/* Online evaluator drafts and local persistence. Copilot generation is a deterministic Mock. */
(function (global) {
  'use strict';
  var STORAGE_KEY = 'aiops.online-evaluators.v1';
  var MODELS = ['deepseek 4.1 flash', 'GPT-6.1 Sol', 'Claude 5.5 Opus'];
  var GRANULARITIES = [{ id: 'session', name: 'Session（会话）' }, { id: 'trace', name: 'Trace（执行链路）' }, { id: 'span', name: 'Span（执行步骤）' }, { id: 'business-task', name: '业务任务评估器' }];
  var SPAN_TYPES = [{ id: 'ontology', name: '本体执行' }, { id: 'model', name: '模型调用' }, { id: 'tool', name: '工具调用' }, { id: 'agent', name: '智能体' }, { id: 'guard', name: '安全围栏' }];
  var REPEATS = ['daily', 'weekly', 'monthly', 'interval', 'once'];
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function number(value) { return typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN; }
  function unique(values) { return values.filter(function (value, index) { return values.indexOf(value) === index; }); }
  function catalog() { return global.AIOpsWorkspaces && global.AIOpsWorkspaces.scopeCatalog ? global.AIOpsWorkspaces.scopeCatalog() : []; }
  function scenes() { return catalog().map(function (scene) { return { id: scene.id, name: scene.name, parentId: scene.parentId }; }); }
  function inScope(scene, id) { return !id || id === 'all' || scene.id === id || scene.parentId === id; }
  function agents(sceneId) {
    return catalog().filter(function (scene) { return inScope(scene, sceneId); }).reduce(function (all, scene) {
      return all.concat((scene.items || []).filter(function (item) { return item.type === 'Agent'; }).map(function (item) { return { id: item.id, name: item.name }; }));
    }, []);
  }
  function defaultScene(id) { var list = scenes(); return list.filter(function (scene) { return inScope(scene, id); })[0] || list[0] || { id: '' }; }
  function taskDefinitions(sceneId, agentId) {
    var tasks = global.AIOpsBusinessTasks && global.AIOpsBusinessTasks.catalog ? global.AIOpsBusinessTasks.catalog() : [];
    return tasks.filter(function (task) {
      var scene = scenes().filter(function (item) { return item.id === task.scene; })[0];
      return scene && inScope(scene, sceneId) && (!agentId || task.agentId === agentId);
    });
  }
  function taskPrompt(tasks) {
    return '从完整正式用户会话中识别以下业务任务的每次独立执行。仅提及任务、补充资料和追问不能创建新执行；新的独立请求可以创建新执行。保留起始用户消息与完成 Agent 回复的消息标识。分别判断是否完成和是否满足通过标准，证据不足保留待确认。按任务执行列表输出，逐项提供评估维度结果及原始消息依据。\n\n' + tasks.map(function (task) {
      return task.id + ' ' + task.name + ' ' + task.version + '\n任务定义：' + task.description + '\n任务输入：' + task.input + '\n预期产出：' + task.output + '\n完成条件：' + task.completion + '\n通过标准：\n' + task.criteria.map(function (criterion) { return '- ' + criterion; }).join('\n') + '\n评估维度：\n' + task.dimensions.map(function (dimension) { return '- ' + dimension.name + '：' + dimension.description; }).join('\n');
    }).join('\n\n');
  }
  function bindTasks(draft, ids) {
    var next = clone(draft), available = taskDefinitions(next.sceneId, next.agentId);
    next.granularity = 'business-task'; next.taskIds = unique((ids || []).map(text).filter(Boolean));
    next.taskSnapshots = available.filter(function (task) { return next.taskIds.indexOf(task.id) >= 0; });
    next.samplingRate = 100; next.output = { type: 'task-executions' }; next.spanTypes = [];
    next.prompt = taskPrompt(next.taskSnapshots); return next;
  }
  function defaults(sceneId) {
    return {
      name: '', description: '', sceneId: defaultScene(sceneId).id, agentId: '', tags: [], granularity: 'session', filterLogic: '', spanTypes: [], taskIds: [], taskSnapshots: [], enabled: true,
      model: MODELS[0], samplingRate: 100,
      schedule: { repeat: 'daily', time: '09:00', weekdays: [1], monthdays: [1], intervalHours: 1, onceAt: '', timezone: 'Asia/Shanghai' },
      prompt: '', output: { type: 'boolean', booleanPass: true, categories: [{ name: '符合', pass: true }, { name: '不符合', pass: false }], scoreItems: [{ name: '准确性', criteria: '', weight: 1 }], threshold: 80 }, source: 'manual'
    };
  }
  function normalize(draft) {
    draft = draft && typeof draft === 'object' ? draft : {};
    var schedule = draft.schedule || {}, output = draft.output || {};
    var result = {
      name: text(draft.name), description: text(draft.description), sceneId: text(draft.sceneId), agentId: text(draft.agentId),
      tags: unique((Array.isArray(draft.tags) ? draft.tags : []).map(text).filter(Boolean)), granularity: text(draft.granularity), filterLogic: text(draft.filterLogic),
      spanTypes: draft.granularity === 'span' ? unique((Array.isArray(draft.spanTypes) ? draft.spanTypes : []).map(text).filter(Boolean)) : [],
      model: text(draft.model), samplingRate: number(draft.samplingRate),
      schedule: { repeat: text(schedule.repeat), time: text(schedule.time), weekdays: unique((Array.isArray(schedule.weekdays) ? schedule.weekdays : []).map(number)).sort(function (a, b) { return a - b; }), monthdays: unique((Array.isArray(schedule.monthdays) ? schedule.monthdays : []).map(number)).sort(function (a, b) { return a - b; }), intervalHours: number(schedule.intervalHours), onceAt: text(schedule.onceAt), timezone: text(schedule.timezone) },
      prompt: text(draft.prompt), output: { type: text(output.type) }, source: draft.source === 'copilot' ? 'copilot' : 'manual', enabled: draft.enabled !== false
    };
    if (text(draft.id)) result.id = text(draft.id);
    if (typeof draft.originalRequest === 'string') result.originalRequest = draft.originalRequest.trim();
    if (draft.granularity === 'business-task') {
      result.taskIds = unique((Array.isArray(draft.taskIds) ? draft.taskIds : []).map(text).filter(Boolean));
      result.taskSnapshots = taskDefinitions(result.sceneId, result.agentId).filter(function (task) { return result.taskIds.indexOf(task.id) >= 0; });
      result.output = { type: 'task-executions' };
    }
    if (draft.granularity !== 'business-task' && output.type === 'boolean') result.output.booleanPass = output.booleanPass;
    if (draft.granularity !== 'business-task' && output.type === 'category') result.output.categories = (Array.isArray(output.categories) ? output.categories : []).map(function (item) { item = item || {}; return { name: text(item.name), pass: item.pass }; });
    if (draft.granularity !== 'business-task' && output.type === 'score') {
      result.output.scoreItems = (Array.isArray(output.scoreItems) ? output.scoreItems : []).map(function (item) { item = item || {}; return { name: text(item.name), criteria: text(item.criteria), weight: number(item.weight) }; });
      result.output.threshold = number(output.threshold);
    }
    return result;
  }
  function onceTimestamp(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return NaN;
    var parts = match.slice(1).map(function (part) { return Number(part || 0); });
    var local = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
    if (local.getUTCFullYear() !== parts[0] || local.getUTCMonth() !== parts[1] - 1 || local.getUTCDate() !== parts[2] || local.getUTCHours() !== parts[3] || local.getUTCMinutes() !== parts[4] || local.getUTCSeconds() !== parts[5]) return NaN;
    return local.getTime() - 8 * 3600000;
  }
  function validate(draft, options) {
    options = options || {};
    var data = normalize(draft), errors = [], schedule = data.schedule, output = data.output;
    function error(field, message) { errors.push({ field: field, message: message }); }
    ['name', 'description', 'filterLogic', 'prompt'].forEach(function (field) { if (!data[field]) error(field, { name: '请输入评估器名称', description: '请输入评估器描述', filterLogic: '请输入数据筛选逻辑', prompt: '请输入评估提示词' }[field]); });
    if (!scenes().some(function (scene) { return scene.id === data.sceneId; })) error('sceneId', '请选择有效的业务场景');
    if (!agents(data.sceneId).some(function (agent) { return agent.id === data.agentId; }) || !data.agentId || !data.sceneId || !scenes().some(function (scene) { return scene.id === data.sceneId; })) error('agentId', '请选择该业务场景内的 Agent');
    if (!data.tags.length) error('tags', '请至少添加一个标签');
    if (!GRANULARITIES.some(function (item) { return item.id === data.granularity; })) error('granularity', '请选择有效的评估粒度');
    if (data.granularity === 'business-task') {
      if (!data.taskIds.length || data.taskSnapshots.length !== data.taskIds.length) error('taskIds', '请选择当前关联 Agent 下有效的业务任务');
      if (data.samplingRate !== 100) error('samplingRate', '业务任务识别须全量扫描，采样率须为 100%');
    }
    if (data.granularity === 'span' && (!data.spanTypes.length || data.spanTypes.some(function (type) { return !SPAN_TYPES.some(function (item) { return item.id === type; }); }))) error('spanTypes', '请至少选择一种有效的 Span 类型');
    if (MODELS.indexOf(data.model) < 0) error('model', '请选择有效的评估模型');
    if (!Number.isFinite(data.samplingRate) || data.samplingRate <= 0 || data.samplingRate > 100) error('samplingRate', '抽样比例须大于 0 且不超过 100%');
    if (REPEATS.indexOf(schedule.repeat) < 0) error('schedule.repeat', '请选择有效的评估频次');
    if (schedule.timezone !== 'Asia/Shanghai') error('schedule.timezone', '时区须为 Asia/Shanghai');
    if (['daily', 'weekly', 'monthly'].indexOf(schedule.repeat) >= 0 && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time)) error('schedule.time', '请输入有效时间（HH:mm）');
    if (schedule.repeat === 'weekly' && (!schedule.weekdays.length || schedule.weekdays.some(function (day) { return !Number.isInteger(day) || day < 1 || day > 7; }))) error('schedule.weekdays', '请至少选择一天，周一至周日对应 1–7');
    if (schedule.repeat === 'monthly' && (!schedule.monthdays.length || schedule.monthdays.some(function (day) { return !Number.isInteger(day) || day < 1 || day > 31; }))) error('schedule.monthdays', '请至少选择一个有效日期（1–31 日）');
    if (schedule.repeat === 'interval' && (!Number.isInteger(schedule.intervalHours) || schedule.intervalHours < 1)) error('schedule.intervalHours', '间隔须为至少 1 个整数小时');
    if (schedule.repeat === 'once' && (!Number.isFinite(onceTimestamp(schedule.onceAt)) || !options.allowPastOnce && onceTimestamp(schedule.onceAt) <= (options.now == null ? Date.now() : new Date(options.now).getTime()))) error('schedule.onceAt', '请选择 Asia/Shanghai 时区内有效且尚未到达的执行时间');
    if ((data.granularity === 'business-task' ? ['task-executions'] : ['boolean', 'category', 'score', 'text']).indexOf(output.type) < 0) error('output.type', '请选择有效的输出类型');
    if (output.type === 'boolean' && typeof output.booleanPass !== 'boolean') error('output.booleanPass', '请选择 true 或 false 作为通过值');
    if (output.type === 'category') {
      if (output.categories.length < 2) error('output.categories', '分类输出至少需要两个枚举值');
      var categoryNames = [];
      output.categories.forEach(function (item, index) {
        if (!item.name || categoryNames.indexOf(item.name) >= 0) error('output.categories.' + index + '.name', '枚举名称不能为空且不能重复');
        categoryNames.push(item.name);
        if (typeof item.pass !== 'boolean') error('output.categories.' + index + '.pass', '请指定该枚举值是否通过');
      });
    }
    if (output.type === 'score') {
      if (!output.scoreItems.length) error('output.scoreItems', '请至少添加一个评分项');
      var weight = 0, scoreNames = [];
      output.scoreItems.forEach(function (item, index) {
        if (!item.name || scoreNames.indexOf(item.name) >= 0) error('output.scoreItems.' + index + '.name', '评分项名称不能为空且不能重复');
        scoreNames.push(item.name);
        if (!item.criteria) error('output.scoreItems.' + index + '.criteria', '请输入该评分项的评估标准');
        if (!Number.isFinite(item.weight) || item.weight <= 0) error('output.scoreItems.' + index + '.weight', '权重须为大于 0 的数值');
        weight += item.weight;
      });
      if (!Number.isFinite(weight) || Math.abs(weight - 1) > 1e-6) error('output.scoreItems', '评分项权重之和须为 1');
      if (!Number.isFinite(output.threshold) || output.threshold < 0 || output.threshold > 100) error('output.threshold', '通过阈值须在 0–100 分之间');
    }
    return errors;
  }
  function scheduleSummary(schedule) {
    var value = schedule || {}, week = ['一', '二', '三', '四', '五', '六', '日'], summary;
    if (value.repeat === 'interval') summary = '每隔 ' + value.intervalHours + ' 小时';
    else if (value.repeat === 'once') summary = '单次 ' + String(value.onceAt || '').replace('T', ' ');
    else if (value.repeat === 'weekly') summary = '每周' + (value.weekdays || []).map(function (day) { return week[day - 1] || day; }).join('、') + ' ' + (value.time || '');
    else if (value.repeat === 'monthly') summary = '每月 ' + (value.monthdays || []).join('、') + ' 日 ' + (value.time || '');
    else if (value.repeat === 'daily') summary = '每天 ' + (value.time || '');
    else return '未设置';
    return summary + '（' + (value.timezone || 'Asia/Shanghai') + '）';
  }
  function scheduleKey(schedule) {
    var value = schedule || {}, active = { repeat: value.repeat, timezone: value.timezone };
    if (value.repeat === 'interval') active.intervalHours = value.intervalHours;
    else if (value.repeat === 'once') active.onceAt = value.onceAt;
    else { active.time = value.time; if (value.repeat === 'weekly') active.weekdays = (value.weekdays || []).slice().sort(function (a, b) { return a - b; }); if (value.repeat === 'monthly') active.monthdays = (value.monthdays || []).slice().sort(function (a, b) { return a - b; }); }
    return JSON.stringify(active);
  }
  function createStore(storage, options) {
    options = options || {};
    function clock() { return new Date(typeof options.now === 'function' ? options.now() : options.now == null ? Date.now() : options.now).toISOString(); }
    function read() {
      try { var saved = JSON.parse(storage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(saved) ? { ok: true, records: saved.filter(function (record) { return record && typeof record === 'object' && typeof record.id === 'string' && typeof record.sceneId === 'string'; }) } : { ok: false, records: [] }; }
      catch (_) { return { ok: false, records: [] }; }
    }
    return {
      armSchedules: function (at) {
        var state = read(); if (!state.ok) return { ok: false, error: '评估器数据读取失败，未启用自动调度。' };
        var stamp = at == null ? clock() : new Date(at).toISOString(), changed = false;
        var next = state.records.map(function (item) {
          var record = clone(item), revision = Number.isInteger(record.scheduleRevision) && record.scheduleRevision > 0;
          if (typeof record.enabled !== 'boolean') { record.enabled = true; changed = true; }
          if (!revision) { record.scheduleRevision = 1; changed = true; }
          if (record.enabled && !Number.isFinite(Date.parse(record.armedAt))) { record.armedAt = stamp; record.enabledAt = stamp; changed = true; }
          if (!record.enabled && record.armedAt !== null) { record.armedAt = null; changed = true; }
          return record;
        });
        if (!changed) return { ok: true, changed: false };
        try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); return { ok: true, changed: true }; }
        catch (_) { return { ok: false, error: '调度状态保存失败，未启用自动调度。' }; }
      },
      setEnabled: function (id, enabled) {
        if (typeof enabled !== 'boolean') return { ok: false, error: '请选择有效的启用状态。' };
        var state = read(); if (!state.ok) return { ok: false, error: '评估器数据读取失败，状态未修改。' };
        var index = state.records.findIndex(function (record) { return record.id === id; }); if (index < 0) return { ok: false, error: '该评估器不存在，请刷新后重试。' };
        var previous = state.records[index], record = clone(previous), stamp = clock();
        if ((previous.enabled !== false) === enabled && typeof previous.enabled === 'boolean' && (!enabled || Number.isFinite(Date.parse(previous.armedAt)))) return { ok: true, record: clone(previous), changed: false };
        record.enabled = enabled; record.stateUpdatedAt = stamp; record.armedAt = enabled ? stamp : null; record.enabledAt = enabled ? stamp : previous.enabledAt || null;
        record.scheduleRevision = (Number.isInteger(previous.scheduleRevision) && previous.scheduleRevision > 0 ? previous.scheduleRevision : 0) + 1;
        var next = state.records.slice(); next[index] = record;
        try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); return { ok: true, record: clone(record), changed: true }; }
        catch (_) { return { ok: false, error: '评估器状态保存失败，请重试。' }; }
      },
      seedDefaults: function () {
        var state = read(); if (!state.ok) return { ok: false, error: '评估器数据读取失败' };
        var seeded = seedDefinitions(), missing = seeded.filter(function (item) { return !state.records.some(function (record) { return record.id === item.id; }); });
        if (!missing.length) return { ok: true, records: [] };
        try { storage.setItem(STORAGE_KEY, JSON.stringify(state.records.concat(missing))); return { ok: true, records: clone(missing) }; }
        catch (_) { return { ok: false, error: '示例评估器保存失败' }; }
      },
      list: function (scopeIds) {
        var records = read().records, ids = scopeIds == null ? ['all'] : Array.isArray(scopeIds) ? scopeIds : [scopeIds];
        return clone(records.filter(function (record) {
          var scene = scenes().filter(function (item) { return item.id === record.sceneId; })[0];
          return scene && ids.some(function (id) { return inScope(scene, id) || id === record.agentId; });
        }).map(function (record) { return Object.assign({}, record, { enabled: record.enabled !== false }); }));
      },
      save: function (draft, existingId) {
        var record = normalize(draft), errors = validate(record, { now: clock() });
        if (errors.length) return { ok: false, errors: errors };
        var state = read();
        if (!state.ok) return { ok: false, errors: [{ field: 'storage', message: '本地评估器数据读取失败，请重试' }] };
        var id = text(existingId) || text(record.id), index = id ? state.records.findIndex(function (item) { return item.id === id; }) : -1;
        if (id && index < 0) return { ok: false, errors: [{ field: 'id', message: '该评估器不存在，请重新打开后编辑' }] };
        var now = clock();
        if (index >= 0) {
          var previous = state.records[index]; record.id = previous.id; record.createdAt = previous.createdAt || now; record.source = previous.source === 'copilot' ? 'copilot' : 'manual';
          if (record.source === 'copilot' && typeof previous.originalRequest === 'string') record.originalRequest = previous.originalRequest;
          record.enabled = previous.enabled !== false; record.enabledAt = previous.enabledAt || (record.enabled ? now : null); record.stateUpdatedAt = previous.stateUpdatedAt || now;
          var changedSchedule = scheduleKey(previous.schedule) !== scheduleKey(record.schedule);
          record.scheduleRevision = (Number.isInteger(previous.scheduleRevision) && previous.scheduleRevision > 0 ? previous.scheduleRevision : 1) + (changedSchedule ? 1 : 0);
          record.armedAt = record.enabled ? changedSchedule || !Number.isFinite(Date.parse(previous.armedAt)) ? now : previous.armedAt : null;
        } else {
          var serial = state.records.reduce(function (max, item) { var match = item.id.match(/^OE-(\d+)$/); return Math.max(max, match ? Number(match[1]) : 0); }, 0) + 1;
          record.id = 'OE-' + String(serial).padStart(3, '0'); record.createdAt = now;
          record.enabled = true; record.enabledAt = now; record.armedAt = now; record.stateUpdatedAt = now; record.scheduleRevision = 1;
        }
        record.updatedAt = now;
        var next = state.records.slice(); if (index >= 0) next[index] = record; else next.unshift(record);
        try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); return { ok: true, record: clone(record) }; }
        catch (_) { return { ok: false, errors: [{ field: 'storage', message: '评估器保存失败，请重试' }] }; }
      }
    };
  }
  function seedDefinitions() {
    var options = [
      ['OE-DEMO-SESSION', '会话回答质量', 'session', 'boolean', '回答质量'],
      ['OE-DEMO-TRACE', '链路执行复盘', 'trace', 'text', '链路复盘'],
      ['OE-DEMO-SPAN', '模型调用准确性', 'span', 'score', '模型质量'],
      ['OE-DEMO-BUSINESS', '业务任务识别与结果评估', 'business-task', 'task-executions', '业务任务']
    ];
    return options.map(function (option) {
      var draft = defaults('audit'); draft.agentId = 'audit:agents:0'; draft.name = option[1]; draft.description = '持续评估正式用户会话中的' + option[4] + '，保留原始执行证据。';
      draft.tags = [option[4], '在线评测']; draft.granularity = option[2]; draft.filterLogic = '全部正式用户会话'; draft.prompt = '根据正式用户输入、Agent 回复与执行证据，评估' + option[4] + '，说明判断依据。';
      draft.output.type = option[3]; draft.spanTypes = option[2] === 'span' ? ['model'] : []; draft.output.scoreItems[0].criteria = '核对输出和原始输入、引用证据是否一致，0分为完全不符合，100分为完全符合。';
      if (option[2] === 'business-task') {
        var availableTasks = taskDefinitions(draft.sceneId, draft.agentId);
        // The evaluation workspace replaces the old task catalog. Seed against
        // its first compatible Agent when the previous audit tasks are absent.
        if (!availableTasks.length) {
          var firstTask = taskDefinitions('all').find(function (task) { return agents(task.scene).some(function (agent) { return agent.id === task.agentId; }); });
          if (firstTask) {
            draft.sceneId = firstTask.scene; draft.agentId = firstTask.agentId;
            availableTasks = taskDefinitions(draft.sceneId, draft.agentId);
          }
        }
        draft = bindTasks(draft, availableTasks.map(function (task) { return task.id; }));
      }
      draft = normalize(draft); draft.id = option[0]; draft.createdAt = '2026-11-01T01:00:00.000Z'; draft.updatedAt = draft.createdAt; return draft;
    });
  }
  function chineseNumber(value) {
    if (/^\d+$/.test(value)) return Number(value);
    var digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 日: 7, 天: 7 };
    if (value.indexOf('十') >= 0) { var parts = value.split('十'); return (digits[parts[0]] || 1) * 10 + (digits[parts[1]] || 0); }
    return digits[value] || 0;
  }
  function daysFrom(value) {
    var tokens = String(value || '').match(/\d{1,2}|[一二三四五六七八九十日天]{1,3}/g) || [];
    var result = tokens.map(chineseNumber);
    if (/[至到\-]/.test(value) && result.length === 2 && result[0] <= result[1]) { var range = []; for (var i = result[0]; i <= result[1]; i++) range.push(i); result = range; }
    return unique(result).sort(function (a, b) { return a - b; });
  }
  function generatedSchedule(request) {
    var schedule = defaults().schedule, interval = request.match(/(?:每隔?|间隔)\s*(\d+(?:\.\d+)?)\s*(?:个)?小时|every\s+(\d+)\s*hours?/i);
    var clock = request.match(/\b(\d{1,2})[:：](\d{2})\b/), hour = request.match(/(上午|下午|晚上|中午|早上|凌晨)?\s*(\d{1,2})[点时](半|\d{1,2}分?)?/);
    if (clock) schedule.time = clock[1].padStart(2, '0') + ':' + clock[2];
    else if (hour) { var h = Number(hour[2]); if (/下午|晚上|中午/.test(hour[1]) && h < 12) h += 12; if (/凌晨/.test(hour[1]) && h === 12) h = 0; schedule.time = String(h).padStart(2, '0') + ':' + (hour[3] === '半' ? '30' : String(parseInt(hour[3], 10) || 0).padStart(2, '0')); }
    if (interval) { schedule.repeat = 'interval'; schedule.intervalHours = Number(interval[1] || interval[2]); }
    else if (/每周|每星期|weekly|工作日|周末/i.test(request)) {
      schedule.repeat = 'weekly'; var weekdays = request.match(/(?:每周|每星期)\s*([一二三四五六日天1-7、，,\s和至到\-]+)/);
      schedule.weekdays = /工作日/.test(request) ? [1, 2, 3, 4, 5] : /周末/.test(request) ? [6, 7] : weekdays ? daysFrom(weekdays[1]) : [1];
    } else if (/每月|monthly/i.test(request)) {
      schedule.repeat = 'monthly'; var monthdays = request.match(/每月\s*([\d一二三四五六七八九十、，,\s和至到\-]+)\s*(?:日|号)/); schedule.monthdays = monthdays ? daysFrom(monthdays[1]) : [1];
    } else if (/单次|仅一次|一次性|仅执行一次|明天|后天|20\d{2}[-\/年]\d/i.test(request)) {
      schedule.repeat = 'once'; var date = request.match(/(20\d{2})[-\/年](\d{1,2})[-\/月](\d{1,2})(?:日|号)?/);
      var day = date ? date[1] + '-' + date[2].padStart(2, '0') + '-' + date[3].padStart(2, '0') : new Date(Date.now() + 8 * 3600000 + (/后天/.test(request) ? 2 : 1) * 86400000).toISOString().slice(0, 10);
      schedule.onceAt = day + 'T' + schedule.time;
    }
    return schedule;
  }
  function generate(request, sceneId) {
    request = typeof request === 'string' ? request.trim() : '';
    var draft = defaults(sceneId), available = agents(sceneId), scene = scenes().filter(function (item) { return item.id === draft.sceneId; })[0];
    var namedAgent = available.filter(function (agent) { return request.indexOf(agent.name) >= 0; })[0];
    draft.agentId = (namedAgent || available[0] || { id: '' }).id;
    var agentScene = scenes().filter(function (item) { return agents(item.id).some(function (agent) { return agent.id === draft.agentId; }); })[0];
    if (agentScene) { scene = agentScene; draft.sceneId = agentScene.id; }
    draft.source = 'copilot'; draft.originalRequest = request;
    var explicitSpan = /\bspan\b/i.test(request), spanMention = /(?:本体|模型|工具|智能体|Agent|安全围栏).{0,2}(?:执行|调用)|调用记录/i.test(request);
    draft.granularity = /业务任务评估|业务任务识别|识别.{0,12}业务任务|业务任务.{0,8}(?:识别|执行次数|执行结果)/.test(request) ? 'business-task' : explicitSpan ? 'span' : /\btrace\b|执行链路|完整链路|链路级/i.test(request) ? 'trace' : spanMention ? 'span' : 'session';
    if (draft.granularity === 'span') {
      var spanPatterns = { ontology: /本体|ontology/i, model: /模型调用|模型执行|LLM|model\s*(?:call|span)/i, tool: /工具|tool/i, agent: /智能体(?:执行|调用)|Agent\s*(?:call|span)/i, guard: /安全围栏|guard|护栏/i };
      draft.spanTypes = SPAN_TYPES.filter(function (type) { return spanPatterns[type.id].test(request); }).map(function (type) { return type.id; });
      if (!draft.spanTypes.length) draft.spanTypes = SPAN_TYPES.map(function (type) { return type.id; });
    }
    var modelMatches = [{ value: MODELS[0], pattern: /deepseek/i }, { value: MODELS[1], pattern: /GPT(?:-?6\.1)?(?:\s*Sol)?/i }, { value: MODELS[2], pattern: /Claude(?:\s*5\.5)?(?:\s*Opus)?/i }].map(function (item) { var match = item.pattern.exec(request); return match ? { value: item.value, at: match.index } : null; }).filter(Boolean).sort(function (a, b) { return a.at - b.at; });
    if (modelMatches.length) draft.model = modelMatches[0].value;
    var topicPatterns = [['回答质量', /回答|回复|会话质量/], ['准确性', /准确|正确/], ['完整性', /完整|遗漏/], ['安全合规', /安全|合规|风险/], ['成本效率', /成本|Token/i], ['性能', /性能|延迟|耗时/], ['工具调用', /工具/], ['本体执行', /本体/]];
    draft.tags = topicPatterns.filter(function (item) { return item[1].test(request); }).map(function (item) { return item[0]; });
    var tags = request.match(/标签\s*[:：]\s*([^。；;\n]+)/); if (tags) draft.tags = tags[1].split(/[、，,|/]/).map(text).filter(Boolean);
    if (!draft.tags.length) draft.tags = ['在线评测'];
    var sample = request.match(/(?:抽样|采样|sampling)\D{0,8}(\d+(?:\.\d+)?)\s*[%％]|(\d+(?:\.\d+)?)\s*[%％]\s*(?:抽样|采样)/i);
    if (sample) draft.samplingRate = Number(sample[1] || sample[2]);
    draft.schedule = generatedSchedule(request);
    draft.output.type = /(?:输出|返回|结果).{0,6}(?:文本|文字|text)/i.test(request) ? 'text' : /分类|类别|枚举|category/i.test(request) ? 'category' : /评分|打分|score|分数|分值/i.test(request) ? 'score' : 'boolean';
    draft.output.booleanPass = !/(?:false|否)\s*(?:表示|视为|为)?通过|通过(?:值|条件)[^。；;\n]{0,12}false/i.test(request);
    if (draft.output.type === 'category') {
      var categories = request.match(/(?:分类|类别|枚举)(?:值|结果)?\s*(?:为|是|[:：])\s*([^。；;\n]+)/);
      var names = categories ? unique(categories[1].split(/[、，,|/]/).map(text).filter(Boolean)) : [];
      if (names.length >= 2) {
        draft.output.categories = names.map(function (name) { return { name: name, pass: !/不|未|失败|错误|风险|差|拒绝|违规/.test(name) }; });
      }
    }
    if (draft.output.type === 'score') {
      var dimensionNames = ['准确性', '完整性', '相关性', '安全性', '合规性', '可追溯性', '工具选择', '参数正确性', '执行结果'].filter(function (name) { return request.indexOf(name) >= 0; });
      if (!dimensionNames.length) dimensionNames = ['准确性'];
      var weights = dimensionNames.map(function (name) { var match = request.match(new RegExp(name + '\\s*(?:权重)?\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)\\s*[%％]')); return match ? Number(match[1]) / 100 : null; });
      var explicitWeights = weights.every(function (weight) { return weight != null; }) && Math.abs(weights.reduce(function (sum, weight) { return sum + weight; }, 0) - 1) <= 1e-6;
      draft.output.scoreItems = dimensionNames.map(function (name, index) { return { name: name, criteria: '依据原始输入、输出和执行证据评估' + name + '；0 分表示完全不符合，100 分表示完全符合。', weight: explicitWeights ? weights[index] : index === dimensionNames.length - 1 ? 1 - index / dimensionNames.length : 1 / dimensionNames.length }; });
      var threshold = request.match(/(?:通过阈值|阈值|及格分|通过分|至少|达到)\s*(?:为|是|[:：])?\s*(\d+(?:\.\d+)?)\s*(?:分|[%％])?|(\d+(?:\.\d+)?)\s*分(?:及以上|以上)?\s*(?:为|算)?通过/);
      if (threshold) draft.output.threshold = Number(threshold[1] || threshold[2]);
    }
    var title = request.match(/名称\s*[:：]\s*[“"']?([^”"'\n，,。；;]+)/);
    draft.name = title ? title[1].trim() : /工具/.test(request) ? '工具调用质量评测' : /本体/.test(request) ? '本体执行质量评测' : /安全|合规/.test(request) ? '安全合规评测' : /成本/.test(request) ? '调用成本评测' : /回答|回复/.test(request) ? '回答质量评测' : /完整/.test(request) ? '任务完整性评测' : /准确|正确/.test(request) ? '任务准确性评测' : draft.granularity === 'trace' ? '线上链路质量评测' : draft.granularity === 'span' ? '执行步骤质量评测' : '线上会话质量评测';
    var agentName = (namedAgent || available[0] || { name: '所选 Agent' }).name;
    draft.description = '评估' + agentName + '在正式用户使用中的' + ({ session: '会话', trace: '执行链路', span: '执行步骤', 'business-task': '业务任务执行' }[draft.granularity]) + '质量。' + request;
    var range = request.match(/(?:最近|近)\s*(\d+)\s*(?:天|日)/), hours = request.match(/(?:最近|近)\s*(\d+)\s*小时/), conditions = ['所属场景为' + (scene ? scene.name : '所选业务场景'), 'Agent 为' + agentName, '仅包含正式用户使用记录'];
    if (/当天|今天|当日/.test(request)) conditions.push('时间范围为评估执行当天（Asia/Shanghai）');
    else if (/昨天|昨日/.test(request)) conditions.push('时间范围为评估执行前一天（Asia/Shanghai）');
    else if (hours) conditions.push('时间范围为最近 ' + hours[1] + ' 小时');
    else if (range) conditions.push('时间范围为最近 ' + range[1] + ' 天');
    if (/新增|新建|新产生/.test(request)) conditions.push('按记录创建时间筛选新增记录');
    if (/(?:只|仅).{0,8}(?:失败|异常)|失败记录|异常记录/.test(request)) conditions.push('仅包含失败或异常的执行记录');
    else if (/已完成|完成记录/.test(request)) conditions.push('任务执行状态为已完成');
    if (draft.granularity === 'span') conditions.push('Span 类型属于：' + SPAN_TYPES.filter(function (type) { return draft.spanTypes.indexOf(type.id) >= 0; }).map(function (type) { return type.name; }).join('、'));
    draft.filterLogic = conditions.join('；') + '。';
    draft.prompt = '你是在线评测评估器。依据提供的正式用户记录进行判断，使用原始输入、Agent 输出与执行证据，不补造未采集的信息。\n\n评估需求：\n' + request + '\n\n逐项说明判断依据，并按配置的' + ({ boolean: '布尔', category: '分类', score: '0–100 分评分', text: '文本' }[draft.output.type]) + '格式输出结果。';
    if (draft.granularity === 'business-task') {
      var availableTasks = taskDefinitions(draft.sceneId, draft.agentId), namedTasks = availableTasks.filter(function (task) { return request.indexOf(task.name) >= 0 || request.indexOf(task.id) >= 0; });
      draft = bindTasks(draft, (namedTasks.length ? namedTasks : availableTasks).map(function (task) { return task.id; }));
      draft.name = title ? title[1].trim() : '业务任务识别与结果评估'; draft.prompt += '\n\n补充评估需求：\n' + request;
    }
    return draft;
  }
  global.AIOpsOnlineEvaluatorData = { constants: { models: MODELS.slice(), granularities: clone(GRANULARITIES), spanTypes: clone(SPAN_TYPES) }, defaults: defaults, scenes: scenes, agents: agents, taskDefinitions: taskDefinitions, bindTasks: bindTasks, taskPrompt: taskPrompt, validate: validate, normalize: normalize, scheduleSummary: scheduleSummary, scheduleKey: scheduleKey, onceTimestamp: onceTimestamp, createStore: createStore, generate: generate };
})(window);
