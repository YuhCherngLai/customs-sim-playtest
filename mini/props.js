// 道具與場景插圖（原創 SVG，不用外部圖檔）：申報單、伴手禮、投票箱、最後一擊、物品圖示
// 用法：Mini.props.svg('form', 64) → SVG 字串；Mini.props.icon('吹風機') → 物品圖示；Mini.props.banner('strike') → 場景橫幅
(function(){
'use strict';
const S=(w,h,body)=>`<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="flex:none;vertical-align:middle">${body}</svg>`;
const ART={
  // 申報單：夾板上的表格，左邊一排勾選框
  form:S(64,64,`<rect x="10" y="6" width="44" height="54" rx="4" fill="#8a6d3b"/><rect x="14" y="12" width="36" height="44" rx="2" fill="#f3e8cf"/>
    <rect x="24" y="3" width="16" height="8" rx="2" fill="#c9c9c9" stroke="#6b6b6b"/>
    <text x="32" y="21" font-size="6" text-anchor="middle" fill="#a3261d" font-weight="900">DECLARE</text>
    ${[27,35,43,51].map((y,i)=>`<rect x="18" y="${y-4}" width="5" height="5" fill="#fff" stroke="#2a2114" stroke-width=".8"/>${i!==2?`<path d="M18.6 ${y-2} l1.8 1.8 l3.2-4" stroke="#1f6b45" stroke-width="1.4" fill="none"/>`:''}<rect x="26" y="${y-2.5}" width="${[20,16,21,13][i]}" height="2" rx="1" fill="#7a6a4f"/>`).join('')}`),
  // 伴手禮：紅緞帶禮盒
  gift:S(64,64,`<rect x="10" y="26" width="44" height="32" rx="3" fill="#d9534f"/><rect x="8" y="18" width="48" height="10" rx="2" fill="#e8706c"/>
    <rect x="28" y="18" width="8" height="40" fill="#ffd84d"/><path d="M32 18 C 18 4, 10 16, 30 18 Z M32 18 C 46 4, 54 16, 34 18 Z" fill="#ffd84d" stroke="#c9a52a"/>
    <circle cx="32" cy="18" r="3" fill="#c9a52a"/><path d="M14 30 h6 M14 34 h4" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`),
  // 投票箱：透明箱子，裡面有綠票紅票
  ballot:S(64,64,`<rect x="10" y="22" width="44" height="36" rx="3" fill="#5fb3ff" fill-opacity=".18" stroke="#8fc4ff" stroke-width="2"/>
    <rect x="24" y="20" width="16" height="4" rx="2" fill="#26324a"/>
    <rect x="27" y="6" width="11" height="15" rx="1" fill="#55d38a" transform="rotate(-8 32 14)"/><path d="M29 12 l2 2 l4-5" stroke="#fff" stroke-width="1.6" fill="none" transform="rotate(-8 32 14)"/>
    <rect x="16" y="42" width="11" height="13" rx="1" fill="#55d38a" transform="rotate(12 21 48)"/><rect x="30" y="44" width="11" height="13" rx="1" fill="#ff6b6b" transform="rotate(-6 35 50)"/><rect x="40" y="40" width="11" height="13" rx="1" fill="#55d38a" transform="rotate(20 45 46)"/>`),
  // 最後一擊：兩個螢幕，中間一支飛鏢
  strike:S(64,64,`<rect x="4" y="14" width="24" height="18" rx="2" fill="#000" stroke="#7dffb0" stroke-width="1.5"/><rect x="36" y="14" width="24" height="18" rx="2" fill="#000" stroke="#7dffb0" stroke-width="1.5"/>
    <rect x="14" y="32" width="4" height="6" fill="#444"/><rect x="46" y="32" width="4" height="6" fill="#444"/>
    <text x="16" y="27" font-size="11" text-anchor="middle" fill="#7dffb0" font-weight="900">?</text><text x="48" y="27" font-size="11" text-anchor="middle" fill="#7dffb0" font-weight="900">?</text>
    <path d="M32 60 L40 34" stroke="#ffc857" stroke-width="2.5"/><path d="M42 30 l-6 3 l3 4 z" fill="#ff6b6b"/><path d="M30 56 l-4 2 l2 4 l3-3 z M32 60 l3 3 l3-3 l-3-1 z" fill="#ffc857"/>`),
  // 橡皮章（放行／抓人共用，顏色由 currentColor 決定）
  stamp:S(64,64,`<ellipse cx="32" cy="12" rx="9" ry="8" fill="#8a5a33"/><rect x="28" y="17" width="8" height="18" fill="#6b4a2a"/>
    <rect x="14" y="34" width="36" height="10" rx="2" fill="#4a3320"/><rect x="12" y="44" width="40" height="8" rx="1" fill="currentColor"/>`)
};

// 物品圖示：系統字型的圖示＋一個底色圈。只用在本來就看得到物品名稱的地方（自己的行李、開過的東西、結算），不會洩漏 X 光看不到的資訊
const ICON={吹風機:'💨',自拍棒:'🤳',嬰兒爽身粉:'🧴',鬧鐘:'⏰',一疊旅遊書:'📚',行動電源:'🔋',洗髮精:'🧴',保溫瓶:'🥤',電動刮鬍刀:'🪒',
  太陽餅禮盒:'🍪',一捆充電線:'🔌',玩具水槍:'🔫',折疊傘:'☂️',指甲剪:'✂️',毛衣:'🧶',金屬皮帶扣:'🔩',一包肉乾:'🥓',巧克力:'🍫',一捲襪子:'🧦',一頂毛帽:'🧢',
  手槍:'🔫',一把刀:'🔪',一罐白粉:'🫙',一綑炸藥:'🧨',一疊假鈔:'💵',電擊棒:'⚡',一瓶汽油:'⛽',一條小蛇:'🐍',一隻小鳥:'🐦',一隻小貓:'🐱',
  麻醉藥水:'💉',手術刀:'🔪',一盒針筒:'💉',瓦斯噴槍:'🔥',開山刀:'🗡️',防熊噴霧:'🐻',信號槍:'🎆',手銬:'⛓️',皮鞭:'〰️',一盒活蟲:'🐛'};
const base=n=>String(n).replace(/（.*$/,'');   // 去掉「（職業用品，合法）」這類後綴
const icon=(n,danger)=>`<span class="pr-ic${danger?' pr-bad':''}" aria-hidden="true">${ICON[base(n)]||'📦'}</span>`;

// 場景橫幅：最後一擊（兩個螢幕在聚光燈下，中間一個大問號）
function banner(kind){
  if(kind!=='strike')return '';
  return `<svg viewBox="0 0 800 150" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">
    <defs><radialGradient id="pr-sp" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="#ffc857" stop-opacity=".45"/><stop offset="1" stop-color="#10141c" stop-opacity="0"/></radialGradient>
    <linearGradient id="pr-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1018"/><stop offset="1" stop-color="#10141c"/></linearGradient></defs>
    <rect width="800" height="150" fill="url(#pr-bg)"/><path d="M330 0 L470 0 L620 150 L180 150 Z" fill="url(#pr-sp)"/>
    ${[[470,'左'],[640,'右']].map(([x,t])=>`<g transform="translate(${x} 44)"><rect width="120" height="74" rx="6" fill="#000" stroke="#7dffb0" stroke-width="3"/><rect x="54" y="74" width="12" height="18" fill="#333"/><rect x="34" y="90" width="52" height="6" rx="3" fill="#333"/>
      <text x="60" y="50" font-size="38" text-anchor="middle" fill="#7dffb0" font-weight="900" font-family="sans-serif">?</text><text x="60" y="-8" font-size="14" text-anchor="middle" fill="#93a0b5" font-family="sans-serif">${t}螢幕</text></g>`).join('')}
    <g transform="translate(600 40) rotate(28)"><rect x="-3" y="0" width="6" height="70" fill="#ffc857"/><path d="M0 -14 L-9 4 L9 4 Z" fill="#ff6b6b"/></g>
  </svg>`;
}

const CSS=`.pr-ic{display:inline-flex;align-items:center;justify-content:center;width:1.7em;height:1.7em;border-radius:50%;background:#26324a;margin-right:4px;font-size:.95em;flex:none;line-height:1}
.pr-ic.pr-bad{background:#5a1a1a;box-shadow:0 0 0 1px #a94444}
.pr-head{display:flex;align-items:center;gap:10px}`;
if(!document.getElementById('pr-style')){const s=document.createElement('style');s.id='pr-style';s.textContent=CSS;document.head.appendChild(s)}

window.Mini=window.Mini||{};
window.Mini.props={svg:(k,size=56)=>(ART[k]||'').replace(/width="\d+" height="\d+"/,`width="${size}" height="${size}"`),icon,banner,ICON};
})();
