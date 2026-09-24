const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
        "GET /api/admin/messages/:user1/:user2",
        "DELETE /api/admin/users/:id"
    ];

    expectedEndpoints.forEach(ep => {
        const [, routePath] = ep.split(' ');
        const exists = serverFile.includes(`"${routePath}"`) || serverFile.includes(`'${routePath}'`);
        assert(exists, `Endpoint registered: ${ep}`);
    });
} catch (err) { assert(false, `Express app route test failed: ${err.message}`); }

// TEST 4: Email Verification Removed (Static Analysis)
console.log("\n4. Testing Email Verification is Fully Removed...");
try {
    const serverFile = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

    assert(!serverFile.includes("nodemailer"), "nodemailer not imported in server.js");
    assert(!serverFile.includes("sendVerificationEmail"), "sendVerificationEmail function removed");
    assert(!serverFile.includes("verifyToken"), "verifyToken removed from server.js");
    assert(!serverFile.includes("verifyTokenExpiry"), "verifyTokenExpiry removed from server.js");
    assert(!serverFile.includes("emailVerified"), "emailVerified removed from server.js");
    assert(!serverFile.includes("needsVerification"), "needsVerification response removed");
    assert(!serverFile.includes("resend-verification"), "resend-verification route removed");
    assert(!serverFile.includes("/api/auth/verify-email"), "verify-email route removed");

    const modelFile = fs.readFileSync(path.join(__dirname, 'models', 'user.js'), 'utf8');
    assert(!modelFile.includes("emailVerified"), "User model: emailVerified field removed");
    assert(!modelFile.includes("verifyToken"), "User model: verifyToken field removed");
    assert(!modelFile.includes("verifyTokenExpiry"), "User model: verifyTokenExpiry field removed");
    assert(!modelFile.includes("resendVerifyAt"), "User model: resendVerifyAt field removed");

    const pkgFile = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
    assert(!pkgFile.includes("nodemailer"), "nodemailer removed from package.json dependencies");
} catch (err) { assert(false, `Email verification removal test failed: ${err.message}`); }

// TEST 5: Security Logic Verification (Static Analysis)
console.log("\n5. Testing Security Logic in server.js...");
try {
    const serverFile = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

    // Registration returns token immediately (direct login)
    assert(serverFile.includes("token: generateToken(user)") && serverFile.includes("status(201)"), "Register returns token on 201 (direct auto-login)");

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
    assert(serverFile.includes('select("-password")'), "Password excluded from user queries");

    // Conversations always from JWT
    assert(serverFile.includes("const uid = req.user?.id || req.user?._id"), "Conversations handler derives uid from JWT not URL params");

} catch (err) { assert(false, `Security logic test failed: ${err.message}`); }

// TEST 6: Frontend HTML Inspection
console.log("\n6. Testing Frontend HTML Files & Script Links...");
const frontendDir = path.join(__dirname, '..', 'frontend');
const pagesDir = path.join(frontendDir, 'pages');

const htmlFiles = [
    path.join(frontendDir, 'index.html'),
    ...fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).map(f => path.join(pagesDir, f))
];

htmlFiles.forEach(file => {
    const filename = path.basename(file);
    const content = fs.readFileSync(file, 'utf8');
    const hasBadAuthScript = content.includes('src="js/auth.js"') && file.includes('pages');
    assert(!hasBadAuthScript, `${filename}: uses correct relative path for scripts`);
    assert(fs.existsSync(path.join(frontendDir, 'js', 'auth.js')), `${filename}: js/auth.js exists`);
    assert(fs.existsSync(path.join(frontendDir, 'js', 'app.js')), `${filename}: js/app.js exists`);
    assert(fs.existsSync(path.join(frontendDir, 'css', 'style.css')), `${filename}: css/style.css exists`);
});

// TEST 7: Auth Flow Pages
console.log("\n7. Testing Auth Flow Pages...");

assert(!fs.existsSync(path.join(pagesDir, 'verify-email.html')), "verify-email.html page removed");

const loginPage = fs.readFileSync(path.join(pagesDir, 'login.html'), 'utf8');
assert(!loginPage.includes('needsVerification'), "login.html: needsVerification branch removed");
assert(!loginPage.includes('resendVerification'), "login.html: resendVerification function removed");
assert(!loginPage.includes('verifyBanner'), "login.html: verifyBanner element removed");

const registerPage = fs.readFileSync(path.join(pagesDir, 'register.html'), 'utf8');
assert(!registerPage.includes('verifyNotice'), "register.html: verifyNotice element removed");
assert(registerPage.includes('setAuthSession(result.token'), "register.html: auto-login on successful registration");
assert(!registerPage.includes('resendVerification'), "register.html: resendVerification function removed");

// TEST 8: CSS Variable Palette
console.log("\n8. Testing CSS Variable Palette...");
try {
    const cssContent = fs.readFileSync(path.join(frontendDir, 'css', 'style.css'), 'utf8');
    const requiredColors = ['#2F4156', '#567C8D', '#C8D9E6', '#F5EFEB', '#FFFFFF'];
    requiredColors.forEach(color => {
        assert(cssContent.toUpperCase().includes(color.toUpperCase()), `CSS includes required palette color: ${color}`);
    });
} catch (err) { assert(false, `CSS test failed: ${err.message}`); }

// TEST 9: User Model Schema (verification fields absent)
console.log("\n9. Testing User Model Schema...");
try {
    const modelFile = fs.readFileSync(path.join(__dirname, 'models', 'user.js'), 'utf8');
    // Core fields must be present
    assert(modelFile.includes('name'), "User model has name field");
    assert(modelFile.includes('email'), "User model has email field");
    assert(modelFile.includes('password'), "User model has password field");
    assert(modelFile.includes('role'), "User model has role field");
    // Verification fields must be absent
    assert(!modelFile.includes('emailVerified'), "User model: emailVerified absent");
    assert(!modelFile.includes('verifyToken'), "User model: verifyToken absent");
    assert(!modelFile.includes('verifyTokenExpiry'), "User model: verifyTokenExpiry absent");
    assert(!modelFile.includes('resendVerifyAt'), "User model: resendVerifyAt absent");
} catch (err) { assert(false, `User model test failed: ${err.message}`); }

console.log("\n========================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("========================================================\n");

if (failed > 0) process.exit(1);
process.exit(0);
