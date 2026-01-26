let currentUser = null;
let allNotifications = [];
let currentlyVisible = 5;
const BATCH_SIZE = 5;

// nič s názvom API_BASE tu NEDEFINUJ
const API_BASE_URL = window.API_BASE || (
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : "https://api.dajtovon.sk"
);

const apiFetchUrl = window.api || ((path) => `${API_BASE_URL}${path}`);

if (!sessionStorage.getItem("api_warm")) {
  sessionStorage.setItem("api_warm", "1");
  fetch(apiFetchUrl("/health"), { cache: "no-store" }).catch(() => {});
}

function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return "pred chvíľou";
  if (diff < 3600) return `pred ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `pred ${Math.floor(diff / 3600)} hod`;
  return `pred ${Math.floor(diff / 86400)} dňami`;
}

function renderNotification(notification) {
  const list = document.getElementById("notification-list");
  const dot = document.getElementById("bell-dot");
  if (!list || !dot) return;

  if (!notification.read) dot.style.display = "block";

  const li = document.createElement("li");
  li.style.padding = "6px 0";
  li.style.borderBottom = "1px solid #eee";
  li.dataset.read = String(notification.read);

  if (!notification.read) li.style.backgroundColor = "#dbeeff";

  const username = `<span class="notification-username">${notification.from}</span>`;
  const title = `<strong>„${notification.contentTitle}“</strong>`;
  let text = "";

  if (notification.type === "like") {
    text = notification.targetType === "comment"
      ? `👍 ${username} reagoval na váš komentár k príspevku ${title}`
      : `👍 ${username} reagoval na váš príspevok ${title}`;
  } else if (notification.type === "dislike") {
    text = notification.targetType === "comment"
      ? `👎 ${username} reagoval na váš komentár k príspevku ${title}`
      : `👎 ${username} reagoval na váš príspevok ${title}`;
  } else if (notification.type === "comment") {
    text = `💬 ${username} komentoval váš príspevok ${title}`;
  }

  const a = document.createElement("a");
  a.href = `content-detail.html?contentId=${notification.contentId}`;
  a.innerHTML = `${text}<br><small style="color:#888;">${timeAgo(notification.timestamp)}</small>`;
  a.style.textDecoration = "none";
  a.style.color = "#333";
  a.style.display = "block";

  a.addEventListener("click", (e) => {
    e.preventDefault();

    fetch(apiFetchUrl(`/api/notifications/read/${notification._id}`), {
      method: "POST",
      credentials: "include",
    })
      .then(() => {
        notification.read = true;
        li.style.backgroundColor = "";
        li.dataset.read = "true";
        checkUnreadDot();
        window.location.href = a.href;
      })
      .catch(() => {
        window.location.href = a.href;
      });
  });

  li.appendChild(a);
  list.appendChild(li);
}

function renderNotificationList() {
  const list = document.getElementById("notification-list");
  const dot = document.getElementById("bell-dot");
  if (!list) return;

  list.innerHTML = "";

  // ✅ Keď nie sú notifikácie, zobraz prázdny stav
  if (!allNotifications || allNotifications.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.textContent = "Zatiaľ nemáte žiadne upozornenia.";
    emptyLi.style.textAlign = "center";
    emptyLi.style.padding = "12px 0";
    emptyLi.style.color = "#888";
    emptyLi.style.fontSize = "14px";
    list.appendChild(emptyLi);

    if (dot) dot.style.display = "none";
    return;
  }

  const notificationsToShow = allNotifications.slice(0, currentlyVisible);
  notificationsToShow.forEach(renderNotification);

  if (currentlyVisible < allNotifications.length) {
    const moreLi = document.createElement("li");
    moreLi.textContent = `Zobraziť staršie (${allNotifications.length - currentlyVisible})`;
    moreLi.style.textAlign = "center";
    moreLi.style.cursor = "pointer";
    moreLi.style.padding = "8px 0";
    moreLi.style.color = "#3498db";
    moreLi.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent popup from closing
      currentlyVisible += BATCH_SIZE;
      renderNotificationList();
    });
    list.appendChild(moreLi);
  }
}

function checkUnreadDot() {
  const items = document.querySelectorAll("#notification-list li");
  let hasUnread = false;

  items.forEach((item) => {
    const isNotification = item.dataset.read !== undefined;
    if (isNotification && item.dataset.read === "false") {
      hasUnread = true;
    }
  });

  const dot = document.getElementById("bell-dot");
  if (dot) dot.style.display = hasUnread ? "block" : "none";
}

window.initializeNotifications = function initializeNotifications() {
  const container = document.getElementById("notification-container");
  const popup = document.getElementById("notification-popup");
  const dot = document.getElementById("bell-dot");

  // ✅ default: skryť zvonček, kým nevieme či je user prihlásený
  if (container) container.style.display = "none";
  if (popup) popup.style.display = "none";
  if (dot) dot.style.display = "none";

  // ✅ Socket.IO na správnu URL (https -> wss automaticky)
  const socket = io(API_BASE_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    if (currentUser) socket.emit("register-username", currentUser);
  });

  socket.on("notification", (notification) => {
    if (!currentUser || notification.to !== currentUser) return;

    allNotifications.unshift(notification);
    currentlyVisible = BATCH_SIZE;
    renderNotificationList();
    checkUnreadDot();
  });

  const bell = document.getElementById("notification-bell");
  if (bell) {
    bell.addEventListener("click", () => {
      const popupEl = document.getElementById("notification-popup");
      const dotEl = document.getElementById("bell-dot");
      if (!popupEl) return;

      popupEl.style.display = popupEl.style.display === "block" ? "none" : "block";
      if (dotEl) dotEl.style.display = "none";

      // ✅ nech sa aj pri otvorení zobrazí prázdny stav
      renderNotificationList();
    });
  }

  document.addEventListener("click", (event) => {
    const bellEl = document.getElementById("notification-bell");
    const popupEl = document.getElementById("notification-popup");
    if (!bellEl || !popupEl) return;

    if (!bellEl.contains(event.target) && !popupEl.contains(event.target)) {
      popupEl.style.display = "none";
    }
  });

  fetch(apiFetchUrl("/api/me"), { method: "GET", credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (!data.username) {
        if (container) container.style.display = "none";
        return;
      }

      currentUser = data.username;

      // ✅ až teraz zobraz zvonček
      if (container) container.style.display = "block";
      socket.emit("register-username", currentUser);

      fetch(apiFetchUrl("/api/notifications?limit=100"), {
        method: "GET",
        credentials: "include",
      })
        .then((res) => res.json())
        .then((notifications) => {
          allNotifications = (notifications || []).sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          currentlyVisible = BATCH_SIZE;
          renderNotificationList();
          checkUnreadDot();
        })
        .catch(() => {
          // ak zlyhá načítanie notifikácií, ukáž prázdny stav
          allNotifications = [];
          currentlyVisible = BATCH_SIZE;
          renderNotificationList();
          if (dot) dot.style.display = "none";
        });
    })
    .catch(() => {
      // neprihlásený -> zvonček ostáva skrytý
      if (container) container.style.display = "none";
    });
};
