// divine/clientid.js
// Shared helper for generating/storing a stable clientID in localStorage.
// clientID is NOT a secret.

(function () {
  const STORAGE_KEY = "divine.clientID";

  function generateID() {
    try {
      if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch (e) {}
    return "cid-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
  }

  function getOrCreateClientID() {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && typeof existing === "string" && existing.trim()) return existing.trim();
    } catch (e) {}

    const id = generateID();
    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
    return id;
  }

  // expose tiny API
  window.__divine_clientid = {
    key: STORAGE_KEY,
    get: getOrCreateClientID
  };
})();
