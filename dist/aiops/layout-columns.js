/* Workbench column controls: resize without rebuilding the pane contents. */
(function (global) {
  'use strict';
  var navWidth = 256, navOpen = true, cuiWidth = null, drag = null;
  // Leave room above the resource panel's 680px compact-layout breakpoint.
  var DEFAULT_RAIL_WIDTH = 800;
  var compactNavOpen = false;
  var animating = false, motionFrame = null, motionTimer = null;
  var collapsedNav = document.getElementById('aiopsCollapsedNav');
  function app() { return document.querySelector('.aiops-app'); }
  function side() { return document.querySelector('.aiops-side'); }
  function compact() { return global.matchMedia('(max-width: 760px)').matches; }
  function navVisible() { return compact() ? compactNavOpen : navOpen; }
  function split() { return document.querySelector('.resource-split'); }
  function tr(zh, en) { return document.documentElement.lang === 'en' ? en : zh; }
  function clamp(value, min, max) { return Math.round(Math.max(min, Math.min(Math.max(min, max), value))); }
  function railWidth(room) { return clamp(cuiWidth == null ? DEFAULT_RAIL_WIDTH : cuiWidth, 220, room); }
  function layout() {
    var el = split();
    return el ? global.AIOpsResources.columnLayout(el.dataset.kind) : null;
  }
  function bounds(kind) {
    var el = split(), data = layout(), room = app().clientWidth;
    if (kind === 'nav') {
      var center = el && !el.classList.contains('is-max') ? (data.min || 300) + 320 : app().classList.contains('is-rail-open') ? 620 : 400;
      return { min: 224, max: Math.max(224, Math.min(400, room - center)) };
    }
    if (kind === 'resource') return { min: data.min, max: Math.max(data.min, el.clientWidth - 320) };
    return { min: 220, max: Math.max(220, room - (navVisible() ? side().getBoundingClientRect().width : 0) - 400) };
  }
  function separator(id, kind, label) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; el.className = 'aiops-column-resize'; el.dataset.columnResize = kind; el.setAttribute('role', 'separator'); el.setAttribute('aria-orientation', 'vertical'); el.tabIndex = 0; }
    el.setAttribute('aria-label', label); el.title = label; return el;
  }
  function updateAria(el, kind, width) {
    var range = bounds(kind); el.setAttribute('aria-valuemin', range.min); el.setAttribute('aria-valuemax', range.max); el.setAttribute('aria-valuenow', Math.round(width));
  }
  function setResourceWidth(width, remember) {
    var el = split(); if (!el) return;
    var range = bounds('resource'), value = clamp(width, range.min, range.max);
    global.AIOpsResources.resizeColumn(el.dataset.kind, value, remember);
    el.style.setProperty('--resource-list-width', value + 'px');
    el.style.setProperty('--resource-list-min', range.min + 'px');
  }
  function collapsedHeader() {
    if (app().classList.contains('is-rail-max')) return document.querySelector('#cuiRail .right-panel-head');
    var el = split();
    if (el) return el.querySelector(el.classList.contains('is-max') ? '.resource-panel-head' : '.resource-list > .page-heading, .resource-workspace .cui-head');
    return document.querySelector('#pageRoot .home-top, #pageRoot .cui-head, #pageRoot .analysis-sticky-chrome > .page-heading, #pageRoot .page > .page-heading, #pageRoot .notify-head') || document.querySelector('#pageRoot .page');
  }
  function normalize() {
    if (!app()) return;
    if (!compact()) compactNavOpen = false;
    var visible = navVisible();
    var range = bounds('nav');
    app().style.setProperty('--sidebar-w', visible ? clamp(navWidth, range.min, range.max) + 'px' : '0px');
    app().classList.toggle('is-nav-collapsed', !visible);
    app().classList.toggle('is-mobile-nav-open', compact() && visible);
    side().hidden = !visible && !animating;
    side().inert = !visible;
    side().setAttribute('aria-hidden', String(!visible));
    var header = visible ? app() : collapsedHeader();
    if (header && collapsedNav.parentNode !== header) header.insertBefore(collapsedNav, header.firstChild);
    collapsedNav.hidden = visible || !header;
    var home = document.getElementById('aiopsCollapsedHome');
    home.hidden = true;
    home.setAttribute('aria-label', tr('回到首页', 'Back to Workbench')); home.title = home.getAttribute('aria-label');
    var close = document.getElementById('aiopsNavToggle'), open = document.getElementById('aiopsNavOpen');
    if (close) { close.setAttribute('aria-label', tr('收起左侧边栏', 'Collapse sidebar')); close.title = close.getAttribute('aria-label'); close.setAttribute('aria-expanded', String(visible)); }
    if (open) { open.hidden = visible; open.setAttribute('aria-label', tr('展开左侧边栏', 'Open sidebar')); open.title = open.getAttribute('aria-label'); }
    var el = split(), data = layout();
    if (el && !el.classList.contains('is-max')) setResourceWidth(data.width, false);
    if (app().classList.contains('is-rail-open') && !app().classList.contains('is-rail-max')) {
      var railRange = bounds('cui'); app().style.setProperty('--rail-w', railWidth(railRange.max) + 'px');
    }
    updateHandles();
  }
  function cancelMotionTimers() {
    cancelAnimationFrame(motionFrame); clearTimeout(motionTimer);
    motionFrame = motionTimer = null;
  }
  function finishMotion() {
    if (!animating) return;
    cancelMotionTimers(); animating = false;
    app().classList.remove('is-column-toggling');
    var rail = document.getElementById('cuiRail');
    if (rail && !app().classList.contains('is-rail-open')) rail.hidden = true;
    normalize();
    window.dispatchEvent(new Event('resize'));
  }
  function animateColumns(update) {
    if (global.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches) {
      finishMotion(); update(); window.dispatchEvent(new Event('resize')); return;
    }
    cancelMotionTimers(); animating = true;
    app().classList.add('is-column-toggling');
    // Commit the current tracks before changing their target widths. CSS can also reverse an in-flight toggle.
    getComputedStyle(app()).gridTemplateColumns;
    update();
    function followDividers() {
      if (!animating) return;
      updateHandles(); motionFrame = requestAnimationFrame(followDividers);
    }
    motionFrame = requestAnimationFrame(followDividers);
    motionTimer = setTimeout(finishMotion, 280);
  }
  document.addEventListener('transitionend', function (event) {
    if (event.target === app() && event.propertyName === 'grid-template-columns') finishMotion();
  });
  function updateHandles() {
    var left = separator('aiopsNavResize', 'nav', tr('调整左侧边栏宽度', 'Resize navigation'));
    if (!left.isConnected) document.body.appendChild(left);
    left.hidden = !navVisible() || getComputedStyle(side()).display === 'none';
    left.style.left = side().getBoundingClientRect().right - 4 + 'px';
    updateAria(left, 'nav', side().getBoundingClientRect().width);
    var el = split();
    if (el) {
      var middle = separator('aiopsResourceResize', 'resource', tr('调整中间栏和右侧边栏宽度', 'Resize middle and detail panes'));
      if (!middle.isConnected) el.appendChild(middle);
      middle.hidden = el.classList.contains('is-max');
      updateAria(middle, 'resource', layout().width);
    }
    var rail = document.getElementById('cuiRail'), right = separator('aiopsCuiResize', 'cui', tr('调整右侧边栏宽度', 'Resize agent panel'));
    if (!right.isConnected) document.body.appendChild(right);
    right.hidden = !rail || rail.hidden || app().classList.contains('is-rail-max');
    if (!right.hidden) { right.style.left = rail.getBoundingClientRect().left - 4 + 'px'; updateAria(right, 'cui', rail.getBoundingClientRect().width); }
  }
  function change(kind, value) {
    finishMotion();
    var range = bounds(kind), next = clamp(value, range.min, range.max);
    if (kind === 'nav') navWidth = next;
    else if (kind === 'resource') setResourceWidth(next, true);
    else cuiWidth = next;
    normalize();
  }
  function finish() {
    if (!drag) return;
    drag.handle.classList.remove('is-active'); drag = null;
    document.body.classList.remove('is-col-resizing');
    window.dispatchEvent(new Event('resize'));
  }
  document.addEventListener('pointerdown', function (event) {
    var handle = event.target.closest('[data-column-resize]');
    if (!handle || event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    finishMotion();
    var kind = handle.dataset.columnResize;
    drag = { kind: kind, handle: handle, start: kind === 'nav' ? navWidth : kind === 'resource' ? layout().width : document.getElementById('cuiRail').getBoundingClientRect().width };
    handle.classList.add('is-active'); document.body.classList.add('is-col-resizing'); handle.setPointerCapture(event.pointerId);
  }, true);
  window.addEventListener('pointermove', function (event) {
    if (!drag) return;
    var value = drag.kind === 'nav' ? event.clientX - app().getBoundingClientRect().left : drag.kind === 'resource' ? event.clientX - split().getBoundingClientRect().left : app().getBoundingClientRect().right - event.clientX;
    change(drag.kind, value);
  });
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  document.addEventListener('keydown', function (event) {
    if (drag && event.key === 'Escape') { change(drag.kind, drag.start); finish(); return; }
    var handle = event.target.closest('[data-column-resize]');
    if (!handle || ['ArrowLeft','ArrowRight','Home','End'].indexOf(event.key) < 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    var kind = handle.dataset.columnResize, range = bounds(kind), value = Number(handle.getAttribute('aria-valuenow'));
    var delta = (event.key === 'ArrowRight' ? 16 : -16) * (kind === 'cui' ? -1 : 1);
    change(kind, event.key === 'Home' ? range.min : event.key === 'End' ? range.max : value + delta);
    window.dispatchEvent(new Event('resize'));
  }, true);
  document.addEventListener('dblclick', function (event) {
    var handle = event.target.closest('[data-column-resize]'); if (!handle) return;
    change(handle.dataset.columnResize, handle.dataset.columnResize === 'nav' ? 256 : handle.dataset.columnResize === 'resource' ? bounds('resource').min : DEFAULT_RAIL_WIDTH);
  });
  document.addEventListener('click', function (event) {
    var button = event.target.closest('#aiopsNavToggle, #aiopsNavOpen');
    if (!button) {
      if (compactNavOpen && (!event.target.closest('.aiops-side') || event.target.closest('[data-page]'))) { compactNavOpen = false; normalize(); }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    animateColumns(function () {
      if (compact()) compactNavOpen = !compactNavOpen;
      else navOpen = !navOpen;
      normalize();
    });
    document.getElementById(navVisible() ? 'aiopsNavToggle' : 'aiopsNavOpen').focus({ preventScroll: true });
  }, true);
  document.addEventListener('keydown', function (event) {
    if (compactNavOpen && event.key === 'Escape') {
      compactNavOpen = false; normalize();
      document.getElementById('aiopsNavOpen').focus({ preventScroll: true });
    }
  });
  window.addEventListener('resize', normalize);
  global.AIOpsColumns = {
    afterRender: normalize,
    animate: animateColumns,
    isAnimating: function () { return animating; },
    savedRailWidth: function () { return cuiWidth; },
    restoreRailWidth: function (width) { cuiWidth = width == null ? null : width; },
    railWidth: railWidth
  };
})(window);
