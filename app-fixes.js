// Compatibility and UX fixes layered after the core app scripts.
// Keep this small so game-rule corrections can ship without disturbing the scheduler core.

const HERO_CAP_KEYS = {
  'barbarian-king': 'barbarianKing',
  'archer-queen': 'archerQueen',
  'minion-prince': 'minionPrince',
  'grand-warden': 'grandWarden',
  'royal-champion': 'royalChampion',
  'dragon-duke': 'dragonDuke'
};

function maxLevelAtTH(entity, th) {
  if (entity?._category === 'hero') {
    const heroHall = state.data?.byId?.get('hero-hall');
    const key = HERO_CAP_KEYS[entity.id];
    if (!heroHall || !key) return 0;
    const hallLevel = Math.max(0, ...(heroHall.levels || [])
      .filter(level => Number(level.townHallRequired || 1) <= Number(th))
      .map(level => Number(level.level || 0)));
    if (!hallLevel) return 0;
    const hall = levelRecord(heroHall, hallLevel);
    return Number(hall?.heroLevelCaps?.[key] || 0);
  }
  return Math.max(0, ...(entity?.levels || [])
    .filter(level => Number(level.townHallRequired ?? 1) <= Number(th))
    .map(level => Number(level.level) || 0));
}

function actionCountdown(start) {
  const delta = Math.max(0, Number(start || 0) - Date.now());
  return delta <= 60000 ? 'now' : `in ${fmtDuration(delta)}`;
}

function actionWhen(start, verb = 'Upgrade') {
  if (!start) return '';
  if (Number(start) <= Date.now() + 60000) return `${verb} now`;
  return `${verb} ${fmtDateTime(start)} · ${actionCountdown(start)}`;
}

function taskName(task) {
  return task ? `${task.entity.name} ${task.from} → ${task.to}` : '';
}

function nextActions(model) {
  const actions = [];
  for (const lane of model.builderSchedule.lanes) {
    const task = lane.queue[0];
    if (task) actions.push({ start: task.start, lane: `Builder ${lane.id}`, verb: 'Tap Upgrade', task });
  }
  const lab = model.labSchedule.queue[0];
  if (lab) actions.push({ start: lab.start, lane: 'Laboratory', verb: 'Start research', task: lab });
  const pet = model.petSchedule.queue[0];
  if (pet) actions.push({ start: pet.start, lane: 'Pet House', verb: 'Start upgrade', task: pet });
  return actions.filter(a => Number.isFinite(a.start)).sort((a, b) => a.start - b.start);
}

function renderNextActionBanner(model) {
  const workerList = qs('#workerList');
  if (!workerList) return;
  let banner = qs('#nextActionCard');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'nextActionCard';
    banner.className = 'next-action-card';
    workerList.previousElementSibling?.before(banner);
  }
  const action = nextActions(model)[0];
  if (!action) {
    banner.innerHTML = '<div class="next-action-kicker">NEXT ACTION</div><strong>Nothing needs your attention.</strong><div class="next-action-when">All queued lanes are complete.</div>';
    return;
  }
  banner.innerHTML = `
    <div class="next-action-kicker">NEXT ACTION</div>
    <div class="next-action-row">
      <div>
        <strong>${escapeHtml(taskName(action.task))}</strong>
        <span>${escapeHtml(action.lane)}</span>
      </div>
      <div class="next-action-time">
        <strong>${escapeHtml(actionWhen(action.start, action.verb))}</strong>
      </div>
    </div>`;
}

function workerNextBlock(task, verb = 'Tap Upgrade') {
  if (!task) return '<div class="worker-next worker-next-empty"><span>UP NEXT</span><strong>No queued task</strong></div>';
  return `<div class="worker-next"><span>UP NEXT</span><strong>${escapeHtml(taskName(task))}</strong><time>${escapeHtml(actionWhen(task.start, verb))}</time></div>`;
}

