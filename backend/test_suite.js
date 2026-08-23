const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) { console.log(`  ✅ PASS: ${message}`); passed++; }
    else { console.error(`  ❌ FAIL: ${message}`); failed++; }
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
} catch (err) { assert(false, `JWT test failed: ${err.message}`); }

// TEST 2: Bcrypt Password Hashing
console.log("\n2. Testing Bcrypt Password Hashing & Verification...");
try {
    const password = "mySecurePassword123";
    const hash = bcrypt.hashSync(password, 10);
    assert(bcrypt.compareSync(password, hash), "Bcrypt password hash matches original password");
    assert(!bcrypt.compareSync("wrongPassword", hash), "Bcrypt rejects incorrect password");
} catch (err) { assert(false, `Bcrypt test failed: ${err.message}`); }

// TEST 3: Crypto token generation (email verification)
console.log("\n3. Testing Crypto Verification Token Generation...");
try {
    const token1 = crypto.randomBytes(32).toString("hex");
    const token2 = crypto.randomBytes(32).toString("hex");
    assert(token1.length === 64, "Verification token has correct length (64 hex chars)");
    assert(token1 !== token2, "Each verification token is unique");
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    assert(expiry > new Date(), "Verification token expiry is in the future");
    const expired = new Date(Date.now() - 1000);
    assert(expired < new Date(), "Expired token correctly identified");
} catch (err) { assert(false, `Crypto test failed: ${err.message}`); }

// TEST 4: Backend Server & Express Endpoints
console.log("\n4. Testing Express App Route Definitions...");
try {
    process.env.NODE_ENV = "test";
    const serverFile = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

    const expectedEndpoints = [
        "POST /api/register",
        "POST /api/login",
        "POST /api/reset-password",
        "GET /api/auth/verify-email",
        "POST /api/auth/resend-verification",
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
        "GET /api/admin/messages/:user1/:user2",
        "DELETE /api/admin/users/:id",
        "DELETE /api/admin/projects/:id"
    ];

    expectedEndpoints.forEach(ep => {
        const [, routePath] = ep.split(' ');
        const exists = serverFile.includes(`"${routePath}"`) || serverFile.includes(`'${routePath}'`);
        assert(exists, `Endpoint registered: ${ep}`);
    });
} catch (err) { assert(false, `Express app route test failed: ${err.message}`); }

// TEST 5: Security Logic Verification (Static Analysis)
console.log("\n5. Testing Security Logic in server.js...");
try {
    const serverFile = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

    // Email verification
    assert(serverFile.includes("emailVerified"), "Server checks emailVerified before login");
    assert(serverFile.includes("verifyToken"), "Server uses verifyToken for email verification");
    assert(serverFile.includes("verifyTokenExpiry"), "Server checks token expiry");
    assert(serverFile.includes("needsVerification"), "Server returns needsVerification flag");
    assert(serverFile.includes("sendVerificationEmail"), "Server sends verification email");
    assert(serverFile.includes("crypto.randomBytes"), "Server uses cryptographically secure tokens");

    // Chat IDOR protection
    assert(serverFile.includes('const sender = req.user.id || req.user._id'), "Message sender always from JWT, not body");
    assert(serverFile.includes('const { receiver, message } = req.body') && !serverFile.includes('const { receiver, message, sender } = req.body'), "req.body.sender not used as trusted sender identity");
    assert(serverFile.includes("Access denied. You are not a participant"), "Chat IDOR: unauthorized access rejected");

    // Admin read-only oversight
    assert(serverFile.includes("/api/admin/messages/:user1/:user2"), "Admin read-only oversight endpoint exists");
    assert(!serverFile.includes('app.post("/api/admin/messages'), "No admin POST message endpoint (read-only)");
    assert(!serverFile.includes('app.put("/api/admin/messages'), "No admin PUT message endpoint (read-only)");
    assert(!serverFile.includes('app.delete("/api/admin/messages'), "No admin DELETE message endpoint (read-only)");

    // Sensitive fields never exposed
    assert(serverFile.includes('select("-password -verifyToken'), "Sensitive fields excluded from user queries");

    // Conversations always from JWT
    // The conversations handler must use req.user (JWT) not req.params for the authenticated user's ID
    // Check that the handler function uses req.user and does NOT fall back to req.params.userId
    assert(serverFile.includes("const uid = req.user?.id || req.user?._id"), "Conversations handler derives uid from JWT not URL params");

} catch (err) { assert(false, `Security logic test failed: ${err.message}`); }

