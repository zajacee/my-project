document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     HAMBURGER / SIDEBAR
  ========================= */
  const btn = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (btn && sidebar && overlay) {
    const isOpen = () => sidebar.classList.contains("open");

    const openMenu = () => {
      sidebar.classList.add("open");
      overlay.classList.add("show");
      document.body.style.overflow = "hidden";
    };

    const closeMenu = () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
      document.body.style.overflow = "";
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      isOpen() ? closeMenu() : openMenu();
    });

    overlay.addEventListener("click", closeMenu);

    sidebar.addEventListener("click", (e) => {
      const hit = e.target.closest("a, button");
      if (hit) closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768 && isOpen()) closeMenu();
    });
  }

  /* =========================
     DROPDOWN: zruš "stále aktívne"
     - nerobí toggle (to už máš v svojom kóde)
     - len zatvorí pri kliku mimo + blur
  ========================= */
  const dropdown = document.getElementById("logout-dropdown");

  const closeDropdown = () => {
    if (!dropdown) return;
    dropdown.style.display = "none";
    const lb = document.getElementById("login-button");
    if (lb) lb.blur();
  };

  // klik mimo (aj na mobile je lepšie počúvať aj touchstart)
  const outsideHandler = (e) => {
    const lb = document.getElementById("login-button");
    if (!dropdown || !lb) return;

    const clickedInside =
      lb.contains(e.target) || dropdown.contains(e.target);

    if (!clickedInside) closeDropdown();
  };

  document.addEventListener("click", outsideHandler, true);
  document.addEventListener("touchstart", outsideHandler, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdown();
  });
});
