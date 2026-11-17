/* Pip mobile bridge: lets a native app (Swift today) drive the mascot.
   Native -> JS: window.Pip.<method>(...)   JS -> native: webkit.messageHandlers.pip.postMessage({type, ...}) */
(function () {
  'use strict';
  var post = function (type, data) {
    var msg = Object.assign({ type: type }, data || {});
    try { window.webkit.messageHandlers.pip.postMessage(msg); } catch (e) { (window.__pipOutbox = window.__pipOutbox || []).push(msg); }
  };
  var el = null, kbTop = null, lastRect = '', target = null, timer = 0;
  var busy = function () { return el && Date.now() - (el._goAt || 0) < 3800; };

  // An invisible stand-in for a native view, so the web mascot can walk to it and point at it
  function stand(r) {
    if (!target) { target = document.createElement('div'); target.setAttribute('aria-hidden', 'true');
      target.style.cssText = 'position:fixed;pointer-events:none;visibility:hidden;margin:0'; document.body.appendChild(target); }
    target.style.left = r.x + 'px'; target.style.top = r.y + 'px'; target.style.width = Math.max(1, r.w) + 'px'; target.style.height = Math.max(1, r.h) + 'px';
    return target;
  }
  // Tell native where the mascot is, so only taps on the mascot reach it and the app stays usable underneath
  function report() {
    if (!el) return;
    var r = el.getBoundingClientRect(), hidden = el.hasAttribute('data-hidden'), box;
    if (hidden) { var left = el.hasAttribute('data-left'); box = { x: left ? r.left : r.right - 52, y: r.bottom - 52, w: 52, h: 52 }; }
    else box = { x: r.left, y: r.top - 30, w: r.width, h: r.height + 30 };   // a little room above for the hide button
    var key = [box.x, box.y, box.w, box.h, hidden].map(function (v) { return typeof v === 'number' ? Math.round(v) : v; }).join(',');
    if (key !== lastRect) { lastRect = key; post('rect', { x: box.x, y: box.y, w: box.w, h: box.h, hidden: hidden }); }
  }
  function kbSpot() {
    if (kbTop == null || !el) return null;
    var s = el._size(), left = el._place().h === 'left';
    return [left ? 10 : innerWidth - s[0] - 10, kbTop - s[1] + 6];
  }

  window.Pip = {
    init: function (cfg) {
      cfg = cfg || {};
      if (el) el.remove();
      el = document.createElement('pip-mascot');
      el.setAttribute('float', '');
      if (cfg.mascot) el.setAttribute('mascot', cfg.mascot);
      if (cfg.position) el.setAttribute('position', cfg.position);
      if (cfg.offset) el.setAttribute('offset', cfg.offset.join(' '));
      if (cfg.size) el.setAttribute('size', String(cfg.size));
      if (cfg.greet) el.setAttribute('greet', '');
      if (cfg.greeting) el.setAttribute('greeting', cfg.greeting);
      if (cfg.hideable === false) el.setAttribute('no-hide', '');
      el.setAttribute('sleep-after', String(cfg.sleepAfter == null ? 30 : cfg.sleepAfter));
      el.setAttribute('avoid', 'false');   // nothing else lives in this layer
      ['ready', 'error', 'statechange', 'pip:hide', 'pip:show'].forEach(function (n) {
        el.addEventListener(n, function (e) { post(n.replace('pip:', ''), { state: e.detail && e.detail.state }); setTimeout(report, 60); });
      });
      el.addEventListener('pointerdown', function () { post('tap'); });
      document.body.appendChild(el);
      el._kbSpot = kbSpot;
      clearInterval(timer); timer = setInterval(report, 50);
      return true;
    },
    setOffset: function (x, y) { if (el) el.setAttribute('offset', x + ' ' + y); },
    react: function (s, ms) { if (el) el.react(s, ms || 2400); },
    setState: function (s) { if (el) el.setState(s); },
    say: function (t, ms) { if (el) el.say(t, { hold: ms || 2400 }); },
    lookAt: function (x, y) { if (el) el.lookAt(x, y); },
    cover: function (on) { if (el) el.cover(!!on); },
    goTo: function (r, opts) { if (el && el.goTo) return el.goTo(stand(r), opts || {}); },
    home: function () { if (el && el.home) el.home(); },
    hide: function () { if (el && el.hideMascot) el.hideMascot(); },
    show: function () { if (el && el.showMascot) el.showMascot(); },
    // The on-screen keyboard's top edge in points (null when it closes). Pip sits on it.
    keyboard: function (top) {
      kbTop = (top == null || top <= 0) ? null : top;
      if (!el || !el._m) return;
      if (kbTop == null) { if (!busy()) el.home(); return; }
      if (busy()) return;
      var p = kbSpot(); el.walkTo(p[0], p[1], { ms: 360 });
    }
  };
  post('loaded');
})();
