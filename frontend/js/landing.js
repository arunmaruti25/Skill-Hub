document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".landing-nav");
    const menu = document.getElementById("landingMenu");
    const toggle = document.querySelector(".landing-menu-toggle");
    if (!header || !menu || !toggle) return;

    const mobile = window.matchMedia("(max-width: 900px)");
    let open = false;
    const syncMenu = () => {
        toggle.hidden = !mobile.matches;
        menu.hidden = mobile.matches && !open;
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        toggle.querySelector("i").className = open ? "fa-solid fa-xmark" : "fa-solid fa-bars";
        header.classList.toggle("menu-open", mobile.matches && open);
    };
    toggle.addEventListener("click", () => {
        open = !open;
        syncMenu();
    });
    menu.addEventListener("click", (event) => {
        if (!event.target.closest("a")) return;
        open = false;
        syncMenu();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !open) return;
        open = false;
        syncMenu();
        toggle.focus();
    });
    document.addEventListener("click", (event) => {
        if (!open || header.contains(event.target)) return;
        open = false;
        syncMenu();
    });
    mobile.addEventListener("change", () => {
        open = false;
        syncMenu();
    });
    const syncScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 50);
    window.addEventListener("scroll", syncScroll, { passive: true });
    syncMenu();
    syncScroll();
});
