const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  bootstrap: null,
  floor: null,
  currentWorkbench: null,
  currentView: null,
};

const WORKBENCH_LABELS = {
  GENERAL_IDEA_WORKBENCH: ['General / Idea', 'intent · experiment · variant'],
  LOGIC_WORKBENCH: ['Logic', 'draft · edit · compare'],
  VISUAL_WORKBENCH: ['Visual', 'reference · brief · render'],
  BUILD_TEST_WORKBENCH: ['Build / Test', 'matrix · run · regression'],
  DEBUG_INSPECTION_WORKBENCH: ['Debug / Inspection', 'observe · diagnose · verify'],
  PRODUCTION_EVIDENCE_WORKBENCH: ['Production / Evidence', 'candidate · proof · handoff'],
  CODING_WORKBENCH: ['Coding', 'repo · edit · test · diff'],
  RUNTIME_WORKBENCH: ['Runtime', 'observe · interact · evidence'],
};

const SHELL_COMMANDS = [
  'status','capabilities','workbench_floor','workbench_open','checkpoint_dock','reality_screen','big_view','intent_review',
  'idea_create','experiment_create','variant_create','variant_evaluate','experiment_select',
  'logic_create','logic_edit','logic_compare',
  'visual_create','visual_scan','visual_edit','visual_compare','visual_render_packet','visual_verify','image_request','image_result',
  'add_matrix','start_matrix','update_matrix','add_test_run','rerun_test_run','add_golden_case','replay_golden',
  'add_bug','add_attention','update_attention','debug_start','debug_step','debug_complete',
  'production_handoff_prepare',
  'coding_status','coding_list','coding_read','coding_search','coding_diff','coding_apply',
  'runtime_status','runtime_view','runtime_record','runtime_interaction_record','runtime_action',
];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function contextSelector(extra = {}) {
  const workId = $('#work-id').value.trim();
  const checkpointId = $('#checkpoint-id').value.trim();
  return {
    ...(workId ? { workId } : {}),
    ...(checkpointId ? { checkpointId } : {}),
    ...extra,
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.result?.reason || 'FACTORY_API_FAILED');
  return data;
}

async function command(command, args = {}) {
  return api('/api/command', {
    method: 'POST',
    body: JSON.stringify({ command, args }),
  });
}

function setHealth(ok, label) {
  const el = $('#health');
  el.textContent = label;
  el.style.color = ok ? 'var(--good)' : 'var(--bad)';
}

function badge(text, tone = '') {
  return `<span class="badge ${tone}">${esc(text)}</span>`;
}

function truthStatus(value) {
  const status = String(value || 'UNKNOWN').toUpperCase();
  if (['PASS','VERIFIED','ACTIVE','KNOWN','SUPPORTED','OBSERVED'].includes(status)) return 'known';
  if (['FAIL','FAILED','BLOCKED'].includes(status)) return 'failed';
  return 'unknown';
}

function renderMiniReality() {
  const reality = state.bootstrap?.data?.reality_screen?.result;
  if (!reality) return;
  const items = [
    ['Test', reality.observed?.latestTest?.status || 'UNKNOWN'],
    ['Runtime', reality.observed?.latestRuntimeObservation?.status || 'UNKNOWN'],
    ['Evidence', reality.observed?.latestEvidence?.status || 'UNKNOWN'],
    ['Artifact', reality.observed?.latestArtifact?.artifactId || 'UNKNOWN'],
    ['Blocker', reality.attention?.blockerStatus || 'UNKNOWN'],
  ];
  $('#reality-mini').innerHTML = items.map(([name, value]) =>
    `<div class="mini-item"><strong>${esc(name)}</strong><span>${esc(value)}</span></div>`
  ).join('');
  const statuses = items.map(([,value]) => String(value).toUpperCase());
  const overall = statuses.includes('FAIL') || statuses.includes('FAILED') ? 'FAILED'
    : statuses.some((v) => ['PASS','VERIFIED','ACTIVE','OBSERVED'].includes(v)) ? 'KNOWN'
    : 'UNKNOWN';
  const badge = $('#reality-state');
  badge.textContent = overall;
  badge.className = `truth ${truthStatus(overall)}`;
}

