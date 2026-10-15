/* Browser controller. Physics and relation semantics live in ZooEngine. */
(function () {
  'use strict';
  var root = document.getElementById('complexity-zoo');
  if (!root || !window.ZooEngine) return;
  var $ = function (id) { return document.getElementById('zoo-' + id); };
  var data = JSON.parse($('data').textContent), E = window.ZooEngine, model = E.buildModel(data);
  var canvas = $('canvas'), ctx = canvas.getContext('2d'), stage = $('stage');
  var world = new E.World(), state, index = model.events.length - 1;
  var selected = null, hover = null, pointer = null, labelHits = [];
  var width = 1, height = 1, scale = 1, dpr = 1, camera = { x: 550, y: 425, zoom: 1 };
  var playing = false, timer = 0, last = 0, accumulator = 0, lastTooltip = '';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var colors = { computability:'#59695e', deterministic:'#588b80', randomized:'#af9149', interactive:'#8b7794', quantum:'#c47159', 'quantum-interactive':'#9e6382' };
  var types = { define:'A CLASS ENTERS', inclusion:'AN INCLUSION', separation:'A STRICT SEPARATION', equality:'TWO NAMES, ONE CLASS', oracle:'AN ORACLE RESULT', problem:'A PROBLEM FINDS A HOME', nonmembership:'A PROVEN NONMEMBERSHIP' };
  world.setSize(1100, 850);
  var hints = {};
  data.classes.concat(data.problems).forEach(function (c) { hints[c.id] = c.hint; });
  world.setHints(hints);
  $('motion').checked = !reduced.matches;
  world.motion = $('motion').checked ? 1 : 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function math(el) { if (window.renderMathInElement) window.renderMathInElement(el, {delimiters:[{left:'$',right:'$',display:false}],throwOnError:false}); }
  function dateText(date) {
    if (date.length === 4) return date;
    var bits = date.split('-');
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(bits[1])-1] + ' ' + bits[0];
  }
  function color(cell) {
    var ids = cell.members || [cell.key];
    var quantum = ids.find(function (id) { return model.classes[id] && model.classes[id].family.indexOf('quantum') === 0; });
    return colors[model.classes[quantum || ids[0]].family] || '#588b80';
  }
  function setPlaying(value) {
    playing = value; timer = 0;
    $('play').textContent = playing ? 'Pause history' : 'Play history';
    $('play').setAttribute('aria-pressed', String(playing));
  }
  function setEvent(next, instant) {
    index = Math.max(0, Math.min(model.events.length-1, Number(next)));
    state = model.stateAt(index);
    if (state.warnings.length) console.warn('Zoo dataset:', state.warnings);
    world.sync(state, {instant:!!instant});
    if (selected && state.groupOfClass[selected] === undefined) selected = null;
    hover = null; hideTooltip();
    $('timeline').value = index; $('event-select').value = index;
    $('timeline').setAttribute('aria-valuetext', dateText(state.event.date) + ': ' + state.event.title);
    $('prev').disabled = index === 0; $('next').disabled = index === model.events.length-1;
    $('event-title').textContent = state.event.title;
    $('date').textContent = dateText(state.event.date);
    $('stage-year').textContent = state.event.date.slice(0,4);
    $('stage-type').textContent = types[state.event.type] || '';
    $('count').textContent = state.groups.length + ' MEMBRANES';
    var e = state.event, p = e.paper || {}, url = /^https:\/\//.test(p.url || '') ? p.url : null;
    var badge = e.date_basis === 'preprint' ? 'PREPRINT MILESTONE' : e.date_basis === 'derived' ? 'DERIVED AT THIS MILESTONE' : 'PUBLICATION';
    $('paper').innerHTML = '<span class="zoo-kicker">'+badge+'</span><h3>'+esc(e.title)+'</h3><p class="zoo-paper__authors">'+esc(p.authors)+'</p>'+
      '<p>'+(url ? '<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(p.title)+' ↗</a>' : esc(p.title))+'</p><p class="zoo-paper__venue">'+esc(p.venue)+' · '+esc(dateText(e.date))+'</p>'+
      (e.note ? '<p class="zoo-paper__note">'+esc(e.note)+'</p>' : '')+(p.version_note ? '<p class="zoo-paper__note">'+esc(p.version_note)+'</p>' : '');
    buildDirectory(); updateSelection();
  }

  function buildDirectory() {
    var query = $('search').value.trim().toLowerCase();
    var visible = state.groups.filter(function(g) { return g.members.some(function(id) { return (id+' '+model.classes[id].name).toLowerCase().includes(query); }); });
    $('classes').innerHTML = visible.length ? visible.map(function(g) {
      var c = world.groupCell[g.index];
      return '<button type="button" data-class="'+esc(g.members[0])+'" style="--class-color:'+color(c)+'">'+esc(g.label)+'</button>';
    }).join('') : '<p>No matching classes at this date.</p>';
    $('compare').innerHTML = '<option value="">Choose a class</option>'+state.groups.map(function(g) { return '<option value="'+g.index+'">'+esc(g.label)+'</option>'; }).join('');
    $('problems').innerHTML = state.problems.map(function(pr) {
      var p = model.problems[pr.id];
      return '<button type="button" data-problem="'+esc(pr.id)+'">'+esc(p.label)+(pr.kind==='promise' ? ' · promise problem' : '')+'</button>';
    }).join('') || '<p>No example problems recorded yet.</p>';
  }

  function relationText(a,b) {
    var A=state.groups[a].label,B=state.groups[b].label;
    if(a===b) return A+' — these names denote the same class.';
    if(state.leq[a][b]) return A+(state.strict[a][b] ? ' ⊊ ' : ' ⊆ ')+B+(state.strict[a][b] ? '. Strict inclusion is proved by the recorded results.' : '. Equality versus strict inclusion is not resolved by this atlas.');
    if(state.leq[b][a]) return B+(state.strict[b][a] ? ' ⊊ ' : ' ⊆ ')+A+(state.strict[b][a] ? '. Strict inclusion is proved by the recorded results.' : '. Equality versus strict inclusion is not resolved by this atlas.');
    return 'No unconditional inclusion in either direction is recorded here. This is not a proof of incomparability.';
  }
  function showRelation() {
    $('relation').textContent = '';
    if(!selected || $('compare').value==='') return;
    var a=state.groupOfClass[selected],b=Number($('compare').value);
    var text=relationText(a,b);
    var ors=state.oracles.filter(function(o) {return o.a===a&&o.b===b || o.b===a&&o.a===b;});
    if(ors.length) text+=' Oracle annotation: '+ors.map(function(o) {return o.event.title;}).join('; ')+'. This does not establish unconditional strictness.';
    $('relation').textContent=text;
  }
  function updateSelection() {
    world.focus = null;
    $('compare').disabled = !selected;
    $('clear').hidden = !selected;
    $('classes').querySelectorAll('button').forEach(function(b) { b.setAttribute('aria-pressed',String(!!selected && state.groupOfClass[b.dataset.class]===state.groupOfClass[selected])); });
    if(!selected) {
      $('detail').innerHTML='<h2>Explore the membranes</h2><p>Hover for a definition. Select a class to inspect its known relationships at this point in history.</p>';
      $('relation').textContent='';return;
    }
    var gi=state.groupOfClass[selected],g=state.groups[gi];
    var focus={};
    state.groups.forEach(function(other,j) {
      var rel=model.relation(state,gi,j);
      focus[world.groupCell[j].key]=rel==='self' ? 'self' : rel.includes('strict') ? 'strict' : rel==='sub'||rel==='sup' ? 'open' : rel;
    });world.focus=focus;
    $('detail').innerHTML='<h2>'+esc(g.label)+'</h2>'+g.members.map(function(id) {
      var c=model.classes[id];return '<h3>'+esc(c.name)+'</h3><p>'+esc(c.definition)+'</p>';
    }).join('')+'<p class="zoo-detail__note">Relationships and membrane materials are now relative to this selection.</p>';
    math($('detail'));showRelation();
  }
  function selectClass(id) { selected=id;updateSelection(); }
  function showProblem(id) {
    var pr=state.problems.find(function(p) {return p.id===id;}),p=model.problems[id];
    if(!pr) return;
    selected=null;updateSelection();
    var pos=pr.groups.map(function(g) {return state.groups[g].label;}).join(', ');
    $('detail').innerHTML='<h2>'+esc(p.label)+'</h2><h3>'+esc(p.name)+'</h3><p>'+esc(p.description)+'</p><p>Recorded membership: '+esc(pos)+(pr.kind==='promise' ? ' (promise variant; not plotted).' : '.')+'</p>'+
      (pr.exclude.length ? '<p>Proven nonmembership: '+esc(pr.exclude.map(function(i){return state.groups[i].label;}).join(', '))+'.</p>' : '')+
      '<p class="zoo-detail__note">The marker’s position does not assert any additional memberships or separations.</p>';
    math($('detail'));$('clear').hidden=false;
  }

  function resize() {
    var r=stage.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    scale=Math.min(width/1100,height/850);hideTooltip();
  }
  function toScreen(x,y) { return {x:(x-camera.x)*scale*camera.zoom+width/2,y:(y-camera.y)*scale*camera.zoom+height/2}; }
  function toWorld(x,y) { return {x:(x-width/2)/(scale*camera.zoom)+camera.x,y:(y-height/2)/(scale*camera.zoom)+camera.y}; }
  function local(e) { var r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  function path(c) {ctx.beginPath();for(var i=0;i<c.n;i++){if(i===0)ctx.moveTo(c.x[i],c.y[i]);else ctx.lineTo(c.x[i],c.y[i]);}ctx.closePath();}
  function resetView() {camera={x:550,y:425,zoom:1};}
  function zoom(f,x,y) {
    x=x===undefined?width/2:x;y=y===undefined?height/2:y;
    var p=toWorld(x,y);camera.zoom=Math.max(0.65,Math.min(5,camera.zoom*f));
    var q=toWorld(x,y);camera.x+=p.x-q.x;camera.y+=p.y-q.y;
  }

  function draw() {
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    var sc=scale*camera.zoom;
    ctx.save();ctx.translate(width/2,height/2);ctx.scale(sc,sc);ctx.translate(-camera.x,-camera.y);
    var cells=world.cells.slice().sort(function(a,b) {return Math.abs(E.geometry.signedArea(b))-Math.abs(E.geometry.signedArea(a));});
    // Parent fills first; no curves are interpolated beyond the validated polygon.
    cells.forEach(function(c) {
      ctx.save();
      // Clip strokes too: line width must not leak beyond a known parent.
      world.pairs.forEach(function(p) {if(p.child===c){path(p.parent);ctx.clip();}});
      var tint=color(c), alpha=c.alpha*c.dim;
      ctx.globalAlpha=alpha;path(c);ctx.fillStyle=tint+'0b';ctx.fill();
      ctx.strokeStyle=tint;ctx.lineJoin='round';ctx.lineCap='round';
      var rel=world.focus&&world.focus[c.key];
      if(rel==='unknown'||rel==='oracle') ctx.setLineDash([5/sc,6/sc]); else ctx.setLineDash([]);
      for(var i=0;i<c.n;i++) {
        var j=(i+1)%c.n;
        ctx.lineWidth=(0.9+c.mat[i]*2.4+(selected && c.members.includes(selected)?0.7:0))/sc;
        ctx.beginPath();ctx.moveTo(c.x[i],c.y[i]);ctx.lineTo(c.x[j],c.y[j]);ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    });
    ctx.globalAlpha=1;
    if($('examples').checked) world.orgs.forEach(function(g) {
      if(g.status!=='alive'||g.hidden) return;
      ctx.globalAlpha=g.alpha;ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,Math.PI*2);ctx.fillStyle='#665e4c';ctx.fill();
      ctx.beginPath();ctx.arc(g.x-1,g.y-1,1.5,0,Math.PI*2);ctx.fillStyle='#f6f1e7';ctx.fill();
    });
    ctx.restore();ctx.globalAlpha=1;
    labelHits=[];ctx.font='500 12px "Inter Tight", sans-serif';
    var placed=[];
    cells.filter(function(c){return c.status==='alive';}).reverse().forEach(function(c) {
      var label=c.label, textW=ctx.measureText(label).width, boxW=textW+14, boxH=23,best=null;
      var start=Math.round((c.group*0.61803398875%1)*c.n);
      for(var attempt=0;attempt<c.n;attempt++) {
        var i=(start+attempt*7)%c.n,p=toScreen(c.x[i],c.y[i]);
        var box={x:p.x-boxW/2,y:p.y-boxH/2,w:boxW,h:boxH,cell:c};
        if(box.x<7||box.x+box.w>width-7||box.y<75||box.y+box.h>height-30) continue;
        var penalty=placed.reduce(function(s,b){return s+(box.x<b.x+b.w+4&&box.x+box.w+4>b.x&&box.y<b.y+b.h+3&&box.y+box.h+3>b.y?1:0);},0);
        if(!best||penalty<best.penalty)best={box:box,penalty:penalty};
        if(penalty===0)break;
      }
      if(!best) return;
      var b=best.box;placed.push(b);labelHits.push(b);
      ctx.globalAlpha=c.alpha*(world.focus && ['unknown','oracle'].includes(world.focus[c.key])?0.5:1);
      ctx.fillStyle='#f8f4eb';ctx.fillRect(b.x,b.y,b.w,b.h);
      ctx.fillStyle=color(c);ctx.fillText(label,b.x+7,b.y+16);
    });ctx.globalAlpha=1;
  }
  function targetAt(p) {
    for(var i=labelHits.length-1;i>=0;i--){var b=labelHits[i];if(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return{cell:b.cell};}
    var q=toWorld(p.x,p.y),hit=world.hit(q.x,q.y);
    if(hit&&hit.org&&(!$('examples').checked||hit.org.hidden)) return null;
    return hit;
  }
  function hideTooltip() {$('tooltip').hidden=true;lastTooltip='';}
  function showTooltip(hit,p) {
    if(!hit){hideTooltip();return;}
    var key=hit.cell?'c:'+hit.cell.key:'p:'+hit.org.key;
    if(lastTooltip!==key) {
      var obj=hit.cell?model.classes[hit.cell.members[0]]:model.problems[hit.org.key];
      $('tooltip').innerHTML='<strong>'+esc(hit.cell?hit.cell.label:obj.label)+'</strong><p>'+esc(obj.definition||obj.description)+'</p><span>Click to inspect · drag the boundary to deform</span>';
      math($('tooltip'));lastTooltip=key;
    }
    $('tooltip').hidden=false;
    var tw=$('tooltip').offsetWidth,th=$('tooltip').offsetHeight;
    $('tooltip').style.left=Math.max(8,Math.min(width-tw-8,p.x+18))+'px';
    $('tooltip').style.top=Math.max(8,Math.min(height-th-8,p.y+18))+'px';
  }

  canvas.addEventListener('pointerdown',function(e) {
    if(e.button!==0 || pointer)return;
    var p=local(e),q=toWorld(p.x,p.y),target=targetAt(p);
    // Pause history while manipulating a membrane so its identity stays stable.
    setPlaying(false);var grab=world.grab(q.x,q.y,target&&target.cell);
    if(target&&target.cell&&!grab){var c=target.cell;var near=E.geometry.nearest(c,q.x,q.y,1);grab=world.grab(c.x[near.a],c.y[near.a]);}
    pointer={id:e.pointerId,start:p,last:p,moved:false,grab:grab,target:target};
    canvas.setPointerCapture(e.pointerId);hideTooltip();canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove',function(e) {
    var p=local(e);
    if(pointer && pointer.id===e.pointerId) {
      if(Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>4)pointer.moved=true;
      if(pointer.grab){var q=toWorld(p.x,p.y);world.drag(q.x,q.y);}
      else {camera.x-=(p.x-pointer.last.x)/(scale*camera.zoom);camera.y-=(p.y-pointer.last.y)/(scale*camera.zoom);}
      pointer.last=p;return;
    }
    hover=targetAt(p);canvas.style.cursor=hover?'grab':'default';showTooltip(hover,p);
  });
  function endPointer(e) {
    if(!pointer||pointer.id!==e.pointerId)return;
    if(e.type==='pointerup'&&!pointer.moved&&pointer.target){if(pointer.target.cell)selectClass(pointer.target.cell.members[0]);else showProblem(pointer.target.org.key);}
    world.release();pointer=null;canvas.classList.remove('is-dragging');
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  }
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);canvas.addEventListener('lostpointercapture',endPointer);
  canvas.addEventListener('pointerleave',function(){if(!pointer)hideTooltip();});
  canvas.addEventListener('wheel',function(e){e.preventDefault();var p=local(e);zoom(Math.exp(-e.deltaY*0.001),p.x,p.y);hideTooltip();},{passive:false});
  $('zoom-in').onclick=function(){zoom(1.25);};$('zoom-out').onclick=function(){zoom(0.8);};$('reset').onclick=resetView;
  $('clear').onclick=function(){selected=null;updateSelection();};$('compare').onchange=showRelation;
  $('motion').onchange=function(){world.motion=this.checked?1:0;};
  $('search').oninput=function(){var compare=$('compare').value;buildDirectory();$('compare').value=compare;updateSelection();};
  $('classes').onclick=function(e){var b=e.target.closest('button[data-class]');if(b)selectClass(b.dataset.class);};
  $('problems').onclick=function(e){var b=e.target.closest('button[data-problem]');if(b)showProblem(b.dataset.problem);};
  $('timeline').max=model.events.length-1;
  document.querySelectorAll('.zoo-history__ticks span').forEach(function(t){
    var at=model.events.findIndex(function(e){return e.date.slice(0,4)===t.textContent;});
    t.style.left=(100*Math.max(0,at)/(model.events.length-1))+'%';
  });
  $('timeline').oninput=function(){setPlaying(false);setEvent(this.value);};
  $('event-select').innerHTML=model.events.map(function(e,i){return '<option value="'+i+'">'+esc(dateText(e.date)+' · '+e.title)+'</option>';}).join('');
  $('event-select').onchange=function(){setPlaying(false);setEvent(this.value);};
  $('prev').onclick=function(){setPlaying(false);setEvent(index-1);};$('next').onclick=function(){setPlaying(false);setEvent(index+1);};
  $('play').onclick=function(){if(!playing && index===model.events.length-1)setEvent(0);setPlaying(!playing);};
  root.addEventListener('keydown',function(e){if(e.key==='Escape'){world.release();pointer=null;hideTooltip();selected=null;updateSelection();setPlaying(false);}});
  document.addEventListener('visibilitychange',function(){if(document.hidden){setPlaying(false);world.release();pointer=null;}last=0;accumulator=0;});
  reduced.addEventListener('change',function(e){$('motion').checked=!e.matches;world.motion=e.matches?0:1;});
  new ResizeObserver(resize).observe(stage);
  setEvent(index,true);resize();
  function frame(now) {
    var dt=last?Math.min((now-last)/1000,0.05):0;last=now;
    if(!document.hidden){
      accumulator+=dt;
      var steps=0;
      while(accumulator>=1/60 && steps<3){world.step(1/60);accumulator-=1/60;steps++;}
      if(playing){timer+=dt;if(timer>2.8){timer=0;if(index<model.events.length-1)setEvent(index+1);else setPlaying(false);}}
      draw();
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
})();
