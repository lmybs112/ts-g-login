/**
 * Token 自動刷新管理器
 * 
 * 功能特色：
 * - 智能 Token 生命週期管理
 * - 提前刷新策略，避免在使用時過期
 * - 指數退避重試機制
 * - 與 Google Identity Services 無聲刷新整合
 * - 完全原生實現，避免 setTimeout 不可靠方式
 * 
 * 設計原則：
 * - 事件驅動的刷新策略
 * - 智能過期檢測
 * - 優雅的降級處理
 * - 高效能的記憶體管理
 */
class TokenRefreshManager {
    constructor(googleLoginComponent = null) {
        // 引用現有的 Google 登入元件
        this.googleLoginComponent = googleLoginComponent;
        
        // 刷新策略設定
        this.refreshThreshold = 10 * 60 * 1000; // 提前 10 分鐘刷新
        this.earlyRefreshThreshold = 5 * 60 * 1000; // 提前 5 分鐘強制刷新
        this.criticalRefreshThreshold = 2 * 60 * 1000; // 提前 2 分鐘緊急刷新
        
        // 重試設定
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.retryDelays = [1000, 3000, 10000]; // 指數退避：1秒、3秒、10秒
        
        // 狀態管理
        this.isRefreshing = false;
        this.lastRefreshTime = 0;
        this.refreshCooldown = 30000; // 30 秒刷新冷卻
        
        // 事件監聽器
        this.eventListeners = [];
        this.monitoringActive = false;
        
        // 初始化
        this.init();
        
        // console removed
    }
    
    /**
     * 初始化 token 刷新系統
     */
    init() {
        // 監聽認證狀態變化
        this.addEventListenerWithTracking(document, 'auth-status-changed', (event) => {
            this.handleAuthStatusChange(event);
        });
        
        // 監聽 token 刷新成功事件
        this.addEventListenerWithTracking(document, 'token-refreshed', (event) => {
            this.handleTokenRefreshed(event);
        });
        
        // 監聽頁面可見性變化，在頁面重新可見時檢查 token
        this.addEventListenerWithTracking(document, 'visibilitychange', () => {
            if (!document.hidden) {
                this.checkAndRefreshIfNeeded();
            }
        });
        
        // 監聽頁面焦點事件
        this.addEventListenerWithTracking(window, 'focus', () => {
            this.checkAndRefreshIfNeeded();
        });
        
        // 初始檢查
        this.checkAndRefreshIfNeeded();
        
        // 啟動監控
        this.startMonitoring();
    }
    
    /**
     * 帶追蹤的事件監聽器添加
     */
    addEventListenerWithTracking(target, event, handler) {
        target.addEventListener(event, handler);
        this.eventListeners.push({ target, event, handler });
    }
    
    /**
     * 啟動 token 監控
     */
    startMonitoring() {
        if (this.monitoringActive) return;
        
        this.monitoringActive = true;
        // console removed
        
        // 使用 requestAnimationFrame 替代 setTimeout 避免不可靠性
        this.scheduleNextCheck();
    }
    
    /**
     * 安排下次檢查（使用 requestAnimationFrame 的可靠方式）
     */
    scheduleNextCheck() {
        if (!this.monitoringActive) return;
        
        const checkInterval = 60000; // 1 分鐘檢查間隔
        let lastCheck = Date.now();
        
        const checkLoop = () => {
            const now = Date.now();
            
            // 每分鐘檢查一次
            if (now - lastCheck >= checkInterval) {
                lastCheck = now;
                this.checkAndRefreshIfNeeded();
            }
            
            // 繼續排程下次檢查
            if (this.monitoringActive) {
                requestAnimationFrame(checkLoop);
            }
        };
        
        requestAnimationFrame(checkLoop);
    }
    
    /**
     * 停止監控
     */
    stopMonitoring() {
        this.monitoringActive = false;
        // console removed
    }
    
    /**
     * 檢查並刷新 token（如果需要）
     */
    async checkAndRefreshIfNeeded() {
        try {
            const refreshNeeded = await this.shouldRefreshToken();
            if (refreshNeeded.shouldRefresh) {
                await this.performTokenRefresh(refreshNeeded.urgency);
            }
        } catch (error) {
            console.error('❌ Token 檢查失敗:', error);
        }
    }
    
