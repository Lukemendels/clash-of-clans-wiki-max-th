function buildModel() {
  if(!state.village||!state.data)return null;
  const parsed=parseVillage(state.village);
  const builders=buildUpgradeChains(parsed), heroes=heroChains(parsed), labs=labChains(parsed), pets=petChains(parsed);
  const wall=wallModel(parsed);
  const builderSchedule=scheduleBuilders(builders,heroes,parsed,wall);
  const labSchedule=scheduleSingleLane(labs,parsed,'lab');
  const petSchedule=scheduleSingleLane(pets,parsed,'pet');
  const phases=[1,2,3,4].map(n=>({n,name:phaseName(n),description:phaseDescription(n),progress:phaseProgress(parsed,n)}));
  const currentPhase=phases.find(p=>p.progress.pct<100)?.n||5;
  const allBuilderTasks=builderSchedule.lanes.flatMap(l=>l.queue);
  const phaseEnd=n=>Math.max(0,...allBuilderTasks.filter(t=>t.phase===n).map(t=>t.end));
  const nonHeroActive=parsed.active.filter(x=>!x.extra && ['building','trap'].includes(x.kind));
  const builderEnd=Math.max(Date.now(),...allBuilderTasks.filter(t=>t.type!=='hero').map(t=>t.end),...nonHeroActive.map(activeFinish));
  const heroEnd=Math.max(Date.now(),...allBuilderTasks.filter(t=>t.type==='hero').map(t=>t.end),...parsed.active.filter(x=>x.kind==='hero').map(activeFinish));
  const thReady=Math.max(builderEnd,heroEnd,labSchedule.end,petSchedule.end,wall.eta);
  return {parsed,builders,heroes,labs,pets,builderSchedule,labSchedule,petSchedule,phases,currentPhase,phaseEnd,builderEnd,heroEnd,wall,thReady,
    progress:{heroes:heroProgress(parsed),lab:labProgress(parsed),walls:wall,defenses:defenseProgress(parsed)}};
}

function activeLabel(inst) {
  const e=state.data?.byDataId.get(inst.dataId); if(!e)return `Unknown ${inst.dataId}`;
  return `${e.name} ${inst.level} → ${inst.level+1}`;
}
function workerIcon(kind,entity) {
  if(kind==='hero')return '👑'; if(kind==='lab')return '⚗️'; if(kind==='pet')return '🐾';
  if(entity?.id==='hidden-tesla')return '⚡'; if(entity?._category==='trap')return '💣'; if(entity?._category==='defense')return '🛡️'; if(entity?._category==='resource')return '🪙'; return '🔨';
}
function nextTaskForLane(lane) { return lane.queue[0]||null; }
function currentPhaseTaskCount(model,n){ return model.builderSchedule.lanes.flatMap(l=>l.queue).filter(t=>t.phase===n).length; }

