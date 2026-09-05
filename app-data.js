const DATA_VERSION = '0.16.0';
const DATA_ROOT = `https://cdn.jsdelivr.net/npm/clash-of-clans-data@${DATA_VERSION}/data/home`;
const TEN_MIN = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const DB_NAME = 'max-th';
const DB_VERSION = 1;

const FILES = {
  'army-buildings': ['army-camp','barracks','blacksmith','dark-barracks','dark-spell-factory','hero-banner','hero-hall','laboratory','pet-house','spell-factory','workshop'],
  'resource-buildings': ['clan-castle','dark-elixir-drill','dark-elixir-storage','elixir-collector','elixir-storage','gold-mine','gold-storage'],
  defenses: ['air-defense','air-sweeper','archer-tower','bomb-tower','builders-hut','cannon','crafting-station','eagle-artillery','firespitter','hidden-tesla','inferno-tower','monolith','mortar','multi-archer-tower','multi-gear-tower','revenge-tower','ricochet-cannon','scattershot','spell-tower','super-wizard-tower','wizard-tower','x-bow'],
  traps: ['air-bomb','bomb','giant-bomb','giga-bomb','seeking-air-mine','skeleton-trap','spring-trap','tornado-trap'],
  troops: ['apprentice-warden','archer','baby-dragon','balloon','barbarian','bowler','dragon','dragon-rider','druid','electro-dragon','electro-titan','furnace','giant','goblin','golem','headhunter','healer','hog-rider','ice-golem','lava-hound','meteor-golem','miner','minion','pekka','root-rider','thrower','valkyrie','wall-breaker','witch','wizard','yeti'],
  spells: ['bat-spell','clone-spell','earthquake-spell','freeze-spell','haste-spell','healing-spell','ice-block-spell','invisibility-spell','jump-spell','lightning-spell','overgrowth-spell','poison-spell','rage-spell','recall-spell','revive-spell','skeleton-spell','totem-spell'],
  'siege-machines': ['battle-blimp','battle-drill','flame-flinger','log-launcher','siege-barracks','stone-slammer','troop-launcher','wall-wrecker'],
  heroes: ['archer-queen','barbarian-king','dragon-duke','grand-warden','minion-prince','royal-champion'],
  pets: ['angry-jelly','diggy','electro-owl','frosty','greedy-raven','lassi','mighty-yak','phoenix','poison-lizard','sneezy','spirit-fox','unicorn'],
  walls: ['wall'],
  'town-hall': ['town-hall']
};

const CATEGORY_BY_FOLDER = {
  'army-buildings':'army', 'resource-buildings':'resource', defenses:'defense', traps:'trap', troops:'troop', spells:'spell',
  'siege-machines':'siege', heroes:'hero', pets:'pet', walls:'wall', 'town-hall':'townhall'
};

const OFFENSIVE_BUILDINGS = new Set(['army-camp','barracks','blacksmith','clan-castle','dark-barracks','dark-spell-factory','hero-banner','hero-hall','laboratory','pet-house','spell-factory','workshop']);
const ECONOMY_BUILDINGS = new Set(['dark-elixir-drill','dark-elixir-storage','elixir-collector','elixir-storage','gold-mine','gold-storage']);
const DEFENSE_PRIORITY = [
  'mortar','wizard-tower','bomb-tower','cannon','archer-tower','air-sweeper','air-defense','builders-hut',
  'x-bow','inferno-tower','eagle-artillery','scattershot','spell-tower','monolith','ricochet-cannon','multi-archer-tower',
  'multi-gear-tower','firespitter','super-wizard-tower','revenge-tower','crafting-station'
];

