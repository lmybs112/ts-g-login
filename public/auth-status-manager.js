/**
 * 自動登入狀態檢查管理器
 * 
 * 功能特色：
 * - 頁面載入時自動檢查登入狀態
 * - 可見性變化監控（避免記憶體為記憶體洩漏的定期檢查方法）
 * - 智能 token 有效性驗證
 * - 與現有 Google 登入元件完美整合
 * 
 * 設計原則：
 * - 完全原生 JavaScript 實現
 * - 避免使用 setTimeout 的不可靠機制
 * - 事件驅動的狀態管理
 * - 高效能的檢查策略
 */
class AuthStatusManager {
    constructor(googleLoginComponent = null) {
        // 引用現有的 Google 登入元件
        this.googleLoginComponent = googleLoginComponent;
        
        // 狀態管理
        this.isChecking = false;
        this.lastCheckTime = 0;
        this.checkCooldown = 30000; // 30 秒冷卻時間
        
        // Token 有效性設定
        this.tokenValidityThreshold = 10 * 60 * 1000; // 10 分鐘閾值
        
        // 事件監聽器追蹤
        this.eventListeners = [];
        
        // 初始化
        this.init();
        
        // console removed
    }
    
    /**
     * 初始化自動檢查系統
     */
    init() {
        // 頁面載入完成後立即檢查
        if (document.readyState === 'complete') {
            this.performInitialCheck();
        } else {
            this.addEventListenerWithTracking(window, 'load', () => {
                this.performInitialCheck();
            });
        }
        
        // 監聽頁面可見性變化
        this.addEventListenerWithTracking(document, 'visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // 監聽 localStorage 變化（其他標籤頁的登入狀態變化）
        this.addEventListenerWithTracking(window, 'storage', (event) => {
            this.handleStorageChange(event);
        });
        
        // 監聽頁面焦點變化
        this.addEventListenerWithTracking(window, 'focus', () => {
            this.handlePageFocus();
        });
        
        // 監聽網路狀態變化
        if ('navigator' in window && 'onLine' in navigator) {
            this.addEventListenerWithTracking(window, 'online', () => {
                // console removed
                this.checkAuthStatus();
            });
        }
    }
    
    /**
     * 帶追蹤的事件監聽器添加
     */
    addEventListenerWithTracking(target, event, handler) {
        target.addEventListener(event, handler);
        this.eventListeners.push({ target, event, handler });
    }
    
    /**
     * 初始檢查
     */
    async performInitialCheck() {
        // console removed
        await this.checkAuthStatus();
    }
    
    /**
     * 處理頁面可見性變化
     */
    async handleVisibilityChange() {
        if (!document.hidden) {
            // console removed
            await this.checkAuthStatus();
        }
    }
    
    /**
     * 處理 localStorage 變化
     */
    async handleStorageChange(event) {
        // 檢查是否為認證相關的 storage 變化
        const authRelatedKeys = [
            'google_access_token',
            'google_refresh_token', 
            'google_token_expires_at',
            'google_auth_credential'
        ];
        
        if (authRelatedKeys.includes(event.key)) {
            // console removed
            await this.checkAuthStatus();
        }
    }
    
    /**
     * 處理頁面焦點變化
     */
    async handlePageFocus() {
        // console removed
        await this.checkAuthStatus();
    }
    
    /**
     * 主要的登入狀態檢查方法
     */
    async checkAuthStatus() {
        // 防止重複檢查
        if (this.isChecking) {
            // console removed
            return;
        }
        
        // 冷卻時間檢查
        const now = Date.now();
        if (now - this.lastCheckTime < this.checkCooldown) {
            // console removed
            return;
        }
        
        this.isChecking = true;
        this.lastCheckTime = now;
        
        try {
            // console removed
            
            // 檢查基本 token 存在性
            const hasValidTokenStructure = await this.checkTokenStructure();
            if (!hasValidTokenStructure) {
                await this.handleNoValidToken();
                return;
            }
            
            // 檢查 token 有效性
            const tokenValidation = await this.validateTokenExpiry();
            if (!tokenValidation.isValid) {
                await this.handleTokenExpired(tokenValidation);
                return;
            }
            
            // 可選：與伺服器驗證 token（如果有的話）
            if (this.googleLoginComponent) {
                await this.validateTokenWithComponent();
            }
            
            // console removed
            
        } catch (error) {
            console.error('❌ 登入狀態檢查失敗:', error);
            await this.handleCheckError(error);
        } finally {
            this.isChecking = false;
        }
    }
    
    /**
     * 檢查 token 結構
     */
    async checkTokenStructure() {
        const accessToken = localStorage.getItem('google_access_token');
        const credential = localStorage.getItem('google_auth_credential');
        
        if (!accessToken && !credential) {
            // console removed
            return false;
        }
        
        // console removed
        return true;
    }
    
    /**
     * 驗證 token 過期時間
     */
    async validateTokenExpiry() {
        const expiresAtStr = localStorage.getItem('google_token_expires_at');
        
        if (!expiresAtStr) {
            // console removed
            return { isValid: false, reason: 'no_expiry_info' };
        }
        
        const expiresAt = parseInt(expiresAtStr);
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        if (timeUntilExpiry <= 0) {
            // console removed
            return { isValid: false, reason: 'expired', timeUntilExpiry };
        }
        
        if (timeUntilExpiry <= this.tokenValidityThreshold) {
            // console removed
            return { isValid: false, reason: 'expiring_soon', timeUntilExpiry };
        }
        
        // console removed
        return { isValid: true, timeUntilExpiry };
    }
    
    /**
     * 與現有元件驗證 token
     */
    async validateTokenWithComponent() {
        if (!this.googleLoginComponent || typeof this.googleLoginComponent.getValidAccessToken !== 'function') {
            return;
        }
        
        try {
            const validToken = await this.googleLoginComponent.getValidAccessToken();
            if (validToken) {
                // console removed
            } else {
                // console removed
                await this.handleTokenExpired({ reason: 'component_validation_failed' });
            }
        } catch (error) {
            console.error('❌ 元件 token 驗證失敗:', error);
        }
    }
    
    /**
     * 處理沒有有效 token 的情況
     */
    async handleNoValidToken() {
        // console removed
        
        // 清理相關的認證資訊
        this.clearAuthData();
        
        // 觸發登出事件
        this.dispatchAuthEvent('auth-status-changed', {
            isAuthenticated: false,
            reason: 'no_valid_token'
        });
    }
    
    /**
     * 處理 token 過期情況
     */
    async handleTokenExpired(validation) {
        // console removed
        
        // 如果有 refresh token，嘗試刷新
        if (this.googleLoginComponent && typeof this.googleLoginComponent.getValidAccessToken === 'function') {
            try {
                // console removed
                const newToken = await this.googleLoginComponent.getValidAccessToken();
                
                if (newToken) {
                    // console removed
                    this.dispatchAuthEvent('token-refreshed', {
                        success: true,
                        newToken: newToken
                    });
                    return;
                }
            } catch (error) {
                console.error('❌ Token 刷新失敗:', error);
            }
        }
        
        // 刷新失敗，清理認證資料
        this.clearAuthData();
        
        // 觸發需要重新登入事件
        this.dispatchAuthEvent('auth-status-changed', {
            isAuthenticated: false,
            reason: 'token_expired',
            tokenValidation: validation
        });
        
        // 如果配置了自動重新登入，可以在這裡觸發
        if (this.shouldAutoReLogin()) {
            await this.triggerAutoReLogin();
        }
    }
    
    /**
     * 處理檢查錯誤
     */
    async handleCheckError(error) {
        console.error('❌ 登入狀態檢查錯誤:', error);
        
        this.dispatchAuthEvent('auth-check-error', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 清理認證資料
     */
    clearAuthData() {
        const keysToRemove = [
            'google_access_token',
            'google_refresh_token',
            'google_token_expires_at',
            'google_auth_credential',
            'google_token_info'
        ];
        
        keysToRemove.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                // console removed
            }
        });
    }
    
