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
class InfGoogleLoginComponent extends HTMLElement {
    constructor() {
        super();

        // 建立 Shadow DOM
        this.attachShadow({
            mode: 'open'
        });

        // 組件狀態
        this.isGoogleLoaded = false;
        this.clientId = null;
        this.autoSelect = true;
        this.loginUri = null;
        this.isAuthenticated = false;
        this.credential = null;
        this.targetContainerId = null; // 新增：目標容器 ID
        this.apiRefreshInProgress = false; // 防止重複調用 API
        this.modalContainerStyle = null; // 新增：模態框容器樣式配置

        // 靜態屬性：全局 API 刷新控制（所有實例共享）
        InfGoogleLoginComponent.lastApiRefreshTime = InfGoogleLoginComponent.lastApiRefreshTime || 0;

        // 添加 timeout 追蹤器，用於清理
        this.activeTimeouts = new Set();
        this.activeIntervals = new Set();

        // 監聽 localStorage 變化
        window.addEventListener('storage', this.handleStorageChange.bind(this));

        // 綁定方法到 this 上下文
        this.handleCredentialResponse = this.handleCredentialResponse.bind(this);
        this.handleLoginFailure = this.handleLoginFailure.bind(this);
        this.handleStorageChange = this.handleStorageChange.bind(this);

        // 檢查本地存儲的憑證（初始化時不刷新 API，等到掛載時再刷新）
        this.checkStoredCredential(false);
    }

