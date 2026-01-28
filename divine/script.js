// script.js — emoji theme toggle, persistence, and global shortcut handler

(function(){
  const STORAGE_KEY = 'divine-theme';
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');

  // Apply theme: 'dark' or 'light'
  function applyTheme(theme){
    if(theme === 'light'){
      root.classList.remove('dark');
      root.classList.add('light');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.textContent = '🌙'; // show moon while in light mode
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      toggle.setAttribute('aria-pressed', 'true');
      toggle.textContent = '☀️'; // show sun while in dark mode
    }
  }

  // Initialize: default to dark unless user preference stored
  const stored = localStorage.getItem(STORAGE_KEY);
  const initial = stored === 'light' ? 'light' : 'dark';
  applyTheme(initial);

  // Toggle handler
  function toggleTheme(){
    const current = root.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ignore */ }
  }

  toggle.addEventListener('click', toggleTheme);
  toggle.addEventListener('keyup', (e) => {
    if(e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleTheme();
    }
  });

  // Ensure accessibility role
  toggle.setAttribute('role', 'button');


  //
  // Shortcut handling (site-wide)
  //
  // Reads config from localStorage key 'divine.settings.shortcut' (same shape as the settings page)
  // and listens for the configured modifier+key combo on every page that includes this script.
  //
  const SHORTCUT_STORAGE = 'divine.settings.shortcut';

  function loadShortcutCfg() {
    try {
      const raw = localStorage.getItem(SHORTCUT_STORAGE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function deleteAccessCookie() {
    const name = 'divine_access';
    // Expire in the past, try both /divine and root paths
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/divine; SameSite=Strict';
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict';
  }

  function activateShortcut(cfg) {
    if (!cfg) return;
    if (cfg.removeAccess) {
      deleteAccessCookie();
      try {
        localStorage.removeItem('divine_failed_attempts');
        localStorage.removeItem('divine_lock_until');
      } catch (e) { /* ignore */ }
    }
    const target = cfg.url || '/divine/';
    // Use location.href so external targets open normally; settings page used replace for testing UX.
    location.href = target;
  }

  // The global key listener — non-invasive: ignores typing in inputs, requires exact modifiers, case-insensitive match
  function globalShortcutListener(e) {
    const cfg = loadShortcutCfg();
    if (!cfg || !cfg.key) return;

    // don't intercept typing when user is focused on text inputs/areas or contenteditable
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
      return;
    }

    // require modifiers if configured
    if (cfg.ctrl && !e.ctrlKey) return;
    if (cfg.alt && !e.altKey) return;
    if (cfg.shift && !e.shiftKey) return;
    if (cfg.search) {
      const hasSearch = e.metaKey || (typeof e.getModifierState === 'function' && e.getModifierState('Search')) || e.key === 'Search';
      if (!hasSearch) return;
    }

    // Only act on single-character keys (we store a single character)
    if (!e.key || e.key.length !== 1) return;
    if (e.repeat) return; // avoid repeats while held down

    if (e.key.toLowerCase() !== String(cfg.key).toLowerCase()) return;

    // Matched! prevent default (e.g., avoid Ctrl+R reload) and activate
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (ex) { /* ignore for older browsers */ }

    activateShortcut(cfg);
  }

  // Attach listener early and in capture so we can intercept system keys like Ctrl+R when desired
  window.addEventListener('keydown', globalShortcutListener, true);

  // Expose debug helper
  window.__divine_shortcut_cfg = loadShortcutCfg;

})();
