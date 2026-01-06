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

    document.addEventListener(
      "click",
      (e) => {
        if (!userMenu.contains(e.target)) {
          closeDropdown();
        }
      },
      true
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown();
    });
  }

  /* =========================
     MOBILE: THUMBNAIL KLIKATEĽNÝ (GLOBÁLNE)
  ========================= */
  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  function getDetailHrefFromCard(card) {
    // 1) preferuj existujúci link z názvu
    const titleLink = card.querySelector('a[href*="content-detail.html?contentId="]');
    if (titleLink) return titleLink.getAttribute("href");

    // 2) fallback: "Čítať viac" s data-id
    const readMore = card.querySelector(".read-more[data-id]");
    if (readMore) {
      const id = readMore.getAttribute("data-id");
      return `content-detail.html?contentId=${encodeURIComponent(id)}`;
    }

    return null;
  }

  function makeMobileThumbClickable(scope = document) {
    if (!isMobile()) return;

    scope.querySelectorAll(".content-item").forEach((card) => {
      const thumbWrap = card.querySelector(".content-thumbnail");
      const img = thumbWrap?.querySelector("img.thumbnail");
      if (!thumbWrap || !img) return;

      // už je zabalené
      if (thumbWrap.querySelector("a.thumbnail-link")) return;

      const href = getDetailHrefFromCard(card);
      if (!href) return;

      const a = document.createElement("a");
      a.className = "thumbnail-link";
      a.href = href;
      a.setAttribute("aria-label", "Otvoriť príspevok");

      img.replaceWith(a);
      a.appendChild(img);
    });
  }

  // hneď po načítaní
  makeMobileThumbClickable(document);

  // dynamické dopĺňanie obsahu (load more, filter, fetch render...)
  const observer = new MutationObserver((mutations) => {
    if (!isMobile()) return;

    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches?.(".content-item")) {
          makeMobileThumbClickable(node.parentNode || document);
        } else if (node.querySelector?.(".content-item")) {
          makeMobileThumbClickable(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // otočenie / zmena šírky
  window.addEventListener("resize", () => makeMobileThumbClickable(document));
});
