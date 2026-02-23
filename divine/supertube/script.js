/* global */ "use strict";
/**
 * UltraTube (Supertube) – client-side logic
 * All data fetches go through /api/supertube/* — no RapidAPI keys in client.
 */
(function () {

  // -------------------------------------------------------------------------
  // Settings (persisted in localStorage)
  // -------------------------------------------------------------------------
  const SETTINGS_KEY = "ultratube_settings";

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return Object.assign({ pageSize: 6, playlistId: "" }, JSON.parse(raw));
    } catch {}
    return { pageSize: 6, playlistId: "" };
  }

  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  }

  let settings = loadSettings();

  // -------------------------------------------------------------------------
  // History (persisted in localStorage)
  // -------------------------------------------------------------------------
  const HISTORY_KEY = "ultratube_history";
  const MAX_HISTORY = 50;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  function addToHistory(video) {
    let hist = loadHistory();
    hist = hist.filter(v => v.id !== video.id);
    hist.unshift(video);
    if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist)); } catch {}
  }

  // -------------------------------------------------------------------------
  // API helpers
  // -------------------------------------------------------------------------
  const API = "/api/supertube";

  async function apiFetch(endpoint, params = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();
    const url = `${API}/${endpoint}${qs ? "?" + qs : ""}`;
    const res = await fetch(url);
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  // -------------------------------------------------------------------------
  // DOM refs
  // -------------------------------------------------------------------------
  function el(id) { return document.getElementById(id); }

  const root         = el("supertubeRoot");
  const searchForm   = el("stSearchForm");
  const searchInput  = el("stSearchInput");
  const sectionTitle = el("stSectionTitle");
  const grid         = el("stGrid");
  const loading      = el("stLoading");
  const emptyMsg     = el("stEmpty");
  const prevBtn      = el("stPrevBtn");
  const nextBtn      = el("stNextBtn");
  const pageInfo     = el("stPageInfo");

  // Playlist view
  const playlistGrid    = el("stPlaylistGrid");
  const playlistLoading = el("stPlaylistLoading");
  const playlistEmpty   = el("stPlaylistEmpty");
  const playlistPrev    = el("stPlaylistPrev");
  const playlistNext    = el("stPlaylistNext");
  const playlistPageInfo = el("stPlaylistPageInfo");

  // History view
  const historyGrid  = el("stHistoryGrid");
  const historyEmpty = el("stHistoryEmpty");

  // Bottom nav buttons
  const navHome     = el("stNavHome");
  const navShorts   = el("stNavShorts");
  const navPlaylist = el("stNavPlaylist");
  const navHistory  = el("stNavHistory");

  // Views
  const viewHome     = el("stViewHome");
  const viewPlaylist = el("stViewPlaylist");
  const viewHistory  = el("stViewHistory");

  // Shorts overlay
  const shortsOverlay  = el("stShortsOverlay");
  const shortsFeed     = el("stShortsFeed");
  const shortsClose    = el("stShortsClose");
  const shortsLoading  = el("stShortsLoading");

  // Watch modal
  const watchModal       = el("stWatchModal");
  const watchBackdrop    = el("stWatchBackdrop");
  const watchClose       = el("stWatchClose");
  const watchFrame       = el("stWatchFrame");
  const watchTitle       = el("stWatchTitle");
  const watchMeta        = el("stWatchMeta");
  const watchDesc        = el("stWatchDesc");
  const watchComments    = el("stWatchComments");
  const commentsLoading  = el("stCommentsLoading");

  // Settings panel
  const settingsBtn      = el("stSettingsBtn");
  const settingsPanel    = el("stSettingsPanel");
  const settingsBackdrop = el("stSettingsBackdrop");
  const settingsClose    = el("stSettingsClose");
  const settingsPageSize = el("stSettingsPageSize");
  const settingsPlaylistId = el("stSettingsPlaylistId");
  const settingsSave     = el("stSettingsSave");

  // Logo
  const logoBtn = el("stLogoBtn");

  // -------------------------------------------------------------------------
  // Navigation / view switching
  // -------------------------------------------------------------------------
  let currentView = "home";

  const navButtons = [navHome, navShorts, navPlaylist, navHistory];

  function switchView(viewName) {
    if (viewName === "shorts") {
      openShorts();
      return;
    }
    currentView = viewName;
    navButtons.forEach(b => {
      b.classList.toggle("st-nav-btn--active", b.dataset.view === viewName);
      b.setAttribute("aria-current", b.dataset.view === viewName ? "page" : "false");
    });
    viewHome.classList.toggle("st-view--active", viewName === "home");
    viewHome.hidden = viewName !== "home";
    viewPlaylist.classList.toggle("st-view--active", viewName === "playlist");
    viewPlaylist.hidden = viewName !== "playlist";
    viewHistory.classList.toggle("st-view--active", viewName === "history");
    viewHistory.hidden = viewName !== "history";

    if (viewName === "playlist") loadPlaylist(settings.playlistId);
    if (viewName === "history") renderHistory();
  }

  navHome.addEventListener("click", () => switchView("home"));
  navShorts.addEventListener("click", () => switchView("shorts"));
  navPlaylist.addEventListener("click", () => switchView("playlist"));
  navHistory.addEventListener("click", () => switchView("history"));
  logoBtn.addEventListener("click", e => { e.preventDefault(); switchView("home"); });

  // -------------------------------------------------------------------------
  // Video card rendering helpers
  // -------------------------------------------------------------------------
  function fmtViews(n) {
    if (!n) return "";
    const num = parseInt(n, 10);
    if (isNaN(num)) return "";
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, "") + "B views";
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M views";
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K views";
    return num + " views";
  }

  function createCard(video, onClick) {
    const card = document.createElement("article");
    card.className = "st-card";
    card.setAttribute("role", "listitem");
    card.tabIndex = 0;

    const thumb = video.thumbnails?.high || video.thumbnails?.medium || video.thumbnails?.default || "";

    // Build card safely using DOM APIs to avoid XSS
    const thumbDiv = document.createElement("div");
    thumbDiv.className = "st-card-thumb";

    if (thumb) {
      const img = document.createElement("img");
      img.src = thumb;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      thumbDiv.appendChild(img);
    }

    if (video.duration) {
      const dur = document.createElement("span");
      dur.className = "st-card-duration";
      dur.textContent = video.duration;
      thumbDiv.appendChild(dur);
    }

    const body = document.createElement("div");
    body.className = "st-card-body";

    const titleEl = document.createElement("div");
    titleEl.className = "st-card-title";
    titleEl.textContent = video.title || "(untitled)";

    const chanEl = document.createElement("div");
    chanEl.className = "st-card-channel";
    chanEl.textContent = video.channel || "";

    body.appendChild(titleEl);
    body.appendChild(chanEl);

    if (video.viewCount) {
      const viewsEl = document.createElement("div");
      viewsEl.className = "st-card-views";
      viewsEl.textContent = fmtViews(video.viewCount);
      body.appendChild(viewsEl);
    }

    card.appendChild(thumbDiv);
    card.appendChild(body);

    const handler = () => onClick(video);
    card.addEventListener("click", handler);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); } });

    return card;
  }

  function renderCards(container, videos, onClick) {
    container.innerHTML = "";
    videos.forEach(v => container.appendChild(createCard(v, onClick)));
  }

  // -------------------------------------------------------------------------
  // Home / search feed
  // -------------------------------------------------------------------------
  let homePageNum    = 1;
  let homeNextToken  = "";
  let homePageTokens = [""]; // index → token to fetch that page
  let homeSearchQuery = "";
  let homeMode = "home"; // "home" | "search" | "channel"
  let channelId = "";

  async function loadHome(pageToken) {
    setLoading(true);
    try {
      let data;
      if (homeMode === "search") {
        sectionTitle.textContent = `Results for "${homeSearchQuery}"`;
        data = await apiFetch("search", { query: homeSearchQuery, pageToken, pageSize: settings.pageSize });
      } else if (homeMode === "channel") {
        sectionTitle.textContent = "Channel Videos";
        data = await apiFetch("channelVideos", { id: channelId, pageToken, pageSize: settings.pageSize });
      } else {
        sectionTitle.textContent = "Trending";
        data = await apiFetch("home", { pageToken, pageSize: settings.pageSize });
      }
      renderCards(grid, data.videos || [], openWatch);
      emptyMsg.hidden = (data.videos || []).length > 0;
      homeNextToken = data.nextPageToken || "";
      // Record this page's next token for forward navigation
      homePageTokens[homePageNum] = homeNextToken;
      updateHomePagination();
    } catch (e) {
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Failed to load: " + e.message;
    } finally {
      setLoading(false);
    }
  }

  function setLoading(on) {
    loading.hidden = !on;
    grid.style.opacity = on ? "0.4" : "1";
  }

  function updateHomePagination() {
    prevBtn.disabled = homePageNum <= 1;
    nextBtn.disabled = !homeNextToken;
    pageInfo.textContent = `Page ${homePageNum}`;
  }

  prevBtn.addEventListener("click", () => {
    if (homePageNum <= 1) return;
    homePageNum--;
    loadHome(homePageTokens[homePageNum - 1] || "");
  });

  nextBtn.addEventListener("click", () => {
    if (!homeNextToken) return;
    homePageNum++;
    if (!homePageTokens[homePageNum - 1]) homePageTokens[homePageNum - 1] = homeNextToken;
    loadHome(homeNextToken);
  });

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------
  searchForm.addEventListener("submit", e => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (!q) return;

    // Channel search: @channelname
    if (q.startsWith("@")) {
      homeMode = "channel";
      homeSearchQuery = q.slice(1);
      loadChannelBySearch(homeSearchQuery);
      return;
    }

    homeMode = "search";
    homeSearchQuery = q;
    homePageNum = 1;
    homePageTokens = [""];
    homeNextToken = "";
    switchView("home");
    loadHome("");
  });

  async function loadChannelBySearch(query) {
    setLoading(true);
    try {
      const data = await apiFetch("channelSearch", { query });
      const channels = data.channels || [];
      if (channels.length === 0) {
        emptyMsg.hidden = false;
        emptyMsg.textContent = "No channel found.";
        return;
      }
      channelId = channels[0].id;
      homeMode = "channel";
      homePageNum = 1;
      homePageTokens = [""];
      homeNextToken = "";
      switchView("home");
      loadHome("");
    } catch (e) {
      setLoading(false);
      emptyMsg.hidden = false;
      emptyMsg.textContent = "Channel search failed: " + e.message;
    }
  }

  // -------------------------------------------------------------------------
  // Playlist view
  // -------------------------------------------------------------------------
  let plPageNum    = 1;
  let plNextToken  = "";
  let plPageTokens = [""];

  async function loadPlaylist(id) {
    if (!id) {
      playlistEmpty.hidden = false;
      playlistEmpty.textContent = "Enter a Playlist ID in Settings to load a playlist.";
      return;
    }
    setPlLoading(true);
    try {
      const pageToken = plPageTokens[plPageNum - 1] || "";
      const data = await apiFetch("playlistVideos", { id, pageToken, pageSize: settings.pageSize });
      renderCards(playlistGrid, data.videos || [], openWatch);
      playlistEmpty.hidden = (data.videos || []).length > 0;
      plNextToken = data.nextPageToken || "";
      plPageTokens[plPageNum] = plNextToken;
      updatePlPagination();
    } catch (e) {
      playlistEmpty.hidden = false;
      playlistEmpty.textContent = "Failed to load playlist: " + e.message;
    } finally {
      setPlLoading(false);
    }
  }

  function setPlLoading(on) {
    playlistLoading.hidden = !on;
    playlistGrid.style.opacity = on ? "0.4" : "1";
  }

  function updatePlPagination() {
    playlistPrev.disabled = plPageNum <= 1;
    playlistNext.disabled = !plNextToken;
    playlistPageInfo.textContent = `Page ${plPageNum}`;
  }

  playlistPrev.addEventListener("click", () => {
    if (plPageNum <= 1) return;
    plPageNum--;
    loadPlaylist(settings.playlistId);
  });

  playlistNext.addEventListener("click", () => {
    if (!plNextToken) return;
    plPageNum++;
    loadPlaylist(settings.playlistId);
  });

  // -------------------------------------------------------------------------
  // History view
  // -------------------------------------------------------------------------
  function renderHistory() {
    const hist = loadHistory();
    if (hist.length === 0) {
      historyEmpty.hidden = false;
      historyGrid.innerHTML = "";
      return;
    }
    historyEmpty.hidden = true;
    renderCards(historyGrid, hist, openWatch);
  }

  // -------------------------------------------------------------------------
  // Watch modal
  // -------------------------------------------------------------------------
  async function openWatch(video) {
    addToHistory(video);

    // Set embed URL using youtube-nocookie
    watchFrame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0`;
    watchTitle.textContent = video.title || "";
    watchMeta.textContent = [video.channel, fmtViews(video.viewCount)].filter(Boolean).join(" · ");
    watchDesc.textContent = video.description || "";
    watchComments.innerHTML = "";
    commentsLoading.hidden = false;

    watchModal.hidden = false;
    document.body.style.overflow = "hidden";
    watchClose.focus();

    // Load comments async
    try {
      const data = await apiFetch("videoComments", { id: video.id });
      commentsLoading.hidden = true;
      (data.comments || []).slice(0, 20).forEach(c => {
        watchComments.appendChild(buildComment(c));
      });
    } catch {
      commentsLoading.hidden = true;
    }
  }

  function buildComment(c) {
    const wrap = document.createElement("div");
    wrap.className = "st-comment";

    if (c.authorAvatar) {
      const img = document.createElement("img");
      img.className = "st-comment-avatar";
      img.src = c.authorAvatar;
      img.alt = "";
      img.loading = "lazy";
      wrap.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "st-comment-body";

    const author = document.createElement("div");
    author.className = "st-comment-author";
    author.textContent = c.author || "";

    const text = document.createElement("div");
    text.className = "st-comment-text";
    text.textContent = c.text || "";

    body.appendChild(author);
    body.appendChild(text);
    wrap.appendChild(body);
    return wrap;
  }

  function closeWatch() {
    watchModal.hidden = true;
    watchFrame.src = "";
    document.body.style.overflow = "";
  }

  watchClose.addEventListener("click", closeWatch);
  watchBackdrop.addEventListener("click", closeWatch);

  // -------------------------------------------------------------------------
  // Shorts overlay
  // -------------------------------------------------------------------------
  let shortsLoaded = false;
  let shortsObserver = null;

  async function openShorts() {
    shortsOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    shortsClose.focus();
    if (!shortsLoaded) {
      await loadShorts();
      shortsLoaded = true;
    }
    setupShortsObserver();
  }

  function closeShorts() {
    shortsOverlay.hidden = true;
    document.body.style.overflow = "";
    if (shortsObserver) { shortsObserver.disconnect(); shortsObserver = null; }
    // Stop all short iframes by clearing src
    shortsFeed.querySelectorAll("iframe").forEach(f => { f.src = ""; });
  }

  shortsClose.addEventListener("click", () => {
    closeShorts();
    // Return focus to Shorts nav button
    navShorts.focus();
  });

  let shortsNextToken = "";

  async function loadShorts() {
    shortsLoading.hidden = false;
    try {
      const data = await apiFetch("shorts", { pageToken: shortsNextToken, pageSize: 10 });
      shortsLoading.hidden = true;
      (data.videos || []).forEach(v => shortsFeed.appendChild(buildShortItem(v)));
      shortsNextToken = data.nextPageToken || "";
    } catch {
      shortsLoading.hidden = true;
    }
  }

  function buildShortItem(video) {
    const item = document.createElement("div");
    item.className = "st-short-item";
    item.dataset.videoId = video.id;

    // Iframe is lazy – inserted by IntersectionObserver when near viewport
    const info = document.createElement("div");
    info.className = "st-short-info";

    const title = document.createElement("div");
    title.className = "st-short-title";
    title.textContent = video.title || "";

    const chan = document.createElement("div");
    chan.className = "st-short-channel";
    chan.textContent = video.channel || "";

    info.appendChild(title);
    info.appendChild(chan);
    item.appendChild(info);
    return item;
  }

  function setupShortsObserver() {
    if (!("IntersectionObserver" in window)) return;
    if (shortsObserver) shortsObserver.disconnect();

    shortsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const item = entry.target;
        const vid = item.dataset.videoId;
        if (!vid) return;

        if (entry.isIntersecting) {
          // Lazy-load iframe
          if (!item.querySelector("iframe")) {
            const iframe = document.createElement("iframe");
            iframe.className = "st-short-frame";
            iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?autoplay=1&mute=1&rel=0&loop=1&playlist=${encodeURIComponent(vid)}`;
            iframe.allow = "autoplay; encrypted-media; picture-in-picture";
            iframe.allowFullscreen = true;
            iframe.title = "Short";
            item.insertBefore(iframe, item.firstChild);
          }
        } else {
          // Stop out-of-view iframe by clearing src
          const iframe = item.querySelector("iframe");
          if (iframe) iframe.src = "";
        }
      });
    }, { root: shortsFeed, threshold: 0.6 });

    shortsFeed.querySelectorAll(".st-short-item").forEach(item => shortsObserver.observe(item));
  }

  // -------------------------------------------------------------------------
  // Settings panel
  // -------------------------------------------------------------------------
  function openSettings() {
    settingsPageSize.value = String(settings.pageSize);
    settingsPlaylistId.value = settings.playlistId || "";
    settingsPanel.hidden = false;
    settingsClose.focus();
  }

  function closeSettings() {
    settingsPanel.hidden = true;
  }

  settingsBtn.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  settingsBackdrop.addEventListener("click", closeSettings);

  settingsSave.addEventListener("click", () => {
    const ps = parseInt(settingsPageSize.value, 10);
    settings.pageSize = (!isNaN(ps) && ps >= 1 && ps <= 50) ? ps : 6;
    settings.playlistId = settingsPlaylistId.value.trim().slice(0, 128);
    saveSettings(settings);
    closeSettings();
    // Reload current view with new settings
    if (currentView === "home") loadHome("");
  });

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!watchModal.hidden) { closeWatch(); return; }
      if (!shortsOverlay.hidden) { closeShorts(); return; }
      if (!settingsPanel.hidden) { closeSettings(); return; }
    }
  });

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  // Init settings UI
  settingsPageSize.value = String(settings.pageSize);
  settingsPlaylistId.value = settings.playlistId || "";

  // Load home feed
  loadHome("");

})();
