/**
 * Google OAuth 處理 - Vercel Serverless Function
 * 
 * 功能：
 * - 處理 Google OAuth 授權碼交換
 * - 獲取使用者資訊
 * - 安全的 token 管理
 * - CORS 支援
 * 
 * 端點：POST /api/auth/google
 * 
 * 請求格式：
 * {
 *   "code": "授權碼",
 *   "state": "狀態參數（可選）",
 *   "redirect_uri": "重定向URI（可選）"
 * }
 * 
 * 響應格式：
 * {
 *   "success": true,
 *   "access_token": "訪問令牌",
 *   "refresh_token": "刷新令牌",
 *   "expires_in": 3600,
 *   "user": {
 *     "id": "使用者ID",
 *     "name": "使用者姓名",
 *     "email": "使用者郵箱",
 *     "picture": "頭像URL"
 *   }
 * }
 */

/**
 * 主要處理函數
 */
export default async function handler(req, res) {
    // 設定 CORS 標頭
    setCorsHeaders(res);
    
    // 處理 OPTIONS 請求（CORS 預檢）
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // 允許 GET 和 POST 請求
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed',
            message: '只允許 GET 和 POST 請求'
        });
    }
    
    try {
        console.log('🚀 開始處理 Google OAuth 請求');
        
        // 從 GET 或 POST 請求中獲取參數
        let code, state, redirect_uri;
        
        if (req.method === 'GET') {
            // 處理重定向回調
            code = req.query.code;
            state = req.query.state;
            redirect_uri = req.query.redirect_uri || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/google`;
            
            // 如果是測試請求，返回配置狀態
            if (req.query.test === '1') {
                const clientId = process.env.GOOGLE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
                
                return res.status(200).json({
                    success: true,
                    config_status: {
                        client_id: clientId ? 'configured' : 'missing',
                        client_secret: clientSecret ? 'configured' : 'missing',
                        redirect_uri: `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/auth/google`
                    }
                });
            }
            
            // 如果是 GET 請求且有授權碼，返回一個頁面來處理回調
            if (code) {
                return res.status(200).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Google 授權處理中...</title>
                        <script>
                            // 發送 POST 請求處理授權碼
                            fetch('/api/auth/google', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    code: '${code}',
                                    state: '${state}',
                                    redirect_uri: '${redirect_uri}'
                                })
                            })
                            .then(response => response.json())
                            .then(data => {
                                if (data.success) {
                                    // 保存 tokens 到 localStorage
                                    localStorage.setItem('google_access_token', data.access_token);
                                    if (data.refresh_token) {
                                        localStorage.setItem('google_refresh_token', data.refresh_token);
                                    }
                                    localStorage.setItem('google_token_expires_at', Date.now() + (data.expires_in * 1000));
                                    localStorage.setItem('google_user_info', JSON.stringify(data.user));
                                    
                                    // 觸發登入成功事件
                                    window.dispatchEvent(new CustomEvent('google-login-success', {
                                        detail: {
                                            user: data.user,
                                            access_token: data.access_token,
                                            refresh_token: data.refresh_token
                                        }
                                    }));
                                    
                                    // 重定向回測試頁面
                                    window.location.href = '/auth-test.html';
                                } else {
                                    console.error('OAuth 失敗:', data.message);
                                    window.location.href = '/?error=oauth_failed';
                                }
                            })
                            .catch(error => {
                                console.error('處理授權碼失敗:', error);
                                window.location.href = '/?error=auth_processing_failed';
                            });
                        </script>
                    </head>
                    <body>
                        <h2>正在處理 Google 授權...</h2>
                        <p>請稍候，系統正在完成登入流程。</p>
                    </body>
                    </html>
                `);
            }
        } else {
            // POST 請求
            code = req.body.code;
            state = req.body.state;
            redirect_uri = req.body.redirect_uri;
        }
        
        if (!code) {
            return res.status(400).json({
                success: false,
                error: 'missing_code',
                message: '缺少授權碼參數'
            });
        }
        
        // 交換授權碼獲取 tokens
        console.log('🔄 交換授權碼獲取 tokens...');
        // 交換授權碼獲取 access token 和 refresh token
        const tokenResponse = await exchangeCodeForTokens(code, redirect_uri);
        
        if (!tokenResponse.access_token) {
            throw new Error('無法獲取有效的 access token');
        }
        
        // 獲取使用者資訊
        console.log('👤 獲取使用者資訊...');
        const userInfo = await getUserInfo(tokenResponse.access_token);
        
        if (!userInfo.id) {
            throw new Error('無法獲取使用者資訊');
        }
        
        // 準備響應
        const response = {
            success: true,
            access_token: tokenResponse.access_token,
            refresh_token: tokenResponse.refresh_token,
            expires_in: tokenResponse.expires_in || 3600,
            token_type: tokenResponse.token_type || 'Bearer',
            user: {
                id: userInfo.id || userInfo.sub,
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture,
                locale: userInfo.locale,
                verified_email: userInfo.verified_email,
                family_name: userInfo.family_name,
                given_name: userInfo.given_name
            },
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ Google OAuth 處理成功');
        
        // 記錄成功日誌（不包含敏感資訊）
        console.log('📊 登入成功統計:', {
            userId: userInfo.id,
            email: userInfo.email ? userInfo.email.substring(0, 3) + '***' : undefined,
            timestamp: response.timestamp
        });
        
        return res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Google OAuth 處理失敗:', error);
        
        // 詳細錯誤處理
        const errorResponse = handleOAuthError(error);
        
        return res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.code,
            message: errorResponse.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 交換授權碼獲取 tokens
 */
async function exchangeCodeForTokens(code, redirectUri = null) {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const defaultRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000';
        
        if (!clientId || !clientSecret) {
            throw new Error('Google OAuth 配置不完整');
        }
        
        const tokenEndpoint = 'https://oauth2.googleapis.com/token';
        
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri || defaultRedirectUri,
            access_type: 'offline'  // 確保獲取 refresh token
        });
        
        console.log('🔗 調用 Google Token API...');
        
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params.toString()
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Google Token API 錯誤:', errorData);
            throw new Error(`Token 交換失敗: ${errorData.error_description || response.statusText}`);
        }
        
        const tokenData = await response.json();
        
        console.log('✅ Token 交換成功:', {
            hasAccessToken: !!tokenData.access_token,
            hasRefreshToken: !!tokenData.refresh_token,
            expiresIn: tokenData.expires_in
        });
        
        return tokenData;
        
    } catch (error) {
        console.error('❌ Token 交換失敗:', error);
        throw error;
    }
}

