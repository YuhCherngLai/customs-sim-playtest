// 後台發送暗號小遊戲模組：window.Mini.screen = { mount, update, unmount }
// 後台用定型的詞組一句話送上自己的螢幕。草稿只存在這個模組裡，送出後由主機驗證。
//
// state（合約第 5 節，加上試玩版本用的選填欄位，細節見 NOTES_screen.md）：
//   fields[].opts    有：答案版，每欄四個可送出的選項
//   fields[].truth   有：特徵詞版，答案只能看不能送（memo＝這個答案在回憶錄裡的模糊說法）
//   groups           有：分組的詞庫 [{label, words}]；沒有就用 words
//   ask              undefined：隨時可送（有冷卻）；null：等海關點題；
//                    {k,label,ms,n,of,sent}：海關正在問第 n/of 題，剩 ms 毫秒，sent＝這題我送過了
(function () {
  'use strict';

  var STYLE_ID = 'msc-style';

  var CSS = [
    '.msc-wrap{color:var(--fg,#e8ecf3)}',
    '.msc-wrap *{box-sizing:border-box}',
    '.msc-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 8px;margin:10px 0 4px;font-weight:700;font-size:.95em}',
    '.msc-h:first-child{margin-top:0}',
    '.msc-h small{font-weight:400;color:var(--dim,#93a0b5);font-size:.85em}',
    '.msc-ask{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 10px;margin-bottom:8px;padding:8px 10px;border:1px solid var(--line,#2c3649);border-radius:8px;background:var(--card,#1a2130);color:var(--dim,#93a0b5)}',
    '.msc-ask b{color:var(--fg,#e8ecf3);font-size:1.15em}',
    '.msc-ask.msc-open{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.1);color:var(--fg,#e8ecf3)}',
    '.msc-ask.msc-open b{color:var(--warn,#ffc857)}',
    '.msc-cd{font-weight:700;font-variant-numeric:tabular-nums;font-size:1.15em}',
    '.msc-cdbar{position:absolute;left:0;bottom:0;height:3px;width:0;background:var(--warn,#ffc857)}',
    '.msc-screen{background:#000;border:2px solid #444;border-radius:8px;min-height:74px;padding:8px 10px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:22px;font-weight:700;color:#7dffb0;text-shadow:0 0 8px rgba(125,255,176,.5);overflow-wrap:anywhere}',
    '.msc-screen i{font-style:normal;font-size:15px;font-weight:400;color:var(--dim,#93a0b5);text-shadow:none}',
    '.msc-compose{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#0e131b;border:1px dashed var(--line,#2c3649);border-radius:8px;padding:6px 10px;min-height:40px;font-size:18px}',
    '.msc-compose b{overflow-wrap:anywhere;min-width:0}',
    '.msc-compose i{font-style:normal;font-weight:400;font-size:.85em;color:var(--dim,#93a0b5)}',
    '.msc-compose span{flex:none;color:var(--dim,#93a0b5);font-size:.8em;font-variant-numeric:tabular-nums}',
    '.msc-compose.msc-full span{color:var(--warn,#ffc857)}',
    '.msc-bar{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;align-items:center}',
    '.msc-row{display:flex;flex-wrap:wrap;gap:3px;margin:4px 0;align-items:center}',
    '.msc-row.msc-asked{outline:1px solid var(--warn,#ffc857);outline-offset:2px;border-radius:8px}',
    '.msc-truth{font-weight:700;margin:0 4px}',
    '.msc-memo{color:var(--dim,#93a0b5);font-size:.82em}',
    '.msc-g{display:grid;grid-template-columns:4.6em minmax(0,1fr);gap:2px 6px;align-items:start;margin:4px 0}',
    '.msc-g>span{color:var(--dim,#93a0b5);font-size:.8em;padding-top:5px}',
    '.msc-g .msc-row{margin:0}',
    '.msc-b{font:inherit;font-size:13px;line-height:1.3;color:var(--fg,#e8ecf3);background:#2a3a55;border:1px solid #3d5278;border-radius:8px;padding:4px 9px;margin:0;cursor:pointer;touch-action:manipulation}',
    '.msc-b:hover:not(:disabled){background:#35496b}',
    '.msc-b:disabled{opacity:.4;cursor:not-allowed}',
    '.msc-b.msc-go{background:#1f6b45;border-color:#2f9461}',
    '.msc-b.msc-go:hover:not(:disabled){background:#268253}',
    '.msc-b.msc-lab{background:#3a3152;border-color:#5b4d85}',
    '.msc-b.msc-send{font-size:15px;padding:6px 14px;margin-left:auto}',
    '.msc-cool{color:var(--dim,#93a0b5);font-size:.85em}',
    '.msc-hist{color:var(--dim,#93a0b5);font-size:.85em;margin:0 0 4px;overflow-wrap:anywhere}',
    '.msc-hist b{color:var(--fg,#e8ecf3);font-weight:400}',
    '.msc-note{color:var(--dim,#93a0b5);font-size:.85em;margin:8px 0 0}'
  ].join('\n');

  var root = null, api = null, wrap = null, timer = null;
  var st = null;        // 最新的主機狀態
  var draft = [];       // 目前組到一半的詞
  var hist = [];        // 這位旅客已經送上螢幕過的句子（主機確認後才記）
  var lastScreen = '';
  var lastSig = '';     // 上次畫面的指紋：一樣就不重畫
  var fieldSig = '';    // 這位旅客選項的指紋：變了代表換人，草稿裡失效的詞要丟掉
  var deadline = 0, askTotal = 1;   // 點題倒數（本機時間），只更新數字、不重畫

  function esc(s) {
    return api && api.esc ? api.esc(s) : String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function len(s) { return Array.from(String(s)).length; }
  function sideName(side) { return side < 0 ? '' : side ? '（右螢幕）' : '（左螢幕）'; }
  function vocab(s) { return s.groups || [{ label: '', words: s.words || [] }]; }

  // 主機接受的詞：詞庫、欄位名稱、這位旅客各欄位的選項
  function allowed(s) {
    var ok = {};
    vocab(s).forEach(function (g) { (g.words || []).forEach(function (w) { ok[String(w)] = 1; }); });
    (s.fields || []).forEach(function (f) {
      ok[String(f.label)] = 1;
      (f.opts || []).forEach(function (o) { ok[String(o.v)] = 1; });
    });
    return ok;
  }
  function askOpen() { return !!(st && st.ask && st.ask.ms > 0); }
  function canSend() {
    if (!st || !draft.length || st.cooling) return false;
    return st.ask === undefined || (askOpen() && !st.ask.sent);
  }

  function tok(label, t, cls, used, max) {
    var over = used + len(t) > max;
    return '<button type="button" class="msc-b' + (cls || '') + '" data-t="' + esc(t) + '"' + (over ? ' disabled' : '') + '>' + label + '</button>';
  }

  function tick() {
    if (!wrap) return;
    var cd = wrap.querySelector('.msc-cd'), bar = wrap.querySelector('.msc-cdbar');
    if (!cd) return;
    var left = Math.max(0, deadline - performance.now());
    cd.textContent = Math.ceil(left / 1000) + ' 秒';
    if (bar) bar.style.width = Math.min(100, left / askTotal * 100) + '%';
  }

  function render() {
    if (!wrap || !st) return;
    var max = st.max || 12, cur = draft.join(''), used = len(cur), a = st.ask, open = askOpen();
    // 倒數的毫秒每次都不一樣，不能算進指紋，否則每次 update 都重畫、按鈕會點不到
    var sig = JSON.stringify([st, draft, hist], function (k, v) { return k === 'ms' ? v > 0 : v; });
    if (sig === lastSig) return;
    lastSig = sig;
    var h = '';
    if (a !== undefined) {
      if (!a) h += '<div class="msc-ask"><span>🎤 等海關點題…可以先把句子組好</span></div>';
      else if (open) h += '<div class="msc-ask msc-open"><span>🎤 海關在問 <b>' + esc(a.label) + '</b>　第 ' + a.n + '/' + a.of + ' 題' + (a.sent ? '・這題你送過了' : '') + '</span><span class="msc-cd"></span><div class="msc-cdbar"></div></div>';
      else h += '<div class="msc-ask"><span>⏱ 「' + esc(a.label) + '」時間到（第 ' + a.n + '/' + a.of + ' 題），等海關問下一題</span></div>';
    }
    h += '<div class="msc-h"><span>📺 你的螢幕' + sideName(st.side) + '</span></div>';
    h += '<div class="msc-screen">' + (st.myScreen ? esc(st.myScreen) : '<i>（空白）</i>') + '</div>';
    h += '<div class="msc-bar"><button type="button" class="msc-b" data-act="wipe"' + (st.myScreen ? '' : ' disabled') + '>清空螢幕</button>' +
      (st.cooling ? '<span class="msc-cool">切換冷卻中…</span>' : '') + '</div>';
    if (hist.length) h += '<p class="msc-hist">這位旅客你已送過 ' + hist.length + ' 句：' + hist.map(function (t) { return '<b>' + esc(t) + '</b>'; }).join('、') + '</p>';
    h += '<div class="msc-h"><span>組一句話</span><small>最多 ' + max + ' 個字</small></div>';
    h += '<div class="msc-compose' + (used >= max ? ' msc-full' : '') + '"><b>' + (used ? esc(cur) : '<i>點下面的詞來組合…</i>') + '</b><span>' + used + '/' + max + '</span></div>';
    var sendLabel = st.cooling ? '冷卻中…' : a === undefined || (open && !a.sent) ? '📺 送上螢幕' : open ? '這題已送出' : '等海關點題…';
    h += '<div class="msc-bar">' +
      '<button type="button" class="msc-b" data-act="del"' + (used ? '' : ' disabled') + '>⌫ 退一格</button>' +
      '<button type="button" class="msc-b" data-act="clear"' + (used ? '' : ' disabled') + '>清除</button>' +
      '<button type="button" class="msc-b msc-go msc-send" data-act="send"' + (canSend() ? '' : ' disabled') + '>' + sendLabel + '</button></div>';
    var fields = st.fields || [], hasOpts = fields.some(function (f) { return f.opts; });
    h += '<div class="msc-h"><span>這位旅客的資料</span><small>' + (hasOpts ? '✓＝資料上的答案，其他是假的' : '答案只能看、不能直接送，用下面的詞繞著講') + '</small></div>';
    fields.forEach(function (f) {
      h += '<div class="msc-row' + (a && a.k === f.k ? ' msc-asked' : '') + '">' + tok(esc(f.label), f.label, ' msc-lab', used, max);
      if (f.opts) h += f.opts.map(function (o) { return tok((o.t ? '✓ ' : '') + esc(o.v), o.v, o.t ? ' msc-go' : '', used, max); }).join('');
      else h += '<span class="msc-truth">' + esc(f.truth) + '</span>' + (f.memo ? '<span class="msc-memo">回憶錄若記不清會寫：「' + esc(f.memo) + '」</span>' : '');
      h += '</div>';
    });
    var groups = vocab(st);
    h += '<div class="msc-h"><span>' + (st.groups ? '可以用的詞' : '通用詞') + '</span></div>';
    groups.forEach(function (g) {
      var row = '<div class="msc-row">' + (g.words || []).map(function (w) { return tok(esc(w), w, '', used, max); }).join('') + '</div>';
      h += g.label ? '<div class="msc-g"><span>' + esc(g.label) + '</span>' + row + '</div>' : row;
    });
    h += '<p class="msc-note">螢幕會一直顯示到你換掉或清空，換下一位旅客時自動清空。櫃台前的旅客看得到兩個螢幕；<b>另一位後台看不到你的螢幕，你也看不到他的</b>；海關要回頭才看得到（已回頭 ' + (st.looks || 0) + ' 次）。</p>';
    wrap.innerHTML = h;
    tick();
  }

  function onClick(e) {
    var b = e.target && e.target.closest ? e.target.closest('button.msc-b') : null;
    if (!b || b.disabled || !st || !api) return;
    var act = b.getAttribute('data-act'), t = b.getAttribute('data-t');
    if (t != null) {
      if (len(draft.join('') + t) > (st.max || 12)) return;
      draft.push(t); api.play('tick');
    } else if (act === 'del') { draft.pop(); api.play('tick'); }
    else if (act === 'clear') { draft = []; api.play('sweep'); }
    else if (act === 'wipe') { api.send({ a: 'screen', clear: 1 }); api.play('sweep'); }
    else if (act === 'send') {
      if (!canSend()) return;
      api.send({ a: 'screen', t: draft.slice() }); api.play('pop');
      draft = [];
    }
    render();
  }

  window.Mini = window.Mini || {};
  window.Mini.screen = {
    mount: function (r, a) {
      if (root) this.unmount();
      root = r; api = a;
      if (!document.getElementById(STYLE_ID)) {
        var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
      }
      wrap = document.createElement('div'); wrap.className = 'msc-wrap';
      root.appendChild(wrap);
      root.addEventListener('click', onClick);
      timer = setInterval(tick, 100);
      draft = []; hist = []; lastScreen = ''; lastSig = ''; fieldSig = ''; st = null; deadline = 0;
    },
    update: function (state) {
      if (!root || !state) return;
      var prev = st && st.ask;
      st = state;
      var fs = JSON.stringify([state.fields, state.groups || state.words]);
      if (fs !== fieldSig) {
        fieldSig = fs;
        var ok = allowed(state);
        draft = draft.filter(function (t) { return ok[t]; });
        hist = []; lastScreen = '';
      }
      var scr = state.myScreen || '';
      if (scr !== lastScreen) { lastScreen = scr; if (scr) hist.push(scr); }
      var a = state.ask;
      if (a && a.ms > 0) {
        var d = performance.now() + a.ms;
        if (Math.abs(d - deadline) > 400) deadline = d;
        if (!prev || prev.n !== a.n || !(prev.ms > 0)) { askTotal = a.total || a.ms; api.play('beep'); }
      }
      render();
    },
    unmount: function () {
      if (timer) clearInterval(timer);
      if (root) root.removeEventListener('click', onClick);
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      var s = document.getElementById(STYLE_ID); if (s && s.parentNode) s.parentNode.removeChild(s);
      root = api = wrap = st = timer = null; draft = []; hist = []; lastScreen = ''; lastSig = ''; fieldSig = '';
    }
  };
})();
