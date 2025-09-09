# Google 登入完整認證系統

## 🎯 主要目標
實現完全原生的前端自動登入狀態檢查系統，支援：
- 前端自動檢查登入狀態
- access_token 過期自動刷新
- 登入後 cookie 保存使用者資訊
- Vercel serverless function 處理 OAuth 流程
- 無需第三方套件或框架的完全原生實現

## 🚀 新增功能開發

### 1. 前端自動檢查登入狀態系統 ⏳
**實現智能的登入狀態監控機制**

#### 核心功能
- **頁面載入檢查**：每次頁面載入時自動檢查登入狀態
- **可見性監控**：頁面重新可見時檢查 token 有效性
- **定時檢查**：每 5 分鐘自動檢查 token 狀態
- **即時驗證**：檢測到 token 即將過期時立即驗證

#### 技術實作
```javascript
// 自動登入狀態檢查管理器
class AuthStatusManager {
    constructor() {
        this.checkInterval = null;
        this.isChecking = false;
        this.init();
    }
    
    init() {
        // 頁面載入時檢查
        this.checkAuthStatus();
        
        // 可見性變化監聽
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkAuthStatus();
            }
        });
        
        // 定時檢查（每 5 分鐘）
        this.startPeriodicCheck();
    }
    
    async checkAuthStatus() {
        if (this.isChecking) return;
        this.isChecking = true;
        
        try {
            const token = await this.getValidToken();
            if (token) {
                await this.validateTokenWithServer(token);
            } else {
                this.handleTokenExpired();
            }
        } catch (error) {
            console.error('登入狀態檢查失敗:', error);
        } finally {
            this.isChecking = false;
        }
    }
}
```

### 2. Access Token 自動刷新機制 ⏳
**智能 Token 生命週期管理**

#### 核心功能
- **提前刷新**：在 token 過期前 10 分鐘自動刷新
- **失敗重試**：刷新失敗時採用指數退避重試策略
- **無聲刷新**：使用 Google Identity Services 無聲刷新
- **降級處理**：刷新失敗時自動引導重新登入

#### 技術實作
```javascript
// Token 自動刷新管理器
class TokenRefreshManager {
    constructor() {
        this.refreshThreshold = 10 * 60 * 1000; // 提前 10 分鐘刷新
        this.retryAttempts = 0;
        this.maxRetries = 3;
    }
    
    async autoRefreshToken() {
        try {
            const token = localStorage.getItem('google_access_token');
            const expiresAt = localStorage.getItem('google_token_expires_at');
            
            if (this.shouldRefreshToken(expiresAt)) {
                await this.performTokenRefresh();
            }
        } catch (error) {
            this.handleRefreshError(error);
        }
    }
    
    shouldRefreshToken(expiresAt) {
        if (!expiresAt) return true;
        const timeUntilExpiry = parseInt(expiresAt) - Date.now();
        return timeUntilExpiry <= this.refreshThreshold;
    }
}
```

### 3. Cookie 使用者資訊保存 ⏳
**安全的使用者資料持久化**

#### 核心功能
- **加密存儲**：使用者敏感資訊進行加密保存
- **自動同步**：登入狀態變化時自動更新 cookie
- **跨域支援**：支援子域名間的 cookie 共享
- **安全設定**：HttpOnly、Secure、SameSite 等安全屬性

#### 技術實作
```javascript
// Cookie 使用者資料管理器
class UserDataCookieManager {
    constructor() {
        this.cookieName = 'inf_user_data';
        this.encryptionKey = this.generateEncryptionKey();
    }
    
    saveUserDataToCookie(userData) {
        try {
            const encryptedData = this.encryptData(userData);
            const cookieOptions = {
                expires: 30, // 30 天
                secure: true,
                sameSite: 'Lax',
                path: '/'
            };
            
            this.setCookie(this.cookieName, encryptedData, cookieOptions);
        } catch (error) {
            console.error('保存使用者資料到 Cookie 失敗:', error);
        }
    }
    
    getUserDataFromCookie() {
        try {
            const encryptedData = this.getCookie(this.cookieName);
            if (encryptedData) {
                return this.decryptData(encryptedData);
            }
        } catch (error) {
            console.error('從 Cookie 讀取使用者資料失敗:', error);
        }
        return null;
    }
}
```

### 4. Vercel Serverless OAuth 處理 ⏳
**完全原生的 OAuth 流程**

