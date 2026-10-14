// 後台發送暗號小遊戲模組：window.Mini.screen = { mount, update, unmount }
// 後台用定型的詞組一句話送上自己的螢幕。草稿只存在這個模組裡，送出後由主機驗證。
//
// state（合約第 5 節，加上試玩版本用的選填欄位，細節見 NOTES_screen.md）：
//   fields[].opts    有：答案版，每欄四個可送出的選項
//   fields[].truth   有：特徵詞版，答案只能看不能送（memo＝這個答案在回憶錄裡的模糊說法）
//   fields[].tiers   有：線索三層 [{n:1|2|3, opts:[{v,t}] 或 note:'說明'}]，n 大於 tier.lvl 的鎖住（看得到、按不了）
//   groups           有：分組的詞庫 [{label, words, tier?}]（tier＝這一組算第幾層，沒寫＝通用詞）；沒有就用 words
//   tier             有：線索解鎖 {mode:'A'|'B'|'C', lvl, byQ, see, peeks, next:{n,ms}, cd:{n,ms}, cdSec:[第一層,第二層,第三層]}
//   ask              undefined：隨時可送（有冷卻）；null：等海關點題；
//                    {k,label,ms,n,of,sent}：海關正在問第 n/of 題，剩 ms 毫秒，sent＝這題我送過了
(function () {
  'use strict';

  var STYLE_ID = 'msc-style';
  var CN = ['', '一', '二', '三'], CIRC = ['', '①', '②', '③'];

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
    '.msc-tbar{border-color:#3d5278;color:var(--fg,#e8ecf3)}',
    '.msc-tbar b{color:var(--warn,#ffc857);font-variant-numeric:tabular-nums}',
    '.msc-td{display:inline-block;margin-left:4px;color:var(--dim,#93a0b5)}',
    '.msc-td.msc-on{color:var(--good,#55d38a);font-weight:700}',
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
    '.msc-row.msc-asked,.msc-fld.msc-asked{outline:1px solid var(--warn,#ffc857);outline-offset:2px;border-radius:8px}',
    '.msc-fld{margin:6px 0 8px;padding-bottom:4px;border-bottom:1px solid rgba(44,54,73,.6)}',
    '.msc-fld .msc-row{margin:2px 0}',
    '.msc-tier{padding-left:1.1em}',
    '.msc-tn{flex:none;min-width:2.4em;color:var(--good,#55d38a);font-size:.85em;font-weight:700}',
    '.msc-locked .msc-tn{color:var(--dim,#93a0b5);font-weight:400}',
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
    '.msc-b.msc-lock{border-style:dashed}',
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
  var nextEnd = 0, cdEnd = 0;       // 線索解鎖倒數、送完的冷卻（本機時間）

  function esc(s) {
    return api && api.esc ? api.esc(s) : String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function len(s) { return Array.from(String(s)).length; }
  function sideName(side) { return side < 0 ? '' : side ? '（右螢幕）' : '（左螢幕）'; }
  function vocab(s) { return s.groups || [{ label: '', words: s.words || [] }]; }
  function lvl() { return st && st.tier ? st.tier.lvl : 3; }   // 沒有線索分層＝全部可用

  // 每個詞算第幾層（0＝通用詞、欄位名稱）；主機接受的詞＝這張表裡有的
  function tierMap(s) {
    var m = {}, put = function (w, n) { w = String(w); if (!(w in m)) m[w] = n; };
    (s.fields || []).forEach(function (f) { put(f.label, 0); });
    vocab(s).forEach(function (g) { (g.words || []).forEach(function (w) { put(w, g.tier || 0); }); });
    (s.fields || []).forEach(function (f) {
      (f.tiers || []).forEach(function (tr) { (tr.opts || []).forEach(function (o) { put(o.v, tr.n); }); });
      (f.opts || []).forEach(function (o) { put(o.v, f.tiers ? 3 : 0); });
    });
    return m;
  }
  function askOpen() { return !!(st && st.ask && st.ask.ms > 0); }
  function canSend() {
    if (!st || !draft.length || st.cooling) return false;
    var tm = tierMap(st), L = lvl();
    if (!draft.every(function (t) { return (tm[t] || 0) <= L; })) return false;
    return st.ask === undefined || (askOpen() && !st.ask.sent);
  }

  function tok(label, t, cls, used, max, lock) {
    var over = used + len(t) > max;
    return '<button type="button" class="msc-b' + (cls || '') + (lock ? ' msc-lock' : '') + '" data-t="' + esc(t) + '"' +
      (over || lock ? ' disabled' : '') + (lock ? ' title="還沒解鎖"' : '') + '>' + label + '</button>';
  }

  // 線索解鎖的狀態列：可以送到第幾層、下一層什麼時候開、冷卻還剩多久
  function tierBar(t) {
    var dots = [1, 2, 3].map(function (n) { return '<span class="msc-td' + (n <= t.lvl ? ' msc-on' : '') + '">' + CIRC[n] + (n <= t.lvl ? '' : '🔒') + '</span>'; }).join('');
    var cs = t.cdSec || [3, 8, 15], s;
    if (t.mode === 'A' && t.byQ) s = '以題號解鎖：第 1 題送第一層、第 2 題開到第二層、第 3 題開到第三層';
    else if (t.mode === 'A') s = t.next ? '第' + CN[t.next.n] + '層 <b class="msc-tnx"></b> 秒後解鎖' : '三層全開';
    else if (t.mode === 'B') s = t.cd ? '⏳ 冷卻中 <b class="msc-tcd"></b> 秒（剛送了第' + CN[t.cd.n] + '層）' : '隨時可送，句子裡最細的詞決定冷卻：①' + cs[0] + ' 秒 ②' + cs[1] + ' 秒 ③' + cs[2] + ' 秒';
    else s = '旅客抬頭看得到第' + CN[t.see || 1] + '層（這位已抬頭 ' + (t.peeks || 0) + ' 次）：比這細的詞他會看到 🔒';
    return '<div class="msc-ask msc-tbar"><span>🔓 可送到第' + CN[t.lvl] + '層' + dots + '</span><span>' + s + '</span></div>';
  }

  function tick() {
    if (!wrap) return;
    var now = performance.now();
    var nx = wrap.querySelector('.msc-tnx'), tc = wrap.querySelector('.msc-tcd');
    if (nx) nx.textContent = Math.ceil(Math.max(0, nextEnd - now) / 1000);
    if (tc) tc.textContent = Math.ceil(Math.max(0, cdEnd - now) / 1000);
    var cd = wrap.querySelector('.msc-cd'), bar = wrap.querySelector('.msc-cdbar');
    if (!cd) return;
    var left = Math.max(0, deadline - now);
    cd.textContent = Math.ceil(left / 1000) + ' 秒';
    if (bar) bar.style.width = Math.min(100, left / askTotal * 100) + '%';
  }

  function render() {
    if (!wrap || !st) return;
    var max = st.max || 12, cur = draft.join(''), used = len(cur), a = st.ask, open = askOpen(), t = st.tier, L = lvl();
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
    if (t) h += tierBar(t);
    h += '<div class="msc-h"><span>📺 你的螢幕' + sideName(st.side) + '</span></div>';
    h += '<div class="msc-screen">' + (st.myScreen ? esc(st.myScreen) : '<i>（空白）</i>') + '</div>';
    h += '<div class="msc-bar"><button type="button" class="msc-b" data-act="wipe"' + (st.myScreen ? '' : ' disabled') + '>清空螢幕</button>' +
      (st.cooling && !(t && t.cd) ? '<span class="msc-cool">切換冷卻中…</span>' : '') + '</div>';
    if (hist.length) h += '<p class="msc-hist">這位旅客你已送過 ' + hist.length + ' 句：' + hist.map(function (x) { return '<b>' + esc(x) + '</b>'; }).join('、') + '</p>';
    h += '<div class="msc-h"><span>組一句話</span><small>最多 ' + max + ' 個字</small></div>';
    h += '<div class="msc-compose' + (used >= max ? ' msc-full' : '') + '"><b>' + (used ? esc(cur) : '<i>點下面的詞來組合…</i>') + '</b><span>' + used + '/' + max + '</span></div>';
    var sendLabel = st.cooling ? '冷卻中…' : a === undefined || (open && !a.sent) ? '📺 送上螢幕' : open ? '這題已送出' : '等海關點題…';
    h += '<div class="msc-bar">' +
      '<button type="button" class="msc-b" data-act="del"' + (used ? '' : ' disabled') + '>⌫ 退一格</button>' +
      '<button type="button" class="msc-b" data-act="clear"' + (used ? '' : ' disabled') + '>清除</button>' +
      '<button type="button" class="msc-b msc-go msc-send" data-act="send"' + (canSend() ? '' : ' disabled') + '>' + sendLabel + '</button></div>';
    var fields = st.fields || [], hasOpts = fields.some(function (f) { return f.opts; }), tiered = fields.some(function (f) { return f.tiers; });
    h += '<div class="msc-h"><span>這位旅客的資料</span><small>' + (tiered ? '①最模糊（跟回憶錄差不多）→ ③最細；🔒＝還沒解鎖・' : '') + (hasOpts ? '✓＝資料上的答案，其他是假的' : '答案只能看、不能直接送，用下面的詞繞著講') + '</small></div>';
    fields.forEach(function (f) {
      var asked = a && a.k === f.k;
      if (f.tiers) {
        h += '<div class="msc-fld' + (asked ? ' msc-asked' : '') + '"><div class="msc-row">' + tok(esc(f.label), f.label, ' msc-lab', used, max);
        if (f.truth) h += '<span class="msc-truth">' + esc(f.truth) + '</span>' + (f.memo ? '<span class="msc-memo">回憶錄若記不清會寫：「' + esc(f.memo) + '」</span>' : '');
        h += '</div>';
        f.tiers.forEach(function (tr) {
          var lk = tr.n > L;
          h += '<div class="msc-row msc-tier' + (lk ? ' msc-locked' : '') + '"><span class="msc-tn">' + CIRC[tr.n] + (lk ? '🔒' : '') + '</span>' +
            (tr.opts ? tr.opts.map(function (o) { return tok((o.t ? '✓ ' : '') + esc(o.v), o.v, o.t ? ' msc-go' : '', used, max, lk); }).join('') : '<span class="msc-memo">' + esc(tr.note || '') + '</span>') + '</div>';
        });
        h += '</div>';
        return;
      }
      h += '<div class="msc-row' + (asked ? ' msc-asked' : '') + '">' + tok(esc(f.label), f.label, ' msc-lab', used, max);
      if (f.opts) h += f.opts.map(function (o) { return tok((o.t ? '✓ ' : '') + esc(o.v), o.v, o.t ? ' msc-go' : '', used, max); }).join('');
      else h += '<span class="msc-truth">' + esc(f.truth) + '</span>' + (f.memo ? '<span class="msc-memo">回憶錄若記不清會寫：「' + esc(f.memo) + '」</span>' : '');
      h += '</div>';
    });
    var groups = vocab(st);
    h += '<div class="msc-h"><span>' + (st.groups ? '可以用的詞' : '通用詞') + '</span>' + (st.groups && t ? '<small>標 ③ 的是第三層的特徵詞</small>' : '') + '</div>';
    groups.forEach(function (g) {
      var lk = (g.tier || 0) > L;
      var row = '<div class="msc-row">' + (g.words || []).map(function (w) { return tok(esc(w), w, '', used, max, lk); }).join('') + '</div>';
      var lab = (g.tier && t ? CIRC[g.tier] + (lk ? '🔒' : '') + ' ' : '') + esc(g.label || '');
      h += g.label ? '<div class="msc-g"><span>' + lab + '</span>' + row + '</div>' : row;
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
      if ((tierMap(st)[t] || 0) > lvl()) return;
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

  // 收到新的倒數毫秒：換算成本機截止時間，差太多才重設（避免數字跳來跳去）
  function sync(end, o) {
    if (!o || !(o.ms > 0)) return 0;
    var d = performance.now() + o.ms;
    return Math.abs(d - end) > 400 ? d : end;
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
      draft = []; hist = []; lastScreen = ''; lastSig = ''; fieldSig = ''; st = null; deadline = 0; nextEnd = cdEnd = 0;
    },
    update: function (state) {
      if (!root || !state) return;
      var prev = st && st.ask;
      st = state;
      var fs = JSON.stringify([state.fields, state.groups || state.words]);
      if (fs !== fieldSig) {
        fieldSig = fs;
        var ok = tierMap(state);
        draft = draft.filter(function (t) { return t in ok; });
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
      var t = state.tier;
      nextEnd = sync(nextEnd, t && t.next); cdEnd = sync(cdEnd, t && t.cd);
      render();
    },
    unmount: function () {
      if (timer) clearInterval(timer);
      if (root) root.removeEventListener('click', onClick);
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      var s = document.getElementById(STYLE_ID); if (s && s.parentNode) s.parentNode.removeChild(s);
      root = api = wrap = st = timer = null; draft = []; hist = []; lastScreen = ''; lastSig = ''; fieldSig = ''; nextEnd = cdEnd = 0;
    }
  };
})();
