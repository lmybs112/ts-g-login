/**
 * infFITS Google OAuth2 登入 Web Component
 * 支援 Google Identity Services (GIS) 的現代化登入流程
 * 
 * 功能特色：
 * - Shadow DOM 封裝
 * - 自動登入判斷
 * - 登入狀態持久化
 * - 事件驅動架構
 * - 支援任何框架或原生 JavaScript
 */
class GoogleLoginComponent extends HTMLElement {
    constructor() {
        super();
        
        // 建立 Shadow DOM
        this.attachShadow({ mode: 'open' });
        
        // 組件狀態
        this.isGoogleLoaded = false;
        this.clientId = null;
        this.autoSelect = true;
        this.loginUri = null;
        this.isAuthenticated = false;
        this.credential = null;
        
        // 綁定方法到 this 上下文
        this.handleCredentialResponse = this.handleCredentialResponse.bind(this);
        this.handleLoginFailure = this.handleLoginFailure.bind(this);
        this.handleStorageChange = this.handleStorageChange.bind(this);
        
        // 檢查本地存儲的憑證
        this.checkStoredCredential();
        
        // 監聽 localStorage 變更
        window.addEventListener('storage', this.handleStorageChange);
    }
    
    // 檢查存儲的憑證
    checkStoredCredential() {
        const storedCredential = localStorage.getItem('google_auth_credential');
        if (storedCredential) {
            this.credential = storedCredential;
            this.isAuthenticated = true;
            this.getUserInfo(); // 載入用戶資訊
        }
    }

    // 保存憑證
    saveCredential(credential) {
        if (credential) {
            localStorage.setItem('google_auth_credential', credential);
            this.credential = credential;
            this.isAuthenticated = true;
        }
    }

    // 清除憑證
    clearCredential() {
        localStorage.removeItem('google_auth_credential');
        localStorage.removeItem('google_user_info');
        localStorage.removeItem('inffits_api_response'); // 清除 API 回應數據
        this.credential = null;
        this.userInfo = null;
        this.isAuthenticated = false;
        this.apiResponse = null;
        this.updateAvatar();
    }
    
    // 保存用戶資訊
    saveUserInfo(userInfo) {
        if (userInfo) {
            localStorage.setItem('google_user_info', JSON.stringify(userInfo));
            this.userInfo = userInfo;
            this.updateAvatar();
        }
    }

    // 獲取用戶資訊
    getUserInfo() {
        if (!this.userInfo) {
            const stored = localStorage.getItem('google_user_info');
            if (stored) {
                this.userInfo = JSON.parse(stored);
            }
        }
        return this.userInfo;
    }
    
    // 更新頭像顯示
    updateAvatar() {
        const defaultAvatar = this.shadowRoot.getElementById('default-avatar');
        const avatarImage = this.shadowRoot.getElementById('avatar-image');
        
        if (this.isAuthenticated && this.userInfo && this.userInfo.picture) {
            // 顯示用戶頭像
            avatarImage.src = this.userInfo.picture;
            avatarImage.style.display = 'block';
            defaultAvatar.style.display = 'none';
        } else {
            // 顯示預設頭像
            avatarImage.style.display = 'none';
            defaultAvatar.style.display = 'flex';
        }
        
        // 隱藏下拉選單（如果用戶登出）
        if (!this.isAuthenticated) {
            this.hideDropdown();
        }
    }
    
    // 解析 Google 憑證
    parseCredential(credential) {
        try {
            // JWT 憑證格式：header.payload.signature
            const parts = credential.split('.');
            if (parts.length !== 3) {
                throw new Error('無效的 JWT 格式');
            }
            
            // 解碼 payload 部分
            const payload = JSON.parse(atob(parts[1]));
            
            return {
                sub: payload.sub,
                name: payload.name,
                given_name: payload.given_name,
                family_name: payload.family_name,
                picture: payload.picture,
                email: payload.email,
                email_verified: payload.email_verified,
                locale: payload.locale
            };
        } catch (error) {
            console.error('解析 Google 憑證失敗:', error);
            return null;
        }
    }
    
