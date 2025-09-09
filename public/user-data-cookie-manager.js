/**
 * Cookie 使用者資料管理器
 * 
 * 功能特色：
 * - 安全的使用者資料持久化到 Cookie
 * - 輕量級加密保護敏感資訊
 * - 自動同步登入狀態變化
 * - 跨域支援和安全設定
 * - 完全原生實現，無第三方依賴
 * 
 * 設計原則：
 * - 資料安全優先
 * - 自動狀態同步
 * - 優雅的錯誤處理
 * - 高效能的操作
 */
class UserDataCookieManager {
    constructor() {
        // Cookie 設定
        this.cookieName = 'inf_user_data';
        this.encryptedCookieName = 'inf_user_secure';
        
        // 安全設定
        this.encryptionKey = this.generateEncryptionKey();
        this.defaultCookieOptions = {
            expires: 30, // 30 天
            secure: window.location.protocol === 'https:',
            sameSite: 'Lax',
            path: '/'
        };
        
        // 事件監聽器
        this.eventListeners = [];
        
        // 快取
        this.userDataCache = null;
        this.lastCacheTime = 0;
        this.cacheExpiry = 5 * 60 * 1000; // 5 分鐘快取
        
        // 初始化
        this.init();
        
        // console removed
    }
    
    /**
     * 初始化使用者資料管理系統
     */
    init() {
        // 監聽登入成功事件
        this.addEventListenerWithTracking(document, 'google-login-success', (event) => {
            this.handleLoginSuccess(event);
        });
        
        // 監聽登入狀態變化
        this.addEventListenerWithTracking(document, 'auth-status-changed', (event) => {
            this.handleAuthStatusChange(event);
        });
        
        // 監聽 token 刷新成功事件（可能包含新的使用者資訊）
        this.addEventListenerWithTracking(document, 'token-refreshed', (event) => {
            this.handleTokenRefreshed(event);
        });
        
        // 頁面卸載時確保資料已保存
        this.addEventListenerWithTracking(window, 'beforeunload', () => {
            this.flushCacheToStorage();
        });
        
        // 初始載入使用者資料
        this.loadUserDataFromStorage();
    }
    
    /**
     * 帶追蹤的事件監聽器添加
     */
    addEventListenerWithTracking(target, event, handler) {
        target.addEventListener(event, handler);
        this.eventListeners.push({ target, event, handler });
    }
    
    /**
     * 處理登入成功事件
     */
    async handleLoginSuccess(event) {
        // console removed
        
        const { userInfo, accessToken } = event.detail || {};
        
        if (userInfo) {
            await this.saveUserData(userInfo, { source: 'login_success' });
        }
    }
    
    /**
     * 處理認證狀態變化
     */
    async handleAuthStatusChange(event) {
        const { isAuthenticated, reason } = event.detail || {};
        
        if (!isAuthenticated) {
            // console removed
            await this.clearUserData(reason);
        }
    }
    
    /**
     * 處理 token 刷新事件
     */
    async handleTokenRefreshed(event) {
        // console removed
        
        // 刷新時更新最後活動時間
        const currentData = await this.getUserData();
        if (currentData) {
            currentData.lastActive = new Date().toISOString();
            await this.saveUserData(currentData, { source: 'token_refresh' });
        }
    }
    
