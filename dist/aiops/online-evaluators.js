/* Online evaluator configuration, session-grouped results, and browser-local scheduling. */
(function (global) {
  'use strict';
  var host = {}, data = global.AIOpsOnlineEvaluatorData, storage = null;
  var query = '', menuOpen = false, modal = null, editor = null, copilot = null, detailId = null, detailTab = 'results', sessionResult = null, running = false, lastRun = null, runtimeError = '', initializationError = '';
  var activePage = '', expandedSessions = Object.create(null);
  var filters = global.AIOpsOnlineEvaluatorFilters, listFilters = filters.defaultsList(), detailFilters = filters.defaultsDetail(), presentationCache = new WeakMap();
  var outputNames = { boolean: '布尔值', category: '类别', score: '评分', text: '文本', 'task-executions': '任务执行记录' };
  var frequencyNames = { daily: '每天', weekly: '每周', monthly: '每月', interval: '间隔', once: '单次' };
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function ico(name) { return '<i data-lucide="' + name + '" aria-hidden="true"></i>'; }
  function button(action, text, icon, extra, cls) { return '<button type="button" class="' + (cls || 'btn-soft') + '" data-oe="' + action + '"' + (extra || '') + '>' + (icon ? ico(icon) : '') + esc(text) + '</button>'; }
  function scope() { return global.AIOpsResources.scopeCatalog().map(function (scene) { return scene.id; }); }
  function sceneName(id) { var found = data.scenes().filter(function (scene) { return scene.id === id; })[0]; return found ? found.name : id; }
  function agentName(record) { var found = data.agents(record.sceneId).filter(function (agent) { return agent.id === record.agentId; })[0]; return found ? found.name : record.agentId; }
  function granularityName(id) { var found = data.constants.granularities.filter(function (item) { return item.id === id; })[0]; return found ? found.name : id; }
  function time(value) { var date = new Date(value); return isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
  function records() { return storage ? storage.list(scope()) : []; }
  function find(id) { return records().filter(function (record) { return record.id === id; })[0]; }
  function runtime() { return global.AIOpsOnlineEvaluatorRuntime; }
  function scheduler() { return global.AIOpsOnlineEvaluatorScheduler; }
  function enabled(record) { return record.enabled !== false; }
  function enabledStatus(record) { return '<span class="oe-enabled-status ' + (enabled(record) ? 'is-enabled' : 'is-disabled') + '">' + (enabled(record) ? '已启用' : '已停用') + '</span>'; }
  function toggleButton(record) { return button('toggle-enabled', enabled(record) ? '停用' : '启用', null, ' data-id="' + esc(record.id) + '" data-enabled="' + !enabled(record) + '" aria-label="' + (enabled(record) ? '停用' : '启用') + '评估器 ' + esc(record.name) + '"', 'btn-soft oe-status-toggle'); }
  function nextRunLabel(record) { if (!enabled(record)) return '已停用'; var next = scheduler() && scheduler().nextRunAt(record); return next ? '下次：' + time(next) : record.schedule.repeat === 'once' ? '无后续执行' : '等待调度'; }
  function results(id) { return runtime() ? runtime().results(id) : []; }
  function runs(id) { return runtime() ? runtime().runs(id) : []; }
  function percent(n, d) { return d ? (n / d * 100).toFixed(1) + '%' : '—'; }
  function presentation(item) {
    if (presentationCache.has(item)) return presentationCache.get(item);
    var value = runtime() && runtime().presentation ? runtime().presentation(item) : { type: item.outputType, value: item.value, pass: item.outputType === 'text' ? null : typeof item.pass === 'boolean' ? item.pass : item.acceptance === 'passed' ? true : item.acceptance === 'rejected' ? false : null, reason: item.reason || '缺少可核对的判断依据，尚不能确认结果。', criteria: '按结果记录中保存的评估标准判断。', observations: '请查看来源会话和执行记录。', evidence: [] };
    presentationCache.set(item, value); return value;
  }
  function passLabel(item) { var pass = presentation(item).pass; return pass === true ? '<span class="oe-pass is-yes">是</span>' : pass === false ? '<span class="oe-pass is-no">否</span>' : '<span class="oe-pass is-empty">—</span>'; }
  function filteredEvaluators() { return filters.evaluators(records(), listFilters, query, agentName); }
  function filteredResults(items, selection) { return filters.results(items, selection || detailFilters, { presentation: presentation, session: sessionRow }); }
  function filterSelect(kind, key, options, value, label) { return '<select data-oe-' + kind + '-filter="' + key + '" aria-label="' + esc(label) + '">' + options.map(function (option) { var id = Array.isArray(option) ? option[0] : option.id, name = Array.isArray(option) ? option[1] : option.label; return '<option value="' + esc(id) + '"' + (String(id) === String(value) ? ' selected' : '') + '>' + esc(name) + '</option>'; }).join('') + '</select>'; }
  function resultStatus(value) { var name = { passed: '通过', rejected: '未通过', pending: '待确认', na: '不适用', completed: '已完成', running: '进行中', failed: '未完成', success: '成功', error: '失败' }; return '<span class="oe-status is-' + esc(value) + '">' + esc(name[value] || value || '—') + '</span>'; }
  function metricCards(values) { return '<section class="oe-metrics" aria-label="评估数据统计">' + values.map(function (item) { return '<article class="oe-metric"><span>' + item[0] + '</span><strong>' + esc(item[1]) + '</strong><small>' + item[2] + '</small></article>'; }).join('') + '</section>'; }
  function overviewMetrics(all) {
    var ids = all.map(function (record) { return record.id; }), observations = ids.reduce(function (items, id) { return items.concat(results(id)); }, []), passed = observations.filter(function (item) { return presentation(item).pass === true; }).length, rejected = observations.filter(function (item) { return presentation(item).pass === false; }).length;
    var active = all.filter(enabled).length;
    return metricCards([['在线评估器', all.length, '当前筛选范围内的评估器'], ['已启用', active, '已停用 ' + (all.length - active) + ' 个'], ['评估记录', observations.length, '包含已停用评估器的历史记录'], ['评估通过率', percent(passed, passed + rejected), '通过 /（通过 + 未通过）']]);
  }
  function tagsMarkup(tags) { return tags.map(function (tag) { return '<span class="oe-tag">' + esc(tag) + '</span>'; }).join(''); }
  function tableRows() {
    return filteredEvaluators().map(function (record) {
      var evaluated = results(record.id), latest = evaluated[0], latestRun = runs(record.id)[0];
      return '<tr><td><button type="button" class="oe-record-name" data-oe="view" data-id="' + esc(record.id) + '">' + esc(record.name) + '</button></td><td>' + enabledStatus(record) + '</td><td><span class="oe-description" title="' + esc(record.description) + '">' + esc(record.description) + '</span></td><td>' + esc(agentName(record)) + '</td><td><div class="oe-tags">' + tagsMarkup(record.tags) + '</div></td><td><span class="oe-grain">' + esc(granularityName(record.granularity)) + '</span></td><td>' + esc(record.model) + '</td><td>' + record.samplingRate + '%</td><td>' + esc(data.scheduleSummary(record.schedule)) + '<small class="oe-helper">' + esc(nextRunLabel(record)) + '</small></td><td>' + evaluated.length + '</td><td>' + (latestRun || latest ? esc(time(latestRun ? latestRun.finishedAt : latest.evaluatedAt)) : '—') + '</td><td class="oe-actions">' + toggleButton(record) + button('view', '查看详情', null, ' data-id="' + esc(record.id) + '"') + button('run', '立即评估', null, ' data-id="' + esc(record.id) + '"' + (enabled(record) ? '' : ' disabled title="请先启用评估器"')) + button('edit', '编辑', null, ' data-id="' + esc(record.id) + '"') + '</td></tr>';
    }).join('');
  }
  function listFilterMarkup(all) {
    var agents = [], tags = [];
    all.forEach(function (record) { if (!agents.some(function (agent) { return agent[0] === record.agentId; })) agents.push([record.agentId, agentName(record)]); record.tags.forEach(function (tag) { if (tags.indexOf(tag) < 0) tags.push(tag); }); });
    var fields = [['状态', 'status', [['', '全部状态'], ['enabled', '已启用'], ['disabled', '已停用']]], ['评估粒度', 'granularity', [['', '全部粒度']].concat(data.constants.granularities.map(function (item) { return [item.id, item.name]; }))], ['关联 Agent', 'agentId', [['', '全部 Agent']].concat(agents)], ['标签', 'tag', [['', '全部标签']].concat(tags.sort().map(function (tag) { return [tag, tag]; }))]];
    return '<div class="oe-filter-bar">' + fields.map(function (field) { return '<label class="oe-filter-field"><span>' + field[0] + '</span>' + filterSelect('list', field[1], field[2], listFilters[field[1]], '筛选' + field[0]) + '</label>'; }).join('') + '</div>';
  }
  function listHeading(count, total) { return '在线评估器列表 <small>' + count + (count === total ? '' : ' / ' + total) + '</small>'; }
  function page() {
    presentationCache = new WeakMap();
    var current = detailId && find(detailId); if (current) return detailPage(current); detailId = null; sessionResult = null;
    var all = records(), matching = filteredEvaluators(), rows = tableRows();
    return '<div class="oe-page"><header class="page-heading has-actions oe-heading"><h1>在线评估器</h1><div class="oe-create-wrap"><button type="button" class="btn-ink" data-oe="create-menu" aria-haspopup="menu" aria-expanded="' + menuOpen + '">' + ico('plus') + '新建' + ico('chevron-down') + '</button><div class="oe-create-menu" role="menu"' + (menuOpen ? '' : ' hidden') + '>' + button('manual', '手动新建', 'square-pen', ' role="menuitem"') + button('copilot', 'Copilot 新建', 'sparkles', ' role="menuitem"') + '</div></div></header>' +
      '<div id="oeOverviewStats">' + overviewMetrics(matching) + '</div>' + (runtimeError ? '<div class="oe-error" role="alert">' + esc(runtimeError) + '</div>' : '') + (all.length ? '<section class="oe-list"><div class="oe-list-toolbar"><h2 id="oeListHeading">' + listHeading(matching.length, all.length) + '</h2><label class="oe-search">' + ico('search') + '<input id="oeSearch" type="search" aria-label="搜索在线评估器" placeholder="搜索名称、描述、Agent 或标签" value="' + esc(query) + '"></label>' + button('reset-list-filters', '清除筛选') + '</div>' + listFilterMarkup(all) + '<div class="oe-table-wrap"><table class="oe-table"><thead><tr>' + ['名称', '状态', '描述', '关联 Agent', '标签', '评估粒度', '评测模型', '采样率', '评估时间', '评估记录', '最近评估', '操作'].map(function (label) { return '<th scope="col">' + label + '</th>'; }).join('') + '</tr></thead><tbody id="oeRows">' + (rows || '<tr><td colspan="12"><div class="oe-empty">没有匹配的在线评估器</div></td></tr>') + '</tbody></table></div></section>' : '<section class="oe-empty">' + ico('scan-line') + '<h2>暂无在线评估器</h2><div class="oe-empty-actions">' + button('manual', '手动新建', 'plus') + button('copilot', 'Copilot 新建', 'sparkles') + '</div></section>') + '</div>';
  }
  function refreshList() {
    presentationCache = new WeakMap();
    var rows = document.getElementById('oeRows'), stats = document.getElementById('oeOverviewStats'), heading = document.getElementById('oeListHeading'), matching = filteredEvaluators();
    if (rows) rows.innerHTML = tableRows() || '<tr><td colspan="12"><div class="oe-empty">没有匹配的在线评估器</div></td></tr>';
    if (stats) stats.innerHTML = overviewMetrics(matching);
    if (heading) heading.innerHTML = listHeading(matching.length, records().length);
    host.icons();
  }
  function sessionRow(id) { return host.sessions ? host.sessions().filter(function (row) { return row.id === id; })[0] : null; }
  function taskName(id) { var task = global.AIOpsBusinessTasks && global.AIOpsBusinessTasks.definition(id); return task ? task.name : id || '—'; }
  function scoreValue(result) { var view = presentation(result); return view.type === 'score' && typeof view.value === 'number' ? view.value : null; }
  function outputLabel(result) {
    var view = presentation(result), value = view.value;
    if (value == null) return '—';
    if (view.type === 'boolean') return value ? 'True' : 'False';
    if (view.type === 'score') return esc(value);
    if (view.type === 'task-executions') return esc(JSON.stringify(value, null, 2));
    return esc(value);
  }
  function detailMetrics(record, items) {
    var passed = items.filter(function (item) { return presentation(item).pass === true; }).length, rejected = items.filter(function (item) { return presentation(item).pass === false; }).length, pending = items.filter(function (item) { var view = presentation(item); return view.pass == null && view.type !== 'text'; }).length;
    if (record.granularity === 'business-task') {
      var completed = items.filter(function (item) { return item.completion === 'completed'; }).length;
      return metricCards([['识别执行次数', items.length, '当前筛选范围内的任务执行'], ['任务完成率', percent(completed, items.length), '已完成 ' + completed + ' / 执行 ' + items.length], ['任务通过率', percent(passed, completed), '是 ' + passed + ' / 已完成 ' + completed], ['未判定记录', pending, '不作为通过值“否”统计']]);
    }
    var scores = items.filter(function (item) { return scoreValue(item) != null; });
    return metricCards([['评估记录', items.length, '当前筛选范围内的评估记录'], ['评估通过率', percent(passed, passed + rejected), '是 ' + passed + ' / 已判定 ' + (passed + rejected)], ['未判定记录', pending, '文本无通过标准，不计入此项'], [record.output.type === 'score' ? '平均评分' : '评估会话', record.output.type === 'score' ? (scores.length ? (scores.reduce(function (n, item) { return n + scoreValue(item); }, 0) / scores.length).toFixed(1) : '—') : sessionGroups(items).length, record.output.type === 'score' ? '按筛选后的实际评分计算' : '按会话 ID 去重']]);
  }
  function resultRows(record, items, nested) {
    if (!items.length) return '<tr><td colspan="' + (nested ? 6 : 7) + '"><div class="oe-empty">暂无评估记录</div></td></tr>';
    return items.map(function (item) {
      var row = sessionRow(item.sessionId), subject = item.taskId ? taskName(item.taskId) : item.targetName || item.targetId || item.sessionId, view = presentation(item);
      var boundary = item.taskId && item.startRound ? ' · 第 ' + item.startRound + (item.completionRound ? '→' + item.completionRound : '') + ' 轮' : '';
      return '<tr data-result-id="' + esc(item.id) + '"><td><button type="button" class="oe-record-name" data-oe="result" data-id="' + esc(item.id) + '">' + esc(subject) + '</button><small class="oe-helper">' + esc((item.executionId || item.id) + boundary) + '</small></td>' + (nested ? '' : '<td>' + esc(row ? row.name : item.sessionId) + '<small class="oe-helper">' + esc(item.sessionId) + '</small></td>') + '<td>' + (item.taskId ? resultStatus(item.completion) : esc(granularityName(record.granularity))) + '</td><td><div class="oe-result-text" title="' + esc(typeof view.value === 'object' ? JSON.stringify(view.value) : view.value) + '">' + outputLabel(item) + '</div></td><td>' + passLabel(item) + '</td><td>' + esc(time(item.evaluatedAt)) + '</td><td class="oe-actions">' + button('result', '评估详情', null, ' data-id="' + esc(item.id) + '"') + button('session', item.taskId && item.completion === 'completed' ? '查看完成回复' : '查看会话', null, ' data-id="' + esc(item.id) + '"') + '</td></tr>';
    }).join('');
  }
  function sessionGroups(items) {
    var groups = Object.create(null);
    items.forEach(function (item) {
      var id = item.sessionId; if (!id) return;
      if (!groups[id]) { var row = sessionRow(id); groups[id] = { id: id, name: row ? row.name : item.sessionName || id, time: row ? row.time : '', items: [], lastAt: '', passed: 0, rejected: 0, pending: 0, na: 0, completed: 0 }; }
      var group = groups[id], view = presentation(item); group.items.push(item); if (item.completion === 'completed') group.completed++;
      if (group.lastAt < (item.evaluatedAt || '')) group.lastAt = item.evaluatedAt;
      if (view.pass === true) group.passed++; else if (view.pass === false) group.rejected++; else if (view.type === 'text') group.na++; else group.pending++;
    });
    return Object.keys(groups).map(function (id) { var group = groups[id]; group.items.sort(function (a, b) { return (a.startRound || a.completionRound || 0) - (b.startRound || b.completionRound || 0) || String(a.targetId || a.id).localeCompare(String(b.targetId || b.id)); }); return group; }).sort(function (a, b) { return b.lastAt.localeCompare(a.lastAt) || b.time.localeCompare(a.time) || a.id.localeCompare(b.id); });
  }
  function groupKey(record, id) { return JSON.stringify([record.id, id]); }
  function outputSummary(group) {
    var entries = [], views = group.items.map(presentation);
    if (views.every(function (view) { return view.type === 'text'; })) return '<div class="oe-result-text">' + esc(views[0].value == null ? '—' : views[0].value) + '</div><small class="oe-helper">共 ' + views.length + ' 条文本结果</small>';
    views.forEach(function (view) {
      var label = view.value == null ? '—' : view.type === 'boolean' ? (view.value ? 'True' : 'False') : view.type === 'task-executions' ? taskName(view.value.taskId) + ' · ' + ({ completed: '已完成', running: '进行中', failed: '未完成' }[view.value.completion] || '未判定') : String(view.value);
      var key = view.type + ':' + label, old = entries.filter(function (entry) { return entry.key === key; })[0]; if (old) old.count++; else entries.push({ key: key, label: label, count: 1 });
    });
    var full = entries.map(function (entry) { return entry.label + ' × ' + entry.count; }).join('；');
    return '<div class="oe-result-text" title="' + esc(full) + '">' + esc(entries.slice(0, 4).map(function (entry) { return entry.label + ' × ' + entry.count; }).join('；')) + (entries.length > 4 ? ' …' : '') + '</div>';
  }
  function passSummary(group) {
    var parts = []; if (group.passed) parts.push('是 ' + group.passed); if (group.rejected) parts.push('否 ' + group.rejected);
    if (group.pending || group.na) parts.push('— ' + (group.pending + group.na)); return '<span class="oe-session-counts">' + esc(parts.join(' / ') || '—') + '</span>';
  }
  function sessionRowsMarkup(record, groups) {
    if (!groups.length) return '<tr><td colspan="7"><div class="oe-empty">暂无评估记录</div></td></tr>';
    var nested = record.granularity !== 'session', kind = record.granularity === 'business-task' ? '任务执行' : record.granularity === 'trace' ? 'Trace' : 'Span';
    return groups.map(function (group) {
      var open = !!expandedSessions[groupKey(record, group.id)], first = group.items[0], denominator = record.granularity === 'business-task' ? group.completed : group.passed + group.rejected, panelId = 'oe-session-group-' + encodeURIComponent(group.id);
      var main = '<tr class="oe-session-row' + (open ? ' is-expanded' : '') + '" data-session-id="' + esc(group.id) + '"><td>' + (nested ? '<button type="button" class="oe-session-toggle' + (open ? ' is-expanded' : '') + '" data-oe="expand-session" data-id="' + esc(group.id) + '" aria-expanded="' + open + '" aria-controls="' + panelId + '" aria-label="' + (open ? '收起' : '展开') + '会话 ' + esc(group.name + ' · ' + group.id) + '">' + ico('chevron-right') + '<span>' + esc(group.name) + '<small>' + esc(group.id) + '</small></span></button>' : '<button type="button" class="oe-record-name" data-oe="result" data-id="' + esc(first.id) + '">' + esc(group.name) + '</button><small class="oe-helper">' + esc(group.id) + '</small>') + '</td><td>' + (nested ? outputSummary(group) : '<div class="oe-result-text">' + outputLabel(first) + '</div>') + '</td><td>' + (nested ? passSummary(group) : passLabel(first)) + '</td><td><span class="oe-session-count">' + group.items.length + ' 条' + (nested ? esc(kind) : '会话评估') + '</span></td><td>' + percent(group.passed, denominator) + '</td><td>' + esc(time(group.lastAt)) + '</td><td class="oe-actions">' + (nested ? '' : button('result', '评估详情', null, ' data-id="' + esc(first.id) + '"')) + button('group-session', '查看会话', null, ' data-id="' + esc(group.id) + '"') + '</td></tr>';
      var children = nested && open ? '<tr class="oe-session-children" id="' + panelId + '" data-session-children="' + esc(group.id) + '"><td colspan="7"><div class="oe-session-child-panel"><header><strong>' + esc(group.name) + '</strong><span>共 ' + group.items.length + ' 条' + esc(kind) + '评估记录</span></header><div class="oe-table-wrap"><table class="oe-table oe-results-table"><thead><tr>' + ['评估对象', record.granularity === 'business-task' ? '完成状态' : '评估粒度', '评估结果', '通过', '最近评估', '操作'].map(function (label) { return '<th>' + label + '</th>'; }).join('') + '</tr></thead><tbody>' + resultRows(record, group.items, true) + '</tbody></table></div></div></td></tr>' : '';
      return main + children;
    }).join('');
  }
  function sessionTable(record, groups, count) {
    return '<section class="oe-list"><div class="oe-list-toolbar"><h2>评估会话 <small>' + groups.length + '</small></h2><span class="oe-helper">共 ' + count + ' 条评估记录</span></div><div class="oe-table-wrap"><table class="oe-table oe-session-table"><thead><tr>' + ['会话', '评估结果', record.granularity === 'session' ? '通过' : '通过（汇总）', '记录数', record.granularity === 'business-task' ? '任务通过率' : '通过率', '最近评估', '操作'].map(function (label) { return '<th>' + label + '</th>'; }).join('') + '</tr></thead><tbody>' + sessionRowsMarkup(record, groups) + '</tbody></table></div></section>';
  }
  function resultFilterControls(record, all) {
    var choices = filters.resultChoices(all, presentation, record.output), choice = detailFilters.resultChoice;
    return '<label class="oe-filter-field"><span>评估结果</span>' + filterSelect('result', 'resultChoice', choices, choice, '筛选评估结果') + '</label>' + (choice === 'score' ? '<label class="oe-filter-field"><span>最低评分</span><input type="number" min="0" max="100" step="any" data-oe-result-filter="minScore" aria-label="最低评分" placeholder="不限" value="' + esc(detailFilters.minScore) + '"></label><label class="oe-filter-field"><span>最高评分</span><input type="number" min="0" max="100" step="any" data-oe-result-filter="maxScore" aria-label="最高评分" placeholder="不限" value="' + esc(detailFilters.maxScore) + '"></label>' : choice === 'text' ? '<label class="oe-filter-field"><span>文本包含</span><input type="search" data-oe-result-filter="text" aria-label="筛选文本结果" placeholder="搜索文本结果" value="' + esc(detailFilters.text) + '"></label>' : '') + '<label class="oe-filter-field"><span>通过</span>' + filterSelect('result', 'pass', [['all', '全部通过状态'], ['yes', '是'], ['no', '否'], ['undecided', '未判定'], ['not-applicable', '无通过标准']], detailFilters.pass, '筛选通过') + '</label>' + button('reset-result-filters', '清除筛选');
  }
  function detailFilterMarkup(record, all) {
    return '<div class="oe-session-filters"><div class="oe-session-filter-row"><label class="oe-search">' + ico('search') + '<input type="search" id="oeSessionSearch" data-oe-result-filter="query" aria-label="搜索会话名称或 ID" placeholder="搜索会话名称或 ID" value="' + esc(detailFilters.query) + '"></label><label class="oe-filter-field"><span>时间依据</span>' + filterSelect('result', 'dateBy', [['evaluation', '评估时间'], ['session', '会话时间']], detailFilters.dateBy, '时间依据') + '</label><label class="oe-filter-field"><span>开始日期</span><input type="date" data-oe-result-filter="from" aria-label="开始日期" value="' + esc(detailFilters.from) + '"></label><label class="oe-filter-field"><span>结束日期</span><input type="date" data-oe-result-filter="to" aria-label="结束日期" value="' + esc(detailFilters.to) + '"></label></div><div class="oe-result-filters" id="oeResultFilters">' + resultFilterControls(record, all) + '</div><p class="oe-error" role="alert" id="oeResultFilterError"' + (filters.validate(detailFilters) ? '' : ' hidden') + '>' + esc(filters.validate(detailFilters)) + '</p></div>';
  }
  function filterSummary(groups, items) { return '当前筛选：' + groups.length + ' 个会话，' + items.length + ' 条评估记录'; }
  function refreshDetail() {
    var record = find(detailId); if (!record) return;
    presentationCache = new WeakMap(); var all = results(record.id), items = filteredResults(all), groups = sessionGroups(items), stats = document.getElementById('oeDetailStats'), table = document.getElementById('oeSessionResults'), count = document.getElementById('oeSessionTabCount'), summary = document.getElementById('oeFilterSummary'), error = document.getElementById('oeResultFilterError'), invalid = filters.validate(detailFilters);
    if (stats) stats.innerHTML = detailMetrics(record, items);
    if (table) table.innerHTML = sessionTable(record, groups, items.length);
    if (count) count.textContent = groups.length;
    if (summary) summary.textContent = filterSummary(groups, items);
    if (error) { error.hidden = !invalid; error.textContent = invalid; }
    host.icons();
  }
  function runSummary(run) { return '扫描 ' + (run.scanned || 0) + ' · 识别 ' + (run.recognized || 0) + ' · 新增 ' + (run.created || 0) + ' · 更新 ' + (run.updated || 0) + ' · 未变化 ' + (run.unchanged || 0); }
  function detailPage(record) {
    var all = results(record.id), items = filteredResults(all), history = runs(record.id), groups = sessionGroups(items);
    if (sessionResult) {
      var observation = typeof sessionResult === 'object' ? { sessionId: sessionResult.sessionId, id: sessionResult.sessionId } : all.filter(function (item) { return item.id === sessionResult; })[0], row = observation && sessionRow(observation.sessionId);
      if (row) return '<div class="oe-page oe-session-context"><header class="oe-session-head">' + button('back-results', '返回评估记录', 'arrow-left', '', 'oe-back') + '<span>' + esc(record.name) + ' · ' + esc(observation.executionId || observation.id) + '</span></header>' + global.AIOpsSessionDetail.page(row, true) + '</div>';
      sessionResult = null;
    }
    var content;
    if (detailTab === 'configuration') content = '<section class="oe-list oe-configuration oe-detail-config">' + definition(record) + '</section>';
    else if (detailTab === 'runs') content = '<section class="oe-list"><div class="oe-table-wrap"><table class="oe-table oe-runs-table"><thead><tr>' + ['运行编号', '触发方式', '开始时间', '完成时间', '状态', '扫描会话', '识别/评估对象', '新增', '更新', '未变化'].map(function (label) { return '<th>' + label + '</th>'; }).join('') + '</tr></thead><tbody>' + (history.length ? history.map(function (run) { return '<tr><td>' + esc(run.id) + '</td><td>' + (run.trigger === 'scheduled' ? '定时执行' : run.trigger === 'seed' ? '示例历史' : '手动执行') + '</td><td>' + esc(time(run.startedAt)) + '</td><td>' + esc(time(run.finishedAt)) + '</td><td>' + resultStatus(run.status) + '</td><td>' + (run.scanned || 0) + '</td><td>' + (run.recognized || 0) + '</td><td>' + (run.created || 0) + '</td><td>' + (run.updated || 0) + '</td><td>' + (run.unchanged || 0) + '</td></tr>'; }).join('') : '<tr><td colspan="10"><div class="oe-empty">暂无运行记录</div></td></tr>') + '</tbody></table></div></section>';
    else content = detailFilterMarkup(record, all) + '<div id="oeSessionResults">' + sessionTable(record, groups, items.length) + '</div>';
    return '<div class="oe-page oe-detail-page"><header class="oe-detail-heading"><div>' + button('back-list', query.trim() || Object.keys(listFilters).some(function (key) { return !!listFilters[key]; }) ? '返回评估器列表' : '全部在线评估器', 'arrow-left', '', 'oe-back') + '<h1>' + esc(record.name) + '</h1><p>' + enabledStatus(record) + ' ' + esc(agentName(record)) + ' · ' + esc(granularityName(record.granularity)) + ' · ' + esc(record.model) + '</p><small class="oe-helper">' + esc(nextRunLabel(record)) + '</small></div><div class="oe-detail-actions">' + toggleButton(record) + button('edit', '编辑', 'pencil', ' data-id="' + esc(record.id) + '"') + button('run', running ? '评估中…' : '立即评估', 'play', ' data-id="' + esc(record.id) + '"' + (running || !enabled(record) ? ' disabled' : '') + (!enabled(record) ? ' title="请先启用评估器"' : ''), 'btn-ink') + '</div></header>' + '<div id="oeDetailStats">' + detailMetrics(record, items) + '</div><div class="oe-filter-summary" id="oeFilterSummary">' + filterSummary(groups, items) + '</div>' + (runtimeError ? '<div class="oe-error" role="alert">' + esc(runtimeError) + '</div>' : '') + (lastRun && lastRun.evaluatorId === record.id ? '<div class="oe-run-summary" role="status">' + esc(runSummary(lastRun)) + '</div>' : '') + '<div class="oe-detail-tabs" role="tablist" aria-label="评估器详情">' + [['results', '评估会话', groups.length], ['runs', '运行记录', history.length], ['configuration', '评估配置', '']].map(function (tab) { return '<button type="button" role="tab" data-oe="detail-tab" data-id="' + tab[0] + '" class="' + (detailTab === tab[0] ? 'is-active' : '') + '" aria-selected="' + (detailTab === tab[0]) + '">' + tab[1] + (tab[2] !== '' ? ' <span' + (tab[0] === 'results' ? ' id="oeSessionTabCount"' : '') + '>' + tab[2] + '</span>' : '') + '</button>'; }).join('') + '</div>' + content + '</div>';
  }
  function openResult(id, anchor) {
    var record = find(detailId), item = record && results(record.id).filter(function (result) { return result.id === id; })[0]; if (!item) return;
    var view = presentation(item), row = sessionRow(item.sessionId), conversation = row && global.AIOpsSessionDetail.data(row), messages = [];
    if (conversation) conversation.rounds.forEach(function (turn) { messages.push({ id: turn.inputId, text: turn.input, label: '用户 · 第 ' + turn.n + ' 轮' }); if (turn.outputId) messages.push({ id: turn.outputId, text: turn.output, label: 'Agent · 第 ' + turn.n + ' 轮' }); });
    var evidenceIds = (item.evidence || []).map(function (evidence) { return typeof evidence === 'string' ? evidence : evidence.messageId; }), evidence = messages.filter(function (message) { return evidenceIds.indexOf(message.id) >= 0 || message.id === item.startMessageId || message.id === item.completionMessageId; });
    if (conversation) conversation.records.filter(function (step) { return evidenceIds.indexOf(step.id) >= 0; }).forEach(function (step) { evidence.push({ id: step.id, label: step.name + ' · ' + step.type + ' · 第 ' + step.round + ' 轮', text: '输入：\n' + (typeof step.input === 'string' ? step.input : JSON.stringify(step.input, null, 2)) + '\n\n输出：\n' + (typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)) }); });
    if (!evidence.length) evidence = (view.evidence || []).map(function (entry) { return { id: entry.id, label: entry.kind === 'span' ? 'Span 证据' : entry.kind === 'input' ? '输入证据' : '输出证据', text: entry.text }; });
    var dimensions = (item.dimensions || []).map(function (dimension) { return '<tr><td>' + esc(dimension.name) + '</td><td>' + esc(dimension.value == null ? dimension.status || (dimension.score == null ? '未判定' : dimension.score) : dimension.value) + '</td><td>' + esc(dimension.reason || dimension.description || '没有记录该维度的具体依据。') + '</td></tr>'; }).join('');
    var metadata = [['评估器', item.evaluatorName || record.name], ['来源会话', row ? row.name + ' · ' + row.id : item.sessionId], ['输出类型', outputNames[view.type] || '未记录'], ['评估时间', time(item.evaluatedAt)], ['模型', item.model || record.model]];
    if (item.taskId) metadata.push(['业务任务', taskName(item.taskId)], ['任务版本', item.taskVersion || '—']);
    metadata.push(['起始消息', item.startMessageId || '—'], ['完成回复', item.completionMessageId || '—']);
    var missing = view.pass == null ? '<small class="oe-helper">' + (view.type === 'text' ? '文本输出未设置通过标准。' : '当前证据或结果不足，尚未判定。') + '</small>' : '';
    var judgment = '<section class="oe-detail-section oe-judgment" aria-label="判断依据"><h3>判断依据</h3><dl><div class="oe-rule"><dt>适用标准</dt><dd>' + esc(view.criteria || '没有记录可核对的通过标准。') + '</dd></div><div class="oe-observations"><dt>观察到的证据</dt><dd>' + esc(view.observations || '没有记录可核对的输入或输出证据。') + '</dd></div><div class="oe-conclusion"><dt>判断结论</dt><dd>' + esc(view.reason || '依据不足，尚未作出通过判定。') + '</dd></div></dl></section>';
    mount('oe-detail oe-result-dialog', heading('评估记录详情') + '<div class="oe-editor-body"><dl class="oe-definition-grid">' + metadata.map(function (pair) { return '<div><dt>' + pair[0] + '</dt><dd>' + esc(pair[1]) + '</dd></div>'; }).join('') + '</dl><section class="oe-detail-section"><h3>评估结果</h3><pre class="oe-result-full">' + outputLabel(item) + '</pre><dl class="oe-definition-grid"><div><dt>通过</dt><dd>' + passLabel(item) + missing + '</dd></div></dl></section>' + judgment + (dimensions ? '<section class="oe-detail-section"><h3>评估维度</h3><table class="oe-detail-output oe-dimension-results"><thead><tr><th>维度</th><th>结果</th><th>依据</th></tr></thead><tbody>' + dimensions + '</tbody></table></section>' : '') + '<section class="oe-detail-section"><h3>会话证据</h3><div class="oe-evidence">' + (evidence.length ? evidence.map(function (message) { return '<blockquote><header>' + esc(message.label) + ' <small>' + esc(message.id) + '</small></header><p>' + esc(message.text) + '</p></blockquote>'; }).join('') : '<p>历史记录没有采集到可定位的会话证据。</p>') + '</div></section></div><footer class="oe-editor-foot">' + button('close', '关闭') + button('session', '查看会话', 'messages-square', ' data-id="' + esc(item.id) + '"', 'btn-ink') + '</footer>', anchor);
  }
  async function runEvaluator(id) {
    var record = find(id); if (!record || !runtime() || running) return;
    if (!enabled(record)) { host.toast('评估器已停用，请先启用。'); return; }
    var originalModal = modal, originalDetail = detailId, originalTab = detailTab;
    running = true; runtimeError = ''; var result;
    try { result = scheduler() ? await scheduler().runNow(record) : runtime().run(record); } catch (error) { result = { ok: false, error: error.message || '评估失败，请重试。' }; }
    running = false;
    var sameView = (!activePage || activePage === '在线评估器') && modal === originalModal && detailId === originalDetail && detailTab === originalTab;
    if (!sameView) { if (result.ok) schedulerRefresh(result.run); else schedulerError(result.error); return; }
    if (!result.ok) { runtimeError = result.error || (result.errors || []).map(function (error) { return error.message; }).join('；') || '评估失败，请重试。'; host.render(); host.toast(runtimeError); return; }
    lastRun = result.run; detailId = id; detailTab = 'results'; sessionResult = null; closeModal(); host.render({ resetScroll: true }); host.toast('评估完成，' + runSummary(result.run));
  }
  function toggleEnabled(id, target) {
    var record = find(id); if (!record) return;
    var result = storage.setEnabled(id, typeof target === 'boolean' ? target : !enabled(record));
    if (!result.ok) { runtimeError = result.error || (result.errors || []).map(function (error) { return error.message; }).join('；') || '状态更新失败，请重试。'; host.render(); host.toast(runtimeError); return; }
    runtimeError = ''; if (scheduler()) scheduler().tick().catch(function (error) { schedulerError(error.message); });
    host.render({ resetScroll: false }); host.toast(enabled(result.record) ? '评估器已启用' : '评估器已停用，历史评估记录已保留');
  }
  function schedulerRefresh(run) {
    if (run && run.evaluatorId === detailId) lastRun = run;
    var focused = document.activeElement, editingFilter = focused && (focused.id === 'oeSearch' || focused.closest && focused.closest('.oe-session-filters, .oe-filter-bar'));
    if (activePage === '在线评估器' && !modal && !sessionResult && !editingFilter) host.render({ resetScroll: false });
  }
  function schedulerError(message) { runtimeError = String(message || '自动评估失败，请检查评估配置。'); schedulerRefresh(); }
  function closeMenu() {
    menuOpen = false; var menu = document.querySelector('.oe-create-menu'); if (menu) menu.hidden = true;
    var trigger = document.querySelector('[data-oe="create-menu"]'); if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }
  function closeModal() {
    var old = modal; modal = null; editor = null; copilot = null;
    if (old) { old.close(); old.remove(); }
  }
  function mount(className, html, anchor) {
    closeMenu(); closeModal();
    var element = document.createElement('dialog'); element.className = className; element.innerHTML = html;
    element.setAttribute('aria-labelledby', 'oeDialogTitle'); modal = element;
    element.addEventListener('close', function () { if (modal === element) { modal = null; editor = null; copilot = null; } element.remove(); if (!modal && anchor && anchor.isConnected) anchor.focus({ preventScroll: true }); });
    document.body.appendChild(element); host.icons(); element.showModal(); return element;
  }
  function heading(title) { return '<header class="oe-editor-head"><h2 id="oeDialogTitle">' + esc(title) + '</h2>' + button('close', '', 'x', ' aria-label="关闭在线评估器弹窗"', 'ws-btn') + '</header>'; }
  function get(object, path) { return path.split('.').reduce(function (value, key) { return value == null ? '' : value[key]; }, object); }
  function set(object, path, value) { var parts = path.split('.'), key = parts.pop(), target = object; parts.forEach(function (part) { target = target[part] || (target[part] = {}); }); target[key] = value; }
  function input(path, value, attrs) { return '<input data-oe-field="' + path + '" value="' + esc(value) + '"' + (attrs || '') + '>'; }
  function textarea(path, value, attrs) { return '<textarea data-oe-field="' + path + '"' + (attrs || '') + '>' + esc(value) + '</textarea>'; }
  function field(label, control, wide, note, required) { return '<label class="oe-field' + (wide ? ' oe-wide' : '') + '"><span>' + esc(label) + (required ? ' <b class="oe-required" aria-hidden="true">*</b>' : '') + '</span>' + control + (note ? '<small class="oe-helper">' + esc(note) + '</small>' : '') + '</label>'; }
  function select(path, options, value, attrs) { return '<select data-oe-field="' + path + '"' + (attrs || '') + '>' + options.map(function (option) { var id = Array.isArray(option) ? option[0] : option, label = Array.isArray(option) ? option[1] : option; return '<option value="' + esc(id) + '"' + (String(id) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>'; }).join('') + '</select>'; }
  function availableScenes() { var ids = scope(); return data.scenes().filter(function (scene) { return ids.indexOf(scene.id) >= 0; }); }
  function agentsSelect(draft) {
    return '<select data-oe-field="agentId" required aria-label="关联 Agent"><option value="">请选择 Agent</option>' + availableScenes().map(function (scene) {
      return '<optgroup label="' + esc(scene.name) + '">' + data.agents(scene.id).map(function (agent) { return '<option value="' + esc(agent.id) + '"' + (agent.id === draft.agentId ? ' selected' : '') + '>' + esc(agent.name) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select>';
  }
  function tagChoices() {
    if (!editor) return [];
    var selected = editor.draft.tags, search = (editor.tagSearch || '').trim().toLowerCase(), history = [];
    records().forEach(function (record) { record.tags.forEach(function (tag) { if (history.indexOf(tag) < 0) history.push(tag); }); });
    return history.filter(function (tag) { return selected.indexOf(tag) < 0 && (!search || tag.toLowerCase().indexOf(search) >= 0); });
  }
  function tagChips(tags) {
    return tags.map(function (tag, index) { return '<span class="oe-tag-chip"><span>' + esc(tag) + '</span>' + button('remove-tag', '', 'x', ' data-index="' + index + '" aria-label="移除标签 ' + esc(tag) + '"', '') + '</span>'; }).join('');
  }
  function tagPicker(draft) {
    return '<div class="oe-field"><span id="oeTagLabel">标签 <b class="oe-required" aria-hidden="true">*</b></span><div class="oe-tag-picker"><div class="oe-tag-control"><div class="oe-tag-chips" id="oeTagChips">' + tagChips(draft.tags) + '</div><input id="oeTagInput" class="oe-tag-entry" type="text" role="combobox" aria-labelledby="oeTagLabel" aria-autocomplete="list" aria-controls="oeTagMenu" aria-expanded="false" autocomplete="off" placeholder="搜索或输入后回车添加"></div><div id="oeTagMenu" class="oe-tag-menu" role="listbox" aria-label="历史标签" hidden></div></div></div>';
  }
  function refreshTags(focus) {
    if (!editor) return;
    var root = editor.element, entry = root.querySelector('#oeTagInput'), menu = root.querySelector('#oeTagMenu'), choices = tagChoices();
    root.querySelector('#oeTagChips').innerHTML = tagChips(editor.draft.tags);
    menu.innerHTML = choices.map(function (tag, index) { return '<button type="button" tabindex="-1" role="option" id="oeTagOption' + index + '" class="oe-tag-option' + (editor.tagActive === index ? ' is-active' : '') + '" data-oe="select-tag" data-index="' + index + '" aria-selected="' + (editor.tagActive === index) + '">' + esc(tag) + '</button>'; }).join('') + (!choices.length ? '<div class="oe-tag-empty">' + ((editor.tagSearch || '').trim() ? '回车添加新标签' : '暂无可选历史标签') + '</div>' : '');
    menu.hidden = !editor.tagOpen; entry.value = editor.tagSearch || ''; entry.setAttribute('aria-expanded', String(!!editor.tagOpen));
    if (editor.tagOpen && editor.tagActive >= 0 && choices[editor.tagActive]) entry.setAttribute('aria-activedescendant', 'oeTagOption' + editor.tagActive);
    else entry.removeAttribute('aria-activedescendant');
    host.icons(); if (focus) entry.focus();
  }
  function addTag(value, focus) {
    if (!editor) return; var tag = String(value || '').trim();
    if (tag && editor.draft.tags.indexOf(tag) < 0) editor.draft.tags.push(tag);
    editor.tagSearch = ''; editor.tagActive = -1; editor.tagOpen = !!focus; refreshTags(focus);
  }
  function closeTags() { if (editor && editor.tagOpen) { editor.tagOpen = false; editor.tagActive = -1; refreshTags(false); } }
  function rangeFields(draft) {
    var placeholders = { session: '例如：当天新增且已结束的会话', trace: '例如：近 1 小时新增、包含错误的 Trace', span: '例如：当天新增且耗时超过 3 秒的 Span' };
    if (draft.granularity === 'business-task') {
      var available = data.taskDefinitions ? data.taskDefinitions(draft.sceneId, draft.agentId).filter(function () { return !!draft.agentId; }) : [], ids = draft.taskIds || [];
      return '<fieldset class="oe-fieldset oe-wide"><legend>关联业务任务 <b class="oe-required">*</b></legend><div class="oe-task-options">' + (available.length ? available.map(function (task) { return '<label><input type="checkbox" data-oe-task value="' + esc(task.id) + '"' + (ids.indexOf(task.id) >= 0 ? ' checked' : '') + '><span>' + esc(task.name) + '<small>' + esc(task.id + ' · ' + task.version) + '</small></span></label>'; }).join('') : '<span class="oe-helper">' + (draft.agentId ? '该 Agent 暂无业务任务。' : '请先选择关联 Agent。') + '</span>') + '</div></fieldset><div class="oe-wide" id="oeTaskSnapshots">' + taskSnapshots(draft.taskSnapshots || []) + '</div>' + field('会话筛选逻辑', textarea('filterLogic', draft.filterLogic, ' rows="2" maxlength="4000" required placeholder="例如：全部正式用户会话，或最近 7 天新增的会话"'), true, '', true);
    }
    return (draft.granularity === 'span' ? '<fieldset class="oe-fieldset oe-wide"><legend>Span 类型 <b class="oe-required">*</b></legend><div class="oe-options">' + data.constants.spanTypes.map(function (item) { return '<label><input type="checkbox" data-oe-span value="' + item.id + '"' + (draft.spanTypes.indexOf(item.id) >= 0 ? ' checked' : '') + '>' + esc(item.name) + '</label>'; }).join('') + '</div></fieldset>' : '') + field('筛选逻辑', textarea('filterLogic', draft.filterLogic, ' rows="3" maxlength="4000" required placeholder="' + placeholders[draft.granularity] + '"'), true, '', true);
  }
  function taskSnapshots(tasks) {
    return tasks.map(function (task) {
      return '<section class="oe-task-snapshot"><header><h4>' + esc(task.name) + '</h4><span>' + esc(task.id + ' · ' + task.version) + '</span></header><dl>' + [['任务定义', task.description], ['任务输入', task.input], ['预期产出', task.output], ['完成条件', task.completion]].map(function (pair) { return '<div><dt>' + pair[0] + '</dt><dd>' + esc(pair[1]) + '</dd></div>'; }).join('') + '</dl><h5>通过标准</h5><ul>' + (task.criteria || []).map(function (criterion) { return '<li>' + esc(criterion) + '</li>'; }).join('') + '</ul><h5>评估维度</h5><table><thead><tr><th>维度</th><th>评估标准</th><th>结果取值</th></tr></thead><tbody>' + (task.dimensions || []).map(function (dimension) { return '<tr><td>' + esc(dimension.name) + '</td><td>' + esc(dimension.description) + '</td><td>' + esc((dimension.values || []).join(' / ')) + '</td></tr>'; }).join('') + '</tbody></table></section>';
    }).join('');
  }
  function samplingField(draft) { return field('采样率', '<div class="oe-percent-unit">' + input('samplingRate', draft.granularity === 'business-task' ? 100 : draft.samplingRate, ' type="number" min="0.01" max="100" step="any" required' + (draft.granularity === 'business-task' ? ' disabled' : '')) + '<span>%</span></div>', false, draft.granularity === 'business-task' ? '全量识别符合筛选条件的会话。' : '对满足筛选逻辑的记录进行采样。', true); }
  function outputSection(draft) {
    if (draft.granularity === 'business-task') return '<h3>输出与通过标准</h3><div class="oe-task-output"><strong>任务执行记录</strong><p>每次执行包含起始消息、完成回复、完成状态、通过判定及各维度结果；通过标准沿用关联业务任务。</p></div>';
    return '<h3>输出与通过标准</h3><fieldset class="oe-fieldset"><legend>输出类型</legend><div class="oe-output-options">' + ['boolean', 'category', 'score', 'text'].map(function (type) { return '<label class="' + (draft.output.type === type ? 'is-selected' : '') + '"><input type="radio" name="oeOutputType" value="' + type + '"' + (draft.output.type === type ? ' checked' : '') + '>' + outputNames[type] + '</label>'; }).join('') + '</div></fieldset><div id="oeOutput">' + outputFields(draft) + '</div>';
  }
  function scheduleFields(draft) {
    var schedule = draft.schedule, extra = '', timeField = '';
    if (schedule.repeat === 'weekly' || schedule.repeat === 'monthly') {
      var weekly = schedule.repeat === 'weekly', selected = weekly ? schedule.weekdays : schedule.monthdays;
      extra = '<div class="oe-day-options' + (weekly ? '' : ' oe-monthdays') + '" role="group" aria-label="' + (weekly ? '星期' : '每月日期') + '">' + Array.from({ length: weekly ? 7 : 31 }, function (_, index) {
        var day = index + 1, on = selected.indexOf(day) >= 0;
        return '<button type="button" class="oe-day-button' + (on ? ' is-on' : '') + '" data-oe="schedule-day" data-kind="' + (weekly ? 'weekdays' : 'monthdays') + '" data-day="' + day + '" aria-pressed="' + on + '">' + (weekly ? '周' + ['一', '二', '三', '四', '五', '六', '日'][index] : day) + '</button>';
      }).join('') + '</div>' + (weekly ? '' : '<small class="oe-helper">当月不存在的日期跳过。</small>');
    }
    if (schedule.repeat === 'once') extra = field('执行时间', input('schedule.onceAt', schedule.onceAt, ' type="datetime-local" required aria-label="执行时间"'), false, '', true);
    else if (schedule.repeat === 'interval') extra = field('间隔小时', input('schedule.intervalHours', schedule.intervalHours, ' type="number" min="1" step="1" required aria-label="间隔小时"'), false, '', true);
    else timeField = field('时间', '<span class="cap-time-control">' + ico('clock-3') + input('schedule.time', schedule.time, ' type="time" required aria-label="时间"') + '</span>', false, '', true);
    var html = '<div class="oe-schedule-row">' + field('重复', select('schedule.repeat', Object.keys(frequencyNames).map(function (key) { return [key, frequencyNames[key]]; }), schedule.repeat, ' aria-label="重复"'), false, '', true) + timeField + '</div>' + extra;
    return html + '<div class="oe-schedule-summary oe-wide">' + esc(data.scheduleSummary(schedule)) + '</div>';
  }
  function ensureOutput(draft) {
    var defaults = data.defaults(draft.sceneId).output, old = draft.output || {};
    draft.output = Object.assign({}, defaults, old);
    if (!draft.output.categories || !draft.output.categories.length) draft.output.categories = clone(defaults.categories);
    if (!draft.output.scoreItems || !draft.output.scoreItems.length) draft.output.scoreItems = clone(defaults.scoreItems);
  }
  function outputFields(draft) {
    ensureOutput(draft); var output = draft.output;
    if (output.type === 'boolean') return '<div class="oe-form-grid">' + field('通过值', select('output.booleanPass', [['true', 'True'], ['false', 'False']], String(output.booleanPass)), false, '输出等于所选布尔值时通过。') + '</div>';
    if (output.type === 'category') return '<div class="oe-table-wrap"><table class="oe-repeat-table"><thead><tr><th scope="col">类别</th><th scope="col">通过判定</th><th scope="col"></th></tr></thead><tbody>' + output.categories.map(function (category, index) { return '<tr><td><input data-oe-category="name" data-index="' + index + '" aria-label="类别名称 ' + (index + 1) + '" maxlength="80" value="' + esc(category.name) + '" placeholder="类别名称"></td><td><select data-oe-category="pass" data-index="' + index + '" aria-label="类别通过判定 ' + (index + 1) + '"><option value="true"' + (category.pass === true ? ' selected' : '') + '>通过</option><option value="false"' + (category.pass !== true ? ' selected' : '') + '>不通过</option></select></td><td>' + button('remove-category', '', 'trash-2', ' data-index="' + index + '" aria-label="删除类别 ' + (index + 1) + '"' + (output.categories.length <= 2 ? ' disabled' : ''), 'ws-btn') + '</td></tr>'; }).join('') + '</tbody></table></div>' + button('add-category', '添加类别', 'plus', '', 'btn-soft oe-add-row');
    if (output.type === 'score') {
      var total = output.scoreItems.reduce(function (sum, item) { return sum + (Number(item.weight) || 0); }, 0);
      return '<div class="oe-helper">各项按 0–100 分评分，权重合计须为 1。</div><div class="oe-table-wrap"><table class="oe-repeat-table oe-score-table"><thead><tr><th scope="col">评分项</th><th scope="col">评分标准</th><th scope="col">权重</th><th scope="col"></th></tr></thead><tbody>' + output.scoreItems.map(function (item, index) { return '<tr><td><input data-oe-score="name" data-index="' + index + '" aria-label="评分项 ' + (index + 1) + '" maxlength="80" value="' + esc(item.name) + '" placeholder="评分项名称"></td><td><textarea data-oe-score="criteria" data-index="' + index + '" aria-label="评分标准 ' + (index + 1) + '" rows="2" maxlength="4000" placeholder="说明各分值对应的判断依据">' + esc(item.criteria) + '</textarea></td><td><input data-oe-score="weight" data-index="' + index + '" aria-label="评分权重 ' + (index + 1) + '" type="number" min="0.000001" max="1" step="any" value="' + esc(item.weight) + '"></td><td>' + button('remove-score', '', 'trash-2', ' data-index="' + index + '" aria-label="删除评分项 ' + (index + 1) + '"' + (output.scoreItems.length <= 1 ? ' disabled' : ''), 'ws-btn') + '</td></tr>'; }).join('') + '</tbody></table></div><div class="oe-score-actions">' + button('add-score', '添加评分项', 'plus', '', 'btn-soft oe-add-row') + '<span id="oeWeightTotal" class="oe-weight-total' + (Math.abs(total - 1) > 0.000001 ? ' is-invalid' : '') + '">权重合计：' + Number(total.toFixed(6)) + ' / 1</span></div><div class="oe-form-grid">' + field('最终通过阈值', input('output.threshold', output.threshold, ' type="number" min="0" max="100" step="any" required'), false, '总分 = Σ（评分项得分 × 权重），总分达到阈值时通过。', true) + '</div>';
    }
    return '<p class="oe-helper">仅输出文本，不设置通过标准。</p>';
  }
  function editorMarkup(draft, existingId) {
    return heading(existingId ? '编辑在线评估器' : '新建在线评估器') + '<form id="oeForm" novalidate><div class="oe-editor-body"><div id="oeErrors" class="oe-error" role="alert" hidden></div><section class="oe-form-section"><h3>基本信息</h3><div class="oe-basic-row">' +
      field('名称', input('name', draft.name, ' type="text" maxlength="80" required placeholder="输入评估器名称"'), false, '', true) + tagPicker(draft) + field('关联 Agent', agentsSelect(draft), false, '', true) + '</div>' + field('描述', textarea('description', draft.description, ' class="oe-description-input" rows="2" maxlength="2000" required placeholder="描述评估目的和适用范围"'), false, '', true) + '</section>' +
      '<section class="oe-form-section"><h3>评估范围</h3><div class="oe-form-grid">' + field('评估粒度', select('granularity', data.constants.granularities.map(function (item) { return [item.id, item.name]; }), draft.granularity), false, '', true) + '</div><div id="oeRange" class="oe-form-grid">' + rangeFields(draft) + '</div></section>' +
      '<section class="oe-form-section"><h3>评估执行</h3><div class="oe-form-grid">' + field('评测模型', select('model', data.constants.models, draft.model), false, '', true) + '<div id="oeSampling">' + samplingField(draft) + '</div>' + '</div><fieldset class="oe-fieldset"><legend>评估频率</legend><div id="oeSchedule" class="oe-schedule">' + scheduleFields(draft) + '</div></fieldset></section>' +
      '<section class="oe-form-section"><h3>评估提示词</h3><div class="oe-form-grid">' + field('提示词', textarea('prompt', draft.prompt, ' class="oe-prompt" rows="6" maxlength="20000" required placeholder="明确评估目标、判断依据、评估步骤和输出要求…"'), true, '', true) + '</div></section>' +
      '<section class="oe-form-section" id="oeOutputSection">' + outputSection(draft) + '</section></div><footer class="oe-editor-foot"><span class="oe-save-state">' + (draft.source === 'copilot' ? (existingId ? 'Copilot 创建' : 'Copilot 草稿') : '') + '</span>' + button('close', '取消') + '<button class="btn-ink" type="submit">' + (existingId ? '保存' : '创建评估器') + '</button></footer></form>';
  }
  function openEditor(record, anchor) {
    var existingId = record && record.id || null;
    var draft = record ? clone(record) : data.defaults(global.AIOpsResources.sceneId());
    if (!record) { draft.agentId = ''; draft.source = 'manual'; }
    ensureOutput(draft);
    var element = mount('oe-editor', editorMarkup(draft, existingId), anchor); editor = { element: element, draft: draft, existingId: existingId, tagSearch: '', tagActive: -1, tagOpen: false, activeGranularity: draft.granularity, ordinaryPrompt: draft.granularity === 'business-task' ? '' : draft.prompt, ordinarySampling: draft.samplingRate };
  }
  function readEditor() {
    if (!editor) return null; var draft = editor.draft, root = editor.element;
    root.querySelectorAll('[data-oe-field]').forEach(function (element) {
      var path = element.getAttribute('data-oe-field'), value = element.value;
      if (path === 'output.booleanPass') value = value === 'true';
      else if (['samplingRate', 'schedule.intervalHours', 'output.threshold'].indexOf(path) >= 0) value = value === '' ? null : Number(value);
      set(draft, path, value);
    });
    var selectedScene = availableScenes().filter(function (scene) { return data.agents(scene.id).some(function (agent) { return agent.id === draft.agentId; }); })[0];
    if (selectedScene) draft.sceneId = selectedScene.id;
    draft.spanTypes = draft.granularity === 'span' ? Array.from(root.querySelectorAll('[data-oe-span]:checked')).map(function (element) { return element.value; }) : [];
    var outputType = root.querySelector('[name="oeOutputType"]:checked'); if (draft.granularity === 'business-task') { draft.output = { type: 'task-executions' }; draft.samplingRate = 100; draft.taskIds = Array.from(root.querySelectorAll('[data-oe-task]:checked')).map(function (element) { return element.value; }); } else if (outputType) draft.output.type = outputType.value;
    var names = root.querySelectorAll('[data-oe-category="name"]');
    if (names.length) draft.output.categories = Array.from(names).map(function (element) { var index = element.getAttribute('data-index'); return { name: element.value, pass: root.querySelector('[data-oe-category="pass"][data-index="' + index + '"]').value === 'true' }; });
    var scores = root.querySelectorAll('[data-oe-score="name"]');
    if (scores.length) draft.output.scoreItems = Array.from(scores).map(function (element) { var index = element.getAttribute('data-index'), weight = root.querySelector('[data-oe-score="weight"][data-index="' + index + '"]').value; return { name: element.value, criteria: root.querySelector('[data-oe-score="criteria"][data-index="' + index + '"]').value, weight: weight === '' ? null : Number(weight) }; });
    return draft;
  }
  function showErrors(errors) {
    var root = editor.element, box = root.querySelector('#oeErrors');
    root.querySelectorAll('[aria-invalid="true"]').forEach(function (element) { element.removeAttribute('aria-invalid'); });
    box.hidden = false; box.innerHTML = '<strong>请完善以下配置</strong><ul>' + errors.map(function (error) { return '<li>' + esc(error.message) + '</li>'; }).join('') + '</ul>';
    errors.forEach(function (error) { var element = root.querySelector(error.field === 'tags' ? '#oeTagInput' : '[data-oe-field="' + error.field + '"]'); if (element) element.setAttribute('aria-invalid', 'true'); });
    root.querySelector('.oe-editor-body').scrollTop = 0;
  }
  function saveEditor() {
    if (editor && editor.tagSearch.trim()) addTag(editor.tagSearch, false);
    var draft = readEditor(); if (!draft) return;
    if (scope().indexOf(draft.sceneId) < 0) { showErrors([{ field: 'agentId', message: '请选择当前场景内的 Agent。' }]); return; }
    var result = storage.save(draft, editor.existingId);
    if (!result.ok) { showErrors(result.errors || [{ field: 'save', message: '保存失败，请重试。' }]); return; }
    var edited = !!editor.existingId; closeModal(); query = ''; host.render({ resetScroll: true }); host.toast(edited ? '在线评估器已保存' : '在线评估器已创建');
  }
  function definition(record) {
    var values = [['名称', record.name], ['状态', enabled(record) ? '已启用' : '已停用'], ['描述', record.description], ['所属场景', sceneName(record.sceneId)], ['关联 Agent', agentName(record)], ['标签', record.tags.join('、')], ['评估粒度', granularityName(record.granularity)], ['筛选逻辑', record.filterLogic], ['评测模型', record.model], ['采样率', record.samplingRate + '%'], ['评估时间', data.scheduleSummary(record.schedule)], ['下一次执行', nextRunLabel(record)], ['时区', record.schedule.timezone || 'Asia/Shanghai']];
    if (record.granularity === 'span') values.splice(6, 0, ['Span 类型', record.spanTypes.map(function (id) { var found = data.constants.spanTypes.filter(function (item) { return item.id === id; })[0]; return found ? found.name : id; }).join('、')]);
    var output = record.output, criteria = '';
    if (output.type === 'boolean') criteria = '<p>通过值：' + (output.booleanPass ? 'True' : 'False') + '</p>';
    if (output.type === 'category') criteria = '<table class="oe-detail-output"><thead><tr><th>类别</th><th>通过判定</th></tr></thead><tbody>' + output.categories.map(function (category) { return '<tr><td>' + esc(category.name) + '</td><td>' + (category.pass ? '通过' : '不通过') + '</td></tr>'; }).join('') + '</tbody></table>';
    if (output.type === 'score') criteria = '<table class="oe-detail-output"><thead><tr><th>评分项</th><th>评分标准</th><th>权重</th></tr></thead><tbody>' + output.scoreItems.map(function (item) { return '<tr><td>' + esc(item.name) + '</td><td>' + esc(item.criteria) + '</td><td>' + item.weight + '</td></tr>'; }).join('') + '</tbody></table><p>最终通过阈值：' + output.threshold + ' / 100</p>';
    if (output.type === 'text') criteria = '<p>无通过标准</p>';
    return '<dl class="oe-definition-grid">' + values.map(function (value) { return '<div><dt>' + value[0] + '</dt><dd>' + esc(value[1]) + '</dd></div>'; }).join('') + '</dl>' + (record.granularity === 'business-task' ? '<section class="oe-detail-section"><h3>关联业务任务</h3>' + taskSnapshots(record.taskSnapshots || []) + '</section>' : '') + '<section class="oe-detail-section"><h3>评估提示词</h3><pre class="oe-readonly-prompt">' + esc(record.prompt) + '</pre></section><section class="oe-detail-section"><h3>输出类型：' + outputNames[output.type] + '</h3>' + (record.granularity === 'business-task' ? '<p>按关联任务的完成条件、通过标准及评估维度判断，输出每次任务执行的结构化结果。</p>' : criteria) + '</section>';
  }
  function openDetail(id, anchor) {
    var record = find(id); if (!record) return;
    closeModal(); detailId = id; detailTab = 'results'; sessionResult = null; detailFilters = filters.defaultsDetail(); expandedSessions = Object.create(null); runtimeError = ''; lastRun = null; host.render({ resetScroll: true });
  }
  function openCopilot(anchor) {
    var element = mount('oe-copilot', heading('Copilot 新建在线评估器') + '<div class="oe-copilot-body"><div class="oe-copilot-message is-assistant">描述你希望评估什么、评估哪些记录，以及如何判断结果。</div><label class="oe-field"><span>创建需求</span><textarea id="oeCopilotRequest" rows="5" maxlength="6000" placeholder="例如：每天 09:00，用 GPT-6.1 Sol 评估当天新增的模型调用 Span，采样率 20%，按准确性和完整性评分，总分 80 分通过。"></textarea></label><div id="oeCopilotPreview" hidden></div></div><footer class="oe-editor-foot">' + button('close', '取消') + '<button type="button" class="btn-ink" data-oe="generate" disabled>生成草稿</button></footer>', anchor);
    copilot = { element: element, draft: null, request: '' };
  }
  function generateDraft() {
    if (!copilot) return; var request = copilot.element.querySelector('#oeCopilotRequest').value.trim(); if (!request) return;
    var draft = data.generate(request, global.AIOpsResources.sceneId());
    if (scope().indexOf(draft.sceneId) < 0) { var scene = availableScenes()[0]; draft.sceneId = scene.id; draft.agentId = data.agents(scene.id)[0].id; }
    copilot.draft = draft; copilot.request = request;
    var preview = copilot.element.querySelector('#oeCopilotPreview'); preview.hidden = false;
    preview.innerHTML = '<div class="oe-copilot-message is-assistant">已生成草稿，可继续编辑后创建。</div><div class="oe-copilot-preview"><dl>' + [['名称', draft.name], ['关联 Agent', agentName(draft)], ['评估粒度', granularityName(draft.granularity)], ['评测模型', draft.model], ['采样率', draft.samplingRate + '%'], ['评估时间', data.scheduleSummary(draft.schedule)], ['输出类型', outputNames[draft.output.type]]].map(function (item) { return '<div><dt>' + item[0] + '</dt><dd>' + esc(item[1]) + '</dd></div>'; }).join('') + '</dl></div>';
    copilot.element.querySelector('.oe-editor-foot').innerHTML = button('close', '取消') + button('generate', '重新生成', 'refresh-cw') + button('review-draft', '继续编辑并创建', 'arrow-right', '', 'btn-ink'); host.icons();
  }
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.oe-tag-picker')) closeTags();
    var control = event.target.closest('[data-oe]');
    if (!control) { if (!event.target.closest('.oe-create-wrap')) closeMenu(); return; }
    var action = control.getAttribute('data-oe'), id = control.getAttribute('data-id');
    if (action === 'create-menu') { menuOpen = !menuOpen; var menu = document.querySelector('.oe-create-menu'); if (menu) menu.hidden = !menuOpen; control.setAttribute('aria-expanded', String(menuOpen)); if (menuOpen) { var first = menu.querySelector('button'); if (first) first.focus(); } return; }
    closeMenu();
    if (action === 'manual') { openEditor(null, control); return; }
    if (action === 'copilot') { openCopilot(control); return; }
    if (action === 'close') { closeModal(); return; }
    if (action === 'view') { openDetail(id, control); return; }
    if (action === 'reset-list-filters') { listFilters = filters.defaultsList(); query = ''; host.render({ resetScroll: false }); return; }
    if (action === 'reset-result-filters') { detailFilters = filters.defaultsDetail(); host.render({ resetScroll: false }); return; }
    if (action === 'toggle-enabled') { var targetState = control.getAttribute('data-enabled'); toggleEnabled(id, targetState === 'true' ? true : targetState === 'false' ? false : undefined); return; }
    if (action === 'expand-session') {
      var currentRecord = find(detailId); if (!currentRecord || !results(detailId).some(function (item) { return item.sessionId === id; })) return;
      var key = groupKey(currentRecord, id); expandedSessions[key] = !expandedSessions[key]; host.render({ resetScroll: false }); return;
    }
    if (action === 'group-session') {
      var currentResult = results(detailId).filter(function (item) { return item.sessionId === id; })[0], currentSession = currentResult && sessionRow(id); if (!currentSession) { host.toast('没有找到来源会话'); return; }
      global.AIOpsSessionDetail.focusReply(currentSession, null); closeModal(); sessionResult = { sessionId: id }; host.render({ resetScroll: true }); return;
    }
    if (action === 'back-list') { closeModal(); detailId = null; sessionResult = null; lastRun = null; runtimeError = ''; host.render({ resetScroll: true }); return; }
    if (action === 'detail-tab' && ['results', 'runs', 'configuration'].indexOf(id) >= 0) { detailTab = id; host.render({ resetScroll: true }); return; }
    if (action === 'run') { runEvaluator(id); return; }
    if (action === 'result') { openResult(id, control); return; }
    if (action === 'back-results') { sessionResult = null; host.render({ resetScroll: true }); return; }
    if (action === 'session') {
      var source = results(detailId).filter(function (result) { return result.id === id; })[0], row = source && sessionRow(source.sessionId); if (!row) { host.toast('没有找到来源会话'); return; }
      var target = source.taskId && source.completion === 'completed' ? { round: source.completionRound, messageId: source.completionMessageId, recordId: source.executionId || source.id, taskId: source.taskId, taskName: taskName(source.taskId) } : null;
      if (!global.AIOpsSessionDetail.focusReply(row, target)) { host.toast('未找到该次执行的完成回复'); return; }
      closeModal(); sessionResult = source.id; host.render({ resetScroll: true }); return;
    }
    if (action === 'edit') { var record = find(id); if (record) openEditor(record, control); return; }
    if (action === 'generate') { generateDraft(); return; }
    if (action === 'review-draft' && copilot && copilot.draft) { var draft = clone(copilot.draft); delete draft.id; openEditor(draft, control); return; }
    if (!editor) return;
    var current = readEditor(), index = Number(control.getAttribute('data-index'));
    if (action === 'select-tag') { addTag(tagChoices()[index], true); return; }
    if (action === 'remove-tag') { current.tags.splice(index, 1); refreshTags(true); return; }
    if (action === 'schedule-day') {
      var kind = control.getAttribute('data-kind'), day = Number(control.getAttribute('data-day')), selected = current.schedule[kind], at = selected.indexOf(day);
      if (at >= 0) selected.splice(at, 1); else selected.push(day);
      selected.sort(function (a, b) { return a - b; });
      control.classList.toggle('is-on', at < 0); control.setAttribute('aria-pressed', String(at < 0));
      editor.element.querySelector('.oe-schedule-summary').textContent = data.scheduleSummary(current.schedule); return;
    }
    if (action === 'add-category') current.output.categories.push({ name: '', pass: false });
    else if (action === 'remove-category' && current.output.categories.length > 2) current.output.categories.splice(index, 1);
    else if (action === 'add-score') current.output.scoreItems.push({ name: '', criteria: '', weight: 0 });
    else if (action === 'remove-score' && current.output.scoreItems.length > 1) current.output.scoreItems.splice(index, 1);
    else return;
    editor.element.querySelector('#oeOutput').innerHTML = outputFields(current); host.icons();
  });
  document.addEventListener('submit', function (event) { if (event.target.id === 'oeForm') { event.preventDefault(); saveEditor(); } });
  document.addEventListener('change', function (event) {
    var listKey = event.target.getAttribute && event.target.getAttribute('data-oe-list-filter'), detailKey = event.target.getAttribute && event.target.getAttribute('data-oe-result-filter');
    if (listKey && Object.prototype.hasOwnProperty.call(listFilters, listKey)) { listFilters[listKey] = event.target.value; refreshList(); return; }
    if (detailKey && Object.prototype.hasOwnProperty.call(detailFilters, detailKey)) {
      detailFilters[detailKey] = event.target.value;
      if (detailKey === 'resultChoice') { var currentRecord = find(detailId), controls = document.getElementById('oeResultFilters'); if (currentRecord && controls) controls.innerHTML = resultFilterControls(currentRecord, results(detailId)); }
      refreshDetail(); return;
    }
    if (!editor || !editor.element.contains(event.target)) return;
    var previousGranularity = editor.activeGranularity, previousSampling = editor.element.querySelector('[data-oe-field="samplingRate"]');
    if (event.target.getAttribute('data-oe-field') === 'granularity' && previousGranularity !== 'business-task' && previousSampling) editor.ordinarySampling = Number(previousSampling.value);
    var draft = readEditor(), path = event.target.getAttribute('data-oe-field');
    if (path === 'granularity' || path === 'agentId' || event.target.hasAttribute && event.target.hasAttribute('data-oe-task')) {
      if (draft.granularity === 'business-task') {
        if (previousGranularity !== 'business-task') editor.ordinaryPrompt = draft.prompt;
        var taskIds = (draft.taskIds || []).filter(function (id) { return data.taskDefinitions(draft.sceneId, draft.agentId).some(function (task) { return task.id === id; }); });
        Object.assign(draft, data.bindTasks(draft, taskIds)); editor.element.querySelector('[data-oe-field="prompt"]').value = draft.prompt;
        if (!draft.filterLogic) { draft.filterLogic = '全部正式用户会话'; }
      } else if (draft.output.type === 'task-executions') { draft.output = data.defaults(draft.sceneId).output; draft.taskIds = []; draft.taskSnapshots = []; draft.prompt = editor.ordinaryPrompt || ''; draft.samplingRate = editor.ordinarySampling == null ? 100 : editor.ordinarySampling; editor.element.querySelector('[data-oe-field="prompt"]').value = draft.prompt; }
      editor.activeGranularity = draft.granularity;
      editor.element.querySelector('#oeRange').innerHTML = rangeFields(draft);
      editor.element.querySelector('#oeSampling').innerHTML = samplingField(draft);
      editor.element.querySelector('#oeOutputSection').innerHTML = outputSection(draft);
    }
    else if (path === 'schedule.repeat') editor.element.querySelector('#oeSchedule').innerHTML = scheduleFields(draft);
    else if (event.target.name === 'oeOutputType') {
      editor.element.querySelectorAll('.oe-output-options label').forEach(function (label) { label.classList.toggle('is-selected', label.querySelector('input').checked); });
      editor.element.querySelector('#oeOutput').innerHTML = outputFields(draft);
    }
    host.icons();
  });
  document.addEventListener('input', function (event) {
    if (event.target.id === 'oeSearch' && !event.isComposing) { query = event.target.value; refreshList(); return; }
    var detailKey = event.target.getAttribute && event.target.getAttribute('data-oe-result-filter');
    if (detailKey && !event.isComposing && ['query', 'minScore', 'maxScore', 'text'].indexOf(detailKey) >= 0) { detailFilters[detailKey] = event.target.value; refreshDetail(); return; }
    if (event.target.id === 'oeCopilotRequest' && copilot) {
      var request = event.target.value.trim(), generate = copilot.element.querySelector('[data-oe="generate"]'); if (generate) generate.disabled = !request;
      if (copilot.draft && request !== copilot.request) { copilot.draft = null; copilot.element.querySelector('#oeCopilotPreview').hidden = true; var review = copilot.element.querySelector('[data-oe="review-draft"]'); if (review) review.disabled = true; }
    }
    if (editor && event.target.id === 'oeTagInput') { editor.tagSearch = event.target.value; editor.tagOpen = true; editor.tagActive = -1; refreshTags(false); return; }
    if (editor && (event.target.getAttribute('data-oe-field') || '').indexOf('schedule.') === 0) { var current = readEditor(); editor.element.querySelector('.oe-schedule-summary').textContent = data.scheduleSummary(current.schedule); }
    if (editor && event.target.matches('[data-oe-score="weight"]')) {
      var draft = readEditor(), total = draft.output.scoreItems.reduce(function (sum, item) { return sum + (Number(item.weight) || 0); }, 0), label = editor.element.querySelector('#oeWeightTotal');
      if (label) { label.textContent = '权重合计：' + Number(total.toFixed(6)) + ' / 1'; label.classList.toggle('is-invalid', Math.abs(total - 1) > 0.000001); }
    }
  });
  document.addEventListener('focusin', function (event) {
    if (!editor) return;
    if (event.target.id === 'oeTagInput') { editor.tagOpen = true; refreshTags(false); }
    else if (!event.target.closest('.oe-tag-picker')) closeTags();
  });
  document.addEventListener('mousedown', function (event) { if (editor && event.target.closest('.oe-tag-option')) event.preventDefault(); });
  document.addEventListener('compositionend', function (event) { if (event.target.id === 'oeSearch' || event.target.hasAttribute && event.target.hasAttribute('data-oe-result-filter')) event.target.dispatchEvent(new Event('input', { bubbles: true })); });
  document.addEventListener('keydown', function (event) {
    if (editor && event.target.id === 'oeTagInput') {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Escape' && editor.tagOpen) { event.preventDefault(); event.stopPropagation(); closeTags(); return; }
      if (event.key === 'Enter') { event.preventDefault(); var choices = tagChoices(); addTag(editor.tagActive >= 0 ? choices[editor.tagActive] : editor.tagSearch, true); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); var options = tagChoices(); editor.tagOpen = true;
        if (options.length) editor.tagActive = (editor.tagActive + (event.key === 'ArrowDown' ? 1 : (editor.tagActive < 0 ? 0 : -1)) + options.length) % options.length;
        refreshTags(false); var active = editor.element.querySelector('.oe-tag-option.is-active'); if (active) active.scrollIntoView({ block: 'nearest' }); return;
      }
    }
    if (!menuOpen) return;
    if (event.key === 'Escape') { closeMenu(); var trigger = document.querySelector('[data-oe="create-menu"]'); if (trigger) trigger.focus(); }
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { var items = Array.from(document.querySelectorAll('.oe-create-menu button')), at = items.indexOf(document.activeElement); if (items.length) { event.preventDefault(); items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); } }
  });
  global.addEventListener('storage', function (event) { if (event.key === 'aiops.online-evaluators.v1' || event.key === 'aiops.online-evaluation-ledger.v1') schedulerRefresh(); });
  global.AIOpsOnlineEvaluators = { configure: function (next) {
    host = next; storage = data.createStore(global.localStorage);
    if (runtime() && host.sessions) {
      runtime().configure({ sessions: host.sessions, storage: global.localStorage }); var initial = runtime().initialize();
      if (initial && !initial.ok) runtimeError = initializationError = initial.error || '评估数据初始化失败';
      else if (scheduler()) { scheduler().configure({ sessions: host.sessions, storage: global.localStorage, onRun: schedulerRefresh, onError: schedulerError }); scheduler().start(); }
    }
  }, page: page, definition: definition, groupResults: sessionGroups, filterResults: filteredResults, filteredEvaluators: filteredEvaluators,
    captureView: function () { return clone({scope:global.AIOpsResources.sceneId(),query:query,listFilters:listFilters,detailFilters:detailFilters,detailId:detailId,detailTab:detailTab,sessionResult:sessionResult,expandedSessions:expandedSessions,lastRun:lastRun}); },
    restoreView: function (saved) { if(!saved||saved.scope!==global.AIOpsResources.sceneId())return false;query=saved.query;listFilters=clone(saved.listFilters);detailFilters=clone(saved.detailFilters);detailId=saved.detailId;detailTab=saved.detailTab;sessionResult=clone(saved.sessionResult);expandedSessions=clone(saved.expandedSessions);lastRun=clone(saved.lastRun);activePage='在线评估器';return true; },
    onNavigate: function (page) { activePage = page; closeMenu(); closeModal(); query = ''; listFilters = filters.defaultsList(); detailFilters = filters.defaultsDetail(); detailId = null; sessionResult = null; expandedSessions = Object.create(null); lastRun = null; runtimeError = initializationError; }, onSceneChange: function () { closeMenu(); closeModal(); query = ''; listFilters = filters.defaultsList(); detailFilters = filters.defaultsDetail(); detailId = null; sessionResult = null; expandedSessions = Object.create(null); lastRun = null; runtimeError = initializationError; } };
})(window);
