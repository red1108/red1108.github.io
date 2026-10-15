// Run: node scripts/tests/complexity-zoo.cjs (uses Ruby only to read Jekyll YAML).
'use strict';
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const E = require(path.join(root, 'assets/js/complexity-zoo-engine.js'));
const data = JSON.parse(execFileSync('ruby', ['-rjson', '-ryaml', '-e', 'puts JSON.generate(YAML.load_file(ARGV[0]))', path.join(root, '_data/complexity_zoo.yml')], {encoding:'utf8'}));
const model = E.buildModel(data);
const hints = Object.fromEntries([...data.classes,...data.problems].map(c=>[c.id,c.hint]));
let frames = 0;
function create() { const w=new E.World();w.setSize(1100,850);w.setHints(hints);return w; }
function verify(w, where) {
  assert(w._validGeometry(), 'invalid polygon geometry: '+where);
  const r=w.checkInvariants();
  assert.equal(r.vertexOut+r.parentIn+r.crossings,0,where+': '+JSON.stringify(r));
  for(const g of w.orgs.filter(g=>g.status==='alive'&&!g.hidden)) {
    for(const p of g.inc) assert(E.geometry.nearest(p,g.x,g.y,1).d>=g.r-1e-6,'example outside known membership');
    for(const p of g.exc) assert(E.geometry.nearest(p,g.x,g.y,1).d<=-g.r+1e-6,'example inside proven nonmembership');
  }
}
function step(w,n,label) { for(let i=0;i<n;i++){w.step(1/60);verify(w,label+' frame '+i);frames++;} }
for(let i=0;i<model.events.length;i++) {
  const s=model.stateAt(i);
  assert.deepEqual(s.warnings,[],s.event.title);
  for(let a=0;a<s.groups.length;a++) {
    assert(!s.strict[a][a]);
    for(let b=a+1;b<s.groups.length;b++)assert(!(s.leq[a][b]&&s.leq[b][a]),'unmerged equality');
  }
}
const end=model.stateAt(model.events.length-1);
assert.equal(end.groupOfClass.QIP,end.groupOfClass.PSPACE);
assert.equal(end.groupOfClass.MIPstar,end.groupOfClass.RE);
assert(!end.strict[end.groupOfClass.P][end.groupOfClass.NP]);
assert(!end.strict[end.groupOfClass.BPP][end.groupOfClass.BQP], 'oracle separation leaked');
assert.equal(end.problems.find(p=>p.id==='SAT').exclude.length,0,'unknown membership treated as exclusion');
assert(end.problems.find(p=>p.id==='HALT').exclude.includes(end.groupOfClass.R));
const beforeAKS=model.events.findIndex(e=>e.problem==='PRIMES'&&e.class==='P');
assert(!model.stateAt(beforeAKS-1).problems.find(p=>p.id==='PRIMES').known.includes(model.stateAt(beforeAKS-1).groupOfClass.P));

// Reproduce a real freeze: rewind from the latest state, select RE, then step
// forward while new classes are growing. A motionless scene used to satisfy
// every containment assertion, so check liveness as well as geometry here.
const history=create();history.sync(end,{instant:true});
const route=[[2,104],[3,267],[4,111],[5,210],[6,165],[7,114],[8,268],[9,253],[0,222],[1,248],[2,182],[3,223],[4,52],[5,45],[6,147],[15,70],[2,220]];
for(const [index,dwell] of route) {
  const state=model.stateAt(index);history.sync(state);
  history.focus=null;
  if(state.groupOfClass.RE!==undefined) {
    history.focus={};
    state.groups.forEach((g,i)=>{
      const rel=model.relation(state,state.groupOfClass.RE,i);
      history.focus[history.groupCell[i].key]=rel==='self'?'self':rel.includes('strict')?'strict':rel==='sub'||rel==='sup'?'open':rel;
    });
  }
  let lateMotion=0;
  for(let f=0;f<dwell;f++) {
    const before=history._capture();step(history,1,'history liveness '+index);
    if(f>=dwell-20) {
      let displacement=0;
      for(const c of history.cells)for(let i=0;i<c.n;i++)displacement=Math.max(displacement,Math.hypot(c.x[i]-before[c.key].x[i],c.y[i]-before[c.key].y[i]));
      lateMotion+=displacement;
    }
  }
  assert(lateMotion>0.2,'timeline membrane froze at '+state.event.title);
}
const grabbed=history.cells.find(c=>c.status==='alive');
history.grab(grabbed.x[0],grabbed.y[0],grabbed);
history.sync(model.stateAt(3));
assert.equal(history.grabbed,null,'timeline transition retained an obsolete drag');

const w=create();
for(let i=0;i<model.events.length;i++){w.sync(model.stateAt(i));verify(w,'sync '+i);step(w,8,'forward '+i);}
for(let i=model.events.length-1;i>=0;i--){w.sync(model.stateAt(i));verify(w,'reverse sync '+i);step(w,3,'reverse '+i);}
for(let i=1;i<model.events.length;i++) {
  if(model.events[i].type!=='equality')continue;
  const f=create();f.sync(model.stateAt(i-1),{instant:true});f.sync(model.stateAt(i));
  step(f,110,'fusion '+i);
  assert.equal(f.cells.filter(c=>c.status==='fusing').length,0,'fusion did not retire old boundary');
}
w.sync(end,{instant:true});step(w,240,'settle');
assert(!w.orgs.some(g=>g.key==='LH'),'promise problem plotted as language');
for(const id of ['P','BQP','NP','QMA','RE']) {
  const c=w.groupCell[end.groupOfClass[id]];
  const hit=w.grab(c.x[0],c.y[0],c);assert.equal(hit.cell,c,'grab '+id);
  for(let i=0;i<90;i++) {
    w.drag(i%2?1400:-300, i%3?1200:-300);
    step(w,1,'drag '+id);
  }
  w.release();step(w,20,'release '+id);
}
for(const [x,y] of [[360,300],[1600,600],[1100,850]]){w.setSize(x,y);verify(w,'resize');step(w,10,'resize');}
// Deliberately propose an invalid crossing to exercise the acceptance guard.
const c=w.groupCell[end.groupOfClass.P],before=w._capture();
c.x[0]+=2000;c.y[0]-=1000;w._acceptSafe(before);verify(w,'rejected crossing');
assert(w.safety.limited>0,'safety limiter was never exercised');
const valid=w._capture();c.x[0]=NaN;w._acceptSafe(valid);verify(w,'non-finite proposal');
assert(w.safety.rejected>0,'invalid-number fallback was never exercised');
// Repeated inadmissible motion must not leave a valid scene permanently frozen.
const jammed=create();jammed.sync(end,{instant:true});
for(let f=0;f<100 && jammed.safety.recoveries===0;f++) {
  const before=jammed._capture(),inner=jammed.groupCell[end.groupOfClass.P];
  inner.x[0]+=2000;inner.y[0]-=1000;
  jammed._acceptSafe(before);jammed._placeOrganelles();verify(jammed,'stall recovery '+f);
}
assert.equal(jammed.safety.recoveries,1,'persistent blocked motion did not recover');
console.log(JSON.stringify({classes:data.classes.length,events:model.events.length,checkedFrames:frames,safety:w.safety,result:'passed'}));
