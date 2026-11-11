/**
 * Overlay scrollbar: native bars hidden; floating #D9D9D9 thumb shown while scrolling.
 * Does not reserve layout width — rail is position:fixed over content.
 */
(function (global) {
  'use strict';
  if (global.__AO_OSB__) return;
  global.__AO_OSB__ = true;

  var THICKNESS = 4;
  var INSET = 2;
  var HIDE_MS = 900;
  var MIN_THUMB = 24;

  /** @type {Map<Element, { hideTimer: number, vy?: object, vx?: object }>} */
  var active = new Map();

  function scrollingRoot() {
    return document.scrollingElement || document.documentElement;
  }

  function resolveTarget(t) {
    if (t === document || t === document.documentElement || t === document.body) {
      return scrollingRoot();
    }
    return t instanceof Element ? t : null;
  }

  function overflowAllows(el, axis) {
    if (el === scrollingRoot() || el === document.documentElement || el === document.body) {
      return true;
    }
    var st = getComputedStyle(el);
    var v = axis === 'y' ? st.overflowY : st.overflowX;
    return v === 'auto' || v === 'scroll' || v === 'overlay';
  }

  function canScroll(el, axis) {
    if (axis === 'y') return el.scrollHeight > el.clientHeight + 1;
    return el.scrollWidth > el.clientWidth + 1;
  }

  function ensure(el, axis) {
    var rec = active.get(el);
    if (!rec) {
      rec = { hideTimer: 0 };
      active.set(el, rec);
    }
    var key = axis === 'y' ? 'vy' : 'vx';
    if (rec[key]) return rec[key];

    var rail = document.createElement('div');
    rail.className = 'ao-osb-rail' + (axis === 'x' ? ' is-x' : '');
    rail.setAttribute('aria-hidden', 'true');
    var thumb = document.createElement('div');
    thumb.className = 'ao-osb-thumb';
    rail.appendChild(thumb);
    (document.body || document.documentElement).appendChild(rail);
    rec[key] = { rail: rail, thumb: thumb, axis: axis };
    return rec[key];
  }

  function layout(el, meta) {
    var rect = el.getBoundingClientRect();
    var rail = meta.rail;
    var thumb = meta.thumb;

    if (meta.axis === 'y') {
      var ch = el.clientHeight;
      var sh = el.scrollHeight;
      if (sh <= ch + 1) {
        rail.classList.remove('is-visible');
        return false;
      }
      var track = Math.max(0, ch - INSET * 2);
      var thumbH = Math.max(MIN_THUMB, Math.min(track, (ch / sh) * track));
      var maxTop = Math.max(0, track - thumbH);
      var top = maxTop === 0 ? 0 : (el.scrollTop / (sh - ch)) * maxTop;
      rail.style.top = rect.top + INSET + 'px';
      rail.style.left = rect.right - THICKNESS - INSET + 'px';
      rail.style.height = track + 'px';
      rail.style.width = THICKNESS + 'px';
      thumb.style.height = thumbH + 'px';
      thumb.style.width = '100%';
      thumb.style.transform = 'translateY(' + top + 'px)';
      return true;
    }

    var cw = el.clientWidth;
    var sw = el.scrollWidth;
    if (sw <= cw + 1) {
      rail.classList.remove('is-visible');
      return false;
    }
    var trackX = Math.max(0, cw - INSET * 2);
    var thumbW = Math.max(MIN_THUMB, Math.min(trackX, (cw / sw) * trackX));
    var maxLeft = Math.max(0, trackX - thumbW);
    var left = maxLeft === 0 ? 0 : (el.scrollLeft / (sw - cw)) * maxLeft;
    rail.style.left = rect.left + INSET + 'px';
    rail.style.top = rect.bottom - THICKNESS - INSET + 'px';
    rail.style.width = trackX + 'px';
    rail.style.height = THICKNESS + 'px';
    thumb.style.width = thumbW + 'px';
    thumb.style.height = '100%';
    thumb.style.transform = 'translateX(' + left + 'px)';
    return true;
  }

  function teardown(el) {
    var rec = active.get(el);
    if (!rec) return;
    clearTimeout(rec.hideTimer);
    ['vy', 'vx'].forEach(function (k) {
      var meta = rec[k];
      if (meta && meta.rail && meta.rail.parentNode) meta.rail.parentNode.removeChild(meta.rail);
    });
    active.delete(el);
  }

  function flash(el) {
    var rec = active.get(el);
    if (!rec) return;

    ['vy', 'vx'].forEach(function (k) {
      var meta = rec[k];
      if (!meta) return;
      if (layout(el, meta)) meta.rail.classList.add('is-visible');
      else meta.rail.classList.remove('is-visible');
    });

    clearTimeout(rec.hideTimer);
    rec.hideTimer = setTimeout(function () {
      var r = active.get(el);
      if (!r) return;
      ['vy', 'vx'].forEach(function (k) {
        if (r[k]) r[k].rail.classList.remove('is-visible');
      });
    }, HIDE_MS);
  }

  function relayoutVisible() {
    active.forEach(function (rec, el) {
      if (!el.isConnected) {
        teardown(el);
        return;
      }
      ['vy', 'vx'].forEach(function (k) {
        var meta = rec[k];
        if (!meta || !meta.rail.classList.contains('is-visible')) return;
        layout(el, meta);
      });
    });
  }

  function onScroll(e) {
    var el = resolveTarget(e.target);
    if (!el) {
      relayoutVisible();
      return;
    }
    if (el.hasAttribute && el.hasAttribute('data-no-osb')) return;
    if (el.closest && el.closest('[data-no-osb]')) return;

    var needY = overflowAllows(el, 'y') && canScroll(el, 'y');
    var needX = overflowAllows(el, 'x') && canScroll(el, 'x');
    if (needY) ensure(el, 'y');
    if (needX) ensure(el, 'x');
    if (needY || needX) flash(el);
    relayoutVisible();
  }

  function boot() {
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', relayoutVisible);
    window.addEventListener('orientationchange', relayoutVisible);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : this);