function render() {
  state.model=buildModel();
  const has=Boolean(state.model); qs('#emptyState').classList.toggle('hidden',has); qs('#dashboardContent').classList.toggle('hidden',!has);
  qs('#planEmpty').classList.toggle('hidden',has); qs('#planContent').classList.toggle('hidden',!has);
  if(!has){qs('#villageSubtitle').textContent='War-optimized maxing planner';renderMaxList();return;}
  const m=state.model,p=m.parsed;
  qs('#villageSubtitle').textContent=`TH${p.th} · ${p.permanentBuilders} builders${p.activeExtra.length?' + Goblin':''}`;
  const phase=m.phases.find(x=>x.n===m.currentPhase);
  if(phase){qs('#phaseLabel').textContent=`Phase ${phase.n} of 4`;qs('#phaseName').textContent=phase.name;qs('#phaseDescription').textContent=phase.description;qs('#phasePercent').textContent=`${phase.progress.pct}%`;qs('#phaseRing').style.background=`conic-gradient(var(--accent) ${phase.progress.pct*3.6}deg, var(--surface-3) 0deg)`;}
  else {qs('#phaseLabel').textContent='Builder track';qs('#phaseName').textContent='Complete';qs('#phaseDescription').textContent='All permanent builder-track upgrades at this Town Hall are complete.';qs('#phasePercent').textContent='100%';qs('#phaseRing').style.background='conic-gradient(var(--accent) 360deg, var(--surface-3) 0deg)';}
  renderProgress(); renderMilestones(); renderWorkers(); renderPlan(); renderMaxList(); renderImportMeta();
}
function progressCard(label,icon,pr,detail='') { return `<div class="progress-card"><div class="label">${icon} ${escapeHtml(label)}</div><strong>${pr.pct}%</strong><div class="small muted">${escapeHtml(detail)}</div><div class="progress-track"><i style="width:${pr.pct}%"></i></div></div>`; }
function renderProgress(){const m=state.model;qs('#progressGrid').innerHTML=[progressCard('Heroes','👑',m.progress.heroes,'offensive power'),progressCard('Laboratory','⚗️',m.progress.lab,'war-meta first'),progressCard('Walls','🧱',m.progress.walls,state.settings.wallEnabled?`${m.wall.sessions} sessions est.`:'sessions off'),progressCard('Defenses','🛡️',m.progress.defenses,'heavy defenses last')].join('');}
function renderMilestones(){const m=state.model;const firstEnd=m.phaseEnd(1)||Date.now();const items=[['⚔️','Foundation',firstEnd],['👑','Heroes max',m.heroEnd],['⚗️','Lab max',m.labSchedule.end],['🛡️','Defenses max',m.builderEnd],['🏛️','TH ready',m.thReady]];qs('#milestoneGrid').innerHTML=items.map(([i,n,t])=>`<div class="milestone"><span class="icon">${i}</span><strong>${n}</strong><time>${fmtDate(t)}</time><div class="small muted">${fmtDuration(Math.max(0,t-Date.now()))}</div></div>`).join('');}
function renderWorkers(){
  const m=state.model,p=m.parsed; const cards=[];
  for(const lane of m.builderSchedule.lanes){const cur=lane.current&&remainingFromTimer(lane.current.timer)>0?lane.current:null;const next=nextTaskForLane(lane);const label=cur?activeLabel(cur):(next?`${next.entity.name} ${next.from} → ${next.to}`:'Idle');const finish=cur?Date.now()+remainingFromTimer(cur.timer):next?.end;const after=cur?next:lane.queue[1];cards.push(`<div class="worker-card"><div class="worker-icon">${workerIcon(cur?.kind,next?.entity)}</div><div class="worker-main"><strong>Builder ${lane.id} · ${escapeHtml(label)}</strong><div class="next">Next: ${after?escapeHtml(`${after.entity.name} ${after.from} → ${after.to}`):'No queued task'}</div></div><div class="worker-time"><strong>${finish?fmtDuration(Math.max(0,finish-Date.now())):'Free'}</strong><span>${finish?fmtDateTime(finish):''}</span></div></div>`);}
  for(const lane of m.builderSchedule.extra){const a=lane.current;cards.push(`<div class="worker-card"><div class="worker-icon">👺</div><div class="worker-main"><strong>Goblin Builder · ${escapeHtml(activeLabel(a))}</strong><div class="next">Temporary slot — no future task assumed</div></div><div class="worker-time"><strong>${fmtDuration(remainingFromTimer(a.timer))}</strong><span>${fmtDateTime(Date.now()+remainingFromTimer(a.timer))}</span></div></div>`);}
  const la=m.labSchedule.active; const ln=m.labSchedule.queue[0]; cards.push(`<div class="worker-card"><div class="worker-icon">⚗️</div><div class="worker-main"><strong>Laboratory · ${escapeHtml(la?activeLabel(la):(ln?`${ln.entity.name} ${ln.from} → ${ln.to}`:'Max'))}</strong><div class="next">Next: ${ln?escapeHtml(`${ln.entity.name} ${ln.from} → ${ln.to}`):'No research remaining'}</div></div><div class="worker-time"><strong>${la?fmtDuration(remainingFromTimer(la.timer)):(ln?fmtDuration(ln.duration):'Done')}</strong><span>${m.parsed.helper?`Lab Assistant Lv${m.parsed.helper.lvl}`:''}</span></div></div>`);
  if(m.pets.length||p.th>=14){const pa=m.petSchedule.active,pn=m.petSchedule.queue[0];cards.push(`<div class="worker-card"><div class="worker-icon">🐾</div><div class="worker-main"><strong>Pet House · ${escapeHtml(pa?activeLabel(pa):(pn?`${pn.entity.name} ${pn.from} → ${pn.to}`:'No pet upgrade'))}</strong><div class="next">Continuous independent lane</div></div><div class="worker-time"><strong>${pa?fmtDuration(remainingFromTimer(pa.timer)):(pn?fmtDuration(pn.duration):'Done')}</strong><span></span></div></div>`);}
  qs('#workerList').innerHTML=cards.join(''); qs('#workerCount').textContent=`${p.permanentBuilders} permanent${p.activeExtra.length?` + ${p.activeExtra.length} temporary`:''}`;
}
function renderPlan(){
  const m=state.model; if(!m)return;
  qs('#phaseStack').innerHTML=m.phases.map(ph=>`<div class="phase-card"><div class="phase-card-head"><div><div class="eyebrow">Phase ${ph.n}</div><h2>${ph.name}</h2></div><span class="phase-badge">${ph.progress.pct}% · ${plural(currentPhaseTaskCount(m,ph.n),'upgrade')} left</span></div><div class="phase-card-body">${ph.description}</div></div>`).join('');
  const tasks=m.builderSchedule.lanes.flatMap(l=>l.queue.map(t=>({...t,lane:`Builder ${l.id}`}))).sort((a,b)=>a.start-b.start).slice(0,24);
  const lab=m.labSchedule.queue.slice(0,8).map(t=>({...t,lane:'Laboratory'})); const pets=m.petSchedule.queue.slice(0,5).map(t=>({...t,lane:'Pet House'}));
  qs('#queuePreview').innerHTML=[...tasks,...lab,...pets].sort((a,b)=>a.start-b.start).map(t=>`<div class="queue-card"><strong>${escapeHtml(t.entity.name)} ${t.from} → ${t.to}</strong><div class="meta">${t.lane} · ${fmtDateTime(t.start)} · ${fmtDuration(t.duration)}${t.phase?` · Phase ${t.phase}`:''}</div></div>`).join('') || '<div class="empty-card compact">No future tasks remaining.</div>';
}
function currentLevelForEntity(e,parsed){const obs=parsed?.byDataId.get(Number(e.dataId))||[];if(!obs.length)return 0;if(e.id==='wall')return Math.min(...obs.map(x=>x.level));return Math.max(...obs.map(x=>x.level));}
function renderMaxList(){
  if(!state.data){qs('#maxList').innerHTML='<div class="empty-card compact">Loading game data…</div>';return;}
  const th=state.model?.parsed.th||9; qs('#maxTitle').textContent=`TH${th} Max`; const term=qs('#maxSearch')?.value?.trim().toLowerCase()||''; const cat=qs('#maxCategory')?.value||'all';
  const parsed=state.model?.parsed;
  const rows=state.data.entities.filter(e=>e._category!=='townhall' && e._category!=='hero-equipment').map(e=>({e,max:maxLevelAtTH(e,th),current:currentLevelForEntity(e,parsed)})).filter(x=>x.max>0 && (cat==='all'||x.e._category===cat) && (!term||x.e.name.toLowerCase().includes(term))).sort((a,b)=>a.e._category.localeCompare(b.e._category)||a.e.name.localeCompare(b.e.name));
  qs('#maxList').innerHTML=rows.map(({e,max,current})=>{const lr=levelRecord(e,max);const req=levelRequirement(e,lr||{});const status=parsed?`Current ${current||'not built'}${current>=max?' · maxed':''}`:`Max at TH${th}`;return `<div class="max-row"><div><div class="name">${escapeHtml(e.name)}</div><div class="detail">${escapeHtml(status)} · ${escapeHtml(req)}${lr?.researchTime?` · ${fmtDuration(durationMs(lr))}`:''}</div></div><div class="max-level"><strong>Lv ${max}</strong><span>TH${th} max</span></div></div>`;}).join('') || '<div class="empty-card compact">No matching upgrades.</div>';
}
function renderImportMeta(){if(!state.village)return;const p=state.model?.parsed;qs('#importMeta').innerHTML=`Last village export: ${fmtDateTime(importEpoch())}${p?` · TH${p.th} · ${p.permanentBuilders} builders`:''}`;}

