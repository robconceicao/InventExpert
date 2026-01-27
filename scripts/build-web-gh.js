const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const publicUrl = process.env.PUBLIC_URL;
const basePath = process.env.BASE_PATH;

const resolveBasePath = () => {
  if (basePath) {
    return basePath;
  }
  if (!publicUrl) {
    return '';
  }
  try {
    const url = new URL(publicUrl);
    return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  } catch {
    return '';
  }
};

const resolvedBasePath = resolveBasePath();

const exportResult = spawnSync(
  'npx',
  [
    'expo',
    'export',
    '--platform',
    'web',
    '--output-dir',
    'docs',
  ],
  { stdio: 'inherit', shell: true }
);

if (exportResult.status !== 0) {
  process.exit(exportResult.status ?? 1);
}

const docsDir = path.resolve(__dirname, '..', 'docs');
const indexPath = path.join(docsDir, 'index.html');
const notFoundPath = path.join(docsDir, '404.html');
const noJekyllPath = path.join(docsDir, '.nojekyll');
const collectHtmlFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  });
  return files;
};

const htmlFiles = collectHtmlFiles(docsDir);

const replaceInHtml = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content
    .replace(/href="\/favicon\.ico"/g, 'href="./favicon.ico"')
    .replace(/src="\/_expo\//g, 'src="./_expo/')
    .replace(/href="\/_expo\//g, 'href="./_expo/');
  if (updated !== content) {
    fs.writeFileSync(filePath, updated);
  }
};

htmlFiles.forEach(replaceInHtml);

if (fs.existsSync(indexPath)) {
  fs.copyFileSync(indexPath, notFoundPath);
  replaceInHtml(notFoundPath);
  console.log('404.html gerado a partir de index.html');
}

fs.writeFileSync(noJekyllPath, '');
