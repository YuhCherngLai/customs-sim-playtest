// 乘客比姿勢小遊戲模組：window.Mini.gesture = { mount, update, unmount }
// 比的人（active:true）看到自己的大頭照＋動作按鈕；看的人（active:false）只看到大頭照和正在比的動作。
(function () {
  'use strict';

  var STYLE_ID = 'mgs-style';
  var POSE_MS = 2000;      // 主機沒送 pose 時，自己這邊動作播多久（跟冷卻一樣長）
  var PENDING_MS = 1200;   // 送出後多久沒回應就把按鈕放開
  var SK = '#f3c9a0', SKL = '#a8663a', HR = '#3b2a20';
  var SLEEVE = { 白襯衫: '#f6f6f6', 花襯衫: '#19a7a0', 黑色帽T: '#2a2a2e', 西裝: '#1f2f55', 條紋衫: '#ffffff', 皮夾克: '#6b3e1e' };
  // 主機的動作字串 → 這裡畫的姿勢；不認得的字串一律用 wave
  var KEY = { 摸了摸鼻子: 'nose', 抓了抓頭: 'head', 咳了兩聲: 'cough', 眨了眨眼: 'wink', 聳了聳肩: 'shrug', 拉了拉耳朵: 'ear', 比了個讚: 'thumb', 看了看手錶: 'watch' };
  var ICON = { nose: '👃', head: '💭', cough: '😷', wink: '😉', shrug: '🤷', ear: '👂', thumb: '👍', watch: '⌚', wave: '🙋' };

  var CSS = [
    '.mgs-wrap{container-type:inline-size;container-name:mgs;color:var(--fg,#e8ecf3);-webkit-user-select:none;user-select:none}',
    '.mgs-wrap *{box-sizing:border-box}',
    '.mgs-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin-bottom:8px}',
    '.mgs-title{font-weight:700;font-size:1.05em}',
    '.mgs-hint{color:var(--dim,#93a0b5);font-size:.82em}',
    '.mgs-grid{display:grid;grid-template-columns:minmax(120px,180px) minmax(0,1fr);gap:14px;align-items:start}',
    '.mgs-stage{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}',
    '.mgs-port{position:relative;width:100%;max-width:180px;aspect-ratio:100/120;border-radius:12px;overflow:hidden;background:#cfd8e6;box-shadow:0 0 0 1px var(--line,#2c3649);transition:box-shadow .15s}',
    '.mgs-port svg{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.mgs-on .mgs-port{box-shadow:0 0 0 3px var(--warn,#ffc857),0 0 22px rgba(255,200,87,.35)}',
    '.mgs-cap{text-align:center;min-width:0;max-width:100%}',
    '.mgs-cap small{display:block;color:var(--dim,#93a0b5);font-size:.74em}',
    '.mgs-cap b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mgs-act{display:inline-block;margin-top:4px;padding:3px 12px;border-radius:999px;border:1px solid var(--line,#2c3649);color:var(--dim,#93a0b5);font-size:.86em;white-space:nowrap}',
    '.mgs-on .mgs-act{border-color:var(--warn,#ffc857);background:rgba(255,200,87,.14);color:var(--warn,#ffc857);font-weight:700;animation:mgs-pop .25s ease-out}',
    '.mgs-panel{min-width:0}',
    '.mgs-btns{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:8px}',
    '.mgs-b{font:inherit;display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid var(--line,#2c3649);background:var(--card,#1a2130);color:var(--fg,#e8ecf3);cursor:pointer;text-align:left;touch-action:manipulation;transition:border-color .12s,background .12s,opacity .12s}',
    '.mgs-b i{font-style:normal;font-size:1.25em;line-height:1;flex:none}',
    '.mgs-b span{min-width:0}',
    '.mgs-b:hover:not(:disabled){border-color:var(--acc,#5fb3ff);background:rgba(95,179,255,.12)}',
    '.mgs-b:active:not(:disabled){transform:translateY(1px)}',
    '.mgs-b:disabled{opacity:.45;cursor:not-allowed}',
    '.mgs-b.mgs-sent,.mgs-b.mgs-sent:disabled{opacity:1;border-color:var(--warn,#ffc857);background:rgba(255,200,87,.14)}',
    '.mgs-cd{height:4px;margin-top:10px;border-radius:2px;background:var(--line,#2c3649);overflow:hidden}',
    '.mgs-cd i{display:block;height:100%;width:0;background:var(--warn,#ffc857)}',
    '.mgs-cooling .mgs-cd i{animation:mgs-cd 2s linear both}',
    '.mgs-tip{margin-top:5px;color:var(--dim,#93a0b5);font-size:.78em;min-height:1.3em}',
    // 抬頭看螢幕（旅客）／盯著旅客（海關）：都是按住才算
    '.mgs-peek,.mgs-watch{display:none}',
    '.mgs-canpeek .mgs-peek{display:block;margin-top:12px;padding-top:10px;border-top:1px solid var(--line,#2c3649)}',
    '.mgs-canwatch .mgs-watch{display:block;margin-top:10px}',
    '.mgs-sub{font-weight:700;font-size:.92em;margin-bottom:6px}',
    '.mgs-sub small{font-weight:400;color:var(--dim,#93a0b5);margin-left:8px}',
    '.mgs-scr{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px;margin-bottom:8px}',
    '.mgs-scr div{min-height:46px;padding:8px;border-radius:8px;border:1px solid var(--line,#2c3649);background:#0b0f16;color:var(--dim,#93a0b5);font-size:.82em;display:grid;place-items:center;text-align:center;overflow-wrap:anywhere}',
    '.mgs-peeking .mgs-scr div{color:#8dffbd;border-color:#2c6b4a;font-weight:700;font-size:1em;text-shadow:0 0 8px rgba(141,255,189,.5)}',
    '.mgs-hold{font:inherit;display:block;width:100%;min-height:48px;padding:6px 10px;border-radius:10px;border:1px solid var(--acc,#5fb3ff);background:rgba(95,179,255,.12);color:var(--fg,#e8ecf3);cursor:pointer;touch-action:none;-webkit-touch-callout:none}',
    '.mgs-hold.mgs-down{background:var(--acc,#5fb3ff);color:#08111c;font-weight:700}',
    '.mgs-hold:disabled{opacity:.45;cursor:not-allowed}',
    '.mgs-note{margin-top:5px;color:var(--dim,#93a0b5);font-size:.78em}',
    '.mgs-notice{visibility:hidden;margin-top:8px;padding:6px 10px;border-radius:8px;border:1px solid var(--bad,#ff6b6b);background:rgba(255,107,107,.16);color:var(--bad,#ff6b6b);font-weight:700}',
    '.mgs-seen .mgs-notice{visibility:visible;animation:mgs-blink .4s linear infinite alternate}',
    '.mgs-watching .mgs-port{box-shadow:0 0 0 3px var(--acc,#5fb3ff)}',
    '.mgs-seen .mgs-port{box-shadow:0 0 0 3px var(--bad,#ff6b6b),0 0 22px rgba(255,107,107,.4)}',
    '.mgs-eyes{display:none}',
    '.mgs-eyesup .mgs-eyes{display:inline}',
    // 看的人：沒有按鈕，大頭照和說明橫排
    '.mgs-view .mgs-panel,.mgs-view .mgs-hint{display:none}',
    '.mgs-view .mgs-grid{grid-template-columns:1fr}',
    '.mgs-view .mgs-stage{flex-direction:row;justify-content:flex-start;gap:14px}',
    '.mgs-view .mgs-port{width:42%;max-width:180px;flex:none}',
    '.mgs-view .mgs-cap{text-align:left;flex:1 1 0}',
    // 櫃台沒有人
    '.mgs-idle .mgs-grid{display:none}',
    '.mgs-none{display:none;padding:22px 8px;text-align:center;color:var(--dim,#93a0b5);border:1px dashed var(--line,#2c3649);border-radius:12px}',
    '.mgs-idle .mgs-none{display:block}',
    // 姿勢圖層
    '.mgs-p{opacity:0;visibility:hidden;transition:opacity .2s,visibility 0s .2s}',
    '.mgs-p.mgs-show{opacity:1;visibility:visible;transition:opacity .1s}',
    '.mgs-show .mgs-e{animation:mgs-in .3s cubic-bezier(.2,1.5,.4,1) both}',
    '.mgs-show[data-k=nose] .mgs-m{animation:mgs-nose .32s ease-in-out infinite alternate}',
    '.mgs-show[data-k=head] .mgs-m,.mgs-show[data-k=wave] .mgs-m{animation:mgs-x3 .16s ease-in-out infinite alternate}',
    '.mgs-show[data-k=cough] .mgs-m{animation:mgs-cough 1s ease-in-out infinite}',
    '.mgs-show[data-k=cough] .mgs-x{animation:mgs-puff 1s ease-out infinite}',
    '.mgs-show[data-k=wink] .mgs-m{animation:mgs-wink 1s linear infinite}',
    '.mgs-show[data-k=wink] .mgs-x{animation:mgs-puff 1s ease-out infinite}',
    '.mgs-show[data-k=shrug] .mgs-m{animation:mgs-up5 .5s ease-in-out infinite alternate}',
    '.mgs-show[data-k=ear] .mgs-m{animation:mgs-ear .3s ease-in-out infinite alternate}',
    '.mgs-show[data-k=thumb] .mgs-m{animation:mgs-up3 .4s ease-in-out infinite alternate}',
    '.mgs-show[data-k=thumb] .mgs-x{animation:mgs-blink .5s linear infinite alternate}',
    '.mgs-show[data-k=watch] .mgs-m{animation:mgs-up3 .7s ease-in-out infinite alternate}',
    '.mgs-on[data-pose=cough] .mgs-port{animation:mgs-bob 1s ease-in-out infinite}',
    '.mgs-on[data-pose=shrug] .mgs-port{animation:mgs-bob2 .5s ease-in-out infinite alternate}',
    '@keyframes mgs-in{from{transform:translate(0,38px)}to{transform:none}}',
    '@keyframes mgs-pop{from{transform:scale(.8)}to{transform:none}}',
    '@keyframes mgs-cd{from{width:100%}to{width:0}}',
    '@keyframes mgs-nose{from{transform:none}to{transform:translate(-1px,-3px)}}',
    '@keyframes mgs-x3{from{transform:translate(-3px,0)}to{transform:translate(3px,0)}}',
    '@keyframes mgs-up5{from{transform:translate(0,3px)}to{transform:translate(0,-4px)}}',
    '@keyframes mgs-up3{from{transform:none}to{transform:translate(0,-3px)}}',
    '@keyframes mgs-ear{from{transform:none}to{transform:translate(4px,1px)}}',
    '@keyframes mgs-cough{0%,24%,48%,100%{transform:none}12%,36%{transform:translate(0,-3px)}}',
    '@keyframes mgs-puff{0%,24%,48%,100%{opacity:.15}12%,36%{opacity:1}}',
    '@keyframes mgs-wink{0%,8%{opacity:0}14%,58%{opacity:1}66%,100%{opacity:0}}',
    '@keyframes mgs-blink{from{opacity:.35}to{opacity:1}}',
    '@keyframes mgs-bob{0%,24%,48%,100%{transform:none}12%,36%{transform:translateY(3px)}}',
    '@keyframes mgs-bob2{from{transform:none}to{transform:translateY(-3px)}}',
    '@container mgs (max-width:430px){',
    '.mgs-grid{grid-template-columns:1fr;gap:10px}',
    '.mgs-stage{flex-direction:row;justify-content:flex-start;gap:12px}',
    '.mgs-port{width:104px;flex:none}',
    '.mgs-cap{text-align:left}',
    '.mgs-btns{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
    '.mgs-b{padding:6px 8px;gap:6px;font-size:.92em}',
    '}',
    '@media (prefers-reduced-motion:reduce){.mgs-wrap *{animation-duration:.01s!important;animation-iteration-count:1!important}}'
  ].join('\n');

  var mounted = 0;   // 幾個實例掛著（歸零才把 <style> 拿掉）

  // ── 姿勢圖層：跟 core.js 的 face() 同一個座標（viewBox 0 0 100 120），疊在大頭照上 ──
  function arm(c, x1, y1, x2, y2) {
    var d = 'M' + x1 + ',' + y1 + ' L' + x2 + ',' + y2;
    return '<path d="' + d + '" stroke="rgba(0,0,0,.45)" stroke-width="13.5" stroke-linecap="round" fill="none"/>' +
      '<path d="' + d + '" stroke="' + c + '" stroke-width="11" stroke-linecap="round" fill="none"/>';
  }
  function hand(x, y, rx, ry) {
    return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + (rx || 7.6) + '" ry="' + (ry || rx || 7.6) + '" fill="' + SK + '" stroke="' + SKL + '" stroke-width="1.3"/>';
  }
  // 白色的小記號（底下墊一層深色，深淺背景都看得到）
  function mark(d) {
    return '<path d="' + d + '" stroke="rgba(0,0,0,.55)" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="' + d + '" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>';
  }
  function pose(k, moving, extra) {
    return '<g class="mgs-p" data-k="' + k + '"><g class="mgs-e"><g class="mgs-m">' + moving + '</g></g>' +
      (extra ? '<g class="mgs-x">' + extra + '</g>' : '') + '</g>';
  }
  function overlay(looks) {
    var c = SLEEVE[looks && looks.上衣] || '#8a93a3', shades = looks && looks.眼鏡 === '墨鏡', o = [];
    o.push(pose('nose',
      arm(c, 82, 130, 62, 79) +
      '<path d="M57,70 L52,63.5" stroke="' + SKL + '" stroke-width="7.4" stroke-linecap="round"/>' +
      hand(60, 74) +
      '<path d="M57,70 L52,63.5" stroke="' + SK + '" stroke-width="5" stroke-linecap="round"/>'));
    o.push(pose('head',
      arm(c, 97, 130, 78, 34) + hand(73, 24),
      mark('M56,6 L53,1 M63,5 L63,0 M84,12 L89,8')));
    o.push(pose('cough',
      arm(c, 76, 130, 58, 88) + hand(51, 78, 8.6, 7.6) +
      '<path d="M46,74 L46,80 M50,73.5 L50,80.5 M54,74 L54,80" stroke="' + SKL + '" stroke-width="1.1" stroke-linecap="round"/>',
      mark('M66,70 L74,66 M67,76 L77,76 M66,82 L74,86')));
    o.push(pose('wink',
      shades
        ? '<path d="M55,48 L60,56 M60,48 L65,56" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'
        : '<ellipse cx="60" cy="53" rx="6.4" ry="6.2" fill="' + SK + '"/><path d="M54.5,53 Q60,58.5 65.5,53" stroke="' + HR + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
      '<path d="M84,36 l2.2,5.3 5.3,2.2 -5.3,2.2 -2.2,5.3 -2.2,-5.3 -5.3,-2.2 5.3,-2.2z" fill="#fff" stroke="rgba(0,0,0,.55)" stroke-width="1"/>'));
    o.push(pose('shrug',
      arm(c, 15, 130, 12, 96) + arm(c, 85, 130, 88, 96) + hand(11, 87, 9, 5.6) + hand(89, 87, 9, 5.6),
      mark('M20,72 Q24,66 30,66 M80,72 Q76,66 70,66')));
    o.push(pose('ear',
      arm(c, 99, 130, 89, 74) +
      '<circle cx="78" cy="61" r="3.6" fill="' + SK + '" stroke="' + SKL + '" stroke-width="1.1"/>' + hand(85, 65, 7),
      mark('M93,52 L97,49 M94,60 L99,60')));
    o.push(pose('thumb',
      arm(c, 98, 130, 86, 106) +
      '<rect x="72.5" y="70" width="8" height="20" rx="4" fill="' + SK + '" stroke="' + SKL + '" stroke-width="1.3"/>' +
      '<rect x="70" y="84" width="20" height="17" rx="6" fill="' + SK + '" stroke="' + SKL + '" stroke-width="1.3"/>' +
      '<path d="M82,89 L89,89 M82,93 L89,93 M82,97 L88,97" stroke="' + SKL + '" stroke-width="1.1" stroke-linecap="round"/>',
      mark('M64,70 L60,66 M76.5,63 L76.5,58 M89,70 L93,66')));
    o.push(pose('watch',
      arm(c, 99, 118, 46, 103) + hand(37, 101, 7.8, 7.2) +
      '<rect x="50.5" y="95" width="9" height="17" rx="2" fill="#23262d" transform="rotate(-15 55 103.5)"/>' +
      '<circle cx="55" cy="103.5" r="6" fill="#fff" stroke="#23262d" stroke-width="1.8"/>' +
      '<path d="M55,103.5 L55,99.6 M55,103.5 L57.8,105" stroke="#23262d" stroke-width="1.3" stroke-linecap="round"/>',
      mark('M44,88 L41,84 M55,90 L55,85 M66,91 L69,87')));
    o.push('<g class="mgs-eyes">' + (shades
      ? mark('M33,41 L46,39 M54,39 L67,41')
      : '<circle cx="40" cy="53" r="6" fill="#fff"/><circle cx="60" cy="53" r="6" fill="#fff"/><circle cx="41.5" cy="49.6" r="2.6" fill="#222"/><circle cx="61.5" cy="49.6" r="2.6" fill="#222"/>') + '</g>');
    o.push(pose('wave', arm(c, 99, 130, 88, 70) + hand(86, 59, 7.6, 8.6)));
    return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + o.join('') + '</svg>';
  }

  function create() {
    var root = null, api = null, wrap = null, el = {};
    var sigFace = null, sigBtns = null, curName = null;
    var poseSeq = null, poseKey = '', poseG = '', poseTimer = 0;
    var pendG = '', pendTimer = 0, prevCooling = false, st = null;
    var holding = '', sigScr = null;

    function text(node, s) { if (node.textContent !== s) node.textContent = s; }
    function flag(node, cls, on) { if (node.classList.contains(cls) !== !!on) node.classList.toggle(cls, !!on); }

    function showPose() {
      var ps = el.port.querySelectorAll('.mgs-p'), i;
      for (i = 0; i < ps.length; i++) ps[i].classList.remove('mgs-show');
      if (!poseKey) return;
      void el.port.offsetWidth;   // 讓同一個動作連比兩次也會重播
      for (i = 0; i < ps.length; i++) if (ps[i].getAttribute('data-k') === poseKey) ps[i].classList.add('mgs-show');
    }
    function capIdle() { text(el.act, st && st.active ? '選一個動作' : '沒有動作'); }
    function stopPose() {
      clearTimeout(poseTimer); poseTimer = 0;
      if (!poseKey) return;
      poseKey = ''; poseG = '';
      wrap.classList.remove('mgs-on'); wrap.removeAttribute('data-pose');
      showPose(); capIdle();
    }
    function play(g, ms) {
      clearTimeout(poseTimer);
      poseKey = KEY[g] || 'wave'; poseG = g;
      wrap.classList.remove('mgs-on'); showPose();
      wrap.setAttribute('data-pose', poseKey); wrap.classList.add('mgs-on');
      text(el.act, '🙋 ' + g);
      api.play('pop');
      poseTimer = setTimeout(stopPose, ms);
    }
    function refreshButtons() {
      var off = !st || !st.active || !!st.cooling || !!pendG, bs = el.btns.children, i, b;
      for (i = 0; i < bs.length; i++) {
        b = bs[i];
        if (b.disabled !== off) b.disabled = off;
        flag(b, 'mgs-sent', pendG && b.getAttribute('data-g') === pendG);
      }
      text(el.tip, st && st.cooling ? '剛比完，等一下才能再比…' : pendG ? '比出去了…' : '');
    }
    function clearPending() { clearTimeout(pendTimer); pendTimer = 0; pendG = ''; }

    function onClick(e) {
      var b = e.target && e.target.closest ? e.target.closest('.mgs-b') : null;
      if (!b || b.disabled || !st || !st.active || st.cooling || pendG) return;
      pendG = b.getAttribute('data-g');
      api.send({ a: 'gesture', g: pendG });
      api.play('tick');
      refreshButtons();
      pendTimer = setTimeout(function () { clearPending(); refreshButtons(); }, PENDING_MS);
    }

    // 按住類操作：放開的 listener 掛在 document，root 被拔掉再接回也收得到
    function holdEnd() {
      if (!holding) return;
      var act = holding; holding = '';
      document.removeEventListener('pointerup', holdEnd);
      document.removeEventListener('pointercancel', holdEnd);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', holdEnd);
      if (api) api.send({ a: act, on: 0 });
      if (wrap) refreshHold();
    }
    function holdStart(b) {
      if (holding || !b || b.disabled) return;
      holding = b.getAttribute('data-act');
      document.addEventListener('pointerup', holdEnd);
      document.addEventListener('pointercancel', holdEnd);
      document.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', holdEnd);
      api.send({ a: holding, on: 1 });
      refreshHold();
    }
    function holdBtn(e) { return e.target && e.target.closest ? e.target.closest('.mgs-hold') : null; }
    function onDown(e) { var b = holdBtn(e); if (b && (e.button || 0) === 0) { e.preventDefault(); holdStart(b); } }
    function onKeyDown(e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { var b = holdBtn(e); if (b) { e.preventDefault(); holdStart(b); } } }
    function onKeyUp(e) { if (e.key === ' ' || e.key === 'Enter') holdEnd(); }
    function onMenu(e) { if (holdBtn(e)) e.preventDefault(); }
    function refreshHold() {
      var pk = st && st.peek, w = st && st.watch, t;
      flag(el.peekBtn, 'mgs-down', holding === 'peek');
      flag(el.watchBtn, 'mgs-down', holding === 'watch');
      if (pk) {
        t = pk.on ? '👀 正在看螢幕…（放開就低頭）' : pk.cooling && holding !== 'peek' ? '剛看過，等一下…' : '👀 按住：抬頭看螢幕';
        text(el.peekBtn, t);
        t = !pk.on && !!pk.cooling && holding !== 'peek';
        if (el.peekBtn.disabled !== t) el.peekBtn.disabled = t;
      }
      if (w) {
        t = w.blocked ? '你正在回頭看螢幕，看不到旅客' : w.on ? '🔍 正在盯著旅客…' : '🔍 按住：盯著旅客的眼睛';
        text(el.watchBtn, t);
        if (el.watchBtn.disabled !== !!w.blocked) el.watchBtn.disabled = !!w.blocked;
      }
    }

    function mount(r, a) {
      if (wrap) unmount();
      root = r; api = a;
      if (!document.getElementById(STYLE_ID)) {
        var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s);
      }
      mounted++;
      wrap = document.createElement('div');
      wrap.className = 'mgs-wrap mgs-idle mgs-view';
      wrap.innerHTML =
        '<div class="mgs-head"><span class="mgs-title"></span><span class="mgs-hint">所有人都看得到，海關也是。</span></div>' +
        '<div class="mgs-none">櫃台前沒有旅客</div>' +
        '<div class="mgs-grid">' +
          '<div class="mgs-stage"><div class="mgs-port"></div>' +
            '<div class="mgs-cap"><small>櫃台前的旅客</small><b class="mgs-name"></b><span class="mgs-act"></span>' +
              '<div class="mgs-watch"><button type="button" class="mgs-hold" data-act="watch"></button><div class="mgs-notice">👀 旅客正在看螢幕…</div></div></div></div>' +
          '<div class="mgs-panel"><div class="mgs-btns"></div><div class="mgs-cd"><i></i></div><div class="mgs-tip"></div>' +
            '<div class="mgs-peek"><div class="mgs-sub">📺 海關背後的螢幕<small class="mgs-cnt"></small></div><div class="mgs-scr"></div>' +
              '<button type="button" class="mgs-hold" data-act="peek"></button><div class="mgs-note">抬頭的時候，海關如果正盯著你就會發現。</div></div></div>' +
        '</div>';
      el = {
        title: wrap.querySelector('.mgs-title'), port: wrap.querySelector('.mgs-port'), name: wrap.querySelector('.mgs-name'),
        act: wrap.querySelector('.mgs-act'), btns: wrap.querySelector('.mgs-btns'), tip: wrap.querySelector('.mgs-tip'),
        scr: wrap.querySelector('.mgs-scr'), cnt: wrap.querySelector('.mgs-cnt'),
        peekBtn: wrap.querySelector('[data-act=peek]'), watchBtn: wrap.querySelector('[data-act=watch]')
      };
      wrap.addEventListener('click', onClick);
      wrap.addEventListener('pointerdown', onDown);
      wrap.addEventListener('keydown', onKeyDown);
      wrap.addEventListener('contextmenu', onMenu);
      root.appendChild(wrap);
    }

    function update(s) {
      if (!wrap || !s) return;
      st = s;
      var active = !!s.active, has = !!(s.name && s.looks), cooling = !!s.cooling, sig;
      flag(wrap, 'mgs-view', !active);
      flag(wrap, 'mgs-idle', !has);
      text(el.title, active ? '🙋 比動作' : '🙋 旅客的動作');

      var name = has ? String(s.name) : '';
      if (name !== curName) { curName = name; text(el.name, name); stopPose(); clearPending(); }

      if (has) {
        sig = JSON.stringify([s.looks, s.deco || null]);
        if (sig !== sigFace) {
          sigFace = sig;
          var bg = (s.deco && typeof DECO_BG !== 'undefined' && DECO_BG[s.deco.bg]) || '#cfd8e6';
          el.port.style.background = bg;
          el.port.innerHTML = api.face(s.looks, 180, bg, s.deco || undefined) + overlay(s.looks);
          showPose();
        }
      }

      sig = (s.gestures || []).join('\n');
      if (sig !== sigBtns) {
        sigBtns = sig;
        el.btns.innerHTML = (s.gestures || []).map(function (g) {
          return '<button type="button" class="mgs-b" data-g="' + api.esc(g) + '"><i>' + ICON[KEY[g] || 'wave'] + '</i><span>' + api.esc(g) + '</span></button>';
        }).join('');
      }

      // 主機有送 pose 就照它播（比的人、看的人都一樣）；沒送的話，比的人靠「冷卻開始」知道自己比成功了
      var p = s.pose;
      if (p && p.g) {
        if (p.seq !== poseSeq) {
          poseSeq = p.seq;
          var left = p.left == null ? POSE_MS : +p.left;
          if (left > 150) play(String(p.g), Math.min(left, POSE_MS * 3));
        }
      } else if (has && cooling && !prevCooling && pendG) {
        play(pendG, POSE_MS);
      }
      if (cooling) clearPending();
      if (cooling !== prevCooling) { prevCooling = cooling; flag(wrap, 'mgs-cooling', cooling); }
      if (!poseKey) capIdle();
      refreshButtons();

      // 抬頭看螢幕（旅客）與盯著旅客（海關）：主機有送 peek／watch 才出現
      var pk = active && has ? s.peek : null, w = !active && has ? s.watch : null;
      if (holding && !(holding === 'peek' ? pk : w)) holdEnd();
      flag(wrap, 'mgs-canpeek', pk);
      flag(wrap, 'mgs-canwatch', w);
      flag(wrap, 'mgs-peeking', pk && pk.on);
      flag(wrap, 'mgs-watching', w && w.on);
      flag(wrap, 'mgs-seen', w && w.on && s.notice);
      flag(wrap, 'mgs-eyesup', has && ((pk && pk.on) || (w && w.on && s.notice)));
      if (pk) {
        var scr = pk.on && pk.screens ? pk.screens : null, n = scr ? scr.length : (pk.n || 2);
        sig = scr ? 'on\n' + scr.join('\n') : 'off' + n;
        if (sig !== sigScr) {
          sigScr = sig;
          for (var h = '', i = 0; i < n; i++) h += '<div>' + (scr ? api.esc(scr[i] || '（空白）') : '抬頭才看得到') + '</div>';
          el.scr.innerHTML = h;
        }
        text(el.cnt, pk.count ? '已經看了 ' + pk.count + ' 次' : '');
      }
      refreshHold();
    }

    function unmount() {
      if (!wrap) return;
      holdEnd();
      clearTimeout(poseTimer); clearTimeout(pendTimer);
      wrap.removeEventListener('click', onClick);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('keydown', onKeyDown);
      wrap.removeEventListener('contextmenu', onMenu);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      wrap = null; root = null; api = null; el = {}; st = null;
      sigFace = sigBtns = curName = poseSeq = sigScr = null; poseKey = poseG = pendG = ''; poseTimer = pendTimer = 0; prevCooling = false;
      if (--mounted <= 0) {
        mounted = 0;
        var s = document.getElementById(STYLE_ID);
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
    }

    return { mount: mount, update: update, unmount: unmount };
  }

  window.Mini = window.Mini || {};
  window.Mini.gesture = create();
  // 同一頁要同時放兩份（例如 demo 的「比的人」和「看的人」）時用
  window.Mini.gesture.create = create;
})();
