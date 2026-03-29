const fs = require('fs');
const file = 'dist/index.html';
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('<base href="/InventExpert/" />')) {
  // Inject right after <head>
  content = content.replace('<head>', '<head><base href="/InventExpert/" />');
  fs.writeFileSync(file, content);
  console.log('Injected <base> tag into index.html');
}
