/**
 * Skill Hub - Navigation & Responsive Drawer Controller (nav.js)
 * Handles desktop collapsible sidebar, mobile slide-in drawer, touch gestures,
 * accessibility (ARIA, focus trap), Capacitor/Android back button, and safe areas.
 */

(function () {
    'use strict';

    const BREAKPOINT_DESKTOP = 1024;
    const STORAGE_KEY_COLLAPSED = 'skillhub_sidebar_collapsed';

    let historyStatePushed = false;
    let previousActiveElement = null;

    // ================= DOM ELEMENTS =================
    function getElements() {
        return {
            body: document.body,
            sidebar: document.getElementById('sidebar'),
            backdrop: document.getElementById('sidebarBackdrop'),
            menuBtn: document.getElementById('mobileMenuBtn'),
            closeBtn: document.getElementById('drawerCloseBtn'),
            collapseBtn: document.getElementById('sidebarCollapseBtn'),
            mobileAvatar: document.getElementById('mobileUserAvatar'),
            navLinks: document.querySelectorAll('#sidebar nav a, #sidebar .sidebar-bottom a')
        };
    }

    // ================= DESKTOP COLLAPSE CONTROLLER =================
    function isDesktop() {
        return window.innerWidth >= BREAKPOINT_DESKTOP;
    }

    function initDesktopSidebar() {
        const { body, collapseBtn, sidebar } = getElements();
        if (!sidebar) return;

        if (isDesktop()) {
            sidebar.removeAttribute('aria-hidden');
            const isCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
            if (isCollapsed) {
                body.classList.add('sidebar-collapsed');
                if (collapseBtn) {
                    collapseBtn.setAttribute('aria-expanded', 'false');
                    collapseBtn.setAttribute('aria-label', 'Expand sidebar');
                    collapseBtn.setAttribute('title', 'Expand sidebar');
                }
            } else {
                body.classList.remove('sidebar-collapsed');
                if (collapseBtn) {
                    collapseBtn.setAttribute('aria-expanded', 'true');
                    collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
                    collapseBtn.setAttribute('title', 'Collapse sidebar');
                }
            }
        } else {
            // In mobile mode, remove desktop collapsed class
            body.classList.remove('sidebar-collapsed');
            if (!body.classList.contains('drawer-open')) {
                sidebar.setAttribute('aria-hidden', 'true');
            }
        }
    }

    function toggleDesktopCollapse() {
        const { body, collapseBtn } = getElements();
        if (!isDesktop()) return;

        const isCurrentlyCollapsed = body.classList.toggle('sidebar-collapsed');
        localStorage.setItem(STORAGE_KEY_COLLAPSED, isCurrentlyCollapsed ? 'true' : 'false');

        if (collapseBtn) {
            collapseBtn.setAttribute('aria-expanded', isCurrentlyCollapsed ? 'false' : 'true');
            const label = isCurrentlyCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
            collapseBtn.setAttribute('aria-label', label);
            collapseBtn.setAttribute('title', label);
        }
    }

    // ================= MOBILE DRAWER CONTROLLER =================
    function isDrawerOpen() {
        return document.body.classList.contains('drawer-open');
    }

    function openDrawer() {
        const { body, sidebar, backdrop, menuBtn, closeBtn } = getElements();
        if (!sidebar || isDesktop()) return;

        previousActiveElement = document.activeElement;
        body.classList.add('drawer-open');

        if (menuBtn) {
            menuBtn.setAttribute('aria-expanded', 'true');
        }
        sidebar.setAttribute('aria-hidden', 'false');
        if (backdrop) {
            backdrop.setAttribute('aria-hidden', 'false');
        }

        // Push state for Android hardware back button & mobile browser back
        if (!historyStatePushed) {
            try {
                window.history.pushState({ drawerOpen: true }, '');
                historyStatePushed = true;
            } catch (e) {}
        }

        // Focus trap initial focus
        requestAnimationFrame(() => {
            if (closeBtn && typeof closeBtn.focus === 'function') {
                closeBtn.focus();
            } else {
                const firstNav = sidebar.querySelector('nav a');
                if (firstNav) firstNav.focus();
            }
        });
    }

    function closeDrawer(popHistory = true) {
        const { body, sidebar, backdrop, menuBtn } = getElements();
        if (!sidebar || !isDrawerOpen()) return;

        body.classList.remove('drawer-open');

        if (menuBtn) {
            menuBtn.setAttribute('aria-expanded', 'false');
        }
        sidebar.setAttribute('aria-hidden', 'true');
        if (backdrop) {
            backdrop.setAttribute('aria-hidden', 'true');
        }

        // Handle history state clean up
        if (popHistory && historyStatePushed) {
            historyStatePushed = false;
            try {
                if (window.history.state && window.history.state.drawerOpen) {
                    window.history.back();
                }
            } catch (e) {}
        } else {
            historyStatePushed = false;
        }

        // Restore focus
        if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
            previousActiveElement.focus();
            previousActiveElement = null;
        } else if (menuBtn) {
            menuBtn.focus();
        }
    }

    function toggleDrawer() {
        if (isDrawerOpen()) {
            closeDrawer();
        } else {
            openDrawer();
        }
    }

    // ================= KEYBOARD & ACCESSIBILITY =================
    function initKeyboardAccessibility() {
        document.addEventListener('keydown', (e) => {
            if (!isDrawerOpen()) return;

            // Close on Escape key
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                closeDrawer();
                return;
            }

            // Focus trap inside drawer
            if (e.key === 'Tab') {
                const { sidebar } = getElements();
                if (!sidebar) return;

                const focusable = sidebar.querySelectorAll(
                    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;

                const firstEl = focusable[0];
                const lastEl = focusable[focusable.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            }
        });
    }

    // ================= CAPACITOR & WEBVIEW BACK BUTTON =================
    function initBackButton() {
        // 1. Capacitor native app listener (if @capacitor/app is available)
        try {
            const cap = window.Capacitor;
            if (cap && cap.Plugins && cap.Plugins.App && typeof cap.Plugins.App.addListener === 'function') {
                cap.Plugins.App.addListener('backButton', ({ canGoBack }) => {
                    if (isDrawerOpen()) {
                        closeDrawer(false);
                    } else if (canGoBack) {
                        window.history.back();
                    } else if (typeof cap.Plugins.App.exitApp === 'function') {
                        cap.Plugins.App.exitApp();
                    }
                });
            }
        } catch (err) {
            console.warn('Capacitor backButton setup note:', err);
        }

        // 2. Browser history / popstate listener (works inside WebView & mobile browsers)
        window.addEventListener('popstate', (e) => {
            if (isDrawerOpen()) {
                // Drawer was closed via browser/hardware back
                closeDrawer(false);
            }
        });
    }

    // ================= TOUCH GESTURES (SWIPE) =================
    function initTouchGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let isTrackingDrawerSwipe = false;
        let isTrackingEdgeSwipe = false;

        // 1. Swipe Left to Close (on open drawer or backdrop)
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;

            if (isDrawerOpen()) {
                isTrackingDrawerSwipe = true;
            } else if (!isDesktop() && touchStartX <= 30) {
                // 2. Edge Swipe to Open (within 30px of left screen edge)
                isTrackingEdgeSwipe = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            const diffX = touch.clientX - touchStartX;
            const diffY = touch.clientY - touchStartY;

            // Swipe to close: user swipes left inside the open drawer
            if (isTrackingDrawerSwipe && diffX < -45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                isTrackingDrawerSwipe = false;
                closeDrawer();
                return;
            }

            // Edge swipe to open: user swipes right from left edge
            if (isTrackingEdgeSwipe && diffX > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                isTrackingEdgeSwipe = false;
                openDrawer();
                return;
            }
        }, { passive: true });

        document.addEventListener('touchend', () => {
            isTrackingDrawerSwipe = false;
            isTrackingEdgeSwipe = false;
        }, { passive: true });

        document.addEventListener('touchcancel', () => {
            isTrackingDrawerSwipe = false;
            isTrackingEdgeSwipe = false;
        }, { passive: true });
    }

    // ================= MOBILE AVATAR POPULATION =================
    function updateMobileAvatar() {
        const avatarEl = document.getElementById('mobileUserAvatar');
        if (!avatarEl) return;

        let user = {};
        try {
            if (typeof window.getAuthUser === 'function') {
                user = window.getAuthUser();
            } else {
                user = JSON.parse(localStorage.getItem('user') || '{}');
            }
        } catch (e) {
            user = {};
        }

        const displayName = user.name || 'User';
        const initial = displayName.charAt(0).toUpperCase();

        if (user.profileImage) {
            const apiBase = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
            const src = user.profileImage.startsWith('http') ? user.profileImage : apiBase + user.profileImage;
            avatarEl.innerHTML = `<img src="${src}" alt="${displayName}">`;
        } else {
            avatarEl.textContent = initial;
        }
        avatarEl.setAttribute('title', displayName);
    }

    // ================= MAIN INITIALIZATION =================
    function initNavigation() {
        const { menuBtn, closeBtn, backdrop, collapseBtn, navLinks } = getElements();

        // Mobile menu hamburger toggle
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleDrawer();
            });
        }

        // Mobile drawer close button
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeDrawer();
            });
        }

        // Tap backdrop to close
        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                e.preventDefault();
                closeDrawer();
            });
        }

        // Desktop collapse toggle button
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleDesktopCollapse();
            });
        }

        // Automatically close drawer when any nav link is tapped on mobile
        if (navLinks && navLinks.length > 0) {
            navLinks.forEach((link) => {
                link.addEventListener('click', () => {
                    if (!isDesktop() && isDrawerOpen()) {
                        closeDrawer(false);
                    }
                });
            });
        }

        initDesktopSidebar();
        initKeyboardAccessibility();
        initBackButton();
        initTouchGestures();
        updateMobileAvatar();

        // Handle viewport resize across 1024px boundary
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                initDesktopSidebar();
                if (isDesktop() && isDrawerOpen()) {
                    closeDrawer(false);
                }
            }, 100);
        });
    }

    // Expose helpers globally
    window.SkillHubNav = {
        init: initNavigation,
        openDrawer: openDrawer,
        closeDrawer: closeDrawer,
        toggleDrawer: toggleDrawer,
        toggleCollapse: toggleDesktopCollapse,
        updateMobileAvatar: updateMobileAvatar
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigation);
    } else {
        initNavigation();
    }
})();