async function maybeCelebrate(previous,next){if(!previous||!next)return;const milestones=[['Phase 1',previous.phases?.[0]?.progress?.pct,next.phases?.[0]?.progress?.pct,false],['Heroes',previous.progress?.heroes?.pct,next.progress?.heroes?.pct,false],['Laboratory',previous.progress?.lab?.pct,next.progress?.lab?.pct,false],['Walls',previous.wall?.pct,next.wall?.pct,false]];for(const [name,a,b,big] of milestones)if(a<100&&b===100){confetti(big);toast(`${name} maxed!`);}const prevAll=Math.min(previous.progress?.heroes?.pct||0,previous.progress?.lab?.pct||0,previous.wall?.pct||0,...(previous.phases||[]).map(p=>p.progress?.pct||0));const nextAll=Math.min(next.progress?.heroes?.pct||0,next.progress?.lab?.pct||0,next.wall?.pct||0,...(next.phases||[]).map(p=>p.progress?.pct||0));if(prevAll<100&&nextAll===100){confetti(true);toast(`TH${next.parsed.th} MAXED!`);}}

async function importVillage(raw){
  let v; try{v=JSON.parse(raw.trim());}catch{toast('That is not valid JSON.');return;}
  if(!v?.buildings||!v?.timestamp){toast('This does not look like a Clash village export.');return;}
  const previous=state.model; state.village=v; await dbSet('village',v); render(); await maybeCelebrate(previous,state.model); qs('#jsonInput').value=''; toast(`TH${state.model.parsed.th} imported and replanned.`); switchTab('dashboard');
}
async function saveSettings(){
  state.settings={...state.settings,sleepStart:qs('#sleepStart').value,wakeTime:qs('#wakeTime').value,goldPass:Number(qs('#goldPass').value),autoHelpers:qs('#autoHelpers').checked,wallEnabled:qs('#wallEnabled').checked,wallStart:qs('#wallStart').value,wallMinutes:Number(qs('#wallMinutes').value),wallGold:Number(qs('#wallGold').value),wallElixir:Number(qs('#wallElixir').value)};
  await dbSet('settings',state.settings); render();
}
function loadSettingsUI(){for(const [id,key] of [['sleepStart','sleepStart'],['wakeTime','wakeTime'],['goldPass','goldPass'],['wallStart','wallStart'],['wallMinutes','wallMinutes'],['wallGold','wallGold'],['wallElixir','wallElixir']])qs(`#${id}`).value=state.settings[key];qs('#autoHelpers').checked=Boolean(state.settings.autoHelpers);qs('#wallEnabled').checked=Boolean(state.settings.wallEnabled);}
function switchTab(tab){qsa('.nav-button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));qsa('.tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tab));window.scrollTo({top:0,behavior:'instant'});}
function bindUI(){
  qsa('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));qsa('[data-go]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.go)));
  qs('#importButton').addEventListener('click',()=>importVillage(qs('#jsonInput').value));
  qs('#pasteButton').addEventListener('click',async()=>{try{qs('#jsonInput').value=await navigator.clipboard.readText();toast('Clipboard pasted.');}catch{toast('Clipboard access was blocked — paste manually.');}});
  ['sleepStart','wakeTime','goldPass','autoHelpers','wallEnabled','wallStart','wallMinutes','wallGold','wallElixir'].forEach(id=>qs(`#${id}`).addEventListener('change',saveSettings));
  qs('#maxSearch').addEventListener('input',renderMaxList);qs('#maxCategory').addEventListener('change',renderMaxList);
  qs('#resetButton').addEventListener('click',async()=>{if(!confirm('Forget the saved village on this device?'))return;await dbDelete('village');state.village=null;state.model=null;render();toast('Village removed.');});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;qs('#installButton').classList.remove('hidden');});
  qs('#installButton').addEventListener('click',async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null;qs('#installButton').classList.add('hidden');});
}

async function init(){
  bindUI(); const [settings,village]=await Promise.all([dbGet('settings'),dbGet('village')]); state.settings={...DEFAULT_SETTINGS,...settings};state.village=village||null;loadSettingsUI();renderMaxList();
  try{state.data=await loadGameData();render();}catch(e){console.error(e);qs('#maxList').innerHTML='<div class="empty-card compact">Game data could not load. Reconnect and reload once; it will be cached locally after that.</div>';toast('Could not load Clash game data.');}
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
init();
