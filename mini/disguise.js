// 小遊戲模組：易容（通緝犯在化妝鏡前換裝）。依賴 core.js 的 FEAT / CATS / face()。
(function () {
  'use strict';

  var STYLE_ID = 'mdg-style';
  var PENDING_MS = 1500;   // 樂觀更新最多等主機這麼久，沒被承認就退回
  var DRAG_PX = 8;         // 移動超過這個距離才算拖曳

  // 各種特徵在 face() 的 100x120 畫布上的位置 [x, y, 半徑]，用來在兩張臉上圈出破綻
  var MARK = {
    '左臉有痣': [67, 64, 9],
    '眉毛有疤': [60, 43, 10],
    '戴耳環': [23, 64, 9],
    '脖子有刺青': [31, 79, 10],
    '有酒窩': [50, 72, 17],
    '鑲金牙': [53, 73, 8],
    '滿臉雀斑': [50, 61, 22],
    '缺一顆門牙': [50, 73, 8]
  };

  var ICO_LOCK = '<svg class="mdg-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7.5" rx="1.6" fill="currentColor"/><path d="M5.2 7.2V5a2.8 2.8 0 0 1 5.6 0v2.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  var ICO_STAR = '<svg class="mdg-ico" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M8 1 L9.7 6.3 L15 8 L9.7 9.7 L8 15 L6.3 9.7 L1 8 L6.3 6.3Z" fill="currentColor"/></svg>';

  var CSS = [
    '.mdg-wrap{container-type:inline-size;container-name:mdg;color:var(--fg,#e8ecf3);font-size:14px;line-height:1.45;-webkit-tap-highlight-color:transparent}',
    '.mdg-wrap *{box-sizing:border-box}',
    '.mdg-wrap button{font:inherit;color:inherit}',
    '.mdg-ico{vertical-align:-2px;flex:none}',
    '.mdg-stage{display:grid;grid-template-columns:minmax(150px,200px) minmax(200px,1fr) minmax(220px,270px);gap:14px;align-items:stretch}',

    /* 通緝令 */
    '.mdg-poster{background:#e9dcbc;color:#2b2118;border-radius:4px;padding:12px 12px 14px;text-align:center;transform:rotate(-1.4deg);box-shadow:0 6px 16px rgba(0,0,0,.45);position:relative;align-self:center;border:1px solid #bda97c}',
    '.mdg-poster:before{content:"";position:absolute;left:50%;top:-6px;width:13px;height:13px;margin-left:-6px;border-radius:50%;background:var(--bad,#ff6b6b);box-shadow:0 2px 3px rgba(0,0,0,.5)}',
    '.mdg-poster-head{font-weight:900;font-size:24px;letter-spacing:3px;line-height:1.1}',
    '.mdg-poster-sub{font-weight:700;letter-spacing:10px;text-indent:10px;font-size:13px;border-top:2px solid #2b2118;border-bottom:2px solid #2b2118;margin:4px 0 9px;padding:1px 0}',
    '.mdg-poster-face{width:74%;margin:0 auto;border:2px solid #2b2118}',
    '.mdg-poster-name{font-weight:800;font-size:18px;margin-top:8px}',
    '.mdg-poster-mark{font-size:12px;margin-top:2px;color:#7a2a1c;font-weight:700}',
    '.mdg-poster-cap{font-size:11px;color:#6b5a41;margin-top:2px}',

    /* 臉＋破綻圈 */
    '.mdg-facewrap{position:relative;display:block;line-height:0}',
    '.mdg-facewrap svg{display:block;width:100%;height:auto}',
    '.mdg-ring{position:absolute;border-radius:50%;border:2px solid var(--warn,#ffc857);box-shadow:0 0 0 2px rgba(0,0,0,.55),0 0 10px 2px var(--warn,#ffc857);pointer-events:none;animation:mdg-pulse 1.5s ease-in-out infinite}',
    '@keyframes mdg-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.22);opacity:.55}}',

    /* 化妝鏡 */
    '.mdg-mirror{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-width:0}',
    '.mdg-mirror-cap{font-size:12px;color:var(--dim,#93a0b5)}',
    '.mdg-frame{width:min(100%,236px);padding:13px;border-radius:120px 120px 14px 14px;background:radial-gradient(circle,#fff3c4 0 2.6px,#ffd35e 3px 3.6px,transparent 4.2px) 2px 2px/22px 22px,#3b2b22;box-shadow:0 0 26px rgba(255,214,110,.16),inset 0 0 0 2px #5a4233;outline:2px dashed transparent;outline-offset:4px;transition:outline-color .12s,transform .12s}',
    '.mdg-glass{position:relative;border-radius:108px 108px 6px 6px;overflow:hidden;background:#d5e4f2}',
    '.mdg-glass:after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.5) 0 12%,transparent 12.5% 20%,rgba(255,255,255,.22) 20.5% 25%,transparent 25.5%);pointer-events:none}',
    '.mdg-mirror-face{transform-origin:50% 60%}',
    '.mdg-mirror-face.mdg-poof{animation:mdg-swap .42s cubic-bezier(.2,1.4,.4,1)}',
    '@keyframes mdg-swap{0%{transform:scale(.55) rotate(-9deg);filter:brightness(2.4) blur(3px);opacity:.2}55%{transform:scale(1.07) rotate(2deg);filter:brightness(1.2)}100%{transform:none;filter:none;opacity:1}}',
    '.mdg-puff{position:absolute;left:50%;top:50%;width:70%;aspect-ratio:1;margin:-35% 0 0 -35%;border-radius:50%;pointer-events:none;opacity:0;background:radial-gradient(circle,#fff 0 30%,rgba(255,255,255,.75) 45%,rgba(255,255,255,0) 70%)}',
    '.mdg-puff.mdg-poof{animation:mdg-puff .45s ease-out}',
    '@keyframes mdg-puff{0%{transform:scale(.3);opacity:.95}100%{transform:scale(2.1);opacity:0}}',
    '.mdg-drag-on .mdg-frame{outline-color:var(--acc,#5fb3ff)}',
    '.mdg-drag-on.mdg-drop-on .mdg-frame{outline-style:solid;transform:scale(1.03)}',
    '.mdg-plate{background:var(--card,#1a2130);border:1px solid var(--line,#2c3649);border-radius:8px;padding:4px 14px;text-align:center;max-width:100%}',
    '.mdg-plate small{display:block;font-size:11px;color:var(--dim,#93a0b5)}',
    '.mdg-plate b{font-size:17px;letter-spacing:1px}',

    /* 右側狀態 */
    '.mdg-status{display:flex;flex-direction:column;gap:10px;min-width:0}',
    '.mdg-card{background:var(--card,#1a2130);border:1px solid var(--line,#2c3649);border-radius:10px;padding:9px 11px;min-width:0}',
    '.mdg-card-t{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:13px;margin-bottom:6px}',
    '.mdg-card-t b{font-size:13px;color:var(--acc,#5fb3ff);white-space:nowrap}',
    '.mdg-small{font-size:12px;color:var(--dim,#93a0b5)}',
    '.mdg-tokens{display:flex;gap:8px;flex-wrap:wrap}',
    '.mdg-token{flex:1 1 104px;display:flex;align-items:center;gap:7px;border-radius:999px;padding:4px 10px 4px 5px;border:1px solid var(--acc,#5fb3ff);background:rgba(95,179,255,.12);font-size:12px;min-width:0}',
    '.mdg-token-ico{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--acc,#5fb3ff);color:#0c1422;flex:none}',
    '.mdg-token.mdg-used{border-color:var(--line,#2c3649);background:transparent;color:var(--dim,#93a0b5)}',
    '.mdg-token.mdg-used .mdg-token-ico{background:var(--line,#2c3649);color:var(--dim,#93a0b5)}',
    '.mdg-token-txt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mdg-bar{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:3px}',
    '.mdg-seg{text-align:center;font-size:10px;color:var(--dim,#93a0b5);min-width:0;white-space:nowrap}',
    '.mdg-seg i{display:block;height:11px;border-radius:3px;background:var(--line,#2c3649);margin-bottom:2px;transition:background .2s}',
    '.mdg-seg.mdg-on{color:var(--fg,#e8ecf3)}',
    '.mdg-hi .mdg-seg.mdg-on i{background:var(--bad,#ff6b6b)}',
    '.mdg-mid .mdg-seg.mdg-on i{background:var(--warn,#ffc857)}',
    '.mdg-lo .mdg-seg.mdg-on i{background:var(--good,#55d38a)}',
    '.mdg-meter-txt{margin-top:5px;font-size:13px;font-weight:700}',
    '.mdg-hi .mdg-meter-txt,.mdg-hi .mdg-card-t b{color:var(--bad,#ff6b6b)}',
    '.mdg-mid .mdg-meter-txt,.mdg-mid .mdg-card-t b{color:var(--warn,#ffc857)}',
    '.mdg-lo .mdg-meter-txt,.mdg-lo .mdg-card-t b{color:var(--good,#55d38a)}',
    '.mdg-lockcard{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.07)}',
    '.mdg-lockcard .mdg-card-t{color:var(--warn,#ffc857);justify-content:flex-start;margin-bottom:3px}',

    /* 化妝台 */
    '.mdg-table{margin-top:14px;background:var(--card,#1a2130);border:1px solid var(--line,#2c3649);border-radius:12px;padding:10px;border-top:4px solid #6b4a34}',
    '.mdg-table-t{font-weight:700;font-size:13px;margin:0 2px 8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
    '.mdg-table-t span{color:var(--dim,#93a0b5);font-weight:400;font-size:12px}',
    '.mdg-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px}',
    '.mdg-tab{position:relative;display:flex;min-width:0;border:1px solid var(--line,#2c3649);border-radius:9px;background:var(--bg,#10141c);overflow:hidden}',
    '.mdg-tab-btn{flex:1;min-width:0;background:none;border:0;padding:6px 8px;text-align:left;cursor:pointer;display:block}',
    '.mdg-tab-btn b{display:block;font-size:14px}',
    '.mdg-tab-btn span{display:block;font-size:11px;color:var(--dim,#93a0b5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mdg-tab.mdg-open{border-color:var(--acc,#5fb3ff);box-shadow:inset 0 -3px 0 var(--acc,#5fb3ff)}',
    '.mdg-tab.mdg-changed .mdg-tab-btn span{color:var(--good,#55d38a);font-weight:700}',
    '.mdg-tab.mdg-full .mdg-tab-btn b{color:var(--dim,#93a0b5)}',
    '.mdg-undo{flex:none;align-self:center;margin-right:6px;border:1px solid var(--good,#55d38a);background:rgba(85,211,138,.12);color:var(--good,#55d38a)!important;border-radius:7px;padding:3px 7px;font-size:12px;cursor:pointer;white-space:nowrap}',
    '.mdg-undo:hover{background:rgba(85,211,138,.28)}',
    '.mdg-tab.mdg-fixed{border-style:dashed;border-color:var(--warn,#ffc857);background:rgba(255,200,87,.07)}',
    '.mdg-tab.mdg-fixed .mdg-tab-btn{cursor:not-allowed}',
    '.mdg-tab.mdg-fixed .mdg-tab-btn b,.mdg-tab.mdg-fixed .mdg-tab-btn span{color:var(--warn,#ffc857)}',
    '.mdg-drawer{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px;margin-top:10px;padding:10px;border-radius:9px;background:var(--bg,#10141c);border:1px solid var(--line,#2c3649)}',
    '.mdg-opt{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:7px 4px 6px;border-radius:9px;border:2px solid var(--line,#2c3649);background:var(--card,#1a2130);cursor:pointer;user-select:none;-webkit-user-select:none;min-width:0;transition:transform .1s,border-color .1s}',
    '.mdg-opt:hover{border-color:var(--acc,#5fb3ff);transform:translateY(-2px)}',
    '.mdg-opt-face{width:58px;max-width:100%;border-radius:6px;overflow:hidden;touch-action:none;cursor:grab}',
    '.mdg-opt-label{font-size:12px;text-align:center;line-height:1.2;white-space:nowrap}',
    '.mdg-opt.mdg-sel{border-color:var(--acc,#5fb3ff);background:rgba(95,179,255,.14)}',
    '.mdg-opt.mdg-sel .mdg-opt-label{font-weight:700;color:var(--acc,#5fb3ff)}',
    '.mdg-badge{position:absolute;top:-7px;left:-5px;font-size:11px;font-weight:700;line-height:1;padding:3px 6px;border-radius:999px;background:var(--warn,#ffc857);color:#2b2118}',
    '.mdg-opt.mdg-lock{cursor:not-allowed;border-style:dashed}',
    '.mdg-opt.mdg-lock:hover{border-color:var(--bad,#ff6b6b);transform:none}',
    '.mdg-opt.mdg-lock .mdg-opt-face{opacity:.62;filter:grayscale(.65);cursor:not-allowed}',
    '.mdg-opt.mdg-lock .mdg-opt-label{color:var(--dim,#93a0b5)}',
    '.mdg-optlock{position:absolute;top:-7px;right:-5px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:var(--bad,#ff6b6b);color:#2b1010}',
    '.mdg-optlock .mdg-ico{width:12px;height:12px;vertical-align:0}',
    '.mdg-shake{animation:mdg-shake .34s linear}',
    '@keyframes mdg-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}',
    '.mdg-hint{margin:8px 2px 0;font-size:12.5px;color:var(--dim,#93a0b5);min-height:18px}',
    '.mdg-hint.mdg-warn{color:var(--warn,#ffc857);font-weight:700}',
    '.mdg-hint.mdg-flash{animation:mdg-flash .5s ease-out}',
    '@keyframes mdg-flash{0%{color:var(--bad,#ff6b6b);transform:scale(1.03)}100%{transform:none}}',
    '.mdg-ro .mdg-opt,.mdg-ro .mdg-opt-face{cursor:default}',
    '.mdg-ro .mdg-opt:hover{transform:none;border-color:var(--line,#2c3649)}',
    '.mdg-ro .mdg-opt.mdg-sel:hover{border-color:var(--acc,#5fb3ff)}',
    '.mdg-ghost{position:fixed;left:0;top:0;z-index:99999;width:70px;margin:-42px 0 0 -35px;pointer-events:none;border-radius:8px;overflow:hidden;line-height:0;box-shadow:0 10px 22px rgba(0,0,0,.55);outline:2px solid #5fb3ff;opacity:.94;will-change:transform}',
    '.mdg-ghost svg{display:block;width:100%;height:auto}',

    /* 中等寬度：狀態卡移到下面排成一列 */
    '@container mdg (max-width:780px){',
    '.mdg-stage{grid-template-columns:minmax(140px,190px) minmax(0,1fr)}',
    '.mdg-status{grid-column:1/-1;flex-direction:row;flex-wrap:wrap}',
    '.mdg-status>.mdg-card{flex:1 1 200px}',
    '}',
    /* 窄：通緝令與鏡子上下疊 */
    '@container mdg (max-width:480px){',
    '.mdg-stage{grid-template-columns:minmax(0,1fr);gap:12px}',
    '.mdg-poster{display:grid;grid-template-columns:86px minmax(0,1fr);column-gap:12px;text-align:left;align-items:center;transform:rotate(-.6deg);padding:10px 12px}',
    '.mdg-poster-face{grid-column:1;grid-row:1/span 5;width:100%}',
    '.mdg-poster-head,.mdg-poster-sub,.mdg-poster-name,.mdg-poster-mark,.mdg-poster-cap{grid-column:2}',
    '.mdg-poster-head{font-size:20px}',
    '.mdg-poster-sub{margin:2px 0 4px;text-indent:0;letter-spacing:8px}',
    '.mdg-poster-name{margin-top:0}',
    '.mdg-frame{width:min(100%,200px)}',
    '.mdg-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.mdg-drawer{grid-template-columns:repeat(auto-fill,minmax(78px,1fr));padding:9px 7px}',
    '}',
    '@media (prefers-reduced-motion:reduce){.mdg-ring,.mdg-poof,.mdg-shake,.mdg-flash{animation:none!important}}'
  ].join('\n');

  // ---------- 模組狀態 ----------
  var root = null, api = null, els = null;
  var st = null, stKey = '';
  var pending = {};          // 類別 -> {v, t}：已送出、主機還沒承認的樂觀更新
  var open = null;           // 目前打開的抽屜（類別）
  var keys = {};             // 各區塊上次畫出來的內容指紋，用來避免重複動 DOM
  var timers = [];
  var press = null;          // 按下／拖曳中的資訊
  var skipClickUntil = 0;
  var drawerDirty = false;
  var hintFlash = false;

  function cats() { return (typeof CATS !== 'undefined' && CATS) || (st ? Object.keys(st.real) : []); }
  function opts(k) { return (typeof FEAT !== 'undefined' && FEAT[k]) || []; }
  function esc(s) {
    s = String(s == null ? '' : s);
    if (api && typeof api.esc === 'function') return api.esc(s);
    return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function drawFace(looks, size, bg) {
    var f = (api && typeof api.face === 'function') ? api.face : (typeof face === 'function' ? face : null);
    return f ? f(looks, size, bg) : '';
  }
  function play(n) { try { if (api && api.play) api.play(n); } catch (e) { /* 音效失敗不影響遊戲 */ } }
  function later(fn, ms) {
    var id = setTimeout(function () {
      var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1);
      if (root) fn();
    }, ms);
    timers.push(id);
    return id;
  }

  function snap(s) {
    s = s || {};
    var real = {}, looks = {}, list = (typeof CATS !== 'undefined' && CATS) || Object.keys(s.real || {});
    list.forEach(function (c) {
      real[c] = (s.real || {})[c];
      looks[c] = (s.looks || {})[c];
    });
    return {
      editable: !!s.editable,
      max: typeof s.max === 'number' ? s.max : 2,
      locked: Array.isArray(s.locked) ? s.locked.slice() : ['特徵'],
      realName: String(s.realName == null ? '' : s.realName),
      passName: String(s.passName == null ? '' : s.passName),
      real: real, looks: looks
    };
  }
  function isFixed(k) { return st.locked.indexOf(k) >= 0; }
  function view() {
    var v = {}, k;
    for (k in st.looks) v[k] = st.looks[k];
    for (k in pending) v[k] = pending[k].v;
    return v;
  }
  function changedCats(v) {
    return cats().filter(function (c) { return !isFixed(c) && v[c] !== st.real[c]; });
  }
  function reconcile() {
    var now = Date.now(), k;
    for (k in pending) {
      if (st.looks[k] === pending[k].v || now - pending[k].t > PENDING_MS) delete pending[k];
    }
  }
  function setHTML(el, name, key, html) {
    if (keys[name] === key) return false;
    keys[name] = key;
    el.innerHTML = typeof html === 'function' ? html() : html;
    return true;
  }
  function ring(mark) {
    var m = MARK[mark];
    if (!m) return '';
    return '<span class="mdg-ring" style="left:' + (m[0] - m[2]) + '%;top:' + ((m[1] - m[2]) / 1.2).toFixed(2) +
      '%;width:' + (m[2] * 2) + '%;height:' + (m[2] * 2 / 1.2).toFixed(2) + '%"></span>';
  }
  function rings(looks) {
    return st.locked.map(function (c) { return ring(looks[c]); }).join('');
  }

  // ---------- 畫面 ----------
  function render() {
    if (!root || !els || !st) return;
    var v = view(), list = cats();
    var changed = changedCats(v), used = changed.length, full = used >= st.max;
    var vKey = JSON.stringify(v), rKey = JSON.stringify(st.real);
    if (!open || list.indexOf(open) < 0 || isFixed(open)) {
      open = changed[0] || list.filter(function (c) { return !isFixed(c); })[0] || null;
    }
    var fixedTxt = st.locked.map(function (c) { return st.real[c]; }).filter(Boolean).join('、');

    if (keys.ro !== st.editable) { keys.ro = st.editable; els.wrap.classList.toggle('mdg-ro', !st.editable); }

    setHTML(els.poster, 'poster', rKey + st.realName + st.locked, function () {
      return '<div class="mdg-poster-head">WANTED</div><div class="mdg-poster-sub">通緝</div>' +
        '<div class="mdg-facewrap mdg-poster-face">' + drawFace(st.real, 132, '#e3d2a8') + rings(st.real) + '</div>' +
        '<div class="mdg-poster-name">' + esc(st.realName) + '</div>' +
        (fixedTxt ? '<div class="mdg-poster-mark">特徵：' + esc(fixedTxt) + '</div>' : '') +
        '<div class="mdg-poster-cap">這是你的真面目</div>';
    });

    setHTML(els.face, 'face', vKey + st.locked, function () {
      return drawFace(v, 200, '#d5e4f2') + rings(v);
    });
    setHTML(els.plate, 'plate', st.passName, function () {
      return '<small>護照上的假名</small><b>' + esc(st.passName) + '</b>';
    });

    setHTML(els.status, 'status', vKey + rKey + st.max + st.locked, function () {
      var h = '', i, same = list.filter(function (c) { return v[c] === st.real[c]; }).length;
      var left = Math.max(0, st.max - used);
      h += '<div class="mdg-card"><div class="mdg-card-t">易容道具<b>剩 ' + left + ' / ' + st.max + '</b></div><div class="mdg-tokens">';
      for (i = 0; i < st.max; i++) {
        h += i < used
          ? '<div class="mdg-token mdg-used"><span class="mdg-token-ico">' + ICO_STAR + '</span><span class="mdg-token-txt">用在' + esc(changed[i]) + '</span></div>'
          : '<div class="mdg-token"><span class="mdg-token-ico">' + ICO_STAR + '</span><span class="mdg-token-txt">還沒用</span></div>';
      }
      h += '</div></div>';
      var lvl = same >= list.length ? 'mdg-hi' : (same <= list.length - st.max ? 'mdg-lo' : 'mdg-mid');
      h += '<div class="mdg-card ' + lvl + '"><div class="mdg-card-t">和通緝令的相似度<b>' + same + ' / ' + list.length + '</b></div><div class="mdg-bar">';
      list.forEach(function (c) {
        h += '<div class="mdg-seg' + (v[c] === st.real[c] ? ' mdg-on' : '') + '"><i></i>' + esc(c) + '</div>';
      });
      h += '</div><div class="mdg-meter-txt">' + list.length + ' 類裡還有 ' + same + ' 類一樣</div></div>';
      st.locked.forEach(function (c) {
        h += '<div class="mdg-card mdg-lockcard"><div class="mdg-card-t">' + ICO_LOCK + esc(c) + '：' + esc(st.real[c]) + '</div>' +
          '<div class="mdg-small">這個改不掉，是你的破綻。兩張臉上閃爍的圈就是它的位置。</div></div>';
      });
      return h;
    });

    setHTML(els.tabs, 'tabs', vKey + rKey + open + st.max + st.locked + st.editable, function () {
      return list.map(function (c) {
        if (isFixed(c)) {
          return '<div class="mdg-tab mdg-fixed"><button type="button" class="mdg-tab-btn" data-fixed="1" title="不能改">' +
            '<b>' + ICO_LOCK + ' ' + esc(c) + '</b><span>' + esc(v[c]) + '・不能改</span></button></div>';
        }
        var ch = v[c] !== st.real[c];
        return '<div class="mdg-tab' + (c === open ? ' mdg-open' : '') + (ch ? ' mdg-changed' : (full ? ' mdg-full' : '')) + '">' +
          '<button type="button" class="mdg-tab-btn" data-tab="' + list.indexOf(c) + '" aria-expanded="' + (c === open) + '">' +
          '<b>' + (!ch && full ? ICO_LOCK + ' ' : '') + esc(c) + '</b><span>' + esc(v[c]) + '</span></button>' +
          (ch && st.editable ? '<button type="button" class="mdg-undo" data-undo="' + list.indexOf(c) + '">還原</button>' : '') +
          '</div>';
      }).join('');
    });

    renderDrawer(v, vKey, rKey, full);

    var hint, warn = false;
    if (!st.editable) hint = '現在只能看，不能換裝。';
    else if (full && open && v[open] === st.real[open]) { hint = '最多只能易容 ' + st.max + ' 類，先把別的改回原樣'; warn = true; }
    else if (full) hint = '易容道具用完了。這一類還可以換別的款式，或按「還原」把道具拿回來。';
    else hint = '點一下縮圖，或把它拖到鏡子上就能換。還能再改 ' + (st.max - used) + ' 類。';
    if (setHTML(els.hint, 'hint', hint, esc(hint))) els.hint.classList.toggle('mdg-warn', warn);
    if (hintFlash) { hintFlash = false; restart(els.hint, 'mdg-flash', 520); }
  }

  function renderDrawer(v, vKey, rKey, full) {
    if (press) { drawerDirty = true; return; }   // 按住／拖曳中不重畫抽屜，放開再補
    drawerDirty = false;
    var key = open + vKey + rKey + st.max + st.editable;
    if (keys.drawer === key) return;
    var d = els.drawer, sx = d.scrollLeft, sy = d.scrollTop, focusI = null;
    var act = document.activeElement;
    if (act && d.contains(act) && act.getAttribute) focusI = act.getAttribute('data-i');
    var catLocked = full && v[open] === st.real[open];
    setHTML(d, 'drawer', key, opts(open).map(function (o, i) {
      var look = {}, k;
      for (k in v) look[k] = v[k];
      look[open] = o;
      var orig = o === st.real[open], sel = o === v[open], lock = catLocked && !orig;
      return '<button type="button" class="mdg-opt' + (sel ? ' mdg-sel' : '') + (lock ? ' mdg-lock' : '') + '" data-i="' + i + '"' +
        ' aria-pressed="' + sel + '"' + (lock ? ' aria-disabled="true"' : '') + '>' +
        '<span class="mdg-facewrap mdg-opt-face">' + drawFace(look, 58, sel ? '#d5e4f2' : '#b9c4d4') + '</span>' +
        '<span class="mdg-opt-label">' + esc(o) + '</span>' +
        (orig ? '<span class="mdg-badge">原樣</span>' : '') +
        (lock ? '<span class="mdg-optlock">' + ICO_LOCK + '</span>' : '') +
        '</button>';
    }).join(''));
    d.scrollLeft = sx; d.scrollTop = sy;
    if (focusI != null) {
      var f = d.querySelector('[data-i="' + focusI + '"]');
      if (f) { try { f.focus({ preventScroll: true }); } catch (e) { /* 舊瀏覽器 */ } }
    }
  }

  function restart(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;   // 強制重排，讓同一個動畫可以連續重播
    el.classList.add(cls);
    later(function () { el.classList.remove(cls); }, ms);
  }
  function refuse(el) {
    play('deduct');
    if (el) restart(el, 'mdg-shake', 360);
  }

  // ---------- 動作 ----------
  function apply(k, val, el) {
    if (!st || !st.editable || !k) return;
    if (isFixed(k)) { refuse(el); return; }
    if (opts(k).indexOf(val) < 0) return;
    var v = view();
    if (v[k] === val) return;
    var others = changedCats(v).filter(function (c) { return c !== k; }).length;
    if (val !== st.real[k] && others >= st.max) {
      hintFlash = true;
      refuse(el);
      render();
      return;
    }
    pending[k] = { v: val, t: Date.now() };
    render();
    restart(els.face, 'mdg-poof', 440);
    restart(els.puff, 'mdg-poof', 470);
    play('pop');
    later(function () { reconcile(); render(); }, PENDING_MS + 60);
    try { api.send({ a: 'disguise', k: k, v: val }); } catch (e) { /* 送不出去就等逾時退回 */ }
  }

  function onClick(e) {
    if (!st) return;
    var t = e.target, list = cats(), b;
    if (!t || !t.closest) return;
    if ((b = t.closest('.mdg-opt'))) {
      if (Date.now() < skipClickUntil) return;
      apply(open, opts(open)[+b.getAttribute('data-i')], b);
      return;
    }
    if ((b = t.closest('[data-undo]'))) {
      var k = list[+b.getAttribute('data-undo')];
      apply(k, st.real[k], b);
      return;
    }
    if ((b = t.closest('[data-tab]'))) {
      var c = list[+b.getAttribute('data-tab')];
      if (c !== open) { open = c; play('tick'); render(); }
      return;
    }
    if ((b = t.closest('[data-fixed]'))) refuse(b.parentNode);
  }

  // ---------- 拖曳（監聽掛在 document，root 被拆下再裝回也不會斷） ----------
  function onDown(e) {
    if (!st || !st.editable || press) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var b = e.target && e.target.closest ? e.target.closest('.mdg-opt') : null;
    if (!b) return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, k: open, val: opts(open)[+b.getAttribute('data-i')], el: b, ghost: null, over: false };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onCancel, true);
  }
  function overMirror(x, y) {
    if (!els || !els.frame.isConnected) return false;
    var r = els.frame.getBoundingClientRect();
    return r.width > 0 && x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
  }
  function onMove(e) {
    if (!press || e.pointerId !== press.id) return;
    if (!press.ghost) {
      var dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (dx * dx + dy * dy < DRAG_PX * DRAG_PX) return;
      var v = view();
      if (v[press.k] === st.real[press.k] && press.val !== st.real[press.k] && changedCats(v).length >= st.max) {
        var el = press.el;
        skipClickUntil = Date.now() + 250;
        endPress();
        hintFlash = true; refuse(el); render();
        return;
      }
      v[press.k] = press.val;
      var g = document.createElement('div');
      g.className = 'mdg-ghost';
      g.innerHTML = drawFace(v, 70, '#d5e4f2');
      document.body.appendChild(g);
      press.ghost = g;
      els.mirror.classList.add('mdg-drag-on');
    }
    press.ghost.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    var over = overMirror(e.clientX, e.clientY);
    if (over !== press.over) { press.over = over; els.mirror.classList.toggle('mdg-drop-on', over); }
    if (e.cancelable) e.preventDefault();
  }
  function onUp(e) {
    if (!press || e.pointerId !== press.id) return;
    var p = press, dragged = !!p.ghost, hit = dragged && overMirror(e.clientX, e.clientY);
    if (dragged) skipClickUntil = Date.now() + 250;
    endPress();
    if (hit) apply(p.k, p.val, null);
  }
  function onCancel(e) {
    if (press && e.pointerId === press.id) endPress();
  }
  function endPress() {
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onCancel, true);
    if (press && press.ghost && press.ghost.parentNode) press.ghost.parentNode.removeChild(press.ghost);
    press = null;
    if (els) els.mirror.classList.remove('mdg-drag-on', 'mdg-drop-on');
    // 晚一拍再補畫抽屜，免得把接下來的 click 目標換掉
    if (drawerDirty) later(function () { if (!press) render(); }, 0);
  }

  // ---------- 對外介面 ----------
  function mount(r, a) {
    if (root) unmount();
    root = r; api = a || {};
    if (!document.getElementById(STYLE_ID)) {
      var s = document.createElement('style');
      s.id = STYLE_ID; s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    }
    root.innerHTML =
      '<div class="mdg-wrap">' +
        '<div class="mdg-stage">' +
          '<div class="mdg-poster"></div>' +
          '<div class="mdg-mirror">' +
            '<div class="mdg-mirror-cap">化妝鏡：現在的樣子</div>' +
            '<div class="mdg-frame"><div class="mdg-glass"><div class="mdg-facewrap mdg-mirror-face"></div><div class="mdg-puff"></div></div></div>' +
            '<div class="mdg-plate"></div>' +
          '</div>' +
          '<div class="mdg-status"></div>' +
        '</div>' +
        '<div class="mdg-table">' +
          '<div class="mdg-table-t">化妝台<span>一個抽屜一類，打開看看換了會變怎樣</span></div>' +
          '<div class="mdg-tabs"></div>' +
          '<div class="mdg-drawer"></div>' +
          '<div class="mdg-hint" aria-live="polite"></div>' +
        '</div>' +
      '</div>';
    var q = function (c) { return root.querySelector(c); };
    els = {
      wrap: q('.mdg-wrap'), poster: q('.mdg-poster'), mirror: q('.mdg-mirror'), frame: q('.mdg-frame'),
      face: q('.mdg-mirror-face'), puff: q('.mdg-puff'), plate: q('.mdg-plate'), status: q('.mdg-status'),
      tabs: q('.mdg-tabs'), drawer: q('.mdg-drawer'), hint: q('.mdg-hint')
    };
    keys = {}; pending = {}; open = null; st = null; stKey = '';
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', onDown);
  }

  function update(state) {
    if (!root) return;
    var s = snap(state), key = JSON.stringify(s);
    if (key !== stKey) { st = s; stKey = key; }
    else if (!hasPending()) return;      // 資料一模一樣又沒有待確認的更動：什麼都不做
    reconcile();
    render();
  }
  function hasPending() { for (var k in pending) return true; return false; }

  function unmount() {
    endPress();
    timers.forEach(clearTimeout); timers = [];
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('pointerdown', onDown);
      root.innerHTML = '';
    }
    var s = document.getElementById(STYLE_ID);
    if (s && s.parentNode) s.parentNode.removeChild(s);
    root = null; api = null; els = null; st = null; stKey = '';
    keys = {}; pending = {}; open = null; drawerDirty = false; hintFlash = false; skipClickUntil = 0;
  }

  window.Mini = window.Mini || {};
  window.Mini.disguise = { mount: mount, update: update, unmount: unmount };
})();
