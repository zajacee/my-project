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
  const now = new Date();
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return "pred chvíľou";
  if (diff < 3600) return `pred ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `pred ${Math.floor(diff / 3600)} hod`;
  return `pred ${Math.floor(diff / 86400)} dňami`;
}

function renderNotification(notification) {
  const list = document.getElementById("notification-list");
  const dot = document.getElementById("bell-dot");

  if (!notification.read) dot.style.display = "block";

  const li = document.createElement("li");
  li.style.padding = "6px 0";
  li.style.borderBottom = "1px solid #eee";
  li.dataset.read = notification.read;

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
  list.innerHTML = "";

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

  document.getElementById("bell-dot").style.display = hasUnread ? "block" : "none";
}

window.initializeNotifications = function initializeNotifications() {
  // ✅ Socket.IO na správnu URL (https -> wss automaticky)
  const socket = io(API_BASE_URL, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    if (currentUser) {
      socket.emit("register-username", currentUser);
    }
  });

  socket.on("notification", (notification) => {
    if (!currentUser || notification.to !== currentUser) return;

    allNotifications.unshift(notification);
    currentlyVisible = BATCH_SIZE; // reset visible to show first batch
    renderNotificationList();
    checkUnreadDot();
  });

  document.getElementById("notification-bell").addEventListener("click", () => {
    const popup = document.getElementById("notification-popup");
    const dot = document.getElementById("bell-dot");
    popup.style.display = popup.style.display === "block" ? "none" : "block";
    dot.style.display = "none";
  });

  document.addEventListener("click", (event) => {
    const bell = document.getElementById("notification-bell");
    const popup = document.getElementById("notification-popup");
    if (!bell.contains(event.target) && !popup.contains(event.target)) {
      popup.style.display = "none";
    }
  });

  // ✅ už nie localhost
  fetch(apiFetchUrl("/api/me"), { method: "GET", credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (!data.username) return;
      currentUser = data.username;
      document.getElementById("notification-container").style.display = "block";
      socket.emit("register-username", currentUser);

      fetch(apiFetchUrl("/api/notifications?limit=100"), {
        method: "GET",
        credentials: "include",
      })
        .then((res) => res.json())
        .then((notifications) => {
          allNotifications = notifications.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          );
          currentlyVisible = BATCH_SIZE;
          renderNotificationList();
          checkUnreadDot();
        });
    })
    .catch(() => {
      // ak nie je prihlásený, notifikácie len nenačítame
    });
}
