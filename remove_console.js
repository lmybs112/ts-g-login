const fs = require('fs');

// 讀取文件
const content = fs.readFileSync('inf-google-login.js', 'utf8');

// 將 console 語句替換為空語句，保持語法完整性
const cleanedContent = content.replace(
    /(\s*)console\.(log|error|warn|info|debug)\([^;]*\);?/g, 
    '$1// console statement removed'
);

// 寫回文件
fs.writeFileSync('inf-google-login.js', cleanedContent, 'utf8');

console.log('Console statements have been removed successfully');
