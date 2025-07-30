# WebView Google 登入整合指南

## 概述

`inf-google-login` Web Component 現在支援在各種 WebView 環境中使用 Google 登入功能，包括：

- React Native WebView
- iOS WKWebView
- Android WebView
- Cordova/PhoneGap
- Ionic/Capacitor
- Flutter WebView

## 自動檢測

組件會自動檢測 WebView 環境並選擇適當的登入方式：

1. **一般瀏覽器**：使用 Google Identity Services (GIS)
2. **WebView 環境**：使用 WebView 特定的登入方式

## 支援的 WebView 類型

### 1. React Native WebView

```javascript
// React Native 端
import { WebView } from 'react-native-webview';

const WebViewComponent = () => {
  const handleMessage = (event) => {
    const data = JSON.parse(event.nativeEvent.data);
    
    if (data.type === 'GOOGLE_SIGN_IN') {
      // 使用 React Native Google Sign-In 庫
      GoogleSignin.signIn()
        .then((result) => {
          // 發送成功消息回 WebView
          webViewRef.current.postMessage(JSON.stringify({
            type: 'GOOGLE_SIGN_IN_SUCCESS',
            credential: result.idToken
          }));
        })
        .catch((error) => {
          // 發送失敗消息回 WebView
          webViewRef.current.postMessage(JSON.stringify({
            type: 'GOOGLE_SIGN_IN_FAILURE',
            error: error.message
          }));
        });
    }
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: 'your-webview-url' }}
      onMessage={handleMessage}
    />
  );
};
```

### 2. iOS WKWebView

```swift
// iOS 端
import WebKit
import GoogleSignIn

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    var webView: WKWebView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        let contentController = WKUserContentController()
        contentController.add(self, name: "googleSignIn")
        
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.navigationDelegate = self
        view.addSubview(webView)
        
        // 載入網頁
        let url = URL(string: "your-webview-url")!
        webView.load(URLRequest(url: url))
    }
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "googleSignIn" {
            // 處理 Google 登入
            GIDSignIn.sharedInstance.signIn(withPresenting: self) { result, error in
                if let error = error {
                    // 發送失敗消息
                    self.webView.evaluateJavaScript("""
                        window.postMessage({
                            type: 'GOOGLE_SIGN_IN_FAILURE',
                            error: '\(error.localizedDescription)'
                        }, '*');
                    """)
                } else if let result = result {
                    // 發送成功消息
                    self.webView.evaluateJavaScript("""
                        window.postMessage({
                            type: 'GOOGLE_SIGN_IN_SUCCESS',
                            credential: '\(result.user.idToken?.tokenString ?? "")'
                        }, '*');
                    """)
                }
            }
        }
    }
}
```

### 3. Android WebView

```java
// Android 端
public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private GoogleSignInClient googleSignInClient;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // 初始化 Google Sign-In
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken("your-client-id")
            .requestEmail()
            .build();
        
        googleSignInClient = GoogleSignIn.getClient(this, gso);
        
        // 設置 WebView
        webView = findViewById(R.id.webview);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.addJavascriptInterface(new WebAppInterface(), "Android");
        webView.loadUrl("your-webview-url");
    }
    
    public class WebAppInterface {
        @JavascriptInterface
        public void googleSignIn(String clientId) {
            Intent signInIntent = googleSignInClient.getSignInIntent();
            startActivityForResult(signInIntent, RC_SIGN_IN);
        }
    }
    
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                String idToken = account.getIdToken();
                
                // 發送成功消息回 WebView
                webView.evaluateJavascript(
                    "window.postMessage({type: 'GOOGLE_SIGN_IN_SUCCESS', credential: '" + idToken + "'}, '*');",
                    null
                );
            } catch (ApiException e) {
                // 發送失敗消息回 WebView
                webView.evaluateJavascript(
                    "window.postMessage({type: 'GOOGLE_SIGN_IN_FAILURE', error: '" + e.getMessage() + "'}, '*');",
                    null
                );
            }
        }
    }
}
```

## OAuth2 回調方式

如果無法與原生應用通信，組件會使用 OAuth2 授權流程：

1. 點擊頭像時，會重定向到 Google 授權頁面
2. 用戶授權後，會重定向回應用並帶有 access token
3. 組件會自動處理回調並獲取用戶資訊

### 配置 OAuth2 重定向 URI

在 Google Cloud Console 中配置 OAuth2 重定向 URI：

```
https://your-domain.com/webview-test.html
```

## 使用方式

### 1. 基本使用

```html
<google-login client-id="your-google-client-id"></google-login>
```

### 2. 監聽事件

```javascript
// 登入成功
document.addEventListener('google-login-success', (event) => {
    console.log('登入成功:', event.detail);
});

// 登入失敗
document.addEventListener('google-login-failure', (event) => {
    console.log('登入失敗:', event.detail.error);
});

// 登出
document.addEventListener('google-logout', (event) => {
    console.log('已登出');
});

// 導航到個人資料
document.addEventListener('navigate-to-profile', (event) => {
    console.log('導航到個人資料:', event.detail.user);
});
```

## 測試

### 1. WebView 測試頁面

訪問 `webview-test.html` 來測試 WebView 功能：

```bash
python3 -m http.server 8000
# 然後訪問 http://localhost:8000/webview-test.html
```

### 2. 在真實 WebView 中測試

1. 將測試頁面部署到 HTTPS 服務器
2. 在原生應用中載入該頁面
3. 測試登入功能

## 注意事項

1. **HTTPS 要求**：Google OAuth2 要求使用 HTTPS
2. **Client ID 配置**：確保在 Google Cloud Console 中正確配置了 Client ID
3. **重定向 URI**：OAuth2 方式需要配置正確的重定向 URI
4. **原生應用權限**：確保原生應用有適當的權限來處理 Google 登入

## 故障排除

### 常見問題

1. **WebView 檢測失敗**
   - 檢查 User Agent 是否包含 WebView 標識
   - 手動設置 WebView 模式

2. **原生應用通信失敗**
   - 檢查 JavaScript interface 是否正確設置
   - 確認消息格式是否正確

3. **OAuth2 回調失敗**
   - 檢查重定向 URI 是否正確配置
   - 確認 HTTPS 設置

### 調試

組件會在控制台輸出詳細的調試信息，包括：

- WebView 檢測結果
- 通信消息
- 錯誤詳情

查看瀏覽器控制台或 WebView 日誌來診斷問題。 