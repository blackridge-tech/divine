/* ===== OWNER DASHBOARD ===== */
(function () {
  "use strict";

  // ── Elements ──────────────────────────────────────────────────────────────
  const statusText    = document.getElementById("statusText");
  const refreshBtn    = document.getElementById("refreshBtn");
  const homeBtn       = document.getElementById("homeBtn");
  const relockBtn     = document.getElementById("relockBtn");

  const navItems = Array.from(document.querySelectorAll(".navItem[data-view]"));
  const views    = Array.from(document.querySelectorAll(".view"));

  // Overview
  const statActive          = document.getElementById("statActive");
  const statBanned          = document.getElementById("statBanned");
  const statLockdown        = document.getElementById("statLockdown");
  const recentActivityBody  = document.getElementById("recentActivityBody");
  const loadActivityBtn     = document.getElementById("loadActivityBtn");

  // Users
  const userSearch    = document.getElementById("userSearch");
  const loadUsersBtn  = document.getElementById("loadUsersBtn");
  const usersBody     = document.getElementById("usersBody");

  // Broadcast
  const bcUserRow        = document.getElementById("bcUserRow");
  const bcUser           = document.getElementById("bcUser");
  const bcMsg            = document.getElementById("bcMsg");
  const sendBroadcastBtn = document.getElementById("sendBroadcastBtn");
  const clearBroadcastBtn = document.getElementById("clearBroadcastBtn");

  // Activity
  const loadAllActivityBtn = document.getElementById("loadAllActivityBtn");
  const clearActivityBtn   = document.getElementById("clearActivityBtn");
  const activityBody       = document.getElementById("activityBody");

  // Bans
  const loadBansBtn   = document.getElementById("loadBansBtn");
  const openBanModalBtn = document.getElementById("openBanModalBtn");
  const bansBody      = document.getElementById("bansBody");

  // DM Bans
  const loadDmBansBtn    = document.getElementById("loadDmBansBtn");
  const openDmBanModalBtn = document.getElementById("openDmBanModalBtn");
  const dmBansBody       = document.getElementById("dmBansBody");

  // Reports
  const loadReportsBtn  = document.getElementById("loadReportsBtn");
  const clearReportsBtn = document.getElementById("clearReportsBtn");
  const reportsList     = document.getElementById("reportsList");

  // DM Appeals
  const loadDmAppealsBtn  = document.getElementById("loadDmAppealsBtn");
  const clearDmAppealsBtn = document.getElementById("clearDmAppealsBtn");
  const dmAppealsList     = document.getElementById("dmAppealsList");

  // Active users
  const loadOwnerActiveBtn = document.getElementById("loadOwnerActiveBtn");
  const ownerActiveBody    = document.getElementById("ownerActiveBody");

  // Lockdown
  const lockLight    = document.getElementById("lockLight");
  const lockTitle    = document.getElementById("lockTitle");
  const lockSub      = document.getElementById("lockSub");
  const toggleLockdownBtn = document.getElementById("toggleLockdownBtn");

  // Block activation
  const blockActLight    = document.getElementById("blockActLight");
  const blockActTitle    = document.getElementById("blockActTitle");
  const toggleBlockActBtn = document.getElementById("toggleBlockActBtn");
  const loadBlockActBtn  = document.getElementById("loadBlockActBtn");
  const loadBlockedActLogBtn = document.getElementById("loadBlockedActLogBtn");
  const blockedActLogBody    = document.getElementById("blockedActLogBody");

  // Mod settings
  const loadModSettingsBtn = document.getElementById("loadModSettingsBtn");
  const saveModSettingsBtn = document.getElementById("saveModSettingsBtn");
  const modPermBan       = document.getElementById("modPermBan");
  const modPermRefresh   = document.getElementById("modPermRefresh");
  const modPermRevoke    = document.getElementById("modPermRevoke");
  const modPermRedirect  = document.getElementById("modPermRedirect");
  const modNewPin        = document.getElementById("modNewPin");
  const modSettingsMsg   = document.getElementById("modSettingsMsg");

  // Security
  const loadLoginsBtn = document.getElementById("loadLoginsBtn");
  const loginsBody    = document.getElementById("loginsBody");

  // Modals
  const banModal     = document.getElementById("banModal");
  const banUser      = document.getElementById("banUser");
  const banDuration  = document.getElementById("banDuration");
  const banReason    = document.getElementById("banReason");
  const banSubmitBtn = document.getElementById("banSubmitBtn");
  const banMsg       = document.getElementById("banMsg");

  const dmBanModal     = document.getElementById("dmBanModal");
  const dmBanUser      = document.getElementById("dmBanUser");
  const dmBanDuration  = document.getElementById("dmBanDuration");
  const dmBanReason    = document.getElementById("dmBanReason");
  const dmBanSubmitBtn = document.getElementById("dmBanSubmitBtn");
  const dmBanMsg       = document.getElementById("dmBanMsg");

  const toastEl = document.getElementById("toast");

  // ── Helpers ────────────────────────────────────────────────────────────────
  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text || "";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtTime(ms) {
    if (!ms) return "—";
    return new Date(Number(ms)).toLocaleString();
  }

  function setMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }

  // ── API helpers ────────────────────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: {}, credentials: "same-origin" };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(path, opts);
    let data;
    try { data = await r.json(); } catch { data = {}; }
    if (r.status === 401) {
      // Session expired — go back to gate
      window.location.href = "/owner";
      throw new Error("Session expired");
    }
    if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
    return data;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function selectView(name) {
    navItems.forEach(b => b.classList.toggle("active", b.dataset.view === name));
    views.forEach(v => v.classList.toggle("active", v.id === "view-" + name));
  }

  navItems.forEach(btn => {
    btn.addEventListener("click", () => selectView(btn.dataset.view));
  });

  refreshBtn.addEventListener("click", () => { loadOverview(); toast("Refreshing…"); });
  homeBtn.addEventListener("click", () => { window.location.href = "/divine/"; });
  relockBtn.addEventListener("click", () => {
    document.cookie = "dv_owner=; Max-Age=0; Path=/";
    window.location.href = "/owner";
  });

  // ── Overview ───────────────────────────────────────────────────────────────
  async function loadOverview() {
    try {
      const d = await api("GET", "/api/owner/state");
      statActive.textContent   = String(d.activeUsers  ?? "—");
      statBanned.textContent   = String(d.bannedUsers  ?? "—");
      statLockdown.textContent = d.lockdownEnabled ? "ON" : "OFF";
      setLockdownUi(Boolean(d.lockdownEnabled));
    } catch (e) {
      if (e.message !== "Session expired") toast("Overview error: " + e.message);
    }
  }

  function setLockdownUi(enabled) {
    if (!lockLight) return;
    lockLight.style.background  = enabled ? "rgba(255,59,59,0.95)" : "rgba(255,255,255,0.25)";
    lockLight.style.boxShadow   = enabled ? "0 0 26px rgba(255,59,59,0.35)" : "0 0 26px rgba(255,255,255,0.18)";
    lockTitle.textContent = "Lockdown: " + (enabled ? "ENABLED" : "DISABLED");
    lockSub.textContent   = "Live";
  }

  loadActivityBtn.addEventListener("click", loadRecentActivity);
  async function loadRecentActivity() {
    try {
      const d = await api("GET", "/api/owner/activity?limit=8");
      const items = d.items || d.activity || [];
      if (!items.length) {
        recentActivityBody.innerHTML = `<tr><td colspan="3" class="muted">No activity.</td></tr>`;
        return;
      }
      recentActivityBody.innerHTML = items.slice(0, 8).map(it => `
        <tr>
          <td class="muted mini">${esc(it.time || fmtTime(it.created_at))}</td>
          <td>${esc(it.username || it.user || "")}</td>
          <td class="muted">${esc(it.action || it.page || it.path || "")}</td>
        </tr>`).join("");
    } catch (e) {
      if (e.message !== "Session expired") toast("Activity error: " + e.message);
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  let allUsers = [];
  loadUsersBtn.addEventListener("click", loadUsers);
  userSearch.addEventListener("input", () => renderUsers(
    allUsers.filter(u => !userSearch.value || u.username.toLowerCase().includes(userSearch.value.toLowerCase()))
  ));

  async function loadUsers() {
    usersBody.innerHTML = `<tr><td colspan="5" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/users");
      allUsers = d.users || [];
      renderUsers(allUsers);
    } catch (e) {
      if (e.message !== "Session expired")
        usersBody.innerHTML = `<tr><td colspan="5" class="muted">${esc(e.message)}</td></tr>`;
    }
  }

  function renderUsers(users) {
    if (!users.length) {
      usersBody.innerHTML = `<tr><td colspan="5" class="muted">No users found.</td></tr>`;
      return;
    }
    usersBody.innerHTML = users.map(u => {
      const banned = Number(u.banned_until || 0) > Date.now();
      const status = banned
        ? `<span style="color:rgba(255,59,59,0.92);font-weight:700">BANNED</span>`
        : `<span style="color:rgba(34,197,94,0.92);font-weight:700">OK</span>`;
      return `<tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td class="muted mini"><code>${esc(u.id)}</code></td>
        <td class="muted mini">${esc(u.last_ip || "—")}</td>
        <td>${status}</td>
        <td style="text-align:right">
          <div class="row" style="justify-content:flex-end;gap:4px">
            <button class="btn ghost small" data-act="revoke"   data-user="${esc(u.username)}" title="Revoke">↩️</button>
            <button class="btn ghost small" data-act="redirect" data-user="${esc(u.username)}" title="Redirect">🔗</button>
            <button class="btn ghost small" data-act="view"     data-user="${esc(u.username)}" title="Activity">👁️</button>
            <button class="btn danger small" data-act="ban"     data-user="${esc(u.username)}" title="Ban">🛑</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  usersBody.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act, username = b.dataset.user;
    if (act === "ban") {
      banUser.value = username; banDuration.value = "1h"; banReason.value = ""; setMsg(banMsg, "", "");
      try { banModal.showModal(); } catch {}
    } else if (act === "revoke") {
      if (!confirm("Revoke all sessions for \"" + username + "\"?")) return;
      try { await api("POST", "/api/owner/users/revoke", { username }); toast("Revoked " + username); await loadUsers(); }
      catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    } else if (act === "redirect") {
      const url = prompt("Redirect URL:", "https://example.com");
      if (!url) return;
      try { await api("POST", "/api/owner/users/redirect", { username, url }); toast("Redirect set for " + username); }
      catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    } else if (act === "view") {
      selectView("activity");
      try {
        const d = await api("GET", "/api/owner/activity?user=" + encodeURIComponent(username));
        renderActivity(d.items || d.activity || []);
        toast("Showing activity for " + username);
      } catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    }
  });

  // ── Broadcast ──────────────────────────────────────────────────────────────
  document.querySelectorAll("input[name='bcScope']").forEach(r => {
    r.addEventListener("change", () => {
      bcUserRow.hidden = r.value !== "user" || !r.checked;
    });
  });
  sendBroadcastBtn.addEventListener("click", sendBroadcast);
  clearBroadcastBtn.addEventListener("click", () => { bcUser.value = ""; bcMsg.value = ""; toast("Cleared."); });

  async function sendBroadcast() {
    const scope = (document.querySelector("input[name='bcScope']:checked") || {}).value || "global";
    const message = (bcMsg.value || "").trim();
    const username = (bcUser.value || "").trim();
    if (!message) { toast("Write a message first."); return; }
    if (scope === "user" && !username) { toast("Enter a target username."); return; }
    try {
      await api("POST", "/api/owner/broadcast", { scope, username, message });
      toast("Broadcast sent.");
    } catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
  }

  // ── Activity ───────────────────────────────────────────────────────────────
  loadAllActivityBtn.addEventListener("click", loadAllActivity);
  clearActivityBtn.addEventListener("click", () => { activityBody.innerHTML = `<tr><td colspan="4" class="muted">Cleared.</td></tr>`; });

  async function loadAllActivity() {
    activityBody.innerHTML = `<tr><td colspan="4" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/activity");
      renderActivity(d.items || d.activity || []);
    } catch (e) {
      if (e.message !== "Session expired")
        activityBody.innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`;
    }
  }

  function renderActivity(items) {
    if (!items.length) { activityBody.innerHTML = `<tr><td colspan="4" class="muted">No activity.</td></tr>`; return; }
    activityBody.innerHTML = items.map(it => `
      <tr>
        <td class="muted mini">${esc(it.time || fmtTime(it.created_at))}</td>
        <td>${esc(it.username || it.user || "")}</td>
        <td class="muted">${esc(it.page || it.path || it.action || "")}</td>
        <td class="muted mini">${esc(it.extra || it.ip || "")}</td>
      </tr>`).join("");
  }

  // ── Site Bans ──────────────────────────────────────────────────────────────
  loadBansBtn.addEventListener("click", loadBans);
  openBanModalBtn.addEventListener("click", () => {
    banUser.value = ""; banDuration.value = "1h"; banReason.value = ""; setMsg(banMsg, "", "");
    try { banModal.showModal(); } catch {}
  });

  async function loadBans() {
    bansBody.innerHTML = `<tr><td colspan="5" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/bans");
      const items = d.items || d.bans || [];
      if (!items.length) { bansBody.innerHTML = `<tr><td colspan="5" class="muted">No bans.</td></tr>`; return; }
      bansBody.innerHTML = items.map(b => `
        <tr>
          <td><strong>${esc(b.username)}</strong></td>
          <td class="muted mini"><code>${esc(b.userId || b.id || "")}</code></td>
          <td class="muted mini">${esc(b.ends || b.until || "—")}</td>
          <td>${esc(b.reason || "")}</td>
          <td style="text-align:right">
            <button class="btn ghost small" data-ban-act="unban" data-user="${esc(b.username)}">Unban</button>
          </td>
        </tr>`).join("");
    } catch (e) { if (e.message !== "Session expired") bansBody.innerHTML = `<tr><td colspan="5" class="muted">${esc(e.message)}</td></tr>`; }
  }

  bansBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-ban-act='unban']");
    if (!btn) return;
    const username = btn.dataset.user;
    if (!confirm("Unban " + username + "?")) return;
    try { await api("POST", "/api/owner/unban", { username }); toast("Unbanned " + username); await loadBans(); }
    catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
  });

  banSubmitBtn.addEventListener("click", async () => {
    const u = (banUser.value || "").trim(), d = (banDuration.value || "").trim(), r = (banReason.value || "").trim();
    if (!u || !d) { setMsg(banMsg, "Username + duration required.", "err"); return; }
    banSubmitBtn.disabled = true;
    try {
      await api("POST", "/api/owner/ban", { username: u, duration: d, reason: r });
      setMsg(banMsg, "Banned.", "ok");
      toast("User banned.");
      banModal.close();
      await loadBans();
    } catch (e) {
      if (e.message !== "Session expired") setMsg(banMsg, e.message, "err");
    } finally { banSubmitBtn.disabled = false; }
  });

  // ── DM Bans ────────────────────────────────────────────────────────────────
  loadDmBansBtn.addEventListener("click", loadDmBans);
  openDmBanModalBtn.addEventListener("click", () => {
    dmBanUser.value = ""; dmBanDuration.value = ""; dmBanReason.value = ""; setMsg(dmBanMsg, "", "");
    try { dmBanModal.showModal(); } catch {}
  });

  async function loadDmBans() {
    dmBansBody.innerHTML = `<tr><td colspan="5" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/dm-bans");
      const items = d.items || [];
      if (!items.length) { dmBansBody.innerHTML = `<tr><td colspan="5" class="muted">No DM bans.</td></tr>`; return; }
      dmBansBody.innerHTML = items.map(b => `
        <tr>
          <td><strong>${esc(b.username)}</strong></td>
          <td class="muted mini"><code>${esc(b.userId || "")}</code></td>
          <td class="muted mini">${esc(b.ends || "—")}</td>
          <td>${esc(b.reason || "—")}</td>
          <td style="text-align:right">
            <button class="btn ghost small" data-dmu-act="unban" data-user="${esc(b.username)}">Unban</button>
          </td>
        </tr>`).join("");
    } catch (e) { if (e.message !== "Session expired") dmBansBody.innerHTML = `<tr><td colspan="5" class="muted">${esc(e.message)}</td></tr>`; }
  }

  dmBansBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-dmu-act='unban']");
    if (!btn) return;
    const username = btn.dataset.user;
    if (!confirm("DM-unban " + username + "?")) return;
    try { await api("POST", "/api/owner/dm-unban", { username }); toast("DM-unbanned " + username); await loadDmBans(); }
    catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
  });

  dmBanSubmitBtn.addEventListener("click", async () => {
    const u = (dmBanUser.value || "").trim(), d = (dmBanDuration.value || "").trim(), r = (dmBanReason.value || "").trim();
    if (!u || !d) { setMsg(dmBanMsg, "Username + duration required.", "err"); return; }
    dmBanSubmitBtn.disabled = true;
    try {
      await api("POST", "/api/owner/dm-ban", { username: u, duration: d, reason: r });
      setMsg(dmBanMsg, "DM-banned.", "ok");
      toast("User DM-banned.");
      dmBanModal.close();
      await loadDmBans();
    } catch (e) {
      if (e.message !== "Session expired") setMsg(dmBanMsg, e.message, "err");
    } finally { dmBanSubmitBtn.disabled = false; }
  });

  // ── Reports ────────────────────────────────────────────────────────────────
  loadReportsBtn.addEventListener("click", loadReports);
  clearReportsBtn.addEventListener("click", () => { reportsList.innerHTML = `<div class="muted">Cleared.</div>`; });

  async function loadReports() {
    reportsList.innerHTML = `<div class="muted">Loading…</div>`;
    try {
      const d = await api("GET", "/api/owner/reports");
      const items = d.items || d.reports || [];
      if (!items.length) { reportsList.innerHTML = `<div class="muted">No reports.</div>`; return; }
      reportsList.innerHTML = items.map((r, i) => `
        <div class="report">
          <div class="reportTop">
            <div>
              <div class="reportTitle">${esc(r.title || "Report #" + (i + 1))}</div>
              <div class="mini muted">From: ${esc(r.reporter || r.reporterUsername || "?")} &bull; Target: ${esc(r.target || r.targetUsername || "?")}</div>
            </div>
            <button class="xbtn" data-rep-act="dismiss" data-rep-id="${esc(r.id || i)}" title="Dismiss">&#x2715;</button>
          </div>
          <div class="reportBody">${esc(r.body || r.message || r.text || "")}</div>
          <div class="row" style="margin-top:10px;justify-content:flex-end">
            <button class="btn danger small" data-rep-act="ban" data-rep-target="${esc(r.target || r.targetUsername || "")}">Ban</button>
          </div>
        </div>`).join("");
    } catch (e) { if (e.message !== "Session expired") reportsList.innerHTML = `<div class="muted">${esc(e.message)}</div>`; }
  }

  reportsList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-rep-act]");
    if (!btn) return;
    if (btn.dataset.repAct === "dismiss") {
      const id = btn.dataset.repId;
      if (!confirm("Dismiss this report?")) return;
      try { await api("POST", "/api/owner/reports/dismiss", { id: parseInt(id, 10) }); toast("Dismissed."); await loadReports(); }
      catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    } else if (btn.dataset.repAct === "ban") {
      banUser.value = btn.dataset.repTarget || ""; banDuration.value = "1d"; banReason.value = "From report"; setMsg(banMsg, "", "");
      try { banModal.showModal(); } catch {}
    }
  });

  // ── DM Appeals ─────────────────────────────────────────────────────────────
  loadDmAppealsBtn.addEventListener("click", loadDmAppeals);
  clearDmAppealsBtn.addEventListener("click", () => { dmAppealsList.innerHTML = `<div class="muted">Cleared.</div>`; });

  async function loadDmAppeals() {
    dmAppealsList.innerHTML = `<div class="muted">Loading…</div>`;
    try {
      const d = await api("GET", "/api/owner/dm-appeals");
      const items = d.items || d.appeals || [];
      if (!items.length) { dmAppealsList.innerHTML = `<div class="muted">No appeals.</div>`; return; }
      dmAppealsList.innerHTML = items.map(a => `
        <div class="report">
          <div class="reportTop">
            <div>
              <div class="reportTitle">Appeal from ${esc(a.username || "?")}</div>
              <div class="mini muted">${esc(a.time || fmtTime(a.created_at || a.createdAt))}</div>
            </div>
            <button class="xbtn" data-appeal-act="dismiss" data-appeal-id="${esc(a.id)}" title="Dismiss">&#x2715;</button>
          </div>
          <div class="reportBody">${esc(a.appeal_text || a.text || "")}</div>
          <div class="row" style="margin-top:10px;justify-content:flex-end">
            <button class="btn ghost small" data-appeal-act="unban" data-appeal-user="${esc(a.username || "")}">Lift DM Ban</button>
          </div>
        </div>`).join("");
    } catch (e) { if (e.message !== "Session expired") dmAppealsList.innerHTML = `<div class="muted">${esc(e.message)}</div>`; }
  }

  dmAppealsList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-appeal-act]");
    if (!btn) return;
    if (btn.dataset.appealAct === "dismiss") {
      const id = btn.dataset.appealId;
      if (!confirm("Dismiss this appeal?")) return;
      try { await api("POST", "/api/owner/dm-appeals/dismiss", { id: parseInt(id, 10) }); toast("Dismissed."); await loadDmAppeals(); }
      catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    } else if (btn.dataset.appealAct === "unban") {
      const u = btn.dataset.appealUser;
      if (!confirm("Lift DM ban for " + u + "?")) return;
      try { await api("POST", "/api/owner/dm-unban", { username: u }); toast("DM ban lifted for " + u); await loadDmAppeals(); }
      catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    }
  });

  // ── Active Users ───────────────────────────────────────────────────────────
  loadOwnerActiveBtn.addEventListener("click", loadOwnerActive);

  async function loadOwnerActive() {
    ownerActiveBody.innerHTML = `<tr><td colspan="4" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/active-users");
      const users = d.users || [];
      if (!users.length) { ownerActiveBody.innerHTML = `<tr><td colspan="4" class="muted">No active users.</td></tr>`; return; }
      ownerActiveBody.innerHTML = users.map(u => `
        <tr>
          <td><strong>${esc(u.username)}</strong></td>
          <td class="muted mini">${esc(u.last_seen || fmtTime(u.lastSeenAt) || "—")}</td>
          <td class="muted mini">${esc(u.last_ip || u.lastIp || "—")}</td>
          <td style="text-align:right">
            <button class="btn ghost small" data-oact="revoke" data-user="${esc(u.username)}">↩️ Revoke</button>
          </td>
        </tr>`).join("");
    } catch (e) { if (e.message !== "Session expired") ownerActiveBody.innerHTML = `<tr><td colspan="4" class="muted">${esc(e.message)}</td></tr>`; }
  }

  ownerActiveBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-oact]");
    if (!btn) return;
    const act = btn.dataset.oact, user = btn.dataset.user;
    if (act === "revoke" && confirm("Revoke all sessions for \"" + user + "\"?")) {
      try { await api("POST", "/api/owner/users/revoke", { username: user }); toast("Revoked " + user); await loadOwnerActive(); }
      catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
    }
  });

  // ── Lockdown ───────────────────────────────────────────────────────────────
  toggleLockdownBtn.addEventListener("click", async () => {
    try {
      const d = await api("POST", "/api/owner/lockdown", { toggle: true });
      const enabled = Boolean(d.enabled ?? d.lockdownEnabled);
      setLockdownUi(enabled);
      statLockdown.textContent = enabled ? "ON" : "OFF";
      toast(enabled ? "Lockdown enabled." : "Lockdown disabled.");
    } catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
  });

  // ── Block Activation ───────────────────────────────────────────────────────
  function setBlockActUi(enabled) {
    if (!blockActLight) return;
    blockActLight.style.background  = enabled ? "rgba(255,59,59,0.95)" : "rgba(255,255,255,0.25)";
    blockActLight.style.boxShadow   = enabled ? "0 0 26px rgba(255,59,59,0.35)" : "0 0 26px rgba(255,255,255,0.18)";
    blockActTitle.textContent = "Block Activation: " + (enabled ? "ON" : "OFF");
  }

  if (loadBlockActBtn) loadBlockActBtn.addEventListener("click", async () => {
    try { const d = await api("GET", "/api/owner/block-activation"); setBlockActUi(Boolean(d.enabled || d.blocked)); }
    catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
  });

  if (toggleBlockActBtn) toggleBlockActBtn.addEventListener("click", async () => {
    try {
      const d = await api("POST", "/api/owner/block-activation", { toggle: true });
      setBlockActUi(Boolean(d.enabled || d.blocked));
      toast(d.enabled || d.blocked ? "Activations blocked." : "Activations unblocked.");
    } catch (e) { if (e.message !== "Session expired") toast("Error: " + e.message); }
  });

  if (loadBlockedActLogBtn) loadBlockedActLogBtn.addEventListener("click", loadBlockedActLog);

  async function loadBlockedActLog() {
    if (!blockedActLogBody) return;
    blockedActLogBody.innerHTML = `<tr><td colspan="5" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/blocked-activations");
      const rows = d.logs || d.items || [];
      if (!rows.length) { blockedActLogBody.innerHTML = `<tr><td colspan="5" class="muted">No entries.</td></tr>`; return; }
      blockedActLogBody.innerHTML = rows.map(r => `
        <tr>
          <td class="muted mini">${esc(r.time || fmtTime(r.created_at || r.createdAt))}</td>
          <td>${esc(r.os || "—")}</td>
          <td class="muted mini">${esc(r.ip || "—")}</td>
          <td>${esc(r.reason || "os_block")}</td>
          <td class="muted mini" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.user_agent || r.userAgent || "")}">${esc(r.user_agent || r.userAgent || "—")}</td>
        </tr>`).join("");
    } catch (e) { if (e.message !== "Session expired") blockedActLogBody.innerHTML = `<tr><td colspan="5" class="muted">${esc(e.message)}</td></tr>`; }
  }

  // ── Mod Settings ───────────────────────────────────────────────────────────
  if (loadModSettingsBtn) loadModSettingsBtn.addEventListener("click", loadModSettings);
  if (saveModSettingsBtn) saveModSettingsBtn.addEventListener("click", saveModSettings);

  async function loadModSettings() {
    try {
      const d = await api("GET", "/api/owner/mod-settings");
      const p = d.perms || d.permissions || {};
      if (modPermBan)      modPermBan.checked      = p.ban      !== false;
      if (modPermRefresh)  modPermRefresh.checked  = p.refresh  !== false;
      if (modPermRevoke)   modPermRevoke.checked   = p.revoke   !== false;
      if (modPermRedirect) modPermRedirect.checked = p.redirect !== false;
      if (modNewPin) modNewPin.value = "";
      setMsg(modSettingsMsg, "Settings loaded.", "ok");
    } catch (e) { if (e.message !== "Session expired") setMsg(modSettingsMsg, e.message, "err"); }
  }

  async function saveModSettings() {
    const permissions = {
      ban:      modPermBan      ? modPermBan.checked      : true,
      refresh:  modPermRefresh  ? modPermRefresh.checked  : true,
      revoke:   modPermRevoke   ? modPermRevoke.checked   : true,
      redirect: modPermRedirect ? modPermRedirect.checked : true,
    };
    const newPin = modNewPin ? modNewPin.value.trim() : "";
    const body = { perms: permissions };
    if (newPin) body.pin = newPin;
    try {
      await api("POST", "/api/owner/mod-settings", body);
      if (modNewPin) modNewPin.value = "";
      setMsg(modSettingsMsg, "Saved.", "ok");
      toast("Mod settings saved.");
    } catch (e) { if (e.message !== "Session expired") setMsg(modSettingsMsg, e.message, "err"); }
  }

  // ── Security — Login History ────────────────────────────────────────────────
  if (loadLoginsBtn) loadLoginsBtn.addEventListener("click", loadLogins);

  async function loadLogins() {
    loginsBody.innerHTML = `<tr><td colspan="3" class="muted">Loading…</td></tr>`;
    try {
      const d = await api("GET", "/api/owner/security/logins");
      const items = d.logins || [];
      if (!items.length) { loginsBody.innerHTML = `<tr><td colspan="3" class="muted">No login history.</td></tr>`; return; }
      loginsBody.innerHTML = items.map(l => `
        <tr>
          <td class="muted mini">${esc(l.time || fmtTime(l.createdAt))}</td>
          <td class="muted mini">${esc(l.ip || "—")}</td>
          <td class="muted mini" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(l.userAgent || "")}">${esc(l.userAgent || "—")}</td>
        </tr>`).join("");
    } catch (e) { if (e.message !== "Session expired") loginsBody.innerHTML = `<tr><td colspan="3" class="muted">${esc(e.message)}</td></tr>`; }
  }

  // ── Tab switching ──────────────────────────────────────────────────────────
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;
      const parentSection = tab.closest("section");
      parentSection.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      if (parentSection.id === "view-bans") {
        document.getElementById("panel-site-bans").style.display = targetTab === "site-bans" ? "" : "none";
        document.getElementById("panel-dm-bans").style.display   = targetTab === "dm-bans"   ? "" : "none";
      } else if (parentSection.id === "view-reports") {
        document.getElementById("panel-user-reports").style.display = targetTab === "user-reports" ? "" : "none";
        document.getElementById("panel-dm-appeals").style.display   = targetTab === "dm-appeals"   ? "" : "none";
      }
    });
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  loadOverview();
})();