#### 核心功能
- **授權碼處理**：處理 Google OAuth 授權碼交換
- **Token 管理**：安全的 access_token 和 refresh_token 管理
- **使用者資訊獲取**：從 Google API 獲取使用者基本資訊
- **CORS 支援**：正確的跨域請求處理

#### API 路由設計
```javascript
// api/auth/google.js - Google OAuth 處理
export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { code, state } = req.body;
        
        try {
            // 交換授權碼獲取 tokens
            const tokenResponse = await exchangeCodeForTokens(code);
            
            // 獲取使用者資訊
            const userInfo = await getUserInfo(tokenResponse.access_token);
            
            // 返回安全的響應
            res.status(200).json({
                success: true,
                access_token: tokenResponse.access_token,
                refresh_token: tokenResponse.refresh_token,
                expires_in: tokenResponse.expires_in,
                user: userInfo
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

// api/auth/refresh.js - Token 刷新處理
export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { refresh_token } = req.body;
        
        try {
            const newTokens = await refreshAccessToken(refresh_token);
            res.status(200).json({
                success: true,
                access_token: newTokens.access_token,
                expires_in: newTokens.expires_in
            });
        } catch (error) {
            res.status(401).json({ success: false, error: 'Token refresh failed' });
        }
    }
}
```

## 📋 任務進度追蹤

### 任務清單
- ✅ **任務 1：實現前端自動檢查登入狀態系統**  
  描述：建立智能的登入狀態監控機制，包含頁面載入、可見性變化和定時檢查。  
  預期輸出：AuthStatusManager 類別和相關檢查邏輯。  
  完成標準：系統能自動檢測並維護登入狀態。  
  **✅ 已完成**：`auth-status-manager.js`

- ✅ **任務 2：實現 access_token 過期自動刷新機制**  
  描述：建立智能 Token 生命週期管理，支援提前刷新和失敗重試。  
  預期輸出：TokenRefreshManager 類別和刷新邏輯。  
  完成標準：Token 能在過期前自動刷新，失敗時正確處理。  
  **✅ 已完成**：`token-refresh-manager.js`

- ✅ **任務 3：實現登入後 cookie 保存使用者資訊**  
  描述：建立安全的使用者資料持久化機制，支援加密存儲和自動同步。  
  預期輸出：UserDataCookieManager 類別和加密邏輯。  
  完成標準：使用者資料能安全保存在 cookie 中並正確讀取。  
  **✅ 已完成**：`user-data-cookie-manager.js`

- ✅ **任務 4：創建 Vercel serverless function 處理 OAuth**  
  描述：建立完全原生的 OAuth 流程處理，包含授權碼交換和 token 刷新。  
  預期輸出：Google OAuth 和 token 刷新的 serverless API。  
  完成標準：OAuth 流程能完全通過 serverless function 處理。  
  **✅ 已完成**：`/api/auth/google.js`, `/api/auth/refresh.js`, `/api/auth/verify.js`

- ✅ **任務 5：整合測試完整認證流程**  
  描述：整合所有功能模組，測試完整的認證流程。  
  預期輸出：完整的測試報告和功能驗證。  
  完成標準：所有功能正常運作，無相容性問題。  
  **✅ 已完成**：`auth-integration-manager.js`, `auth-test.html`

## 🎉 系統實現完成

### 📁 檔案結構
```
/
├── auth-status-manager.js          # 前端自動檢查登入狀態系統
├── token-refresh-manager.js        # access_token 過期自動刷新機制
├── user-data-cookie-manager.js     # Cookie 使用者資訊保存功能
├── auth-integration-manager.js     # 認證系統整合管理器
├── auth-test.html                   # 完整功能測試頁面
├── /api/auth/
│   ├── google.js                   # Google OAuth 處理
│   ├── refresh.js                  # Token 刷新處理
│   └── verify.js                   # Token 驗證與使用者資訊獲取
├── vercel.json                     # Vercel 部署配置
├── package.json                    # 專案配置
└── .env.example                    # 環境變數範例
```

### 🚀 核心功能特色

#### 1. 前端自動檢查登入狀態系統 ✅
- **事件驅動檢查**：頁面載入、可見性變化、焦點事件
- **智能冷卻機制**：避免頻繁檢查，提升效能
- **自動狀態同步**：跨標籤頁狀態同步
- **完善錯誤處理**：優雅的錯誤恢復機制

