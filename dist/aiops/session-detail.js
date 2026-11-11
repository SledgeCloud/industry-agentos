/* Live session inspection — read-only demo data, shared AIOps chrome. */
(function (global) {
  'use strict';
  var host = {};
  var ui = { id: null, tab: 'conversation', format: 'conversation', round: 1, jump: false, replyTarget: null, traceId: null, inspectorTab: 'io', inspectorOpen: true, query: '', type: '', abnormal: false };
  var cache = {};
  var choiceMenu = null;
  var TYPES = [ ['user', '用户'], ['model', '模型'], ['tool', '工具'], ['ontology', '本体'], ['agent', '智能体'], ['guard', '安全围栏'], ['memory', '记忆'], ['other', '其他'] ];
  var TRACE_LANES = [ ['input', '输入', ['user', 'memory', 'other']], ['model', '模型', ['model']], ['tool', '工具', ['tool']], ['ontology', '本体', ['ontology']], ['agent', '智能体', ['agent']], ['guard', '安全围栏', ['guard']] ];
  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ico(name) { return '<i data-lucide="' + name + '"></i>'; }
  function tr(zh, en) { return host.lang && host.lang() === 'en' ? en : zh; }
  function typeLabel(type) { var found = TYPES.filter(function (item) { return item[0] === type; })[0]; return found ? found[1] : type; }
  function badge(type) { return '<span class="sd-type sd-type-' + type + '">' + esc(typeLabel(type)) + '</span>'; }
  function button(action, label, icon, extra) { return '<button type="button" class="btn-soft" data-sd="' + action + '"' + (extra || '') + '>' + ico(icon) + esc(label) + '</button>'; }
  function iconButton(action, label, icon, extra) { return '<button type="button" class="sd-icon" data-sd="' + action + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (extra || '') + '>' + ico(icon) + '</button>'; }
  function currentRow() { return host.row ? host.row(ui.id) : null; }
  function timeAt(end, offset) { return new Date(Date.parse(end.replace(' ', 'T') + ':00+08:00') + offset + 8 * 3600000).toISOString().replace('Z', '+08:00'); }
  function clock(value) { return value.slice(11, 23); }
  // These visible dialogue fixtures give the online Mock evaluator evidence to read.
  // They are conversation content, rather than evaluator outcomes inferred from errors or user marks.
  var taskDialogue = {
    'CR-1024': ['BT-001', '月末关账审核', 17, 'pending', '审核报告已生成，但部分附注来源附件仍待补充，需业务复核。'],
    'CR-1019': ['BT-001', '月末关账审核', 13, 'rejected', '报告的附注引用不完整，不满足引用可追溯的通过标准。'],
    'CR-1002': ['BT-001', '月末关账审核', 17, 'pending', '检查清单已执行，来源附件仍待业务确认。'],
    'CR-1001': ['BT-001', '月末关账审核', 6, 'passed'],
    'CR-1021': ['BT-002', '关联方与往来对账', 5, 'rejected', '未达项解释缺少双方明细依据，不满足每个未达项均可追溯的通过标准。'],
    'CR-1013': ['BT-002', '关联方与往来对账', 8, 'passed'],
    'CR-1006': ['BT-002', '关联方与往来对账', 10, 'passed'],
    'CR-1022': ['BT-003', '收入与合同核验', 7, 'passed'],
    'CR-1005': ['BT-003', '收入与合同核验', 7, 'passed'],
    'CR-1004': ['BT-003', '收入与合同核验', 14, 'rejected', '截止性结论与履约记录不一致，不满足收入确认时点与履约证据一致的通过标准。'],
    'CR-1023': ['BT-004', '费用与税金复核', 10, 'rejected', '跨期计提说明未覆盖全部调整记录，不满足跨期计提和冲回关系正确的通过标准。'],
    'CR-1017': ['BT-004', '费用与税金复核', 4, 'passed'],
    'CR-1016': ['BT-004', '费用与税金复核', 7, 'passed'],
    'CR-1015': ['BT-004', '费用与税金复核', null, 'failed', '资料读取中断，未生成完整复核结果。'],
    'CR-1009': ['BT-004', '费用与税金复核', 5, 'passed'],
    'CR-1003': ['BT-004', '费用与税金复核', 4, 'passed'],
    'CR-1020': ['BT-005', '资产与负债计量核验', 9, 'passed'],
    'CR-1014': ['BT-005', '资产与负债计量核验', 5, 'passed'],
    'CR-1012': ['BT-005', '资产与负债计量核验', 9, 'passed'],
    'CR-1011': ['BT-005', '资产与负债计量核验', 6, 'passed'],
    'CR-1010': ['BT-005', '资产与负债计量核验', 12, 'passed'],
    'CR-1008': ['BT-005', '资产与负债计量核验', 10, 'passed'],
    'CR-1007': ['BT-005', '资产与负债计量核验', 4, 'passed'],
    'CR-1018': ['BT-006', '规则适用范围确认', 6, 'passed'],
    'CR-1027': ['BT-007', '制造业规则阈值复核', 12, 'passed'],
    'CR-1028': ['BT-008', '模型调用成本分析', null, 'running'],
    'CR-1025': ['BT-008', '模型调用成本分析', null, 'failed', '调用明细读取失败，未完成成本归因。'],
    'CR-1026': ['BT-009', '会话回答质量复盘', 8, 'passed']
  };
  function taskReply(profile, task, row, round) {
    var verdict = profile[3], criteria = task && task.criteria || [], dimensions = task && task.dimensions || [];
    return '已完成「' + profile[1] + '」本次执行。\n完成条件：' + (task ? task.completion : '完成指定核验并生成结果。') + '\n已生成产出：' + (task ? task.output : '任务结果与原始记录依据') + '。\n来源记录：' + row.id + '；产出编号：report_' + row.id.toLowerCase() + '_' + round + '。\n\n评估维度：\n' + dimensions.map(function (dimension, index) { return '- ' + dimension.name + '：' + (verdict === 'passed' ? '符合。' + (criteria[index] || dimension.description) : index === 0 ? (verdict === 'rejected' ? '不符合。' : '待确认。') + profile[4] : '已核验，保留原始记录依据。'); }).join('\n') + '\n\n通过标准核验：' + (verdict === 'passed' ? '满足，逐项核验均符合，原始来源与规则版本已关联。' : profile[4]);
  }
  function makeData(row) {
    var conversation = Array.isArray(row.conversation) ? row.conversation : row.conversation && Array.isArray(row.conversation.rounds) ? row.conversation.rounds : null;
    var rounds = conversation ? conversation.length : Math.ceil(row.messages / 2);
    var profile = !conversation && taskDialogue[row.id], task = profile && global.AIOpsBusinessTasks && global.AIOpsBusinessTasks.definition ? global.AIOpsBusinessTasks.definition(profile[0]) : null;
    var duration = row.id === 'CR-1024' ? 82 : Math.max(24, rounds * 4);
    var requestCount = rounds * 8 + 1;
    var prompts = [
      '请展开核验依据，保留规则版本和原始记录位置。',
      '把需要我补充的资料单独列出来，区分已确认和待确认的问题。',
      '请解释资料缺失与核验不通过的区别，避免直接判定业务错误。',
      '请按来源记录逐项复核，说明问题归属和适用的规则。',
      '请整理本轮复核后的待确认项，并列出下一步处理建议。',
      '请核对跨期调整记录，保留调整前后的差异。',
      '请补充来源会话、附件及原始数据的引用位置。',
      '这些结论分别依据哪一版规则？请说明生效范围。',
      '把已经解决的问题排除，只保留仍需业务确认的核验项。',
      '请按影响程度整理问题，说明哪些需要优先核实。',
      '请重新检查关联记录，确认是否存在重复核验。',
      '请汇总当前进展，给出可以直接交接的复核清单。'
    ];
    var initial = row.id === 'CR-1024'
      ? '请审核这份制造业客户的月末管理报表，重点核对预提费用跨期、收入确认和关联方余额。请列出核验依据及需要我确认的问题。'
      : '请分析「' + row.name + '」相关数据，核对原始记录、适用规则和异常情况，并列出需要确认的问题。';
    var firstAnswer = row.id === 'CR-1024'
      ? '已完成对上传报表的初步核验。\n\n1. 预提费用：有 2 笔费用的计提月份与冲回月份需要核对，已关联 R-028 v3。\n2. 收入确认：有 1 笔收入缺少交付确认附件，暂列为待补充证据，未直接判断为确认错误。\n3. 关联方余额：3 组往来余额需与对方对账单交叉核对。\n\n共整理 6 项待复核问题。请补充交付附件及对账单后，由业务负责人确认最终结论。'
      : '已完成「' + row.name + '」的初步分析。\n\n1. 已核对原始数据和适用规则，保留来源记录及版本。\n2. 发现的异常已与执行记录关联，缺失证据单独标记为待确认。\n3. 请由业务负责人补充资料并复核相关结论。';
    var data = { rounds: [], records: [], steps: requestCount, duration: duration, messageCount: row.messages };
    var step = 0, modelIndex = 0, messageIndex = 0, tokensUsed = 0;
    var totalTokens = Math.round((Number(row.tokens) || 0) * 1000000);
    function record(type, name, input, output, round, state, elapsed) {
      var isRequest = type !== 'user' && type !== 'other';
      var requestStep = isRequest ? ++step : null;
      var token = 0;
      if (type === 'model') {
        modelIndex += 1;
        token = modelIndex === 1 ? Math.min(327619, totalTokens) : modelIndex === rounds * 3 ? totalTokens - tokensUsed : Math.floor((totalTokens - Math.min(327619, totalTokens)) / Math.max(1, rounds * 3 - 1));
        tokensUsed += token;
      }
      var roundMs = duration * 1000 / rounds;
      var stepInRound = isRequest ? (round === 1 ? requestStep : requestStep - (9 + (round - 2) * 8)) : 0;
      var offset = -duration * 1000 + ((round || 1) - 1) * roundMs + (isRequest ? stepInRound / (round === 1 ? 9 : 8) * roundMs : type === 'other' ? data.records.length < 2 ? (data.records.length - 2) * 20 : 10 : 0);
      var item = { id: row.id + '-trace-' + String(data.records.length + 1).padStart(3, '0'), session_id: row.id, type: type, name: name, round: round || 0, step: requestStep, status: state || 'completed', duration_ms: elapsed || (isRequest ? 320 : 0), tokens: token, timestamp: timeAt(row.time, offset), input: input, output: output };
      data.records.push(item); return item;
    }
    record('other', '初始系统提示词', { agent: row.agent }, '依据给定规则、原始记录与本体对象关系核验；资料缺失时标记待确认。', 0);
    record('other', '已加载审核规则库', { version: 'v3' }, '规则版本、原始文件与来源引用随请求一同保留。', 0);
    for (var i = 1; i <= rounds; i++) {
      var prompt = i === 1 ? initial : prompts[(i - 2) % prompts.length];
      var answer = i === 1 ? firstAnswer : '第 ' + i + ' 轮复核已完成。\n\n' + ['已展开对应来源记录，保留规则 R-028 v3 和原始数据位置。', '缺失的交付证明、调整记录及对账附件已单独列为待补充资料。', '待确认问题已写入核验项清单，补充证据后再确认最终结论。', '已区分已确认事项与待核实事项，未将缺失资料直接判定为业务错误。'][(i - 2) % 4] + '\n\n建议继续补充证据，并由业务负责人确认。';
      if (profile) {
        if (i === 1) prompt = '请执行「' + profile[1] + '」任务。' + initial + (task ? '\n本次输入：' + task.input + '；预期产出：' + task.output + '。' : '');
        answer = i === profile[2] ? taskReply(profile, task, row, i) : i < (profile[2] || Infinity) ? '「' + profile[1] + '」执行处理中，正在核对原始记录，尚未生成完整的任务产出。\n' + (profile[3] === 'failed' ? profile[4] : '本轮仅补充核验依据，继续原任务，不新增一次执行。') : '补充说明上一项已完成任务的来源记录，不重新执行任务。\n' + prompts[(i - 2) % prompts.length];
        if (row.id === 'CR-1024' && i === 19) { prompt = '请开始新的一次「月末关账审核」任务，这次审核 10 月关账资料，与前面的 9 月审核是两项独立工作。'; answer = '已开始新一次月末关账审核，正在核对 10 月资料，尚未生成完整产出。'; }
        if (row.id === 'CR-1024' && i === 20) { prompt = '这是本次 10 月审核的补充凭证，请继续刚才的任务。'; answer = '已补充原始凭证，继续本次 10 月审核，尚未生成完整产出。'; }
        if (row.id === 'CR-1024' && i === 21) { prompt = '请汇总本次 10 月关账审核的最终结果。'; answer = taskReply([profile[0], profile[1], 21, 'passed'], task, row, i); }
      }
      var custom = conversation && conversation[i - 1];
      if (custom) { prompt = String(custom.input == null ? '' : custom.input); answer = String(custom.output == null ? '' : custom.output); }
      var turn = { n: i, input: prompt, output: answer, inputId: row.id + '-msg-' + String(++messageIndex).padStart(3, '0'), inputAt: timeAt(row.time, -duration * 1000 + (i - 1) * duration * 1000 / rounds), outputAt: timeAt(row.time, -duration * 1000 + i * duration * 1000 / rounds), hasOutput: messageIndex < row.messages, attachment: i === 1 ? (row.id === 'CR-1024' ? '制造业_9月管理报表.xlsx' : row.name + '_原始资料.xlsx') : null, signal: i <= Math.max(row.errors, row.warnings), steps: i === 1 ? 9 : 8 };
      if (custom) { turn.hasOutput = custom.hasOutput == null ? custom.output != null : !!custom.hasOutput; turn.inputId = custom.inputId || turn.inputId; turn.inputAt = custom.inputAt || turn.inputAt; turn.outputAt = custom.outputAt || turn.outputAt; if (custom.attachment != null) turn.attachment = custom.attachment; }
      if (turn.hasOutput) turn.outputId = row.id + '-msg-' + String(++messageIndex).padStart(3, '0');
      if (custom && turn.hasOutput && custom.outputId) turn.outputId = custom.outputId;
      turn.feedback = i === 1 && row.errors > 0 ? { sentiment: 'negative', tags: ['没有帮助', '信息虚假'], comment: row.id === 'CR-1024' ? '这两笔费用已在线下冲回，请先核对补充凭证，再判断是否需要调整。' : '请补充原始证据，并重新核实相关结论。', user: row.user, at: row.time + ':00' } : i === 3 ? { sentiment: 'positive', tags: ['有帮助', '依据清晰'], comment: '来源和待确认项已经说明清楚。', user: row.user, at: row.time + ':00' } : null;
      data.rounds.push(turn);
      record('user', '原始输入', { user: row.user }, prompt, i);
      if (i === 1) record('other', '已加载审核本体', { object_set: '关账核验对象集', version: 'v1.2' }, '本体对象集已就绪。', i);
      record('tool', 'document.parse', { file_name: turn.attachment || '补充核验资料', round: i }, { pages: i === 1 ? 28 : 3, source_refs: [turn.attachment || '补充记录-' + i] }, i);
      record('tool', 'knowledge.search', { query: row.name, rule_version: 'v3' }, i <= row.warnings ? 'RULE_SCOPE_UNCONFIRMED：适用范围需要业务确认。' : { rules: ['R-028 v3', 'R-014 v2'], source_refs: ['规则库 / 月末审核'] }, i, i <= row.warnings ? 'warning' : 'completed');
      record('ontology', 'ontology.query', { object_set: '关账核验对象集', session_id: row.id }, { finding_id: row.id + '-finding-' + i, status: '待确认' }, i);
      record('model', '模型核验推理', { system: '依据给定规则、原始记录与本体对象关系核验；资料缺失时标记待确认。', user: prompt, context: ['R-028 v3', '原始记录', '核验对象集'] }, { finding: '核验项已整理，业务结论待确认。', evidence: ['R-028 v3', row.id + '-finding-' + i] }, i, 'completed', 1560);
      record('ontology', 'ontology.action', { action: '创建待确认核验项', finding_id: row.id + '-finding-' + i }, { saved: true }, i);
      record('tool', 'report.create', { session_id: row.id, round: i, format: 'Markdown' }, i <= row.errors ? 'GATEWAY_TIMEOUT：报告网关超时，已保留核验结果。' : { report_id: 'report_' + row.id.toLowerCase() + '_' + i, status: 'completed' }, i, i <= row.errors ? 'error' : 'completed');
      if (i === 1) record('tool', 'report.create.retry', { session_id: row.id, idempotency_key: row.id + '-report-1' }, { report_id: 'report_' + row.id.toLowerCase() + '_01', status: 'completed' }, i);
      record('model', '整理核验结果', { findings: [row.id + '-finding-' + i], instructions: '保留证据，区分待确认与已确认。' }, answer, i);
      record('model', '原始输出', { conversation_id: row.id, round: i }, turn.hasOutput ? answer : '等待后续输出。', i);
    }
    if (row.conversation && !Array.isArray(row.conversation) && Array.isArray(row.conversation.records)) data.records = JSON.parse(JSON.stringify(row.conversation.records));
    if (conversation) data.messageCount = data.rounds.reduce(function (count, turn) { return count + 1 + (turn.hasOutput ? 1 : 0); }, 0);
    return data;
  }
  function dataFor(row) { var signature = JSON.stringify([row.conversation || null, row.messages, row.time, row.tokens, row.errors, row.warnings]); if (!cache[row.id] || cache[row.id].signature !== signature) cache[row.id] = { signature: signature, data: makeData(row) }; return cache[row.id].data; }
  function reset(id) { ui = { id: id, tab: 'conversation', format: 'conversation', round: 1, jump: false, replyTarget: null, traceId: null, inspectorTab: 'io', inspectorOpen: true, query: '', type: '', abnormal: false }; }
  function replyAt(row, round) {
    if (!row || !Number.isInteger(round)) return null;
    var turn = dataFor(row).rounds.filter(function (item) { return item.n === round && item.hasOutput && item.outputId; })[0];
    return turn ? { round: turn.n, messageId: turn.outputId, completedAt: turn.outputAt } : null;
  }
  function focusReply(row, target) {
    if (!row) return false;
    closeChoiceMenu(); selectRow(row.id);
    ui.tab = 'conversation'; ui.format = 'conversation'; ui.round = 1; ui.replyTarget = null; ui.jump = true;
    if (!target) return true;
    var reply = replyAt(row, target.round);
    if (!reply || reply.messageId !== target.messageId) return false;
    ui.round = reply.round;
    ui.replyTarget = { round: reply.round, messageId: reply.messageId, recordId: target.recordId || '', taskId: target.taskId || '', taskName: target.taskName || '' };
    return true;
  }

  function display(value) { return typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
  function rawMessages(row, data) {
    var messages = [];
    data.rounds.forEach(function (turn) {
      messages.push({ id: turn.inputId, role: 'user', user: row.user, created_at: turn.inputAt, content: turn.input, attachments: turn.attachment ? [turn.attachment] : [] });
      if (turn.hasOutput) messages.push({ id: turn.outputId, role: 'assistant', agent: row.agent, created_at: turn.outputAt, content: turn.output, feedback: turn.feedback });
    });
    return { session_id: row.id, agent: row.agent, messages: messages };
  }
  function feedbackHtml(feedback) {
    if (!feedback) return '';
    return '<aside class="sd-feedback"><header><strong>' + tr('用户反馈', 'User feedback') + '</strong><span class="' + (feedback.sentiment === 'negative' ? 'sd-negative' : 'sd-positive') + '">' + ico(feedback.sentiment === 'negative' ? 'thumbs-down' : 'thumbs-up') + tr(feedback.sentiment === 'negative' ? '劣质' : '优质', feedback.sentiment === 'negative' ? 'Poor' : 'Good') + '</span><small>' + esc(feedback.user + ' · ' + clock(feedback.at).slice(0, 8)) + '</small></header><p>' + esc(feedback.comment) + '</p><div class="sd-feedback-tags">' + feedback.tags.map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '</div></aside>';
  }
  function messageBody(text) {
    return String(text).split(/\n{2,}/).map(function (paragraph) {
      var lines = paragraph.split('\n');
      if (lines.every(function (line) { return /^\d+\.\s/.test(line); })) return '<ol>' + lines.map(function (line) { return '<li>' + esc(line.replace(/^\d+\.\s*/, '')) + '</li>'; }).join('') + '</ol>';
      return '<p>' + esc(paragraph) + '</p>';
    }).join('');
  }
  function messageHtml(row, turn, input) {
    var id = input ? turn.inputId : turn.outputId;
    var actor = input ? row.user : row.agent;
    var attachment = input && turn.attachment ? '<span class="cui-session-ref sd-attachment" title="' + esc(turn.attachment) + '"><span class="cui-session-ref-icon">' + ico('file-spreadsheet') + '</span><span class="cui-session-ref-label">' + esc(turn.attachment) + '</span></span>' : '';
    var at = input ? turn.inputAt : turn.outputAt;
    var completion = !input && ui.replyTarget && ui.replyTarget.messageId === id;
    var completionLabel = completion ? '<div class="sd-completion-heading">' + ico('circle-check') + '<strong>' + tr('任务完成 · 第 ' + turn.n + ' 轮', 'Task completed · Turn ' + turn.n) + '</strong></div>' : '';
    return '<article class="sd-message' + (input ? ' is-user' : '') + (completion ? ' is-task-completion' : '') + '" data-message-id="' + esc(id) + '" data-round="' + turn.n + '"' + (completion ? ' data-completion-record="' + esc(ui.replyTarget.recordId) + '" tabindex="-1"' : '') + ' aria-label="' + esc(actor + (input ? tr('的输入', ' input') : tr('的回复', ' response'))) + '">' + completionLabel + '<header><div class="sd-message-source"><span class="sd-speaker-avatar' + (input ? '' : ' is-agent') + '" aria-hidden="true">' + (input ? esc(actor.slice(0, 1).toUpperCase()) : ico('bot')) + '</span><span class="sd-muted" title="' + esc(actor) + '">' + esc(actor) + '</span></div><div class="sd-message-meta"><time datetime="' + esc(at) + '">' + esc(clock(at).slice(0, 8)) + '</time><span aria-hidden="true">·</span><code class="sd-message-id" title="' + esc(id) + '">' + esc(id) + '</code><span aria-hidden="true">·</span>' + iconButton('copy-message', tr('复制消息', 'Copy message'), 'copy', ' data-round="' + turn.n + '" data-role="' + (input ? 'user' : 'assistant') + '"') + '</div></header><div class="sd-message-body">' + messageBody(input ? turn.input : turn.output) + attachment + (!input ? feedbackHtml(turn.feedback) : '') + '</div></article>';
  }
  function overviewHtml(row, data) {
    var metrics = [
      [tr('消息 / 对话轮次', 'Messages / turns'), row.messages + ' / ' + data.rounds.length + tr(' 轮', ' turns')],
      [tr('token 总用量', 'Total tokens'), row.tokens + ' M token'],
      [tr('执行步骤 / 总耗时', 'Steps / elapsed'), data.steps + ' / ' + data.duration + tr(' 秒', ' seconds')]
    ];
    return '<section class="sd-overview" aria-labelledby="sd-overview-title"><h2 id="sd-overview-title">' + tr('会话概要', 'Conversation overview') + '</h2><dl>' + metrics.map(function (metric) {
      return '<div><dt>' + esc(metric[0]) + '</dt><dd>' + esc(metric[1]) + '</dd></div>';
    }).join('') + '</dl></section>';
  }
  function conversationHtml(row, data) {
    var nav = data.rounds.map(function (turn) {
      var label = tr('第 ' + turn.n + ' 轮：', 'Turn ' + turn.n + ': ') + turn.input;
      return '<button type="button" data-sd="round" data-round="' + turn.n + '" aria-label="' + esc(label) + '" title="' + esc(label) + '" class="' + (ui.round === turn.n ? 'is-active' : '') + '"' + (ui.round === turn.n ? ' aria-current="true"' : '') + '><span class="sd-round-number">' + turn.n + '</span><span class="sd-round-prompt">' + esc(turn.input) + '</span></button>';
    }).join('<div class="sd-round-separator" aria-hidden="true"><hr></div>');
    var content = ui.format === 'json' ? '<pre class="sd-json">' + esc(JSON.stringify(rawMessages(row, data), null, 2)) + '</pre>' : data.rounds.map(function (turn) {
      return '<section class="sd-turn" id="sd-turn-' + turn.n + '"><header><button type="button" class="sd-turn-link" data-sd="round-trace" data-round="' + turn.n + '" aria-label="' + tr('查看第 ' + turn.n + ' 轮 Trace', 'View trace for turn ' + turn.n) + '" title="' + tr('查看本轮第一条记录', 'View the first record in this turn') + '"><strong>' + tr('第 ' + turn.n + ' 轮', 'Turn ' + turn.n) + '</strong><span>' + tr('查看 ', 'View ') + turn.steps + tr(' 个执行步骤', ' steps') + '</span>' + ico('chevron-right') + '</button></header>' + messageHtml(row, turn, true) + (turn.hasOutput ? messageHtml(row, turn, false) : '<p class="sd-muted">' + tr('尚无后续输出', 'No response yet') + '</p>') + '</section>';
    }).join('');
    return '<div class="sd-conversation-view">' + overviewHtml(row, data) +
      '<section class="sd-conversation-section" aria-labelledby="sd-conversation-title"><h2 id="sd-conversation-title">' + tr('会话详情', 'Conversation details') + '</h2>' +
      '<div class="sd-conversation"><aside class="sd-rounds"><header>' + tr('对话轮次', 'Conversation turns') + '</header><nav aria-label="' + tr('对话轮次', 'Conversation turns') + '">' + nav + '</nav></aside>' +
      '<section class="sd-conversation-main"><header class="sd-panel-heading"><div class="sd-conversation-label"><strong>' + tr('全部对话', 'Full conversation') + '</strong></div>' +
      '<button type="button" id="sdRoundSelect" class="btn-soft sd-round-select" data-sd="round-menu" aria-label="' + tr('跳转对话轮次', 'Jump to turn') + '" aria-haspopup="listbox" aria-controls="sdRoundMenu" aria-expanded="false"><span>' + tr('第 ' + ui.round + ' 轮', 'Turn ' + ui.round) + '</span>' + ico('chevron-down') + '</button>' +
      '<div class="sd-format-actions"><span class="sd-copy-slot">' + (ui.format === 'json' ? iconButton('copy-conversation', tr('复制会话 JSON', 'Copy conversation JSON'), 'copy') : '') + '</span><div class="ov-segment" role="group" aria-label="' + tr('会话显示方式', 'Conversation format') + '">' + [['conversation', tr('对话', 'Conversation')], ['json', 'JSON']].map(function (format) {
        return '<button type="button" data-sd="format" data-value="' + format[0] + '" class="' + (ui.format === format[0] ? 'is-active' : '') + '" aria-pressed="' + (ui.format === format[0]) + '">' + format[1] + '</button>';
      }).join('') + '</div></div>' +
      '</header><div class="sd-conversation-scroll">' + content + '</div></section></div></section></div>';
  }
  function filteredRecords(data) {
    var q = ui.query.trim().toLowerCase();
    return data.records.filter(function (record) { return (!ui.type || record.type === ui.type) && (!ui.abnormal || record.status === 'error' || record.status === 'warning') && (!q || (record.id + ' ' + record.name + ' ' + display(record.input) + ' ' + display(record.output)).toLowerCase().indexOf(q) >= 0); });
  }
  function timelineHtml(data) {
    var legend = ['user', 'memory', 'other', 'model', 'tool', 'ontology', 'agent', 'guard'];
    return '<section class="sd-timeline"><header><strong>' + tr('全程轨迹', 'Full trace') + '</strong><div class="sd-timeline-legend">' + legend.map(function (type) { return '<span class="sd-track-' + type + '"><i></i>' + esc(typeLabel(type)) + '</span>'; }).join('') + '</div></header><div class="sd-timeline-scroll" style="--trace-count:' + data.records.length + '">' + TRACE_LANES.map(function (lane) {
      return '<div class="sd-track"><span>' + esc(lane[1]) + '</span><div>' + data.records.map(function (record, index) {
        if (lane[2].indexOf(record.type) < 0) return '';
        var label = typeLabel(record.type) + ' · ' + record.name + (record.round ? ' · 第 ' + record.round + ' 轮' : '');
        return '<button type="button" data-sd="trace-point" data-id="' + record.id + '" style="--point:' + ((index + 0.5) / data.records.length * 100).toFixed(3) + '%" class="sd-track-' + record.type + (record.id === ui.traceId ? ' is-selected' : '') + (record.status === 'error' ? ' is-error' : record.status === 'warning' ? ' is-warning' : '') + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"></button>';
      }).join('') + '</div></div>';
    }).join('') + '</div></section>';
  }
  function statusLabel(status) { return status === 'error' ? tr('错误', 'Error') : status === 'warning' ? tr('警告', 'Warning') : tr('已完成', 'Completed'); }
  function inspectorHtml(record) {
    if (!record || !ui.inspectorOpen) return '';
    var main = ui.inspectorTab === 'raw' ? '<div class="sd-raw-heading"><span>JSON</span>' + iconButton('copy-record', tr('复制记录', 'Copy record'), 'copy', ' data-id="' + record.id + '"') + '</div><pre class="sd-json">' + esc(JSON.stringify(record, null, 2)) + '</pre>' : ui.inspectorTab === 'details' ? '<table class="sd-record-meta"><tbody>' + [ [tr('请求编号', 'Request ID'), record.id], [tr('会话编号', 'Session ID'), record.session_id], [tr('记录类型', 'Type'), typeLabel(record.type)], [tr('操作', 'Operation'), record.name], [tr('状态', 'Status'), statusLabel(record.status)], [tr('时间', 'Timestamp'), record.timestamp], [tr('耗时', 'Duration'), (record.duration_ms / 1000).toFixed(2) + ' 秒'], ['Token', record.tokens.toLocaleString('en-US')], [tr('轮次 / 步骤', 'Turn / step'), (record.round || '—') + ' / ' + (record.step || '—')] ].map(function (pair) { return '<tr><th>' + esc(pair[0]) + '</th><td>' + esc(pair[1]) + '</td></tr>'; }).join('') + '</tbody></table>' : '<section><h3>' + tr('输入', 'Input') + '</h3><pre class="sd-json">' + esc(display(record.type === 'user' ? record.output : record.input)) + '</pre></section>' + (record.type === 'user' ? '' : '<section><h3>' + tr('输出', 'Output') + '</h3><pre class="sd-json">' + esc(display(record.output)) + '</pre></section>');
    return '<aside class="sd-inspector"><header>' + badge(record.type) + '<strong title="' + esc(record.name) + '">' + esc(record.type === 'user' ? tr('用户输入', 'User input') : record.name) + '</strong><div class="sd-inspector-actions">' + (record.round ? iconButton('related-conversation', tr('查看关联原始会话', 'View original conversation'), 'circle-arrow-right', ' data-round="' + record.round + '"') : '') + iconButton('inspector-close', tr('关闭记录详情', 'Close record details'), 'x') + '</div></header><div class="sd-inspector-tabs ov-segment" role="tablist" aria-label="' + tr('记录详情', 'Record details') + '">' + [ ['io', tr('输入输出', 'Input / output')], ['details', tr('详情', 'Details')], ['raw', tr('原始记录', 'Raw record')] ].map(function (tab) { return '<button type="button" role="tab" data-sd="inspector-tab" data-value="' + tab[0] + '" aria-selected="' + (ui.inspectorTab === tab[0]) + '" class="' + (ui.inspectorTab === tab[0] ? 'is-active' : '') + '">' + tab[1] + '</button>'; }).join('') + '</div><div class="sd-inspector-content" role="tabpanel">' + main + '</div></aside>';
  }
  function traceHtml(data) {
    var records = filteredRecords(data);
    if (!records.some(function (r) { return r.id === ui.traceId; })) ui.traceId = records.length ? records[0].id : null;
    var selected = records.filter(function (r) { return r.id === ui.traceId; })[0];
    return '<div class="sd-trace">' + timelineHtml(data) + '<div class="sd-trace-toolbar"><label class="search-field">' + ico('search') + '<input id="sdTraceSearch" type="text" placeholder="' + tr('搜索 Trace', 'Search Trace') + '" aria-label="' + tr('搜索 Trace', 'Search trace') + '" value="' + esc(ui.query) + '"></label><button type="button" class="btn-soft sd-trace-type" id="sdTraceType" data-sd="type-menu" aria-label="' + tr('记录类型', 'Record type') + '" aria-haspopup="listbox" aria-controls="sdTraceTypeMenu" aria-expanded="false"><span>' + (ui.type ? typeLabel(ui.type) : tr('全部记录', 'All records')) + '</span>' + ico('chevron-down') + '</button><span class="sd-abnormal">' + tr('仅显示异常', 'Anomalies only') + '<button type="button" class="cap-switch" id="sdTraceAbnormal" data-sd="abnormal-toggle" role="switch" aria-label="' + tr('仅显示异常', 'Anomalies only') + '" aria-checked="' + ui.abnormal + '"><span></span></button></span><span class="sd-trace-count" aria-live="polite">' + records.length + ' / ' + data.records.length + tr(' 条记录', ' records') + '</span>' + iconButton('copy-trace', tr('复制当前记录', 'Copy filtered records'), 'copy') + '</div><div class="sd-trace-body"><div class="sd-records" role="region" aria-label="' + tr('Trace 记录', 'Trace records') + '">' + (records.length ? records.map(function (record) {
      var operation = record.type === 'tool' || record.type === 'ontology';
      var summary = operation ? display(record.input) : display(record.output);
      var text = (operation ? '<b class="sd-operation">' + esc(record.name) + '</b> ' : record.type === 'other' ? '<b>' + esc(record.name) + '</b> ' : '') + (record.name === '初始系统提示词' ? '' : esc(summary.replace(/\s+/g, ' ')));
      return '<button type="button" class="sd-record' + (record.id === ui.traceId ? ' is-selected' : '') + (record.type === 'other' ? ' is-context' : '') + ' sd-record-' + record.status + '" data-sd="trace-record" data-id="' + record.id + '" aria-current="' + (record.id === ui.traceId) + '" title="' + esc(record.name + ' · ' + display(record.output)) + '"><span class="sd-record-round">' + (record.type === 'user' ? '<span>' + tr('第 ' + record.round + ' 轮', 'Turn ' + record.round) + '</span>' : '') + '</span>' + badge(record.type) + '<span class="sd-record-text">' + text + '</span></button>';
    }).join('<div class="sd-record-separator" aria-hidden="true"></div>') : '<div class="sd-empty"><p>' + tr('没有匹配的记录', 'No matching records') + '</p><button type="button" class="btn-soft" data-sd="trace-reset">' + tr('重置筛选', 'Reset filters') + '</button></div>') + '</div>' + inspectorHtml(selected) + '</div></div>';
  }
  var savedViews = {};
  var contexts = Object.create(null), contextKey = null;
  function selectRow(id) {
    if (ui.id === id) return;
    if (ui.id) savedViews[ui.id] = Object.assign({}, ui);
    if (savedViews[id]) ui = Object.assign({}, savedViews[id]); else reset(id);
  }
  function page(row, docked) {
    selectRow(row.id);
    var data = dataFor(row);
    if (!ui.traceId) { var input = data.records.filter(function (record) { return record.type === 'user'; })[0]; ui.traceId = input ? input.id : data.records[0].id; }
    var signal = row.errors || row.warnings;
    var signalLabel = row.errors + tr(' 个错误，', ' errors, ') + row.warnings + tr(' 个警告', ' warnings');
    var signalDetails = tr('包含 ' + row.errors + ' 错误 ' + row.warnings + ' 警告', 'Contains ' + row.errors + ' errors and ' + row.warnings + ' warnings');
    var tabs = [['conversation', tr('原始会话', 'Original conversation'), data.rounds.length + tr(' 轮', ' turns')], ['trace', 'Trace', data.steps + tr(' 步', ' steps')]];
    return '<div class="session-detail"><header class="page-heading has-actions sd-heading"><div class="sd-heading-main">' +
      '<div class="sd-title-row"><div class="sd-title-line"><h1>' + esc(row.name) + '</h1>' + (signal ? '<button type="button" class="sd-session-status has-signal" data-sd="signals" aria-label="' + esc(tr('查看运行异常：', 'View anomalies: ') + signalLabel) + '" aria-describedby="sd-signal-tooltip">' + tr('含运行异常', 'With anomalies') + ico('info') + '<span id="sd-signal-tooltip" class="metric-tooltip sd-signal-tooltip" role="tooltip">' + esc(signalDetails) + '</span></button>' : '') + '</div><div class="sd-heading-actions">' + (docked ? '' : button('back', tr('返回列表', 'Back to list'), 'arrow-left')) + '<button type="button" class="btn-ink" data-sd="analyze">' + ico('sparkles') + tr('AI 分析', 'AI analysis') + '</button></div></div>' +
      '<div class="sd-session-meta"><span class="sd-session-id"><code>' + esc(row.id) + '</code>' + iconButton('copy-id', tr('复制会话编号', 'Copy session ID'), 'copy') + '</span><span aria-hidden="true">·</span><span>' + tr('最新对话 ', 'Latest activity ') + '<time>' + esc(row.time) + '</time></span><span aria-hidden="true">·</span><span>' + esc(row.agent) + '</span><span aria-hidden="true">·</span><span>' + esc(row.user) + '</span></div></div>' +
      '</header>' +
      '<section class="sd-detail-card"><div class="sd-card-heading"><div class="sd-tabs" role="tablist" aria-label="' + tr('会话详情', 'Session details') + '">' + tabs.map(function (tab) {
        return '<button type="button" role="tab" id="sd-tab-' + tab[0] + '" data-sd="tab" data-value="' + tab[0] + '" aria-controls="sd-tab-content" aria-selected="' + (ui.tab === tab[0]) + '" tabindex="' + (ui.tab === tab[0] ? '0' : '-1') + '" class="' + (ui.tab === tab[0] ? 'is-active' : '') + '">' + tab[1] + '<span>（' + tab[2] + '）</span></button>';
      }).join('') + '</div></div>' +
      '<div class="sd-tab-content" id="sd-tab-content" role="tabpanel" aria-labelledby="sd-tab-' + ui.tab + '">' + (ui.tab === 'conversation' ? conversationHtml(row, data) : traceHtml(data)) + '</div></section></div>';
  }
  function closeChoiceMenu(restoreFocus) {
    if (!choiceMenu) return;
    var anchor = choiceMenu.anchor;
    choiceMenu.element.remove();
    choiceMenu = null;
    if (anchor.isConnected) {
      anchor.setAttribute('aria-expanded', 'false');
      if (restoreFocus) anchor.focus();
    }
  }
  function openChoiceMenu(anchor, config, focusLast) {
    closeChoiceMenu();
    var menu = document.createElement('div');
    menu.id = config.id;
    menu.className = 'cui-model-menu sd-choice-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', config.label);
    menu.innerHTML = config.items.map(function (item) {
      var selected = config.value === item[0];
      return '<button type="button" class="cui-model-option' + (selected ? ' is-selected' : '') + '" role="option" aria-selected="' + selected + '" tabindex="-1" data-sd="' + config.action + '" data-value="' + esc(item[0]) + '"><span>' + esc(item[1]) + '</span>' + (selected ? ico('check') : '') + '</button>';
    }).join('');
    document.body.appendChild(menu);
    choiceMenu = { element: menu, anchor: anchor };
    anchor.setAttribute('aria-expanded', 'true');
    if (global.lucide) global.lucide.createIcons();
    var rect = anchor.getBoundingClientRect();
    var below = window.innerHeight - rect.bottom - 12, above = rect.top - 12;
    var openAbove = below < Math.min(220, menu.scrollHeight) && above > below;
    menu.style.maxHeight = Math.min(280, openAbove ? above : below) + 'px';
    menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = (openAbove ? rect.top - menu.offsetHeight - 4 : rect.bottom + 4) + 'px';
    var option = focusLast ? menu.lastElementChild : menu.querySelector('[aria-selected="true"]') || menu.firstElementChild;
    if (option) option.focus();
  }
  function openRoundMenu(anchor, data, focusLast) {
    openChoiceMenu(anchor, { id: 'sdRoundMenu', label: tr('选择对话轮次', 'Select conversation turn'), action: 'round', value: String(ui.round), items: data.rounds.map(function (turn) { return [String(turn.n), tr('第 ' + turn.n + ' 轮', 'Turn ' + turn.n)]; }) }, focusLast);
  }
  function openTraceTypeMenu(anchor, focusLast) {
    openChoiceMenu(anchor, { id: 'sdTraceTypeMenu', label: tr('记录类型', 'Record type'), action: 'trace-type', value: ui.type, items: [['', tr('全部记录', 'All records')]].concat(TYPES) }, focusLast);
  }
  function repaint() { closeChoiceMenu(); if (host.render) host.render(); }
  function afterRender(restorePosition) {
    if (choiceMenu && !choiceMenu.anchor.isConnected) closeChoiceMenu();
    if (!document.querySelector('.session-detail')) return;
    if (restorePosition) ui.jump = true;
    if (ui.jump) {
      ui.jump = false;
      var completion = ui.tab === 'conversation' && ui.format === 'conversation' && ui.replyTarget && ui.round === ui.replyTarget.round;
      var target = ui.tab === 'trace' ? document.querySelector('.sd-record[data-id="' + ui.traceId + '"]') : completion ? document.querySelector('.sd-message.is-task-completion') : document.getElementById('sd-turn-' + ui.round);
      var scroller = document.querySelector(ui.tab === 'trace' ? '.sd-records' : '.sd-conversation-scroll');
      if (target && scroller) scroller.scrollTop = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - (parseFloat(getComputedStyle(scroller).paddingTop) || 0);
      var nav = document.querySelector('.sd-rounds nav');
      var active = nav && nav.querySelector('.is-active');
      if (active) {
        var itemRect = active.getBoundingClientRect(), navRect = nav.getBoundingClientRect();
        if (itemRect.top < navRect.top) nav.scrollTop += itemRect.top - navRect.top;
        else if (itemRect.bottom > navRect.bottom) nav.scrollTop += itemRect.bottom - navRect.bottom;
      }
    }
  }
  function copy(value) {
    if (!navigator.clipboard) { if (host.toast) host.toast(tr('当前浏览器无法复制', 'Clipboard is unavailable')); return; }
    navigator.clipboard.writeText(value).then(function () { if (host.toast) host.toast(tr('已复制', 'Copied')); }).catch(function () { if (host.toast) host.toast(tr('复制失败，请重试', 'Could not copy. Try again.')); });
  }
  document.addEventListener('click', function (e) {
    var control = e.target.closest('[data-sd]');
    if (!control) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var row = currentRow(); if (!row) return;
    var data = dataFor(row), action = control.getAttribute('data-sd'), value = control.getAttribute('data-value'), round = Number(control.getAttribute('data-round')) || 1;
    if (action === 'round-menu' || action === 'type-menu') { if (choiceMenu) closeChoiceMenu(true); else if (action === 'round-menu') openRoundMenu(control, data); else openTraceTypeMenu(control); return; }
    var choiceTriggerId = control.closest('.sd-choice-menu') && choiceMenu ? choiceMenu.anchor.id : null;
    if (action === 'back') { if (host.back) host.back(); return; }
    if (action === 'analyze') { if (host.analyze) host.analyze(row.id); return; }
    if (action === 'copy-id') { copy(row.id); return; }
    if (action === 'copy-message') { var turn = data.rounds[round - 1]; copy(control.getAttribute('data-role') === 'user' ? turn.input : turn.output); return; }
    if (action === 'copy-conversation') { copy(JSON.stringify(rawMessages(row, data), null, 2)); return; }
    if (action === 'copy-trace') { copy(JSON.stringify(filteredRecords(data), null, 2)); return; }
    if (action === 'copy-record') { var record = data.records.filter(function (item) { return item.id === control.getAttribute('data-id'); })[0]; if (record) copy(JSON.stringify(record, null, 2)); return; }
    var records = document.querySelector('.sd-records'), traceTop = records ? records.scrollTop : 0;
    if (action === 'signals') { ui.tab = 'trace'; ui.query = ''; ui.type = ''; ui.abnormal = true; ui.inspectorOpen = true; ui.jump = true; }
    if (action === 'tab') { ui.tab = value; ui.jump = value === 'conversation'; }
    if (action === 'format') { ui.format = value; ui.jump = true; }
    if (action === 'round') { ui.round = Number(value) || round; ui.format = 'conversation'; ui.jump = true; }
    if (action === 'round-trace') { ui.tab = 'trace'; ui.round = round; ui.type = ''; ui.query = ''; ui.abnormal = false; var first = data.records.filter(function (item) { return item.round === round; })[0]; ui.traceId = first.id; ui.inspectorOpen = true; ui.jump = true; }
    if (action === 'trace-record' || action === 'trace-point') { ui.traceId = control.getAttribute('data-id'); ui.inspectorOpen = true; ui.jump = action === 'trace-point'; if (action === 'trace-point') { ui.query = ''; ui.type = ''; ui.abnormal = false; } }
    if (action === 'inspector-close') ui.inspectorOpen = false;
    if (action === 'inspector-tab') ui.inspectorTab = value;
    if (action === 'related-conversation') { ui.tab = 'conversation'; ui.round = round; ui.format = 'conversation'; ui.jump = true; }
    if (action === 'trace-type') ui.type = value;
    if (action === 'trace-reset') { ui.query = ''; ui.type = ''; ui.abnormal = false; }
    if (action === 'abnormal-toggle') ui.abnormal = !ui.abnormal;
    var jumping = ui.jump;
    repaint();
    if (choiceTriggerId) { var trigger = document.getElementById(choiceTriggerId); if (trigger) trigger.focus(); }
    records = document.querySelector('.sd-records'); if (records && !jumping) records.scrollTop = traceTop;
  });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'sdTraceSearch' || !e.target.isConnected || e.isComposing) return;
    var pos = e.target.selectionStart; ui.query = e.target.value;
    repaint();
    var field = document.getElementById('sdTraceSearch'); if (field) { field.focus(); field.setSelectionRange(pos, pos); }
  });
  document.addEventListener('compositionend', function (e) {
    if (e.target.id !== 'sdTraceSearch') return;
    ui.query = e.target.value; repaint();
    var field = document.getElementById('sdTraceSearch'); if (field) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
  });
  document.addEventListener('click', function (e) {
    if (choiceMenu && !e.target.closest('.sd-choice-menu, #sdRoundSelect, #sdTraceType')) closeChoiceMenu();
  }, true);
  window.addEventListener('resize', function () { closeChoiceMenu(); });
  window.addEventListener('scroll', function (e) {
    if (choiceMenu && !choiceMenu.element.contains(e.target)) closeChoiceMenu();
  }, true);
  document.addEventListener('keydown', function (e) {
    var choiceTrigger = e.target.closest('#sdRoundSelect, #sdTraceType');
    var option = e.target.closest('.sd-choice-menu [role="option"]');
    if (choiceMenu && (e.key === 'Escape' || e.key === 'Tab')) {
      if (e.key === 'Escape') e.preventDefault();
      closeChoiceMenu(true);
      return;
    }
    if (choiceTrigger && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (choiceTrigger.id === 'sdTraceType') openTraceTypeMenu(choiceTrigger, e.key === 'ArrowUp');
      else { var row = currentRow(); if (row) openRoundMenu(choiceTrigger, dataFor(row), e.key === 'ArrowUp'); }
      return;
    }
    if (option && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) >= 0) {
      e.preventDefault();
      var options = Array.from(choiceMenu.element.querySelectorAll('[role="option"]'));
      var index = options.indexOf(option);
      var next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus();
      return;
    }
    var tab = e.target.closest('.sd-tabs [role="tab"], .sd-inspector-tabs [role="tab"]');
    if (!tab || ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
    e.preventDefault();
    var tabs = Array.from(tab.parentElement.querySelectorAll('[role="tab"]')), at = tabs.indexOf(tab);
    var next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(at + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    var selector = '[data-sd="' + next.getAttribute('data-sd') + '"][data-value="' + next.getAttribute('data-value') + '"]';
    next.click(); var target = document.querySelector(selector); if (target) target.focus();
  });
  global.AIOpsSessionDetail = {
    bind: function (next) { host = next; }, page: page, afterRender: afterRender,
    startedAt: function (row) { var first = dataFor(row).rounds[0]; return first ? first.inputAt : null; }, replyAt: replyAt, focusReply: focusReply,
    data: function (row) { return JSON.parse(JSON.stringify(dataFor(row))); },
    setContext: function (key) {
      if (contextKey === key) return;
      closeChoiceMenu();
      if (contextKey) contexts[contextKey] = { ui: Object.assign({}, ui), views: savedViews };
      contextKey = key;
      var saved = contexts[key];
      savedViews = saved ? saved.views : {};
      if (saved) ui = Object.assign({}, saved.ui);
      else reset(null);
    }
  };
})(window);
