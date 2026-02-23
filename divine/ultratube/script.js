/* Ultratube — client-side script */
(function () {
  "use strict";

  // ── Constants ───────────────────────────────────────────────────────────────
  const PAGE_SIZE = 6;
  const LS_SETTINGS  = "ut_settings";
  const LS_HISTORY   = "ut_history";
  const LS_PLAYLIST  = "ut_playlist";

  // ── State ───────────────────────────────────────────────────────────────────
  const state = {
    view: "home",            // "home" | "channel" | "playlist" | "history"
    query: "",
    pageStack: [],           // array of pageTokens for "prev" support
    nextToken: null,
    currentToken: null,
    channelId: null,
    channelNextToken: null,
    channelPageStack: [],
    loading: false,
    settings: loadSettings(),
  };

  // ── Element refs ────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const el = {
    logo:          $("utLogo"),
    searchForm:    $("utSearchForm"),
    searchInput:   $("utSearchInput"),
    settingsBtn:   $("utSettingsBtn"),
    settingsPanel: $("utSettingsPanel"),
    settingRegion: $("utSettingRegion"),
    settingOrder:  $("utSettingOrder"),

    homeView:      $("utHomeView"),
    grid:          $("utGrid"),
    pagination:    $("utPagination"),
    prevBtn:       $("utPrevBtn"),
    nextBtn:       $("utNextBtn"),
    pageLabel:     $("utPageLabel"),

    channelView:   $("utChannelView"),
    channelHeader: $("utChannelHeader"),
    channelGrid:   $("utChannelGrid"),
    chPrevBtn:     $("utChPrevBtn"),
    chNextBtn:     $("utChNextBtn"),
    chPageLabel:   $("utChPageLabel"),
    channelBack:   $("utChannelBack"),

    playlistView:  $("utPlaylistView"),
    playlistList:  $("utPlaylistList"),

    historyView:   $("utHistoryView"),
    historyList:   $("utHistoryList"),

    watchModal:    $("utWatchModal"),
    modalTitle:    $("utModalTitle"),
    modalClose:    $("utModalClose"),
    iframeWrap:    $("utIframeWrap"),

    shortsOverlay: $("utShortsOverlay"),
    shortsClose:   $("utShortsClose"),

    navHome:       $("utNavHome"),
    navShorts:     $("utNavShorts"),
    navPlaylist:   $("utNavPlaylist"),
    navHistory:    $("utNavHistory"),
  };

  // ── Settings ─────────────────────────────────────────────────────────────────
  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_SETTINGS);
      if (raw) return Object.assign({ region: "US", order: "relevance" }, JSON.parse(raw));
    } catch {}
    return { region: "US", order: "relevance" };
  }

  function saveSettings() {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings)); } catch {}
  }

  function applySettingsToUI() {
    el.settingRegion.value = state.settings.region || "US";
    el.settingOrder.value  = state.settings.order  || "relevance";
  }

  el.settingRegion.addEventListener("change", () => {
    state.settings.region = el.settingRegion.value;
    saveSettings();
  });

  el.settingOrder.addEventListener("change", () => {
    state.settings.order = el.settingOrder.value;
    saveSettings();
  });

  // ── Storage helpers (history / playlist) ─────────────────────────────────────
  function storageGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }

  function storageSet(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
  }

  function historyAdd(video) {
    let list = storageGet(LS_HISTORY);
    list = list.filter((v) => v.id !== video.id);
    list.unshift(video);
    if (list.length > 50) list = list.slice(0, 50);
    storageSet(LS_HISTORY, list);
  }

  function playlistToggle(video) {
    let list = storageGet(LS_PLAYLIST);
    if (list.some((v) => v.id === video.id)) {
      list = list.filter((v) => v.id !== video.id);
    } else {
      list.unshift(video);
    }
    storageSet(LS_PLAYLIST, list);
  }

  function playlistHas(id) {
    return storageGet(LS_PLAYLIST).some((v) => v.id === id);
  }

  // ── API helpers ──────────────────────────────────────────────────────────────
  async function apiGet(url) {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Request failed");
    }
    return res.json();
  }

  async function searchVideos(query, pageToken) {
    const params = new URLSearchParams({ query });
    if (pageToken) params.set("pageToken", pageToken);
    if (state.settings.region) params.set("region", state.settings.region);
    if (state.settings.order)  params.set("order",  state.settings.order);
    return apiGet("/api/ultratube/search?" + params.toString());
  }

  async function searchChannel(query) {
    const params = new URLSearchParams({ query });
    return apiGet("/api/ultratube/channelSearch?" + params.toString());
  }

  async function fetchChannel(channelId, pageToken) {
    const params = new URLSearchParams();
    if (pageToken) params.set("pageToken", pageToken);
    if (state.settings.region) params.set("region", state.settings.region);
    const qs = params.toString();
    return apiGet("/api/ultratube/channel/" + encodeURIComponent(channelId) + (qs ? "?" + qs : ""));
  }

  async function searchShorts(pageToken) {
    const params = new URLSearchParams({ query: "#shorts", type: "short" });
    if (pageToken) params.set("pageToken", pageToken);
    if (state.settings.region) params.set("region", state.settings.region);
    return apiGet("/api/ultratube/search?" + params.toString());
  }

  // ── Grid rendering ────────────────────────────────────────────────────────────
  function renderSkeletons(container) {
    container.innerHTML = "";
    for (let i = 0; i < PAGE_SIZE; i++) {
      const s = document.createElement("div");
      s.className = "ultratube-skeleton";
      s.setAttribute("aria-hidden", "true");
      s.innerHTML = `
        <div class="ultratube-skeleton-thumb"></div>
        <div class="ultratube-skeleton-body">
          <div class="ultratube-skeleton-line"></div>
          <div class="ultratube-skeleton-line short"></div>
        </div>`;
      container.appendChild(s);
    }
  }

  function formatSubscribers(n) {
    if (!n) return "";
    const num = parseInt(n, 10);
    if (isNaN(num)) return "";
    if (num >= 1e9) return (num / 1e9).toFixed(1) + "B subscribers";
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M subscribers";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K subscribers";
    return num + " subscribers";
  }

  function formatViews(n) {
    if (!n) return "";
    const num = parseInt(n, 10);
    if (isNaN(num)) return "";
    if (num >= 1e9) return (num / 1e9).toFixed(1) + "B views";
    if (num >= 1e6) return (num / 1e6).toFixed(1) + "M views";
    if (num >= 1e3) return (num / 1e3).toFixed(1) + "K views";
    return num + " views";
  }

  function formatDate(published) {
    if (!published) return "";
    try {
      const d = new Date(published);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    } catch { return ""; }
  }

  function buildCard(video) {
    const card = document.createElement("div");
    card.className = "ultratube-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "Watch " + video.title);

    const thumb = video.thumbnail || "";
    const inPlaylist = playlistHas(video.id);

    card.innerHTML = `
      <div class="ultratube-thumb-wrap">
        <img class="ultratube-thumb" src="${escAttr(thumb)}" alt="${escAttr(video.title)}" loading="lazy" />
        ${video.duration ? `<span class="ultratube-duration">${escHtml(video.duration)}</span>` : ""}
      </div>
      <div class="ultratube-card-body">
        <div class="ultratube-card-title">${escHtml(video.title)}</div>
        <div class="ultratube-card-channel">${escHtml(video.channel || "")}</div>
        <div class="ultratube-card-meta">
          ${video.viewCount ? escHtml(formatViews(video.viewCount)) + " · " : ""}${escHtml(formatDate(video.publishedAt))}
        </div>
      </div>`;

    card.addEventListener("click", () => openWatch(video));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWatch(video); }
    });
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      playlistToggle(video);
    });

    return card;
  }

  function renderGrid(container, videos) {
    container.innerHTML = "";
    if (!videos || videos.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ultratube-empty";
      empty.textContent = "No results found.";
      container.appendChild(empty);
      return;
    }
    videos.forEach((v) => container.appendChild(buildCard(v)));
  }

  // ── Watch modal ───────────────────────────────────────────────────────────────
  function openWatch(video) {
    historyAdd(video);
    el.modalTitle.textContent = video.title;
    el.iframeWrap.innerHTML = `<iframe
      src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1"
      allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen
      title="${escAttr(video.title)}"
    ></iframe>`;
    el.watchModal.hidden = false;
    el.modalClose.focus();
  }

  function closeWatch() {
    el.watchModal.hidden = true;
    el.iframeWrap.innerHTML = "";
  }

  el.modalClose.addEventListener("click", closeWatch);
  el.watchModal.addEventListener("click", (e) => {
    if (e.target === el.watchModal) closeWatch();
  });

  // ── Logo fallback ────────────────────────────────────────────────────────────
  el.logo.addEventListener("error", () => {
    const span = document.createElement("span");
    span.className = "ultratube-logo-fallback";
    span.textContent = "Ultratube";
    el.logo.replaceWith(span);
  });

  // ── Search ────────────────────────────────────────────────────────────────────
  el.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = el.searchInput.value.trim();
    if (!raw) return;

    if (raw.startsWith("@")) {
      // Channel search
      const channelQuery = raw.slice(1).trim();
      if (!channelQuery) return;
      await doChannelSearch(channelQuery);
    } else {
      // Video search — reset stack for new query
      state.query = raw;
      state.pageStack = [];
      state.nextToken = null;
      state.currentToken = null;
      await doSearch(null);
    }
    showView("home");
  });

  async function doSearch(pageToken) {
    if (state.loading) return;
    state.loading = true;
    renderSkeletons(el.grid);
    setNavActive("home");

    try {
      const data = await searchVideos(state.query, pageToken);
      state.nextToken = data.nextPageToken || null;
      state.currentToken = pageToken || null;
      renderGrid(el.grid, data.items || []);
      updatePagination();
    } catch (err) {
      el.grid.innerHTML = `<div class="ultratube-empty">Error: ${escHtml(err.message)}</div>`;
      el.prevBtn.disabled = true;
      el.nextBtn.disabled = true;
    } finally {
      state.loading = false;
    }
  }

  function updatePagination() {
    const hasPrev = state.pageStack.length > 0;
    const hasNext = !!state.nextToken;
    el.prevBtn.disabled = !hasPrev;
    el.nextBtn.disabled = !hasNext;
    const page = state.pageStack.length + 1;
    el.pageLabel.textContent = state.query ? "Page " + page : "";
  }

  el.prevBtn.addEventListener("click", async () => {
    if (state.loading || state.pageStack.length === 0) return;
    state.pageStack.pop(); // remove token for current page
    const tok = state.pageStack.length > 0 ? state.pageStack[state.pageStack.length - 1] : null;
    await doSearch(tok);
  });

  el.nextBtn.addEventListener("click", async () => {
    if (state.loading || !state.nextToken) return;
    state.pageStack.push(state.nextToken);
    await doSearch(state.nextToken);
  });

  // ── Channel search ────────────────────────────────────────────────────────────
  async function doChannelSearch(query) {
    if (state.loading) return;
    state.loading = true;
    renderSkeletons(el.grid);

    try {
      const data = await searchChannel(query);
      const channels = data.items || [];
      if (channels.length === 0) {
        el.grid.innerHTML = `<div class="ultratube-empty">No channel found for "@${escHtml(query)}".</div>`;
        return;
      }
      // Navigate directly to first matching channel
      const ch = channels[0];
      await loadChannel(ch.id);
    } catch (err) {
      el.grid.innerHTML = `<div class="ultratube-empty">Error: ${escHtml(err.message)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  // ── Channel page ──────────────────────────────────────────────────────────────
  async function loadChannel(channelId, pageToken) {
    state.channelId = channelId;
    if (!pageToken) {
      state.channelPageStack = [];
      state.channelNextToken = null;
    }
    state.loading = true;
    renderSkeletons(el.channelGrid);
    showView("channel");

    try {
      const data = await fetchChannel(channelId, pageToken);

      // Render channel header
      const info = data.channel || {};
      const avatar = info.thumbnail || "";
      const name = info.title || channelId;
      const subs = info.subscriberCount ? formatSubscribers(info.subscriberCount) : "";
      el.channelHeader.innerHTML = `
        ${avatar ? `<img class="ultratube-channel-avatar" src="${escAttr(avatar)}" alt="${escAttr(name)}" />` : ""}
        <div>
          <div class="ultratube-channel-name">${escHtml(name)}</div>
          ${info.description ? `<div class="ultratube-channel-meta">${escHtml(info.description.slice(0, 120))}</div>` : ""}
          ${subs ? `<div class="ultratube-channel-meta">${escHtml(subs)}</div>` : ""}
        </div>`;

      state.channelNextToken = data.nextPageToken || null;
      renderGrid(el.channelGrid, data.videos || []);
      updateChannelPagination();
    } catch (err) {
      el.channelGrid.innerHTML = `<div class="ultratube-empty">Error: ${escHtml(err.message)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  function updateChannelPagination() {
    const hasPrev = state.channelPageStack.length > 0;
    const hasNext = !!state.channelNextToken;
    el.chPrevBtn.disabled = !hasPrev;
    el.chNextBtn.disabled = !hasNext;
    const page = state.channelPageStack.length + 1;
    el.chPageLabel.textContent = "Page " + page;
  }

  el.chPrevBtn.addEventListener("click", async () => {
    if (state.loading || state.channelPageStack.length === 0) return;
    state.channelPageStack.pop();
    const tok = state.channelPageStack.length > 0
      ? state.channelPageStack[state.channelPageStack.length - 1]
      : null;
    await loadChannel(state.channelId, tok);
  });

  el.chNextBtn.addEventListener("click", async () => {
    if (state.loading || !state.channelNextToken) return;
    state.channelPageStack.push(state.channelNextToken);
    await loadChannel(state.channelId, state.channelNextToken);
  });

  el.channelBack.addEventListener("click", () => {
    showView("home");
    if (state.query) doSearch(state.currentToken);
  });

  // ── View switching ────────────────────────────────────────────────────────────
  function showView(view) {
    state.view = view;
    el.homeView.hidden    = view !== "home";
    el.channelView.hidden = view !== "channel";
    el.playlistView.hidden = view !== "playlist";
    el.historyView.hidden  = view !== "history";

    if (view === "playlist") renderPlaylist();
    if (view === "history")  renderHistory();

    setNavActive(view);
  }

  function setNavActive(view) {
    [el.navHome, el.navShorts, el.navPlaylist, el.navHistory].forEach((btn) => {
      btn.removeAttribute("aria-current");
    });
    const map = { home: el.navHome, shorts: el.navShorts, playlist: el.navPlaylist, history: el.navHistory };
    if (map[view]) map[view].setAttribute("aria-current", "page");
  }

  // ── Bottom nav ────────────────────────────────────────────────────────────────
  el.navHome.addEventListener("click", () => {
    showView("home");
    if (!state.query) loadTrending();
  });

  el.navShorts.addEventListener("click", () => openShorts());

  el.navPlaylist.addEventListener("click", () => showView("playlist"));

  el.navHistory.addEventListener("click", () => showView("history"));

  // ── Shorts overlay ────────────────────────────────────────────────────────────
  let shortsLoaded = false;

  async function openShorts() {
    el.shortsOverlay.hidden = false;
    el.shortsClose.focus();
    setNavActive("shorts");

    if (!shortsLoaded) {
      shortsLoaded = true;
      el.shortsOverlay.innerHTML = `<button class="ultratube-shorts-close" id="utShortsClose2" type="button" aria-label="Close Shorts">&#xd7;</button>
        <div style="color:var(--muted);text-align:center;padding:40px;min-height:100dvh;display:flex;align-items:center;justify-content:center;">Loading Shorts…</div>`;

      try {
        const data = await searchShorts(null);
        const videos = (data.items || []).slice(0, 8);
        el.shortsOverlay.innerHTML = `<button class="ultratube-shorts-close" id="utShortsClose2" type="button" aria-label="Close Shorts">&#xd7;</button>`;
        videos.forEach((v) => {
          const slide = document.createElement("div");
          slide.className = "ultratube-short-slide";
          slide.innerHTML = `<div class="ultratube-short-iframe-wrap">
            <iframe
              src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=0&loop=1&playlist=${encodeURIComponent(v.id)}"
              allow="autoplay; encrypted-media; fullscreen"
              allowfullscreen
              loading="lazy"
              title="${escAttr(v.title)}"
            ></iframe>
          </div>`;
          el.shortsOverlay.appendChild(slide);
        });
        if (videos.length === 0) {
          el.shortsOverlay.innerHTML += `<div class="ultratube-empty" style="min-height:100dvh;display:flex;align-items:center;justify-content:center;">No Shorts found.</div>`;
        }
      } catch {
        el.shortsOverlay.innerHTML += `<div class="ultratube-empty" style="min-height:100dvh;display:flex;align-items:center;justify-content:center;">Could not load Shorts.</div>`;
      }

      // Re-bind close button after re-render
      const closeBtn = document.getElementById("utShortsClose2");
      if (closeBtn) closeBtn.addEventListener("click", closeShorts);
    }
  }

  function closeShorts() {
    el.shortsOverlay.hidden = true;
    setNavActive(state.view);
  }

  el.shortsClose.addEventListener("click", closeShorts);

  // ── Playlist rendering ────────────────────────────────────────────────────────
  function renderPlaylist() {
    const list = storageGet(LS_PLAYLIST);
    if (list.length === 0) {
      el.playlistList.innerHTML = `<div class="ultratube-empty-state">No videos saved.<br><small>Right-click a video card to add it.</small></div>`;
      return;
    }
    el.playlistList.innerHTML = "";
    list.forEach((v) => el.playlistList.appendChild(buildListItem(v, LS_PLAYLIST)));
  }

  function renderHistory() {
    const list = storageGet(LS_HISTORY);
    if (list.length === 0) {
      el.historyList.innerHTML = `<div class="ultratube-empty-state">No watch history yet.</div>`;
      return;
    }
    el.historyList.innerHTML = "";
    list.forEach((v) => el.historyList.appendChild(buildListItem(v, LS_HISTORY)));
  }

  function buildListItem(video, storageKey) {
    const item = document.createElement("div");
    item.className = "ultratube-list-item";
    item.setAttribute("role", "button");
    item.setAttribute("tabindex", "0");
    item.setAttribute("aria-label", "Watch " + video.title);
    item.innerHTML = `
      <img class="ultratube-list-thumb" src="${escAttr(video.thumbnail || "")}" alt="${escAttr(video.title)}" loading="lazy" />
      <div class="ultratube-list-info">
        <div class="ultratube-list-title">${escHtml(video.title)}</div>
        <div class="ultratube-list-channel">${escHtml(video.channel || "")}</div>
      </div>
      <button class="ultratube-list-remove" type="button" aria-label="Remove from list" title="Remove">&#215;</button>`;

    item.querySelector(".ultratube-list-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      let arr = storageGet(storageKey).filter((v) => v.id !== video.id);
      storageSet(storageKey, arr);
      item.remove();
      if (storageKey === LS_PLAYLIST) renderPlaylist();
      else renderHistory();
    });
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("ultratube-list-remove")) return;
      openWatch(video);
    });
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWatch(video); }
    });
    return item;
  }

  // ── Settings panel toggle ─────────────────────────────────────────────────────
  el.settingsBtn.addEventListener("click", () => {
    const open = !el.settingsPanel.hidden;
    el.settingsPanel.hidden = open;
    el.settingsBtn.setAttribute("aria-expanded", String(!open));
  });

  document.addEventListener("click", (e) => {
    if (!el.settingsPanel.hidden && !el.settingsPanel.contains(e.target) && e.target !== el.settingsBtn) {
      el.settingsPanel.hidden = true;
      el.settingsBtn.setAttribute("aria-expanded", "false");
    }
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    const tag = document.activeElement && document.activeElement.tagName.toLowerCase();
    if (e.key === "/" && tag !== "input" && tag !== "textarea") {
      e.preventDefault();
      el.searchInput.focus();
      el.searchInput.select();
    }
    if (e.key === "Escape") {
      if (!el.watchModal.hidden) { closeWatch(); return; }
      if (!el.shortsOverlay.hidden) { closeShorts(); return; }
      if (!el.settingsPanel.hidden) {
        el.settingsPanel.hidden = true;
        el.settingsBtn.setAttribute("aria-expanded", "false");
      }
    }
  });

  // ── Trending (initial load) ───────────────────────────────────────────────────
  async function loadTrending() {
    if (state.loading) return;
    state.query = "trending";
    state.pageStack = [];
    state.nextToken = null;
    state.currentToken = null;
    await doSearch(null);
  }

  // ── Escape helpers ────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  function escAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  function init() {
    applySettingsToUI();

    // Handle direct /divine/ultratube/channel/:id URL navigation
    const pathParts = window.location.pathname.split("/");
    const chIdx = pathParts.indexOf("channel");
    if (chIdx !== -1 && pathParts[chIdx + 1]) {
      const channelId = pathParts[chIdx + 1];
      loadChannel(channelId);
      return;
    }

    loadTrending();
  }

  init();
})();
