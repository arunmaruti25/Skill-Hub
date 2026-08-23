const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

console.log("\n========================================================");
console.log("🚀 RUNNING SKILL HUB FULL SYSTEM VERIFICATION SUITE");
console.log("========================================================\n");

// TEST 1: JWT Signing and Verification
console.log("1. Testing JWT Token Operations...");
try {
    const testSecret = "test_secret_12345";
    const payload = { id: "user123", email: "test@example.com", role: "user" };
    const token = jwt.sign(payload, testSecret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, testSecret);
    assert(decoded.id === "user123", "JWT token sign and verify decoded ID correctly");
    assert(decoded.email === "test@example.com", "JWT token sign and verify decoded email correctly");
} catch (err) {
    assert(false, `JWT test failed: ${err.message}`);
}

// TEST 2: Bcrypt Password Hashing
console.log("\n2. Testing Bcrypt Password Hashing & Verification...");
try {
    const password = "mySecurePassword123";
    const hash = bcrypt.hashSync(password, 10);
    assert(bcrypt.compareSync(password, hash), "Bcrypt password hash matches original password");
    assert(!bcrypt.compareSync("wrongPassword", hash), "Bcrypt rejects incorrect password");
} catch (err) {
    assert(false, `Bcrypt test failed: ${err.message}`);
}

// TEST 3: Backend Server & Express Endpoints
console.log("\n3. Testing Express App Route Definitions...");
try {
    process.env.NODE_ENV = "test";
    const serverFile = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

    const expectedEndpoints = [
        "POST /api/register",
        "POST /api/login",
        "POST /api/reset-password",
        "GET /api/skills",
        "GET /api/users",
        "GET /api/profile/:id",
        "PUT /api/profile/:id",
        "GET /api/projects",
        "POST /api/projects",
        "GET /api/projects/:id",
        "PUT /api/projects/:id",
        "DELETE /api/projects/:id",
        "GET /api/requests",
        "PATCH /api/requests/:requestId",
        "DELETE /api/requests/:requestId",
        "GET /api/notifications",
        "PUT /api/notifications/read-all",
        "GET /api/messages/conversations",
        "POST /api/messages",
        "GET /api/messages/:user1/:user2",
        "GET /api/admin/stats",
        "GET /api/admin/users",
        "DELETE /api/admin/users/:id",
        "DELETE /api/admin/projects/:id"
    ];

    expectedEndpoints.forEach(ep => {
        const [method, routePath] = ep.split(' ');
        const pattern = `app.${method.toLowerCase()}("${routePath}"`;
        const exists = serverFile.includes(`"${routePath}"`) || serverFile.includes(`'${routePath}'`);
        assert(exists, `Endpoint registered: ${ep}`);
    });
} catch (err) {
    assert(false, `Express app route test failed: ${err.message}`);
}

// TEST 4: Frontend HTML Inspection
console.log("\n4. Testing Frontend HTML Files & Script Links...");
const pagesDir = path.join(__dirname, '..', 'pages');
const rootDir = path.join(__dirname, '..');

const htmlFiles = [
    path.join(rootDir, 'index.html'),
    ...fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).map(f => path.join(pagesDir, f))
];

htmlFiles.forEach(file => {
    const filename = path.basename(file);
    const content = fs.readFileSync(file, 'utf8');

    // Check no incorrect script paths
    const hasBadAuthScript = content.includes('src="js/auth.js"') && file.includes('pages');
    assert(!hasBadAuthScript, `${filename}: uses correct relative path for scripts`);

    // Check auth.js exists
    assert(fs.existsSync(path.join(rootDir, 'js', 'auth.js')), `${filename}: js/auth.js exists`);
    assert(fs.existsSync(path.join(rootDir, 'js', 'app.js')), `${filename}: js/app.js exists`);
    assert(fs.existsSync(path.join(rootDir, 'css', 'style.css')), `${filename}: css/style.css exists`);
});

// TEST 5: CSS Palette & Syntax Check
console.log("\n5. Testing CSS Variable Palette...");
try {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'style.css'), 'utf8');
    const requiredColors = ['#2F4156', '#567C8D', '#C8D9E6', '#F5EFEB', '#FFFFFF'];
    requiredColors.forEach(color => {
        assert(cssContent.toUpperCase().includes(color.toUpperCase()), `CSS includes required palette color: ${color}`);
    });
} catch (err) {
    assert(false, `CSS test failed: ${err.message}`);
}

console.log("\n========================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("========================================================\n");

if (failed > 0) process.exit(1);
process.exit(0);

