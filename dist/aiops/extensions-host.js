/* Same-origin srcdoc adapter: no cross-file loading or message handshake is required. */
(function () {
  'use strict';
  var config = document.body.dataset || {};
  if (window.parent === window || (config.operationsEmbedded !== '1' && new URLSearchParams(location.search).get('embedded') !== '1')) return;
  document.body.classList.add('embedded-operations');
  var allowed = ['本体知识运营', '消息通知', '自定义看板', 'Agent评测'];
  var navigate = go;
  window.AIOpsOperations = {
    navigate: function (page) {
      if (allowed.indexOf(page) < 0) throw new Error('Unsupported operations page');
      if (state.page !== page) navigate(page);
      return state.page;
    }
  };
  go = function (page) {
    if (allowed.indexOf(page) >= 0) return navigate(page);
    var mapped = page === '线上会话分析' ? '线上会话' : page === '工作区' ? '分析任务' : page;
    window.parent.AIOpsApp.navigate(mapped);
  };
})();
