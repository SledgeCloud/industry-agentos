/* Host adapters for the existing local operations modules. Reference UI lives in aiops.js. */
(function (global) {
  'use strict';
  var pages = ['本体知识运营', '消息通知', '自定义看板', 'Agent评测'];
  var frame = null, requestedPage = null, ready = false, administration = null, inert = [];
  function showError() {
    frame.hidden = true;
    var status = document.querySelector('#pageRoot .extension-loading');
    if (status) { status.hidden = false; status.textContent = '页面加载失败，请刷新后重试。'; status.setAttribute('role', 'alert'); }
  }
  function positionFrame() {
    if (!frame || frame.hidden) return;
    var rect = document.getElementById('pageRoot').getBoundingClientRect();
    Object.assign(frame.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
  }
  function navigateFrame() {
    if (!ready || !frame || !requestedPage) return;
    try {
      var page = frame.contentWindow.AIOpsOperations.navigate(requestedPage);
      if (page !== requestedPage) throw new Error('Operations route mismatch');
      frame.hidden = false;
      var status = document.querySelector('#pageRoot .extension-loading');
      if (status) { status.hidden = true; status.textContent = ''; }
      positionFrame();
    } catch (_) { showError(); }
  }
  global.AIOpsExtensions = {
    markup: function () { return '<div class="extension-loading" role="status">正在加载…</div>'; },
    beforeRender: function () { if (frame) frame.hidden = true; },
    afterRender: function (page) {
      var active = pages.indexOf(page) >= 0;
      document.getElementById('pageRoot').classList.toggle('is-extension-page', active);
      if (!active) { requestedPage = null; return; }
      requestedPage = page;
      if (!frame) {
        frame = document.createElement('iframe');
        frame.className = 'aiops-extension-frame';
        frame.hidden = true;
        frame.addEventListener('load', function () {
          try {
            if (!frame.contentWindow.AIOpsOperations) { showError(); return; }
            ready = true;
            navigateFrame();
          } catch (_) { showError(); }
        });
        frame.srcdoc = global.AIOpsOperationsDocument.create(page, new URL('.', document.baseURI).href);
        document.body.appendChild(frame);
      }
      frame.title = page;
      frame.hidden = true;
      positionFrame();
      navigateFrame();
    }
  };
  function closeAdministration() {
    if (administration) administration.remove();
    administration = null;
    inert.forEach(function (entry) { entry[0].inert = entry[1]; });
    inert = [];
    document.getElementById('userBtn').focus();
  }
  // Administration documents use this existing return contract, preserving the active AIOps view.
  global.EnterpriseProfile = { closeAdministration: closeAdministration };
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-admin]');
    if (!button) return;
    var file = button.getAttribute('data-admin');
    if (['enterprise-space.html', 'enterprise-organization.html'].indexOf(file) < 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    document.getElementById('acctMenu').hidden = true;
    document.getElementById('userBtn').setAttribute('aria-expanded', 'false');
    inert = Array.from(document.body.children).map(function (element) { var old = element.inert; element.inert = true; return [element, old]; });
    administration = document.createElement('iframe');
    administration.className = 'aiops-administration';
    administration.title = button.textContent.trim();
    administration.src = file + '?from=new-aiops.html&returnDepth=1';
    document.body.appendChild(administration);
    administration.focus();
  }, true);
  var resize = new ResizeObserver(positionFrame);
  resize.observe(document.getElementById('pageRoot'));
  window.addEventListener('resize', positionFrame);
})(window);
