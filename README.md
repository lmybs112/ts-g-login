# infFITS Google OAuth2 登入 Web Component

一個可重複使用的 Google OAuth2 登入 Web Component，支援 Shadow DOM、自動登入、狀態持久化，適用於任何支援原生 JavaScript 的網站或框架。

## 功能特色

- ✅ **Shadow DOM 封裝**：完全隔離的樣式和行為
- ✅ **自動登入判斷**：支援 `auto_select` 自動登入機制
- ✅ **狀態持久化**：重新載入頁面時自動檢查登入狀態
- ✅ **事件驅動架構**：透過自定義事件通知登入結果
- ✅ **框架無關**：支援 Vue、React、Nuxt、純 HTML 等任何環境
- ✅ **現代化 API**：使用 Google Identity Services (GIS)

## 快速開始

### 1. 獲取 Google OAuth2 客戶端 ID

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立或選擇專案
3. 啟用 Google+ API 或 Google Identity Services
4. 建立 OAuth 2.0 客戶端 ID
5. 設置授權的 JavaScript 來源（例如：`http://localhost:3000`）

### 2. 使用 Web Component

```html
<!DOCTYPE html>
<html>
<head>
    <title>Google 登入測試</title>
</head>
<body>
    <!-- 引入 Google 登入組件 -->
    <script src="src/inf-google-login.js"></script>
    
    <!-- 使用組件 -->
    <google-login 
        client-id="YOUR_GOOGLE_CLIENT_ID"
        auto-select="true">
    </google-login>

    <script>
        // 監聽登入成功事件
        document.addEventListener('google-login-success', (event) => {
            console.log('登入成功！', event.detail);
            const credential = event.detail.credential;
            // 處理 JWT token...
        });

        // 監聽登入失敗事件
        document.addEventListener('google-login-failure', (event) => {
            console.log('登入失敗！', event.detail);
        });
    </script>
</body>
</html>
```

## API 文檔

### 屬性 (Attributes)

| 屬性名 | 類型 | 必填 | 預設值 | 說明 |
|--------|------|------|--------|------|
| `client-id` | String | ✅ | - | Google OAuth2 客戶端 ID |
| `auto-select` | Boolean | ❌ | `true` | 是否啟用自動登入 |

### 事件 (Events)

#### `google-login-success`
登入成功時觸發

```javascript
event.detail = {
    credential: "eyJhbGciOiJSUzI1NiIs...", // JWT token
    timestamp: "2024-01-01T00:00:00.000Z"
}
```

#### `google-login-failure`
登入失敗時觸發

```javascript
event.detail = {
    error: "錯誤訊息",
    timestamp: "2024-01-01T00:00:00.000Z"
}
```

#### `google-logout`
登出時觸發

```javascript
event.detail = {
    timestamp: "2024-01-01T00:00:00.000Z"
}
```

### 方法 (Methods)

| 方法名 | 說明 |
|--------|------|
| `signIn()` | 手動觸發登入 |
| `signOut()` | 登出並停用自動登入 |

```javascript
// 取得組件實例
const googleLogin = document.querySelector('google-login');

// 手動觸發登入
googleLogin.signIn();

// 登出
googleLogin.signOut();
```

## 使用範例

### Vue.js 使用範例

```vue
<template>
  <div>
    <google-login 
      :client-id="googleClientId"
      auto-select="true"
      @google-login-success="handleLoginSuccess"
      @google-login-failure="handleLoginFailure">
    </google-login>
  </div>
</template>

<script>
export default {
  data() {
    return {
      googleClientId: 'YOUR_GOOGLE_CLIENT_ID'
    }
  },
  methods: {
    handleLoginSuccess(event) {
      console.log('Vue: 登入成功', event.detail);
      // 處理登入成功邏輯
    },
    handleLoginFailure(event) {
      console.log('Vue: 登入失敗', event.detail);
      // 處理登入失敗邏輯
    }
  }
}
</script>
```

### React 使用範例

```jsx
import { useEffect, useRef } from 'react';

function GoogleLoginComponent() {
  const googleLoginRef = useRef(null);

  useEffect(() => {
    const handleLoginSuccess = (event) => {
      console.log('React: 登入成功', event.detail);
      // 處理登入成功邏輯
    };

    const handleLoginFailure = (event) => {
      console.log('React: 登入失敗', event.detail);
      // 處理登入失敗邏輯
    };

    const element = googleLoginRef.current;
    element.addEventListener('google-login-success', handleLoginSuccess);
    element.addEventListener('google-login-failure', handleLoginFailure);

    return () => {
      element.removeEventListener('google-login-success', handleLoginSuccess);
      element.removeEventListener('google-login-failure', handleLoginFailure);
    };
  }, []);

  return (
    <google-login 
      ref={googleLoginRef}
      client-id="YOUR_GOOGLE_CLIENT_ID"
      auto-select="true">
    </google-login>
  );
}
```

## 開發

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

開啟瀏覽器訪問 `http://localhost:3000` 進行測試。

### 建置

```bash
npm run build
```

## 技術細節

- **Web Component 標準**：使用原生 Custom Elements API
- **Shadow DOM**：完全隔離的 DOM 和樣式
- **Google Identity Services**：使用最新的 GIS API
- **事件系統**：使用 `composed: true` 讓事件穿透 Shadow DOM
- **自動載入**：動態載入 Google 服務腳本
- **錯誤處理**：完善的錯誤處理和狀態回饋

## 瀏覽器支援

- Chrome 54+
- Firefox 63+
- Safari 10.1+
- Edge 79+

## 授權

MIT License

## 貢獻

歡迎提交 Pull Request 或 Issue！ 