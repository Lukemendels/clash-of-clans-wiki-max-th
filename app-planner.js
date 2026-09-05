function buildUpgradeChains(parsed) {
  const chains=[]; const th=parsed.th;
  const schedulable=state.data.entities.filter(e=>['army','resource','defense','trap'].includes(e._category) && e.id!=='town-hall' && e.id!=='wall');
  for(const e of schedulable) {
    const target=maxLevelAtTH(e,th), expected=availableCount(e,th); if(!target||!expected) continue;
    const observed=parsed.byDataId.get(Number(e.dataId))||[];
    const instances=[...observed];
    while(instances.length<expected) instances.push({kind:e._category,dataId:Number(e.dataId),level:0,timer:0,extra:false,instance:`${e._category}:${e.dataId}:new${instances.length+1}`,raw:{}});
    instances.slice(0,expected).forEach((inst,index)=>{
      const isNew=inst.level===0; const tasks=[];
      for(let level=inst.level+1; level<=target; level++) {
        const lr=levelRecord(e,level); if(!lr) continue;
        tasks.push({
          type:'builder', entity:e, chainId:`builder:${e.dataId}:${index}`, instanceIndex:index, from:level-1,to:level,
          phase:phaseFor(e,isNew && level===1), duration:applyBoost(durationMs(lr)), levelRecord:lr,
          priority: phaseFor(e,isNew && level===1)*1000 + (e.id==='hidden-tesla'?900:defenseRank(e.id)*10) + level
        });
      }
      if(tasks.length) chains.push({id:`builder:${e.dataId}:${index}`,entity:e,current:inst,tasks,kind:'builder'});
    });
  }
  return chains;
}
function heroChains(parsed) {
  const th=parsed.th, chains=[];
  for(const e of state.data.entities.filter(e=>e._category==='hero')) {
    const target=maxLevelAtTH(e,th); if(!target) continue;
    const current=(parsed.byDataId.get(Number(e.dataId))||[])[0]||{level:0,timer:0,extra:false,instance:`hero:${e.dataId}:1`};
    const tasks=[];
    for(let level=Math.max(1,current.level+1);level<=target;level++) { const lr=levelRecord(e,level); if(!lr)continue; tasks.push({type:'hero',entity:e,chainId:`hero:${e.dataId}:1`,from:level-1,to:level,phase:1,duration:applyBoost(durationMs(lr)),levelRecord:lr,priority:1500+metaRank(e.id,th)+level/100}); }
    if(tasks.length)chains.push({id:`hero:${e.dataId}:1`,entity:e,current,tasks,kind:'hero'});
  }
  return chains;
}
function labChains(parsed) {
  const th=parsed.th, chains=[];
  for(const e of state.data.entities.filter(e=>['troop','spell','siege'].includes(e._category))) {
    const target=maxLevelAtTH(e,th); if(!target) continue;
    const current=(parsed.byDataId.get(Number(e.dataId))||[])[0]||{level:0,timer:0,instance:`${e._category}:${e.dataId}:1`};
    const tasks=[];
    for(let level=Math.max(1,current.level+1);level<=target;level++) { const lr=levelRecord(e,level); if(!lr)continue; const ms=durationMs(lr); if(ms<=0)continue; tasks.push({type:'lab',entity:e,chainId:`lab:${e.dataId}:1`,from:level-1,to:level,duration:applyBoost(ms),levelRecord:lr,priority:metaRank(e.id,th)*100+level}); }
    if(tasks.length)chains.push({id:`lab:${e.dataId}:1`,entity:e,current,tasks,kind:'lab'});
  }
  return chains;
}
function petChains(parsed) {
  const th=parsed.th, chains=[];
  for(const e of state.data.entities.filter(e=>e._category==='pet')) {
    const target=maxLevelAtTH(e,th); if(!target) continue;
    const current=(parsed.byDataId.get(Number(e.dataId))||[])[0]||{level:0,timer:0,instance:`pet:${e.dataId}:1`};
    const tasks=[];
    for(let level=Math.max(1,current.level+1);level<=target;level++) { const lr=levelRecord(e,level); if(!lr)continue; const ms=durationMs(lr); if(ms<=0)continue; tasks.push({type:'pet',entity:e,chainId:`pet:${e.dataId}:1`,from:level-1,to:level,duration:applyBoost(ms),levelRecord:lr,priority:level}); }
    if(tasks.length)chains.push({id:`pet:${e.dataId}:1`,entity:e,current,tasks,kind:'pet'});
  }
  return chains;
}

