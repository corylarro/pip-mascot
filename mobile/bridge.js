/* Pip mobile bridge: lets a native app (Swift today) drive the mascot.
   Native -> JS: window.Pip.<method>(...)   JS -> native: webkit.messageHandlers.pip.postMessage({type, ...}) */
(function () {
  'use strict';
  var post = function (type, data) {
    var msg = Object.assign({ type: type }, data || {});
    try { window.webkit.messageHandlers.pip.postMessage(msg); } catch (e) { (window.__pipOutbox = window.__pipOutbox || []).push(msg); }
  };
  // Forward errors and logs to Xcode's console while testing
  window.addEventListener('error', function (e) { post('log', { level: 'error', text: String(e.message) + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')' }); });
  window.addEventListener('unhandledrejection', function (e) { post('log', { level: 'error', text: 'Unhandled: ' + String(e.reason && e.reason.message || e.reason) }); });
  ['log', 'warn', 'error'].forEach(function (k) { var orig = console[k]; console[k] = function () { try { post('log', { level: k, text: Array.prototype.map.call(arguments, String).join(' ') }); } catch (x) {} return orig.apply(console, arguments); }; });
  var webpOK = null;
  function testWebP(done) {
    var img = new Image(), finished = false;
    var finish = function (ok) { if (!finished) { finished = true; done(ok); } };
    img.onload = function () {
      try {
        var c = document.createElement('canvas'); c.width = c.height = 8; var x = c.getContext('2d'); x.drawImage(img, 0, 0);
        var d = x.getImageData(3, 3, 1, 1).data; finish(d[3] > 40 && d[0] > 120);
      } catch (e) { finish(false); }
    };
    img.onerror = function () { finish(false); };
    setTimeout(function () { finish(false); }, 1500);
    img.src = 'data:image/webp;base64,UklGRjoCAABXRUJQVlA4WAoAAAAwAAAABwAABwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZBTFBIDwAAAAEH0MyICAAE4f/bQ0T/QwBWUDggNAAAABACAJ0BKggACAAAwBIloAJ0ugH4AfgAA8gA/vCbQ/9rP84yn8lX/8mO/kx38mO/+SgAAAA=';
  }
  var el = null, kbTop = null, lastRect = '', target = null, timer = 0;
  var busy = function () { return el && (el._touring || Date.now() - (el._goAt || 0) < 3800); };

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
      // Check this device can decode WebP with transparency; if not, ask the server for PNG
      if (cfg.mascot && webpOK === null) {
        testWebP(function (ok) {
          webpOK = ok;
          if (!ok) { window.PIP_IMAGE_FORMAT = 'png'; post('log', { level: 'log', text: 'WebP not supported here, using PNG images' }); }
          window.Pip.init(cfg);
        });
        return;
      }
      if (el) el.remove();
      el = document.createElement('critter-mascot');
      el.setAttribute('float', '');
      if (cfg.mascot) el.setAttribute('mascot', cfg.mascot);
      if (cfg.position) el.setAttribute('position', cfg.position);
      if (cfg.offset) el.setAttribute('offset', cfg.offset.join(' '));
      if (cfg.size) el.setAttribute('size', String(cfg.size));
      if (cfg.greet) el.setAttribute('greet', '');
      if (cfg.greeting) el.setAttribute('greeting', cfg.greeting);
      if (cfg.hideable === false) el.setAttribute('no-hide', '');
      if (cfg.seasonal) el.setAttribute('seasonal', cfg.seasonal);
      el.setAttribute('sleep-after', String(cfg.sleepAfter == null ? 30 : cfg.sleepAfter));
      el.setAttribute('avoid', 'false');   // nothing else lives in this layer
      ['ready', 'error', 'statechange', 'pip:hide', 'pip:show'].forEach(function (n) {
        el.addEventListener(n, function (e) { post(n.replace('pip:', ''), { state: e.detail && e.detail.state }); setTimeout(report, 60); });
      });
      el.addEventListener('pointerdown', function () { post('tap'); });
      document.body.appendChild(el);
      el._kbSpot = kbSpot;
      post('log', { level: 'log', text: 'mascot created (' + (cfg.mascot ? 'painted ' + cfg.mascot : 'drawn') + '), page ' + innerWidth + 'x' + innerHeight + ', custom element ' + (customElements.get('critter-mascot') ? 'ok' : 'MISSING') });
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
    tour: function (steps, done) {
      if (!el || !el.tour) return;
      var list = (steps || []).map(function (s) {
        var r = s.r;
        return { text: s.text, mode: s.mode, state: s.state,
          target: { scrollIntoView: function () {}, getBoundingClientRect: function () { return { left: r.x, top: r.y, right: r.x + r.w, bottom: r.y + r.h, width: r.w, height: r.h, x: r.x, y: r.y }; } } };
      });
      return el.tour(list, { done: done || undefined });
    },
    stopTour: function () { if (el && el.stopTour) el.stopTour(); },
    play: function (steps, values) { if (el && el.play) el.play(steps || [], values || {}); },
    moment: function (name, opts) { if (!el || !el.moment) return; opts = opts || {}; if (opts.rect) { opts.at = stand(opts.rect); delete opts.rect; } el.moment(name, opts); },
    season: function (name) { if (el) el.setAttribute('seasonal', name || 'auto'); },
    hide: function () { if (el && el.hideMascot) el.hideMascot(); },
    show: function () { if (el && el.showMascot) el.showMascot(); },
    // The on-screen keyboard's top edge in points (null when it closes). Pip sits on it.
    keyboard: function (top) {
      kbTop = (top == null || top <= 0) ? null : top;
      if (el) el._kbTop = kbTop;
      if (!el || !el._m) return;
      if (kbTop == null) { if (!busy()) el.home(); return; }
      if (busy()) return;
      var p = kbSpot(); el.walkTo(p[0], p[1], { ms: 360 });
    }
  };
  post('loaded');
})();
