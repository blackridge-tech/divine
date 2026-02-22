(function () {
  const tabBtns       = document.querySelectorAll('.tab-btn');
  const editors       = document.querySelectorAll('.code-area');
  const runBtn        = document.getElementById('run-btn');
  const frame         = document.getElementById('preview-frame');
  const editorSection = document.getElementById('editor-section');
  const previewSection= document.getElementById('preview-section');
  const dragDiv       = document.getElementById('drag-divider');

  // Tab switching
  tabBtns.forEach(b => {
    if (b.dataset.tab) b.addEventListener('click', () => {
      tabBtns.forEach(x => x.classList.toggle('active', x.dataset.tab === b.dataset.tab));
      editors.forEach(e => e.classList.toggle('hidden', e.dataset.tab !== b.dataset.tab));
    });
  });

  // Build & run
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
  runPreview();

  // Secret: typing !activate in any editor redirects to /activate
  editors.forEach(ed => {
    ed.addEventListener('input', function () {
      if (this.value.includes('!activate')) location.href = '/activate';
    });
  });

  // Tab key → 2-space indent
  editors.forEach(ed => {
    ed.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = this.selectionStart;
      this.value = this.value.slice(0, s) + '  ' + this.value.slice(this.selectionEnd);
      this.selectionStart = this.selectionEnd = s + 2;
    });
  });

  // Vertical drag-to-resize
  let dragging = false;
  dragDiv.addEventListener('mousedown', e => {
    dragging = true;
    dragDiv.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const shell = dragDiv.parentElement;
    const rect  = shell.getBoundingClientRect();
    // Reserve header height
    const headerH = shell.querySelector('.tool-header')?.offsetHeight || 42;
    const usable  = rect.height - headerH - dragDiv.offsetHeight;
    const offsetY = e.clientY - rect.top - headerH;
    const pct = Math.max(20, Math.min(80, (offsetY / usable) * 100));
    editorSection.style.height = pct + '%';
    previewSection.style.flex  = 'none';
    previewSection.style.height = (100 - pct) + '%';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    dragDiv.classList.remove('dragging');
  });
})();
