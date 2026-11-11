/* Unified evaluation assets and jobs. Browser-local Mock; no model or business operation is called. */
(function (global) {
  'use strict';
  var KEY = 'aiops.unified-evaluation.v1', host = {}, timer = null, lastTick = null, planned = Object.create(null), schedulerPending = null, schedulerGeneration = 0;
  var TARGETS = ['case_output', 'session', 'trace', 'span', 'task_execution'];
  var MAX_TARGETS_PER_RUN = 200;
  var memory = {}, fallbackStorage = { getItem: function (key) { return memory[key] || null; }, setItem: function (key, value) { memory[key] = value; } };
  function copy(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function own(object, key) { return !!object && Object.prototype.hasOwnProperty.call(object, key); }
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function clock() { return new Date(typeof host.now === 'function' ? host.now() : host.now || Date.now()).toISOString(); }
  function storage() { return host.storage || fallbackStorage; }
  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().filter(function (key) { return value[key] !== undefined; }).map(function (key) { return JSON.stringify(key) + ':' + canonical(value[key]); }).join(',') + '}';
    return JSON.stringify(value);
  }
  // Synchronous SHA-256 keeps snapshot/config identities stable without an async crypto dependency.
  function sha256(value) {
    var bytes = unescape(encodeURIComponent(String(value))), words = [], length = bytes.length, i, j;
    var h = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
    var k = [1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];
    function rotate(n, bits) { return n >>> bits | n << 32 - bits; }
    for (i = 0; i < length; i++) words[i >> 2] = (words[i >> 2] || 0) | bytes.charCodeAt(i) << 24 - (i % 4) * 8;
    words[length >> 2] = (words[length >> 2] || 0) | 128 << 24 - (length % 4) * 8;
    var size = ((length + 9 + 63) >> 6) * 16; while (words.length < size) words.push(0);
    words[size - 2] = Math.floor(length * 8 / 4294967296); words[size - 1] = length * 8 >>> 0;
    for (i = 0; i < size; i += 16) {
      var w = words.slice(i, i + 16), a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (j = 0; j < 64; j++) {
        if (j >= 16) w[j] = (w[j - 16] + (rotate(w[j - 15], 7) ^ rotate(w[j - 15], 18) ^ w[j - 15] >>> 3) + w[j - 7] + (rotate(w[j - 2], 17) ^ rotate(w[j - 2], 19) ^ w[j - 2] >>> 10)) | 0;
        var t1 = (hh + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + k[j] + w[j]) | 0;
        var t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c)) | 0;
        hh = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
      }
      h = h.map(function (n, index) { return n + [a,b,c,d,e,f,g,hh][index] | 0; });
    }
    return h.map(function (n) { return (n >>> 0).toString(16).padStart(8, '0'); }).join('');
  }
  function digest(value) { return sha256(canonical(value)); }
  function empty() { return { schemaVersion: 1, revision: 0, initialized: false, evaluators: [], jobs: [], runs: [], assessments: [], events: [], recognitions: [] }; }
  function read() {
    try {
      var raw = storage().getItem(KEY), state = raw ? JSON.parse(raw) : empty();
      if (!state || state.schemaVersion !== 1 || !['evaluators', 'jobs', 'runs', 'assessments'].every(function (key) { return Array.isArray(state[key]); })) throw Error('invalid');
      if (!Array.isArray(state.events)) state.events = []; if (!Array.isArray(state.recognitions)) state.recognitions = [];
      return { ok: true, state: state, raw: raw };
    } catch (_) { return { ok: false, error: '统一评估数据读取失败，未覆盖现有记录。' }; }
  }
  function transact(work) {
    for (var attempt = 0; attempt < 2; attempt++) {
      var loaded = read(); if (!loaded.ok) return loaded;
      try {
        var state = loaded.state, result = work(state); if (!result || result.ok === false || result.noWrite) return result;
        if (storage().getItem(KEY) !== loaded.raw) continue;
        state.revision++; storage().setItem(KEY, JSON.stringify(state)); return copy(result);
      } catch (error) { return { ok: false, error: error.message || '统一评估数据保存失败，本次变更未写入。' }; }
    }
    return { ok: false, error: '配置已在其他页面更新，请重新操作。' };
  }
  function fail(errors) { return { ok: false, errors: errors, error: errors.map(function (e) { return e.message; }).join('；') }; }
  function problem(list, field, message) { list.push({ field: field, message: message }); }
  function unique(values) { return values.filter(function (value, index) { return values.indexOf(value) === index; }); }
  function content(value) { return value !== undefined && value !== null && (typeof value === 'string' ? !!value.trim() : Array.isArray(value) ? !!value.length : typeof value === 'object' ? !!Object.keys(value).length : true); }
  function timestamp(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value !== 'string' || !value.trim()) return NaN;
    var source = value.trim().replace(' ', 'T');
    if (/^\d{4}-\d\d-\d\d$/.test(source)) source += 'T00:00:00+08:00';
    else if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?$/.test(source)) source += '+08:00';
    return Date.parse(source);
  }
  function activity(values) {
    var times = values.map(timestamp).filter(Number.isFinite);
    return times.length ? new Date(Math.max.apply(Math, times)).toISOString() : null;
  }
  function objectTimes(value) { return ['updatedAt', 'lastActivityAt', 'endedAt', 'completedAt', 'finishedAt', 'outputAt', 'timestamp', 'inputAt', 'startedAt', 'triggeredAt', 'time'].map(function (key) { return value && value[key]; }); }
  function pointer(value, path) {
    if (typeof path !== 'string' || !/^(?:\/(?:[^~\/]|~0|~1)*)*$/.test(path)) return undefined;
    var keys = path ? path.slice(1).split('/').map(function (key) { return key.replace(/~1/g, '/').replace(/~0/g, '~'); }) : [];
    for (var i = 0; i < keys.length; i++) { if (!own(value, keys[i])) return undefined; value = value[keys[i]]; }
    return value;
  }
  function typeMatches(value, schema) {
    schema = schema || {}; var types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    if (types.length && !types.some(function (type) { return type === 'null' ? value === null : type === 'array' ? Array.isArray(value) : type === 'object' ? !!value && typeof value === 'object' && !Array.isArray(value) : type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === type; })) return false;
    if (schema.enum && !schema.enum.some(function (item) { return canonical(item) === canonical(value); })) return false;
    if (typeof value === 'number' && (Number.isFinite(schema.minimum) && value < schema.minimum || Number.isFinite(schema.maximum) && value > schema.maximum)) return false;
    if (typeof value === 'string' && schema.minLength && value.length < schema.minLength) return false;
    if (Array.isArray(value) && (Number.isInteger(schema.minItems) && value.length < schema.minItems || Number.isInteger(schema.maxItems) && value.length > schema.maxItems)) return false;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Number.isInteger(schema.minProperties) && Object.keys(value).length < schema.minProperties) return false;
      if ((schema.required || []).some(function (key) { return !own(value, key); })) return false;
      if (schema.additionalProperties === false && Object.keys(value).some(function (key) { return !own(schema.properties || {}, key); })) return false;
      if (Object.keys(schema.properties || {}).some(function (key) { return own(value, key) && !typeMatches(value[key], schema.properties[key]); })) return false;
    }
    if (Array.isArray(value) && schema.items && value.some(function (item) { return !typeMatches(item, schema.items); })) return false;
    return true;
  }
  function metricValue(metric, value) {
    if (metric.valueType === 'number') return typeof value === 'number' && Number.isFinite(value) && (!metric.range || value >= metric.range.min && value <= metric.range.max);
    if (metric.valueType === 'boolean') return typeof value === 'boolean';
    if (metric.valueType === 'category') return typeof value === 'string' && (metric.categories || []).some(function (category) { return category.code === value; });
    return metric.valueType === 'text' && typeof value === 'string';
  }
  function modelCatalog(description) { return ['deepseek 4.1 flash', 'GPT-6.1 Sol', 'Claude 5.5 Opus'].map(function (name) { return { id: name, name: name, description: description }; }); }
  function judgeModels() { return modelCatalog('评估模型配置；当前本地 Mock 不连接真实模型服务。'); }
  function runtimeModels() { return modelCatalog('评测执行模型配置；与评估模型独立，当前本地 Mock 不调用真实模型。'); }
  function resolveModel(value) {
    var ref = typeof value === 'string' ? value : value && (value.modelRef || value.id), current = modelCatalog('').filter(function (item) { return item.id === ref; })[0];
    if (current) return current;
    var labels = { 'mock-evidence-judge-v1': '通用评判模型 · Mock', 'mock-evidence-judge-fast-v1': '快速评判模型 · Mock', 'mock-evidence-judge-strict-v1': '复核评判模型 · Mock', 'mock-agent-balanced-v1': '均衡被测模型 · Mock', 'mock-agent-fast-v1': '快速被测模型 · Mock', 'mock-agent-reasoning-v1': '推理被测模型 · Mock', 'mock-eval-balanced': '通用评测模型 · Mock', 'mock-eval-fast': '快速评测模型 · Mock', 'mock-eval-reasoning': '推理评测模型 · Mock' };
    return own(labels, ref) ? { id: ref, name: labels[ref], legacy: true, description: '保留原历史配置标识，不推断过去调用了任何真实模型。' } : null;
  }
  function modelDisplayName(value) { var resolved = resolveModel(value); return resolved ? resolved.name : text(typeof value === 'string' ? value : value && value.modelRef) || '未知'; }
  function defaultJudgeRuntime() { return { modelRef: 'deepseek 4.1 flash', parameters: { temperature: 0, maxOutputTokens: 1200 } }; }
  function normalizeJudgeRuntime(value, legacyMethod) {
    var fallback = defaultJudgeRuntime(), supplied = value;
    if (supplied == null) supplied = legacyMethod && text(legacyMethod.modelRef) ? { modelRef: legacyMethod.modelRef, parameters: legacyMethod.parameters || {} } : fallback;
    var parameters = supplied.parameters;
    return { modelRef: text(supplied.modelRef), parameters: parameters != null && (typeof parameters !== 'object' || Array.isArray(parameters)) ? copy(parameters) : Object.assign({}, fallback.parameters, copy(parameters || {})) };
  }
  function validateJudgeRuntime(value) {
    var errors = [], config = value || {}, parameters = config.parameters;
    if (!text(config.modelRef)) problem(errors, 'judgeRuntime.modelRef', '请选择独立的评判模型');
    if (parameters != null && (typeof parameters !== 'object' || Array.isArray(parameters))) problem(errors, 'judgeRuntime.parameters', '评判模型参数须为对象');
    if (parameters && own(parameters, 'temperature') && (!Number.isFinite(parameters.temperature) || parameters.temperature < 0 || parameters.temperature > 2)) problem(errors, 'judgeRuntime.parameters.temperature', '评判温度须在 0–2 之间');
    if (parameters && own(parameters, 'maxOutputTokens') && (!Number.isInteger(parameters.maxOutputTokens) || parameters.maxOutputTokens < 1)) problem(errors, 'judgeRuntime.parameters.maxOutputTokens', '评判输出上限须为正整数');
    if (parameters && own(parameters, 'topP') && (!Number.isFinite(parameters.topP) || parameters.topP < 0 || parameters.topP > 1)) problem(errors, 'judgeRuntime.parameters.topP', 'topP 须在 0–1 之间');
    return errors;
  }
  function evaluatorDefinition(value) {
    var result = copy(value || {});
    if (result.method && result.method.type === 'llm_judge') result.method = { type: 'llm_judge', prompt: result.method.prompt };
    ['modelRef', 'model', 'parameters', 'judgeRuntime'].forEach(function (key) { delete result[key]; }); return result;
  }
  function gradingDefinition(value) {
    var clean = evaluatorDefinition(value), result = {};
    ['id', 'version', 'authoringMode', 'supportedTargets', 'method', 'inputSchema', 'metrics', 'aggregation', 'decision'].forEach(function (key) { if (own(clean, key)) result[key] = clean[key]; });
    if (isV4Evaluator(clean) && own(clean, 'additionalPrompt')) result.additionalPrompt = clean.additionalPrompt;
    return result;
  }
  var INPUT_ALIASES = { actual: 'actual', output: 'actual', answer: 'actual', input: 'input', reference: 'reference', expected: 'reference', messages: 'messages', trajectory: 'trajectory', taskDefinition: 'taskDefinition', task: 'taskDefinition', context: 'context' };
  var INPUT_LABELS = { actual: '实际输出', input: '实际输入', reference: '参考答案', messages: '评估对象的消息', trajectory: '评估对象的执行轨迹', taskDefinition: '业务任务定义', context: '检索/补充上下文' };
  function isPromptEvaluator(evaluator) { return !!evaluator && evaluator.authoringMode === 'prompt'; }
  function isV4Evaluator(evaluator) { var d = evaluator && evaluator.decision || {}; return !isPromptEvaluator(evaluator) && (d.policyVersion === 4 || d.type === 'evaluation_policy'); }
  function itemDefinition(evaluator) { var d = evaluator && evaluator.decision || {}; return d.policyVersion === 3 || d.type === 'item_summary'; }
  function itemPolicies(evaluator) { return itemDefinition(evaluator) || isV4Evaluator(evaluator) ? copy((evaluator.metrics || []).filter(function (item) { return item.valueType !== 'text'; })) : []; }
  function decisionRules(evaluator) {
    var d = evaluator && evaluator.decision || {};
    if (d.type === 'all_rules') return copy(Array.isArray(d.rules) ? d.rules : []);
    if (d.type === 'boolean_equals') return [{ metricId: d.metricId, operator: 'equals', value: d.value }];
    if (d.type === 'category_in') return [{ metricId: d.metricId, operator: 'in', value: copy(d.values || []) }];
    return [];
  }
  function hasDecision(evaluator) { var d = evaluator && evaluator.decision || {}; return isV4Evaluator(evaluator) ? d.mode === 'custom_prompt' || itemPolicies(evaluator).length > 0 : itemDefinition(evaluator) ? itemPolicies(evaluator).length > 0 : d.type === 'aggregate_threshold' ? Number.isFinite(d.threshold) : decisionRules(evaluator).length > 0; }
  function decisionMigrationStatus(evaluator) {
    var d = evaluator && evaluator.decision || {}, migration = evaluator && evaluator.migrationState;
    if (migration) return { requiresChoice: !!migration.requiresReview && migration.acknowledged !== true, legacyDecision: copy(evaluator.legacyConfiguration && evaluator.legacyConfiguration.decision || null), message: '请参照历史配置完成评估项重配并明确确认；旧发布版本不会改变。', policyVersion: d.policyVersion || 1, issues: copy(migration.issues || []) };
    var required = d.type === 'aggregate_threshold';
    return { requiresChoice: required, legacyDecision: required ? copy(d) : null, message: required ? '旧版本按汇总分判定。请明确选择指标通过条件，或主动选择仅观察；汇总分在新版本中只作展示。' : '', policyVersion: d.policyVersion || 1 };
  }
  function newDecisionPolicy(value, metrics) {
    var original = copy(value || {}), d = { type: original.type || 'none', policyVersion: 2, missingEvidence: own(original, 'missingEvidence') ? original.missingEvidence : 'inconclusive' };
    if (['all_rules', 'boolean_equals', 'category_in'].indexOf(d.type) >= 0) {
      if (d.type === 'all_rules' && !Array.isArray(original.rules)) { d.rules = copy(original.rules); return d; }
      d.type = 'all_rules'; d.rules = decisionRules({ decision: original }).map(function (rule) {
        if (!rule || typeof rule !== 'object') return rule;
        var metric = (metrics || []).filter(function (m) { return m.id === rule.metricId; })[0];
        if (metric && metric.valueType === 'category' && ['equals', 'not_equals'].indexOf(rule.operator) >= 0 && metricValue(metric, rule.value)) return { metricId: rule.metricId, operator: 'in', value: rule.operator === 'equals' ? [rule.value] : metric.categories.filter(function (category) { return category.code !== rule.value; }).map(function (category) { return category.code; }) };
        return rule;
      });
      if (!d.rules.length) { d.type = 'none'; delete d.rules; }
    } else if (d.type === 'aggregate_threshold') { d.operator = original.operator; d.threshold = original.threshold; }
    return d;
  }
  function validTypedCondition(metric, rule) {
    if (!metric || metric.valueType === 'text') return false;
    if (metric.valueType === 'boolean') return ['equals', 'not_equals'].indexOf(rule.operator) >= 0 && typeof rule.value === 'boolean';
    if (metric.valueType === 'category') return rule.operator === 'in' && Array.isArray(rule.value) && rule.value.length > 0 && unique(rule.value).length === rule.value.length && rule.value.every(function (value) { return metricValue(metric, value); });
    if (metric.valueType === 'number') {
      if (rule.operator === 'between') return Array.isArray(rule.value) && rule.value.length === 2 && rule.value.every(Number.isFinite) && rule.value[0] <= rule.value[1];
      return ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte'].indexOf(rule.operator) >= 0 && Number.isFinite(rule.value);
    }
    return false;
  }
  function inputType(canonicalKey) {
    if (canonicalKey === 'messages' || canonicalKey === 'trajectory') return { type: 'array', minItems: 1, items: { type: 'object', minProperties: 1 } };
    if (canonicalKey === 'taskDefinition') return { type: 'object', minProperties: 1 };
    return { type: ['string', 'object', 'array', 'number', 'boolean'] };
  }
  function prepareLegacyEvaluator(value) {
    var record = evaluatorDefinition(value), method = record.method || {}, prompt = typeof method.prompt === 'string' ? method.prompt : '';
    var priorSchema = record.inputSchema || {}, legacyInputs = !priorSchema['x-aiops-evidence'];
    if (Array.isArray(record.metrics)) record.metrics.forEach(function (metric) {
      if (!metric || typeof metric !== 'object' || ['llm_judge', 'rule'].indexOf(method.type) < 0) return;
      if (method.type === 'llm_judge' && text(metric.rubric)) {
        var block = '【指标评分规则：' + String(metric.id || '') + '｜' + String(metric.name || '') + '】\n' + metric.rubric;
        if (prompt.indexOf(block) < 0) prompt += (prompt ? '\n\n' : '') + block;
        if (metric.description === metric.rubric) delete metric.description;
      }
      delete metric.rubric;
    });
    if (method.type === 'llm_judge') {
      record.method.prompt = prompt;
      var used = deriveEvidenceRequirements(record).variables.map(function (item) { return item.canonical; });
      var declarations = priorSchema.properties || {}, lines = [];
      (legacyInputs ? Array.isArray(priorSchema.required) ? priorSchema.required : [] : []).forEach(function (key) {
        if (!own(declarations, key) || !own(INPUT_ALIASES, key) || used.indexOf(INPUT_ALIASES[key]) >= 0) return;
        lines.push(INPUT_LABELS[INPUT_ALIASES[key]] + '：{{' + key + '}}'); used.push(INPUT_ALIASES[key]);
      });
      if (lines.length) record.method.prompt += (record.method.prompt ? '\n\n' : '') + '【评估输入】\n' + lines.join('\n');
      var refreshed = deriveEvidenceRequirements(record); record.inputSchema = refreshed.inputSchema; record.supportedTargets = refreshed.supportedTargets;
    }
    record.decision = newDecisionPolicy(record.decision, record.metrics);
    return record;
  }
  function deriveFlatEvidenceRequirements(draft) {
    var e = draft || {}, method = e.method || {}, variables = [], errors = [], fields = Object.create(null);
    function add(key, field) {
      if (!own(INPUT_ALIASES, key)) { problem(errors, field, '不支持输入变量「' + key + '」，可使用 {{actual}}、{{input}}、{{reference}}、{{messages}}、{{trajectory}}、{{taskDefinition}}、{{context}}'); return; }
      if (own(fields, key)) return; fields[key] = true;
      var canonicalKey = INPUT_ALIASES[key], item = { key: key, canonical: canonicalKey, label: INPUT_LABELS[canonicalKey] };
      if (canonicalKey === 'messages' || canonicalKey === 'trajectory') item.scope = 'selected_target'; variables.push(item);
    }
    if (method.type === 'llm_judge') {
      var prompt = text(method.prompt), expression = /\{\{([\s\S]*?)\}\}/g, match;
      while ((match = expression.exec(prompt))) add(match[1].trim(), 'method.prompt');
      if (/\{\{|\}\}/.test(prompt.replace(expression, ''))) problem(errors, 'method.prompt', '输入变量括号不完整，请使用 {{actual}} 这样的完整格式');
      if (!variables.length && !errors.length) problem(errors, 'method.prompt', '请在评判提示词中插入至少一个标准输入变量，例如 {{actual}}；系统不会从自然语言猜测所需数据');
    } else if (method.type === 'rule') {
      (Array.isArray(method.checks) ? method.checks : []).forEach(function (check, index) {
        ['inputPath', 'expectedPath'].forEach(function (field) {
          if (!own(check, field)) return;
          var path = check[field];
          if (typeof path !== 'string' || !/^\/(?:[^~\/]|~0|~1)*(?:\/(?:[^~\/]|~0|~1)*)*$/.test(path)) { problem(errors, 'method.checks.' + index + '.' + field, '规则输入须使用 /actual/field 这样的标准输入路径'); return; }
          add(path.slice(1).split('/')[0].replace(/~1/g, '/').replace(/~0/g, '~'), 'method.checks.' + index + '.' + field);
        });
      });
      if (!variables.length && !errors.length) problem(errors, 'method.checks', '规则须引用至少一个标准输入路径，例如 /actual');
    } else problem(errors, 'method', '请选择有效的评估方法');
    var properties = {}, scopes = {};
    variables.forEach(function (item) { properties[item.key] = inputType(item.canonical); if (item.scope) scopes[item.canonical] = item.scope; });
    var metadata = { version: 1, source: method.type === 'rule' ? 'rule_paths' : 'prompt_variables', variables: variables.map(function (v) { return { key: v.key, canonical: v.canonical }; }), contextScopes: scopes };
    var inputSchema = { type: 'object', properties: properties, required: variables.map(function (v) { return v.key; }), additionalProperties: false, 'x-aiops-evidence': metadata };
    return { ok: !errors.length, variables: variables, required: inputSchema.required.slice(), inputSchema: inputSchema, supportedTargets: TARGETS.slice(), errors: errors, error: errors.map(function (e) { return e.message; }).join('；') };
  }
  function compileItemPrompt(items) {
    return '逐项依据以下评估项标准读取真实证据并输出类型化结果。缺少本项证据时仅本项待确认；评分项必须逐子项输出0–100分，不得用总分反推子分。整体通过由运行系统计算。\n\n' + (items || []).map(function (item) {
      var lines = ['【评估项 ' + item.id + '｜' + item.name + '｜' + item.valueType + '】'];
      if (text(item.standard)) lines.push('共同说明：' + item.standard);
      if (item.valueType === 'boolean') { lines.push('True标准：' + (item.boolean && item.boolean.trueStandard || '')); lines.push('False标准：' + (item.boolean && item.boolean.falseStandard || '')); }
      else if (item.valueType === 'category') (item.categories || []).forEach(function (category) { lines.push('类别 ' + category.code + '｜' + category.label + '：' + (category.standard || '')); });
      else if (item.valueType === 'number') ((item.scoring || {}).items || []).forEach(function (part) { lines.push('评分子项 ' + item.id + '.' + part.id + '｜' + part.name + '：' + part.standard); });
      return lines.join('\n');
    }).join('\n\n');
  }
  function normalizeItemRecord(value) {
    var record = evaluatorDefinition(value);
    if (record.authoringMode == null) record.authoringMode = 'structured';
    record.metrics = (record.metrics || []).map(function (source) {
      var item = copy(source); delete item.rubric;
      if (item.valueType === 'number') { item.range = { min: 0, max: 100 }; item.scoring = Object.assign({ items: [], passThreshold: null }, item.scoring || {}); }
      return item;
    });
    var d = record.decision || {}, summary = d.summary || { type: 'all' };
    record.decision = { type: 'item_summary', policyVersion: 3, summary: summary.type === 'all' ? { type: 'all' } : { type: summary.type, minPassed: summary.minPassed }, missingEvidence: 'inconclusive' };
    record.aggregation = { type: 'none' }; record.method = { type: 'llm_judge', prompt: compileItemPrompt(record.metrics) }; return record;
  }
  function promptTemplateText(prompt) {
    var result = prompt.split(''), protectedPositions = Object.create(null), expression = /\{\{/g, match;
    // Explicit template openings remain templates even inside a valid JSON string.
    while ((match = expression.exec(prompt))) {
      var close = prompt.indexOf('}}', match.index + 2), end = close < 0 ? prompt.length : close + 2;
      for (var p = match.index; p < end; p++) protectedPositions[p] = true;
      expression.lastIndex = end;
    }
    for (var start = 0; start < prompt.length; start++) {
      if ('{['.indexOf(prompt[start]) < 0 || protectedPositions[start]) continue;
      var stack = [], quoted = false, escaped = false, finish = -1;
      for (var index = start; index < prompt.length; index++) {
        var character = prompt[index];
        if (quoted) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') quoted = false; continue; }
        if (character === '"') quoted = true;
        else if (character === '{' || character === '[') stack.push(character);
        else if (character === '}' || character === ']') { if (!stack.length || stack.pop() !== (character === '}' ? '{' : '[')) break; if (!stack.length) { finish = index; break; } }
      }
      if (finish < 0) continue;
      try { JSON.parse(prompt.slice(start, finish + 1)); } catch (_) { continue; }
      // JSON syntax braces and literal unmatched closing braces are not template delimiters.
      for (var position = start; position <= finish; position++) if (!protectedPositions[position] && (prompt[position] === '{' || prompt[position] === '}')) result[position] = ' ';
      start = finish;
    }
    return result.join('');
  }
  function promptMetric(prompt) {
    var standard = prompt;
    // This is a fixed platform default, not dependency inference from natural language.
    if (!/\{\{|\}\}/.test(promptTemplateText(prompt))) standard += '\n\n【平台默认评估输入】\n实际输出：{{actual}}';
    return { id: 'overall_verdict', name: '整体判定', valueType: 'boolean', standard: standard, boolean: { trueStandard: '证据明确满足用户评估标准时返回 True。', falseStandard: '证据明确违反用户评估标准时返回 False；缺少证据返回 null，不能当作 False。', passValue: true } };
  }
  function normalizePromptRecord(value) {
    var record = evaluatorDefinition(value), prompt = record.method && typeof record.method.prompt === 'string' ? record.method.prompt : '';
    record.authoringMode = 'prompt'; record.method = { type: 'llm_judge', prompt: prompt }; record.metrics = [promptMetric(prompt)];
    record.aggregation = { type: 'none' }; record.decision = { type: 'item_summary', policyVersion: 3, summary: { type: 'all' }, missingEvidence: 'inconclusive' };
    delete record.legacyConfiguration; delete record.migrationState; delete record.additionalPrompt;
    return record;
  }
  function compileV4Prompt(record) {
    var compiled = compileItemPrompt(record.metrics || []), itemText = compiled.slice(compiled.indexOf('\n\n') + 2);
    return '评分项直接返回依据本项标准评出的0–100原始分，不返回评分子项。权重与通过判定由运行系统计算。\n' + (text(record.additionalPrompt) ? '\n【补充背景】\n' + record.additionalPrompt + '\n\n' : '\n') + itemText;
  }
  function normalizeV4Record(value) {
    var record = evaluatorDefinition(value), original = record.decision || {}, mode = original.mode || 'item_count';
    record.authoringMode = record.authoringMode || 'structured'; record.metrics = (record.metrics || []).map(function (source) {
      var item = copy(source); delete item.rubric;
      if (item.valueType === 'number') { item.range = { min: 0, max: 100 }; item.scoring = Object.assign({ passThreshold: null }, item.scoring || {}); }
      if (mode !== 'weighted_score' || item.valueType === 'text') delete item.weight;
      return item;
    });
    record.decision = { type: 'evaluation_policy', policyVersion: 4, mode: mode, missingEvidence: 'inconclusive' };
    if (mode === 'weighted_score') record.decision.passThreshold = own(original, 'passThreshold') ? original.passThreshold : null;
    else if (mode === 'item_count') { var summary = original.summary || { type: 'all' }; record.decision.summary = summary.type === 'all' ? { type: 'all' } : { type: summary.type, minPassed: summary.minPassed }; }
    else if (mode === 'custom_prompt') record.decision.customPrompt = typeof original.customPrompt === 'string' ? original.customPrompt : '';
    record.aggregation = { type: 'none' }; record.method = { type: 'llm_judge', prompt: compileV4Prompt(record) }; return record;
  }
  function migrateV3ToV4(value) {
    var record = evaluatorDefinition(value), original = copy(record), issues = copy(record.migrationState && record.migrationState.issues || []), hasScores = (record.metrics || []).some(function (item) { return item.valueType === 'number'; });
    if (hasScores && !record.legacyConfiguration) record.legacyConfiguration = { sourceVersion: record.version || null, method: copy(record.method), metrics: copy(record.metrics || []), decision: copy(record.decision), aggregation: copy(record.aggregation) };
    (record.metrics || []).forEach(function (item) {
      if (item.valueType !== 'number') return;
      item.standard = ''; item.scoring = { passThreshold: item.scoring && item.scoring.passThreshold != null ? item.scoring.passThreshold : null };
      issues.push({ metricId: item.id, code: 'direct_score_standard_required', message: '旧评分子项、标准和权重已只读保留。请明确填写新的0–100直接评分标准并确认；旧子分不能替代新的直接评分。' });
    });
    if (hasScores) issues.push({ code: 'v4_policy_review', message: '请核对直接评分及整体通过判定，新版本不会改变任何旧发布版本。' });
    record.decision = { type: 'evaluation_policy', policyVersion: 4, mode: 'item_count', summary: copy(original.decision && original.decision.summary || { type: 'all' }), missingEvidence: 'inconclusive' };
    if (hasScores || record.migrationState) record.migrationState = { requiresReview: true, acknowledged: false, issues: issues }; return normalizeV4Record(record);
  }
  function migrateLegacyItems(value) {
    var original = evaluatorDefinition(value), prepared = prepareLegacyEvaluator(original), originalRules = decisionRules(original), issues = [];
    prepared.legacyConfiguration = { sourceVersion: original.version || null, method: copy(original.method), metrics: copy(original.metrics || []), decision: copy(original.decision), aggregation: copy(original.aggregation) };
    issues.push({ code: 'legacy_standard_review', message: '原整体标准已完整保留在各项说明中，请确认每项定义及通过标准。' });
    prepared.metrics = (original.metrics || []).map(function (old) {
      var item = copy(old), rules = originalRules.filter(function (r) { return r.metricId === old.id; }); delete item.rubric;
      if (old.description === old.rubric) delete item.description;
      item.standard = prepared.method.prompt;
      if (old.valueType === 'boolean') {
        var booleanRule = rules.length === 1 && ['equals', 'not_equals'].indexOf(rules[0].operator) >= 0 && typeof rules[0].value === 'boolean' ? rules[0] : null;
        item.boolean = { trueStandard: 'True 对应原评估标准中定义的 True 情形，请确认本项具体含义。', falseStandard: 'False 对应原评估标准中定义的 False 情形，请确认本项具体含义。', passValue: booleanRule ? booleanRule.operator === 'equals' ? booleanRule.value : !booleanRule.value : null };
        if (!booleanRule) issues.push({ metricId: old.id, code: 'boolean_pass_required', message: '原配置无法直接确定本项通过值，请明确选择 True 或 False。' });
      } else if (old.valueType === 'category') {
        var usable = rules.length && rules.every(function (r) { return ['equals', 'not_equals', 'in'].indexOf(r.operator) >= 0; });
        item.categories = (old.categories || []).map(function (category) { return { code: category.code, label: category.label, standard: category.standard || '原类别「' + category.label + '」，请结合保留的原标准确认该类别定义。', pass: usable ? rules.every(function (r) { return compare(category.code, r.operator, r.value) === true; }) : null }; });
        if (!usable) issues.push({ metricId: old.id, code: 'category_pass_required', message: '请为每个类别明确配置通过或未通过。' });
      } else if (old.valueType === 'number') {
        var threshold = rules.length === 1 && rules[0].operator === 'gte' && Number.isFinite(rules[0].value) && rules[0].value >= 0 && rules[0].value <= 100 ? rules[0].value : null;
        item.range = { min: 0, max: 100 }; item.scoring = { items: [], passThreshold: threshold };
        issues.push({ metricId: old.id, code: 'scoring_parts_required', message: '旧数值及条件已保留，请显式配置0–100分子项、权重和通过阈值；不能从旧总分反推子项。' });
      }
      return item;
    });
    if (original.aggregation && original.aggregation.type !== 'none') issues.push({ code: 'legacy_aggregate_review', message: '旧全局展示汇总已保留供核对，新结构只汇总单个评分项。' });
    if ((original.decision || {}).type === 'aggregate_threshold') issues.push({ code: 'legacy_aggregate_gate_review', message: '旧总分门槛不能自动等同于评估项通过数量，请明确重配。' });
    prepared.migrationState = { requiresReview: true, acknowledged: false, issues: issues };
    prepared.decision = { type: 'item_summary', policyVersion: 3, summary: { type: 'all' }, missingEvidence: 'inconclusive' };
    return normalizeItemRecord(prepared);
  }
  function prepareEvaluatorForEditing(value) {
    var record = evaluatorDefinition(value);
    if ((record.method || {}).type !== 'llm_judge') return prepareLegacyEvaluator(record);
    if (isPromptEvaluator(record)) return normalizePromptRecord(record);
    if (isV4Evaluator(record)) return normalizeV4Record(record);
    if (itemDefinition(record)) return migrateV3ToV4(record);
    if ((record.metrics || []).some(function (item) { return own(item, 'standard') || own(item, 'boolean') || own(item, 'scoring'); })) return normalizeV4Record(record);
    return migrateV3ToV4(migrateLegacyItems(record));
  }
  function defaultEvaluationPolicy(mode) {
    return mode==='custom_prompt'?{type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:'',missingEvidence:'inconclusive'}:{type:'evaluation_policy',policyVersion:4,mode:'weighted_score',passThreshold:80,missingEvidence:'inconclusive'};
  }
  function legacyCountPrompt(summary,kind) {
    var items=kind==='evaluator'?'评估项':'评估器',variable=kind==='evaluator'?'itemResults':'evaluatorResults',partial=summary && summary.type==='at_least';
    return '根据 {{'+variable+'}} 中各'+items+'的真实结果、理由与证据作最终判定。仅观察项不参与判定。\n'+(partial?'原配置要求至少 '+summary.minPassed+' 个参与判定的'+items+'通过。已明确通过数达到要求时通过；明确通过数加待确认数仍无法达到要求时未通过；其他情况保留待确认。':'原配置要求全部参与判定的'+items+'通过。全部明确通过时通过；任一明确未通过时未通过；其余缺证或执行异常保留待确认。')+'\n没有参与判定的'+items+'时仅记录观察，不自动通过。';
  }
  function prepareEvaluatorForAuthoring(value) {
    var record=prepareEvaluatorForEditing(value);
    if(!isPromptEvaluator(record)&&isV4Evaluator(record)&&record.decision.mode==='item_count') {
      if(!record.legacyConfiguration)record.legacyConfiguration={sourceVersion:record.version || null,method:copy(record.method),metrics:copy(record.metrics),decision:copy(record.decision),aggregation:copy(record.aggregation)};
      record.decision={type:'evaluation_policy',policyVersion:4,mode:'custom_prompt',customPrompt:legacyCountPrompt(record.decision.summary,'evaluator'),missingEvidence:'inconclusive'};
      record=normalizeV4Record(record);
    }
    return record;
  }
  function defaultCompositePolicy(mode,bindings) {
    var result={type:'composite_policy',policyVersion:1,mode:mode==='custom_prompt'?'custom_prompt':'weighted_score',missingEvidence:'inconclusive'};
    if(result.mode==='custom_prompt')result.customPrompt='';
    else {result.passThreshold=80;var gates=(bindings || []).filter(function(binding){return binding.role!=='observe';});result.weights=gates.map(function(binding){return {bindingId:binding.id,weight:1/gates.length};});}
    return result;
  }
  function prepareCompositePolicyForAuthoring(value) {
    if(value==null)return defaultCompositePolicy();
    var policy=compositePolicy(value);
    return policy.mode==='item_count'?{type:'composite_policy',policyVersion:1,mode:'custom_prompt',customPrompt:legacyCountPrompt(policy.summary,'composite'),missingEvidence:'inconclusive'}:policy;
  }
  function authoringPolicyErrors(record,kind) {
    var policy=kind==='job'?compositePolicy(record.passPolicy):record.decision || {};
    return (kind==='job'||!isPromptEvaluator(record)&&isV4Evaluator(record))&&['weighted_score','custom_prompt'].indexOf(policy.mode)<0?[{field:kind==='job'?'passPolicy':'decision',message:'当前通过判定只支持评分或自定义，请重新配置后保存。'}]:[];
  }
  function deriveItemEvidenceRequirements(draft) {
    var variables = [], variableKeys = Object.create(null), errors = [], itemRequirements = [];
    function parse(texts, field, requireVariable) {
      var parsed = deriveFlatEvidenceRequirements({ method: { type: 'llm_judge', prompt: texts.filter(function (value) { return typeof value === 'string'; }).join('\n') } });
      parsed.errors.forEach(function (error) { if (requireVariable || error.message.indexOf('插入至少一个标准输入变量') < 0) problem(errors, field, error.message); });
      parsed.variables.forEach(function (variable) { if (!own(variableKeys, variable.key)) { variableKeys[variable.key] = true; variables.push(variable); } });
      return { required: parsed.required, contextScopes: parsed.inputSchema['x-aiops-evidence'].contextScopes };
    }
    (draft.metrics || []).forEach(function (item, index) {
      var texts = [item.standard], path = 'metrics.' + index, requirement;
      if (item.valueType === 'boolean') texts = texts.concat([item.boolean && item.boolean.trueStandard, item.boolean && item.boolean.falseStandard]);
      if (item.valueType === 'category') texts = texts.concat((item.categories || []).map(function (category) { return category.standard; }));
      if (item.valueType === 'number') {
        var parts = (item.scoring || {}).items || [], allTexts = texts.concat(parts.map(function (part) { return part.standard; })); parse(allTexts, path + '.standard', true);
        requirement = parse(texts, path + '.standard', false); requirement.subItems = parts.map(function (part, partIndex) { var deps = parse(texts.concat([part.standard]), path + '.scoring.items.' + partIndex + '.standard', true); return { id: part.id, required: deps.required, contextScopes: deps.contextScopes }; });
      } else requirement = parse(texts, path + '.standard', true);
      itemRequirements.push(Object.assign({ metricId: item.id }, requirement));
    });
    var properties = {}, scopes = {}; variables.forEach(function (v) { properties[v.key] = inputType(v.canonical); if (v.scope) scopes[v.canonical] = v.scope; });
    var metadata = { version: 2, source: 'item_standards', variables: variables.map(function (v) { return { key: v.key, canonical: v.canonical }; }), contextScopes: scopes, itemRequirements: itemRequirements };
    var inputSchema = { type: 'object', properties: properties, required: [], additionalProperties: false, 'x-aiops-evidence': metadata };
    return { ok: !errors.length, variables: variables, required: [], inputSchema: inputSchema, supportedTargets: TARGETS.slice(), itemRequirements: itemRequirements, errors: errors, error: errors.map(function (e) { return e.message; }).join('；') };
  }
  function derivePromptEvidenceRequirements(draft) {
    var record = normalizePromptRecord(draft); record.metrics[0].standard = promptTemplateText(record.metrics[0].standard);
    return deriveItemEvidenceRequirements(record);
  }
  function deriveV4EvidenceRequirements(draft) {
    var variables = [], known = Object.create(null), errors = [], itemRequirements = [], finalRequirements = null;
    function parse(texts, field, requireVariable, finalStage) {
      var prompt = texts.filter(function (value) { return typeof value === 'string'; }).join('\n');
      if (finalStage) prompt = prompt.replace(/\{\{\s*itemResults\s*\}\}/g, '');
      var parsed = deriveFlatEvidenceRequirements({ method: { type: 'llm_judge', prompt: prompt } });
      parsed.errors.forEach(function (error) { if (requireVariable || error.message.indexOf('插入至少一个标准输入变量') < 0) problem(errors, field, error.message); });
      parsed.variables.forEach(function (variable) { if (!own(known, variable.key)) { known[variable.key] = true; variables.push(variable); } });
      return { required: parsed.required, contextScopes: parsed.inputSchema['x-aiops-evidence'].contextScopes };
    }
    var shared = typeof draft.additionalPrompt === 'string' ? promptTemplateText(draft.additionalPrompt) : '';
    var sharedRequirement = parse([shared], 'additionalPrompt', false, false);
    (draft.metrics || []).forEach(function (item, index) {
      var standards = [shared, item.standard];
      if (item.valueType === 'boolean') standards = standards.concat([item.boolean && item.boolean.trueStandard, item.boolean && item.boolean.falseStandard]);
      if (item.valueType === 'category') standards = standards.concat((item.categories || []).map(function (category) { return category.standard; }));
      itemRequirements.push(Object.assign({ metricId: item.id }, parse(standards, 'metrics.' + index + '.standard', true, false)));
    });
    if ((draft.decision || {}).mode === 'custom_prompt') {
      var final = parse([promptTemplateText(draft.decision.customPrompt || '')], 'decision.customPrompt', false, true);
      finalRequirements = { computed: ['itemResults'], required: ['itemResults'].concat(unique(sharedRequirement.required.concat(final.required))), contextScopes: Object.assign({}, sharedRequirement.contextScopes, final.contextScopes) };
    }
    var properties = {}, scopes = {};
    variables.forEach(function (variable) { properties[variable.key] = inputType(variable.canonical); if (variable.scope) scopes[variable.canonical] = variable.scope; });
    var metadata = { version: 3, source: 'evaluation_policy', variables: variables.map(function (v) { return { key: v.key, canonical: v.canonical }; }), contextScopes: scopes, itemRequirements: itemRequirements };
    if (finalRequirements) metadata.finalRequirements = finalRequirements;
    var schema = { type: 'object', properties: properties, required: [], additionalProperties: false, 'x-aiops-evidence': metadata };
    return { ok: !errors.length, variables: variables, required: [], inputSchema: schema, supportedTargets: TARGETS.slice(), itemRequirements: itemRequirements, finalRequirements: finalRequirements, errors: errors, error: errors.map(function (e) { return e.message; }).join('；') };
  }
  function deriveEvidenceRequirements(draft) { return isPromptEvaluator(draft) ? derivePromptEvidenceRequirements(draft) : isV4Evaluator(draft) ? deriveV4EvidenceRequirements(draft) : itemDefinition(draft) ? deriveItemEvidenceRequirements(draft) : deriveFlatEvidenceRequirements(draft); }
  function validateV4Evaluator(e) {
    var errors = [], items = Array.isArray(e.metrics) ? e.metrics : [], ids = items.map(function (item) { return item.id; }), d = e.decision || {};
    if (!text(e.name)) problem(errors, 'name', '请填写评估器名称'); if (!text(e.description)) problem(errors, 'description', '请填写评估器描述');
    if (e.authoringMode !== 'structured' || !e.method || e.method.type !== 'llm_judge') problem(errors, 'authoringMode', '此配置使用详细 LLM 评估，规则与提示词配置保留各自原有契约');
    if (e.additionalPrompt != null && typeof e.additionalPrompt !== 'string') problem(errors, 'additionalPrompt', '补充提示词须为文本，可留空');
    if (!items.length || unique(ids).length !== ids.length) problem(errors, 'metrics', '请添加至少一个编号不重复的评估项');
    items.forEach(function (item, index) {
      var field = 'metrics.' + index;
      if (!text(item.id) || !text(item.name) || ['boolean', 'category', 'number', 'text'].indexOf(item.valueType) < 0) problem(errors, field, '请填写评估项编号、名称和类型');
      if (item.standard != null && typeof item.standard !== 'string') problem(errors, field + '.standard', '评估标准须为文本');
      if (item.description != null && typeof item.description !== 'string') problem(errors, field + '.description', '评估项说明须为文本，可留空');
      if (item.valueType === 'boolean' && (!item.boolean || !text(item.boolean.trueStandard) || !text(item.boolean.falseStandard) || typeof item.boolean.passValue !== 'boolean')) problem(errors, field + '.boolean', '请定义 True、False 标准并明确通过值');
      if (item.valueType === 'category') { var categories = item.categories || []; if (categories.length < 2 || unique(categories.map(function (c) { return c.code; })).length !== categories.length || categories.some(function (c) { return !text(c.code) || !text(c.label) || !text(c.standard) || typeof c.pass !== 'boolean'; })) problem(errors, field + '.categories', '请设置不同类别的定义及各类别是否通过'); }
      if (item.valueType === 'number' && (!text(item.standard) || !item.scoring || Object.keys(item.scoring).some(function (key) { return key !== 'passThreshold'; }) || !Number.isFinite(item.scoring.passThreshold) || item.scoring.passThreshold < 0 || item.scoring.passThreshold > 100 || canonical(item.range) !== canonical({ min: 0, max: 100 }))) problem(errors, field + '.scoring', '评分项须有明确的直接0–100分标准和本项通过阈值，不再设置评分子项');
      if (item.valueType === 'text' && !text(item.standard)) problem(errors, field + '.standard', '请填写文本观察标准');
    });
    if (d.type !== 'evaluation_policy' || d.policyVersion !== 4 || ['weighted_score', 'item_count', 'custom_prompt'].indexOf(d.mode) < 0 || d.missingEvidence !== 'inconclusive') problem(errors, 'decision', '请选择有效的整体通过判定方式');
    var decidable = items.filter(function (item) { return item.valueType !== 'text'; });
    if (d.mode === 'weighted_score' && (!decidable.length || decidable.some(function (item) { return !Number.isFinite(item.weight) || item.weight <= 0 || item.weight > 1; }) || Math.abs(decidable.reduce(function (sum, item) { return sum + item.weight; }, 0) - 1) > 1e-8 || !Number.isFinite(d.passThreshold) || d.passThreshold < 0 || d.passThreshold > 100)) problem(errors, 'decision', '加权判定须有非文本评估项，所有参与项权重为正且合计1，整体通过阈值为0–100');
    if (d.mode === 'item_count') { var summary = d.summary || {}; if (['all', 'at_least'].indexOf(summary.type) < 0 || summary.type === 'at_least' && (!Number.isInteger(summary.minPassed) || summary.minPassed < 1 || summary.minPassed > decidable.length)) problem(errors, 'decision.summary', '通过项数须为全部或1至可判定项数量，文本不计入'); }
    if (d.mode === 'custom_prompt' && !text(d.customPrompt)) problem(errors, 'decision.customPrompt', '请填写基于真实评估项结果的自定义整体判定提示词');
    if (e.migrationState && e.migrationState.requiresReview && e.migrationState.acknowledged !== true) problem(errors, 'migrationState', '请核对保留的历史配置，完成直接评分及整体通过规则重配，并明确确认');
    if (canonical(e.aggregation) !== canonical({ type: 'none' })) problem(errors, 'aggregation', '整体加权由通过判定统一计算，不维护另一份汇总配置');
    var derived = deriveV4EvidenceRequirements(e); errors = errors.concat(derived.errors);
    if (canonical(e.inputSchema) !== canonical(derived.inputSchema)) problem(errors, 'inputSchema', '系统证据契约与评估项或整体判定不一致，请保存后重新生成');
    if (!e.method || e.method.prompt !== compileV4Prompt(e)) problem(errors, 'method.prompt', '运行提示词由详细标准及补充提示词生成，不能分开维护');
    if (canonical((e.supportedTargets || []).slice().sort()) !== canonical(TARGETS.slice().sort())) problem(errors, 'supportedTargets', '实际对象由实验或任务选择，详细评估器保持通用');
    return errors;
  }
  function validateItemEvaluator(e) {
    var errors = [], items = Array.isArray(e.metrics) ? e.metrics : [], ids = items.map(function (item) { return item.id; });
    if (!text(e.name)) problem(errors, 'name', '请填写评估器名称'); if (!text(e.description)) problem(errors, 'description', '请填写评估器描述');
    if (e.authoringMode != null && ['structured', 'prompt'].indexOf(e.authoringMode) < 0) problem(errors, 'authoringMode', '请选择详细配置或提示词配置');
    if (!e.method || e.method.type !== 'llm_judge') problem(errors, 'method', '评估项结构当前用于 LLM 评估；规则校验继续使用原显式 checks');
    if (e.aggregation && e.aggregation.type !== 'none') problem(errors, 'aggregation', '新结构不维护全局数值汇总，只在评分项内按子项权重计算');
    if (!items.length || unique(ids).length !== ids.length) problem(errors, 'metrics', '请添加至少一个编号不重复的评估项');
    items.forEach(function (item, index) {
      var path = 'metrics.' + index;
      if (!text(item.id) || !text(item.name) || ['boolean', 'category', 'number', 'text'].indexOf(item.valueType) < 0) problem(errors, path, '请填写评估项编号、名称和类型');
      if (item.standard != null && typeof item.standard !== 'string') problem(errors, path + '.standard', '共同说明须为文本，可留空');
      if (item.description != null && typeof item.description !== 'string') problem(errors, path + '.description', '评估项说明须为文本，可留空');
      if (item.valueType === 'boolean' && (!item.boolean || !text(item.boolean.trueStandard) || !text(item.boolean.falseStandard) || typeof item.boolean.passValue !== 'boolean')) problem(errors, path + '.boolean', '请定义 True、False 的标准并明确选择通过值');
      if (item.valueType === 'category') {
        var categories = item.categories || [];
        if (categories.length < 2 || unique(categories.map(function (c) { return c.code; })).length !== categories.length || categories.some(function (c) { return !text(c.code) || !text(c.label) || !text(c.standard) || typeof c.pass !== 'boolean'; })) problem(errors, path + '.categories', '至少配置两个不同类别，并填写定义及各类别是否通过');
      }
      if (item.valueType === 'number') {
        var scoring = item.scoring || {}, parts = scoring.items || [];
        if (!parts.length || unique(parts.map(function (p) { return p.id; })).length !== parts.length || parts.some(function (p) { return !text(p.id) || !text(p.name) || !text(p.standard) || !Number.isFinite(p.weight) || p.weight <= 0 || p.weight > 1; }) || Math.abs(parts.reduce(function (sum, p) { return sum + p.weight; }, 0) - 1) > 1e-8) problem(errors, path + '.scoring.items', '评分须配置标准明确的子项，权重为正数且合计 1，每个子项按0–100分评估');
        if (!Number.isFinite(scoring.passThreshold) || scoring.passThreshold < 0 || scoring.passThreshold > 100) problem(errors, path + '.scoring.passThreshold', '请设置0–100分内的本项通过阈值');
      }
      if (item.valueType === 'text' && !text(item.standard)) problem(errors, path + '.standard', '请填写文本观察标准，文本项仅观察');
    });
    var d = e.decision || {}, summary = d.summary || {}, count = items.filter(function (item) { return item.valueType !== 'text'; }).length;
    if (d.type !== 'item_summary' || d.policyVersion !== 3 || d.missingEvidence !== 'inconclusive' || ['all', 'at_least'].indexOf(summary.type) < 0) problem(errors, 'decision', '请选择全部通过或至少若干项通过的汇总规则');
    if (summary.type === 'at_least' && (!Number.isInteger(summary.minPassed) || summary.minPassed < 1 || summary.minPassed > count)) problem(errors, 'decision.summary.minPassed', '至少通过项数须为1至可判定评估项数量，不能自动降低门槛');
    if (e.migrationState && e.migrationState.requiresReview && e.migrationState.acknowledged !== true) problem(errors, 'migrationState', '请参照保留的历史标准和条件完成重配，并明确确认迁移');
    var derived = isPromptEvaluator(e) ? derivePromptEvidenceRequirements(e) : deriveItemEvidenceRequirements(e); errors = errors.concat(derived.errors);
    if (!e.inputSchema || canonical(e.inputSchema) !== canonical(derived.inputSchema)) problem(errors, 'inputSchema', '系统证据契约与各评估项标准不一致，请保存后重新生成');
    if (isPromptEvaluator(e)) {
      if (!e.method || !text(e.method.prompt)) problem(errors, 'method.prompt', '请填写评估提示词');
      if (!e.method || canonical(items) !== canonical([promptMetric(e.method.prompt || '')]) || canonical(e.decision) !== canonical({ type: 'item_summary', policyVersion: 3, summary: { type: 'all' }, missingEvidence: 'inconclusive' }) || canonical(e.aggregation) !== canonical({ type: 'none' })) problem(errors, 'metrics', '提示词配置使用系统固定的整体判定契约，请保存后重新生成');
    } else if (!e.method || e.method.prompt !== compileItemPrompt(items)) problem(errors, 'method.prompt', '全局提示词由各项标准生成，不能与评估项标准分离维护');
    if (canonical((e.supportedTargets || []).slice().sort()) !== canonical(TARGETS.slice().sort())) problem(errors, 'supportedTargets', '实际对象由实验或任务选择，评估项契约应保持通用');
    return errors;
  }
  function deriveEvaluatorContract(draft) {
    var record = prepareEvaluatorForEditing(draft), derived = deriveEvidenceRequirements(record);
    record.supportedTargets = derived.supportedTargets; record.inputSchema = derived.inputSchema;
    return { ok: derived.ok, record: record, requirements: derived.variables, errors: derived.errors, error: derived.error };
  }
  function validateEvaluator(draft, options) {
    if (!(options && options.preserveContract)) { var derived = deriveEvaluatorContract(draft); return derived.errors.concat(validateEvaluator(derived.record, { preserveContract: true })); }
    if (isV4Evaluator(draft)) return validateV4Evaluator(draft);
    if (itemDefinition(draft)) return validateItemEvaluator(draft);
    var errors = [], e = draft || {}, metrics = Array.isArray(e.metrics) ? e.metrics : [], ids = metrics.map(function (m) { return m.id; });
    if (e.authoringMode != null && ['structured', 'prompt'].indexOf(e.authoringMode) < 0) problem(errors, 'authoringMode', '请选择详细配置或提示词配置');
    if (isPromptEvaluator(e)) problem(errors, 'authoringMode', '提示词配置仅支持 LLM 整体判定，规则校验继续使用显式 checks');
    if (!text(e.name)) problem(errors, 'name', '请填写评估器名称');
    if (!text(e.description)) problem(errors, 'description', '请填写评估器描述');
    if (!Array.isArray(e.supportedTargets) || !e.supportedTargets.length || e.supportedTargets.some(function (t) { return TARGETS.indexOf(t) < 0; })) problem(errors, 'supportedTargets', '请选择有效的评估对象');
    if (!e.inputSchema || e.inputSchema.type !== 'object' || !e.inputSchema.properties || !Array.isArray(e.inputSchema.required) || e.inputSchema.required.some(function (key) { return !own(e.inputSchema.properties, key); })) problem(errors, 'inputSchema', '输入契约须声明对象字段及必需字段');
    if (e.inputSchema && e.inputSchema['x-aiops-evidence']) {
      var inferred = deriveEvidenceRequirements(e);
      if (inferred.ok && canonical(inferred.inputSchema) !== canonical(e.inputSchema)) problem(errors, 'inputSchema', '系统证据契约与评估定义不一致，请保存新版本重新生成');
      if (canonical((e.supportedTargets || []).slice().sort()) !== canonical(TARGETS.slice().sort())) problem(errors, 'supportedTargets', '系统适用范围须保持通用；实际评估对象由实验或任务选择');
    }
    if (!metrics.length || unique(ids).length !== ids.length) problem(errors, 'metrics', '至少配置一个指标，且指标 ID 不得重复');
    metrics.forEach(function (m, index) {
      if (!text(m.id) || !text(m.name) || ['number', 'boolean', 'category', 'text'].indexOf(m.valueType) < 0) problem(errors, 'metrics.' + index, '请填写指标 ID、名称和输出类型');
      if (own(m, 'description') && m.description !== undefined && typeof m.description !== 'string') problem(errors, 'metrics.' + index + '.description', '指标说明须为文本，可留空');
      if (m.range && (m.valueType !== 'number' || !Number.isFinite(m.range.min) || !Number.isFinite(m.range.max) || m.range.min >= m.range.max)) problem(errors, 'metrics.' + index + '.range', '分数范围须为有效的数值区间');
      if (m.valueType === 'category' && (!Array.isArray(m.categories) || m.categories.length < 2 || m.categories.some(function (c) { return !text(c.code) || !text(c.label); }) || unique(m.categories.map(function (c) { return c.code; })).length !== m.categories.length)) problem(errors, 'metrics.' + index + '.categories', '分类指标至少设置两个不重复的枚举值');
    });
    var method = e.method || {};
    if (method.type === 'rule' && metrics.some(function (m) { return !!m.scoring; })) problem(errors, 'method', '规则校验继续使用原显式 checks，当前不支持评分子项执行');
    if (['llm_judge', 'rule'].indexOf(method.type) < 0) problem(errors, 'method', '请选择 LLM Judge 或规则评估');
    if (method.type === 'llm_judge' && !text(method.prompt)) problem(errors, 'method', '请填写评估提示词');
    if (method.type === 'rule') {
      if (!Array.isArray(method.checks) || !method.checks.length) problem(errors, 'method.checks', '请添加至少一个显式规则');
      var checkIds = (method.checks || []).map(function (c) { return c.metricId; });
      if (unique(checkIds).length !== checkIds.length || ids.some(function (id) { return checkIds.indexOf(id) < 0; })) problem(errors, 'method.checks', '每个指标须且仅须对应一条显式规则');
      (method.checks || []).forEach(function (check) {
        var m = metrics.filter(function (item) { return item.id === check.metricId; })[0];
        if (!m || !/^\//.test(check.inputPath || '') || ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists'].indexOf(check.operator) < 0 || !metricValue(m, check.onTrue) || !metricValue(m, check.onFalse)) problem(errors, 'method.checks', '规则路径、操作符或指标输出不合法');
        if (check.operator !== 'exists' && own(check, 'expected') === own(check, 'expectedPath')) problem(errors, 'method.checks', '比较规则须指定一个固定值或输入路径');
      });
    }
    var aggregation = e.aggregation || {}, weights = aggregation.weights || [];
    if (['none', 'weighted_mean'].indexOf(aggregation.type) < 0) problem(errors, 'aggregation', '请选择汇总方式');
    if (aggregation.type === 'weighted_mean' && (!weights.length || unique(weights.map(function (w) { return w.metricId; })).length !== weights.length || Math.abs(weights.reduce(function (sum, w) { return sum + w.weight; }, 0) - 1) > 1e-8 || weights.some(function (w) { return !Number.isFinite(w.weight) || w.weight <= 0 || !metrics.some(function (m) { return m.id === w.metricId && m.valueType === 'number'; }); }))) problem(errors, 'aggregation', '加权汇总仅支持数值指标，权重须为正数且合计 1');
    var decision = e.decision || {}, rules = decision.rules || [], typedPolicy = decision.policyVersion === 2;
    if (['all_rules', 'boolean_equals', 'category_in', 'aggregate_threshold', 'none'].indexOf(decision.type) < 0 || decision.missingEvidence !== 'inconclusive') problem(errors, 'decision', '请选择通过策略；缺少必需证据固定为无法判定');
    if (typedPolicy && ['all_rules', 'none'].indexOf(decision.type) < 0) problem(errors, 'decision', decision.type === 'aggregate_threshold' ? decisionMigrationStatus(e).message : '请选择指标通过条件，或明确选择仅观察');
    if (typedPolicy && decision.type === 'all_rules' && (!Array.isArray(decision.rules) || rules.some(function (rule) { return !rule || typeof rule !== 'object' || !validTypedCondition(metrics.filter(function (m) { return m.id === rule.metricId; })[0], rule); }))) problem(errors, 'decision.rules', '通过条件须匹配指标类型：布尔取值、数值比较或闭区间、分类集合；文本指标仅观察');
    if (!typedPolicy && decision.type === 'all_rules' && (!rules.length || rules.some(function (rule) {
      var metric = metrics.filter(function (m) { return m.id === rule.metricId; })[0];
      return !metric || ['equals', 'not_equals', 'gt', 'gte', 'lt', 'lte', 'in'].indexOf(rule.operator) < 0 || (['gt', 'gte', 'lt', 'lte'].indexOf(rule.operator) >= 0 && (metric.valueType !== 'number' || !Number.isFinite(rule.value))) || (rule.operator === 'in' ? !Array.isArray(rule.value) || !rule.value.length || rule.value.some(function (value) { return !metricValue(metric, value); }) : !metricValue(metric, rule.value));
    }))) problem(errors, 'decision.rules', '通过规则引用了无效指标、操作符或比较值');
    if (!typedPolicy && decision.type === 'boolean_equals' && (typeof decision.value !== 'boolean' || !metrics.some(function (m) { return m.id === decision.metricId && m.valueType === 'boolean'; }))) problem(errors, 'decision', '布尔策略须引用布尔指标并指定通过值');
    if (!typedPolicy && decision.type === 'category_in' && (!Array.isArray(decision.values) || !decision.values.length || !metrics.some(function (m) { return m.id === decision.metricId && m.valueType === 'category' && decision.values.every(function (value) { return metricValue(m, value); }); }))) problem(errors, 'decision', '分类策略须指定有效的通过类别');
    if (!typedPolicy && decision.type === 'aggregate_threshold' && (aggregation.type !== 'weighted_mean' || !Number.isFinite(decision.threshold) || ['gt', 'gte', 'lt', 'lte'].indexOf(decision.operator) < 0)) problem(errors, 'decision', '总分阈值策略须配置数值汇总、操作符和阈值');
    return errors;
  }
  function tasks() {
    var supplied = host.businessTasks ? host.businessTasks() : global.AIOpsEvaluation && global.AIOpsEvaluation.taskCatalog ? global.AIOpsEvaluation.taskCatalog() : [];
    return copy(supplied || []).map(function (task) {
      task.sceneId = task.sceneId || task.scene || '';
      task.dimensions = (task.dimensions || []).map(function (dimension) { dimension.id = dimension.id || 'DIM-' + digest(dimension.name || '').slice(0, 12); return dimension; }); return task;
    });
  }
  function resolve(state, id, version) {
    var record = state.evaluators.filter(function (item) { return item.id === id; })[0]; if (!record) return null;
    if (!version) return record;
    return (record.versions || []).filter(function (item) { return item.version === version; })[0] || null;
  }
  function normalizedContext(context) {
    context = copy(context || {}); context.target = context.target || { type: 'case_output', id: 'preview', output: own(context, 'actual') ? context.actual : context.output };
    if (!own(context.target, 'output') && own(context, 'output')) context.target.output = context.output;
    if (!context.case && own(context, 'expected')) context.case = { expected: context.expected };
    if (!own(context.target, 'reference') && own(context, 'reference')) context.target.reference = context.reference;
    context.target.type = context.target.type || 'case_output'; context.target.id = context.target.id || 'preview';
    context.target.snapshotId = context.target.snapshotId || 'SNAP-' + digest(context.target).slice(0, 20); return context;
  }
  function defaultInputMapping(evaluator, targetType) {
    var mapping = {}, referencePath = targetType === 'case_output' ? '/case/expected' : '/target/reference', paths = { actual: '/target/output', output: '/target/output', answer: '/target/output', input: '/target/input', taskDefinition: '/task', task: '/task', messages: '/target/messages', trajectory: '/target/trajectory', context: '/target/context', reference: referencePath, expected: referencePath };
    Object.keys(evaluator && evaluator.inputSchema && evaluator.inputSchema.properties || {}).forEach(function (key) { if (own(paths, key)) mapping[key] = paths[key]; }); return mapping;
  }
  function automaticBinding(binding, evaluator, online) {
    var result = copy(binding || {}), standard = defaultInputMapping(evaluator, result.targetType);
    result.inputMapping = online ? standard : Object.assign(standard, result.inputMapping || {});
    // Online reference data must come from explicitly supplied reference evidence, never the answer itself.
    if (result.targetType !== 'case_output' && evaluator && evaluator.inputSchema) ['reference', 'expected'].forEach(function (key) { if (own(evaluator.inputSchema.properties || {}, key)) result.inputMapping[key] = '/target/reference'; });
    return result;
  }
  function completenessErrors(evaluator, target) {
    var metadata = evaluator.inputSchema && evaluator.inputSchema['x-aiops-evidence'], errors = [];
    if (!metadata || metadata.version !== 1) return errors;
    var coverage = target.evidenceCompleteness || {};
    Object.keys(metadata.contextScopes || {}).forEach(function (key) {
      var value = coverage[key], compatibleType = !coverage.targetType || coverage.targetType === target.type;
      var complete = value === 'complete' || value === 'full_target' || value === 'full_execution' || value === 'full_conversation' && target.type === 'session' || value === 'single_turn' && ['trace', 'case_output'].indexOf(target.type) >= 0 || value === 'single_span' && target.type === 'span';
      if (!compatibleType || !complete) problem(errors, 'input.' + key, INPUT_LABELS[key] + '缺少相对于当前评估对象的完整证据，不能用其他粒度的局部记录代替');
    }); return errors;
  }
  function evidenceIdentity(target) {
    var result = {}; ['type', 'id', 'sessionId', 'agentId', 'input', 'output', 'reference', 'context', 'messages', 'trajectory', 'completion', 'completed', 'error', 'spanType', 'sourceModel', 'evidenceCompleteness'].forEach(function (key) { if (own(target, key)) result[key] = target[key]; }); return result;
  }
  function assessmentIdentity(jobId, binding, evaluator, target, task, judgeRuntime) {
    var mapped = {}, mapping = Object.assign(defaultInputMapping(evaluator, binding.targetType), binding.inputMapping || {}), source = { target: target, task: task };
    Object.keys(mapping).forEach(function (key) { var value = pointer(source, mapping[key]); if (value !== undefined) mapped[key] = value; });
    var config = copy(binding); delete config.inputMapping;
    var runtime = evaluator.method.type === 'llm_judge' ? normalizeJudgeRuntime(judgeRuntime, evaluator.method) : null;
    var evidence = evidenceIdentity(target), contract = evaluator.inputSchema && evaluator.inputSchema['x-aiops-evidence'];
    if (!contract || !Object.keys(contract.contextScopes || {}).length) delete evidence.evidenceCompleteness;
    return digest({ jobId: jobId, binding: config, evaluator: gradingDefinition(evaluator), judgeRuntime: runtime, target: evidence, task: task || null, inputs: mapped });
  }
  function bindingErrors(binding, context, evaluator, skipInput) {
    var errors = [], e = evaluator, b = automaticBinding(binding, e, false);
    if (!text(b.id)) problem(errors, 'id', '绑定须有稳定 ID');
    if (!e || !b.evaluatorRef || e.id !== b.evaluatorRef.id || e.version !== b.evaluatorRef.version) problem(errors, 'evaluatorRef', '绑定须引用存在的已发布评估器版本');
    if (['gate', 'observe'].indexOf(b.role) < 0) problem(errors, 'role', '请选择阻断判定或仅观察');
    if (TARGETS.indexOf(b.targetType) < 0 || e && (e.supportedTargets || []).indexOf(b.targetType) < 0) problem(errors, 'targetType', '评估器不支持该评估对象');
    if (e && b.role === 'gate' && !hasDecision(e)) problem(errors, 'role', '无通过策略的评估器只能用于观察');
    var mapping = b.inputMapping || {}, props = e && e.inputSchema && e.inputSchema.properties || {};
    if (e && ((e.inputSchema || {}).required || []).some(function (key) { return !own(mapping, key); })) problem(errors, 'inputMapping', '须映射全部必需输入');
    Object.keys(mapping).forEach(function (key) { if (!own(props, key) || typeof mapping[key] !== 'string' || !/^(?:\/(?:[^~\/]|~0|~1)*)*$/.test(mapping[key])) problem(errors, 'inputMapping', '输入映射须引用已声明变量并使用 JSON Pointer'); });
    var dimensions = b.dimensionMappings || [];
    if (!Array.isArray(dimensions) || dimensions.some(function (m) { return !e || !(e.metrics || []).some(function (metric) { return metric.id === m.metricId; }); })) problem(errors, 'dimensionMappings', '维度绑定引用了不存在的指标');
    if (Array.isArray(dimensions) && unique(dimensions.map(function (m) { return m.dimensionId; })).length !== dimensions.length) problem(errors, 'dimensionMappings', '同一绑定内业务维度不能重复');
    if (dimensions.length && !b.taskRef) problem(errors, 'taskRef', '维度映射须指定业务任务版本');
    if (b.taskRef) {
      var task = context && context.task || tasks().filter(function (item) { return item.id === b.taskRef.id && item.version === b.taskRef.version; })[0];
      if (!task || task.id !== b.taskRef.id || task.version !== b.taskRef.version || dimensions.some(function (m) { return !(task.dimensions || []).some(function (d) { return d.id === m.dimensionId; }); })) problem(errors, 'taskRef', '业务任务版本或维度已不存在，请重新绑定');
    }
    if (context && e && !skipInput && !itemDefinition(e) && !isV4Evaluator(e)) {
      var source = normalizedContext(context), input = {};
      Object.keys(mapping).forEach(function (key) { var value = pointer(source, mapping[key]); if (value !== undefined) input[key] = value; });
      if ((e.inputSchema.required || []).some(function (key) { return !content(input[key]); }) || !typeMatches(input, e.inputSchema)) problem(errors, 'input', '必需输入缺失或不符合输入契约');
      errors = errors.concat(completenessErrors(e, source.target));
    }
    return errors;
  }
  function validateBinding(binding, context, options) {
    var loaded = read(); if (!loaded.ok) return [{ field: 'storage', message: loaded.error }];
    var ref = binding && binding.evaluatorRef; return bindingErrors(binding, context, ref && resolve(loaded.state, ref.id, ref.version), options && options.skipInput);
  }
  function headSnapshot(record) { var result = copy(record); delete result.versions; delete result.enabled; return result; }
  function versionNumber(value) { return Number(String(value || '').replace(/^V/, '')) || 0; }
  function saveEvaluator(draft, id, options) {
    var derived = deriveEvaluatorContract(draft); draft = derived.record;
    var errors = derived.errors.concat(validateEvaluator(draft, { preserveContract: true }),options && options.historicalImport?[]:authoringPolicyErrors(draft,'evaluator')); if (errors.length) return fail(errors);
    return transact(function (state) {
      var prior = id ? resolve(state, id) : null; if (id && !prior) return { ok: false, error: '评估器不存在' };
      var record = copy(draft), at = clock(), versions = prior ? copy(prior.versions || []) : [];
      delete record.legacyConfiguration; delete record.migrationState;
      record.id = prior ? prior.id : 'UE-' + digest([at, state.revision, draft.name]).slice(0, 16);
      record.version = prior && prior.versionStatus === 'draft' ? prior.version : 'V' + (versions.reduce(function (max, item) { return Math.max(max, versionNumber(item.version)); }, 0) + 1);
      record.schemaVersion = '1.0'; record.status = record.status === 'disabled' ? 'disabled' : 'active'; record.enabled = record.status === 'active'; record.versionStatus = 'draft'; record.tags = record.tags || [];
      record.versions = versions; record.createdAt = prior ? prior.createdAt : at; record.updatedAt = at;
      if (prior) state.evaluators[state.evaluators.indexOf(prior)] = record; else state.evaluators.unshift(record);
      return { ok: true, record: record };
    });
  }
  function publishEvaluator(id, options) { return transact(function (state) {
    var e = resolve(state, id); if (!e) return { ok: false, error: '评估器不存在' };
    if (e.versionStatus === 'published') return { ok: true, record: e, noWrite: true };
    var derived = deriveEvaluatorContract(e), errors = derived.errors.concat(validateEvaluator(derived.record, { preserveContract: true }),options && options.historicalImport?[]:authoringPolicyErrors(derived.record,'evaluator')); if (errors.length) return fail(errors);
    var clean = derived.record; delete clean.legacyConfiguration; delete clean.migrationState; state.evaluators[state.evaluators.indexOf(e)] = clean; e = clean;
    if (e.versions.some(function (v) { return v.version === e.version; })) return { ok: false, error: '已发布版本不可覆盖' };
    e.versionStatus = 'published'; e.updatedAt = clock(); e.versions.push(headSnapshot(e)); return { ok: true, record: e };
  }); }
  function setEvaluatorEnabled(id, enabled) { return transact(function (state) { var e = resolve(state, id); if (!e) return { ok: false, error: '评估器不存在' }; e.status = enabled ? 'active' : 'disabled'; e.enabled = !!enabled; e.updatedAt = clock(); return { ok: true, record: e }; }); }
  function deleteEvaluator(id) { return transact(function (state) {
    if (state.jobs.some(function (job) { return job.bindings.some(function (binding) { return binding.evaluatorRef.id === id; }); }) || state.assessments.some(function (item) { return item.evaluatorRef.id === id; })) return { ok: false, error: '该评估器已被任务或历史结果引用，请先停用并保留历史' };
    var index = state.evaluators.findIndex(function (e) { return e.id === id; }); if (index < 0) return { ok: false, error: '评估器不存在' }; state.evaluators.splice(index, 1); return { ok: true };
  }); }
  function compare(left, operator, right) {
    if (operator === 'exists') return content(left);
    if (left === undefined || right === undefined) return null;
    if (operator === 'equals') return canonical(left) === canonical(right);
    if (operator === 'not_equals') return canonical(left) !== canonical(right);
    if (operator === 'contains') return typeof left === 'string' && typeof right === 'string' ? left.indexOf(right) >= 0 : Array.isArray(left) ? left.some(function (item) { return canonical(item) === canonical(right); }) : null;
    if (operator === 'in') return Array.isArray(right) ? right.some(function (item) { return canonical(item) === canonical(left); }) : null;
    if (operator === 'between') return Number.isFinite(left) && Array.isArray(right) && right.length === 2 && right.every(Number.isFinite) ? left >= right[0] && left <= right[1] : null;
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    return operator === 'gte' ? left >= right : operator === 'gt' ? left > right : operator === 'lte' ? left <= right : operator === 'lt' ? left < right : null;
  }
  function llmMock(metric, input) {
    var keys = Object.keys(input), actual = own(input, 'actual') ? input.actual : own(input, 'output') ? input.output : own(input, 'answer') ? input.answer : keys.length === 1 ? input[keys[0]] : input, supplied = actual && typeof actual === 'object' && (actual.metricValues || actual.metrics), value, reason = '';
    if (supplied && own(supplied, metric.id)) { value = supplied[metric.id]; if (value && typeof value === 'object' && own(value, 'value')) { reason = value.reason || ''; value = value.value; } }
    var output = typeof actual === 'string' ? actual : actual == null ? '' : JSON.stringify(actual), escaped = (metric.name || metric.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (value === undefined) {
      var line = output.match(new RegExp('(?:^|\\n)\\s*(?:' + escaped + '|' + metric.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[：:]\\s*([^\\n]+)'));
      if (line) {
        var assertion = line[1].trim();
        if (/证据不足|无法判断|待确认|未知/.test(assertion)) return { value: null, reason: '证据明确标为待确认；未推断质量结论。' };
        if (metric.valueType === 'number' && /^-?\d+(?:\.\d+)?(?:\s*分)?(?:[，,；;。\s]|$)/.test(assertion)) value = Number(assertion.match(/^-?\d+(?:\.\d+)?/)[0]);
        if (metric.valueType === 'boolean') { if (/^(?:true|是|符合|通过)(?:[，,；;。\s]|$)/i.test(assertion)) value = true; else if (/^(?:false|否|不符合|未通过|不通过)(?:[，,；;。\s]|$)/i.test(assertion)) value = false; }
        if (metric.valueType === 'category') { var category = (metric.categories || []).filter(function (c) { return assertion === c.code || assertion === c.label || assertion.indexOf(c.label + '；') === 0 || assertion.indexOf(c.label + '。') === 0; })[0]; if (category) value = category.code; }
        if (metric.valueType === 'text') value = assertion;
        reason = '读取当前证据中的逐项结果：' + assertion;
      }
    }
    if (value === undefined && metric.valueType === 'text' && output.trim()) { value = output; reason = '本地 Mock 原样提取当前证据，不生成未经执行的模型分析。'; }
    return value === undefined ? { value: null, reason: '本地 LLM Judge Mock 未调用真实模型；当前证据没有该指标可直接核验的逐项结果，无法判定。' } : { value: value, reason: reason || '读取当前结构化证据中的指标值；未调用真实评审模型。' };
  }
  function promptMock(input) {
    var result = null, keys = Object.keys(input).sort(function (a, b) { return Number(INPUT_ALIASES[b] === 'actual') - Number(INPUT_ALIASES[a] === 'actual'); });
    keys.some(function (key) {
      var value = input[key];
      if (typeof value === 'string') {
        var blocks = value.match(/```(?:json)?\s*\n?[\s\S]*?```/gi), encoded = blocks && blocks.length === 1 ? blocks[0].replace(/^```(?:json)?\s*\n?/i, '').replace(/```$/, '').trim() : value.trim();
        try { value = JSON.parse(encoded); } catch (_) { return false; }
      }
      var values = value && typeof value === 'object' && !Array.isArray(value) && value.metricValues;
      if (!values || !own(values, 'overall_verdict')) return false;
      var raw = values.overall_verdict, object = raw && typeof raw === 'object' && !Array.isArray(raw), verdict = object && own(raw, 'value') ? raw.value : raw;
      result = { value: verdict, reason: '本地 LLM Judge Mock 未调用真实模型；仅读取明确的整体结论结果。' + (object && text(raw.reason) ? ' ' + raw.reason : ''), evidenceRefs: object && Array.isArray(raw.evidenceRefs) ? unique(raw.evidenceRefs.filter(function (ref) { return typeof ref === 'string' && !!ref.trim(); })) : [] };
      return true;
    });
    return result || { value: null, reason: '本地 LLM Judge Mock 未调用真实模型；当前输入没有明确的整体结论结果，未从提示词或普通文本推断结论。', evidenceRefs: [] };
  }
  function itemInput(input, requirement) { var result = {}; (requirement.required || []).forEach(function (key) { if (own(input, key)) result[key] = input[key]; }); return result; }
  function itemInputErrors(evaluator, input, requirement, target) {
    var missing = (requirement.required || []).filter(function (key) { return !content(input[key]) || !typeMatches(input[key], evaluator.inputSchema.properties[key]); });
    var errors = missing.map(function (key) { return '本项缺少有效' + (INPUT_LABELS[INPUT_ALIASES[key]] || key); });
    var coverage = completenessErrors({ inputSchema: { 'x-aiops-evidence': { version: 1, contextScopes: requirement.contextScopes || {} } } }, target);
    return errors.concat(coverage.map(function (error) { return error.message; }));
  }
  function subScore(item, part, input) {
    var found, reason = '', totalOnly = false, keys = Object.keys(input).sort(function (a, b) { return Number(INPUT_ALIASES[b] === 'actual') - Number(INPUT_ALIASES[a] === 'actual'); });
    function escaped(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    keys.some(function (key) {
      var value = input[key], container = value && typeof value === 'object' && (value.metricValues || value.metrics || value), payload = container && own(container, item.id) ? container[item.id] : undefined;
      if (typeof payload === 'number') totalOnly = true;
      if (payload && typeof payload === 'object') {
        if (payload.subScores && own(payload.subScores, part.id)) found = payload.subScores[part.id];
        var row = Array.isArray(payload.subResults) && payload.subResults.filter(function (result) { return result.id === part.id; })[0];
        if (found === undefined && row) { found = own(row, 'value') ? row.value : row.score; reason = text(row.reason); }
        if (found && typeof found === 'object') { reason = text(found.reason); found = own(found, 'value') ? found.value : found.score; }
        if (found !== undefined) { reason = reason || '本地 Mock 读取 ' + key + ' 中明确的 ' + item.id + '.' + part.id + ' 子项分数。'; return true; }
      }
      if (typeof value === 'string') {
        var line = value.match(new RegExp('(?:^|\\n)\\s*(?:' + escaped(item.id) + '|' + escaped(item.name) + ')\\.(?:' + escaped(part.id) + '|' + escaped(part.name) + ')[：:]\\s*(-?\\d+(?:\\.\\d+)?)(?:\\s*分)?(?:[，,；;。\\s]|$)'));
        if (line) { found = Number(line[1]); reason = '本地 Mock 读取明确子项行：' + line[0].trim(); return true; }
      }
      return false;
    });
    if (found === undefined || found === null) return { value: null, validationStatus: 'missing', reason: totalOnly ? '只提供了单一总分，不能据此反推各子项分数。' : '当前证据没有该子项可核验的0–100分数。' };
    if (!Number.isFinite(found) || found < 0 || found > 100) return { value: null, rawValue: copy(found), validationStatus: 'invalid', reason: '子项原始分数不是0–100内的有效数值，保留待确认。' };
    return { value: found, validationStatus: 'valid', reason: reason };
  }
  // Demo judges are injected by the new-AIOps host only. Agent output and saved
  // evaluator/job configuration cannot provide this trusted execution channel.
  function evaluationDemoJudge(stage, payload) {
    if (typeof host.evaluationDemoJudge !== 'function') return null;
    var request=Object.assign({protocol:'aiops.demo_judge.request.v1',stage:stage},copy(payload));
    request.requestHash='sha256:'+digest(request);
    try {
      var response=host.evaluationDemoJudge(copy(request));
      if(!response || response.requestHash!==request.requestHash)return null;
      if(stage==='metrics' && response.protocol!=='aiops.demo_judge.metrics.v1')return null;
      return copy(response);
    }catch(_){return null;}
  }
  function demoMetricResult(packet,metric) {
    if(!packet || !packet.metricValues || !own(packet.metricValues,metric.id))return null;
    var raw=packet.metricValues[metric.id],boxed=raw && typeof raw==='object' && own(raw,'value');
    return {value:boxed?copy(raw.value):copy(raw),reason:boxed&&typeof raw.reason==='string'?raw.reason:'本地 Mock 评估：读取固定演示证据的独立评审结果，未调用真实模型。',evidenceRefs:boxed&&Array.isArray(raw.evidenceRefs)?copy(raw.evidenceRefs):[]};
  }
  function assessItems(e, source, input, assessment, demoPacket) {
    var metadata = e.inputSchema['x-aiops-evidence'], requirements = metadata.itemRequirements || [];
    e.metrics.forEach(function (item) {
      var requirement = requirements.filter(function (entry) { return entry.metricId === item.id; })[0] || { required: [] };
      var errors = itemInputErrors(e, input, requirement, source.target), result = { metricId: item.id, value: null, decision: 'inconclusive', validationStatus: 'missing', reason: '', evidenceRefs: copy(source.target.evidenceRefs || []) };
      if (item.valueType === 'number') {
        result.subResults = item.scoring.items.map(function (part) {
          var dependency = (requirement.subItems || []).filter(function (entry) { return entry.id === part.id; })[0] || requirement, missing = itemInputErrors(e, input, dependency, source.target);
          var value = missing.length ? { value: null, validationStatus: 'missing', reason: missing.join('；') } : subScore(item, part, itemInput(input, dependency));
          var sub = Object.assign({ id: part.id, name: part.name, weight: part.weight, weightedValue: value.value === null ? null : value.value * part.weight }, value); return sub;
        });
        if (result.subResults.every(function (part) { return part.validationStatus === 'valid'; })) {
          result.value = result.subResults.reduce(function (sum, part) { return sum + part.weightedValue; }, 0); result.validationStatus = 'valid'; result.decision = result.value >= item.scoring.passThreshold ? 'passed' : 'failed'; result.reason = '依据真实子项分数加权：' + result.subResults.map(function (part) { return part.value + '×' + part.weight; }).join(' + ') + ' = ' + result.value + '；本项通过阈值 ≥ ' + item.scoring.passThreshold + '。';
        } else { result.validationStatus = result.subResults.some(function (part) { return part.validationStatus === 'invalid'; }) ? 'invalid' : 'missing'; result.reason = '本项子项分数不完整或无效，未计算总分，也未用单一总分补造子项。'; }
      } else if (errors.length) result.reason = errors.join('；');
      else {
        var value = demoMetricResult(demoPacket,item) || (isPromptEvaluator(e) ? promptMock(itemInput(input, requirement)) : llmMock(item, itemInput(input, requirement)));
        if (value.evidenceRefs) result.evidenceRefs = unique(result.evidenceRefs.concat(value.evidenceRefs));
        if (value.value !== null && metricValue(item, value.value)) {
          result.value = value.value; result.validationStatus = 'valid'; result.decision = item.valueType === 'text' ? 'not_applicable' : item.valueType === 'boolean' ? value.value === item.boolean.passValue ? 'passed' : 'failed' : item.categories.filter(function (category) { return category.code === value.value; })[0].pass ? 'passed' : 'failed'; result.reason = value.reason;
        } else if (value.value !== null) { result.validationStatus = 'invalid'; result.rawValue = copy(value.value); result.reason = '本项输出不符合定义的类型或类别，原始值已保留，待确认。'; }
        else result.reason = value.reason;
      }
      assessment.metricResults.push(result);
    });
    var judged = assessment.metricResults.filter(function (result) { return e.metrics.filter(function (item) { return item.id === result.metricId; })[0].valueType !== 'text'; }), summary = e.decision.summary;
    var passed = judged.filter(function (result) { return result.decision === 'passed'; }).length, failed = judged.filter(function (result) { return result.decision === 'failed'; }).length, unknown = judged.length - passed - failed;
    var required = summary.type === 'all' ? judged.length : summary.minPassed;
    assessment.aggregate = null; assessment.summaryResult = { mode: summary.type, required: required, total: judged.length, passed: passed, failed: failed, inconclusive: unknown, observed: e.metrics.length - judged.length, lowerBound: passed, upperBound: passed + unknown };
    assessment.decision = !judged.length ? 'not_applicable' : passed >= required ? 'passed' : passed + unknown < required ? 'failed' : 'inconclusive'; return assessment;
  }
  function assessV4(e, source, input, assessment, demoPacket, binding) {
    var metadata = e.inputSchema['x-aiops-evidence'], policy = e.decision;
    e.metrics.forEach(function (item) {
      var requirement = (metadata.itemRequirements || []).filter(function (entry) { return entry.metricId === item.id; })[0] || { required: [] }, errors = itemInputErrors(e, input, requirement, source.target);
      var result = { metricId: item.id, value: null, decision: 'inconclusive', validationStatus: 'missing', reason: '', evidenceRefs: copy(source.target.evidenceRefs || []) };
      if (errors.length) result.reason = errors.join('；');
      else {
        var output = demoMetricResult(demoPacket,item) || llmMock(item, itemInput(input, requirement)); result.reason = output.reason;if(output.evidenceRefs)result.evidenceRefs=unique(result.evidenceRefs.concat(output.evidenceRefs));
        if (output.value !== null && metricValue(item, output.value)) {
          result.value = output.value; result.validationStatus = 'valid';
          result.decision = item.valueType === 'text' ? 'not_applicable' : item.valueType === 'number' ? result.value >= item.scoring.passThreshold ? 'passed' : 'failed' : item.valueType === 'boolean' ? result.value === item.boolean.passValue ? 'passed' : 'failed' : item.categories.filter(function (category) { return category.code === result.value; })[0].pass ? 'passed' : 'failed';
        } else if (output.value !== null) { result.validationStatus = 'invalid'; result.rawValue = copy(output.value); result.reason = '本项输出不符合真实类型、类别或0–100分范围，未将非法值补为0或当作未通过。'; }
      }
      assessment.metricResults.push(result);
    });
    var judged = assessment.metricResults.filter(function (result) { return e.metrics.filter(function (item) { return item.id === result.metricId; })[0].valueType !== 'text'; }), passed = judged.filter(function (r) { return r.decision === 'passed'; }).length, failed = judged.filter(function (r) { return r.decision === 'failed'; }).length, unknown = judged.length - passed - failed;
    var detail = { mode: policy.mode, decision: 'inconclusive', reason: '', evidenceRefs: copy(source.target.evidenceRefs || []) };
    if(policy.mode==='custom_prompt'&&binding&&binding.role==='observe'&&e.metrics.length&&e.metrics.every(function(item){return item.valueType==='text';})){
      detail.decision='not_applicable';detail.reason='仅记录文本观察结果与证据，不参与通过判定。';assessment.policyResult=detail;assessment.decision=detail.decision;return assessment;
    }
    if (policy.mode === 'weighted_score') {
      detail.threshold = policy.passThreshold; detail.contributions = judged.map(function (result) {
        var item = e.metrics.filter(function (m) { return m.id === result.metricId; })[0], score = result.validationStatus !== 'valid' ? null : item.valueType === 'number' ? result.value : result.decision === 'passed' ? 100 : 0;
        return { metricId: item.id, weight: item.weight, value: result.value, normalizedScore: score, weightedScore: score === null ? null : score * item.weight };
      });
      detail.score = detail.contributions.some(function (part) { return part.normalizedScore === null; }) ? null : detail.contributions.reduce(function (sum, part) { return sum + part.weightedScore; }, 0);
      assessment.aggregate = detail.score; detail.decision = detail.score === null ? 'inconclusive' : detail.score >= policy.passThreshold ? 'passed' : 'failed';
      detail.reason = detail.score === null ? '存在缺证或非法的加权项，未补0、未重分权重，也未计算整体分数。' : '按真实评分及布尔/类别通过100、未通过0加权得到 ' + detail.score + ' 分；整体通过阈值 ≥ ' + policy.passThreshold + '。';
    } else if (policy.mode === 'item_count') {
      var required = policy.summary.type === 'all' ? judged.length : policy.summary.minPassed;
      assessment.summaryResult = { mode: policy.summary.type, required: required, total: judged.length, passed: passed, failed: failed, inconclusive: unknown, observed: e.metrics.length - judged.length, lowerBound: passed, upperBound: passed + unknown };
      detail.summaryResult = copy(assessment.summaryResult); detail.decision = !judged.length ? 'not_applicable' : passed >= required ? 'passed' : passed + unknown < required ? 'failed' : 'inconclusive';
      detail.reason = !judged.length ? '全部为文本观察项，不产生自动通过。' : '已通过 ' + passed + '/' + judged.length + ' 项，需要 ' + required + ' 项；待确认 ' + unknown + ' 项，未将缺证当作未通过。';
    } else {
      var finalRequirement = metadata.finalRequirements || { computed: ['itemResults'], required: ['itemResults'], contextScopes: {} }, rawRequirement = { required: finalRequirement.required.filter(function (key) { return key !== 'itemResults'; }), contextScopes: finalRequirement.contextScopes || {} }, finalErrors = itemInputErrors(e, input, rawRequirement, source.target);
      var finalInput = { protocol: 'aiops.final_verdict.v1', evaluatorRef: copy(assessment.evaluatorRef), evaluatorConfigHash: 'sha256:' + digest(gradingDefinition(e)), targetRef: copy(assessment.targetRef), judgeRuntimeSnapshot: copy(assessment.judgeRuntimeSnapshot), additionalPrompt: e.additionalPrompt || '', customPrompt: policy.customPrompt, itemResults: assessment.metricResults.map(function (result) {
        var item = e.metrics.filter(function (m) { return m.id === result.metricId; })[0], entry = Object.assign({ name: item.name, valueType: item.valueType }, copy(result)); if (item.valueType === 'category') entry.categories = item.categories.map(function (category) { return { code: category.code, label: category.label }; }); return entry;
      }), inputs: itemInput(input, rawRequirement) };
      finalInput.inputHash = 'sha256:' + digest(finalInput); assessment.finalJudgeInputSnapshot = copy(finalInput);
      var response = source.finalJudgeOutput || evaluationDemoJudge('evaluator_final',{inputSnapshot:finalInput,source:source}), finalResult = { inputHash: finalInput.inputHash, value: null, decision: 'inconclusive', validationStatus: 'missing', reason: '本地 Mock 未调用真实最终评估模型；没有与本次真实评估项结果匹配的独立整体判定结果。', evidenceRefs: [] };
      if (finalErrors.length) finalResult.reason = finalErrors.join('；');
      else if (response != null) {
        if (!response || response.protocol !== 'aiops.final_verdict.v1' || response.inputHash !== finalInput.inputHash || !own(response, 'value') || response.value !== null && typeof response.value !== 'boolean' || typeof response.reason !== 'string' || !Array.isArray(response.evidenceRefs) || response.evidenceRefs.some(function (ref) { return typeof ref !== 'string'; })) { finalResult.validationStatus = 'invalid'; finalResult.reason = '最终判定协议或输入快照不匹配，未复用旧标准、旧模型或其他对象的结果。'; }
        else { finalResult.value = response.value; finalResult.validationStatus = response.value === null ? 'missing' : 'valid'; finalResult.decision = response.value === null ? 'inconclusive' : response.value ? 'passed' : 'failed'; finalResult.reason = '本地 Mock 仅读取与本次真实评估项快照匹配的独立最终判定结果；未调用真实模型。 ' + response.reason; finalResult.evidenceRefs = copy(response.evidenceRefs); }
      }
      assessment.finalJudgeResult = finalResult; detail.inputHash = finalInput.inputHash; detail.decision = finalResult.decision; detail.reason = finalResult.reason; detail.evidenceRefs = unique(detail.evidenceRefs.concat(finalResult.evidenceRefs));
    }
    assessment.policyResult = detail; assessment.decision = detail.decision; return assessment;
  }
  function assess(evaluator, context, binding) {
    var e = copy(evaluator || {}), source = normalizedContext(context), derivationErrors = [];
    if (!e.inputSchema || !e.supportedTargets) { var derived = deriveEvaluatorContract(e); e = derived.record; derivationErrors = derived.errors; }
    var b = automaticBinding(binding || { id: 'PREVIEW-BINDING', evaluatorRef: { id: e.id || 'preview', version: e.version || 'V1' }, role: hasDecision(e) ? 'gate' : 'observe', targetType: source.target.type, dimensionMappings: [] }, e, source.target.type !== 'case_output');
    if (!e.id) e.id = b.evaluatorRef.id; if (!e.version) e.version = b.evaluatorRef.version;
    var judgeRuntime = e.method && e.method.type === 'llm_judge' ? normalizeJudgeRuntime(source.judgeRuntime, e.method) : null;
    var agentRuntime = source.agentRuntimeSnapshot && typeof source.agentRuntimeSnapshot === 'object' ? copy(source.agentRuntimeSnapshot) : observedModels(source.target);
    var assessment = { id: 'UA-' + digest([source.runId || 'preview', b.id, source.target.snapshotId, clock()]).slice(0, 20), runId: source.runId || 'preview', bindingId: b.id, targetRef: { type: source.target.type, id: source.target.id, snapshotId: source.target.snapshotId }, evaluatorRef: { id: e.id, version: e.version }, effectiveConfigHash: 'sha256:' + digest({ evaluator: gradingDefinition(e), binding: b, judgeRuntime: judgeRuntime }), judgeRuntimeSnapshot: copy(judgeRuntime), agentRuntimeSnapshot: agentRuntime, executionStatus: 'succeeded', decision: 'inconclusive', metricResults: [], aggregate: null, usage: { tokens: 0, cost: 0, currency: 'USD' }, evaluatedAt: clock(), source: 'mock' };
    function executionError(code, message) { assessment.executionStatus = 'failed'; assessment.decision = 'inconclusive'; assessment.aggregate = null; assessment.error = { code: code, message: message, retryable: false }; return assessment; }
    var metadata = e.inputSchema && e.inputSchema['x-aiops-evidence'];
    var errors = validateEvaluator(e, { preserveContract: true }).concat(derivationErrors, metadata ? deriveEvidenceRequirements(e).errors : [], bindingErrors(b, source.task ? { task: source.task } : null, e, true), judgeRuntime ? validateJudgeRuntime(judgeRuntime) : []);
    if (source.target.type !== b.targetType) errors.push({ message: '目标类型与绑定不匹配' });
    if (errors.length) return executionError('CONFIG_VALIDATION_FAILED', errors.map(function (item) { return item.message; }).join('；'));
    var input = {}; Object.keys(b.inputMapping || {}).forEach(function (key) { var value = pointer(source, b.inputMapping[key]); if (value !== undefined) input[key] = value; });
    var demoPacket=e.method.type==='llm_judge'?evaluationDemoJudge('metrics',{evaluator:e,evaluatorConfigHash:'sha256:'+digest(gradingDefinition(e)),judgeRuntimeSnapshot:judgeRuntime,targetRef:assessment.targetRef,inputs:input,source:source}):null;
    if(demoPacket)assessment.demoJudgeSnapshot={source:'fixture_mock',requestHash:demoPacket.requestHash,fixtureRef:copy(demoPacket.fixtureRef || null)};
    if (isV4Evaluator(e)) { try { return assessV4(e, source, input, assessment, demoPacket, b); } catch (_) { return executionError('JUDGE_EXECUTION_FAILED', '评估项或整体判定本地执行异常，未将执行错误计为业务未通过。'); } }
    if (itemDefinition(e)) { try { return assessItems(e, source, input, assessment, demoPacket); } catch (_) { return executionError('JUDGE_EXECUTION_FAILED', '评估项本地执行异常，未将整体执行错误计为业务未通过。'); } }
    if ((e.inputSchema.required || []).some(function (key) { return !content(input[key]); }) || !typeMatches(input, e.inputSchema)) return executionError('INPUT_VALIDATION_FAILED', '必需输入缺失或不符合输入契约，未计为业务不通过。');
    var incomplete = completenessErrors(e, source.target); if (incomplete.length) return executionError('INPUT_VALIDATION_FAILED', incomplete.map(function (error) { return error.message; }).join('；'));
    var invalid = false, typedPolicy = e.decision.policyVersion === 2, gatedMetrics = decisionRules(e).map(function (rule) { return rule.metricId; });
    e.metrics.forEach(function (metric) {
      var output;
      if (e.method.type === 'rule') {
        var check = e.method.checks.filter(function (item) { return item.metricId === metric.id; })[0], left = pointer(input, check.inputPath), right = own(check, 'expectedPath') ? pointer(input, check.expectedPath) : check.expected;
        var matched = compare(left, check.operator, right);
        output = matched === null ? { value: null, reason: '规则所需证据缺失或类型不匹配，无法判定。' } : { value: matched ? check.onTrue : check.onFalse, reason: '依据冻结规则 ' + check.inputPath + ' ' + check.operator + (check.operator === 'exists' ? '' : ' ' + JSON.stringify(right)) + '，比较结果为 ' + matched + '。' };
      } else output = demoMetricResult(demoPacket,metric) || llmMock(metric, input);
      var validationStatus = output.value === null ? 'missing' : 'valid', rawValue;
      if (output.value !== null && !metricValue(metric, output.value)) {
        invalid = true; validationStatus = 'invalid'; rawValue = copy(output.value);
        output = { value: null, reason: typedPolicy ? (gatedMetrics.indexOf(metric.id) >= 0 ? '判定指标' : '观察指标') + '输出不符合冻结类型、范围或枚举，原始输出已保留，本项待确认。' : '证据输出不符合冻结指标类型、范围或枚举，未改写输出。' };
      }
      var metricResult = { metricId: metric.id, value: output.value, decision: output.value === null ? 'inconclusive' : 'not_applicable', reason: output.reason, evidenceRefs: copy(source.target.evidenceRefs || []) };
      if (typedPolicy) { metricResult.validationStatus = validationStatus; if (validationStatus === 'invalid') metricResult.rawValue = rawValue; }
      assessment.metricResults.push(metricResult);
    });
    if (invalid && !typedPolicy) return executionError('OUTPUT_VALIDATION_FAILED', '评估输出不符合冻结指标定义，未计为业务不通过。');
    var values = {}; assessment.metricResults.forEach(function (r) { values[r.metricId] = r.value; });
    if (e.aggregation.type === 'weighted_mean' && e.aggregation.weights.every(function (w) { return typeof values[w.metricId] === 'number'; })) assessment.aggregate = e.aggregation.weights.reduce(function (sum, w) { return sum + values[w.metricId] * w.weight; }, 0);
    var decision = e.decision, outcomes = [], metricDecisions = {};
    function outcome(metricId, operator, expected) { var result = values[metricId] === null || values[metricId] === undefined ? null : compare(values[metricId], operator, expected); outcomes.push(result); (metricDecisions[metricId] || (metricDecisions[metricId] = [])).push(result); }
    if (decision.type === 'all_rules') decision.rules.forEach(function (rule) { outcome(rule.metricId, rule.operator, rule.value); });
    else if (decision.type === 'boolean_equals') outcome(decision.metricId, 'equals', decision.value);
    else if (decision.type === 'category_in') outcome(decision.metricId, 'in', decision.values);
    else if (decision.type === 'aggregate_threshold') outcomes.push(assessment.aggregate === null ? null : compare(assessment.aggregate, decision.operator, decision.threshold));
    assessment.decision = decision.type === 'none' || typedPolicy && !outcomes.length ? 'not_applicable' : typedPolicy && outcomes.indexOf(false) >= 0 ? 'failed' : outcomes.indexOf(null) >= 0 ? 'inconclusive' : outcomes.every(Boolean) ? 'passed' : 'failed';
    assessment.metricResults.forEach(function (result) { var verdicts = metricDecisions[result.metricId]; if (verdicts) result.decision = typedPolicy && verdicts.indexOf(false) >= 0 ? 'failed' : verdicts.indexOf(null) >= 0 ? 'inconclusive' : verdicts.every(Boolean) ? 'passed' : 'failed'; });
    return assessment;
  }
  function scheduleDefaults() { return { repeat: 'manual', timezone: 'Asia/Shanghai', time: '09:00', intervalHours: 1, weekdays: [1], monthdays: [1], onceAt: '' }; }
  function compositePolicy(value) {
    value=value || {type:'all'};
    if(value.type!=='composite_policy')return {type:'composite_policy',policyVersion:1,mode:'item_count',missingEvidence:'inconclusive',summary:value.type==='at_least'?{type:'at_least',minPassed:value.minPassed}:{type:value.type || 'all'}};
    var result={type:'composite_policy',policyVersion:value.policyVersion==null?1:value.policyVersion,mode:value.mode,missingEvidence:value.missingEvidence==null?'inconclusive':value.missingEvidence};
    if(value.mode==='weighted_score'){result.passThreshold=value.passThreshold;result.weights=Array.isArray(value.weights)?value.weights.map(function(row){return {bindingId:row && row.bindingId,weight:row && row.weight};}):copy(value.weights);}
    else if(value.mode==='custom_prompt')result.customPrompt=value.customPrompt;
    else if(value.mode==='item_count')result.summary=value.summary && value.summary.type==='at_least'?{type:'at_least',minPassed:value.summary.minPassed}:{type:value.summary && value.summary.type || 'all'};
    return result;
  }
  function compositeEntries(entries) {
    return (entries || []).map(function(entry){
      entry=entry || {};var binding=entry.binding || entry.bindingSnapshot || entry,evaluator=entry.evaluatorSnapshot || entry.evaluator || binding.evaluatorSnapshot || binding.evaluator,role=entry.role || binding.role || 'gate';
      return {entry:entry,binding:binding,evaluator:evaluator,bindingId:entry.bindingId || binding.id || '',evaluatorRef:copy(entry.evaluatorRef || binding.evaluatorRef || evaluator && {id:evaluator.id,version:evaluator.version}),name:evaluator && evaluator.name || entry.name || (entry.evaluatorRef || binding.evaluatorRef || {}).id || entry.bindingId || binding.id || '',participates:entry.participates!==false && role!=='observe' && (!evaluator || hasDecision(evaluator))};
    });
  }
  function validateCompositePolicy(value, bindings) {
    var policy=compositePolicy(value),errors=[],gates=compositeEntries(bindings).filter(function(entry){return entry.participates;}),ids=gates.map(function(entry){return entry.bindingId;});
    if(ids.some(function(id,index){return !text(id)||ids.indexOf(id)!==index;}))problem(errors,'policy.bindings','参与最终判定的评估器绑定标识不可缺失或重复');
    if(policy.policyVersion!==1 || policy.missingEvidence!=='inconclusive' || ['weighted_score','item_count','custom_prompt'].indexOf(policy.mode)<0)problem(errors,'policy','请选择有效的评分、通过数量或自定义判定方式');
    if(policy.mode==='weighted_score'){
      if(!gates.length)problem(errors,'policy.weights','评分判定至少需要一个可判定的评估器');
      if(!Number.isFinite(policy.passThreshold)||policy.passThreshold<0||policy.passThreshold>100)problem(errors,'policy.passThreshold','整体通过分数须为0–100');
      var rows=Array.isArray(policy.weights)?policy.weights:[],sum=0,seen=[];
      rows.forEach(function(row){
        if(!text(row.bindingId)||ids.indexOf(row.bindingId)<0||seen.indexOf(row.bindingId)>=0)problem(errors,'policy.weights','评分权重须准确对应每个参与判定的评估器，不可缺失、重复或包含不适用绑定');
        seen.push(row.bindingId);if(!Number.isFinite(row.weight)||row.weight<=0||row.weight>1)problem(errors,'policy.weights','每个评估器权重须为大于0且不大于1的数值');else sum+=row.weight;
      });
      if(rows.length!==gates.length || ids.some(function(id){return seen.indexOf(id)<0;}))problem(errors,'policy.weights','请为每个参与判定的评估器配置权重');
      if(Math.abs(sum-1)>1e-8)problem(errors,'policy.weights','评估器权重合计必须为1');
    }else if(policy.mode==='item_count'){
      var summary=policy.summary || {};
      if(['all','at_least'].indexOf(summary.type)<0)problem(errors,'policy.summary','请选择全量通过或部分通过');
      if(summary.type==='at_least'&&(!Number.isInteger(summary.minPassed)||summary.minPassed<1||summary.minPassed>gates.length))problem(errors,'policy.summary.minPassed','至少通过评估器数须为1至'+gates.length+'的整数');
    }else if(policy.mode==='custom_prompt'){
      if(!text(policy.customPrompt))problem(errors,'policy.customPrompt','请填写最终判断提示词');
      var prompt=promptTemplateText(String(policy.customPrompt || '')),variables=Array.from(prompt.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g),function(match){return match[1];});
      if(variables.some(function(name){return name!=='evaluatorResults';})||prompt.replace(/\{\{\s*evaluatorResults\s*\}\}/g,'').indexOf('{{')>=0||prompt.replace(/\{\{\s*evaluatorResults\s*\}\}/g,'').indexOf('}}')>=0)problem(errors,'policy.customPrompt','最终判断提示词仅可使用系统提供的 {{evaluatorResults}}，不支持其他输入变量');
    }
    return errors;
  }
  function evaluateCompositePolicy(value, assessments, context) {
    var policy=compositePolicy(value),source=context || {},entries=compositeEntries(assessments),gates=entries.filter(function(entry){return entry.participates;}),counts={total:gates.length,passed:0,failed:0,inconclusive:0,observed:entries.length-gates.length};
    function verdict(entry){return entry.entry.executionStatus==='succeeded'&&['passed','failed'].indexOf(entry.entry.decision)>=0?entry.entry.decision:'inconclusive';}
    gates.forEach(function(entry){counts[verdict(entry)]++;});
    var refs=unique(entries.flatMap(function(entry){return (entry.entry.metricResults || []).flatMap(function(item){return item.evidenceRefs || [];}).concat(entry.entry.evidenceMessageIds || [],(entry.entry.policyResult || {}).evidenceRefs || []);})),detail={mode:policy.mode,decision:'inconclusive',reason:'',evidenceRefs:refs},result={decision:'inconclusive',counts:counts,required:policy.mode==='item_count'&&policy.summary.type==='at_least'?policy.summary.minPassed:gates.length,policyResult:detail};
    var errors=validateCompositePolicy(policy,assessments);
    if(errors.length){detail.reason=errors.map(function(error){return error.message;}).join('；');detail.validationStatus='invalid';result.errors=errors;return result;}
    if(policy.mode==='custom_prompt'&&entries.length&&!gates.length&&entries.every(function(entry){return (entry.entry.role||entry.binding.role||entry.entry.participation)==='observe';})){detail.decision='not_applicable';detail.reason='所有评估器仅观察，不生成整体通过判定。';result.decision=detail.decision;return result;}
    if(policy.mode==='weighted_score'){
      detail.threshold=policy.passThreshold;
      detail.contributions=gates.map(function(entry){
        var a=entry.entry,row=policy.weights.filter(function(item){return item.bindingId===entry.bindingId;})[0],decision=verdict(entry),declared=a.policyResult && a.policyResult.mode==='weighted_score',raw=declared?a.policyResult.score:null,actual=Number.isFinite(raw)&&raw>=0&&raw<=100,score=decision==='inconclusive'?null:declared?actual?raw:null:decision==='passed'?100:0;
        return {bindingId:entry.bindingId,evaluatorRef:copy(entry.evaluatorRef),name:entry.name,weight:row.weight,score:score,normalizedScore:score,weightedScore:score===null?null:score*row.weight,decision:decision,scoreSource:declared?'weighted_score':'verdict'};
      });
      detail.score=detail.contributions.some(function(item){return item.score===null;})?null:detail.contributions.reduce(function(sum,item){return sum+item.weightedScore;},0);
      detail.decision=detail.score===null?'inconclusive':detail.score>=policy.passThreshold?'passed':'failed';
      detail.reason=detail.score===null?'参与判定的评估器缺证或执行异常，不补零、不重分权重，整体待确认。':'评估器加权总分为 '+detail.score+' 分，通过阈值 ≥ '+policy.passThreshold+'。';
    }else if(policy.mode==='item_count'){
      var summary={mode:policy.summary.type,required:result.required,total:counts.total,passed:counts.passed,failed:counts.failed,inconclusive:counts.inconclusive,observed:counts.observed,lowerBound:counts.passed,upperBound:counts.passed+counts.inconclusive};
      result.summary=copy(summary);result.summaryResult=copy(summary);detail.summaryResult=copy(summary);
      detail.decision=!counts.total?'not_applicable':counts.passed>=result.required?'passed':counts.passed+counts.inconclusive<result.required?'failed':'inconclusive';
      detail.reason=!counts.total?'没有参与判定的评估器，仅记录观察结果。':'已通过 '+counts.passed+' / '+counts.total+' 个评估器，需要 '+result.required+' 个；待确认 '+counts.inconclusive+' 个。';
    }else {
      var finalInput={protocol:'aiops.composite_verdict.v1',ownerRef:copy(source.ownerRef || null),targetRef:copy(source.targetRef || null),runId:source.runId || null,judgeRuntimeSnapshot:copy(source.judgeRuntimeSnapshot || source.judgeRuntime || null),policySnapshot:copy(policy),evaluatorResults:entries.map(function(entry){
        var a=entry.entry;return {bindingId:entry.bindingId,evaluatorRef:copy(entry.evaluatorRef || null),name:entry.name,participation:entry.participates?'gate':'observe',executionStatus:a.executionStatus || 'unknown',decision:entry.participates?verdict(entry):a.decision || 'not_applicable',effectiveConfigHash:a.effectiveConfigHash || null,evaluatorConfigHash:entry.evaluator?'sha256:'+digest(gradingDefinition(entry.evaluator)):null,targetRef:copy(a.targetRef || null),judgeRuntimeSnapshot:copy(a.judgeRuntimeSnapshot || null),reason:a.reason || (a.policyResult || {}).reason || (a.error || {}).message || '',evidenceRefs:unique((a.evidenceMessageIds || []).concat((a.metricResults || []).flatMap(function(item){return item.evidenceRefs || [];}),(a.policyResult || {}).evidenceRefs || [])),aggregate:typeof a.aggregate==='number'?a.aggregate:null,metricResults:copy(a.metricResults || []),policyResult:copy(a.policyResult || null),finalJudgeInputSnapshot:copy(a.finalJudgeInputSnapshot || null),finalJudgeResult:copy(a.finalJudgeResult || null)};
      })};
      finalInput.inputHash='sha256:'+digest(finalInput);result.finalJudgeInputSnapshot=copy(finalInput);
      var response=source.finalJudgeOutput || evaluationDemoJudge('composite_final',{inputSnapshot:finalInput,source:source}),finalResult={inputHash:finalInput.inputHash,value:null,decision:'inconclusive',validationStatus:'missing',reason:'本地 Mock 未调用真实最终评估模型；未收到与本次真实评估器结果匹配的独立最终判定。',evidenceRefs:[]},runtimeErrors=validateJudgeRuntime(finalInput.judgeRuntimeSnapshot);
      if(!entries.length)finalResult.reason='没有评估器结果，不产生自动通过。';
      else if(runtimeErrors.length)finalResult.reason='自定义最终判定需要有效的评估模型配置。';
      else if(!finalInput.ownerRef || !finalInput.targetRef)finalResult.reason='最终判定缺少运行归属或评估对象快照。';
      else if(response!=null){
        if(!response||response.protocol!=='aiops.composite_verdict.v1'||response.inputHash!==finalInput.inputHash||!own(response,'value')||response.value!==null&&typeof response.value!=='boolean'||typeof response.reason!=='string'||!Array.isArray(response.evidenceRefs)||response.evidenceRefs.some(function(ref){return typeof ref!=='string';})) {finalResult.validationStatus='invalid';finalResult.reason='最终判定协议或本次输入快照不匹配，未复用其他标准、模型或对象的结果。';}
        else {finalResult.value=response.value;finalResult.decision=response.value===null?'inconclusive':response.value?'passed':'failed';finalResult.validationStatus=response.value===null?'missing':'valid';finalResult.reason='本地 Mock 仅读取独立最终判定结果，未调用真实模型。 '+response.reason;finalResult.evidenceRefs=copy(response.evidenceRefs);}
      }
      result.finalJudgeResult=finalResult;detail.inputHash=finalInput.inputHash;detail.decision=finalResult.decision;detail.reason=finalResult.reason;detail.evidenceRefs=unique(detail.evidenceRefs.concat(finalResult.evidenceRefs));
    }
    result.decision=detail.decision;return result;
  }
  function normalizedPassPolicy(value) {
    value = value || {type:'all'};
    if(value.type==='composite_policy')return compositePolicy(value);
    return value.type === 'at_least' ? {type:'at_least',minPassed:value.minPassed} : {type:value.type || 'all'};
  }
  function activeJobSelector(job) {
    var selector = copy(job.selector || {});
    // Preserve batch filter drafts for mode changes, but events select their own objects.
    if (job.trigger && job.trigger.mode === 'automatic') {
      selector.filter = {text:'',status:'all',logic:'all',conditions:[]};
      selector.spanTypes = [];
    }
    return selector;
  }
  function applicableJobBindings(job, state, task) {
    return (job.bindings || []).filter(function(binding){return !binding.taskRef || task && binding.taskRef.id === task.id;}).map(function(binding){return {binding:binding,evaluator:resolve(state,binding.evaluatorRef.id,binding.evaluatorRef.version)};});
  }
  function gateBinding(plan) { return plan.binding.role !== 'observe' && hasDecision(plan.evaluator); }
  function summarizeJobResults(results) {
    var counts={total:0,passed:0,failed:0,inconclusive:0,not_applicable:0};
    (results || []).forEach(function(result){counts.total++;if(own(counts,result.decision))counts[result.decision]++;});
    return counts;
  }
  function sessionResultIdentity(record) {
    var target=record.targetSnapshot || {},ref=record.targetRef || {},type=ref.type || target.type || 'unknown';
    var id=record.sourceSessionId || target.sessionId || (type==='session' ? ref.id || target.id : '');
    return {id:id || 'unattributed:'+type+':'+(ref.id || target.id || record.id),missing:!id};
  }
  function resultLogicalKey(record) {
    var target=record.targetSnapshot || record.targetRef || {};
    return record.logicalKey || logicalObjectIdentity({type:(record.targetRef || {}).type || target.type,id:(record.targetRef || {}).id || target.id || record.id},record.taskSnapshot || record.taskRef);
  }
  // A session is a navigation unit. Each target keeps its own frozen decision and evidence.
  function groupedSessionResults(state, jobId, options) {
    options=options || {};
    var runs=state.runs.filter(function(run){return (!jobId || run.jobId===jobId) && (!options.runId || run.id===options.runId);}),groups=[],bySession=Object.create(null),byAssessment=Object.create(null),linked=Object.create(null);
    function groupFor(record, preferred) {
      var identity=sessionResultIdentity(record),key=canonical([record.jobId || jobId || '',identity.id]);
      if(preferred && identity.missing)return preferred;
      if(bySession[key]){var existing=bySession[key],snapshot=record.targetSnapshot || {},sourceName=snapshot.sessionName || (snapshot.sessionSnapshot || {}).name || ((record.targetRef || {}).type==='session'?snapshot.name:'');if(existing.sessionName===existing.sessionId && sourceName)existing.sessionName=sourceName;return existing;}
      var target=record.targetSnapshot || {},ref=record.targetRef || {},group={sessionId:identity.id,sessionMissing:identity.missing,jobId:record.jobId || jobId,sessionName:target.sessionName || (target.sessionSnapshot || {}).name || (ref.type==='session' || target.type==='session'?target.name:'') || identity.id,agentId:target.agentId || '',lastEvaluatedAt:record.evaluatedAt || '',decision:'not_applicable',counts:{total:0,passed:0,failed:0,inconclusive:0,not_applicable:0},targetCounts:{session:0,trace:0,span:0,task_execution:0},objectCount:0,assessmentCount:0,latestAssessmentCount:0,runIds:[],latestRunId:record.runId || '',objectResults:[],history:[],assessments:[],latestAssessments:[],historicalAssessments:[],latestHistoricalAssessments:[],_objects:Object.create(null),_historical:Object.create(null)};
      groups.push(group);bySession[key]=group;return group;
    }
    runs.slice().reverse().forEach(function(run){
      (run.objectResults || []).slice().reverse().forEach(function(value){
        var record=Object.assign({jobId:run.jobId,runId:run.id,evaluatedAt:run.finishedAt},copy(value)),identity=sessionResultIdentity(record),source=(run.sourceSnapshots || []).filter(function(target){return target.type==='session' && (target.sessionId || target.id)===identity.id;})[0];
        if(source && record.targetSnapshot && !record.targetSnapshot.sessionName)record.targetSnapshot.sessionName=source.sessionName || source.name;
        var group=groupFor(record),key=resultLogicalKey(record);
        group.history.push(record);
        if(!own(group._objects,key)){group._objects[key]=record;group.objectResults.push(record);}
        (record.evaluatorResults || []).forEach(function(detail){if(detail.assessmentId){linked[detail.assessmentId]=true;byAssessment[detail.assessmentId]=group;}});
        if(group.runIds.indexOf(run.id)<0)group.runIds.push(run.id);
        if(!group.lastEvaluatedAt || timestamp(record.evaluatedAt)>timestamp(group.lastEvaluatedAt)){group.lastEvaluatedAt=record.evaluatedAt;group.latestRunId=run.id;}
      });
    });
    state.assessments.slice().reverse().filter(function(assessment){return (!jobId || assessment.jobId===jobId) && (!options.runId || assessment.runId===options.runId || own(linked,assessment.id));}).forEach(function(assessment){
      var group=groupFor(assessment,byAssessment[assessment.id]),key=canonical([resultLogicalKey(assessment),assessment.bindingId || (assessment.bindingSnapshot || {}).id || assessment.evaluatorRef]);
      group.assessments.push(copy(assessment));
      if(!own(linked,assessment.id)){
        group.historicalAssessments.push(copy(assessment));
        if(!own(group._historical,key)){group._historical[key]=assessment;group.latestHistoricalAssessments.push(copy(assessment));}
      }
      if(assessment.runId && (!options.runId || assessment.runId===options.runId) && group.runIds.indexOf(assessment.runId)<0)group.runIds.push(assessment.runId);
      if(!group.lastEvaluatedAt || timestamp(assessment.evaluatedAt)>timestamp(group.lastEvaluatedAt)){group.lastEvaluatedAt=assessment.evaluatedAt;group.latestRunId=assessment.runId || group.latestRunId;}
    });
    groups.forEach(function(group){
      var targetKeys=Object.create(null),assessmentIds=Object.create(null),latestKeys=Object.create(null),lookup=Object.create(null);
      group.assessments.forEach(function(assessment){lookup[assessment.id]=assessment;});
      function addTarget(record){var key=resultLogicalKey(record),type=(record.targetRef || {}).type || (record.targetSnapshot || {}).type || 'unknown';if(!own(targetKeys,key)){targetKeys[key]=true;group.objectCount++;group.targetCounts[type]=(group.targetCounts[type] || 0)+1;}}
      group.objectResults.forEach(function(record){addTarget(record);(record.evaluatorResults || []).forEach(function(detail){if(detail.assessmentId && lookup[detail.assessmentId] && !own(assessmentIds,detail.assessmentId)){assessmentIds[detail.assessmentId]=true;var assessment=lookup[detail.assessmentId];latestKeys[canonical([resultLogicalKey(assessment),assessment.bindingId || (assessment.bindingSnapshot || {}).id || assessment.evaluatorRef])]=true;group.latestAssessments.push(copy(assessment));}});});
      group.latestHistoricalAssessments=group.latestHistoricalAssessments.filter(function(assessment){return !own(latestKeys,canonical([resultLogicalKey(assessment),assessment.bindingId || (assessment.bindingSnapshot || {}).id || assessment.evaluatorRef]));});
      group.latestHistoricalAssessments.forEach(addTarget);
      group.counts=summarizeJobResults(group.objectResults);
      group.decision=group.counts.failed?'failed':group.counts.inconclusive?'inconclusive':group.counts.passed?'passed':'not_applicable';
      group.assessmentCount=group.assessments.length;group.latestAssessmentCount=group.latestAssessments.length+group.latestHistoricalAssessments.length;group.historicalAssessmentCount=group.historicalAssessments.length;
      delete group._objects;delete group._historical;
    });
    groups.sort(function(a,b){return (timestamp(b.lastEvaluatedAt) || 0)-(timestamp(a.lastEvaluatedAt) || 0) || a.sessionId.localeCompare(b.sessionId);});
    return groups;
  }
  function sessionResults(jobId, options) { var loaded=read();return loaded.ok?groupedSessionResults(loaded.state,jobId,options):[]; }
  function runPresentation(run, state) {
    var value=copy(run),local={runs:[value],assessments:state.assessments},sessions=groupedSessionResults(local,value.jobId,{runId:value.id});
    value.durationMs=Math.max(0,(timestamp(value.finishedAt) || 0)-(timestamp(value.startedAt) || 0));
    value.objectCounts=value.objectCounts || summarizeJobResults(value.objectResults || []);
    value.sessionCounts=Object.assign({scanned:null,matched:null,selected:unique((value.targetSnapshots || []).map(function(target){return target.sessionId || (target.type==='session'?target.id:'');}).filter(Boolean)).length,evaluated:sessions.length,passed:0,failed:0,inconclusive:0,not_applicable:0},value.sessionCounts || {});
    value.sessionCounts.total=value.sessionCounts.evaluated;
    sessions.forEach(function(session){if(own(value.sessionCounts,session.decision))value.sessionCounts[session.decision]++;});
    // Persisted counts already include these outcomes; never accumulate again during reads.
    if(run.sessionCounts && own(run.sessionCounts,'passed'))['passed','failed','inconclusive','not_applicable'].forEach(function(key){value.sessionCounts[key]=run.sessionCounts[key] || 0;});
    var assessments=state.assessments.filter(function(assessment){return assessment.runId===value.id || (value.assessmentIds || []).indexOf(assessment.id)>=0;}),reused=unique((value.objectResults || []).flatMap(function(result){return (result.evaluatorResults || []).filter(function(detail){return detail.reused && detail.assessmentId;}).map(function(detail){return detail.assessmentId;});}));
    value.executionCounts=value.executionCounts || {total:value.assessed || assessments.length,succeeded:assessments.filter(function(assessment){return assessment.executionStatus==='succeeded';}).length,failed:value.failedExecutions || 0,reused:reused.length};
    value.triggerReason=value.triggerReason || (value.trigger==='scheduled'?'定时批量':value.trigger==='automatic'?'自动触发':'手动触发');
    value.emptyReason=value.emptyReason || (!value.objectCounts.total?(value.scanned===0?'未找到符合筛选条件且已就绪的对象':value.eligible===0?'本次时间范围内没有符合条件的对象':value.pending===0 && (value.unchanged || value.alreadyEvaluated)?'命中对象均已评测，证据未变化，无需重复评测':value.sampled===0?'没有待评对象命中采样策略':'本次未生成新的评测结果'):'');
    return value;
  }
  function objectResultIdentity(job, state, target, task) {
    return digest({jobId:job.id,target:evidenceIdentity(target),task:task || null,policy:normalizedPassPolicy(job.passPolicy),compositeJudgeRuntime:job.passPolicy && job.passPolicy.type==='composite_policy' && job.passPolicy.mode==='custom_prompt'?job.judgeRuntime:undefined,selectedTasks:target.type==='session' && job.selector.targetType==='task_execution'?(job.taskSnapshots || []):undefined,bindings:applicableJobBindings(job,state,task).map(function(plan){return assessmentIdentity(job.id,plan.binding,plan.evaluator,target,task,job.judgeRuntime);})});
  }
  function logicalObjectIdentity(target, task) { return canonical([target.type,target.id,task && task.id]); }
  function objectEvidenceKey(target,task){return digest({target:evidenceIdentity(target),task:task || null});}
  function makeObjectResult(job, state, run, target, task, lookup, event, reasonCode) {
    var plans=reasonCode?[]:applicableJobBindings(job,state,task),actualAssessments=[],counts={total:0,passed:0,failed:0,inconclusive:0,observed:0},details=[];
    plans.forEach(function(plan){
      var identity=assessmentIdentity(job.id,plan.binding,plan.evaluator,target,task,job.judgeRuntime),assessment=lookup[identity],participates=gateBinding(plan),decision=assessment && assessment.executionStatus==='succeeded'?assessment.decision:'inconclusive';
      if(!participates)counts.observed++;else {counts.total++;if(['passed','failed'].indexOf(decision)>=0)counts[decision]++;else counts.inconclusive++;}
      actualAssessments.push(Object.assign({},copy(assessment || {executionStatus:'failed',decision:'inconclusive',metricResults:[]}),{bindingId:plan.binding.id,evaluatorRef:copy(plan.binding.evaluatorRef),evaluatorSnapshot:copy(plan.evaluator),bindingSnapshot:copy(plan.binding),role:participates?'gate':'observe',participates:participates}));
      details.push({bindingId:plan.binding.id,evaluatorRef:copy(plan.binding.evaluatorRef),assessmentId:assessment && assessment.id || null,decision:reasonCode?'not_evaluated':decision,participates:participates,reused:!!assessment && assessment.runId!==run.id});
    });
    var policy=normalizedPassPolicy(job.passPolicy),required=policy.type==='at_least'?policy.minPassed:counts.total,decision,reason;
    if(reasonCode==='TASK_NOT_MATCHED'){decision='failed';reason='候选会话未命中任一所选业务任务，按任务通过判定记为未通过；未执行评估器。';}
    else if(reasonCode==='TASK_RECOGNITION_INCONCLUSIVE'){decision='inconclusive';reason='业务任务识别不可用或证据不足，无法确认是否命中，未将识别异常当作未命中。';}
    else if(!counts.total){decision='not_applicable';reasonCode='NO_DECIDABLE_EVALUATORS';reason='没有适用且可判定的评估器，不产生自动通过。';}
    else if(counts.passed>=required){decision='passed';reasonCode='PASS_THRESHOLD_MET';reason='已通过 '+counts.passed+' / '+counts.total+' 个参与判定的评估器，达到 '+required+' 个通过门槛。';}
    else if(counts.passed+counts.inconclusive<required){decision='failed';reasonCode='PASS_THRESHOLD_UNREACHABLE';reason='已通过 '+counts.passed+' / '+counts.total+' 个评估器，即使待确认项全部通过也达不到 '+required+' 个通过门槛。';}
    else {decision='inconclusive';reasonCode='EVALUATOR_RESULTS_INCONCLUSIVE';reason='部分评估器缺少证据或执行异常，尚不能确定是否达到 '+required+' 个通过门槛。';}
    if(reasonCode==='TASK_NOT_MATCHED' || reasonCode==='TASK_RECOGNITION_INCONCLUSIVE') { counts.passed=0;counts.failed=0;counts.inconclusive=0; }
    var composite=policy.type==='composite_policy'&&!reasonCode?.startsWith('TASK_')?evaluateCompositePolicy(policy,actualAssessments,{ownerRef:{type:'evaluation_job',id:job.id,revision:job.revision},targetRef:{type:target.type,id:target.id,snapshotId:target.snapshotId},runId:run.id,judgeRuntimeSnapshot:run.judgeRuntimeSnapshot || job.judgeRuntime,demoEvidence:copy(target.demoEvidence),targetOutput:copy(target.output),targetInput:copy(target.input),targetReference:copy(target.reference)}):null;
    if(composite){decision=composite.decision;reason=composite.policyResult.reason;reasonCode=decision==='passed'?'COMPOSITE_POLICY_PASSED':decision==='failed'?'COMPOSITE_POLICY_FAILED':decision==='not_applicable'?'NO_DECIDABLE_EVALUATORS':'COMPOSITE_POLICY_INCONCLUSIVE';counts=composite.counts;required=composite.required;}
    var contentKey=objectResultIdentity(job,state,target,task),dedupKey=event && event.type!=='ready'?canonical([contentKey,event.id]):contentKey;
    var result={id:'UO-'+digest([run.id,dedupKey]).slice(0,20),jobId:job.id,runId:run.id,evaluatedAt:run.finishedAt,targetRef:{type:target.type,id:target.id,snapshotId:target.snapshotId},targetSnapshot:copy(target),taskRef:task?{id:task.id,version:task.version}:null,taskSnapshot:copy(task),selectedTaskRefs:job.selector.targetType==='task_execution'?(job.taskSnapshots || []).map(function(item){return {id:item.id,version:item.version};}):undefined,decision:decision,passPolicySnapshot:copy(policy),counts:counts,required:required,evaluatorResults:details,reasonCode:reasonCode,reason:reason,sourceSessionId:target.sessionId || target.id,triggerReason:run.triggerReason,triggerEventId:event && event.type!=='ready'?event.id:null,contentKey:contentKey,dedupKey:dedupKey,logicalKey:logicalObjectIdentity(target,task),evidenceKey:objectEvidenceKey(target,task)};
    if(composite){result.policyResult=copy(composite.policyResult);if(composite.summaryResult)result.summaryResult=copy(composite.summaryResult);if(composite.finalJudgeInputSnapshot)result.finalJudgeInputSnapshot=copy(composite.finalJudgeInputSnapshot);if(composite.finalJudgeResult)result.finalJudgeResult=copy(composite.finalJudgeResult);}
    return result;
  }
  function validateJob(draft, state) {
    var errors = [], job = draft || {}, selector = job.selector || {}, schedule = job.schedule || {}, sampling = job.sampling || {};
    if (!text(job.name)) problem(errors, 'name', '请填写任务名称');
    if (!text(selector.agentId) || TARGETS.indexOf(selector.targetType) < 0 || selector.targetType === 'case_output') problem(errors, 'selector', '在线任务须选择 Agent 及有效在线评估对象');
    if (selector.targetType === 'task_execution' && (!Array.isArray(selector.taskIds) || !selector.taskIds.length)) problem(errors, 'selector.taskIds', '业务执行评测须明确选择至少一个业务任务');
    if (selector.targetType === 'task_execution') {
      var taskCatalog = job.taskSnapshots || tasks();
      (selector.taskIds || []).forEach(function (id) {
        var task = taskCatalog.filter(function (item) { return item.id === id; })[0];
        if (!task || selector.sceneId && sceneId(task.sceneId || task.scene) !== sceneId(selector.sceneId) || [task.agentId, task.sourceAgentId].filter(Boolean).indexOf(selector.agentId) < 0) problem(errors, 'selector.taskIds', '所选业务任务不存在，或不属于当前场景和 Agent');
      });
    }
    if (!job.trigger || ['manual', 'scheduled', 'automatic'].indexOf(job.trigger.mode) < 0) problem(errors, 'trigger', '请选择有效运行方式');
    if (job.trigger && job.trigger.mode === 'automatic' && (!Array.isArray(job.trigger.events) || !job.trigger.events.length || job.trigger.events.some(function (event) { return ['ready', 'negative_feedback', 'negative_sentiment', 'evaluation_result'].indexOf(event) < 0; }))) problem(errors, 'trigger.events', '请至少选择一种有效自动触发事件');
    if (job.trigger && job.trigger.mode === 'scheduled' && schedule.repeat === 'manual') problem(errors, 'schedule', '定时批量评测须选择运行周期');
    if (!job.reEvaluation || ['on_change', 'first_only'].indexOf(job.reEvaluation.mode) < 0) problem(errors, 'reEvaluation', '请选择已评对象的处理方式');

    if (!Number.isFinite(sampling.rate) || sampling.rate < 0 || sampling.rate > 100) problem(errors, 'sampling', '采样比例须为 0–100%');
    if (!Array.isArray(job.bindings) || !job.bindings.length || unique((job.bindings || []).map(function (b) { return b.id; })).length !== (job.bindings || []).length) problem(errors, 'bindings', '请配置至少一个不重复的评估器绑定');
    (job.bindings || []).forEach(function (binding) {
      var ref = binding.evaluatorRef || {}, evaluator = resolve(state, ref.id, ref.version), task = binding.taskRef && (job.taskSnapshots || []).filter(function (t) { return t.id === binding.taskRef.id && t.version === binding.taskRef.version; })[0];
      errors = errors.concat(bindingErrors(binding, task ? { task: task } : null, evaluator, true));
      if (binding.targetType !== selector.targetType) problem(errors, 'bindings', '绑定粒度须与任务粒度一致');
      if (selector.targetType === 'task_execution' && binding.taskRef && (!Array.isArray(selector.taskIds) || selector.taskIds.indexOf(binding.taskRef.id) < 0)) problem(errors, 'bindings.taskRef', '评估器绑定的业务任务“' + (task && task.name || binding.taskRef.id) + '”已不在所选范围内，请重新选择适用范围');
    });
    (job.bindings || []).forEach(function(binding,index){
      var ref=binding.evaluatorRef || {};if(!ref.id || !ref.version)return;
      (job.bindings || []).slice(0,index).forEach(function(prior){
        var priorRef=prior.evaluatorRef || {};if(priorRef.id!==ref.id || priorRef.version!==ref.version)return;
        var scopes=selector.targetType==='task_execution'?(selector.taskIds || []).filter(function(taskId){return (!binding.taskRef || binding.taskRef.id===taskId)&&(!prior.taskRef || prior.taskRef.id===taskId);}):['current'];
        if(!scopes.length)return;
        var evaluator=resolve(state,ref.id,ref.version),scopeLabel=selector.targetType==='task_execution'?scopes.map(function(id){var task=(job.taskSnapshots || []).filter(function(item){return item.id===id;})[0];return task && task.name || id;}).join('、'):'当前评估对象';
        problem(errors,'bindings.duplicate','评估器“'+(evaluator && evaluator.name || ref.id)+'”（'+ref.version+'）在重叠范围“'+scopeLabel+'”中重复配置，请保留一个配置，或明确选择不同业务任务范围');
      });
    });
    var passPolicy=normalizedPassPolicy(job.passPolicy);
    if(passPolicy.type==='composite_policy'){
      var policyScopes=selector.targetType==='task_execution'?(job.taskSnapshots || []).filter(function(task){return (selector.taskIds || []).indexOf(task.id)>=0;}):[null];
      policyScopes.forEach(function(task){var scoped=applicableJobBindings(job,state,task).map(function(plan){return Object.assign({},plan.binding,{evaluatorSnapshot:plan.evaluator});});validateCompositePolicy(passPolicy,scoped).forEach(function(error){problem(errors,(error.field || error.path || 'policy').replace(/^policy/,'passPolicy'),(task?'业务任务“'+task.name+'”：':'')+error.message);});});
    }else {
    if(['all','at_least'].indexOf(passPolicy.type)<0)problem(errors,'passPolicy','请选择全部通过或部分通过的任务判定方式');
    if(passPolicy.type==='at_least'){
      var scopes=selector.targetType==='task_execution'?(job.taskSnapshots || []).filter(function(task){return (selector.taskIds || []).indexOf(task.id)>=0;}):[null];
      if(!Number.isInteger(passPolicy.minPassed)||passPolicy.minPassed<1)problem(errors,'passPolicy.minPassed','至少通过评估器数量须为正整数');
      else scopes.forEach(function(task){var total=applicableJobBindings(job,state,task).filter(gateBinding).length;if(passPolicy.minPassed>total)problem(errors,'passPolicy.minPassed',(task?'业务任务“'+task.name+'”的':'')+'适用可判定评估器仅 '+total+' 个，通过门槛不可达');});
    }
    }
    if (passPolicy.type==='composite_policy'&&passPolicy.mode==='custom_prompt' || (job.bindings || []).some(function (binding) { var ref = binding.evaluatorRef || {}, e = resolve(state, ref.id, ref.version); return e && e.method.type === 'llm_judge'; })) errors = errors.concat(validateJudgeRuntime(job.judgeRuntime));
    if (['manual', 'once', 'interval', 'daily', 'weekly', 'monthly'].indexOf(schedule.repeat) < 0) problem(errors, 'schedule', '请选择有效的浏览器 Mock 调度方式');
    if (['daily', 'weekly', 'monthly'].indexOf(schedule.repeat) >= 0 && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time || '')) problem(errors, 'schedule.time', '执行时间须为 HH:mm');
    if (schedule.repeat === 'interval' && (!Number.isFinite(schedule.intervalHours) || schedule.intervalHours <= 0)) problem(errors, 'schedule.intervalHours', '间隔小时数须大于 0');
    if (schedule.repeat === 'once' && !Number.isFinite(timestamp(schedule.onceAt))) problem(errors, 'schedule.onceAt', '请选择单次执行时间');
    if (schedule.repeat === 'weekly' && (!Array.isArray(schedule.weekdays) || !schedule.weekdays.length || schedule.weekdays.some(function (d) { return !Number.isInteger(d) || d < 1 || d > 7; }))) problem(errors, 'schedule.weekdays', '请设置周一至周日的执行日期');
    if (schedule.repeat === 'monthly' && (!Array.isArray(schedule.monthdays) || !schedule.monthdays.length || schedule.monthdays.some(function (d) { return !Number.isInteger(d) || d < 1 || d > 31; }))) problem(errors, 'schedule.monthdays', '请设置 1–31 日的执行日期');
    if (job.readiness && (['any', 'idle', 'completed'].indexOf(job.readiness.mode) < 0 || job.readiness.mode === 'idle' && (!Number.isFinite(job.readiness.idleMinutes) || job.readiness.idleMinutes < 0))) problem(errors, 'readiness', '请设置有效的会话就绪条件');
    var activeSelector = activeJobSelector(job), filter = activeSelector.filter || {};
    if (filter.status && ['all', 'completed', 'error'].indexOf(filter.status) < 0 || filter.text != null && typeof filter.text !== 'string') problem(errors, 'selector.filter', '请设置有效的结构化筛选条件');
    errors = errors.concat(filterErrors(activeSelector));
    if (job.trigger && (job.trigger.events || []).indexOf('evaluation_result') >= 0 && job.trigger.mode === 'automatic') { var condition = job.trigger.evaluationCondition || {}; if (!text(condition.key) || ['equals','not_equals','gte','lte','gt','lt'].indexOf(condition.operator) < 0 || !content(condition.value)) problem(errors, 'trigger.evaluationCondition', '请填写评估结果的指标、条件与阈值'); }
    if (selector.sceneId != null && typeof selector.sceneId !== 'string') problem(errors, 'selector.sceneId', '场景须为有效标识，留空表示全局');
    return errors;
  }
  function effectiveJob(record, state) {
    var result = copy(record), selector = result.selector || {};
    result.selector = Object.assign({ sceneId: '', agentId: '', targetType: 'session', taskIds: [], spanTypes: [] }, selector);
    result.selector.sceneId = selector.sceneId === 'all' ? '' : selector.sceneId || '';
    result.selector.filter = normalizeJobFilter(selector);
    result.sampling = { rate: result.sampling && result.sampling.rate != null ? result.sampling.rate : 100, seed: result.sampling && result.sampling.seed || result.id || 'draft' };
    result.schedule = Object.assign(scheduleDefaults(), result.schedule || {}, { timezone: 'Asia/Shanghai' });
    result.readiness = Object.assign({ mode: 'any', idleMinutes: 10 }, result.readiness || {});
    result.trigger = Object.assign({ inherited: !result.trigger, mode: result.schedule.repeat === 'manual' ? 'manual' : 'scheduled', events: ['ready'], evaluationCondition: { key: '', operator: 'lte', value: 0 } }, result.trigger || {});
    if (result.trigger.inherited) result.trigger.mode = result.schedule.repeat === 'manual' ? 'manual' : 'scheduled';
    result.reEvaluation = Object.assign({ mode: 'on_change' }, result.reEvaluation || {});
    result.passPolicy = normalizedPassPolicy(result.passPolicy);
    result.incrementalSince = result.incrementalSince || result.createdAt;
    result.bindings = (result.bindings || []).map(function (binding) { var ref = binding.evaluatorRef || {}; return automaticBinding(binding, resolve(state, ref.id, ref.version), true); });
    var judges = result.bindings.map(function (binding) { return resolve(state, binding.evaluatorRef.id, binding.evaluatorRef.version); }).filter(function (e) { return e && e.method.type === 'llm_judge'; });
    result.judgeRuntime = judges.length || result.passPolicy.type==='composite_policy'&&result.passPolicy.mode==='custom_prompt' ? normalizeJudgeRuntime(result.judgeRuntime, judges.length?judges[0].method:undefined) : null;
    return result;
  }
  function saveJob(draft, id, options) { return transact(function (state) {
    var prior = id ? state.jobs.filter(function (j) { return j.id === id; })[0] : null; if (id && !prior) return { ok: false, error: '在线评测任务不存在' };
    var record = copy(draft || {}); record.selector = Object.assign({ sceneId: '', agentId: '', targetType: 'session', taskIds: [], spanTypes: [], filter: { text: '', status: 'all' } }, record.selector || {});
    record.selector.taskIds = Array.isArray(record.selector.taskIds) ? unique(record.selector.taskIds) : []; record.selector.spanTypes = Array.isArray(record.selector.spanTypes) ? unique(record.selector.spanTypes) : [];
    record = effectiveJob(record, state);
    var availableTasks = tasks(), frozenTasks = prior && prior.taskSnapshots || [];
    record.taskSnapshots = unique(record.selector.taskIds.concat((record.bindings || []).map(function (b) { return b.taskRef && b.taskRef.id; }).filter(Boolean))).map(function (taskId) {
      var ref = (record.bindings || []).map(function (b) { return b.taskRef; }).filter(function (r) { return r && r.id === taskId; })[0];
      return frozenTasks.filter(function (t) { return t.id === taskId && (!ref || t.version === ref.version); })[0] || availableTasks.filter(function (t) { return t.id === taskId && (!ref || t.version === ref.version); })[0];
    }).filter(Boolean);
    var errors = validateJob(record, state).concat(options && options.historicalImport?[]:authoringPolicyErrors(record,'job')); if (errors.length) return fail(errors);
    record.id = prior ? prior.id : 'UJ-' + digest([clock(), state.revision, record.name]).slice(0, 16); record.enabled = record.enabled !== false;
    record.revision = prior ? prior.revision + 1 : 1; record.createdAt = prior ? prior.createdAt : clock(); record.incrementalSince = prior ? prior.incrementalSince || prior.createdAt : record.createdAt; record.updatedAt = clock(); record.armedAt = clock();
    if (prior) state.jobs[state.jobs.indexOf(prior)] = record; else state.jobs.unshift(record); return { ok: true, record: record };
  }); }
  function setJobEnabled(id, enabled) { return transact(function (state) { var j = state.jobs.filter(function (item) { return item.id === id; })[0]; if (!j) return { ok: false, error: '在线评测任务不存在' }; j.enabled = !!enabled; j.revision++; j.armedAt = clock(); j.updatedAt = clock(); return { ok: true, record: j }; }); }
  function deleteJob(id) { return transact(function (state) { var index = state.jobs.findIndex(function (j) { return j.id === id; }); if (index < 0) return { ok: false, error: '在线评测任务不存在' }; state.jobs.splice(index, 1); return { ok: true }; }); }
  function conversation(row) {
    if(row && row.evaluationDemoSource===true && row.conversation && typeof host.evaluationDemoJudge==='function')return {rounds:copy(row.conversation.rounds || []),records:copy(row.conversation.records || [])};
    var supplied = global.AIOpsSessionDetail && typeof global.AIOpsSessionDetail.data === 'function' ? global.AIOpsSessionDetail.data(row) : row.conversation || {};
    return Array.isArray(supplied) ? { rounds: copy(supplied), records: [] } : { rounds: copy(supplied.rounds || []), records: copy(supplied.records || []) };
  }
  function recordedModel(record) {
    record = record || {}; var model = record.model, attributes = record.attributes || {}, value = null, field = '';
    if (text(record.modelRef)) { value = text(record.modelRef); field = 'modelRef'; }
    else if (text(record.modelId)) { value = text(record.modelId); field = 'modelId'; }
    else if (typeof model === 'string' && text(model)) { value = text(model); field = 'model'; }
    else if (model && typeof model === 'object') { value = text(model.modelRef) || text(model.id) || text(model.name) || null; field = value ? 'model.' + (text(model.modelRef) ? 'modelRef' : text(model.id) ? 'id' : 'name') : ''; }
    if (!value) ['gen_ai.response.model', 'gen_ai.request.model', 'llm.model_name'].some(function (key) { if (text(attributes[key])) { value = text(attributes[key]); field = 'attributes.' + key; return true; } return false; });
    var provider = text(record.provider) || model && typeof model === 'object' && text(model.provider) || text(attributes['gen_ai.provider.name']) || null;
    var parameters = record.parameters || record.modelParameters || model && typeof model === 'object' && model.parameters;
    return { modelRef: value, provider: provider, parameters: parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? copy(parameters) : {}, field: field || 'model_metadata_missing' };
  }
  function modelSummary(calls, declared) {
    var models = [], unknown = calls.filter(function (call) { return !call.modelRef; }).length;
    function add(value, source) {
      if (!value.modelRef) return;
      var key = canonical([value.modelRef, value.provider, value.parameters]), prior = models.filter(function (item) { return canonical([item.modelRef, item.provider, item.parameters]) === key; })[0];
      if (!prior) { prior = { modelRef: value.modelRef, provider: value.provider || null, parameters: copy(value.parameters || {}), sourceRefs: [] }; models.push(prior); }
      if (!prior.sourceRefs.some(function (ref) { return canonical(ref) === canonical(source); })) prior.sourceRefs.push(copy(source));
    }
    calls.forEach(function (call) { add(call, call.source); }); (declared || []).forEach(function (item) { add(item, item.source); });
    var refs = unique(models.map(function (item) { return item.modelRef; }));
    return { mode: 'observed', source: 'session_records', resolution: !models.length ? 'unknown' : unknown ? 'partial' : 'resolved', modelRef: refs.length === 1 ? refs[0] : null, parameters: models.length === 1 ? copy(models[0].parameters) : {}, models: models, calls: copy(calls), unknownCalls: unknown, executionMode: 'not_invoked' };
  }
  function observedModels(target) {
    target = target || {}; var calls = [], declared = [], trajectory = target.trajectory || [];
    trajectory.forEach(function (record, index) {
      if (['model', 'llm', 'generation'].indexOf(String(record.type || record.kind || '').toLowerCase()) < 0) return;
      var recorded = recordedModel(record), id = String(record.id || target.id + ':model-record:' + index);
      calls.push({ id: id, modelRef: recorded.modelRef, provider: recorded.provider, parameters: recorded.parameters, source: { kind: 'span', id: id, field: recorded.field } });
    });
    if (target.sourceModel) { var value = recordedModel(target.sourceModel); if (value.modelRef) declared.push({ modelRef: value.modelRef, provider: value.provider, parameters: value.parameters, source: { kind: 'session', id: String(target.sessionId || target.id), field: value.field } }); }
    return modelSummary(calls, declared);
  }
  function combinedObservedModels(targets) {
    var calls = [], declared = [], keys = Object.create(null);
    targets.forEach(function (target) { var snapshot = observedModels(target); snapshot.calls.forEach(function (call) { var key = canonical([call.id, call.source]); if (!own(keys, key)) { keys[key] = true; calls.push(call); } }); snapshot.models.forEach(function (model) { model.sourceRefs.filter(function (ref) { return ref.kind === 'session'; }).forEach(function (source) { declared.push({ modelRef: model.modelRef, provider: model.provider, parameters: model.parameters, source: source }); }); }); });
    return modelSummary(calls, declared);
  }
  function sceneId(value) { return value === 'sales-app' ? 'sales' : value === 'procurement-app' ? 'procurement' : value; }
  function sourceAgents(catalog) {
    var business = global.AIOpsBusinessTasks, definitions = (catalog || []).slice();
    if (business && typeof business.catalog === 'function') definitions = definitions.concat(business.catalog() || []);
    // Historical task definitions retain the source Agent names used by existing session rows.
    // Once authored tasks replace catalog(), recover those definitions through read-only records.
    if (business && typeof business.records === 'function' && typeof business.definition === 'function') {
      unique((business.records() || []).map(function (record) { return record.taskId; }).filter(Boolean)).forEach(function (id) { var task = business.definition(id); if (task) definitions.push(task); });
    }
    var values = definitions.map(function (task) { return { id: task.agentId, sourceId: task.sourceAgentId, name: task.agent, sceneId: task.sceneId || task.scene }; });
    var scenes = global.AIOpsWorkspaces && global.AIOpsWorkspaces.scopeCatalog ? global.AIOpsWorkspaces.scopeCatalog() : [];
    scenes.forEach(function (scene) { (scene.items || []).filter(function (item) { return item.type === 'Agent'; }).forEach(function (item) { values.push({ id: item.id, name: item.name, sceneId: scene.id }); }); });
    return values;
  }
  function rowMatches(row, selector, catalog, knownAgents) {
    var related = catalog.filter(function (t) { return t.agentId === selector.agentId || t.sourceAgentId === selector.agentId; });
    var agents = unique([selector.agentId].concat(related.flatMap(function (t) { return [t.agentId, t.sourceAgentId, t.agent]; }).filter(Boolean)));
    (knownAgents || sourceAgents(catalog)).filter(function (agent) { return agent.id === selector.agentId || agent.sourceId === selector.agentId; }).forEach(function (agent) { agents.push(agent.id, agent.sourceId, agent.name); });
    agents = agents.filter(Boolean);
    if (![row.agentId, row.sourceAgentId, row.agent].filter(Boolean).some(function (agent) { return agents.indexOf(agent) >= 0; })) return false;
    return !selector.sceneId || selector.sceneId === 'all' || !row.sceneId && !row.scene || [sceneId(row.sceneId), sceneId(row.scene)].indexOf(sceneId(selector.sceneId)) >= 0;
  }
  function filterFields(targetType) {
    function field(id, label, type, options) { return { id: id, label: label, type: type || 'string', operators: type === 'number' ? ['equals','not_equals','gte','lte','gt','lt','exists'] : type === 'boolean' ? ['equals','not_equals'] : ['contains','equals','not_equals','exists'], options: options }; }
    var common = [field('name',targetType==='session'||targetType==='task_execution'?'会话名称':targetType==='trace'?'Trace 名称':'Span 名称'),field('status','对象状态','string',[{value:'completed',label:'正常结束'},{value:'running',label:'执行中'},{value:'error',label:'有错误'}]),field('ended','对象已结束','boolean'),field('hasError','对象包含错误','boolean'),field('keyword','关键词'),field('environment','环境'),field('agentVersion','Agent 版本'),field('tags','标签'),field('input','输入内容'),field('output','输出内容'),field('sessionName','所属会话名称')];
    if (targetType === 'span') return common.concat([field('spanType','Span 类型','string',[{value:'tool',label:'工具调用'},{value:'model',label:'模型调用'},{value:'agent',label:'Agent'}]),field('model','模型'),field('toolName','工具名称'),field('durationMs','耗时（毫秒）','number'),field('tokens','Token 数','number')]);
    return common.concat((targetType === 'session' || targetType === 'task_execution' ? [field('turnCount','会话轮数','number')] : [field('tokens','Token 数','number')]).concat([field('durationMs','耗时（毫秒）','number'),field('containsTool','包含工具调用'),field('containsSpan','包含 Span 名称')]));
  }
  function normalizeJobFilter(selector) {
    var previous = selector && selector.filter || {}, filter = {text: previous.text == null ? '' : previous.text, status: previous.status || 'all', logic: previous.logic || 'all', conditions: previous.conditions == null ? [] : copy(previous.conditions)};
    if (!Array.isArray(filter.conditions)) return filter;
    // Legacy controls were conjuncts outside the all/any group. Keep their scope explicit
    // when moving them into the single condition builder, especially for an OR group.
    function required(field, operator, value, key) {
      filter.conditions.push({id:'legacy-'+key+'-'+digest([field,operator,value]).slice(0,10),field:field,operator:operator,value:value,required:true});
    }
    if (filter.status === 'completed') { required('ended','equals',true,'status'); filter.status = 'all'; }
    else if (filter.status === 'error') { required('hasError','equals',true,'status'); filter.status = 'all'; }
    if (typeof filter.text === 'string' && filter.text.length) { required('keyword','contains',filter.text,'keyword'); filter.text = ''; }
    return filter;
  }
  function filterErrors(selector) {
    var errors = [], filter = selector.filter || {}, fields = filterFields(selector.targetType);
    if (filter.logic && ['all','any'].indexOf(filter.logic) < 0) problem(errors,'selector.filter.logic','请选择全部满足或任一满足');
    if (filter.conditions != null && !Array.isArray(filter.conditions)) { problem(errors,'selector.filter.conditions','筛选条件须为有效列表'); return errors; }
    (filter.conditions || []).forEach(function (condition) {
      var field = fields.filter(function (item) { return item.id === condition.field; })[0];
      if (!field || condition.required != null && typeof condition.required !== 'boolean' || field.operators.indexOf(condition.operator) < 0 || condition.operator !== 'exists' && (!content(condition.value) && !(condition.field === 'keyword' && condition.required === true && typeof condition.value === 'string' && condition.value.length) || field.type === 'number' && !Number.isFinite(Number(condition.value)) || field.type === 'boolean' && [true,false,'true','false'].indexOf(condition.value) < 0)) problem(errors,'selector.filter.conditions','筛选字段、运算符或值不适用于当前评估对象');
    }); return errors;
  }
  function sourceValues(target, row, data, source) {
    source = source || {}; var trajectory = target.trajectory || [], attributes = source.attributes || {}, metadata = source.metadata || row.metadata || {};
    var duration = source.durationMs != null ? source.durationMs : source.latencyMs != null ? source.latencyMs : source.duration != null ? source.duration : null;
    if (duration == null) { var began = timestamp(source.startedAt || source.inputAt || row.startedAt), ended = timestamp(source.endedAt || source.finishedAt || source.outputAt || target.activityAt); if (Number.isFinite(began) && Number.isFinite(ended)) duration = Math.max(0, ended - began); }
    return { name: target.name || row.name || target.id, status: target.error ? 'error' : target.running ? 'running' : target.completed ? 'completed' : source.status || 'unknown', ended: !!target.completed, hasError: !!target.error, keyword: canonical({row:row,conversation:data}), environment: source.environment || row.environment || metadata.environment, agentVersion: source.agentVersion || row.agentVersion || metadata.agentVersion, tags: source.tags || row.tags || metadata.tags, input: typeof target.input === 'string' ? target.input : canonical(target.input), output: typeof target.output === 'string' ? target.output : canonical(target.output), sessionName: row.name || row.id, turnCount: data.rounds.length, durationMs: duration, tokens: row.evaluationDemoSource===true && source.usage && source.usage.totalTokens!=null?source.usage.totalTokens:source.tokens != null ? source.tokens : source.usage && (source.usage.totalTokens || source.usage.total_tokens) || attributes['llm.token_count.total'], spanType: source.type || source.kind, model: recordedModel(source).modelRef, toolName: source.toolName || source.tool || attributes['tool.name'] || (source.type === 'tool' ? source.name : undefined), containsTool: trajectory.filter(function (record) { return record.type === 'tool'; }).map(function (record) { return record.toolName || record.tool || record.name || ''; }), containsSpan: trajectory.map(function (record) { return record.name || record.id; }) };
  }
  function matchesConditions(values, filter, type) {
    var fields = filterFields(type), required = [], outcomes = [];
    (filter.conditions || []).forEach(function (condition) {
      function record(outcome) { (condition.required === true ? required : outcomes).push(outcome); }
      var field = fields.filter(function (item) { return item.id === condition.field; })[0], left = values[condition.field], right = condition.value;
      if (!field) { record(false); return; }
      if (field.type === 'number') { left = left == null ? undefined : Number(left); right = Number(right); }
      if (field.type === 'boolean') right = right === true || right === 'true';
      if (Array.isArray(left) && condition.operator === 'contains' && typeof right === 'string') { record(left.some(function (item) { return String(item).toLowerCase().indexOf(right.toLowerCase()) >= 0; })); return; }
      if (condition.operator === 'contains' && typeof left === 'string') { record(left.toLowerCase().indexOf(String(right).toLowerCase()) >= 0); return; }
      record(compare(left, condition.operator, right) === true);
    }); return required.every(Boolean) && (!outcomes.length || (filter.logic === 'any' ? outcomes.some(Boolean) : outcomes.every(Boolean)));
  }
  function readyState(target, readiness) {
    readiness = readiness || {mode:'any'};
    if (readiness.mode === 'completed') return { ready: !!target.completed && !target.running, reason: target.running ? '等待执行结束' : !target.completed ? '等待结束事件' : '已结束，可评测' };
    if (readiness.mode === 'idle') { var at = timestamp(target.activityAt), elapsed = Date.parse(clock()) - at; return { ready: !target.running && Number.isFinite(at) && elapsed >= readiness.idleMinutes * 60000, reason: target.running ? '仍有执行中的步骤' : !Number.isFinite(at) ? '缺少活动时间，无法判断空闲' : elapsed < readiness.idleMinutes * 60000 ? '等待空闲 ' + readiness.idleMinutes + ' 分钟' : '已达到空闲时长' }; }
    return { ready: true, reason: '数据已到达' };
  }
  function sampledTarget(job, target) { return parseInt(digest([job.sampling.seed || job.id || 'draft', target.sessionId && job.selector.targetType === 'task_execution' ? target.sessionId : target.id]).slice(0, 8), 16) / 4294967296 * 100 < job.sampling.rate; }
  function previewJob(draft, options) {
    options = options || {}; var loaded = read(); if (!loaded.ok) return loaded;
    try {
      var job = effectiveJob(draft || {}, loaded.state), errors = filterErrors(activeJobSelector(job));
      if (!text(job.selector.agentId)) problem(errors,'selector.agentId','请先选择 Agent');
      if (errors.length) return fail(errors);
      var supplied = collectTargets(job, copy(host.sessions ? host.sessions() : []), tasks(), {includeWaiting:true,businessCandidates:job.selector.targetType === 'task_execution'}), seen = Object.create(null);
      var items = supplied.filter(function (item) { var key=canonical([item.target.type,item.target.id]);if(seen[key])return false;seen[key]=true;return true; }).map(function (item) { return {id:item.target.id,sessionId:item.target.sessionId,name:item.target.name,type:item.target.type,ready:item.ready,sampled:sampledTarget(job,item.target),reason:item.reason,input:copy(item.target.input),output:copy(item.target.output),activityAt:item.target.activityAt,recognition:job.selector.targetType === 'task_execution'?'pending':undefined}; });
      var summary = {candidateCount:items.length,readyCount:items.filter(function(item){return item.ready;}).length,waitingCount:items.filter(function(item){return !item.ready;}).length,sampledCount:items.filter(function(item){return item.ready&&item.sampled;}).length,taskRecognitionPending:job.selector.targetType === 'task_execution'};
      return {ok:true,summary:summary,items:items.slice(0,Math.max(1,Math.min(100,Number(options.limit)||20))),truncated:items.length>(Number(options.limit)||20),source:'browser-mock'};
    } catch(error) { return {ok:false,error:error.message || '数据预览失败'}; }
  }
  function collectTargets(job, rows, catalog, options) {
    options = options || {};
    var result = [], selector = activeJobSelector(job), targetType = options.businessCandidates && selector.targetType === 'task_execution' ? 'session' : selector.targetType, current = Date.parse(clock()), knownAgents = sourceAgents(catalog);
    rows.filter(function (row) { return rowMatches(row, selector, catalog, knownAgents); }).forEach(function (row) {
      var data = conversation(row), rounds = data.rounds, records = data.records;
      var lastAt = activity(objectTimes(row).concat(rounds.flatMap(objectTimes), records.flatMap(objectTimes),options.businessCandidates && Array.isArray(row.taskExecutions)?row.taskExecutions.flatMap(objectTimes):[]));
      var completed = !!row.endedAt || row.sessionEnded === true || ['completed', 'closed', 'ended', 'failed', 'error', 'cancelled', 'canceled', 'timeout', '已结束', '已完成'].indexOf(row.status) >= 0;
      var filter = selector.filter || {}, error = ['failed','error','timeout'].indexOf(row.status) >= 0 || !!(row.errors || row.warnings) || records.some(function (record) { return ['failed', 'error', 'warning'].indexOf(record.status) >= 0; });
      if (filter.text && canonical({ row: row, conversation: data }).toLowerCase().indexOf(String(filter.text).toLowerCase()) < 0) return;
      function add(target, task) {
        if (filter.status === 'completed' && !target.completed || filter.status === 'error' && !target.error) return;
        var readiness = readyState(target, job.readiness); if (!readiness.ready && !options.includeWaiting) return;
        target.type = targetType; target.sessionId = row.id; target.sessionName = row.name || row.id; target.agentId = row.agentId || selector.agentId; target.name = target.name || row.name || target.id;
        var evidenceSource = targetType === 'span' ? records.filter(function (record) { return record.id === target.id; })[0] : targetType === 'trace' ? rounds.filter(function (turn) { return target.messages && target.messages[0] && turn.inputId === target.messages[0].id; })[0] : targetType === 'task_execution' ? (executions || []).filter(function (execution) { return execution.id === target.id; })[0] : row;
        evidenceSource = evidenceSource || {}; if (!matchesConditions(sourceValues(target,row,data,evidenceSource), filter, selector.targetType)) return; var coverage = copy(evidenceSource.evidenceCompleteness || {});
        if (!own(coverage, 'targetType')) coverage.targetType = targetType;
        if (!own(coverage, 'messages')) coverage.messages = Array.isArray(target.messages) && target.messages.length ? 'complete' : 'unknown';
        if (!own(coverage, 'trajectory')) coverage.trajectory = Array.isArray(target.trajectory) && target.trajectory.length ? 'complete' : 'unknown';
        if (evidenceSource.messagesTruncated || evidenceSource.truncated || data.truncated || row.truncated) coverage.messages = 'partial';
        if (evidenceSource.trajectoryTruncated || evidenceSource.truncated || data.truncated || row.truncated) coverage.trajectory = 'partial';
        target.evidenceCompleteness = coverage;if(row.evaluationDemoSource===true && typeof host.evaluationDemoJudge==='function'){target.demoEvidence=copy(row.demoEvidence);if(Array.isArray(row.inputAttachments)&&row.inputAttachments.length&&typeof target.input==='string')target.input={text:target.input,attachments:copy(row.inputAttachments)};}
        if (targetType === 'session' && recordedModel(row).modelRef) { target.sourceModel = {}; ['modelRef', 'modelId', 'model', 'provider', 'parameters', 'modelParameters', 'attributes'].forEach(function (key) { if (own(row, key)) target.sourceModel[key] = copy(row[key]); }); }
        target.snapshotId = 'SNAP-' + digest(target).slice(0, 24); result.push({ target: target, task: task || undefined, ready:readiness.ready, reason:readiness.reason });
      }
      function messages(turns) { return turns.flatMap(function (turn) { return [{ id: turn.inputId, role: 'user', content: turn.input || '' }].concat(turn.hasOutput === false || !turn.output ? [] : [{ id: turn.outputId, role: 'assistant', content: turn.output }]); }); }
      if (targetType === 'session') add({ id: row.id, activityAt: lastAt, completed: completed, running: records.some(function (r) { return ['running', 'pending', 'in_progress'].indexOf(r.status) >= 0; }), error: error, input: rounds.map(function (turn) { return turn.input || ''; }).join('\n'), output: rounds.map(function (turn) { return turn.output || ''; }).join('\n'), reference: copy(row.reference), context: copy(row.context), messages: messages(rounds), trajectory: records, evidenceRefs: messages(rounds).map(function (m) { return m.id; }).filter(Boolean) });
      if (targetType === 'trace') rounds.forEach(function (turn, index) { var trajectory = records.filter(function (record) { return record.round === turn.n; }); add({ id: row.id + ':trace:' + (turn.n || index + 1), name: turn.name || turn.traceName || row.id + ':trace:' + (turn.n || index + 1), activityAt: activity(objectTimes(turn).concat(trajectory.flatMap(objectTimes))), completed: turn.hasOutput !== false && content(turn.output) || ['failed','error','cancelled','canceled','timeout'].indexOf(turn.status) >= 0, running: turn.hasOutput === false && ['failed','error','cancelled','canceled','timeout'].indexOf(turn.status) < 0 || trajectory.some(function (r) { return ['running', 'pending', 'in_progress'].indexOf(r.status) >= 0; }), error: trajectory.some(function (r) { return ['failed', 'error', 'warning'].indexOf(r.status) >= 0; }), input: turn.input, output: turn.hasOutput === false ? '' : turn.output, reference: copy(turn.reference), context: copy(turn.context), messages: messages([turn]), trajectory: trajectory, evidenceRefs: [turn.inputId, turn.outputId].filter(Boolean) }); });
      if (targetType === 'span') records.filter(function (record) { return !selector.spanTypes.length || selector.spanTypes.indexOf(record.type) >= 0; }).forEach(function (record) { var turn = rounds.filter(function (item) { return item.n === record.round; })[0]; add({ id: record.id, name: record.name, activityAt: activity(objectTimes(record)) || activity(objectTimes(turn)), completed: ['completed', 'success', 'succeeded', 'failed', 'error', 'cancelled', 'canceled', 'timeout', 'warning'].indexOf(record.status) >= 0, running: ['running', 'pending', 'in_progress'].indexOf(record.status) >= 0, error: ['failed', 'error', 'warning'].indexOf(record.status) >= 0, input: record.input, output: record.output, reference: copy(record.reference), context: copy(record.context), trajectory: [record], evidenceRefs: [record.id], spanType: record.type }); });
      if (targetType === 'task_execution') {
        var selected = catalog.filter(function (task) { return (!selector.taskIds.length || selector.taskIds.indexOf(task.id) >= 0) && [task.agentId, task.sourceAgentId, task.agent].some(function (agent) { return [selector.agentId, row.agentId, row.agent].indexOf(agent) >= 0; }); });
        var executions;
        try { executions = typeof host.recognizeTasks === 'function' ? host.recognizeTasks(copy(row), copy(selected)) : Array.isArray(row.taskExecutions) ? copy(row.taskExecutions) : global.AIOpsOnlineEvaluatorRuntime && global.AIOpsOnlineEvaluatorRuntime.scanTaskSession ? global.AIOpsOnlineEvaluatorRuntime.scanTaskSession({ taskSnapshots: selected }, copy(row)) : []; }
        catch(error){if(options.recognitionStatus){options.recognitionStatus.invalid=true;options.recognitionStatus.error=error.message || '任务识别异常';}else throw error;executions=[];}
        if (!Array.isArray(executions)) {if(options.recognitionStatus){options.recognitionStatus.invalid=true;options.recognitionStatus.error='任务识别结果不是有效列表';}executions = [];}
        executions.forEach(function (execution) {
          var task = selected.filter(function (item) { return item.id === execution.taskId; })[0]; if (!task) return;
          var start = rounds.findIndex(function (turn) { return turn.inputId === execution.startMessageId; }), end = rounds.findIndex(function (turn) { return turn.outputId === execution.completionMessageId; });
          var turns = start >= 0 ? rounds.slice(start, end >= start ? end + 1 : undefined) : [];
          var trajectory = records.filter(function (record) { return turns.some(function (turn) { return turn.n === record.round; }); });
          add({ id: execution.id || 'TE-' + digest([row.id, execution.taskId, execution.startMessageId]).slice(0, 20), activityAt: activity(objectTimes(execution).concat(turns.flatMap(objectTimes), trajectory.flatMap(objectTimes))), taskId: execution.taskId, completion: execution.completion, completed: execution.completion === 'completed', running: execution.completion === 'running', error: execution.completion === 'failed', input: turns.map(function (turn) { return turn.input; }).join('\n'), output: own(execution, 'output') ? execution.output : turns.map(function (turn) { return turn.output || ''; }).join('\n'), reference: copy(execution.reference), context: copy(execution.context), messages: messages(turns), trajectory: trajectory, evidenceRefs: copy(execution.evidence || []) }, task);
        });
      }
    });
    return result;
  }
  function logicalAssessment(binding,target) { return canonical([binding&&binding.id,binding&&binding.evaluatorRef,target&&target.type,target&&target.id]); }
  function eventMatchesJob(job,event) {
    if (event.jobId && event.jobId!==job.id || (job.trigger.events || []).indexOf(event.type)<0) return false;
    if (event.type==='evaluation_result') { var condition=job.trigger.evaluationCondition || {}, value=event.value, expected=condition.value; if (['gte','gt','lte','lt'].indexOf(condition.operator)>=0){value=Number(value);expected=Number(expected);} return event.key===condition.key && compare(value,condition.operator,expected)===true; }
    return true;
  }
  function dispatchEvent(event) {
    var loaded=read();if(!loaded.ok)return [];
    return loaded.state.jobs.map(function(stored){return effectiveJob(stored,loaded.state);}).filter(function(job){return job.enabled&&job.trigger.mode==='automatic'&&eventMatchesJob(job,event);}).map(function(job){return runJob(job.id,{trigger:'automatic',event:event});});
  }
  function emitEvent(draft) {
    draft=copy(draft || {});
    if (['ready','negative_feedback','negative_sentiment','evaluation_result'].indexOf(draft.type)<0 || !text(draft.sessionId)) return {ok:false,error:'请选择事件类型及关联会话'};
    var result=transact(function(state){var event=Object.assign({},draft,{id:draft.id||'EV-'+digest([clock(),state.revision,draft]).slice(0,20),at:draft.at||clock()});var existing=state.events.filter(function(item){return item.id===event.id;})[0];if(existing)return {ok:true,event:existing,duplicate:true,noWrite:true};state.events.push(event);return {ok:true,event:event};});
    if(!result.ok || result.duplicate)return Object.assign(result,{results:[]});
    result.results=dispatchEvent(result.event);return result;
  }
  function runJob(id, options) {
    options = options || {}; id = typeof id === 'string' ? id : id && id.id;
    var mode = options.mode || 'incremental', range = null, startedAt=clock(), notifyFailure=false;
    if (['incremental', 'backfill'].indexOf(mode) < 0) return { ok: false, error: '请选择增量评测或历史补评' };
    if (mode === 'backfill') {
      var from = timestamp(options.range && options.range.from), to = timestamp(options.range && options.range.to);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return { ok: false, error: '历史补评须指定有效起止时间，结束时间须晚于开始时间' };
      range = { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
    } else if (options.range) return { ok: false, error: '历史时间范围须通过独立历史补评执行' };
    var result = transact(function (state) {
      var storedJob = state.jobs.filter(function (item) { return item.id === id; })[0]; if (!storedJob) return { ok: false, error: '在线评测任务不存在' };
      var job = effectiveJob(storedJob, state);
      if (!job.enabled) return { ok: false, code: 'disabled', error: '在线评测任务已停用，无法开始执行' };
      if (options.trigger === 'scheduled' && (options.revision !== job.revision || !Number.isFinite(Date.parse(options.scheduledAt)) || Date.parse(options.scheduledAt) > Date.parse(clock()) || Date.parse(options.scheduledAt) <= Date.parse(job.armedAt))) return { ok: false, skipped: true, error: '已跳过失效的调度配置' };
      var errors = validateJob(job, state); if (errors.length) return fail(errors);
      var event = options.event || null, eventKey = event ? canonical([job.id,event.id]) : null, explicitEvent = event && event.type !== 'ready';
      if (options.trigger === 'automatic' && (job.trigger.mode !== 'automatic' || (job.trigger.events || []).indexOf(event ? event.type : 'ready') < 0)) return {ok:false,skipped:true,noWrite:true,error:'自动触发事件未启用'};
      if (event && (!eventMatchesJob(job,event) || timestamp(event.at) < timestamp(job.armedAt))) return {ok:true,skipped:true,noWrite:true,reason:'事件不符合当前任务配置'};
      var slotKey = eventKey || (options.trigger === 'scheduled' ? canonical([job.id, job.revision, options.scheduledAt]) : null);
      var priorSlots = slotKey ? state.runs.filter(function (r) { return r.slotKey === slotKey; }) : [], existing = priorSlots[priorSlots.length-1]; if (existing && !(event && (existing.deferred>0 || existing.failedExecutions>0))) return { ok: true, skipped: true, run: existing, noWrite: true };
      var catalog = tasks(), frozenTasks = job.taskSnapshots || [];
      catalog = catalog.filter(function (task) { return !frozenTasks.some(function (snapshot) { return snapshot.id === task.id; }); }).concat(copy(frozenTasks));
      var rows = copy(host.sessions ? host.sessions() : []), business = job.selector.targetType === 'task_execution';
      if (event) rows = rows.filter(function(row){return row.id === event.sessionId;});
      var supplied = collectTargets(job, rows, catalog, {businessCandidates:business}), targetKeys = Object.create(null), candidates = [];
      if (event && event.targetId && !business && job.selector.targetType !== 'session') supplied = supplied.filter(function(item){return item.target.id === event.targetId || (item.target.evidenceRefs || []).indexOf(event.targetId) >= 0;});
      supplied.forEach(function (item) { var key = canonical([item.target.type, item.target.id, item.target.snapshotId]); if (!own(targetKeys, key)) { targetKeys[key] = true; candidates.push(item); } });
      var since = timestamp(job.incrementalSince), nowAt = Date.parse(clock()), undated = 0;
      var eligible = candidates.filter(function (item) {
        var at = timestamp(item.target.activityAt);
        if (business && mode==='backfill' && !explicitEvent) {
          var row=rows.filter(function(row){return row.id===item.target.sessionId;})[0], data=conversation(row), times=objectTimes(row).concat(data.rounds.flatMap(objectTimes),data.records.flatMap(objectTimes),(row.taskExecutions||[]).flatMap(objectTimes)).map(timestamp).filter(Number.isFinite);
          if (!times.length) undated++;
          return times.some(function(time){return time<=nowAt&&time>=timestamp(range.from)&&time<timestamp(range.to);});
        }
        if (!Number.isFinite(at)) { if (explicitEvent) return timestamp(event.at) <= nowAt; undated++; return false; }
        return at <= nowAt && (explicitEvent ? timestamp(event.at) <= nowAt : mode === 'backfill' ? at >= timestamp(range.from) && at < timestamp(range.to) : Number.isFinite(since) && at >= since);
      });
      var priorObjectKeys=Object.create(null),priorLogicalObjects=Object.create(null);
      state.runs.filter(function(run){return run.jobId===job.id;}).forEach(function(run){(run.objectResults || []).forEach(function(verdict){if(verdict.dedupKey)priorObjectKeys[verdict.dedupKey]=true;if(verdict.contentKey)priorObjectKeys[verdict.contentKey]=true;if(verdict.logicalKey)priorLogicalObjects[verdict.logicalKey]=verdict;});});
      function needsObjectResult(target,task){var contentKey=objectResultIdentity(job,state,target,task),key=explicitEvent?canonical([contentKey,event.id]):contentKey;return !priorObjectKeys[key];}
      var sourceCandidates = candidates.length, sourceEligible = eligible.length, sourceMatchedSessions=unique(eligible.map(function(item){return item.target.sessionId;})), recognition = null, recognitionRecords = [], recognitionOutcomes=[];
      if (business) {
        var sources = eligible.filter(function(item){return sampledTarget(job,item.target);});
        if (options.trigger === 'automatic' && !explicitEvent) sources = sources.filter(function(item){return !state.recognitions.some(function(old){return old.jobId===job.id && old.revision===job.revision && old.sourceId===item.target.id && old.snapshotId===item.target.snapshotId && old.status!=='matched' && old.passPolicyHash===digest(job.passPolicy);});});
        recognition = {scanned:sources.length,matched:0,notMatched:0,inconclusive:0,executions:0,sourceSampled:sources.length};
        var recognized = [], recognitionJob = copy(job); recognitionJob.readiness = {mode:'any'}; recognitionJob.selector.filter = {text:'',status:'all',logic:'all',conditions:[]};
        sources.forEach(function(source){
          var row = rows.filter(function(item){return item.id===source.target.sessionId;})[0], available = typeof host.recognizeTasks==='function' || Array.isArray(row.taskExecutions) || global.AIOpsOnlineEvaluatorRuntime && typeof global.AIOpsOnlineEvaluatorRuntime.scanTaskSession==='function';
          var recognitionStatus={},found = available ? collectTargets(recognitionJob,[row],catalog,{recognitionStatus:recognitionStatus}) : [], coverage=source.target.evidenceCompleteness || {},uncertain=!available || recognitionStatus.invalid || !found.length && coverage.messages!=='complete',status = found.length ? 'matched' : uncertain ? 'inconclusive' : 'not_matched';
          if (found.length) recognition.matched++; else if (!uncertain) recognition.notMatched++; else recognition.inconclusive++;
          found.forEach(function(item){recognized.push(item);}); recognition.executions += found.length;
          var priorSource=priorLogicalObjects[logicalObjectIdentity(source.target,null)];
          if(!found.length && needsObjectResult(source.target,null) && (explicitEvent || job.reEvaluation.mode!=='first_only' || !priorSource || priorSource.evidenceKey===objectEvidenceKey(source.target,null)))recognitionOutcomes.push({target:source.target,reasonCode:uncertain?'TASK_RECOGNITION_INCONCLUSIVE':'TASK_NOT_MATCHED'});
          recognitionRecords.push({jobId:job.id,revision:job.revision,sourceId:source.target.id,snapshotId:source.target.snapshotId,status:status,executionIds:found.map(function(item){return item.target.id;}),evaluatedAt:clock(),eventId:event&&event.id||null,passPolicyHash:digest(job.passPolicy)});
        });
        eligible = recognized.filter(function(item){var at=timestamp(item.target.activityAt);return explicitEvent || Number.isFinite(at) && at<=nowAt && (mode==='backfill'?at>=timestamp(range.from)&&at<timestamp(range.to):at>=since);});
      }
      var completed = Object.create(null), reusable=Object.create(null),latestAssessments=Object.create(null),firstCompleted = Object.create(null), attempts = Object.create(null), unchanged = 0, alreadyEvaluated = 0;
      state.assessments.filter(function (a) { return a.jobId === job.id; }).forEach(function (a) {
        var key = a.targetSnapshot && a.evaluatorSnapshot && a.bindingSnapshot ? assessmentIdentity(job.id, a.bindingSnapshot, a.evaluatorSnapshot, a.targetSnapshot, a.taskSnapshot, a.judgeRuntimeSnapshot) : a.dedupKey;
        if (!key) return;
        var baseKey=key; if (a.triggerEventId) key=canonical([key,a.triggerEventId]);
        latestAssessments[baseKey]=a;
        if (a.executionStatus === 'succeeded') { completed[key] = true; completed[baseKey] = true;reusable[baseKey]=a; firstCompleted[logicalAssessment(a.bindingSnapshot || {id:a.bindingId,evaluatorRef:a.evaluatorRef},a.targetSnapshot || a.targetRef)] = true; }
        attempts[key] = { count: (attempts[key] && attempts[key].count || 0) + 1, at: timestamp(a.evaluatedAt) || 0 };
      });
      var pending = eligible.map(function (item) {
        var plans=applicableJobBindings(job,state,item.task),suppressed=false;
        var bindings = plans.map(function (plan) {
          var binding=plan.binding,evaluator=plan.evaluator;
          var baseIdentity=assessmentIdentity(job.id,binding,evaluator,item.target,item.task,job.judgeRuntime),identity = baseIdentity;
          if (explicitEvent) identity=canonical([identity,event.id]);
          if ((own(completed, identity) || !explicitEvent && job.reEvaluation.mode==='first_only' && firstCompleted[logicalAssessment(binding,item.target)]) && !(mode === 'backfill' && options.force === true)) { unchanged++;if(!own(reusable,baseIdentity))suppressed=true;return null; }
          return { binding: binding, evaluator: evaluator, identity: identity };
        }).filter(Boolean);
        if (!bindings.length) alreadyEvaluated++;
        return { target: item.target, task: item.task, bindings: bindings, needsVerdict:!suppressed && needsObjectResult(item.target,item.task),attemptCount: bindings.length ? Math.min.apply(Math, bindings.map(function (b) { return attempts[b.identity] && attempts[b.identity].count || 0; })) : 0, lastAttempt: bindings.length ? Math.min.apply(Math, bindings.map(function (b) { return attempts[b.identity] && attempts[b.identity].at || 0; })) : 0 };
      }).filter(function (item) { return item.bindings.length || item.needsVerdict; });
      // Remove successful snapshots/bindings before sampling or applying operational capacity.
      var selected = pending.filter(function (item) { return business || sampledTarget(job,item.target); });
      selected.sort(function (a, b) { return a.attemptCount - b.attemptCount || a.lastAttempt - b.lastAttempt || digest([job.id, a.target.id]).localeCompare(digest([job.id, b.target.id])); });
      var sampled = selected.length, capacity = Number.isInteger(host.maxTargetsPerRun) && host.maxTargetsPerRun > 0 ? host.maxTargetsPerRun : MAX_TARGETS_PER_RUN;
      selected = selected.slice(0, capacity);
      var deferredOutcomes=recognitionOutcomes.slice(Math.max(0,capacity-selected.length)),deferredSources=deferredOutcomes.map(function(item){return item.target.id;});
      recognitionOutcomes=recognitionOutcomes.slice(0,Math.max(0,capacity-selected.length));
      recognitionRecords=recognitionRecords.filter(function(record){return deferredSources.indexOf(record.sourceId)<0;});
      if (options.trigger === 'automatic' && !selected.length && !recognitionOutcomes.length) {
        var newRecognitions=recognitionRecords.filter(function(record){return !state.recognitions.some(function(old){return old.jobId===record.jobId&&old.revision===record.revision&&old.sourceId===record.sourceId&&old.snapshotId===record.snapshotId&&old.passPolicyHash===record.passPolicyHash&&old.status===record.status;});});
        newRecognitions.forEach(function(record){state.recognitions.push(record);});
        return {ok:true,skipped:true,noWrite:!newRecognitions.length,reason:'没有新增且就绪的待评对象'};
      }
      var run = { id: 'UR-' + digest([job.id, state.revision, clock()]).slice(0, 20), jobId: job.id, jobName: job.name, startedAt: startedAt, finishedAt: clock(), status: 'completed', trigger: options.trigger || 'manual', mode: mode, range: copy(range), incrementalSince: job.incrementalSince, source: 'mock', scanned: sourceCandidates, duplicates: supplied.length - candidates.length, eligible: sourceEligible, undated: undated, pending: pending.length, sampled: sampled, selected: selected.length, deferred: sampled - selected.length, alreadyEvaluated: alreadyEvaluated, assessed: 0, unchanged: unchanged, failedExecutions: 0, counts: { passed: 0, failed: 0, inconclusive: 0, not_applicable: 0 }, jobSnapshot: copy(job), evaluatorSnapshots: [], taskSnapshots: copy(catalog.filter(function (t) { return job.selector.taskIds.indexOf(t.id) >= 0; })), targetSnapshots: [], assessmentIds: [] };
      run.sessionCounts={scanned:unique(candidates.map(function(item){return item.target.sessionId;})).length,matched:sourceMatchedSessions.length,selected:unique(selected.concat(recognitionOutcomes).map(function(item){return item.target.sessionId;})).length};
      run.selectionSnapshot = {mode:job.trigger.mode === 'automatic'?'event':'filter',selector:activeJobSelector(job)};
      run.sourceSnapshots = business ? (sources || []).map(function(item){return copy(item.target);}) : [];
      run.objectResults=[];
      run.objectDeferred=deferredOutcomes.length;run.deferred+=deferredOutcomes.length;
      run.recognition = recognition; run.triggerReason = event ? ({negative_feedback:'用户点踩',negative_sentiment:'检测到负面情绪',evaluation_result:'评估结果满足条件',ready:'对象就绪'}[event.type] || event.type) : options.trigger==='automatic'?'对象就绪':options.trigger==='scheduled'?'定时批量':'手动执行'; run.triggerEvent = copy(event); if (event) run.triggerEventId=event.id;
      recognitionRecords.forEach(function(record){state.recognitions.push(record);});
      run.judgeRuntimeSnapshot = copy(job.judgeRuntime); run.agentRuntimeSnapshot = combinedObservedModels(selected.map(function (item) { return item.target; }));
      if (slotKey) { run.slotKey = slotKey; run.scheduledAt = options.scheduledAt; }
      job.bindings.forEach(function (binding) { var e = resolve(state, binding.evaluatorRef.id, binding.evaluatorRef.version), head = resolve(state, e.id); if (head.status === 'disabled') throw Error('评估器「' + e.name + '」已停用，未执行该任务'); run.evaluatorSnapshots.push(copy(e)); });
      selected.forEach(function (item) {
        run.targetSnapshots.push(copy(item.target));
        var currentAssessments={};
        item.bindings.forEach(function (plannedBinding) {
          var e = plannedBinding.evaluator, snapshotBinding = copy(plannedBinding.binding), binding = snapshotBinding;
          var context = { target: item.target, task: item.task, runId: run.id, judgeRuntime: job.judgeRuntime }, assessment = assess(e, context, snapshotBinding);
          assessment.id = 'UA-' + digest([run.id, binding.id, item.target.snapshotId]).slice(0, 20); assessment.jobId = job.id;assessment.runId=run.id; assessment.dedupKey = plannedBinding.identity;
          if (explicitEvent) assessment.triggerEventId=event.id; assessment.triggerReason=run.triggerReason; assessment.targetSnapshot = copy(item.target); assessment.evaluatorSnapshot = copy(e); assessment.bindingSnapshot = snapshotBinding; if (item.task) assessment.taskSnapshot = copy(item.task);
          state.assessments.push(assessment); run.assessmentIds.push(assessment.id); run.assessed++; run.counts[assessment.decision]++; if (assessment.executionStatus === 'failed') run.failedExecutions++;
          var baseIdentity=assessmentIdentity(job.id,binding,e,item.target,item.task,job.judgeRuntime);latestAssessments[baseIdentity]=assessment;currentAssessments[baseIdentity]=assessment;if(assessment.executionStatus==='succeeded')reusable[baseIdentity]=assessment;
        });
        var lookup=Object.assign({},latestAssessments,reusable,currentAssessments);
        run.objectResults.push(makeObjectResult(job,state,run,item.target,item.task,lookup,event));
      });
      recognitionOutcomes.forEach(function(item){run.objectResults.push(makeObjectResult(job,state,run,item.target,null,{},event,item.reasonCode));});
      run.finishedAt=clock();run.objectResults.forEach(function(result){result.evaluatedAt=run.finishedAt;});
      run.objectCounts=summarizeJobResults(run.objectResults);
      run=runPresentation(run,state);
      state.runs.push(run); return { ok: true, run: run };
    });
    if(result && !result.ok && !result.skipped && result.code!=='disabled' && options.trigger!=='automatic'){
      var failedAttempt=transact(function(state){
        var stored=state.jobs.filter(function(job){return job.id===id;})[0];if(!stored || stored.enabled===false)return {ok:false,error:result.error};
        if(options.trigger==='scheduled'){var existingSlot=state.runs.filter(function(run){return run.slotKey===canonical([id,stored.revision,options.scheduledAt]);})[0];if(existingSlot)return {ok:true,noWrite:true,run:existingSlot};}
        var snapshot=effectiveJob(stored,state),run={id:'UR-'+digest([id,state.revision,startedAt,'failed']).slice(0,20),jobId:id,jobName:snapshot.name,startedAt:startedAt,finishedAt:clock(),status:'failed',trigger:options.trigger || 'manual',triggerReason:options.trigger==='scheduled'?'定时批量':'手动触发',mode:mode,range:copy(range),source:'mock',error:result.error || '本次评测运行失败',emptyReason:result.error || '本次评测运行失败',failureCode:result.code || 'RUN_EXECUTION_FAILED',jobSnapshot:copy(snapshot),selectionSnapshot:{mode:snapshot.trigger.mode==='automatic'?'event':'filter',selector:activeJobSelector(snapshot)},judgeRuntimeSnapshot:copy(snapshot.judgeRuntime),evaluatorSnapshots:(snapshot.bindings || []).map(function(binding){return copy(resolve(state,(binding.evaluatorRef || {}).id,(binding.evaluatorRef || {}).version));}).filter(Boolean),taskSnapshots:copy(snapshot.taskSnapshots || []),targetSnapshots:[],sourceSnapshots:[],assessmentIds:[],objectResults:[],assessed:0,unchanged:0,failedExecutions:0,deferred:0,counts:{passed:0,failed:0,inconclusive:0,not_applicable:0},sessionCounts:{scanned:null,matched:null,selected:0,evaluated:0}};
        if(options.trigger==='scheduled'){run.scheduledAt=options.scheduledAt;run.slotKey=canonical([id,snapshot.revision,options.scheduledAt]);}
        run=runPresentation(run,state);state.runs.push(run);return {ok:true,run:run};
      });
      if(failedAttempt && failedAttempt.ok){result=Object.assign({},result,{run:failedAttempt.run});notifyFailure=!failedAttempt.noWrite;}
    }
    // Notify only after the complete ledger has committed. Rendering failures cannot undo a run.
    if ((result.ok && !result.skipped || notifyFailure) && result.run && typeof host.onRun === 'function') {
      try { host.onRun(copy(result.run)); } catch (_) { /* Observer failures do not change persisted execution state. */ }
    }
    return result;
  }
  function seedEvaluator(state, record) { var derived = deriveEvaluatorContract(record); if (!derived.ok) throw Error(derived.error); record = derived.record; var errors = validateEvaluator(record, { preserveContract: true }); if (errors.length) throw Error(errors.map(function (e) { return e.message; }).join('；')); record.schemaVersion = '1.0'; record.tags = record.tags || []; record.status = record.enabled === false ? 'disabled' : 'active'; record.enabled = record.status === 'active'; record.versionStatus = 'published'; record.createdAt = clock(); record.updatedAt = clock(); record.versions = [headSnapshot(record)]; state.evaluators.push(record); }
  function factoryOnlinePolicy(bindings,state) {
    var gates=(bindings || []).filter(function(binding){var evaluator=resolve(state,binding.evaluatorRef.id,binding.evaluatorRef.version);return binding.role!=='observe'&&evaluator&&hasDecision(evaluator);});
    return gates.length?defaultCompositePolicy('weighted_score',gates):{type:'composite_policy',policyVersion:1,mode:'custom_prompt',customPrompt:'仅归档各评估器的观察结果、理由与证据；观察项不参与业务验收，不产生自动通过结论。',missingEvidence:'inconclusive'};
  }
  function sessionDemoRecord(catalog,rows) {
    var agents=sourceAgents(catalog),row=rows.filter(function(item){return item.agentId || agents.some(function(agent){return agent.name===item.agent;});}).sort(function(a,b){return Number(/关账|audit/i.test(b.agent || b.agentId || ''))-Number(/关账|audit/i.test(a.agent || a.agentId || ''));})[0],agent=row&&agents.filter(function(item){return item.id===row.agentId||item.sourceId===row.agentId||item.name===row.agent;})[0],task=catalog[0],agentId=row?row.agentId || agent&&agent.id:task&&(task.agentId || task.sourceAgentId);
    if(!agentId)return null;
    return {id:'UJ-SESSION-DEMO',name:'生产会话交付内容巡检',description:'浏览器本地 Mock 示例，检查会话输出是否存在，不代表业务验收。',enabled:true,selector:{sceneId:row?row.sceneId || row.scene || agent&&agent.sceneId || '':task.sceneId,agentId:agentId,targetType:'session',taskIds:[],spanTypes:[],filter:{text:'',status:'all'}},sampling:{rate:100},readiness:{mode:'any',idleMinutes:10},schedule:scheduleDefaults(),bindings:[{id:'UB-SESSION-OUTPUT',evaluatorRef:{id:'UE-OUTPUT-EXISTS',version:'V1'},dimensionMappings:[],role:'observe',targetType:'session',inputMapping:{actual:'/target/output'}}],revision:1,incrementalSince:clock(),armedAt:clock(),createdAt:clock(),updatedAt:clock()};
  }
  function migrateSessionDemoPolicy(state) {
    if(state.sessionDemoPolicyVersion>=2)return false;
    var current=state.jobs.find(function(job){return job.id==='UJ-SESSION-DEMO';}),rows=copy(host.sessions?host.sessions():[]);
    if(current&&!rows.length)return false;
    var baseline=sessionDemoRecord(tasks(),rows);
    if(current&&baseline&&demoJobSignature(current,state)===demoJobSignature(baseline,state)){
      var record=copy(current);record.passPolicy=factoryOnlinePolicy(record.bindings,state);record.demoPolicyVersion=2;record.revision=(record.revision || 1)+1;record.updatedAt=clock();record=effectiveJob(record,state);
      if(!validateJob(record,state).length)state.jobs[state.jobs.indexOf(current)]=record;
    }
    state.sessionDemoPolicyVersion=2;return true;
  }
  function seedOnlineTaskDemos(state) {
    if (!host.seedOnlineTaskDemos || state.onlineTaskDemoVersion >= 1 && state.onlineTaskPolicyVersion >= 2) return false;
    var catalog = tasks(), rows = copy(host.sessions ? host.sessions() : []), known = sourceAgents(catalog), taskScopes = [], trafficScopes = [];
    if (!catalog.length || !rows.length) return false;
    function scopeKey(scope) { return canonical([scope.sceneId,scope.agentId]); }
    function addScope(list, scope) { if (scope.sceneId && scope.agentId && !list.some(function(item){return scopeKey(item)===scopeKey(scope);})) list.push(scope); }
    catalog.forEach(function(task){addScope(taskScopes,{sceneId:sceneId(task.sceneId || task.scene),agentId:task.agentId});});
    rows.forEach(function(row){
      var agent=known.filter(function(item){return row.agentId && (item.id===row.agentId || item.sourceId===row.agentId) || row.agent && item.name===row.agent;})[0];
      var related=catalog.filter(function(task){return [task.agentId,task.sourceAgentId,task.agent].filter(Boolean).some(function(value){return value===row.agentId || value===row.agent;});})[0];
      var scope={sceneId:sceneId(row.sceneId || row.scene || agent && agent.sceneId || related && (related.sceneId || related.scene)),agentId:related && related.agentId || agent && agent.id || row.agentId};
      if (scope.agentId && !scope.sceneId) { var matching=taskScopes.filter(function(item){return item.agentId===scope.agentId;})[0];if(matching)scope.sceneId=matching.sceneId; }
      addScope(trafficScopes,scope);
    });
    if (!taskScopes.length || !trafficScopes.length) return false;
    function taskScope(hint,index) { return taskScopes.filter(function(scope){return scope.sceneId.indexOf(hint)>=0;})[0] || taskScopes[index % taskScopes.length]; }
    function traffic(index) { return trafficScopes[index % trafficScopes.length]; }
    function demoRule(id,name,metric,type,check,required,decision) {
      if (resolve(state,id)) return;
      var properties={actual:{type:['string','object','array']}};if(required.indexOf('reference')>=0)properties.reference={type:['string','object','array']};
      seedEvaluator(state,{id:id,name:name,description:'在线评测 Mock 示例规则：'+name,sceneId:'',tags:['Mock 示例'],enabled:true,version:'V1',supportedTargets:TARGETS.slice(),method:{type:'rule',checks:[Object.assign({metricId:metric},check)]},inputSchema:{type:'object',properties:properties,required:required,additionalProperties:false},metrics:[{id:metric,name:name,valueType:type,rubric:'仅按明确的字段和字面规则记录结果。'}],aggregation:{type:'none'},decision:decision});
    }
    demoRule('UE-DEMO-CITATION-MARKER','来源标记检查（示例）','citation_marker','boolean',{inputPath:'/actual',operator:'contains',expected:'[来源]',onTrue:true,onFalse:false},['actual'],{type:'boolean_equals',metricId:'citation_marker',value:true,missingEvidence:'inconclusive'});
    demoRule('UE-DEMO-REFERENCE','参考证据存在性（示例）','reference_exists','boolean',{inputPath:'/reference',operator:'exists',onTrue:true,onFalse:false},['reference'],{type:'boolean_equals',metricId:'reference_exists',value:true,missingEvidence:'inconclusive'});
    demoRule('UE-DEMO-OBSERVATION','输出观察记录（示例）','output_observation','text',{inputPath:'/actual',operator:'exists',onTrue:'已记录可读取的输出。',onFalse:'没有可读取的输出。'},['actual'],{type:'none',missingEvidence:'inconclusive'});
    var output='UE-OUTPUT-EXISTS',citation='UE-DEMO-CITATION-MARKER',reference='UE-DEMO-REFERENCE',observation='UE-DEMO-OBSERVATION';
    var sales=taskScope('sales',0),procurement=taskScope('procurement',1),specs=[
      {id:'SALES-SESSION',name:'销售会话回答巡检',scope:sales,target:'session',mode:'manual',rate:25,refs:[output,citation]},
      {id:'SALES-TRACE',name:'销售执行链路抽检',scope:sales,target:'trace',mode:'scheduled',repeat:'interval',rate:100,refs:[output,citation],minimum:1},
      {id:'SALES-SPAN',name:'销售工具调用检查',scope:sales,target:'span',mode:'scheduled',repeat:'daily',rate:100,refs:[output],enabled:false,spanTypes:['tool']},
      {id:'SALES-TASK',name:'销售业务任务达成评测',scope:sales,target:'task_execution',mode:'manual',rate:100,refs:[output,citation]},
      {id:'PROCUREMENT-SESSION',name:'采购会话参考证据检查',scope:procurement,target:'session',mode:'scheduled',repeat:'daily',rate:50,refs:[output,reference]},
      {id:'PROCUREMENT-TASK',name:'采购业务任务抽检',scope:procurement,target:'task_execution',mode:'scheduled',repeat:'weekly',rate:30,refs:[output,citation],minimum:1},
      {id:'FEEDBACK',name:'用户点踩响应复评',scope:traffic(0),target:'trace',mode:'automatic',event:'negative_feedback',rate:100,refs:[reference]},
      {id:'SENTIMENT',name:'负面情绪会话复评',scope:traffic(1),target:'session',mode:'automatic',event:'negative_sentiment',rate:100,refs:[output,citation],minimum:1},
      {id:'LOW-SCORE',name:'低分会话二次评测',scope:traffic(2),target:'session',mode:'automatic',event:'evaluation_result',rate:100,refs:[output,citation]},
      {id:'NEW-SESSION',name:'新增会话交付检查',scope:traffic(0),target:'session',mode:'automatic',event:'ready',rate:10,refs:[output],firstOnly:true},
      {id:'OBSERVATION',name:'会话输出观察归档',scope:traffic(1),target:'session',mode:'manual',rate:100,refs:[observation],observe:true}
    ];
    specs.forEach(function(spec,index){
      var id='UJ-DEMO-'+spec.id,current=state.jobs.find(function(item){return item.id===id;});if(!current&&state.onlineTaskDemoVersion>=1)return;
      var selectedTasks=spec.target==='task_execution'?catalog.filter(function(task){return sceneId(task.sceneId || task.scene)===spec.scope.sceneId && task.agentId===spec.scope.agentId;}).slice(0,2):[];
      var record={id:id,name:spec.name,description:'本地在线评测任务 Mock 示例。',source:'mock',demoVersion:1,enabled:spec.enabled!==false,selector:{sceneId:spec.scope.sceneId,agentId:spec.scope.agentId,targetType:spec.target,taskIds:selectedTasks.map(function(task){return task.id;}),spanTypes:spec.spanTypes || [],filter:{text:'',status:'all',logic:'all',conditions:[]}},sampling:{rate:spec.rate,seed:id},readiness:{mode:spec.mode==='automatic' && spec.event==='ready'?'idle':spec.mode==='scheduled'?'completed':'any',idleMinutes:10},trigger:{mode:spec.mode,events:[spec.event || 'ready'],evaluationCondition:{key:'quality',operator:'lte',value:0.6}},schedule:Object.assign(scheduleDefaults(),{repeat:spec.mode==='scheduled'?spec.repeat:'manual',time:index%2?'09:30':'10:00',intervalHours:1,weekdays:[1,3,5]}),reEvaluation:{mode:spec.firstOnly?'first_only':'on_change'},passPolicy:spec.minimum?{type:'at_least',minPassed:spec.minimum}:{type:'all'},bindings:spec.refs.map(function(evaluatorId,bindingIndex){return {id:'UB-DEMO-'+spec.id+'-'+bindingIndex,evaluatorRef:{id:evaluatorId,version:'V1'},targetType:spec.target,role:spec.observe?'observe':'gate',dimensionMappings:[],inputMapping:defaultInputMapping(resolve(state,evaluatorId,'V1'),spec.target)};}),taskSnapshots:copy(selectedTasks),revision:1,createdAt:clock(),updatedAt:clock(),armedAt:clock(),incrementalSince:clock()};
      record=effectiveJob(record,state);
      if(current&&(current.source!=='mock'||current.demoVersion!==1||demoJobSignature(current,state)!==demoJobSignature(record,state)))return;
      record.passPolicy=factoryOnlinePolicy(record.bindings,state);record.demoPolicyVersion=2;record=effectiveJob(record,state);
      var errors=validateJob(record,state);if(errors.length){if(current)return;throw Error(errors.map(function(error){return error.message;}).join('；'));}
      if(current){record.revision=(current.revision || 1)+1;record.createdAt=current.createdAt;record.updatedAt=clock();record.incrementalSince=current.incrementalSince;record.armedAt=current.armedAt;state.jobs[state.jobs.indexOf(current)]=record;}
      else {state.jobs.push(record);if(seedOnlineTaskHistory(state,record,rows,catalog))record.revision=2;}
    });
    state.onlineTaskDemoVersion=1;state.onlineTaskPolicyVersion=2;return true;
  }
  function seedOnlineTaskHistory(state,job,rows,catalog) {
    if(job.enabled===false)return false;
    // Historical examples used a full-snapshot backfill; current sampling/readiness may differ.
    var historyJob=copy(job);historyJob.readiness={mode:'any',idleMinutes:10};historyJob.sampling.rate=100;
    var business=job.selector.targetType==='task_execution',sources=collectTargets(historyJob,rows,catalog,{businessCandidates:business}).filter(function(item){return Number.isFinite(timestamp(item.target.activityAt)) && timestamp(item.target.activityAt)<=Date.parse(clock());}).slice(0,2),targets=[],unmatched=[],recognition=business?{scanned:sources.length,matched:0,notMatched:0,inconclusive:0,executions:0,sourceSampled:sources.length}:null;
    if(business)sources.forEach(function(source){
      var row=rows.filter(function(item){return item.id===source.target.sessionId;})[0],available=typeof host.recognizeTasks==='function' || Array.isArray(row.taskExecutions) || global.AIOpsOnlineEvaluatorRuntime && typeof global.AIOpsOnlineEvaluatorRuntime.scanTaskSession==='function',status={};
      var found=available?collectTargets(historyJob,[row],catalog,{recognitionStatus:status}):[],uncertain=!available || status.invalid || !found.length && (source.target.evidenceCompleteness || {}).messages!=='complete';
      if(found.length){recognition.matched++;recognition.executions+=found.length;targets=targets.concat(found);}else{recognition[uncertain?'inconclusive':'notMatched']++;unmatched.push({target:source.target,reasonCode:uncertain?'TASK_RECOGNITION_INCONCLUSIVE':'TASK_NOT_MATCHED'});}
    });else targets=sources.slice();
    targets=targets.filter(function(item){return Number.isFinite(timestamp(item.target.activityAt)) && timestamp(item.target.activityAt)<=Date.parse(clock());});
    var deferred=Math.max(0,targets.length-4);targets=targets.slice(0,4);
    if(!targets.length&&!unmatched.length)return false;
    var times=sources.concat(targets).map(function(item){return timestamp(item.target.activityAt);}),range={from:new Date(Math.min.apply(Math,times)-1).toISOString(),to:new Date(Math.max.apply(Math,times)+1).toISOString()};
    var run={id:'UR-DEMO-'+job.id.slice(8),jobId:job.id,jobName:job.name,startedAt:clock(),finishedAt:clock(),status:'completed',trigger:'manual',triggerReason:'示例历史补评',mode:'backfill',range:range,incrementalSince:job.incrementalSince,source:'mock',demoVersion:1,scanned:sources.length,duplicates:0,eligible:sources.length,undated:0,pending:targets.length,sampled:targets.length,selected:targets.length,deferred:0,alreadyEvaluated:0,assessed:0,unchanged:0,failedExecutions:0,counts:{passed:0,failed:0,inconclusive:0,not_applicable:0},jobSnapshot:copy(historyJob),selectionSnapshot:{mode:historyJob.trigger.mode==='automatic'?'event':'filter',selector:activeJobSelector(historyJob)},evaluatorSnapshots:[],taskSnapshots:copy(historyJob.taskSnapshots || []),sourceSnapshots:sources.map(function(item){return copy(item.target);}),targetSnapshots:[],assessmentIds:[],objectResults:[],judgeRuntimeSnapshot:copy(historyJob.judgeRuntime),agentRuntimeSnapshot:combinedObservedModels(targets.map(function(item){return item.target;}))};
    run.deferred=deferred;run.recognition=recognition;
    var lookup={};job.bindings.forEach(function(binding){run.evaluatorSnapshots.push(copy(resolve(state,binding.evaluatorRef.id,binding.evaluatorRef.version)));});
    targets.forEach(function(item){
      run.targetSnapshots.push(copy(item.target));
      applicableJobBindings(job,state,item.task).forEach(function(plan){
        var assessment=assess(plan.evaluator,{target:item.target,task:item.task,runId:run.id,judgeRuntime:job.judgeRuntime},plan.binding);
        assessment.id='UA-DEMO-'+digest([run.id,plan.binding.id,item.target.snapshotId]).slice(0,20);assessment.jobId=job.id;assessment.runId=run.id;assessment.triggerReason=run.triggerReason;assessment.source='mock';assessment.demoVersion=1;
        assessment.targetSnapshot=copy(item.target);assessment.evaluatorSnapshot=copy(plan.evaluator);assessment.bindingSnapshot=copy(plan.binding);if(item.task)assessment.taskSnapshot=copy(item.task);
        assessment.dedupKey=assessmentIdentity(job.id,plan.binding,plan.evaluator,item.target,item.task,job.judgeRuntime);lookup[assessment.dedupKey]=assessment;
        state.assessments.push(assessment);run.assessmentIds.push(assessment.id);run.assessed++;run.counts[assessment.decision]++;if(assessment.executionStatus==='failed')run.failedExecutions++;
      });
      var result=makeObjectResult(job,state,run,item.target,item.task,lookup,null);result.source='mock';result.demoVersion=1;run.objectResults.push(result);
    });
    unmatched.forEach(function(item){var result=makeObjectResult(job,state,run,item.target,null,{},null,item.reasonCode);result.source='mock';result.demoVersion=1;run.objectResults.push(result);});
    run.objectCounts=summarizeJobResults(run.objectResults);state.runs.push(run);return true;
  }
  function demoEvaluatorSignature(value) {
    var derived=deriveEvaluatorContract(value),record=copy(derived.record);
    ['versions','schemaVersion','createdAt','updatedAt','source','demoCatalog','demoVersion','versionStatus','status'].forEach(function(key){delete record[key];});
    record.enabled=value.enabled!==false;record.tags=record.tags || [];
    return digest(record);
  }
  function demoJobSignature(value,state) {
    var record=effectiveJob(value,state);
    ['revision','createdAt','updatedAt','armedAt','incrementalSince','source','demoCatalog','demoVersion','demoPolicyVersion'].forEach(function(key){delete record[key];});
    return digest(record);
  }
  function demoEvaluatorRecord(spec,version) {
    var temporary={evaluators:[]};seedEvaluator(temporary,copy(spec));var record=temporary.evaluators[0];
    record.source='mock';record.demoCatalog='evaluation-showcase-v2';record.demoVersion=version;
    if(spec.versionStatus==='draft'){record.versionStatus='draft';record.versions=[];}
    return record;
  }
  function seedDemoCatalog(bundle) {
    if(typeof host.evaluationDemoJudge!=='function' || !bundle || bundle.id!=='evaluation-showcase-v2')return {ok:false,error:'演示目录未在当前宿主启用。'};
    return transact(function(state){
      var prior=state.evaluationShowcase || {},previous=bundle.previous || {},fresh=!prior.version;
      if(prior.version>=bundle.version)return {ok:true,noWrite:true,installed:false,epoch:prior.epoch};
      var evaluatorIds=[],jobIds=[],upgradedEvaluators=[],upgradedJobs=[],rows=copy(host.sessions?host.sessions():[]),catalog=tasks();
      (bundle.evaluators || []).forEach(function(spec){
        var current=resolve(state,spec.id),old=(previous.evaluators || []).find(function(item){return item.id===spec.id;});
        if(!current){
          if(!fresh&&((prior.evaluatorIds || []).indexOf(spec.id)>=0||old))return;
          var added=demoEvaluatorRecord(spec,bundle.version);
          if(old&&old.versionStatus!=='draft'&&old.version!==spec.version){var archived=demoEvaluatorRecord(old,previous.version);added.versions=archived.versions.concat(added.versions);}
          state.evaluators.push(added);evaluatorIds.push(added.id);return;
        }
        if(!old||current.demoCatalog!=='evaluation-showcase-v2'||current.demoVersion!==previous.version||current.versionStatus!==(old.versionStatus || 'published')||current.updatedAt!==current.createdAt||demoEvaluatorSignature(current)!==demoEvaluatorSignature(old))return;
        var next=demoEvaluatorRecord(spec,bundle.version);next.createdAt=current.createdAt;next.updatedAt=clock();next.versions=copy(current.versions || []);
        if(next.versionStatus==='published'&&!next.versions.some(function(item){return item.version===next.version;}))next.versions.push(headSnapshot(next));
        state.evaluators[state.evaluators.indexOf(current)]=next;upgradedEvaluators.push(next.id);
      });
      (bundle.jobs || []).forEach(function(spec){
        var current=state.jobs.find(function(job){return job.id===spec.id;}),old=(previous.jobs || []).find(function(job){return job.id===spec.id;});
        if(current&&(!old||current.demoCatalog!=='evaluation-showcase-v2'||current.demoVersion!==previous.version||current.source!=='mock'||demoJobSignature(current,state)!==demoJobSignature(old,state)))return;
        if(!current&&!fresh&&((prior.jobIds || []).indexOf(spec.id)>=0||old))return;
        var record=effectiveJob(copy(spec),state),missingVersion=(record.bindings || []).some(function(binding){var asset=resolve(state,binding.evaluatorRef.id,binding.evaluatorRef.version),expected=(bundle.evaluators || []).find(function(item){return item.id===binding.evaluatorRef.id&&item.version===binding.evaluatorRef.version;});return !asset||expected&&demoEvaluatorSignature(asset)!==demoEvaluatorSignature(expected);});
        if(missingVersion)return;
        var errors=validateJob(record,state);if(errors.length){if(current)return;throw Error(errors.map(function(error){return error.message;}).join('；'));}
        record.source='mock';record.demoCatalog='evaluation-showcase-v2';record.demoVersion=bundle.version;
        if(current){
          record.createdAt=current.createdAt;record.updatedAt=clock();record.revision=(current.revision || 1)+1;record.incrementalSince=current.incrementalSince;record.armedAt=current.armedAt;
          state.jobs[state.jobs.indexOf(current)]=record;upgradedJobs.push(record.id);
        }else {state.jobs.push(record);jobIds.push(record.id);if((bundle.historyJobIds || []).indexOf(record.id)>=0)seedOnlineTaskHistory(state,record,rows,catalog);}
      });
      state.evaluationShowcase=Object.assign({},prior,{version:bundle.version,epoch:prior.epoch || bundle.epoch,evaluatorIds:unique((prior.evaluatorIds || []).concat(evaluatorIds,upgradedEvaluators)),jobIds:unique((prior.jobIds || []).concat(jobIds,upgradedJobs))});
      return {ok:true,installed:true,epoch:state.evaluationShowcase.epoch,evaluatorIds:evaluatorIds,jobIds:jobIds,upgradedEvaluators:upgradedEvaluators,upgradedJobs:upgradedJobs};
    });
  }
  function repairDemoAgentReferences(repairs) {
    if(typeof host.evaluationDemoJudge!=='function')return {ok:false,error:'演示目录未在当前宿主启用。'};
    return transact(function(state){
      if(!state.evaluationShowcase || state.evaluationShowcase.agentReferencesVersion>=1)return {ok:true,noWrite:true,repaired:0};
      var count=0;
      (repairs || []).forEach(function(repair){
        var job=state.jobs.find(function(item){return item.id===repair.id;});
        if(!job || job.demoCatalog!=='evaluation-showcase-v2' || job.demoVersion!==1 || job.source!=='mock' || job.revision!==1 || job.createdAt!==job.updatedAt || !job.selector || job.selector.agentId!==repair.from || !/^(sales|procurement):agents:0$/.test(repair.to))return;
        job.selector.agentId=repair.to;
        (job.taskSnapshots || []).forEach(function(task){if(task.agentId===repair.from){task.sourceAgentId=task.sourceAgentId || repair.from;task.agentId=repair.to;}});
        job.revision++;job.updatedAt=clock();count++;
      });
      state.evaluationShowcase.agentReferencesVersion=1;return {ok:true,repaired:count};
    });
  }
  function initialize() { return transact(function (state) {
    var added = false, legacy = host.legacyEvaluators ? host.legacyEvaluators() : [];
    (legacy || []).forEach(function (old) {
      var id = 'UE-LEGACY-' + (old.sceneId || old.scene || 'shared') + '-' + old.id; if (resolve(state, id)) return;
      var metrics = (old.criteria || []).map(function (criterion, index) { return { id: 'metric-' + (index + 1), name: criterion.name, description: '', valueType: 'number', standard: (criterion.description || criterion.name) + '\n评估依据：{{actual}}', range: { min: 0, max: 100 }, scoring: { passThreshold: Number(criterion.passScore == null ? old.passScore || 80 : criterion.passScore) } }; });
      if (!metrics.length) return;
      seedEvaluator(state, { id: id, legacyId: old.id, sceneId: old.sceneId || old.scene || '', name: old.name, description: old.description || old.name, enabled: old.enabled !== false, version: /^V[1-9]\d*$/.test(old.version) ? old.version : 'V1', method: { type: 'llm_judge' }, metrics: metrics, aggregation: { type: 'none' }, decision: { type: 'evaluation_policy', policyVersion: 4, mode: 'item_count', summary: { type: 'all' }, missingEvidence: 'inconclusive' } }); added = true;
    });
    if (!resolve(state, 'UE-OUTPUT-EXISTS')) {
      seedEvaluator(state, { id: 'UE-OUTPUT-EXISTS', sceneId: '', name: '交付内容存在性', description: '显式规则检查是否存在可读取的输出；仅代表证据存在，不代表业务质量合格。', tags: ['通用', '规则'], enabled: true, version: 'V1', supportedTargets: TARGETS.slice(), method: { type: 'rule', checks: [{ metricId: 'output_exists', inputPath: '/actual', operator: 'exists', onTrue: true, onFalse: false }] }, inputSchema: { type: 'object', properties: { actual: { type: ['string', 'object', 'array'] } }, required: ['actual'], additionalProperties: false }, metrics: [{ id: 'output_exists', name: '存在交付内容', description: '实际输出中存在可读取内容。', valueType: 'boolean', rubric: '实际输出非空为 true；缺少必需输出证据时无法判定。' }], aggregation: { type: 'none' }, decision: { type: 'boolean_equals', metricId: 'output_exists', value: true, missingEvidence: 'inconclusive' } }); added = true;
    }
    if (!state.initialized) {
      var initial=sessionDemoRecord(tasks(),copy(host.sessions?host.sessions():[]));
      if(initial){initial.passPolicy=factoryOnlinePolicy(initial.bindings,state);initial.demoPolicyVersion=2;state.jobs.push(effectiveJob(initial,state));}
      state.initialized=true;state.sessionDemoPolicyVersion=2;added=true;
    }
    if(migrateSessionDemoPolicy(state))added=true;
    if (seedOnlineTaskDemos(state)) added = true;
    return { ok: true, noWrite: !added };
  }); }
  function nextRunAt(job, after) {
    if (!job || !job.enabled || job.trigger && !job.trigger.inherited && job.trigger.mode !== 'scheduled') return null;
    var schedule = Object.assign(scheduleDefaults(), job.schedule || {}), at = after == null ? Date.parse(clock()) : timestamp(after), armed = Date.parse(job.armedAt || job.createdAt);
    if (!Number.isFinite(at) || schedule.repeat === 'manual') return null;
    if (schedule.repeat === 'once') { var once = timestamp(schedule.onceAt); return once > at ? new Date(once).toISOString() : null; }
    if (schedule.repeat === 'interval') { var period = Number(schedule.intervalHours) * 3600000; if (!(period > 0)) return null; armed = Number.isFinite(armed) ? armed : at; return new Date(armed + (Math.floor(Math.max(0, at - armed) / period) + 1) * period).toISOString(); }
    var match = String(schedule.time || '').match(/^(\d\d):(\d\d)$/); if (!match) return null;
    var local = new Date(at + 8 * 3600000), start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    for (var offset = 0; offset < 371; offset++) { var day = new Date(start + offset * 86400000); if (schedule.repeat === 'weekly' && schedule.weekdays.indexOf(day.getUTCDay() || 7) < 0 || schedule.repeat === 'monthly' && schedule.monthdays.indexOf(day.getUTCDate()) < 0) continue; var slot = day.getTime() + (+match[1] * 60 + +match[2]) * 60000 - 8 * 3600000; if (slot > at) return new Date(slot).toISOString(); }
    return null;
  }
  function tick() {
    var at = Date.parse(clock()), discontinuity = lastTick == null || at < lastTick || at - lastTick > 15000; lastTick = at;
    var loaded = read(); if (!loaded.ok) return loaded; var completed = [];
    loaded.state.jobs.forEach(function (record) {
      var job=effectiveJob(record,loaded.state);
      if (job.enabled && job.trigger.mode==='automatic') {
        if ((job.trigger.events||[]).indexOf('ready')>=0) completed.push(runJob(job.id,{trigger:'automatic'}));
        loaded.state.events.filter(function(event){return timestamp(event.at)>=timestamp(job.armedAt)&&eventMatchesJob(job,event);}).forEach(function(event){completed.push(runJob(job.id,{trigger:'automatic',event:event}));});
        return;
      }
      var old = planned[job.id], next = { revision: job.revision, at: nextRunAt(job, at) };
      if (discontinuity || !old || old.revision !== job.revision || !job.enabled) { planned[job.id] = next; return; }
      if (old.at && Date.parse(old.at) <= at) { if (at - Date.parse(old.at) <= 5000) completed.push(runJob(job.id, { trigger: 'scheduled', scheduledAt: old.at, revision: job.revision })); planned[job.id] = next; }
    }); return { ok: true, results: completed, source: 'browser-mock', backfill: false };
  }
  function stop() { schedulerGeneration++; if (timer !== null && global.clearInterval) global.clearInterval(timer); timer = null; lastTick = null; planned = Object.create(null); }
  function serializedTick() {
    var locks = global.navigator && global.navigator.locks;
    if (!locks || typeof locks.request !== 'function') return tick();
    if (schedulerPending) return schedulerPending;
    var generation = schedulerGeneration;
    schedulerPending = locks.request('aiops.unified-evaluation.scheduler.v1', { mode: 'exclusive' }, function () { return generation === schedulerGeneration ? tick() : { ok: true, skipped: true }; }).catch(function () { return { ok: false, error: '浏览器调度锁执行失败，请手动重试。' }; }).finally(function () { schedulerPending = null; }); return schedulerPending;
  }
  function start() { if (timer === null && global.setInterval) { lastTick = null; timer = global.setInterval(serializedTick, 1000); } return serializedTick(); }
  function list(key, predicate) { var loaded = read(); return loaded.ok ? copy(loaded.state[key].filter(predicate || function () { return true; })) : []; }
  global.AIOpsUnifiedData = {
    compositePolicy:compositePolicy,validateCompositePolicy:validateCompositePolicy,evaluateCompositePolicy:evaluateCompositePolicy,
    storageKey: KEY, seedDemoCatalog:seedDemoCatalog, repairDemoAgentReferences:repairDemoAgentReferences, configure: function (next) { stop(); host = next || {}; }, initialize: initialize,
    listEvaluators: function (scene) { return list('evaluators', function (e) { return !scene || scene === 'all' || !e.sceneId || sceneId(e.sceneId) === sceneId(scene); }); }, evaluator: function (id, version) { var loaded = read(); return loaded.ok ? copy(resolve(loaded.state, id, version)) : null; },
    saveEvaluator: saveEvaluator, publishEvaluator: publishEvaluator, setEvaluatorEnabled: setEvaluatorEnabled, deleteEvaluator: deleteEvaluator, validateEvaluator: validateEvaluator, validateBinding: validateBinding,
    listJobs: function (scene) { var loaded = read(); return loaded.ok ? loaded.state.jobs.map(function (job) { return effectiveJob(job, loaded.state); }).filter(function (job) { return !scene || scene === 'all' || !job.selector.sceneId || sceneId(job.selector.sceneId) === sceneId(scene); }) : []; }, job: function (id) { var loaded = read(), record = loaded.ok && loaded.state.jobs.filter(function (job) { return job.id === id; })[0]; return record ? effectiveJob(record, loaded.state) : null; }, saveJob: saveJob, previewJob: previewJob, filterFields: filterFields, normalizeJobFilter: normalizeJobFilter, emitEvent: emitEvent, events: function(id){return list('events',function(event){return !id||event.jobId===id;});}, setJobEnabled: setJobEnabled, deleteJob: deleteJob, runJob: runJob,
    objectResults: function(id){return list('runs',function(run){return !id || run.jobId===id;}).reverse().flatMap(function(run){return (run.objectResults || []).slice().reverse();});}, sessionResults:sessionResults, sessionResult:function(jobId,sessionId,options){return sessionResults(jobId,options).filter(function(row){return row.sessionId===sessionId;})[0] || null;}, summarizeJobResults:summarizeJobResults, runs: function (id) { var loaded=read();return loaded.ok?loaded.state.runs.filter(function(run){return !id || run.jobId===id;}).slice().reverse().map(function(run){return runPresentation(run,loaded.state);}):[]; }, run:function(id){var loaded=read(),record=loaded.ok && loaded.state.runs.filter(function(run){return run.id===id;})[0];return record?runPresentation(record,loaded.state):null;}, assessments: function (id) { return list('assessments', function (a) { return !id || a.jobId === id; }).reverse(); }, assess: assess,
    trialEvaluator: function (e, sample) { var a = assess(e, { target: { id: 'trial', type: e.supportedTargets && e.supportedTargets[0] || 'session', output: sample.actual, messages: sample.messages || [], evidenceRefs: ['trial-input'] }, case: { expected: sample.reference }, task: sample.task }); return { ok: a.executionStatus === 'succeeded', assessment: a, error: a.error && a.error.message }; },
    scheduler: { start: start, stop: stop, tick: tick, nextRunAt: nextRunAt, browserOnly: true, backfill: false }, startScheduler: start, stopScheduler: stop,
    normalizeTargets: function (job) { return copy(collectTargets(job, copy(host.sessions ? host.sessions() : []), tasks())); }, defaultInputMapping: defaultInputMapping, prepareEvaluatorForEditing: prepareEvaluatorForEditing, prepareEvaluatorForAuthoring:prepareEvaluatorForAuthoring, prepareCompositePolicyForAuthoring:prepareCompositePolicyForAuthoring, defaultEvaluationPolicy:defaultEvaluationPolicy, defaultCompositePolicy:defaultCompositePolicy, deriveEvidenceRequirements: deriveEvidenceRequirements, deriveEvaluatorContract: deriveEvaluatorContract, isPromptEvaluator: isPromptEvaluator, isV4Evaluator: isV4Evaluator, decisionRules: decisionRules, itemPolicies: itemPolicies, hasDecision: hasDecision, decisionMigrationStatus: decisionMigrationStatus, judgeModels: judgeModels, runtimeModels: runtimeModels, resolveModel: resolveModel, modelDisplayName: modelDisplayName, defaultJudgeRuntime: defaultJudgeRuntime, validateJudgeRuntime: validateJudgeRuntime, hash: digest
  };
})(window);
