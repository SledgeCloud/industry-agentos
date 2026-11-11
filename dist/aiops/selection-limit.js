/* Shared resource selection limit for tables and picker dialogs. */
(function (global) {
  'use strict';
  var MAX = 10, host;
  function notify(kind) {
    host.toast(host.lang() === 'en' ? 'Select up to 10 ' + (kind === 'ses' ? 'sessions' : 'files') : '最多选择 10 个' + (kind === 'ses' ? '会话' : '文件'), 'warning');
  }
  function select(selected, ids, checked, kind) {
    var result = selected.slice(), overflow = false;
    // At capacity, a partially selected group can still clear its selection.
    if (checked && result.length >= MAX && ids.some(function (id) { return result.indexOf(id) >= 0; })) checked = false;
    ids.forEach(function (id) {
      var index = result.indexOf(id);
      if (!checked) { if (index >= 0) result.splice(index, 1); }
      else if (index < 0) { if (result.length < MAX) result.push(id); else overflow = true; }
    });
    if (overflow) notify(kind);
    return result;
  }
  function sync(input, count, kind, hit) {
    var blocked = count >= MAX && !input.checked && !input.indeterminate;
    input.disabled = blocked;
    hit = hit || input.parentElement;
    if (blocked) { hit.setAttribute('data-selection-limit', kind); hit.setAttribute('aria-disabled', 'true'); }
    else { hit.removeAttribute('data-selection-limit'); hit.removeAttribute('aria-disabled'); }
  }
  // Native disabled inputs do not dispatch clicks. Their checkbox container or row is
  // the hit target, so the shared toast can explain the limit without selecting.
  document.addEventListener('click', function (event) {
    var hit = event.target.closest('[data-selection-limit]');
    if (!hit) return;
    event.preventDefault(); event.stopImmediatePropagation(); notify(hit.getAttribute('data-selection-limit'));
  }, true);
  global.AIOpsSelectionLimit = { max: MAX, select: select, sync: sync, configure: function (options) { host = options; } };
})(window);