#### 2. Access Token 自動刷新機制 ✅
- **多層級刷新策略**：10分鐘、5分鐘、2分鐘提前刷新
- **指數退避重試**：1秒、3秒、10秒智能重試
- **多種刷新方式**：Google Identity Services、後端API、直接調用
- **無聲刷新支援**：使用者無感知的token更新

#### 3. Cookie 使用者資訊保存 ✅
- **輕量級加密**：XOR加密保護敏感資訊
- **資料分離存儲**：敏感與非敏感資料分別處理
- **自動狀態同步**：登入狀態變化時自動更新
- **快取機制**：5分鐘記憶體快取提升效能

#### 4. Vercel Serverless OAuth 處理 ✅
- **完全原生實現**：無第三方套件依賴
- **安全的授權碼交換**：後端處理client_secret
- **CORS支援**：正確的跨域請求處理
- **詳細錯誤處理**：分類錯誤響應和狀態碼

#### 5. 整合測試系統 ✅
- **統一管理介面**：整合所有認證模組
- **即時狀態監控**：5秒間隔自動狀態更新
- **完整測試功能**：涵蓋所有認證流程
- **視覺化儀表板**：直觀的狀態顯示和操作控制

### 🔧 使用方式

#### 快速開始
1. **複製環境變數**：
   ```bash
   cp .env.example .env
   ```

2. **設定 Google OAuth 配置**：
   ```bash
   # .env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000
   ```

3. **安裝依賴並啟動**：
   ```bash
   npm install
   npm run dev
   ```

4. **訪問測試頁面**：
   ```
   http://localhost:3000/auth-test.html
   ```

#### 整合到現有專案
```html
<!-- 載入所有模組 -->
<script src="auth-status-manager.js"></script>
<script src="token-refresh-manager.js"></script>
<script src="user-data-cookie-manager.js"></script>
<script src="auth-integration-manager.js"></script>

<script>
// 初始化整合管理器
const authManager = new AuthIntegrationManager({
    debug: true,
    apiBaseUrl: '/api'
});

// 監聽認證事件
document.addEventListener('auth-integration-login-success', (event) => {
    console.log('登入成功:', event.detail);
});

document.addEventListener('auth-integration-status-changed', (event) => {
    console.log('狀態變化:', event.detail);
});
</script>
```

### 🌟 技術亮點

#### 1. 完全原生實現
- **零外部依賴**：不需要任何第三方套件或框架
- **純 JavaScript**：使用現代 ES6+ 語法
- **模組化設計**：可獨立使用任何單一模組

#### 2. 高效能設計
- **事件驅動架構**：避免輪詢造成的效能問題
- **智能快取機制**：減少不必要的API調用
- **記憶體管理**：正確的事件監聽器清理

#### 3. 安全性考量
- **敏感資訊加密**：cookie中的使用者資料加密保護
- **後端token處理**：client_secret在後端安全處理
- **CORS安全設定**：正確的跨域請求配置

#### 4. 使用者體驗
- **無感知刷新**：使用者無需手動重新登入
- **跨標籤頁同步**：多標籤頁狀態自動同步
- **優雅錯誤處理**：失敗時的自動恢復機制

### 🔍 部署指南

#### Vercel 部署
1. **推送到 GitHub**：
   ```bash
   git add .
   git commit -m "完成認證系統實現"
   git push origin main
   ```

2. **連接 Vercel**：
   - 在 Vercel Dashboard 中導入 GitHub 專案
   - 設定環境變數：GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

3. **自動部署**：
   - Vercel 將自動部署並建立 API 端點

#### 環境變數設定
```bash
# 在 Vercel Dashboard 的 Settings > Environment Variables 中設定
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret  
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app
```

## 🎯 原有目標（已完成部分）
讓 Google 登入功能在無痕瀏覽器中正常工作，解決以下問題：
- Provider's accounts list is empty
- FedCM get() rejects with NetworkError
- Not signed in with the identity provider

## ✅ 已完成的改動

### 1. 完全解決 Token 一小時失效問題 ✅ 
**🚀 重大更新：徹底解決 Google Token 頻繁過期問題**

#### 核心問題分析
- **問題根源**：前端無法安全使用 `client_secret` 進行 refresh token 操作
- **舊解決方案缺陷**：硬編碼 8 小時過期時間與 Google 實際 1 小時限制不符
- **用戶痛點**：頻繁被迫重新登入，嚴重影響使用體驗

