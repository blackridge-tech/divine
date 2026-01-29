(function(){
  const idVal = document.getElementById("idVal");
  const showId = document.getElementById("showId");
  const hideId = document.getElementById("hideId");

  const username = document.getElementById("username");
  const cooldown = document.getElementById("cooldown");
  const saveUsername = document.getElementById("saveUsername");
  const userMsg = document.getElementById("userMsg");

  const bio = document.getElementById("bio");
  const saveBio = document.getElementById("saveBio");
  const bioMsg = document.getElementById("bioMsg");

  const logout = document.getElementById("logout");

  // Search elements
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const resultsList = document.getElementById("resultsList");
  const searchMsg = document.getElementById("searchMsg");

  let userId = "";
  let searchTimeout = null;

  function setMsg(el, text, kind){
    el.textContent = text || "";
    el.className = "msg" + (kind ? (" " + kind) : "");
  }

  async function getMe(){
    const res = await fetch("/api/me", { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || "Failed");
    return json;
  }

  function setCooldownText(remainingMs){
    if (!remainingMs || remainingMs <= 0) {
      cooldown.textContent = "You can change your username now.";
      return;
    }
    const hrs = Math.ceil(remainingMs / 3600000);
    cooldown.textContent = `You can change again in ~${hrs}h.`;
  }

  async function load(){
    try {
      const me = await getMe();
      userId = String(me.user.id || "");
      bio.value = String(me.user.bio || "");
      setCooldownText(me.usernameChange ? me.usernameChange.remainingMs : 0);
    } catch (e) {
      cooldown.textContent = "Failed to load profile.";
    }
  }

  showId.addEventListener("click", () => {
    idVal.textContent = userId ? userId : "Unavailable";
    showId.hidden = true;
    hideId.hidden = false;
  });

  hideId.addEventListener("click", () => {
    idVal.textContent = "••••••••••••••••";
    showId.hidden = false;
    hideId.hidden = true;
  });

  saveBio.addEventListener("click", async () => {
    const v = (bio.value || "").trim();
    saveBio.disabled = true;
    setMsg(bioMsg, "Saving...", "");
    try {
      const res = await fetch("/api/me", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ bio: v })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setMsg(bioMsg, json.error || "Failed", "err"); return; }
      setMsg(bioMsg, "Saved.", "ok");
    } catch {
      setMsg(bioMsg, "Request failed", "err");
    } finally {
      saveBio.disabled = false;
    }
  });

  saveUsername.addEventListener("click", async () => {
    const u = (username.value || "").trim();
    if (!u) { setMsg(userMsg, "Enter a username.", "err"); return; }

    saveUsername.disabled = true;
    setMsg(userMsg, "Saving...", "");
    try {
      const res = await fetch("/api/me/username", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ username: u })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) { setMsg(userMsg, json.error || "Failed", "err"); return; }
      setMsg(userMsg, "Username updated.", "ok");
      username.value = "";
      await load();
    } catch {
      setMsg(userMsg, "Request failed", "err");
    } finally {
      saveUsername.disabled = false;
    }
  });

  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try { await fetch("/api/logout", { method: "POST" }); } catch {}
    location.href = "/";
  });

  // Search functionality
  async function performSearch(query){
    if (!query || query.length < 2) {
      searchResults.style.display = "none";
      setMsg(searchMsg, "", "");
      return;
    }

    try {
      setMsg(searchMsg, "Searching...", "");
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMsg(searchMsg, data.error || "Search failed", "err");
        searchResults.style.display = "none";
        return;
      }

      if (!data.users || data.users.length === 0) {
        setMsg(searchMsg, "No users found", "");
        searchResults.style.display = "none";
        return;
      }

      setMsg(searchMsg, "", "");
      resultsList.innerHTML = data.users.map(u => `
        <a href="/divine/u/${encodeURIComponent(u.username)}" 
           style="display:block;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.25);text-decoration:none;transition:background 0.2s;"
           onmouseover="this.style.background='rgba(255,255,255,0.08)'"
           onmouseout="this.style.background='rgba(0,0,0,0.25)'">
          <div style="font-weight:800;color:var(--gold);margin-bottom:4px;">${escapeHtml(u.username)}</div>
          <div style="font-size:0.9rem;color:var(--muted);">${escapeHtml(u.bio || 'No bio')}</div>
        </a>
      `).join("");
      searchResults.style.display = "block";
    } catch (e) {
      setMsg(searchMsg, "Network error", "err");
      searchResults.style.display = "none";
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = (e.target.value || "").trim();
    searchTimeout = setTimeout(() => performSearch(query), 300);
  });

  load();
})();