function renderFloor() {
  const floor = state.floor;
  const nav = $('#workbench-nav');
  const workbenches = floor?.workbenches || {};
  nav.innerHTML = Object.keys(WORKBENCH_LABELS).map((id) => {
    const [name, detail] = WORKBENCH_LABELS[id];
    const status = workbenches[toFloorKey(id)]?.status || 'UNKNOWN';
    return `<button class="nav-btn" data-workbench="${id}">
      ${esc(name)}
      <small>${esc(detail)} · ${esc(status)}</small>
    </button>`;
  }).join('');
  $$('.nav-btn', nav).forEach((button) => button.addEventListener('click', () => openWorkbench(button.dataset.workbench)));

  const labs = floor?.labs?.experimental || [];
  $('#labs').innerHTML = labs.map((lab) =>
    `<div class="lab-pill">${esc(lab.roomId.replace('ROOM-','LAB '))}<br><span class="muted">${esc(lab.status || 'UNKNOWN')}</span></div>`
  ).join('');
}

function toFloorKey(id) {
  return {
    GENERAL_IDEA_WORKBENCH:'generalIdea',
    LOGIC_WORKBENCH:'logic',
    VISUAL_WORKBENCH:'visual',
    BUILD_TEST_WORKBENCH:'buildTest',
    DEBUG_INSPECTION_WORKBENCH:'debugInspection',
    PRODUCTION_EVIDENCE_WORKBENCH:'productionEvidence',
    CODING_WORKBENCH:'coding',
    RUNTIME_WORKBENCH:'runtime',
  }[id];
}

async function refreshBootstrap() {
  setHealth(true, 'refreshing…');
  const data = await api('/api/bootstrap');
  state.bootstrap = data;
  state.floor = data.data.workbench_floor?.result;
  renderFloor();
  renderMiniReality();
  setHealth(true, 'LOCAL · LIVE');
  if (state.currentWorkbench) await openWorkbench(state.currentWorkbench, { preserveNav: true });
}

function renderGeneric(title, view) {
  $('#workspace').innerHTML = `<div class="generic-grid">
    <section class="data-card"><h3>CURRENT WORKBENCH</h3><pre>${esc(pretty(view))}</pre></section>
    <section class="data-card"><h3>REALITY / EVIDENCE</h3><pre>${esc(pretty(state.bootstrap?.data?.reality_screen?.result || {}))}</pre></section>
    <section class="data-card"><h3>CHECKPOINT DOCK</h3><pre>${esc(pretty(state.bootstrap?.data?.checkpoint_dock?.result || {}))}</pre></section>
    <section class="data-card"><h3>BIG VIEW</h3><pre>${esc(pretty(state.bootstrap?.data?.big_view?.result || {}))}</pre></section>
  </div>`;
}

function artifactUrl(ref) {
  const value = String(ref || '');
  return /^(https?:|data:|blob:)/.test(value) ? value : null;
}

