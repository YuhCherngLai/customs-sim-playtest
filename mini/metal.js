// 金屬探測小遊戲模組：window.Mini.metal = { mount, update, unmount }
(function () {
  'use strict';

  var HOLD_MS = 1200;      // 探測棒要停多久才算掃完
  var TICK_MS = 300;       // 充能時每隔多久響一次 tick
  var PENDING_MS = 4000;   // 送出掃描後多久沒回應就允許重掃
  var FRISK_LOCK_MS = 1500;// 按下取出後暫時鎖住按鈕，避免連點
  var FLASH_MS = 1800;     // 新結果的強調動畫長度
  var DETACH_GRACE_MS = 400;
  var STYLE_ID = 'mmd-style';
  var RING_C = 2 * Math.PI * 27;

  var FALLBACK_SLOTS = [
    { id: 'hat', label: '帽子裡' }, { id: 'coat', label: '外套內袋' }, { id: 'waist', label: '腰間' },
    { id: 'lp', label: '左口袋' }, { id: 'rp', label: '右口袋' }, { id: 'shoe', label: '鞋子裡' }
  ];
  // 各部位在人形圖（viewBox 0 0 220 372）上的範圍
  var ZONE = {
    hat:   { x: 58,  y: 10,  w: 104, h: 54 },
    coat:  { x: 66,  y: 128, w: 88,  h: 58 },
    waist: { x: 76,  y: 192, w: 68,  h: 30 },
    lp:    { x: 48,  y: 228, w: 56,  h: 46 },
    rp:    { x: 116, y: 228, w: 56,  h: 46 },
    shoe:  { x: 54,  y: 318, w: 112, h: 46 }
  };

  var CSS = [
    '.mmd-wrap{container-type:inline-size;container-name:mmd;color:var(--fg,#e8ecf3);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    '.mmd-wrap *{box-sizing:border-box}',
    '.mmd-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}',
    '.mmd-title{font-weight:700;font-size:1.05em}',
    '.mmd-ap{display:inline-flex;align-items:baseline;gap:6px;padding:3px 12px;border:1px solid var(--line,#2c3649);border-radius:999px;background:var(--card,#1a2130);font-size:.85em;color:var(--dim,#93a0b5);white-space:nowrap}',
    '.mmd-ap b{color:var(--warn,#ffc857);font-size:1.35em;font-variant-numeric:tabular-nums}',
    '.mmd-ap.mmd-low b{color:var(--bad,#ff6b6b)}',
    '.mmd-hint{color:var(--dim,#93a0b5);font-size:.85em;margin-bottom:8px}',
    '.mmd-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:10px;align-items:start}',
    '.mmd-play{position:relative;touch-action:none;cursor:none;overflow:hidden;display:flex;justify-content:center;padding:6px;border:1px solid var(--line,#2c3649);border-radius:12px;background:radial-gradient(ellipse at 50% 100%,rgba(95,179,255,.14),transparent 62%),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 22px),var(--bg,#10141c)}',
    '.mmd-fig{width:100%;max-width:270px}',
    '.mmd-fig svg{display:block;width:100%;height:auto;overflow:visible}',
    '.mmd-idlemsg{display:none;position:absolute;inset:0;place-items:center;text-align:center;font-weight:700;font-size:1.1em;color:var(--dim,#93a0b5);letter-spacing:.08em}',
    '.mmd-idle .mmd-idlemsg{display:grid}',
    '.mmd-idle .mmd-play{cursor:default}',
    '.mmd-idle .mmd-fig{opacity:.22;filter:grayscale(1)}',
    '.mmd-idle .mmd-zones{display:none}',
    '.mmd-idle .mmd-side{opacity:.45}',
    '.mmd-side{display:flex;flex-direction:column;gap:8px;min-width:0}',
    '.mmd-pass{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--line,#2c3649);border-radius:10px;background:var(--card,#1a2130);min-height:60px}',
    '.mmd-pass svg{flex:none;border-radius:6px;display:block}',
    '.mmd-pass small{display:block;color:var(--dim,#93a0b5);font-size:.75em}',
    '.mmd-pass b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mmd-pname{min-width:0}',
    '.mmd-list{display:grid;grid-template-columns:1fr;gap:6px}',
    '.mmd-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;column-gap:8px;padding:6px 8px;border:1px solid var(--line,#2c3649);border-radius:10px;background:var(--card,#1a2130);transition:border-color .12s,background .12s}',
    '.mmd-dot{width:10px;height:10px;border-radius:50%;background:var(--line,#2c3649)}',
    '.mmd-rl{min-width:0}',
    '.mmd-rl b{display:block;font-size:.92em}',
    '.mmd-rl small{display:block;color:var(--dim,#93a0b5);font-size:.76em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mmd-row.mmd-hot{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.08)}',
    '.mmd-row.mmd-beep{border-color:var(--bad,#ff6b6b)}',
    '.mmd-row.mmd-beep .mmd-dot{background:var(--bad,#ff6b6b);box-shadow:0 0 8px var(--bad,#ff6b6b)}',
    '.mmd-row.mmd-beep small{color:var(--bad,#ff6b6b)}',
    '.mmd-row.mmd-clear .mmd-dot{background:var(--good,#55d38a)}',
    '.mmd-row.mmd-clear small{color:var(--good,#55d38a)}',
    '.mmd-row.mmd-taken small{color:var(--fg,#e8ecf3)}',
    '.mmd-row.mmd-pending .mmd-dot{background:var(--acc,#5fb3ff);animation:mmd-blink .5s linear infinite}',
    '.mmd-btn{font:inherit;font-size:.8em;padding:5px 8px;border-radius:8px;border:1px solid var(--warn,#ffc857);background:rgba(255,200,87,.12);color:var(--warn,#ffc857);cursor:pointer;white-space:nowrap}',
    '.mmd-btn:hover:not(:disabled){background:rgba(255,200,87,.26)}',
    '.mmd-btn:disabled{border-color:var(--line,#2c3649);background:transparent;color:var(--dim,#93a0b5);opacity:.6;cursor:not-allowed}',
    '.mmd-tip{color:var(--dim,#93a0b5);font-size:.76em}',
    // 人形圖上的部位
    '.mmd-zbox{fill:rgba(95,179,255,.10);stroke:var(--acc,#5fb3ff);stroke-width:1.5;stroke-dasharray:5 4}',
    '.mmd-zpulse{fill:none;stroke:var(--bad,#ff6b6b);stroke-width:3;opacity:0;transform-box:fill-box;transform-origin:center}',
    '.mmd-zcheck{fill:none;stroke:var(--good,#55d38a);stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round;display:none;transform-box:fill-box;transform-origin:center}',
    '.mmd-ztext{font-size:11px;font-weight:700;fill:var(--fg,#e8ecf3);text-anchor:middle;paint-order:stroke;stroke:#0b0e14;stroke-width:3px;stroke-linejoin:round;pointer-events:none}',
    '.mmd-hot .mmd-zbox{fill:rgba(255,200,87,.22);stroke:var(--warn,#ffc857);stroke-dasharray:none;stroke-width:2.5}',
    '.mmd-pending .mmd-zbox{stroke:var(--acc,#5fb3ff);stroke-width:2.5;animation:mmd-march .4s linear infinite}',
    '.mmd-beep .mmd-zbox{fill:rgba(255,107,107,.38);stroke:var(--bad,#ff6b6b);stroke-dasharray:none;stroke-width:2.5;animation:mmd-redglow 1.1s ease-in-out infinite}',
    '.mmd-beep .mmd-zpulse{animation:mmd-pulse 1.1s ease-out infinite}',
    '.mmd-beep .mmd-ztext{fill:#fff;font-size:13px}',
    '.mmd-beep.mmd-flash .mmd-zbox{animation-duration:.3s}',
    '.mmd-beep.mmd-flash .mmd-zpulse{animation-duration:.42s;stroke-width:5}',
    '.mmd-beep.mmd-flash .mmd-ztext{animation:mmd-shake .12s linear infinite}',
    '.mmd-clear .mmd-zbox{fill:rgba(85,211,138,.16);stroke:var(--good,#55d38a);stroke-dasharray:none}',
    '.mmd-clear .mmd-zcheck{display:block}',
    '.mmd-clear.mmd-flash .mmd-zcheck{animation:mmd-popin .35s ease-out}',
    '.mmd-taken .mmd-zcheck{display:none}',
    '.mmd-taken .mmd-zbox{stroke-dasharray:2 3}',
    '.mmd-taken .mmd-ztext{fill:var(--warn,#ffc857);font-size:12px}',
    // 探測棒
    '.mmd-wand{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;display:none;z-index:3}',
    '.mmd-wand.mmd-on{display:block}',
    '.mmd-wand svg{position:absolute;left:-40px;top:-40px;width:140px;height:140px;overflow:visible;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55))}',
    '.mmd-wring{display:none}',
    '.mmd-wand.mmd-chg .mmd-wring{display:block}',
    '.mmd-wand.mmd-chg svg{animation:mmd-hum .08s linear infinite;filter:drop-shadow(0 0 8px rgba(255,200,87,.85))}',
    '.mmd-wglow{fill:var(--warn,#ffc857);opacity:0}',
    '.mmd-wled{fill:#3a4458}',
    '.mmd-wand.mmd-chg .mmd-wled{fill:var(--bad,#ff6b6b);animation:mmd-blink .3s linear infinite}',
    '@keyframes mmd-hum{0%{transform:translate(.7px,-.5px)}50%{transform:translate(-.7px,.6px)}100%{transform:translate(.5px,.5px)}}',
    '@keyframes mmd-blink{0%,49%{opacity:1}50%,100%{opacity:.25}}',
    '@keyframes mmd-march{to{stroke-dashoffset:-9}}',
    '@keyframes mmd-redglow{0%,100%{fill:rgba(255,107,107,.25)}50%{fill:rgba(255,107,107,.55)}}',
    '@keyframes mmd-pulse{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}',
    '@keyframes mmd-shake{0%{transform:translate(1px,0)}50%{transform:translate(-1px,0)}100%{transform:translate(1px,0)}}',
    '@keyframes mmd-popin{0%{transform:scale(.2)}70%{transform:scale(1.25)}100%{transform:scale(1)}}',
    '@container mmd (max-width:480px){.mmd-grid{grid-template-columns:1fr}.mmd-fig{max-width:230px}.mmd-list{grid-template-columns:1fr 1fr}}',
    '@container mmd (max-width:400px){.mmd-list{grid-template-columns:1fr}}'
  ].join('\n');

  var WAND_SVG =
    '<svg viewBox="-40 -40 140 140" aria-hidden="true">' +
      '<circle class="mmd-wglow" r="19"/>' +
      '<g transform="rotate(45)">' +
        '<rect x="15" y="-4" width="10" height="8" fill="#ffc857"/>' +
        '<rect x="22" y="-8" width="60" height="16" rx="8" fill="#15181f" stroke="#000" stroke-width="1"/>' +
        '<rect x="36" y="-8" width="7" height="16" fill="#ffc857"/>' +
        '<rect x="50" y="-8" width="7" height="16" fill="#ffc857"/>' +
        '<rect x="64" y="-8" width="7" height="16" fill="#ffc857"/>' +
        '<circle class="mmd-wled" cx="29" cy="0" r="3"/>' +
      '</g>' +
      '<circle r="17" fill="rgba(255,200,87,.10)" stroke="#ffc857" stroke-width="7"/>' +
      '<circle r="17" fill="none" stroke="#15181f" stroke-width="7" stroke-dasharray="6 11.8"/>' +
      '<g class="mmd-wring" transform="rotate(-90)">' +
        '<circle r="27" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="5"/>' +
        '<circle class="mmd-wprog" r="27" fill="none" stroke="#5fb3ff" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="' + RING_C.toFixed(2) + '"/>' +
      '</g>' +
    '</svg>';

  // ---- 模組狀態 ----
  var mounted = false, root = null, api = null, wrap = null;
  var el = {};            // 常用節點
  var zones = {};         // id -> {g, box, text, label}
  var rows = {};          // id -> {row, small, btn}
  var ids = [];
  var st = { active: false };
  var lastSig = null, figSig = null, passSig = null;
  var curKey = null, baseline = true, prevScan = {};
  var pending = {}, friskLock = {}, flash = {};
  var timers = [];
  var ptr = { on: false, id: null, x: 0, y: 0 };
  var charge = null, hot = null, raf = 0, detachedAt = 0;

  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function esc(s) {
    if (api && typeof api.esc === 'function') return api.esc(String(s));
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function play(name) { try { if (api && api.play) api.play(name); } catch (e) { /* 音效失敗不影響遊戲 */ } }
  function later(fn, ms) {
    var id = setTimeout(function () {
      var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
      if (mounted) fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // ---- 人形圖 ----
  function figureSVG(slots, looks) {
    looks = looks || {};
    var SK = '#f3c9a0', HR = '#3b2a20';
    var coat = { 白襯衫: '#e9edf2', 花襯衫: '#19a7a0', 黑色帽T: '#33343c', 西裝: '#27407a', 條紋衫: '#dfe6f2', 皮夾克: '#7a4722' }[looks.上衣] || '#5b6a86';
    var hatC = { 棒球帽: '#d23b3b', 漁夫帽: '#c9b27a', 毛帽: '#2f6fd0', 草帽: '#f1d57a' }[looks.帽子];
    var o = [];
    o.push('<defs><clipPath id="mmd-clip-body"><rect x="55" y="34" width="110" height="262" rx="55"/></clipPath></defs>');
    o.push('<ellipse cx="110" cy="356" rx="74" ry="9" fill="rgba(0,0,0,.45)"/>');
    // 腿與鞋
    o.push('<rect x="74" y="268" width="28" height="66" rx="10" fill="#3a4763"/><rect x="118" y="268" width="28" height="66" rx="10" fill="#3a4763"/>');
    o.push('<rect x="60" y="326" width="46" height="24" rx="12" fill="#1c2029" stroke="#566178" stroke-width="1.5"/><rect x="114" y="326" width="46" height="24" rx="12" fill="#1c2029" stroke="#566178" stroke-width="1.5"/>');
    // 手臂
    o.push('<rect x="36" y="136" width="22" height="84" rx="11" fill="' + coat + '"/><rect x="162" y="136" width="22" height="84" rx="11" fill="' + coat + '"/>');
    o.push('<circle cx="47" cy="222" r="10" fill="' + SK + '"/><circle cx="173" cy="222" r="10" fill="' + SK + '"/>');
    // 身體
    o.push('<g clip-path="url(#mmd-clip-body)">');
    o.push('<rect x="55" y="34" width="110" height="262" fill="' + SK + '"/>');
    o.push('<rect x="55" y="122" width="110" height="104" fill="' + coat + '"/>');
    if (looks.上衣 === '條紋衫') o.push([130, 146, 162, 178].map(function (y) { return '<rect x="55" y="' + y + '" width="110" height="7" fill="#2f6fd0"/>'; }).join(''));
    o.push('<path d="M96,122 L110,146 L124,122Z" fill="rgba(255,255,255,.55)"/>');
    o.push('<path d="M110,146 L110,200" stroke="rgba(0,0,0,.28)" stroke-width="2"/>');
    o.push('<rect x="55" y="222" width="110" height="74" fill="#3a4763"/>');
    o.push('<rect x="55" y="200" width="110" height="14" fill="#20242e"/><rect x="102" y="198" width="16" height="18" rx="3" fill="#c9a23f"/>');
    o.push('<path d="M66,236 q10,10 24,6 M154,236 q-10,10 -24,6" stroke="rgba(0,0,0,.4)" stroke-width="2" fill="none"/>');
    o.push('</g>');
    o.push('<rect x="55" y="34" width="110" height="262" rx="55" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.5"/>');
    // 臉
    o.push('<circle cx="92" cy="92" r="7" fill="#fff"/><circle cx="128" cy="92" r="7" fill="#fff"/><circle cx="93" cy="93" r="3" fill="#222"/><circle cx="129" cy="93" r="3" fill="#222"/>');
    o.push('<path d="M100,108 Q110,115 120,108" stroke="#7a2e2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>');
    // 帽子或頭髮
    if (hatC) {
      o.push('<path d="M53,72 Q53,26 110,26 Q167,26 167,72Z" fill="' + hatC + '"/><rect x="44" y="64" width="132" height="11" rx="5.5" fill="' + hatC + '" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/>');
    } else if (looks.髮型 !== '光頭') {
      o.push('<path d="M55,76 Q55,32 110,32 Q165,32 165,76 Q110,54 55,76Z" fill="' + HR + '"/>');
    }
    // 掃描部位
    o.push('<g class="mmd-zones">');
    slots.forEach(function (s) {
      var z = ZONE[s.id]; if (!z) return;
      var cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      o.push('<g class="mmd-zone" data-slot="' + esc(s.id) + '">' +
        '<rect class="mmd-zpulse" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="10"/>' +
        '<rect class="mmd-zbox" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="10"/>' +
        '<path class="mmd-zcheck" d="M' + (cx - 9) + ',' + cy + ' l6,7 l12,-13"/>' +
        '<text class="mmd-ztext" x="' + cx + '" y="' + (cy + 4) + '"></text>' +
        '</g>');
    });
    o.push('</g>');
    return '<svg viewBox="0 0 220 372" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="受檢旅客">' + o.join('') + '</svg>';
  }

  function buildFigure(slots, looks) {
    el.fig.innerHTML = figureSVG(slots, looks);
    zones = {}; rows = {}; ids = [];
    var html = '';
    slots.forEach(function (s) {
      if (!ZONE[s.id]) return;
      ids.push(s.id);
      html += '<div class="mmd-row" data-slot="' + esc(s.id) + '"><span class="mmd-dot"></span>' +
        '<span class="mmd-rl"><b>' + esc(s.label) + '</b><small></small></span>' +
        '<button type="button" class="mmd-btn" data-frisk="' + esc(s.id) + '">取出（−2）</button></div>';
    });
    el.list.innerHTML = html;
    var gs = el.fig.querySelectorAll('.mmd-zone'), rs = el.list.querySelectorAll('.mmd-row'), i;
    for (i = 0; i < gs.length; i++) {
      var id = gs[i].getAttribute('data-slot');
      zones[id] = { g: gs[i], box: gs[i].querySelector('.mmd-zbox'), text: gs[i].querySelector('.mmd-ztext') };
    }
    for (i = 0; i < rs.length; i++) {
      rows[rs[i].getAttribute('data-slot')] = { row: rs[i], small: rs[i].querySelector('small'), btn: rs[i].querySelector('button') };
    }
    slots.forEach(function (s) { if (zones[s.id]) zones[s.id].label = s.label; });
  }

  function buildPass(passport) {
    if (!passport) { el.pass.innerHTML = '<div class="mmd-pname"><small>受檢旅客</small><b>—</b></div>'; return; }
    var pic = '';
    try { if (passport.looks && api && typeof api.face === 'function') pic = api.face(passport.looks, 44, '#cfd8e6'); } catch (e) { pic = ''; }
    el.pass.innerHTML = pic + '<div class="mmd-pname"><small>受檢旅客</small><b>' + esc(passport.name || '') + '</b></div>';
  }

  // 把目前的狀態畫到既有節點上（不重建節點，便宜而且可重複呼叫）
  function paint() {
    if (!mounted) return;
    var active = !!st.active, sc = st.scanned || {}, tk = st.taken || {}, ap = Number(st.ap) || 0;
    wrap.classList.toggle('mmd-idle', !active);
    el.apNum.textContent = active ? String(ap) : '–';
    el.ap.classList.toggle('mmd-low', active && ap < 2);
    ids.forEach(function (id) {
      var s = sc[id], has = own(tk, id), item = has ? String(tk[id] == null ? '' : tk[id]) : '';
      var state = (s === 'beep' ? ' mmd-beep' : s === 'clear' ? ' mmd-clear' : '') + (has ? ' mmd-taken' : '') +
        (pending[id] ? ' mmd-pending' : '') + (flash[id] ? ' mmd-flash' : '') + (hot === id ? ' mmd-hot' : '');
      var z = zones[id], r = rows[id];
      if (z) {
        z.g.setAttribute('class', 'mmd-zone' + state);
        z.text.textContent = has ? (item || '空的') : s === 'beep' ? '嗶嗶！' : s === 'clear' ? '' : pending[id] ? '分析中…' : z.label;
      }
      if (r) {
        r.row.className = 'mmd-row' + state;
        var parts = [s === 'beep' ? '嗶嗶！有金屬反應' : s === 'clear' ? '沒有反應' : pending[id] ? '分析中…' : '尚未掃描'];
        if (has) parts.push('取出：' + (item || '空的'));
        r.small.textContent = parts.join('・');
        r.btn.disabled = !active || ap < 2 || has || !!friskLock[id];
        r.btn.textContent = has ? '已取出' : '取出（−2）';
      }
    });
  }

  function setHot(id) {
    if (hot === id) return;
    if (hot) { if (zones[hot]) zones[hot].g.classList.remove('mmd-hot'); if (rows[hot]) rows[hot].row.classList.remove('mmd-hot'); }
    hot = id;
    if (hot) { if (zones[hot]) zones[hot].g.classList.add('mmd-hot'); if (rows[hot]) rows[hot].row.classList.add('mmd-hot'); }
  }

  function resetLocal() {
    clearTimers();
    charge = null; pending = {}; friskLock = {}; flash = {}; prevScan = {};
    setHot(null);
    showRing(0, false);
  }

  function showRing(p, on) {
    if (!el.wand) return;
    el.wand.classList.toggle('mmd-chg', !!on);
    el.prog.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(1));
    el.glow.style.opacity = on ? (0.15 + 0.6 * p).toFixed(2) : '0';
  }

  // ---- 每一格：命中測試、充能、探測棒位置 ----
  function kick() { if (mounted && !raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    if (!mounted) return;
    if (!wrap.isConnected) {
      // 主頁重畫時我們會被暫時拆下：短時間內保留充能，拆太久才放棄
      if (!detachedAt) detachedAt = now;
      if (charge && now - detachedAt < DETACH_GRACE_MS) raf = requestAnimationFrame(frame);
      else if (charge) { charge = null; showRing(0, false); setHot(null); }
      return;
    }
    detachedAt = 0;
    var active = !!st.active && ptr.on, inPlay = false, hit = null, pr = null;
    if (active) {
      pr = el.play.getBoundingClientRect();
      inPlay = ptr.x >= pr.left && ptr.x <= pr.right && ptr.y >= pr.top && ptr.y <= pr.bottom;
      if (inPlay) {
        var top = document.elementFromPoint(ptr.x, ptr.y);
        if (!top || !el.play.contains(top)) inPlay = false;   // 被別的視窗蓋住就不算
      }
      if (inPlay) {
        for (var i = 0; i < ids.length; i++) {
          var b = zones[ids[i]].box.getBoundingClientRect();
          if (ptr.x >= b.left && ptr.x <= b.right && ptr.y >= b.top && ptr.y <= b.bottom) { hit = ids[i]; break; }
        }
      }
    }
    el.wand.classList.toggle('mmd-on', inPlay);
    if (inPlay) el.wand.style.transform = 'translate(' + (ptr.x - pr.left - el.play.clientLeft).toFixed(1) + 'px,' + (ptr.y - pr.top - el.play.clientTop).toFixed(1) + 'px)';

    var sc = st.scanned || {};
    var can = hit && !sc[hit] && !pending[hit] ? hit : null;
    if (charge && charge.slot !== can) charge = null;          // 離開部位：取消
    if (!charge && can) charge = { slot: can, start: now, ticks: 0 };
    setHot(can);
    if (charge) {
      var t = now - charge.start, p = Math.min(1, t / HOLD_MS);
      while (charge.ticks < Math.floor(HOLD_MS / TICK_MS) && t >= charge.ticks * TICK_MS) { charge.ticks++; play('tick'); }
      if (p >= 1) {
        var slot = charge.slot;
        charge = null;
        pending[slot] = true;
        setHot(null);
        showRing(0, false);
        paint();
        later(function () { if (pending[slot]) { delete pending[slot]; paint(); kick(); } }, PENDING_MS);
        try { api.send({ a: 'scan', slot: slot }); } catch (e) { /* 交給逾時重試 */ }
      } else showRing(p, true);
    } else showRing(0, false);

    if (ptr.on && (inPlay || charge)) raf = requestAnimationFrame(frame);
  }

  // ---- 指標事件（掛在 document，因為 root 隨時會被拆下再裝回）----
  function onMove(e) {
    if (e.pointerType === 'mouse') { if (ptr.id !== null) return; ptr.on = true; }
    else if (ptr.id !== e.pointerId) return;
    ptr.x = e.clientX; ptr.y = e.clientY; kick();
  }
  function onDown(e) {
    if (e.pointerType === 'mouse') { onMove(e); return; }
    if (ptr.id !== null) return;
    ptr.id = e.pointerId; ptr.on = true; ptr.x = e.clientX; ptr.y = e.clientY; kick();
  }
  function onUp(e) {
    if (e.pointerType === 'mouse' || ptr.id !== e.pointerId) return;
    ptr.id = null; ptr.on = false; kick();
  }
  function onLeave() { if (ptr.id === null) { ptr.on = false; kick(); } }
  function onBlur() { ptr.id = null; ptr.on = false; kick(); }
  function onMenu(e) { if (el.play && e.target && el.play.contains(e.target)) e.preventDefault(); }
  function onClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-frisk]') : null;
    if (!btn || btn.disabled) return;
    var id = btn.getAttribute('data-frisk');
    if (!st.active || (Number(st.ap) || 0) < 2 || own(st.taken, id) || friskLock[id]) return;
    friskLock[id] = true;
    paint();
    later(function () { delete friskLock[id]; paint(); }, FRISK_LOCK_MS);
    try { api.send({ a: 'frisk', slot: id }); } catch (err) { /* 鎖會自己解開 */ }
  }

  function mount(rootEl, apiObj) {
    if (mounted) unmount();
    root = rootEl; api = apiObj || {};
    if (!document.getElementById(STYLE_ID)) {
      var s = document.createElement('style');
      s.id = STYLE_ID; s.textContent = CSS;
      document.head.appendChild(s);
    }
    wrap = document.createElement('div');
    wrap.className = 'mmd-wrap mmd-idle';
    wrap.innerHTML =
      '<div class="mmd-head"><div class="mmd-title">金屬探測</div><div class="mmd-ap">行動點 <b>–</b></div></div>' +
      '<div class="mmd-hint">掃描免費但要花時間，取出要 2 點。</div>' +
      '<div class="mmd-grid">' +
        '<div class="mmd-play"><div class="mmd-fig"></div><div class="mmd-idlemsg">櫃台沒有旅客</div><div class="mmd-wand">' + WAND_SVG + '</div></div>' +
        '<div class="mmd-side"><div class="mmd-pass"></div><div class="mmd-list"></div>' +
        '<div class="mmd-tip">把探測棒停在部位上約 1 秒完成掃描，移開就要重來。</div></div>' +
      '</div>';
    el = {
      ap: wrap.querySelector('.mmd-ap'), apNum: wrap.querySelector('.mmd-ap b'),
      play: wrap.querySelector('.mmd-play'), fig: wrap.querySelector('.mmd-fig'),
      wand: wrap.querySelector('.mmd-wand'), prog: wrap.querySelector('.mmd-wprog'), glow: wrap.querySelector('.mmd-wglow'),
      pass: wrap.querySelector('.mmd-pass'), list: wrap.querySelector('.mmd-list')
    };
    root.appendChild(wrap);
    mounted = true;
    st = { active: false };
    lastSig = figSig = passSig = null; curKey = null; baseline = true;
    ptr = { on: false, id: null, x: 0, y: 0 };
    resetLocal();
    update(st);

    wrap.addEventListener('click', onClick);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    document.addEventListener('contextmenu', onMenu, true);
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onBlur);
  }

  function update(state) {
    if (!mounted) return;
    state = state || { active: false };
    var slots = state.slots && state.slots.length ? state.slots : (typeof SLOTS !== 'undefined' ? SLOTS : FALLBACK_SLOTS);
    var pass = state.passport || null;
    var sig = JSON.stringify([!!state.active, state.key, slots, state.scanned || {}, state.taken || {}, state.ap, pass]);
    if (sig === lastSig) return;     // 資料沒變：什麼都不做
    lastSig = sig;
    st = state;

    var key = state.active ? String(state.key) : null;
    if (key !== curKey) { curKey = key; resetLocal(); baseline = true; }

    var fs = JSON.stringify([slots, pass && pass.looks]);
    if (fs !== figSig) { figSig = fs; hot = null; buildFigure(slots, pass && pass.looks); }
    var ps = JSON.stringify(pass);
    if (ps !== passSig) { passSig = ps; buildPass(pass); }

    var sc = state.scanned || {};
    ids.forEach(function (id) {
      var v = sc[id];
      if (v) delete pending[id];
      if (v === prevScan[id]) return;
      if (!baseline && (v === 'beep' || v === 'clear')) {
        flash[id] = true;
        later(function () { delete flash[id]; paint(); }, FLASH_MS);
        play(v === 'beep' ? 'beep' : 'pop');
      }
    });
    prevScan = {};
    ids.forEach(function (id) { if (sc[id]) prevScan[id] = sc[id]; });
    ids.forEach(function (id) { if (own(state.taken, id)) delete friskLock[id]; });
    baseline = false;
    paint();
    if (!state.active) kick();       // 讓探測棒收起來
  }

  function unmount() {
    if (!mounted) return;
    mounted = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearTimers();
    wrap.removeEventListener('click', onClick);
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
    document.removeEventListener('contextmenu', onMenu, true);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onBlur);
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    var s = document.getElementById(STYLE_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    wrap = null; root = null; api = null; el = {}; zones = {}; rows = {}; ids = [];
    charge = null; hot = null; pending = {}; friskLock = {}; flash = {}; prevScan = {};
    st = { active: false }; lastSig = figSig = passSig = null; curKey = null;
  }

  window.Mini = window.Mini || {};
  window.Mini.metal = { mount: mount, update: update, unmount: unmount };
})();
