// 換裝小遊戲模組：window.Mini.deco = { mount, update, unmount, figure }
// 純娛樂的打扮，不影響任何判定：背景色、小配件，加上用畫筆在皮膚上塗鴉。
// 圖層規則：塗鴉是平的，只留在皮膚上（臉、脖子、手臂）；
//           眉眼口鼻、特徵、鬍子、眼鏡、頭髮、帽子、衣服一律畫在塗鴉上面，所以塗鴉蓋不掉任何特徵。
(function () {
  'use strict';

  var STYLE_ID = 'mdc-style';
  var VB = { x: -14, y: 0, w: 128, h: 160 };   // 半身像的畫布；臉的部分和 core.js face() 的 100x120 座標相同
  var SKIN = '#f3c9a0';
  var PANTS = '#3a4660';
  // 和 core.js face() 相同的上衣底色（袖子要用）
  var CLOTH = { '白襯衫': '#f6f6f6', '花襯衫': '#19a7a0', '黑色帽T': '#2a2a2e', '西裝': '#1f2f55', '條紋衫': '#ffffff', '皮夾克': '#6b3e1e' };
  // face() 的輸出從這一段開始是「臉上的東西」：在它前面插入塗鴉層
  var SPLIT = '<path d="M34,44 L46,43';
  var FACE_CLIP = 'M24,84 L24,42 A26,26 0 0 1 76,42 L76,84Z';
  var ARMS = [{ x: 2, y: 86, w: 20, h: 62 }, { x: 78, y: 86, w: 20, h: 62 }];

  var PALETTE = ['#111111', '#ffffff', '#8a5a2b', '#e03131', '#f76707', '#ffd43b', '#37b24d', '#1098ad', '#1c7ed6', '#7048e8', '#e64980', '#868e96'];
  var WIDTHS = [1.5, 3, 6];
  var MAX_STROKES = 80;     // 主機沒給 maxStrokes 時的預設
  var MAX_PTS = 120;        // 一筆最多幾個點，超過自動接下一筆
  var MIN_STEP = 1;         // 兩個點至少相隔多遠（畫布單位）
  var PENDING_MS = 2000;    // 送出的筆畫最多先顯示這麼久，主機沒承認就消失
  var MSG_MS = 2600;
  var COLOR_RE = /^#[0-9a-f]{6}$/i;

  var CSS = [
    '.mdc-wrap{container-type:inline-size;container-name:mdc;color:var(--fg,#e8ecf3);-webkit-tap-highlight-color:transparent}',
    '.mdc-wrap *{box-sizing:border-box}',
    '.mdc-title{font-weight:700;font-size:1.05em}',
    '.mdc-hint{color:var(--dim,#93a0b5);font-size:.85em;margin:2px 0 10px}',
    '.mdc-grid{display:grid;grid-template-columns:minmax(200px,340px) minmax(0,1fr);gap:14px;align-items:start}',
    '.mdc-stagebox{padding:8px;border:1px solid var(--line,#2c3649);border-radius:12px;background:var(--card,#1a2130)}',
    '.mdc-stage{touch-action:none;cursor:crosshair;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    '.mdc-stage svg{display:block;width:100%;height:auto;border-radius:8px}',
    '.mdc-ro .mdc-stage{cursor:default}',
    '.mdc-name{font-weight:700;text-align:center;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mdc-side{display:flex;flex-direction:column;gap:6px;min-width:0}',
    '.mdc-h{font-size:.85em;color:var(--dim,#93a0b5);margin-top:4px}',
    '.mdc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.mdc-sw,.mdc-pen{width:32px;height:32px;padding:0;border-radius:50%;border:2px solid var(--line,#2c3649);cursor:pointer}',
    '.mdc-sw.mdc-on,.mdc-pen.mdc-on{border-color:var(--warn,#ffc857);box-shadow:0 0 0 2px var(--warn,#ffc857)}',
    '.mdc-pick{width:38px;height:32px;padding:0;border:2px solid var(--line,#2c3649);border-radius:8px;background:none;cursor:pointer}',
    '.mdc-pick.mdc-on{border-color:var(--warn,#ffc857);box-shadow:0 0 0 2px var(--warn,#ffc857)}',
    '.mdc-wd{width:38px;height:32px;padding:0;border-radius:8px;border:2px solid var(--line,#2c3649);background:var(--card,#1a2130);cursor:pointer;display:grid;place-items:center}',
    '.mdc-wd i{display:block;border-radius:50%;background:var(--fg,#e8ecf3)}',
    '.mdc-wd.mdc-on{border-color:var(--warn,#ffc857)}',
    '.mdc-btn,.mdc-acc{font:inherit;font-size:.9em;padding:6px 12px;border-radius:999px;border:1px solid var(--line,#2c3649);background:var(--card,#1a2130);color:var(--fg,#e8ecf3);cursor:pointer}',
    '.mdc-acc.mdc-on{border-color:var(--good,#55d38a);background:rgba(85,211,138,.16)}',
    '.mdc-wrap button:disabled,.mdc-wrap input:disabled{cursor:default;opacity:.45}',
    '.mdc-count{color:var(--dim,#93a0b5);font-size:.8em;font-variant-numeric:tabular-nums}',
    '.mdc-msg{color:var(--warn,#ffc857);font-size:.85em;min-height:1.3em}',
    '.mdc-prev{display:flex;gap:10px;align-items:center;padding:8px;border:1px solid var(--line,#2c3649);border-radius:10px;background:var(--card,#1a2130);margin-top:4px}',
    '.mdc-prev svg{display:block;flex:none;border-radius:6px}',
    '.mdc-prev small{color:var(--dim,#93a0b5);font-size:.8em;line-height:1.4}',
    '.mdc-lock{display:none;color:var(--dim,#93a0b5);font-size:.8em}',
    '.mdc-ro .mdc-lock{display:block}',
    '@container mdc (max-width:520px){.mdc-grid{grid-template-columns:1fr}.mdc-stagebox{max-width:300px;width:100%;justify-self:center}}'
  ].join('\n');

  var root = null, api = null, wrap = null;
  var elStage, elName, elPens, elWidths, elPick, elUndo, elClear, elCount, elMsg, elBgs, elAccs, elPrev;
  var gStrokes = null, gLive = null;
  var sigFig = '', sigStrokes = '', sigOpts = '', sigSel = '', sigName = '';
  var last = null;            // 最近一次的 state
  var penColor = PALETTE[3], penWidth = WIDTHS[1];
  var cur = null;             // 正在畫的那一筆 {c,w,p,id}
  var pending = [];           // 已送出、主機還沒承認的筆畫 [{s,key,until}]
  var pendT = 0, msgT = 0, clipN = 0;

  function escFn(s) { return api && api.esc ? api.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r1(v) { return Math.round(v * 10) / 10; }

  function strokeSvg(s) {
    var p = s && s.p;
    if (!p || p.length < 2) return '';
    var d = 'M' + (+p[0]) + ',' + (+p[1]);
    if (p.length < 4) d += 'l0.01,0';
    for (var i = 2; i + 1 < p.length; i += 2) d += 'L' + (+p[i]) + ',' + (+p[i + 1]);
    return '<path d="' + d + '" stroke="' + (COLOR_RE.test(s.c) ? s.c : '#e03131') + '" stroke-width="' + (+s.w || 3) + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  // 畫出帶塗鴉的膠囊人。o.full：半身像（有手臂）；否則是和 face() 一樣的 100x120 大頭照。
  // o.size：寬度 px（不給就由 CSS 決定）。回傳 SVG 字串。
  function hashStr(t) { var h = 5381; for (var k = 0; k < t.length; k++) h = ((h << 5) + h + t.charCodeAt(k)) | 0; return (h >>> 0).toString(36); }
  function figure(looks, deco, o) {
    o = o || {};
    deco = deco || {};
    var faceFn = (api && api.face) || window.face;
    var raw = faceFn(looks, 100, undefined, { bg: deco.bg, acc: deco.acc });
    var inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    var bgm = /^<rect width="100" height="120"[^>]*fill="([^"]*)"[^>]*\/>/.exec(inner);
    var bg = bgm ? bgm[1] : '#cfd8e6';
    if (bgm) inner = inner.slice(bgm[0].length);
    var cut = inner.indexOf(SPLIT);
    var pre = cut < 0 ? inner : inner.slice(0, cut), post = cut < 0 ? '' : inner.slice(cut);
    var strokes = (deco.strokes || []).map(strokeSvg).join('');
    var cloth = CLOTH[looks && looks['上衣']] || '#f6f6f6';
    // 剪裁編號用內容算出來：同一張圖每次畫出來都一樣，主頁才不會以為畫面變了而整頁重畫（會讓動畫一直重播）
    var id = 'mdc-clip-' + hashStr(inner + '|' + strokes + '|' + cloth);
    var out = [];
    var clip = '<path d="' + FACE_CLIP + '"/>';
    if (o.full) {
      ARMS.forEach(function (a) { clip += '<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" rx="10"/>'; });
      out.push('<svg class="mdc-fig" viewBox="' + VB.x + ' ' + VB.y + ' ' + VB.w + ' ' + VB.h + '"' + (o.size ? ' width="' + o.size + '" height="' + Math.round(o.size * VB.h / VB.w) + '"' : '') + ' xmlns="http://www.w3.org/2000/svg">');
      out.push('<defs><clipPath id="' + id + '">' + clip + '</clipPath></defs>');
      out.push('<rect x="' + VB.x + '" y="' + VB.y + '" width="' + VB.w + '" height="' + VB.h + '" rx="10" fill="' + bg + '"/>');
      out.push(pre);
      out.push('<rect x="24" y="124" width="52" height="40" fill="' + PANTS + '"/><path d="M50,136 L50,160" stroke="#2a3348" stroke-width="2"/>');
      ARMS.forEach(function (a) { out.push('<rect x="' + a.x + '" y="' + a.y + '" width="' + a.w + '" height="' + a.h + '" rx="10" fill="' + SKIN + '"/>'); });
    } else {
      var size = o.size || 88;
      out.push('<svg class="face" width="' + size + '" height="' + Math.round(size * 1.2) + '" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">');
      out.push('<defs><clipPath id="' + id + '">' + clip + '</clipPath></defs>');
      out.push('<rect width="100" height="120" rx="10" fill="' + bg + '"/>');
      out.push(pre);
    }
    // 塗鴉層：只留在皮膚上
    out.push('<g clip-path="url(#' + id + ')"><g class="mdc-strokes">' + strokes + '</g><g class="mdc-live"></g></g>');
    if (o.full) {
      // 短袖蓋在手臂塗鴉上面
      ARMS.forEach(function (a) { out.push('<rect x="' + (a.x - 1) + '" y="84" width="' + (a.w + 3) + '" height="20" rx="8" fill="' + cloth + '" stroke="rgba(0,0,0,.22)" stroke-width="1"/>'); });
    }
    out.push(post);
    out.push('</svg>');
    return out.join('');
  }

  function inSkin(x, y) {
    if (x >= 24 && x <= 76 && y >= 16 && y <= 84) return true;
    for (var i = 0; i < ARMS.length; i++) { var a = ARMS[i]; if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return true; }
    return false;
  }
  function touchesSkin(p) { for (var i = 0; i + 1 < p.length; i += 2) if (inSkin(p[i], p[i + 1])) return true; return false; }
  function skey(s) { return s.c + '|' + s.w + '|' + s.p.join(','); }

  function say(t) {
    if (!elMsg) return;
    elMsg.textContent = t;
    clearTimeout(msgT);
    msgT = setTimeout(function () { if (elMsg) elMsg.textContent = ''; }, MSG_MS);
  }

  function allStrokes() {
    var a = (last && last.deco && last.deco.strokes) || [];
    return pending.length ? a.concat(pending.map(function (q) { return q.s; })) : a;
  }
  function maxStrokes() { return (last && last.maxStrokes) || MAX_STROKES; }

  function drawStrokes() {
    var all = allStrokes();
    if (gStrokes) gStrokes.innerHTML = all.map(strokeSvg).join('');
    if (elPrev && last && last.looks) {
      elPrev.innerHTML = figure(last.looks, { bg: last.deco.bg, acc: last.deco.acc, strokes: all }, { size: 60 }) +
        '<small>護照照片上別人看到的樣子。<br>特徵都還在，塗鴉蓋不掉。</small>';
    }
    var n = all.length, ed = !!(last && last.editable);
    if (elCount) elCount.textContent = '筆畫 ' + n + ' / ' + maxStrokes();
    if (elUndo) elUndo.disabled = !ed || !n;
    if (elClear) elClear.disabled = !ed || !n;
  }
  function drawLive() { if (gLive) gLive.innerHTML = cur ? strokeSvg(cur) : ''; }

  function prunePending() {
    clearTimeout(pendT);
    var now = Date.now(), have = {};
    ((last && last.deco && last.deco.strokes) || []).forEach(function (s) { have[skey(s)] = 1; });
    pending = pending.filter(function (q) { return q.until > now && !have[q.key]; });
    if (pending.length) pendT = setTimeout(function () { prunePending(); drawStrokes(); }, PENDING_MS);
  }

  // ── 畫筆 ──
  function toVB(e) {
    var svg = elStage && elStage.firstChild;
    if (!svg || !svg.getBoundingClientRect) return null;
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;   // root 被拔掉的瞬間
    return [r1(VB.x + (e.clientX - r.left) / r.width * VB.w), r1(VB.y + (e.clientY - r.top) / r.height * VB.h)];
  }
  function commit() {
    if (!cur) return;
    var s = { c: cur.c, w: cur.w, p: cur.p };
    if (!touchesSkin(s.p)) { say('只能畫在皮膚上喔：臉、脖子、手臂。'); return; }
    if (allStrokes().length >= maxStrokes()) { say('塗鴉滿了，先復原或清除幾筆。'); return; }
    pending.push({ s: s, key: skey(s), until: Date.now() + PENDING_MS });
    prunePending();
    api.send({ a: 'deco', k: 'stroke', v: s });   // 主機驗證後從下一次 update 回來
    drawStrokes();
  }
  function stopDraw() {
    cur = null;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    drawLive();
  }
  function onDown(e) {
    if (cur || !last || !last.editable || (e.button && e.button > 0)) return;
    var pt = toVB(e);
    if (!pt) return;
    e.preventDefault();
    cur = { c: penColor, w: penWidth, p: [pt[0], pt[1]], id: e.pointerId };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    drawLive();
  }
  function onMove(e) {
    if (!cur || e.pointerId !== cur.id) return;
    var pt = toVB(e);
    if (!pt) return;
    var p = cur.p, dx = pt[0] - p[p.length - 2], dy = pt[1] - p[p.length - 1];
    if (dx * dx + dy * dy < MIN_STEP * MIN_STEP) return;
    p.push(pt[0], pt[1]);
    if (p.length >= MAX_PTS * 2) {   // 太長：先送出這一段，從同一個點接著畫
      var id = cur.id;
      commit();
      cur = { c: penColor, w: penWidth, p: [pt[0], pt[1]], id: id };
    }
    drawLive();
  }
  function onUp(e) {
    if (!cur || e.pointerId !== cur.id) return;
    commit();
    stopDraw();
  }

  function syncTools() {
    if (!wrap) return;
    var ed = !!(last && last.editable), custom = PALETTE.indexOf(penColor) < 0;
    [].forEach.call(elPens.querySelectorAll('.mdc-pen'), function (b) { b.classList.toggle('mdc-on', b.getAttribute('data-v') === penColor); b.disabled = !ed; });
    [].forEach.call(elWidths.querySelectorAll('.mdc-wd'), function (b) { b.classList.toggle('mdc-on', +b.getAttribute('data-v') === penWidth); b.disabled = !ed; });
    elPick.classList.toggle('mdc-on', custom);
    elPick.disabled = !ed;
    if (custom) elPick.value = penColor;
  }

  function onClick(e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (!b || b.disabled || !wrap || !wrap.contains(b)) return;
    var v = b.getAttribute('data-v');
    if (b.classList.contains('mdc-pen')) { penColor = v; syncTools(); api.play('tick'); return; }
    if (b.classList.contains('mdc-wd')) { penWidth = +v; syncTools(); api.play('tick'); return; }
    if (b === elUndo) {
      if (pending.length) pending = [];   // 還沒被承認的那幾筆等主機回來再說
      api.play('pop'); api.send({ a: 'deco', k: 'undo' }); return;
    }
    if (b === elClear) { pending = []; api.play('sweep'); api.send({ a: 'deco', k: 'clear' }); return; }
    var k = b.getAttribute('data-mdc');
    if (!k) return;
    api.play('pop');
    api.send({ a: 'deco', k: k, v: k === 'bg' ? +v : v });
  }
  function onPick() { if (COLOR_RE.test(elPick.value)) { penColor = elPick.value.toLowerCase(); syncTools(); } }

  function mount(r, a) {
    if (root) unmount();
    root = r; api = a;
    if (!document.getElementById(STYLE_ID)) {
      var st = document.createElement('style');
      st.id = STYLE_ID; st.textContent = CSS;
      document.head.appendChild(st);
    }
    wrap = document.createElement('div');
    wrap.className = 'mdc-wrap';
    wrap.innerHTML =
      '<div class="mdc-title">🎀 打扮一下</div>' +
      '<div class="mdc-hint">純娛樂，不影響任何判定。直接在皮膚上畫：臉、脖子、手臂都可以；頭髮、眼鏡、鬍子、帽子、衣服會蓋在塗鴉上面。</div>' +
      '<div class="mdc-grid">' +
        '<div class="mdc-stagebox"><div class="mdc-stage"></div><div class="mdc-name"></div></div>' +
        '<div class="mdc-side">' +
          '<div class="mdc-h">畫筆顏色</div><div class="mdc-row mdc-pens">' +
            PALETTE.map(function (c) { return '<button type="button" class="mdc-pen" data-v="' + c + '" style="background:' + c + '" aria-label="顏色 ' + c + '"></button>'; }).join('') +
            '<input type="color" class="mdc-pick" value="#ff00aa" aria-label="自訂顏色">' +
          '</div>' +
          '<div class="mdc-h">粗細</div><div class="mdc-row mdc-widths">' +
            WIDTHS.map(function (w) { var d = Math.round(w * 3 + 2); return '<button type="button" class="mdc-wd" data-v="' + w + '" aria-label="粗細 ' + w + '"><i style="width:' + d + 'px;height:' + d + 'px"></i></button>'; }).join('') +
            '<button type="button" class="mdc-btn mdc-undo">↩ 復原</button><button type="button" class="mdc-btn mdc-clear">🧽 全部擦掉</button>' +
            '<span class="mdc-count"></span>' +
          '</div>' +
          '<div class="mdc-msg"></div>' +
          '<div class="mdc-h">背景</div><div class="mdc-row mdc-bgs"></div>' +
          '<div class="mdc-h">配件</div><div class="mdc-row mdc-accs"></div>' +
          '<div class="mdc-prev"></div>' +
          '<div class="mdc-lock">現在不能換裝。</div>' +
        '</div>' +
      '</div>';
    elStage = wrap.querySelector('.mdc-stage');
    elName = wrap.querySelector('.mdc-name');
    elPens = wrap.querySelector('.mdc-pens');
    elWidths = wrap.querySelector('.mdc-widths');
    elPick = wrap.querySelector('.mdc-pick');
    elUndo = wrap.querySelector('.mdc-undo');
    elClear = wrap.querySelector('.mdc-clear');
    elCount = wrap.querySelector('.mdc-count');
    elMsg = wrap.querySelector('.mdc-msg');
    elBgs = wrap.querySelector('.mdc-bgs');
    elAccs = wrap.querySelector('.mdc-accs');
    elPrev = wrap.querySelector('.mdc-prev');
    wrap.addEventListener('click', onClick);
    elPick.addEventListener('input', onPick);
    elPick.addEventListener('click', onPick);
    elStage.addEventListener('pointerdown', onDown);
    root.appendChild(wrap);
    sigFig = sigStrokes = sigOpts = sigSel = sigName = '';
    last = null; pending = []; cur = null; gStrokes = gLive = null;
  }

  function update(s) {
    if (!wrap || !s) return;
    var deco = s.deco || { bg: 0, acc: '沒有' };
    var bgs = s.bgs || [], accs = s.accs || [];
    var editable = !!s.editable;
    last = { editable: editable, name: s.name, looks: s.looks, deco: { bg: deco.bg, acc: deco.acc, strokes: deco.strokes || [] }, maxStrokes: s.maxStrokes };
    if (!editable && cur) stopDraw();

    var so = JSON.stringify([bgs, accs]);
    if (so !== sigOpts) {
      sigOpts = so; sigSel = '';
      elBgs.innerHTML = bgs.map(function (c, i) {
        return '<button type="button" class="mdc-sw" data-mdc="bg" data-v="' + i + '" style="background:' + escFn(c) + '" aria-label="背景 ' + (i + 1) + '"></button>';
      }).join('');
      elAccs.innerHTML = accs.map(function (a) {
        return '<button type="button" class="mdc-acc" data-mdc="acc" data-v="' + escFn(a) + '">' + escFn(a) + '</button>';
      }).join('');
    }

    var ss = deco.bg + '|' + deco.acc + '|' + editable;
    if (ss !== sigSel) {
      sigSel = ss;
      wrap.classList.toggle('mdc-ro', !editable);
      [].forEach.call(wrap.querySelectorAll('[data-mdc]'), function (b) {
        var k = b.getAttribute('data-mdc'), v = b.getAttribute('data-v');
        b.classList.toggle('mdc-on', k === 'bg' ? +v === deco.bg : v === deco.acc);
        b.disabled = !editable;
      });
      syncTools();
    }

    if (s.name !== sigName) { sigName = s.name; elName.textContent = s.name || ''; }

    var sf = JSON.stringify([s.looks, deco.bg, deco.acc]), redraw = false;
    if (sf !== sigFig) {
      // 換了一張臉或換了背景／配件：整張重畫。換人（looks 變了）時放棄正在畫的那一筆
      var sameLooks = sigFig && JSON.stringify(s.looks) === JSON.stringify(JSON.parse(sigFig)[0]);
      if (!sameLooks) { if (cur) stopDraw(); pending = []; }
      sigFig = sf;
      elStage.innerHTML = s.looks ? figure(s.looks, { bg: deco.bg, acc: deco.acc }, { full: true }) : '';
      gStrokes = elStage.querySelector('.mdc-strokes');
      gLive = elStage.querySelector('.mdc-live');
      redraw = true;
    }
    var st = JSON.stringify(last.deco.strokes) + '|' + editable + '|' + (s.maxStrokes || '');
    if (st !== sigStrokes) { sigStrokes = st; prunePending(); redraw = true; }
    if (redraw) { drawStrokes(); drawLive(); }
  }

  function unmount() {
    stopDraw();
    clearTimeout(pendT); clearTimeout(msgT);
    if (wrap) {
      wrap.removeEventListener('click', onClick);
      if (elPick) { elPick.removeEventListener('input', onPick); elPick.removeEventListener('click', onPick); }
      if (elStage) elStage.removeEventListener('pointerdown', onDown);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    var st = document.getElementById(STYLE_ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    root = api = wrap = null;
    elStage = elName = elPens = elWidths = elPick = elUndo = elClear = elCount = elMsg = elBgs = elAccs = elPrev = null;
    gStrokes = gLive = null; last = null; pending = [];
    sigFig = sigStrokes = sigOpts = sigSel = sigName = '';
  }

  window.Mini = window.Mini || {};
  // figure(looks, deco, {full,size})：帶塗鴉的膠囊人 SVG。主頁在 core.js 還沒支援塗鴉前可以先拿它來畫別人的造型。
  window.Mini.deco = { mount: mount, update: update, unmount: unmount, figure: figure };
})();
