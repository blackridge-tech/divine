// divine/access-client.js
// ClientID-based flow control for a static site (no backend).
//
// - Ensures a stable clientID in localStorage
// - POST { clientID } to PANEL_HOST/api/check on every page load
// - If banned -> redirect to /banned
// - If suspicious -> redirect to /suspicious
// - Sends device/browser telemetry to PANEL_HOST/api/hello to help admins distinguish users
//
// Configuration:
// - Set window.__PANEL_HOST__ before loading this script, e.g.
//   <script>window.__PANEL_HOST__="https://dv-panel-app.sirco.online";</script>

(function () {
  function getPanelHost() {
    if (typeof window !== "undefined" && window.__PANEL_HOST__) return String(window.__PANEL_HOST__);
    return "https://dv-panel-app.sirco.online";
  }

  function isBypassPath() {
    const p = location.pathname || "/";
    if (p === "/banned" || p.startsWith("/banned/")) return true;
    if (p === "/lockdown" || p.startsWith("/lockdown/")) return true;
    if (p === "/suspicious" || p.startsWith("/suspicious/")) return true;
    return false;
  }

  function getClientID() {
    // Prefer shared helper if present
    try {
      if (window.__divine_clientid && typeof window.__divine_clientid.get === "function") {
        return window.__divine_clientid.get();
      }
    } catch (e) {}

    // Fallback (standalone)
    const STORAGE_KEY = "divine.clientID";
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing.trim()) return existing.trim();
    } catch (e) {}

    let id = "";
    try {
      if (crypto && typeof crypto.randomUUID === "function") id = crypto.randomUUID();
    } catch (e) {}
    if (!id) id = "cid-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);

    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
    return id;
  }

  function deviceInfo() {
    const ua = (navigator && navigator.userAgent) ? String(navigator.userAgent) : "";
    const platform = (navigator && navigator.platform) ? String(navigator.platform) : "";
    const language = (navigator && navigator.language) ? String(navigator.language) : "";
    let timezone = "";
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}

    let screenStr = "";
    try {
      if (screen && typeof screen.width === "number" && typeof screen.height === "number") {
        screenStr = screen.width + "x" + screen.height;
      }
    } catch (e) {}

    return { ua, platform, language, timezone, screen: screenStr };
  }

  async function sendHello(clientID) {
    const PANEL_HOST = getPanelHost().replace(/\/+$/, "");
    const url = PANEL_HOST + "/api/hello";

    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientID, device: deviceInfo() })
      });
    } catch (e) {
      // ignore if panel unreachable
    }
  }

  async function checkAccess() {
    if (isBypassPath()) return;

    const clientID = getClientID();
    const PANEL_HOST = getPanelHost().replace(/\/+$/, "");
    const url = PANEL_HOST + "/api/check";

    // Fire-and-forget telemetry so admin can see device/ip info
    sendHello(clientID);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientID })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json || !json.ok) return;

      const status = String(json.status || "").toLowerCase();

      if (json.banned === true || status === "banned") {
        const back = encodeURIComponent(location.pathname + location.search + location.hash);
        location.replace("/banned?back=" + back);
        return;
      }

      if (status === "suspicious") {
        const back = encodeURIComponent(location.pathname + location.search + location.hash);
        location.replace("/suspicious?back=" + back);
        return;
      }
    } catch (e) {
      // Panel unreachable => do nothing (flow continues).
    }
  }

  checkAccess();
})();
