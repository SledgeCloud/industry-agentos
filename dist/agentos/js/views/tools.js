/* AgentOS · 系统内置工具 */
(function (root) {
  const AOS = root.AOS;
  const { ui, svc, store } = AOS;
  const { esc, icon } = ui;
  const GROUP = { internal: ['厂内资料', 'outline'], public: ['公开资料', 'ext'], none: ['不读取资料', ''] };

  AOS.views.tools = function (el) {
    AOS.setCrumbs([{ name: '内置工具' }]);
    const agents = store.state.agents;
    const usedBy = id => agents.filter(a => (a.draft.tools || []).includes(id));
    el.innerHTML = '<div class="page"><div class="page-head"><div><h1>内置工具</h1><p>智能体访问资料和外部能力的唯一方式。工具内部按用户权限和密级过滤，每次调用写入会话记录；配置人员只能设置参数，不能修改工具逻辑。</p></div></div>' +
      '<div class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>资料范围与可调用工具</h3><span class="muted small">用户在对话中选择资料范围，决定本轮可调用哪些已勾选的工具</span></div><div class="table-wrap"><table class="tbl"><thead><tr><th>资料范围</th><th>可调用的工具</th></tr></thead><tbody>' +
      '<tr><td>公开资料</td><td>联网搜索、网页读取</td></tr><tr><td>厂内资料</td><td>文档检索、图纸检索、代码检索、数据查询</td></tr><tr><td>全部</td><td>以上全部</td></tr><tr><td class="muted">不受限制</td><td>报告导出、数据分析（不直接读取资料）</td></tr></tbody></table></div></div>' +
      '<div class="tool-grid">' + AOS.data.tools.map(t => {
        const g = GROUP[t.group];
        const users = usedBy(t.id);
        return '<article class="tool-card"><div class="head"><div class="agent-icon">' + icon(t.icon) + '</div><div class="grow"><h3>' + esc(t.name) + '</h3><div class="row small"><span class="badge ' + g[1] + '">' + g[0] + '</span>' + (t.phase > svc.phase() ? '<span class="badge warn">' + svc.PHASE_LABEL[t.phase] + '提供</span>' : '<span class="badge ok">已可用 · ' + svc.PHASE_LABEL[t.phase] + '</span>') + '</div></div></div>' +
          '<dl class="kv"><dt>适用资料</dt><dd>' + esc(t.appliesTo) + '</dd><dt>入库处理</dt><dd>' + esc(t.ingest) + '</dd><dt>调用能力</dt><dd>' + esc(t.capability) + '</dd><dt>可配置参数</dt><dd>' + t.params.map(p => esc(p.label) + '（默认 ' + esc(p.default) + '）').join('、') + '</dd></dl>' +
          '<div><div class="field-label" style="margin-bottom:4px">安全要求</div><ul>' + t.safety.map(s => '<li>' + esc(s) + '</li>').join('') + '</ul></div>' +
          '<div class="row wrap small"><span class="muted">' + users.length + ' 个智能体已勾选</span>' + users.slice(0, 4).map(a => '<a class="badge outline" href="#/studio/' + a.id + '">' + esc(a.draft.name) + '</a>').join('') + (users.length > 4 ? '<span class="muted">等</span>' : '') + '</div></article>';
      }).join('') + '</div></div>';
  };
})(window);
