/**
 * 認證系統整合管理器
 * 
 * 功能特色：
 * - 統一管理所有認證相關元件
 * - 自動協調各模組之間的交互
 * - 提供完整的認證生命週期管理
 * - 事件驅動的狀態同步
 * - 完整的錯誤處理和恢復機制
 * 
 * 設計原則：
 * - 模組化架構
 * - 自動狀態同步
 * - 優雅的錯誤處理
 * - 高效能的操作
 */
class AuthIntegrationManager {
    constructor(options = {}) {
        // 基本配置
        this.options = {
            autoStart: true,
            enableCookieManager: true,
            enableTokenRefresh: true,
            enableStatusCheck: true,
            apiBaseUrl: '/api',
            debug: false,
            ...options
        };
        
        // 模組實例
        this.authStatusManager = null;
        this.tokenRefreshManager = null;
        this.userDataCookieManager = null;
        this.googleLoginComponent = null;
        
        // 狀態管理
        this.isInitialized = false;
        this.currentAuthState = {
            isAuthenticated: false,
            user: null,
            lastCheck: null,
            tokenStatus: null
        };
        
        // 事件監聽器
        this.eventListeners = [];
        
        // 統計資料
        this.stats = {
            initTime: null,
            loginCount: 0,
            refreshCount: 0,
            errorCount: 0,
            lastActivity: null
        };
        
        // 初始化
        if (this.options.autoStart) {
            this.init();
        }
        
        console.log('🔗 AuthIntegrationManager 已創建');
    }
    
    /**
     * 初始化整合系統
     */
    async init() {
        if (this.isInitialized) {
            console.log('⚠️ AuthIntegrationManager 已經初始化');
            return;
        }
        
        try {
            console.log('🚀 初始化 AuthIntegrationManager...');
            this.stats.initTime = new Date().toISOString();
            
            // 等待 DOM 載入完成
            await this.waitForDOMReady();
            
            // 初始化各個管理器
            await this.initializeManagers();
            
            // 設定全域事件監聽
            this.setupGlobalEventListeners();
            
            // 嘗試尋找現有的 Google 登入元件
            this.findGoogleLoginComponent();
            
            // 執行初始認證檢查
            await this.performInitialAuthCheck();
            
            this.isInitialized = true;
            console.log('✅ AuthIntegrationManager 初始化完成');
            
            // 觸發初始化完成事件
            this.dispatchEvent('auth-integration-ready', {
                timestamp: new Date().toISOString(),
                managers: this.getManagerStatus()
            });
            
        } catch (error) {
            console.error('❌ AuthIntegrationManager 初始化失敗:', error);
            this.stats.errorCount++;
            
            // 觸發初始化失敗事件
            this.dispatchEvent('auth-integration-error', {
                error: error.message,
                phase: 'initialization',
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * 等待 DOM 載入完成
     */
    async waitForDOMReady() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                resolve();
            } else {
                document.addEventListener('DOMContentLoaded', resolve, { once: true });
            }
        });
    }
    
    /**
     * 初始化各個管理器
     */
    async initializeManagers() {
        console.log('📦 初始化子管理器...');
        
        // 初始化認證狀態管理器
        if (this.options.enableStatusCheck && window.AuthStatusManager) {
            this.authStatusManager = new window.AuthStatusManager();
            console.log('✅ AuthStatusManager 已初始化');
        }
        
        // 初始化 Token 刷新管理器
        if (this.options.enableTokenRefresh && window.TokenRefreshManager) {
            this.tokenRefreshManager = new window.TokenRefreshManager();
            console.log('✅ TokenRefreshManager 已初始化');
        }
        
        // 初始化使用者資料 Cookie 管理器
        if (this.options.enableCookieManager && window.UserDataCookieManager) {
            this.userDataCookieManager = new window.UserDataCookieManager();
            console.log('✅ UserDataCookieManager 已初始化');
        }
        
        // 連接管理器之間的引用
        this.connectManagers();
    }
    
    /**
     * 連接管理器之間的引用
     */
    connectManagers() {
        // 如果找到 Google 登入元件，設定引用
        if (this.googleLoginComponent) {
            if (this.authStatusManager && typeof this.authStatusManager.setGoogleLoginComponent === 'function') {
                this.authStatusManager.setGoogleLoginComponent(this.googleLoginComponent);
            }
            
            if (this.tokenRefreshManager && typeof this.tokenRefreshManager.setGoogleLoginComponent === 'function') {
                this.tokenRefreshManager.setGoogleLoginComponent(this.googleLoginComponent);
            }
        }
    }
    
