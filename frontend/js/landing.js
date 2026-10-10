document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector(".landing-nav");
    if (!header) return;

    const desktop = window.matchMedia("(min-width: 901px)");
    const syncScroll = () => header.classList.toggle("is-scrolled", desktop.matches && window.scrollY > 50);
    window.addEventListener("scroll", syncScroll, { passive: true });
    desktop.addEventListener("change", syncScroll);
    syncScroll();
});
