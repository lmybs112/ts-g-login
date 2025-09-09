/**
 * Token 刷新處理 - Vercel Serverless Function
 * 
 * 功能：
 * - 使用 refresh_token 刷新 access_token
 * - 安全的 token 驗證
 * - 錯誤處理和重試邏輯
 * - CORS 支援
 * 
 * 端點：POST /api/auth/refresh
 * 
 * 請求格式：
 * {
 *   "refresh_token": "刷新令牌"
 * }
 * 
 * 響應格式：
 * {
 *   "success": true,
 *   "access_token": "新的訪問令牌",
 *   "expires_in": 3600,
 *   "token_type": "Bearer"
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
    
    // 只允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'method_not_allowed',
            message: '只允許 POST 請求'
        });
    }
    
    try {
        console.log('🔄 開始處理 token 刷新請求');
        
        // 驗證請求參數
        const { refresh_token } = req.body;
        
        if (!refresh_token) {
            return res.status(400).json({
                success: false,
                error: 'missing_refresh_token',
                message: '缺少 refresh_token 參數'
            });
        }
        
        // 驗證 refresh_token 格式
        if (!isValidRefreshToken(refresh_token)) {
            return res.status(400).json({
                success: false,
                error: 'invalid_refresh_token_format',
                message: 'refresh_token 格式無效'
            });
        }
        
        // 執行 token 刷新
        console.log('🔄 執行 token 刷新...');
        const tokenResponse = await refreshAccessToken(refresh_token);
        
        if (!tokenResponse.access_token) {
            throw new Error('無法獲取新的 access token');
        }
        
        // 準備響應
        const response = {
            success: true,
            access_token: tokenResponse.access_token,
            expires_in: tokenResponse.expires_in || 3600,
            token_type: tokenResponse.token_type || 'Bearer',
            scope: tokenResponse.scope,
            timestamp: new Date().toISOString()
        };
        
        // 如果有新的 refresh_token，也返回它
        if (tokenResponse.refresh_token) {
            response.refresh_token = tokenResponse.refresh_token;
        }
        
        console.log('✅ Token 刷新成功');
        
        // 記錄成功日誌
        console.log('📊 刷新成功統計:', {
            hasNewAccessToken: !!tokenResponse.access_token,
            hasNewRefreshToken: !!tokenResponse.refresh_token,
            expiresIn: tokenResponse.expires_in,
            timestamp: response.timestamp
        });
        
        return res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Token 刷新失敗:', error);
        
        // 詳細錯誤處理
        const errorResponse = handleRefreshError(error);
        
        return res.status(errorResponse.status).json({
            success: false,
            error: errorResponse.code,
            message: errorResponse.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 刷新 access token
 */
async function refreshAccessToken(refreshToken) {
    try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        
        if (!clientId || !clientSecret) {
            throw new Error('Google OAuth 配置不完整');
        }
        
        const tokenEndpoint = 'https://oauth2.googleapis.com/token';
        
        const params = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        });
        
        console.log('🔗 調用 Google Token 刷新 API...');
        
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
            console.error('❌ Google Token 刷新 API 錯誤:', errorData);
            
            // 特殊處理不同類型的錯誤
            if (errorData.error === 'invalid_grant') {
                throw new Error('INVALID_REFRESH_TOKEN');
            }
            
            throw new Error(`Token 刷新失敗: ${errorData.error_description || response.statusText}`);
        }
        
        const tokenData = await response.json();
        
        console.log('✅ Token 刷新 API 調用成功:', {
            hasAccessToken: !!tokenData.access_token,
            hasRefreshToken: !!tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            scope: tokenData.scope
        });
        
        return tokenData;
        
    } catch (error) {
        console.error('❌ Token 刷新執行失敗:', error);
        throw error;
    }
}

/**
 * 驗證 refresh_token 格式
 */
function isValidRefreshToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    
    // Google refresh_token 通常以 '1//' 開頭或者是較長的字串
    if (token.length < 20) {
        return false;
    }
    
    // 檢查是否包含有效字符
    const validChars = /^[a-zA-Z0-9\-_.\/]+$/;
    if (!validChars.test(token)) {
        return false;
    }
    
    return true;
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
 * 處理刷新錯誤
 */
function handleRefreshError(error) {
    const message = error.message || '未知錯誤';
    
    // 無效的 refresh_token
    if (message.includes('INVALID_REFRESH_TOKEN') || message.includes('invalid_grant')) {
        return {
            status: 401,
            code: 'invalid_refresh_token',
            message: 'refresh_token 無效或已過期，需要重新登入'
        };
    }
    
    // 無效的客戶端
    if (message.includes('invalid_client')) {
        return {
            status: 401,
            code: 'invalid_client',
            message: 'Google OAuth 客戶端配置錯誤'
        };
    }
    
    // 範圍錯誤
    if (message.includes('invalid_scope')) {
        return {
            status: 400,
            code: 'invalid_scope',
            message: '請求的權限範圍無效'
        };
    }
    
    // 速率限制
    if (message.includes('rate_limit') || message.includes('quota')) {
        return {
            status: 429,
            code: 'rate_limit_exceeded',
            message: '請求頻率過高，請稍後重試'
        };
    }
    
    // 網路錯誤
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
        return {
            status: 503,
            code: 'service_unavailable',
            message: 'Google 服務暫時不可用，請稍後重試'
        };
    }
    
    // 配置錯誤
    if (message.includes('配置不完整') || message.includes('環境變數')) {
        return {
            status: 500,
            code: 'configuration_error',
            message: '伺服器配置錯誤'
        };
    }
    
    // 預設錯誤
    return {
        status: 500,
        code: 'internal_server_error',
        message: '伺服器內部錯誤，請稍後重試'
    };
}

/**
 * 驗證 token 有效性（可選功能）
 */
async function validateAccessToken(accessToken) {
    try {
        const tokenInfoEndpoint = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`;
        
        const response = await fetch(tokenInfoEndpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            return { valid: false, error: 'Token validation failed' };
        }
        
        const tokenInfo = await response.json();
        
        return {
            valid: true,
            audience: tokenInfo.audience,
            scope: tokenInfo.scope,
            expiresIn: tokenInfo.expires_in,
            userId: tokenInfo.user_id
        };
        
    } catch (error) {
        console.error('❌ Token 驗證失敗:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * 取得 token 資訊（調試用）
 */
async function getTokenInfo(accessToken) {
    try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
        
        if (!response.ok) {
            throw new Error('無法獲取 token 資訊');
        }
        
        return await response.json();
        
    } catch (error) {
        console.error('❌ 獲取 token 資訊失敗:', error);
        return null;
    }
}

/**
 * 計算 token 過期時間
 */
function calculateTokenExpiry(expiresIn) {
    if (!expiresIn || isNaN(expiresIn)) {
        return null;
    }
    
    const now = new Date();
    const expiryTime = new Date(now.getTime() + (expiresIn * 1000));
    
    return {
        expiresAt: expiryTime.toISOString(),
        expiresAtTimestamp: expiryTime.getTime(),
        expiresInMinutes: Math.round(expiresIn / 60)
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
        console.log('✅ Token 刷新服務環境變數驗證通過');
    } catch (error) {
        console.error('❌ Token 刷新服務環境變數驗證失敗:', error.message);
    }
}
