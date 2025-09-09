/**
 * Token 驗證與使用者資訊獲取 - Vercel Serverless Function
 * 
 * 功能：
 * - 驗證 access_token 有效性
 * - 獲取最新的使用者資訊
 * - 檢查 token 權限範圍
 * - 安全的 token 處理
 * 
 * 端點：POST /api/auth/verify
 * 
 * 請求格式：
 * {
 *   "access_token": "訪問令牌"
 * }
 * 
 * 響應格式：
 * {
 *   "success": true,
 *   "valid": true,
 *   "user": {
 *     "id": "使用者ID",
 *     "name": "使用者姓名",
 *     "email": "使用者郵箱",
 *     "picture": "頭像URL"
 *   },
 *   "token_info": {
 *     "expires_in": 3600,
 *     "scope": "openid profile email"
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
            error: 'method_not_allowed',
            message: '只允許 GET 和 POST 請求'
        });
    }
    
    try {
        console.log('🔍 開始處理 token 驗證請求');
        
        // 從不同來源獲取 access_token
        let accessToken = null;
        
        if (req.method === 'POST') {
            accessToken = req.body?.access_token;
        } else if (req.method === 'GET') {
            // 從 Authorization header 或 query 參數獲取
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                accessToken = authHeader.substring(7);
            } else {
                accessToken = req.query.access_token;
            }
        }
        
        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'missing_access_token',
                message: '缺少 access_token 參數'
            });
        }
        
        // 驗證 access_token 格式
        if (!isValidAccessToken(accessToken)) {
            return res.status(400).json({
                success: false,
                error: 'invalid_access_token_format',
                message: 'access_token 格式無效'
            });
        }
        
        // 驗證 token 有效性
        console.log('🔐 驗證 token 有效性...');
        const tokenValidation = await validateAccessToken(accessToken);
        
        if (!tokenValidation.valid) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'invalid_token',
                message: tokenValidation.error || 'Token 無效或已過期',
                timestamp: new Date().toISOString()
            });
        }
        
        // 獲取使用者資訊
        console.log('👤 獲取使用者資訊...');
        const userInfo = await getUserInfo(accessToken);
        
        if (!userInfo) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'user_info_failed',
                message: '無法獲取使用者資訊',
                timestamp: new Date().toISOString()
            });
        }
        
        // 準備響應
        const response = {
            success: true,
            valid: true,
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
            token_info: {
                expires_in: tokenValidation.expiresIn,
                scope: tokenValidation.scope,
                audience: tokenValidation.audience,
                issued_at: tokenValidation.issuedAt
            },
            timestamp: new Date().toISOString()
        };
        
        console.log('✅ Token 驗證成功');
        
        // 記錄成功日誌（不包含敏感資訊）
        console.log('📊 驗證成功統計:', {
            userId: userInfo.id,
            email: userInfo.email ? userInfo.email.substring(0, 3) + '***' : undefined,
            scope: tokenValidation.scope,
            expiresIn: tokenValidation.expiresIn,
            timestamp: response.timestamp
        });
        
        return res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Token 驗證失敗:', error);
        
        // 詳細錯誤處理
        const errorResponse = handleVerifyError(error);
        
        return res.status(errorResponse.status).json({
            success: false,
            valid: false,
            error: errorResponse.code,
            message: errorResponse.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * 驗證 access token（支援 JWT）
 */
