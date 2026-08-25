const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'www');

// Clean or create www
if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

function copyRecursive(src, dest) {
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
            copyRecursive(path.join(src, child), path.join(dest, child));
        }
    } else {
        const destParent = path.dirname(dest);
        if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

// Items to copy into www
const itemsToCopy = [
    'index.html',
    'css',
    'js',
    'pages',
    'assets',
    'robots.txt',
    'sitemap.xml',
    'google579278a1a9ae3272.html'
];

itemsToCopy.forEach(item => {
    const srcPath = path.join(rootDir, item);
    if (fs.existsSync(srcPath)) {
        copyRecursive(srcPath, path.join(outDir, item));
        console.log(`[build-web] Copied ${item} -> www/${item}`);
    }
});

console.log('[build-web] Web assets successfully synchronized to www/');

