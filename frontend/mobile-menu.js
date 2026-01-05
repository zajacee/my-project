document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     HAMBURGER / SIDEBAR
  ========================= */
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (hamburger && sidebar && overlay) {
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

    hamburger.addEventListener("click", (e) => {
      e.preventDefault();
      isOpen() ? closeMenu() : openMenu();
    });

    overlay.addEventListener("click", closeMenu);

    sidebar.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) closeMenu();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768 && isOpen()) closeMenu();
    });
  }

  /* =========================
     DROPDOWN – ZAVRIE SA KLIKOM MIMO
  ========================= */
  const userMenu = document.querySelector(".user-menu");
  const loginBtn = document.getElementById("login-button");
  const dropdown = document.getElementById("logout-dropdown");

  if (userMenu && loginBtn && dropdown) {

    const closeDropdown = () => {
      dropdown.style.display = "none";
      dropdown.classList.remove("show");
      loginBtn.blur();
    };

    document.addEventListener("click", (e) => {
      if (!userMenu.contains(e.target)) {
        closeDropdown();
      }
    }, true);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });
  }
});