async function validateAccessToken(accessToken) {
    try {
        // 檢查是否為 Google Identity Token (JWT)
        if (accessToken.startsWith('gid_') || (accessToken.includes('.') && accessToken.split('.').length === 3)) {
            console.log('🔍 處理 Google Identity Token (JWT)...');
            return await validateJwtToken(accessToken);
        }
        
        // 處理傳統 access token
        console.log('🔗 調用 Google Token 驗證 API...');
        const tokenInfoEndpoint = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(accessToken)}`;
        
        const response = await fetch(tokenInfoEndpoint, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 400) {
                return { valid: false, error: 'Token 無效或格式錯誤' };
            }
            
            if (response.status === 401) {
                return { valid: false, error: 'Token 已過期' };
            }
            
            throw new Error(`Token 驗證 API 失敗: ${response.statusText}`);
        }
        
        const tokenInfo = await response.json();
        
        // 檢查 token 是否即將過期（少於 5 分鐘）
        const expiresIn = parseInt(tokenInfo.expires_in) || 0;
        const isExpiringSoon = expiresIn < 300; // 5 分鐘
        
        console.log('✅ Token 驗證 API 調用成功:', {
            audience: tokenInfo.audience,
            scope: tokenInfo.scope,
            expiresIn: expiresIn,
            isExpiringSoon: isExpiringSoon,
            userId: tokenInfo.user_id
        });
        
        return {
            valid: true,
            audience: tokenInfo.audience,
            scope: tokenInfo.scope,
            expiresIn: expiresIn,
            isExpiringSoon: isExpiringSoon,
            userId: tokenInfo.user_id,
            issuedAt: tokenInfo.issued_at,
            verifiedEmail: tokenInfo.verified_email
        };
        
    } catch (error) {
        console.error('❌ Token 驗證失敗:', error);
        return { valid: false, error: error.message };
    }
}

/**
 * 驗證 JWT Token
 */
async function validateJwtToken(jwtToken) {
    try {
        // 解析 JWT
        const parts = jwtToken.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid JWT format' };
        }
        
        // 解碼 payload
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        
        console.log('🔍 JWT Payload 解析成功:', {
            iss: payload.iss,
            aud: payload.aud,
            sub: payload.sub,
            exp: payload.exp,
            iat: payload.iat
        });
        
        // 驗證 issuer
        if (payload.iss !== 'https://accounts.google.com') {
            return { valid: false, error: 'Invalid issuer' };
        }
        
        // 驗證是否過期
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return { valid: false, error: 'Token expired' };
        }
        
        // 計算剩餘時間
        const expiresIn = payload.exp ? payload.exp - now : 0;
        const isExpiringSoon = expiresIn < 300; // 5 分鐘
        
        console.log('✅ JWT 驗證成功:', {
            userId: payload.sub,
            email: payload.email,
            expiresIn: expiresIn,
            isExpiringSoon: isExpiringSoon
        });
        
        return {
            valid: true,
            audience: payload.aud,
            scope: 'openid profile email', // JWT 通常包含這些範圍
            expiresIn: expiresIn,
            isExpiringSoon: isExpiringSoon,
            userId: payload.sub,
            issuedAt: payload.iat,
            verifiedEmail: payload.email_verified,
            tokenType: 'jwt'
        };
        
    } catch (error) {
        console.error('❌ JWT 驗證失敗:', error);
        return { valid: false, error: 'JWT validation failed: ' + error.message };
    }
}

/**
 * 獲取使用者資訊（支援 JWT）
 */
async function getUserInfo(accessToken) {
    try {
        // 如果是 JWT，直接從 payload 提取使用者資訊
        if (accessToken.startsWith('gid_') || (accessToken.includes('.') && accessToken.split('.').length === 3)) {
            console.log('👤 從 JWT 提取使用者資訊...');
            
            const parts = accessToken.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            
            const userInfo = {
                id: payload.sub,
                sub: payload.sub,
                name: payload.name,
                given_name: payload.given_name,
                family_name: payload.family_name,
                email: payload.email,
                email_verified: payload.email_verified,
                picture: payload.picture,
                locale: payload.locale
            };
            
            console.log('✅ JWT 使用者資訊提取成功:', {
                id: userInfo.id,
                name: userInfo.name,
                email: userInfo.email ? userInfo.email.substring(0, 3) + '***' : undefined,
                verified: userInfo.email_verified
            });
            
            return userInfo;
        }
        
        // 處理傳統 access token
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
            if (response.status === 401) {
                throw new Error('Token 無效，無法獲取使用者資訊');
            }
            
            throw new Error(`獲取使用者資訊失敗: ${response.statusText}`);
        }
        
        const userInfo = await response.json();
        
        console.log('✅ 使用者資訊獲取成功:', {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email ? userInfo.email.substring(0, 3) + '***' : undefined,
            verified: userInfo.verified_email
        });
        
        return userInfo;
        
    } catch (error) {
        console.error('❌ 獲取使用者資訊失敗:', error);
        throw error;
    }
}

/**
 * 驗證 access_token 格式（支援 JWT）
 */
function isValidAccessToken(token) {
    if (!token || typeof token !== 'string') {
        return false;
    }
    
    // 檢查是否為 Google Identity Token (JWT)
    if (token.startsWith('gid_') || token.includes('.')) {
        const parts = token.split('.');
        if (parts.length === 3) {
            // 這是 JWT 格式，暫時認為有效，後續會進一步驗證
            return true;
        }
    }
    
    // Google access_token 通常長度在 100-200 字符之間
    if (token.length < 50 || token.length > 2000) {  // 增加長度限制以支援 JWT
        return false;
    }
    
    // 檢查是否包含有效字符（Base64 URL-safe 字符）
    const validChars = /^[a-zA-Z0-9\-_.]+$/;
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
 * 處理驗證錯誤
 */
function handleVerifyError(error) {
    const message = error.message || '未知錯誤';
    
    // Token 無效
    if (message.includes('Token 無效') || message.includes('invalid_token')) {
        return {
            status: 401,
            code: 'invalid_token',
            message: 'Access token 無效'
        };
    }
    
    // Token 過期
    if (message.includes('過期') || message.includes('expired')) {
        return {
            status: 401,
            code: 'token_expired',
            message: 'Access token 已過期'
        };
    }
    
    // 權限不足
    if (message.includes('insufficient_scope') || message.includes('權限')) {
        return {
            status: 403,
            code: 'insufficient_scope',
            message: 'Token 權限不足'
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
    
    // 使用者資訊獲取失敗
    if (message.includes('使用者資訊')) {
        return {
            status: 401,
            code: 'user_info_failed',
            message: '無法獲取使用者資訊，token 可能無效'
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
 * 檢查 token 權限範圍
 */
function checkTokenScope(tokenInfo, requiredScopes = []) {
    if (!tokenInfo.scope || requiredScopes.length === 0) {
        return { valid: true, missing: [] };
    }
    
    const tokenScopes = tokenInfo.scope.split(' ');
    const missingScopes = requiredScopes.filter(scope => !tokenScopes.includes(scope));
    
    return {
        valid: missingScopes.length === 0,
        missing: missingScopes,
        available: tokenScopes
    };
}

/**
 * 獲取詳細的 token 資訊（調試用）
 */
async function getDetailedTokenInfo(accessToken) {
    try {
        // 獲取基本 token 資訊
        const tokenValidation = await validateAccessToken(accessToken);
        
        if (!tokenValidation.valid) {
            return { valid: false, error: tokenValidation.error };
        }
        
        // 獲取使用者資訊
        const userInfo = await getUserInfo(accessToken);
        
        return {
            valid: true,
            token: tokenValidation,
            user: userInfo,
            warnings: []
        };
        
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

console.log('📦 Token 驗證服務已載入');