function renderWorkers() {
  const m = state.model, p = m.parsed;
  const cards = [];
  renderNextActionBanner(m);

  for (const lane of m.builderSchedule.lanes) {
    const cur = lane.current && remainingFromTimer(lane.current.timer) > 0 ? lane.current : null;
    const next = lane.queue[0] || null;
    const currentLabel = cur ? activeLabel(cur) : 'Free';
    const finish = cur ? Date.now() + remainingFromTimer(cur.timer) : null;
    cards.push(`<div class="worker-card worker-card-v2">
      <div class="worker-icon">${workerIcon(cur?.kind, next?.entity)}</div>
      <div class="worker-main">
        <div class="worker-current"><strong>Builder ${lane.id} · ${escapeHtml(currentLabel)}</strong>${finish ? `<div>Finishes ${escapeHtml(fmtDuration(Math.max(0, finish - Date.now())))} · ${escapeHtml(fmtDateTime(finish))}</div>` : '<div>Available now</div>'}</div>
        ${workerNextBlock(next, 'Tap Upgrade')}
      </div>
    </div>`);
  }

  for (const lane of m.builderSchedule.extra) {
    const a = lane.current;
    const finish = Date.now() + remainingFromTimer(a.timer);
    cards.push(`<div class="worker-card worker-card-v2">
      <div class="worker-icon">👺</div>
      <div class="worker-main">
        <div class="worker-current"><strong>Goblin Builder · ${escapeHtml(activeLabel(a))}</strong><div>Finishes ${escapeHtml(fmtDuration(remainingFromTimer(a.timer)))} · ${escapeHtml(fmtDateTime(finish))}</div></div>
        <div class="worker-next worker-next-empty"><span>TEMPORARY SLOT</span><strong>No future Goblin task assumed</strong></div>
      </div>
    </div>`);
  }

  const la = m.labSchedule.active;
  const ln = m.labSchedule.queue[0] || null;
  const labFinish = la ? Date.now() + remainingFromTimer(la.timer) : null;
  cards.push(`<div class="worker-card worker-card-v2">
    <div class="worker-icon">⚗️</div>
    <div class="worker-main">
      <div class="worker-current"><strong>Laboratory · ${escapeHtml(la ? activeLabel(la) : 'Ready')}</strong>${labFinish ? `<div>Finishes ${escapeHtml(fmtDuration(Math.max(0, labFinish - Date.now())))} · ${escapeHtml(fmtDateTime(labFinish))}</div>` : '<div>Available now</div>'}</div>
      ${workerNextBlock(ln, 'Start research')}
      ${m.parsed.helper ? `<div class="worker-helper">Lab Assistant Lv${m.parsed.helper.lvl}</div>` : ''}
    </div>
  </div>`);

  if (m.pets.length || p.th >= 14) {
    const pa = m.petSchedule.active;
    const pn = m.petSchedule.queue[0] || null;
    const petFinish = pa ? Date.now() + remainingFromTimer(pa.timer) : null;
    cards.push(`<div class="worker-card worker-card-v2">
      <div class="worker-icon">🐾</div>
      <div class="worker-main">
        <div class="worker-current"><strong>Pet House · ${escapeHtml(pa ? activeLabel(pa) : 'Ready')}</strong>${petFinish ? `<div>Finishes ${escapeHtml(fmtDuration(Math.max(0, petFinish - Date.now())))} · ${escapeHtml(fmtDateTime(petFinish))}</div>` : '<div>Available now</div>'}</div>
        ${workerNextBlock(pn, 'Start upgrade')}
      </div>
    </div>`);
  }

  qs('#workerList').innerHTML = cards.join('');
  qs('#workerCount').textContent = `${p.permanentBuilders} permanent${p.activeExtra.length ? ` + ${p.activeExtra.length} temporary` : ''}`;
}

// Heroes run in parallel with the builder phases. They are not themselves
// Phase 1 completion work, even though Phase 1 reserves one builder for them.
function currentPhaseTaskCount(model, n) {
  return model.builderSchedule.lanes
    .flatMap(lane => lane.queue)
    .filter(task => task.type !== 'hero' && task.phase === n).length;
}

function renderMilestones() {
  const m = state.model;
  const foundationTasks = m.builderSchedule.lanes
    .flatMap(lane => lane.queue)
    .filter(task => task.type !== 'hero' && task.phase === 1);
  const foundationComplete = m.phases?.[0]?.progress?.pct === 100;
  const foundationEnd = foundationComplete
    ? Date.now()
    : Math.max(Date.now(), ...foundationTasks.map(task => task.end));
  const items = [
    ['⚔️', 'Foundation', foundationEnd],
    ['👑', 'Heroes max', m.heroEnd],
    ['⚗️', 'Lab max', m.labSchedule.end],
    ['🛡️', 'Defenses max', m.builderEnd],
    ['🏛️', 'TH ready', m.thReady]
  ];
  qs('#milestoneGrid').innerHTML = items.map(([icon, name, time]) => `
    <div class="milestone">
      <span class="icon">${icon}</span>
      <strong>${name}</strong>
      <time>${foundationComplete && name === 'Foundation' ? 'Complete' : fmtDate(time)}</time>
      <div class="small muted">${foundationComplete && name === 'Foundation' ? 'Builder foundation done' : fmtDuration(Math.max(0, time - Date.now()))}</div>
    </div>`).join('');
}

function renderPlan() {
  const m = state.model;
  if (!m) return;
  qs('#phaseStack').innerHTML = m.phases.map(ph => `<div class="phase-card"><div class="phase-card-head"><div><div class="eyebrow">Phase ${ph.n}</div><h2>${ph.name}</h2></div><span class="phase-badge">${ph.progress.pct}% · ${plural(currentPhaseTaskCount(m, ph.n), 'upgrade')} left</span></div><div class="phase-card-body">${ph.description}</div></div>`).join('');
  const tasks = m.builderSchedule.lanes.flatMap(lane => lane.queue.map(task => ({...task, lane: `Builder ${lane.id}`}))).sort((a,b) => a.start-b.start).slice(0,24);
  const lab = m.labSchedule.queue.slice(0,8).map(task => ({...task,lane:'Laboratory'}));
  const pets = m.petSchedule.queue.slice(0,5).map(task => ({...task,lane:'Pet House'}));
  qs('#queuePreview').innerHTML = [...tasks,...lab,...pets].sort((a,b) => a.start-b.start).map(task => {
    const track = task.type === 'hero' ? ' · Hero track' : (task.phase ? ` · Phase ${task.phase}` : '');
    return `<div class="queue-card"><strong>${escapeHtml(task.entity.name)} ${task.from} → ${task.to}</strong><div class="meta">${task.lane} · ${fmtDateTime(task.start)} · ${fmtDuration(task.duration)}${track}</div></div>`;
  }).join('') || '<div class="empty-card compact">No future tasks remaining.</div>';
}

// If cached data made the original render finish unusually quickly, re-render once with the fixes.
queueMicrotask(() => {
  if (state?.data && state?.village && typeof render === 'function') render();
});