    // 安全的 timeout 包裝器
    safeSetTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            this.activeTimeouts.delete(timeoutId);
            callback();
        }, delay);
        this.activeTimeouts.add(timeoutId);
        return timeoutId;
    }

    // 安全的 interval 包裝器
    safeSetInterval(callback, delay) {
        const intervalId = setInterval(callback, delay);
        this.activeIntervals.add(intervalId);
        return intervalId;
    }

    // 清理所有活動的 timeout 和 interval
    clearAllTimers() {
        this.activeTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.activeTimeouts.clear();

        this.activeIntervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.activeIntervals.clear();
    }

    // 等待動畫完成的 Promise
    waitForAnimation(element, animationName) {
        return new Promise((resolve) => {
            const handleAnimationEnd = (event) => {
                if (event.animationName === animationName) {
                    element.removeEventListener('animationend', handleAnimationEnd);
                    resolve();
                }
            };

            element.addEventListener('animationend', handleAnimationEnd);

            // 如果動畫已經完成，立即 resolve
            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.animationPlayState === 'finished' ||
                !computedStyle.animationName ||
                computedStyle.animationName === 'none') {
                resolve();
            }
        });
    }

    // 設置模態框容器樣式
    setModalContainerStyle(style) {
        this.modalContainerStyle = style;
    }

    // 獲取當前適用的樣式（響應式）
    getCurrentStyle(styleConfig) {
        if (!styleConfig) return null;

        const isDesktop = window.innerWidth >= 480;

        if (typeof styleConfig === 'object' && styleConfig.desktop && styleConfig.mobile) {
            // 新的響應式格式
            return isDesktop ? styleConfig.desktop : styleConfig.mobile;
        } else {
            // 向後兼容：舊的單一樣式格式
            return styleConfig;
        }
    }

    // 等待 Google 服務載入的 Promise
    waitForGoogleServices() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                resolve();
                return;
            }

            // 檢查是否已經在載入中
            if (window.googleLoadingPromise) {
                window.googleLoadingPromise.then(resolve).catch(reject);
                return;
            }

            // 創建載入 Promise
            window.googleLoadingPromise = new Promise((innerResolve, innerReject) => {
                const maxWaitTime = 10000; // 10秒超時
                const checkInterval = 100;
                let elapsedTime = 0;

                const checkGoogle = () => {
                    if (window.google && window.google.accounts && window.google.accounts.id) {
                        innerResolve();
                        return;
                    }

                    elapsedTime += checkInterval;
                    if (elapsedTime >= maxWaitTime) {
                        innerReject(new Error('Google 服務載入超時'));
                        return;
                    }

                    this.safeSetTimeout(checkGoogle, checkInterval);
                };

                checkGoogle();
            });

            window.googleLoadingPromise.then(resolve).catch(reject);
        });
    }

    // 檢查存儲的憑證
    async checkStoredCredential(shouldRefreshApi = false) {
        console.log('🔍 checkStoredCredential 開始檢查...');
        
        // 首先檢查是否有 JWT 憑證（Google One Tap）
        const jwtCredential = localStorage.getItem('google_auth_credential');
        
        if (jwtCredential) {
            console.log('🔍 找到 JWT 憑證，使用 JWT 登入');
            this.credential = jwtCredential;
            this.isAuthenticated = true;
            this.getUserInfo(); // 載入用戶資訊

            if (shouldRefreshApi) {
                // 只在頁面刷新時重新取得最新的個人資料
                this.refreshApiData();
            } else {
                // 其他情況使用本地快取的 API 資料
                this.getApiResponse();
            }
            return;
        }
        
        // 如果沒有 JWT 憑證，檢查是否有有效的 access token（OAuth2）
        const accessToken = await this.getValidAccessToken();
        
        if (accessToken) {
            console.log('🔍 找到 OAuth2 access token，使用 OAuth2 登入');
            // 創建 credential 格式
            this.credential = `oauth2_${accessToken}`;
            this.isAuthenticated = true;
            this.getUserInfo(); // 載入用戶資訊

            if (shouldRefreshApi) {
                // 只在頁面刷新時重新取得最新的個人資料
                this.refreshApiData();
            } else {
                // 其他情況使用本地快取的 API 資料
                this.getApiResponse();
            }
        } else {
            console.log('🔍 沒有找到任何有效的憑證');
            // 如果沒有有效的 token，清除所有狀態
            this.credential = null;
            this.isAuthenticated = false;
            this.clearTokens();
        }
    }

    // 刷新 API 資料以確保個人資料為最新
    async refreshApiData() {
        if (!this.credential) {
            console.warn('無憑證，無法刷新 API 資料');
            return;
        }

        // 全局防重複調用：如果 5 秒內已經調用過，就跳過
        const now = Date.now();
        if (now - InfGoogleLoginComponent.lastApiRefreshTime < 5000) {

            // 仍然載入本地快取的資料
            this.getApiResponse();
            return;
        }

        // 實例級別防重複調用
        if (this.apiRefreshInProgress) {

            return;
        }

        try {
            this.apiRefreshInProgress = true;
            InfGoogleLoginComponent.lastApiRefreshTime = now;


            // 重新調用 API 獲取最新資料
            const freshApiData = await this.callInfFitsAPI(this.credential);

            if (freshApiData) {

                // 觸發資料更新事件
                this.dispatchEvent(new CustomEvent('api-data-refreshed', {
                    detail: {
                        apiResponse: freshApiData,
                        timestamp: new Date().toISOString()
                    },
                    bubbles: true,
                    composed: true
                }));
            }
        } catch (error) {
            console.warn('⚠️ 刷新個人資料失敗，使用本地快取資料:', error);

            // 🔐 如果是憑證失效錯誤（401），不載入本地快取，因為用戶已被登出
            if (error.message && error.message.includes('憑證已失效')) {

                return;
            }

            // 如果是其他錯誤，仍然載入本地的 API 回應數據
            this.getApiResponse();
        } finally {
            // 重置標記，但延遲一段時間以避免短時間內重複調用
            setTimeout(() => {
                this.apiRefreshInProgress = false;
            }, 1000);
        }
    }

    // 保存憑證
    saveCredential(credential) {
        if (credential) {
            const oldCredential = this.credential;
            localStorage.setItem('google_auth_credential', credential);
            this.credential = credential;
            this.isAuthenticated = true;

            console.log('🔍 saveCredential 調用:', {
                oldCredential: oldCredential ? oldCredential.substring(0, 50) + '...' : null,
                newCredential: credential.substring(0, 50) + '...',
                isAuthenticated: this.isAuthenticated
            });

            // 觸發 localStorage 更新事件
            this.dispatchEvent(new CustomEvent('localStorage-updated', {
                detail: {
                    key: 'google_auth_credential',
                    value: credential
                },
                bubbles: true,
                composed: true
            }));

            // 觸發 storage 事件，通知其他組件實例
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'google_auth_credential',
                newValue: credential,
                oldValue: oldCredential,
                storageArea: localStorage
            }));
        }
    }

    // 清除憑證
    clearCredential() {
        const oldCredential = this.credential;
        localStorage.removeItem('google_auth_credential');
        localStorage.removeItem('google_user_info');
        localStorage.removeItem('inffits_api_response'); // 清除 API 回應數據
        this.credential = null;
        this.userInfo = null;
        this.isAuthenticated = false;
        this.apiResponse = null;
        this.updateAvatar();

        // 觸發 localStorage 更新事件
        this.dispatchEvent(new CustomEvent('localStorage-updated', {
            detail: {
                key: 'google_auth_credential',
                value: null
            },
            bubbles: true,
            composed: true
        }));
    }

    // 保存用戶資訊
    saveUserInfo(userInfo) {
        if (userInfo) {
            localStorage.setItem('google_user_info', JSON.stringify(userInfo));
            this.userInfo = userInfo;
            this.updateAvatar();

            // 觸發 localStorage 更新事件
            this.dispatchEvent(new CustomEvent('localStorage-updated', {
                detail: {
                    key: 'google_user_info',
                    value: userInfo
                },
                bubbles: true,
                composed: true
            }));
        }
    }

    // 獲取用戶資訊
    getUserInfo() {
        if (!this.userInfo) {
            const stored = localStorage.getItem('google_user_info');
            if (stored) {
                try {
                    this.userInfo = JSON.parse(stored);
                } catch (error) {
                    console.warn('解析用戶資訊失敗:', error);
                    this.userInfo = null;
                }
            }
        }
        return this.userInfo;
    }

    // 更新頭像顯示
    updateAvatar() {
        const defaultAvatar = this.shadowRoot.getElementById('default-avatar');
        const avatarImage = this.shadowRoot.getElementById('avatar-image');

        // 檢查 Google Identity Services 是否已載入
        if (!this.isGoogleLoaded) {
            // 如果 Google 服務未載入，隱藏整個頭像容器
            const avatarContainer = this.shadowRoot.getElementById('avatar-container');
            if (avatarContainer) {
                avatarContainer.style.display = 'none';
            }
            return;
        }

        // 確保頭像容器可見
        const avatarContainer = this.shadowRoot.getElementById('avatar-container');
        if (avatarContainer) {
            avatarContainer.style.display = 'inline-block';
        }

        // 優先使用 API 回應中的 picture，如果沒有則使用 Google 用戶資訊中的 picture
        let pictureUrl = null;
        const apiResponse = this.getApiResponse();
        const userInfo = this.getUserInfo();

        if (apiResponse && apiResponse.picture) {
            pictureUrl = apiResponse.picture;
        } else if (userInfo && userInfo.picture) {
            pictureUrl = userInfo.picture;
        }

        console.log('🔍 updateAvatar 調試資訊:');
        console.log('isAuthenticated:', this.isAuthenticated);
        console.log('pictureUrl:', pictureUrl);
        console.log('userInfo:', this.getUserInfo());
        console.log('apiResponse:', this.getApiResponse());

        if (this.isAuthenticated && pictureUrl) {
            // 顯示用戶頭像
            console.log('✅ 顯示用戶頭像:', pictureUrl);
            avatarImage.src = pictureUrl;
            avatarImage.style.display = 'block';
            defaultAvatar.style.display = 'none';
        } else {
            // 顯示預設頭像
            console.log('❌ 顯示預設頭像');
            avatarImage.style.display = 'none';
            defaultAvatar.style.display = 'flex';
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
        return ['client-id', 'auto-select', 'data-client-id', 'data-auto-select', 'data-login-uri', 'target-container-id', 'data-target-container-id'];
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
                case 'target-container-id':
                case 'data-target-container-id':
                    this.targetContainerId = newValue;
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
        // 讀取屬性值
        this.clientId = this.getAttribute('client-id') || this.getAttribute('data-client-id');
        this.autoSelect = (this.getAttribute('auto-select') || this.getAttribute('data-auto-select')) === 'true';
        this.loginUri = this.getAttribute('data-login-uri');
        this.targetContainerId = this.getAttribute('target-container-id') || this.getAttribute('data-target-container-id');

        // 載入 Google Fonts
        this.loadGoogleFonts();

        this.render();
        this.setupEventListeners(); // 在 DOM 渲染後設置事件監聽器

        // 檢查 Google 服務是否已經載入
        if (window.google && window.google.accounts) {
            this.isGoogleLoaded = true;
        }

        // 確保在組件連接時檢查並同步登入狀態
        this.checkStoredCredential(true).then(() => {
            this.updateAvatar(); // 初始化頭像顯示
        }).catch(error => {
            console.warn('檢查存儲憑證失敗:', error);
            this.updateAvatar(); // 即使失敗也要更新頭像顯示
        });

        // 🔧 如果已有 API 資料，立即更新 BodyData
        const existingApiResponse = this.getApiResponse();
        if (existingApiResponse) {
            this.updateBodyDataDisplay(existingApiResponse);
        }

        this.loadGoogleIdentityServices();
    }

    // 載入 Google Fonts
    loadGoogleFonts() {
        // 檢查是否已經載入過字體
        if (document.querySelector('link[href*="fonts.googleapis.com"]')) {
            return;
        }

        // 創建 Google Fonts 連結
        const fontLink = document.createElement('link');
        fontLink.rel = 'stylesheet';
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Figtree:wght@300;400;500;600;700&display=swap';
        fontLink.crossOrigin = 'anonymous';

        // 添加到 document head
        document.head.appendChild(fontLink);

        // 監聽字體載入完成事件
        fontLink.onload = () => {};

        fontLink.onerror = () => {
            console.warn('Google Fonts 載入失敗，將使用系統預設字體');
        };
    }

    // 設置事件監聽器
    setupEventListeners() {
        const avatarContainer = this.shadowRoot.getElementById('avatar-container');

        if (avatarContainer) {
            avatarContainer.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.handleAvatarClick();
            });
        } else {
            console.error('找不到頭像容器元素');
        }

        // 設置登入畫面關閉按鈕
        const closeLoginModal = this.shadowRoot.getElementById('close-login-modal');
        if (closeLoginModal) {
            closeLoginModal.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.hideLoginModal();
            });
        }

        // 設置個人資訊畫面關閉按鈕
        const closeProfileModal = this.shadowRoot.getElementById('close-profile-modal');
        if (closeProfileModal) {
            closeProfileModal.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.hideProfileModal();
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

        // 點擊個人資訊畫面背景關閉
        const profileModal = this.shadowRoot.getElementById('profile-modal');
        if (profileModal) {
            profileModal.addEventListener('click', (event) => {
                if (event.target === profileModal) {
                    this.hideProfileModal();
                }
            });
        }

        // 設置返回按鈕
        const backArrow = this.shadowRoot.getElementById('back-arrow');
        if (backArrow) {
            backArrow.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.hideLoginModal();
            });
        }

        const profileBackArrow = this.shadowRoot.getElementById('profile-back-arrow');
        if (profileBackArrow) {
            profileBackArrow.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.hideProfileModal();
            });
        }

        // 設置 Google 登入按鈕
        const googleLoginButton = this.shadowRoot.getElementById('inf-google-login-button');
        if (googleLoginButton) {
            googleLoginButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.triggerGoogleSignIn();
            });
        }



        // 設置登出按鈕
        const logoutButton = this.shadowRoot.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.handleLogout();
            });
        }

        // 監聽預設使用者切換事件（使用靜態標記防止重複添加）
        if (!InfGoogleLoginComponent.defaultUserEventListenerAdded) {
            document.addEventListener('set-default-user', (event) => {
                // console.log('🎯 捕獲到 set-default-user 事件:', event.detail);
                event.preventDefault();
                event.stopPropagation();
                const userKey = event.detail.userKey;
                // console.log('🔄 準備設置預設使用者為:', userKey);
                
                // 找到觸發事件的組件實例（安全的方式）
                let component = null;
                try {
                    // 嘗試從事件目標找到組件
                    if (event.target && typeof event.target.closest === 'function') {
                        component = event.target.closest('inf-google-login');
                    }
                } catch (error) {
                    console.warn('無法從事件目標找到組件:', error);
                }
                
                // 如果找不到，則查找頁面上的第一個組件實例
                if (!component) {
                    component = document.querySelector('inf-google-login');
                }
                
                if (component && typeof component.setDefaultUser === 'function') {
                    component.setDefaultUser(userKey);
                } else {
                    console.warn('找不到可用的組件實例或 setDefaultUser 方法');
                }
            });
            InfGoogleLoginComponent.defaultUserEventListenerAdded = true;
        }
    }

    // 處理頭像點擊
    async handleAvatarClick() {
        // 重新設定 CSS 樣式，確保樣式正確
        this.reapplyStyles();

        // 檢查當前 API 資料狀態
        const currentApiResponse = this.getApiResponse();

        console.log('🔍 頭像點擊調試資訊:');
        console.log('isAuthenticated:', this.isAuthenticated);
        console.log('credential:', this.credential);
        console.log('userInfo:', this.getUserInfo());
        console.log('apiResponse:', currentApiResponse);

        if (this.isAuthenticated) {
            // 已登入：顯示個人資訊畫面
            console.log('✅ 用戶已登入，顯示個人資訊畫面');
            this.showProfileModal();
        } else {
            // 未登入：顯示登入畫面
            console.log('❌ 用戶未登入，顯示登入畫面');
            this.showLoginModal();
        }
    }

    // 重新應用樣式的方法
    reapplyStyles() {
        // 添加 CSS 規則來設定 SizeBox_cart 的 modal 容器樣式
        const styleId = 'sizebox-cart-modal-style';
        let existingStyle = document.getElementById(styleId);
        if (!existingStyle) {
            existingStyle = document.createElement('style');
            existingStyle.id = styleId;
            document.head.appendChild(existingStyle);
        }

        existingStyle.textContent = `
            #SizeBox_cart .inf-google-login-modal-container {
                max-width: 90% !important;
                margin: 0 auto !important;
                padding-top: 20px !important;
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                background: white !important;
                border-radius: 8px !important;
                position: relative !important;
                overflow: hidden !important;
            }
        `;
        // 找到對應的配置
        const configs = [{
                avatarContainerId: 'SB_Prod_cart',
                modalContainerId: 'SizeBox_cart',
                avatarStyle: {
                    desktop: {
                        position: 'absolute',
                        left: '10px',
                        top: '10px',
                        width: '28px',
                        height: '28px',
                    },
                    mobile: {
                        position: 'absolute',
                        left: '10px',
                        top: '10px',
                        width: '28px',
                        height: '28px',
                    }
                },
                modalContainerStyle: {
                    desktop: {
                        maxWidth: '90%',
                        margin: '0 auto',
                        paddingTop: '20px'
                    },
                    mobile: {
                        maxWidth: '90%',
                        margin: '0 auto',
                        paddingTop: '20px'
                    }
                }
            },
            {
                avatarContainerId: 'header_BF',
                modalContainerId: 'container_BF_mbinfo',
                avatarStyle: {
                    desktop: {
                        position: 'absolute',
                        left: '10px',
                        top: '10px',
                        width: '28px',
                        height: '28px',
                    },
                    mobile: {
                        position: 'absolute',
                        left: '8px',
                        top: '8px',
                        width: '24px',
                        height: '24px',
                    }
                },
                modalContainerStyle: {
                    desktop: {
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'white',
                        borderRadius: '8px',
                        position: 'relative',
                        overflow: 'hidden',
                        maxWidth: '440px',
                        margin: '0 auto',
                        paddingTop: '20px'
                    },
                    mobile: {
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'white',
                        borderRadius: '8px',
                        position: 'relative',
                        overflow: 'hidden',
                        maxWidth: '100%',
                        margin: '0 auto',
                        paddingTop: '10px'
                    }
                }
            }
        ];

        configs.forEach(config => {
            const container = document.getElementById(config.avatarContainerId);
            if (container) {
                const component = container.querySelector('inf-google-login');
                if (component) {
                    // 重新設定 avatar 樣式
                    const currentStyle = this.getCurrentStyle(config.avatarStyle);
                    Object.entries(currentStyle).forEach(([property, value]) => {
                        const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                        component.style.setProperty(cssProperty, value);
                    });

                    // 重新設定 modal 容器樣式
                    if (config.modalContainerId) {
                        const modalContainer = document.getElementById(config.modalContainerId);
                        if (modalContainer && config.modalContainerStyle) {
                            const currentModalStyle = this.getCurrentStyle(config.modalContainerStyle);
                            Object.entries(currentModalStyle).forEach(([property, value]) => {
                                const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                                modalContainer.style.setProperty(cssProperty, value);
                            });
                        }
                    }
                }
            }
        });
    }

    // 獲取當前樣式的輔助方法
    getCurrentStyle(avatarStyle) {
        const isDesktop = window.innerWidth >= 480;
        if (avatarStyle && typeof avatarStyle === 'object' && avatarStyle.desktop && avatarStyle.mobile) {
            return isDesktop ? avatarStyle.desktop : avatarStyle.mobile;
        } else {
            return avatarStyle || {
                position: 'absolute',
                left: '10px',
                top: '10px',
                width: '28px',
                height: '28px',
            };
        }
    }



    // 獲取當前顯示的內容區域
    getCurrentContentContainer() {
        // 如果指定了目標容器 ID，優先使用
        if (this.targetContainerId) {
            const targetContainer = document.getElementById(this.targetContainerId);
            if (targetContainer) {
                return targetContainer;
            } else {
                console.warn(`指定的目標容器 ID "${this.targetContainerId}" 不存在`);
            }
        }

        // 如果沒有指定目標容器，使用原本的邏輯
        const advancedContainer = document.getElementById('intro-content-advanced');
        const simpleContainer = document.getElementById('intro-content-simple');

        // 檢查哪個容器目前可見
        // 優先檢查 simple 容器，因為它可能是動態生成的
        if (simpleContainer && simpleContainer.style.display !== 'none' && simpleContainer.style.opacity !== '0') {
            return simpleContainer;
        } else if (advancedContainer && advancedContainer.style.display !== 'none') {
            return advancedContainer;
        } else if (simpleContainer) {
            // 如果都沒有明確顯示，預設使用 simple
            return simpleContainer;
        } else if (advancedContainer) {
            // 如果只有 advanced 存在，使用 advanced
            return advancedContainer;
        }

        return null;
    }

    // 顯示登入畫面
    showLoginModal() {
        // 查找當前顯示的目標容器
        const targetContainer = this.getCurrentContentContainer();
        if (!targetContainer) {
            console.error('找不到當前顯示的內容容器');
            return;
        }

        // 隱藏原本內容
        this.hideOriginalContent(targetContainer);

        // 創建並顯示登入畫面
        this.showModalInContainer(targetContainer, 'login');
    }

    // 隱藏登入畫面
    hideLoginModal() {
        const targetContainer = this.getCurrentContentContainer();
        if (targetContainer) {
            this.hideModalInContainer(targetContainer);
            this.showOriginalContent(targetContainer);
        }
    }

    // 顯示個人資訊畫面
    showProfileModal() {

        // 查找當前顯示的目標容器
        const targetContainer = this.getCurrentContentContainer();
        if (!targetContainer) {
            console.error('找不到當前顯示的內容容器');

            // 🔧 備用方案：顯示 shadow DOM 中的個人資訊模態框
            this.showShadowDOMProfileModal();
            return;
        }

        // 隱藏原本內容
        this.hideOriginalContent(targetContainer);

        // 創建並顯示個人資訊畫面
        this.showModalInContainer(targetContainer, 'profile');
    }

    // 顯示 shadow DOM 中的個人資訊模態框
    showShadowDOMProfileModal() {
        const profileModal = this.shadowRoot.getElementById('profile-modal');
        if (profileModal) {
            // 先更新個人資訊內容
            this.updateProfileInfo();

            // 顯示模態框
            profileModal.classList.add('show');
        } else {
            console.error('找不到 shadow DOM 個人資訊模態框');
        }
    }

    // 隱藏個人資訊畫面
    hideProfileModal() {
        const targetContainer = this.getCurrentContentContainer();
        if (targetContainer) {
            // 添加退出動畫
            const modalContent = targetContainer.querySelector('.profile-modal');
            if (modalContent) {
                modalContent.style.animation = 'slideOutToRight 0.3s cubic-bezier(0.06, 0.43, 0.26, 0.99) forwards';

                // 等待動畫完成後再隱藏
                this.waitForAnimation(modalContent, 'slideOutToRight').then(() => {
                    this.hideModalInContainer(targetContainer);
                    this.showOriginalContent(targetContainer);
                });
            } else {
                this.hideModalInContainer(targetContainer);
                this.showOriginalContent(targetContainer);
            }
        } else {
            // 🔧 備用方案：隱藏 shadow DOM 中的個人資訊模態框
            this.hideShadowDOMProfileModal();
        }
    }

    // 隱藏 shadow DOM 中的個人資訊模態框
    hideShadowDOMProfileModal() {
        const profileModal = this.shadowRoot.getElementById('profile-modal');
        if (profileModal) {
            profileModal.classList.remove('show');
        }
    }

    // 隱藏原本內容
    hideOriginalContent(container) {
        // 保存原本內容的引用
        this.originalContainer = container;
        this.originalContainerId = container.id;

        // 將原本內容移動到隱藏位置，而不是複製
        const hiddenContainer = document.createElement('div');
        hiddenContainer.style.cssText = `
            position: absolute;
            top: -9999px;
            left: -9999px;
            width: 1px;
            height: 1px;
            overflow: hidden;
            opacity: 0;
            pointer-events: none;
        `;

        // 移動所有子元素到隱藏容器，包括 avatar 元素
        // 使用 while 循環確保移動所有子元素，包括動態添加的 avatar
        while (container.firstChild) {
            hiddenContainer.appendChild(container.firstChild);
        }

        document.body.appendChild(hiddenContainer);
        this.hiddenContent = hiddenContainer;
    }

    // 顯示原本內容
    showOriginalContent(container) {
        if (this.originalContainer && this.hiddenContent) {
            // 將原本內容移回原容器
            while (this.hiddenContent.firstChild) {
                container.appendChild(this.hiddenContent.firstChild);
            }

            // 移除隱藏的容器
            if (this.hiddenContent.parentNode) {
                this.hiddenContent.parentNode.removeChild(this.hiddenContent);
            }

            this.originalContainer = null;
            this.originalContainerId = null;
            this.hiddenContent = null;
        }
    }

    // 重新創建 simple 內容
    recreateSimpleContent(container) {
        // 重新生成 simple 內容的 HTML，與 embedded.js 中的結構完全一致
        const simpleContent = `
            <div style="display: flex; justify-content: center; align-items: center; width: 100%; position: relative;">
                <div class="intro-logo intro-modal__logo intro-modal__logo--inf">
                    <img src="img/intro-logo.png" alt="intro logo" />
                </div>
                <inf-google-login 
                    client-id="265821704236-fkdt4rrvpmuhf442c7r2dfg16i71c6qg.apps.googleusercontent.com"
                    auto-select="true"
                    style="position: absolute; right: 8px; top: 8px;">
                </inf-google-login>
            </div>
            <div class="intro-logo intro-modal__logo">
                <img src="img/start-animation.gif" alt="start animation" loading="lazy" />
            </div>
            <p class="intro-modal__title">開啟精準購物之旅</p>
            <button id="start-button" class="intro-modal__btn--start">
                <div>開始</div>
                <img
                    src="img/start-arrow.svg"
                    alt="start arrow"
                    class="intro-modal__btn--arrow"
                />
            </button>
            <div class="intro-modal__icon">
                <div class="intro-modal__icon--inffits">
                    <div class="icon-inffits"></div>
                    <div class="text-inffits">
                        <p>
                            使用本服務，即代表您同意 infFITS
                            <a href="https://inffits.com/Privacy.html" target="_blank">隱私權聲明</a>
                            及
                            <a href="https://inffits.com/Terms.html" target="_blank">使用條款</a>。
                        </p>
                    </div>
                </div>
                <div class="intro-modal__icon--reminder">
                    <div class="icon-reminder"></div>
                    <div class="text-reminder">
                        <p>
                            您可以跳過部分提問，但我們建議完成整個選購流程，推薦結果將更精準。
                        </p>
                    </div>
                </div>
            </div>
        `;

        // 設置內容並顯示
        container.innerHTML = simpleContent;
        container.style.display = 'block';
        container.style.opacity = '1';

        // 重新初始化 Google Login 組件
        this.reinitializeGoogleLoginInContainer(container);
    }

    // 重新初始化容器中的 Google Login 組件
    reinitializeGoogleLoginInContainer(container) {
        const googleLoginElement = container.querySelector('inf-google-login');
        if (googleLoginElement) {
            // 重新初始化 Google Login 組件
            if (googleLoginElement.connectedCallback) {
                googleLoginElement.connectedCallback();
            }
        }
    }

    // 在容器內顯示模態框
    showModalInContainer(container, type) {
        // 創建模態框內容，傳遞樣式配置
        const modalContent = this.createModalContent(type, this.modalContainerStyle);

        // 直接將模態框內容添加到容器
        container.appendChild(modalContent);
        container.style.opacity = '1';
        container.style.pointerEvents = 'auto';

        // 添加事件監聽器
        this.setupModalEventListeners(container, type);
    }

    // 隱藏容器內的模態框
    hideModalInContainer(container) {
        // 移除模態框內容
        const modalContainer = container.querySelector('.inf-google-login-modal-container');
        if (modalContainer) {
            modalContainer.remove();
        }
    }

    // 創建模態框內容
    createModalContent(type, modalContainerStyle = null) {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'inf-google-login-modal-container';

        // 預設樣式
        const defaultStyle = `
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
        `;

        // 如果有自定義樣式，則應用自定義樣式
        if (modalContainerStyle) {
            const currentStyle = this.getCurrentStyle(modalContainerStyle);
            const cssProperties = [];

            Object.entries(currentStyle).forEach(([property, value]) => {
                // 將 camelCase 轉換為 kebab-case
                const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                cssProperties.push(`${cssProperty}: ${value};`);
            });

            const customStyle = cssProperties.join('\n            ');
            modalDiv.style.cssText = customStyle;
        } else {
            modalDiv.style.cssText = defaultStyle;
        }

        // 添加 CSS 樣式
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            /* 容器過渡效果 */
            #intro-content-advanced,
            #intro-content-simple {
                transition: opacity 0.3s ease-in-out, pointer-events 0.3s ease-in-out;
            }
            
            /* 全局字體設定 */
            * {
                font-family: 'Noto Sans TC', 'Figtree', sans-serif;
            }
            
            /* 中文使用 Noto Sans TC */
            *:lang(zh),
            *:lang(zh-TW),
            *:lang(zh-CN) {
                font-family: 'Noto Sans TC', sans-serif;
            }
            
            /* 英文和數字使用 Figtree */
            *:lang(en),
            *:lang(en-US),
            *:lang(en-GB) {
                font-family: 'Figtree', sans-serif;
            }
            
            /* 使用 font-family 堆疊來實現 UTF-8 編碼字體 */
            .profile-modal__info-label-text {
                font-family: 'Noto Sans TC', sans-serif;
            }
            
            .profile-modal__info-value {
                font-family: 'Figtree', 'Noto Sans TC', sans-serif;
            }
            
            /* Profile Modal BEM 樣式 */
            .profile-modal {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                animation: slideInFromRight 0.3s cubic-bezier(0.06, 0.43, 0.26, 0.99);
            }
            
            @keyframes slideInFromRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutToRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            @keyframes slideOutToRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .profile-modal__header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: white;
                flex-shrink: 0;
                max-height: 19px;
                margin-bottom:6px;
            }
            
            .profile-modal__back-arrow {
                cursor: pointer;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
           @media screen and (min-width: 480px) {
                .profile-modal__back-arrow {
                    width: 36px;
                    height: 36px;
                }
            }
            
            .profile-modal__title {
                color: rgba(0, 0, 0, 0.95);
                font-family: "Noto Sans TC", "Figtree", sans-serif;
                font-size: 15px;
                font-style: normal;
                font-weight: 700;
                line-height: 19px;
                /* 126.667% */
                letter-spacing: 0.3px;
            }
            @media screen and (min-width: 480px) {
            .profile-modal__title {
                color: rgba(0, 0, 0, 0.95);
                    font-family: "Noto Sans TC", "Figtree", sans-serif;
                    font-size: 18px;
                    font-style: normal;
                    font-weight: 700;
                    line-height: 19px;
                    /* 105.556% */
                    letter-spacing: 0.36px;
                }
            }
            .profile-modal__logout-btn {
                display: flex;
                align-items: center;
                background: none;
                border: none;
                cursor: pointer;
                font-weight: 500;
                font-size: 14px;
                color: #787974;
            }
            
            .profile-modal__content {
                flex: 1;
                overflow-y: auto;
                padding: 20px 0;
            }
            
            .profile-modal__avatar-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 24px;
            }
            
            .profile-modal__avatar {
                position: relative;
                width: 72px;
                height: 72px;
            }
            
            .profile-modal__avatar-img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .profile-modal__info-section {
                display: flex;
                flex-direction: column;
                width: 100%;
                text-align: left;
            }
            
            .profile-modal__info-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #E0E0DF;
            }
            @media screen and (min-width: 480px) {
                .profile-modal__info-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 0;
                    border-bottom: 1px solid #E0E0DF;
              }
            }
            
            .profile-modal__info-item:last-child {
                border-bottom: none;
            }
            
            .profile-modal__info-label {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
                   .profile-modal__info-label-text {
                color: rgba(0, 0, 0, 0.95);
                font-family: "Noto Sans TC", "Figtree", sans-serif;
                font-size: 15px;
                font-style: normal;
                font-weight: 700;
                line-height: 19px;
                /* 126.667% */
                letter-spacing: 0.3px;
            }
            @media screen and (min-width: 480px) {
                .profile-modal__info-label-text {
                    font-weight: 500;
                    font-size: 17px;
                    line-height: 22px;
                    letter-spacing: 0.34px;
                    color: #1E1E19;
                }
            }
            
            .profile-modal__info-value {
                font-weight: 500;
                font-size: 15px;
                line-height: 20px;
                letter-spacing: -0.12px;
                color: #787974;
            }
            
            /* Login Modal BEM 樣式 */
            .login-modal {
                width: 100%;
                height: 100%;
                display: flex;
                flex-direction: column;
                animation: slideInFromRight 0.3s cubic-bezier(0.06, 0.43, 0.26, 0.99);
            }
            
            .login-modal__header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .login-modal__back-arrow {
                cursor: pointer;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            @media screen and (min-width: 480px) {
                .login-modal__back-arrow {
                    width: 36px;
                    height: 36px;
                }
            }
            .login-modal__title {
                color: rgba(0, 0, 0, 0.95);
                font-family: "Noto Sans TC", "Figtree", sans-serif;
                font-size: 15px;
                font-style: normal;
                font-weight: 700;
                line-height: 19px;
                /* 126.667% */
                letter-spacing: 0.3px;
            }
            @media screen and (min-width: 480px) {
            .login-modal__title {
                color: rgba(0, 0, 0, 0.95);
                    font-family: "Noto Sans TC", "Figtree", sans-serif;
                    font-size: 18px;
                    font-style: normal;
                    font-weight: 700;
                    line-height: 19px;
                    /* 105.556% */
                    letter-spacing: 0.36px;
                }
            }
            
            .login-modal__spacer {
                width: 24px;
            }
            
            .login-modal__content {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px 0;
                max-width: 450px;
                margin: 0 auto;
                width: 100%;
            }


            .login-modal__logo {
                width: 119.894px;
                height: 25.022px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            @media screen and (min-width: 480px) {
                .login-modal__logo {
                    width: 121px;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            }
            .login-modal__divider {
                display: flex;
                gap: 6px;
                width: 100%;
                padding-top: 24px;
                padding-bottom: 18px;
            }
            
            .login-modal__divider-line {
                flex: 1;
                height: 1px;
                background-color: #D7D7D6;
            }
            
            .login-modal__button-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 100%;
                max-width: 400px;
                margin: 0 auto;
            }
            
            .login-modal__google-button {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 6px;
                padding: 10px 14px;
                background-color: #F2F2F2;
                border-radius: 40px;
                border: none;
                cursor: pointer;
                width: 100%;
                position: relative;
            }
            
            .login-modal__google-icon {
                position: absolute;
                left: 14px;
                top: 13px;
                width: 16px;
                height: 16px;
            }
            
            .login-modal__button-text {
                font-weight: 500;
                font-size: 17px;
                line-height: 1.2941176470588236em;
                letter-spacing: 2%;
                color: rgba(0, 0, 0, 0.95);
            }
        `;

        modalDiv.appendChild(styleElement);

        if (type === 'login') {
            modalDiv.innerHTML += this.getLoginModalHTML();
        } else if (type === 'profile') {
            modalDiv.innerHTML += this.getProfileModalHTML();
        }

        return modalDiv;
    }

    // 獲取登入模態框 HTML
    getLoginModalHTML() {
        return `
            <div class="login-modal">
                <div class="login-modal__header">
                    <div class="login-modal__back-arrow" id="modal-back-arrow">
                        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.9996 22.3999L9.59961 15.9999L15.9996 9.5999" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M22.3996 16H9.59961" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="login-modal__title">登入</div>
                    <div class="login-modal__spacer"></div>
                </div>
                
                <div class="login-modal__content">
                    <div class="login-modal__logo">
                        <svg width="121" height="26" viewBox="0 0 121 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M108.993 25.0225C108.218 24.9117 107.436 24.8294 106.666 24.6852C104.615 24.3015 102.652 23.6742 100.911 22.4783C100.822 22.4172 100.739 22.3495 100.619 22.2591C101.246 20.8717 101.871 19.4884 102.51 18.0742C102.858 18.2941 103.158 18.5011 103.473 18.6795C105.75 19.9691 108.199 20.607 110.819 20.5532C111.716 20.5345 112.603 20.4172 113.436 20.0546C114.108 19.7622 114.648 19.3255 114.848 18.585C115.101 17.6489 114.703 16.8506 113.733 16.308C112.679 15.7182 111.505 15.4925 110.357 15.1829C108.727 14.743 107.088 14.3202 105.486 13.7931C104.306 13.4053 103.258 12.7349 102.442 11.7695C101.305 10.4261 100.962 8.84078 101.151 7.13813C101.482 4.16705 103.268 2.34546 105.957 1.30514C108.231 0.425301 110.608 0.325097 113.005 0.540169C114.851 0.705546 116.634 1.14383 118.314 1.94709C118.689 2.12713 119.05 2.33813 119.452 2.5532C118.876 3.96828 118.313 5.35157 117.729 6.78701C117.554 6.69903 117.4 6.62652 117.251 6.5475C115.036 5.37927 112.696 4.76257 110.175 4.95809C109.304 5.02571 108.458 5.19923 107.709 5.68559C106.86 6.23711 106.459 7.18538 106.709 8.05952C106.886 8.67703 107.347 9.05178 107.883 9.33854C109.031 9.9528 110.3 10.1915 111.549 10.4897C113.416 10.9361 115.305 11.3174 117.035 12.2029C118.81 13.1121 120.052 14.4538 120.353 16.4823C120.739 19.0852 119.941 21.2677 117.844 22.9084C116.19 24.2029 114.238 24.7178 112.187 24.9361C112.043 24.9516 111.903 24.9923 111.76 25.0216C110.838 25.0225 109.915 25.0225 108.993 25.0225Z" fill="#1E1E19"/>
                            <path d="M0.552734 5.36793C0.758844 4.52964 1.18166 3.86813 2.01261 3.51049C3.11241 3.03717 4.63094 3.29705 5.32992 4.09787C6.40039 5.32475 5.91974 7.26691 4.36618 7.83555C3.30141 8.22577 2.26842 8.12964 1.34459 7.38911C0.896523 7.02984 0.735219 6.52149 0.552734 6.01803C0.552734 5.80133 0.552734 5.58463 0.552734 5.36793Z" fill="#1E1E19"/>
                            <path d="M65.2331 11.5178C65.2331 13.038 65.2331 14.4922 65.2331 15.9846C61.581 15.9846 57.9517 15.9846 54.2702 15.9846C54.2702 18.8677 54.2702 21.7133 54.2702 24.5867C52.3932 24.5867 50.5692 24.5867 48.7109 24.5867C48.7109 16.7015 48.7109 8.80743 48.7109 0.865273C48.8429 0.858755 48.9863 0.844906 49.1305 0.844091C54.8405 0.843277 60.5513 0.845721 66.2612 0.835945C66.605 0.83513 66.7337 0.903562 66.7264 1.27831C66.702 2.48238 66.7175 3.68645 66.7166 4.89134C66.7166 5.0111 66.706 5.13004 66.6979 5.30845C62.5529 5.30845 58.4266 5.30845 54.2783 5.30845C54.2783 7.4054 54.2783 9.44287 54.2783 11.5178C57.9297 11.5178 61.5598 11.5178 65.2331 11.5178Z" fill="#1E1E19"/>
                            <path d="M86.4174 24.5827C86.4174 18.1836 86.4174 11.8039 86.4174 5.386C83.8715 5.386 81.3673 5.386 78.8377 5.386C78.8239 5.24832 78.8051 5.14486 78.8051 5.0414C78.8027 3.7697 78.8133 2.4972 78.797 1.22551C78.7929 0.916751 78.8972 0.836914 79.1937 0.836914C85.8675 0.843431 92.5404 0.841802 99.2141 0.843431C99.32 0.843431 99.4251 0.859725 99.5563 0.870315C99.5563 2.37011 99.5563 3.84954 99.5563 5.36971C97.0365 5.36971 94.533 5.36971 91.9937 5.36971C91.9937 11.7901 91.9937 18.1697 91.9937 24.5819C90.1355 24.5827 88.3131 24.5827 86.4174 24.5827Z" fill="#1E1E19"/>
                            <path d="M30.7687 13.9895C30.7687 12.6861 30.7687 11.4567 30.7687 10.1818C31.9963 10.1818 33.2224 10.1818 34.4827 10.1818C34.4909 10.0091 34.5023 9.87955 34.5031 9.74921C34.5047 8.7211 34.543 7.69055 34.4966 6.66407C34.3458 3.35002 36.7564 0.906028 39.4945 0.216008C42.6416 -0.577475 46.0094 0.870183 47.3935 3.6547C47.501 3.87141 47.5898 4.09707 47.7128 4.3765C46.3817 4.7936 45.075 5.20338 43.7405 5.62212C43.2908 4.75206 42.5552 4.32273 41.6118 4.18342C39.9629 3.93984 38.653 5.04126 38.653 6.69259C38.653 7.80216 38.6546 8.91173 38.6562 10.0213C38.6562 10.0474 38.6652 10.0734 38.6815 10.1622C39.286 10.1622 39.9035 10.1622 40.521 10.1622C41.1295 10.1622 41.7373 10.1622 42.3719 10.1622C42.3719 11.438 42.3719 12.6869 42.3719 13.9667C41.1434 13.9667 39.9279 13.9667 38.653 13.9667C38.653 14.1386 38.653 14.2812 38.653 14.4237C38.653 15.5333 38.6163 16.6445 38.6603 17.7525C38.7809 20.8026 36.6684 23.2775 33.932 24.0906C30.635 25.0706 27.0554 23.5309 25.6803 20.5297C25.6029 20.3602 25.5377 20.1842 25.4473 19.9618C26.7931 19.5415 28.1128 19.1292 29.4212 18.7211C30.3247 20.0694 31.6697 20.5329 33.0179 19.9749C33.9629 19.5838 34.4778 18.8669 34.4982 17.847C34.5234 16.5769 34.5039 15.306 34.5039 13.9903C33.2583 13.9895 32.033 13.9895 30.7687 13.9895Z" fill="#1E1E19"/>
                            <path d="M24.1711 24.5974C22.7649 24.5974 21.3719 24.5974 19.921 24.5974C19.921 24.4467 19.921 24.3041 19.921 24.1616C19.921 21.8471 19.9283 19.5327 19.9152 17.2182C19.9128 16.7481 19.859 16.274 19.7865 15.808C19.5739 14.4459 18.6484 13.6182 17.288 13.5335C15.8167 13.4414 14.4513 14.0483 13.8753 15.4724C13.5886 16.1811 13.5226 16.9127 13.5193 17.6565C13.5104 19.795 13.5161 21.9335 13.5161 24.072C13.5161 24.2333 13.5161 24.3946 13.5161 24.5852C12.0871 24.5852 10.6859 24.5852 9.25781 24.5852C9.25781 19.7379 9.25781 14.8997 9.25781 10.0329C10.6045 10.0329 11.9397 10.0329 13.3197 10.0329C13.3197 10.5396 13.3197 11.0447 13.3197 11.6019C13.701 11.3127 14.013 11.039 14.3592 10.819C15.8729 9.85689 17.5446 9.65078 19.2823 9.88296C22.3438 10.2919 24.0244 12.4744 24.1385 15.3771C24.2558 18.3636 24.1947 21.3575 24.2102 24.3481C24.2102 24.4263 24.1865 24.5045 24.1711 24.5974Z" fill="#1E1E19"/>
                            <path d="M75.5762 24.6023C73.7146 24.6023 71.8988 24.6023 70.0527 24.6023C70.0527 16.6944 70.0527 8.79949 70.0527 0.871993C70.179 0.862217 70.2963 0.844294 70.4144 0.844294C72.0153 0.842665 73.6161 0.849997 75.2169 0.836962C75.5216 0.834518 75.6087 0.924946 75.6079 1.228C75.6006 8.90213 75.6022 16.5763 75.6006 24.2512C75.6022 24.3563 75.5867 24.4622 75.5762 24.6023Z" fill="#1E1E19"/>
                            <path d="M1.125 10.019C2.54822 10.019 3.92744 10.019 5.34007 10.019C5.34007 14.8785 5.34007 19.7241 5.34007 24.5918C3.94048 24.5918 2.55066 24.5918 1.125 24.5918C1.125 19.7445 1.125 14.8997 1.125 10.019Z" fill="#1E1E19"/>
                        </svg>
                    </div>
                    
                    <div class="login-modal__divider">
                        <div class="login-modal__divider-line"></div>
                        <div class="login-modal__divider-line"></div>
                    </div>
                    
                    <div class="login-modal__button-container">
                        <button class="login-modal__google-button" id="modal-inf-google-login-button">
                            <svg class="login-modal__google-icon" width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <g clip-path="url(#clip0_7461_9318)">
                                    <path d="M15.8099 8.17192C15.8099 7.5164 15.7567 7.03805 15.6416 6.54199H8.15625V9.50065H12.55C12.4614 10.2359 11.9831 11.3432 10.92 12.0873L10.9051 12.1863L13.2719 14.0198L13.4358 14.0362C14.9417 12.6454 15.8099 10.5991 15.8099 8.17192Z" fill="#4285F4"/>
                                    <path d="M8.15534 15.9675C10.3079 15.9675 12.115 15.2588 13.4349 14.0364L10.9191 12.0875C10.2459 12.557 9.34233 12.8848 8.15534 12.8848C6.04707 12.8848 4.25769 11.494 3.61983 9.57178L3.52633 9.57972L1.06539 11.4843L1.0332 11.5737C2.34423 14.1781 5.03717 15.9675 8.15534 15.9675Z" fill="#34A853"/>
                                    <path d="M3.6206 9.57182C3.4523 9.07576 3.35489 8.54422 3.35489 7.99503C3.35489 7.44578 3.4523 6.9143 3.61175 6.41824L3.60729 6.31259L1.1155 4.37744L1.03398 4.41622C0.49364 5.49695 0.183594 6.71057 0.183594 7.99503C0.183594 9.27949 0.49364 10.493 1.03398 11.5738L3.6206 9.57182Z" fill="#FBBC05"/>
                                    <path d="M8.15534 3.10515C9.65238 3.10515 10.6622 3.7518 11.238 4.2922L13.488 2.09532C12.1062 0.810858 10.3079 0.0224609 8.15534 0.0224609C5.03717 0.0224609 2.34423 1.81184 1.0332 4.41617L3.61097 6.41819C4.25769 4.49593 6.04707 3.10515 8.15534 3.10515Z" fill="#EB4335"/>
                                </g>
                                <defs>
                                    <clipPath id="clip0_7461_9318">
                                        <rect width="16" height="16" fill="white" transform="translate(0 0.0224609)"/>
                                    </clipPath>
                                </defs>
                            </svg>
                            <span class="login-modal__button-text">繼續使用 Google 登入</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 獲取個人資訊模態框 HTML
    getProfileModalHTML() {
        const userInfo = this.getUserInfo();
        const apiResponse = this.getApiResponse();


        // 優先使用 API 回傳的資料，fallback 到 userInfo
        const displayName = (apiResponse && apiResponse.name) ? apiResponse.name : (userInfo && userInfo.name) ? userInfo.name : '尚未提供';
        const displayEmail = (apiResponse && apiResponse.email) ? apiResponse.email : (userInfo && userInfo.email) ? userInfo.email : '尚未提供';
        const displayPicture = (apiResponse && apiResponse.picture) ? apiResponse.picture : (userInfo && userInfo.picture) ? userInfo.picture : '';


        return `
            <div class="profile-modal">
                <div class="profile-modal__header">
                    <div class="profile-modal__back-arrow" id="modal-profile-back-arrow">
                        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.9996 22.3999L9.59961 15.9999L15.9996 9.5999" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M22.3996 16H9.59961" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="profile-modal__title">個人資訊</div>
                    <button class="profile-modal__logout-btn" id="modal-logout-button">登出</button>
                </div>
                
                <div class="profile-modal__content">
                    <div class="profile-modal__avatar-section">
                        <div class="profile-modal__avatar">
                            <img src="${displayPicture}" alt="用戶頭像" class="profile-modal__avatar-img" onerror="this.style.display='none'">
                        </div>
                    </div>
                    
                    <div class="profile-modal__info-section">
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">姓名</div>
                                <div class="profile-modal__info-value">${displayName}</div>
                            </div>
                        </div>
                        
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">電子郵件</div>
                                <div class="profile-modal__info-value">${displayEmail}</div>
                            </div>
                        </div>
                        
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">電話號碼</div>
                                <div class="profile-modal__info-value">尚未提供</div>
                            </div>
                        </div>
                        
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">出生日期</div>
                                <div class="profile-modal__info-value">尚未提供</div>
                            </div>
                        </div>
                        
                        <!-- BodyData 使用者資料區域 -->
                        <div class="profile-modal__info-item" id="modal-body-data-section" style="display: none;">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">使用者資料</div>
                                <div class="profile-modal__info-value" id="modal-body-data-content">尚未提供</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 設置模態框事件監聽器
    setupModalEventListeners(container, type) {
        if (type === 'login') {
            // 返回按鈕
            const backArrow = container.querySelector('#modal-back-arrow');
            if (backArrow) {
                backArrow.addEventListener('click', () => {
                    this.hideLoginModal();
                });
            }

            // Google 登入按鈕
            const googleLoginButton = container.querySelector('#modal-inf-google-login-button');
            if (googleLoginButton) {
                googleLoginButton.addEventListener('click', () => {
                    this.triggerGoogleSignIn();
                });
            }
        } else if (type === 'profile') {
            // 返回按鈕
            const backArrow = container.querySelector('#modal-profile-back-arrow');
            if (backArrow) {
                backArrow.addEventListener('click', () => {
                    this.hideProfileModal();
                });
            }

            // 登出按鈕
            const logoutButton = container.querySelector('#modal-logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    this.handleLogout();
                });
            }

            // 🔧 修復：顯示個人資訊畫面時，更新個人資訊內容（包含 BodyData）
            this.updateDynamicModalProfile(container);
        }
    }

    // 更新動態模態框中的個人資訊（包含所有 API 資料）
    updateDynamicModalProfile(container) {
        const apiResponse = this.getApiResponse();

        if (apiResponse) {
            // 使用短暫延遲確保 DOM 元素已完全渲染
            setTimeout(() => {

                // 更新姓名
                const nameElement = container.querySelector('.profile-modal__info-item:nth-child(1) .profile-modal__info-value');
                if (nameElement && apiResponse.name) {
                    nameElement.textContent = apiResponse.name;
                }

                // 更新電子郵件
                const emailElement = container.querySelector('.profile-modal__info-item:nth-child(2) .profile-modal__info-value');
                if (emailElement && apiResponse.email) {
                    emailElement.textContent = apiResponse.email;
                }

                // 更新頭像
                const avatarElement = container.querySelector('.profile-modal__avatar-img');
                if (avatarElement && apiResponse.picture) {
                    avatarElement.src = apiResponse.picture;
                }

                // 更新 BodyData
                this.updateBodyDataDisplay(apiResponse);
            }, 100);
        } else {}
    }

    // 更新個人資訊顯示
    updateProfileInfo() {
        const userInfo = this.getUserInfo();
        const apiResponse = this.getApiResponse();

        // 優先使用 API 回傳的資料，fallback 到 userInfo
        const displayName = (apiResponse && apiResponse.name) ? apiResponse.name : (userInfo && userInfo.name) ? userInfo.name : '尚未提供';
        const displayEmail = (apiResponse && apiResponse.email) ? apiResponse.email : (userInfo && userInfo.email) ? userInfo.email : '尚未提供';
        const displayPicture = (apiResponse && apiResponse.picture) ? apiResponse.picture : (userInfo && userInfo.picture) ? userInfo.picture : null;


        // 更新頭像
        const profileAvatarImage = this.shadowRoot.getElementById('profile-avatar-image');
        if (profileAvatarImage && displayPicture) {
            profileAvatarImage.src = displayPicture;
        }

        // 更新姓名
        const profileName = this.shadowRoot.getElementById('profile-name');
        if (profileName) {
            profileName.textContent = displayName;
        }

        // 更新電子郵件
        const profileEmail = this.shadowRoot.getElementById('profile-email');
        if (profileEmail) {
            const emailSpan = profileEmail.querySelector('span');
            if (emailSpan) {
                emailSpan.textContent = displayEmail;
            }
        }

        // 更新其他資訊（如果有 API 回應數據）
        if (apiResponse) {
            // 處理 BodyData 身體資料
            this.updateBodyDataDisplay(apiResponse);
        } else {}
    }

    // 更新 BodyData 身體資料顯示
    updateBodyDataDisplay(apiResponse) {

        // 首先嘗試在動態模態框中查找（優先級較高）
        let bodyDataSection = document.getElementById('modal-body-data-section');
        let bodyDataContent = document.getElementById('modal-body-data-content');

        // 如果在動態模態框中找不到，則尋找 shadow DOM 中的元素
        if (!bodyDataSection || !bodyDataContent) {
            bodyDataSection = this.shadowRoot.getElementById('body-data-section');
            bodyDataContent = this.shadowRoot.getElementById('body-data-content');
        }

        if (!bodyDataSection || !bodyDataContent) {
            console.warn('❌ 找不到 BodyData 顯示元素');
            return;
        }

        // 檢查 API 回應中是否有 BodyData
        if (apiResponse.BodyData && typeof apiResponse.BodyData === 'object') {
            // 整理 BodyData 資料，傳遞 BodyData_ptr 參數
            const bodyDataHtml = this.formatBodyData(apiResponse.BodyData, apiResponse.BodyData_ptr);

            if (bodyDataHtml) {
                bodyDataContent.innerHTML = bodyDataHtml;
                bodyDataSection.style.display = 'block'; // 顯示 BodyData 區域
            } else {
                bodyDataSection.style.display = 'none'; // 隱藏 BodyData 區域
            }
        } else {
            bodyDataSection.style.display = 'none'; // 隱藏 BodyData 區域
        }
    }

    // 格式化 BodyData 資料
    formatBodyData(bodyData, bodyDataPtr) {
        if (!bodyData || typeof bodyData !== 'object') {
            return '';
        }



        // 確定預設使用者
        let defaultUserKey = bodyDataPtr;
        if (!defaultUserKey || !bodyData[defaultUserKey]) {
            // 如果 BodyData_ptr 為空或不存在，使用第一個 key
            const userKeys = Object.keys(bodyData);
            if (userKeys.length > 0) {
                defaultUserKey = userKeys[0];
            }
        }

        let formattedHtml = '<div style="display: flex; flex-direction: column; gap: 16px;">';
        // 遍歷所有 User 資料
        
        // 對使用者進行排序，確保預設使用者（BodyData_ptr）排在第一位
        const userKeys = Object.keys(bodyData);
        const sortedUserKeys = userKeys.sort((a, b) => {
            // 如果 a 是預設使用者，排在前面
            if (a === defaultUserKey) return -1;
            // 如果 b 是預設使用者，排在前面
            if (b === defaultUserKey) return 1;
            // 其他使用者保持原有順序
            return 0;
        });

        sortedUserKeys.forEach(userKey => {
            const userData = bodyData[userKey];
            
            if (userData && typeof userData === 'object') {
                // 檢查是否為預設使用者
                const isDefaultUser = userKey === defaultUserKey;

                // 處理新的 BodyData 格式：支援 body 和 shoes 子物件
                let bodyInfo = userData;
                let shoesInfo = null;

                // 檢查是否為新格式（包含 body 和 shoes）
                if (userData.body && typeof userData.body === 'object') {
                    bodyInfo = userData.body;
                    shoesInfo = userData.shoes;
                }

                // 計算 BMI（始終顯示）
                let bmiHtml = '';
                let bmiValue = '尚未提供';
                let bmiStatus = '';
                let bmiColor = '#9CA3AF'; // 預設灰色
                
                if (bodyInfo.HV && bodyInfo.HV.trim() !== '' && bodyInfo.WV && bodyInfo.WV.trim() !== '') {
                    const height = parseFloat(bodyInfo.HV) / 100; // 轉換為公尺
                    const weight = parseFloat(bodyInfo.WV);
                    if (!isNaN(height) && !isNaN(weight) && height > 0 && weight > 0) {
                        const bmi = (weight / (height * height)).toFixed(1);
                        bmiValue = bmi;

                        if (bmi < 18.5) {
                            bmiStatus = '體重過輕';
                            bmiColor = '#3B82F6';
                        } else if (bmi < 24) {
                            bmiStatus = '正常範圍';
                            bmiColor = '#10B981';
                        } else if (bmi < 27) {
                            bmiStatus = '體重過重';
                            bmiColor = '#F59E0B';
                        } else {
                            bmiStatus = '肥胖';
                            bmiColor = '#EF4444';
                        }
                    }
                }

                bmiHtml = `
                <div style="
                    padding: 10px;
                    background: linear-gradient(135deg, ${bmiColor}10, ${bmiColor}05);
                    border-left: 3px solid ${bmiColor};
                    border-radius: 6px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #4B5563; font-size: 13px; font-weight: 500;">BMI 指數</span>
                        <div style="text-align: right;">
                            <div style="color: ${bmiColor}; font-size: 16px; font-weight: 600;">${bmiValue}</div>
                            <div style="color: ${bmiColor}; font-size: 11px; margin-top: 2px;">${bmiStatus || '請提供身高體重'}</div>
                        </div>
                    </div>
                </div>
                `;

                formattedHtml += `
                    <div style="
                        background: linear-gradient(135deg, #FFFFFF, #F8FAFC);
                        border: 1px solid #E2E8F0;
                        border-radius: 12px;
                        padding: 16px;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                        transition: all 0.2s ease;
                        position: relative;
                    ">
                        <div style="
                            position: absolute;
                            top: 8px;
                            right: 8px;
                            display: flex;
                            gap: 8px;
                            z-index: 1000;
                        ">
                            <!-- 刪除按鈕 -->
                            <button 
                                onclick="
                                    console.log('🗑️ 點擊刪除按鈕，使用者:', '${userKey.replace(/'/g, "\\'")}');
                                    
                                    // 顯示確認對話框
                                    if (confirm('⚠️ 確定要刪除使用者 ${userKey.replace(/'/g, "\\'")} 嗎？\\n\\n此操作無法復原，所有身體資料將被永久刪除。')) {
                                        deleteUser('${userKey.replace(/'/g, "\\'")}');
                                    }
                                "
                                style="
                                    background: linear-gradient(135deg, #EF4444, #DC2626);
                                    color: white;
                                    padding: 6px 10px;
                                    border-radius: 12px;
                                    font-size: 11px;
                                    font-weight: 600;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    gap: 4px;
                                    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
                                    border: none;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    font-family: inherit;
                                    min-width: 50px;
                                    min-height: 24px;
                                "
                                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(239, 68, 68, 0.4)'"
                                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(239, 68, 68, 0.3)'"
                                title="刪除使用者"
                            >
                                刪除
                            </button>
                            
                            ${isDefaultUser ? `
                            <button 
                                onclick="console.log('🎯 點擊預設按鈕，使用者:', '${userKey.replace(/'/g, "\\'")}'); document.dispatchEvent(new CustomEvent('set-default-user', { 
                                    detail: { userKey: '${userKey.replace(/'/g, "\\'")}' },
                                    bubbles: true,
                                    composed: true 
                                }))"
                                style="
                                    background: linear-gradient(135deg, #10B981, #059669);
                                    color: white;
                                    padding: 6px 10px;
                                    border-radius: 12px;
                                    font-size: 11px;
                                    font-weight: 600;
                                    display: flex;
                                    align-items: center;
                                    gap: 4px;
                                    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
                                    border: none;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    font-family: inherit;
                                    min-width: 40px;
                                    min-height: 24px;
                                "
                                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(16, 185, 129, 0.4)'"
                                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(16, 185, 129, 0.3)'"
                                title="點擊設為預設使用者"
                            >
                                預設
                            </button>
                            ` : `
                            <button 
                                onclick="console.log('🎯 點擊設為預設按鈕，使用者:', '${userKey.replace(/'/g, "\\'")}'); document.dispatchEvent(new CustomEvent('set-default-user', { 
                                    detail: { userKey: '${userKey.replace(/'/g, "\\'")}' },
                                    bubbles: true,
                                    composed: true 
                                }))"
                                style="
                                    background: linear-gradient(135deg, #6B7280, #4B5563);
                                    color: white;
                                    padding: 6px 10px;
                                    border-radius: 12px;
                                    font-size: 11px;
                                    font-weight: 600;
                                    display: flex;
                                    align-items: center;
                                    gap: 4px;
                                    box-shadow: 0 2px 4px rgba(107, 114, 128, 0.3);
                                    border: none;
                                    cursor: pointer;
                                    transition: all 0.2s ease;
                                    font-family: inherit;
                                    min-width: 60px;
                                    min-height: 24px;
                                "
                                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(107, 114, 128, 0.4)'"
                                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(107, 114, 128, 0.3)'"
                                title="點擊設為預設使用者"
                            >
                                設為預設
                            </button>
                            `}
                        </div>
                        <div style="
                            display: flex;
                            align-items: center;
                            margin-bottom: 16px;
                            padding-bottom: 12px;
                            border-bottom: 1px solid #E2E8F0;
                        ">
                            <div style="
                                width: 32px;
                                height: 32px;
                                background: linear-gradient(135deg, #3B82F6, #1D4ED8);
                                border-radius: 8px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin-right: 12px;
                            ">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white"/>
                                    <path d="M12 14C7.03125 14 3 18.0312 3 23H21C21 18.0312 16.9688 14 12 14Z" fill="white"/>
                                </svg>
                            </div>
                            <div>
                                <div style="
                                    font-weight: 600;
                                    color: #1E293B;
                                    font-size: 15px;
                                    line-height: 1.2;
                                ">${userKey.replace('User', '使用者 ')}</div>
                                <div style="
                                    color: #64748B;
                                    font-size: 12px;
                                    margin-top: 2px;
                                ">身體測量資料</div>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                `;

                // 添加身體資料標題
                formattedHtml += `
                    <div style="
                        grid-column: 1 / -1;
                    ">
                        <div style="
                            color: #475569;
                            font-size: 14px;
                            font-weight: 600;
                        ">
                            身體資料
                        </div>
                    </div>
                `;



                // 身高資料 - 始終顯示
                const heightValue = bodyInfo.HV && bodyInfo.HV.trim() !== '' ? `${bodyInfo.HV} cm` : '尚未提供';
                const heightColor = bodyInfo.HV && bodyInfo.HV.trim() !== '' ? '#1E293B' : '#9CA3AF';
                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="HV"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'HV', '${userKey}', 'body', '${bodyInfo.HV || ''}', '身高', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">身高</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${heightColor}; font-size: 14px; font-weight: 600;" class="field-value">${heightValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 體重資料 - 始終顯示
                const weightValue = bodyInfo.WV && bodyInfo.WV.trim() !== '' ? `${bodyInfo.WV} kg` : '尚未提供';
                const weightColor = bodyInfo.WV && bodyInfo.WV.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="WV"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'WV', '${userKey}', 'body', '${bodyInfo.WV || ''}', '體重', 'kg')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">體重</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${weightColor}; font-size: 14px; font-weight: 600;" class="field-value">${weightValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 性別資料 - 始終顯示（撐滿整行）
                const genderValue = bodyInfo.Gender ?
                    (bodyInfo.Gender === 'M' ? '男性' : bodyInfo.Gender === 'F' ? '女性' : bodyInfo.Gender) :
                    '尚未提供';
                const genderColor = bodyInfo.Gender ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        grid-column: 1 / -1;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="Gender"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'Gender', '${userKey}', 'body', '${bodyInfo.Gender || ''}', '性別', '')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">性別</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${genderColor}; font-size: 14px; font-weight: 600;" class="field-value">${genderValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 胸圍資料 - 始終顯示，沒有值就顯示「尚未提供」
                const ccValue = bodyInfo.CC && bodyInfo.CC.trim() !== '' ? `${bodyInfo.CC} cm` : '尚未提供';
                const ccValueColor = bodyInfo.CC && bodyInfo.CC.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        grid-column: 1 / -1;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="CC"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'CC', '${userKey}', 'body', '${bodyInfo.CC || ''}', '胸圍', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">胸圍</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${ccValueColor}; font-size: 14px; font-weight: 600;" class="field-value">${ccValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 肩寬資料 - 始終顯示
                const shoulderValue = bodyInfo.Shoulder && bodyInfo.Shoulder.trim() !== '' ? `${bodyInfo.Shoulder} cm` : '尚未提供';
                const shoulderColor = bodyInfo.Shoulder && bodyInfo.Shoulder.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="Shoulder"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'Shoulder', '${userKey}', 'body', '${bodyInfo.Shoulder || ''}', '肩寬', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">肩寬</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${shoulderColor}; font-size: 14px; font-weight: 600;" class="field-value">${shoulderValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 上胸圍資料 - 始終顯示
                const upChestValue = bodyInfo.UpChest && bodyInfo.UpChest.trim() !== '' ? `${bodyInfo.UpChest} cm` : '尚未提供';
                const upChestColor = bodyInfo.UpChest && bodyInfo.UpChest.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="UpChest"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'UpChest', '${userKey}', 'body', '${bodyInfo.UpChest || ''}', '上胸圍', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">上胸圍</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${upChestColor}; font-size: 14px; font-weight: 600;" class="field-value">${upChestValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 下胸圍資料 - 始終顯示
                const dnChestValue = bodyInfo.DnChest && bodyInfo.DnChest.trim() !== '' ? `${bodyInfo.DnChest} cm` : '尚未提供';
                const dnChestColor = bodyInfo.DnChest && bodyInfo.DnChest.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="DnChest"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'DnChest', '${userKey}', 'body', '${bodyInfo.DnChest || ''}', '下胸圍', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">下胸圍</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${dnChestColor}; font-size: 14px; font-weight: 600;" class="field-value">${dnChestValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 腰圍資料 - 始終顯示
                const waistValue = bodyInfo.Waist && bodyInfo.Waist.trim() !== '' ? `${bodyInfo.Waist} cm` : '尚未提供';
                const waistColor = bodyInfo.Waist && bodyInfo.Waist.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="Waist"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'Waist', '${userKey}', 'body', '${bodyInfo.Waist || ''}', '腰圍', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">腰圍</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${waistColor}; font-size: 14px; font-weight: 600;" class="field-value">${waistValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // 臀圍資料 - 始終顯示
                const hipValue = bodyInfo.Hip && bodyInfo.Hip.trim() !== '' ? `${bodyInfo.Hip} cm` : '尚未提供';
                const hipColor = bodyInfo.Hip && bodyInfo.Hip.trim() !== '' ? '#1E293B' : '#9CA3AF';

                formattedHtml += `
                    <div style="
                        background: #F1F5F9;
                        border-radius: 8px;
                        padding: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        position: relative;
                        transition: all 0.2s ease;
                        cursor: pointer;
                    " 
                    class="editable-field"
                    data-field="Hip"
                    data-user="${userKey}"
                    data-type="body"
                    onclick="editField(this, 'Hip', '${userKey}', 'body', '${bodyInfo.Hip || ''}', '臀圍', 'cm')"
                    onmouseenter="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.2)'"
                    onmouseleave="this.querySelector('.edit-icon').style.background='rgba(107, 114, 128, 0.1)'"
                    >
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: #475569; font-size: 13px; font-weight: 500;">臀圍</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: ${hipColor}; font-size: 14px; font-weight: 600;" class="field-value">${hipValue}</span>
                            <div class="edit-icon" style="
                                opacity: 1;
                                transition: all 0.2s ease;
                                cursor: pointer;
                                padding: 4px;
                                border-radius: 4px;
                                background: rgba(107, 114, 128, 0.1);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M18.5 2.50023C18.8978 2.10243 19.4374 1.87891 20 1.87891C20.5626 1.87891 21.1022 2.10243 21.5 2.50023C21.8978 2.89804 22.1213 3.43762 22.1213 4.00023C22.1213 4.56284 21.8978 5.10243 21.5 5.50023L12 15.0002L8 16.0002L9 12.0002L18.5 2.50023Z" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;

                // BMI 資料（始終顯示）
                    formattedHtml += `
                        <div style="
                            grid-column: 1 / -1;
                        ">
                            ${bmiHtml}
                        </div>
                    `;

                // 鞋子資料（整合到身體資料網格中）
                if (shoesInfo && typeof shoesInfo === 'object') {
                    // 添加鞋子尺寸標題和分隔線
                    formattedHtml += `
                        <div style="
                            grid-column: 1 / -1;
                        ">
                            <div style="
                                   color: #475569;
                                    font-size: 14px;
                                    font-weight: 600;
                                    margin-top: 20px;
                            ">
                               鞋子尺寸
                            </div>
                        </div>
                    `;

                    // 裸足長
                    const footLengthValue = shoesInfo.HV && shoesInfo.HV.trim() !== '' ? `${shoesInfo.HV} cm` : '尚未提供';
                    const footLengthColor = shoesInfo.HV && shoesInfo.HV.trim() !== '' ? '#1E293B' : '#9CA3AF';

                    formattedHtml += `
                        <div style="
                            background: #F1F5F9;
                            border-radius: 8px;
                            padding: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        ">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">裸足長</span>
                            </div>
                            <span style="color: ${footLengthColor}; font-size: 14px; font-weight: 600;">${footLengthValue}</span>
                        </div>
                    `;

                    // 裸足寬
                    const footWidthValue = shoesInfo.WV && shoesInfo.WV.trim() !== '' ? `${shoesInfo.WV} cm` : '尚未提供';
                    const footWidthColor = shoesInfo.WV && shoesInfo.WV.trim() !== '' ? '#1E293B' : '#9CA3AF';

                    formattedHtml += `
                        <div style="
                            background: #F1F5F9;
                            border-radius: 8px;
                            padding: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                        ">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">裸足寬</span>
                            </div>
                            <span style="color: ${footWidthColor}; font-size: 14px; font-weight: 600;">${footWidthValue}</span>
                        </div>
                    `;

                    // 腳圍
                    const footCircumValue = shoesInfo.FOOT_CIRCUM && shoesInfo.FOOT_CIRCUM.trim() !== '' ? `${shoesInfo.FOOT_CIRCUM} cm` : '尚未提供';
                    const footCircumColor = shoesInfo.FOOT_CIRCUM && shoesInfo.FOOT_CIRCUM.trim() !== '' ? '#1E293B' : '#9CA3AF';

                    formattedHtml += `
                        <div style="
                            background: #F1F5F9;
                            border-radius: 8px;
                            padding: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            grid-column: 1 / -1;
                        ">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">腳圍</span>
                            </div>
                            <span style="color: ${footCircumColor}; font-size: 14px; font-weight: 600;">${footCircumValue}</span>
                        </div>
                    `;

                    // 小腿圍
                    const calfCircumValue = shoesInfo.CALF_CIRCUM && shoesInfo.CALF_CIRCUM.trim() !== '' ? `${shoesInfo.CALF_CIRCUM} cm` : '尚未提供';
                    const calfCircumColor = shoesInfo.CALF_CIRCUM && shoesInfo.CALF_CIRCUM.trim() !== '' ? '#1E293B' : '#9CA3AF';

                    formattedHtml += `
                        <div style="
                            background: #F1F5F9;
                            border-radius: 8px;
                            padding: 12px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            grid-column: 1 / -1;
                        ">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">小腿圍</span>
                            </div>
                            <span style="color: ${calfCircumColor}; font-size: 14px; font-weight: 600;">${calfCircumValue}</span>
                        </div>
                    `;
                }

                formattedHtml += '</div></div>';
            }
        });

        formattedHtml += '</div>';

        // 如果沒有任何資料，返回空字串
        if (formattedHtml === '<div style="display: flex; flex-direction: column; gap: 16px;"></div>') {
            return '';
        }

        return formattedHtml;
    }

    // 處理登出
    handleLogout() {

        // 隱藏個人資訊畫面
        this.hideProfileModal();

        // 執行登出
        this.signOut();

        // 觸發登出事件
        this.dispatchEvent(new CustomEvent('google-logout', {
            detail: {
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        }));
    }





    // 觸發 Google 登入
    triggerGoogleSignIn() {
        if (window.google && window.google.accounts) {

            // 檢查是否有活躍的 Google 會話
            const hasActiveSession = this.checkGoogleSession();

            try {
                // 使用標準的 prompt 方法
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed()) {

                        // 針對空會話問題，直接使用 OAuth2 方法
                        if (notification.getNotDisplayedReason() === 'no_session' ||
                            notification.getNotDisplayedReason() === 'browser_not_supported' ||
                            notification.getNotDisplayedReason() === 'invalid_client') {
                            this.triggerDirectGoogleSignIn();
                        } else {
                            // 如果無法顯示，嘗試其他方式
                            this.fallbackGoogleSignIn();
                        }
                    } else if (notification.isSkippedMoment()) {} else if (notification.isDismissedMoment()) {}
                });
            } catch (error) {
                console.warn('標準 prompt 方法失敗，使用備用方法:', error);
                this.fallbackGoogleSignIn();
            }
        } else {
            console.error('Google 服務尚未載入');
        }
    }

    // 檢查 Google 會話狀態
    checkGoogleSession() {
        try {
            // 檢查是否有 Google 相關的 cookie
            const cookies = document.cookie.split(';');
            const googleCookies = cookies.filter(cookie =>
                cookie.trim().startsWith('G_AUTHUSER_') ||
                cookie.trim().startsWith('SID=') ||
                cookie.trim().startsWith('SSID=')
            );

            return googleCookies.length > 0;
        } catch (error) {
            console.warn('檢查 Google 會話失敗:', error);
            return false;
        }
    }

    // 重新初始化 Google 登入
    reinitializeGoogleSignIn() {
        try {
            // 清除現有配置
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.cancel();
            }

            // 重新初始化
            this.onGoogleLoaded();

            // 等待 Google 服務載入後再次嘗試
            this.waitForGoogleServices().then(() => {
                this.triggerGoogleSignIn();
            }).catch((error) => {
                console.error('Google 服務載入失敗:', error);
                this.fallbackGoogleSignIn();
            });
        } catch (error) {
            console.error('重新初始化失敗:', error);
            this.fallbackGoogleSignIn();
        }
    }

    // 直接 Google 登入方法（處理空會話問題）
    useDirectGoogleSignIn() {
        try {
            // 創建一個容器來放置 Google 登入按鈕
            const container = document.createElement('div');
            container.id = 'google-signin-container';
            container.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 10001;
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            `;

            // 添加標題
            const title = document.createElement('div');
            title.textContent = 'Google 登入';
            title.style.cssText = `
                font-size: 18px;
                font-weight: 600;
                color: #333;
                margin-bottom: 8px;
            `;
            container.appendChild(title);

            // 創建 Google 登入按鈕容器
            const googleSignInButton = document.createElement('div');
            googleSignInButton.id = 'google-signin-button';
            container.appendChild(googleSignInButton);

            // 添加關閉按鈕
            const closeButton = document.createElement('button');
            closeButton.textContent = '取消';
            closeButton.style.cssText = `
                padding: 8px 16px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            `;
            closeButton.onclick = () => {
                document.body.removeChild(container);
            };
            container.appendChild(closeButton);

            document.body.appendChild(container);

            // 使用 Google 的 renderButton 方法
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.renderButton(googleSignInButton, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    logo_alignment: 'left',
                    width: 300
                });

                // 監聽登入成功事件
                const checkLoginSuccess = this.safeSetInterval(() => {
                    if (this.getUserInfo()) {
                        clearInterval(checkLoginSuccess);
                        document.body.removeChild(container);
                    }
                }, 500);

                // 5秒後自動清理
                const cleanupTimeout = setTimeout(() => {
                    clearInterval(checkLoginSuccess);
                    if (container.parentNode) {
                        document.body.removeChild(container);
                    }
                }, 5000);

                // 保存 timeout ID 以便清理
                this.activeTimeouts.add(cleanupTimeout);
            } else {
                document.body.removeChild(container);
                this.triggerDirectGoogleSignIn();
            }
        } catch (error) {
            console.error('直接登入方法失敗:', error);
            this.triggerDirectGoogleSignIn();
        }
    }

    // 備用 Google 登入方法
    fallbackGoogleSignIn() {
        try {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                const config = {
                    client_id: this.clientId,
                    callback: this.handleCredentialResponse,
                    auto_select: false,
                    cancel_on_tap_outside: false,
                    context: 'signin',
                    select_account: true,
                    use_fedcm_for_prompt: true
                };

                // 重新初始化
                window.google.accounts.id.initialize(config);

                // 延遲一下再觸發，確保初始化完成
                const initTimeout = setTimeout(() => {
                    try {
                        window.google.accounts.id.prompt((notification) => {
                            if (notification.isNotDisplayed()) {
                                // 最後嘗試直接調用
                                this.triggerDirectGoogleSignIn();
                            }
                        });
                    } catch (error) {
                        console.warn('備用 prompt 失敗，嘗試直接調用:', error);
                        this.triggerDirectGoogleSignIn();
                    }
                }, 200);

                // 保存 timeout ID 以便清理
                this.activeTimeouts.add(initTimeout);
            }
        } catch (error) {
            console.error('備用登入方法也失敗:', error);
            this.handleLoginFailure(error);
        }
    }

    // 直接觸發 Google 登入（最後手段）
    triggerDirectGoogleSignIn() {
        try {
            // 構建 OAuth2 授權 URL，請求 refresh token
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(this.clientId)}` +
                `&redirect_uri=${encodeURIComponent(window.location.origin)}` +
                `&response_type=code` + // 使用 code 而不是 token，這樣可以獲取 refresh token
                `&scope=${encodeURIComponent('openid email profile')}` +
                `&state=${encodeURIComponent('google_signin')}` +
                `&prompt=select_account` +
                `&access_type=offline`; // 請求 refresh token

            // 在新視窗中打開授權頁面
            const authWindow = window.open(authUrl, 'google_auth',
                'width=500,height=600,scrollbars=yes,resizable=yes');

            // 監聽授權結果
            const checkAuthResult = this.safeSetInterval(() => {
                try {
                    if (authWindow.closed) {
                        clearInterval(checkAuthResult);
                        // 檢查 URL 中是否有 authorization code
                        const urlParams = new URLSearchParams(window.location.search);
                        const code = urlParams.get('code');
                        if (code) {
                            // 使用 authorization code 交換 access token 和 refresh token
                            this.exchangeCodeForTokens(code);
                        }
                    }
                } catch (error) {
                    // 視窗可能已經關閉
                    clearInterval(checkAuthResult);
                }
            }, 1000);

        } catch (error) {
            console.error('直接 Google 登入失敗:', error);
            // 顯示錯誤訊息給用戶
            alert('Google 登入暫時無法使用，請稍後再試。');
        }
    }

    // 使用 authorization code 交換 tokens
    async exchangeCodeForTokens(code) {
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: 'YOUR_GOOGLE_CLIENT_SECRET', // 需要替換為實際的 client secret
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: window.location.origin,
                }),
            });

            if (!response.ok) {
                throw new Error(`Token 交換失敗: ${response.status}`);
            }

            const data = await response.json();
            
            // 處理授權成功，包含 refresh token
            await this.handleAuthSuccess(data.access_token, data.refresh_token);
            
        } catch (error) {
            console.error('Token 交換失敗:', error);
            alert('登入失敗，請重試。');
        }
    }

    // 處理 OAuth2 授權成功
    async handleAuthSuccess(accessToken, refreshToken = null) {
        try {
            // 保存 tokens
            this.saveTokens(accessToken, refreshToken);

            // 創建 credential 並保存
            const credential = `oauth2_${accessToken}`;
            this.saveCredential(credential);

            // 使用 access token 獲取用戶資訊
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.ok) {
                const userInfo = await response.json();

                // 保存用戶資訊
                this.saveUserInfo(userInfo);

                // 調用 infFITS API
                const apiResponse = await this.callInfFitsAPI(credential);

                // 檢查 API 回應中是否有 picture 欄位，如果有則更新用戶資訊
                if (apiResponse && apiResponse.picture) {
                    // 更新用戶資訊中的 picture
                    userInfo.picture = apiResponse.picture;
                    this.saveUserInfo(userInfo);
                }

                // 更新頭像顯示
                this.updateAvatar();

                // 隱藏登入畫面
                this.hideLoginModal();

                // 觸發成功事件
                this.dispatchEvent(new CustomEvent('inf-google-login-success', {
                    detail: {
                        user: userInfo,
                        accessToken: accessToken,
                        apiResponse: apiResponse,
                        timestamp: new Date().toISOString()
                    },
                    bubbles: true,
                    composed: true
                }));
            } else {
                throw new Error('無法獲取用戶資訊');
            }
        } catch (error) {
            console.error('處理 OAuth2 授權失敗:', error);
            alert('登入成功但無法獲取用戶資訊，請重試。');
        }
    }

    // 保存 tokens
    saveTokens(accessToken, refreshToken = null) {
        if (accessToken) {
            localStorage.setItem('google_access_token', accessToken);
            
            // 如果有 refresh token，也保存它
            if (refreshToken) {
                localStorage.setItem('google_refresh_token', refreshToken);
            }
            
            // 保存 token 過期時間（預設一小時後）
            const expiresAt = Date.now() + (60 * 60 * 1000); // 一小時
            localStorage.setItem('google_token_expires_at', expiresAt.toString());
        }
    }

    // 獲取有效的 access token
    async getValidAccessToken() {
        const accessToken = localStorage.getItem('google_access_token');
        const refreshToken = localStorage.getItem('google_refresh_token');
        const expiresAt = localStorage.getItem('google_token_expires_at');

        // 如果沒有 access token，返回 null
        if (!accessToken) {
            return null;
        }

        // 檢查 token 是否即將過期（提前 5 分鐘刷新）
        const now = Date.now();
        const expiresAtTime = parseInt(expiresAt || '0');
        const shouldRefresh = now >= (expiresAtTime - (5 * 60 * 1000)); // 提前 5 分鐘

        if (shouldRefresh && refreshToken) {
            try {
                console.log('🔄 Token 即將過期，正在刷新...');
                const newAccessToken = await this.refreshAccessToken(refreshToken);
                return newAccessToken;
            } catch (error) {
                console.error('❌ 刷新 token 失敗:', error);
                // 如果刷新失敗，清除所有 tokens
                this.clearTokens();
                return null;
            }
        }

        return accessToken;
    }

    // 刷新 access token
    async refreshAccessToken(refreshToken) {
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: 'YOUR_GOOGLE_CLIENT_ID', // 需要替換為實際的 client ID
                    client_secret: 'YOUR_GOOGLE_CLIENT_SECRET', // 需要替換為實際的 client secret
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            if (!response.ok) {
                throw new Error(`刷新 token 失敗: ${response.status}`);
            }

            const data = await response.json();
            
            // 保存新的 access token
            this.saveTokens(data.access_token, refreshToken);
            
            return data.access_token;
        } catch (error) {
            console.error('刷新 access token 失敗:', error);
            throw error;
        }
    }

    // 清除所有 tokens
    clearTokens() {
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_refresh_token');
        localStorage.removeItem('google_token_expires_at');
        localStorage.removeItem('google_auth_credential'); // 也清除舊的 credential
    }

    // 處理 localStorage 變更
    handleStorageChange(event) {
        console.log('🔍 Storage 事件處理:', event.key, event.newValue);
        
        if (event.key === 'google_auth_credential') {
            if (event.newValue) {
                // 其他頁面登入了，或者當前頁面剛完成登入
                // 避免重複設置相同的狀態
                if (this.credential !== event.newValue) {
                    console.log('🔄 更新憑證狀態:', event.newValue);
                    this.credential = event.newValue;
                    this.isAuthenticated = true;
                    this.getUserInfo();
                    this.getApiResponse(); // 也載入 API 回應數據
                    this.updateAvatar();
                } else {
                    console.log('⏭️ 跳過重複的憑證更新');
                }
            } else {
                // 其他頁面登出了
                console.log('🚪 用戶登出');
                this.credential = null;
                this.isAuthenticated = false;
                this.userInfo = null;
                this.apiResponse = null;
                this.updateAvatar();
            }
        } else if (event.key === 'google_user_info') {
            // 用戶資訊更新時，重新載入用戶資訊
            if (event.newValue) {
                try {
                    this.userInfo = JSON.parse(event.newValue);
                } catch (error) {
                    console.warn('解析用戶資訊失敗:', error);
                    this.userInfo = null;
                }
            } else {
                this.userInfo = null;
            }
            this.updateAvatar();
        } else if (event.key === 'inffits_api_response') {
            // API 回應數據更新時，只更新本地快取，不重新檢查登入狀態（避免死迴圈）
            if (event.newValue) {
                try {
                    this.apiResponse = JSON.parse(event.newValue);
                } catch (error) {
                    console.warn('解析 API 回應數據失敗:', error);
                    this.apiResponse = null;
                }
            } else {
                this.apiResponse = null;
            }
            this.updateAvatar();
        }
    }

    // 組件從 DOM 移除時
    disconnectedCallback() {

        // 清理所有活動的 timeout 和 interval
        this.clearAllTimers();

        // 移除事件監聽器
        window.removeEventListener('storage', this.handleStorageChange.bind(this));

        // 清理其他資源
        this.cleanup();
    }

    // 渲染組件內容
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: inline-block;
                    cursor: default;
                    font-family: 'Noto Sans TC', 'Figtree', sans-serif;
                }
                
                /* 全局字體設定 */
                * {
                    font-family: 'Noto Sans TC', 'Figtree', sans-serif;
                }
                
                /* 中文使用 Noto Sans TC */
                *:lang(zh),
                *:lang(zh-TW),
                *:lang(zh-CN) {
                    font-family: 'Noto Sans TC', sans-serif;
                }
                
                /* 英文和數字使用 Figtree */
                *:lang(en),
                *:lang(en-US),
                *:lang(en-GB) {
                    font-family: 'Figtree', sans-serif;
                }
                
                /* 使用 font-family 堆疊來實現 UTF-8 編碼字體 */
                .profile-modal__info-label-text {
                    font-family: 'Noto Sans TC', sans-serif;
                }
                
                .profile-modal__info-value {
                    font-family: 'Figtree', 'Noto Sans TC', sans-serif;
                }
                .avatar-container {
                    position: relative;
                    width: var(--inf-google-login-width, var(--inf-google-login-size, 40px));
                    height: var(--inf-google-login-height, var(--inf-google-login-size, 40px));
                    border-radius: var(--inf-google-login-border-radius, 50%);
                    overflow: hidden;
                    transition: border-color 0.3s ease;
                }
                
                .avatar-container:hover {
                    opacity: var(--inf-google-login-hover-opacity, 0.8);
                    cursor: pointer;
                }
                
                .avatar-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .default-avatar {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .default-avatar svg {
                    width: 100%;
                    height: 100%;
                }
                
                /* 模態框基礎樣式 */
                .modal {
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
                
                .modal.show {
                    display: flex;
                }
                
                .modal-container {
                    background: white;
                    border-radius: 18px;
                    width: 365px;
                    height: 365px;
                    box-shadow: 0px -10px 72px 0px rgba(0, 0, 0, 0.18), 0px 0px 18px 0px rgba(0, 0, 0, 0.05);
                    backdrop-filter: blur(80px);
                    overflow: hidden;
                    position: relative;
                }
                
                /* 標題區域 */
                .title-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 20px;
                    width: 355px;
                    backdrop-filter: blur(32px);
                    position: relative;
                    box-sizing: border-box;
                }
                
                .title-text {
                    font-weight: 700;
                    font-size: 17px;
                    line-height: 1.1176470588235294em;
                    letter-spacing: 2%;
                    color: rgba(0, 0, 0, 0.95);
                    flex: 1;
                    text-align: center;
                    padding: 0 12px;
                    min-width: 0;
                }
                
                .back-arrow {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                }
                
                .back-arrow:hover {
                    background-color: rgba(0, 0, 0, 0.05);
                }
                
                .back-arrow svg {
                    width: 32px;
                    height: 32px;
                }
                
                /* 登入畫面內容 */
                .login-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 24px;
                    padding: 32px 16px 24px;
                    height: 445px;
                }
                
                .logo-container {
                    width: 121px;
                    height: 26px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .divider {
                    display: flex;
                    gap: 6px;
                    width: 100%;
                }
                
                .divider-line {
                    flex: 1;
                    height: 1px;
                    background-color: #D7D7D6;
                }
                
                .inf-google-login-button-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                }
                
                .inf-google-login-button {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 14px;
                    background-color: #F2F2F2;
                    border-radius: 40px;
                    border: none;
                    cursor: pointer;
                    width: 100%;
                    position: relative;
                }
                
                .inf-google-login-button:hover {
                    background-color: #E8E8E8;
                }
                
                .inf-google-login-text {
                    font-weight: 500;
                    font-size: 17px;
                    line-height: 1.2941176470588236em;
                    letter-spacing: 2%;
                    color: rgba(0, 0, 0, 0.95);
                }
                
                .google-icon {
                    position: absolute;
                    left: 14px;
                    top: 13px;
                    width: 16px;
                    height: 16px;
                }
                
                /* 個人資訊畫面內容 */
                .profile-content {
                    display: flex;
                    flex-direction: column;
                    overflow-y: auto;
                    align-items: center;
                    gap: 24px;
                    padding: 24px 18px 16px;
                    width: 355px;
                    height: 447px;
                }
                
                .profile-header {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }
                
                .profile-avatar {
                    position: relative;
                    width: 72px;
                    height: 72px;
                }
                
                .profile-avatar img {
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                    object-fit: cover;
                }
                

                
                .profile-info-section {
                    display: flex;
                    flex-direction: column;
                    width: 319px;
                }
                
                .info-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 8px;
                    padding: 18px 0px;
                    border-bottom: 1px solid #E0E0DF;
                }
                
                .info-item:last-child {
                    border-bottom: none;
                }
                
                .info-content {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                
                .info-label {
                    font-weight: 500;
                    font-size: 17px;
                    line-height: 1.2941176470588236em;
                    letter-spacing: 2%;
                    color: #1E1E19;
                }
                
                .info-value {
                    font-weight: 500;
                    font-size: 15px;
                    line-height: 1.3333333333333333em;
                    letter-spacing: -0.8000000119209291%;
                    color: #787974;
                }
                
                .info-value.verified {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                
                .verified-icon {
                    width: 18px;
                    height: 18px;
                    color: #1EC337;
                }
                
                .edit-button {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 16px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-weight: 400;
                    font-size: 13px;
                    line-height: 1.3846153846153846em;
                    letter-spacing: 2%;
                    color: #787974;
                }
                
                .edit-button:hover {
                    background-color: #f8f9fa;
                    border-radius: 4px;
                }
                
                /* 登出按鈕樣式 */
                .logout-button {
                    display: flex;
                    align-items: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-weight: 400;
                    font-size: 12px;
                    line-height: 1.2;
                    color: #787974;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                    flex-shrink: 0;
                    border-radius: 4px;
                }
                
                .logout-button:hover {
                    color: #333;
                }
                
                .logout-button:active {
                    color: #000;
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
                <div class="default-avatar" id="default-avatar">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g clip-path="url(#clip0_7314_33987)">
                            <rect width="32" height="32" rx="16" fill="#787974"/>
                            <path d="M20.2426 18.2426C19.1174 19.3679 17.5913 20 16 20C14.4087 20 12.8826 19.3679 11.7574 18.2426C10.6321 17.1174 10 15.5913 10 14C10 12.4087 10.6321 10.8826 11.7574 9.75736C12.8826 8.63214 14.4087 8 16 8C17.5913 8 19.1174 8.63214 20.2426 9.75736C21.3679 10.8826 22 12.4087 22 14C22 15.5913 21.3679 17.1174 20.2426 18.2426Z" fill="#FCFCF8"/>
                            <path d="M13.2791 19.3335C7.41602 19.3335 2.66602 24.6668 2.66602 33.6498C2.66602 34.5795 3.45768 35.3335 4.43387 35.3335H27.5648C28.541 35.3335 29.3327 34.5795 29.3327 33.6498C29.3327 24.0002 24.5827 19.3335 18.7196 19.3335H13.2791Z" fill="#FCFCF8"/>
                        </g>
                        <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="15.25" stroke="#787974" stroke-width="1.5"/>
                        <defs>
                            <clipPath id="clip0_7314_33987">
                                <rect width="32" height="32" rx="16" fill="white"/>
                            </clipPath>
                        </defs>
                    </svg>
                </div>
                <img class="avatar-image" id="avatar-image" style="display: none;" alt="用戶頭像">
                    </div>
            
            <!-- 登入畫面 -->
            <div class="modal" id="login-modal">
                <div class="modal-container">
                    <button class="close-button" id="close-login-modal">×</button>
                    
                    <div class="title-section">
                        <div class="back-arrow" id="back-arrow">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15.9996 22.3999L9.59961 15.9999L15.9996 9.5999" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M22.3996 16H9.59961" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                    </div>
                        <div class="title-text">登入</div>
                </div>
                    
                    <div class="login-content">
                        <div class="logo-container">
                            <!-- Logo SVG -->
                            <svg width="121" height="26" viewBox="0 0 121 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M108.993 25.0225C108.218 24.9117 107.436 24.8294 106.666 24.6852C104.615 24.3015 102.652 23.6742 100.911 22.4783C100.822 22.4172 100.739 22.3495 100.619 22.2591C101.246 20.8717 101.871 19.4884 102.51 18.0742C102.858 18.2941 103.158 18.5011 103.473 18.6795C105.75 19.9691 108.199 20.607 110.819 20.5532C111.716 20.5345 112.603 20.4172 113.436 20.0546C114.108 19.7622 114.648 19.3255 114.848 18.585C115.101 17.6489 114.703 16.8506 113.733 16.308C112.679 15.7182 111.505 15.4925 110.357 15.1829C108.727 14.743 107.088 14.3202 105.486 13.7931C104.306 13.4053 103.258 12.7349 102.442 11.7695C101.305 10.4261 100.962 8.84078 101.151 7.13813C101.482 4.16705 103.268 2.34546 105.957 1.30514C108.231 0.425301 110.608 0.325097 113.005 0.540169C114.851 0.705546 116.634 1.14383 118.314 1.94709C118.689 2.12713 119.05 2.33813 119.452 2.5532C118.876 3.96828 118.313 5.35157 117.729 6.78701C117.554 6.69903 117.4 6.62652 117.251 6.5475C115.036 5.37927 112.696 4.76257 110.175 4.95809C109.304 5.02571 108.458 5.19923 107.709 5.68559C106.86 6.23711 106.459 7.18538 106.709 8.05952C106.886 8.67703 107.347 9.05178 107.883 9.33854C109.031 9.9528 110.3 10.1915 111.549 10.4897C113.416 10.9361 115.305 11.3174 117.035 12.2029C118.81 13.1121 120.052 14.4538 120.353 16.4823C120.739 19.0852 119.941 21.2677 117.844 22.9084C116.19 24.2029 114.238 24.7178 112.187 24.9361C112.043 24.9516 111.903 24.9923 111.76 25.0216C110.838 25.0225 109.915 25.0225 108.993 25.0225Z" fill="#1E1E19"/>
                                <path d="M0.552734 5.36793C0.758844 4.52964 1.18166 3.86813 2.01261 3.51049C3.11241 3.03717 4.63094 3.29705 5.32992 4.09787C6.40039 5.32475 5.91974 7.26691 4.36618 7.83555C3.30141 8.22577 2.26842 8.12964 1.34459 7.38911C0.896523 7.02984 0.735219 6.52149 0.552734 6.01803C0.552734 5.80133 0.552734 5.58463 0.552734 5.36793Z" fill="#1E1E19"/>
                                <path d="M65.2331 11.5178C65.2331 13.038 65.2331 14.4922 65.2331 15.9846C61.581 15.9846 57.9517 15.9846 54.2702 15.9846C54.2702 18.8677 54.2702 21.7133 54.2702 24.5867C52.3932 24.5867 50.5692 24.5867 48.7109 24.5867C48.7109 16.7015 48.7109 8.80743 48.7109 0.865273C48.8429 0.858755 48.9863 0.844906 49.1305 0.844091C54.8405 0.843277 60.5513 0.845721 66.2612 0.835945C66.605 0.83513 66.7337 0.903562 66.7264 1.27831C66.702 2.48238 66.7175 3.68645 66.7166 4.89134C66.7166 5.0111 66.706 5.13004 66.6979 5.30845C62.5529 5.30845 58.4266 5.30845 54.2783 5.30845C54.2783 7.4054 54.2783 9.44287 54.2783 11.5178C57.9297 11.5178 61.5598 11.5178 65.2331 11.5178Z" fill="#1E1E19"/>
                                <path d="M86.4174 24.5827C86.4174 18.1836 86.4174 11.8039 86.4174 5.386C83.8715 5.386 81.3673 5.386 78.8377 5.386C78.8239 5.24832 78.8051 5.14486 78.8051 5.0414C78.8027 3.7697 78.8133 2.4972 78.797 1.22551C78.7929 0.916751 78.8972 0.836914 79.1937 0.836914C85.8675 0.843431 92.5404 0.841802 99.2141 0.843431C99.32 0.843431 99.4251 0.859725 99.5563 0.870315C99.5563 2.37011 99.5563 3.84954 99.5563 5.36971C97.0365 5.36971 94.533 5.36971 91.9937 5.36971C91.9937 11.7901 91.9937 18.1697 91.9937 24.5819C90.1355 24.5827 88.3131 24.5827 86.4174 24.5827Z" fill="#1E1E19"/>
                                <path d="M30.7687 13.9895C30.7687 12.6861 30.7687 11.4567 30.7687 10.1818C31.9963 10.1818 33.2224 10.1818 34.4827 10.1818C34.4909 10.0091 34.5023 9.87955 34.5031 9.74921C34.5047 8.7211 34.543 7.69055 34.4966 6.66407C34.3458 3.35002 36.7564 0.906028 39.4945 0.216008C42.6416 -0.577475 46.0094 0.870183 47.3935 3.6547C47.501 3.87141 47.5898 4.09707 47.7128 4.3765C46.3817 4.7936 45.075 5.20338 43.7405 5.62212C43.2908 4.75206 42.5552 4.32273 41.6118 4.18342C39.9629 3.93984 38.653 5.04126 38.653 6.69259C38.653 7.80216 38.6546 8.91173 38.6562 10.0213C38.6562 10.0474 38.6652 10.0734 38.6815 10.1622C39.286 10.1622 39.9035 10.1622 40.521 10.1622C41.1295 10.1622 41.7373 10.1622 42.3719 10.1622C42.3719 11.438 42.3719 12.6869 42.3719 13.9667C41.1434 13.9667 39.9279 13.9667 38.653 13.9667C38.653 14.1386 38.653 14.2812 38.653 14.4237C38.653 15.5333 38.6163 16.6445 38.6603 17.7525C38.7809 20.8026 36.6684 23.2775 33.932 24.0906C30.635 25.0706 27.0554 23.5309 25.6803 20.5297C25.6029 20.3602 25.5377 20.1842 25.4473 19.9618C26.7931 19.5415 28.1128 19.1292 29.4212 18.7211C30.3247 20.0694 31.6697 20.5329 33.0179 19.9749C33.9629 19.5838 34.4778 18.8669 34.4982 17.847C34.5234 16.5769 34.5039 15.306 34.5039 13.9903C33.2583 13.9895 32.033 13.9895 30.7687 13.9895Z" fill="#1E1E19"/>
                                <path d="M24.1711 24.5974C22.7649 24.5974 21.3719 24.5974 19.921 24.5974C19.921 24.4467 19.921 24.3041 19.921 24.1616C19.921 21.8471 19.9283 19.5327 19.9152 17.2182C19.9128 16.7481 19.859 16.274 19.7865 15.808C19.5739 14.4459 18.6484 13.6182 17.288 13.5335C15.8167 13.4414 14.4513 14.0483 13.8753 15.4724C13.5886 16.1811 13.5226 16.9127 13.5193 17.6565C13.5104 19.795 13.5161 21.9335 13.5161 24.072C13.5161 24.2333 13.5161 24.3946 13.5161 24.5852C12.0871 24.5852 10.6859 24.5852 9.25781 24.5852C9.25781 19.7379 9.25781 14.8997 9.25781 10.0329C10.6045 10.0329 11.9397 10.0329 13.3197 10.0329C13.3197 10.5396 13.3197 11.0447 13.3197 11.6019C13.701 11.3127 14.013 11.039 14.3592 10.819C15.8729 9.85689 17.5446 9.65078 19.2823 9.88296C22.3438 10.2919 24.0244 12.4744 24.1385 15.3771C24.2558 18.3636 24.1947 21.3575 24.2102 24.3481C24.2102 24.4263 24.1865 24.5045 24.1711 24.5974Z" fill="#1E1E19"/>
                                <path d="M75.5762 24.6023C73.7146 24.6023 71.8988 24.6023 70.0527 24.6023C70.0527 16.6944 70.0527 8.79949 70.0527 0.871993C70.179 0.862217 70.2963 0.844294 70.4144 0.844294C72.0153 0.842665 73.6161 0.849997 75.2169 0.836962C75.5216 0.834518 75.6087 0.924946 75.6079 1.228C75.6006 8.90213 75.6022 16.5763 75.6006 24.2512C75.6022 24.3563 75.5867 24.4622 75.5762 24.6023Z" fill="#1E1E19"/>
                                <path d="M1.125 10.019C2.54822 10.019 3.92744 10.019 5.34007 10.019C5.34007 14.8785 5.34007 19.7241 5.34007 24.5918C3.94048 24.5918 2.55066 24.5918 1.125 24.5918C1.125 19.7445 1.125 14.8997 1.125 10.019Z" fill="#1E1E19"/>
                            </svg>
            </div>
            
                        <div class="divider">
                            <div class="divider-line"></div>
                            <div class="divider-line"></div>
                        </div>
                        
                        <div class="inf-google-login-button-container">
                            <button class="inf-google-login-button" id="inf-google-login-button">
                                <svg class="google-icon" width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <g clip-path="url(#clip0_7461_9318)">
                                        <path d="M15.8099 8.17192C15.8099 7.5164 15.7567 7.03805 15.6416 6.54199H8.15625V9.50065H12.55C12.4614 10.2359 11.9831 11.3432 10.92 12.0873L10.9051 12.1863L13.2719 14.0198L13.4358 14.0362C14.9417 12.6454 15.8099 10.5991 15.8099 8.17192Z" fill="#4285F4"/>
                                        <path d="M8.15534 15.9675C10.3079 15.9675 12.115 15.2588 13.4349 14.0364L10.9191 12.0875C10.2459 12.557 9.34233 12.8848 8.15534 12.8848C6.04707 12.8848 4.25769 11.494 3.61983 9.57178L3.52633 9.57972L1.06539 11.4843L1.0332 11.5737C2.34423 14.1781 5.03717 15.9675 8.15534 15.9675Z" fill="#34A853"/>
                                        <path d="M3.6206 9.57182C3.4523 9.07576 3.35489 8.54422 3.35489 7.99503C3.35489 7.44578 3.4523 6.9143 3.61175 6.41824L3.60729 6.31259L1.1155 4.37744L1.03398 4.41622C0.49364 5.49695 0.183594 6.71057 0.183594 7.99503C0.183594 9.27949 0.49364 10.493 1.03398 11.5738L3.6206 9.57182Z" fill="#FBBC05"/>
                                        <path d="M8.15534 3.10515C9.65238 3.10515 10.6622 3.7518 11.238 4.2922L13.488 2.09532C12.1062 0.810858 10.3079 0.0224609 8.15534 0.0224609C5.03717 0.0224609 2.34423 1.81184 1.0332 4.41617L3.61097 6.41819C4.25769 4.49593 6.04707 3.10515 8.15534 3.10515Z" fill="#EB4335"/>
                                    </g>
                                    <defs>
                                        <clipPath id="clip0_7461_9318">
                                            <rect width="16" height="16" fill="white" transform="translate(0 0.0224609)"/>
                                        </clipPath>
                                    </defs>
                                </svg>
                                <span class="inf-google-login-text">繼續使用 Google 登入</span>
                            </button>
                        </div>
                    </div>
                </div>
                    </div>
                    
            <!-- 個人資訊畫面 -->
            <div class="modal" id="profile-modal">
                <div class="modal-container">
                    <button class="close-button" id="close-profile-modal">×</button>
                    
                    <div class="title-section">
                        <div class="back-arrow" id="profile-back-arrow">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15.9996 22.3999L9.59961 15.9999L15.9996 9.5999" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M22.3996 16H9.59961" stroke="#01453D" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                    </div>
                        <div class="title-text">個人資訊</div>
                          <button class="logout-button" id="logout-button">
                                    登出
                                </button>
                    </div>
                    
                    <div class="profile-content">
                        <div class="profile-header">
                            <div class="profile-avatar">
                                <img id="profile-avatar-image" src="" alt="用戶頭像">
                            </div>
                        </div>
                        
                        <div class="profile-info-section">
                            <div class="info-item">
                                <div class="info-content">
                                    <div class="info-label">姓名</div>
                                    <div class="info-value" id="profile-name">尚未提供</div>
                                </div>
                              
                            </div>
                            
                            <div class="info-item">
                                <div class="info-content">
                                    <div class="info-label">電子郵件</div>
                                    <div class="info-value verified" id="profile-email">
                                        <span>尚未提供</span>
                                        <svg class="verified-icon" viewBox="0 0 18 18" fill="none">
                                            <path d="M0.75 0.75L16.5 16.5" fill="#1EC337"/>
                                            <path d="M5.7 6.52L12.3 11.47" fill="white"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="info-item">
                                <div class="info-content">
                                    <div class="info-label">出生日期</div>
                                    <div class="info-value" id="profile-birthday">尚未提供</div>
                                </div>
                            </div>
                            
                            <div class="info-item">
                                <div class="info-content">
                                    <div class="info-label">電話號碼</div>
                                    <div class="info-value" id="profile-phone">尚未提供</div>
                                </div>
                            </div>
                            
                            <div class="info-item">
                                <div class="info-content">
                                    <div class="info-label">出生日期</div>
                                    <div class="info-value" id="profile-birthday">尚未提供</div>
                                </div>
                            </div>
                            
                            <!-- BodyData 使用者資料區域 -->
                            <div class="info-item" id="body-data-section" style="display: none;">
                                <div class="info-content">
                                    <div class="info-label">使用者資料</div>
                                    <div class="info-value" id="body-data-content">尚未提供</div>
                                </div>
                            </div>
                        </div>
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
                // 確保在 Google 服務載入後再次檢查登入狀態
                this.checkStoredCredential(false); // 只同步狀態，不刷新 API
                this.updateAvatar(); // 更新頭像狀態
                return;
            }

            // 標準載入方式
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;

            script.onload = () => {
                this.isGoogleLoaded = true;
                this.onGoogleLoaded();
                // 確保在 Google 服務載入後再次檢查登入狀態
                this.checkStoredCredential(false); // 只同步狀態，不刷新 API
                this.updateAvatar(); // 更新頭像狀態
            };

            script.onerror = () => {
                console.error('無法載入 Google Identity Services');
                this.isGoogleLoaded = false;
                this.updateAvatar(); // 更新頭像狀態（隱藏頭像）
                this.handleLoginFailure('無法載入 Google Identity Services');
            };

            document.head.appendChild(script);

        } catch (error) {
            console.error('載入 Google 服務時發生錯誤:', error);
            this.isGoogleLoaded = false;
            this.updateAvatar(); // 更新頭像狀態（隱藏頭像）
            this.handleLoginFailure('載入 Google 服務時發生錯誤: ' + error.message);
        }
    }







    // Google 服務載入完成後的回調
    onGoogleLoaded() {

        if (!this.clientId) {
            console.error('缺少 client-id 屬性，請設置您的 Google OAuth2 客戶端 ID');
            return;
        }

        try {
            // 初始化 Google Identity Services
            const config = {
                client_id: this.clientId,
                callback: this.handleCredentialResponse,
                auto_select: false,
                cancel_on_tap_outside: false,
                context: 'signin',
                select_account: true,
                prompt: 'select_account',
                auto_prompt: false,
                state: 'google_signin',
                scope: 'openid email profile'
            };

            window.google.accounts.id.initialize(config);


        } catch (error) {
            console.error('初始化 Google 登入失敗:', error);
        }
    }

    // 處理 Google 登入回調
    async handleCredentialResponse(response) {

        if (!response.credential) {
            this.handleLoginFailure('未收到有效的登入憑證');
            return;
        }

        console.log('🔍 Google One Tap 登入回調處理:', response.credential.substring(0, 50) + '...');

        try {
            // 解析 Google 憑證獲取用戶資訊
            const payload = this.parseCredential(response.credential);
            if (payload) {
                this.saveUserInfo(payload);
            }

            // 保存憑證
            this.saveCredential(response.credential);

            // 確保登入狀態正確設置
            console.log('🔍 設置登入狀態:', this.isAuthenticated);

            // 調用 infFITS API
            const apiResponse = await this.callInfFitsAPI(response.credential);

            // 檢查 API 回應中是否有 picture 欄位，如果有則更新用戶資訊
            if (apiResponse && apiResponse.picture) {
                // 更新用戶資訊中的 picture
                if (payload) {
                    payload.picture = apiResponse.picture;
                    this.saveUserInfo(payload);
                }
            }

            // 再次確保登入狀態正確
            console.log('🔍 API 調用後登入狀態:', this.isAuthenticated);
            
            // 更新頭像顯示
            this.updateAvatar();

            // 隱藏登入畫面
            this.hideLoginModal();

            // 觸發成功事件
            this.dispatchEvent(new CustomEvent('inf-google-login-success', {
                detail: {
                    credential: response.credential,
                    user: payload,
                    apiResponse: apiResponse,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            this.handleLoginFailure('處理登入回調失敗: ' + error.message);
        }
    }

    // 調用 infFITS API
    async callInfFitsAPI(credential) {
        try {
            // 如果是 OAuth2 credential，先確保 token 有效
            if (credential && credential.startsWith('oauth2_')) {
                const accessToken = await this.getValidAccessToken();
                if (accessToken) {
                    credential = `oauth2_${accessToken}`;
                }
            }

            const payload = {
                credential: credential,
                IDTYPE: "Google" // ✅ 關鍵欄位：Lambda 會根據它分辨平台
            };

            const response = await fetch("https://api.inffits.com/inffits_account_register_and_retrieve_data/model", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // 🔐 401 錯誤處理：嘗試刷新 token
                if (response.status === 401) {
                    console.warn('🔐 API 回應 401 - 嘗試刷新 token...');
                    
                    const refreshToken = localStorage.getItem('google_refresh_token');
                    if (refreshToken) {
                        try {
                            // 嘗試刷新 token
                            const newAccessToken = await this.refreshAccessToken(refreshToken);
                            if (newAccessToken) {
                                // 使用新的 token 重新調用 API
                                const newCredential = `oauth2_${newAccessToken}`;
                                return await this.callInfFitsAPI(newCredential);
                            }
                        } catch (refreshError) {
                            console.error('❌ 刷新 token 失敗:', refreshError);
                        }
                    }
                    
                    // 如果刷新失敗，執行登出操作
                    console.warn('🔐 Token 刷新失敗，執行自動登出');
                    this.signOut();

                    // 觸發憑證失效事件
                    this.dispatchEvent(new CustomEvent('credential-expired', {
                        detail: {
                            status: response.status,
                            statusText: response.statusText,
                            timestamp: new Date().toISOString()
                        },
                        bubbles: true,
                        composed: true
                    }));

                    throw new Error(`憑證已失效，已自動登出 (${response.status}: ${response.statusText})`);
                }

                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
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

            // 觸發 localStorage 更新事件
            this.dispatchEvent(new CustomEvent('localStorage-updated', {
                detail: {
                    key: 'inffits_api_response',
                    value: data
                },
                bubbles: true,
                composed: true
            }));

            // 觸發 storage 事件，通知其他組件實例
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'inffits_api_response',
                newValue: JSON.stringify(data),
                oldValue: null,
                storageArea: localStorage
            }));
        } catch (error) {
            console.warn('保存 API 回應數據失敗:', error);
        }
    }

    // 靜默保存 API 回應數據（不觸發 storage 事件）
    saveApiResponseSilently(data) {
        try {
            localStorage.setItem('inffits_api_response', JSON.stringify(data));
            this.apiResponse = data;

            // 只觸發 localStorage 更新事件，不觸發 storage 事件
            this.dispatchEvent(new CustomEvent('localStorage-updated', {
                detail: {
                    key: 'inffits_api_response',
                    value: data
                },
                bubbles: true,
                composed: true
            }));
        } catch (error) {
            console.warn('靜默保存 API 回應數據失敗:', error);
        }
    }

    // 獲取 API 回應數據
    getApiResponse() {
        if (!this.apiResponse) {
            const stored = localStorage.getItem('inffits_api_response');
            if (stored) {
                try {
                    this.apiResponse = JSON.parse(stored);
                } catch (error) {
                    console.warn('解析 API 回應數據失敗:', error);
                    this.apiResponse = null;
                }
            }
        }
        return this.apiResponse;
    }

    // 處理登入失敗
    handleLoginFailure(error) {
        console.error('Google 登入失敗:', error);

        // 觸發失敗事件
        this.dispatchEvent(new CustomEvent('inf-google-login-failure', {
            detail: {
                error: error.message || error,
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        }));
    }

    // 清理資源
    cleanup() {}

    // 公開方法：手動觸發登入
    signIn() {
        this.triggerGoogleSignIn();
    }

    // 公開方法：登出
    signOut() {
        if (window.google && window.google.accounts) {
            try {
                window.google.accounts.id.disableAutoSelect();
                // 清除 Google 的會話狀態
                window.google.accounts.id.revoke(this.clientId, () => {});
            } catch (error) {
                console.warn('Google 登出清理失敗:', error);
            }
        }

        // 清除所有 tokens 和憑證
        this.clearTokens();
        this.clearCredential();

        // 重置狀態
        this.credential = null;
        this.isAuthenticated = false;
        this.userInfo = null;
        this.apiResponse = null;

        // 更新頭像顯示
        this.updateAvatar();

        // 觸發登出事件
        this.dispatchEvent(new CustomEvent('google-logout', {
            bubbles: true,
            composed: true
        }));

        // 觸發 localStorage 更新事件，通知其他組件實例
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'google_auth_credential',
            newValue: null,
            oldValue: this.credential,
            storageArea: localStorage
        }));
    }

    // 設置預設使用者
    async setDefaultUser(userKey) {
        try {
            // 獲取當前 API 回應
            const currentApiResponse = this.getApiResponse();
            if (!currentApiResponse || !currentApiResponse.BodyData) {
                console.warn('❌ 沒有可用的 BodyData 來更新預設使用者');
                return;
            }

            // 檢查使用者是否存在
            if (!currentApiResponse.BodyData[userKey]) {
                console.warn(`❌ 使用者 ${userKey} 不存在於 BodyData 中`);
                return;
            }

            // 獲取當前憑證
            const credential = localStorage.getItem('google_auth_credential');
            if (!credential) {
                console.warn('❌ 沒有可用的憑證來更新預設使用者');
                return;
            }

            // 準備 API 請求資料
            const payload = {
                BodyData: currentApiResponse.BodyData,
                BodyData_ptr: userKey,
                update_bodydata: true,
                credential: credential,
                IDTYPE: "Google"
            };

            console.log('🔄 正在更新預設使用者為:', userKey);

            // 調用 API 更新預設使用者
            const response = await fetch("https://api.inffits.com/inffits_account_register_and_retrieve_data/model", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 401) {
                    // 401 錯誤處理：憑證失效，自動登出
                    console.warn('🔐 API 回應 401 - 憑證已失效，執行自動登出');
                    this.signOut();
                    this.dispatchEvent(new CustomEvent('credential-expired', {
                        detail: {
                            message: '憑證已失效，已自動登出',
                            timestamp: new Date().toISOString()
                        },
                        bubbles: true,
                        composed: true
                    }));
                    throw new Error(`憑證已失效，已自動登出`);
                }
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ 預設使用者更新成功:', data);

            // 保存新的 API 回應（不觸發額外的 storage 事件）
            this.saveApiResponseSilently(data);

            // 更新顯示
            this.updateBodyDataDisplay(data);

            // 觸發事件通知其他組件
            this.dispatchEvent(new CustomEvent('default-user-updated', {
                detail: {
                    userKey: userKey,
                    apiResponse: data,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            console.error('❌ 更新預設使用者失敗:', error);

            // 顯示錯誤提示（可選）
            this.showErrorNotification('更新預設使用者失敗: ' + error.message);
        }
    }

    // 顯示錯誤通知
    showErrorNotification(message) {
        // 創建錯誤通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease-out;
        `;

        // 添加動畫樣式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        notification.textContent = message;
        document.body.appendChild(notification);

        // 3秒後自動移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 更新編輯圖標的 onclick 屬性
function updateEditFieldOnclick(fieldContainer, fieldName, userKey, newValue, fieldLabel, unit) {
    if (!fieldContainer) {
        console.log('❌ fieldContainer 為空，無法更新 onclick');
        return;
    }
    
    // 根據欄位類型構建新的 onclick 屬性
    let newOnclick = '';
    
    if (fieldName === 'HV') {
        newOnclick = `editField(this, 'HV', '${userKey}', 'body', '${newValue}', '身高', 'cm')`;
    } else if (fieldName === 'WV') {
        newOnclick = `editField(this, 'WV', '${userKey}', 'body', '${newValue}', '體重', 'kg')`;
    } else if (fieldName === 'Gender') {
        newOnclick = `editField(this, 'Gender', '${userKey}', 'body', '${newValue}', '性別', '')`;
    } else if (fieldName === 'CC') {
        newOnclick = `editField(this, 'CC', '${userKey}', 'body', '${newValue}', '胸圍', 'cm')`;
    }
    
    if (newOnclick) {
        // 更新欄位容器的 onclick 屬性
        fieldContainer.setAttribute('onclick', newOnclick);
        console.log(`✅ 更新 ${fieldLabel} 欄位的 onclick 屬性：${newOnclick}`);
        
        // 同時更新編輯圖標的 onclick 屬性（如果有的話）
        const editIcon = fieldContainer.querySelector('.edit-icon');
        if (editIcon) {
            editIcon.setAttribute('onclick', newOnclick);
            console.log(`✅ 更新編輯圖標的 onclick 屬性`);
        }
    }
}

// 更新 BMI 顯示
function updateBMI(userKey) {
    // 獲取當前 API 回應
    const currentApiResponse = JSON.parse(localStorage.getItem('inffits_api_response') || '{}');
    
    // 獲取指定用戶的身體資料
    const userBodyData = currentApiResponse.BodyData[userKey];
    if (!userBodyData || !userBodyData.body) {
        console.log(`❌ 用戶 ${userKey} 沒有身體資料`);
        return;
    }
    
    const bodyInfo = userBodyData.body;
    
    // 設定預設值
    let bmiValue = '尚未提供';
    let bmiStatus = '請提供身高體重';
    let bmiColor = '#9CA3AF'; // 預設灰色
    
    // 檢查是否有身高和體重
    if (bodyInfo.HV && bodyInfo.WV) {
        const height = parseFloat(bodyInfo.HV);
        const weight = parseFloat(bodyInfo.WV);
        
        if (!isNaN(height) && !isNaN(weight) && height > 0 && weight > 0) {
            // 計算 BMI
            const bmi = (weight / (height * height) * 10000).toFixed(1); // 身高轉換為米
            bmiValue = bmi;
            
            // 確定 BMI 狀態和顏色
            if (bmi < 18.5) {
                bmiStatus = '體重過輕';
                bmiColor = '#3B82F6';
            } else if (bmi < 24) {
                bmiStatus = '正常範圍';
                bmiColor = '#10B981';
            } else if (bmi < 27) {
                bmiStatus = '體重過重';
                bmiColor = '#F59E0B';
            } else {
                bmiStatus = '肥胖';
                bmiColor = '#EF4444';
            }
            
            console.log(`🔍 計算結果：身高=${height}cm, 體重=${weight}kg, BMI=${bmiValue}`);
        } else {
            console.log(`❌ 身高或體重數據無效：身高=${height}, 體重=${weight}`);
        }
    } else {
        console.log(`❌ 用戶 ${userKey} 缺少身高或體重數據，顯示預設值`);
    }
    
    // 查找 BMI 顯示元素並更新（無論是否有數據都執行）
            console.log(`🔍 查找用戶 ${userKey} 的 BMI 顯示`);
            
            // 嘗試多種查找方式
            let bmiValueElements = [];
            
            // 方式1：通過 style 屬性查找（在用戶容器內）
            bmiValueElements = document.querySelectorAll(`[data-user="${userKey}"] div[style*="BMI 指數"]`);
            console.log(`🔍 方式1 - 通過 style 屬性查找（用戶容器內）：找到 ${bmiValueElements.length} 個元素`);
            
            // 方式2：通過文本內容查找（在用戶容器內）
            if (bmiValueElements.length === 0) {
                const allDivs = document.querySelectorAll(`[data-user="${userKey}"] div`);
                bmiValueElements = Array.from(allDivs).filter(div => 
                    div.textContent && div.textContent.includes('BMI 指數')
                );
                console.log(`🔍 方式2 - 通過文本內容查找（用戶容器內）：找到 ${bmiValueElements.length} 個元素`);
            }
            
            // 方式3：通過父容器查找（在用戶容器內）
            if (bmiValueElements.length === 0) {
                const userContainer = document.querySelector(`[data-user="${userKey}"]`);
                if (userContainer) {
                    const bmiContainer = userContainer.querySelector('div[style*="linear-gradient"]');
                    if (bmiContainer) {
                        bmiValueElements = [bmiContainer];
                        console.log(`🔍 方式3 - 通過父容器查找（用戶容器內）：找到 ${bmiValueElements.length} 個元素`);
                    }
                }
            }
            
            // 方式4：通過外層容器查找（BMI 可能在用戶容器外）
            if (bmiValueElements.length === 0) {
                console.log(`🔍 方式4 - 通過外層容器查找`);
                
                // 查找包含當前用戶的所有父容器
                const userContainer = document.querySelector(`[data-user="${userKey}"]`);
                if (userContainer) {
                    // 向上查找包含 BMI 的容器
                    let parent = userContainer.parentElement;
                    while (parent && parent !== document.body) {
                        console.log(`🔍 檢查父容器:`, parent);
                        
                        // 在父容器中查找 BMI 元素
                        const bmiInParent = parent.querySelectorAll('div[style*="BMI 指數"]');
                        if (bmiInParent.length > 0) {
                            bmiValueElements = Array.from(bmiInParent);
                            console.log(`🔍 在父容器中找到 ${bmiValueElements.length} 個 BMI 元素`);
                            break;
                        }
                        
                        // 通過文本內容查找
                        const bmiByText = Array.from(parent.querySelectorAll('div')).filter(div => 
                            div.textContent && div.textContent.includes('BMI 指數')
                        );
                        if (bmiByText.length > 0) {
                            bmiValueElements = bmiByText;
                            console.log(`🔍 在父容器中通過文本找到 ${bmiValueElements.length} 個 BMI 元素`);
                            break;
                        }
                        
                        parent = parent.parentElement;
                    }
                }
            }
            
            if (bmiValueElements.length > 0) {
                console.log(`✅ 找到 ${bmiValueElements.length} 個 BMI 顯示元素`);
                
                bmiValueElements.forEach((bmiElement, index) => {
                    console.log(`🔍 處理第 ${index + 1} 個 BMI 元素:`, bmiElement);
                    
                    // 查找 BMI 值和狀態元素
                    let bmiValueElement = bmiElement.querySelector('div[style*="font-size: 16px"]');
                    let bmiStatusElement = bmiElement.querySelector('div[style*="font-size: 11px"]');
                    
                    // 如果沒找到，嘗試其他方式
                    if (!bmiValueElement) {
                        bmiValueElement = bmiElement.querySelector('div[style*="font-size: 16px; font-weight: 600"]');
                    }
                    if (!bmiStatusElement) {
                        bmiStatusElement = bmiElement.querySelector('div[style*="font-size: 11px; margin-top: 2px"]');
                    }
                    
                    console.log(`🔍 BMI 值元素:`, bmiValueElement);
                    console.log(`🔍 BMI 狀態元素:`, bmiStatusElement);
                    
                    if (bmiValueElement) {
                        bmiValueElement.textContent = bmiValue;
                        bmiValueElement.style.color = bmiColor;
                        console.log(`✅ 更新 BMI 值為 ${bmiValue}`);
                    } else {
                        console.log(`❌ 未找到 BMI 值元素`);
                    }
                    
                    if (bmiStatusElement) {
                        bmiStatusElement.textContent = bmiStatus;
                        bmiStatusElement.style.color = bmiColor;
                        console.log(`✅ 更新 BMI 狀態為 ${bmiStatus}`);
                    } else {
                        console.log(`❌ 未找到 BMI 狀態元素`);
                    }
                    
                    // 更新父容器的背景色
                    const parentContainer = bmiElement.closest('div[style*="linear-gradient"]');
                    if (parentContainer) {
                        parentContainer.style.background = `linear-gradient(135deg, ${bmiColor}10, ${bmiColor}05)`;
                        console.log(`✅ 更新 BMI 容器背景色`);
                    } else {
                        console.log(`❌ 未找到 BMI 容器`);
                    }
                });
                
                console.log(`✅ BMI 更新完成：${bmiValue} - ${bmiStatus}`);
            } else {
                console.log(`❌ 未找到用戶 ${userKey} 的 BMI 顯示元素`);
                console.log(`🔍 可用的用戶容器:`, document.querySelectorAll('[data-user]'));
    }
}

// 註冊 Web Component
if (!customElements.get('inf-google-login')) {
    customElements.define('inf-google-login', InfGoogleLoginComponent);
} else {
    console.warn('Google Login Web Component 已經存在，跳過註冊');
}

// 預定義的配置模板
const CONFIG_TEMPLATES = {
    // Product 類型配置（商品推薦頁面）
    product: [
        {
            avatarContainerId: 'intro-content-simple',
            modalContainerId: 'intro-content-simple',
            avatarStyle: {
                desktop: {
                    position: 'absolute',
                    right: '20px',
                    top: '20px',
                    width: '32px',
                    height: '32px',
                },
                mobile: {
                    position: 'absolute',
                    right: '15px',
                    top: '15px',
                    width: '28px',
                    height: '28px',
                }
            }
        },
        {
            avatarContainerId: 'intro-content-advanced',
            modalContainerId: 'intro-content-advanced',
            avatarStyle: {
                desktop: {
                    position: 'absolute',
                    right: '20px',
                    top: '20px',
                    width: '32px',
                    height: '32px',
                },
                mobile: {
                    position: 'absolute',
                    right: '15px',
                    top: '15px',
                    width: '28px',
                    height: '28px',
                }
            }
        },
        {
            avatarContainerId: '#container-container-recom-header',
            modalContainerId: 'container-recom',
            avatarStyle: {
                desktop: {
                    position: 'absolute',
                    right: '20px',
                    top: '20px',
                    width: '32px',
                    height: '32px',
                },
                mobile: {
                    position: 'absolute',
                    right: '15px',
                    top: '15px',
                    width: '28px',
                    height: '28px',
                }
            }
        }
    ],
    
    // Size 類型配置（尺寸選擇頁面）
    size: [
        {
            avatarContainerId: '#container_BF_mbinfo .c_header',
            modalContainerId: 'container_BF_mbinfo',
            modalContainerStyle: {
                desktop: {
                    maxWidth: '90%',
                    margin: '0 auto',
                    paddingTop: '20px'
                },
                mobile: {
                    maxWidth: '90%',
                    margin: '0 auto',
                    paddingTop: '20px'
                }
            }
        },
        {
            avatarContainerId: '#SB_Prod_cart',
            modalContainerId: 'Sizebox_cart',
            modalContainerStyle: {
                desktop: {
                    maxWidth: '90%',
                    margin: '0 auto',
                    paddingTop: '20px'
                },
                mobile: {
                    maxWidth: '90%',
                    margin: '0 auto',
                    paddingTop: '20px'
                }
            }
        }
    ]
};

// 簡化的初始化函數
function createGoogleLoginComponentsByType(type = 'product') {
    if (CONFIG_TEMPLATES[type]) {
        console.log(`使用 ${type} 類型配置模板`);
        createGoogleLoginComponents(CONFIG_TEMPLATES[type]);
    } else {
        console.error(`未知的類型: ${type}，使用預設 product 配置`);
        createGoogleLoginComponents(CONFIG_TEMPLATES.product);
    }
}

// 自動初始化函數
function createGoogleLoginComponents(configs = [{
        avatarContainerId: 'intro-content-simple',
        modalContainerId: 'intro-content-simple',
        avatarStyle: {
            desktop: {
                position: 'absolute',
                right: '20px',
                top: '20px',
                width: '32px',
                height: '32px',
            },
            mobile: {
                position: 'absolute',
                right: '15px',
                top: '15px',
                width: '28px',
                height: '28px',
            }
        }
    },
    {
        avatarContainerId: 'intro-content-advanced',
        modalContainerId: 'intro-content-advanced',
        avatarStyle: {
            desktop: {
                position: 'absolute',
                right: '20px',
                top: '20px',
                width: '32px',
                height: '32px',
            },
            mobile: {
                position: 'absolute',
                right: '15px',
                top: '15px',
                width: '28px',
                height: '28px',
            }
        }
    },
    {
        avatarContainerId: '#container-container-recom-header',
        modalContainerId: 'container-recom',
        avatarStyle: {
            desktop: {
                position: 'absolute',
                right: '20px',
                top: '20px',
                width: '32px',
                height: '32px',
            },
            mobile: {
                position: 'absolute',
                right: '15px',
                top: '15px',
                width: '28px',
                height: '28px',
            }
        }
    },
    {
        avatarContainerId: 'header_BF',
        modalContainerId: 'container_BF_mbinfo',
        avatarStyle: {
            desktop: {
                position: 'absolute',
                left: '10px',
                top: '10px',
                width: '28px',
                height: '28px',
            },
            mobile: {
                position: 'absolute',
                left: '8px',
                top: '8px',
                width: '24px',
                height: '24px',
            }
        },
        modalContainerStyle: {
            desktop: {
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'white',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '440px',
                margin: '0 auto',
                paddingTop: '20px'
            },
            mobile: {
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'white',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '100%',
                margin: '0 auto',
                paddingTop: '10px'
            }
        }
    },
    {
        avatarContainerId: 'SB_Prod_cart',
        modalContainerId: 'SizeBox_cart',
        avatarStyle: {
            desktop: {
                position: 'absolute',
                left: '10px',
                top: '10px',
                width: '28px',
                height: '28px',
            },
            mobile: {
                position: 'absolute',
                left: '10px',
                top: '10px',
                width: '28px',
                height: '28px',
            }
        },
        modalContainerStyle: {
            desktop: {
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'white',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '440px',
                margin: '0 auto',
                paddingTop: '20px'
            },
            mobile: {
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'white',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '100%',
                margin: '0 auto',
                paddingTop: '10px'
            }
        }
    }
]) {
    // 判斷當前螢幕尺寸
    function isDesktop() {
        return window.innerWidth >= 480;
    }

    // 獲取當前適用的樣式
    function getCurrentStyle(avatarStyle) {
        if (typeof avatarStyle === 'object' && avatarStyle.desktop && avatarStyle.mobile) {
            // 新的響應式格式
            return isDesktop() ? avatarStyle.desktop : avatarStyle.mobile;
        } else {
            // 向後兼容：舊的單一樣式格式
            return avatarStyle || {
                position: 'absolute',
                left: '10px',
                top: '10px',
                width: '28px',
                height: '28px',
            };
        }
    }

    // 應用樣式到組件
    function applyStyleToComponent(component, avatarStyle) {
        const currentStyle = getCurrentStyle(avatarStyle);

        // 將 avatarStyle 物件轉換為 CSS 字串和 CSS 變數
        const cssProperties = [];
        const cssVariables = [];

        Object.entries(currentStyle).forEach(([property, value]) => {
            // 將 camelCase 轉換為 kebab-case
            const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();

            // 特殊處理 width 和 height，設定為 CSS 變數
            if (property === 'width') {
                cssVariables.push(`--inf-google-login-width: ${value};`);
            } else if (property === 'height') {
                cssVariables.push(`--inf-google-login-height: ${value};`);
            } else {
                cssProperties.push(`${cssProperty}: ${value};`);
            }
        });

        const cssText = [...cssProperties, ...cssVariables].join('\n                    ');

        component.style.cssText = `
            ${cssText}
        `;
    }



    // 更新現有組件的樣式（不重新創建）
    function updateExistingComponents() {
        configs.forEach(config => {
            const {
                avatarContainerId,
                avatarStyle
            } = config;

            // 處理選擇器（支援 ID 和 CSS 選擇器）
            let containers;
            if (avatarContainerId.includes(' ')) {
                containers = document.querySelectorAll(avatarContainerId);
            } else if (avatarContainerId.startsWith('#')) {
                containers = document.querySelectorAll(avatarContainerId);
            } else {
                const container = document.getElementById(avatarContainerId);
                containers = container ? [container] : [];
            }

            containers.forEach(container => {
                const existingComponents = container.querySelectorAll('inf-google-login');
                existingComponents.forEach(component => {
                    applyStyleToComponent(component, avatarStyle);
                });
            });
        });
    }

    function initComponents() {
        configs.forEach(config => {
            const {
                avatarContainerId,
                modalContainerId,
                avatarStyle,
                modalContainerStyle
            } = config;

            // 處理選擇器（支援 ID 和 CSS 選擇器）
            let containers;
            if (avatarContainerId.includes(' ')) {
                // 如果是 CSS 選擇器（包含空格），使用 querySelectorAll
                containers = document.querySelectorAll(avatarContainerId);
            } else if (avatarContainerId.startsWith('#')) {
                // 如果是 ID 選擇器，使用 querySelectorAll（處理重複 ID）
                containers = document.querySelectorAll(avatarContainerId);
            } else {
                // 如果是純 ID，使用 getElementById
                const container = document.getElementById(avatarContainerId);
                containers = container ? [container] : [];
            }

            containers.forEach(container => {
                // 清理已存在的 Google 登入組件
                const existingComponents = container.querySelectorAll('inf-google-login');
                existingComponents.forEach(component => {
                    component.remove();
                });

                const googleLoginComponent = document.createElement('inf-google-login');
                googleLoginComponent.setAttribute('client-id', '265821704236-fkdt4rrvpmuhf442c7r2dfg16i71c6qg.apps.googleusercontent.com');
                googleLoginComponent.setAttribute('auto-select', 'true');

                // 設置模態框目標容器 ID
                if (modalContainerId) {
                    googleLoginComponent.setAttribute('target-container-id', modalContainerId);
                }

                // 設置模態框容器樣式
                if (modalContainerStyle) {
                    googleLoginComponent.setModalContainerStyle(modalContainerStyle);
                }

                // 應用響應式樣式
                applyStyleToComponent(googleLoginComponent, avatarStyle);

                // 強制重新設定 CSS 樣式，確保樣式正確應用
                const currentStyle = getCurrentStyle(avatarStyle);
                Object.entries(currentStyle).forEach(([property, value]) => {
                    const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                    googleLoginComponent.style.setProperty(cssProperty, value);
                });

                // 確保容器有 position: relative 設定，這樣 absolute 定位的 avatar 才能正確定位
                if (getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
                container.appendChild(googleLoginComponent);

                // 確保樣式正確應用
                if (googleLoginComponent.reapplyStyles) {
                    setTimeout(() => {
                        googleLoginComponent.reapplyStyles();
                    }, 50);
                }
            });
        });
    }

    // 等待 DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initComponents);
    } else {
        initComponents();
    }

    // 簡化的 DOM 變化監聽器
    const observer = new MutationObserver((mutations) => {
        let shouldInit = false;

        mutations.forEach((mutation) => {
            // 檢查新增的節點
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 檢查是否為 intro-content-simple 或 intro-content-advanced
                    if (node.id === 'intro-content-simple' ||
                        node.id === 'intro-content-advanced' ||
                        node.querySelector('#intro-content-simple') ||
                        node.querySelector('#intro-content-advanced')) {
                        shouldInit = true;
                    }
                }
            });

            // 檢查屬性變化
            if (mutation.type === 'attributes' &&
                (mutation.target.id === 'intro-content-simple' ||
                    mutation.target.id === 'intro-content-advanced')) {
                shouldInit = true;
            }
        });

        if (shouldInit) {
            // 檢查是否正在顯示模態框，如果是則不重新初始化
            const modalContainers = document.querySelectorAll('.inf-google-login-modal-container');
            if (modalContainers.length === 0) {
                console.log('檢測到 intro-content 變化，重新初始化 Google Login 組件');
                initComponents();

                // 延遲一點時間，然後重新應用樣式到所有現有的組件
                setTimeout(() => {
                    const allComponents = document.querySelectorAll('inf-google-login');
                    allComponents.forEach(component => {
                        if (component.reapplyStyles) {
                            component.reapplyStyles();
                        }
                    });
                }, 200);
            } else {
                console.log('檢測到模態框正在顯示，跳過重新初始化');
            }
        }
    });

    // 開始監聽整個文檔的變化
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
    });

    // 全局重新應用樣式函數
    const globalReapplyStyles = () => {
        const allComponents = document.querySelectorAll('inf-google-login');
        allComponents.forEach(component => {
            if (component.reapplyStyles) {
                component.reapplyStyles();
            }
        });
    };

    // 監聽 startover 按鈕點擊事件，強制重新初始化
    document.addEventListener('click', (event) => {
        if (event.target && (event.target.id === 'startover' || event.target.closest('#startover'))) {
            console.log('檢測到 startover 按鈕點擊，強制重新初始化');
            // 延遲一點時間確保重置完成
            setTimeout(() => {
                initComponents();
                // 重新應用樣式
                setTimeout(() => {
                    globalReapplyStyles();
                }, 150);
            }, 100);
        }
    });

    // 監聽 startover 按鈕的觸摸事件（移動設備）
    document.addEventListener('touchstart', (event) => {
        if (event.target && (event.target.id === 'startover' || event.target.closest('#startover'))) {
            console.log('檢測到 startover 按鈕觸摸，強制重新初始化');
            // 延遲一點時間確保重置完成
            setTimeout(() => {
                initComponents();
                // 重新應用樣式
                setTimeout(() => {
                    globalReapplyStyles();
                }, 150);
            }, 100);
        }
    });

    // 監聽可能的重新輸入按鈕
    document.addEventListener('click', (event) => {
        const target = event.target;
        const isResetButton = target && (
            target.id === 'startover' ||
            target.closest('#startover') ||
            (target.textContent && target.textContent.includes('重新輸入')) ||
            (target.textContent && target.textContent.includes('重新開始')) ||
            (target.textContent && target.textContent.includes('重新')) ||
            (target.className && typeof target.className === 'string' && target.className.includes('reset')) ||
            (target.className && typeof target.className === 'string' && target.className.includes('restart'))
        );

        if (isResetButton) {
            console.log('檢測到重置按鈕點擊，重新應用樣式');
            setTimeout(() => {
                globalReapplyStyles();
            }, 200);
        }
    });

    // 監聽視窗大小變化，重新應用樣式
    let resizeTimeout;
    let lastScreenSize = isDesktop();

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const currentScreenSize = isDesktop();

            // 只有當螢幕尺寸跨越 480px 邊界時才更新樣式
            if (currentScreenSize !== lastScreenSize) {
                lastScreenSize = currentScreenSize;
                // 只更新現有組件的樣式，不重新創建
                updateExistingComponents();
                // 重新應用樣式
                globalReapplyStyles();
            }
        }, 250); // 防抖動延遲
    });
}