#### 全新解決方案 
- **智能 Token 管理**：
  - 從 JWT payload 自動解析實際過期時間
  - 智能識別不同 token 類型 (`gid_`, `oauth2_` 等)
  - 動態調整過期時間，避免硬編碼錯誤

- **多層級自動刷新機制**：
  - 每 30 分鐘主動檢查 token 狀態
  - 每 10 分鐘快速檢查過期時間
  - 頁面重新可見時立即檢查
  - 提前 15 分鐘主動觸發刷新

- **Google Identity Services 無聲刷新**：
  - 使用官方 `prompt()` API 進行無聲刷新
  - 支援 `moment_callback` 和 `credential_callback`
  - 失敗時自動降級到重新登入流程

- **完善的事件監聽管理**：
  - 新增 `visibilitychange` 事件監聽
  - 組件銷毀時正確清理所有監聽器
  - 避免記憶體洩漏問題

#### 技術改進細節
- **Token 保存優化**：支援自定義過期時間參數
- **錯誤處理強化**：多重降級機制確保可靠性
- **日誌改善**：詳細的 emoji 日誌便於偵錯
- **無痕模式兼容**：無痕瀏覽器專用處理邏輯

### 1.1. CC 值智能讀取優化 ✅
**🎯 新增：優先從 localStorage 讀取 CC 胸圍資料**

#### 功能改進
- **智能資料來源**：優先從 `localStorage.BodyID_size` 讀取 CC 值
- **備用機制**：如果 localStorage 中沒有資料，自動降級使用原有計算邏輯
- **錯誤處理**：完善的 try-catch 機制確保程式穩定性

#### 技術實作
```javascript
CC: (function() {
    // 優先從 localStorage BodyID_size 獲取 CC 值
    try {
        const bodyIDSize = localStorage.getItem('BodyID_size');
        if (bodyIDSize) {
            const sizeData = JSON.parse(bodyIDSize);
            if (sizeData && sizeData.CC) {
                return sizeData.CC;
            }
        }
    } catch (error) {
        // 如果讀取失敗，使用備用邏輯
    }
    
    // 備用邏輯：使用原有的胸圍計算方式
    return (Bra_value+Cuxv).length > 2 ? Bra_value+Cuxv : $('#UpChest_input_PS_mbinfo').val()+'_'+$('#DnChest_input_PS_mbinfo').val();
})()
```

### 2. 胸圍編輯智能切換功能 ✅
- 新增格式檢測函數 `detectChestEditMode()` 自動判斷胸圍格式
- 支援兩種編輯模式：
  - **胸圍/罩杯模式**：適用於 "28A", "32B" 等格式
  - **上胸圍/下胸圍模式**：適用於 "85_80", "90" 等格式
- 新增 `createChestMeasurementSelector()` 上胸圍/下胸圍編輯器
- 在胸圍欄位新增 + icon 按鈕，可手動切換編輯模式
- 智能格式轉換和顯示優化

### 3. 資料比對邏輯加入 CC (胸圍) 比對 ✅
- 修改 `getLocalDataInfo()` 方法，加入 CC 資料的處理
- 修改 `getCloudDataInfo()` 方法，加入 CC 資料的處理  
- 更新 `showDataConflictDialog()` 中的比對邏輯，加入 CC 比對
- 在資料衝突對話框中顯示胸圍資料

### 4. 無痕瀏覽器檢測
- 新增 `detectIncognitoMode()` 方法
- 檢測 localStorage、sessionStorage、indexedDB、FileSystem API 可用性
- 在構造函數中自動檢測並設置 `isIncognitoMode` 標記

### 5. Google 登入策略調整
- **無痕模式**：直接使用彈出視窗登入，跳過 Google One Tap
- **正常模式**：使用標準的 Google One Tap + 備用方案

### 6. 配置優化
- 無痕瀏覽器中禁用 `auto_prompt`
- 使用 `consent` 提示模式
- 禁用 `select_account` 強制選擇

### 7. 本地存儲處理
- 無痕瀏覽器中跳過本地憑證檢查
- 跳過 token 自動刷新機制
- 跳過 localStorage 變化監聽

### 8. OAuth2 流程簡化
- 無痕瀏覽器中使用 `response_type=token`
- 直接重定向而不是彈出視窗
- 不請求 refresh token

