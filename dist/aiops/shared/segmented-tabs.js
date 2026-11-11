/* One sliding-tab renderer for the existing Workbench / Workplace segments. */
(function () {
  'use strict';
  var selector = '.wb-segmented-tabs,.ov-segment,.sm-seg,.fsw-seg,.og-seg,.mode-switch,.fast-route,.ffm-seg,.fx-seg,.lang-seg,.si-segment,.segments';
  var selected = '.selected,.is-active,.is-on,.on,.is-current,.is-cur,[aria-selected="true"],[aria-pressed="true"]';
  var frame;
  function paint() {
    frame = null;
    document.querySelectorAll(selector).forEach(function (group) {
      if (!group.classList.contains('wb-segmented-tabs')) group.classList.add('wb-segmented-tabs');
      var current = Array.from(group.children).filter(function (node) { return node.tagName === 'BUTTON' && node.matches(selected); })[0];
      group.style.setProperty('--wb-tab-width', current ? current.offsetWidth + 'px' : '0px');
      if (!current) return;
      group.style.setProperty('--wb-tab-left', current.offsetLeft + 'px');
      group.style.setProperty('--wb-tab-top', current.offsetTop + 'px');
      group.style.setProperty('--wb-tab-height', current.offsetHeight + 'px');
    });
  }
  function queue() { if (!frame) frame = requestAnimationFrame(paint); }
  new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-pressed'] });
  document.addEventListener('keydown', function (event) {
    var group = event.target.closest('.wb-segmented-tabs');
    if (!group || !event.target.matches('button') || ['ArrowLeft','ArrowRight','Home','End'].indexOf(event.key) < 0) return;
    var buttons = Array.from(group.children).filter(function (node) { return node.tagName === 'BUTTON' && !node.disabled; });
    var index = buttons.indexOf(event.target);
    var target = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons[buttons.length - 1] : buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
    if (target) { event.preventDefault(); event.stopImmediatePropagation(); target.click(); if (target.isConnected) { target.focus(); target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }
  }, true);
  window.addEventListener('resize', queue);
  window.WorkbenchSegmentedTabs = { refresh: queue };
  queue();
})();