// 不自動執行，等待外層指定目標 ID

// 編輯欄位功能
function editField(editIcon, fieldName, userKey, dataType, currentValue, fieldLabel, unit) {
    // 獲取欄位容器
    const fieldContainer = editIcon.closest('.editable-field');
    const valueElement = fieldContainer.querySelector('.field-value');
    
    // 檢查是否已經在編輯中
    const existingInput = fieldContainer.querySelector('input, select');
    if (existingInput) {
        console.log('欄位正在編輯中，忽略重複點擊');
        return;
    }
    
    let inputElement;
    
    // 根據欄位類型創建不同的輸入元素
    if (fieldName === 'Gender') {
        // 性別欄位使用下拉選單
        inputElement = document.createElement('select');
        inputElement.style.cssText = `
            width: 100px;
            padding: 6px 8px;
            border: 2px solid #3B82F6;
            border-radius: 6px;
            font-size: 14px;
        font-weight: 600;
        color: #1E293B;
            background: white;
            outline: none;
        transition: all 0.2s ease;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            cursor: pointer;
        `;
        
        // 添加選項
        const options = [
            { value: '', label: '請選擇' },
            { value: 'M', label: '男性' },
            { value: 'F', label: '女性' }
        ];
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (option.value === currentValue) {
                optionElement.selected = true;
            }
            inputElement.appendChild(optionElement);
        });
        
    } else {
        // 其他欄位使用輸入框
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        inputElement.value = currentValue;
        inputElement.style.cssText = `
            width: 80px;
            padding: 6px 8px;
            border: 2px solid #3B82F6;
            border-radius: 6px;
        font-size: 14px;
            font-weight: 600;
            color: #1E293B;
            background: white;
            text-align: center;
            outline: none;
        transition: all 0.2s ease;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        `;
        
        // 設置輸入框的 min 和 max 值
        if (fieldName === 'HV') {
            inputElement.min = '100';
            inputElement.max = '250';
            inputElement.step = '0.1';
            // 添加數字輸入限制
            inputElement.pattern = '[0-9]*[.]?[0-9]+';
            inputElement.inputMode = 'decimal';
        } else if (fieldName === 'WV') {
            inputElement.min = '20';
            inputElement.max = '200';
            inputElement.step = '0.1';
            // 添加數字輸入限制
            inputElement.pattern = '[0-9]*[.]?[0-9]+';
            inputElement.inputMode = 'decimal';
        } else if (fieldName === 'CC') {
            inputElement.type = 'text';
            inputElement.placeholder = '例如: 97.5_97.5';
        }
    }
    
    // 隱藏原始值並顯示輸入元素
    valueElement.style.display = 'none';
    valueElement.parentNode.insertBefore(inputElement, valueElement);
    
    // 更新編輯圖標狀態（顯示為編輯中）
    if (editIcon) {
        editIcon.style.setProperty('background', 'rgba(16, 185, 129, 0.2)', 'important');
        editIcon.style.cursor = 'not-allowed';
        editIcon.title = '正在編輯中...';
    }
    
    // 聚焦輸入元素
    inputElement.focus();
    if (inputElement.tagName === 'INPUT') {
        inputElement.select();
    }
    
    // 處理輸入元素的 blur 事件（失去焦點時保存）
    let blurTimeout;
    let isBlurHandled = false;
    
    inputElement.onblur = () => {
        // 如果已經被點擊外部處理，則不執行
        if (isBlurHandled) {
            return;
        }
        
        // 清除之前的 timeout
        if (blurTimeout) {
            clearTimeout(blurTimeout);
        }
        
        // 延遲執行，避免與點擊事件衝突
        blurTimeout = setTimeout(() => {
            saveFieldValue(inputElement, fieldName, userKey, dataType, fieldLabel, unit, valueElement, fieldContainer);
        }, 200);
    };
    
    // 處理 Enter 鍵和數字輸入限制
    inputElement.onkeydown = (e) => {
        if (e.key === 'Enter') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            inputElement.blur();
        } else if (e.key === 'Escape') {
            // 按 ESC 取消編輯
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            cancelEdit(inputElement, valueElement);
        }
        
        // 身高和體重欄位只允許數字、小數點、退格鍵、刪除鍵、方向鍵等
        if (fieldName === 'HV' || fieldName === 'WV') {
            const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Escape'];
            const isNumber = /[0-9]/.test(e.key);
            const isDecimal = e.key === '.';
            const isAllowedKey = allowedKeys.includes(e.key);
            
            // 如果輸入的不是數字、小數點或允許的按鍵，則阻止輸入
            if (!isNumber && !isDecimal && !isAllowedKey) {
                e.preventDefault();
                return;
            }
            
            // 防止多個小數點
            if (isDecimal && inputElement.value.includes('.')) {
                e.preventDefault();
                return;
            }
        }
    };
    
    // 點擊外部保存編輯
    const clickOutsideHandler = (e) => {
        if (!fieldContainer.contains(e.target)) {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            // 標記 blur 事件已被處理，避免重複保存
            isBlurHandled = true;
            // 直接保存，不觸發 blur 事件
            saveFieldValue(inputElement, fieldName, userKey, dataType, fieldLabel, unit, valueElement, fieldContainer);
            document.removeEventListener('click', clickOutsideHandler);
        }
    };
    
    // 延遲添加點擊外部事件，避免立即觸發
    setTimeout(() => {
        document.addEventListener('click', clickOutsideHandler);
    }, 100);
    
    // 添加 input 事件監聽器，進一步過濾輸入內容
    if (fieldName === 'HV' || fieldName === 'WV') {
        inputElement.addEventListener('input', (e) => {
            let value = e.target.value;
            
            // 只保留數字和小數點
            value = value.replace(/[^0-9.]/g, '');
            
            // 防止多個小數點
            const decimalCount = (value.match(/\./g) || []).length;
            if (decimalCount > 1) {
                value = value.replace(/\.+$/, ''); // 移除末尾的多餘小數點
            }
            
            // 限制小數位數為1位
            if (value.includes('.')) {
                const parts = value.split('.');
                if (parts[1].length > 1) {
                    value = parts[0] + '.' + parts[1].substring(0, 1);
                }
            }
            
            // 更新輸入框的值
            e.target.value = value;
        });
    }
    
    // 防止點擊輸入框本身觸發 blur 事件
    inputElement.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
    
    inputElement.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// 保存欄位值
