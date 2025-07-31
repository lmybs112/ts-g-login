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

            // 觸發 localStorage 更新事件
            this.dispatchEvent(new CustomEvent('localStorage-updated', {
                detail: {
                    key: 'google_auth_credential',
                    value: credential
                },
                bubbles: true,
                composed: true
            }));
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

        // 優先使用 API 回應中的 picture，如果沒有則使用 Google 用戶資訊中的 picture
        let pictureUrl = null;
        const apiResponse = this.getApiResponse();

        if (apiResponse && apiResponse.picture) {
            pictureUrl = apiResponse.picture;
            console.log('使用 API 回傳的 picture:', pictureUrl);
        } else if (this.userInfo && this.userInfo.picture) {
            pictureUrl = this.userInfo.picture;
            console.log('使用 Google 用戶資訊的 picture:', pictureUrl);
        }

        if (this.isAuthenticated && pictureUrl) {
            // 顯示用戶頭像
            avatarImage.src = pictureUrl;
            avatarImage.style.display = 'block';
            defaultAvatar.style.display = 'none';
        } else {
            // 顯示預設頭像
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
        // 載入 Google Fonts
        this.loadGoogleFonts();

        this.render();
        this.updateAvatar(); // 初始化頭像顯示
        this.setupEventListeners(); // 在 DOM 渲染後設置事件監聽器
        this.loadGoogleIdentityServices();

        // Debug 模式：添加模擬登入按鈕（僅在開發環境）
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.addDebugButtons();
        }
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
        fontLink.onload = () => {
            console.log('Google Fonts 載入完成：Noto Sans TC, Figtree');
        };

        fontLink.onerror = () => {
            console.warn('Google Fonts 載入失敗，將使用系統預設字體');
        };
    }

    // 設置事件監聽器
    setupEventListeners() {
        const avatarContainer = this.shadowRoot.getElementById('avatar-container');

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
        const googleLoginButton = this.shadowRoot.getElementById('google-login-button');
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
    }

    // 處理頭像點擊
    handleAvatarClick() {
        console.log('處理頭像點擊，登入狀態:', this.isAuthenticated);

        if (this.isAuthenticated) {
            // 已登入：顯示個人資訊畫面
            console.log('用戶已登入，顯示個人資訊畫面');
            this.showProfileModal();
        } else {
            // 未登入：顯示登入畫面
            console.log('用戶未登入，顯示登入畫面');
            this.showLoginModal();
        }
    }



    // 獲取當前顯示的內容區域
    getCurrentContentContainer() {
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
            return;
        }

        // 隱藏原本內容
        this.hideOriginalContent(targetContainer);

        // 創建並顯示個人資訊畫面
        this.showModalInContainer(targetContainer, 'profile');
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
                setTimeout(() => {
                    this.hideModalInContainer(targetContainer);
                    this.showOriginalContent(targetContainer);
                }, 300);
            } else {
                this.hideModalInContainer(targetContainer);
                this.showOriginalContent(targetContainer);
            }
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
        
        // 移動所有子元素到隱藏容器
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
                <google-login 
                    client-id="265821704236-fkdt4rrvpmuhf442c7r2dfg16i71c6qg.apps.googleusercontent.com"
                    auto-select="true"
                    style="position: absolute; right: 8px; top: 8px;">
                </google-login>
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
        const googleLoginElement = container.querySelector('google-login');
        if (googleLoginElement) {
            // 重新初始化 Google Login 組件
            if (googleLoginElement.connectedCallback) {
                googleLoginElement.connectedCallback();
            }
        }
    }

    // 在容器內顯示模態框
    showModalInContainer(container, type) {
        // 創建模態框內容
        const modalContent = this.createModalContent(type);
        
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
        const modalContainer = container.querySelector('.google-login-modal-container');
        if (modalContainer) {
            modalContainer.remove();
        }
    }

    // 創建模態框內容
    createModalContent(type) {
        const modalDiv = document.createElement('div');
        modalDiv.className = 'google-login-modal-container';
        modalDiv.style.cssText = `
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
                        <button class="login-modal__google-button" id="modal-google-login-button">
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

        // 獲取頭像 URL
        let pictureUrl = null;
        if (apiResponse && apiResponse.picture) {
            pictureUrl = apiResponse.picture;
        } else if (userInfo && userInfo.picture) {
            pictureUrl = userInfo.picture;
        }

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
                            <img src="${pictureUrl || ''}" alt="用戶頭像" class="profile-modal__avatar-img" onerror="this.style.display='none'">
                        </div>
                    </div>
                    
                    <div class="profile-modal__info-section">
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">姓名</div>
                                <div class="profile-modal__info-value">${userInfo ? (userInfo.name || '尚未提供') : '尚未提供'}</div>
                            </div>
                        </div>
                        
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">電子郵件</div>
                                <div class="profile-modal__info-value">${userInfo ? (userInfo.email || '尚未提供') : '尚未提供'}</div>
                            </div>
                        </div>
                        
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">電話號碼</div>
                                <div class="profile-modal__info-value">${userInfo ? (userInfo.phone || '尚未提供') : '尚未提供'}</div>
                            </div>
                        </div>
                        
                        <div class="profile-modal__info-item">
                            <div class="profile-modal__info-label">
                                <div class="profile-modal__info-label-text">出生日期</div>
                                <div class="profile-modal__info-value">${userInfo ? (userInfo.birthday || '尚未提供') : '尚未提供'}</div>
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
            const googleLoginButton = container.querySelector('#modal-google-login-button');
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
        }
    }

    // 更新個人資訊顯示
    updateProfileInfo() {
        const userInfo = this.getUserInfo();
        const apiResponse = this.getApiResponse();

        // 更新頭像 - 優先使用 API 回應中的 picture
        const profileAvatarImage = this.shadowRoot.getElementById('profile-avatar-image');
        if (profileAvatarImage) {
            let pictureUrl = null;
            if (apiResponse && apiResponse.picture) {
                pictureUrl = apiResponse.picture;
                console.log('個人資訊使用 API 回傳的 picture:', pictureUrl);
            } else if (userInfo && userInfo.picture) {
                pictureUrl = userInfo.picture;
                console.log('個人資訊使用 Google 用戶資訊的 picture:', pictureUrl);
            }

            if (pictureUrl) {
                profileAvatarImage.src = pictureUrl;
            }
        }

        // 更新姓名
        const profileName = this.shadowRoot.getElementById('profile-name');
        if (profileName) {
            profileName.textContent = userInfo ? (userInfo.name || '尚未提供') : '尚未提供';
        }

        // 更新電子郵件
        const profileEmail = this.shadowRoot.getElementById('profile-email');
        if (profileEmail) {
            const emailSpan = profileEmail.querySelector('span');
            if (emailSpan) {
                emailSpan.textContent = userInfo ? (userInfo.email || '尚未提供') : '尚未提供';
            }
        }

        // 更新其他資訊（如果有 API 回應數據）
        if (apiResponse) {
            // 這裡可以根據 API 回應更新其他欄位
            // 例如：出生日期、電話號碼等
        }
    }



    // 處理登出
    handleLogout() {
        console.log('用戶點擊登出按鈕');

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
        console.log('觸發 Google 登入');
        if (window.google && window.google.accounts) {
            console.log('Google 服務已載入，調用 prompt()');

            // 檢查是否有活躍的 Google 會話
            const hasActiveSession = this.checkGoogleSession();

            try {
                // 使用標準的 prompt 方法
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed()) {
                        console.log('Google 登入提示未顯示:', notification.getNotDisplayedReason());

                        // 針對空會話問題，直接使用 OAuth2 方法
                        if (notification.getNotDisplayedReason() === 'no_session' ||
                            notification.getNotDisplayedReason() === 'browser_not_supported' ||
                            notification.getNotDisplayedReason() === 'invalid_client') {
                            console.log('檢測到會話問題，使用 OAuth2 登入方法');
                            this.triggerDirectGoogleSignIn();
                        } else {
                            // 如果無法顯示，嘗試其他方式
                            this.fallbackGoogleSignIn();
                        }
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

            console.log('Google 會話檢查:', googleCookies.length > 0 ? '有活躍會話' : '無活躍會話');
            return googleCookies.length > 0;
        } catch (error) {
            console.warn('檢查 Google 會話失敗:', error);
            return false;
        }
    }

    // 重新初始化 Google 登入
    reinitializeGoogleSignIn() {
        console.log('重新初始化 Google 登入');
        try {
            // 清除現有配置
            if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.cancel();
            }

            // 重新初始化
            this.onGoogleLoaded();

            // 延遲後再次嘗試
            setTimeout(() => {
                this.triggerGoogleSignIn();
            }, 1000);
        } catch (error) {
            console.error('重新初始化失敗:', error);
            this.fallbackGoogleSignIn();
        }
    }

    // 直接 Google 登入方法（處理空會話問題）
    useDirectGoogleSignIn() {
        console.log('使用直接 Google 登入方法');
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
                const checkLoginSuccess = setInterval(() => {
                    if (this.getUserInfo()) {
                        clearInterval(checkLoginSuccess);
                        document.body.removeChild(container);
                    }
                }, 500);

                // 5秒後自動清理
                setTimeout(() => {
                    clearInterval(checkLoginSuccess);
                    if (container.parentNode) {
                        document.body.removeChild(container);
                    }
                }, 5000);
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
        console.log('使用備用 Google 登入方法');
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
            // 構建 OAuth2 授權 URL
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(this.clientId)}` +
                `&redirect_uri=${encodeURIComponent(window.location.origin)}` +
                `&response_type=token` +
                `&scope=${encodeURIComponent('openid email profile')}` +
                `&state=${encodeURIComponent('google_signin')}` +
                `&prompt=select_account`;

            // 在新視窗中打開授權頁面
            const authWindow = window.open(authUrl, 'google_auth',
                'width=500,height=600,scrollbars=yes,resizable=yes');

            // 監聽授權結果
            const checkAuthResult = setInterval(() => {
                try {
                    if (authWindow.closed) {
                        clearInterval(checkAuthResult);
                        // 檢查 URL 中是否有 access_token
                        const urlParams = new URLSearchParams(window.location.hash.substring(1));
                        const accessToken = urlParams.get('access_token');
                        if (accessToken) {
                            // 處理授權成功
                            this.handleAuthSuccess(accessToken);
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

    // 處理 OAuth2 授權成功
    async handleAuthSuccess(accessToken) {
        console.log('OAuth2 授權成功，處理 access token');
        try {
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

                // 創建一個模擬的 credential 來調用 infFITS API
                const mockCredential = `oauth2_${accessToken}`;

                // 調用 infFITS API
                const apiResponse = await this.callInfFitsAPI(mockCredential);

                // 檢查 API 回應中是否有 picture 欄位，如果有則更新用戶資訊
                if (apiResponse && apiResponse.picture) {
                    console.log('API 回傳 picture:', apiResponse.picture);
                    // 更新用戶資訊中的 picture
                    userInfo.picture = apiResponse.picture;
                    this.saveUserInfo(userInfo);
                }

                // 更新頭像顯示
                this.updateAvatar();

                // 隱藏登入畫面
                this.hideLoginModal();

                // 觸發成功事件
                this.dispatchEvent(new CustomEvent('google-login-success', {
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
                    width: var(--google-login-size, 40px);
                    height: var(--google-login-size, 40px);
                    border-radius: var(--google-login-border-radius, 50%);
                    overflow: hidden;
                    transition: border-color 0.3s ease;
                }
                
                .avatar-container:hover {
                    opacity: var(--google-login-hover-opacity, 0.8);
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
                
                .google-login-button-container {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    width: 100%;
                }
                
                .google-login-button {
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
                
                .google-login-button:hover {
                    background-color: #E8E8E8;
                }
                
                .google-login-text {
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
                        
                        <div class="google-login-button-container">
                            <button class="google-login-button" id="google-login-button">
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
                                <span class="google-login-text">繼續使用 Google 登入</span>
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
                                    <div class="info-label">密碼</div>
                                    <div class="info-value">••••••••••••</div>
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
            };

            script.onerror = () => {
                console.error('無法載入 Google Identity Services');
                this.handleLoginFailure('無法載入 Google Identity Services');
            };

            document.head.appendChild(script);

        } catch (error) {
            console.error('載入 Google 服務時發生錯誤:', error);
            this.handleLoginFailure('載入 Google 服務時發生錯誤: ' + error.message);
        }
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

            console.log('Google Identity Services 初始化完成');

        } catch (error) {
            console.error('初始化 Google 登入失敗:', error);
        }
    }

    // 處理 Google 登入回調
    async handleCredentialResponse(response) {
        console.log('Google 登入回調收到 credential');

        if (!response.credential) {
            this.handleLoginFailure('未收到有效的登入憑證');
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
            const apiResponse = await this.callInfFitsAPI(response.credential);

            // 檢查 API 回應中是否有 picture 欄位，如果有則更新用戶資訊
            if (apiResponse && apiResponse.picture) {
                console.log('API 回傳 picture:', apiResponse.picture);
                // 更新用戶資訊中的 picture
                if (payload) {
                    payload.picture = apiResponse.picture;
                    this.saveUserInfo(payload);
                }
                // 更新頭像顯示
                this.updateAvatar();
            }

            // 隱藏登入畫面
            this.hideLoginModal();

            // 觸發成功事件
            this.dispatchEvent(new CustomEvent('google-login-success', {
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
            console.log('🔄 調用 infFITS API...');

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

            // 觸發 localStorage 更新事件
            this.dispatchEvent(new CustomEvent('localStorage-updated', {
                detail: {
                    key: 'inffits_api_response',
                    value: data
                },
                bubbles: true,
                composed: true
            }));
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

    // Debug 方法：模擬已登入狀態
    async debugSimulateLogin(credential = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImRkNTMwMTIwNGZjMWQ2YTBkNjhjNzgzYTM1Y2M5YzEwYjI1ZTFmNGEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIyNjU4MjE3MDQyMzYtZmtkdDRycnZwbXVoZjQ0MmM3cjJkZmcxNmk3MWM2cWcuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIyNjU4MjE3MDQyMzYtZmtkdDRycnZwbXVoZjQ0MmM3cjJkZmcxNmk3MWM2cWcuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDU0NzQ4MzI4NjQ0NDUxMDYxMDkiLCJlbWFpbCI6ImluZmZpdHMuZGV2ZWxvcG1lbnRAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5iZiI6MTc1Mzg2MjA2MSwibmFtZSI6ImluZkZJVFMgRGV2ZWxvcG1lbnQiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EvQUNnOG9jS3ZXY2Q3REhQYUk4bENaU0p2NVdodm1YdEJXb2VKOFZhR3UtZGZqamZDRnNneXhRPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6ImluZkZJVFMiLCJmYW1pbHlfbmFtZSI6IkRldmVsb3BtZW50IiwiaWF0IjoxNzUzODYyMzYxLCJleHAiOjE3NTM4NjU5NjEsImp0aSI6IjQxODhmZThlMTQxYTY2ZjE4YmQ1NTg5YzRjMmFiMjYwZmFhN2Y4YmYifQ.MWOVHIAGIaSJlcA-MG8aEYoz15E2_I0-hu2t2f7ccaBOfhEOr6WC0tFtWNTr56KVlmzpk6IbObiWgYjqOi2oBCQYieSqpmA0G52KMXr7S3GQgXnxAvIX-332gQ-n9AKUmFaUZeOLOXLfdUHj_BzUuLWLwHsbqFP1SjN9aA7hopqrjz-LTr83iFxt_-eQJppTs_k8cZc4vhx9HjuuoUCG7ELVgm7cRUZJfCjp7hEcYd5T0HS_ygKYftF9ymroB05zehP_mABA1ZTN72WB08UZAuvM8yCVQNXBY8FSpuZDwwSya3S00DzF3ou4P_VUYaluU5v88hLZLSWeG0XINTifNw') {
        console.log('🔧 Debug: 使用真實憑證模擬登入流程');
        console.log('📋 使用憑證:', credential);

        try {
            // 使用真實的 handleCredentialResponse 流程
            const response = {
                credential: credential
            };

            // 調用原本的登入處理流程
            await this.handleCredentialResponse(response);

            console.log('✅ Debug: 真實登入流程完成');

        } catch (error) {
            console.error('❌ Debug: 模擬登入失敗:', error);
            this.handleLoginFailure(error);
        }
    }

    // Debug 方法：清除模擬登入狀態
    debugClearLogin() {
        console.log('🔧 Debug: 清除模擬登入狀態');
        this.signOut();
    }

    // 添加 Debug 按鈕
    addDebugButtons() {
        // 創建 debug 容器
        const debugContainer = document.createElement('div');
        debugContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10001;
            background: rgba(0,0,0,0.8);
            padding: 10px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            color: white;
        `;

        debugContainer.innerHTML = `
            <div style="margin-bottom: 8px; font-weight: bold;">🔧 Debug 模式</div>
            <button id="debug-login" style="
                background: #4285f4;
                color: white;
                border: none;
                padding: 4px 8px;
                margin: 2px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">模擬登入</button>
            <button id="debug-logout" style="
                background: #ea4335;
                color: white;
                border: none;
                padding: 4px 8px;
                margin: 2px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            ">模擬登出</button>
        `;

        document.body.appendChild(debugContainer);

        // 添加事件監聽器
        document.getElementById('debug-login').addEventListener('click', () => {
            this.debugSimulateLogin();
        });

        document.getElementById('debug-logout').addEventListener('click', () => {
            this.debugClearLogin();
        });

        console.log('🔧 Debug 按鈕已添加');
    }
}

// 註冊 Web Component
if (!customElements.get('google-login')) {
    customElements.define('google-login', GoogleLoginComponent);
    console.log('Google Login Web Component 已註冊');
} else {
    console.warn('Google Login Web Component 已經存在，跳過註冊');
}