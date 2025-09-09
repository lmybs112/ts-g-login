const fs = require('fs');
const path = require('path');

// 要處理的檔案列表
const filesToClean = [
    'inf-google-login.js',
    'auth-status-manager.js',
    'token-refresh-manager.js',
    'user-data-cookie-manager.js',
    'auth-integration-manager.js'
];

// 清理函數：只移除 console.log 和 console.info，保留 console.error 和 console.warn
function cleanConsoleFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 檔案不存在: ${filePath}`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 移除 console.log 和 console.info，保留錯誤和警告
    const cleanedContent = content.replace(
        /(\s*)console\.(log|info|debug)\([^;]*\);?/g, 
        '$1// console removed'
    );
    
    // 只有內容改變時才寫入
    if (cleanedContent !== content) {
        fs.writeFileSync(filePath, cleanedContent, 'utf8');
        console.log(`✅ 已清理: ${filePath}`);
        
        // 同時更新 public 目錄
        const publicPath = path.join('public', path.basename(filePath));
        if (fs.existsSync('public')) {
            fs.writeFileSync(publicPath, cleanedContent, 'utf8');
            console.log(`✅ 已更新 public: ${publicPath}`);
        }
    } else {
        console.log(`📝 無需清理: ${filePath}`);
    }
}

// 執行清理
console.log('🧹 開始清理非錯誤 console 訊息...\n');

filesToClean.forEach(fileName => {
    cleanConsoleFromFile(fileName);
});

console.log('\n✅ 清理完成！保留了 console.error 和 console.warn');