async function saveFieldValue(input, fieldName, userKey, dataType, fieldLabel, unit, valueElement, fieldContainer) {
    const newValue = input.value.trim();
    let originalValue = valueElement.textContent.replace(` ${unit}`, '').replace('尚未提供', '');
    
    // 性別欄位的特殊處理：將顯示值轉換為存儲值進行比較
    if (fieldName === 'Gender') {
        if (originalValue === '男性') {
            originalValue = 'M';
        } else if (originalValue === '女性') {
            originalValue = 'F';
        }
    }
    
    console.log(`🔍 值比較：新值="${newValue}", 原始值="${originalValue}"`);
    
    // 如果值沒有改變，直接取消編輯
    if (newValue === originalValue || (newValue === '' && originalValue === '')) {
        console.log('🔍 值未改變，直接取消編輯');
        cancelEdit(input, valueElement);
        return;
    }
    
    // 驗證輸入值
    if (!validateFieldValue(fieldName, newValue)) {
        showNotification(`❌ ${fieldLabel}格式不正確，請重新輸入`, 'error');
        input.focus();
        return;
    }
    
    try {
        // 顯示保存中狀態
        input.style.borderColor = '#10B981';
        input.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
        
        // 準備更新 payload
        const payload = await prepareUpdatePayload(fieldName, userKey, dataType, newValue);

    // 發送 API 請求
        const response = await fetch('https://api.inffits.com/inffits_account_register_and_retrieve_data/model', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ 欄位更新成功:', data);
        
        // 更新顯示值
        let displayValue, displayColor;
        
        if (fieldName === 'Gender') {
            if (newValue === 'M') {
                displayValue = '男性';
                displayColor = '#1E293B';
            } else if (newValue === 'F') {
                displayValue = '女性';
                displayColor = '#1E293B';
            } else {
                displayValue = '尚未提供';
                displayColor = '#9CA3AF';
            }
        } else {
            displayValue = newValue ? `${newValue} ${unit}` : '尚未提供';
            displayColor = newValue ? '#1E293B' : '#9CA3AF';
        }
        
        valueElement.textContent = displayValue;
        valueElement.style.color = displayColor;
        
        // 保存新的 API 回應到 localStorage
        localStorage.setItem('inffits_api_response', JSON.stringify(data));
        
        // 顯示成功訊息
        showNotification(`✅ ${fieldLabel}更新成功！`, 'success');
        
        // 觸發更新事件
        document.dispatchEvent(new CustomEvent('bodydata-updated', {
            detail: { 
                userKey: userKey,
                fieldName: fieldName,
                newValue: newValue,
                data: data,
                timestamp: new Date().toISOString()
            },
            bubbles: true,
            composed: true
        }));

        // 如果更新的是身高、體重或性別，則更新 BMI
        if (fieldName === 'HV' || fieldName === 'WV' || fieldName === 'Gender') {
            console.log('🔍 更新 BMI 顯示');
            // 延遲執行 BMI 更新，確保 DOM 完全更新
        setTimeout(() => {
                updateBMI(userKey);
            }, 100);
        }
        
        // 更新編輯圖標的 onclick 屬性，使其使用新的值
        if (fieldName === 'HV' || fieldName === 'WV' || fieldName === 'Gender') {
            console.log('🔍 更新編輯圖標的 onclick 屬性');
            updateEditFieldOnclick(fieldContainer, fieldName, userKey, newValue, fieldLabel, unit);
        }

        // 先恢復編輯圖標狀態和欄位容器狀態
        console.log('🔍 檢查 fieldContainer:', fieldContainer);
        if (fieldContainer) {
            // 恢復欄位容器狀態
            fieldContainer.style.setProperty('background', '#F1F5F9', 'important');
            fieldContainer.style.setProperty('cursor', 'pointer', 'important');
            fieldContainer.removeAttribute('title');
            
            const editIcon = fieldContainer.querySelector('.edit-icon');
            console.log('🔍 找到的 editIcon:', editIcon);
            if (editIcon) {
                console.log('🔍 編輯圖標當前樣式:', editIcon.style.cssText);
                console.log('🔍 編輯圖標當前背景色:', editIcon.style.background);
                console.log('🔍 直接恢復編輯圖標狀態，背景色從', editIcon.style.background, '變為 rgba(59, 130, 246, 0.1)');
                editIcon.style.setProperty('background', 'rgba(59, 130, 246, 0.1)', 'important');
                editIcon.style.cursor = 'pointer';
                editIcon.title = '點擊編輯';
                // 清除 hover 事件，防止覆蓋背景色
                editIcon.onmouseenter = null;
                editIcon.onmouseleave = null;
                console.log('🔍 設置後的背景色:', editIcon.style.background);
            } else {
                console.log('❌ 沒有找到 editIcon');
            }
        } else {
            console.log('❌ fieldContainer 為空');
        }
        
        // 恢復顯示
        console.log('🔍 準備調用 cancelEdit，參數檢查:');
        console.log('  - input:', input);
        console.log('  - valueElement:', valueElement);
        console.log('  - valueElement.parentNode:', valueElement.parentNode);
        console.log('  - valueElement.closest(".editable-field"):', valueElement.closest('.editable-field'));
        console.log('  - fieldContainer:', fieldContainer);
        cancelEdit(input, valueElement);
        
    } catch (error) {
        console.error('❌ 欄位更新失敗:', error);
        showNotification(`❌ ${fieldLabel}更新失敗，請稍後再試`, 'error');
        
        // 先恢復編輯圖標狀態和欄位容器狀態
        if (fieldContainer) {
            // 恢復欄位容器狀態
            fieldContainer.style.setProperty('background', '#F1F5F9', 'important');
            fieldContainer.style.setProperty('cursor', 'pointer', 'important');
            fieldContainer.removeAttribute('title');
            
            const editIcon = fieldContainer.querySelector('.edit-icon');
            if (editIcon) {
                console.log('🔍 錯誤處理中直接恢復編輯圖標狀態');
                editIcon.style.setProperty('background', 'rgba(59, 130, 246, 0.1)', 'important');
                editIcon.style.cursor = 'pointer';
                editIcon.title = '點擊編輯';
                // 清除 hover 事件，防止覆蓋背景色
                editIcon.onmouseenter = null;
                editIcon.onmouseleave = null;
            }
        }
        
        // 錯誤處理中也需要更新 onclick 屬性，使用原始值
        console.log('🔍 錯誤處理中更新 onclick 屬性');
        updateEditFieldOnclick(fieldContainer, fieldName, userKey, originalValue, fieldLabel, unit);
        
        // 恢復顯示
        console.log('🔍 錯誤處理中調用 cancelEdit，參數檢查:');
        console.log('  - input:', input);
        console.log('  - valueElement:', valueElement);
        console.log('  - valueElement.parentNode:', valueElement.parentNode);
        cancelEdit(input, valueElement);
    }
}

// 驗證欄位值
function validateFieldValue(fieldName, value) {
    if (!value) return true; // 空值允許
    
    if (fieldName === 'HV') {
        const height = parseFloat(value);
        return !isNaN(height) && height >= 100 && height <= 250;
    } else if (fieldName === 'WV') {
        const weight = parseFloat(value);
        return !isNaN(weight) && weight >= 20 && weight <= 200;
    } else if (fieldName === 'CC') {
        // 胸圍格式：數字_數字 或 純數字
        return /^(\d+(\.\d+)?)(_\d+(\.\d+)?)?$/.test(value);
    }
    
    return true;
}

// 準備更新 payload
async function prepareUpdatePayload(fieldName, userKey, dataType, newValue) {
    // 獲取當前 API 回應
    const currentApiResponse = JSON.parse(localStorage.getItem('inffits_api_response') || '{}');
    
    // 構建新的 BodyData
    const newBodyData = { ...currentApiResponse.BodyData };
    
    if (dataType === 'body') {
        if (!newBodyData[userKey]) {
            newBodyData[userKey] = {};
        }
        if (!newBodyData[userKey].body) {
            newBodyData[userKey].body = {};
        }
        newBodyData[userKey].body[fieldName] = newValue;
    }
    
    // 獲取憑證
    const credential = localStorage.getItem('google_auth_credential');
    if (!credential) {
        throw new Error('沒有可用的憑證');
    }
    
    return {
        BodyData: newBodyData,
        update_bodydata: true,
        credential: credential,
        sub: (() => {
            try {
                const userInfo = JSON.parse(localStorage.getItem('google_user_info') || '{}');
                return userInfo.sub || '';
            } catch (e) {
                return '';
            }
        })(),
        IDTYPE: 'Google'
    };
}

// 取消編輯
function cancelEdit(inputElement, valueElement) {
    // 移除輸入元素
    if (inputElement.parentNode) {
        inputElement.parentNode.removeChild(inputElement);
    }
    
    // 恢復顯示原始值
    valueElement.style.display = 'inline';
    
    // 恢復編輯圖標狀態和欄位容器狀態
    const fieldContainer = valueElement.closest('.editable-field');
    console.log('🔍 cancelEdit: fieldContainer found:', !!fieldContainer);
    if (fieldContainer) {
        // 恢復欄位容器狀態
        fieldContainer.style.setProperty('background', '#F1F5F9', 'important');
        fieldContainer.style.setProperty('cursor', 'pointer', 'important');
        fieldContainer.removeAttribute('title');
        
        const editIcon = fieldContainer.querySelector('.edit-icon');
        console.log('🔍 cancelEdit: editIcon found:', !!editIcon);
        if (editIcon) {
            console.log('🔍 cancelEdit: 恢復編輯圖標狀態，背景色從', editIcon.style.background, '變為 rgba(59, 130, 246, 0.1)');
            editIcon.style.setProperty('background', 'rgba(59, 130, 246, 0.1)', 'important');
            editIcon.style.cursor = 'pointer';
            editIcon.title = '點擊編輯';
            // 清除 hover 事件，防止覆蓋背景色
            editIcon.onmouseenter = null;
            editIcon.onmouseleave = null;
        }
    }
}

// 顯示通知訊息
function showNotification(message, type = 'info') {
    // 移除現有的通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    const bgColor = type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6';
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10001;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;

    document.body.appendChild(notification);

    // 顯示動畫
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // 自動隱藏
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 刪除使用者功能
async function deleteUser(userKey) {
    try {
        console.log(`🗑️ 開始刪除使用者: ${userKey}`);
        
        // 獲取當前 API 回應
        const currentApiResponse = JSON.parse(localStorage.getItem('inffits_api_response') || '{}');
        
        // 檢查使用者是否存在
        if (!currentApiResponse.BodyData || !currentApiResponse.BodyData[userKey]) {
            console.error(`❌ 使用者 ${userKey} 不存在`);
            showNotification(`❌ 使用者 ${userKey} 不存在`, 'error');
            return;
        }
        
        // 檢查使用者數量（用於日誌記錄）
        const userKeys = Object.keys(currentApiResponse.BodyData);
        console.log(`🔍 當前使用者數量: ${userKeys.length}`);
        
        // 獲取憑證資料
        const storedCredential = localStorage.getItem('google_auth_credential');
        const storedUserInfo = localStorage.getItem('google_user_info');
        
        if (!storedCredential) {
            console.error(`❌ 沒有可用的憑證`);
            showNotification(`❌ 沒有可用的憑證，請重新登入`, 'error');
            return;
        }
        
        let subValue = '';
        if (storedUserInfo) {
            try {
                const userInfo = JSON.parse(storedUserInfo);
                subValue = userInfo.sub || '';
            } catch (e) {
                console.warn('解析 localStorage 用戶資訊失敗:', e);
            }
        }
        
        // 創建新的 BodyData，移除指定使用者
        const newBodyData = { ...currentApiResponse.BodyData };
        delete newBodyData[userKey];
        
        // 如果刪除的是預設使用者，需要重新設定預設使用者
        let newBodyDataPtr = currentApiResponse.BodyData_ptr;
        if (newBodyDataPtr === userKey) {
            // 選擇第一個可用的使用者作為新的預設使用者
            const remainingUsers = Object.keys(newBodyData);
            if (remainingUsers.length > 0) {
                newBodyDataPtr = remainingUsers[0];
                console.log(`🔄 重新設定預設使用者為: ${newBodyDataPtr}`);
            } else {
                // 如果沒有剩餘使用者，設定為空字串
                newBodyDataPtr = '';
                console.log(`🔄 沒有剩餘使用者，預設使用者設為空`);
            }
        }
        
        // 準備 API 請求資料
        const payload = {
            BodyData: newBodyData,
            BodyData_ptr: newBodyDataPtr,
            update_bodydata: true,
            credential: storedCredential,
            sub: subValue,
            IDTYPE: 'Google'
        };
        
        console.log(`📤 發送刪除使用者請求:`, payload);
        
        // 調用 API 刪除使用者
        const response = await fetch('https://api.inffits.com/inffits_account_register_and_retrieve_data/model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ 刪除使用者 API 回應:`, data);
        
        if (data.success) {
            // 更新本地儲存的 API 回應
            const updatedApiResponse = {
                ...currentApiResponse,
                BodyData: newBodyData,
                BodyData_ptr: newBodyDataPtr
            };
            localStorage.setItem('inffits_api_response', JSON.stringify(updatedApiResponse));
            
            // 顯示成功訊息
            const remainingCount = Object.keys(newBodyData).length;
            if (remainingCount === 0) {
                showNotification(`✅ 使用者 ${userKey} 已成功刪除，所有使用者已清空`, 'success');
            } else {
                showNotification(`✅ 使用者 ${userKey} 已成功刪除，剩餘 ${remainingCount} 個使用者`, 'success');
            }
            
            // 觸發刪除事件
            document.dispatchEvent(new CustomEvent('user-deleted', {
                detail: { 
                    deletedUserKey: userKey,
                    newDefaultUser: newBodyDataPtr,
                    data: data,
                    timestamp: new Date().toISOString()
                },
                bubbles: true,
                composed: true
            }));
            
            // 重新載入頁面以更新顯示
            setTimeout(() => {
                console.log(`🔄 重新載入頁面以更新顯示`);
                window.location.reload();
            }, 1500);
            
        } else {
            throw new Error(data.message || '刪除使用者失敗');
        }
        
    } catch (error) {
        console.error(`❌ 刪除使用者失敗:`, error);
        showNotification(`❌ 刪除使用者失敗: ${error.message}`, 'error');
    }
}