    /**
     * 判斷是否需要刷新 token
     */
    async shouldRefreshToken() {
        const accessToken = localStorage.getItem('google_access_token');
        const expiresAtStr = localStorage.getItem('google_token_expires_at');
        const refreshToken = localStorage.getItem('google_refresh_token');
        
        // 沒有 access token，不需要刷新
        if (!accessToken) {
            return { shouldRefresh: false, reason: 'no_access_token' };
        }
        
        // 沒有 refresh token，無法刷新
        if (!refreshToken) {
            // console removed
            return { shouldRefresh: false, reason: 'no_refresh_token' };
        }
        
        // 沒有過期時間資訊
        if (!expiresAtStr) {
            // console removed
            return { shouldRefresh: true, reason: 'no_expiry_info', urgency: 'high' };
        }
        
        const expiresAt = parseInt(expiresAtStr);
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        // Token 已過期
        if (timeUntilExpiry <= 0) {
            // console removed
            return { shouldRefresh: true, reason: 'expired', urgency: 'critical', timeUntilExpiry };
        }
        
        // 緊急刷新（2 分鐘內過期）
        if (timeUntilExpiry <= this.criticalRefreshThreshold) {
            // console removed
            return { shouldRefresh: true, reason: 'critical_expiry', urgency: 'critical', timeUntilExpiry };
        }
        
        // 提前刷新（5 分鐘內過期）
        if (timeUntilExpiry <= this.earlyRefreshThreshold) {
            // console removed
            return { shouldRefresh: true, reason: 'early_expiry', urgency: 'high', timeUntilExpiry };
        }
        
        // 預防性刷新（10 分鐘內過期）
        if (timeUntilExpiry <= this.refreshThreshold) {
            // console removed
            return { shouldRefresh: true, reason: 'preventive_refresh', urgency: 'normal', timeUntilExpiry };
        }
        
        // Token 仍然有效
        // console removed
        return { shouldRefresh: false, reason: 'token_valid', timeUntilExpiry };
    }
    
    /**
     * 執行 token 刷新
     */
    async performTokenRefresh(urgency = 'normal') {
        // 防止重複刷新
        if (this.isRefreshing) {
            // console removed
            return;
        }
        
        // 檢查刷新冷卻
        const now = Date.now();
        if (now - this.lastRefreshTime < this.refreshCooldown && urgency !== 'critical') {
            // console removed
            return;
        }
        
        this.isRefreshing = true;
        this.lastRefreshTime = now;
        
        try {
            // console removed
            
            const refreshToken = localStorage.getItem('google_refresh_token');
            if (!refreshToken) {
                throw new Error('沒有可用的 refresh token');
            }
            
            // 嘗試多種刷新方式
            let newAccessToken = null;
            
            // 方式 1: 使用現有 Google 登入元件的刷新方法
            if (this.googleLoginComponent && typeof this.googleLoginComponent.refreshAccessToken === 'function') {
                try {
                    // console removed
                    newAccessToken = await this.googleLoginComponent.refreshAccessToken(refreshToken);
                } catch (error) {
                    console.warn('⚠️ 元件刷新失敗，嘗試其他方式:', error.message);
                }
            }
            
            // 方式 2: 使用 Google Identity Services 無聲刷新
            if (!newAccessToken && window.google && window.google.accounts) {
                try {
                    // console removed
                    newAccessToken = await this.performGoogleIdentityRefresh();
                } catch (error) {
                    console.warn('⚠️ Google Identity Services 刷新失敗:', error.message);
                }
            }
            
            // 方式 3: 直接調用 Google OAuth2 API
            if (!newAccessToken) {
                // console removed
                newAccessToken = await this.performDirectTokenRefresh(refreshToken);
            }
            
            if (newAccessToken) {
                // 刷新成功
                // console removed
                this.retryAttempts = 0;
                
                // 觸發刷新成功事件
                this.dispatchRefreshEvent('token-refresh-success', {
                    newToken: newAccessToken,
                    urgency: urgency,
                    timestamp: new Date().toISOString()
                });
                
                return newAccessToken;
            } else {
                throw new Error('所有刷新方式都失敗');
            }
            
        } catch (error) {
            console.error(`❌ Token 刷新失敗 (嘗試 ${this.retryAttempts + 1}/${this.maxRetries}):`, error);
            await this.handleRefreshFailure(error, urgency);
        } finally {
            this.isRefreshing = false;
        }
    }
    