function localMinutes(ms) { const d=new Date(ms); return d.getHours()*60+d.getMinutes(); }
function hmMinutes(v) { const [h,m]=String(v||'00:00').split(':').map(Number); return h*60+m; }
function isSleeping(ms) {
  const t=localMinutes(ms), s=hmMinutes(state.settings.sleepStart), w=hmMinutes(state.settings.wakeTime);
  return s>w ? (t>=s||t<w) : (t>=s&&t<w);
}
function nextWake(ms) {
  const d=new Date(ms), w=hmMinutes(state.settings.wakeTime), wh=Math.floor(w/60), wm=w%60;
  const out=new Date(d); out.setHours(wh,wm,0,0); if(out.getTime()<=ms || !isSleeping(out.getTime()-1)) out.setDate(out.getDate()+1);
  return out.getTime();
}
function nextAction(finish) { return isSleeping(finish) ? nextWake(finish)+TEN_MIN : finish+TEN_MIN; }
function nextSleepWindow(start) {
  const s=hmMinutes(state.settings.sleepStart), w=hmMinutes(state.settings.wakeTime);
  const d=new Date(start); const ss=new Date(d); ss.setHours(Math.floor(s/60),s%60,0,0); if(ss.getTime()<start) ss.setDate(ss.getDate()+1);
  const ee=new Date(ss); ee.setHours(Math.floor(w/60),w%60,0,0); if(s>w) ee.setDate(ee.getDate()+1);
  return [ss.getTime(),ee.getTime()];
}
function sleepFitScore(task,start) {
  const [s,e]=nextSleepWindow(start); if(s-start>5*60*60*1000)return 0; const finish=start+task.duration;
  if(finish>=e) return Math.max(0,1000000000-(finish-e));
  return -Math.max(0,s-finish);
}
function activeFinish(inst) { return importEpoch()+Number(inst.timer||0)*1000; }

function nextWallWindow(ms) {
  const startMin=hmMinutes(state.settings.wallStart), duration=Math.max(0,Number(state.settings.wallMinutes||60))*60000;
  const d=new Date(ms), start=new Date(d); start.setHours(Math.floor(startMin/60),startMin%60,0,0);
  if(start.getTime()+duration<=ms) start.setDate(start.getDate()+1);
  return [start.getTime(),start.getTime()+duration];
}

function scheduleSingleLane(chains,parsed,kind) {
  const now=Date.now(); const active=parsed.active.find(x=>x.kind===kind || (kind==='lab'&&['troop','spell','siege'].includes(x.kind)));
  let cursor=active ? Math.max(now,nextAction(activeFinish(active))) : now;
  const queue=[]; const chainStates=chains.map(c=>({c,i:0,ready:c.current?.timer?Math.max(now,nextAction(activeFinish(c.current))):now}));
  while(true){ const candidates=chainStates.filter(x=>x.i<x.c.tasks.length && x.ready<=cursor); if(!candidates.length){const next=Math.min(...chainStates.filter(x=>x.i<x.c.tasks.length).map(x=>x.ready));if(!Number.isFinite(next))break;cursor=Math.max(cursor,next);continue;}
    candidates.sort((a,b)=>a.c.tasks[a.i].priority-b.c.tasks[b.i].priority); const x=candidates[0], task=x.c.tasks[x.i++];
    const start=cursor,end=start+task.duration; queue.push({...task,start,end}); x.ready=nextAction(end); cursor=nextAction(end);
  }
  let end=queue.at(-1)?.end || (active?activeFinish(active):now);
  if(kind==='lab' && state.settings.autoHelpers && parsed.helper?.lvl && end>now){ const raw=end-now; const factor=23/(23+Number(parsed.helper.lvl)); end=now+raw*factor; }
  return {queue,end,active};
}

