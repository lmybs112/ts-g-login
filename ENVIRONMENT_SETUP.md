# 環境變數設定

## 必需的環境變數

請在 Vercel 部署設定中添加以下環境變數：

### Google OAuth2 設定
```
GOOGLE_CLIENT_ID=265821704236-fkdt4rrvpmuhf442c7r2dfg16i71c6qg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[請前往 Google Cloud Console 獲取]
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/google
```

### JWT 加密密鑰
```
JWT_SECRET=your_jwt_secret_key_here
```

## Google Cloud Console 設定

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇您的專案或創建新專案
3. 啟用 Google+ API 和 Google Identity API
4. 創建 OAuth 2.0 客戶端 ID
5. 在「已授權的重新導向 URI」中添加：
   - `https://your-domain.vercel.app/api/auth/google`
   - `http://localhost:3000/api/auth/google`（開發時使用）

## Vercel 部署設定

1. 前往 Vercel 專案設定
2. 點擊「Environment Variables」
3. 添加上述所有環境變數
4. 重新部署專案

## 測試環境變數

部署後可以使用以下端點測試：
- `GET /api/auth/google?test=1` - 檢查配置是否正確
