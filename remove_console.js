const fs = require('fs');

// 讀取文件
const content = fs.readFileSync('inf-google-login.js', 'utf8');

// 只移除 console.log 和 console.info，保留 console.error 和 console.warn
const cleanedContent = content.replace(
    /(\s*)console\.(log|info|debug)\([^;]*\);?/g, 
    '$1// console statement removed'
);

// 寫回文件
fs.writeFileSync('inf-google-login.js', cleanedContent, 'utf8');

console.log('Console statements have been removed successfully');
