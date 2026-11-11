/* Local online-evaluation demonstration. Reads visible conversation evidence; no model or scheduler is invoked. */
(function (global) {
  'use strict';
  var KEY = 'aiops.online-evaluation-ledger.v1', host = {}, seeding = false, historicalSnapshots = Object.create(null), evidenceCache = Object.create(null);
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function now() { return host.now ? new Date(typeof host.now === 'function' ? host.now() : host.now).toISOString() : new Date().toISOString(); }
  function storage() { return host.storage || global.localStorage; }
  function hash(value) { var n = 2166136261; for (var i = 0; i < value.length; i++) { n ^= value.charCodeAt(i); n = Math.imul(n, 16777619); } return (n >>> 0).toString(36); }
  function empty() { return { version: 1, initialized: false, runs: [], results: [], taskExecutions: [] }; }
  function read() {
    try {
      var raw = storage().getItem(KEY); if (!raw) return { ok: true, data: empty() };
      var value = JSON.parse(raw);
      if (!value || !Array.isArray(value.runs) || !Array.isArray(value.results) || !Array.isArray(value.taskExecutions)) throw new Error('Invalid ledger');
      function record(item, fields, dates) {
        return item && typeof item === 'object' && !Array.isArray(item) && fields.every(function (field) { return typeof item[field] === 'string' && item[field].trim(); }) && dates.every(function (field) { return Number.isFinite(Date.parse(item[field])); });
      }
      function details(item) {
        return (item.dimensions == null || Array.isArray(item.dimensions) && item.dimensions.every(function (dimension) { return dimension && typeof dimension === 'object' && typeof dimension.name === 'string'; })) &&
          (item.evidence == null || Array.isArray(item.evidence) && item.evidence.every(function (evidence) { return typeof evidence === 'string' && evidence || evidence && typeof evidence === 'object' && typeof evidence.messageId === 'string' && evidence.messageId; }));
      }
      if (!value.runs.every(function (item) { return record(item, ['id', 'evaluatorId', 'startedAt', 'finishedAt'], ['startedAt', 'finishedAt']) && ['scanned', 'recognized', 'created', 'updated', 'unchanged', 'failed'].every(function (field) { return item[field] == null || Number.isInteger(item[field]) && item[field] >= 0; }); }) ||
          !value.results.every(function (item) { return record(item, ['id', 'evaluatorId', 'sessionId', 'evaluatedAt'], ['evaluatedAt']) && ['passed', 'rejected', 'pending', 'na'].indexOf(item.acceptance) >= 0 && details(item); }) ||
          !value.taskExecutions.every(function (item) { return record(item, ['id', 'evaluatorId', 'taskId', 'sessionId', 'startMessageId', 'triggeredAt', 'evaluatedAt'], ['triggeredAt', 'evaluatedAt']) && ['completed', 'running', 'failed'].indexOf(item.completion) >= 0 && ['passed', 'rejected', 'pending', 'na'].indexOf(item.acceptance) >= 0 && details(item); })) throw new Error('Invalid ledger record');
      return { ok: true, data: value };
    } catch (_) { return { ok: false, data: empty(), error: '评估记录读取失败，未开始扫描。' }; }
  }
  function write(value) { try { storage().setItem(KEY, JSON.stringify(value)); historicalSnapshots = Object.create(null); return { ok: true }; } catch (_) { return { ok: false, error: '评估记录保存失败，业务任务执行记录与统计均未写回。' }; } }
  function sessionData(row) {
    if (global.AIOpsSessionDetail && global.AIOpsSessionDetail.data) return global.AIOpsSessionDetail.data(row);
    var supplied = row.conversation || {}; return Array.isArray(supplied) ? { rounds: clone(supplied), records: [] } : clone({ rounds: supplied.rounds || [], records: supplied.records || [] });
  }
  function canonicalAgent(row) {
    if (row.agentId) return row.agentId;
    var tasks = global.AIOpsBusinessTasks && global.AIOpsBusinessTasks.catalog ? global.AIOpsBusinessTasks.catalog() : [];
    var task = tasks.filter(function (item) { return item.agent === row.agent; })[0];
    if (task) return task.agentId;
    var catalog = global.AIOpsWorkspaces ? global.AIOpsWorkspaces.scopeCatalog() : [];
    var found = catalog.reduce(function (all, scene) { return all.concat(scene.items || []); }, []).filter(function (item) { return item.type === 'Agent' && item.name === row.agent; })[0];
    return found ? found.id : '';
  }
  function timestamp(row, data) { return data.rounds.length && data.rounds[0].inputAt || (row.time || '').replace(' ', 'T') + ':00+08:00'; }
  function day(at) { var value = Date.parse(at); return Number.isFinite(value) ? new Date(value + 8 * 3600000).toISOString().slice(0, 10) : ''; }
  function filterSpec(logic, clock) {
    var value = String(logic || '').trim(), chunks = value.split(/[；;。\n]/).map(function (part) { return part.trim(); }).filter(Boolean);
    var D = global.AIOpsOnlineEvaluatorData, sceneNames = D.scenes().map(function (scene) { return scene.name; }), agentNames = D.agents('all').map(function (agent) { return agent.name; });
    var unsupported = chunks.filter(function (part) {
      var normalized = part.replace(/\s*[（(]Asia\/Shanghai[）)]$/, '').replace(/^时间范围为(?:评估执行)?/, '').trim(), compact = normalized.replace(/\s+/g, '');
      if (/^(?:全部|所有)(?:正式用户)?(?:使用)?(?:会话|记录|Trace|Span|执行记录)$/i.test(compact)) return false;
      if (/^所属场景为/.test(normalized) && sceneNames.indexOf(normalized.slice(5)) >= 0) return false;
      if (/^Agent\s*为/i.test(normalized) && agentNames.indexOf(normalized.replace(/^Agent\s*为\s*/i, '')) >= 0) return false;
      if (/^Span\s*类型属于[：:]/i.test(normalized)) { var types = normalized.replace(/^Span\s*类型属于[：:]\s*/i, '').split(/[、，,]/); return !types.length || types.some(function (name) { return !D.constants.spanTypes.some(function (type) { return type.name === name.trim(); }); }); }
      if (/^(?:仅包含正式用户使用记录|按记录创建时间筛选新增记录|任务执行状态为已完成)$/.test(normalized)) return false;
      if (/^(?:当天|今天|当日|昨天|昨日|前一天|(?:最近|近)\d+(?:天|日|小时))(?:新增)?(?:且|、|，)?(?:已结束|已完成|包含错误|包含异常|包含失败)?的?(?:正式用户)?(?:会话|记录|Trace|Span|执行记录)?$/i.test(compact)) return false;
      if (/^(?:已结束|已完成)的?(?:正式用户)?(?:会话|记录|Trace|Span|执行记录)?$/i.test(compact)) return false;
      if (/^(?:仅|只)?(?:包含)?(?:失败|异常|错误)(?:(?:或|、)(?:失败|异常|错误))*的?(?:正式用户)?(?:记录|会话|Trace|Span|执行记录)$/i.test(compact)) return false;
      return true;
    });
    if (unsupported.length) return { ok: false, error: '当前本地评估暂不支持筛选条件「' + unsupported.join('；') + '」。可使用全部正式用户会话、当天/昨天/最近 N 天或小时，以及已结束、异常条件。' };
    var today = day(clock), yesterday = day(Date.parse(clock) - 86400000), hours = value.match(/(?:最近|近)\s*(\d+)\s*小时/), days = value.match(/(?:最近|近)\s*(\d+)\s*(?:天|日)/);
    return { ok: true, match: function (row, data) {
      var startedAt = timestamp(row, data), stamp = Date.parse(startedAt), targetDay = day(startedAt), end = data.rounds[data.rounds.length - 1];
      if (/当天|今天|当日/.test(value) && targetDay !== today) return false;
      if (/昨天|昨日|前一天/.test(value) && targetDay !== yesterday) return false;
      if (hours && (!Number.isFinite(stamp) || stamp < Date.parse(clock) - Number(hours[1]) * 3600000 || stamp > Date.parse(clock))) return false;
      if (days && (!Number.isFinite(stamp) || stamp < Date.parse(clock) - Number(days[1]) * 86400000 || stamp > Date.parse(clock))) return false;
      if (/已结束|已完成|完成记录/.test(value) && (!end || end.hasOutput === false || !end.output)) return false;
      if (/失败|异常|错误/.test(value) && !data.records.some(function (record) { return record.status === 'error' || record.status === 'warning' || record.status === 'failed'; }) && !(row.errors || row.warnings)) return false;
      return true;
    } };
  }
  function executionKey(taskId, sessionId, messageId) { return global.AIOpsBusinessTasks && global.AIOpsBusinessTasks.executionKey ? global.AIOpsBusinessTasks.executionKey(taskId, sessionId, messageId) : JSON.stringify([taskId, sessionId, messageId]); }
  function quotePattern(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function dimensionResult(dimension, output, verdict) {
    var line = output.match(new RegExp('(?:^|\\n)\\s*[-•]?\\s*' + quotePattern(dimension.name) + '[：:]\\s*([^\\n]+)'));
    var evidence = line ? line[1] : '', judgment = evidence.split(/[。；]/)[0], status = evidence ? /不符合|不满足|不通过|未通过|不完整|不准确|不正确|未覆盖|缺少|错误|不一致/.test(judgment) ? 'rejected' : /待确认|待补充|未知|证据不足|无法判断|部分符合/.test(judgment) ? 'pending' : /符合|满足|完整|一致|正确/.test(judgment) ? 'passed' : 'pending' : verdict;
    return { name: dimension.name, value: status === 'passed' ? '符合' : status === 'rejected' ? '不符合' : '待确认', status: status, reason: evidence || (status === 'pending' ? '会话未提供该维度的充分核验依据。' : dimension.description) };
  }
  function assess(task, output) {
    var match = output.match(/通过标准核验[：:]\s*([^\n]+)/), statement = match ? match[1] : '';
    var verdict = /不满足|不符合|未通过|不通过/.test(statement) ? 'rejected' : /待确认|待补充|未知|证据不足|无法判断|部分/.test(statement) ? 'pending' : /满足|符合|通过/.test(statement) ? 'passed' : 'pending';
    var dimensions = task.dimensions.map(function (dimension) { return dimensionResult(dimension, output, verdict); });
    if (dimensions.some(function (dimension) { return dimension.status === 'rejected'; })) verdict = 'rejected';
    else if (dimensions.some(function (dimension) { return dimension.status === 'pending'; })) verdict = 'pending';
    else if (dimensions.length) verdict = 'passed';
    return { acceptance: verdict, dimensions: dimensions, reason: statement || (verdict === 'pending' ? '已识别任务产出，部分通过标准缺少明确证据，等待确认。' : '依据会话中的逐项核验结果判定。') };
  }
  function isRequest(input, task, active) {
    var mentioned = input.indexOf(task.name) >= 0 || input.indexOf(task.id) >= 0;
    if (!mentioned || /什么是|介绍.{0,12}(?:任务|定义)|解释.{0,12}(?:定义|标准)|(?:不要|不用|无需|不需要)执行|只是(?:讨论|举例|提到)|通过标准是什么|完成条件是什么/.test(input)) return false;
    if (!/请|帮我|开始|执行|审核|复核|核验|检查|分析|新建|发起/.test(input)) return false;
    var independent = /新的一次|全新|独立(?:的)?任务|另一(?:个|份|家|次|客户)|新(?:任务|请求|客户)|再做一次|再次发起|重新发起|重新执行/.test(input);
    if (active && !independent && /继续|补充|追问|这次|本次|这份|上述|此前|接着|完善|重新检查|重新核对/.test(input)) return false;
    return !active || independent || active.completion === 'completed' && !/继续|补充|追问|这次|本次|这份|上述|此前|接着|完善/.test(input);
  }
  function scanTaskSession(evaluator, row) {
    var data = sessionData(row), found = [], active = {}, tasks = evaluator.taskSnapshots || [];
    data.rounds.forEach(function (turn) {
      tasks.forEach(function (task) {
        var input = String(turn.input || ''), output = turn.hasOutput === false ? '' : String(turn.output || ''), current = active[task.id];
        if (isRequest(input, task, current)) {
          var key = executionKey(task.id, row.id, turn.inputId);
          current = { id: 'EX-' + hash(key), key: key, taskId: task.id, taskName: task.name, taskVersion: task.version, sessionId: row.id, startMessageId: turn.inputId, startRound: turn.n, triggeredAt: turn.inputAt, completion: 'running', acceptance: 'na', reason: '已识别任务请求，尚未出现完整任务产出。', completionRound: null, completionMessageId: null, completedAt: null, dimensions: [], evidence: [turn.inputId] };
          active[task.id] = current; found.push(current);
        }
        if (!current) return;
        if (current.evidence.indexOf(turn.inputId) < 0) current.evidence.push(turn.inputId);
        if (turn.outputId && current.evidence.indexOf(turn.outputId) < 0) current.evidence.push(turn.outputId);
        var named = output.indexOf(task.name) >= 0 || output.indexOf(task.id) >= 0;
        var completed = turn.outputId && output && !/尚未(?:完成|生成)|未完成(?:全部|本次|任务)|未生成完整/.test(output) && (/已完成/.test(output) && named || named && /已生成产出[：:]/.test(output));
        if (completed) {
          var outcome = assess(task, output);
          current.completion = 'completed'; current.acceptance = outcome.acceptance; current.reason = outcome.reason; current.dimensions = outcome.dimensions;
          current.completionRound = turn.n; current.completionMessageId = turn.outputId; current.completedAt = turn.outputAt;
        } else if (current.completion !== 'completed' && /读取失败|读取中断|执行失败|任务终止|任务取消/.test(output)) { current.completion = 'failed'; current.acceptance = 'na'; current.reason = output.split('\n').filter(Boolean).slice(-1)[0]; }
      });
    });
    return found;
  }
  function equivalent(a, b) {
    if (!a || !b) return false;
    var fields = ['taskVersion', 'completion', 'acceptance', 'reason', 'completionRound', 'completionMessageId', 'completedAt', 'dimensions', 'outputType', 'value', 'evidence', 'configKey'];
    return fields.every(function (field) { return JSON.stringify(a[field] == null ? null : a[field]) === JSON.stringify(b[field] == null ? null : b[field]); });
  }
  function displayValue(value) { if (value == null) return '—'; if (typeof value === 'boolean') return value ? 'True' : 'False'; if (typeof value === 'object') { try { return JSON.stringify(value); } catch (_) { return '无法读取的输出'; } } return String(value); }
  function excerpt(value) {
    var text = value == null ? '' : typeof value === 'string' ? value : displayValue(value), cue = /不符合|不满足|未通过|不通过|读取失败|尚未生成|证据不足|待业务确认|通过标准核验/.exec(text), start = cue ? Math.max(0, cue.index - 35) : 0;
    return (start ? '…' : '') + text.slice(start, start + 140) + (text.length > start + 140 ? '…' : '');
  }
  function savedSnapshot(result) {
    if (result.evaluatorSnapshot && typeof result.evaluatorSnapshot === 'object') return result.evaluatorSnapshot;
    if (!result.runId) return null;
    if (!Object.prototype.hasOwnProperty.call(historicalSnapshots, result.runId)) {
      var state = read();
      state.data.runs.forEach(function (item) { historicalSnapshots[item.id] = item.evaluatorSnapshot || null; });
      if (!Object.prototype.hasOwnProperty.call(historicalSnapshots, result.runId)) historicalSnapshots[result.runId] = null;
    }
    return historicalSnapshots[result.runId];
  }
  function resultEvidence(result) {
    function normalized(list) {
      return (Array.isArray(list) ? list : []).filter(function (item) { return item && typeof item === 'object' && typeof item.text === 'string' && item.text; }).slice(0, 3).map(function (item) { return { id: String(item.id || item.messageId || ''), kind: ['input', 'output', 'span'].indexOf(item.kind) >= 0 ? item.kind : 'output', text: item.kind === 'span' ? item.text.slice(0, 160) : excerpt(item.text) }; });
    }
    var saved = normalized(result.judgment && result.judgment.evidence); if (saved.length) return saved;
    var supplied = normalized(result.sourceEvidence); if (supplied.length) return supplied;
    var row = host.sessions ? host.sessions().filter(function (item) { return item.id === result.sessionId; })[0] : null; if (!row) return [];
    var signature = JSON.stringify([row.conversation || null, row.messages, row.time, row.tokens, row.errors, row.warnings]), cached = evidenceCache[row.id];
    if (!cached || cached.signature !== signature) {
      var data = sessionData(row), index = Object.create(null);
      data.rounds.forEach(function (turn) { if (turn.inputId) index[turn.inputId] = { id: turn.inputId, kind: 'input', text: String(turn.input || '') }; if (turn.outputId) index[turn.outputId] = { id: turn.outputId, kind: 'output', text: String(turn.output || '') }; });
      data.records.forEach(function (span) { if (span.id) index[span.id] = { id: span.id, kind: 'span', text: '输出：' + excerpt(span.output) + '\n输入：' + excerpt(span.input) }; });
      cached = evidenceCache[row.id] = { signature: signature, index: index };
    }
    var ids = [result.startMessageId, result.targetId, result.completionMessageId].filter(Boolean);
    if (!ids.length && Array.isArray(result.evidence)) ids = result.evidence.map(function (item) { return typeof item === 'string' ? item : item && (item.id || item.messageId); }).filter(Boolean).slice(0, 3);
    return normalized(ids.filter(function (id, index) { return ids.indexOf(id) === index; }).map(function (id) { return cached.index[id]; }));
  }
  function scoreResult(output, config) {
    var value = typeof output === 'number' ? output : output && typeof output.score === 'number' ? output.score : null, calculation = '', problem = '';
    if (output && typeof output === 'object' && Array.isArray(output.items) && Array.isArray(config.scoreItems) && config.scoreItems.length) {
      var weight = 0, total = 0, parts = [], valid = true;
      config.scoreItems.forEach(function (item) {
        var matches = output.items.filter(function (result) { return result && result.name === item.name; }), score = matches.length === 1 ? matches[0].score : null;
        if (!Number.isFinite(score) || score < 0 || score > 100 || !Number.isFinite(item.weight) || item.weight <= 0) { valid = false; return; }
        weight += item.weight; total += score * item.weight; parts.push(item.name + ' ' + score + '×' + item.weight);
      });
      if (!valid || Math.abs(weight - 1) > 1e-6) { value = null; problem = '逐项分数缺失、超出 0–100，或冻结权重不完整，无法重算总分。'; }
      else { value = Math.round(total * 100) / 100; calculation = parts.join(' + ') + ' = ' + value; }
    } else if (value != null) calculation = '历史保存的总分为 ' + value + '，未提供可重算的逐项分数。';
    if (!Number.isFinite(value) || value < 0 || value > 100) { if (value != null) problem = '保存的总分 ' + displayValue(value) + ' 不是 0–100 范围内的有效有限分数。'; value = null; }
    return { value: value, calculation: calculation, problem: problem };
  }
  function presentation(result) {
    result = result && typeof result === 'object' ? result : {};
    var snapshot = null, config = result.outputConfig && typeof result.outputConfig === 'object' ? result.outputConfig : null;
    if (!config || result.outputType === 'task-executions' && !result.taskSnapshot) { snapshot = savedSnapshot(result); if (!config && snapshot && snapshot.output) config = snapshot.output; }
    config = config || {}; var type = config.type || result.outputType || 'unknown', output = Object.prototype.hasOwnProperty.call(result, 'output') ? result.output : result.value, value = null, pass = null, criteria = '', observations = '', conclusion = '', applicable = true;
    if (type === 'boolean') {
      value = typeof output === 'boolean' ? output : null;
      criteria = typeof config.booleanPass === 'boolean' ? '输出等于 ' + displayValue(config.booleanPass) + ' 时通过。' : '历史未保存布尔通过值快照，无法确定 True/False 哪个值表示通过。';
      observations = value == null ? '未保存有效布尔输出；实际输出为 ' + displayValue(output) + (output == null ? '' : '（保存类型为 ' + typeof output + '）') + '。' : '实际布尔输出为 ' + displayValue(value) + '。';
      if (value != null && typeof config.booleanPass === 'boolean') pass = value === config.booleanPass;
    } else if (type === 'category') {
      var categories = Array.isArray(config.categories) ? config.categories : [], valid = categories.filter(function (item) { return item && typeof item.name === 'string' && typeof item.pass === 'boolean'; }), matches = typeof output === 'string' ? valid.filter(function (item) { return item.name === output; }) : [];
      criteria = valid.length ? '类别通过映射：' + valid.map(function (item) { return item.name + ' → ' + (item.pass ? '是' : '否'); }).join('；') + '。' : '历史未保存有效的类别及通过映射快照。';
      if (matches.length === 1) { value = matches[0].name; pass = matches[0].pass; observations = '实际输出类别为「' + value + '」，按冻结映射判定。'; }
      else observations = output == null ? '未保存可匹配已定义类别的输出。' : '保存的输出「' + displayValue(output) + '」无法唯一匹配冻结的已定义类别，未作类别替换。';
    } else if (type === 'score') {
      var score = scoreResult(output, config), weighted = Array.isArray(config.scoreItems) ? config.scoreItems.filter(function (item) { return item && typeof item.name === 'string' && Number.isFinite(item.weight); }).map(function (item) { return item.name + '×' + item.weight; }).join(' + ') : '';
      value = score.value; criteria = (weighted ? '总分按 ' + weighted + ' 计算；' : '依据历史保存的总分；') + (Number.isFinite(config.threshold) ? '总分 ≥ ' + config.threshold + ' 时通过。' : '未保存有效的通过阈值快照，无法判定是否通过。');
      observations = value == null ? score.problem || '未保存有效总分或完整逐项分数，实际评分输出缺失。' : score.calculation || '实际总分为 ' + value + '。';
      if (value != null && Number.isFinite(config.threshold) && config.threshold >= 0 && config.threshold <= 100) pass = value >= config.threshold;
    } else if (type === 'text') {
      value = typeof output === 'string' ? output : null; criteria = '文本输出无通过标准。'; applicable = false;
      observations = value == null ? '本条记录未保存有效的文本输出。' : '已保存文本输出：' + excerpt(value);
    } else if (type === 'task-executions') {
      value = output && typeof output === 'object' && !Array.isArray(output) ? clone(output) : null;
      var task = result.taskSnapshot || snapshot && Array.isArray(snapshot.taskSnapshots) && snapshot.taskSnapshots.filter(function (item) { return item.id === result.taskId; })[0], completion = result.completion || value && value.completion, acceptance = result.acceptance || value && value.acceptance;
      criteria = task ? '完成条件：' + task.completion + '；通过标准：' + (Array.isArray(task.criteria) ? task.criteria.join('；') : '未保存') + '。' : '业务任务执行完成后，依据历史保存的任务通过判定展示；本条记录未保存完整任务定义快照。';
      observations = '保存的执行状态为「' + ({ completed: '已完成', running: '进行中', failed: '未完成' }[completion] || '未知') + '」，业务判定为「' + ({ passed: '通过', rejected: '未通过', pending: '待确认', na: '暂不评测' }[acceptance] || '未知') + '」。';
      if (completion !== 'completed') observations = '保存的执行状态为「' + ({ running: '进行中', failed: '未完成' }[completion] || '未知') + '」；任务尚未完成，未作业务通过判定。';
      var dimensions = Array.isArray(result.dimensions) ? result.dimensions : value && Array.isArray(value.dimensions) ? value.dimensions : [];
      if (dimensions.length) observations += ' 保存的维度结果：' + dimensions.filter(function (item) { return item && typeof item.name === 'string'; }).slice(0, 5).map(function (item) { return item.name + '：' + displayValue(item.value == null ? item.status : item.value); }).join('；') + '。';
      applicable = completion === 'completed'; if (applicable && acceptance === 'passed') pass = true; else if (applicable && acceptance === 'rejected') pass = false;
    } else { criteria = '历史未保存可识别的输出类型及通过标准快照。'; observations = '实际保存的输出为 ' + displayValue(output) + '，未推断输出类型。'; }
    var evidence = resultEvidence(result), identifiers = evidence.map(function (item) { return item.id; }).filter(Boolean);
    observations += identifiers.length ? ' 引用证据：' + identifiers.join('、') + '。' : ' 未找到可定位的原始输入输出证据。';
    var decisionStatus = type === 'text' ? 'na' : pass === true ? 'passed' : pass === false ? 'rejected' : 'pending';
    if (type === 'text') conclusion = '文本输出无通过标准，是否通过为 —。';
    else if (pass == null) conclusion = criteria + ' ' + (type === 'task-executions' ? !applicable ? '任务尚未完成，暂不能判定是否通过。' : '任务已完成，但通过标准相关证据尚未得到明确确认，是否通过未判定。' : value == null ? '缺少有效输出，是否通过未判定。' : '通过标准快照不完整，是否通过未判定。');
    else conclusion = criteria + ' 实际' + (type === 'score' ? '总分为 ' + value : type === 'task-executions' ? '任务执行已完成且业务判定为' + (pass ? '通过' : '未通过') : '输出为 ' + displayValue(value)) + '，是否通过：' + (pass ? '是' : '否') + '。';
    return { type: type, value: value, pass: pass, hasCriteria: type !== 'text', currentlyApplicable: applicable, criteria: criteria, observations: observations, reason: conclusion, decisionStatus: decisionStatus, evidence: evidence };
  }
  function derivePass(output, config) { return presentation({ output: output, outputConfig: config }).pass; }
  function recordResult(evaluator, target, run, value) {
    var output = value.output, acceptance = value.acceptance || 'na';
    var snapshot = evaluator.granularity === 'business-task' ? (evaluator.taskSnapshots || []).filter(function (task) { return task.id === target.taskId; })[0] : null;
    var record = Object.assign({}, target, value, { id: 'ER-' + hash(evaluator.id + ':' + target.key), evaluatorId: evaluator.id, evaluatorName: evaluator.name, runId: run.id, model: evaluator.model, granularity: evaluator.granularity, outputType: evaluator.output.type, outputConfig: clone(evaluator.output), taskSnapshot: snapshot ? clone(snapshot) : null, output: output, value: output, acceptance: acceptance, evaluatedAt: run.finishedAt, source: 'mock', configKey: hash(JSON.stringify(evaluator)) });
    var explained = presentation(record); record.pass = explained.pass; record.acceptance = explained.decisionStatus; record.reason = explained.reason;
    record.judgment = { criteria: explained.criteria, observations: explained.observations, conclusion: explained.reason, evidence: explained.evidence }; delete record.sourceEvidence; return record;
  }
  function ordinaryResult(evaluator, row, target, run) {
    var content = typeof target.output === 'string' ? target.output : JSON.stringify(target.output), negative = /不符合|不满足|未通过|不通过|GATEWAY_TIMEOUT|读取失败/.test(content), pending = !content || /等待后续输出|尚未生成|证据不足|待业务确认/.test(content);
    var output, acceptance = pending ? 'pending' : negative ? 'rejected' : 'passed';
    if (evaluator.output.type === 'boolean') output = pending ? null : acceptance === 'passed' ? evaluator.output.booleanPass : !evaluator.output.booleanPass;
    else if (evaluator.output.type === 'category') {
      var category = evaluator.output.categories.filter(function (item) { return pending ? /待|未知|确认/.test(item.name) : item.pass === (acceptance === 'passed'); })[0];
      if (!category) { output = null; acceptance = 'pending'; } else { output = category.name; if (!pending) acceptance = category.pass ? 'passed' : 'rejected'; }
    } else if (evaluator.output.type === 'score') {
      var score = negative ? 45 : 92, items = evaluator.output.scoreItems.map(function (item) { return { name: item.name, score: score, weight: item.weight, criteria: item.criteria }; });
      output = pending ? null : { items: items, score: Math.round(items.reduce(function (sum, item) { return sum + item.score * item.weight; }, 0) * 100) / 100, threshold: evaluator.output.threshold };
      if (!pending) acceptance = output.score >= evaluator.output.threshold ? 'passed' : 'rejected';
    } else { output = (negative ? '发现需复核的异常。' : pending ? '执行证据仍需补充。' : '已保留会话与执行证据。') + '摘要：' + content.slice(0, 220); acceptance = 'na'; }
    return recordResult(evaluator, { key: target.key, sessionId: row.id, sessionName: row.name, targetId: target.id, startMessageId: target.startMessageId || '', completionMessageId: target.completionMessageId || '', completionRound: target.round || null, evidence: target.evidence || [], targetName: target.name }, run, { output: output, acceptance: acceptance, dimensions: evaluator.output.type === 'score' && output ? output.items.map(function (item) { return { name: item.name, value: item.score, reason: item.criteria }; }) : [] });
  }
  function targets(evaluator, row, data) {
    if (evaluator.granularity === 'session') return [{ id: row.id, key: row.id, name: row.name, startMessageId: data.rounds[0] && data.rounds[0].inputId, completionMessageId: data.rounds.length && data.rounds[data.rounds.length - 1].outputId, output: data.rounds.map(function (turn) { return turn.output || ''; }).join('\n'), evidence: data.rounds.reduce(function (all, turn) { return all.concat([turn.inputId, turn.outputId].filter(Boolean)); }, []) }];
    if (evaluator.granularity === 'trace') return data.rounds.map(function (turn) { return { id: row.id + '-round-' + turn.n, key: row.id + '-round-' + turn.n, name: '第 ' + turn.n + ' 轮 Trace', round: turn.n, startMessageId: turn.inputId, completionMessageId: turn.outputId, output: data.records.filter(function (record) { return record.round === turn.n; }).map(function (record) { return typeof record.output === 'string' ? record.output : JSON.stringify(record.output); }).join('\n') || turn.output, evidence: [turn.inputId, turn.outputId].filter(Boolean) }; });
    return data.records.filter(function (record) { return evaluator.spanTypes.indexOf(record.type) >= 0; }).map(function (record) { var turn = data.rounds.filter(function (item) { return item.n === record.round; })[0] || {}; return { id: record.id, key: record.id, name: record.name, round: record.round, startMessageId: turn.inputId, completionMessageId: turn.outputId, output: record.output, evidence: [record.id] }; });
  }
  function results(id) { var state = read(); return clone(state.data.results.filter(function (item) { return !id || item.evaluatorId === id; }).sort(function (a, b) { return b.evaluatedAt.localeCompare(a.evaluatedAt); })); }
  function runs(id) { var state = read(); return clone(state.data.runs.filter(function (item) { return !id || item.evaluatorId === id; }).sort(function (a, b) { return b.startedAt.localeCompare(a.startedAt); })); }
  function run(evaluator, options) {
    options = options || {}; var D = global.AIOpsOnlineEvaluatorData, requestedId = typeof evaluator === 'string' ? evaluator : evaluator && evaluator.id;
    if (!requestedId) return { ok: false, error: '请先保存评估器。' };
    evaluator = D.createStore(storage()).list().filter(function (record) { return record.id === requestedId; })[0];
    if (!evaluator) return { ok: false, error: '评估器不存在或配置读取失败，请刷新后重试。' };
    if (options.trigger === 'seed' && !seeding) return { ok: false, error: '仅初始化示例历史时允许此执行方式。' };
    if (!seeding && evaluator.enabled === false) return { ok: false, code: 'disabled', error: '该评估器已停用，无法开始新的评估。' };
    var clock = now(), errors = D.validate(evaluator, { allowPastOnce: true, now: clock }), state = read();
    if (errors.length) return { ok: false, error: errors.map(function (error) { return error.message; }).join('；'), errors: errors };
    if (evaluator.granularity === 'business-task') {
      var currentTasks = D.taskDefinitions(evaluator.sceneId, evaluator.agentId), snapshots = evaluator.taskSnapshots || [];
      if (snapshots.length !== evaluator.taskIds.length || snapshots.some(function (snapshot) { var current = currentTasks.filter(function (task) { return task.id === snapshot.id; })[0]; return !current || JSON.stringify(current) !== JSON.stringify(snapshot); })) return { ok: false, error: '关联业务任务定义已更新或快照不完整，请重新保存评估器后再执行。' };
    }
    if (!state.ok) return { ok: false, error: state.error };
    if (options.trigger === 'scheduled') {
      var slot = JSON.stringify([evaluator.id, evaluator.scheduleRevision, options.scheduledAt]);
      if (!options.slotKey || options.slotKey !== slot || options.scheduleRevision !== evaluator.scheduleRevision || options.armedAt !== evaluator.armedAt || options.scheduleKey !== D.scheduleKey(evaluator.schedule) || !Number.isFinite(Date.parse(options.scheduledAt)) || Date.parse(options.scheduledAt) > Date.parse(clock) || !Number.isFinite(Date.parse(evaluator.armedAt)) || Date.parse(options.scheduledAt) <= Date.parse(evaluator.armedAt)) return { ok: false, skipped: true, code: 'stale-schedule', error: '调度配置或启用状态已变化，已跳过旧执行时间。' };
      var executed = state.data.runs.filter(function (item) { return item.slotKey === options.slotKey; })[0];
      if (executed) return { ok: true, skipped: true, run: clone(executed) };
    }
    var filter = filterSpec(evaluator.filterLogic, clock); if (!filter.ok) return filter;
    var ledger = state.data, serial = ledger.runs.reduce(function (max, item) { return Math.max(max, Number(String(item.id).split('-').pop()) || 0); }, 0) + 1;
    var scan = { id: 'EVRUN-' + String(serial).padStart(5, '0'), evaluatorId: evaluator.id, evaluatorName: evaluator.name, startedAt: clock, finishedAt: clock, status: 'completed', trigger: options.trigger || 'manual', scanned: 0, recognized: 0, created: 0, updated: 0, unchanged: 0, failed: 0, source: 'mock', evaluatorSnapshot: clone(evaluator) };
    if (options.trigger === 'scheduled') { scan.slotKey = options.slotKey; scan.scheduledAt = options.scheduledAt; scan.scheduleRevision = options.scheduleRevision; }
    var rows = host.sessions ? host.sessions() : [], candidates = rows.filter(function (row) { return canonicalAgent(row) === evaluator.agentId; });
    var baseline = evaluator.granularity === 'business-task' && global.AIOpsBusinessTasks ? global.AIOpsBusinessTasks.records(evaluator.taskIds) : [];
    try {
      candidates.forEach(function (row) {
        var data = sessionData(row); if (!filter.match(row, data)) return; scan.scanned++;
        if (evaluator.granularity === 'business-task') {
          scanTaskSession(evaluator, row).forEach(function (execution) {
            scan.recognized++;
            var index = ledger.taskExecutions.findIndex(function (item) { return (item.key || item.executionKey) === execution.key; }), previous = index >= 0 ? ledger.taskExecutions[index] : baseline.filter(function (item) { return (item.key || item.executionKey || executionKey(item.taskId, item.sessionId, item.startMessageId)) === execution.key; })[0];
            if (previous) execution.id = previous.id;
            if (!previous) scan.created++; else if (equivalent(previous, execution)) scan.unchanged++; else scan.updated++;
            execution.evaluatorId = evaluator.id; execution.evaluatorName = evaluator.name; execution.evaluatedAt = clock;
            if (index >= 0) ledger.taskExecutions[index] = execution; else ledger.taskExecutions.push(execution);
            var result = recordResult(evaluator, Object.assign({}, execution, { executionId: execution.id, sessionName: row.name }), scan, { output: { taskId: execution.taskId, taskVersion: execution.taskVersion, completion: execution.completion, acceptance: execution.acceptance, startMessageId: execution.startMessageId, completionMessageId: execution.completionMessageId, dimensions: execution.dimensions }, acceptance: execution.acceptance });
            var at = ledger.results.findIndex(function (item) { return item.id === result.id; }); if (at >= 0) ledger.results[at] = result; else ledger.results.push(result);
          });
        } else {
          targets(evaluator, row, data).forEach(function (target) {
            if ((parseInt(hash(evaluator.id + ':' + target.key), 36) % 10000) / 100 >= evaluator.samplingRate) return;
            var result = ordinaryResult(evaluator, row, target, scan), at = ledger.results.findIndex(function (item) { return item.id === result.id; }); scan.recognized++;
            if (at < 0) { ledger.results.push(result); scan.created++; }
            else { if (equivalent(ledger.results[at], result)) scan.unchanged++; else scan.updated++; ledger.results[at] = result; }
          });
        }
      });
    } catch (_) { return { ok: false, error: '会话扫描失败，本次结果与业务任务统计均未写回。' }; }
    ledger.runs.push(scan); var saved = write(ledger); return saved.ok ? { ok: true, run: clone(scan) } : saved;
  }
  function summary(ids) {
    var allowed = ids == null ? null : Array.isArray(ids) ? ids : [ids], values = results().filter(function (item) { return !allowed || allowed.indexOf(item.evaluatorId) >= 0; }), scans = runs().filter(function (item) { return !allowed || allowed.indexOf(item.evaluatorId) >= 0; });
    var views = values.map(presentation), passed = views.filter(function (item) { return item.pass === true; }).length, rejected = views.filter(function (item) { return item.pass === false; }).length, pending = views.filter(function (item) { return item.decisionStatus === 'pending'; }).length, executions = values.filter(function (item) { return item.executionId; }), completed = executions.filter(function (item) { return item.completion === 'completed'; }).length, scores = views.filter(function (item) { return item.type === 'score' && Number.isFinite(item.value); });
    return { evaluators: allowed ? allowed.length : new Set(values.map(function (item) { return item.evaluatorId; }).concat(scans.map(function (item) { return item.evaluatorId; }))).size, runs: scans.length, records: values.length, passed: passed, rejected: rejected, pending: pending, completed: completed, executions: executions.length, passRate: passed + rejected ? passed / (passed + rejected) * 100 : null, completionRate: executions.length ? completed / executions.length * 100 : null, averageScore: scores.length ? scores.reduce(function (sum, item) { return sum + item.value; }, 0) / scores.length : null, lastEvaluatedAt: scans.length ? scans[0].finishedAt : null };
  }
  function initialize() {
    var D = global.AIOpsOnlineEvaluatorData, store = D.createStore(storage()), seeded = store.seedDefaults(); if (!seeded.ok) return seeded;
    var state = read(); if (!state.ok) return state; if (state.data.initialized) return { ok: true };
    var examples = store.list().filter(function (record) { return record.id.indexOf('OE-DEMO-') === 0; });
    seeding = true;
    try { for (var i = 0; i < examples.length; i++) { var result = run(examples[i], { trigger: 'seed' }); if (!result.ok) return result; } }
    finally { seeding = false; }
    state = read(); if (!state.ok) return state; state.data.initialized = true; return write(state.data);
  }
  global.AIOpsOnlineEvaluatorRuntime = { configure: function (next) { host = next || {}; historicalSnapshots = Object.create(null); evidenceCache = Object.create(null); }, initialize: initialize, run: run, results: results, runs: runs, summary: summary, presentation: presentation, derivePass: derivePass, scanTaskSession: scanTaskSession, filterSpec: filterSpec, storageKey: KEY };
})(window);
