'use strict';
// 主頁與三個小遊戲模組共用的資料與工具（單一來源，別在別處複製）
const FEAT={
  髮型:['短髮','長髮','捲髮','光頭','馬尾','平頭'],
  眼鏡:['沒戴眼鏡','圓框眼鏡','方框眼鏡','墨鏡'],
  鬍子:['沒留鬍子','八字鬍','山羊鬍','落腮鬍'],
  帽子:['沒戴帽子','棒球帽','漁夫帽','毛帽','草帽'],
  上衣:['白襯衫','花襯衫','黑色帽T','西裝','條紋衫','皮夾克'],
  特徵:['左臉有痣','眉毛有疤','戴耳環','脖子有刺青','有酒窩','鑲金牙','滿臉雀斑','缺一顆門牙']
};
const CATS=Object.keys(FEAT);
// 行李箱格子與身上的藏匿位置
const GRID={w:3,h:3,d:3};   // 行李箱：寬 × 深 × 可以疊幾層
const SLOTS=[{id:'hat',label:'帽子裡'},{id:'coat',label:'外套內袋'},{id:'waist',label:'腰間'},{id:'lp',label:'左口袋'},{id:'rp',label:'右口袋'},{id:'shoe',label:'鞋子裡'}];
const BODY_MAX_CELLS=3;   // 超過 3 格的東西太大，藏不到身上
// 形狀 sh（例如 ["XX","X."]）順時針轉 r 次 90° 之後佔的格子，回傳 [[x,y],...]，最小 x、y 都是 0
function cells(sh,r){
  let c=[];sh.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='X')c.push([x,y])}));
  for(let k=0;k<(r&3);k++){const h=Math.max(...c.map(p=>p[1]));c=c.map(([x,y])=>[h-y,x])}
  return c;
}
// 依六類特徵畫出原創的膠囊人大頭照（護照與通緝令共用，同樣特徵一定畫出同一張臉）
// ── 3D 堆行李：每件東西厚 1 層，從上面放下去，會落在底下東西的最高點上 ──
// 行李箱裡每一格目前疊到第幾層（不算 except 這件）
function colHeights(items,except){
  const h={};
  for(const o of items)if(o!==except&&o.loc==='bag')for(const [cx,cy] of cells(o.sh,o.r)){const k=(o.gx+cx)+','+(o.gy+cy);h[k]=Math.max(h[k]||0,o.gz+1)}
  return h;
}
// 把 it 以 (x,y)、轉 r 次放下去會落在第幾層；出界或超出箱子高度回傳 -1
function dropZ(items,it,x,y,r){
  const mine=cells(it.sh,r).map(([cx,cy])=>[x+cx,y+cy]);
  if(mine.some(([cx,cy])=>cx<0||cy<0||cx>=GRID.w||cy>=GRID.h))return -1;
  const h=colHeights(items,it),z=Math.max(0,...mine.map(([cx,cy])=>h[cx+','+cy]||0));
  return z<GRID.d?z:-1;
}
// 有東西被拿走之後，上面的東西往下掉
function settle(items){
  const bag=items.filter(o=>o.loc==='bag').sort((a,b)=>a.gz-b.gz),done=[];
  for(const o of bag){o.gz=Math.max(0,dropZ(done,o,o.gx,o.gy,o.r));done.push(o)}
}