    // 監聽的屬性變更
    static get observedAttributes() {
        return ['client-id', 'auto-select', 'data-client-id', 'data-auto-select', 'data-login-uri'];
    }
    
    // 屬性變更回調
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            switch (name) {
                case 'client-id':
                case 'data-client-id':
                    this.clientId = newValue;
                    break;
                case 'auto-select':
                case 'data-auto-select':
                    this.autoSelect = newValue === 'true';
                    break;
                case 'data-login-uri':
                    this.loginUri = newValue;
                    break;
            }
            
            // 如果組件已連接且 Google 已載入，重新初始化
            if (this.isConnected && this.isGoogleLoaded) {
                this.initializeGoogleSignIn();
            }
        }
    }
    
    // 組件掛載到 DOM 時
    connectedCallback() {
        this.render();
        this.updateAvatar(); // 初始化頭像顯示
        this.setupEventListeners(); // 在 DOM 渲染後設置事件監聽器
        this.loadGoogleIdentityServices();
    }
    
    // 設置事件監聽器
    setupEventListeners() {
        const avatarContainer = this.shadowRoot.getElementById('avatar-container');
        const dropdownMenu = this.shadowRoot.getElementById('dropdown-menu');
        const profileItem = this.shadowRoot.getElementById('profile-item');
        const logoutItem = this.shadowRoot.getElementById('logout-item');
        
        if (avatarContainer) {
            console.log('設置頭像點擊事件監聽器');
            avatarContainer.addEventListener('click', (event) => {
                console.log('頭像被點擊');
                event.preventDefault();
                event.stopPropagation();
                this.handleAvatarClick();
            });
        } else {
            console.error('找不到頭像容器元素');
        }
        
        // 設置下拉選單項目點擊事件
        if (profileItem) {
            profileItem.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                console.log('點擊個人資料');
                this.navigateToProfile();
                this.hideDropdown();
            });
        }
        
        if (logoutItem) {
            logoutItem.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                console.log('點擊登出');
                this.signOut();
                this.hideDropdown();
            });
        }
        
        // 點擊外部關閉下拉選單（WebView 環境下可能不支援，使用更寬鬆的檢測）
        this.setupOutsideClickHandler();
    }
    
    // 設置外部點擊處理器（WebView 相容）
    setupOutsideClickHandler() {
        // 使用 setTimeout 確保在當前事件循環後執行
        setTimeout(() => {
            document.addEventListener('click', (event) => {
                // 檢查點擊是否在組件外部
                if (!this.shadowRoot.contains(event.target)) {
                    this.hideDropdown();
                }
            }, true); // 使用捕獲階段
            
            // WebView 環境下，也監聽 touchstart 事件
            document.addEventListener('touchstart', (event) => {
                if (!this.shadowRoot.contains(event.target)) {
                    this.hideDropdown();
                }
            }, true);
        }, 0);
    }
    
    // 處理頭像點擊
    handleAvatarClick() {
        console.log('處理頭像點擊，登入狀態:', this.isAuthenticated);
        
        if (this.isAuthenticated) {
            // 已登入：顯示下拉選單
            console.log('用戶已登入，顯示下拉選單');
            this.toggleDropdown();
        } else {
            // 未登入：觸發 Google 登入
            console.log('用戶未登入，觸發 Google 登入');
            this.triggerGoogleSignIn();
        }
    }
    
    // 切換下拉選單顯示
    toggleDropdown() {
        const dropdownMenu = this.shadowRoot.getElementById('dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.toggle('show');
        }
    }
    
    // 隱藏下拉選單
    hideDropdown() {
        const dropdownMenu = this.shadowRoot.getElementById('dropdown-menu');
        if (dropdownMenu) {
            dropdownMenu.classList.remove('show');
        }
    }
    
    // 進入個人資料頁
    navigateToProfile() {
        // 觸發事件，讓父組件處理導航
        this.dispatchEvent(new CustomEvent('navigate-to-profile', {
            detail: {
                user: this.getUserInfo(),
                apiResponse: this.getApiResponse()
            },
            bubbles: true,
            composed: true
        }));
    }
    
    // 觸發 Google 登入
    triggerGoogleSignIn() {
        console.log('觸發 Google 登入');
        
        // 檢查是否在 WebView 環境
        if (this.detectWebView()) {
            console.log('WebView 環境下觸發登入');
            this.handleWebViewFallback();
            return;
        }
        
        if (window.google && window.google.accounts) {
            console.log('Google 服務已載入，調用 prompt()');
            try {
                window.google.accounts.id.prompt();
            } catch (error) {
                console.error('Google prompt() 調用失敗:', error);
                // 如果 prompt() 失敗，嘗試備用方案
                this.handleWebViewFallback();
            }
        } else {
            console.error('Google 服務尚未載入');
            // 等待一段時間後重試
            setTimeout(() => {
                if (window.google && window.google.accounts) {
                    this.triggerGoogleSignIn();
                } else {
                    this.handleWebViewFallback();
                }
            }, 1000);
        }
    }
    
    // 處理 localStorage 變更
    handleStorageChange(event) {
        if (event.key === 'google_auth_credential') {
            if (event.newValue) {
                // 其他頁面登入了
                this.credential = event.newValue;
                this.isAuthenticated = true;
                this.getUserInfo();
                this.updateAvatar();
            } else {
                // 其他頁面登出了
                this.credential = null;
                this.isAuthenticated = false;
                this.userInfo = null;
                this.updateAvatar();
            }
        }
    }

    // 組件從 DOM 移除時
    disconnectedCallback() {
        // 移除 localStorage 監聽器
        window.removeEventListener('storage', this.handleStorageChange);
        this.cleanup();
    }
    
    // 渲染組件內容
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    cursor: pointer;
                }
                
                .avatar-container {
                    position: relative;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 2px solid #e0e0e0;
                    transition: border-color 0.3s ease;
                }
                
                .avatar-container:hover {
                    border-color: #4285f4;
                }
                
                .avatar-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .default-avatar {
                    width: 100%;
                    height: 100%;
                    background-color: #f0f0f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    font-size: 16px;
                    font-weight: bold;
                }
                
                .dropdown-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    min-width: 150px;
                    z-index: 1000;
                    display: none;
                    margin-top: 5px;
                }
                
                .dropdown-menu.show {
                    display: block;
                }
                
                .dropdown-item {
                    padding: 10px 15px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                }
                
                .dropdown-item:last-child {
                    border-bottom: none;
                }
                
                .dropdown-item:hover {
                    background-color: #f8f9fa;
                }
                
                .dropdown-item.logout {
                    color: #dc3545;
                }
                
                .dropdown-item.logout:hover {
                    background-color: #f8d7da;
                }
            </style>
            
            <div class="avatar-container" id="avatar-container">
                <div class="default-avatar" id="default-avatar">👤</div>
                <img class="avatar-image" id="avatar-image" style="display: none;" alt="用戶頭像">
                <div class="dropdown-menu" id="dropdown-menu">
                    <div class="dropdown-item" id="profile-item">
                        👤 個人資料
                    </div>
                    <div class="dropdown-item logout" id="logout-item">
                        🚪 登出
                    </div>
                </div>
            </div>
        `;
    }
    
    // 載入 Google Identity Services
    async loadGoogleIdentityServices() {
        try {
            // 檢查是否已經載入
            if (window.google && window.google.accounts) {
                this.isGoogleLoaded = true;
                this.onGoogleLoaded();
                return;
            }
            
            // 檢查是否在 WebView 環境
            const isWebView = this.detectWebView();
            console.log('WebView 檢測結果:', isWebView);
            
            // 動態載入 Google Identity Services 腳本
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            
            // 腳本載入成功
            script.onload = () => {
                this.isGoogleLoaded = true;
                this.onGoogleLoaded();
            };
            
            // 腳本載入失敗
            script.onerror = () => {
                console.error('Google Identity Services 載入失敗');
                if (isWebView) {
                    // WebView 環境下，嘗試使用備用方案
                    this.handleWebViewFallback();
                } else {
                    this.handleError('無法載入 Google Identity Services');
                }
            };
            
            // 添加到文檔頭部
            document.head.appendChild(script);
            
            // WebView 環境下設置超時處理
            if (isWebView) {
                setTimeout(() => {
                    if (!this.isGoogleLoaded) {
                        console.warn('WebView 環境下 Google 服務載入超時，使用備用方案');
                        this.handleWebViewFallback();
                    }
                }, 5000); // 5秒超時
            }
            
        } catch (error) {
            console.error('載入 Google 服務時發生錯誤:', error);
            if (this.detectWebView()) {
                this.handleWebViewFallback();
            } else {
                this.handleError('載入 Google 服務時發生錯誤: ' + error.message);
            }
        }
    }
    
    // 檢測是否在 WebView 環境
    detectWebView() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        // 檢測常見的 WebView 標識
        const webViewPatterns = [
            'wv', // Android WebView
            'webview',
            'mobile safari',
            'safari/',
            'chrome/',
            'firefox/',
            'edge/',
            'opera/',
            'ucbrowser',
            'micromessenger', // 微信內建瀏覽器
            'qq/', // QQ 內建瀏覽器
            'alipay', // 支付寶內建瀏覽器
            'baiduboxapp', // 百度 App 內建瀏覽器
            'toutiao', // 今日頭條內建瀏覽器
            'weibo', // 微博內建瀏覽器
        ];
        
        const isWebView = webViewPatterns.some(pattern => userAgent.includes(pattern));
        
        // 額外檢測：檢查是否在 iframe 中
        const isInIframe = window !== window.top;
        
        return isWebView || isInIframe;
    }
    
    // WebView 環境下的備用處理方案
    handleWebViewFallback() {
        console.log('使用 WebView 備用方案');
        
        // 觸發事件通知父組件或原生應用
        this.dispatchEvent(new CustomEvent('webview-google-login', {
            detail: {
                clientId: this.clientId,
                action: 'login',
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        }));
        
        // 顯示提示訊息
        this.showWebViewMessage('請在原生應用中完成 Google 登入');
    }
    
    // 顯示 WebView 提示訊息
    showWebViewMessage(message) {
        // 創建提示元素
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            text-align: center;
            max-width: 80%;
        `;
        messageEl.textContent = message;
        
        document.body.appendChild(messageEl);
        
        // 3秒後自動移除
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 3000);
    }
    
    // Google 服務載入完成後的回調
    onGoogleLoaded() {
        console.log('Google Identity Services 已載入');
        
        if (!this.clientId) {
            console.error('缺少 client-id 屬性，請設置您的 Google OAuth2 客戶端 ID');
            return;
        }
        
        try {
            // 初始化 Google Identity Services
            window.google.accounts.id.initialize({
                client_id: this.clientId,
                callback: this.handleCredentialResponse,
                auto_select: false, // 不自動選擇，讓用戶點擊頭像觸發
                cancel_on_tap_outside: false
            });
            
            console.log('Google Identity Services 初始化完成');
            
        } catch (error) {
            console.error('初始化 Google 登入失敗:', error);
        }
    }
    
    // 處理 Google 登入回調
    async handleCredentialResponse(response) {
        console.log('Google 登入回調收到 credential');
        
        if (!response.credential) {
            this.handleError('未收到有效的登入憑證');
            return;
        }
        
        try {
            // 解析 Google 憑證獲取用戶資訊
            const payload = this.parseCredential(response.credential);
            if (payload) {
                this.saveUserInfo(payload);
            }
            
            // 保存憑證
            this.saveCredential(response.credential);
            
            // 調用 infFITS API
            await this.callInfFitsAPI(response.credential);
            
            // 觸發成功事件
            this.dispatchEvent(new CustomEvent('google-login-success', {
                detail: {
                    credential: response.credential,
                    user: payload,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));
            
        } catch (error) {
            this.handleError('處理登入回調失敗: ' + error.message);
        }
    }
    
    // 調用 infFITS API
    async callInfFitsAPI(credential) {
        try {
            console.log('🔄 調用 infFITS API...');
            
            const payload = {
                credential: credential,
                IDTYPE: "Google"  // ✅ 關鍵欄位：Lambda 會根據它分辨平台
            };
            
            const response = await fetch("https://api.inffits.com/inffits_account_register_and_retrieve_data/model", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log("✅ infFITS API 回應:", data);
            
            // 保存 API 回應數據
            this.saveApiResponse(data);
            
            return data;
            
        } catch (error) {
            console.error("❌ 調用 infFITS API 失敗:", error);
            throw error;
        }
    }
    
    // 保存 API 回應數據
    saveApiResponse(data) {
        try {
            localStorage.setItem('inffits_api_response', JSON.stringify(data));
            this.apiResponse = data;
        } catch (error) {
            console.warn('保存 API 回應數據失敗:', error);
        }
    }
    
    // 獲取 API 回應數據
    getApiResponse() {
        if (!this.apiResponse) {
            const stored = localStorage.getItem('inffits_api_response');
            if (stored) {
                this.apiResponse = JSON.parse(stored);
            }
        }
        return this.apiResponse;
    }
    
    // 處理登入失敗
    handleLoginFailure(error) {
        console.error('Google 登入失敗:', error);
        
        // 觸發失敗事件
        this.dispatchEvent(new CustomEvent('google-login-failure', {
            detail: {
                error: error.message || error,
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        }));
    }
    
    // 清理資源
    cleanup() {
        console.log('Google Login Component 已清理');
    }
    
    // 公開方法：手動觸發登入
    signIn() {
        this.triggerGoogleSignIn();
    }
    
    // 公開方法：處理 WebView 登入結果（由原生應用調用）
    handleWebViewLoginResult(credential, userInfo) {
        console.log('收到 WebView 登入結果:', { credential, userInfo });
        
        try {
            // 保存憑證和用戶資訊
            this.saveCredential(credential);
            this.saveUserInfo(userInfo);
            
            // 調用 infFITS API
            this.callInfFitsAPI(credential);
            
            // 觸發登入成功事件
            this.dispatchEvent(new CustomEvent('google-login-success', {
                detail: {
                    credential: credential,
                    user: userInfo,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));
            
        } catch (error) {
            console.error('處理 WebView 登入結果失敗:', error);
            this.handleLoginFailure(error);
        }
    }
    
    // 公開方法：處理 WebView 登入失敗（由原生應用調用）
    handleWebViewLoginFailure(error) {
        console.error('WebView 登入失敗:', error);
        this.handleLoginFailure(error);
    }
    
    // 公開方法：登出
    signOut() {
        // 檢查是否在 WebView 環境
        if (this.detectWebView()) {
            console.log('WebView 環境下觸發登出');
            // 觸發 WebView 登出事件
            this.dispatchEvent(new CustomEvent('webview-google-logout', {
                detail: {
                    action: 'logout',
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));
        }
        
        if (window.google && window.google.accounts) {
            try {
                window.google.accounts.id.disableAutoSelect();
            } catch (error) {
                console.warn('Google disableAutoSelect() 調用失敗:', error);
            }
        }
        
        this.clearCredential();
        
        // 觸發登出事件
        this.dispatchEvent(new CustomEvent('google-logout', {
            bubbles: true,
            composed: true
        }));
    }
}

// 註冊 Web Component
if (!customElements.get('google-login')) {
    customElements.define('google-login', GoogleLoginComponent);
    console.log('Google Login Web Component 已註冊');
} else {
    console.warn('Google Login Web Component 已經存在，跳過註冊');
} 