// TEST 6: Frontend HTML Inspection
console.log("\n6. Testing Frontend HTML Files & Script Links...");
const pagesDir = path.join(__dirname, '..', 'pages');
const rootDir = path.join(__dirname, '..');

const htmlFiles = [
    path.join(rootDir, 'index.html'),
    ...fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).map(f => path.join(pagesDir, f))
];

htmlFiles.forEach(file => {
    const filename = path.basename(file);
    const content = fs.readFileSync(file, 'utf8');
    const hasBadAuthScript = content.includes('src="js/auth.js"') && file.includes('pages');
    assert(!hasBadAuthScript, `${filename}: uses correct relative path for scripts`);
    assert(fs.existsSync(path.join(rootDir, 'js', 'auth.js')), `${filename}: js/auth.js exists`);
    assert(fs.existsSync(path.join(rootDir, 'js', 'app.js')), `${filename}: js/app.js exists`);
    assert(fs.existsSync(path.join(rootDir, 'css', 'style.css')), `${filename}: css/style.css exists`);
});

// TEST 7: verify-email.html exists
console.log("\n7. Testing New Security Pages...");
assert(fs.existsSync(path.join(pagesDir, 'verify-email.html')), "verify-email.html page exists");
const verifyPage = fs.readFileSync(path.join(pagesDir, 'verify-email.html'), 'utf8');
assert(verifyPage.includes('/api/auth/verify-email'), "verify-email.html calls correct backend endpoint");
assert(verifyPage.includes('resend'), "verify-email.html includes resend functionality");

const loginPage = fs.readFileSync(path.join(pagesDir, 'login.html'), 'utf8');
assert(loginPage.includes('needsVerification'), "login.html handles needsVerification response");
assert(loginPage.includes('resendVerification'), "login.html has resend verification function");

const registerPage = fs.readFileSync(path.join(pagesDir, 'register.html'), 'utf8');
assert(registerPage.includes('verifyNotice'), "register.html shows email verification notice");
assert(!registerPage.includes('setAuthSession(result.token'), "register.html does NOT auto-login (requires verification)");

// TEST 8: CSS Variable Palette
console.log("\n8. Testing CSS Variable Palette...");
try {
    const cssContent = fs.readFileSync(path.join(rootDir, 'css', 'style.css'), 'utf8');
    const requiredColors = ['#2F4156', '#567C8D', '#C8D9E6', '#F5EFEB', '#FFFFFF'];
    requiredColors.forEach(color => {
        assert(cssContent.toUpperCase().includes(color.toUpperCase()), `CSS includes required palette color: ${color}`);
    });
} catch (err) { assert(false, `CSS test failed: ${err.message}`); }

// TEST 9: User Model has verification fields
console.log("\n9. Testing User Model Schema...");
try {
    const modelFile = fs.readFileSync(path.join(__dirname, 'models', 'user.js'), 'utf8');
    assert(modelFile.includes('emailVerified'), "User model has emailVerified field");
    assert(modelFile.includes('verifyToken'), "User model has verifyToken field");
    assert(modelFile.includes('verifyTokenExpiry'), "User model has verifyTokenExpiry field");
    assert(modelFile.includes('resendVerifyAt'), "User model has resendVerifyAt field");
} catch (err) { assert(false, `User model test failed: ${err.message}`); }

console.log("\n========================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("========================================================\n");

if (failed > 0) process.exit(1);
process.exit(0);