function lineList(value) {
  return String(value || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

async function renderVisual(view) {
  const template = $('#visual-template').content.cloneNode(true);
  $('#workspace').replaceChildren(template);

  const draft = view.draft;
  const packets = view.renderPackets || [];
  const receipts = view.imageReceipts || [];
  const latestPacket = packets.at(-1);
  const latestReceipt = receipts.at(-1);

  $('#visual-source').textContent = draft?.sourceRef || 'No source yet';
  $('#visual-status').textContent = latestReceipt?.status || (draft?.status || 'UNKNOWN');
  $('#visual-status').className = `truth ${truthStatus($('#visual-status').textContent)}`;

  const imageUrl = artifactUrl(latestReceipt?.artifactRef);
  if (imageUrl) {
    $('#visual-canvas').innerHTML = `<img class="canvas-image" alt="Current visual artifact" src="${esc(imageUrl)}">`;
  } else if (latestReceipt?.artifactRef) {
    $('#visual-canvas').innerHTML = `<div class="canvas-placeholder">
      <div class="canvas-mark">✦</div>
      <strong>Artifact returned</strong>
      <span>${esc(latestReceipt.artifactRef)}</span>
    </div>`;
  }

  $('#visual-prompt').value = latestPacket?.intent || '';
  $('#visual-requested').value = latestPacket?.requestedResult || '';
  $('#visual-keep').value = (latestPacket?.mustKeep || []).join('\n');
  $('#visual-remove').value = (latestPacket?.mustRemove || []).join('\n');

  const scans = draft?.scans || [];
  const unknowns = [...new Set([...(view.unknowns || []), ...scans.flatMap((scan) => scan.unknowns || [])])];
  $('#visual-pixie').innerHTML = draft
    ? `<strong>PIXIE scan</strong><br>
       Edits: ${draft.edits?.length || 0} · Scans: ${scans.length}<br>
       Unknown: ${unknowns.length ? esc(unknowns.join(', ')) : 'none recorded'}<br>
       <span class="muted">Source stays locked. Selection is not approval.</span>`
    : `No Visual Draft yet.<br><button id="visual-create" style="margin-top:8px">Create Visual Draft</button>`;

  const history = [
    ...(draft ? [{ label:'ORIGINAL', ref:draft.sourceRef, status:'LOCKED' }] : []),
    ...packets.map((packet, i) => ({ label:`PACKET V${i+1}`, ref:packet.packetId, status:'PREPARED' })),
    ...receipts.map((receipt, i) => ({ label:`IMAGE V${i+1}`, ref:receipt.artifactRef || receipt.receiptId, status:receipt.status })),
  ];
  $('#visual-history').innerHTML = history.length
    ? history.map((item) => `<div class="history-card"><strong>${esc(item.label)}</strong><span>${esc(item.ref)}</span><span>${esc(item.status)}</span></div>`).join('')
    : '<span class="muted">No visual history yet.</span>';

  const create = $('#visual-create');
  if (create) create.addEventListener('click', async () => {
    const sourceRef = window.prompt('Source / reference ref');
    if (!sourceRef) return;
    const visualDraftId = `VIS-${Date.now()}`;
    await command('visual_create', {
      visualDraftId,
      sourceRef,
      sourceVersion: 'ui',
      spec: { brief: '', referenceRoles: ['INSPIRATION'] },
    });
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  });

  $('#visual-prepare').addEventListener('click', async () => {
    if (!draft?.visualDraftId) {
      window.alert('Create a Visual Draft first.');
      return;
    }
    const intent = $('#visual-prompt').value.trim();
    const requestedResult = $('#visual-requested').value.trim();
    if (!intent || !requestedResult) {
      window.alert('Intent and Requested Result are required.');
      return;
    }
    const packetId = `PACKET-${Date.now()}`;
    await command('visual_render_packet', {
      visualDraftId: draft.visualDraftId,
      packet: {
        packetId,
        intent,
        requestedResult,
        mustKeep: lineList($('#visual-keep').value),
        mustRemove: lineList($('#visual-remove').value),
      },
    });
    await command('image_request', {
      packetId,
      request: {
        actionId: `IMG-${Date.now()}`,
        ...contextSelector(),
        requestedBy: 'GO',
      },
    });
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  });
}

async function renderCoding(view) {
  const [status, diff] = await Promise.all([
    command('coding_status').catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
    command('coding_diff').catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
  ]);
  const host = status.result?.executor || {};
  const writeEnabled = host.writeEnabled === true;
  const pushEnabled = host.pushEnabled === true;

  $('#workspace').innerHTML = `<div class="generic-grid">
    <section class="data-card"><h3>CODING HOST</h3><pre>${esc(pretty(status.result))}</pre></section>
    <section class="data-card"><h3>GIT DIFF / STATUS</h3><pre id="coding-diff">${esc(pretty(diff.result))}</pre></section>
    <section class="data-card">
      <h3>SEARCH / READ</h3>
      <div style="display:flex;gap:8px;margin-bottom:8px"><input id="coding-query" style="flex:1" placeholder="function / error / filename"><button id="coding-search">Search</button></div>
      <div style="display:flex;gap:8px"><input id="coding-read-path" style="flex:1" placeholder="path/to/file.mjs"><button id="coding-read">Read</button></div>
      <pre id="coding-search-result"></pre>
    </section>
    <section class="data-card">
      <h3>EDIT → VERIFY → COMMIT → BRANCH PUSH</h3>
      <div class="code-form">
        <label>Branch<input id="coding-branch" placeholder="factory/my-change"></label>
        <label>Base<input id="coding-base" value="main"></label>
        <label>File path<input id="coding-write-path" placeholder="path/to/file.mjs"></label>
        <label>File content<textarea id="coding-write-content" spellcheck="false" placeholder="full file content"></textarea></label>
        <label>Verify argv<input id="coding-run" value="npm test" placeholder="npm test"></label>
        <label>Commit message<input id="coding-commit" placeholder="feat: change"></label>
        <label class="check-row"><input id="coding-push" type="checkbox" ${pushEnabled ? '' : 'disabled'}> Push branch</label>
        <button id="coding-apply" class="primary" ${writeEnabled ? '' : 'disabled'}>Apply on Coding Workbench</button>
        <small class="muted">${writeEnabled
          ? `Write enabled · push ${pushEnabled ? 'enabled' : 'disabled'} · main/master protected`
          : 'Write is disabled on this host. Start Factory Shell with ERGASTERION_CODING_WRITE=1 to enable branch writes.'}</small>
      </div>
      <pre id="coding-apply-result"></pre>
    </section>
  </div>`;

  $('#coding-search').addEventListener('click', async () => {
    const query = $('#coding-query').value.trim();
    if (!query) return;
    const result = await command('coding_search', { query, path: '.', limit: 60 });
    $('#coding-search-result').textContent = pretty(result.result);
  });

  $('#coding-read').addEventListener('click', async () => {
    const path = $('#coding-read-path').value.trim();
    if (!path) return;
    const result = await command('coding_read', { path });
    $('#coding-search-result').textContent = result.result?.result?.content || pretty(result.result);
    $('#coding-write-path').value = path;
    $('#coding-write-content').value = result.result?.result?.content || '';
  });

  $('#coding-apply').addEventListener('click', async () => {
    const branch = $('#coding-branch').value.trim();
    const path = $('#coding-write-path').value.trim();
    const content = $('#coding-write-content').value;
    const commitMessage = $('#coding-commit').value.trim();
    if (!branch || !path || !commitMessage) {
      window.alert('Branch, file path and commit message are required.');
      return;
    }
    const argv = $('#coding-run').value.trim().split(/\s+/).filter(Boolean);
    $('#coding-apply-result').textContent = 'running verification…';
    try {
      const result = await command('coding_apply', {
        branch,
        baseRef: $('#coding-base').value.trim() || 'main',
        writes: [{ path, content }],
        runs: argv.length ? [{ argv, cwd: 'pixie-lab-v1' }] : [],
        commitMessage,
        push: $('#coding-push').checked,
        ...contextSelector(),
      });
      $('#coding-apply-result').textContent = pretty(result.result);
      const freshDiff = await command('coding_diff').catch(() => null);
      if (freshDiff) $('#coding-diff').textContent = pretty(freshDiff.result);
      await refreshBootstrap();
    } catch (error) {
      $('#coding-apply-result').textContent = error.message;
    }
  });
}

async function renderRuntime(view) {
  const [status, runtimeView] = await Promise.all([
    command('runtime_status').catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
    command('runtime_view', { selector: contextSelector() }).catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
  ]);
  $('#workspace').innerHTML = `<div class="generic-grid">
    <section class="data-card"><h3>RUNTIME HOST</h3><pre>${esc(pretty(status.result))}</pre></section>
    <section class="data-card"><h3>LATEST OBSERVATION</h3><pre>${esc(pretty(runtimeView.result))}</pre></section>
    <section class="data-card"><h3>RECORD OBSERVATION</h3>
      <input id="runtime-target" style="width:100%;margin-bottom:8px" placeholder="targetRef e.g. app://candidate">
      <input id="runtime-observed" style="width:100%;margin-bottom:8px" placeholder="observedRef e.g. observer://snapshot">
      <input id="runtime-evidence" style="width:100%;margin-bottom:8px" placeholder="evidence ref (optional)">
      <button id="runtime-record">Record observed reality</button>
    </section>
    <section class="data-card"><h3>WORKBENCH CONTRACT</h3><pre>${esc(pretty(view))}</pre></section>
  </div>`;
  $('#runtime-record').addEventListener('click', async () => {
    const targetRef = $('#runtime-target').value.trim();
    const observedRef = $('#runtime-observed').value.trim();
    if (!targetRef || !observedRef) return;
    const evidenceRef = $('#runtime-evidence').value.trim();
    await command('runtime_record', {
      observationId: `OBS-${Date.now()}`,
      targetRef,
      observedRef,
      status: evidenceRef ? 'PASS' : 'UNKNOWN',
      evidenceRefs: evidenceRef ? [evidenceRef] : [],
      source: 'FACTORY_SHELL',
      ...contextSelector(),
    });
    await refreshBootstrap();
    await openWorkbench('RUNTIME_WORKBENCH');
  });
}

async function openWorkbench(id, { preserveNav = false } = {}) {
  state.currentWorkbench = id;
  $$('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.workbench === id));
  const [name, detail] = WORKBENCH_LABELS[id] || [id, ''];
  $('#stage-kicker').textContent = 'WORKBENCH';
  $('#stage-title').textContent = name;
  $('#stage-subtitle').textContent = detail;
  $('#workspace').innerHTML = '<div class="empty-state"><div class="empty-icon">⚙️</div><h2>Opening current state…</h2></div>';

  const response = await command('workbench_open', { workbenchId: id, selector: contextSelector() });
  const view = response.result;
  state.currentView = view;
  $('#stage-badges').innerHTML = [
    badge(view.status || 'UNKNOWN'),
    badge(view.source || 'projection'),
    badge(view.authority?.approval || 'NOT_AN_APPROVAL'),
  ].join('');

  if (id === 'VISUAL_WORKBENCH') await renderVisual(view);
  else if (id === 'CODING_WORKBENCH') await renderCoding(view);
  else if (id === 'RUNTIME_WORKBENCH') await renderRuntime(view);
  else renderGeneric(name, view);
}

function renderProjection(title, key) {
  const view = state.bootstrap?.data?.[key]?.result || {};
  state.currentWorkbench = null;
  $$('.nav-btn').forEach((button) => button.classList.remove('active'));
  $('#stage-kicker').textContent = 'SHARED SURFACE';
  $('#stage-title').textContent = title;
  $('#stage-subtitle').textContent = 'Read-only projection from current ERGASTERION state and evidence.';
  $('#stage-badges').innerHTML = badge('READ ONLY');
  renderGeneric(title, view);
}

function initCommandConsole() {
  $('#command-name').innerHTML = SHELL_COMMANDS.map((name) => `<option>${esc(name)}</option>`).join('');
  $('#run-command').addEventListener('click', async () => {
    const name = $('#command-name').value;
    let args;
    try { args = JSON.parse($('#command-args').value || '{}'); }
    catch { $('#command-result').textContent = 'Invalid JSON'; return; }
    $('#command-result').textContent = 'running…';
    try {
      const result = await command(name, args);
      $('#command-result').textContent = pretty(result);
      if (result.mutated || result.externalEffect) await refreshBootstrap();
    } catch (error) {
      $('#command-result').textContent = error.message;
    }
  });
}

async function start() {
  initCommandConsole();
  $('#refresh').addEventListener('click', refreshBootstrap);
  $('#open-big').addEventListener('click', () => renderProjection('BIG View', 'big_view'));
  $('#open-reality').addEventListener('click', () => renderProjection('Reality Screen', 'reality_screen'));
  $('#open-checkpoint').addEventListener('click', () => renderProjection('Checkpoint Dock', 'checkpoint_dock'));

  try {
    const health = await api('/api/health');
    setHealth(health.ok, 'LOCAL · READY');
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  } catch (error) {
    setHealth(false, 'OFFLINE');
    $('#workspace').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h2>${esc(error.message)}</h2></div>`;
  }
}

start();
