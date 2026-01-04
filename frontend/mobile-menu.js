document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  // ak na stránke niečo chýba, nič nerob
  if (!btn || !sidebar || !overlay) return;

  const isOpen = () => sidebar.classList.contains("open");

  const openMenu = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
    // zamkni scroll pozadia
    document.body.style.overflow = "hidden";
  };

  const closeMenu = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    // odomkni scroll
    document.body.style.overflow = "";
  };

  // toggle klikom na hamburger
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    isOpen() ? closeMenu() : openMenu();
  });

  // klik mimo (overlay) zatvorí menu
  overlay.addEventListener("click", closeMenu);

  // klik na link v menu zatvorí menu (lepší UX na mobile)
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  // ESC zatvorí menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) closeMenu();
  });

  // bezpečnostné: ak niekto otočí mobil / zväčší okno na desktop,
  // zavri menu a obnov scroll
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && isOpen()) closeMenu();
  });
});
