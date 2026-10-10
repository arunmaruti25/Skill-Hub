document.addEventListener("DOMContentLoaded", () => {
    const shell = document.querySelector(".auth-shell");
    if (!shell) return;

    const setMode = (isSignUp, focusHeading = false) => {
        shell.classList.toggle("sign-up-mode", isSignUp);
        document.title = `${isSignUp ? "Register" : "Login"} - Skill Hub`;

        document.querySelectorAll("[data-auth-form], [data-auth-panel]").forEach(element => {
            const mode = element.dataset.authForm || element.dataset.authPanel;
            const active = mode === (isSignUp ? "register" : "login");
            element.hidden = !active;
            element.inert = !active;
            element.setAttribute("aria-hidden", String(!active));
        });

        if (focusHeading) {
            document.querySelector(`[data-auth-form="${isSignUp ? "register" : "login"}"] h1`)?.focus({ preventScroll: true });
        }
    };

    document.querySelectorAll("[data-auth-switch]").forEach(link => {
        link.addEventListener("click", event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            const isSignUp = link.dataset.authSwitch === "register";
            const nextUrl = new URL(link.href);
            if (nextUrl.pathname !== window.location.pathname) {
                history.pushState(null, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);
            }
            setMode(isSignUp, true);
        });
    });

    document.querySelectorAll(".auth-password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.getAttribute("aria-controls"));
            if (!input) return;
            const visible = input.type === "text";
            button.setAttribute("aria-pressed", String(visible));
            button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${button.dataset.passwordLabel}`);
        });
    });

    window.addEventListener("popstate", () => {
        setMode(/register\.html$/.test(window.location.pathname), true);
    });

    setMode(/register\.html$/.test(window.location.pathname));
});
