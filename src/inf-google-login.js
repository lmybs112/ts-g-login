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
        this.credential = null;
        this.isAuthenticated = false;
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
        this.loadGoogleIdentityServices();
    }
    
    // 處理 localStorage 變更
    handleStorageChange(event) {
        if (event.key === 'google_auth_credential') {
            if (event.newValue) {
                // 其他頁面登入了
                this.credential = event.newValue;
                this.isAuthenticated = true;
                this.handleCredentialResponse({ credential: event.newValue });
            } else {
                // 其他頁面登出了
                this.credential = null;
                this.isAuthenticated = false;
                this.showLoginButton();
                this.updateStatus('其他分頁已登出', 'ready');
            }
        }
    }
    
    // 顯示登入按鈕
    showLoginButton() {
        const buttonContainer = this.shadowRoot.getElementById('google-signin-button');
        if (buttonContainer) {
            buttonContainer.style.display = 'block';
            this.renderSignInButton();
        }
    }
    
    // 隱藏登入按鈕
    hideLoginButton() {
        const buttonContainer = this.shadowRoot.getElementById('google-signin-button');
        if (buttonContainer) {
            buttonContainer.style.display = 'none';
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
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .google-login-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                }
                
                .login-button-wrapper {
                    position: relative;
                }
                
                .status-message {
                    font-size: 14px;
                    color: #666;
                    text-align: center;
                    padding: 8px 12px;
                    border-radius: 4px;
                    background-color: #f8f9fa;
                    border: 1px solid #e0e0e0;
                    max-width: 300px;
                }
                
                .status-loading {
                    color: #007bff;
                    border-color: #007bff;
                    background-color: #e7f3ff;
                }
                
                .status-error {
                    color: #dc3545;
                    border-color: #dc3545;
                    background-color: #ffedef;
                }
                
                .status-success {
                    color: #28a745;
                    border-color: #28a745;
                    background-color: #edf7ee;
                }
                
                /* Google 按鈕容器樣式 */
                #google-signin-button {
                    min-height: 40px;
                    min-width: 200px;
                }
                
                /* 載入動畫 */
                .loading-spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid #f3f3f3;
                    border-top: 2px solid #4285f4;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    display: inline-block;
                    margin-right: 8px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
            
            <div class="google-login-container">
                <div class="login-button-wrapper">
                    <div id="google-signin-button"></div>
                </div>
                <div class="status-message status-loading" id="status-message">
                    <span class="loading-spinner"></span>
                    正在載入 Google 登入服務...
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
                this.handleError('無法載入 Google Identity Services');
            };
            
            // 添加到文檔頭部
            document.head.appendChild(script);
            
        } catch (error) {
            this.handleError('載入 Google 服務時發生錯誤: ' + error.message);
        }
    }
    
    // Google 服務載入完成後的回調
    onGoogleLoaded() {
        this.updateStatus('Google 服務已載入，正在初始化...', 'loading');
        
        // 稍微延遲初始化，確保 Google API 完全準備就緒
        setTimeout(() => {
            this.initializeGoogleSignIn();
        }, 100);
    }
    
    // 初始化 Google Sign-In
    initializeGoogleSignIn() {
        if (!this.clientId) {
            this.handleError('缺少 client-id 屬性，請設置您的 Google OAuth2 客戶端 ID');
            return;
        }
        
        if (!window.google || !window.google.accounts) {
            this.handleError('Google Identity Services 未正確載入');
            return;
        }
        
        try {
            // 初始化 Google Identity Services
            window.google.accounts.id.initialize({
                client_id: this.clientId,
                callback: this.handleCredentialResponse,
                auto_select: this.autoSelect,
                cancel_on_tap_outside: false,
                use_fedcm_for_prompt: true,
                login_uri: this.loginUri || window.location.origin,
                ux_mode: 'popup',
                itp_support: true,
                state_cookie_domain: window.location.hostname
            });
            
            // 渲染登入按鈕
            this.renderSignInButton();
            
            // 如果已經有存儲的憑證，直接觸發登入成功
            if (this.isAuthenticated && this.credential) {
                this.handleCredentialResponse({ credential: this.credential });
            }
            // 否則，如果啟用自動選擇，嘗試自動登入
            else if (this.autoSelect) {
                this.attemptAutoSignIn();
            } else {
                this.updateStatus('請點擊下方按鈕登入', 'ready');
            }
            
        } catch (error) {
            this.handleError('初始化 Google 登入失敗: ' + error.message);
        }
    }
    
    // 渲染 Google 登入按鈕
    renderSignInButton() {
        const buttonContainer = this.shadowRoot.getElementById('google-signin-button');
        
        if (!buttonContainer) {
            console.error('找不到按鈕容器');
            return;
        }
        
        try {
            // 清空容器
            buttonContainer.innerHTML = '';
            
            // 渲染 Google 登入按鈕
            window.google.accounts.id.renderButton(buttonContainer, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left',
                width: 250
            });
            
            console.log('Google 登入按鈕已渲染');
            
        } catch (error) {
            this.handleError('渲染登入按鈕失敗: ' + error.message);
        }
    }
    
    // 嘗試自動登入
    attemptAutoSignIn() {
        try {
            this.updateStatus('檢查登入狀態...', 'loading');
            
            // 使用 Google Identity Services 的 prompt 方法嘗試自動登入
            window.google.accounts.id.prompt((notification) => {
                console.log('Auto sign-in notification:', notification);
                
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    // 沒有可用的自動登入，顯示按鈕
                    this.updateStatus('請點擊下方按鈕登入', 'ready');
                } else if (notification.isDismissedMoment()) {
                    // 用戶取消了自動登入
                    this.updateStatus('請點擊下方按鈕登入', 'ready');
                }
            });
            
        } catch (error) {
            console.warn('自動登入嘗試失敗:', error);
            this.updateStatus('請點擊下方按鈕登入', 'ready');
        }
    }
    
    // 處理 Google 登入回調
    handleCredentialResponse(response) {
        console.log('Google 登入回調收到 credential');
        
        if (!response.credential) {
            this.handleError('未收到有效的登入憑證');
            return;
        }
        
        try {
            // 保存憑證
            this.saveCredential(response.credential);
            
            // 更新狀態
            this.updateStatus('登入成功！', 'success');
            
            // 隱藏登入按鈕
            this.hideLoginButton();
            
            // 觸發成功事件
            this.dispatchEvent(new CustomEvent('google-login-success', {
                detail: {
                    credential: response.credential,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));
            
        } catch (error) {
            this.handleError('處理登入回調失敗: ' + error.message);
        }
    }
    
    // 處理登入失敗
    handleLoginFailure(error) {
        this.handleError('登入失敗: ' + (error.message || error));
        
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
    
    // 處理錯誤
    handleError(message) {
        console.error('Google Login Component Error:', message);
        this.updateStatus(message, 'error');
    }
    
    // 更新狀態訊息
    updateStatus(message, type = 'loading') {
        const statusEl = this.shadowRoot.getElementById('status-message');
        if (!statusEl) return;
        
        // 清除所有狀態類別
        statusEl.className = 'status-message';
        
        // 添加新的狀態類別
        switch (type) {
            case 'loading':
                statusEl.className += ' status-loading';
                statusEl.innerHTML = `<span class="loading-spinner"></span>${message}`;
                break;
            case 'error':
                statusEl.className += ' status-error';
                statusEl.innerHTML = `❌ ${message}`;
                break;
            case 'success':
                statusEl.className += ' status-success';
                statusEl.innerHTML = `✅ ${message}`;
                break;
            case 'ready':
                statusEl.className += ' status-loading';
                statusEl.innerHTML = message;
                break;
            default:
                statusEl.innerHTML = message;
        }
    }
    
    // 清理資源
    cleanup() {
        // 目前沒有特別的清理需求，但保留此方法以備未來使用
        console.log('Google Login Component 已清理');
    }
    
    // 公開方法：手動觸發登入
    signIn() {
        if (window.google && window.google.accounts) {
            window.google.accounts.id.prompt();
        } else {
            this.handleError('Google 服務尚未載入');
        }
    }
    
    // 公開方法：登出
    signOut() {
        if (window.google && window.google.accounts) {
            window.google.accounts.id.disableAutoSelect();
            this.clearCredential();
            
            // 顯示登入按鈕
            this.showLoginButton();
            
            this.updateStatus('已登出', 'ready');
            
            // 觸發登出事件
            this.dispatchEvent(new CustomEvent('google-logout', {
                bubbles: true,
                composed: true
            }));
        }
    }
}

// 註冊 Web Component
if (!customElements.get('google-login')) {
    customElements.define('google-login', GoogleLoginComponent);
    console.log('Google Login Web Component 已註冊');
} else {
    console.warn('Google Login Web Component 已經存在，跳過註冊');
} 