// ── 純娛樂的打扮（不影響任何判定）：背景色與小配件 ──
const DECO_BG=['#cfd8e6','#ffd9e0','#d8f3dc','#fff3bf','#e5dbff','#ffe8cc','#c5f6fa','#343a40'];
const DECO_ACC=['沒有','蝴蝶結','胸花','徽章','氣球','星星貼紙','愛心貼紙','小旗子'];
function decoSvg(acc){
  switch(acc){
    case '蝴蝶結':return '<path d="M50,90 L40,84 L40,96Z M50,90 L60,84 L60,96Z" fill="#e8437a"/><circle cx="50" cy="90" r="2.6" fill="#b82e5c"/>';
    case '胸花':return [0,72,144,216,288].map(a=>`<circle cx="${(66+4*Math.cos(a*Math.PI/180)).toFixed(1)}" cy="${(98+4*Math.sin(a*Math.PI/180)).toFixed(1)}" r="3" fill="#ff8fb1"/>`).join('')+'<circle cx="66" cy="98" r="2.4" fill="#ffd84d"/>';
    case '徽章':return '<circle cx="35" cy="99" r="5.5" fill="#f2b705" stroke="#a87b00"/><path d="M35,95.5 l1.2,2.5 2.8,.3 -2.1,1.9 .6,2.8 -2.5,-1.5 -2.5,1.5 .6,-2.8 -2.1,-1.9 2.8,-.3z" fill="#fff"/>';
    case '氣球':return '<path d="M88,40 Q86,62 82,96" stroke="#888" fill="none"/><ellipse cx="88" cy="28" rx="9" ry="11.5" fill="#ff6b6b"/><ellipse cx="85" cy="24" rx="2.4" ry="3.4" fill="#fff" opacity=".6"/>';
    case '星星貼紙':return '<path d="M12,10 l2.6,5.6 6,.7 -4.5,4.1 1.3,6 -5.4,-3.1 -5.4,3.1 1.3,-6 -4.5,-4.1 6,-.7z" fill="#ffd84d" stroke="#e0a800"/>';
    case '愛心貼紙':return '<path d="M12,24 C2,16 5,6 12,12 C19,6 22,16 12,24Z" fill="#ff5d8f"/>';
    case '小旗子':return '<path d="M12,112 L12,74" stroke="#8a6d3b" stroke-width="2"/><path d="M12,74 L26,79 L12,85Z" fill="#3fa9f5"/>';
  }
  return '';
}
function face(l,size=88,bg='#cfd8e6',deco){
  if(deco&&DECO_BG[deco.bg])bg=DECO_BG[deco.bg];
  const SK='#f3c9a0',HR='#3b2a20',o=[];
  const hair=l.髮型,top=l.上衣,hat=l.帽子,gl=l.眼鏡,bd=l.鬍子,mk=l.特徵;
  o.push(`<rect width="100" height="120" rx="10" fill="${bg}"/>`);
  // 後層：帽T 的帽兜、長髮、馬尾
  if(top==='黑色帽T')o.push('<path d="M17,96 Q12,40 32,28 L68,28 Q88,40 83,96Z" fill="#1c1c20"/>');
  if(hair==='長髮')o.push(`<path d="M19,40 Q19,14 50,14 Q81,14 81,40 L84,94 L16,94Z" fill="${HR}"/>`);
  if(hair==='馬尾')o.push(`<ellipse cx="85" cy="54" rx="7" ry="18" transform="rotate(-14 85 54)" fill="${HR}"/><rect x="76" y="34" width="8" height="5" rx="2" fill="#e04b6a"/>`);
  // 身體
  o.push(`<rect x="24" y="16" width="52" height="120" rx="26" fill="${SK}"/>`);
  // 上衣
  const C={白襯衫:'#f6f6f6',花襯衫:'#19a7a0',黑色帽T:'#2a2a2e',西裝:'#1f2f55',條紋衫:'#ffffff',皮夾克:'#6b3e1e'}[top];
  o.push(`<rect x="24" y="84" width="52" height="40" fill="${C}"/>`);
  if(top==='白襯衫')o.push('<path d="M50,84 L39,84 L45,95Z M50,84 L61,84 L55,95Z" fill="#fff" stroke="#b9bfc9"/><circle cx="50" cy="102" r="1.6" fill="#b9bfc9"/><circle cx="50" cy="112" r="1.6" fill="#b9bfc9"/>');
  if(top==='花襯衫')o.push('<path d="M50,84 L40,84 L46,94Z M50,84 L60,84 L54,94Z" fill="#12807b"/>'+[[32,94,'#ffd84d'],[66,92,'#ff8fb1'],[40,108,'#fff'],[60,106,'#ffd84d'],[30,114,'#ff8fb1'],[70,114,'#fff'],[50,116,'#ff8fb1']].map(f=>`<circle cx="${f[0]}" cy="${f[1]}" r="3.4" fill="${f[2]}"/><circle cx="${f[0]}" cy="${f[1]}" r="1.2" fill="#e0662b"/>`).join(''));
  if(top==='黑色帽T')o.push('<path d="M45,86 L45,104 M55,86 L55,104" stroke="#ddd" stroke-width="1.6"/><path d="M36,112 L64,112" stroke="#3d3d44" stroke-width="2"/>');
  if(top==='西裝')o.push('<path d="M41,84 L50,104 L59,84Z" fill="#fff"/><path d="M48,86 L52,86 L53.5,104 L50,109 L46.5,104Z" fill="#c8323c"/><path d="M41,84 L50,104 M59,84 L50,104" stroke="#111a33" stroke-width="2" fill="none"/>');
  if(top==='條紋衫')o.push([88,96,104,112].map(y=>`<rect x="24" y="${y}" width="52" height="4" fill="#2f6fd0"/>`).join(''));
  if(top==='皮夾克')o.push('<path d="M50,92 L39,84 L35,98Z M50,92 L61,84 L65,98Z" fill="#4c2a12"/><path d="M50,92 L50,124" stroke="#c9c9c9" stroke-width="1.6"/>');
  // 臉
  o.push('<path d="M34,44 L46,43 M54,43 L66,44" stroke="#3b2a20" stroke-width="2.6" stroke-linecap="round"/>');
  o.push('<circle cx="40" cy="53" r="6" fill="#fff"/><circle cx="60" cy="53" r="6" fill="#fff"/><circle cx="41" cy="54" r="2.6" fill="#222"/><circle cx="61" cy="54" r="2.6" fill="#222"/>');
  o.push('<ellipse cx="50" cy="61" rx="4" ry="3" fill="#e2a37c"/>');
  if(mk==='滿臉雀斑')o.push([[31,61],[35,64],[38,60],[62,60],[65,64],[69,61],[34,58],[66,58]].map(d=>`<circle cx="${d[0]}" cy="${d[1]}" r="1.1" fill="#a8663a"/>`).join(''));
  if(mk==='左臉有痣')o.push('<circle cx="67" cy="64" r="2.2" fill="#3b2a20"/>');
  if(mk==='眉毛有疤')o.push('<path d="M57,38 L63,49" stroke="#f7e3d0" stroke-width="3"/><path d="M57,38 L63,49" stroke="#c0564b" stroke-width="1.2"/>');
  // 鬍子
  if(bd==='落腮鬍')o.push(`<path d="M25,56 Q24,86 50,89 Q76,86 75,56 Q71,66 62,66 Q50,62 38,66 Q29,66 25,56Z" fill="${HR}"/>`);
  if(bd==='山羊鬍')o.push(`<path d="M44,75 Q50,90 56,75 Q50,78 44,75Z" fill="${HR}"/>`);
  if(bd==='八字鬍')o.push(`<path d="M50,64 Q42,62 35,69 Q44,71 50,67 Q56,71 65,69 Q58,62 50,64Z" fill="${HR}"/>`);
  // 嘴
  const mc=bd==='落腮鬍'?'#f0b8a0':'#7a2e2e';
  if(mk==='鑲金牙')o.push('<path d="M41,70 Q50,81 59,70Z" fill="#fff" stroke="#7a2e2e"/><rect x="51" y="70.5" width="4" height="4.2" fill="#f2b705" stroke="#a87b00" stroke-width=".5"/>');
  else if(mk==='缺一顆門牙')o.push('<path d="M41,70 Q50,81 59,70Z" fill="#fff" stroke="#7a2e2e"/><rect x="48" y="70.5" width="4" height="4.6" fill="#3a1414"/>');
  else o.push(`<path d="M43,71 Q50,76 57,71" stroke="${mc}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  if(mk==='有酒窩')o.push(`<path d="M38,68 q-3,4 0,8 M62,68 q3,4 0,8" stroke="${bd==='落腮鬍'?'#f0b8a0':'#c98a63'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  if(mk==='脖子有刺青')o.push('<path d="M31,74 l1.6,3.4 3.6,.4 -2.7,2.5 .8,3.6 -3.3,-1.9 -3.3,1.9 .8,-3.6 -2.7,-2.5 3.6,-.4z" fill="#2456c9" stroke="#fff" stroke-width=".6"/>');
  // 眼鏡
  if(gl==='圓框眼鏡')o.push('<circle cx="40" cy="53" r="8.5" fill="none" stroke="#222" stroke-width="2"/><circle cx="60" cy="53" r="8.5" fill="none" stroke="#222" stroke-width="2"/><path d="M48.5,53 L51.5,53" stroke="#222" stroke-width="2"/>');
  if(gl==='方框眼鏡')o.push('<rect x="31" y="46" width="17" height="13" rx="1.5" fill="none" stroke="#222" stroke-width="2"/><rect x="52" y="46" width="17" height="13" rx="1.5" fill="none" stroke="#222" stroke-width="2"/><path d="M48,52 L52,52" stroke="#222" stroke-width="2"/>');
  if(gl==='墨鏡')o.push('<rect x="30" y="46" width="18" height="12" rx="4" fill="#111"/><rect x="52" y="46" width="18" height="12" rx="4" fill="#111"/><path d="M48,50 L52,50 M30,50 L24,48 M70,50 L76,48" stroke="#111" stroke-width="2"/><path d="M33,49 l5,0" stroke="#666" stroke-width="1.4"/>');
  // 前層頭髮
  if(hair==='短髮'||hair==='長髮'||hair==='馬尾')o.push(`<path d="M24,42 A26,26 0 0 1 76,42 L76,38 Q50,25 24,38Z" fill="${HR}"/>`);
  if(hair==='平頭')o.push(`<path d="M24,40 L24,22 Q24,11 35,11 L65,11 Q76,11 76,22 L76,40 Q50,31 24,40Z" fill="${HR}"/>`);
  if(hair==='捲髮')o.push([[27,37],[31,26],[40,18],[50,15],[60,18],[69,26],[73,37]].map(c=>`<circle cx="${c[0]}" cy="${c[1]}" r="8.5" fill="${HR}"/>`).join(''));
  if(hair==='光頭'&&hat==='沒戴帽子')o.push('<ellipse cx="41" cy="26" rx="7" ry="3" transform="rotate(-25 41 26)" fill="#fff" opacity=".55"/>');
  // 帽子
  if(hat==='棒球帽')o.push('<path d="M23,36 A27,25 0 0 1 77,36Z" fill="#d23b3b"/><path d="M68,31 L96,36 Q97,41 92,41 L68,37Z" fill="#a82a2a"/><circle cx="50" cy="12" r="2.4" fill="#a82a2a"/>');
  if(hat==='漁夫帽')o.push('<path d="M31,32 L35,10 Q50,6 65,10 L69,32Z" fill="#c9b27a"/><path d="M12,41 L27,29 L73,29 L88,41 Q50,33 12,41Z" fill="#b39a5e"/>');
  if(hat==='毛帽')o.push('<path d="M23,34 A27,27 0 0 1 77,34Z" fill="#2f6fd0"/><rect x="21" y="29" width="58" height="10" rx="5" fill="#7fb0f5"/><circle cx="50" cy="7" r="6.5" fill="#fff"/>');
  if(hat==='草帽')o.push('<path d="M32,32 L35,13 Q50,7 65,13 L68,32Z" fill="#f1d57a"/><ellipse cx="50" cy="33" rx="45" ry="7" fill="#e8c65a"/><path d="M32.5,29 L67.5,29 L67,24 L33,24Z" fill="#b5473c"/>');
  if(mk==='戴耳環')o.push('<circle cx="23" cy="64" r="4.5" fill="none" stroke="#f2b705" stroke-width="2.4"/>');
  if(deco)o.push(decoSvg(deco.acc));
  return `<svg class="face" width="${size}" height="${Math.round(size*1.2)}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">${o.join('')}</svg>`;
}
window.Mini=window.Mini||{};
