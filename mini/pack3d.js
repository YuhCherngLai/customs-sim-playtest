// 3D 堆行李：行李箱是 寬×深×高 的格子，東西從上面放下去會疊起來。
// 操作：先點一件東西 → 在行李箱上移動看落點 → 點一下放下；R 或按鈕旋轉；也可以點身上的位置藏起來。
// 介面與 pack.js 相同（window.Mini.pack），主頁只載入其中一個。
(function(){
'use strict';
const TW=92,TH=46,ZH=38,PAD=16;
const COLORS=['#5fb3ff','#ffb454','#b78cff','#55d38a','#ff8fb1','#ffd84d'];
let root=null,api=null,st=null,sel=null,rot=0,hover=null,sig='',hsig='',msg='',msgT=0;
let prevPos=null,dropAt={},lidAt=0,wasEdit=null;   // 剛落地的東西、剛蓋上的箱蓋：動畫只在那一瞬間播
const fresh=(t,ms)=>performance.now()-t<ms;

const CSS=`
.mp3-wrap{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.mp3-stage{flex:1 1 300px;min-width:260px;text-align:center}
.mp3-stage svg{max-width:100%;height:auto;touch-action:manipulation}
.mp3-side{flex:1 1 280px;min-width:240px}
.mp3-item{display:flex;gap:8px;align-items:center;border:1px solid var(--line,#2c3649);border-radius:8px;padding:6px 8px;margin:4px 0;cursor:pointer;background:#141b28}
.mp3-item.on{border-color:var(--warn,#ffc857);background:#262214}
.mp3-item.ro{cursor:default}
.mp3-sw{width:16px;height:16px;border-radius:4px;flex:none}
.mp3-item small{display:block;color:var(--dim,#93a0b5);font-size:12px;line-height:1.35}
.mp3-tag{font-size:11px;border-radius:4px;padding:0 5px;margin-left:4px}
.mp3-bad{background:#7a2b2b;color:#fff}.mp3-metal{background:#234a6b;color:#bfe3ff}
.mp3-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}
.mp3-slot{font:inherit;font-size:13px;color:var(--fg,#e8ecf3);background:#1d2636;border:1px dashed #3d5278;border-radius:8px;padding:6px 4px;min-height:48px;cursor:pointer}
.mp3-slot b{display:block;font-size:12px;color:var(--dim,#93a0b5);font-weight:400}
.mp3-slot.full{border-style:solid;border-color:#5b6f94}
.mp3-slot:disabled{opacity:.45;cursor:not-allowed}
.mp3-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0;min-height:32px}
.mp3-bar button{font:inherit;color:var(--fg,#e8ecf3);background:#2a3a55;border:1px solid #3d5278;border-radius:8px;padding:4px 10px;cursor:pointer}
.mp3-msg{color:var(--warn,#ffc857);font-size:13px}
.mp3-hint{color:var(--dim,#93a0b5);font-size:13px;margin:4px 0}
.mp3-hit{fill:transparent;cursor:pointer}
.mp3-cube{cursor:pointer}
.mp3-drop{animation:mp3drop .42s cubic-bezier(.25,1.6,.5,1)}
@keyframes mp3drop{0%{transform:translateY(-90px);opacity:.2}100%{transform:none;opacity:1}}
.mp3-lidin{animation:mp3lid .6s cubic-bezier(.3,1.4,.5,1)}
@keyframes mp3lid{0%{transform:translateY(-130px);opacity:0}100%{transform:none;opacity:1}}
`;

const P=(x,y,z,o)=>[o.x+(x-y)*TW/2,o.y+(x+y)*TH/2-z*ZH];
const poly=(pts,attr)=>`<polygon points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" ${attr}/>`;
function cube(x,y,z,o,fill,extra,op){
  const a=`fill="${fill}" stroke="rgba(0,0,0,.55)" stroke-width="1" ${op?`opacity="${op}"`:''} ${extra||''}`;
  const top=[P(x,y,z+1,o),P(x+1,y,z+1,o),P(x+1,y+1,z+1,o),P(x,y+1,z+1,o)];
  const left=[P(x,y+1,z+1,o),P(x+1,y+1,z+1,o),P(x+1,y+1,z,o),P(x,y+1,z,o)];
  const right=[P(x+1,y,z+1,o),P(x+1,y+1,z+1,o),P(x+1,y+1,z,o),P(x+1,y,z,o)];
  const shade=(pts,k)=>poly(pts,a)+poly(pts,`fill="#000" opacity="${op?k*op:k}" pointer-events="none"`);
  return shade(left,.22)+shade(right,.4)+poly(top,a);
}
const cubeG=(c,o)=>{const s=cube(c.x,c.y,c.z,o,c.fill,c.extra,c.op);return c.drop?`<g class="mp3-drop">${s}</g>`:s};
const say=t=>{msg=t;clearTimeout(msgT);msgT=setTimeout(()=>{msg='';draw(true)},1800)};
const cellCount=it=>cells(it.sh,0).length;
function anchor(it,x,y,r){   // 把落點夾在箱子裡，避免一靠邊就放不下
  const c=cells(it.sh,r),w=Math.max(...c.map(p=>p[0]))+1,h=Math.max(...c.map(p=>p[1]))+1,g=st.grid;
  return [Math.max(0,Math.min(x,g.w-w)),Math.max(0,Math.min(y,g.h-h))];
}

const origin=()=>({x:PAD+st.grid.h*TW/2,y:PAD+st.grid.d*ZH});
// 會跟著游標變的那一層：箱子、方塊、落點預覽
function scene(){
  const g=st.grid,o=origin();
  const bag=st.items.filter(it=>it.loc==='bag'),cur=sel!=null?st.items[sel]:null;
  let s='';
  // 箱子：地板格線與後方兩面牆
  for(let x=0;x<g.w;x++)for(let y=0;y<g.h;y++)s+=poly([P(x,y,0,o),P(x+1,y,0,o),P(x+1,y+1,0,o),P(x,y+1,0,o)],'fill="#0e1622" stroke="#2c4263"');
  s+=poly([P(0,0,0,o),P(g.w,0,0,o),P(g.w,0,g.d,o),P(0,0,g.d,o)],'fill="rgba(95,179,255,.06)" stroke="#2c4263"');
  s+=poly([P(0,0,0,o),P(0,g.h,0,o),P(0,g.h,g.d,o),P(0,0,g.d,o)],'fill="rgba(95,179,255,.10)" stroke="#2c4263"');
  for(let z=1;z<g.d;z++)s+=`<path d="M${P(0,g.h,z,o)} L${P(0,0,z,o)} L${P(g.w,0,z,o)}" fill="none" stroke="#22344f" stroke-dasharray="3 4"/>`;
  // 方塊（由遠到近、由下到上）
  const cubes=[];
  for(const it of bag){if(it===cur)continue;for(const [cx,cy] of cells(it.sh,it.r))cubes.push({x:it.gx+cx,y:it.gy+cy,z:it.gz,fill:COLORS[it.i%COLORS.length],extra:`class="mp3-cube" data-i="${it.i}"`,drop:dropAt[it.i]&&fresh(dropAt[it.i],450)})}
  let ghost=null;
  if(cur&&hover&&st.editable){
    const [ax,ay]=anchor(cur,hover.x,hover.y,rot),z=dropZ(st.items,cur,ax,ay,rot),ok=z>=0;
    ghost={x:ax,y:ay,z,ok};
    const gz=ok?z:Math.min(g.d-1,Math.max(0,...cells(cur.sh,rot).map(([cx,cy])=>colHeights(st.items,cur)[(ax+cx)+','+(ay+cy)]||0)));
    for(const [cx,cy] of cells(cur.sh,rot))cubes.push({x:ax+cx,y:ay+cy,z:gz,fill:ok?'#55d38a':'#ff6b6b',extra:'pointer-events="none"',op:.6});
  }
  cubes.sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.z-b.z);
  for(const c of cubes)s+=cubeG(c,o);
  if(!st.editable){   // 準備結束：箱蓋蓋上（半透明，旅客還是看得到自己裝了什麼）
    const lid=poly([P(0,0,g.d,o),P(g.w,0,g.d,o),P(g.w,g.h,g.d,o),P(0,g.h,g.d,o)],'fill="rgba(95,179,255,.16)" stroke="#8fc4ff" stroke-width="2"');
    const hd=P(g.w/2,g.h/2,g.d,o);
    s+=`<g class="${fresh(lidAt,700)?'mp3-lidin':''}" pointer-events="none">${lid}<rect x="${(hd[0]-18).toFixed(1)}" y="${(hd[1]-5).toFixed(1)}" width="36" height="10" rx="5" fill="#8fc4ff" opacity=".7"/></g>`;
  }
  // 前方箱緣
  s+=`<path d="M${P(g.w,0,0,o)} L${P(g.w,g.h,0,o)} L${P(0,g.h,0,o)}" fill="none" stroke="#5b7fb5" stroke-width="2"/>`;
  return s;
}
// 選了東西之後，每一格頂端都是可以點的落點。游標移動時這一層不重畫，不然按到一半元素被換掉，click 會丟失
function hits(){
  const g=st.grid,o=origin(),cur=sel!=null?st.items[sel]:null;
  let s='';
  if(cur&&st.editable){
    const h=colHeights(st.items,cur),hits=[];
    for(let x=0;x<g.w;x++)for(let y=0;y<g.h;y++)hits.push({x,y,z:h[x+','+y]||0});
    hits.sort((a,b)=>(a.x+a.y)-(b.x+b.y));
    for(const t of hits)s+=poly([P(t.x,t.y,t.z,o),P(t.x+1,t.y,t.z,o),P(t.x+1,t.y+1,t.z,o),P(t.x,t.y+1,t.z,o)],`class="mp3-hit" data-cx="${t.x}" data-cy="${t.y}"`);
  }
  return s;
}
function stage(){
  const g=st.grid,W=PAD*2+(g.w+g.h)*TW/2,H=PAD*2+g.d*ZH+(g.w+g.h)*TH/2;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><g class="mp3-scene">${scene()}</g><g>${hits()}</g></svg>`;
}

function side(){
  const cur=sel!=null?st.items[sel]:null,slotOf={};
  for(const it of st.items)if(it.loc==='body')slotOf[it.slot]=it;
  const where=it=>it.loc==='bag'?`行李箱・第 ${it.gz+1} 層`:'身上・'+((st.slots.find(q=>q.id===it.slot)||{}).label||'');
  let h=st.items.map(it=>`<div class="mp3-item${sel===it.i?' on':''}${st.editable?'':' ro'}" data-sel="${it.i}">
    <span class="mp3-sw" style="background:${COLORS[it.i%COLORS.length]}"></span>
    <div>${window.Mini&&Mini.props?Mini.props.icon(it.n,it.c):''}<b>${api.esc(it.n)}</b>${it.c?'<span class="mp3-tag mp3-bad">違禁品</span>':''}${it.m?'<span class="mp3-tag mp3-metal">金屬</span>':''}
    <small>X 光：${api.esc(it.x)}・${cellCount(it)} 格</small><small>${where(it)}</small></div></div>`).join('');
  if(st.editable){
    h+=`<div class="mp3-bar">${cur?`<button data-rot="1">⟳ 旋轉（R）</button><button data-cancel="1">取消選取</button>`:''}<span class="mp3-msg">${api.esc(msg)}</span></div>`;
    h+=`<div class="mp3-hint">${cur?`已選「${api.esc(cur.n)}」：在行李箱上移動看落點，點一下放下；或點下面的位置藏到身上。`:'先點一件東西，再決定放哪裡。東西會疊起來，壓在下面的照樣會被 X 光看到。'}</div>`;
  }
  h+=`<div class="mp3-slots">${st.slots.map(q=>{
    const occ=slotOf[q.id],dis=!st.editable||!cur||(occ&&occ!==cur)||(cur&&cellCount(cur)>st.maxBodyCells);
    return `<button class="mp3-slot${occ?' full':''}" data-slot="${q.id}"${dis?' disabled':''}><b>${q.label}</b>${occ?api.esc(occ.n):'（空）'}</button>`;
  }).join('')}</div>`;
  if(st.editable&&cur&&cellCount(cur)>st.maxBodyCells)h+=`<div class="mp3-hint">這件超過 ${st.maxBodyCells} 格，太大了藏不到身上。</div>`;
  return h;
}

function draw(force){
  if(!root||!st)return;
  const s=JSON.stringify([st.items,st.editable,sel,rot,msg]),hs=JSON.stringify(hover),sc=root.querySelector('.mp3-scene');
  if(!force&&s===sig&&sc){if(hs!==hsig){hsig=hs;sc.innerHTML=scene()}return}
  sig=s;hsig=hs;
  root.innerHTML=`<div class="mp3-wrap"><div class="mp3-stage">${stage()}</div><div class="mp3-side">${side()}</div></div>`;
}

function onClick(e){
  if(!st)return;
  const t=e.target;
  if(!st.editable)return;
  const hit=t.closest('[data-cx]'),cur=sel!=null?st.items[sel]:null;
  if(hit&&cur){
    const [ax,ay]=anchor(cur,+hit.dataset.cx,+hit.dataset.cy,rot);
    if(dropZ(st.items,cur,ax,ay,rot)<0){say('這裡疊不上去，換個位置或轉個方向');api.play('tick');draw();return}
    api.send({a:'pack',i:cur.i,loc:'bag',x:ax,y:ay,r:rot});api.play('thud');sel=null;hover=null;draw();return;
  }
  const cb=t.closest('[data-i]');if(cb){pick(+cb.dataset.i);return}
  const row=t.closest('[data-sel]');if(row){pick(+row.dataset.sel);return}
  if(t.closest('[data-rot]')){rotate();return}
  if(t.closest('[data-cancel]')){sel=null;hover=null;draw();return}
  const sl=t.closest('[data-slot]');
  if(sl&&cur&&!sl.disabled){api.send({a:'pack',i:cur.i,loc:'body',slot:sl.dataset.slot});api.play('thud');sel=null;hover=null;draw()}
}
function pick(i){if(sel===i){sel=null;hover=null}else{sel=i;rot=st.items[i].loc==='bag'?st.items[i].r:0;hover=null}draw()}
function rotate(){if(sel==null)return;rot=(rot+1)&3;api.play('pop');draw()}
function onMove(e){
  if(sel==null||!st||!st.editable)return;
  const hit=e.target.closest&&e.target.closest('[data-cx]');
  const nh=hit?{x:+hit.dataset.cx,y:+hit.dataset.cy}:null;
  if(JSON.stringify(nh)!==JSON.stringify(hover)){hover=nh;draw()}
}
function onKey(e){if(sel!=null&&(e.key==='r'||e.key==='R')&&!/input|textarea/i.test((e.target.tagName||''))){rotate()}}

window.Mini=window.Mini||{};
window.Mini.pack={
  mount(r,a){
    root=r;api=a;sel=null;hover=null;sig='';prevPos=null;dropAt={};lidAt=0;wasEdit=null;
    if(!document.getElementById('mp3-style')){const s=document.createElement('style');s.id='mp3-style';s.textContent=CSS;document.head.appendChild(s)}
    root.addEventListener('click',onClick);root.addEventListener('pointermove',onMove);root.addEventListener('mousemove',onMove);root.addEventListener('pointerdown',onMove);
    document.addEventListener('keydown',onKey);
  },
  update(state){
    st=state;
    const pos={};for(const it of st.items)pos[it.i]=it.loc==='bag'?[it.gx,it.gy,it.gz,it.r].join():'';
    if(prevPos)for(const k in pos)if(pos[k]&&pos[k]!==prevPos[k]){dropAt[k]=performance.now();if(api.sfx)api.sfx.buzz(25)}
    prevPos=pos;
    if(wasEdit===true&&!st.editable){lidAt=performance.now();api.play('thud',350);if(api.sfx)api.sfx.buzz([30,40,60])}
    wasEdit=!!st.editable;
    if(sel!=null&&(!st.items[sel]||!st.editable)){sel=null;hover=null}
    draw();
  },
  unmount(){
    if(root){root.removeEventListener('click',onClick);root.removeEventListener('pointermove',onMove);root.removeEventListener('mousemove',onMove);root.removeEventListener('pointerdown',onMove);root.innerHTML=''}
    document.removeEventListener('keydown',onKey);clearTimeout(msgT);
    const s=document.getElementById('mp3-style');if(s)s.remove();
    root=null;st=null;sel=null;hover=null;sig='';
  }
};
})();
