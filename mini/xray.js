// X 光檢視：後台看每位旅客行李箱的 X 光。一張從上往下照穿的影像，只有輪廓和材質（藍＝金屬、橘＝非金屬），沒有名稱；壓在下層的照樣看得到
// bags[i].messy＝這個箱子超重：items 是空的，改給 blob（每一格疊幾層），畫成看不清的一團（選填，沒給就是原本的樣子）
(function(){
  'use strict';
  const CSS=`
.xr-bags{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:8px}
.xr-bag{border:1px solid var(--line,#2c3649);border-radius:10px;padding:8px 10px;background:var(--card,#1a2130);min-width:0}
.xr-bag.xr-cur{border-color:var(--warn,#ffc857)}
.xr-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px}
.xr-head b{font-size:15px}
.xr-dim{color:var(--dim,#93a0b5);font-size:12px}
.xr-tag{color:var(--warn,#ffc857);font-size:12px}
.xr-tools{display:flex;flex-wrap:wrap;gap:6px 10px;margin-bottom:8px}
.xr-seg{display:inline-flex;border:1px solid var(--line,#2c3649);border-radius:8px;overflow:hidden}
.xr-seg button{font:inherit;font-size:13px;min-height:32px;padding:2px 10px;border:0;border-left:1px solid var(--line,#2c3649);background:transparent;color:var(--dim,#93a0b5);cursor:pointer}
.xr-seg button:first-child{border-left:0}
.xr-seg button.xr-on{background:#12414b;color:#dff8ff}
.xr-wrap{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
.xr-scr{flex:1 1 200px;max-width:300px;min-width:0}
.xr-svg{display:block;width:100%;height:auto;border:2px solid #1d6f78;border-radius:8px;background:#03141a;touch-action:manipulation}
.xr-gl{stroke:#0d3a44;stroke-width:.15}
.xr-it{cursor:pointer;transition:opacity .15s}
.xr-it.xr-M{color:#4fb4ff}.xr-it.xr-O{color:#ff9f43}
.xr-it .xr-b{fill:currentColor;fill-opacity:.4;stroke:currentColor;stroke-width:.45;stroke-linejoin:round}
.xr-it .xr-b.xr-dense{fill-opacity:.7}
.xr-it .xr-b.xr-thin{fill-opacity:.2}
.xr-it .xr-d{fill:none;stroke:currentColor;stroke-width:.45;stroke-linecap:round;stroke-linejoin:round}
.xr-it.xr-off{opacity:.07;pointer-events:none}
.xr-it.xr-fade{opacity:.35}
.xr-it.xr-sel .xr-b,.xr-it.xr-sel .xr-d{stroke:#fff}
.xr-list{list-style:none;margin:0;padding:0;font-size:13px;flex:1 1 150px;min-width:0;color:var(--fg,#e8ecf3)}
.xr-list li{display:flex;gap:6px;align-items:center;padding:4px 6px;border:1px solid transparent;border-radius:6px;cursor:pointer}
.xr-list li.xr-sel{border-color:#fff;background:rgba(255,255,255,.06)}
.xr-list li.xr-off{opacity:.3}
.xr-dot{flex:none;width:10px;height:10px;border-radius:3px}
.xr-dot.xr-M{background:#4fb4ff}.xr-dot.xr-O{background:#ff9f43}
.xr-empty{color:var(--dim,#93a0b5);font-size:13px}
.xr-fm{fill:none;stroke:var(--warn,#ffc857);stroke-width:.7;stroke-dasharray:1.6 1.1;pointer-events:none}
.xr-fm.xr-done{stroke:var(--good,#55d38a);stroke-dasharray:none}
.xr-ft{flex:none;margin-left:auto;font-size:12px;color:var(--warn,#ffc857);white-space:nowrap}
.xr-ft.xr-done{color:var(--good,#55d38a)}
.xr-flag{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:8px;padding:6px 8px;border:1px dashed var(--line,#2c3649);border-radius:8px;font-size:13px;color:var(--fg,#e8ecf3)}
.xr-flag.xr-has{border-color:var(--warn,#ffc857)}
.xr-flag.xr-done{border-style:solid;border-color:var(--good,#55d38a);color:var(--good,#55d38a)}
.xr-flag button{font:inherit;font-size:13px;min-height:32px;padding:2px 12px;border-radius:8px;border:1px solid #3d5278;background:#2a3a55;color:var(--fg,#e8ecf3);cursor:pointer}
.xr-flag button.xr-go{background:#6b5310;border-color:var(--warn,#ffc857)}
.xr-belt{animation:xrbelt 1.1s cubic-bezier(.2,.7,.3,1)}
@keyframes xrbelt{0%{transform:translateX(-36px)}100%{transform:none}}
.xr-beam{fill:#a8ffff;opacity:0;animation:xrbeam 1.3s .35s forwards}
@keyframes xrbeam{0%{opacity:.85;transform:translateX(0)}90%{opacity:.6;transform:translateX(29px)}100%{opacity:0;transform:translateX(29px)}}
.xr-roll{height:8px;margin-top:4px;border-radius:4px;background:repeating-linear-gradient(90deg,#1d6f78 0 6px,#03141a 6px 12px)}
.xr-roll.xr-run{animation:xrroll 1.1s cubic-bezier(.2,.7,.3,1)}
@keyframes xrroll{from{background-position:-60px 0}to{background-position:0 0}}
.xr-mz{fill:#c9d4e2}
.xr-mzt{color:var(--warn,#ffc857);font-size:13px;line-height:1.5}`;
  // 每種「X 光下的樣子」一個原創輪廓，座標 10 單位＝1 格，畫在未旋轉的形狀上。b＝實心輪廓、d＝內部線條
  const B=(s,c)=>`<path class="xr-b${c?' xr-'+c:''}" d="${s}"/>`,D=s=>`<path class="xr-d" d="${s}"/>`;
  const rr=(x,y,w,h,r)=>`M${x+r},${y}h${w-2*r}a${r},${r} 0 0 1 ${r},${r}v${h-2*r}a${r},${r} 0 0 1 ${-r},${r}h${-(w-2*r)}a${r},${r} 0 0 1 ${-r},${-r}v${-(h-2*r)}a${r},${r} 0 0 1 ${r},${-r}z`;
  const ci=(x,y,r)=>`M${x-r},${y}a${r},${r} 0 1 0 ${2*r},0a${r},${r} 0 1 0 ${-2*r},0z`;
  const SIL={
    'L 形、有握把的金屬物':B('M1.5,2.5H18.5V7.5H9L8.5,18.5H3L2.5,8L1.5,7.5z')+D(ci(5.5,5,1.5)+'M15,2.5V7.5M9,7.5q2.6,.2 2.6,2.8'),
    '細長棒狀金屬':B(rr(1,3.6,28,2.8,1.4))+B(rr(1,2.6,8,4.8,2))+D('M3,5H7M12,3.6V6.4M20,3.6V6.4'),
    '罐裝白色粉末':B(rr(2,5,6,14,1.5),'thin')+B(rr(2.6,1.5,4.8,3.5,.8))+B('M2.3,11H7.7V17.5a1.2,1.2 0 0 1 -1.2,1.2h-3a1.2,1.2 0 0 1 -1.2,-1.2z')+D('M3.5,13.5h.1M5.5,14.5h.1M4.2,16.2h.1M6.4,12.6h.1'),
    '圓形、內有齒輪與電線':B(ci(10,10,8.5))+D(ci(10,10,3)+'M10,5.4V7M10,13V14.6M5.4,10H7M13,10H14.6M6.8,6.8L7.9,7.9M12.1,12.1L13.2,13.2M13.2,6.8L12.1,7.9M7.9,12.1L6.8,13.2M3.5,13q2,3.5 5,3.5M16.5,7q-1,-3.5 -4.5,-4'),
    '方形紙類堆疊':B(rr(1.5,1.5,14.5,14.5,.6))+B(rr(4,4,14.5,14.5,.6))+D('M6,7.5H16.5M6,10.5H16.5M6,13.5H13'),
    '磚塊狀高密度電子物':B(rr(1.5,2,17,6,1),'dense')+D('M7,2V8M13,2V8M3.2,5H5.2'),
    '瓶裝液體':B('M4,1.5h2v3.5q2.5,1.5 2.5,4V17.5a1,1 0 0 1 -1,1h-5a1,1 0 0 1 -1,-1V9q0,-2.5 2.5,-4z','thin')+B('M1.5,10.5q1.8,-1 3.5,0t3.5,0V17.5a1,1 0 0 1 -1,1h-5a1,1 0 0 1 -1,-1z')+D('M3.6,1.5h2.8'),
    '圓柱形金屬容器':B(rr(2.5,1.5,5,27,2.5))+D(rr(3.8,7,2.4,19.5,1.2)+'M2.5,5.5H7.5'),
    '手掌大的金屬物':B(rr(2.5,2,5,16,2.5))+D(ci(5,5,1.5)+'M2.5,8.5H7.5M4,12v3M6,12v3'),
    '方盒、內有多塊有機物':B(rr(1.5,1.5,27,17,1),'thin')+[5.8,15,24.2].map(x=>[5.8,14.2].map(y=>B(ci(x,y,3.1))).join('')).join(''),
    '纏成一團的金屬線':D('M2.5,5a7.5,3 0 1 0 15,0a7.5,3 0 1 0 -15,0M5,5a5,3.6 0 1 0 10,0a5,3.6 0 1 0 -10,0M3.5,3.2Q10,9 16.5,3.2M3.5,6.8Q10,1 16.5,6.8M17.5,5h1.2')+B(ci(10,5,1.2),'dense'),
    '槍形塑膠物':B('M1.5,3H13V1.5H17V3H18.5V7H9.5L9,18.5H4L3.5,7.5L1.5,7z')+D('M9.5,7q3,0 3,3M5,10.5h2.5M5,13.5h2.5'),
    '長條金屬骨架':D('M1.5,5H27.5q1.6,0 1.6,1.6t-1.4,1.4M5,3.4H23M5,6.6H23M5,3.4L3,5L5,6.6M23,3.4L25,5L23,6.6')+B(rr(5,3.4,18,3.2,.4),'thin'),
    '小型金屬片':B('M1.8,6.2L8.2,3.2L8.4,4.6L2,7.4z')+B('M1.8,7L8.2,5.6L8.2,6.8L2,8z','dense')+D(ci(3,6.9,.5)),
    '一團布料':B('M3,5Q5,1.5 10,3Q15,1 17,5Q19.5,10 17,15Q15,19 10,17.5Q5,19 3,15Q.8,10 3,5z','thin')+D('M5,6Q9,8 8,13M11,4.5Q13,10 11,16M15,6.5Q13.5,11 15,14.5'),
    '扁平金屬塊':B(rr(2,2.8,6,4.6,.8),'dense')+D(rr(3.6,4.1,2.8,2,.4))
  };
  let root=null,api=null,st=null,key='',lastCur=null,beltT=0;
  const scanAt={};   // 每位旅客剛上櫃台的時間：那一瞬間播輸送帶動畫
  const fresh=l=>scanAt[l]&&performance.now()-scanAt[l]<1500;
  const ui={};   // 每位旅客各自的檢視設定：{f:'a'|'m'|'o', z:-1|層, sel:-1|第幾件}
  const uiOf=l=>ui[l]||(ui[l]={f:'a',z:-1,sel:-1});

  // 沒有對應輪廓的東西：照格子畫圓角方塊
  const fallback=sh=>sh.map((row,y)=>[...row].map((ch,x)=>ch==='X'?B(rr(x*10+.8,y*10+.8,8.4,8.4,1.5)):'').join('')).join('');
  // 跟 cells(sh,r) 同一套順時針旋轉
  function xform(it){
    let h=it.sh.length*10,w=it.sh[0].length*10,t='';
    for(let k=0;k<(it.r&3);k++){t=`matrix(0 1 -1 0 ${h} 0) `+t;[w,h]=[h,w]}
    return `translate(${it.gx*10} ${it.gy*10}) `+t;
  }
  const shown=(it,u)=>(u.f==='a'||(u.f==='m')===!!it.m)&&(u.z<0||u.z===it.gz);
  // 指認抽查：我指給海關的那一件（沒有就 -1）。canFlag／flag／flagOpened 都是選填，沒給就跟純檢視一樣
  const flagOf=bag=>bag.canFlag&&Number.isInteger(bag.flag)&&bag.flag>=0&&bag.flag<(bag.items||[]).length?bag.flag:-1;
  function flagHtml(bag,bi,u){
    if(!bag.canFlag)return '';
    const fl=flagOf(bag),desc=k=>`${bag.items[k].m?'金屬':'非金屬'}・${api.esc(bag.items[k].x)}`;
    if(fl>=0&&bag.flagOpened)return `<div class="xr-flag xr-done">📦 海關開了你指的那一件（${desc(fl)}）</div>`;
    if(fl>=0)return `<div class="xr-flag xr-has"><span>👉 你指給海關的是：<b>${desc(fl)}</b></span>${u.sel>=0&&u.sel!==fl?`<button type="button" class="xr-go" data-xr="flag" data-b="${bi}" data-v="${u.sel}">👉 改指這一件</button>`:''}<button type="button" data-xr="unflag" data-b="${bi}">取消指認</button></div>`;
    return `<div class="xr-flag">${u.sel>=0?`<button type="button" class="xr-go" data-xr="flag" data-b="${bi}" data-v="${u.sel}">👉 指給海關</button><span class="xr-dim">海關只會知道它的形狀描述，花 1 點就能單獨開這一件</span>`:'<span class="xr-dim">👉 指認：先點一件可疑的東西，再按「指給海關」（這位旅客只能指一件）</span>'}</div>`;
  }

  // 超重的箱子（messy）：主機只給每一格疊多高（blob，長度 w×h），畫成模糊的一團；沒有件數、形狀、材質，也不能指認
  function messyHtml(bag,bi,grid){
    const esc=api.esc,W=grid.w*10,H=grid.h*10,bl=bag.blob||[],run=bag.cur&&fresh(bag.label);
    const cells=bl.map((h,i)=>h?`<rect class="xr-mz" x="${(i%grid.w)*10-1}" y="${Math.floor(i/grid.w)*10-1}" width="12" height="12" rx="4" fill-opacity="${Math.min(.95,.2+h*.25).toFixed(2)}"/>`:'').join('');
    return `<div class="xr-bag${bag.cur?' xr-cur':''}"><div class="xr-head"><b>${esc(bag.label)}</b>${bag.cur?'<span class="xr-tag">← 櫃台</span>':''}<span class="xr-tag">⚖️ 超重</span></div>
      <div class="xr-wrap"><div class="xr-scr"><svg class="xr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="xr-mzf${bi}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.6"/></filter></defs><g class="${run?'xr-belt':''}" filter="url(#xr-mzf${bi})">${cells}</g>${run?`<rect class="xr-beam" x="0" y="0" width="1.4" height="${H}"/>`:''}</svg><div class="xr-roll${run?' xr-run':''}"></div></div>
      <div class="xr-list xr-mzt">⚖️ 這個箱子超重：東西疊成一團，X 光看不清楚——分不出有幾件、什麼形狀、是不是金屬，只看得出哪裡塞得比較厚。<br><span class="xr-dim">超重的箱子沒辦法指認；海關可以免費丟掉裡面一件。</span></div></div></div>`;
  }
  function bagHtml(bag,bi,grid){
    if(bag.messy)return messyHtml(bag,bi,grid);
    const items=bag.items||[],esc=api.esc,u=uiOf(bag.label),W=grid.w*10,H=grid.h*10;
    if(u.sel>=items.length||(u.sel>=0&&!shown(items[u.sel],u)))u.sel=-1;
    const seg=(k,opts)=>`<span class="xr-seg">${opts.map(([v,t])=>`<button type="button" class="${u[k]===v?'xr-on':''}" data-xr="${k}" data-b="${bi}" data-v="${v}">${t}</button>`).join('')}</span>`;
    let gl='';
    for(let x=1;x<grid.w;x++)gl+=`<path class="xr-gl" d="M${x*10},0V${H}"/>`;
    for(let y=1;y<grid.h;y++)gl+=`<path class="xr-gl" d="M0,${y*10}H${W}"/>`;
    const order=items.map((it,k)=>k).sort((a,b)=>items[a].gz-items[b].gz||a-b);
    const run=bag.cur&&fresh(bag.label);
    const svg=order.map(k=>{const it=items[k];
      return `<g class="xr-it ${it.m?'xr-M':'xr-O'}${shown(it,u)?(u.sel>=0&&u.sel!==k?' xr-fade':u.sel===k?' xr-sel':''):' xr-off'}" data-xr="sel" data-b="${bi}" data-v="${k}" transform="${xform(it)}">${SIL[it.x]||fallback(it.sh)}</g>`}).join('');
    const fl=flagOf(bag),fi=fl>=0?items[fl]:null;
    const mark=fi?`<g transform="${xform(fi)}"><path class="xr-fm${bag.flagOpened?' xr-done':''}" d="${rr(.5,.5,fi.sh[0].length*10-1,fi.sh.length*10-1,1.5)}"/></g>`:'';
    const list=items.map((it,k)=>`<li class="${u.sel===k?'xr-sel':''}${shown(it,u)?'':' xr-off'}" data-xr="sel" data-b="${bi}" data-v="${k}"><span class="xr-dot ${it.m?'xr-M':'xr-O'}"></span><span>${it.m?'金屬':'非金屬'}・${esc(it.x)}・第 ${it.gz+1} 層</span>${fl===k?`<span class="xr-ft${bag.flagOpened?' xr-done':''}">${bag.flagOpened?'📦 海關開了':'👉 已指認'}</span>`:''}</li>`).join('');
    return `<div class="xr-bag${bag.cur?' xr-cur':''}"><div class="xr-head"><b>${esc(bag.label)}</b>${bag.cur?'<span class="xr-tag">← 櫃台</span>':''}<span class="xr-dim">行李箱 ${items.length} 件</span></div>
      <div class="xr-tools">${seg('f',[['a','全部'],['m','只看金屬'],['o','只看非金屬']])}${seg('z',[[-1,'照穿'],...Array.from({length:grid.d},(_,z)=>[z,`第 ${z+1} 層`])])}</div>
      <div class="xr-wrap"><div class="xr-scr"><svg class="xr-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${gl}<g class="${run?'xr-belt':''}">${svg}${mark}</g>${run?`<rect class="xr-beam" x="0" y="0" width="1.4" height="${H}"/>`:''}</svg><div class="xr-roll${run?' xr-run':''}"></div></div>
      <ul class="xr-list">${list||'<li class="xr-empty">空的</li>'}</ul></div>${flagHtml(bag,bi,u)}</div>`;
  }
  function render(){
    if(!root||!st)return;
    const grid=st.grid||GRID,bags=st.bags||[];
    root.innerHTML=bags.length?`<div class="xr-dim" style="margin-bottom:6px">藍＝金屬　橘＝非金屬　疊在一起的地方顏色會變深。點一件東西可以單獨看它。</div><div class="xr-bags">${bags.map((b,i)=>bagHtml(b,i,grid)).join('')}</div>`:'<div class="xr-empty">目前沒有行李可以看。</div>';
  }
  function onClick(e){
    const el=e.target.closest&&e.target.closest('[data-xr]');
    if(!el||!st)return;
    const bag=(st.bags||[])[+el.dataset.b];if(!bag)return;
    const u=uiOf(bag.label),k=el.dataset.xr,v=el.dataset.v;
    if(bag.messy)return;   // 超重的箱子看不清，沒有可以點的東西
    if(k==='flag'||k==='unflag'){   // 指認／取消：只送出，結果等主機下一次 update
      if(!bag.canFlag||bag.flagOpened)return;
      if(k==='flag'&&!(+v>=0&&+v<(bag.items||[]).length))return;
      api.play('pop');api.send({a:'flag',item:k==='flag'?+v:null});return;
    }
    if(k==='f')u.f=v;
    else if(k==='z')u.z=+v;
    else if(k==='sel'){if(!shown(bag.items[+v],u))return;u.sel=u.sel===+v?-1:+v}
    api.play('tick');render();
  }

  window.Mini=window.Mini||{};
  window.Mini.xray={
    mount(r,a){
      root=r;api=a;st=null;key='';lastCur=null;
      if(!document.getElementById('xr-style')){const s=document.createElement('style');s.id='xr-style';s.textContent=CSS;document.head.appendChild(s)}
      root.addEventListener('click',onClick);
    },
    update(state){
      if(!root||!state)return;
      const k=JSON.stringify(state);
      if(k===key)return;   // 內容沒變就不重畫
      const c=(state.bags||[]).find(b=>b.cur),lab=c?c.label:null;
      if(lab!==lastCur){lastCur=lab;if(lab){scanAt[lab]=performance.now();clearTimeout(beltT);beltT=setTimeout(()=>{delete scanAt[lab];if(root&&st)render()},1700);try{if(api.sfx){api.sfx.tone(110,1000,'sawtooth',.04,80);setTimeout(()=>{if(api&&api.sfx)api.sfx.tone(900,90,'sine',.1)},1300)}}catch(e){}}}
      key=k;st=state;render();
    },
    unmount(){
      if(root){root.removeEventListener('click',onClick);root.innerHTML=''}
      clearTimeout(beltT);
      const s=document.getElementById('xr-style');if(s)s.remove();
      for(const l in ui)delete ui[l];
      root=api=st=null;key='';
    }
  };
})();