    /**
     * 設定全域事件監聽
     */
    setupGlobalEventListeners() {
        console.log('📡 設定全域事件監聽...');
        
        // 監聽登入成功事件
        this.addEventListenerWithTracking(document, 'google-login-success', (event) => {
            this.handleLoginSuccess(event);
        });
        
        // 監聽認證狀態變化
        this.addEventListenerWithTracking(document, 'auth-status-changed', (event) => {
            this.handleAuthStatusChanged(event);
        });
        
        // 監聽 token 刷新成功
        this.addEventListenerWithTracking(document, 'token-refreshed', (event) => {
            this.handleTokenRefreshed(event);
        });
        
        // 監聽 token 刷新失敗
        this.addEventListenerWithTracking(document, 'token-refresh-failure', (event) => {
            this.handleTokenRefreshFailure(event);
        });
        
        // 監聽使用者資料保存
        this.addEventListenerWithTracking(document, 'user-data-saved', (event) => {
            this.handleUserDataSaved(event);
        });
        
        // 監聽使用者資料清理
        this.addEventListenerWithTracking(document, 'user-data-cleared', (event) => {
            this.handleUserDataCleared(event);
        });
        
        // 監聽頁面卸載
        this.addEventListenerWithTracking(window, 'beforeunload', () => {
            this.handleBeforeUnload();
        });
    }
    
    /**
     * 帶追蹤的事件監聽器添加
     */
    addEventListenerWithTracking(target, event, handler) {
        target.addEventListener(event, handler);
        this.eventListeners.push({ target, event, handler });
    }
    
    /**
     * 尋找現有的 Google 登入元件
     */
    findGoogleLoginComponent() {
        try {
            // 尋找自定義元件
            const customComponents = document.querySelectorAll('inf-google-login-component');
            if (customComponents.length > 0) {
                this.googleLoginComponent = customComponents[0];
                console.log('✅ 找到 Google 登入元件:', this.googleLoginComponent);
                
                // 重新連接管理器
                this.connectManagers();
                return;
            }
            
            // 尋找全域實例
            if (window.globalGoogleLoginComponent) {
                this.googleLoginComponent = window.globalGoogleLoginComponent;
                console.log('✅ 找到全域 Google 登入元件');
                
                // 重新連接管理器
                this.connectManagers();
                return;
            }
            
            console.log('⚠️ 未找到 Google 登入元件，將在元件創建時自動連接');
            
        } catch (error) {
            console.error('❌ 尋找 Google 登入元件失敗:', error);
        }
    }
    
    /**
     * 執行初始認證檢查
     */
    async performInitialAuthCheck() {
        try {
            console.log('🔍 執行初始認證狀態檢查...');
            
            // 檢查本地存儲的認證狀態
            const hasLocalAuth = this.checkLocalAuthData();
            
            // 檢查 Cookie 中的使用者資料
            let userData = null;
            if (this.userDataCookieManager) {
                userData = await this.userDataCookieManager.getUserData();
            }
            
            // 驗證 token 有效性
            let tokenValid = false;
            if (hasLocalAuth) {
                tokenValid = await this.validateCurrentToken();
            }
            
            // 更新認證狀態
            this.updateAuthState({
                isAuthenticated: tokenValid && !!userData,
                user: userData,
                lastCheck: new Date().toISOString(),
                tokenStatus: tokenValid ? 'valid' : 'invalid'
            });
            
            console.log('📊 初始認證狀態:', {
                hasLocalAuth,
                hasUserData: !!userData,
                tokenValid,
                isAuthenticated: this.currentAuthState.isAuthenticated
            });
            
        } catch (error) {
            console.error('❌ 初始認證檢查失敗:', error);
            this.stats.errorCount++;
        }
    }
    
    /**
     * 檢查本地認證資料
     */
    checkLocalAuthData() {
        const accessToken = localStorage.getItem('google_access_token');
        const credential = localStorage.getItem('google_auth_credential');
        
        return !!(accessToken || credential);
    }
    
