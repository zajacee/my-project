document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     HAMBURGER / SIDEBAR MENU
  ===================================================== */

  const hamburger = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  const isSidebarOpen = () => sidebar?.classList.contains("open");

  const openSidebar = () => {
    if (!sidebar || !overlay) return;

    sidebar.classList.add("open");
    overlay.classList.add("show");

    // zamkni scroll (mobile safe)
    document.body.style.overflow = "hidden";
  };

  const closeSidebar = () => {
    if (!sidebar || !overlay) return;

    sidebar.classList.remove("open");
    overlay.classList.remove("show");

    document.body.style.overflow = "";
  };

  if (hamburger && sidebar && overlay) {
    hamburger.addEventListener("click", (e) => {
      e.preventDefault();
      isSidebarOpen() ? closeSidebar() : openSidebar();
    });

    // klik na overlay zavrie menu
    overlay.addEventListener("click", closeSidebar);

    // klik na link v sidebari zavrie menu
    sidebar.addEventListener("click", (e) => {
      const link = e.target.closest("a, button");
      if (link) closeSidebar();
    });

    // ESC zavrie sidebar
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isSidebarOpen()) {
        closeSidebar();
      }
    });

    // pri resize späť na desktop zavri
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768 && isSidebarOpen()) {
        closeSidebar();
      }
    });
  }

  /* =====================================================
     LOGIN / USER DROPDOWN (Juro)
  ===================================================== */

  const userMenu = document.querySelector(".user-menu");
  const loginBtn = document.getElementById("login-button");
  const dropdown = document.getElementById("logout-dropdown");

  if (userMenu && loginBtn && dropdown) {

    const isDropdownOpen = () =>
      dropdown.classList.contains("show") || dropdown.style.display === "block";

    const openDropdown = () => {
      dropdown.classList.add("show");
      dropdown.style.display = "block";
      loginBtn.setAttribute("aria-expanded", "true");
    };

    const closeDropdown = () => {
      dropdown.classList.remove("show");
      dropdown.style.display = "none";
      loginBtn.setAttribute("aria-expanded", "false");

      // ✅ zruší „stále aktívny“ stav
      loginBtn.blur();
    };

    // toggle klikom na login button
    loginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      isDropdownOpen() ? closeDropdown() : openDropdown();
    });

    // klik mimo = zavri dropdown
    document.addEventListener("click", (e) => {
      if (!userMenu.contains(e.target)) {
        closeDropdown();
      }
    }, true);

    // ESC zavrie dropdown
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isDropdownOpen()) {
        closeDropdown();
      }
    });
  }

});
