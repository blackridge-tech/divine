(function () {
  // Elements
  const tabBtns    = document.querySelectorAll('.tab-btn');
  const editors    = document.querySelectorAll('.code-area');
  const runBtn     = document.getElementById('run-btn');
  const frame      = document.getElementById('preview-frame');
  const editorSide = document.getElementById('editor-side');
  const previewSide= document.getElementById('preview-side');
  const dragDiv    = document.getElementById('drag-divider');

  // Tab switching
  function switchTab(name) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    editors.forEach(e => e.classList.toggle('hidden', e.dataset.tab !== name));
  }
  tabBtns.forEach(b => {
    if (b.id !== 'run-btn') b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  // Build & run preview
  function buildDoc() {
    const html = document.getElementById('code-html').value;
    const css  = document.getElementById('code-css').value;
    const js   = document.getElementById('code-js').value;
    return '<!doctype html><html><head><meta charset="utf-8"><style>' + css +
           '</style></head><body>' + html + '<script>' + js + '<\/script></body></html>';
  }

  let blobUrl = null;
  function runPreview() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const blob = new Blob([buildDoc()], { type: 'text/html' });
    blobUrl = URL.createObjectURL(blob);
    frame.src = blobUrl;
  }

  runBtn.addEventListener('click', runPreview);
  // Auto-run on load
  runPreview();

  // !activate trigger
  editors.forEach(ed => {
    ed.addEventListener('input', function () {
      if (this.value.includes('!activate')) {
        location.href = '/activate';
      }
    });
  });

  // Tab key -> 2-space indent
  editors.forEach(ed => {
    ed.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s   = this.selectionStart;
      const end = this.selectionEnd;
      this.value = this.value.slice(0, s) + '  ' + this.value.slice(end);
      this.selectionStart = this.selectionEnd = s + 2;
    });
  });

  // Drag-to-resize divider
  let dragging = false;
  if (dragDiv) {
    dragDiv.addEventListener('mousedown', e => {
      dragging = true;
      dragDiv.classList.add('dragging');
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const container = dragDiv.parentElement;
      const rect = container.getBoundingClientRect();
      const pct  = Math.max(20, Math.min(80, ((e.clientX - rect.left) / rect.width) * 100));
      editorSide.style.width  = pct + '%';
      previewSide.style.flex  = 'none';
      previewSide.style.width = (100 - pct - 0.3) + '%';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      dragDiv.classList.remove('dragging');
    });
  }
})();