    /**
     * 驗證當前 token
     */
    async validateCurrentToken() {
        try {
            const accessToken = localStorage.getItem('google_access_token');
            if (!accessToken) {
                return false;
            }
            
            // 調用驗證 API
            const response = await fetch(`${this.options.apiBaseUrl}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    access_token: accessToken
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.success && data.valid;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Token 驗證失敗:', error);
            return false;
        }
    }
    
    /**
     * 處理登入成功事件
     */
    async handleLoginSuccess(event) {
        console.log('🎉 處理登入成功事件');
        
        const { userInfo, accessToken } = event.detail || {};
        
        this.stats.loginCount++;
        this.stats.lastActivity = new Date().toISOString();
        
        // 更新認證狀態
        this.updateAuthState({
            isAuthenticated: true,
            user: userInfo,
            lastCheck: new Date().toISOString(),
            tokenStatus: 'valid'
        });
        
        // 觸發整合登入成功事件
        this.dispatchEvent('auth-integration-login-success', {
            user: userInfo,
            timestamp: new Date().toISOString(),
            stats: this.stats
        });
    }
    
    /**
     * 處理認證狀態變化
     */
    async handleAuthStatusChanged(event) {
        console.log('🔄 處理認證狀態變化');
        
        const { isAuthenticated, reason } = event.detail || {};
        
        this.updateAuthState({
            isAuthenticated,
            lastCheck: new Date().toISOString(),
            tokenStatus: isAuthenticated ? 'valid' : 'invalid'
        });
        
        if (!isAuthenticated) {
            // 清理使用者資料
            this.currentAuthState.user = null;
        }
        
        // 觸發狀態變化事件
        this.dispatchEvent('auth-integration-status-changed', {
            isAuthenticated,
            reason,
            timestamp: new Date().toISOString(),
            currentState: this.currentAuthState
        });
    }
    
    /**
     * 處理 token 刷新成功
     */
    async handleTokenRefreshed(event) {
        console.log('🔄 處理 token 刷新成功');
        
        this.stats.refreshCount++;
        this.stats.lastActivity = new Date().toISOString();
        
        this.updateAuthState({
            tokenStatus: 'refreshed',
            lastCheck: new Date().toISOString()
        });
        
        // 觸發刷新成功事件
        this.dispatchEvent('auth-integration-token-refreshed', {
            timestamp: new Date().toISOString(),
            refreshCount: this.stats.refreshCount
        });
    }
    
    /**
     * 處理 token 刷新失敗
     */
    async handleTokenRefreshFailure(event) {
        console.log('❌ 處理 token 刷新失敗');
        
        this.stats.errorCount++;
        
        const { error, retryAttempts } = event.detail || {};
        
        // 如果是最終失敗，更新認證狀態
        if (retryAttempts >= 3) {
            this.updateAuthState({
                isAuthenticated: false,
                tokenStatus: 'refresh_failed',
                lastCheck: new Date().toISOString()
            });
        }
        
        // 觸發刷新失敗事件
        this.dispatchEvent('auth-integration-token-refresh-failed', {
            error,
            retryAttempts,
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 處理使用者資料保存
     */
    async handleUserDataSaved(event) {
        console.log('💾 處理使用者資料保存');
        
        const { userData } = event.detail || {};
        
        // 更新當前使用者資料
        if (userData) {
            this.currentAuthState.user = userData;
        }
        
        this.stats.lastActivity = new Date().toISOString();
    }
    
    /**
     * 處理使用者資料清理
     */
    async handleUserDataCleared(event) {
        console.log('🗑️ 處理使用者資料清理');
        
        this.currentAuthState.user = null;
        this.updateAuthState({
            isAuthenticated: false,
            tokenStatus: 'cleared'
        });
    }
    
    /**
     * 處理頁面卸載
     */
    handleBeforeUnload() {
        console.log('📱 頁面即將卸載，執行清理操作');
        
        // 確保所有管理器正確清理
        this.cleanup();
    }
    
    /**
     * 更新認證狀態
     */
    updateAuthState(updates) {
        const oldState = { ...this.currentAuthState };
        
        Object.assign(this.currentAuthState, updates);
        
        // 如果狀態有顯著變化，記錄日誌
        if (oldState.isAuthenticated !== this.currentAuthState.isAuthenticated) {
            console.log('📊 認證狀態變化:', {
                from: oldState.isAuthenticated,
                to: this.currentAuthState.isAuthenticated,
                reason: updates.reason,
                timestamp: this.currentAuthState.lastCheck
            });
        }
    }
    
    /**
     * 手動觸發認證檢查
     */
    async checkAuthStatus() {
        if (this.authStatusManager && typeof this.authStatusManager.forceCheck === 'function') {
            await this.authStatusManager.forceCheck();
        }
    }
    
    /**
     * 手動觸發 token 刷新
     */
    async refreshToken() {
        if (this.tokenRefreshManager && typeof this.tokenRefreshManager.forceRefresh === 'function') {
            await this.tokenRefreshManager.forceRefresh();
        }
    }
    
    /**
     * 獲取當前認證狀態
     */
    getAuthStatus() {
        return {
            ...this.currentAuthState,
            managers: this.getManagerStatus(),
            stats: this.stats,
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * 獲取管理器狀態
     */
    getManagerStatus() {
        return {
            authStatusManager: !!this.authStatusManager,
            tokenRefreshManager: !!this.tokenRefreshManager,
            userDataCookieManager: !!this.userDataCookieManager,
            googleLoginComponent: !!this.googleLoginComponent
        };
    }
    
    /**
     * 獲取使用者資料
     */
    async getUserData() {
        if (this.userDataCookieManager && typeof this.userDataCookieManager.getUserData === 'function') {
            return await this.userDataCookieManager.getUserData();
        }
        
        return this.currentAuthState.user;
    }
    
    /**
     * 登出
     */
    async logout() {
        try {
            console.log('🚪 執行登出操作');
            
            // 清理各個管理器的資料
            if (this.authStatusManager && typeof this.authStatusManager.clearAuthData === 'function') {
                this.authStatusManager.clearAuthData();
            }
            
            if (this.tokenRefreshManager && typeof this.tokenRefreshManager.clearTokens === 'function') {
                this.tokenRefreshManager.clearTokens();
            }
            
            if (this.userDataCookieManager && typeof this.userDataCookieManager.clearUserData === 'function') {
                await this.userDataCookieManager.clearUserData('manual_logout');
            }
            
            // 更新認證狀態
            this.updateAuthState({
                isAuthenticated: false,
                user: null,
                tokenStatus: 'logged_out',
                lastCheck: new Date().toISOString()
            });
            
            // 觸發登出事件
            this.dispatchEvent('auth-integration-logout', {
                timestamp: new Date().toISOString(),
                reason: 'manual'
            });
            
            console.log('✅ 登出完成');
            
        } catch (error) {
            console.error('❌ 登出失敗:', error);
            this.stats.errorCount++;
        }
    }
    
    /**
     * 觸發事件
     */
    dispatchEvent(eventType, detail) {
        const event = new CustomEvent(eventType, {
            detail: detail,
            bubbles: true
        });
        
        document.dispatchEvent(event);
        
        if (this.options.debug) {
            console.log(`📡 觸發事件: ${eventType}`, detail);
        }
    }
    
    /**
     * 設定 Google 登入元件
     */
    setGoogleLoginComponent(component) {
        this.googleLoginComponent = component;
        console.log('🔗 設定 Google 登入元件');
        
        // 重新連接管理器
        this.connectManagers();
    }
    
    /**
     * 清理資源
     */
    cleanup() {
        console.log('🧹 清理 AuthIntegrationManager...');
        
        // 清理各個管理器
        if (this.authStatusManager && typeof this.authStatusManager.destroy === 'function') {
            this.authStatusManager.destroy();
        }
        
        if (this.tokenRefreshManager && typeof this.tokenRefreshManager.destroy === 'function') {
            this.tokenRefreshManager.destroy();
        }
        
        if (this.userDataCookieManager && typeof this.userDataCookieManager.destroy === 'function') {
            this.userDataCookieManager.destroy();
        }
        
        // 移除所有事件監聽器
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // 重置狀態
        this.isInitialized = false;
        this.googleLoginComponent = null;
        
        console.log('✅ AuthIntegrationManager 已清理完成');
    }
    
    /**
     * 重新初始化
     */
    async reinitialize() {
        console.log('🔄 重新初始化 AuthIntegrationManager...');
        
        this.cleanup();
        await this.init();
    }
}

// 全域實例管理
window.AuthIntegrationManager = AuthIntegrationManager;

// 自動初始化全域管理器（如果需要）
if (!window.globalAuthIntegrationManager) {
    window.globalAuthIntegrationManager = new AuthIntegrationManager();
}

console.log('📦 AuthIntegrationManager 模組已載入');