function scheduleBuilders(builderChains,heroes,parsed,wall) {
  const now=Date.now(); const capacity=parsed.permanentBuilders;
  const normalActive=parsed.active.filter(x=>!x.extra && ['building','trap','hero'].includes(x.kind));
  const lanes=Array.from({length:capacity},(_,i)=>({id:i+1,available:now,current:null,queue:[]}));
  normalActive.sort((a,b)=>activeFinish(a)-activeFinish(b)).forEach((a,i)=>{ if(i<lanes.length){lanes[i].current=a;lanes[i].available=Math.max(now,nextAction(activeFinish(a)));} });
  const chainStates=[...builderChains,...heroes].map(c=>({c,i:0,ready:c.current?.timer?Math.max(now,nextAction(activeFinish(c.current))):now}));
  let safety=0;
  while(safety++<10000) {
    const pending=chainStates.filter(x=>x.i<x.c.tasks.length); if(!pending.length)break;
    lanes.sort((a,b)=>a.available-b.available); const lane=lanes[0]; let t=lane.available;
    let candidates=pending.filter(x=>x.ready<=t);
    if(!candidates.length){ const nr=Math.min(...pending.map(x=>x.ready)); lane.available=Math.max(t,nr); continue; }
    if(state.settings.wallEnabled && wall?.pct<100 && lane.id===1 && t<wall.eta) {
      const [ws,we]=nextWallWindow(t);
      if(t>=ws && t<we){ lane.available=we+TEN_MIN; continue; }
      const fit=candidates.filter(x=>t+x.c.tasks[x.i].duration<=ws);
      if(t<ws && fit.length) candidates=fit;
      else if(t<ws && !fit.length){ lane.available=we+TEN_MIN; continue; }
    }
    const phase1Pending=pending.some(x=>x.c.kind==='builder' && x.c.tasks[x.i]?.phase===1);
    const heroActiveAtT=lanes.some(l=>l.queue.at(-1)?.type==='hero' && l.queue.at(-1).end>t) || normalActive.some(a=>a.kind==='hero'&&activeFinish(a)>t);
    candidates=candidates.filter(x=>!(x.c.kind==='hero' && phase1Pending && heroActiveAtT));
    if(!candidates.length){ lane.available+=10*60*1000; continue; }
    candidates.sort((a,b)=>{
      const ta=a.c.tasks[a.i],tb=b.c.tasks[b.i];
      const pa=ta.type==='hero'?(phase1Pending?1500:1900):ta.priority;
      const pb=tb.type==='hero'?(phase1Pending?1500:1900):tb.priority;
      if(pa!==pb)return pa-pb;
      return sleepFitScore(tb,t)-sleepFitScore(ta,t) || ta.duration-tb.duration;
    });
    const x=candidates[0],task=x.c.tasks[x.i++]; const start=t,end=start+task.duration; const scheduled={...task,start,end}; lane.queue.push(scheduled); lane.available=nextAction(end); x.ready=nextAction(end);
  }
  const extra=parsed.activeExtra.map((a,i)=>({id:`g${i+1}`,current:a,available:activeFinish(a),queue:[],temporary:true}));
  return {lanes:lanes.sort((a,b)=>a.id-b.id),extra};
}

function progressForEntities(parsed,filter) {
  let done=0,total=0;
  for(const e of state.data.entities.filter(filter)) {
    const target=maxLevelAtTH(e,parsed.th); const count=availableCount(e,parsed.th); if(!target||!count)continue;
    const obs=parsed.byDataId.get(Number(e.dataId))||[];
    total+=target*count;
    done+=obs.slice(0,count).reduce((s,x)=>s+Math.min(target,x.level),0);
  }
  return {done,total,pct:pct(done,total)};
}
function labProgress(parsed) {
  return progressForEntities(parsed,e=>['troop','spell','siege'].includes(e._category));
}
function heroProgress(parsed) { return progressForEntities(parsed,e=>e._category==='hero'); }
function defenseProgress(parsed) { return progressForEntities(parsed,e=>e._category==='defense'); }
function phaseProgress(parsed,phase) {
  let done=0,total=0;
  for(const e of state.data.entities.filter(e=>['army','resource','defense','trap'].includes(e._category))) {
    const target=maxLevelAtTH(e,parsed.th), count=availableCount(e,parsed.th); if(!target||!count)continue;
    const basePhase=phaseFor(e,false); const obs=parsed.byDataId.get(Number(e.dataId))||[];
    for(let i=0;i<count;i++){
      const current=obs[i]?.level||0;
      for(let l=1;l<=target;l++) { const p=phaseFor(e,current===0&&l===1); if(p!==phase)continue; total++; if(current>=l)done++; }
    }
  }
  return {done,total,pct:pct(done,total)};
}
function wallModel(parsed) {
  const e=state.data.byId.get('wall'); if(!e)return {pct:0,remainingCost:0,sessions:0};
  const target=maxLevelAtTH(e,parsed.th), expected=availableCount(e,parsed.th); const obs=parsed.byDataId.get(Number(e.dataId))||[];
  let doneLevels=0,totalLevels=target*expected,remainingCost=0;
  obs.slice(0,expected).forEach(x=>{doneLevels+=Math.min(x.level,target);for(let l=x.level+1;l<=target;l++)remainingCost+=Number(levelRecord(e,l)?.buildCost||0);});
  for(let i=obs.length;i<expected;i++)for(let l=1;l<=target;l++)remainingCost+=Number(levelRecord(e,l)?.buildCost||0);
  const cycles=Math.max(1,Number(state.settings.wallMinutes||60)/5), perSession=cycles*(Number(state.settings.wallGold||0)+Number(state.settings.wallElixir||0));
  const sessions=perSession?Math.ceil(remainingCost/perSession):Infinity;
  let eta=null;
  const wallPct=pct(doneLevels,totalLevels);
  if(wallPct===100) eta=Date.now();
  else if(state.settings.wallEnabled && Number.isFinite(sessions)) eta=Date.now()+sessions*DAY;
  else eta=Infinity;
  return {pct:wallPct,doneLevels,totalLevels,remainingCost,sessions,eta,target,expected};
}
