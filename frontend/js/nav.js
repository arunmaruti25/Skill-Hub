





(function () {
    'use strict';

    const BREAKPOINT_DESKTOP = 1024;
    const STORAGE_KEY_COLLAPSED = 'skillhub_sidebar_collapsed';

    let historyStatePushed = false;
    let previousActiveElement = null;


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


        if (!historyStatePushed) {
            try {
                window.history.pushState({ drawerOpen: true }, '');
                historyStatePushed = true;
            } catch (e) {}
        }


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


    function initKeyboardAccessibility() {
        document.addEventListener('keydown', (e) => {
            if (!isDrawerOpen()) return;


            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                closeDrawer();
                return;
            }


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


    function initBackButton() {

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


        window.addEventListener('popstate', (e) => {
            if (isDrawerOpen()) {

                closeDrawer(false);
            }
        });
    }


    function initTouchGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let isTrackingDrawerSwipe = false;
        let isTrackingEdgeSwipe = false;


        document.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;

            if (isDrawerOpen()) {
                isTrackingDrawerSwipe = true;
            } else if (!isDesktop() && touchStartX <= 30) {

                isTrackingEdgeSwipe = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1) return;
            const touch = e.touches[0];
            const diffX = touch.clientX - touchStartX;
            const diffY = touch.clientY - touchStartY;


            if (isTrackingDrawerSwipe && diffX < -45 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
                isTrackingDrawerSwipe = false;
                closeDrawer();
                return;
            }


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


    function initNavigation() {
        const { menuBtn, closeBtn, backdrop, collapseBtn, navLinks } = getElements();


        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleDrawer();
            });
        }


        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeDrawer();
            });
        }


        if (backdrop) {
            backdrop.addEventListener('click', (e) => {
                e.preventDefault();
                closeDrawer();
            });
        }


        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleDesktopCollapse();
            });
        }


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
