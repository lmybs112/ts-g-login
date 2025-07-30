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
        
        // 點擊外部關閉下拉選單
        document.addEventListener('click', (event) => {
            if (!this.shadowRoot.contains(event.target)) {
                this.hideDropdown();
            }
        });
        
        // 設置登入畫面關閉按鈕
        const closeLoginModal = this.shadowRoot.getElementById('close-login-modal');
        if (closeLoginModal) {
            closeLoginModal.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.hideLoginModal();
            });
        }
        
        // 點擊登入畫面背景關閉
        const loginModal = this.shadowRoot.getElementById('login-modal');
        if (loginModal) {
            loginModal.addEventListener('click', (event) => {
                if (event.target === loginModal) {
                    this.hideLoginModal();
                }
            });
        }
    }
    
    // 處理頭像點擊
    handleAvatarClick() {
        console.log('處理頭像點擊，登入狀態:', this.isAuthenticated);
        
        if (this.isAuthenticated) {
            // 已登入：顯示下拉選單
            console.log('用戶已登入，顯示下拉選單');
            this.toggleDropdown();
        } else {
            // 未登入：顯示登入畫面
            console.log('用戶未登入，顯示登入畫面');
            this.showLoginModal();
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
    
    // 顯示登入畫面
    showLoginModal() {
        const loginModal = this.shadowRoot.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.add('show');
            // 渲染 Google 登入按鈕
            this.renderGoogleLoginButton();
        }
    }
    
    // 隱藏登入畫面
    hideLoginModal() {
        const loginModal = this.shadowRoot.getElementById('login-modal');
        if (loginModal) {
            loginModal.classList.remove('show');
        }
    }
    
    // 渲染 Google 登入按鈕
    renderGoogleLoginButton() {
        const container = this.shadowRoot.getElementById('google-login-button-container');
        if (!container || !window.google || !window.google.accounts) {
            console.warn('無法渲染 Google 登入按鈕：Google 服務未載入');
            return;
        }
        
        try {
            // 清空容器
            container.innerHTML = '';
            
            // 針對 WebKit WebView 的特殊按鈕配置
            const buttonConfig = {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 300
            };
            
            // 在 WebKit WebView 中使用特殊配置
            if (this.isInWebKitWebView()) {
                console.log('在 WebKit WebView 中渲染按鈕，使用特殊配置');
                buttonConfig.type = 'standard';
                buttonConfig.theme = 'filled_blue';
                buttonConfig.size = 'large';
                buttonConfig.text = 'signin_with';
                buttonConfig.shape = 'rectangular';
                buttonConfig.logo_alignment = 'left';
                buttonConfig.width = 300;
                // 確保在 WebKit 中可見
                buttonConfig.click_listener = () => {
                    console.log('WebKit WebView 中的按鈕被點擊');
                    this.triggerGoogleSignIn();
                };
            }
            
            // 渲染 Google 登入按鈕
            window.google.accounts.id.renderButton(container, buttonConfig);
            
            console.log('Google 登入按鈕已渲染（WebKit 相容模式）');
            
            // 在 WebKit WebView 中添加額外的檢查
            if (this.isInWebKitWebView()) {
                setTimeout(() => {
                    const button = container.querySelector('div[role="button"]');
                    if (!button) {
                        console.warn('WebKit WebView 中按鈕未正確渲染，使用備用方案');
                        this.renderFallbackButton(container);
                    } else {
                        console.log('WebKit WebView 中按鈕渲染成功');
                        // 確保按鈕在 iOS WebView 中可見
                        button.style.display = 'block';
                        button.style.visibility = 'visible';
                        button.style.opacity = '1';
                    }
                }, 2000); // 增加等待時間
            }
            
        } catch (error) {
            console.error('渲染 Google 登入按鈕失敗:', error);
            // 如果渲染失敗，顯示備用按鈕
            this.renderFallbackButton(container);
        }
    }
    
    // 渲染備用登入按鈕
    renderFallbackButton(container) {
        container.innerHTML = `
            <button style="
                background-color: #4285f4;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 200px;
                justify-content: center;
            " onclick="this.getRootNode().host.triggerGoogleSignIn()">
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                使用 Google 登入
            </button>
        `;
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
        if (window.google && window.google.accounts) {
            console.log('Google 服務已載入，調用 prompt()');
            
            // 在 WebView 中使用更穩定的方式觸發登入
            try {
                // 先嘗試使用標準的 prompt 方法
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed()) {
                        console.log('Google 登入提示未顯示:', notification.getNotDisplayedReason());
                        // 如果無法顯示，嘗試其他方式
                        this.fallbackGoogleSignIn();
                    } else if (notification.isSkippedMoment()) {
                        console.log('Google 登入被跳過:', notification.getSkippedReason());
                    } else if (notification.isDismissedMoment()) {
                        console.log('Google 登入被取消');
                    }
                });
            } catch (error) {
                console.warn('標準 prompt 方法失敗，使用備用方法:', error);
                this.fallbackGoogleSignIn();
            }
        } else {
            console.error('Google 服務尚未載入');
        }
    }
    
    // 備用 Google 登入方法（適用於 WebView）
    fallbackGoogleSignIn() {
        console.log('使用備用 Google 登入方法');
        try {
            // 在 WebKit WebView 中使用特殊配置
            if (window.google && window.google.accounts && window.google.accounts.id) {
                const config = {
                    client_id: this.clientId,
                    callback: this.handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: false,
                    context: 'signin',
                    select_account: true
                };
                
                // WebKit WebView 特殊配置
                if (this.isInWebKitWebView()) {
                    config.use_fedcm_for_prompt = false;
                    config.ux_mode = 'popup';
                    config.prompt = 'select_account';
                    config.state_cookie_domain = window.location.hostname;
                } else {
                    config.use_fedcm_for_prompt = true;
                }
                
                // 重新初始化
                window.google.accounts.id.initialize(config);
                
                // 延遲一下再觸發，確保初始化完成
                setTimeout(() => {
                    try {
                        window.google.accounts.id.prompt((notification) => {
                            if (notification.isNotDisplayed()) {
                                console.log('備用方法也無法顯示:', notification.getNotDisplayedReason());
                                // 最後嘗試直接調用
                                this.triggerDirectGoogleSignIn();
                            }
                        });
                    } catch (error) {
                        console.warn('備用 prompt 失敗，嘗試直接調用:', error);
                        this.triggerDirectGoogleSignIn();
                    }
                }, 200);
            }
        } catch (error) {
            console.error('備用登入方法也失敗:', error);
            this.handleLoginFailure(error);
        }
    }
    
    // 直接觸發 Google 登入（最後手段）
    triggerDirectGoogleSignIn() {
        console.log('使用直接觸發方法');
        try {
            // 創建一個隱藏的 iframe 來觸發 Google 登入
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = `https://accounts.google.com/gsi/select?client_id=${this.clientId}&ux_mode=popup&context=signin&prompt=select_account`;
            
            iframe.onload = () => {
                console.log('Google 登入 iframe 已載入');
            };
            
            document.body.appendChild(iframe);
            
            // 5秒後移除 iframe
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 5000);
            
        } catch (error) {
            console.error('直接觸發方法失敗:', error);
            this.handleLoginFailure(error);
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
                
                /* 登入畫面樣式 */
                .login-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: none;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                }
                
                .login-modal.show {
                    display: flex;
                }
                
                .login-container {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 400px;
                    width: 90%;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                }
                
                .login-header {
                    margin-bottom: 25px;
                }
                
                .login-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 10px;
                }
                
                .login-subtitle {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 20px;
                }
                
                .google-login-button-container {
                    margin: 20px 0;
                    display: flex;
                    justify-content: center;
                }
                
                .close-button {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                    padding: 5px;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .close-button:hover {
                    background-color: #f0f0f0;
                    color: #333;
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
            
            <!-- 登入畫面 -->
            <div class="login-modal" id="login-modal">
                <div class="login-container">
                    <button class="close-button" id="close-login-modal">×</button>
                    
                    <div class="login-header">
                        <div class="login-title">歡迎回來</div>
                        <div class="login-subtitle">請選擇您的登入方式</div>
                    </div>
                    
                    <div class="google-login-button-container" id="google-login-button-container">
                        <!-- Google 登入按鈕將在這裡渲染 -->
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
                console.error('無法載入 Google Identity Services');
                this.handleLoginFailure('無法載入 Google Identity Services');
            };
            
            // 添加到文檔頭部
            document.head.appendChild(script);
            
            // WebKit WebView 特殊處理
            if (this.isInWebKitWebView()) {
                console.log('檢測到 WebKit WebView 環境，使用特殊載入策略');
                
                // 在 iOS WebView 中，需要更長的時間來確保腳本完全載入
                const checkInterval = setInterval(() => {
                    if (window.google && window.google.accounts) {
                        this.isGoogleLoaded = true;
                        this.onGoogleLoaded();
                        clearInterval(checkInterval);
                        console.log('WebKit WebView 中 Google 服務載入成功');
                    }
                }, 500);
                
                // 設置超時檢查
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!this.isGoogleLoaded) {
                        console.warn('WebKit WebView 中 Google 服務載入超時，嘗試重新載入');
                        this.retryLoadGoogleServices();
                    }
                }, 10000);
                
            } else if (this.isInWebView()) {
                console.log('檢測到一般 WebView 環境，使用標準載入策略');
                setTimeout(() => {
                    if (!this.isGoogleLoaded && window.google && window.google.accounts) {
                        this.isGoogleLoaded = true;
                        this.onGoogleLoaded();
                    }
                }, 1000);
            }
            
        } catch (error) {
            console.error('載入 Google 服務時發生錯誤:', error);
            this.handleLoginFailure('載入 Google 服務時發生錯誤: ' + error.message);
        }
    }
    
    // 重試載入 Google 服務
    retryLoadGoogleServices() {
        console.log('重試載入 Google 服務');
        try {
            // 移除現有的腳本
            const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
            if (existingScript) {
                existingScript.remove();
            }
            
            // 重新載入
            this.loadGoogleIdentityServices();
        } catch (error) {
            console.error('重試載入失敗:', error);
            this.handleLoginFailure('重試載入失敗: ' + error.message);
        }
    }
    
    // 檢測是否在 WebView 中
    isInWebView() {
        const userAgent = navigator.userAgent.toLowerCase();
        return (
            userAgent.includes('wv') || // Android WebView
            userAgent.includes('mobile') && userAgent.includes('safari') && !userAgent.includes('chrome') || // iOS WebView
            userAgent.includes('webview') || // 其他 WebView
            window.ReactNativeWebView || // React Native WebView
            window.webkit && window.webkit.messageHandlers // iOS WKWebView
        );
    }
    
    // 檢測是否在 WebKit WebView 中
    isInWebKitWebView() {
        const userAgent = navigator.userAgent.toLowerCase();
        return (
            // iOS WKWebView - 更精確的檢測
            (userAgent.includes('iphone') || userAgent.includes('ipad')) && userAgent.includes('webkit') ||
            // iOS Safari WebView
            (userAgent.includes('mobile') && userAgent.includes('safari') && !userAgent.includes('chrome')) ||
            // 明確的 WebKit WebView
            userAgent.includes('webkit') && (userAgent.includes('mobile') || userAgent.includes('ipad') || userAgent.includes('iphone')) ||
            // WKWebView 特定檢測
            window.webkit && window.webkit.messageHandlers ||
            // 其他 WebKit 環境
            userAgent.includes('webkit') && !userAgent.includes('chrome') ||
            // iOS 原生 WebView 檢測
            (userAgent.includes('iphone') || userAgent.includes('ipad')) && userAgent.includes('mozilla')
        );
    }
    
    // Google 服務載入完成後的回調
    onGoogleLoaded() {
        console.log('Google Identity Services 已載入');
        
        if (!this.clientId) {
            console.error('缺少 client-id 屬性，請設置您的 Google OAuth2 客戶端 ID');
            return;
        }
        
        try {
            // 初始化 Google Identity Services - 針對 WebKit WebView 優化
            const config = {
                client_id: this.clientId,
                callback: this.handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: false,
                // WebKit WebView 特殊配置
                use_fedcm_for_prompt: false, // WebKit 中禁用 FedCM
                prompt_parent_id: null,
                redirect_uri: null,
                context: 'signin',
                itp_support: true,
                select_account: true,
                // WebKit WebView 額外配置
                state_cookie_domain: window.location.hostname,
                ux_mode: 'popup', // 強制使用彈出模式
                // 確保在 WebKit 中正常工作
                hosted_domain: null,
                login_hint: null,
                prompt: 'select_account'
            };
            
            // 在 WebKit WebView 中使用特殊配置
            if (this.isInWebKitWebView()) {
                console.log('檢測到 WebKit WebView，使用特殊配置');
                config.use_fedcm_for_prompt = false;
                config.ux_mode = 'popup';
                config.prompt = 'select_account';
            }
            
            window.google.accounts.id.initialize(config);
            
            console.log('Google Identity Services 初始化完成（WebKit WebView 相容模式）');
            
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
            
            // 隱藏登入畫面
            this.hideLoginModal();
            
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
    
    // 公開方法：登出
    signOut() {
        if (window.google && window.google.accounts) {
            try {
                // 在 WebView 中使用更安全的登出方式
                window.google.accounts.id.disableAutoSelect();
                // 清除 Google 的會話狀態
                window.google.accounts.id.revoke(this.clientId, () => {
                    console.log('Google 會話已撤銷');
                });
            } catch (error) {
                console.warn('Google 登出清理失敗:', error);
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