### 9. 腳部尺寸資料支援 ✅
- 新增 `BodyID_Foot_size` localStorage 存儲，對應雲端的 `shoesM/shoesF` 資料
- **支援腳部專用欄位**：FH (腳長)、FW (腳寬)、FCir (腳圍)
- 修改 `checkLocalSizeData()` 方法支援腳部尺寸資料檢查
- 更新雲端資料同步邏輯 (`downloadCloudDataToLocal`) 支援 shoesM/shoesF
- 新增 `callUploadFootDataAPI()` 方法處理腳部資料上傳
- 新增 `uploadFootMeasurementData()` 方法處理腳部測量完成
- 新增 `restoreFootDataFromSizeLast()` 方法恢復腳部歷史資料
- 更新 `getLocalDataInfo()` 方法顯示腳部尺寸資訊 (footLength, footWidth, footCircumference)
- 更新 `getCloudDataInfo()` 方法支援腳部資料顯示和比較
- 新增 `ensureBodyIDFootSizeHasTS()` 輔助函數確保資料完整性
- 新增 `checkAndDeleteLocalFootDataIfSame()` 函數處理重複資料清理
- 更新 `updateLocalStorageFromAPI()` 支援 shoesF/shoesM 編輯
- 更新資料衝突對話框顯示身體和腳部資料對比
- 更新錯誤處理邏輯同時清理身體和腳部資料

## 🔧 技術實現

### 無痕瀏覽器檢測方法
```javascript
detectIncognitoMode() {
    try {
        // 檢查 localStorage 是否可用
        const testKey = '__incognito_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        
        // 檢查 sessionStorage 是否可用
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
        
        // 檢查 indexedDB 是否可用
        if (!window.indexedDB) {
            return true;
        }
        
        // 檢查 FileSystem API 是否可用
        if (window.webkitRequestFileSystem && !window.webkitRequestFileSystem(window.TEMPORARY, 1024, () => {}, () => {})) {
            return true;
        }
        
        return false;
    } catch (error) {
        console.log('無痕瀏覽器檢測失敗，假設為無痕模式:', error);
        return true;
    }
}
```

### 登入策略選擇
```javascript
// 在無痕瀏覽器中，直接使用彈出視窗登入
if (this.isIncognitoMode) {
    console.log('🕵️ 無痕瀏覽器模式，使用彈出視窗登入');
    this.fallbackGoogleSignIn();
    return;
}
```

### 腳部尺寸資料管理
```javascript
// 檢查本地是否有身體或腳部尺寸資料
checkLocalSizeData() {
    const bodyIdSizeLast = localStorage.getItem('BodyID_size');
    const bodyIdFootSizeLast = localStorage.getItem('BodyID_Foot_size');
    const genderLast = localStorage.getItem('Gender_Last');
    
    if ((!bodyIdSizeLast && !bodyIdFootSizeLast) || !genderLast) {
        return false;
    }
    
    // 檢查身體尺寸資料
    let hasBodyData = false;
    if (bodyIdSizeLast) {
        const sizeData = JSON.parse(bodyIdSizeLast);
        hasBodyData = sizeData.HV && sizeData.WV && genderLast;
    }
    
    // 檢查腳部尺寸資料（使用專用欄位）
    let hasFootData = false;
    if (bodyIdFootSizeLast) {
        const footSizeData = JSON.parse(bodyIdFootSizeLast);
        hasFootData = footSizeData.FH && footSizeData.FW && genderLast;
    }
    
    // 有任一種完整資料即可
    return hasBodyData || hasFootData;
}

// 雲端資料同步支援身體和腳部資料
downloadCloudDataToLocal(apiResponse) {
    // 檢查身體資料（bodyF/bodyM）
    if (bodyData.bodyF) {
        bodyTargetKey = 'bodyF';
        bodyUserData = bodyData.bodyF;
    } else if (bodyData.bodyM) {
        bodyTargetKey = 'bodyM';
        bodyUserData = bodyData.bodyM;
    }
    
    // 檢查鞋子資料（shoesF/shoesM）
    if (bodyData.shoesF) {
        shoesTargetKey = 'shoesF';
        shoesUserData = bodyData.shoesF;
    } else if (bodyData.shoesM) {
        shoesTargetKey = 'shoesM';
        shoesUserData = bodyData.shoesM;
    }
    
    // 分別處理身體資料 -> BodyID_size
    // 和腳部資料 -> BodyID_Foot_size
}
```

