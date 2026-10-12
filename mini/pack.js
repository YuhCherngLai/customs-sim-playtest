// 小遊戲：裝行李（window.Mini.pack）。依賴 core.js 的 cells()／GRID／SLOTS／BODY_MAX_CELLS。
(function () {
  'use strict';

  const STYLE_ID = 'mpk-style';
  const PAL = ['#5fb3ff', '#ffc857', '#b58cff', '#55d38a', '#ff9f6b', '#6be0d6', '#f58fc4', '#c3d15a'];
  const PEND_MS = 900;      // 樂觀移動最多撐多久，之後一律以主機狀態為準
  const DRAG_START = 5;     // 指標移動超過幾 px 才算拖曳（否則是點選）

  // 身體示意圖座標（viewBox 300x340）：格子左上角 + 指到身上的錨點
  const BOX = { w: 92, h: 64 };
  const POS = {
    hat:   { x: 2,   y: 6,   ax: 150, ay: 46 },
    lp:    { x: 2,   y: 138, ax: 126, ay: 227 },
    shoe:  { x: 2,   y: 270, ax: 132, ay: 317 },
    coat:  { x: 206, y: 50,  ax: 168, ay: 149 },
    waist: { x: 206, y: 138, ax: 180, ay: 196 },
    rp:    { x: 206, y: 226, ax: 174, ay: 227 }
  };
  const POS_FALLBACK = [POS.hat, POS.coat, POS.waist, POS.lp, POS.rp, POS.shoe];

  const CSS = `
.mpk-wrap{--mpk-bg:var(--bg,#10141c);--mpk-card:var(--card,#1a2130);--mpk-line:var(--line,#2c3649);--mpk-fg:var(--fg,#e8ecf3);--mpk-dim:var(--dim,#93a0b5);--mpk-acc:var(--acc,#5fb3ff);--mpk-good:var(--good,#55d38a);--mpk-bad:var(--bad,#ff6b6b);--mpk-warn:var(--warn,#ffc857);
  color:var(--mpk-fg);font-size:14px;line-height:1.35;user-select:none;-webkit-user-select:none;box-sizing:border-box;width:100%;min-width:0}
.mpk-wrap *,.mpk-ghost,.mpk-ghost *{box-sizing:border-box}
.mpk-bar{display:flex;align-items:center;gap:10px;margin-bottom:10px;min-height:36px}
.mpk-hint{flex:1 1 auto;min-width:0;color:var(--mpk-dim);font-size:13px;transition:color .15s}
.mpk-hint.mpk-bad{color:var(--mpk-bad);font-weight:700}
.mpk-hint.mpk-good{color:var(--mpk-good)}
.mpk-rot{flex:0 0 auto;appearance:none;border:1px solid var(--mpk-line);background:var(--mpk-card);color:var(--mpk-fg);font:inherit;font-size:13px;font-weight:700;padding:7px 12px;border-radius:10px;cursor:pointer;touch-action:manipulation;white-space:nowrap}
.mpk-rot:hover:not(:disabled){border-color:var(--mpk-acc);color:var(--mpk-acc)}
.mpk-rot:active:not(:disabled){transform:scale(.95)}
.mpk-rot:disabled{opacity:.4;cursor:default}
.mpk-lock .mpk-rot{display:none}
.mpk-cols{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch}
.mpk-panel{flex:1 1 290px;min-width:0;background:var(--mpk-card);border:1px solid var(--mpk-line);border-radius:14px;padding:10px 12px 14px;display:flex;flex-direction:column;align-items:center}
.mpk-h{align-self:stretch;margin:0 0 10px;font-size:14px;font-weight:700;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
.mpk-h small{font-size:11.5px;font-weight:400;color:var(--mpk-dim)}
.mpk-case{position:relative;width:100%;max-width:400px;margin-top:16px;padding:10px;border-radius:18px;background:#243049;border:2px solid #3a4a6c;box-shadow:0 6px 0 rgba(0,0,0,.25)}
.mpk-case:before{content:"";position:absolute;left:50%;top:-16px;width:84px;height:16px;margin-left:-42px;border:4px solid #3a4a6c;border-bottom:0;border-radius:12px 12px 0 0}
.mpk-case:after{content:"";position:absolute;left:14px;right:14px;bottom:-9px;height:6px;border-radius:0 0 6px 6px;background:radial-gradient(circle at 12px 0,#3a4a6c 6px,transparent 7px),radial-gradient(circle at calc(100% - 12px) 0,#3a4a6c 6px,transparent 7px)}
.mpk-grid{position:relative;width:100%;border-radius:10px;background:#141b29}
.mpk-bgc{position:absolute;inset:0;display:grid}
.mpk-bgc i{border:1px dashed rgba(147,160,181,.22);border-radius:6px;margin:2px}
.mpk-prev,.mpk-pieces{position:absolute;inset:0;pointer-events:none}
.mpk-pv{position:absolute;padding:3px}
.mpk-pv:before{content:"";display:block;width:100%;height:100%;border-radius:8px;border:2px solid var(--mpk-good);background:rgba(85,211,138,.32)}
.mpk-pv.mpk-no:before{border-color:var(--mpk-bad);background:rgba(255,107,107,.34)}
.mpk-piece{position:absolute;pointer-events:none}
.mpk-cell{position:absolute;pointer-events:auto;padding:2px;touch-action:none;cursor:grab}
.mpk-cell:before{content:"";display:block;width:100%;height:100%;border-radius:inherit;background:var(--mpk-c);border:0 solid var(--mpk-bad);box-shadow:inset 0 calc(var(--b)*-5px) 0 rgba(0,0,0,.2),inset 0 calc(var(--t)*3px) 0 rgba(255,255,255,.28)}
.mpk-lock .mpk-cell,.mpk-lock .mpk-chip{cursor:default}
.mpk-con .mpk-cell:before{border-width:calc(var(--t)*3px) calc(var(--r)*3px) calc(var(--b)*3px) calc(var(--l)*3px)}
.mpk-piece.mpk-sel{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 3px #fff)}
.mpk-piece.mpk-src{opacity:.22}
.mpk-lab{position:absolute;transform:translate(-50%,-50%);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:1px;padding:3px 6px;border-radius:8px;background:rgba(12,16,24,.78);color:#fff;font-size:12px;font-weight:700;white-space:nowrap;text-align:center;max-width:none}
.mpk-lab span{display:flex;gap:3px;align-items:center}
.mpk-tc{color:var(--mpk-bad);font-size:10.5px;font-weight:700;font-style:normal;letter-spacing:-.5px}
.mpk-tm{font-style:normal;font-size:10px;font-weight:700;color:#10141c;background:#c5cedb;border-radius:4px;padding:0 4px;line-height:1.5}
.mpk-pop{animation:mpk-pop .26s cubic-bezier(.2,1.6,.4,1)}
.mpk-shake{animation:mpk-shake .3s}
@keyframes mpk-pop{0%{transform:scale(1.14)}60%{transform:scale(.97)}100%{transform:scale(1)}}
@keyframes mpk-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
.mpk-fig{position:relative;width:100%;max-width:380px}
.mpk-fig svg{display:block;width:100%;height:auto}
.mpk-slot{position:absolute;border:1.5px dashed var(--mpk-line);border-radius:10px;background:rgba(16,20,28,.72);padding:3px 5px;display:flex;flex-direction:column;overflow:hidden;transition:border-color .12s,background .12s,transform .12s}
.mpk-slot.mpk-full{border-style:solid;border-color:#46567a;background:rgba(36,48,73,.9)}
.mpk-slot.mpk-ok{border:2px solid var(--mpk-good);background:rgba(85,211,138,.2);transform:scale(1.05)}
.mpk-slot.mpk-no{border:2px solid var(--mpk-bad);background:rgba(255,107,107,.2)}
.mpk-sl{font-size:11px;color:var(--mpk-dim);white-space:nowrap}
.mpk-empty{margin:auto;font-size:11px;color:rgba(147,160,181,.45)}
.mpk-chip{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:1px;touch-action:none;cursor:grab;border-radius:6px}
.mpk-chip.mpk-sel{outline:2px solid #fff;outline-offset:1px}
.mpk-chip.mpk-src{opacity:.22}
.mpk-chip b{display:flex;align-items:center;gap:4px;font-size:12px;min-width:0}
.mpk-chip b u{text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.mpk-chip span{display:flex;gap:3px;align-items:center;min-height:0}
.mpk-mini{position:relative;flex:0 0 auto;display:inline-block}
.mpk-mini i{position:absolute;border-radius:2px;background:var(--mpk-c);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.mpk-list{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
.mpk-row{display:flex;gap:9px;align-items:center;min-width:0;background:var(--mpk-card);border:1px solid var(--mpk-line);border-radius:10px;padding:7px 9px;cursor:pointer}
.mpk-row.mpk-sel{border-color:#fff}
.mpk-row.mpk-con{border-left:4px solid var(--mpk-bad)}
.mpk-ico{flex:0 0 34px;display:flex;justify-content:center}
.mpk-rt{flex:1 1 auto;min-width:0}
.mpk-rn{display:flex;flex-wrap:wrap;align-items:center;gap:2px 5px;font-weight:700;font-size:13px}
.mpk-rx{font-size:12px;color:var(--mpk-dim);margin-top:1px}
.mpk-rl{font-size:11.5px;color:var(--mpk-acc);margin-top:1px}
.mpk-ghost{position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;will-change:transform;filter:drop-shadow(0 10px 10px rgba(0,0,0,.45));transition:opacity .1s}
.mpk-ghost.mpk-back{transition:transform .18s ease-out,opacity .18s}
.mpk-ghost .mpk-cell{pointer-events:none}
.mpk-ghost .mpk-cell:before{border-color:var(--mpk-bad,#ff6b6b)}
.mpk-ghost .mpk-lab{font-family:inherit}
`;

  // ---- 模組狀態 ----
  let root = null, api = null, wrap = null, els = null;
  let last = null;          // 主機最新狀態（原樣保留）
  let view = null;          // 套上樂觀移動後、實際畫出來的狀態
  let sig = '', structSig = '';
  let sel = -1;
  let down = null;          // 按下但還沒開始拖
  let drag = null;          // 拖曳中
  let pend = {};            // i -> 樂觀移動
  let rot = {};             // i -> 本地記得的旋轉（身上的物品主機不存 r）
  let timers = new Set();
  let hintTimer = 0, popI = -1, lastCell = 64, ghostsOut = [];

  const esc = s => (api && api.esc) ? api.esc(String(s == null ? '' : s))
    : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const play = n => { try { api && api.play && api.play(n); } catch (e) { /* 音效失敗不影響操作 */ } };
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const col = i => PAL[((i % PAL.length) + PAL.length) % PAL.length];
  const item = i => view ? view.items.find(o => o.i === i) : null;

  function shape(sh, r) {
    const cs = cells(sh, r);
    let w = 0, h = 0;
    cs.forEach(p => { if (p[0] + 1 > w) w = p[0] + 1; if (p[1] + 1 > h) h = p[1] + 1; });
    return { cs, w, h };
  }

  // 一塊拼圖的格子 HTML（百分比定位，外角才有圓角，看起來是一整塊）
  function cellsHTML(sp, rad) {
    const has = {}; sp.cs.forEach(p => { has[p[0] + ',' + p[1]] = 1; });
    const R = rad || 10;
    return sp.cs.map(p => {
      const x = p[0], y = p[1];
      const t = has[x + ',' + (y - 1)], b = has[x + ',' + (y + 1)], l = has[(x - 1) + ',' + y], r = has[(x + 1) + ',' + y];
      const rr = [(!t && !l) ? R : 0, (!t && !r) ? R : 0, (!b && !r) ? R : 0, (!b && !l) ? R : 0].map(v => v + 'px').join(' ');
      const pad = [t ? 0 : 2, r ? 0 : 2, b ? 0 : 2, l ? 0 : 2].map(v => v + 'px').join(' ');
      return `<div class="mpk-cell" style="left:${x / sp.w * 100}%;top:${y / sp.h * 100}%;width:${100 / sp.w}%;height:${100 / sp.h}%;border-radius:${rr};padding:${pad};--t:${t ? 0 : 1};--r:${r ? 0 : 1};--b:${b ? 0 : 1};--l:${l ? 0 : 1}"></div>`;
    }).join('');
  }
  function labelHTML(it, sp) {
    let cx = 0, cy = 0;
    sp.cs.forEach(p => { cx += p[0] + .5; cy += p[1] + .5; });
    cx /= sp.cs.length; cy /= sp.cs.length;
    const tags = (it.c ? '<i class="mpk-tc">【違禁品】</i>' : '') + (it.m ? '<i class="mpk-tm">金屬</i>' : '');
    return `<div class="mpk-lab" style="left:${cx / sp.w * 100}%;top:${cy / sp.h * 100}%">${esc(it.n)}${tags ? `<span>${tags}</span>` : ''}</div>`;
  }
  function miniHTML(it, r, px) {
    const sp = shape(it.sh, r);
    return `<span class="mpk-mini" style="--mpk-c:${col(it.i)};width:${sp.w * px}px;height:${sp.h * px}px">` +
      sp.cs.map(p => `<i style="left:${p[0] * px}px;top:${p[1] * px}px;width:${px}px;height:${px}px"></i>`).join('') + '</span>';
  }
  const tip = it => `${it.n}${it.c ? '【違禁品】' : ''}｜X 光：${it.x || '？'}${it.m ? '｜金屬' : ''}`;

  // ---- 規則（跟主機一樣，只用來畫預覽與做樂觀移動）----
  function fitsBag(i, gx, gy, r) {
    const it = item(i); if (!it) return false;
    const occ = {};
    view.items.forEach(o => {
      if (o.i === i || o.loc !== 'bag') return;
      cells(o.sh, o.r).forEach(p => { occ[(o.gx + p[0]) + ',' + (o.gy + p[1])] = 1; });
    });
    return cells(it.sh, r).every(p => {
      const x = gx + p[0], y = gy + p[1];
      return x >= 0 && y >= 0 && x < view.w && y < view.h && !occ[x + ',' + y];
    });
  }
  function bodyCheck(i, slot) {
    const it = item(i); if (!it) return 'x';
    if (cells(it.sh, 0).length > view.max) return 'big';
    if (view.items.some(o => o.i !== i && o.loc === 'body' && o.slot === slot)) return 'full';
    return '';
  }

  // ---- 提示列 ----
  function baseHint() {
    if (!view) return '';
    return view.editable ? '拖曳物品到行李箱或身上；R 鍵／右鍵／按鈕可以旋轉。' : '行李已經收好了，現在只能看。';
  }
  function setHint(text, kind) {
    if (!els) return;
    if (hintTimer) { clearTimeout(hintTimer); timers.delete(hintTimer); hintTimer = 0; }
    els.hint.textContent = text || baseHint();
    els.hint.className = 'mpk-hint' + (text && kind ? ' mpk-' + kind : '');
    if (text) hintTimer = later(() => { hintTimer = 0; setHint(''); }, 1800);
  }

  // ---- 版面骨架（格子大小或口袋清單變了才重建）----
  function slotPos(s, k) { return POS[s.id] || POS_FALLBACK[k % POS_FALLBACK.length]; }
  function figureSVG(slots) {
    const lines = slots.map((s, k) => {
      const p = slotPos(s, k), left = p.x < 150;
      const x1 = left ? p.x + BOX.w : p.x, y1 = p.y + BOX.h / 2;
      return `<path d="M${x1},${y1} L${p.ax},${p.ay}" stroke="#93a0b5" stroke-width="1.4" stroke-dasharray="3 3" fill="none" opacity=".75"/><circle cx="${p.ax}" cy="${p.ay}" r="4" fill="#10141c" stroke="#e8ecf3" stroke-width="1.6"/>`;
    }).join('');
    return `<svg viewBox="0 0 300 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<ellipse cx="150" cy="330" rx="60" ry="7" fill="#000" opacity=".35"/>
<rect x="124" y="246" width="22" height="70" rx="9" fill="#39466a"/><rect x="154" y="246" width="22" height="70" rx="9" fill="#39466a"/>
<rect x="114" y="308" width="34" height="18" rx="9" fill="#c0703f"/><rect x="152" y="308" width="34" height="18" rx="9" fill="#c0703f"/>
<rect x="99" y="132" width="16" height="78" rx="8" fill="#356aa3"/><rect x="185" y="132" width="16" height="78" rx="8" fill="#356aa3"/>
<circle cx="107" cy="212" r="7.5" fill="#f3c9a0"/><circle cx="193" cy="212" r="7.5" fill="#f3c9a0"/>
<rect x="110" y="44" width="80" height="226" rx="40" fill="#f3c9a0"/>
<path d="M110,128 L190,128 L190,230 Q190,270 150,270 Q110,270 110,230Z" fill="#3f78b5"/>
<path d="M150,128 L136,128 L150,152Z M150,128 L164,128 L150,152Z" fill="#e9eef5"/>
<path d="M150,152 L150,268" stroke="#2c5a8c" stroke-width="2"/>
<rect x="157" y="139" width="22" height="19" rx="3" fill="none" stroke="#cfe3ff" stroke-width="1.4" stroke-dasharray="3 2"/>
<rect x="110" y="190" width="80" height="11" fill="#23293a"/><rect x="143" y="188" width="14" height="15" rx="2" fill="#ffc857"/>
<rect x="116" y="216" width="20" height="22" rx="4" fill="#2f5f95" stroke="#254d7a"/><rect x="164" y="216" width="20" height="22" rx="4" fill="#2f5f95" stroke="#254d7a"/>
<path d="M130,82 L142,81 M158,81 L170,82" stroke="#3b2a20" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="136" cy="93" r="6" fill="#fff"/><circle cx="164" cy="93" r="6" fill="#fff"/><circle cx="137" cy="94" r="2.6" fill="#222"/><circle cx="165" cy="94" r="2.6" fill="#222"/>
<path d="M141,109 Q150,116 159,109" stroke="#7a2e2e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
<path d="M112,70 Q112,30 150,30 Q188,30 188,70Z" fill="#e0a93b"/><rect x="112" y="56" width="76" height="9" fill="#8a4b2b"/><rect x="100" y="64" width="100" height="10" rx="5" fill="#c98f25"/>
${lines}</svg>`;
  }
  function build() {
    const bg = []; for (let k = 0; k < view.w * view.h; k++) bg.push('<i></i>');
    wrap.innerHTML =
      `<div class="mpk-bar"><div class="mpk-hint"></div><button type="button" class="mpk-rot" title="旋轉 90°（R 鍵或右鍵也可以）">⟳ 旋轉 <span style="opacity:.6">R</span></button></div>` +
      `<div class="mpk-cols">` +
        `<section class="mpk-panel"><h4 class="mpk-h">🧳 行李箱<small>會過 X 光，海關只看得到形狀</small></h4>` +
          `<div class="mpk-case"><div class="mpk-grid" style="aspect-ratio:${view.w}/${view.h}"><div class="mpk-bgc" style="grid-template-columns:repeat(${view.w},1fr);grid-template-rows:repeat(${view.h},1fr)">${bg.join('')}</div><div class="mpk-prev"></div><div class="mpk-pieces"></div></div></div></section>` +
        `<section class="mpk-panel"><h4 class="mpk-h">🧍 藏在身上<small>金屬探測門或搜身才找得到（最多 ${view.max} 格）</small></h4>` +
          `<div class="mpk-fig">${figureSVG(view.slots)}` +
          view.slots.map((s, k) => { const p = slotPos(s, k); return `<div class="mpk-slot" data-mpk-slot="${esc(s.id)}" style="left:${p.x / 3}%;top:${p.y / 3.4}%;width:${BOX.w / 3}%;height:${BOX.h / 3.4}%"></div>`; }).join('') +
          `</div></section>` +
      `</div><div class="mpk-list"></div>`;
    els = {
      hint: wrap.querySelector('.mpk-hint'), rot: wrap.querySelector('.mpk-rot'), grid: wrap.querySelector('.mpk-grid'),
      prev: wrap.querySelector('.mpk-prev'), pieces: wrap.querySelector('.mpk-pieces'), list: wrap.querySelector('.mpk-list'),
      slots: {}
    };
    wrap.querySelectorAll('.mpk-slot').forEach(e => { els.slots[e.getAttribute('data-mpk-slot')] = e; });
    setHint('');
  }

  // ---- 畫面 ----
  function render() {
    const dI = drag ? drag.i : -1;
    wrap.classList.toggle('mpk-lock', !view.editable);
    els.rot.disabled = !(view.editable && (drag || item(sel)));
    if (!hintTimer) { els.hint.textContent = baseHint(); els.hint.className = 'mpk-hint'; }

    els.pieces.innerHTML = view.items.filter(o => o.loc === 'bag').map(it => {
      const sp = shape(it.sh, it.r);
      const cls = 'mpk-piece' + (it.c ? ' mpk-con' : '') + (it.i === sel ? ' mpk-sel' : '') + (it.i === dI ? ' mpk-src' : '') + (it.i === popI ? ' mpk-pop' : '');
      return `<div class="${cls}" data-mpk-i="${it.i}" title="${esc(tip(it))}" style="--mpk-c:${col(it.i)};left:${it.gx / view.w * 100}%;top:${it.gy / view.h * 100}%;width:${sp.w / view.w * 100}%;height:${sp.h / view.h * 100}%;z-index:${it.i === sel ? 2 : 1}">${cellsHTML(sp)}${labelHTML(it, sp)}</div>`;
    }).join('');

    view.slots.forEach(s => {
      const e = els.slots[s.id]; if (!e) return;
      const it = view.items.find(o => o.loc === 'body' && o.slot === s.id);
      e.classList.toggle('mpk-full', !!it);
      let h = `<div class="mpk-sl">${esc(s.label)}</div>`;
      if (it) {
        const cls = 'mpk-chip' + (it.i === sel ? ' mpk-sel' : '') + (it.i === dI ? ' mpk-src' : '') + (it.i === popI ? ' mpk-pop' : '');
        const tags = (it.c ? '<i class="mpk-tc">【違禁品】</i>' : '') + (it.m ? '<i class="mpk-tm">金屬</i>' : '');
        h += `<div class="${cls}" data-mpk-i="${it.i}" title="${esc(tip(it))}"><b>${miniHTML(it, it.r, 8)}<u>${esc(it.n)}</u></b>${tags ? `<span>${tags}</span>` : ''}</div>`;
      } else h += '<div class="mpk-empty">空的</div>';
      e.innerHTML = h;
    });

    els.list.innerHTML = view.items.map(it => {
      const where = it.loc === 'bag' ? '在行李箱' : '藏在' + ((view.slots.find(s => s.id === it.slot) || {}).label || '身上');
      return `<div class="mpk-row${it.c ? ' mpk-con' : ''}${it.i === sel ? ' mpk-sel' : ''}" data-mpk-row="${it.i}">` +
        `<div class="mpk-ico">${miniHTML(it, it.r, 10)}</div><div class="mpk-rt">` +
        `<div class="mpk-rn">${esc(it.n)}${it.c ? '<i class="mpk-tc">【違禁品】</i>' : ''}${it.m ? '<i class="mpk-tm">金屬</i>' : ''}</div>` +
        `<div class="mpk-rx">X 光：${esc(it.x || '？')}</div><div class="mpk-rl">${esc(where)}</div></div></div>`;
    }).join('');
    popI = -1;
  }

  // 把主機狀態（加上還沒過期的樂觀移動）對到畫面上；資料沒變就什麼都不做
  function sync() {
    if (!wrap || !last) return;
    const now = Date.now();
    const g = last.grid || (typeof GRID !== 'undefined' ? GRID : { w: 4, h: 3 });
    const slots = last.slots || (typeof SLOTS !== 'undefined' ? SLOTS : []);
    const max = last.maxBodyCells != null ? last.maxBodyCells : (typeof BODY_MAX_CELLS !== 'undefined' ? BODY_MAX_CELLS : 3);
    const items = (last.items || []).map(s => {
      const o = { i: s.i, n: s.n, x: s.x, m: !!s.m, c: !!s.c, sh: s.sh, loc: s.loc === 'body' ? 'body' : 'bag', gx: s.gx | 0, gy: s.gy | 0, r: (s.r | 0) & 3, slot: s.slot || '' };
      const p = pend[o.i];
      if (p) {
        const same = p.loc === o.loc && (p.loc === 'body' ? p.slot === o.slot : (p.gx === o.gx && p.gy === o.gy && p.r === o.r));
        if (same || now >= p.until || last.editable === false) delete pend[o.i];
        else { o.loc = p.loc; o.gx = p.gx; o.gy = p.gy; o.r = p.r; o.slot = p.slot; }
      }
      if (o.loc === 'bag') rot[o.i] = o.r; else { o.r = (rot[o.i] | 0) & 3; o.gx = o.gy = 0; }
      return o;
    });
    view = { editable: last.editable !== false, w: g.w, h: g.h, slots: slots, max: max, items: items };
    if (sel >= 0 && !item(sel)) sel = -1;
    const st = JSON.stringify([view.w, view.h, view.max, view.slots]);
    const s = JSON.stringify([view, sel, drag ? drag.i : -1]);
    if (st !== structSig) { structSig = st; build(); sig = ''; }
    if (s === sig) return;
    sig = s; render();
  }

  // ---- 旋轉 ----
  function rotate() {
    if (!view || !view.editable) return;
    if (drag) {
      drag.r = (drag.r + 1) & 3;
      const sp = shape(drag.sh, drag.r);
      drag.ox = sp.w / 2; drag.oy = sp.h / 2;
      paintGhost(); moveDrag(drag.x, drag.y);
      play('pop'); return;
    }
    const it = item(sel); if (!it) return;
    const r = (it.r + 1) & 3;
    if (it.loc === 'body') { rot[it.i] = r; play('pop'); sync(); return; }
    // 在行李箱裡原地轉；卡住就找最近的空位
    let best = null;
    for (let y = 0; y < view.h; y++) for (let x = 0; x < view.w; x++) {
      if (!fitsBag(it.i, x, y, r)) continue;
      const d = Math.abs(x - it.gx) + Math.abs(y - it.gy);
      if (!best || d < best.d) best = { x: x, y: y, d: d };
    }
    if (!best) {
      const e = wrap.querySelector('.mpk-piece[data-mpk-i="' + it.i + '"]');
      if (e) { e.classList.remove('mpk-shake'); void e.offsetWidth; e.classList.add('mpk-shake'); }
      setHint('轉不過來，行李箱沒有空位', 'bad'); play('tick'); return;
    }
    commit(it.i, { loc: 'bag', gx: best.x, gy: best.y, r: r, slot: '' }, 'pop');
  }

  // 樂觀移動 + 送給主機
  function commit(i, to, sound) {
    pend[i] = { loc: to.loc, gx: to.gx | 0, gy: to.gy | 0, r: to.r | 0, slot: to.slot || '', until: Date.now() + PEND_MS };
    if (to.loc === 'bag') rot[i] = to.r;
    popI = i; sig = '';
    later(sync, PEND_MS + 30);
    play(sound);
    sync();   // 先畫出新位置，再送出（主機可能同步回呼 update）
    if (to.loc === 'bag') api.send({ a: 'pack', i: i, loc: 'bag', x: to.gx, y: to.gy, r: to.r });
    else api.send({ a: 'pack', i: i, loc: 'body', slot: to.slot });
  }

  // ---- 拖曳 ----
  function paintGhost() {
    const g = drag.ghost, sp = shape(drag.sh, drag.r), it = item(drag.i) || { n: '', i: drag.i };
    g.style.width = sp.w * drag.cell + 'px'; g.style.height = sp.h * drag.cell + 'px';
    g.style.setProperty('--mpk-c', col(drag.i));
    g.innerHTML = cellsHTML(sp) + labelHTML(it, sp);
  }
  function placeGhost() {
    const g = drag.ghost;
    g.style.transformOrigin = (drag.ox * drag.cell) + 'px ' + (drag.oy * drag.cell) + 'px';
    g.style.transform = `translate3d(${drag.x - drag.ox * drag.cell}px,${drag.y - drag.oy * drag.cell}px,0) rotate(${drag.tilt.toFixed(2)}deg) scale(1.06)`;
  }
  function startDrag() {
    const it = item(down.i); if (!it || !view.editable) { down = null; return; }
    const gr = els.grid.getBoundingClientRect();
    if (gr.width > 0) lastCell = gr.width / view.w;
    const sp = shape(it.sh, it.r);
    const ghost = document.createElement('div');
    ghost.className = 'mpk-ghost' + (it.c ? ' mpk-con' : '');
    // 字型與 CSS 變數從 root 抄過來（ghost 掛在 body 上，繼承不到）
    try {
      const cs = getComputedStyle(wrap);
      ghost.style.fontFamily = cs.fontFamily;
      ['--mpk-bad', '--mpk-good'].forEach(v => ghost.style.setProperty(v, cs.getPropertyValue(v) || ''));
    } catch (e) { /* root 不在文件裡時拿不到樣式，用預設即可 */ }
    drag = {
      i: it.i, id: down.id, sh: it.sh, r: it.r, r0: it.r, cell: lastCell, ghost: ghost,
      ox: down.fromBag ? clamp(down.fx, 0, sp.w) : sp.w / 2, oy: down.fromBag ? clamp(down.fy, 0, sp.h) : sp.h / 2,
      x: down.x, y: down.y, tilt: -4, tgt: null, key: ''
    };
    down = null;
    paintGhost();
    document.body.appendChild(ghost);
    sig = ''; sync();
    moveDrag(drag.x, drag.y);
  }
  function target(x, y) {
    const it = item(drag.i); if (!it) return null;
    // 1) 指標直接在某個口袋格上
    let near = null;
    for (const s of view.slots) {
      const e = els.slots[s.id]; if (!e) continue;
      const b = e.getBoundingClientRect(); if (!b.width) continue;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) { near = { id: s.id, d: -1 }; break; }
      const dx = Math.max(b.left - x, 0, x - b.right), dy = Math.max(b.top - y, 0, y - b.bottom), d = Math.hypot(dx, dy);
      if (d < b.width * .3 && (!near || d < near.d)) near = { id: s.id, d: d };
    }
    const body = id => { const why = bodyCheck(drag.i, id); return { kind: 'body', slot: id, ok: !why, why: why }; };
    if (near && near.d < 0) return body(near.id);
    // 2) 拼圖中心靠近行李箱：吸到最近的格子
    const gr = els.grid.getBoundingClientRect();
    if (gr.width > 0) {
      const c = gr.width / view.w, sp = shape(drag.sh, drag.r);
      const left = x - drag.ox * c, top = y - drag.oy * c;
      const cx = left + sp.w * c / 2, cy = top + sp.h * c / 2, m = c * .6;
      if (cx >= gr.left - m && cx <= gr.right + m && cy >= gr.top - m && cy <= gr.bottom + m) {
        const gx = clamp(Math.round((left - gr.left) / c), 0, Math.max(0, view.w - sp.w));
        const gy = clamp(Math.round((top - gr.top) / c), 0, Math.max(0, view.h - sp.h));
        return { kind: 'bag', gx: gx, gy: gy, r: drag.r, ok: fitsBag(drag.i, gx, gy, drag.r) };
      }
    }
    // 3) 差一點點才到口袋格
    return near ? body(near.id) : null;
  }
  function paintTarget(t) {
    const key = t ? [t.kind, t.slot, t.gx, t.gy, t.r, t.ok].join('|') : '';
    if (key === drag.key) return;
    drag.key = key;
    Object.keys(els.slots).forEach(id => els.slots[id].classList.remove('mpk-ok', 'mpk-no'));
    els.prev.innerHTML = '';
    drag.ghost.style.opacity = t && t.kind === 'bag' ? '.8' : '1';
    if (!t) return;
    if (t.kind === 'bag') {
      els.prev.innerHTML = cells(drag.sh, t.r).map(p =>
        `<div class="mpk-pv${t.ok ? '' : ' mpk-no'}" style="left:${(t.gx + p[0]) / view.w * 100}%;top:${(t.gy + p[1]) / view.h * 100}%;width:${100 / view.w}%;height:${100 / view.h}%"></div>`).join('');
    } else {
      const e = els.slots[t.slot]; if (e) e.classList.add(t.ok ? 'mpk-ok' : 'mpk-no');
      if (t.why === 'big') setHint('太大了，藏不到身上', 'bad');
      else if (t.why === 'full') setHint('這裡已經藏了別的東西', 'bad');
    }
  }
  function moveDrag(x, y) {
    const vx = x - drag.x;
    drag.tilt = clamp(drag.tilt * .8 + vx * .5, -12, 12);
    if (Math.abs(drag.tilt) < 3 && vx === 0) drag.tilt = drag.tilt < 0 ? -3 : 3;
    drag.x = x; drag.y = y;
    placeGhost();
    drag.tgt = target(x, y);
    paintTarget(drag.tgt);
  }
  function clearDragMarks() {
    if (!els) return;
    els.prev.innerHTML = '';
    Object.keys(els.slots).forEach(id => els.slots[id].classList.remove('mpk-ok', 'mpk-no'));
  }
  function killGhost(g) {
    if (g && g.parentNode) g.parentNode.removeChild(g);
    ghostsOut = ghostsOut.filter(o => o !== g);
  }
  // 放不下：飛回原位
  function flyBack(d) {
    const g = d.ghost;
    const e = wrap && wrap.querySelector('[data-mpk-i="' + d.i + '"]');
    const b = e ? e.getBoundingClientRect() : null;
    if (!b || !b.width) { killGhost(g); return; }
    if (d.r !== d.r0) { drag = d; d.r = d.r0; paintGhost(); drag = null; }
    ghostsOut.push(g);
    g.classList.add('mpk-back');
    g.style.transformOrigin = '0 0';
    const sc = b.width / (parseFloat(g.style.width) || b.width);
    g.style.transform = `translate3d(${b.left}px,${b.top}px,0) rotate(0deg) scale(${Math.min(1, sc).toFixed(3)})`;
    g.style.opacity = '.2';
    later(() => killGhost(g), 200);
  }
  function endDrag(doDrop) {
    const d = drag; if (!d) return;
    const it = item(d.i), t = doDrop ? d.tgt : null;
    clearDragMarks();
    drag = null;
    let moved = false;
    if (it && t && t.ok && view.editable) {
      const same = t.kind === 'bag' ? (it.loc === 'bag' && it.gx === t.gx && it.gy === t.gy && it.r === t.r) : (it.loc === 'body' && it.slot === t.slot);
      killGhost(d.ghost);
      moved = true;
      if (same) { popI = d.i; sig = ''; sync(); }
      else {
        if (t.kind === 'bag') commit(d.i, { loc: 'bag', gx: t.gx, gy: t.gy, r: t.r }, 'thud');
        else { rot[d.i] = d.r; commit(d.i, { loc: 'body', slot: t.slot }, 'thud'); }
        setHint(t.kind === 'bag' ? '放進行李箱了' : '藏好了', 'good');
      }
    }
    if (!moved) {
      sig = ''; sync();          // 原位的拼圖先恢復顯示，ghost 再飛回去
      if (t && !t.ok) {
        play('tick');
        setHint(t.kind === 'body' ? (t.why === 'big' ? '太大了，藏不到身上' : '這裡已經藏了別的東西') : '這裡放不下', 'bad');
      }
      flyBack(d);
    }
  }

  // ---- 事件 ----
  function select(i) { if (sel !== i) { sel = i; sync(); } }
  function onDown(e) {
    if (!view) return;
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    const el = t.closest('[data-mpk-i]');
    if (!el) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const i = +el.getAttribute('data-mpk-i'), it = item(i); if (!it) return;
    e.preventDefault();
    // 觸控預設會把後續事件綁在這個元素上；放掉，讓 document 一律收得到
    try { if (t.hasPointerCapture && t.hasPointerCapture(e.pointerId)) t.releasePointerCapture(e.pointerId); } catch (err) { /* 沒有 capture 就算了 */ }
    select(i);
    if (!view.editable || drag) return;
    const d = { i: i, id: e.pointerId, x: e.clientX, y: e.clientY, fromBag: it.loc === 'bag', fx: 0, fy: 0 };
    if (d.fromBag) {
      const gr = els.grid.getBoundingClientRect();
      if (gr.width > 0) { const c = gr.width / view.w; d.fx = (e.clientX - gr.left) / c - it.gx; d.fy = (e.clientY - gr.top) / c - it.gy; }
      else d.fromBag = false;
    }
    down = d;
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    if (t.closest('.mpk-rot')) { if (e.detail === 0) rotate(); return; }   // 鍵盤觸發；指標在 pointerdown 就處理了
    const row = t.closest('[data-mpk-row]');
    if (row) select(+row.getAttribute('data-mpk-row'));
  }
  function onRotDown(e) {
    if (!(e.target && e.target.closest && e.target.closest('.mpk-rot'))) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); rotate();
  }
  function onMove(e) {
    if (down && !drag && e.pointerId === down.id) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) >= DRAG_START) startDrag();
    }
    if (drag && e.pointerId === drag.id) { if (e.cancelable) e.preventDefault(); moveDrag(e.clientX, e.clientY); }
  }
  function onUp(e) {
    if (down && e.pointerId === down.id) down = null;
    if (drag && e.pointerId === drag.id) { drag.tgt = target(e.clientX, e.clientY); endDrag(true); }
  }
  function onCancel(e) {
    if (down && e.pointerId === down.id) down = null;
    if (drag && e.pointerId === drag.id) endDrag(false);
  }
  function onKey(e) {
    if (e.key !== 'r' && e.key !== 'R') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    const a = e.target;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '') || a.isContentEditable)) return;
    if (!view || !view.editable) return;
    if (!drag && !(item(sel) && wrap && wrap.isConnected)) return;
    e.preventDefault(); rotate();
  }
  function onMenu(e) {
    if (drag) { e.preventDefault(); rotate(); return; }
    if (!wrap || !view || !view.editable || !e.target || !e.target.closest || !wrap.contains(e.target)) return;
    const el = e.target.closest('[data-mpk-i]'); if (!el) return;
    e.preventDefault();
    select(+el.getAttribute('data-mpk-i')); rotate();
  }
  function onDragStart(e) { e.preventDefault(); }

  // ---- 對外介面 ----
  function mount(r, a) {
    if (root) unmount();
    root = r; api = a || {};
    if (!api.send) api.send = function () {};
    last = null; view = null; sig = ''; structSig = ''; sel = -1; down = null; drag = null; pend = {}; rot = {}; popI = -1; els = null;
    if (!document.getElementById(STYLE_ID)) {
      const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }
    wrap = document.createElement('div'); wrap.className = 'mpk-wrap';
    root.appendChild(wrap);
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('pointerdown', onRotDown);
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('dragstart', onDragStart);
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('keydown', onKey);
    document.addEventListener('contextmenu', onMenu);
  }
  function update(state) {
    if (!wrap || !state) return;
    last = state;
    if (drag) {
      // 拖曳中不重畫；只有變成唯讀或東西不見了才強制放手
      const gone = !(state.items || []).some(o => o.i === drag.i);
      if (state.editable === false || gone) { endDrag(false); }
      return;
    }
    if (down && state.editable === false) down = null;
    sync();
  }
  function unmount() {
    document.removeEventListener('pointermove', onMove, { passive: false });
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('contextmenu', onMenu);
    timers.forEach(t => clearTimeout(t)); timers.clear(); hintTimer = 0;
    if (drag) killGhost(drag.ghost);
    ghostsOut.slice().forEach(killGhost); ghostsOut = [];
    if (wrap) {
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('pointerdown', onRotDown);
      wrap.removeEventListener('click', onClick);
      wrap.removeEventListener('dragstart', onDragStart);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    const st = document.getElementById(STYLE_ID); if (st && st.parentNode) st.parentNode.removeChild(st);
    root = api = wrap = els = last = view = drag = down = null; pend = {}; rot = {}; sig = structSig = ''; sel = -1;
  }

  window.Mini = window.Mini || {};
  window.Mini.pack = { mount: mount, update: update, unmount: unmount };
})();
