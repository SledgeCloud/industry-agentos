/* Pure evaluator/result filtering. No storage, DOM, scheduler, or model access. */
(function (global) {
  'use strict';
  function text(value) { return value == null ? '' : String(value).trim(); }
  function list(value) { return Array.isArray(value) ? value : []; }
  function defaultsList() { return { status: '', granularity: '', agentId: '', tag: '' }; }
  function defaultsDetail() { return { query: '', dateBy: 'evaluation', from: '', to: '', resultChoice: 'all', minScore: '', maxScore: '', text: '', pass: 'all' }; }
  function dateParts(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value)); if (!match) return null;
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    if (year < 1 || month < 1 || month > 12 || day < 1) return null;
    var date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0, 0, 0, 0);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? match.slice(1) : null;
  }
  function numericBound(value) {
    if (value == null || typeof value === 'string' && !value.trim()) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return NaN;
    if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) return NaN;
    return Number(value);
  }
  function validate(filters) {
    var f = Object.assign(defaultsDetail(), filters || {}), from = text(f.from), to = text(f.to);
    if (from && !dateParts(from) || to && !dateParts(to)) return '请输入有效日期（YYYY-MM-DD）。';
    if (from && to && from > to) return '开始日期不能晚于结束日期。';
    if (f.resultChoice === 'score') {
      var min = numericBound(f.minScore), max = numericBound(f.maxScore);
      if (min !== null && (!Number.isFinite(min) || min < 0 || min > 100) || max !== null && (!Number.isFinite(max) || max < 0 || max > 100)) return '评分范围须为 0–100 之间的有效数字。';
      if (min !== null && max !== null && min > max) return '最低评分不能高于最高评分。';
    }
    return '';
  }
  function shanghaiDay(value) {
    if (typeof value !== 'string') return '';
    var stamp = value.trim(), match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?)?([zZ]|[+-]\d{2}:?\d{2})?$/.exec(stamp);
    if (!match || !dateParts(match[1]) || match[2] != null && (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59)) return '';
    if (match[6] && /^[+-]/.test(match[6]) && (Number(match[6].slice(1, 3)) > 23 || Number(match[6].slice(-2)) > 59)) return '';
    var normalized = match[1] + 'T' + (match[2] || '00') + ':' + (match[3] || '00') + ':' + (match[4] || '00') + (match[5] || '') + (match[6] || '+08:00');
    var timestamp = Date.parse(normalized); return Number.isFinite(timestamp) ? new Date(timestamp + 8 * 3600000).toISOString().slice(0, 10) : '';
  }
  function evaluators(records, filters, query, getAgentName) {
    var f = Object.assign(defaultsList(), filters || {}), q = text(query).toLowerCase();
    return list(records).filter(function (record) {
      if (!record || typeof record !== 'object') return false;
      if (f.status && !(f.status === 'enabled' && record.enabled !== false || f.status === 'disabled' && record.enabled === false)) return false;
      if (f.granularity && record.granularity !== f.granularity || f.agentId && record.agentId !== f.agentId || f.tag && list(record.tags).indexOf(f.tag) < 0) return false;
      var name = typeof getAgentName === 'function' ? getAgentName(record) : record.agentId;
      return !q || [record.name, record.description, record.id, name, list(record.tags).join(' ')].map(text).join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function present(item, options) { return (options && typeof options.presentation === 'function' ? options.presentation(item) : { type: item.outputType, value: item.value, pass: item.pass }) || {}; }
  function taskType(type) { return type === 'task-executions' || type === 'business-task' || type === 'task'; }
  function taskState(item, p) { return item.completion || p.completion || p.value && p.value.completion || ''; }
  function scoreValue(p) { var value = p.score != null ? p.score : typeof p.value === 'number' ? p.value : p.value && p.value.score; return typeof value === 'number' && Number.isFinite(value) ? value : NaN; }
  function empty(item, p) {
    if (taskType(p.type)) return !taskState(item, p);
    if (p.type === 'score') return !Number.isFinite(scoreValue(p));
    return p.value == null || typeof p.value === 'string' && !p.value.trim() || typeof p.value === 'number' && !Number.isFinite(p.value);
  }
  function categoryName(value) { return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : ''; }
  function choiceMatches(item, p, choice) {
    if (!choice || choice === 'all') return true;
    if (choice === 'empty') return empty(item, p);
    if (choice === 'boolean:true' || choice === 'boolean:false') return p.type === 'boolean' && p.value === (choice === 'boolean:true');
    if (choice.indexOf('category:') === 0) return p.type === 'category' && 'category:' + encodeURIComponent(categoryName(p.value)) === choice;
    if (choice === 'score' || choice === 'text') return p.type === choice;
    if (choice.indexOf('task:') === 0) return taskType(p.type) && taskState(item, p) === choice.slice(5);
    return false;
  }
  function results(items, filters, options) {
    var f = Object.assign(defaultsDetail(), filters || {}); if (validate(f)) return [];
    var q = text(f.query).toLowerCase(), content = f.resultChoice === 'text' ? text(f.text).toLowerCase() : '', min = f.resultChoice === 'score' ? numericBound(f.minScore) : null, max = f.resultChoice === 'score' ? numericBound(f.maxScore) : null;
    return list(items).filter(function (item) {
      if (!item || typeof item !== 'object') return false;
      var row = options && typeof options.session === 'function' ? options.session(item.sessionId) : null;
      var name = row && row.name != null ? row.name : item.sessionName;
      if (q && [name, item.sessionId].map(text).join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (text(f.from) || text(f.to)) {
        var day = shanghaiDay(f.dateBy === 'session' ? row && row.time : item.evaluatedAt);
        if (!day || f.from && day < text(f.from) || f.to && day > text(f.to)) return false;
      }
      var p = present(item, options);
      if (!choiceMatches(item, p, text(f.resultChoice))) return false;
      if (min !== null || max !== null) {
        var score = scoreValue(p); if (p.type !== 'score' || !Number.isFinite(score) || min !== null && score < min || max !== null && score > max) return false;
      }
      if (content && (p.type !== 'text' || typeof p.value !== 'string' || p.value.toLowerCase().indexOf(content) < 0)) return false;
      if (f.pass && f.pass !== 'all') {
        if (f.pass === 'yes') { if (p.pass !== true) return false; }
        else if (f.pass === 'no') { if (p.pass !== false) return false; }
        else if (f.pass === 'undecided') { if (p.pass != null || p.type === 'text') return false; }
        else if (f.pass === 'not-applicable') { if (p.type !== 'text') return false; }
        else return false;
      }
      return true;
    });
  }
  function resultChoices(items, presentation, currentOutputConfig) {
    var types = Object.create(null), names = [], seen = Object.create(null), options = { presentation: presentation };
    function category(value) { var name = categoryName(value); if (!name || Object.prototype.hasOwnProperty.call(seen, name)) return; seen[name] = true; names.push(name); }
    function config(value) { value = value || {}; if (value.type) types[value.type] = true; list(value.categories).forEach(function (item) { if (item && item.name != null) { category(item.name); types.category = true; } }); }
    list(items).forEach(function (item) { if (!item) return; var p = present(item, options); if (p.type) types[p.type] = true; if (p.type === 'category') category(p.value); config(item.outputConfig); });
    config(currentOutputConfig);
    var choices = [{ id: 'all', label: '全部结果' }];
    if (types.boolean) choices.push({ id: 'boolean:true', label: 'True' }, { id: 'boolean:false', label: 'False' });
    names.forEach(function (name) { choices.push({ id: 'category:' + encodeURIComponent(name), label: name }); });
    if (types.score) choices.push({ id: 'score', label: '评分' });
    if (types.text) choices.push({ id: 'text', label: '文本' });
    if (types['task-executions'] || types['business-task'] || types.task) choices.push({ id: 'task:completed', label: '任务已完成' }, { id: 'task:running', label: '任务执行中' }, { id: 'task:failed', label: '任务未完成' });
    choices.push({ id: 'empty', label: '空输出' }); return choices;
  }
  global.AIOpsOnlineEvaluatorFilters = { defaultsList: defaultsList, defaultsDetail: defaultsDetail, evaluators: evaluators, results: results, validate: validate, resultChoices: resultChoices };
})(window);