const META = {
  3:['giant','balloon','archer','wizard','lightning-spell','barbarian','goblin'],
  4:['balloon','giant','wizard','archer','lightning-spell','barbarian','goblin'],
  5:['balloon','wizard','giant','lightning-spell','healing-spell','wall-breaker','archer','barbarian','goblin'],
  6:['balloon','wizard','giant','healing-spell','lightning-spell','wall-breaker','archer','barbarian','goblin'],
  7:['dragon','balloon','rage-spell','lightning-spell','hog-rider','healing-spell','wizard','minion','barbarian','goblin'],
  8:['dragon','balloon','rage-spell','lightning-spell','hog-rider','golem','valkyrie','poison-spell','healing-spell','wizard','barbarian','goblin'],
  9:['dragon','balloon','rage-spell','lightning-spell','lava-hound','hog-rider','witch','poison-spell','freeze-spell','healing-spell','golem','wizard','minion','barbarian','goblin'],
  10:['dragon','balloon','witch','lightning-spell','rage-spell','freeze-spell','miner','hog-rider','healing-spell','bowler','lava-hound','poison-spell','barbarian','goblin'],
  11:['electro-dragon','balloon','dragon','witch','rage-spell','freeze-spell','lightning-spell','bat-spell','ice-golem','bowler','miner','hog-rider','poison-spell','barbarian','goblin'],
  12:['dragon','balloon','electro-dragon','miner','hog-rider','rage-spell','freeze-spell','healing-spell','bat-spell','witch','ice-golem','poison-spell','barbarian','goblin'],
  13:['dragon','balloon','dragon-rider','miner','hog-rider','electro-dragon','rage-spell','freeze-spell','invisibility-spell','bat-spell','witch','headhunter','poison-spell','barbarian','goblin'],
  14:['dragon','balloon','dragon-rider','miner','hog-rider','electro-dragon','rage-spell','freeze-spell','invisibility-spell','clone-spell','witch','headhunter','poison-spell','barbarian','goblin'],
  15:['dragon','balloon','root-rider','dragon-rider','electro-titan','witch','rage-spell','freeze-spell','invisibility-spell','overgrowth-spell','recall-spell','poison-spell','barbarian','goblin'],
  16:['root-rider','dragon','balloon','dragon-rider','electro-titan','druid','rage-spell','freeze-spell','overgrowth-spell','invisibility-spell','recall-spell','poison-spell','barbarian','goblin'],
  17:['dragon','balloon','thrower','root-rider','druid','dragon-rider','electro-titan','rage-spell','freeze-spell','overgrowth-spell','invisibility-spell','revive-spell','poison-spell','barbarian','goblin'],
  18:['dragon','balloon','thrower','root-rider','druid','meteor-golem','dragon-rider','electro-titan','rage-spell','freeze-spell','overgrowth-spell','invisibility-spell','revive-spell','totem-spell','poison-spell','barbarian','goblin']
};

const DEFAULT_SETTINGS = {
  sleepStart:'23:00', wakeTime:'07:00', goldPass:0, autoHelpers:false,
  wallEnabled:false, wallStart:'19:00', wallMinutes:60, wallGold:300000, wallElixir:300000
};

