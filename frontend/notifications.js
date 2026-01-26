let currentUser = null;
let allNotifications = [];
let currentlyVisible = 5;
const BATCH_SIZE = 5;

let emailNotifsEnabled = true; // ✅ stav toggle (default ON)

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

// ✅ vloží/prekreslí toggle priamo do popupu (nad listom)
function renderEmailToggle() {
  const popup = document.getElementById("notification-popup");
  if (!popup) return;

  let row = document.getElementById("email-toggle-row");

  if (!row) {
    row = document.createElement("div");
    row.id = "email-toggle-row";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "10px 10px";
    row.style.borderTop = "1px solid #eee";
    row.style.borderBottom = "1px solid #eee";
    row.style.background = "#fff";

    // ✅ aby klik na toggle nezatváral popup (ak by bol mimo wrapperu)
    row.addEventListener("click", (e) => e.stopPropagation());

    const left = document.createElement("div");
left.style.display = "flex";
left.style.flexDirection = "column";
left.style.width = "100%";
left.style.padding = "6px 0";
left.style.textAlign = "left";

const hint = document.createElement("span");
hint.textContent = "Posielať notifikácie e-mailom v režime offline";
hint.style.fontSize = "15px";
hint.style.color = "#666";

left.appendChild(hint);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";

    const status = document.createElement("span");
    status.id = "email-toggle-status";
    status.style.fontSize = "12px";
    status.style.color = "#666";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = "emailNotifsToggle";
    input.style.transform = "scale(1.1)";
    input.style.cursor = "pointer";

    input.addEventListener("change", () => {
      const enabled = input.checked;

      // optimisticky nastav UI
      const prev = emailNotifsEnabled;
      emailNotifsEnabled = enabled;
      updateEmailToggleStatus();

      fetch(apiFetchUrl("/api/settings/email-notifications"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("save_failed");
          return r.json();
        })
        .then((data) => {
          // backend je zdroj pravdy
          emailNotifsEnabled = data?.emailNotificationsEnabled !== false;
          input.checked = emailNotifsEnabled;
          updateEmailToggleStatus();
        })
        .catch(() => {
          // rollback
          emailNotifsEnabled = prev;
          input.checked = prev;
          updateEmailToggleStatus();
          alert("Nepodarilo sa uložiť nastavenie e-mail notifikácií.");
        });
    });

    right.appendChild(status);
    right.appendChild(input);

    row.appendChild(left);
    row.appendChild(right);

    // ✅ vlož pred zoznam (ak existuje), inak navrch popupu
    const list = document.getElementById("notification-list");
    if (list && list.parentElement === popup) {
      popup.insertBefore(row, list);
    } else {
      popup.insertBefore(row, popup.firstChild);
    }
  }

  const toggle = document.getElementById("emailNotifsToggle");
  if (toggle) toggle.checked = !!emailNotifsEnabled;

  updateEmailToggleStatus();
}

function updateEmailToggleStatus() {
  const status = document.getElementById("email-toggle-status");
  if (!status) return;
  status.textContent = emailNotifsEnabled ? "Zapnuté" : "Vypnuté";
}

// ✅ XSS-safe: žiadne innerHTML z dát (from/contentTitle/timestamp)
function renderNotification(notification) {
  const list = document.getElementById("notification-list");
  const dot = document.getElementById("bell-dot");
  if (!list || !dot) return;

  if (!notification.read) dot.style.display = "block";

  const li = document.createElement("li");
  li.style.padding = "4px 10px";
  li.style.borderBottom = "1px solid #eee";
  li.dataset.read = String(notification.read);

  if (!notification.read) li.style.backgroundColor = "#dbeeff";

  const fromText = String(notification.from || "Niekto");
  const titleText = String(notification.contentTitle || "");
  const timeText = timeAgo(notification.timestamp);

  let prefix = "🔔";
  let middleText = "";
  if (notification.type === "like") {
    prefix = "👍";
    middleText = notification.targetType === "comment"
      ? " reagoval na váš komentár k príspevku "
      : " reagoval na váš príspevok ";
  } else if (notification.type === "dislike") {
    prefix = "👎";
    middleText = notification.targetType === "comment"
      ? " reagoval na váš komentár k príspevku "
      : " reagoval na váš príspevok ";
  } else if (notification.type === "comment") {
    prefix = "💬";
    middleText = " komentoval váš príspevok ";
  } else {
    middleText = " aktivita pri príspevku ";
  }

  const a = document.createElement("a");
  a.href = `content-detail.html?contentId=${encodeURIComponent(notification.contentId || "")}`;
  a.style.textDecoration = "none";
  a.style.color = "#333";
  a.style.display = "block";

  const line = document.createElement("div");

  line.appendChild(document.createTextNode(prefix + " "));

  const usernameSpan = document.createElement("span");
  usernameSpan.className = "notification-username";
  usernameSpan.textContent = fromText;
  line.appendChild(usernameSpan);

  line.appendChild(document.createTextNode(middleText));

  const titleStrong = document.createElement("strong");
  titleStrong.textContent = `„${titleText}“`;
  line.appendChild(titleStrong);

const small = document.createElement("small");
small.style.color = "#888";
small.style.display = "block";
small.style.marginTop = "2px";
small.style.lineHeight = "1.1";
small.textContent = timeText;

a.appendChild(line);
a.appendChild(small);

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

  if (!allNotifications || allNotifications.length === 0) {
    const emptyLi = document.createElement("li");
    emptyLi.textContent = "Zatiaľ nemáte žiadne upozornenia";
    emptyLi.style.textAlign = "center";
    emptyLi.style.padding = "12px 10px";
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
    moreLi.style.padding = "10px 10px";
    moreLi.style.color = "#3498db";
    moreLi.addEventListener("click", (e) => {
      e.stopPropagation();
      currentlyVisible += BATCH_SIZE;
      renderNotificationList();
    });
    list.appendChild(moreLi);
  }
}

// ✅ lepšie: dot podľa dát, nie podľa DOM
function checkUnreadDot() {
  const dot = document.getElementById("bell-dot");
  if (!dot) return;

  const hasUnread = (allNotifications || []).some(n => n && n.read === false);
  dot.style.display = hasUnread ? "block" : "none";
}

window.initializeNotifications = function initializeNotifications() {
  const container = document.getElementById("notification-container");
  const popup = document.getElementById("notification-popup");
  const dot = document.getElementById("bell-dot");

  if (container) container.style.display = "none";
  if (popup) popup.style.display = "none";
  if (dot) dot.style.display = "none";

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

      renderEmailToggle();
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
        document.body.classList.remove("logged-in");
        if (container) container.style.display = "none";
        return;
      }

      currentUser = data.username;
      document.body.classList.add("logged-in");

      if (container) container.style.display = "block";
      socket.emit("register-username", currentUser);

      fetch(apiFetchUrl("/api/settings"), { method: "GET", credentials: "include" })
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((s) => {
          emailNotifsEnabled = s?.emailNotificationsEnabled !== false;
          renderEmailToggle();
        })
        .catch(() => {
          emailNotifsEnabled = true;
          renderEmailToggle();
        });

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

          renderEmailToggle();
          renderNotificationList();
          checkUnreadDot();
        })
        .catch(() => {
          allNotifications = [];
          currentlyVisible = BATCH_SIZE;
          renderEmailToggle();
          renderNotificationList();
          if (dot) dot.style.display = "none";
        });
    })
    .catch(() => {
      document.body.classList.remove("logged-in");
      if (container) container.style.display = "none";
    });
};
