const fs = require('fs');
const indexContent = fs.readFileSync('C:\\Users\\Usuario\\OneDrive\\Documentos\\GitHub\\ivss\\index.html', 'utf8');
const lines = indexContent.split('\n');
console.log("=== SCRIPT TAGS IN index.html ===");
lines.forEach((line, idx) => {
    if (line.includes('<script') || line.includes('main.js') || line.includes('firebase-ops.js')) {
        console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
});
