/**
 * Skill Hub - Unified Authentication & API Client Library (auth.js)
 */

const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:5000"
    : "https://skill-hub-backend-4w35.onrender.com";

// ================= AUTH SESSION HELPERS =================
function getAuthToken() {
    return localStorage.getItem("token") || "";
}

function getAuthUser() {
    try {
        return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
        return {};
    }
}

function setAuthSession(token, user) {
    if (token) localStorage.setItem("token", token);
    if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("loggedIn", "true");
    }
}

function clearAuthSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("loggedIn");
}

function logout() {
    clearAuthSession();
    const isInsidePages = window.location.pathname.includes("/pages/");
    window.location.href = isInsidePages ? "../index.html" : "index.html";
}

// Route Guards
function requireAuth() {
    const token = getAuthToken();
    const user = getAuthUser();
    if (!token || !user || (!user.id && !user._id)) {
        clearAuthSession();
        const isInsidePages = window.location.pathname.includes("/pages/");
        window.location.href = isInsidePages ? "login.html" : "pages/login.html";
        return false;
    }
    return true;
}

function requireAdminAuth() {
    if (!requireAuth()) return false;
    const user = getAuthUser();
    if (user.role !== "admin") {
        const isInsidePages = window.location.pathname.includes("/pages/");
        window.location.href = isInsidePages ? "dashboard.html" : "pages/dashboard.html";
        return false;
    }
    return true;
}

// ================= AUTH FETCH WRAPPER =================
async function authFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

    const headers = options.headers ? { ...options.headers } : {};

    if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            // Token expired or invalid
            console.warn("Session expired. Redirecting to login.");
            clearAuthSession();
            const isInsidePages = window.location.pathname.includes("/pages/");
            window.location.href = isInsidePages ? "login.html" : "pages/login.html";
            return null;
        }
        return response;
    } catch (err) {
        console.error(`authFetch Network Error [${endpoint}]:`, err);
        throw err;
    }
}

// ================= GLOBAL TOAST HELPER =================
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "circle-info";
    let bgColor = "#2F4156";
    if (type === "success") { icon = "circle-check"; bgColor = "#22c55e"; }
    else if (type === "error") { icon = "circle-exclamation"; bgColor = "#ef4444"; }
    else if (type === "warning") { icon = "triangle-exclamation"; bgColor = "#f59e0b"; }

    toast.style.cssText = `
        background: ${bgColor};
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 13.5px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ================= SIDEBAR BADGES & ADMIN CHECK =================
async function updateSidebarBadges() {
    const token = getAuthToken();
    const user = getAuthUser();
    const userId = user.id || user._id;
    if (!token || !userId) return;

    // Messages Badge
    try {
        const msgRes = await authFetch(`/api/messages/conversations`);
        if (msgRes && msgRes.ok) {
            const conversations = await msgRes.json();
            const unreadMessages = Array.isArray(conversations)
                ? conversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0)
                : 0;

            document.querySelectorAll("#messageBadge, .message-badge, .sidebar-message-badge").forEach(badge => {
                badge.textContent = unreadMessages;
                badge.style.display = unreadMessages > 0 ? "inline-flex" : "none";
            });
        }
    } catch (err) {
        // Suppress non-critical badge polling error
    }

    // Notifications Badge
    try {
        const notifRes = await authFetch(`/api/notifications`);
        if (notifRes && notifRes.ok) {
            const notifs = await notifRes.json();
            const unreadNotifs = Array.isArray(notifs) ? notifs.filter(n => !n.read).length : 0;

            document.querySelectorAll("#notificationBadge, .notification-badge, .sidebar-notification-badge").forEach(badge => {
                badge.textContent = unreadNotifs;
                badge.style.display = unreadNotifs > 0 ? "inline-flex" : "none";
            });
        }
    } catch (err) {}

    // Requests Badge (Pending received join requests)
    try {
        const reqRes = await authFetch(`/api/requests?type=received`);
        if (reqRes && reqRes.ok) {
            const reqs = await reqRes.json();
            const pendingReqs = Array.isArray(reqs) ? reqs.filter(r => r.status === "pending").length : 0;

            document.querySelectorAll("#requestBadge, .request-badge, .sidebar-request-badge").forEach(badge => {
                badge.textContent = pendingReqs;
                badge.style.display = pendingReqs > 0 ? "inline-flex" : "none";
            });
        }
    } catch (err) {}
}

function checkAdminAccess() {
    const user = getAuthUser();
    const isAdmin = user.role === "admin" || user.isAdmin;
    const adminLink = document.getElementById("adminNavLink");
    if (adminLink) {
        adminLink.style.display = isAdmin ? "flex" : "none";
    }
}

// Auto init on DOM ready for authenticated pages
document.addEventListener("DOMContentLoaded", () => {
    const isPublicPage = window.location.pathname.endsWith("index.html") ||
        window.location.pathname.endsWith("/") ||
        window.location.pathname.endsWith("login.html") ||
        window.location.pathname.endsWith("register.html") ||
        window.location.pathname.endsWith("forgot-password.html");

    if (!isPublicPage) {
        checkAdminAccess();
        updateSidebarBadges();
        // Periodic badge updates every 8 seconds
        setInterval(updateSidebarBadges, 8000);
    }
});