/**
 * 獲取使用者資訊
 */
async function getUserInfo(accessToken) {
    try {
        const userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';
        
        console.log('👤 調用 Google UserInfo API...');
        
        const response = await fetch(userInfoEndpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ Google UserInfo API 錯誤:', errorData);
            throw new Error(`獲取使用者資訊失敗: ${response.statusText}`);
        }
        
        const userInfo = await response.json();
        
        console.log('✅ 使用者資訊獲取成功:', {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email ? userInfo.email.substring(0, 3) + '***' : undefined
        });
        
        return userInfo;
        
    } catch (error) {
        console.error('❌ 獲取使用者資訊失敗:', error);
        throw error;
    }
}

/**
 * 設定 CORS 標頭
 */
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );
}

/**
 * 處理 OAuth 錯誤
 */
function handleOAuthError(error) {
    const message = error.message || '未知錯誤';
    
    // 根據錯誤類型返回適當的狀態碼和錯誤代碼
    if (message.includes('invalid_grant') || message.includes('authorization_code')) {
        return {
            status: 400,
            code: 'invalid_authorization_code',
            message: '無效的授權碼，可能已過期或已使用'
        };
    }
    
    if (message.includes('invalid_client')) {
        return {
            status: 401,
            code: 'invalid_client',
            message: 'Google OAuth 客戶端配置錯誤'
        };
    }
    
    if (message.includes('redirect_uri_mismatch')) {
        return {
            status: 400,
            code: 'redirect_uri_mismatch',
            message: '重定向 URI 不匹配'
        };
    }
    
    if (message.includes('access_denied')) {
        return {
            status: 403,
            code: 'access_denied',
            message: '使用者拒絕授權'
        };
    }
    
    if (message.includes('rate_limit')) {
        return {
            status: 429,
            code: 'rate_limit_exceeded',
            message: '請求頻率過高，請稍後重試'
        };
    }
    
    if (message.includes('network') || message.includes('fetch')) {
        return {
            status: 503,
            code: 'service_unavailable',
            message: 'Google 服務暫時不可用'
        };
    }
    
    // 預設錯誤
    return {
        status: 500,
        code: 'internal_server_error',
        message: '伺服器內部錯誤'
    };
}

/**
 * 驗證環境變數
 */
function validateEnvironmentVariables() {
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`缺少必要的環境變數: ${missing.join(', ')}`);
    }
}

// 在模組載入時驗證環境變數
if (typeof process !== 'undefined' && process.env) {
    try {
        validateEnvironmentVariables();
        console.log('✅ Google OAuth 環境變數驗證通過');
    } catch (error) {
        console.error('❌ Google OAuth 環境變數驗證失敗:', error.message);
    }
}
