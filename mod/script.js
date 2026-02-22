/* ===== MOD PANEL ===== */
(function () {
  "use strict";

  // ── Elements ──────────────────────────────────────────────────────────────
  const pinOverlay    = document.getElementById("pinOverlay");
  const pinInput      = document.getElementById("modPin");
  const pinEnterBtn   = document.getElementById("pinEnterBtn");
  const pinExitBtn    = document.getElementById("pinExitBtn");
  const pinMsg        = document.getElementById("pinMsg");
  const statusText    = document.getElementById("statusText");
  const relockBtn     = document.getElementById("relockBtn");
  const refreshBtn    = document.getElementById("refreshBtn");
  const homeBtn       = document.getElementById("homeBtn");

  const loadActiveBtn = document.getElementById("loadActiveBtn");
  const activeBody    = document.getElementById("activeBody");
  const loadUsersBtn  = document.getElementById("loadUsersBtn");
  const usersBody     = document.getElementById("usersBody");
  const userSearch    = document.getElementById("userSearch");

  const banModal         = document.getElementById("banModal");
  const banUser          = document.getElementById("banUser");
  const banDuration      = document.getElementById("banDuration");
  const banReason        = document.getElementById("banReason");
  const banSubmitBtn     = document.getElementById("banSubmitBtn");
  const banMsg           = document.getElementById("banMsg");
  const redirectModal    = document.getElementById("redirectModal");
  const redirectPath     = document.getElementById("redirectPath");
  const redirectSubmitBtn = document.getElementById("redirectSubmitBtn");
  const redirectMsg      = document.getElementById("redirectMsg");
  const toast            = document.getElementById("toast");

  // ── State ─────────────────────────────────────────────────────────────────
  let unlocked         = false;
  let allUsers         = [];
  let pendingBanUser   = null;
  let pendingRedirUser = null;
  let permissions      = { ban: true, refresh: true, revoke: true, redirect: true };

  // ── Toast ─────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  document.querySelectorAll(".navItem[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".navItem").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.view;
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-" + target).classList.add("active");
    });
  });

  // ── API helpers ───────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    let data;
    try { data = await r.json(); } catch { data = {}; }
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  // ── PIN flow ──────────────────────────────────────────────────────────────
  async function checkSession() {
    try {
      const d = await api("GET", "/api/mod/state");
      permissions = { ...permissions, ...d.permissions };
      unlocked = true;
      unlock();
    } catch {
      pinOverlay.style.display = "flex";
    }
  }

  function unlock() {
    pinOverlay.style.display = "none";
    statusText.textContent  = "Active Session";
    loadActiveUsers();
  }

  pinEnterBtn.addEventListener("click", submitPin);
  pinInput.addEventListener("keydown", e => { if (e.key === "Enter") submitPin(); });
  pinExitBtn.addEventListener("click", () => { window.location.href = "/"; });

  async function submitPin() {
    const pin = pinInput.value.trim();
    if (!pin) { setMsg(pinMsg, "Enter the MOD PIN.", "err"); return; }
    pinEnterBtn.disabled = true;
    pinMsg.className = "msg";
    pinMsg.textContent = "Verifying…";
    try {
      const d = await api("POST", "/mod/pin", { pin });
      permissions = { ...permissions, ...(d.permissions || {}) };
      unlock();
    } catch (e) {
      setMsg(pinMsg, e.message, "err");
    } finally {
      pinEnterBtn.disabled = false;
    }
  }

  relockBtn.addEventListener("click", () => {
    document.cookie = "dv_mod=; Max-Age=0; Path=/";
    location.reload();
  });

  // ── Active Users ──────────────────────────────────────────────────────────
  loadActiveBtn.addEventListener("click", loadActiveUsers);
  async function loadActiveUsers() {
    activeBody.innerHTML = `<tr><td colspan="4" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/mod/active-users");
      renderActiveUsers(d.users || []);
    } catch (e) {
      activeBody.innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`;
    }
  }

  function renderActiveUsers(users) {
    if (!users.length) {
      activeBody.innerHTML = `<tr><td colspan="4" class="muted">No active users found.</td></tr>`;
      return;
    }
    activeBody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td class="muted mini">${esc(u.last_seen || "—")}</td>
        <td class="muted mini">${esc(u.last_ip || "—")}</td>
        <td style="text-align:right">
          ${permissions.refresh ? `<button class="btn ghost small" data-action="refresh" data-user="${esc(u.username)}">🔄 Refresh</button>` : ""}
          ${permissions.revoke  ? `<button class="btn ghost small" data-action="revoke"  data-user="${esc(u.username)}">↩️ Revoke</button>` : ""}
        </td>
      </tr>`).join("");
    bindActions(activeBody);
  }

  // ── All Users ─────────────────────────────────────────────────────────────
  loadUsersBtn.addEventListener("click", loadUsers);
  userSearch.addEventListener("input", filterUsers);

  async function loadUsers() {
    usersBody.innerHTML = `<tr><td colspan="4" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/mod/users");
      allUsers = d.users || [];
      renderUsers(allUsers);
    } catch (e) {
      usersBody.innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`;
    }
  }

  function filterUsers() {
    const q = userSearch.value.trim().toLowerCase();
    renderUsers(q ? allUsers.filter(u => u.username.toLowerCase().includes(q)) : allUsers);
  }

  function renderUsers(users) {
    if (!users.length) {
      usersBody.innerHTML = `<tr><td colspan="4" class="muted">No users found.</td></tr>`;
      return;
    }
    usersBody.innerHTML = users.map(u => {
      const banned = u.banned ? `<span class="pill" style="background:rgba(255,59,59,0.12);color:#ff3b3b;border-color:rgba(255,59,59,0.2)">Banned</span>` : `<span class="pill" style="color:var(--ok);border-color:rgba(34,197,94,0.2)">Active</span>`;
      const actions = [
        permissions.ban      ? `<button class="btn danger small" data-action="ban"      data-user="${esc(u.username)}">🛑 Ban</button>` : "",
        permissions.refresh  ? `<button class="btn ghost  small" data-action="refresh"  data-user="${esc(u.username)}">🔄 Refresh</button>` : "",
        permissions.revoke   ? `<button class="btn ghost  small" data-action="revoke"   data-user="${esc(u.username)}">↩️ Revoke</button>` : "",
        permissions.redirect ? `<button class="btn ghost  small" data-action="redirect" data-user="${esc(u.username)}">🔗 Redirect</button>` : "",
      ].filter(Boolean).join(" ");
      return `<tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td>${banned}</td>
        <td class="muted mini">${esc(u.last_seen || "—")}</td>
        <td style="text-align:right;white-space:nowrap">${actions}</td>
      </tr>`;
    }).join("");
    bindActions(usersBody);
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function bindActions(container) {
    container.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", () => handleAction(btn.dataset.action, btn.dataset.user));
    });
  }

  function handleAction(action, username) {
    switch (action) {
      case "ban":
        pendingBanUser = username;
        banUser.value = username;
        banDuration.value = "";
        banReason.value = "";
        setMsg(banMsg, "", "");
        banModal.showModal();
        break;
      case "refresh":
        doRefresh(username);
        break;
      case "revoke":
        if (confirm(`Revoke all sessions for "${username}"? They will be logged out everywhere.`)) {
          doRevoke(username);
        }
        break;
      case "redirect":
        pendingRedirUser = username;
        redirectPath.value = "";
        setMsg(redirectMsg, "", "");
        redirectModal.showModal();
        break;
    }
  }

  // Ban
  banSubmitBtn.addEventListener("click", async () => {
    const u = banUser.value.trim();
    const dur = banDuration.value.trim();
    const reason = banReason.value.trim();
    if (!u || !dur) { setMsg(banMsg, "Username and duration are required.", "err"); return; }
    banSubmitBtn.disabled = true;
    try {
      await api("POST", "/api/mod/ban", { username: u, duration: dur, reason });
      banModal.close();
      showToast(`Banned ${u}.`);
      refreshCurrentView();
    } catch (e) {
      setMsg(banMsg, e.message, "err");
    } finally {
      banSubmitBtn.disabled = false;
    }
  });

  // Refresh
  async function doRefresh(username) {
    try {
      await api("POST", "/api/mod/refresh", { username });
      showToast(`Refreshed ${username}.`);
    } catch (e) {
      showToast(`Refresh failed: ${e.message}`);
    }
  }

  // Revoke
  async function doRevoke(username) {
    try {
      await api("POST", "/api/mod/revoke", { username });
      showToast(`Revoked sessions for ${username}.`);
      refreshCurrentView();
    } catch (e) {
      showToast(`Revoke failed: ${e.message}`);
    }
  }

  // Redirect
  redirectSubmitBtn.addEventListener("click", async () => {
    const path = redirectPath.value.trim();
    if (!path.startsWith("/")) { setMsg(redirectMsg, "Path must start with /", "err"); return; }
    redirectSubmitBtn.disabled = true;
    try {
      await api("POST", "/api/mod/redirect", { username: pendingRedirUser, path });
      redirectModal.close();
      showToast(`Redirect set for ${pendingRedirUser}.`);
    } catch (e) {
      setMsg(redirectMsg, e.message, "err");
    } finally {
      redirectSubmitBtn.disabled = false;
    }
  });

  // ── Misc ───────────────────────────────────────────────────────────────────
  refreshBtn.addEventListener("click", refreshCurrentView);
  homeBtn.addEventListener("click", () => { window.location.href = "/"; });

  function refreshCurrentView() {
    const active = document.querySelector(".navItem.active");
    if (!active) return;
    const view = active.dataset.view;
    if (view === "active-users") loadActiveUsers();
    else if (view === "all-users") loadUsers();
  }

  function setMsg(el, text, type) {
    el.textContent = text;
    el.className   = "msg" + (type ? " " + type : "");
  }

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  checkSession();
})();
