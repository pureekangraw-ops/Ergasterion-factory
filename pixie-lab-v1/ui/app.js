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
  'visual_create','visual_scan','visual_edit','visual_compare','visual_render_packet','visual_verify','image_request','image_result','visual_dispatch','visual_dispatch_update','visual_receipt','visual_result_import','visual_retry','visual_recover','visual_lineage',
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
  const receipts = [...(view.imageReceipts || []), ...(view.visualReceipts || [])];
  const dispatches = view.visualDispatches || [];
  const latestPacket = packets.at(-1);
  const latestReceipt = receipts.at(-1);
  const spatial = draft?.workingSpec?.spatial || draft?.originalSpec?.spatial || {};
  const references = Array.isArray(spatial.references) ? spatial.references : [];
  const frames = Array.isArray(spatial.focusFrames) ? spatial.focusFrames : [];
  const activeFrame = frames.find((item) => item.id === spatial.activeFocusFrameId) || null;
  const intentLinks = Array.isArray(spatial.intentLinks) ? spatial.intentLinks : [];
  const freezeSet = Array.isArray(spatial.freezeSet) ? spatial.freezeSet : [];
  const exploreSet = Array.isArray(spatial.exploreSet) ? spatial.exploreSet : [];
  const compareNotes = Array.isArray(spatial.compareNotes) ? spatial.compareNotes : [];

  $('#visual-work-id').textContent = contextSelector().workId || 'UNKNOWN';
  $('#visual-checkpoint-id').textContent = contextSelector().checkpointId || 'UNKNOWN';
  $('#visual-source').textContent = draft?.sourceRef || 'No source yet';
  $('#visual-reference-list').innerHTML = references.length
    ? references.map((reference) => `<div class="reference-list-item"><strong>${esc(reference.kind)}</strong><span title="${esc(reference.ref)}">${esc(reference.label)}</span><span class="muted">z${esc(reference.zIndex)}</span></div>`).join('')
    : '<span class="muted">No references placed yet.</span>';
  $('#visual-status').textContent = latestReceipt?.status || (draft?.status || 'UNKNOWN');
  $('#visual-status').className = `truth ${truthStatus($('#visual-status').textContent)}`;
  $('#visual-focus-status').textContent = activeFrame ? `FOCUS · ${activeFrame.label}` : 'No active focus frame';
  $('#visual-focus-frame').innerHTML = frames.length
    ? frames.map((frame) => `<option value="${esc(frame.id)}" ${frame.id === spatial.activeFocusFrameId ? 'selected' : ''}>${esc(frame.label)}</option>`).join('')
    : '<option value="">No frames yet</option>';

  const imageUrl = artifactUrl(latestReceipt?.artifactRef);
  if (imageUrl) {
    $('#visual-canvas').innerHTML = `<img class="canvas-image" alt="Current visual artifact" src="${esc(imageUrl)}">`;
  } else if (latestReceipt?.artifactRef) {
    $('#visual-canvas').innerHTML = `<div class="canvas-placeholder"><div class="canvas-mark">✦</div><strong>Artifact returned</strong><span>${esc(latestReceipt.artifactRef)}</span></div>`;
  }
  const canvas = $('#visual-canvas');
  const boundsStyle = (element, bounds) => {
    element.style.left = `${bounds.x * 100}%`;
    element.style.top = `${bounds.y * 100}%`;
    element.style.width = `${bounds.width * 100}%`;
    element.style.height = `${bounds.height * 100}%`;
  };
  references.forEach((reference) => {
    const node = document.createElement('div');
    node.className = 'reference-node';
    node.dataset.referenceId = reference.id;
    node.style.zIndex = String(reference.zIndex ?? 1);
    boundsStyle(node, reference.bounds);
    const refUrl = artifactUrl(reference.ref);
    node.innerHTML = `<div class="reference-node-header">${esc(reference.label)}</div>${refUrl ? `<img src="${esc(refUrl)}" alt="${esc(reference.label)}">` : `<div class="reference-node-body">${esc(reference.ref)}</div>`}`;
    canvas.append(node);
    let drag = null;
    node.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const rect = canvas.getBoundingClientRect();
      drag = { startX: event.clientX, startY: event.clientY, bounds: { ...reference.bounds }, rect };
      node.setPointerCapture?.(event.pointerId);
    });
    node.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = (event.clientX - drag.startX) / drag.rect.width;
      const dy = (event.clientY - drag.startY) / drag.rect.height;
      const next = { ...drag.bounds, x: Math.min(1 - drag.bounds.width, Math.max(0, drag.bounds.x + dx)), y: Math.min(1 - drag.bounds.height, Math.max(0, drag.bounds.y + dy)) };
      boundsStyle(node, next);
      node.dataset.pendingBounds = JSON.stringify(next);
    });
    node.addEventListener('pointerup', async () => {
      if (!drag) return;
      const next = node.dataset.pendingBounds ? JSON.parse(node.dataset.pendingBounds) : reference.bounds;
      drag = null;
      delete node.dataset.pendingBounds;
      if (JSON.stringify(next) !== JSON.stringify(reference.bounds)) await patchSpatial('references', references.map((item) => item.id === reference.id ? { ...item, bounds: next } : item));
    });
  });
  if (activeFrame) {
    const overlay = document.createElement('div');
    overlay.className = 'focus-frame-overlay';
    boundsStyle(overlay, activeFrame.bounds);
    overlay.innerHTML = `<span>${esc(activeFrame.label)}</span><i class="focus-frame-resize" aria-label="Resize focus frame"></i>`;
    canvas.append(overlay);
    let frameDrag = null;
    overlay.addEventListener('pointerdown', (event) => {
      const rect = canvas.getBoundingClientRect();
      frameDrag = { mode: event.target.classList.contains('focus-frame-resize') ? 'resize' : 'move', startX: event.clientX, startY: event.clientY, bounds: { ...activeFrame.bounds }, rect };
      overlay.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    overlay.addEventListener('pointermove', (event) => {
      if (!frameDrag) return;
      const dx = (event.clientX - frameDrag.startX) / frameDrag.rect.width;
      const dy = (event.clientY - frameDrag.startY) / frameDrag.rect.height;
      const b = frameDrag.bounds;
      const next = frameDrag.mode === 'resize'
        ? { ...b, width: Math.min(1 - b.x, Math.max(0.06, b.width + dx)), height: Math.min(1 - b.y, Math.max(0.06, b.height + dy)) }
        : { ...b, x: Math.min(1 - b.width, Math.max(0, b.x + dx)), y: Math.min(1 - b.height, Math.max(0, b.y + dy)) };
      boundsStyle(overlay, next);
      overlay.dataset.pendingBounds = JSON.stringify(next);
    });
    overlay.addEventListener('pointerup', async () => {
      if (!frameDrag) return;
      const next = overlay.dataset.pendingBounds ? JSON.parse(overlay.dataset.pendingBounds) : activeFrame.bounds;
      frameDrag = null;
      delete overlay.dataset.pendingBounds;
      if (JSON.stringify(next) !== JSON.stringify(activeFrame.bounds)) await patchSpatial('focusFrames', frames.map((frame) => frame.id === activeFrame.id ? { ...frame, bounds: next } : frame));
    });
  }

  $('#visual-prompt').value = latestPacket?.intent || '';
  $('#visual-requested').value = latestPacket?.requestedResult || '';
  $('#visual-keep').value = (latestPacket?.mustKeep || []).join('\n');
  $('#visual-remove').value = (latestPacket?.mustRemove || []).join('\n');
  $('#visual-compare-note').value = compareNotes.at(-1)?.text || '';

  const phase3Host = $('#visual-history')?.parentElement;
  if (phase3Host && !$('#visual-phase3')) {
    const phase3 = document.createElement('section');
    phase3.id = 'visual-phase3';
    phase3.className = 'data-card phase3-transport';
    phase3.innerHTML = `<div class="section-heading"><div><span class="eyebrow">PHASE 3 · RETURN LOOP</span><h3>Generate / Edit transport</h3></div><span class="truth ${truthStatus(view.recovery?.status || 'UNKNOWN')}">${esc(view.recovery?.status || 'UNKNOWN')}</span></div>
      <div class="inline-form"><select id="visual-dispatch-action"><option value="GENERATE">Generate</option><option value="EDIT">Edit</option></select><input id="visual-edit-target" placeholder="Edit target result ref (required for Edit)"><button id="visual-dispatch">Dispatch</button></div>
      <div class="muted">Executor: GO_IMAGE_TOOL · Pixie prepares context only · no winner/branch/production decisions are automatic.</div>
      <div id="visual-dispatch-status" class="phase3-status"></div>
      <div class="inline-form"><input id="visual-receipt-artifact" placeholder="Returned artifact ref"><button id="visual-receive">Record result receipt</button><button id="visual-place-result">Place latest result on table</button></div>
      <div id="visual-lineage-strip" class="provenance-strip"></div>`;
    phase3Host.before(phase3);
  }
  if ($('#visual-dispatch-status')) {
    const latestDispatch = dispatches.at(-1);
    $('#visual-dispatch-status').innerHTML = dispatches.length
      ? dispatches.map((item) => `<span class="spatial-chip"><strong>${esc(item.actionType)} · ${esc(item.status)}</strong><span>${esc(item.dispatchId)} · attempt ${esc(item.attempt)}</span></span>`).join('')
      : '<span class="muted">No dispatch yet.</span>';
    $('#visual-lineage-strip').textContent = latestDispatch
      ? `lineage · ${latestDispatch.visualDraftId} → ${latestDispatch.branchId || 'root'} → ${latestDispatch.packetId} → ${latestDispatch.dispatchId}`
      : 'lineage · UNKNOWN';
  }

  $('#visual-reference-roles').innerHTML = intentLinks.length
    ? intentLinks.filter((link) => link.sourceId === draft?.sourceRef).map((link) => `<span class="spatial-chip"><strong>${esc(link.role)}</strong><span>${esc(link.note || link.sourceId)}</span></span>`).join('')
    : '<span class="muted">Add a role link from the right panel.</span>';
  $('#visual-intent-links').innerHTML = intentLinks.length
    ? intentLinks.map((link) => `<span class="spatial-chip"><strong>${esc(link.role)}</strong><span>${esc(link.sourceId)}${link.note ? ` · ${esc(link.note)}` : ''}</span><button type="button" data-remove-intent="${esc(link.id)}" title="Remove link">×</button></span>`).join('')
    : '<span class="muted">No intent links yet.</span>';
  const renderStateChips = (items, kind) => items.length
    ? items.map((item) => `<span class="spatial-chip"><span>${esc(item)}</span><button type="button" data-remove-state="${kind}" data-state-item="${esc(item)}" title="Remove">×</button></span>`).join('')
    : '<span class="muted">None</span>';
  $('#visual-freeze').innerHTML = renderStateChips(freezeSet, 'freeze');
  $('#visual-explore').innerHTML = renderStateChips(exploreSet, 'explore');

  const scans = draft?.scans || [];
  const unknowns = [...new Set([...(view.unknowns || []), ...scans.flatMap((scan) => scan.unknowns || [])])];
  $('#visual-pixie').innerHTML = draft
    ? `<strong>PIXIE reads the table</strong><br>
       Focus: ${activeFrame ? esc(activeFrame.label) : 'none'} · Links: ${intentLinks.length}<br>
       Freeze: ${freezeSet.length ? esc(freezeSet.join(', ')) : 'none'}<br>
       Explore: ${exploreSet.length ? esc(exploreSet.join(', ')) : 'none'}<br>
       Unknown: ${unknowns.length ? esc(unknowns.join(', ')) : 'none recorded'}<br>
       <span class="muted">Source stays locked. Freeze is context, not approval.</span>`
    : `No Visual Draft yet.<br><button id="visual-create" style="margin-top:8px">Create Visual Draft</button>`;

  const resultRef = (receipt) => receipt.artifactRef || receipt.receiptId;
  const resultRefs = receipts.map(resultRef).filter(Boolean);
  const compareSessions = Array.isArray(spatial.compareSessions) ? spatial.compareSessions : [];
  const activeCompareSession = compareSessions.find((session) => session.compareSessionId === spatial.activeCompareSessionId) || null;
  const compareIds = new Set(activeCompareSession?.selectedResultRefs || []);
  const promotedParts = Array.isArray(spatial.promotedParts) ? spatial.promotedParts : [];
  const semanticRoles = ['FACE', 'LIGHTING', 'COMPOSITION', 'COLOR', 'STYLE', 'OUTFIT', 'BACKGROUND', 'OBJECT', 'POSE', 'TEXTURE', 'NEGATIVE_CONSTRAINT'];

  const history = [
    ...(draft ? [{ label:'ORIGINAL', ref:draft.sourceRef, status:'LOCKED' }] : []),
    ...packets.map((packet, i) => ({ label:`PACKET V${i+1}`, ref:packet.packetId, status:packet.packetVersion === 'V3' ? 'V3 · STRUCTURED' : (packet.focusFrame ? 'FOCUSED' : 'PREPARED') })),
    ...receipts.map((receipt, i) => ({ label:`IMAGE V${i+1}`, ref:resultRef(receipt), status:receipt.status })),
  ];
  $('#visual-history').innerHTML = history.length
    ? history.map((item) => {
        const receipt = receipts.find((candidate) => resultRef(candidate) === item.ref);
        const checked = receipt && compareIds.has(item.ref) ? ' checked' : '';
        return `<div class="history-card"><strong>${esc(item.label)}</strong><span>${esc(item.ref)}</span><span>${esc(item.status)}</span>${receipt ? `<label class="compare-check"><input type="checkbox" data-compare-id="${esc(item.ref)}"${checked}> compare</label>` : ''}</div>`;
      }).join('')
    : '<span class="muted">No visual history yet.</span>';

  const renderPromotedParts = () => {
    $('#visual-promoted-parts').innerHTML = promotedParts.length
      ? promotedParts.map((part) => `<span class="spatial-chip"><strong>${esc(part.role)}</strong><span>${esc(part.sourceResultRef)}${part.note ? ` · ${esc(part.note)}` : ''}</span></span>`).join('')
      : '<span class="muted">Promote a face, light, composition, or other semantic part from a selected result.</span>';
  };
  const renderNextIntent = () => {
    const nextIntent = spatial.nextIntent || spatial.nextIntents?.find((item) => item.nextIntentId === spatial.activeNextIntentId);
    $('#visual-next-intent').textContent = nextIntent ? pretty(nextIntent) : 'Build a Next Intent from this compare session.';
  };
  const renderCompare = () => {
    const selected = receipts.filter((receipt) => compareIds.has(resultRef(receipt))).slice(0, 4);
    $('#visual-compare-grid').innerHTML = selected.length
      ? selected.map((receipt) => {
          const ref = resultRef(receipt);
          const url = artifactUrl(receipt.artifactRef);
          const winner = activeCompareSession?.winnerRef === ref;
          return `<div class="compare-card ${winner ? 'winner' : ''}">${url ? `<img src="${esc(url)}" alt="Selected result">` : '<div class="runtime-shot-empty">No preview</div>'}<strong>${esc(ref)}</strong><span>${esc(receipt.status || 'UNKNOWN')}${winner ? ' · WINNER' : ''}</span><div class="compare-card-actions"><button type="button" data-winner-ref="${esc(ref)}">${winner ? 'Winner' : 'Set winner'}</button><select data-promote-role="${esc(ref)}"><option value="">Promote as…</option>${semanticRoles.map((role) => `<option>${role}</option>`).join('')}</select><input data-promote-note="${esc(ref)}" placeholder="part note"><button type="button" data-promote-ref="${esc(ref)}">Promote</button></div></div>`;
        }).join('')
      : '<span class="muted">Select 2–4 returned results above, then persist the compare session.</span>';
    $('#visual-branch-indicator').textContent = spatial.branch ? `Branch ${spatial.branch.branchId} · from ${spatial.branch.parentVisualDraftId}` : 'No branch selected';
    renderPromotedParts();
    renderNextIntent();
  };
  renderCompare();

  const patchSpatial = async (key, value) => patchSpatialFields({ [key]: value });
  const patchSpatialFields = async (changes) => {
    if (!draft?.visualDraftId) {
      window.alert('Create a Visual Draft first.');
      return;
    }
    for (const [key, value] of Object.entries(changes)) {
      await command('visual_edit', { visualDraftId: draft.visualDraftId, edit: { op: 'SET', path: `spatial.${key}`, value } });
    }
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  };

  $$('[data-compare-id]').forEach((checkbox) => checkbox.addEventListener('change', () => {
    if (checkbox.checked && compareIds.size >= 4) { checkbox.checked = false; return; }
    if (checkbox.checked) compareIds.add(checkbox.dataset.compareId); else compareIds.delete(checkbox.dataset.compareId);
    renderCompare();
  }));
  $('#visual-create-compare').addEventListener('click', async () => {
    const selectedResultRefs = [...compareIds];
    if (selectedResultRefs.length < 2 || selectedResultRefs.length > 4) {
      window.alert('Choose 2–4 results before persisting a compare session.');
      return;
    }
    const sessionId = activeCompareSession?.compareSessionId || `COMPARE-${Date.now()}`;
    const existingWinner = activeCompareSession?.winnerRef && selectedResultRefs.includes(activeCompareSession.winnerRef) ? activeCompareSession.winnerRef : null;
    const session = { compareSessionId: sessionId, selectedResultRefs, winnerRef: existingWinner, compareNoteRefs: activeCompareSession?.compareNoteRefs || [], createdAt: activeCompareSession?.createdAt || new Date().toISOString() };
    const sessions = [...compareSessions.filter((item) => item.compareSessionId !== sessionId), session];
    await patchSpatialFields({ resultRefs, compareSessions: sessions, activeCompareSessionId: sessionId, winnerRef: existingWinner });
  });
  $('#visual-compare-grid').addEventListener('click', async (event) => {
    const winnerButton = event.target.closest('[data-winner-ref]');
    if (winnerButton) {
      if (!activeCompareSession) { window.alert('Persist a compare session first.'); return; }
      const winnerRef = winnerButton.dataset.winnerRef;
      const sessions = compareSessions.map((session) => session.compareSessionId === activeCompareSession.compareSessionId ? { ...session, winnerRef } : session);
      await patchSpatialFields({ winnerRef, compareSessions: sessions });
      return;
    }
    const promoteButton = event.target.closest('[data-promote-ref]');
    if (!promoteButton) return;
    if (!activeCompareSession) { window.alert('Persist a compare session first.'); return; }
    const sourceResultRef = promoteButton.dataset.promoteRef;
    const role = $(`[data-promote-role="${CSS.escape(sourceResultRef)}"]`)?.value;
    if (!role) { window.alert('Choose a semantic role before promoting.'); return; }
    const note = $(`[data-promote-note="${CSS.escape(sourceResultRef)}"]`)?.value.trim() || null;
    const part = { partId: `PART-${Date.now()}`, sourceResultRef, role, note, focusFrameId: activeFrame?.id || null, regionRef: activeFrame ? activeFrame.id : null, visualDraftId: draft.visualDraftId, createdAt: new Date().toISOString() };
    await patchSpatial('promotedParts', [...promotedParts, part]);
  });
  $('#visual-save-compare-note').addEventListener('click', async () => {
    const noteText = $('#visual-compare-note').value.trim();
    if (!noteText) return;
    if (!activeCompareSession) { window.alert('Persist a compare session before saving a linked note.'); return; }
    const noteId = `NOTE-${Date.now()}`;
    const note = { id: noteId, text: noteText, comparedRefs: [...compareIds], compareSessionId: activeCompareSession.compareSessionId, createdAt: new Date().toISOString() };
    const sessions = compareSessions.map((session) => session.compareSessionId === activeCompareSession.compareSessionId ? { ...session, compareNoteRefs: [...new Set([...(session.compareNoteRefs || []), noteId])] } : session);
    await patchSpatial('compareNotes', [...compareNotes, note]);
    await patchSpatialFields({ compareSessions: sessions });
  });
  const buildNextIntent = () => {
    if (!activeCompareSession) return null;
    return { nextIntentId: `NEXT-INTENT-${Date.now()}`, compareSessionId: activeCompareSession.compareSessionId, selectedResultRefs: [...compareIds], winnerRef: activeCompareSession.winnerRef || spatial.winnerRef || null, promotedParts: promotedParts.filter((part) => compareIds.has(part.sourceResultRef)), compareNoteRefs: activeCompareSession.compareNoteRefs || [], freezeSet, exploreSet, focusFrameId: activeFrame?.id || null, intentLinks, createdAt: new Date().toISOString(), visualDraftId: draft.visualDraftId };
  };
  $('#visual-create-branch').addEventListener('click', async () => {
    if (!draft?.visualDraftId || !activeCompareSession) { window.alert('Persist a compare session before creating a branch.'); return; }
    const selectedResultRefs = [...compareIds];
    const nextIntent = buildNextIntent();
    if (!nextIntent) return;
    const branchId = `BRANCH-${Date.now()}`;
    const childId = `VIS-${Date.now()}`;
    const winnerRef = nextIntent.winnerRef || selectedResultRefs[0];
    const branch = { branchId, parentVisualDraftId: draft.visualDraftId, parentResultRefs: selectedResultRefs, promotedParts: nextIntent.promotedParts, inheritedFreezeSet: freezeSet, inheritedExploreSet: exploreSet, inheritedIntentLinks: intentLinks, compareNoteRefs: nextIntent.compareNoteRefs, createdAt: new Date().toISOString() };
    const childSpatial = { references, focusFrames: frames, activeFocusFrameId: spatial.activeFocusFrameId, intentLinks, freezeSet, exploreSet, compareNotes, resultRefs: selectedResultRefs, compareSessions: [{ compareSessionId: `COMPARE-${branchId}`, selectedResultRefs, winnerRef, compareNoteRefs: nextIntent.compareNoteRefs, createdAt: new Date().toISOString() }], activeCompareSessionId: `COMPARE-${branchId}`, winnerRef, promotedParts: nextIntent.promotedParts, branch, nextIntents: [nextIntent], activeNextIntentId: nextIntent.nextIntentId, nextIntent };
    const childSpec = structuredClone(draft.workingSpec || {});
    childSpec.spatial = childSpatial;
    await command('visual_create', { visualDraftId: childId, sourceRef: winnerRef, sourceVersion: `branch:${branchId}`, parentVisualDraftId: draft.visualDraftId, lineage: { parentVisualDraftId: draft.visualDraftId, parentResultRefs: selectedResultRefs, compareSessionId: activeCompareSession.compareSessionId, winnerRef, branchId, createdAt: new Date().toISOString() }, spec: childSpec });
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  });

  $('#visual-add-reference').addEventListener('click', async () => {
    const ref = $('#visual-reference-ref').value.trim();
    if (!ref) return;
    const label = $('#visual-reference-label').value.trim() || ref;
    const index = references.length;
    const reference = { id: `REF-${Date.now()}`, ref, label, kind: 'IMAGE', bounds: { x: 0.04 + (index % 4) * 0.2, y: 0.04 + Math.floor(index / 4) * 0.2, width: 0.18, height: 0.18 }, zIndex: index + 1 };
    await patchSpatial('references', [...references, reference]);
  });

  const create = $('#visual-create');
  if (create) create.addEventListener('click', async () => {
    const sourceRef = window.prompt('Source / reference ref');
    if (!sourceRef) return;
    const visualDraftId = `VIS-${Date.now()}`;
    await command('visual_create', {
      visualDraftId,
      sourceRef,
      sourceVersion: 'ui',
      spec: { brief: '', referenceRoles: ['INSPIRATION'], spatial: { focusFrames: [], intentLinks: [], freezeSet: [], exploreSet: [], resultRefs: [], compareSessions: [], promotedParts: [], nextIntents: [] } },
    });
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  });

  $('#visual-add-frame').addEventListener('click', async () => {
    const label = $('#visual-frame-label').value.trim() || `Focus ${frames.length + 1}`;
    const frame = { id: `FRAME-${Date.now()}`, label, bounds: { x: 0.18, y: 0.18, width: 0.64, height: 0.64 } };
    await patchSpatial('focusFrames', [...frames, frame]);
  });
  $('#visual-use-frame').addEventListener('click', async () => {
    const frameId = $('#visual-focus-frame').value;
    if (frameId) await patchSpatial('activeFocusFrameId', frameId);
  });
  $('#visual-add-link').addEventListener('click', async () => {
    const sourceId = $('#visual-link-source').value.trim() || draft?.sourceRef || 'current-table';
    const role = $('#visual-link-role').value;
    const note = $('#visual-link-note').value.trim();
    const link = { id: `LINK-${Date.now()}`, sourceId, role, note: note || null };
    await patchSpatial('intentLinks', [...intentLinks, link]);
  });
  $('#visual-add-freeze').addEventListener('click', async () => {
    const item = $('#visual-freeze-item').value.trim();
    if (item) await patchSpatialFields({ exploreSet: exploreSet.filter((value) => value !== item), freezeSet: [...new Set([...freezeSet, item])] });
  });
  $('#visual-add-explore').addEventListener('click', async () => {
    const item = $('#visual-explore-item').value.trim();
    if (item) await patchSpatialFields({ freezeSet: freezeSet.filter((value) => value !== item), exploreSet: [...new Set([...exploreSet, item])] });
  });
  $$('[data-remove-intent]').forEach((button) => button.addEventListener('click', async () => {
    await patchSpatial('intentLinks', intentLinks.filter((link) => link.id !== button.dataset.removeIntent));
  }));
  $$('[data-remove-state]').forEach((button) => button.addEventListener('click', async () => {
    const values = button.dataset.removeState === 'freeze' ? freezeSet : exploreSet;
    await patchSpatial(button.dataset.removeState === 'freeze' ? 'freezeSet' : 'exploreSet', values.filter((item) => item !== button.dataset.stateItem));
  }));

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
        focusFrame: activeFrame,
        intentLinks,
        freezeSet,
        exploreSet,
        compareNotes,
        packetVersion: 'V3',
        compareSessionId: activeCompareSession?.compareSessionId || null,
        selectedResultRefs: [...compareIds],
        winnerRef: activeCompareSession?.winnerRef || spatial.winnerRef || null,
        promotedParts,
        branchId: spatial.branch?.branchId || null,
        parentLineage: draft.lineage || null,
        nextIntent: spatial.nextIntent || spatial.nextIntents?.find((item) => item.nextIntentId === spatial.activeNextIntentId) || null,
      },
    });
    const dispatchAction = $('#visual-dispatch-action')?.value || 'GENERATE';
    const editTarget = $('#visual-edit-target')?.value.trim() || null;
    await command('visual_dispatch', {
      visualDraftId: draft.visualDraftId,
      dispatch: {
        dispatchId: `DISPATCH-${Date.now()}`,
        packetId,
        ...contextSelector(),
        actionType: dispatchAction,
        targetResultRef: editTarget,
        sourceResultRefs: editTarget ? [editTarget] : [...compareIds],
        requestedBy: 'PIXIE',
      },
    });
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  });
  $('#visual-dispatch')?.addEventListener('click', async () => {
    $('#visual-prepare')?.click();
  });
  $('#visual-receive')?.addEventListener('click', async () => {
    const dispatch = dispatches.at(-1);
    const artifactRef = $('#visual-receipt-artifact').value.trim();
    if (!dispatch || !artifactRef) { window.alert('A pending dispatch and returned artifact ref are required.'); return; }
    await command('visual_receipt', { dispatchId: dispatch.dispatchId, receipt: { receiptId: `RECEIPT-${Date.now()}`, artifactRef, status: 'RECEIVED', executorIdentity: 'GO_IMAGE_TOOL', evidenceRefs: [`readback://${dispatch.dispatchId}`] } });
    await refreshBootstrap();
    await openWorkbench('VISUAL_WORKBENCH');
  });
  $('#visual-place-result')?.addEventListener('click', async () => {
    const receipt = receipts.filter((item) => item.status === 'LINKED' || item.status === 'RECEIVED').at(-1);
    if (!receipt || !receipt.receiptId || !view.visualReceipts?.length) { window.alert('No linked Phase 3 result is available.'); return; }
    await command('visual_result_import', { receiptId: receipt.receiptId, options: { placeOnTable: true } });
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
  const [status, runtimeView, browserStatus, browserTabs, browserLatest] = await Promise.all([
    command('runtime_status').catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
    command('runtime_view', { selector: contextSelector() }).catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
    api('/api/browser/status').catch((error) => ({ result: { status:'UNAVAILABLE', reason:error.message } })),
    api('/api/browser/tabs').catch(() => ({ tabs: [] })),
    api('/api/browser/latest').catch(() => ({ observation: null })),
  ]);

  const tabs = browserTabs.tabs || [];
  const latest = browserLatest.observation || null;
  const screenshot = latest?.screenshotRef
    ? `<img class="runtime-screenshot" src="/api/browser/screenshot?ref=${encodeURIComponent(latest.screenshotRef)}" alt="Latest observed browser tab">`
    : '<div class="runtime-shot-empty">No screenshot captured yet.</div>';

  const tabCards = tabs.length
    ? tabs.map((tab) => `<button class="runtime-tab-card ${tab.active ? 'active' : ''}" data-runtime-tab="${tab.tabId}">
        <strong>${esc(tab.title || 'Untitled tab')}</strong>
        <span>${esc(tab.url || 'URL unavailable')}</span>
        <small>tab ${tab.tabId} · window ${tab.windowId ?? '?'}${tab.pinned ? ' · pinned' : ''}${tab.active ? ' · ACTIVE' : ''}</small>
      </button>`).join('')
    : '<div class="muted">No Firefox adapter connected yet.</div>';

  $('#workspace').innerHTML = `<div class="runtime-layout">
    <section class="data-card runtime-tabs-card">
      <h3>FIREFOX TABS</h3>
      <div class="runtime-tabs">${tabCards}</div>
    </section>
    <section class="data-card runtime-live-card">
      <h3>LIVE OBSERVATION</h3>
      ${screenshot}
      <pre>${esc(pretty(latest?.page || latest || { status: 'NO_OBSERVATION' }))}</pre>
    </section>
    <section class="data-card"><h3>RUNTIME HOST</h3><pre>${esc(pretty(status.result))}</pre></section>
    <section class="data-card"><h3>BROWSER ADAPTER</h3><pre>${esc(pretty(browserStatus.result))}</pre></section>
    <section class="data-card"><h3>RUNTIME WORKBENCH READBACK</h3><pre>${esc(pretty(runtimeView.result))}</pre></section>
    <section class="data-card"><h3>WORKBENCH CONTRACT</h3><pre>${esc(pretty(view))}</pre></section>
  </div>`;

  $$('.runtime-tab-card').forEach((button) => {
    button.addEventListener('click', async () => {
      const tabId = Number(button.dataset.runtimeTab);
      if (!Number.isInteger(tabId)) return;
      button.disabled = true;
      try {
        await command('runtime_action', {
          action: {
            type: 'activate_tab',
            tabId,
            ...contextSelector(),
          },
        });
        setTimeout(() => { void openWorkbench('RUNTIME_WORKBENCH'); }, 700);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function openWorkbench(id, { preserveNav = false } = {}) {
  state.currentWorkbench = id;
  document.body.classList.toggle('pixie-workbench', id === 'VISUAL_WORKBENCH');
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