    /**
     * 保存使用者資料到 Cookie
     */
    async saveUserData(userData, options = {}) {
        try {
            if (!userData) {
                console.warn('⚠️ 嘗試保存空的使用者資料');
                return false;
            }
            
            // 準備要保存的資料
            const dataToSave = this.prepareUserDataForStorage(userData, options);
            
            // 分離敏感和非敏感資料
            const { sensitiveData, publicData } = this.separateUserData(dataToSave);
            
            // 保存公開資料到普通 Cookie
            if (publicData && Object.keys(publicData).length > 0) {
                const success = this.setCookie(this.cookieName, JSON.stringify(publicData), this.defaultCookieOptions);
                if (!success) {
                    console.error('❌ 保存公開使用者資料失敗');
                    return false;
                }
            }
            
            // 保存敏感資料到加密 Cookie
            if (sensitiveData && Object.keys(sensitiveData).length > 0) {
                const encryptedData = await this.encryptData(sensitiveData);
                const success = this.setCookie(this.encryptedCookieName, encryptedData, this.defaultCookieOptions);
                if (!success) {
                    console.error('❌ 保存加密使用者資料失敗');
                    return false;
                }
            }
            
            // 更新快取
            this.userDataCache = dataToSave;
            this.lastCacheTime = Date.now();
            
            // console removed
            
            // 觸發保存成功事件
            this.dispatchEvent('user-data-saved', {
                userData: dataToSave,
                timestamp: new Date().toISOString(),
                source: options.source || 'manual'
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ 保存使用者資料失敗:', error);
            return false;
        }
    }
    
    /**
     * 從 Cookie 獲取使用者資料
     */
    async getUserData() {
        try {
            // 檢查快取
            if (this.isValidCache()) {
                // console removed
                return this.userDataCache;
            }
            
            // 從 Cookie 載入
            const userData = await this.loadUserDataFromCookies();
            
            // 更新快取
            if (userData) {
                this.userDataCache = userData;
                this.lastCacheTime = Date.now();
            }
            
            return userData;
            
        } catch (error) {
            console.error('❌ 獲取使用者資料失敗:', error);
            return null;
        }
    }
    
    /**
     * 從 Cookies 載入使用者資料
     */
    async loadUserDataFromCookies() {
        try {
            let publicData = {};
            let sensitiveData = {};
            
            // 載入公開資料
            const publicCookie = this.getCookie(this.cookieName);
            if (publicCookie) {
                try {
                    publicData = JSON.parse(publicCookie);
                } catch (error) {
                    console.warn('⚠️ 解析公開使用者資料失敗:', error);
                }
            }
            
            // 載入加密資料
            const encryptedCookie = this.getCookie(this.encryptedCookieName);
            if (encryptedCookie) {
                try {
                    sensitiveData = await this.decryptData(encryptedCookie);
                } catch (error) {
                    console.warn('⚠️ 解密使用者資料失敗:', error);
                }
            }
            
            // 合併資料
            const userData = { ...publicData, ...sensitiveData };
            
            if (Object.keys(userData).length === 0) {
                // console removed
                return null;
            }
            
            // console removed
            return userData;
            
        } catch (error) {
            console.error('❌ 從 Cookie 載入使用者資料失敗:', error);
            return null;
        }
    }
    
    /**
     * 初始載入使用者資料
     */
    async loadUserDataFromStorage() {
        const userData = await this.getUserData();
        if (userData) {
            // console removed
        }
    }
    
    /**
     * 清理使用者資料
     */
    async clearUserData(reason = 'manual') {
        try {
            // 刪除 Cookies
            this.deleteCookie(this.cookieName);
            this.deleteCookie(this.encryptedCookieName);
            
            // 清理快取
            this.userDataCache = null;
            this.lastCacheTime = 0;
            
            // console removed
            
            // 觸發清理事件
            this.dispatchEvent('user-data-cleared', {
                reason: reason,
                timestamp: new Date().toISOString()
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ 清理使用者資料失敗:', error);
            return false;
        }
    }
    
    /**
     * 準備要保存的使用者資料
     */
    prepareUserDataForStorage(userData, options = {}) {
        const prepared = {
            // 基本資訊
            id: userData.id || userData.sub,
            name: userData.name,
            email: userData.email,
            picture: userData.picture,
            
            // 元資料
            lastUpdated: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            source: options.source || 'unknown',
            
            // 額外資訊（如果有的話）
            locale: userData.locale,
            verified_email: userData.verified_email,
            family_name: userData.family_name,
            given_name: userData.given_name
        };
        
        // 移除空值
        Object.keys(prepared).forEach(key => {
            if (prepared[key] === undefined || prepared[key] === null) {
                delete prepared[key];
            }
        });
        
        return prepared;
    }
    
    /**
     * 分離敏感和非敏感資料
     */
    separateUserData(userData) {
        // 敏感資料清單
        const sensitiveFields = ['email', 'id'];
        
        // 公開資料清單
        const publicFields = ['name', 'picture', 'locale', 'lastActive', 'source'];
        
        const sensitiveData = {};
        const publicData = {};
        
        Object.keys(userData).forEach(key => {
            if (sensitiveFields.includes(key)) {
                sensitiveData[key] = userData[key];
            } else if (publicFields.includes(key)) {
                publicData[key] = userData[key];
            } else {
                // 預設放在公開資料中
                publicData[key] = userData[key];
            }
        });
        
        return { sensitiveData, publicData };
    }
    
    /**
     * 生成加密金鑰
     */
    generateEncryptionKey() {
        // 基於瀏覽器指紋生成一致的金鑰
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            window.location.hostname
        ].join('|');
        
        return this.simpleHash(fingerprint);
    }
    
    /**
     * 簡單雜湊函數
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 轉換為 32 位整數
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * 加密資料
     */
    async encryptData(data) {
        try {
            const jsonString = JSON.stringify(data);
            
            // 使用簡單的 XOR 加密（適用於非關鍵資料）
            const encrypted = this.xorEncrypt(jsonString, this.encryptionKey);
            
            // Base64 編碼
            return btoa(encrypted);
            
        } catch (error) {
            console.error('❌ 資料加密失敗:', error);
            throw error;
        }
    }
    
    /**
     * 解密資料
     */
    async decryptData(encryptedData) {
        try {
            // Base64 解碼
            const encrypted = atob(encryptedData);
            
            // XOR 解密
            const decrypted = this.xorDecrypt(encrypted, this.encryptionKey);
            
            // 解析 JSON
            return JSON.parse(decrypted);
            
        } catch (error) {
            console.error('❌ 資料解密失敗:', error);
            throw error;
        }
    }
    
    /**
     * XOR 加密
     */
    xorEncrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return result;
    }
    
    /**
     * XOR 解密
     */
    xorDecrypt(text, key) {
        // XOR 加密和解密使用相同的操作
        return this.xorEncrypt(text, key);
    }
    
    /**
     * 設定 Cookie
     */
    setCookie(name, value, options = {}) {
        try {
            let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
            
            // 添加選項
            if (options.expires) {
                const date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
                cookieString += `; expires=${date.toUTCString()}`;
            }
            
            if (options.path) {
                cookieString += `; path=${options.path}`;
            }
            
            if (options.domain) {
                cookieString += `; domain=${options.domain}`;
            }
            
            if (options.secure) {
                cookieString += `; secure`;
            }
            
            if (options.sameSite) {
                cookieString += `; samesite=${options.sameSite}`;
            }
            
            document.cookie = cookieString;
            return true;
            
        } catch (error) {
            console.error('❌ 設定 Cookie 失敗:', error);
            return false;
        }
    }
    
    /**
     * 獲取 Cookie
     */
    getCookie(name) {
        try {
            const nameEQ = encodeURIComponent(name) + '=';
            const cookies = document.cookie.split(';');
            
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.indexOf(nameEQ) === 0) {
                    return decodeURIComponent(cookie.substring(nameEQ.length));
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ 獲取 Cookie 失敗:', error);
            return null;
        }
    }
    
    /**
     * 刪除 Cookie
     */
    deleteCookie(name) {
        try {
            document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            return true;
        } catch (error) {
            console.error('❌ 刪除 Cookie 失敗:', error);
            return false;
        }
    }
    
    /**
     * 檢查快取是否有效
     */
    isValidCache() {
        return this.userDataCache && 
               this.lastCacheTime && 
               (Date.now() - this.lastCacheTime) < this.cacheExpiry;
    }
    
    /**
     * 強制刷新快取到存儲
     */
    async flushCacheToStorage() {
        if (this.userDataCache) {
            await this.saveUserData(this.userDataCache, { source: 'cache_flush' });
        }
    }
    
    /**
     * 更新使用者資料
     */
    async updateUserData(updates) {
        try {
            const currentData = await this.getUserData() || {};
            const updatedData = { ...currentData, ...updates };
            updatedData.lastUpdated = new Date().toISOString();
            
            return await this.saveUserData(updatedData, { source: 'update' });
            
        } catch (error) {
            console.error('❌ 更新使用者資料失敗:', error);
            return false;
        }
    }
    
    /**
     * 獲取公開使用者資料（隱藏敏感資訊）
     */
    async getPublicUserData() {
        const userData = await this.getUserData();
        if (!userData) return null;
        
        return {
            name: userData.name,
            picture: userData.picture,
            locale: userData.locale,
            lastActive: userData.lastActive,
            // 隱藏敏感資訊
            email: userData.email ? userData.email.substring(0, 3) + '***@***' : undefined,
            id: userData.id ? '***' + userData.id.substring(userData.id.length - 4) : undefined
        };
    }
    
    /**
     * 檢查使用者是否已登入
     */
    async isUserLoggedIn() {
        const userData = await this.getUserData();
        return !!(userData && userData.id);
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
        // console removed
    }
    
    /**
     * 獲取資料統計
     */
    getDataStats() {
        return {
            cookieName: this.cookieName,
            encryptedCookieName: this.encryptedCookieName,
            hasCachedData: !!this.userDataCache,
            cacheAge: this.lastCacheTime ? Date.now() - this.lastCacheTime : 0,
            cacheValid: this.isValidCache()
        };
    }
    
    /**
     * 清理資源
     */
    destroy() {
        // console removed
        
        // 刷新快取到存儲
        this.flushCacheToStorage();
        
        // 移除所有事件監聽器
        this.eventListeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // 清理快取
        this.userDataCache = null;
        this.lastCacheTime = 0;
        
        // console removed
    }
}

// 全域實例管理
window.UserDataCookieManager = UserDataCookieManager;

// 自動初始化全域管理器（如果需要）
if (!window.globalUserDataCookieManager) {
    window.globalUserDataCookieManager = new UserDataCookieManager();
}

// console removed
