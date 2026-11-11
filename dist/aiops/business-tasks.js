/* Online business tasks: read-only definitions, observed triggers, and local Mock feedback. */
(function (global) {
  'use strict';
  var host = {}, view = { task: null, session: null, query: '', filters: { scene: [], agent: [] } }, dialog = null, definitionDialog = null, filterMenu = null;
  var STORAGE_KEY = 'aiops.online-business-task-feedback.v1';
  var definitions = [
    { id: 'BT-001', name: '月末关账审核', scene: 'audit', agent: '关账审核智能体', version: 'v1.3', description: '核对月末关账资料与报表，识别差异并输出可追溯的审核报告。', input: '关账期间、检查清单、财务报表及附注', output: '关账审核报告、差异清单与来源依据', completion: '完成清单中的全部核验项，并生成审核报告。', criteria: ['核验项完整，未遗漏必查项目', '差异结论与来源数据一致，引用可追溯', '资料缺失项单独列示，不直接判定为业务错误'] },
    { id: 'BT-002', name: '关联方与往来对账', scene: 'audit', agent: '关账审核智能体', version: 'v1.2', description: '核对关联方余额、往来重分类与内部交易，定位未达差异。', input: '关联方清单、往来余额与内部交易明细', output: '对账结果、未达项及调整建议', completion: '完成双方余额及内部交易核对，输出差异结果。', criteria: ['双方余额及抵消关系准确', '每个未达项均有原始记录依据', '重分类与调整建议符合适用规则'] },
    { id: 'BT-003', name: '收入与合同核验', scene: 'audit', agent: '关账审核智能体', version: 'v1.1', description: '根据合同与履约记录，核验收入确认时点、截止性及合同资产。', input: '合同条款、履约记录、收入与合同资产明细', output: '收入核验结论及待确认事项', completion: '完成合同与收入记录匹配，输出逐项核验结论。', criteria: ['收入确认时点与履约证据一致', '截止性及减值检查覆盖完整', '待确认事项与明确不通过项分开记录'] },
    { id: 'BT-004', name: '费用与税金复核', scene: 'audit', agent: '关账审核智能体', version: 'v1.2', description: '复核费用科目、跨期计提及税金，检查口径与映射的一致性。', input: '费用明细、科目映射、计提与冲回记录', output: '费用与税金复核清单、异常说明', completion: '完成科目、期间和计提规则复核，生成结果清单。', criteria: ['科目映射与适用规则一致', '跨期计提和冲回关系正确', '异常项包含金额、期间与核验依据'] },
    { id: 'BT-005', name: '资产与负债计量核验', scene: 'audit', agent: '关账审核智能体', version: 'v1.0', description: '检查资产与负债的计量、结转和减值依据，形成逐项核验结果。', input: '资产负债明细、计量参数与相关凭证', output: '计量核验结果及差异依据', completion: '完成全部指定对象核验，输出计量结果。', criteria: ['计算口径与参数正确', '计量结果与明细数据一致', '差异和缺失资料均可追溯'] },
    { id: 'BT-006', name: '规则适用范围确认', scene: 'audit', agent: '关账审核智能体', version: 'v1.0', description: '结合业务上下文，确认审核规则的生效版本与适用范围。', input: '业务类型、审核期间与规则版本', output: '规则适用结论及引用依据', completion: '完成规则匹配并输出适用范围说明。', criteria: ['使用审核期间内有效的规则版本', '适用与不适用的边界说明准确'] },
    { id: 'BT-007', name: '制造业规则阈值复核', scene: 'manufacturing', agent: '制造业规则审核智能体', version: 'v1.2', description: '复核制造业审核规则阈值，说明异常触发条件与业务影响。', input: '制造业审核规则、阈值与业务样本', output: '阈值复核结果、异常依据与建议', completion: '完成阈值与业务样本比对，输出复核结果。', criteria: ['阈值判断与规则版本一致', '异常触发依据充分且可定位', '调整建议说明适用边界'] },
    { id: 'BT-008', name: '模型调用成本分析', scene: 'cost', agent: '成本分析智能体', version: 'v1.1', description: '分析模型调用与 Token 消耗，定位成本变化并提供优化建议。', input: '调用记录、Token 用量与计费口径', output: '成本分析结果、异常来源及优化建议', completion: '完成消耗归因并生成成本分析结果。', criteria: ['成本计算与计费口径一致', '异常归因有原始调用记录支持', '优化建议包含适用范围与预期影响'] },
    { id: 'BT-009', name: '会话回答质量复盘', scene: 'audit', agent: '会话质量分析智能体', version: 'v1.0', description: '复盘用户追问与回答内容，梳理回答质量问题与改进建议。', input: '用户会话、追问记录与用户反馈', output: '回答质量问题清单与改进建议', completion: '完成会话复盘并输出问题清单。', criteria: ['问题与具体会话内容对应', '结论保留上下文及原始反馈依据'] }
  ];
  var dimensionNames = {
    'BT-001': ['核验完整性', '结论与依据一致性', '结论边界'],
    'BT-002': ['对账准确性', '未达项可追溯性', '规则遵循'],
    'BT-003': ['收入确认准确性', '核验覆盖度', '结论边界'],
    'BT-004': ['科目映射准确性', '跨期处理正确性', '异常说明完整性'],
    'BT-005': ['计量口径正确性', '结果一致性', '证据可追溯性'],
    'BT-006': ['版本有效性', '适用边界准确性'],
    'BT-007': ['阈值判断准确性', '异常依据充分性', '建议适用性'],
    'BT-008': ['成本计算准确性', '归因可追溯性', '建议完整性'],
    'BT-009': ['问题定位准确性', '上下文完整性']
  };
  definitions.forEach(function (task) {
    task.agentId = task.scene + ':agents:0';
    task.dimensions = task.criteria.map(function (criterion, index) {
      return { name: dimensionNames[task.id][index], description: criterion, values: ['不符合', '部分符合', '符合'] };
    });
  });
  // Completion and business acceptance are separate seeded outcomes; neither is inferred from errors or user marks.
  // The final field is the recorded completion turn; later conversation turns can follow it.
  var observed = [
    ['BT-001', 'CR-1024', 'completed', 'pending', '审核报告已生成，等待业务复核。', 17],
    ['BT-001', 'CR-1019', 'completed', 'rejected', '报告已生成，但附注引用不完整。', 13],
    ['BT-001', 'CR-1002', 'completed', 'pending', '检查清单已完成，等待核验结果确认。', 17],
    ['BT-001', 'CR-1001', 'completed', 'passed', '报表附注一致性核对满足通过标准。', 6],
    ['BT-002', 'CR-1021', 'completed', 'rejected', '未达项解释缺少双方明细依据。', 5],
    ['BT-002', 'CR-1013', 'completed', 'passed', '重分类结果与适用规则一致。', 8],
    ['BT-002', 'CR-1006', 'completed', 'passed', '内部交易抵消关系核对完成。', 10],
    ['BT-003', 'CR-1022', 'completed', 'passed', '收入确认依据及适用规则完整。', 7],
    ['BT-003', 'CR-1005', 'completed', 'passed', '合同资产核验结果满足通过标准。', 7],
    ['BT-003', 'CR-1004', 'completed', 'rejected', '截止性结论与履约记录不一致。', 14],
    ['BT-004', 'CR-1023', 'completed', 'rejected', '跨期计提说明未覆盖全部调整记录。', 10],
    ['BT-004', 'CR-1017', 'completed', 'passed', '费用科目复核结果一致。', 4],
    ['BT-004', 'CR-1016', 'completed', 'passed', '冲回记录及期间核对完整。', 7],
    ['BT-004', 'CR-1015', 'failed', 'na', '资料读取中断，未生成完整复核结果。'],
    ['BT-004', 'CR-1009', 'completed', 'passed', '薪酬计提与发放核对通过。', 5],
    ['BT-004', 'CR-1003', 'completed', 'passed', '科目映射与规则一致。', 4],
    ['BT-005', 'CR-1020', 'completed', 'passed', '存货减值准备核验完整。', 9],
    ['BT-005', 'CR-1014', 'completed', 'passed', '折旧计算口径及结果正确。', 5],
    ['BT-005', 'CR-1012', 'completed', 'passed', '成本结转核验满足通过标准。', 9],
    ['BT-005', 'CR-1011', 'completed', 'passed', '暂估入库冲销关系核对通过。', 6],
    ['BT-005', 'CR-1010', 'completed', 'passed', '银行余额调节核对结果完整。', 12],
    ['BT-005', 'CR-1008', 'completed', 'passed', '租赁负债计量与参数一致。', 10],
    ['BT-005', 'CR-1007', 'completed', 'passed', '政府补助递延核对通过。', 4],
    ['BT-006', 'CR-1018', 'completed', 'passed', '规则版本及适用范围已确认。', 6],
    ['BT-007', 'CR-1027', 'completed', 'passed', '规则阈值与适用业务样本一致。', 12],
    ['BT-008', 'CR-1028', 'running', 'na', '用户已触发分析，正在汇总调用记录。'],
    ['BT-008', 'CR-1025', 'failed', 'na', '调用明细读取失败，未完成成本归因。'],
    ['BT-009', 'CR-1026', 'completed', 'passed', '复盘问题均已关联原始会话与反馈。', 8]
  ];
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function tr(zh, en) { return host.lang && host.lang() === 'en' ? en : zh; }
  function ico(name) { return '<i data-lucide="' + name + '" aria-hidden="true"></i>'; }
  // Authoring lives in the shared evaluation workspace. Keep the old definitions
  // only as a lookup for already-recorded sessions and their historical evidence.
  function authoredTasks() {
    return global.AIOpsEvaluation && typeof global.AIOpsEvaluation.taskCatalog === 'function' ? global.AIOpsEvaluation.taskCatalog() : null;
  }
  function taskById(id) {
    var authored = global.AIOpsEvaluation && typeof global.AIOpsEvaluation.taskDefinition === 'function' ? global.AIOpsEvaluation.taskDefinition(id) : null;
    if (!authored) authored = (authoredTasks() || []).filter(function (task) { return task.id === id; })[0];
    return authored || definitions.filter(function (task) { return task.id === id; })[0];
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function catalog() { var authored = authoredTasks(); return clone(Array.isArray(authored) ? authored : definitions); }
  function definition(id) { var task = taskById(id); return task ? clone(task) : null; }
  function executionKey(taskId, sessionId, startMessageId) { return JSON.stringify([String(taskId || ''), String(sessionId || ''), String(startMessageId || '')]); }
  function tasks() { var ids = global.AIOpsResources.scopeCatalog().map(function (scene) { return scene.id; }); return catalog().filter(function (task) { return ids.indexOf(task.scene) >= 0; }); }
  function records(taskIds) {
    taskIds = Array.isArray(taskIds) ? taskIds : [...new Set(definitions.concat(catalog()).map(function (task) { return task.id; }))];
    var sessions = host.sessions ? host.sessions() : [];
    var merged = observed.filter(function (run) { return taskIds.indexOf(run[0]) >= 0; }).map(function (run) {
      var session = sessions.filter(function (row) { return row.id === run[1]; })[0];
      var anchor = session && run[2] === 'completed' ? global.AIOpsSessionDetail.replyAt(session, run[5]) : null;
      var first = session && global.AIOpsSessionDetail.data(session).rounds[0], task = taskById(run[0]);
      return session && first ? { id: 'TR-' + run[1].slice(3), executionKey: executionKey(run[0], run[1], first.inputId), taskId: run[0], taskVersion: task.version, sessionId: run[1], startRound: 1, startMessageId: first.inputId, triggeredAt: first.inputAt, completion: run[2], acceptance: run[3], reason: run[4], completionRound: anchor ? anchor.round : null, completionMessageId: anchor ? anchor.messageId : null, completedAt: anchor ? anchor.completedAt : null, session: session } : null;
    }).filter(Boolean);
    var ledger;
    try { ledger = JSON.parse(global.localStorage.getItem('aiops.online-evaluation-ledger.v1') || '{}'); } catch (_) { ledger = null; }
    (ledger && Array.isArray(ledger.taskExecutions) ? ledger.taskExecutions : []).forEach(function (entry) {
      if (!entry || taskIds.indexOf(entry.taskId) < 0 || !taskById(entry.taskId) || typeof entry.id !== 'string' || !entry.id) return;
      var session = sessions.filter(function (row) { return row.id === entry.sessionId; })[0]; if (!session) return;
      var task = taskById(entry.taskId), rounds = global.AIOpsSessionDetail.data(session).rounds;
      var start = rounds.filter(function (turn) { return turn.inputId === entry.startMessageId; })[0]; if (!start) return;
      if (['completed', 'running', 'failed'].indexOf(entry.completion) < 0 || ['passed', 'rejected', 'pending', 'na'].indexOf(entry.acceptance) < 0) return;
      var anchor = entry.completion === 'completed' ? global.AIOpsSessionDetail.replyAt(session, entry.completionRound) : null;
      if (entry.completion === 'completed' && (!anchor || anchor.messageId !== entry.completionMessageId || anchor.round < start.n)) return;
      var key = executionKey(entry.taskId, entry.sessionId, start.inputId), at = merged.findIndex(function (run) { return run.executionKey === key; });
      var record = Object.assign({}, clone(entry), { executionKey: key, taskVersion: entry.taskVersion || task.version, session: session, startRound: start.n, triggeredAt: start.inputAt, completionRound: anchor ? anchor.round : null, completionMessageId: anchor ? anchor.messageId : null, completedAt: anchor ? anchor.completedAt : null });
      if (record.completion !== 'completed') record.acceptance = 'na';
      if (at < 0) merged.push(record); else merged[at] = record;
    });
    return merged.sort(function (a, b) { return b.triggeredAt.localeCompare(a.triggeredAt); });
  }
  function summary(items) { var runs = records(items.map(function (task) { return task.id; })); return { tasks: items.length, executions: runs.length, completed: runs.filter(function (run) { return run.completion === 'completed'; }).length, passed: runs.filter(function (run) { return run.completion === 'completed' && run.acceptance === 'passed'; }).length }; }
  function rate(numerator, denominator) { return denominator ? (numerator / denominator * 100).toFixed(1) + '%' : '—'; }
  function sceneName(id) { var scene = global.AIOpsWorkspaces.scopeCatalog().filter(function (item) { return item.id === id; })[0]; return scene ? scene.name : id; }
  function status(value, evaluatedAt) { var labels = { completed: tr('已完成', 'Completed'), running: tr('执行中', 'Running'), failed: tr('未完成', 'Incomplete'), passed: tr('通过', 'Passed'), rejected: tr('未通过', 'Not passed'), pending: evaluatedAt ? tr('待确认', 'Pending confirmation') : tr('待评测', 'Pending evaluation'), na: tr('暂不评测', 'Not evaluated') }; return '<span class="bt-status is-' + value + '">' + esc(labels[value]) + '</span>'; }
  function metrics(items) {
    var data = summary(items);
    var values = { tasks: data.tasks, executions: data.executions, completed: rate(data.completed, data.executions), passed: rate(data.passed, data.completed) };
    return '<section class="bt-metrics" aria-label="' + tr('业务任务统计', 'Business task metrics') + '">' + [
      ['tasks', tr('业务任务', 'Business tasks'), 'list-checks', tr('当前场景下的业务任务数', 'Tasks in the selected scenario')],
      ['executions', tr('任务执行记录', 'Execution records'), 'activity', tr('正式用户触发的执行次数', 'Executions triggered by end users')],
      ['completed', tr('任务完成率', 'Task completion rate'), 'circle-check', tr('已完成执行记录 / 触发执行总次数', 'Completed executions / total triggered executions')],
      ['passed', tr('任务通过率', 'Task pass rate'), 'badge-check', tr('已通过执行记录 / 已完成执行记录', 'Passed executions / completed executions')]
    ].map(function (item) { return '<article class="bt-metric" data-bt-metric="' + item[0] + '"><div class="bt-metric-top"><span>' + item[1] + '</span>' + ico(item[2]) + '</div><strong>' + values[item[0]] + '</strong><small>' + item[3] + '</small></article>'; }).join('') + '</section>';
  }
  function feedbackEntries(id) {
    try { var saved = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(saved) ? saved.filter(function (entry) { return entry && taskById(entry.taskId) && typeof entry.content === 'string' && entry.content.trim() && entry.content.length <= 2000 && typeof entry.at === 'string' && typeof entry.user === 'string' && (!id || entry.taskId === id); }) : []; } catch (_) { return []; }
  }
  function saveFeedback(id, content) {
    content = String(content || '').trim();
    if (!taskById(id) || !tasks().some(function (task) { return task.id === id; })) return { ok: false, error: tr('该业务任务不在当前场景中。', 'This task is outside the selected scenario.') };
    if (!content || content.length > 2000) return { ok: false, error: tr('请输入 1–2000 字的反馈内容。', 'Enter feedback between 1 and 2000 characters.') };
    var entries = feedbackEntries();
    entries.unshift({ taskId: id, content: content, user: 'Feng Zhu', at: new Date().toISOString() });
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); return { ok: true }; } catch (_) { return { ok: false, error: tr('反馈保存失败，请重试。', 'Unable to save feedback. Please retry.') }; }
  }
  function dateLabel(value) { var date = new Date(value); if (isNaN(date.getTime())) return '—'; return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
  function triggerLabel(value) { return value.replace('T', ' ').slice(0, 19); }
  function action(action, id, label, glyph, cls) { return '<button type="button" class="' + (cls || 'btn-soft') + '" data-bt="' + action + '" data-id="' + esc(id) + '">' + (glyph ? ico(glyph) : '') + esc(label) + '</button>'; }
  function listRows(items) {
    return items.map(function (task) {
      var data = summary([task]), runs = records([task.id]);
      return '<tr><td><button type="button" class="bt-task-name" data-bt="task" data-id="' + task.id + '" title="' + esc(task.name) + '">' + ico('clipboard-check') + '<span class="bt-task-copy"><strong>' + esc(task.name) + '</strong></span></button></td><td class="bt-version">' + esc(task.version) + '</td><td><span class="bt-scene-tag">' + esc(sceneName(task.scene)) + '</span></td><td>' + esc(task.agent) + '</td><td class="bt-number">' + data.executions + '</td><td class="bt-number">' + rate(data.completed, data.executions) + '</td><td class="bt-number">' + rate(data.passed, data.completed) + '</td><td class="bt-time">' + esc(runs.length ? triggerLabel(runs[0].triggeredAt) : '—') + '</td><td class="bt-actions">' + action('task', task.id, tr('查看记录', 'View records')) + action('feedback', task.id, tr('反馈', 'Feedback')) + '</td></tr>';
    }).join('');
  }
  function filtered(items) {
    var query = view.query.trim().toLowerCase();
    return items.filter(function (task) {
      return (!query || [task.name, task.id, task.agent, task.version, sceneName(task.scene)].join(' ').toLowerCase().indexOf(query) >= 0) &&
        ['scene', 'agent'].every(function (key) { return !view.filters[key].length || view.filters[key].indexOf(task[key]) >= 0; });
    });
  }
  function empty() { return '<tr><td colspan="9"><div class="bt-empty">' + ico('search') + '<p>' + tr('没有匹配的业务任务', 'No matching business tasks') + '</p>' + action('reset', '', tr('重置筛选', 'Reset filters')) + '</div></td></tr>'; }
  function filterLabel(key) { return key === 'scene' ? tr('所属场景', 'Scenario') : 'Agent'; }
  function filterOptions(key) {
    if (['scene', 'agent'].indexOf(key) < 0) return [];
    return tasks().map(function (task) { return task[key]; }).filter(function (value, index, values) { return values.indexOf(value) === index; });
  }
  function filterHeading(key) {
    var selected = view.filters[key].length;
    return '<button type="button" class="bt-column-filter' + (selected ? ' is-filtered' : '') + '" data-bt="filter" data-id="' + key + '" aria-label="' + tr('筛选', 'Filter ') + filterLabel(key) + '" aria-haspopup="dialog" aria-expanded="false"><span>' + filterLabel(key) + '</span>' + ico('list-filter') + (selected ? '<span class="bt-filter-count">' + selected + '</span>' : '') + '</button>';
  }
  function listPage(items) {
    var visible = filtered(items), active = view.query || view.filters.scene.length || view.filters.agent.length;
    return '<div class="bt-page"><header class="page-heading bt-heading"><h1>' + tr('业务任务', 'Business tasks') + '</h1></header>' + metrics(items) +
      '<section class="bt-card"><div class="bt-card-head"><h2>' + tr('业务任务列表', 'Business tasks') + ' <span id="btTaskCount" aria-live="polite">' + visible.length + '</span></h2></div><div class="bt-toolbar"><label class="bt-search">' + ico('search') + '<input id="btSearch" type="search" placeholder="' + tr('搜索任务名称、编号或 Agent', 'Search task, ID or agent') + '" aria-label="' + tr('搜索业务任务', 'Search business tasks') + '" value="' + esc(view.query) + '"></label><button type="button" class="bt-reset" data-bt="reset"' + (active ? '' : ' hidden') + '>' + tr('清空筛选', 'Clear filters') + '</button></div><div class="bt-table-wrap"><table class="bt-table bt-task-table"><thead><tr>' + [tr('业务任务', 'Business task'), tr('版本', 'Version'), filterHeading('scene'), filterHeading('agent'), tr('执行记录', 'Executions'), tr('任务完成率', 'Task completion rate'), tr('任务通过率', 'Task pass rate'), tr('最近触发时间', 'Latest trigger'), tr('操作', 'Actions')].map(function (label, index) { return '<th scope="col"' + (index >= 4 && index <= 6 ? ' class="bt-number"' : '') + '>' + label + '</th>'; }).join('') + '</tr></thead><tbody id="btTaskRows">' + (visible.length ? listRows(visible) : empty()) + '</tbody></table></div></section></div>';
  }
  function refreshList() {
    var rows = document.getElementById('btTaskRows');
    if (!rows) return;
    var visible = filtered(tasks()); rows.innerHTML = visible.length ? listRows(visible) : empty();
    var count = document.getElementById('btTaskCount'); if (count) count.textContent = visible.length;
    var reset = document.querySelector('.bt-reset'); if (reset) reset.hidden = !view.query && !view.filters.scene.length && !view.filters.agent.length;
    ['scene', 'agent'].forEach(function (key) {
      var heading = document.querySelector('[data-bt="filter"][data-id="' + key + '"]');
      if (heading) { var expanded = filterMenu && filterMenu.key === key; heading.outerHTML = filterHeading(key); heading = document.querySelector('[data-bt="filter"][data-id="' + key + '"]'); heading.setAttribute('aria-expanded', expanded ? 'true' : 'false'); }
    });
    host.icons();
  }
  function setFilter(key, values) {
    if (['scene', 'agent'].indexOf(key) < 0 || !Array.isArray(values)) return false;
    var allowed = filterOptions(key);
    view.filters[key] = values.filter(function (value, index) { return allowed.indexOf(value) >= 0 && values.indexOf(value) === index; });
    refreshList(); return true;
  }
  function closeFilter(restoreFocus) {
    if (!filterMenu) return;
    var key = filterMenu.key; filterMenu.element.remove(); filterMenu = null;
    var anchor = document.querySelector('[data-bt="filter"][data-id="' + key + '"]');
    if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (restoreFocus) anchor.focus({ preventScroll: true }); }
  }
  function openFilter(key, anchor) {
    var same = filterMenu && filterMenu.key === key; closeFilter(); if (same) return;
    if (['scene', 'agent'].indexOf(key) < 0) return;
    var element = document.createElement('div'); element.className = 'bt-filter-menu'; element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', tr('筛选', 'Filter ') + filterLabel(key));
    element.innerHTML = '<header><strong>' + filterLabel(key) + '</strong>' + action('filter-clear', key, tr('清空', 'Clear')) + '</header><div class="bt-filter-options">' + filterOptions(key).map(function (value) {
      return '<label><input type="checkbox" data-bt-filter="' + key + '" value="' + esc(value) + '"' + (view.filters[key].indexOf(value) >= 0 ? ' checked' : '') + '><span>' + esc(key === 'scene' ? sceneName(value) : value) + '</span></label>';
    }).join('') + '</div>';
    document.body.appendChild(element); filterMenu = { key: key, element: element }; anchor.setAttribute('aria-expanded', 'true');
    var rect = anchor.getBoundingClientRect(); element.style.left = Math.max(8, Math.min(rect.left, global.innerWidth - element.offsetWidth - 8)) + 'px'; element.style.top = Math.max(8, rect.bottom + element.offsetHeight + 6 > global.innerHeight ? rect.top - element.offsetHeight - 6 : rect.bottom + 6) + 'px';
    var input = element.querySelector('input'); if (input) input.focus({ preventScroll: true });
  }
  function feedbackList(task) {
    var entries = feedbackEntries(task.id);
    return '<section class="bt-card"><header class="bt-section-head"><h2>' + tr('任务反馈', 'Task feedback') + ' <span>· ' + entries.length + '</span></h2>' + action('feedback', task.id, tr('写反馈', 'Write feedback'), 'message-square') + '</header><div class="bt-feedback-list">' + (entries.length ? entries.map(function (entry) { return '<article><p>' + esc(entry.content) + '</p><footer>' + esc(entry.user) + ' · ' + esc(dateLabel(entry.at)) + '</footer></article>'; }).join('') : '<p class="bt-task-desc">' + tr('暂无反馈', 'No feedback yet') + '</p>') + '</div></section>';
  }
  function evaluationEvidence(run) {
    if (!run.evaluatorId) return '';
    var dimensions = Array.isArray(run.dimensions) ? run.dimensions : [];
    return '<small class="bt-task-desc">' + esc(run.evaluatorName || run.evaluatorId) + (run.evaluatedAt ? ' · ' + esc(dateLabel(run.evaluatedAt)) : '') + '</small>' + (dimensions.length ? '<details class="bt-evaluation-evidence"><summary>' + tr('评估维度', 'Evaluation dimensions') + '</summary><ul>' + dimensions.map(function (dimension) { return '<li><strong>' + esc(dimension.name) + '</strong>：' + esc(dimension.value || dimension.result || dimension.status || '待确认') + (dimension.reason ? ' · ' + esc(dimension.reason) : '') + '</li>'; }).join('') + '</ul></details>' : '');
  }
  function detailPage(task) {
    var runs = records([task.id]);
    return '<div class="bt-page">' + action('back', '', tr('返回业务任务', 'Back to business tasks'), 'arrow-left', 'bt-back') + '<header class="page-heading has-actions bt-heading"><h1>' + esc(task.name) + '</h1><div class="bt-heading-actions">' + action('definition', task.id, tr('任务详情', 'Task details'), 'clipboard-list') + action('feedback', task.id, tr('反馈', 'Feedback'), 'message-square') + '</div></header>' + metrics([task]) +
      '<section class="bt-card"><header class="bt-card-head bt-records-heading"><h2>' + tr('执行触发记录', 'Triggered executions') + ' <span>' + runs.length + '</span></h2></header><div class="bt-table-wrap"><table class="bt-table"><thead><tr>' + [tr('执行记录 / 会话', 'Execution / session'), tr('触发用户', 'Triggered by'), tr('触发时间', 'Trigger time'), tr('执行状态', 'Execution'), tr('评测结果', 'Evaluation'), tr('结果说明', 'Outcome'), tr('操作', 'Actions')].map(function (label) { return '<th scope="col">' + label + '</th>'; }).join('') + '</tr></thead><tbody>' + runs.map(function (run) { return '<tr><td><span class="bt-record-id">' + esc(run.id) + '</span><small class="bt-task-desc">' + esc(run.sessionId) + ' · ' + esc(run.session.name) + '</small></td><td>' + esc(run.session.user) + '</td><td class="bt-time">' + esc(triggerLabel(run.triggeredAt)) + '</td><td>' + status(run.completion) + '</td><td>' + status(run.acceptance, run.evaluatedAt) + '</td><td class="bt-outcome">' + esc(run.reason) + evaluationEvidence(run) + '</td><td class="bt-actions">' + action('session', run.id, tr('查看记录', 'View record')) + '</td></tr>'; }).join('') + '</tbody></table></div></section>' + feedbackList(task) + '</div>';
  }
  function definitionMarkup(id) {
    var task = tasks().filter(function (item) { return item.id === id; })[0]; if (!task) return '';
    var meta = [[tr('任务名称', 'Task name'), task.name], [tr('任务编号', 'Task ID'), task.id], [tr('版本', 'Version'), task.version], [tr('所属场景', 'Scenario'), sceneName(task.scene)], ['Agent', task.agent]];
    var fields = [[tr('任务描述', 'Description'), task.description], [tr('任务输入', 'Input'), task.input], [tr('预期产出', 'Expected output'), task.output], [tr('完成标准', 'Completion criteria'), task.completion]];
    return '<header class="bt-dialog-head"><h2 id="btDefinitionTitle">' + tr('任务详情', 'Task details') + '</h2><button type="button" class="ws-btn" data-bt="definition-close" aria-label="' + tr('关闭任务详情', 'Close task details') + '">' + ico('x') + '</button></header><div class="bt-definition-body"><dl class="bt-definition-meta">' + meta.map(function (pair) { return '<div><dt>' + pair[0] + '</dt><dd>' + esc(pair[1]) + '</dd></div>'; }).join('') + '</dl><section class="bt-definition-section"><h3>' + tr('任务定义', 'Task definition') + '</h3><dl class="bt-definition-fields">' + fields.map(function (pair) { return '<div><dt>' + pair[0] + '</dt><dd>' + esc(pair[1]) + '</dd></div>'; }).join('') + '</dl></section><section class="bt-definition-section"><h3>' + tr('通过标准', 'Acceptance criteria') + '</h3><ul class="bt-criteria">' + task.criteria.map(function (criterion) { return '<li>' + ico('check') + '<span>' + esc(criterion) + '</span></li>'; }).join('') + '</ul></section><section class="bt-definition-section"><h3>' + tr('评估维度', 'Evaluation dimensions') + '</h3><div class="bt-dimensions-wrap"><table class="bt-dimensions-table"><thead><tr><th scope="col">' + tr('维度名称', 'Dimension') + '</th><th scope="col">' + tr('维度描述', 'Description') + '</th><th scope="col">' + tr('枚举值', 'Values') + '</th></tr></thead><tbody>' + task.dimensions.map(function (dimension) { return '<tr><td>' + esc(dimension.name) + '</td><td>' + esc(dimension.description) + '</td><td><div class="bt-dimension-values">' + dimension.values.map(function (value) { return '<span>' + esc(value) + '</span>'; }).join('') + '</div></td></tr>'; }).join('') + '</tbody></table></div></section></div><footer class="bt-dialog-foot">' + action('definition-close', '', tr('关闭', 'Close')) + '</footer>';
  }
  function closeDefinition() { if (definitionDialog) definitionDialog.close(); }
  function openDefinition(id, anchor) {
    var markup = definitionMarkup(id); if (!markup || definitionDialog) return;
    closeFilter(); var element = document.createElement('dialog'); definitionDialog = element;
    element.className = 'bt-definition-dialog'; element.setAttribute('aria-labelledby', 'btDefinitionTitle'); element.innerHTML = markup;
    document.body.appendChild(element); host.icons(); element.showModal();
    element.addEventListener('close', function () { element.remove(); definitionDialog = null; if (anchor && anchor.isConnected) anchor.focus({ preventScroll: true }); });
  }
  function page() {
    var items = tasks(), task = items.filter(function (item) { return item.id === view.task; })[0];
    if (!task) { view.task = null; view.session = null; }
    if (task && view.session) {
      var run = records([task.id]).filter(function (item) { return item.id === view.session || item.sessionId === view.session; })[0];
      if (run) return '<div class="bt-page bt-session-context"><div class="bt-session-head">' + action('back-records', '', tr('返回执行触发记录', 'Back to triggered executions'), 'arrow-left', 'bt-back') + '<span>' + esc(task.name) + ' · ' + run.id + ' ' + status(run.completion) + ' ' + status(run.acceptance, run.evaluatedAt) + '</span></div>' + global.AIOpsSessionDetail.page(run.session, true) + '</div>';
      view.session = null;
    }
    return task ? detailPage(task) : listPage(items);
  }
  function closeFeedback() { if (dialog) dialog.close(); }
  function openExecution(id) {
    var run = records(tasks().map(function (task) { return task.id; })).filter(function (item) { return item.id === id; })[0]; if (!run) return false;
    var task = taskById(run.taskId), target = run.completion === 'completed' ? { round: run.completionRound, messageId: run.completionMessageId, recordId: run.id, taskId: task.id, taskName: task.name } : null;
    if (!global.AIOpsSessionDetail.focusReply(run.session, target)) return false;
    view.task = run.taskId; view.session = run.id; if (host.render) host.render({ resetScroll: true }); return true;
  }
  function openFeedback(id, anchor) {
    if (!tasks().some(function (task) { return task.id === id; }) || dialog) return;
    var task = taskById(id), element = document.createElement('dialog'); dialog = element;
    element.className = 'bt-feedback-dialog'; element.setAttribute('aria-labelledby', 'btFeedbackTitle');
    element.innerHTML = '<header class="bt-dialog-head"><h2 id="btFeedbackTitle">' + tr('业务任务反馈', 'Business task feedback') + '</h2><button type="button" class="ws-btn" data-bt="feedback-close" aria-label="' + tr('关闭反馈', 'Close feedback') + '">' + ico('x') + '</button></header><form id="btFeedbackForm"><div class="bt-dialog-body"><p>' + esc(task.name) + ' · ' + task.id + '</p><label for="btFeedbackContent">' + tr('反馈内容', 'Feedback') + '</label><textarea id="btFeedbackContent" rows="6" maxlength="2000" required placeholder="' + tr('请描述任务定义、通过标准或实际执行效果方面的问题与建议…', 'Share issues or suggestions about the task definition, acceptance criteria or execution outcomes…') + '"></textarea><div class="bt-char-count"><span>' + tr('反馈保存在当前浏览器中', 'Feedback is saved in this browser') + '</span><span id="btFeedbackCount">0 / 2000</span></div><p class="bt-error" id="btFeedbackError" role="alert" hidden></p></div><footer class="bt-dialog-foot">' + action('feedback-close', '', tr('取消', 'Cancel')) + '<button type="submit" class="btn-ink" id="btFeedbackSubmit" disabled>' + tr('提交反馈', 'Submit feedback') + '</button></footer></form>';
    document.body.appendChild(element); host.icons(); element.showModal(); element.querySelector('textarea').focus();
    element.addEventListener('close', function () { element.remove(); dialog = null; if (anchor && anchor.isConnected) anchor.focus(); });
    element.querySelector('textarea').addEventListener('input', function (event) { element.querySelector('#btFeedbackCount').textContent = event.target.value.length + ' / 2000'; element.querySelector('#btFeedbackSubmit').disabled = !event.target.value.trim(); element.querySelector('#btFeedbackError').hidden = true; });
    element.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault(); var result = saveFeedback(id, element.querySelector('textarea').value);
      if (!result.ok) { var error = element.querySelector('#btFeedbackError'); error.textContent = result.error; error.hidden = false; return; }
      element.close(); host.render(); host.toast(tr('反馈已保存', 'Feedback saved'));
      var target = document.querySelector('[data-bt="feedback"][data-id="' + id + '"]'); if (target) target.focus({ preventScroll: true });
    });
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-bt]');
    if (filterMenu && !event.target.closest('.bt-filter-menu') && !(button && button.getAttribute('data-bt') === 'filter')) closeFilter();
    if (!button || !host.render) return;
    var actionName = button.getAttribute('data-bt'), id = button.getAttribute('data-id');
    if (actionName === 'filter') { openFilter(id, button); return; }
    if (actionName === 'filter-clear') { setFilter(id, []); if (filterMenu) filterMenu.element.querySelectorAll('input').forEach(function (input) { input.checked = false; }); return; }
    if (actionName === 'definition') { openDefinition(id, button); return; }
    if (actionName === 'definition-close') { closeDefinition(); return; }
    if (actionName === 'feedback-close') { closeFeedback(); return; }
    if (actionName === 'feedback') { openFeedback(id, button); return; }
    if (actionName === 'task' && tasks().some(function (task) { return task.id === id; })) { view.task = id; view.session = null; }
    else if (actionName === 'back') { view.task = null; view.session = null; }
    else if (actionName === 'back-records') view.session = null;
    else if (actionName === 'session') {
      var run = records([view.task]).filter(function (item) { return item.id === id || item.sessionId === id; })[0]; if (!run) return;
      var task = taskById(run.taskId);
      var target = run.completion === 'completed' ? { round: run.completionRound, messageId: run.completionMessageId, recordId: run.id, taskId: task.id, taskName: task.name } : null;
      if (!global.AIOpsSessionDetail.focusReply(run.session, target)) { host.toast(tr('未找到该次执行的完成回复', 'The completion reply for this execution could not be found')); return; }
      view.session = run.id;
    }
    else if (actionName === 'reset') { view.query = ''; view.filters = { scene: [], agent: [] }; }
    else return;
    host.render({ resetScroll: true });
  });
  document.addEventListener('input', function (event) {
    if (event.target.id !== 'btSearch' || event.isComposing) return;
    view.query = event.target.value; refreshList();
  });
  document.addEventListener('change', function (event) {
    var input = event.target; if (!input.matches || !input.matches('[data-bt-filter]')) return;
    var key = input.getAttribute('data-bt-filter');
    var values = view.filters[key].filter(function (value) { return value !== input.value; });
    if (input.checked) values.push(input.value); setFilter(key, values);
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && filterMenu) { event.preventDefault(); closeFilter(true); } });
  global.addEventListener('resize', function () { closeFilter(); });
  document.addEventListener('scroll', function (event) { if (filterMenu && !(event.target.closest && event.target.closest('.bt-filter-menu'))) closeFilter(); }, true);
  document.addEventListener('compositionend', function (event) { if (event.target.id === 'btSearch') event.target.dispatchEvent(new Event('input', { bubbles: true })); });
  global.AIOpsBusinessTasks = { configure: function (next) { host = next; }, page: page, tasks: tasks, catalog: catalog, definition: definition, executionKey: executionKey, records: records, recordById: function (id) { return records().filter(function (run) { return run.id === id; })[0] || null; }, openExecution: openExecution, summary: summary, filteredTasks: function () { return filtered(tasks()); }, filterOptions: filterOptions, setFilter: setFilter, definitionMarkup: definitionMarkup, saveFeedback: saveFeedback, feedback: feedbackEntries, onSceneChange: function () { view = { task: null, session: null, query: '', filters: { scene: [], agent: [] } }; closeFilter(); closeDefinition(); closeFeedback(); } };
})(window);