    /**
     * 使用 Google Identity Services 無聲刷新
     */
    async performGoogleIdentityRefresh() {
        return new Promise((resolve, reject) => {
            if (!window.google || !window.google.accounts || !window.google.accounts.id) {
                reject(new Error('Google Identity Services 不可用'));
                return;
            }
            
            try {
                // 使用 prompt 方法進行無聲刷新
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                        reject(new Error('Google 無聲刷新失敗'));
                    }
                });
                
                // 設定 credential callback 來接收新的憑證
                window.google.accounts.id.initialize({
                    client_id: this.getGoogleClientId(),
                    callback: (response) => {
                        if (response.credential) {
                            // 解析新的 credential 並提取 access token
                            const newToken = this.extractAccessTokenFromCredential(response.credential);
                            if (newToken) {
                                resolve(newToken);
                            } else {
                                reject(new Error('無法從 credential 提取 access token'));
                            }
                        } else {
                            reject(new Error('沒有收到新的 credential'));
                        }
                    }
                });
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 直接調用 Google OAuth2 API 刷新 token
     */
    async performDirectTokenRefresh(refreshToken) {
        const clientId = this.getGoogleClientId();
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET; // 注意：在前端不應該暴露 client secret
        
        // 如果在前端，應該調用後端 API 來刷新 token
        if (!clientSecret) {
            // console removed
            return await this.callBackendRefreshAPI(refreshToken);
        }
        
        // 直接調用 Google OAuth2 API（僅在伺服器端）
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Token 刷新失敗: ${errorData.error_description || response.statusText}`);
        }
        
        const data = await response.json();
        
        // 更新 localStorage
        localStorage.setItem('google_access_token', data.access_token);
        
        if (data.expires_in) {
            const expiresAt = Date.now() + (data.expires_in * 1000);
            localStorage.setItem('google_token_expires_at', expiresAt.toString());
        }
        
        return data.access_token;
    }
    
    /**
     * 調用後端 API 刷新 token
     */
    async callBackendRefreshAPI(refreshToken) {
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: refreshToken
                })
            });
            
            if (!response.ok) {
                throw new Error(`後端刷新 API 失敗: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || '後端刷新失敗');
            }
            
            // 更新 localStorage
            localStorage.setItem('google_access_token', data.access_token);
            
            if (data.expires_in) {
                const expiresAt = Date.now() + (data.expires_in * 1000);
                localStorage.setItem('google_token_expires_at', expiresAt.toString());
            }
            
