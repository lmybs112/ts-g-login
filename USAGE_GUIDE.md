# 🚀 使用指南

## 概述

這是一個完全原生的前端自動登入狀態檢查系統，提供以下核心功能：

- ✅ **前端自動檢查登入狀態**
- ✅ **access_token 過期自動刷新**  
- ✅ **登入後 cookie 保存使用者資訊**
- ✅ **Vercel serverless function 處理 OAuth 流程**
- ✅ **無需第三方套件或框架**

## 🏃‍♂️ 快速開始

### 1. 環境設定

```bash
# 複製環境變數範例
cp .env.example .env

# 編輯環境變數
nano .env
```

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000
```

### 2. 本地開發

```bash
# 安裝 Vercel CLI (如果尚未安裝)
npm install -g vercel

# 啟動本地開發伺服器
vercel dev

# 或使用 npm 指令
npm run dev
```

### 3. 訪問測試頁面

開啟瀏覽器訪問：
```
http://localhost:3000/auth-test.html
```

## 📝 基本使用

### 方法一：使用整合管理器（推薦）

```html
<!DOCTYPE html>
<html>
<head>
    <title>我的應用</title>
</head>
<body>
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
            const { user } = event.detail;
            console.log('登入成功:', user);
            
            // 更新 UI
            document.getElementById('welcome').textContent = `歡迎 ${user.name}`;
        });

        document.addEventListener('auth-integration-status-changed', (event) => {
            const { isAuthenticated } = event.detail;
            
            if (isAuthenticated) {
                document.getElementById('login-section').style.display = 'none';
                document.getElementById('user-section').style.display = 'block';
            } else {
                document.getElementById('login-section').style.display = 'block';
                document.getElementById('user-section').style.display = 'none';
            }
        });

        // 手動檢查認證狀態
        function checkAuth() {
            authManager.checkAuthStatus();
        }

        // 登出
        function logout() {
            authManager.logout();
        }
    </script>

    <div id="login-section">
        <button onclick="checkAuth()">檢查登入狀態</button>
    </div>

    <div id="user-section" style="display: none;">
        <p id="welcome">歡迎！</p>
        <button onclick="logout()">登出</button>
    </div>
</body>
</html>
```

### 方法二：獨立使用模組

```javascript
// 只使用認證狀態管理器
const authStatusManager = new AuthStatusManager();

// 監聽狀態變化
document.addEventListener('auth-status-changed', (event) => {
    const { isAuthenticated } = event.detail;
    console.log('認證狀態:', isAuthenticated);
});

// 手動檢查
authStatusManager.forceCheck();
```

## 🔧 進階配置

### 自定義整合管理器選項

```javascript
const authManager = new AuthIntegrationManager({
    // 是否自動啟動
    autoStart: true,
    
    // 啟用的模組
    enableCookieManager: true,
    enableTokenRefresh: true,
    enableStatusCheck: true,
    
    // API 基礎 URL
    apiBaseUrl: '/api',
    
    // 調試模式
    debug: false
});
```

### 自定義 Token 刷新設定

```javascript
const tokenManager = new TokenRefreshManager();

// 設定自定義刷新閾值
tokenManager.refreshThreshold = 15 * 60 * 1000; // 15 分鐘
tokenManager.earlyRefreshThreshold = 10 * 60 * 1000; // 10 分鐘
tokenManager.criticalRefreshThreshold = 5 * 60 * 1000; // 5 分鐘

// 設定重試次數
tokenManager.maxRetries = 5;
```

### 自定義 Cookie 設定

```javascript
const cookieManager = new UserDataCookieManager();

// 自定義 Cookie 選項
cookieManager.defaultCookieOptions = {
    expires: 60, // 60 天
    secure: true,
    sameSite: 'Strict',
    path: '/',
    domain: '.yourdomain.com' // 支援子域名
};
```

## 🎯 API 端點

### Google OAuth 授權

```javascript
// POST /api/auth/google
const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        code: 'authorization_code_from_google',
        state: 'optional_state_parameter',
        redirect_uri: 'http://localhost:3000'
    })
});

const data = await response.json();
console.log(data);
// {
//   "success": true,
//   "access_token": "...",
//   "refresh_token": "...",
//   "expires_in": 3600,
//   "user": {
//     "id": "...",
//     "name": "...",
//     "email": "..."
//   }
// }
```

### Token 刷新

```javascript
// POST /api/auth/refresh
const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        refresh_token: 'your_refresh_token'
    })
});

const data = await response.json();
console.log(data);
// {
//   "success": true,
//   "access_token": "new_access_token",
//   "expires_in": 3600
// }
```

### Token 驗證

```javascript
// POST /api/auth/verify
const response = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        access_token: 'your_access_token'
    })
});

