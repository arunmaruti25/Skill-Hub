const fs = require('fs');
const path = require('path');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');
const { minify: minifyHtml } = require('html-minifier-terser');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'www');

// Clean or create www
if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

const cleanCss = new CleanCSS({ level: 1, compatibility: '*' });

async function processFile(src, dest) {
    const ext = path.extname(src).toLowerCase();
    const destParent = path.dirname(dest);
    if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });

    if (ext === '.css') {
        const content = fs.readFileSync(src, 'utf8');
        const minified = cleanCss.minify(content);
        fs.writeFileSync(dest, minified.styles || content, 'utf8');
        console.log(`[build-web] Minified CSS: ${path.relative(rootDir, src)} (${content.length} -> ${(minified.styles || content).length} bytes)`);
    } else if (ext === '.js') {
        const content = fs.readFileSync(src, 'utf8');
        try {
            const minified = await minifyJs(content, {
                compress: { dead_code: true, drop_debugger: true },
                mangle: false // Preserve top-level symbol names for inline HTML handlers
            });
            fs.writeFileSync(dest, minified.code || content, 'utf8');
            console.log(`[build-web] Minified JS: ${path.relative(rootDir, src)} (${content.length} -> ${(minified.code || content).length} bytes)`);
        } catch (e) {
            console.warn(`[build-web] Warning minifying JS ${src}, copying as-is: ${e.message}`);
            fs.copyFileSync(src, dest);
        }
    } else if (ext === '.html') {
        const content = fs.readFileSync(src, 'utf8');
        try {
            const minified = await minifyHtml(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true,
                removeRedundantAttributes: false,
                useShortDoctype: true
            });
            fs.writeFileSync(dest, minified, 'utf8');
            console.log(`[build-web] Minified HTML: ${path.relative(rootDir, src)} (${content.length} -> ${minified.length} bytes)`);
        } catch (e) {
            console.warn(`[build-web] Warning minifying HTML ${src}, copying as-is: ${e.message}`);
            fs.copyFileSync(src, dest);
        }
    } else {
        fs.copyFileSync(src, dest);
        console.log(`[build-web] Copied asset: ${path.relative(rootDir, src)}`);
    }
}

async function processDirectory(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
        const srcChild = path.join(src, child);
        const destChild = path.join(dest, child);
        const stats = fs.statSync(srcChild);
        if (stats.isDirectory()) {
            await processDirectory(srcChild, destChild);
        } else {
            await processFile(srcChild, destChild);
        }
    }
}

const itemsToProcess = [
    'index.html',
    'css',
    'js',
    'pages',
    'assets',
    'robots.txt',
    'sitemap.xml',
    'google579278a1a9ae3272.html'
];

async function main() {
    for (const item of itemsToProcess) {
        const srcPath = path.join(rootDir, item);
        const destPath = path.join(outDir, item);
        if (fs.existsSync(srcPath)) {
            const stats = fs.statSync(srcPath);
            if (stats.isDirectory()) {
                await processDirectory(srcPath, destPath);
            } else {
                await processFile(srcPath, destPath);
            }
        }
    }
    console.log('[build-web] Web assets successfully compressed & minified to www/');
}

main().catch(err => {
    console.error('[build-web] Build failed:', err);
    process.exit(1);
});