    /**
     * 觸發認證事件
     */
    dispatchAuthEvent(eventType, detail) {
        const event = new CustomEvent(eventType, {
            detail: detail,
            bubbles: true
        });
        
        // 在 document 上觸發事件，以便其他元件監聽
        document.dispatchEvent(event);
        
        // 如果有綁定的元件，也在元件上觸發
        if (this.googleLoginComponent && this.googleLoginComponent.dispatchEvent) {
            this.googleLoginComponent.dispatchEvent(event);
        }
        
        // console removed
    }
    
    /**
     * 判斷是否應該自動重新登入
     */
    shouldAutoReLogin() {
        // 可以根據設定或使用者偏好決定
        return false; // 預設不自動重新登入，避免打擾使用者
    }
    
    /**
     * 觸發自動重新登入
     */
    async triggerAutoReLogin() {
        if (this.googleLoginComponent && typeof this.googleLoginComponent.signIn === 'function') {
            try {
                // console removed
                await this.googleLoginComponent.signIn();
            } catch (error) {
                console.error('❌ 自動重新登入失敗:', error);
            }
        }
    }
    
    /**
     * 手動觸發狀態檢查
     */
    async forceCheck() {
        // console removed
        this.lastCheckTime = 0; // 重置冷卻時間
        await this.checkAuthStatus();
    }
    
    /**
     * 設定 Google 登入元件引用
     */
    setGoogleLoginComponent(component) {
        this.googleLoginComponent = component;
        // console removed
    }
    
    /**
     * 獲取當前認證狀態
     */
    getCurrentAuthStatus() {
        const accessToken = localStorage.getItem('google_access_token');
        const expiresAt = localStorage.getItem('google_token_expires_at');
        
        if (!accessToken) {
            return { isAuthenticated: false, reason: 'no_token' };
        }
        
        if (expiresAt) {
            const timeUntilExpiry = parseInt(expiresAt) - Date.now();
            if (timeUntilExpiry <= 0) {
                return { isAuthenticated: false, reason: 'token_expired' };
            }
            
            return { 
                isAuthenticated: true, 
                timeUntilExpiry,
                expiresInMinutes: Math.round(timeUntilExpiry / 60000)
            };
        }
        
        return { isAuthenticated: true, reason: 'token_present' };
    }
    
    /**
     * 清理事件監聽器
     */
    destroy() {
        // console removed
        
        // 移除所有事件監聽器
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // 重置狀態
        this.isChecking = false;
        this.googleLoginComponent = null;
        
        // console removed
    }
}

// 全域實例管理
window.AuthStatusManager = AuthStatusManager;

// 自動初始化全域管理器（如果需要）
if (!window.globalAuthStatusManager) {
    window.globalAuthStatusManager = new AuthStatusManager();
}

// console removed
