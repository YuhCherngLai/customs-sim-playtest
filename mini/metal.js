// 海關檢查工具箱小遊戲模組（原「金屬探測」）：window.Mini.metal = { mount, update, unmount }
// 準備階段選要帶哪幾招，通關階段在倒數內決定用哪招查哪裡。結果一律由主機決定。
(function () {
  'use strict';

  var TICK_MS = 300;       // 充能時每隔多久響一次 tick
  var PENDING_MS = 4000;   // 送出後多久沒回應就允許重試
  var FRISK_LOCK_MS = 1500;// 按下取出後暫時鎖住按鈕，避免連點
  var FLASH_MS = 1800;     // 新結果的強調動畫長度
  var BLUR_MS = 4000;      // 用完透視眼之後眼睛花掉多久
  var DETACH_GRACE_MS = 400;
  var TOUCH_LIFT = 52;     // 觸控時探測棒浮在手指上方幾 px，才不會被手指遮住
  var MIC_TH = 0.10;       // 麥克風音量門檻（RMS）
  var CALL_FALLBACK_MS = 2000; // 沒有麥克風時，按住多久代替
  var STYLE_ID = 'mmd-style';
  var RING_C = 2 * Math.PI * 27;

  // mode：dwell＝停在部位上、tap＝點部位、hold＝按住按鈕查全身、call＝按住並對麥克風叫
  var TOOLS = {
    wand: { name: '金屬探測棒', mode: 'dwell', ms: 1200, cost: '快', desc: '停在一個部位上：有沒有金屬。不知道是什麼。' },
    dog:  { name: '緝毒犬', mode: 'hold', ms: 2500, cost: '中', desc: '查全身：狗會走向有機物。身上有動物時牠會暴衝。' },
    wave: { name: '毫米波掃描', mode: 'hold', ms: 3000, cost: '慢', desc: '查全身：每個部位藏的東西的輪廓。只有形狀。' },
    swab: { name: '微量擦拭', mode: 'dwell', ms: 3000, cost: '很慢', desc: '擦一個部位送驗：有沒有爆裂物，百分之百準。' },
    xeye: { name: '透視眼', mode: 'tap', ap: 1, cost: '−1 點', desc: '點一個部位直接看穿。之後眼睛會花掉幾秒。' },
    call: { name: '學動物叫', mode: 'call', ms: 800, cost: '快＋丟臉', desc: '對麥克風學叫，藏著的同類會回叫。旅客可以咳嗽蓋掉。' }
  };
  var TOOL_ORDER = ['wand', 'dog', 'wave', 'swab', 'xeye', 'call'];
  var DEFAULT_KINDS = [{ k: '貓', say: '喵～' }, { k: '鳥', say: '啾啾' }, { k: '蛇', say: '嘶嘶' }];

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
    '.mmd-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '.mmd-title{font-weight:700;font-size:1.05em;white-space:nowrap}',
    '.mmd-timer{position:relative;flex:1;min-width:0;height:22px;border:1px solid var(--line,#2c3649);border-radius:999px;background:var(--bg,#10141c);overflow:hidden}',
    '.mmd-timer i{position:absolute;left:0;top:0;bottom:0;width:100%;background:var(--acc,#5fb3ff);opacity:.45;transition:width .3s linear}',
    '.mmd-timer span{position:relative;display:block;text-align:center;font-size:.8em;line-height:20px;font-variant-numeric:tabular-nums}',
    '.mmd-timer.mmd-low i{background:var(--bad,#ff6b6b);opacity:.7}',
    '.mmd-timer.mmd-off{visibility:hidden}',
    '.mmd-ap{display:inline-flex;align-items:baseline;gap:6px;padding:3px 12px;border:1px solid var(--line,#2c3649);border-radius:999px;background:var(--card,#1a2130);font-size:.85em;color:var(--dim,#93a0b5);white-space:nowrap}',
    '.mmd-ap b{color:var(--warn,#ffc857);font-size:1.35em;font-variant-numeric:tabular-nums}',
    '.mmd-ap.mmd-low b{color:var(--bad,#ff6b6b)}',
    '.mmd-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}',
    '.mmd-tab{font:inherit;font-size:.88em;padding:7px 12px;border-radius:999px;border:1px solid var(--line,#2c3649);background:var(--card,#1a2130);color:var(--fg,#e8ecf3);cursor:pointer}',
    '.mmd-tab.mmd-cur{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.16);color:var(--warn,#ffc857);font-weight:700}',
    '.mmd-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:10px;align-items:start;transition:filter .25s}',
    '.mmd-blur .mmd-grid{filter:blur(5px) saturate(.4)}',
    '.mmd-play{position:relative;overflow:hidden;display:flex;justify-content:center;padding:6px;border:1px solid var(--line,#2c3649);border-radius:12px;background:radial-gradient(ellipse at 50% 100%,rgba(95,179,255,.14),transparent 62%),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 22px),var(--bg,#10141c)}',
    '.mmd-play.mmd-ptr{touch-action:none;cursor:none}',
    '.mmd-fig{width:100%;max-width:270px}',
    '.mmd-fig svg{display:block;width:100%;height:auto;overflow:visible}',
    '.mmd-sweep{display:none;position:absolute;left:0;right:0;top:0;height:14px;margin-top:-7px;background:linear-gradient(180deg,transparent,rgba(95,179,255,.85),transparent);box-shadow:0 0 18px rgba(95,179,255,.8);pointer-events:none;z-index:2}',
    '.mmd-idlemsg{display:none;position:absolute;inset:0;place-items:center;text-align:center;font-weight:700;font-size:1.1em;color:var(--dim,#93a0b5);letter-spacing:.08em;z-index:4}',
    '.mmd-idle .mmd-idlemsg{display:grid}',
    '.mmd-over .mmd-timer span{color:var(--bad,#ff6b6b);font-weight:700}',
    '.mmd-idle .mmd-fig{opacity:.22;filter:grayscale(1)}',
    '.mmd-idle .mmd-zones{display:none}',
    '.mmd-idle .mmd-side,.mmd-idle .mmd-tabs{opacity:.45}',
    '.mmd-side{display:flex;flex-direction:column;gap:8px;min-width:0}',
    '.mmd-pass{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--line,#2c3649);border-radius:10px;background:var(--card,#1a2130);min-height:60px}',
    '.mmd-pass svg{flex:none;border-radius:6px;display:block}',
    '.mmd-pass small{display:block;color:var(--dim,#93a0b5);font-size:.75em}',
    '.mmd-pass b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mmd-pname{min-width:0}',
    '.mmd-panel{padding:8px 10px;border:1px solid var(--warn,#ffc857);border-radius:10px;background:rgba(255,200,87,.06);font-size:.86em;display:flex;flex-direction:column;gap:6px}',
    '.mmd-panel p{margin:0;color:var(--dim,#93a0b5)}',
    '.mmd-panel p.mmd-res{color:var(--fg,#e8ecf3);font-weight:700}',
    '.mmd-panel p.mmd-res.mmd-pos{color:var(--bad,#ff6b6b)}',
    '.mmd-holds{display:flex;flex-wrap:wrap;gap:6px}',
    '.mmd-hold{position:relative;overflow:hidden;flex:1;min-width:84px;font:inherit;font-weight:700;padding:11px 8px;border-radius:10px;border:1px solid var(--acc,#5fb3ff);background:rgba(95,179,255,.12);color:var(--fg,#e8ecf3);cursor:pointer;touch-action:none}',
    '.mmd-hold:disabled{border-color:var(--line,#2c3649);background:transparent;color:var(--dim,#93a0b5);cursor:not-allowed}',
    '.mmd-hold i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(95,179,255,.5);pointer-events:none}',
    '.mmd-hold span{position:relative;pointer-events:none}',
    '.mmd-hold small{position:relative;display:block;font-weight:400;font-size:.82em;color:var(--dim,#93a0b5);pointer-events:none}',
    '.mmd-hold.mmd-pos{border-color:var(--bad,#ff6b6b)}.mmd-hold.mmd-pos small{color:var(--bad,#ff6b6b)}',
    '.mmd-mic{height:5px;border-radius:3px;background:var(--line,#2c3649);overflow:hidden}',
    '.mmd-mic i{display:block;height:100%;width:0;background:var(--good,#55d38a)}',
    '.mmd-list{display:grid;grid-template-columns:1fr;gap:6px}',
    '.mmd-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;align-items:center;column-gap:8px;padding:6px 8px;border:1px solid var(--line,#2c3649);border-radius:10px;background:var(--card,#1a2130);transition:border-color .12s,background .12s}',
    '.mmd-dot{width:10px;height:10px;border-radius:50%;background:var(--line,#2c3649)}',
    '.mmd-rl{min-width:0}',
    '.mmd-rl b{display:block;font-size:.92em}',
    '.mmd-rl small{display:block;color:var(--dim,#93a0b5);font-size:.76em}',
    '.mmd-row.mmd-hot{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.08)}',
    '.mmd-row.mmd-alert{border-color:var(--bad,#ff6b6b)}',
    '.mmd-row.mmd-alert .mmd-dot{background:var(--bad,#ff6b6b);box-shadow:0 0 8px var(--bad,#ff6b6b)}',
    '.mmd-row.mmd-alert small{color:var(--bad,#ff6b6b)}',
    '.mmd-row.mmd-some .mmd-dot{background:var(--good,#55d38a)}',
    '.mmd-row.mmd-taken small{color:var(--fg,#e8ecf3)}',
    '.mmd-row.mmd-pending .mmd-dot{background:var(--acc,#5fb3ff);animation:mmd-blink .5s linear infinite}',
    '.mmd-btn{font:inherit;font-size:.8em;padding:5px 8px;border-radius:8px;border:1px solid var(--warn,#ffc857);background:rgba(255,200,87,.12);color:var(--warn,#ffc857);cursor:pointer;white-space:nowrap}',
    '.mmd-btn:hover:not(:disabled){background:rgba(255,200,87,.26)}',
    '.mmd-btn:disabled{border-color:var(--line,#2c3649);background:transparent;color:var(--dim,#93a0b5);opacity:.6;cursor:not-allowed}',
    '.mmd-tip{color:var(--dim,#93a0b5);font-size:.76em}',
    // 人形圖上的部位
    '.mmd-zbox{fill:rgba(95,179,255,.10);stroke:var(--acc,#5fb3ff);stroke-width:1.5;stroke-dasharray:5 4}',
    '.mmd-zpulse{fill:none;stroke:var(--bad,#ff6b6b);stroke-width:3;opacity:0;transform-box:fill-box;transform-origin:center;pointer-events:none}',
    '.mmd-zsil{pointer-events:none}',
    '.mmd-zsil rect{fill:rgba(255,255,255,.8);stroke:#0b0e14;stroke-width:1}',
    '.mmd-ztext,.mmd-zmark,.mmd-znote{text-anchor:middle;paint-order:stroke;stroke:#0b0e14;stroke-width:3px;stroke-linejoin:round;pointer-events:none}',
    '.mmd-ztext{font-size:11px;font-weight:700;fill:var(--fg,#e8ecf3)}',
    '.mmd-zmark{font-size:9px;font-weight:700;fill:var(--dim,#93a0b5)}',
    '.mmd-zmark .mmd-p{fill:#ff8f8f}',
    '.mmd-znote{font-size:15px;fill:var(--acc,#5fb3ff);display:none}',
    '.mmd-zdog{display:none;pointer-events:none}',
    '.mmd-dogat .mmd-zdog{display:block}',
    '.mmd-heard .mmd-znote{display:block}',
    '.mmd-hot .mmd-zbox{fill:rgba(255,200,87,.22);stroke:var(--warn,#ffc857);stroke-dasharray:none;stroke-width:2.5}',
    '.mmd-pending .mmd-zbox{stroke:var(--acc,#5fb3ff);stroke-width:2.5;animation:mmd-march .4s linear infinite}',
    '.mmd-alert .mmd-zbox{fill:rgba(255,107,107,.38);stroke:var(--bad,#ff6b6b);stroke-dasharray:none;stroke-width:2.5;animation:mmd-redglow 1.1s ease-in-out infinite}',
    '.mmd-alert .mmd-zpulse{animation:mmd-pulse 1.1s ease-out infinite}',
    '.mmd-alert.mmd-flash .mmd-zbox{animation-duration:.3s}',
    '.mmd-alert.mmd-flash .mmd-zpulse{animation-duration:.42s;stroke-width:5}',
    '.mmd-flash .mmd-zmark{animation:mmd-shake .12s linear infinite}',
    '.mmd-named .mmd-ztext{fill:var(--warn,#ffc857);font-size:12px}',
    '.mmd-taken .mmd-zbox{stroke-dasharray:2 3}',
    // 探測棒
    '.mmd-wand{position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;display:none;z-index:3}',
    '.mmd-wand.mmd-on{display:block}',
    '.mmd-wand svg{position:absolute;left:-40px;top:-40px;width:140px;height:140px;overflow:visible;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55))}',
    '.mmd-wand.mmd-nohandle .mmd-whandle{display:none}',
    '.mmd-wring{display:none}',
    '.mmd-wand.mmd-chg .mmd-wring{display:block}',
    '.mmd-wand.mmd-chg svg{animation:mmd-hum .08s linear infinite;filter:drop-shadow(0 0 8px rgba(255,200,87,.85))}',
    '.mmd-wglow{fill:var(--warn,#ffc857);opacity:0}',
    '.mmd-wled{fill:#3a4458}',
    '.mmd-wand.mmd-chg .mmd-wled{fill:var(--bad,#ff6b6b);animation:mmd-blink .3s linear infinite}',
    // 準備階段：選招
    '.mmd-prep{display:none}',
    '.mmd-isprep .mmd-prep{display:block}',
    '.mmd-isprep .mmd-grid,.mmd-isprep .mmd-tabs,.mmd-isprep .mmd-timer,.mmd-isprep .mmd-ap{display:none}',
    '.mmd-ptitle{margin-bottom:8px;color:var(--dim,#93a0b5);font-size:.9em}',
    '.mmd-ptitle b{color:var(--warn,#ffc857);font-size:1.2em}',
    '.mmd-pgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:8px}',
    '.mmd-card{display:flex;flex-direction:column;border:1px solid var(--line,#2c3649);border-radius:12px;background:var(--card,#1a2130);overflow:hidden}',
    '.mmd-card.mmd-picked{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.10)}',
    '.mmd-cardmain{flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;font:inherit;text-align:left;padding:10px;border:0;background:transparent;color:inherit;cursor:pointer}',
    '.mmd-cardmain:disabled{cursor:not-allowed}',
    '.mmd-cardmain b{display:block}',
    '.mmd-cardmain em{display:inline-block;margin:4px 0;padding:1px 8px;border-radius:999px;border:1px solid var(--line,#2c3649);font-style:normal;font-size:.74em;color:var(--dim,#93a0b5)}',
    '.mmd-cardmain small{display:block;color:var(--dim,#93a0b5);font-size:.8em;line-height:1.35}',
    '.mmd-card.mmd-picked .mmd-cardmain b::after{content:"　✓ 已帶";color:var(--warn,#ffc857);font-size:.8em}',
    '.mmd-sec{font:inherit;font-size:.8em;padding:6px;border:0;border-top:1px solid var(--line,#2c3649);background:transparent;color:var(--dim,#93a0b5);cursor:pointer}',
    '.mmd-sec.mmd-ison{background:#3b2a55;color:#e0c8ff;font-weight:700}',
    '@keyframes mmd-hum{0%{transform:translate(.7px,-.5px)}50%{transform:translate(-.7px,.6px)}100%{transform:translate(.5px,.5px)}}',
    '@keyframes mmd-blink{0%,49%{opacity:1}50%,100%{opacity:.25}}',
    '@keyframes mmd-march{to{stroke-dashoffset:-9}}',
    '@keyframes mmd-redglow{0%,100%{fill:rgba(255,107,107,.25)}50%{fill:rgba(255,107,107,.55)}}',
    '@keyframes mmd-pulse{0%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}',
    '@keyframes mmd-shake{0%{transform:translate(1px,0)}50%{transform:translate(-1px,0)}100%{transform:translate(1px,0)}}',
    '@container mmd (max-width:560px){.mmd-pgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@container mmd (max-width:480px){.mmd-grid{grid-template-columns:1fr}.mmd-fig{max-width:210px}.mmd-list{grid-template-columns:1fr 1fr}.mmd-tab{padding:7px 10px}}',
    '@container mmd (max-width:400px){.mmd-list{grid-template-columns:1fr}}'
  ].join('\n');

  var WAND_SVG =
    '<svg viewBox="-40 -40 140 140" aria-hidden="true">' +
      '<circle class="mmd-wglow" r="19"/>' +
      '<g class="mmd-whandle" transform="rotate(45)">' +
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
  var zones = {};         // id -> {g, box, text, mark, sil, label, sig}
  var rows = {};          // id -> {row, small, btn}
  var ids = [];
  var st = { active: false };
  var lastSig = null, figSig = null, passSig = null, tabSig = null, panelSig = null, prepSig = null;
  var curKey = null, baseline = true, prevRes = {};
  var pending = {}, pendingV = {}, friskLock = {}, flash = {};
  var timers = [];
  var ptr = { on: false, id: null, x: 0, y: 0, touch: false };
  var charge = null, hot = null, raf = 0, detachedAt = 0;
  var curTool = 'wand', hold = null, panelDirty = false;
  var mic = { state: '', stream: null, ctx: null, an: null, buf: null };

  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function esc(s) {
    if (api && typeof api.esc === 'function') return api.esc(String(s));
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function play(name) { try { if (api && api.play) api.play(name); } catch (e) { /* 音效失敗不影響遊戲 */ } }
  // 充能時的嗶聲越來越高（主頁有合成器就用，沒有就退回 tick）
  function chirp(p) { try { if (api && api.sfx) api.sfx.tone(320 + p * 900, 45, 'square', 0.05); else play('tick'); } catch (e) { /* 同上 */ } }
  function alarm() {
    try {
      if (!api || !api.sfx) return;
      api.sfx.tone(1500, 150, 'square', 0.12);
      setTimeout(function () { api.sfx.tone(1500, 150, 'square', 0.12); }, 200);
      api.sfx.buzz([90, 50, 90, 50, 180]);
    } catch (e) { /* 同上 */ }
  }
  function send(msg) { try { api.send(msg); } catch (e) { /* 交給逾時重試 */ } }
  function later(fn, ms) {
    var id = setTimeout(function () {
      var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
      if (mounted) fn();
    }, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function shapeCells(sh) {
    if (typeof cells === 'function') return cells(sh, 0);
    var c = [];
    sh.forEach(function (row, y) { for (var x = 0; x < row.length; x++) if (row[x] === 'X') c.push([x, y]); });
    return c;
  }
  function tools() {
    var t = (st.tools || []).filter(function (id) { return own(TOOLS, id); });
    return t.length ? t : ['wand'];
  }
  function kinds() { return st.kinds && st.kinds.length ? st.kinds : DEFAULT_KINDS; }
  function isOver() { return st.t != null && Number(st.t) <= 0; }
  function canAct() { return !!st.active && !st.prep && !isOver(); }
  function setPending(key) {
    pending[key] = true;
    pendingV[key] = prevRes[key] ? prevRes[key].v : null;
    later(function () { if (pending[key]) { delete pending[key]; paint(); kick(); } }, PENDING_MS);
  }
  // 把主機給的各種結果攤平成 key -> {v, pos, slot}，用來偵測「新結果」
  function collect(s) {
    var r = {}, sc = s.scanned || {}, sw = s.swab || {}, seen = s.seen || {}, heard = s.heard || {};
    ids.forEach(function (id) {
      if (sc[id]) r['wand:' + id] = { v: sc[id], pos: sc[id] === 'beep', slot: id };
      if (sw[id]) r['swab:' + id] = { v: sw[id], pos: sw[id] === 'boom', slot: id };
      if (own(seen, id)) r['xeye:' + id] = { v: 's' + seen[id], pos: !!seen[id], slot: id };
    });
    if (s.wave) r.wave = { v: '1', pos: false, slot: null };
    if (s.dog) r.dog = { v: JSON.stringify(s.dog), pos: !!(s.dog.slot || s.dog.wild), slot: s.dog.slot || null };
    Object.keys(heard).forEach(function (k) {
      var h = heard[k]; if (!h) return;
      r['call:' + k] = { v: JSON.stringify(h), pos: !!h.slot, slot: h.slot || null };
    });
    return r;
  }

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
    // 檢查部位
    o.push('<g class="mmd-zones">');
    slots.forEach(function (s) {
      var z = ZONE[s.id]; if (!z) return;
      var cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      o.push('<g class="mmd-zone" data-slot="' + esc(s.id) + '">' +
        '<rect class="mmd-zpulse" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="10"/>' +
        '<rect class="mmd-zbox" x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" rx="10"/>' +
        '<g class="mmd-zsil"></g>' +
        '<text class="mmd-ztext" x="' + cx + '" y="' + (cy + 1) + '"></text>' +
        '<text class="mmd-zmark" x="' + cx + '" y="' + (cy + 12) + '"></text>' +
        '<text class="mmd-znote" x="' + (z.x + 3) + '" y="' + (z.y + 8) + '">♪</text>' +
        // 緝毒犬的頭：原創的簡單造型
        '<g class="mmd-zdog" transform="translate(' + (z.x - 4) + ',' + cy + ')">' +
          '<path d="M-9,-6 L-12,-15 L-3,-9Z M9,-6 L12,-15 L3,-9Z" fill="#6b4423"/>' +
          '<ellipse rx="10" ry="9" fill="#b98250" stroke="#0b0e14" stroke-width="1.2"/>' +
          '<ellipse cy="4" rx="5" ry="4" fill="#f1dcc0"/><circle cy="2.5" r="1.8" fill="#222"/>' +
          '<circle cx="-4" cy="-2.5" r="1.4" fill="#222"/><circle cx="4" cy="-2.5" r="1.4" fill="#222"/>' +
        '</g>' +
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
      zones[id] = { g: gs[i], box: gs[i].querySelector('.mmd-zbox'), text: gs[i].querySelector('.mmd-ztext'), mark: gs[i].querySelector('.mmd-zmark'), sil: gs[i].querySelector('.mmd-zsil'), sig: null };
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

  function silSVG(id, sh) {
    var z = ZONE[id], c = shapeCells(sh), S = 11, w = 0, h = 0;
    c.forEach(function (p) { w = Math.max(w, p[0] + 1); h = Math.max(h, p[1] + 1); });
    var x0 = z.x + z.w / 2 - w * S / 2, y0 = z.y + z.h / 2 - h * S / 2;
    return c.map(function (p) { return '<rect x="' + (x0 + p[0] * S) + '" y="' + (y0 + p[1] * S) + '" width="' + S + '" height="' + S + '" rx="1.5"/>'; }).join('');
  }

  // ---- 準備階段：選要帶哪幾招 ----
  function paintPrep() {
    var p = st.prep, sig = JSON.stringify(p || null);
    if (sig === prepSig) return;
    prepSig = sig;
    if (!p) { el.prep.innerHTML = ''; return; }
    var all = (p.all && p.all.length ? p.all : TOOL_ORDER).filter(function (id) { return own(TOOLS, id); });
    var picked = p.picked || [], max = Number(p.max) || 3, ro = p.editable === false;
    var html = '<div class="mmd-ptitle">準備階段：選 ' + max + ' 招帶上場　<b>' + picked.length + '/' + max + '</b></div><div class="mmd-pgrid">';
    all.forEach(function (id) {
      var T = TOOLS[id], on = picked.indexOf(id) >= 0, sec = p.secret === id;
      html += '<div class="mmd-card' + (on ? ' mmd-picked' : '') + '">' +
        '<button type="button" class="mmd-cardmain" data-pick="' + id + '"' + (ro ? ' disabled' : '') + '><b>' + T.name + '</b><em>' + T.cost + '</em><small>' + T.desc + '</small></button>' +
        (on ? '<button type="button" class="mmd-sec' + (sec ? ' mmd-ison' : '') + '" data-secret="' + id + '"' + (ro ? ' disabled' : '') + '>' + (sec ? '🤫 這招藏起來了' : '藏這招（旅客看不到）') + '</button>' : '') +
        '</div>';
    });
    html += '</div><div class="mmd-tip">旅客裝行李前看得到你帶的招式，只有藏起來的那一招看不到。</div>';
    el.prep.innerHTML = html;
  }

  // ---- 工具列與工具說明 ----
  function paintTabs() {
    var ts = tools();
    if (ts.indexOf(curTool) < 0) { curTool = ts[0]; charge = null; }
    var sig = ts.join(',') + '|' + curTool;
    if (sig === tabSig) return;
    tabSig = sig;
    el.tabs.innerHTML = ts.map(function (id) {
      return '<button type="button" class="mmd-tab' + (id === curTool ? ' mmd-cur' : '') + '" data-tool="' + id + '">' + TOOLS[id].name + '</button>';
    }).join('');
    el.tabs.style.display = ts.length > 1 ? '' : 'none';
  }

  function slotLabel(id) { return zones[id] ? zones[id].label : id; }

  function paintPanel() {
    if (hold) { panelDirty = true; return; }   // 按住中不重建按鈕
    panelDirty = false;
    var T = TOOLS[curTool], ok = canAct(), ap = Number(st.ap) || 0;
    var sig = JSON.stringify([curTool, ok, ap, st.wave ? 1 : 0, st.dog || 0, st.heard || 0, pending, mic.state, kinds()]);
    if (sig === panelSig) return;
    panelSig = sig;
    var h = '<p>' + T.desc + '</p>';
    if (T.mode === 'dwell') h += '<p>把探測棒停在部位上 ' + (T.ms / 1000) + ' 秒，移開就要重來。</p>';
    else if (T.mode === 'tap') h += '<p>' + (ap < T.ap ? '行動點不夠。' : '點一下要看的部位（−' + T.ap + ' 點）。') + '</p>';
    else if (T.mode === 'hold') {
      var done = curTool === 'wave' ? !!st.wave : !!st.dog;
      if (done && curTool === 'wave') h += '<p class="mmd-res">掃完了：白色方塊是輪廓，沒有方塊的部位是空的。</p>';
      else if (done) {
        var d = st.dog;
        h += d.wild ? '<p class="mmd-res mmd-pos">狗突然暴衝亂吠！身上有活的東西。</p>'
          : d.slot ? '<p class="mmd-res mmd-pos">狗一直聞「' + esc(slotLabel(d.slot)) + '」。</p>'
          : '<p class="mmd-res">狗聞了一圈，沒興趣。</p>';
      } else {
        h += '<div class="mmd-holds"><button type="button" class="mmd-hold" data-hold="' + curTool + '"' + (ok && !pending[curTool] ? '' : ' disabled') + '><i></i><span>' +
          (pending[curTool] ? '分析中…' : '按住 ' + (T.ms / 1000) + ' 秒') + '</span></button></div>';
      }
    } else if (T.mode === 'call') {
      var heard = st.heard || {};
      h += '<div class="mmd-holds">';
      kinds().forEach(function (kd) {
        var r = heard[kd.k], key = 'call:' + kd.k, fin = r && !r.cough;
        var note = pending[key] ? '聽聽看…' : !r ? '按住並學叫' : r.cough ? '被咳嗽聲蓋過了，再叫一次' : r.slot ? '「' + slotLabel(r.slot) + '」回叫了！' : '沒有回應';
        h += '<button type="button" class="mmd-hold' + (r && r.slot ? ' mmd-pos' : '') + '" data-hold="call" data-kind="' + esc(kd.k) + '"' + (ok && !fin && !pending[key] ? '' : ' disabled') + '><i></i><span>' + esc(kd.say) + '</span><small>' + esc(note) + '</small></button>';
      });
      h += '</div><div class="mmd-mic"><i></i></div><p>' +
        (mic.state === 'on' ? '麥克風已開：按住按鈕，對著它叫大聲一點。聲音不會被傳出去，只量音量。'
          : mic.state === 'none' ? '沒有麥克風可用：按住 ' + (CALL_FALLBACK_MS / 1000) + ' 秒代替。'
          : '第一次按會詢問麥克風權限，允許之後再按住學叫。') + '</p>';
    }
    el.panel.innerHTML = h;
    el.micBar = el.panel.querySelector('.mmd-mic i');
  }

  // 把目前的狀態畫到既有節點上（不重建節點，便宜而且可重複呼叫）
  function paint() {
    if (!mounted) return;
    var prep = !!st.prep, active = !!st.active, over = isOver(), ok = canAct(), ap = Number(st.ap) || 0;
    var sc = st.scanned || {}, sw = st.swab || {}, seen = st.seen || {}, tk = st.taken || {}, heard = st.heard || {};
    wrap.classList.toggle('mmd-isprep', prep);
    wrap.classList.toggle('mmd-idle', !prep && !active);
    wrap.classList.toggle('mmd-over', !prep && active && over);
    el.idle.textContent = '櫃台沒有旅客';
    el.title.textContent = prep ? '海關工具箱' : '海關檢查';
    paintPrep();
    if (prep) return;
    el.apNum.textContent = active ? String(ap) : '–';
    el.ap.classList.toggle('mmd-low', active && ap < 2);
    paintTimer();
    paintTabs();
    paintPanel();
    var mode = TOOLS[curTool].mode;
    el.play.classList.toggle('mmd-ptr', ok && (mode === 'dwell' || mode === 'tap'));
    el.wand.classList.toggle('mmd-nohandle', mode === 'tap');
    ids.forEach(function (id) {
      var z = zones[id], r = rows[id];
      var hasT = own(tk, id), hasS = own(seen, id);
      var name = hasT ? String(tk[id] || '') : hasS ? String(seen[id] || '') : null;
      var marks = [], parts = [], alert = false, calls = [];
      if (sc[id] === 'beep') { marks.push(['金屬！', 1]); parts.push('有金屬反應'); alert = true; }
      else if (sc[id] === 'clear') { marks.push(['無金', 0]); parts.push('沒有金屬'); }
      if (sw[id] === 'boom') { marks.push(['爆裂物！', 1]); parts.push('驗出爆裂物'); alert = true; }
      else if (sw[id] === 'clean') { marks.push(['無爆', 0]); parts.push('沒有爆裂物'); }
      var wv = st.wave ? st.wave[id] : undefined;
      if (st.wave) parts.push(wv && wv.length ? '輪廓 ' + shapeCells(wv).length + ' 格' : '沒有輪廓');
      var dogAt = !!(st.dog && st.dog.slot === id);
      if (dogAt) { parts.push('狗在聞'); alert = true; }
      Object.keys(heard).forEach(function (k) { if (heard[k] && heard[k].slot === id) calls.push(k); });
      if (calls.length) { parts.push(calls.join('、') + '回叫'); alert = true; }
      if (hasS && !hasT) parts.push('看穿：' + (name || '空的'));
      if (hasT) parts.push('取出：' + (name || '空的'));
      var pend = !!(pending['wand:' + id] || pending['swab:' + id] || pending['xeye:' + id]);
      if (pend) marks.push(['分析中…', 0]);
      if (!parts.length) parts.push(pend ? '分析中…' : '還沒查');
      var cls = (alert ? ' mmd-alert' : parts.length && parts[0] !== '還沒查' ? ' mmd-some' : '') + (hasT ? ' mmd-taken' : '') + (name !== null ? ' mmd-named' : '') +
        (dogAt ? ' mmd-dogat' : '') + (calls.length ? ' mmd-heard' : '') + (pend ? ' mmd-pending' : '') + (flash[id] ? ' mmd-flash' : '') + (hot === id ? ' mmd-hot' : '');
      var label = name !== null ? (name || '空的') : wv && wv.length ? '' : z.label;   // 有輪廓時把位置讓給輪廓
      var sig = cls + '|' + label + '|' + JSON.stringify(marks) + '|' + JSON.stringify(wv || 0);
      if (z.sig !== sig) {
        z.sig = sig;
        z.g.setAttribute('class', 'mmd-zone' + cls);
        z.text.textContent = label;
        z.mark.innerHTML = marks.map(function (m) { return '<tspan' + (m[1] ? ' class="mmd-p"' : '') + '>' + m[0] + '</tspan>'; }).join(' ');
        z.sil.innerHTML = wv && wv.length ? silSVG(id, wv) : '';
      }
      if (r) {
        r.row.className = 'mmd-row' + cls;
        r.small.textContent = parts.join('・');
        r.btn.disabled = !ok || ap < 2 || hasT || !!friskLock[id];
        r.btn.textContent = hasT ? '已取出' : '取出（−2）';
      }
    });
  }

  function paintTimer() {
    var has = st.t != null && !!st.active, t = Math.max(0, Number(st.t) || 0), max = Number(st.tMax) || t || 1;
    el.timer.classList.toggle('mmd-off', !has);
    if (!has) return;
    el.timerBar.style.width = (100 * Math.min(1, t / max)).toFixed(1) + '%';
    el.timerTxt.textContent = t > 0 ? '剩 ' + Math.ceil(t) + ' 秒' : '時間到！';
    el.timer.classList.toggle('mmd-low', t <= 5);
  }

  function setHot(id) {
    if (hot === id) return;
    if (hot) { if (zones[hot]) { zones[hot].g.classList.remove('mmd-hot'); zones[hot].sig = null; } if (rows[hot]) rows[hot].row.classList.remove('mmd-hot'); }
    hot = id;
    if (hot) { if (zones[hot]) { zones[hot].g.classList.add('mmd-hot'); zones[hot].sig = null; } if (rows[hot]) rows[hot].row.classList.add('mmd-hot'); }
  }

  function resetLocal() {
    clearTimers();
    charge = null; pending = {}; pendingV = {}; friskLock = {}; flash = {}; prevRes = {};
    endHold();
    setHot(null);
    showRing(0, false);
    if (wrap) wrap.classList.remove('mmd-blur');
  }

  function showRing(p, on) {
    if (!el.wand) return;
    el.wand.classList.toggle('mmd-chg', !!on);
    el.prog.setAttribute('stroke-dashoffset', (RING_C * (1 - p)).toFixed(1));
    el.glow.style.opacity = on ? (0.15 + 0.6 * p).toFixed(2) : '0';
  }

  // ---- 麥克風：只量音量，聲音不離開這台裝置 ----
  function micStart() {
    if (mic.state) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { mic.state = 'none'; panelSig = null; return; }
    mic.state = 'asking';
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      if (!mounted) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      mic.stream = s; mic.ctx = new AC(); mic.an = mic.ctx.createAnalyser(); mic.an.fftSize = 512;
      mic.ctx.createMediaStreamSource(s).connect(mic.an);
      mic.buf = new Uint8Array(512);
      mic.state = 'on';
      panelSig = null; paint();
    }).catch(function () { mic.state = 'none'; if (mounted) { panelSig = null; paint(); } });
  }
  function micStop() {
    try { if (mic.stream) mic.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* 已經關了 */ }
    try { if (mic.ctx) mic.ctx.close(); } catch (e2) { /* 已經關了 */ }
    mic = { state: '', stream: null, ctx: null, an: null, buf: null };
  }
  function micLevel() {
    mic.an.getByteTimeDomainData(mic.buf);
    for (var i = 0, s = 0; i < mic.buf.length; i++) { var v = (mic.buf[i] - 128) / 128; s += v * v; }
    return Math.sqrt(s / mic.buf.length);
  }

  // ---- 按住按鈕的招式（查全身、學動物叫）----
  function endHold() {
    if (!hold) return;
    if (hold.bar) hold.bar.style.width = '0';
    if (el.sweep) el.sweep.style.display = 'none';
    if (el.micBar) el.micBar.style.width = '0';
    hold = null;
    if (panelDirty && mounted) paintPanel();
  }
  function stepHold(now) {
    var T = TOOLS[hold.tool], ms = T.ms, dt = Math.min(100, now - hold.last);
    hold.last = now;
    if (!canAct()) { endHold(); return false; }
    if (hold.tool === 'call') {
      if (mic.state === 'asking') { endHold(); return false; }   // 權限視窗會吃掉放開事件
      if (mic.state === 'on') {
        var lv = micLevel();
        if (el.micBar) el.micBar.style.width = Math.min(100, lv / MIC_TH * 50).toFixed(0) + '%';
        if (lv > MIC_TH) hold.acc += dt;
      } else { ms = CALL_FALLBACK_MS; hold.acc += dt; }
    } else hold.acc += dt;
    while (hold.acc >= hold.ticks * TICK_MS) { hold.ticks++; chirp(Math.min(1, hold.acc / ms)); }
    var p = Math.min(1, hold.acc / ms);
    if (hold.bar) hold.bar.style.width = (p * 100).toFixed(1) + '%';
    if (hold.tool === 'wave') { el.sweep.style.display = 'block'; el.sweep.style.top = (p * 100).toFixed(1) + '%'; }
    if (p < 1) return true;
    var tool = hold.tool, kind = hold.kind, key = tool === 'call' ? 'call:' + kind : tool;
    endHold();
    setPending(key);
    panelSig = null; paint();
    send(tool === 'call' ? { a: 'call', kind: kind } : { a: tool });
    return false;
  }

  // ---- 每一格：命中測試、充能、探測棒位置 ----
  function kick() { if (mounted && !raf) raf = requestAnimationFrame(frame); }

  function frame(now) {
    raf = 0;
    if (!mounted) return;
    var again = hold ? stepHold(now) : false;
    if (!wrap.isConnected) {
      // 主頁重畫時我們會被暫時拆下：短時間內保留充能，拆太久才放棄
      if (!detachedAt) detachedAt = now;
      if (charge && now - detachedAt >= DETACH_GRACE_MS) { charge = null; showRing(0, false); setHot(null); }
      if (charge || again) raf = requestAnimationFrame(frame);
      return;
    }
    detachedAt = 0;
    var mode = TOOLS[curTool].mode, usePtr = canAct() && ptr.on && (mode === 'dwell' || mode === 'tap');
    var px = ptr.x, py = ptr.y - (ptr.touch && mode === 'dwell' ? TOUCH_LIFT : 0);
    var inPlay = false, hit = null, pr = null;
    if (usePtr) {
      pr = el.play.getBoundingClientRect();
      inPlay = px >= pr.left && px <= pr.right && py >= pr.top && py <= pr.bottom;
      if (inPlay) {
        var top = document.elementFromPoint(px, py);
        if (!top || !el.play.contains(top)) inPlay = false;   // 被別的視窗蓋住就不算
      }
      if (inPlay) {
        for (var i = 0; i < ids.length; i++) {
          var b = zones[ids[i]].box.getBoundingClientRect();
          if (px >= b.left && px <= b.right && py >= b.top && py <= b.bottom) { hit = ids[i]; break; }
        }
      }
    }
    el.wand.classList.toggle('mmd-on', inPlay);
    if (inPlay) el.wand.style.transform = 'translate(' + (px - pr.left - el.play.clientLeft).toFixed(1) + 'px,' + (py - pr.top - el.play.clientTop).toFixed(1) + 'px)';

    var key = hit ? curTool + ':' + hit : null, can = null;
    if (hit && !pending[key]) {
      if (curTool === 'wand' && !(st.scanned || {})[hit]) can = hit;
      else if (curTool === 'swab' && !(st.swab || {})[hit]) can = hit;
      else if (curTool === 'xeye' && !own(st.seen, hit) && !own(st.taken, hit)) can = hit;
    }
    var chargeable = mode === 'dwell' ? can : null;
    if (charge && charge.slot !== chargeable) charge = null;          // 離開部位：取消
    if (!charge && chargeable) charge = { slot: chargeable, start: now, ticks: 0 };
    setHot(can);
    if (charge) {
      var ms = TOOLS[curTool].ms, t = now - charge.start, p = Math.min(1, t / ms);
      while (charge.ticks < Math.floor(ms / TICK_MS) && t >= charge.ticks * TICK_MS) { charge.ticks++; chirp(p); }
      if (p >= 1) {
        var slot = charge.slot;
        charge = null;
        setPending(curTool + ':' + slot);
        setHot(null);
        showRing(0, false);
        paint();
        send({ a: curTool === 'wand' ? 'scan' : 'swab', slot: slot });
      } else showRing(p, true);
    } else showRing(0, false);

    if (again || (ptr.on && (inPlay || charge))) raf = requestAnimationFrame(frame);
  }

  // ---- 指標事件（掛在 document，因為 root 隨時會被拆下再裝回）----
  function onMove(e) {
    if (e.pointerType === 'mouse') { if (ptr.id !== null) return; ptr.on = true; ptr.touch = false; }
    else if (ptr.id !== e.pointerId) return;
    ptr.x = e.clientX; ptr.y = e.clientY; kick();
  }
  function onDown(e) {
    var hb = e.target && e.target.closest ? e.target.closest('[data-hold]') : null;
    if (hb && wrap && wrap.contains(hb) && !hb.disabled && !hold && canAct()) {
      var now = performance.now();
      hold = { tool: hb.getAttribute('data-hold'), kind: hb.getAttribute('data-kind'), pid: e.pointerId, bar: hb.querySelector('i'), last: now, acc: 0, ticks: 0 };
      if (hold.tool === 'call') micStart();
      kick();
    }
    if (e.pointerType === 'mouse') { onMove(e); return; }
    if (ptr.id !== null) return;
    ptr.id = e.pointerId; ptr.on = true; ptr.touch = true; ptr.x = e.clientX; ptr.y = e.clientY; kick();
  }
  function onUp(e) {
    if (hold && hold.pid === e.pointerId) endHold();
    if (e.pointerType === 'mouse' || ptr.id !== e.pointerId) return;
    ptr.id = null; ptr.on = false; kick();
  }
  function onLeave() { if (ptr.id === null) { ptr.on = false; kick(); } }
  function onBlur() { endHold(); ptr.id = null; ptr.on = false; kick(); }
  function onMenu(e) { if (wrap && e.target && wrap.contains(e.target) && (el.play.contains(e.target) || (e.target.closest && e.target.closest('[data-hold]')))) e.preventDefault(); }
  function onClick(e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var b, id;
    if ((b = t.closest('[data-tool]'))) {
      curTool = b.getAttribute('data-tool'); charge = null; endHold(); setHot(null);
      tabSig = null; panelSig = null; paint(); kick();
      return;
    }
    if ((b = t.closest('[data-pick]')) || (b = t.closest('[data-secret]'))) {
      var p = st.prep;
      if (!p || p.editable === false || b.disabled) return;
      var picked = (p.picked || []).slice(), secret = p.secret || null, max = Number(p.max) || 3;
      if (b.hasAttribute('data-pick')) {
        id = b.getAttribute('data-pick');
        var i = picked.indexOf(id);
        if (i >= 0) { picked.splice(i, 1); if (secret === id) secret = null; }
        else if (picked.length < max) picked.push(id);
        else { play('thud'); return; }
      } else {
        id = b.getAttribute('data-secret');
        secret = secret === id ? null : id;
      }
      play('pop');
      send({ a: 'loadout', picked: picked, secret: secret });
      return;
    }
    if ((b = t.closest('[data-frisk]'))) {
      if (b.disabled) return;
      id = b.getAttribute('data-frisk');
      if (!canAct() || (Number(st.ap) || 0) < 2 || own(st.taken, id) || friskLock[id]) return;
      friskLock[id] = true;
      paint();
      later(function () { delete friskLock[id]; paint(); }, FRISK_LOCK_MS);
      send({ a: 'frisk', slot: id });
      return;
    }
    if (curTool === 'xeye' && (b = t.closest('.mmd-zone'))) {
      id = b.getAttribute('data-slot');
      var key = 'xeye:' + id;
      if (!canAct() || (Number(st.ap) || 0) < TOOLS.xeye.ap) { play('thud'); return; }
      if (own(st.seen, id) || own(st.taken, id) || pending[key]) return;
      setPending(key);
      paint();
      send({ a: 'xeye', slot: id });
    }
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
      '<div class="mmd-head"><div class="mmd-title">海關檢查</div><div class="mmd-timer mmd-off"><i></i><span></span></div><div class="mmd-ap">行動點 <b>–</b></div></div>' +
      '<div class="mmd-prep"></div>' +
      '<div class="mmd-tabs"></div>' +
      '<div class="mmd-grid">' +
        '<div class="mmd-play"><div class="mmd-fig"></div><div class="mmd-sweep"></div><div class="mmd-idlemsg"></div><div class="mmd-wand">' + WAND_SVG + '</div></div>' +
        '<div class="mmd-side"><div class="mmd-pass"></div><div class="mmd-panel"></div><div class="mmd-list"></div></div>' +
      '</div>';
    el = {
      title: wrap.querySelector('.mmd-title'),
      timer: wrap.querySelector('.mmd-timer'), timerBar: wrap.querySelector('.mmd-timer i'), timerTxt: wrap.querySelector('.mmd-timer span'),
      ap: wrap.querySelector('.mmd-ap'), apNum: wrap.querySelector('.mmd-ap b'),
      prep: wrap.querySelector('.mmd-prep'), tabs: wrap.querySelector('.mmd-tabs'),
      play: wrap.querySelector('.mmd-play'), fig: wrap.querySelector('.mmd-fig'), sweep: wrap.querySelector('.mmd-sweep'), idle: wrap.querySelector('.mmd-idlemsg'),
      wand: wrap.querySelector('.mmd-wand'), prog: wrap.querySelector('.mmd-wprog'), glow: wrap.querySelector('.mmd-wglow'),
      pass: wrap.querySelector('.mmd-pass'), panel: wrap.querySelector('.mmd-panel'), list: wrap.querySelector('.mmd-list'), micBar: null
    };
    root.appendChild(wrap);
    mounted = true;
    st = { active: false };
    lastSig = figSig = passSig = tabSig = panelSig = prepSig = null; curKey = null; baseline = true;
    curTool = 'wand';
    ptr = { on: false, id: null, x: 0, y: 0, touch: false };
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
    var over = state.t != null && Number(state.t) <= 0;
    var sig = JSON.stringify([!!state.active, state.key, slots, state.scanned || 0, state.taken || 0, state.ap, pass,
      state.swab || 0, state.seen || 0, state.wave || 0, state.dog || 0, state.heard || 0, state.tools || 0, state.kinds || 0, state.prep || 0, over]);
    if (sig === lastSig) {            // 只有倒數在動：只更新倒數條
      if (st.t !== state.t || st.tMax !== state.tMax) { st = state; paintTimer(); }
      return;
    }
    lastSig = sig;
    st = state;

    var key = state.active ? String(state.key) : null;
    if (key !== curKey) { curKey = key; resetLocal(); baseline = true; panelSig = null; }

    var fs = JSON.stringify([slots, pass && pass.looks]);
    if (fs !== figSig) { figSig = fs; hot = null; buildFigure(slots, pass && pass.looks); }
    var ps = JSON.stringify(pass);
    if (ps !== passSig) { passSig = ps; buildPass(pass); }

    var res = collect(state);
    Object.keys(res).forEach(function (k) {
      var r = res[k], isNew = !prevRes[k] || prevRes[k].v !== r.v;
      if (pending[k] && r.v !== pendingV[k]) { delete pending[k]; delete pendingV[k]; }
      if (!isNew || baseline) return;
      play(r.pos ? 'beep' : 'pop');
      if (r.pos) alarm();
      if (r.slot) {
        var slot = r.slot;
        flash[slot] = true;
        later(function () { delete flash[slot]; paint(); }, FLASH_MS);
      }
      if (k.indexOf('xeye:') === 0) {
        wrap.classList.add('mmd-blur');
        later(function () { wrap.classList.remove('mmd-blur'); }, BLUR_MS);
      }
    });
    prevRes = res;
    ids.forEach(function (id) { if (own(state.taken, id)) delete friskLock[id]; });
    baseline = false;
    if (!canAct()) { charge = null; endHold(); }
    paint();
    kick();
  }

  function unmount() {
    if (!mounted) return;
    mounted = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearTimers();
    hold = null;
    micStop();
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
    charge = null; hot = null; pending = {}; pendingV = {}; friskLock = {}; flash = {}; prevRes = {};
    st = { active: false }; lastSig = figSig = passSig = tabSig = panelSig = prepSig = null; curKey = null;
  }

  window.Mini = window.Mini || {};
  window.Mini.metal = { mount: mount, update: update, unmount: unmount };
})();
