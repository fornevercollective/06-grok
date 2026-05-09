(function () {
  'use strict';
  if (!document.getElementById('nt-blocks')) return;
  var onKbatchCombo = document.documentElement.classList.contains('kbatch-embed-contrails-notes');
  var onNotesPage = document.body && document.body.classList.contains('notes-surface-page');
  if (!onKbatchCombo && !onNotesPage) return;
  var NOTES_SOURCE_APP = onKbatchCombo ? 'kbatch-contrails-notes' : 'notes.html';
  var STORE = 'uvspeed-notes-surface-v3';
  var STORE_V2 = 'uvspeed-notes-surface-v2';
  var LEGACY = 'uvspeed-notes-surface-v1';
  var CELL_TYPES = ['md', 'code', 'math', 'qasm'];
  var TYPE_COLORS = { md: '#3fb950', code: '#58a6ff', math: '#d2a8ff', qasm: '#f0883e' };
  var TYPE_PREFIXES = { md: '+1:', code: '0:', math: '+0:', qasm: '-n:' };
  var blocksEl = document.getElementById('nt-blocks');
  var statusEl = document.getElementById('nt-status');
  var countEl = document.getElementById('nt-sb-count');
  var covEl = document.getElementById('nt-sb-cov');
  var mathRefEl = document.getElementById('nt-math-ref');
  var gateCardsEl = document.getElementById('nt-gate-cards');
  var ctxEl = document.getElementById('nt-context');
  var glueWrap = document.getElementById('nt-glue-wrap');
  var tabName = 'notebook';
  var blocks = [];
  var bcIron = null;
  var bcHex = null;
  var bcDac = null;
  var metaTimer = null;

  try { bcIron = new BroadcastChannel('iron-line'); } catch (e1) {}
  try { bcHex = new BroadcastChannel('hexterm'); } catch (e2) {}
  try { bcDac = new BroadcastChannel('qbit-dac'); } catch (e3) {}

  function uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function defaultLang() {
    var s = document.getElementById('nt-default-lang');
    return s && s.value ? s.value : 'markdown';
  }

  function langFromBlock(b) {
    var t = b.type || 'md';
    if (t === 'md' || t === 'math') return 'markdown';
    if (t === 'qasm') return 'qasm';
    return 'javascript';
  }

  function badgePrefix(b) {
    if ((b.type || 'md') === 'md' && /^\s*#/.test(b.text || '')) return '#';
    return TYPE_PREFIXES[b.type || 'md'] || '+1:';
  }

  function prefixBadgeClass(b) {
    var t = b.type || 'md';
    if (t === 'md' && /^\s*#/.test(b.text || '')) return 'nt-p-md';
    return t === 'code' ? 'nt-p-code' : t === 'math' ? 'nt-p-math' : t === 'qasm' ? 'nt-p-qasm' : 'nt-p-md';
  }

  function combinedText() {
    return blocks.map(function (b) { return b.text || ''; }).join('\n\n');
  }

  function ironPing(op, payload) {
    if (!bcIron) return;
    try {
      bcIron.postMessage({ source: 'notes-surface', layer: 'L4', op: op, payload: payload || {}, ts: Date.now() });
    } catch (e) {}
  }

  function showPanel(id, on) {
    var p = document.getElementById(id);
    if (p) p.classList.toggle('nt-show', !!on);
  }

  function pctClassified(meta) {
    if (!meta || !meta.totalLines) return 0;
    return Math.round((meta.classifiedLines / meta.totalLines) * 100);
  }

  function broadcastQuantum(meta) {
    var QP = window.QuantumPrefixes;
    if (!QP || !QP.broadcastState || !meta) return;
    try {
      QP.broadcastState('notes-surface', {
        coverage: pctClassified(meta),
        totalLines: meta.totalLines,
        classifiedLines: meta.classifiedLines,
        prefixCounts: meta.prefixCounts || {},
        role: 'iterative-notes',
        sourceApp: NOTES_SOURCE_APP
      });
    } catch (e) {}
  }

  function scheduleMetaPush() {
    clearTimeout(metaTimer);
    metaTimer = setTimeout(function () {
      var QP = window.QuantumPrefixes;
      if (!QP || !QP.prefixMetadata) return;
      var text = combinedText();
      var hint = defaultLang();
      var lang = QP.detectLanguage ? QP.detectLanguage(text, hint) : hint;
      var meta = QP.prefixMetadata(text, lang);
      if (covEl) covEl.textContent = meta.totalLines ? pctClassified(meta) + '%' : '—';
      broadcastQuantum(meta);
    }, 350);
  }

  function save() {
    try {
      var toStore = blocks.map(function (b) {
        var o = { id: b.id, text: b.text, t: b.t, type: b.type, lang: b.lang };
        if (b.output) o.output = b.output;
        return o;
      });
      localStorage.setItem(STORE, JSON.stringify(toStore));
      if (countEl) countEl.textContent = String(blocks.length);
      if (statusEl) statusEl.textContent = 'saved ' + new Date().toLocaleTimeString();
      scheduleMetaPush();
    } catch (e) {
      if (statusEl) statusEl.textContent = 'save failed';
    }
  }

  function migrateBlock(b) {
    if (b.type && CELL_TYPES.indexOf(b.type) >= 0) return;
    var l = b.lang || 'markdown';
    if (l === 'qasm') b.type = 'qasm';
    else if (l === 'markdown') b.type = 'md';
    else b.type = 'code';
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE) || localStorage.getItem(STORE_V2) || localStorage.getItem(LEGACY);
      if (raw) {
        var d = JSON.parse(raw);
        if (Array.isArray(d)) blocks = d;
      }
    } catch (e) {}
    blocks.forEach(function (b) {
      migrateBlock(b);
      if (!b.lang) b.lang = langFromBlock(b);
    });
    if (!blocks.length) {
      blocks = [{ id: uid(), text: '# Research Notes\n', t: Date.now(), type: 'md', lang: 'markdown' }];
    }
  }

  function removeBlock(id) {
    blocks = blocks.filter(function (b) { return b.id !== id; });
    if (!blocks.length) {
      blocks = [{ id: uid(), text: '', t: Date.now(), type: 'md', lang: 'markdown' }];
    }
    render();
  }

  function escHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMathText(expr) {
    return String(expr)
      .replace(/\\pi|pi|π/gi, 'π')
      .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ')
      .replace(/\\theta/g, 'θ').replace(/\\phi/g, 'φ').replace(/\\psi/g, 'ψ')
      .replace(/\|0>/g, '|0⟩').replace(/\|1>/g, '|1⟩')
      .replace(/\|psi>/gi, '|ψ⟩').replace(/\|phi>/gi, '|φ⟩')
      .replace(/\\otimes/g, '⊗').replace(/\\hbar/g, 'ℏ').replace(/\\infty/g, '∞');
  }

  function execCell(b, el, opts) {
    opts = opts || {};
    var funnelIn = opts.funnelIn != null ? String(opts.funnelIn) : '';
    var out = el.querySelector('.nt-cell-output');
    if (!out) return;
    try {
      var result = '';
      var t = b.type || 'md';
      var plain = '';
      var fin = funnelIn.length
        ? '<span class="out-ok" style="opacity:.85">funnel in (' + funnelIn.length + ' chars) · </span>'
        : '';
      if (t === 'code') {
        var fn = new Function('Math', 'funnel', 'prev', '"use strict";\n' + (b.text || ''));
        var r = fn(Math, funnelIn, funnelIn);
        plain = r !== undefined && r !== null ? String(r) : '';
        result = fin + (r !== undefined
          ? '<span class="out-ok">' + escHTML(String(r)) + '</span>'
          : '<span class="out-ok">✓</span>');
      } else if (t === 'math') {
        var rendered = renderMathText(b.text || '');
        plain = rendered;
        result = fin + '<span class="out-ok">' + rendered + '</span>';
        if (funnelIn) plain = 'in:' + funnelIn.slice(0, 120) + (funnelIn.length > 120 ? '…' : '') + ' | ' + plain;
      } else if (t === 'qasm') {
        var lines = (b.text || '').split('\n');
        var gates = 0, qregs = 0, cregs = 0;
        lines.forEach(function (l) {
          l = l.trim();
          if (/^(h|x|y|z|cx|cz|s|t|rx|ry|rz|swap|ccx|measure)\s/i.test(l)) gates++;
          if (/^qreg/i.test(l)) qregs++;
          if (/^creg/i.test(l)) cregs++;
        });
        plain = 'QASM qreg:' + qregs + ' creg:' + cregs + ' gates:' + gates;
        result = fin + '<span class="out-ok">QASM: ' + qregs + ' qreg · ' + cregs + ' creg · ' + gates + ' gates</span>';
        if (funnelIn) plain = plain + ' | in:' + funnelIn.slice(0, 80);
      } else {
        var QP = window.QuantumPrefixes;
        if (QP && QP.prefixMetadata) {
          var meta = QP.prefixMetadata(b.text || '', 'markdown');
          plain = 'md ' + meta.classifiedLines + '/' + meta.totalLines + ' · ' + pctClassified(meta) + '%';
          result = fin + '<span class="out-ok">' + meta.totalLines + ' lines · ' + meta.classifiedLines + ' classified · ' + pctClassified(meta) + '%</span>';
        } else {
          plain = 'md ' + (b.text || '').split('\n').length + ' lines';
          result = fin + '<span class="out-ok">' + (b.text || '').split('\n').length + ' lines</span>';
        }
        if (funnelIn) plain = plain + ' | in:' + funnelIn.slice(0, 80);
      }
      b._lastPlain = plain;
      b.output = result;
      out.innerHTML = result;
      out.classList.add('has-output');
    } catch (err) {
      b._lastPlain = 'Error: ' + err.message;
      b.output = '<span class="out-err">Error: ' + escHTML(err.message) + '</span>';
      out.innerHTML = b.output;
      out.classList.add('has-output');
    }
    save();
  }

  function bindCellInput(ta, b, art) {
    ta.addEventListener('input', function () {
      b.text = ta.value;
      b.t = Date.now();
      var pre = art.querySelector('.nt-cell-prefix');
      if (pre) {
        pre.textContent = badgePrefix(b);
        pre.className = 'nt-cell-prefix ' + prefixBadgeClass(b);
      }
      save();
    });
    ta.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Spacebar') e.stopPropagation();
      if (e.key === 'Tab') { e.preventDefault(); var s = ta.selectionStart, en = ta.selectionEnd; ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(en); ta.selectionStart = ta.selectionEnd = s + 2; }
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); execCell(b, art); }
    });
  }

  function placeholderFor(b) {
    var t = b.type || 'md';
    if (t === 'md') return 'Markdown notes…';
    if (t === 'math') return 'Math expression (e.g. sin(π/4), |ψ⟩ = α|0⟩ + β|1⟩)';
    if (t === 'qasm') return 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];';
    return 'JavaScript — return a value; with ▶ Funnel, prev/funnel = prior cell output';
  }

  function render() {
    if (!blocksEl) return;
    blocksEl.innerHTML = '';
    blocks.forEach(function (b) {
      var art = document.createElement('article');
      art.className = 'nt-cell';
      art.setAttribute('data-id', b.id);
      var head = document.createElement('div');
      head.className = 'nt-cell-head';
      var prefix = document.createElement('span');
      prefix.className = 'nt-cell-prefix ' + prefixBadgeClass(b);
      prefix.textContent = badgePrefix(b);
      var typeBtn = document.createElement('span');
      typeBtn.className = 'nt-cell-type';
      typeBtn.textContent = (b.type || 'md').toUpperCase();
      typeBtn.title = 'Cycle type';
      typeBtn.addEventListener('click', function () {
        var idx = CELL_TYPES.indexOf(b.type || 'md');
        b.type = CELL_TYPES[(idx + 1) % CELL_TYPES.length];
        b.lang = langFromBlock(b);
        typeBtn.textContent = b.type.toUpperCase();
        prefix.textContent = badgePrefix(b);
        prefix.className = 'nt-cell-prefix ' + prefixBadgeClass(b);
        ta.placeholder = placeholderFor(b);
        save();
      });
      var spacer = document.createElement('span');
      spacer.className = 'nt-cell-spacer';
      head.appendChild(prefix);
      head.appendChild(typeBtn);
      head.appendChild(spacer);
      if ((b.type || 'md') !== 'md') {
        var runBtn = document.createElement('button');
        runBtn.type = 'button';
        runBtn.className = 'nt-cell-run';
        runBtn.textContent = '▸ Run';
        runBtn.addEventListener('click', function () { execCell(b, art); });
        head.appendChild(runBtn);
      } else {
        var runMd = document.createElement('button');
        runMd.type = 'button';
        runMd.className = 'nt-cell-run';
        runMd.textContent = '▸ Gutter';
        runMd.title = 'Classify / gutter stats';
        runMd.addEventListener('click', function () { execCell(b, art); });
        head.appendChild(runMd);
      }
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'nt-cell-del';
      del.textContent = '×';
      del.addEventListener('click', function () { removeBlock(b.id); });
      head.appendChild(del);
      var ta = document.createElement('textarea');
      ta.className = 'nt-cell-input';
      ta.value = b.text || '';
      ta.placeholder = placeholderFor(b);
      bindCellInput(ta, b, art);
      var out = document.createElement('div');
      out.className = 'nt-cell-output' + (b.output ? ' has-output' : '');
      if (b.output) out.innerHTML = b.output;
      art.appendChild(head);
      art.appendChild(ta);
      art.appendChild(out);
      blocksEl.appendChild(art);
    });
    save();
  }

  function addBlock(type) {
    var t = type || 'md';
    blocks.push({ id: uid(), text: '', t: Date.now(), type: t, lang: langFromBlock({ type: t }) });
    render();
  }

  function findQasmText() {
    for (var i = 0; i < blocks.length; i++) {
      var t = blocks[i].text || '';
      if (blocks[i].type === 'qasm' || /OPENQASM/i.test(t)) return t;
    }
    return '';
  }

  function switchNotesTab(name) {
    tabName = name || 'notebook';
    var wpBar = document.getElementById('nt-toolbar-wp');
    var nbRun = document.getElementById('nt-toolbar-nb');
    var nbActions = document.getElementById('nt-toolbar-nb-actions');
    var isWorkpad = tabName === 'workpad';
    if (wpBar) wpBar.classList.toggle('nt-hidden', !isWorkpad);
    /* Notebook: run bar (#nt-toolbar-nb) + add bar (#nt-toolbar-nb-actions); Workpad uses wp toolbar only */
    if (nbRun) nbRun.classList.toggle('nt-hidden', isWorkpad);
    if (nbActions) nbActions.classList.toggle('nt-hidden', isWorkpad);
    if (mathRefEl) mathRefEl.classList.toggle('visible', tabName === 'math');
    if (gateCardsEl) gateCardsEl.classList.toggle('visible', tabName === 'gates');
    if (ctxEl) ctxEl.classList.toggle('visible', tabName === 'context');
  }

  function toggleGlue() {
    if (!glueWrap) return;
    var hidden = glueWrap.style.display === 'none';
    glueWrap.style.display = hidden ? 'block' : 'none';
  }

  function updateContextPanel() {
    if (!ctxEl) return;
    ctxEl.innerHTML = '<h4>Notes surface</h4><div class="ctx-state">Tab: ' + tabName + '<br>Blocks: ' + blocks.length + '<br>Funnel: row-major 2-col · <code>prev</code>/<code>funnel</code> in code<br>Iron Line · L4 notepad lane</div>' +
      '<h4 style="margin-top:10px">Quick links</h4>' +
      '<a href="https://quantum.ibm.com" target="_blank" rel="noopener">IBM Quantum</a>' +
      '<a href="https://openqasm.com" target="_blank" rel="noopener">OpenQASM</a>' +
      '<a href="https://docs.quantum.ibm.com" target="_blank" rel="noopener">Qiskit docs</a>' +
      '<a href="uvqbit.html">uvQbit</a><a href="history.html">History</a>';
  }

  function initMathRef() {
    if (!mathRefEl) return;
    var sections = [
      { title: 'Quantum States', items: [
        { sym: '|ψ⟩', label: 'Superposition', insert: '|ψ⟩ = α|0⟩ + β|1⟩' },
        { sym: '|Φ⁺⟩', label: 'Bell state', insert: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2' },
        { sym: '⟨ψ|', label: 'Bra', insert: '⟨ψ|' },
        { sym: '⊗', label: 'Tensor', insert: '⊗' },
        { sym: 'ℏ', label: 'ℏ', insert: 'ℏ' }
      ]},
      { title: 'Gates (Unitary)', items: [
        { sym: 'H', label: 'Hadamard', insert: 'H' },
        { sym: 'X', label: 'Pauli-X', insert: 'X' },
        { sym: 'CX', label: 'CNOT', insert: 'CX' },
        { sym: 'Rₓ', label: 'Rx', insert: 'Rx(θ)' }
      ]}
    ];
    sections.forEach(function (sec) {
      var div = document.createElement('div');
      div.className = 'nt-math-section';
      div.innerHTML = '<h4>' + sec.title + '</h4>';
      sec.items.forEach(function (it) {
        var row = document.createElement('div');
        row.className = 'nt-math-item';
        row.innerHTML = '<span class="mi-sym">' + it.sym + '</span><span>' + escHTML(it.label) + '</span>';
        row.addEventListener('click', function () {
          var last = blocks[blocks.length - 1];
          if (!last) { addBlock('math'); last = blocks[blocks.length - 1]; }
          var el = blocksEl.querySelector('[data-id="' + last.id + '"] .nt-cell-input');
          if (el) {
            var s = el.selectionStart || el.value.length;
            el.value = el.value.substring(0, s) + it.insert + el.value.substring(s);
            last.text = el.value;
            last.t = Date.now();
            el.focus();
            save();
          }
        });
        div.appendChild(row);
      });
      mathRefEl.appendChild(div);
    });
  }

  function initGateCards() {
    if (!gateCardsEl) return;
    var GATE_DATA = [
      { prefix: '0:', name: 'Hadamard', sym: 'H', cat: 'Single', color: '#58a6ff', desc: 'Equal superposition.', matrix: '1/√2 [[1,1],[1,-1]]' },
      { prefix: '+n:', name: 'CNOT', sym: 'CX', cat: 'Multi', color: '#3fb950', desc: 'Entangles two qubits.', matrix: '4×4' },
      { prefix: '-n:', name: 'Measure', sym: 'M', cat: 'Readout', color: '#da3633', desc: 'Born rule collapse.', matrix: '—' }
    ];
    var h = document.createElement('div');
    h.className = 'nt-math-section';
    h.innerHTML = '<h4>Prefix ↔ gate</h4><p style="margin:0 0 8px;font-size:10px;color:var(--qp-text-muted)">Gluelam: quantum gutter symbols align with Iron Line gates.</p>';
    gateCardsEl.appendChild(h);
    GATE_DATA.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'nt-gate-card';
      card.innerHTML = '<div class="gc-head"><span class="gc-prefix" style="color:' + item.color + '">' + item.prefix + '</span><span class="gc-name">' + item.sym + ' ' + item.name + '</span><span class="gc-badge" style="color:' + item.color + ';border-color:' + item.color + '">' + item.cat + '</span></div><div class="gc-desc">' + item.desc + '</div><div class="gc-matrix">' + item.matrix + '</div>';
      card.addEventListener('click', function () {
        var last = blocks[blocks.length - 1];
        if (!last) { addBlock('code'); last = blocks[blocks.length - 1]; }
        var el = blocksEl.querySelector('[data-id="' + last.id + '"] .nt-cell-input');
        if (el) {
          var ins = item.sym;
          var s = el.selectionStart || el.value.length;
          el.value = el.value.substring(0, s) + ins + el.value.substring(s);
          last.text = el.value;
          save();
        }
      });
      gateCardsEl.appendChild(card);
    });
  }

  function onClick(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }
  function onChange(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', fn);
  }

  onClick('nt-add-md', function () { addBlock('md'); });
  onClick('nt-add-code', function () { addBlock('code'); });
  onClick('nt-add-math', function () { addBlock('math'); });
  onClick('nt-add-qasm', function () { addBlock('qasm'); });
  onClick('nt-wp-add-note', function () { addBlock('md'); });
  onClick('nt-wp-add-qasm', function () { addBlock('qasm'); });
  onClick('nt-wp-add-code', function () { addBlock('code'); });
  var splitBtn = document.getElementById('nt-toggle-split');
  if (splitBtn) {
    splitBtn.addEventListener('click', function () {
      if (!blocksEl) return;
      blocksEl.classList.toggle('split-view');
      this.classList.toggle('active', blocksEl.classList.contains('split-view'));
    });
  }
  function runAllRunnable() {
    blocks.forEach(function (b) {
      var el = blocksEl.querySelector('[data-id="' + b.id + '"]');
      if (el) execCell(b, el);
    });
    ironPing('run-all', { mode: 'parallel', n: blocks.length });
  }

  function runFunnelPipeline() {
    var prev = '';
    blocks.forEach(function (b, idx) {
      var el = blocksEl.querySelector('[data-id="' + b.id + '"]');
      if (el) execCell(b, el, { funnelIn: prev });
      prev = b._lastPlain != null ? String(b._lastPlain) : '';
    });
    if (statusEl) statusEl.textContent = 'funnel · ' + blocks.length + ' steps';
    ironPing('funnel', { steps: blocks.length, grid: blocksEl && blocksEl.classList.contains('split-view') ? '2col' : '1col' });
    if (bcHex) try { bcHex.postMessage({ type: 'notes-funnel', n: blocks.length, source: 'notes-surface' }); } catch (e) {}
  }

  onClick('nt-run-all', runAllRunnable);
  onClick('nt-run-funnel', runFunnelPipeline);
  onClick('nt-wp-run-all', runAllRunnable);
  onClick('nt-wp-run-funnel', runFunnelPipeline);
  ['nt-toggle-glue', 'nt-toggle-glue2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', toggleGlue);
  });

  onChange('nt-default-lang', function () {
    if (statusEl) statusEl.textContent = 'export lang → ' + defaultLang();
  });
  onClick('nt-clear', function () {
    if (!confirm('Remove all note blocks on this device?')) return;
    blocks = [{ id: uid(), text: '', t: Date.now(), type: 'md', lang: 'markdown' }];
    render();
    save();
  });
  onClick('nt-export', function () {
    var md = '# Notes export\n\n' + blocks.map(function (b, i) {
      return '## Block ' + (i + 1) + ' (' + (b.type || 'md') + ')\n\n' + (b.text || '').trim() + '\n';
    }).join('\n');
    var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'notes-surface-' + new Date().toISOString().slice(0, 10) + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
    if (bcHex) try { bcHex.postMessage({ type: 'notes-export', fmt: 'md', source: 'notes-surface' }); } catch (e) {}
  });

  onClick('nt-gutter', function () {
    var QP = window.QuantumPrefixes;
    if (!QP) return;
    var text = combinedText();
    var hint = defaultLang();
    var lang = QP.detectLanguage ? QP.detectLanguage(text, hint) : hint;
    var meta = QP.prefixMetadata(text, lang);
    var body = document.getElementById('nt-panel-gutter-body');
    var lines = [
      'language: ' + lang,
      'classified: ' + meta.classifiedLines + ' / ' + meta.totalLines + ' lines (' + pctClassified(meta) + '%)',
      'prefixCounts: ' + JSON.stringify(meta.prefixCounts || {}, null, 2)
    ];
    if (body) body.textContent = lines.join('\n');
    showPanel('nt-panel-gutter', true);
    broadcastQuantum(meta);
    ironPing('prefix-classify', { coverage: pctClassified(meta), totalLines: meta.totalLines });
  });

  onClick('nt-dac', function () {
    var dacCx = window.dacComplexity;
    var text = combinedText();
    var lang = defaultLang();
    var body = document.getElementById('nt-panel-dac-body');
    if (typeof window.prefixDAC === 'function') window.prefixDAC(text, lang, 'notes-surface');
    var parts = [];
    if (dacCx) {
      var cx = dacCx(text, lang);
      parts.push('complexity: ' + (cx && cx.score));
      parts.push('maxDepth: ' + (cx && cx.maxDepth));
      parts.push('printsInLoops: ' + (cx && cx.printsInLoops ? cx.printsInLoops.length : 0));
    }
    if (typeof window.dacStats === 'function') {
      var st = window.dacStats();
      parts.push('dacStats: ' + JSON.stringify(st, null, 2));
    }
    if (body) body.textContent = parts.join('\n\n');
    showPanel('nt-panel-dac', true);
    ironPing('dac', { lang: lang });
    if (bcDac) try { bcDac.postMessage({ type: 'dac-stats', stats: typeof window.dacStats === 'function' ? window.dacStats() : {}, source: 'notes-surface' }); } catch (e) {}
  });

  onClick('nt-steno-btn', function () {
    var codec = window.qbitCodec;
    var body = document.getElementById('nt-panel-steno-body');
    if (!codec || !codec.encode) {
      if (body) body.textContent = 'qbitCodec unavailable';
      showPanel('nt-panel-steno', true);
      return;
    }
    var text = combinedText();
    var lang = defaultLang();
    var r = codec.encode(text, lang, 'notes-surface', {});
    var bits = ['prefixed lines: ' + (r.prefixed ? String(r.prefixed).split('\n').length : 0)];
    if (r.meta) bits.push('DAC meta (ratio): ' + (r.meta.coverage != null ? Math.round(Number(r.meta.coverage) * 100) + '%' : '—'));
    if (r.preflight) bits.push('preflight: ' + r.preflight.verdict + ' · ' + r.preflight.scorePct + '%');
    if (r.steno) bits.push('steno: ' + JSON.stringify(r.steno));
    if (r.prefixed) bits.push('--- sample ---\n' + String(r.prefixed).slice(0, 1200) + (String(r.prefixed).length > 1200 ? '\n…' : ''));
    if (body) body.textContent = bits.join('\n\n');
    showPanel('nt-panel-steno', true);
    ironPing('steno-encode', { lang: lang });
  });

  onClick('nt-preflight-btn', function () {
    var PF = window.QbitPreflight;
    var body = document.getElementById('nt-panel-preflight-body');
    if (!PF || !PF.preflight) {
      if (body) body.textContent = 'QbitPreflight not loaded';
      showPanel('nt-panel-preflight', true);
      return;
    }
    var qasm = findQasmText();
    if (!qasm || qasm.length < 8) {
      if (body) body.textContent = 'No QASM found — set a block to language “qasm” or include OPENQASM in text.';
      showPanel('nt-panel-preflight', true);
      return;
    }
    var rep = PF.preflight(qasm, 'ibm_torino', { shots: 4096 });
    if (body) body.textContent = PF.formatReportText ? PF.formatReportText(rep) : JSON.stringify(rep, null, 2);
    showPanel('nt-panel-preflight', true);
    ironPing('preflight', { verdict: rep.verdict, scorePct: rep.scorePct });
  });

  onClick('nt-export-prefixed', function () {
    var QP = window.QuantumPrefixes;
    if (!QP || !QP.downloadWithPrefixes) return;
    var text = combinedText();
    QP.downloadWithPrefixes(text, 'notes-surface-prefixed.md', defaultLang(), 'notes-surface');
    if (bcHex) try { bcHex.postMessage({ type: 'notes-export', fmt: 'prefixed-md', source: 'notes-surface' }); } catch (e) {}
  });

  onClick('nt-export-qbit', function () {
    var codec = window.qbitCodec;
    if (!codec || !codec.wrap) return;
    var text = combinedText();
    var out = codec.wrap(text, defaultLang(), 'notes-surface', {});
    var blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'notes-surface-' + new Date().toISOString().slice(0, 10) + '.qbit';
    a.click();
    URL.revokeObjectURL(a.href);
    if (bcHex) try { bcHex.postMessage({ type: 'notes-export', fmt: 'qbit', source: 'notes-surface' }); } catch (e) {}
  });

  onClick('nt-export-json', function () {
    var QP = window.QuantumPrefixes;
    if (!QP || !QP.wrapJsonExport) return;
    var payload = QP.wrapJsonExport(
      { app: 'notes-surface', blocks: blocks.length, exported: new Date().toISOString(), cellTypes: blocks.map(function (b) { return b.type || 'md'; }) },
      blocks.map(function (b) { return { content: b.text || '', language: langFromBlock(b) }; }),
      'notes-surface'
    );
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'notes-surface-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function net() {
    var el = document.getElementById('nt-sb-net');
    if (el) el.textContent = navigator.onLine ? 'online' : 'offline';
  }
  net();
  window.addEventListener('online', net);
  window.addEventListener('offline', net);

  initMathRef();
  initGateCards();
  load();
  render();
  switchNotesTab('notebook');
  updateContextPanel();

  var QP = window.QuantumPrefixes;
  if (QP && QP.onStateChange) {
    try {
      QP.onStateChange(function (src) {
        if (src === 'notes-surface' || src === 'kbatch-contrails-notes') return;
        if (statusEl) statusEl.textContent = 'sync: ' + src;
      });
    } catch (e) {}
  }
  if (QP && QP.requestStateSync) try { QP.requestStateSync(); } catch (e2) {}

  if (!document.documentElement.classList.contains('kbatch-embed-contrails-notes') && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /** Footer scratchpad → append a Markdown cell (notes.html and embeds with nt-blocks). */
  window.notesSurfaceAppendFromScratch = function (raw) {
    var text = raw == null ? '' : String(raw).trim();
    if (!text) return false;
    blocks.push({ id: uid(), text: text, t: Date.now(), type: 'md', lang: 'markdown' });
    render();
    save();
    var last = blocks[blocks.length - 1];
    if (blocksEl && last) {
      var ta = blocksEl.querySelector('[data-id="' + last.id + '"] .nt-cell-input');
      if (ta) {
        try { ta.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e1) {}
        try { ta.focus(); } catch (e2) {}
      }
    }
    return true;
  };
})();

window.addEventListener('message', function (ev) {
  try {
    var d = ev.data;
    if (!d || d.type !== 'upl-sync-theme') return;
    if (window.parent === window) return;
    if (ev.source !== window.parent) return;
    document.documentElement.setAttribute('data-theme', d.theme === 'light' ? 'light' : 'dark');
  } catch (e2) {}
});
