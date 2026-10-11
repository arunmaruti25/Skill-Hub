function isCapacitorNative() {
    try {
        const c = typeof window !== "undefined" && window.Capacitor;
        if (c) {
            if (typeof c.isNativePlatform === "function") return c.isNativePlatform();
            if (typeof c.getPlatform === "function") return c.getPlatform() !== "web";
            return Boolean(c.platform && c.platform !== "web");
        }
    } catch {}
    return false;
}

const isNativeApp = isCapacitorNative();
const isLocalBrowser = !isNativeApp && ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);
const API_BASE_URL = isLocalBrowser ? "http://127.0.0.1:5000" : "https://skill-hub-backend-4w35.onrender.com";

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
        if (window.SkillHubNav && typeof window.SkillHubNav.updateMobileAvatar === "function") {
            window.SkillHubNav.updateMobileAvatar();
        }
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

async function authFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const headers = { ...options.headers };

    if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
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

function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;";
        document.body.appendChild(container);
    }

    const toastThemes = {
        success: { icon: "circle-check", bg: "#22c55e" },
        error: { icon: "circle-exclamation", bg: "#ef4444" },
        warning: { icon: "triangle-exclamation", bg: "#f59e0b" },
        info: { icon: "circle-info", bg: "#2F4156" }
    };
    const { icon, bg } = toastThemes[type] || toastThemes.info;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `background:${bg};color:#ffffff;padding:12px 20px;border-radius:12px;font-size:13.5px;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;pointer-events:auto;opacity:0;transform:translateY(10px);transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);`;
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

const setBadge = (selector, count) => {
    document.querySelectorAll(selector).forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? "inline-flex" : "none";
    });
};

async function updateSidebarBadges() {
    const user = getAuthUser();
    if (!getAuthToken() || !(user.id || user._id)) return;

    try {
        const msgRes = await authFetch("/api/messages/conversations");
        if (msgRes?.ok) {
            const conversations = await msgRes.json();
            const unread = Array.isArray(conversations) ? conversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0) : 0;
            setBadge("#messageBadge, .message-badge, .sidebar-message-badge", unread);
        }
    } catch {}

    try {
        const notifRes = await authFetch("/api/notifications");
        if (notifRes?.ok) {
            const notifs = await notifRes.json();
            setBadge("#notificationBadge, .notification-badge, .sidebar-notification-badge", Array.isArray(notifs) ? notifs.filter(n => !n.read).length : 0);
        }
    } catch {}

    try {
        const reqRes = await authFetch("/api/requests?type=received");
        if (reqRes?.ok) {
            const reqs = await reqRes.json();
            setBadge("#requestBadge, .request-badge, .sidebar-request-badge", Array.isArray(reqs) ? reqs.filter(r => r.status === "pending").length : 0);
        }
    } catch {}
}

function checkAdminAccess() {
    const user = getAuthUser();
    const adminLink = document.getElementById("adminNavLink");
    if (adminLink) {
        adminLink.style.display = (user.role === "admin" || user.isAdmin) ? "flex" : "none";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const isPublicPage = /index\.html$|\/$|login\.html$|register\.html$|forgot-password\.html$/.test(window.location.pathname);
    if (!isPublicPage) {
        checkAdminAccess();
        updateSidebarBadges();
        if (window.SkillHubNav && typeof window.SkillHubNav.updateMobileAvatar === "function") {
            window.SkillHubNav.updateMobileAvatar();
        }
        setInterval(updateSidebarBadges, 8000);
    }
});