const state = { village:null, settings:{...DEFAULT_SETTINGS}, data:null, model:null, installPrompt:null };

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGet(key) { const db=await openDB(); return new Promise((r,j)=>{const q=db.transaction('kv').objectStore('kv').get(key);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);}); }
async function dbSet(key,val) { const db=await openDB(); return new Promise((r,j)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(val,key);tx.oncomplete=()=>r();tx.onerror=()=>j(tx.error);}); }
async function dbDelete(key) { const db=await openDB(); return new Promise((r,j)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').delete(key);tx.oncomplete=()=>r();tx.onerror=()=>j(tx.error);}); }

const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const clamp = (v,a=0,b=100) => Math.max(a,Math.min(b,v));
const plural = (n,word) => `${n} ${word}${n===1?'':'s'}`;
function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function timeObjMs(t={}) { return (((t.days||0)*24+(t.hours||0))*60+(t.minutes||0))*60000+(t.seconds||0)*1000; }
function durationMs(level) { return timeObjMs(level?.buildTime || level?.researchTime || level?.upgradeTime || level?.trainingTime || {}); }
function applyBoost(ms) { return ms * (1 - Number(state.settings.goldPass||0)/100); }
function pct(done,total) { return total ? clamp(Math.round(done/total*100)) : 100; }
function fmtDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const m=Math.round(ms/60000), d=Math.floor(m/1440), h=Math.floor((m%1440)/60), min=m%60;
  if (d) return `${d}d ${h}h`; if (h) return `${h}h ${min}m`; return `${min}m`;
}
function fmtDate(ms) {
  if (!ms || !Number.isFinite(ms)) return '—';
  const d=new Date(ms); const now=new Date();
  const sameYear=d.getFullYear()===now.getFullYear();
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',...(sameYear?{}:{year:'numeric'})}).format(d);
}
function fmtClock(ms) { return new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date(ms)); }
function fmtDateTime(ms) { return `${fmtDate(ms)} · ${fmtClock(ms)}`; }
function importEpoch(v=state.village) { return (v?.timestamp||Math.floor(Date.now()/1000))*1000; }
function remainingFromTimer(timer,v=state.village) { return Math.max(0, timer*1000 - Math.max(0,Date.now()-importEpoch(v))); }
function toast(msg) { const el=qs('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2200); }
function confetti(big=false) {
  const count=big?90:42;
  for(let i=0;i<count;i++) { const p=document.createElement('i'); p.className='confetti'; p.style.left=`${Math.random()*100}vw`; p.style.setProperty('--drift',`${(Math.random()-.5)*280}px`); p.style.animationDelay=`${Math.random()*.45}s`; p.style.opacity=.55+Math.random()*.45; document.body.appendChild(p); setTimeout(()=>p.remove(),2300); }
}

async function fetchJson(url) {
  const r=await fetch(url,{cache:'force-cache'}); if(!r.ok) throw new Error(`${r.status} ${url}`); return r.json();
}
async function mapLimit(items,limit,fn) {
  const out=new Array(items.length); let cursor=0;
  async function worker(){ while(cursor<items.length){ const i=cursor++; try{out[i]=await fn(items[i]);}catch(e){out[i]=null; console.warn(e);} } }
  await Promise.all(Array.from({length:limit},worker)); return out.filter(Boolean);
}
async function loadGameData() {
  const cacheKey=`gameData:${DATA_VERSION}`;
  const cached=await dbGet(cacheKey); if(cached?.entities?.length) return hydrateGameData(cached.entities);
  const urls=[];
  for(const [folder,names] of Object.entries(FILES)) for(const name of names) urls.push({folder,name,url:`${DATA_ROOT}/${folder}/${name}.json`});
  const entities=await mapLimit(urls,8,async item=>{ const e=await fetchJson(item.url); return {...e,_folder:item.folder,_category:CATEGORY_BY_FOLDER[item.folder],_source:item.url}; });
  if(entities.length<40) throw new Error('Game data could not be loaded.');
  await dbSet(cacheKey,{entities,loadedAt:Date.now()});
  return hydrateGameData(entities);
}
function hydrateGameData(entities) {
  return { entities, byDataId:new Map(entities.map(e=>[Number(e.dataId),e])), byId:new Map(entities.map(e=>[e.id,e])) };
}
function maxLevelAtTH(entity,th) { return Math.max(0,...(entity.levels||[]).filter(l=>(l.townHallRequired??1)<=th).map(l=>Number(l.level)||0)); }
function levelRecord(entity,level) { return (entity.levels||[]).find(l=>Number(l.level)===Number(level)); }
function availableCount(entity,th) {
  const a=entity.availablePerTownHall;
  if(!Array.isArray(a)) return maxLevelAtTH(entity,th)>0?1:0;
  const rows=a.filter(x=>Number(x.townHallLevel)<=th).sort((x,y)=>x.townHallLevel-y.townHallLevel);
  return Number(rows.at(-1)?.count||0);
}
function levelRequirement(entity,level) {
  if (entity._category==='troop' || entity._category==='spell' || entity._category==='siege') return `Lab ${level.laboratoryRequired||'—'}`;
  if (entity._category==='pet') return level.petHouseRequired?`Pet House ${level.petHouseRequired}`:`TH ${level.townHallRequired}`;
  if (entity._category==='hero') return level.heroHallRequired?`Hero Hall ${level.heroHallRequired}`:`TH ${level.townHallRequired}`;
  return `TH ${level.townHallRequired||'—'}`;
}

function expandRecords(records=[],kind='building') {
  const counters=new Map(); const out=[];
  for(const r of records) {
    const n=Math.max(1,Number(r.cnt||1));
    for(let i=0;i<n;i++) {
      const base=`${kind}:${r.data}`; const idx=(counters.get(base)||0)+1; counters.set(base,idx);
      out.push({kind,dataId:Number(r.data),level:Number(r.lvl||0),timer:Number(r.timer||0),extra:Boolean(r.extra),instance:`${base}:${idx}`,raw:r});
    }
  }
  return out;
}
function parseVillage(v) {
  const th=Number((v.buildings||[]).find(x=>Number(x.data)===1000001)?.lvl||0);
  const home={
    buildings:expandRecords(v.buildings,'building'), traps:expandRecords(v.traps,'trap'), troops:expandRecords(v.units,'troop'),
    spells:expandRecords(v.spells,'spell'), siege:expandRecords(v.siege_machines,'siege'), heroes:expandRecords(v.heroes,'hero'), pets:expandRecords(v.pets,'pet')
  };
  const all=Object.values(home).flat();
  const byDataId=new Map(); for(const x of all){if(!byDataId.has(x.dataId))byDataId.set(x.dataId,[]);byDataId.get(x.dataId).push(x);}
  const builderHuts=(v.buildings||[]).filter(x=>Number(x.data)===1000015).reduce((s,x)=>s+Number(x.cnt||1),0);
  const bob=(v.buildings||[]).some(x=>Number(x.data)===1000064)?1:0;
  const permanentBuilders=Math.max(1,builderHuts+bob);
  const active=all.filter(x=>x.timer>0);
  const activeExtra=active.filter(x=>x.extra);
  const helper=(v.helpers||[]).find(x=>Number(x.data)===93000001);
  return {th,home,all,byDataId,permanentBuilders,active,activeExtra,helper};
}

function phaseFor(entity,isNew=false) {
  if (isNew) return 1;
  if (OFFENSIVE_BUILDINGS.has(entity.id)) return 1;
  if (ECONOMY_BUILDINGS.has(entity.id)) return 2;
  if (entity._category==='trap' || entity.id==='hidden-tesla') return 3;
  if (entity._category==='defense') return 4;
  return 99;
}
function phaseName(n) { return ({1:'Offensive Foundation',2:'Economy & Passive HP',3:'Traps & Teslas',4:'Defensive Completion'}[n]||'Complete'); }
function phaseDescription(n) { return ({
  1:'Build a legal base and max attack-enabling infrastructure while one builder stays on heroes.',
  2:'Max storages and collectors while heroes and research keep pulling offense ahead.',
  3:'Take the cheap defensive value first: traps, then Hidden Teslas.',
  4:'Finish defenses from lighter inferred war weight toward signature defenses.'
}[n]||'Permanent progression at this Town Hall is complete.'); }
function defenseRank(id) { const i=DEFENSE_PRIORITY.indexOf(id); return i<0?DEFENSE_PRIORITY.length:i; }
function metaRank(id,th) { const m=META[th]||META[Math.max(...Object.keys(META).map(Number).filter(x=>x<=th))]||[]; const i=m.indexOf(id); return i<0?1000:i; }
