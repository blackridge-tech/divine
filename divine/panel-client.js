// divine/panel-client.js
// Connects the static Divine site to the Divine Admin Panel server.
// - Fetches /api/state on load (lockdown + active broadcast)
// - Subscribes to WebSocket events for real-time broadcast + lockdown
// - Shows broadcast modal ONCE per broadcast id (tracked in localStorage)
// - Enforces lockdown by redirecting any /divine/* page to /lockdown

(function () {
  const PANEL_HOST = "https://dv-panel-app.sirco.online";
  const STATE_URL = PANEL_HOST + "/api/state";
  const WS_URL = PANEL_HOST.replace(/^http/, "ws") + "/ws";

  const DISMISSED_KEY = "divine.broadcast.dismissed"; // JSON map { [broadcastId]: dismissedAtMs }
  const LAST_SHOWN_KEY = "divine.broadcast.lastShown"; // fallback

  function isDivinePath() {
    // enforce for /divine folder pages only
    return location.pathname === "/divine" || location.pathname.startsWith("/divine/");
  }

  function readDismissed() {
    try {
      return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeDismissed(obj) {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(obj));
    } catch (e) {
      // ignore
    }
  }

  function markDismissed(id) {
    const d = readDismissed();
    d[String(id)] = Date.now();
    writeDismissed(d);
  }

  function alreadyDismissed(id) {
    const d = readDismissed();
    return Boolean(d && d[String(id)]);
  }

  function redirectToLockdown() {
    if (location.pathname === "/lockdown" || location.pathname.startsWith("/lockdown/")) return;
    // keep it simple
    location.replace("/lockdown");
  }

  function ensureLockdown(lockdown) {
    if (!isDivinePath()) return;
    if (lockdown && lockdown.enabled) redirectToLockdown();
  }

  function createBroadcastModal(message, id) {
    // If already exists, update text
    const existing = document.getElementById("__divine_broadcast_overlay");
    if (existing) {
      const text = existing.querySelector("[data-broadcast-text]");
      if (text) text.textContent = message;
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "__divine_broadcast_overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.68)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "99999";
    overlay.style.padding = "18px";

    const modal = document.createElement("div");
    modal.style.width = "560px";
    modal.style.maxWidth = "96%";
    modal.style.background = "linear-gradient(135deg, rgba(227,180,58,0.20) 12%, rgba(163,75,255,0.20) 55%, rgba(109,43,214,0.20) 100%)";
    modal.style.border = "1px solid rgba(255,255,255,0.12)";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 18px 50px rgba(3,9,18,0.7)";
    modal.style.padding = "18px 18px 16px";
    modal.style.color = "#FFD700";
    modal.style.position = "relative";
    modal.style.backdropFilter = "blur(6px)";

    const title = document.createElement("div");
    title.textContent = "Broadcast Message";
    title.style.fontWeight = "900";
    title.style.fontSize = "18px";
    title.style.textAlign = "center";
    title.style.marginBottom = "10px";
    title.style.letterSpacing = "0.3px";

    const text = document.createElement("div");
    text.setAttribute("data-broadcast-text", "1");
    text.textContent = message;
    text.style.fontWeight = "800";
    text.style.fontSize = "16px";
    text.style.color = "rgba(255,215,0,0.95)";
    text.style.lineHeight = "1.35";
    text.style.textAlign = "center";
    text.style.whiteSpace = "pre-wrap";

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "✕";
    close.style.position = "absolute";
    close.style.top = "10px";
    close.style.right = "10px";
    close.style.width = "36px";
    close.style.height = "36px";
    close.style.borderRadius = "10px";
    close.style.border = "1px solid rgba(255,255,255,0.12)";
    close.style.background = "rgba(0,0,0,0.35)";
    close.style.color = "#fff";
    close.style.cursor = "pointer";
    close.style.fontWeight = "900";
    close.onclick = function () {
      try { markDismissed(id || (localStorage.getItem(LAST_SHOWN_KEY) || "")); } catch (e) {}
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close.click();
    });

    modal.appendChild(title);
    modal.appendChild(text);
    modal.appendChild(close);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function maybeShowBroadcast(broadcast) {
    if (!broadcast) return;
    if (!broadcast.id || !broadcast.message) return;
    if (alreadyDismissed(broadcast.id)) return;

    // Remember last shown for extra safety
    try { localStorage.setItem(LAST_SHOWN_KEY, String(broadcast.id)); } catch (e) {}

    // Show once per broadcast id
    createBroadcastModal(String(broadcast.message), String(broadcast.id));
  }

  async function fetchState() {
    try {
      const res = await fetch(STATE_URL, { cache: "no-store" });
      const json = await res.json();
      if (!json || !json.ok) return;
      ensureLockdown(json.lockdown);
      maybeShowBroadcast(json.broadcast);
    } catch (e) {
      // ignore
    }
  }

  function connectWS() {
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      return;
    }

    ws.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (!data || !data.type) return;

        if (data.type === "state") {
          ensureLockdown(data.lockdown);
          maybeShowBroadcast(data.broadcast);
        }

        if (data.type === "lockdown") {
          if (data.enabled) redirectToLockdown();
          // if cleared, do nothing special (user can refresh / navigate back)
        }

        if (data.type === "broadcast" && data.broadcast) {
          maybeShowBroadcast(data.broadcast);
        }
      } catch (e) {
        // ignore
      }
    });

    ws.addEventListener("close", () => {
      // retry with backoff
      setTimeout(connectWS, 2000);
    });

    ws.addEventListener("error", () => {
      try { ws.close(); } catch (e) {}
    });
  }

  // Only run on /divine/* pages
  if (isDivinePath()) {
    // initial check
    fetchState();
    // connect realtime
    connectWS();
  }
})();