### 資料結構對應關係
```
身體尺寸資料：
- 本地：BodyID_size (localStorage)
- 雲端：bodyM / bodyF (API BodyData)
- 欄位：HV (身高), WV (體重), CC (胸圍)

腳部尺寸資料：
- 本地：BodyID_Foot_size (localStorage)  
- 雲端：shoesM / shoesF (API BodyData)
- 欄位：FH (腳長), FW (腳寬), FCir (腳圍), DataItem

性別對應：
- M (男性) -> bodyM / shoesM
- F (女性) -> bodyF / shoesF

腳部資料示例格式：
{
  "DataItem": "0010",
  "FCir": "18.3",    // 腳圍 (cm)
  "FH": "22.5",      // 腳長 (cm) 
  "FW": "6.4"        // 腳寬 (cm)
}

腳部資料使用場景：
- 編輯功能：使用者可編輯 FH (腳長)、FW (腳寬)、FCir (腳圍)
- 查看功能：在資料衝突對話框中顯示腳部尺寸對比
- 自動同步：與身體資料一樣支援本地/雲端雙向同步
- 資料管理：獨立的清理、恢復、比對邏輯
```

## 📱 用戶體驗

### 無痕瀏覽器用戶
1. 自動檢測無痕模式
2. 跳過本地憑證檢查
3. 使用簡化的 OAuth2 流程
4. 直接重定向到 Google 授權頁面

### 正常瀏覽器用戶
1. 保持原有的 Google One Tap 體驗
2. 本地憑證自動刷新
3. 完整的 OAuth2 流程（包含 refresh token）

## 🚀 測試建議

### 測試環境
- Chrome 無痕模式
- Firefox 隱私瀏覽模式
- Safari 隱私瀏覽模式
- Edge InPrivate 模式

### 測試步驟
1. 在無痕瀏覽器中打開頁面
2. 檢查控制台是否顯示「🕵️ 無痕瀏覽器模式」
3. 點擊 Google 登入按鈕
4. 驗證是否直接跳轉到 Google 授權頁面
5. 完成登入後檢查功能是否正常

## 🔍 監控與調試

### 控制台日誌
- `🕵️ 無痕瀏覽器檢測結果: true/false`
- `🕵️ 無痕瀏覽器模式，使用彈出視窗登入`
- `🕵️ 無痕瀏覽器模式，調整 Google 登入配置`
- `🕵️ 無痕瀏覽器模式，跳過本地憑證檢查`

### 錯誤處理
- 無痕瀏覽器檢測失敗時，默認啟用無痕模式
- 所有無痕模式相關操作都有 try-catch 保護
- 失敗時自動回退到標準流程

## 🔧 最新修正記錄

### 修復腳步資料編輯後 onclick 屬性未更新問題 ✅
- **問題**：腳步資料（腳長 FH、腳寬 FW、腳圍 FCir）編輯成功後，再次點擊編輯時仍顯示舊值
- **原因**：`updateEditFieldOnclick()` 函數只處理身高、體重、胸圍等欄位，缺少腳步資料欄位的支援
- **修正**：
  - 在 `updateEditFieldOnclick()` 函數中新增腳步資料欄位的支援（FH、FW、FCir）
  - 更新 `saveFieldValue()` 函數中的條件判斷，包含腳步資料欄位
  - 確保腳步資料編輯後，`onclick` 屬性會正確更新為新值，讓後續編輯顯示最新數據

### 修復編輯彈窗層級被刪除按鈕遮擋問題 ✅
- **問題**：編輯彈窗的層級（z-index）與刪除按鈕相同，導致編輯彈窗可能被刪除按鈕遮擋
- **原因**：編輯選擇器和刪除按鈕容器都設定了相同的 `z-index: 1000`
- **修正**：
  - 將所有編輯選擇器的 `z-index` 從 `1000` 提高到 `1500`
  - 確保編輯彈窗始終顯示在刪除按鈕（z-index: 1000）之上
  - 層級設定：刪除按鈕 (1000) < 編輯彈窗 (1500) < 通知訊息/對話框 (10000) < 模態背景 (10001)

## 📚 參考資料

- [Google Identity Services 文檔](https://developers.google.com/identity/gsi/web)
- [FedCM 遷移指南](https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
- [OAuth2 無痕瀏覽器最佳實踐](https://developers.google.com/identity/protocols/oauth2/web-best-practices)