const data = await response.json();
console.log(data);
// {
//   "success": true,
//   "valid": true,
//   "user": {...},
//   "token_info": {...}
// }
```

## 🎮 常見使用案例

### 案例 1：檢查使用者是否已登入

```javascript
async function isUserLoggedIn() {
    if (authManager) {
        const status = authManager.getAuthStatus();
        return status.isAuthenticated;
    }
    
    // 或使用 Cookie 管理器
    if (window.globalUserDataCookieManager) {
        return await window.globalUserDataCookieManager.isUserLoggedIn();
    }
    
    return false;
}

// 使用
const isLoggedIn = await isUserLoggedIn();
if (isLoggedIn) {
    console.log('使用者已登入');
} else {
    console.log('使用者未登入');
}
```

### 案例 2：獲取當前使用者資訊

```javascript
async function getCurrentUser() {
    if (authManager) {
        return await authManager.getUserData();
    }
    
    // 或直接使用 Cookie 管理器
    if (window.globalUserDataCookieManager) {
        return await window.globalUserDataCookieManager.getUserData();
    }
    
    return null;
}

// 使用
const user = await getCurrentUser();
if (user) {
    console.log('當前使用者:', user.name);
} else {
    console.log('沒有登入的使用者');
}
```

### 案例 3：監聽認證狀態變化

```javascript
// 監聽登入成功
document.addEventListener('auth-integration-login-success', (event) => {
    const { user } = event.detail;
    
    // 更新導航欄
    updateNavigationBar(user);
    
    // 載入使用者專屬內容
    loadUserContent(user.id);
    
    // 顯示歡迎訊息
    showWelcomeMessage(user.name);
});

// 監聽登出
document.addEventListener('auth-integration-logout', (event) => {
    // 清理使用者專屬內容
    clearUserContent();
    
    // 重定向到登入頁面
    window.location.href = '/login';
});

// 監聽 Token 刷新
document.addEventListener('auth-integration-token-refreshed', (event) => {
    console.log('Token 已自動刷新');
    
    // 可以在這裡更新 API 請求的 Authorization header
    updateAPIHeaders();
});
```

### 案例 4：手動觸發登入檢查

```javascript
// 在關鍵操作前檢查登入狀態
async function performSensitiveOperation() {
    // 檢查認證狀態
    await authManager.checkAuthStatus();
    
    // 獲取最新的 access token
    const accessToken = localStorage.getItem('google_access_token');
    
    if (!accessToken) {
        alert('請先登入');
        return;
    }
    
    // 執行敏感操作
    const response = await fetch('/api/sensitive-operation', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // 操作資料
        })
    });
    
    if (response.status === 401) {
        // Token 可能已過期，觸發刷新
        await authManager.refreshToken();
        
        // 重試操作
        // ...
    }
}
```

## 🚀 部署到 Vercel

### 1. 準備部署

```bash
# 確保所有檔案已提交
git add .
git commit -m "完成認證系統實現"
git push origin main
```

### 2. 連接 Vercel

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)
2. 點擊 "New Project"
3. 選擇您的 GitHub 專案
4. 點擊 "Deploy"

### 3. 設定環境變數

在 Vercel Dashboard 中：
1. 進入專案設定 (Settings)
2. 選擇 "Environment Variables"
3. 添加以下變數：

```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app
```

### 4. 更新 Google OAuth 設定

在 [Google Cloud Console](https://console.cloud.google.com/) 中：
1. 進入 APIs & Services > Credentials
2. 編輯您的 OAuth 2.0 Client ID
3. 在 "Authorized redirect URIs" 中添加：
   ```
   https://your-domain.vercel.app
   https://your-domain.vercel.app/auth/callback
   ```

## ❗ 常見問題

### Q: 為什麼 Token 刷新失敗？
A: 檢查以下項目：
- Refresh token 是否有效
- Google OAuth 設定是否正確
- 環境變數是否設定正確
- API 端點是否可達

### Q: Cookie 資料沒有保存？
A: 檢查以下項目：
- 瀏覽器是否支援 Cookie
- 是否在 HTTPS 環境下使用 Secure cookie
- Cookie 大小是否超過限制（4KB）

### Q: 跨域請求失敗？
A: 確保：
- CORS 設定正確
- API 端點返回正確的 CORS 標頭
- 請求方法和標頭被允許

### Q: 無痕瀏覽器模式下無法使用？
A: 這是正常現象，因為：
- 無痕模式限制 localStorage 和 Cookie
- 系統會自動檢測並調整策略
- 某些功能在無痕模式下會被禁用

## 📞 支援

如果遇到問題，請：
1. 檢查瀏覽器控制台日誌
2. 確認所有環境變數設定正確
3. 參考 `auth-test.html` 中的完整範例
4. 查看 README.md 中的詳細說明

---

🎉 享受完全原生的認證系統體驗！
