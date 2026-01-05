document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     HAMBURGER / SIDEBAR MENU
  ===================================================== */

  const btn = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  // ak na stránke niečo chýba, nič nerob
  const hasSidebarParts = !!(btn && sidebar && overlay);

  const isSidebarOpen = () => sidebar?.classList.contains("open");

  const openMenu = () => {
    if (!hasSidebarParts) return;
    sidebar.classList.add("open");
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  };

  const closeMenu = () => {
    if (!hasSidebarParts) return;
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  };

  if (hasSidebarParts) {
    // toggle klikom na hamburger
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      isSidebarOpen() ? closeMenu() : openMenu();
    });

    // klik mimo (overlay) zatvorí menu
    overlay.addEventListener("click", closeMenu);

    // klik na link / button v menu zatvorí menu
    sidebar.addEventListener("click", (e) => {
      const hit = e.target.closest("a, button");
      if (hit) closeMenu();
    });

    // ESC zatvorí menu
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isSidebarOpen()) closeMenu();
    });

    // ak otočí mobil / zväčší okno na desktop, zavri menu
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768 && isSidebarOpen()) closeMenu();
    });
  }

  /* =====================================================
     USER DROPDOWN (Juro) – zavrie klikom mimo + zruší active
     (bez rozbíjania tvojho pôvodného dropdown správania)
  ===================================================== */

  const userMenu = document.querySelector(".user-menu");
  const loginBtn = document.getElementById("login-button");
  const dropdown = document.getElementById("logout-dropdown");

  if (userMenu && loginBtn && dropdown) {

    const closeDropdown = () => {
      dropdown.classList.remove("show");
      dropdown.style.display = "none";
      loginBtn.blur(); // ✅ aby nezostal “aktívny”
    };

    // klik mimo user-menu zavrie dropdown
    document.addEventListener("click", (e) => {
      if (!userMenu.contains(e.target)) {
        closeDropdown();
      }
    }, true);

    // ESC zavrie dropdown
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDropdown();
      }
    });
  }

});