            return data.access_token;
            
        } catch (error) {
            console.error('❌ 後端 API 刷新失敗:', error);
            throw error;
        }
    }
    
    /**
     * 處理刷新失敗
     */
    async handleRefreshFailure(error, urgency) {
        this.retryAttempts++;
        
        // 觸發刷新失敗事件
        this.dispatchRefreshEvent('token-refresh-failure', {
            error: error.message,
            retryAttempts: this.retryAttempts,
            maxRetries: this.maxRetries,
            urgency: urgency,
            timestamp: new Date().toISOString()
        });
        
        // 如果還有重試次數
        if (this.retryAttempts < this.maxRetries) {
            const retryDelay = this.retryDelays[this.retryAttempts - 1] || 10000;
            // console removed
            
            // 使用 requestAnimationFrame 實現延遲，避免 setTimeout
            const startTime = Date.now();
            const delayedRetry = () => {
                const elapsed = Date.now() - startTime;
                if (elapsed >= retryDelay) {
                    this.performTokenRefresh(urgency);
                } else {
                    requestAnimationFrame(delayedRetry);
                }
            };
            requestAnimationFrame(delayedRetry);
        } else {
            // 重試次數用盡，處理最終失敗
            console.error('❌ Token 刷新重試次數用盡，需要重新登入');
            this.handleFinalRefreshFailure();
        }
    }
    
    /**
     * 處理最終刷新失敗
     */
    handleFinalRefreshFailure() {
        // 清理 tokens
        this.clearTokens();
        
        // 重置重試計數
        this.retryAttempts = 0;
        
        // 觸發需要重新登入事件
        this.dispatchRefreshEvent('token-refresh-final-failure', {
            reason: 'max_retries_exceeded',
            timestamp: new Date().toISOString()
        });
        
        // 觸發認證狀態變化事件
        this.dispatchRefreshEvent('auth-status-changed', {
            isAuthenticated: false,
            reason: 'token_refresh_failed',
            timestamp: new Date().toISOString()
        });
    }
    
    /**
     * 處理認證狀態變化
     */
    handleAuthStatusChange(event) {
        const { isAuthenticated } = event.detail;
        
        if (isAuthenticated) {
            // console removed
            this.retryAttempts = 0;
            this.startMonitoring();
        } else {
            // console removed
            this.stopMonitoring();
        }
    }
    
    /**
     * 處理 token 刷新成功
     */
    handleTokenRefreshed(event) {
        // console removed
        this.retryAttempts = 0;
    }
    
    /**
     * 觸發刷新相關事件
     */
    dispatchRefreshEvent(eventType, detail) {
        const event = new CustomEvent(eventType, {
            detail: detail,
            bubbles: true
        });
        
        document.dispatchEvent(event);
        
        if (this.googleLoginComponent && this.googleLoginComponent.dispatchEvent) {
            this.googleLoginComponent.dispatchEvent(event);
        }
        
        // console removed
    }
    
    /**
     * 獲取 Google Client ID
     */
    getGoogleClientId() {
        // 嘗試從多個來源獲取 client ID
        return process.env.GOOGLE_CLIENT_ID || 
               window.GOOGLE_CLIENT_ID || 
               (this.googleLoginComponent && this.googleLoginComponent.clientId) ||
               '您的 Google Client ID';
    }
    
    /**
     * 從 credential 提取 access token
     */
    extractAccessTokenFromCredential(credential) {
        try {
            if (credential.startsWith('oauth2_')) {
                return credential.replace('oauth2_', '');
            }
            
            // 解析 JWT token
            const parts = credential.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                return payload.access_token || null;
            }
            
            return null;
        } catch (error) {
            console.error('❌ 解析 credential 失敗:', error);
            return null;
        }
    }
    
    /**
     * 清理 tokens
     */
    clearTokens() {
        const keysToRemove = [
            'google_access_token',
            'google_refresh_token',
            'google_token_expires_at',
            'google_auth_credential'
        ];
        
        keysToRemove.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                // console removed
            }
        });
    }
    
    /**
     * 手動觸發 token 刷新
     */
    async forceRefresh() {
        // console removed
        this.lastRefreshTime = 0; // 重置冷卻時間
        await this.performTokenRefresh('manual');
    }
    
    /**
     * 獲取當前 token 狀態
     */
    getTokenStatus() {
        const accessToken = localStorage.getItem('google_access_token');
        const refreshToken = localStorage.getItem('google_refresh_token');
        const expiresAt = localStorage.getItem('google_token_expires_at');
        
        const status = {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken,
            isRefreshing: this.isRefreshing,
            retryAttempts: this.retryAttempts,
            monitoringActive: this.monitoringActive
        };
        
        if (expiresAt) {
            const timeUntilExpiry = parseInt(expiresAt) - Date.now();
            status.timeUntilExpiry = timeUntilExpiry;
            status.expiresInMinutes = Math.round(timeUntilExpiry / 60000);
            status.isExpired = timeUntilExpiry <= 0;
            status.needsRefresh = timeUntilExpiry <= this.refreshThreshold;
        }
        
        return status;
    }
    
    /**
     * 設定 Google 登入元件引用
     */
    setGoogleLoginComponent(component) {
        this.googleLoginComponent = component;
        // console removed
    }
    
    /**
     * 清理資源
     */
    destroy() {
        // console removed
        
        // 停止監控
        this.stopMonitoring();
        
        // 移除所有事件監聽器
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // 重置狀態
        this.isRefreshing = false;
        this.retryAttempts = 0;
        this.googleLoginComponent = null;
        
        // console removed
    }
}

// 全域實例管理
window.TokenRefreshManager = TokenRefreshManager;

// 自動初始化全域管理器（如果需要）
if (!window.globalTokenRefreshManager) {
    window.globalTokenRefreshManager = new TokenRefreshManager();
}

// console removed
