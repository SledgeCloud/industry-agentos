/* Shared module tabs for the native AIOps shell; resource-detail tabs stay independent. */
(function (global) {
  'use strict';
  var supported = ['工作台', '定时任务', '线上会话', '产出物', '成本分析', '健康度分析', '用户行为分析', '本体知识运营', '自定义看板', '评测实验', '评测集', '业务任务', '统一评估器', '评测任务', '离线评估器', '在线评估器', '分析任务', '消息通知', 'Agent评测'];
  var host = {}, tabs = [], views = new Map(), activePage = null, pending = null, focusPage = null, serial = 0;
  function owner(page) {
    if (page === '产出物详情') return '产出物';
    return supported.indexOf(page) >= 0 ? page : null;
  }
  function currentOwner() { return typeof host.currentPage === 'function' ? owner(host.currentPage()) : activePage; }
  function find(page) { return tabs.filter(function (tab) { return tab.page === page; })[0] || null; }
  function ensure(page) {
    var tab = find(page);
    if (!tab) { tab = { page: page, id: 'aiops-page-tab-' + (++serial) }; tabs.push(tab); }
    return tab;
  }
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function label(page) { var value = typeof host.label === 'function' ? host.label(page) : page; return value === '统一评估器' ? '评估器' : value; }
  function captureCurrent() {
    var page = currentOwner();
    // In particular, closing the active tab must not recapture and recreate its view.
    if (!page || !find(page) || typeof host.capture !== 'function') return null;
    var snapshot = host.capture(page);
    if (snapshot != null) views.set(page, snapshot);
    return snapshot == null ? null : snapshot;
  }
  function beforeNavigate(page, options) {
    options = options || {};
    if (options.capture !== false) captureCurrent();
    var destination = owner(page), existed = destination && !!find(destination);
    pending = null;
    if (!destination) { activePage = null; return null; }
    ensure(destination); activePage = destination;
    if (existed && options.resume !== false && views.has(destination)) pending = { page: destination, snapshot: views.get(destination) };
    return pending ? pending.snapshot : null;
  }
  function restoreView(page) {
    var destination = owner(page);
    if (!pending || pending.page !== destination) return false;
    var saved = pending; pending = null;
    if (typeof host.restore !== 'function') return false;
    host.restore(destination, saved.snapshot); return true;
  }
  function markup() {
    return tabs.map(function (tab) {
      var name = label(tab.page), selected = tab.page === activePage, focusable = selected || (!activePage && tabs[0] === tab), icon = typeof host.icon === 'function' ? host.icon(tab.page) || '' : '';
      return '<div class="aiops-page-tab-wrap aiops-page-tab' + (selected ? ' is-active' : '') + '"><button type="button" class="aiops-page-tab-button" id="' + tab.id + '" role="tab" aria-controls="pageRoot" aria-selected="' + selected + '" tabindex="' + (focusable ? '0' : '-1') + '" data-page-tab="' + esc(tab.page) + '" title="' + esc(name) + '">' + icon + '<span class="aiops-page-tab-label">' + esc(name) + '</span></button><button type="button" class="aiops-page-tab-close" tabindex="-1" data-page-tab-close="' + esc(tab.page) + '" aria-label="' + esc('关闭' + name) + '" title="' + esc('关闭' + name) + '"><i data-lucide="x" aria-hidden="true"></i></button></div>';
    }).join('');
  }
  function paint() {
    var nav = document.getElementById('aiopsPageTabs');
    if (!nav) return;
    nav.hidden = !tabs.length; nav.innerHTML = markup();
    nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', '已打开的功能');
    if (typeof host.icons === 'function') host.icons();
    var tab = find(activePage), button = tab && document.getElementById(tab.id);
    if (button) {
      button.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      if (focusPage === activePage) { button.focus?.({ preventScroll: true }); focusPage = null; }
    }
  }
  function afterRender(page) {
    activePage = owner(page);
    if (activePage) {
      ensure(activePage);
      // Internal links may bypass the ordinary sidebar lifecycle. Preserve the
      // last rendered source location before a cross-module action changes it.
      if (typeof host.capture === 'function') {
        var snapshot = host.capture(activePage);
        if (snapshot != null) views.set(activePage, snapshot);
      }
    }
    paint();
  }
  function select(page, focus) {
    var destination = owner(page);
    if (!destination || !find(destination)) return false;
    if (focus) focusPage = destination;
    if (currentOwner() === destination) { activePage = destination; paint(); return true; }
    if (typeof host.navigate === 'function') host.navigate(destination, { pageTabResume: true });
    return true;
  }
  function close(page) {
    var destination = owner(page), index = tabs.findIndex(function (tab) { return tab.page === destination; });
    if (index < 0) return false;
    var wasActive = destination === activePage || destination === currentOwner();
    tabs.splice(index, 1); views.delete(destination);
    if (pending?.page === destination) pending = null;
    if (focusPage === destination) focusPage = null;
    if (typeof host.reset === 'function') host.reset(destination);
    if (!wasActive) { paint(); return true; }
    activePage = null;
    var next = tabs.length ? tabs[Math.min(index, tabs.length - 1)].page : '工作台';
    focusPage = next;
    // Do not register the fallback until navigation starts: the host still
    // reports the closed current page, whose disposed snapshot must stay gone.
    if (typeof host.navigate === 'function') host.navigate(next, { pageTabResume: true });
    else { ensure(next); activePage = next; paint(); }
    return true;
  }
  function eventButton(event, attribute) {
    var nav = document.getElementById('aiopsPageTabs'), button = event.target.closest?.('[' + attribute + ']');
    return button && nav?.contains(button) ? button : null;
  }
  document.addEventListener('click', function (event) {
    var button = eventButton(event, 'data-page-tab-close');
    if (button) { event.preventDefault(); close(button.getAttribute('data-page-tab-close')); return; }
    button = eventButton(event, 'data-page-tab');
    if (button) { event.preventDefault(); select(button.getAttribute('data-page-tab'), true); }
  });
  document.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var button = eventButton(event, 'data-page-tab') || eventButton(event, 'data-page-tab-close');
    if (!button || ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Delete'].indexOf(event.key) < 0) return;
    var page = button.getAttribute('data-page-tab') || button.getAttribute('data-page-tab-close'), index = tabs.findIndex(function (tab) { return tab.page === page; });
    if (index < 0) return;
    event.preventDefault();
    if (event.key === 'Delete') { close(page); return; }
    var next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    select(tabs[next].page, true);
  });
  global.AIOpsPageTabs = {
    configure: function (next) { host = next || {}; },
    owner: owner,
    beforeNavigate: beforeNavigate,
    restoreView: restoreView,
    afterRender: afterRender,
    list: function () { return tabs.map(function (tab) { return tab.page; }); },
    active: function () { return activePage; },
    clearViews: function () { views.clear(); pending = null; },
    captureCurrent: captureCurrent,
    close: close
  };
})(window);
