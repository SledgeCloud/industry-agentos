/* Ported from AIOps-Enhance dist/new-aiops.html — analysis dashboards */
(function (global) {
  'use strict';

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function modal(title, body) {
    var old = document.getElementById('aiopsAnalysisModal');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.id = 'aiopsAnalysisModal';
    wrap.className = 'aiops-analysis-modal';
    wrap.innerHTML =
      '<div class="aiops-analysis-modal-backdrop" data-close="1"></div>' +
      '<div class="aiops-analysis-modal-card" role="dialog" aria-modal="true">' +
        '<div class="aiops-analysis-modal-head"><h3>' + esc(title) + '</h3>' +
        '<button type="button" class="aiops-analysis-modal-close" data-close="1" aria-label="Close">×</button></div>' +
        '<div class="aiops-analysis-modal-body">' + body + '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close')) wrap.remove();
    });
  }

  // Host bridge — filled by aiops.js
  var host = {
    getRange: function () { return 7; },
    setRange: function () {},
    rerender: function () {},
    getPageRoot: function () { return document.getElementById('pageRoot'); },
    getLang: function () { return 'zh'; },
    t: null
  };

  // Minimal state object used by ported functions
  var state = {
    get range() { return host.getRange(); },
    set range(v) { host.setRange(v); },
    get page() { return host.getPage ? host.getPage() : ''; },
    healthAlertSeverity: 'all'
  };

  function lang() {
    return host.getLang ? host.getLang() : 'zh';
  }
  function loc() {
    return lang() === 'en' ? 'en-US' : 'zh-CN';
  }
  var BOARD_I18N = {
    '计算口径': { zh: '计算口径', en: 'Definition' },
    '日环比': { zh: '日环比', en: 'DoD' },
    '天环比': { zh: '天环比', en: 'change' },
    '新增': { zh: '新增', en: 'New' },
    '更新时间：': { zh: '更新时间：', en: 'Updated: ' },
    '场景筛选': { zh: '场景筛选', en: 'Scope filter' },
    '场景多选': { zh: '场景多选', en: 'Select scopes' },
    '全选': { zh: '全选', en: 'Select all' },
    '清空': { zh: '清空', en: 'Clear' },
    '场景': { zh: '场景', en: 'Scenes' },
    '完成': { zh: '完成', en: 'Done' },
    '未选择': { zh: '未选择', en: 'None selected' },
    '已选场景项': { zh: '已选 {scenes} 个场景 · {items} 项', en: '{scenes} scenes · {items} items' },
    '已选底部': { zh: '已选 {scenes} 个场景中的 {items} 项', en: '{items} items in {scenes} scenes' },
    '销售': { zh: '销售', en: 'Sales' },
    '采购': { zh: '采购', en: 'Procurement' },
    '销售线索 Agent': { zh: '销售线索 Agent', en: 'Sales leads agent' },
    '销售订单 Agent': { zh: '销售订单 Agent', en: 'Sales order agent' },
    '销售分货 Agent': { zh: '销售分货 Agent', en: 'Sales allocation agent' },
    '客户对象集': { zh: '客户对象集', en: 'Customer object set' },
    '销售订单对象集': { zh: '销售订单对象集', en: 'Sales order object set' },
    '采购计划 Agent': { zh: '采购计划 Agent', en: 'Procurement plan agent' },
    '供应商评估 Agent': { zh: '供应商评估 Agent', en: 'Supplier eval agent' },
    '供应商对象集': { zh: '供应商对象集', en: 'Supplier object set' },
    '采购订单对象集': { zh: '采购订单对象集', en: 'PO object set' },
    '本体对象集': { zh: '本体对象集', en: 'Ontology set' },
    '选择场景': { zh: '选择场景', en: 'Select scene' },
    '展开场景': { zh: '展开场景', en: 'Expand scene' },
    '选择': { zh: '选择', en: 'Select' },
    '输入 Token': { zh: '输入 Token', en: 'Input tokens' },
    '输出 Token': { zh: '输出 Token', en: 'Output tokens' },
    '警告影响用户数': { zh: '警告影响用户数', en: 'Users affected' },
    '会话平均耗时': { zh: '会话平均耗时', en: 'Avg session duration' },
    '工具平均耗时': { zh: '工具平均耗时', en: 'Avg tool duration' },
    '首 token 延迟（TTFT）': { zh: '首 token 延迟（TTFT）', en: 'TTFT' },
    '点赞点踩次数': { zh: '点赞点踩次数', en: 'Likes & dislikes' },
    '点赞': { zh: '点赞', en: 'Like' },
    '点踩': { zh: '点踩', en: 'Dislike' },
    '点赞次数': { zh: '点赞次数', en: 'Likes' },
    '点踩次数': { zh: '点踩次数', en: 'Dislikes' },
    '活跃会话趋势': { zh: '活跃会话趋势', en: 'Active sessions trend' },
    '活跃用户趋势': { zh: '活跃用户趋势', en: 'Active users trend' },
    '点赞点踩': { zh: '点赞点踩', en: 'Feedback' },
    '点赞点踩趋势': { zh: '点赞点踩趋势', en: 'Feedback trend' },
    '单位个': { zh: '单位：个', en: 'Unit: sessions' },
    '单位人': { zh: '单位：人', en: 'Unit: users' },
    '单位次': { zh: '单位：次', en: 'Unit: count' },
    '按日': { zh: '按日', en: 'Daily' },
    '按小时': { zh: '按小时', en: 'Hourly' },
    '每日': { zh: '每日', en: 'Daily' },
    '每小时': { zh: '每小时', en: 'Hourly' },
    'Mock 数据': { zh: 'Mock 数据', en: 'Mock data' },
    '今日累计': { zh: '今日累计', en: 'Today cumulative' },
    '活跃用户去重注': { zh: '活跃用户按所选周期去重', en: 'Active users deduped in range' },
    '报错分析': { zh: '报错分析', en: 'Error analysis' },
    '性能分析': { zh: '性能分析', en: 'Performance' },
    '警告分布': { zh: '警告分布', en: 'Warning mix' },
    '实时警告': { zh: '实时警告', en: 'Live warnings' },
    '慢响应': { zh: '慢响应', en: 'Slow response' },
    'LLM 报错': { zh: 'LLM 报错', en: 'LLM error' },
    '规则触发异常': { zh: '规则触发异常', en: 'Rule anomaly' },
    '动作执行失败': { zh: '动作执行失败', en: 'Action failure' },
    '模型请求': { zh: '模型请求', en: 'Model calls' },
    '工具调用': { zh: '工具调用', en: 'Tool calls' },
    '知识检索': { zh: '知识检索', en: 'Retrieval' },
    '本体操作': { zh: '本体操作', en: 'Ontology' },
    '慢响应轮次率趋势': { zh: '慢响应轮次率趋势', en: 'Slow-turn rate trend' },
    '耗时分布': { zh: '耗时分布', en: 'Duration mix' },
    '累计耗时秒': { zh: '累计耗时 · 单位：秒', en: 'Cumulative · seconds' },
    '警告详情': { zh: '警告详情', en: 'Warning detail' },
    '事件时间': { zh: '事件时间', en: 'Event time' },
    '识别来源': { zh: '识别来源', en: 'Source' },
    '会话编号': { zh: '会话编号', en: 'Session ID' },
    '对话轮次': { zh: '对话轮次', en: 'Turn' },
    '轮次最终状态': { zh: '轮次最终状态', en: 'Turn status' },
    '首 Token 输出耗时': { zh: '首 Token 输出耗时', en: 'TTFT' },
    '无首 Token 返回': { zh: '无首 Token 返回', en: 'No first token' },
    '最终成功返回': { zh: '最终成功返回', en: 'Succeeded' },
    '最终失败': { zh: '最终失败', en: 'Failed' },
    '无返回': { zh: '无返回', en: 'No return' },
    '中断': { zh: '中断', en: 'Interrupted' },
    '返回错误': { zh: '返回错误', en: 'Returned error' },
    'Trace 规则': { zh: 'Trace 规则', en: 'Trace rule' },
    'LLM 判断': { zh: 'LLM 判断', en: 'LLM judge' },
    '平均 Token 消耗趋势': { zh: '平均 Token 消耗趋势', en: 'Avg token trend' },
    '所选范围暂无模型调用数据': { zh: '所选范围暂无模型调用数据', en: 'No model calls in range' },
    '所选范围暂无对话轮次数据': { zh: '所选范围暂无对话轮次数据', en: 'No turns in range' },
    '空警告全部': { zh: '所选范围暂无警告事件', en: 'No warnings in range' },
    '空警告严重': { zh: '所选范围暂无严重事件', en: 'No critical events in range' },
    '空警告警告': { zh: '所选范围暂无警告事件', en: 'No warning events in range' },
    '警告共条': { zh: '共 {n} 条 · 展示最近 {m} 条', en: '{n} total · showing latest {m}' },
    '环比说明': { zh: '对比 {from}{to}，上期值 {prev}。', en: 'Vs {from}{to}, prior {prev}. ' },
    '环比公式': { zh: '环比 =（本期值 − 上期值）/ 上期值 × 100%。', en: 'Change = (current − prior) / prior × 100%.' },
    '环比新增': { zh: '上期为 0，当前新增。', en: 'Prior was 0; this is new.' },
    '慢响应回合注': { zh: '{slow} 个慢响应轮次 / {turns} 个总轮次', en: '{slow} slow turns / {turns} turns' },
    '第N轮': { zh: '第 {n} 轮', en: 'Turn {n}' },
    '查看警告': { zh: '查看', en: 'View' },
    '次单位': { zh: '次', en: '' },
    '秒': { zh: '秒', en: 's' },
    '万': { zh: '万', en: '0k' },
    'help·总 Token': { zh: '所选周期内模型调用的输入 Token 与输出 Token 之和。', en: 'Input + output tokens in the selected range.' },
    'help·输入 Token': { zh: '所选周期内全部模型调用记录的输入 Token 总数。', en: 'Total input tokens across model calls.' },
    'help·输出 Token': { zh: '所选周期内全部模型调用记录的输出 Token 总数。', en: 'Total output tokens across model calls.' },
    'help·模型调用次数': { zh: '所选周期内实际发起的模型请求次数，重试请求单独计次。', en: 'Model requests in range; retries counted separately.' },
    'help·平均每轮 Token 消耗': { zh: '所选周期的总 Token ÷ 用户交互总轮次；一次用户输入及对应回复为一轮。', en: 'Total tokens ÷ user turns in range.' },
    'help·平均每会话 Token 消耗': { zh: '所选周期的总 Token ÷ 同周期有模型调用的去重会话数。', en: 'Total tokens ÷ sessions with model calls.' },
    'help·Token 用量趋势': { zh: '总 Token、输入 Token、输出 Token 按所选范围汇总。今日按小时统计，7 天和 14 天按日统计。', en: 'Total / input / output tokens. Hourly for today; daily for 7d/14d.' },
    'help·平均 Token 消耗趋势': { zh: '平均每轮 Token 消耗 = 各时间点总 Token / 轮次数；平均每会话 Token 消耗 = 各时间点总 Token / 会话数。今日按小时统计，7 天和 14 天按日统计。', en: 'Avg / turn = tokens / turns; avg / session = tokens / sessions. Hourly or daily by range.' },
    'help·异常会话率': { zh: '存在至少一轮最终失败、无返回、中断或返回错误的会话数 / 总会话数。', en: 'Sessions with a failed/no-return/interrupted/error turn ÷ total sessions.' },
    'help·工具调用失败率': { zh: '失败工具调用次数 ÷ 已结束工具调用总次数 × 100%。', en: 'Failed tool calls ÷ finished tool calls × 100%.' },
    'help·轮次错误率': { zh: '最终未成功返回、无返回、中断或返回错误的轮次数 / 总轮次数。', en: 'Non-success turns ÷ total turns.' },
    'help·警告事件数': { zh: '筛选范围内 trace 规则/LLM 判断识别出的告警事件总数。', en: 'Alert events from trace rules / LLM judge in range.' },
    'help·警告影响用户数': { zh: '筛选范围内，至少关联 1 条告警事件的去重用户数。', en: 'Distinct users linked to ≥1 alert in range.' },
    'help·会话平均耗时': { zh: '筛选范围内所有会话的执行耗时总和 ÷ 总会话数。', en: 'Sum of session durations ÷ session count.' },
    'help·慢响应轮次率': { zh: '最终成功返回，但首 Token 输出耗时超过体验阈值的轮次数 / 总轮次数。', en: 'Successful turns with slow TTFT ÷ total turns.' },
    'help·工具平均耗时': { zh: '工具调用耗时总和 ÷ 已完成工具调用次数。', en: 'Sum of tool durations ÷ completed tool calls.' },
    'help·首 token 延迟（TTFT）': { zh: '首个输出 token 时间 − 模型请求发起时间；展示有效轮次的首 Token 输出耗时均值。', en: 'Mean TTFT across valid turns.' },
    'help·活跃会话数': { zh: '所选周期内至少发生一次用户交互的会话数，按 session_id 去重。', en: 'Distinct sessions with ≥1 user interaction.' },
    'help·活跃用户数': { zh: '所选周期内发生用户交互的用户数，按 user_id 跨日去重；不累加每日活跃用户数。', en: 'Distinct users with interaction; not sum of daily actives.' },
    'help·人均会话数': { zh: '所选周期的活跃会话数 ÷ 同周期去重活跃用户数。', en: 'Active sessions ÷ distinct active users.' },
    'help·平均会话轮次': { zh: '所选周期内活跃会话的用户交互轮次总数 ÷ 活跃会话数；一次用户输入及对应回复为一轮。', en: 'User turns ÷ active sessions.' },
    'help·点赞点踩次数': { zh: '所选周期内记录的点赞事件数和点踩事件数，分别统计，按反馈发生日期归属；不合并为净值或反馈率。', en: 'Likes and dislikes counted separately by feedback date.' },
    'help·活跃会话趋势': { zh: '各时间点至少发生一次用户交互的会话数，按 session_id 去重。今日按小时统计，7 天和 14 天按日统计。', en: 'Distinct sessions with interaction per bucket. Hourly today; daily for 7d/14d.' },
    'help·活跃用户趋势': { zh: '各时间点发生用户交互的用户数，按 user_id 在该时间点内去重。今日按小时统计，7 天和 14 天按日统计。', en: 'Distinct users with interaction per bucket. Hourly today; daily for 7d/14d.' },
    'help·点赞点踩趋势': { zh: '各时间点的点赞次数和点踩次数，分别统计，按反馈发生时间归属。今日按小时统计，7 天和 14 天按日统计。', en: 'Likes and dislikes per bucket, counted separately. Hourly today; daily for 7d/14d.' },
    'help·警告分布': { zh: '按警告类型统计筛选范围内的事件数，与警告事件数使用同一批 Mock 记录。', en: 'Events by warning type; same mock set as warning count.' },
    'help·实时警告': { zh: '展示所选场景与时间范围内最近的 20 条 Mock 警告记录，按事件时间倒序排列。', en: 'Latest 20 mock warnings in scope, newest first.' },
    'help·慢响应轮次率趋势': { zh: '最终成功返回，但首 Token 输出耗时超过体验阈值的轮次数 / 总轮次数。按各时间点的分子与分母计算，不对百分比取平均。慢响应判定使用固定 Mock 标记。', en: 'Slow successful turns ÷ turns per bucket; mock slow flags.' },
    'help·耗时分布': { zh: '按执行类型汇总筛选范围内的累计执行耗时。', en: 'Cumulative duration by execution type.' },
    'help·慢响应': { zh: '首 Token 输出耗时被规则识别为超过体验阈值的警告事件。', en: 'TTFT above experience threshold.' },
    'help·LLM 报错': { zh: '模型请求返回错误，或被 LLM 判断识别出的模型异常事件。', en: 'Model errors or LLM-judged anomalies.' },
    'help·规则触发异常': { zh: 'Trace 中的规则检查识别出的异常事件。', en: 'Anomalies from Trace rule checks.' },
    'help·动作执行失败': { zh: '本体或业务动作执行失败产生的警告事件。', en: 'Failed ontology / business actions.' },
    'msg·慢响应': { zh: '慢响应：首 Token 输出耗时超过体验阈值', en: 'Slow response: TTFT above experience threshold' },
    'msg·LLM': { zh: 'LLM 报错：provider=mock, model=mock-chat, error_code=UNKNOWN, error_type=AI_APICallError', en: 'LLM error: provider=mock, model=mock-chat, error_code=UNKNOWN, error_type=AI_APICallError' },
    'msg·规则': { zh: '规则触发异常：Trace 规则检查发现返回内容与预期约束不一致', en: 'Rule anomaly: Trace check found content outside expected constraints' },
    'msg·动作': { zh: '动作执行失败：本体动作返回失败，需检查参数与执行结果', en: 'Action failure: ontology action failed; check params and result' }
  };
  function t(key) {
    if (key == null || key === '') return '';
    var row = BOARD_I18N[key];
    if (row) return row[lang()] || row.zh || key;
    if (typeof host.t === 'function') {
      var out = host.t(key);
      if (out !== key) return out;
    }
    return key;
  }
  function tf(tpl, vars) {
    return String(t(tpl)).replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? vars[k] : '';
    });
  }

  function render() {
    host.rerender();
  }

// Shared scene / asset selector for the four operational analysis dashboards.
function analysisScopeCatalog(){return global.AIOpsWorkspaces.scopeCatalog()}
function analysisScopeChosen(){return global.AIOpsResources.scopeIds()}
function analysisScopePicker(){return global.AIOpsResources.scopeTrigger(true)}
function toolbar(updated="2026-10-13 00:00"){return `<div class="toolbar"><span class="updated-time">${esc(t('更新时间：'))}${updated}</span><div class="row toolbar-actions"><div class="segments">${[1,7,14].map(x=>`<button class="${state.range===x?'selected':''}" onclick="state.range=${x};render()">${x===1?esc(t('今日')):(lang()==='en'?x+'d':x+' '+t('天'))}</button>`).join('')}</div>${analysisScopePicker()}</div></div>`}
function heading(title,sub){return `<div class="heading"><div><h1>${esc(t(title))}</h1>${sub?`<small>${esc(t(sub))}</small>`:''}</div></div>`}
function metricHelpIcon(name,formula){var label=t(name),tip=t(formula||('help·'+name));return `<span class="metric-help" tabindex="0" aria-label="${esc(label+' · '+t('计算口径'))}"><svg class="icon" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor"/><path d="M8 7v4M8 4.5v1" stroke="currentColor" stroke-width="1.2"/></svg><span class="metric-tooltip" role="tooltip">${esc(tip)}</span></span>`}
function metricHelp(name,formula){var label=t(name);return `<span class="metric-label"><span class="metric-label-text" title="${esc(label)}">${esc(label)}</span>${metricHelpIcon(name,formula)}</span>`}
const analysisMetricDefinitions={
 '总 Token':{key:'total',icon:'tokens'},'输入 Token':{key:'input',icon:'tokens'},'输出 Token':{key:'output',icon:'tokens'},'模型调用次数':{key:'calls',icon:'model'},'平均每轮 Token 消耗':{key:'perTurn',icon:'tokens'},'平均每会话 Token 消耗':{key:'perSession',icon:'tokens'},
 '异常会话率':{key:'anomalousRate',icon:'error',better:'lower'},'工具调用失败率':{key:'toolFailureRate',icon:'error',better:'lower'},'轮次错误率':{key:'turnErrorRate',icon:'error',better:'lower'},'警告事件数':{key:'warningEvents',icon:'warning',better:'lower'},'警告影响用户数':{key:'affectedUsers',icon:'affected',better:'lower'},
 '会话平均耗时':{key:'sessionAvgMs',icon:'clock',better:'lower'},'慢响应轮次率':{key:'slowRate',icon:'clock',better:'lower'},'工具平均耗时':{key:'toolAvgMs',icon:'clock',better:'lower'},'首 token 延迟（TTFT）':{key:'ttftAvgMs',icon:'clock',better:'lower'},
 '活跃会话数':{key:'sessions',icon:'session'},'活跃用户数':{key:'users',icon:'users'},'人均会话数':{key:'sessionsPerUser',icon:'session'},'平均会话轮次':{key:'averageTurns',icon:'turns'},'点赞点踩次数':{icon:'feedback'},'点赞次数':{key:'likes',better:'higher'},'点踩次数':{key:'dislikes',better:'lower'}
};
function analysisMetricSymbol(name){
 const paths={tokens:'<circle cx="12" cy="12" r="8.5"/><path d="M8 8h8m-4 0v8"/>',model:'<rect x="6" y="6" width="12" height="12" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',error:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',warning:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',affected:'<circle cx="10" cy="7" r="4"/><path d="M3 21v-2a7 7 0 0 1 12-5m2 3 5 5m0-5-5 5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6h5"/>',session:'<path d="M4 4h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7l-4 3V5a1 1 0 0 1 1-1Z"/>',users:'<circle cx="10" cy="7" r="4"/><path d="M3 21v-2a7 7 0 0 1 14 0v2M17 3a4 4 0 0 1 0 8m2 3a7 7 0 0 1 3 6"/>',turns:'<path d="M4 3h14v12H7l-4 3V4a1 1 0 0 1 1-1Zm4 16h10l4 3V9"/>',feedback:'<path d="M8 10 12 3c3 0 3 3 2 6h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H8M3 10h5v11H3Z"/>'};
 return `<span class="metric-symbol" aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[analysisMetricDefinitions[name]?.icon]||paths.session}</svg></span>`;
}
function analysisMetricOptions(name,current,previous){
 const definition=analysisMetricDefinitions[name]||{},raw=totals=>definition.key==='sessionsPerUser'?(totals.users?totals.sessions/totals.users:0):definition.key==='averageTurns'?(totals.sessions?totals.turns/totals.sessions:0):Number(totals[definition.key]||0);
 return {current:raw(current),previous:raw(previous),better:definition.better};
}
function analysisComparison(current,previous,better){
 const label=state.range===1?t('日环比'):(lang()==='en'?state.range+'d '+t('天环比'):state.range+t('天环比')),delta=previous?(current-previous)/Math.abs(previous)*100:current?null:0;
 const rounded=delta===null?null:Math.round(delta*10)/10;
 const text=rounded===null?t('新增'):rounded===0?'0%':(rounded>0?'+':'−')+Math.abs(rounded).toLocaleString(loc(),{maximumFractionDigits:1})+'%';
 const sign=rounded===null?1:Math.sign(rounded),tone=!sign||!better?'neutral':(better==='lower'?sign<0:sign>0)?'improved':'worsened';
 const dates=analysisWindowBounds(state.range,true);
 const title=tf('环比说明',{from:dates.start,to:dates.start!==dates.end?' — '+dates.end:'',prev:previous.toLocaleString(loc(),{maximumFractionDigits:2})})+(delta===null?t('环比新增'):t('环比公式'));
 return `<div class="metric-comparison" title="${esc(title)}" data-current="${current}" data-previous="${previous}" data-comparison="${delta===null?'new':delta}"><span class="metric-change ${tone}">${text}</span><span>${esc(label)}</span></div>`;
}
function analysisMetric(name,value,note,formula,comparison){return `<div class="compact-stat" data-metric="${esc(name)}"><div class="metric-card-head">${metricHelp(name,formula||('help·'+name))}${analysisMetricSymbol(name)}</div><div class="metric-card-value"><strong title="${esc(note?t(note):'')}">${value}</strong>${note?`<small class="metric-unit">${esc(t(note))}</small>`:''}</div>${comparison?analysisComparison(comparison.current,comparison.previous,comparison.better):''}</div>`}
function analysisMetrics(items){return `<div class="compact-stats analysis-metrics">${items.map(([name,value,note,formula,comparison])=>analysisMetric(name,value,note,formula||('help·'+name),comparison)).join('')}</div>`}

// Fixed daily Mock records; all summaries and charts use the same filtered sessions.
const behaviorDailyMock=[
 ['2026-09-29',37,14,34,6.1,16,2],['2026-09-30',39,16,44,6.3,18,3],
 ['2026-10-01',35,17,54,5.9,15,2],['2026-10-02',40,18,50,6.2,21,3],
 ['2026-10-03',41,18,58,6.5,20,4],['2026-10-04',44,19,55,6.4,22,3],
 ['2026-10-05',48,16,35,6.6,25,4],['2026-10-06',42,16,0,6.3,20,3],
 ['2026-10-07',48,18,10,6.5,24,4],['2026-10-08',47,17,20,6.2,23,3],
 ['2026-10-09',61,24,18,6.8,31,6],['2026-10-10',42,19,8,6.1,21,2],
 ['2026-10-11',40,15,26,6.3,18,3],['2026-10-12',48,12,0,6.4,26,2]
];
// The preceding 14 days provide equal-length comparison windows without changing the current Mock baseline.
const analysisPreviousDailyMock=[
 ['2026-09-15',32,12,2,5.5,11,3],['2026-09-16',34,13,10,5.8,13,3],
 ['2026-09-17',33,12,19,5.7,12,4],['2026-09-18',36,14,28,6.0,14,4],
 ['2026-09-19',35,13,37,5.6,13,3],['2026-09-20',31,11,46,5.8,10,3],
 ['2026-09-21',36,14,55,6.0,14,4],['2026-09-22',38,15,64,5.9,16,5],
 ['2026-09-23',40,15,72,6.2,17,4],['2026-09-24',37,13,81,6.0,15,3],
 ['2026-09-25',43,17,4,6.3,20,5],['2026-09-26',38,14,13,6.0,16,4],
 ['2026-09-27',36,13,21,5.7,15,3],['2026-09-28',34,14,29,5.8,14,4]
];
// Roll demo dates forward together, preserving all values and comparison windows.
// The default "last 7 days" must include the seeded data on every preview date.
const analysisMockToday=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const analysisMockTimeline=[...analysisPreviousDailyMock,...behaviorDailyMock];
analysisMockTimeline.forEach((row,index)=>{
 const date=new Date(analysisMockToday+'T00:00:00Z');
 date.setUTCDate(date.getUTCDate()-(analysisMockTimeline.length-1-index));
 row[0]=date.toISOString().slice(0,10);
});
function analysisDateBounds(){return {start:analysisPreviousDailyMock[0][0],end:behaviorDailyMock.at(-1)[0]}}
function analysisWindowBounds(range=state.range,previous=false){
 const end=behaviorDailyMock.at(-1)[0];
 const selected=host.getDateRange?(host.getDateRange()||analysisDateBounds()):{start:new Date(Date.parse(end)-(range-1)*86400000).toISOString().slice(0,10),end};
 const shift=previous?range*86400000:0;
 const start=new Date(Date.parse(selected.start)-shift).toISOString().slice(0,10);
 return {start,end:new Date(Date.parse(selected.end)-shift).toISOString().slice(0,10)};
}
function analysisWindowRows(range=state.range,previous=false){
 const rows=[...analysisPreviousDailyMock,...behaviorDailyMock],bounds=analysisWindowBounds(range,previous);
 return rows.filter(row=>row[0]>=bounds.start&&row[0]<=bounds.end);
}
function behaviorData(range=state.range,previous=false){
 const chosen=new Set(analysisScopeChosen()),agents=analysisScopeCatalog().flatMap(scene=>scene.items.filter(item=>item.type==='Agent').map(item=>item.id));
 const users=new Set(),totals={sessions:0,turns:0,likes:0,dislikes:0};
 const days=analysisWindowRows(range,previous).map(([date,count,userCount,userOffset,averageTurns,likes,dislikes])=>{
  const dayUsers=new Set(),row={date,label:date.slice(5).replace('-','/'),sessions:0,turns:0,likes:0,dislikes:0};
  const turnCount=Math.round(count*averageTurns),baseTurns=Math.floor(turnCount/count),extraTurns=turnCount%count;
  for(let i=0;i<count;i++){
   if(!chosen.has(agents[(i+Number(date.slice(-2)))%agents.length]))continue;
   const user='user-'+(userOffset+i%userCount+1);dayUsers.add(user);users.add(user);
   row.sessions++;row.turns+=baseTurns+(i<extraTurns?1:0);row.likes+=i<likes?1:0;row.dislikes+=i>=likes&&i<likes+dislikes?1:0;
  }
  row.users=dayUsers.size;Object.keys(totals).forEach(key=>totals[key]+=row[key]);return row;
 });
 totals.users=users.size;
 totals.sessionsPerUser=totals.users?(totals.sessions/totals.users).toFixed(1):'0.0';
 totals.averageTurns=totals.sessions?(totals.turns/totals.sessions).toFixed(1):'0.0';
 return {days,totals};
}
// SVG coordinates are CSS pixels. Only plot geometry is recomputed; text is never scaled.
//
// X labels: even step from width (minGap), always keep first + last.
// Use ceil(step) so we never pack every day then trim from the end (that
// clustered labels on the left with a hole before the last day).
// 14d / 24h: also cap at ~7 labels.
function analysisTickIndices(count,plotWidth,minGap=48){
 if(count<2)return new Set(count?[0]:[]);
 let maxLabels=Math.max(2,Math.floor(plotWidth/Math.max(minGap,1))+1);
 if(count>7)maxLabels=Math.min(maxLabels,7);
 if(maxLabels>=count)return new Set(Array.from({length:count},(_,i)=>i));
 const span=count-1,step=Math.max(1,Math.ceil(span/(maxLabels-1))),last=count-1,indices=[];
 for(let i=0;i<count;i+=step)indices.push(i);
 if(indices[indices.length-1]!==last){
  if(last-indices[indices.length-1]<Math.max(1,Math.ceil(step/2)))indices[indices.length-1]=last;
  else indices.push(last);
 }
 return new Set(indices);
}
function analysisAxisAnchor(i,count){return i===0?'start':i===count-1?'end':'middle'}
// Shared plot box for monitoring dashboards + home widgets (same edge-flush / tick style).
// Height only tweaks vertical padding — left gutter stays stable so taller widgets
// don't push the Y-axis inward (old compact?40:64 jump).
function analysisPlotBox(width,height,{left:leftPref,top:topPref}={}){
 const compact=height<180;
 const left=leftPref!=null?leftPref:(width<320?36:44);
 const right=width-(compact?8:12);
 const top=topPref!=null?topPref:(compact?6:14);
 // Keep enough band under the 0-line so date labels don't sit on the axis.
 const xBand=height<120?24:height<180?28:32;
 const bottom=height-xBand;
 return {left,right,top,bottom,plotWidth:right-left,plotHeight:bottom-top,compact,minGap:compact?48:52,xBand,labelY:height-6};
}
/** Y-axis tick count from plot height — short charts drop to 3 or 2 levels. */
function analysisYTickCount(plotHeight){
 if(plotHeight<64)return 2;
 if(plotHeight<100)return 3;
 return 5;
}
let analysisChartObserver,analysisChartResizeFrame=0;
const analysisChartResizeQueue=new Set();
function drawAnalysisChart(host){
 const kind=host.dataset.analysisChart;
 let width=Math.floor(host.clientWidth),height=Math.floor(host.clientHeight);
 if(height<1)height=Math.floor(parseFloat(getComputedStyle(host).height))||(kind&&kind.startsWith('behavior-')?240:280);
 if(width<1)width=Math.floor(host.parentElement?.clientWidth)||640;
 if(width<1||height<1||host.dataset.chartSize===width+'x'+height)return;
 const focused=[...host.querySelectorAll('[tabindex]')].indexOf(document.activeElement);
 let svg='';
 if(kind.startsWith('cost-'))svg=costChart(costData().buckets,width,height,kind.slice(5));
 else if(kind==='health-alert')svg=healthAlertChartSVG(healthData(),width,height);
 else if(kind==='health-slow')svg=healthSlowChartSVG(healthData(),width,height);
 else if(kind.startsWith('behavior-'))svg=behaviorChartSVG(behaviorData().days,kind.slice(9),width,height);
 if(!svg)return;
 host.closest('.panel,.widget-trend,[data-line-chart]')?.querySelectorAll('.analysis-line-tooltip,.cost-chart-tooltip,.health-trend-tooltip,.behavior-chart-tooltip').forEach(node=>node.hidden=true);
 host.innerHTML=svg;host.dataset.chartSize=width+'x'+height;
 if(focused>=0)host.querySelectorAll('[tabindex]')[focused]?.focus({preventScroll:true});
}
function syncAnalysisCharts(){
 analysisChartObserver?.disconnect();
 const hosts=document.querySelectorAll('#main[data-analysis] [data-analysis-chart]');
 if(typeof ResizeObserver==='function'&&!analysisChartObserver)analysisChartObserver=new ResizeObserver(entries=>{
  entries.forEach(entry=>analysisChartResizeQueue.add(entry.target));
  if(!analysisChartResizeFrame)analysisChartResizeFrame=requestAnimationFrame(()=>{
   analysisChartResizeFrame=0;
   analysisChartResizeQueue.forEach(host=>{if(host.isConnected)drawAnalysisChart(host)});analysisChartResizeQueue.clear();
  });
 });
 hosts.forEach(host=>{drawAnalysisChart(host);analysisChartObserver?.observe(host)});
}

/* Monotone cubic through each point, so the line stays smooth without inventing peaks. */
function analysisCurvePath(points){
 if(!points.length)return '';
 const n=value=>Number(value.toFixed(3));
 const move=`M ${n(points[0][0])} ${n(points[0][1])}`;
 if(points.length<3)return move+points.slice(1).map(point=>` L ${n(point[0])} ${n(point[1])}`).join('');
 const dx=[],slope=[];
 for(let i=0;i<points.length-1;i++){
  const gap=points[i+1][0]-points[i][0]||1;
  dx.push(gap);
  slope.push((points[i+1][1]-points[i][1])/gap);
 }
 const m=new Array(points.length);
 m[0]=slope[0];
 m[points.length-1]=slope[slope.length-1];
 for(let i=1;i<points.length-1;i++)m[i]=slope[i-1]*slope[i]<=0?0:(slope[i-1]+slope[i])/2;
 for(let i=0;i<slope.length;i++){
  if(!slope[i]){m[i]=0;m[i+1]=0;continue}
  const a=m[i]/slope[i],b=m[i+1]/slope[i],h=a*a+b*b;
  if(h>9){const t=3/Math.sqrt(h);m[i]=t*a*slope[i];m[i+1]=t*b*slope[i]}
 }
 let d=move;
 for(let i=0;i<points.length-1;i++){
  const gap=dx[i];
  d+=` C ${n(points[i][0]+gap/3)} ${n(points[i][1]+m[i]*gap/3)} ${n(points[i+1][0]-gap/3)} ${n(points[i+1][1]-m[i+1]*gap/3)} ${n(points[i+1][0])} ${n(points[i+1][1])}`;
 }
 return d;
}
function analysisNiceMax(peak,mode,levels=5){
 const divs=Math.max(1,levels-1);
 if(mode==='percent'){
  const step=Math.max(1,Math.ceil(Math.max(0,peak)/divs/5)*5);
  return Math.min(100,Math.max(step*divs,5));
 }
 if(mode==='token'){
  if(!peak)return divs;
  const raw=peak/divs,power=10**Math.floor(Math.log10(Math.max(raw,1e-9))),step=[1,2,2.5,5,10].find(n=>n*power>=raw)*power;
  return step*divs;
 }
 const tick=Math.max(1,Math.ceil(Math.max(0,peak)/divs));
 return tick*divs;
}
/** One line-chart component for 监测 dashboards + 工作台 widgets. */
function analysisLineChartSVG({width=1100,height=280,rows=[],series=[],ariaLabel='',formatY,yMode='count',hoverType=''}={}){
 const {left,right,top,bottom,minGap,plotHeight,labelY}=analysisPlotBox(width,height,{top:height<140?6:height<180?8:16});
 const yTicks=analysisYTickCount(plotHeight),yDivs=yTicks-1;
 const visibleTicks=analysisTickIndices(rows.length,right-left,minGap);
 const peak=Math.max(0,...rows.flatMap(row=>series.map(item=>Number(row[item.key])||0)));
 const yMax=analysisNiceMax(peak,yMode,yTicks);
 const x=i=>left+i*(right-left)/(rows.length-1||1),y=v=>bottom-v/yMax*(bottom-top);
 const fmt=typeof formatY==='function'?formatY:v=>Number(v).toLocaleString(loc(),{maximumFractionDigits:2});
 const grid=Array.from({length:yTicks},(_,i)=>{const py=bottom-i/yDivs*(bottom-top);return `<line x1="${left}" y1="${py}" x2="${right}" y2="${py}" stroke="#e8edf3"/><text x="${left-12}" y="${py+4}" text-anchor="end">${esc(fmt(yMax*i/yDivs))}</text>`;}).join('');
 const lines=series.map(item=>`<path class="analysis-series" data-series="${item.key}" d="${analysisCurvePath(rows.map((row,i)=>[x(i),y(Number(row[item.key])||0)]))}" fill="none" stroke="${item.color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
 const dates=rows.map((row,i)=>`<text data-line-label="${esc(row.label)}" x="${x(i)}" y="${labelY}" text-anchor="${analysisAxisAnchor(i,rows.length)}"${visibleTicks.has(i)?'':' visibility="hidden"'}>${esc(row.label)}</text>`).join('');
 const hits=rows.map((row,i)=>{
  const start=i?(x(i-1)+x(i))/2:left,end=i===rows.length-1?right:(x(i)+x(i+1))/2;
  const tip=series.map(item=>`${item.name} ${fmt(row[item.key])}`).join(', ');
  return `<g class="analysis-line-point" tabindex="0" role="button" aria-label="${esc((row.date||row.label)+' · '+tip)}" data-line-index="${i}" data-line-hover="${esc(hoverType)}" onmouseenter="analysisLineHover(this)" onmouseleave="analysisLineLeave(this)" onfocus="analysisLineHover(this)" onblur="analysisLineLeave(this)"><rect x="${start}" y="${top}" width="${Math.max(1,end-start)}" height="${bottom-top}" fill="transparent"/><g class="analysis-line-focus">${series.map(item=>`<circle cx="${x(i)}" cy="${y(Number(row[item.key])||0)}" r="4" fill="${item.color}" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}</g></g>`;
 }).join('');
 return `<svg class="analysis-line-chart" width="${width}" height="${height}" role="img" aria-label="${esc(ariaLabel)}">${grid}${lines}${dates}${hits}</svg>`;
}
function analysisLineTooltipEl(node){
 return node.closest('[data-line-chart]')?.querySelector('.analysis-line-tooltip')||null;
}
function analysisLinePlaceTooltip(node,tooltip){
 const panel=node.closest('[data-line-chart]');if(!panel||!tooltip)return;
 const rect=node.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
 const minTop=panel.classList.contains('widget-trend')?28:48;
 tooltip.style.left=Math.max(8,Math.min(rect.left-bounds.left+rect.width/2+8,panel.clientWidth-tooltip.offsetWidth-8))+'px';
 tooltip.style.top=Math.max(minTop,rect.top-bounds.top-8)+'px';
}
function analysisLineHover(node){
 const tooltip=analysisLineTooltipEl(node);if(!tooltip)return;
 const index=Number(node.dataset.lineIndex),kind=node.dataset.lineHover||node.closest('[data-line-chart]')?.dataset.lineChart||'';
 let title='',rowsHtml='',extra='';
 if(kind.startsWith('cost-')){
  const group=kind.slice(5),bucket=costData().buckets[index],series=costChartSeries(group);if(!bucket)return;
  title=state.range===1?`${bucket.date} ${bucket.label}`:bucket.date;
  rowsHtml=series.map(item=>`<div><span><i style="background:${item.color}"></i>${esc(t(item.name))}</span><strong>${costNumber(bucket[item.key],false)}</strong></div>`).join('');
 }else if(kind==='health-slow'){
  const bucket=healthData().buckets[index];if(!bucket)return;
  title=bucket.date+(state.range===1?' '+bucket.label:'');
  rowsHtml=`<div><span><i style="background:#f0a142"></i>${esc(t('慢响应轮次率'))}</span><strong>${healthPercent(bucket.slowRate)}</strong></div>`;
  extra=`<small>${esc(tf('慢响应回合注',{slow:bucket.slowTurns,turns:bucket.turns}))}</small>`;
 }else if(kind.startsWith('behavior-')){
  const metric=kind.slice(9),day=behaviorData().days[index];if(!day)return;
  const series=metric==='feedback'?[{key:'likes',name:t('点赞'),color:'#4d8eff'},{key:'dislikes',name:t('点踩'),color:'#f0a142'}]:[{key:metric,name:t(metric==='sessions'?'活跃会话数':'活跃用户数'),color:'#4d8eff'}];
  title=day.date;
  rowsHtml=series.map(item=>`<div><span><i style="background:${item.color}"></i>${esc(item.name)}</span><strong>${Number(day[item.key]).toLocaleString(loc())}</strong></div>`).join('');
 }else return;
 tooltip.innerHTML=`<b>${esc(title)}</b>${rowsHtml}${extra}`;
 tooltip.hidden=false;
 analysisLinePlaceTooltip(node,tooltip);
}
function analysisLineLeave(node){const tooltip=analysisLineTooltipEl(node);if(tooltip)tooltip.hidden=true}
function behaviorSeries(metric){
 return metric==='feedback'?[{key:'likes',name:t('点赞'),color:'#4d8eff'},{key:'dislikes',name:t('点踩'),color:'#f0a142'}]:[{key:metric,name:t(metric==='sessions'?'活跃会话数':'活跃用户数'),color:'#4d8eff'}];
}
function behaviorChartSVG(days,metric,width=metric==='feedback'?1080:560,height=metric==='feedback'?280:240){
 const name=t(metric==='feedback'?'点赞点踩次数':metric==='sessions'?'活跃会话数':'活跃用户数');
 const rows=days.map(day=>({...day,label:(day.date||'').slice(5)||day.label}));
 return analysisLineChartSVG({width,height,rows,series:behaviorSeries(metric),ariaLabel:name,yMode:'count',hoverType:'behavior-'+metric,formatY:v=>Number(v).toLocaleString(loc(),{maximumFractionDigits:0})});
}
function behaviorChart(days,metric){
 return `<div class="behavior-chart-scroll analysis-chart-host" data-analysis-chart="behavior-${metric}">${behaviorChartSVG(days,metric)}</div><div class="analysis-line-tooltip behavior-chart-tooltip" hidden></div>`;
}
function behaviorTrendPanel(metric,days){
 if(window.AIOpsWidget){
  const id=metric==='feedback'?'trendFeedback':metric==='sessions'?'trendSessions':'trendUsers';
  const helpName=metric==='feedback'?'点赞点踩趋势':metric==='sessions'?'活跃会话趋势':'活跃用户趋势';
  return window.AIOpsWidget.panel('behavior',id,metric==='feedback'?'is-span-full':'',metricHelpIcon(helpName,'help·'+helpName));
 }
 const title=metric==='feedback'?'点赞点踩趋势':metric==='sessions'?'活跃会话趋势':'活跃用户趋势';
 const unit=metric==='feedback'?t('单位次'):metric==='sessions'?t('单位个'):t('单位人');
 const rangeUnit=state.range===1?t('今日'):t('按日');
 const head=metric==='feedback'
  ?`<div class="panelhead cost-trend-head"><h2>${esc(t(title))}</h2>${behaviorFeedbackLegend()}</div>`
  :`<div class="panelhead cost-trend-head"><h2>${esc(t(title))}</h2><small>${esc(unit)} · ${esc(rangeUnit)}</small></div>`;
 return `<section class="panel analysis-line-panel${metric==='feedback'?' behavior-feedback-panel':''}" data-line-chart="behavior-${metric}">${head}${behaviorChart(days,metric)}</section>`;
}
function behaviorFeedbackLegend(){
 return `<div class="behavior-legend analysis-line-legend">${behaviorSeries('feedback').map(item=>`<span><i style="background:${item.color}"></i>${esc(item.name)}</span>`).join('')}</div>`;
}
function behaviorChartHover(node,index,metric){node.dataset.lineIndex=index;node.dataset.lineHover='behavior-'+metric;analysisLineHover(node)}
function behaviorChartLeave(node){analysisLineLeave(node)}
function behaviorPage(){
 const {days,totals}=behaviorData(),previous=behaviorData(state.range,true).totals,number=value=>value.toLocaleString(loc());
 const metrics=[
  ['活跃会话数',number(totals.sessions),'','help·活跃会话数'],
  ['活跃用户数',number(totals.users),'','help·活跃用户数'],
  ['人均会话数',totals.sessionsPerUser,'','help·人均会话数'],
  ['平均会话轮次',totals.averageTurns,'','help·平均会话轮次']
 ];
 const feedback=`<div class="compact-stat" data-feedback-card><div class="metric-card-head">${metricHelp('点赞点踩次数','help·点赞点踩次数')}${analysisMetricSymbol('点赞点踩次数')}</div><div class="behavior-feedback-values">${[['likes','点赞','点赞次数'],['dislikes','点踩','点踩次数']].map(([key,label,name])=>{const comparison=analysisMetricOptions(name,totals,previous);return `<div class="metric-feedback-item"><div class="metric-card-value"><strong>${number(totals[key])}</strong><small>${esc(t(label))}</small></div>${analysisComparison(comparison.current,comparison.previous,comparison.better)}</div>`}).join('')}</div></div>`;
 const charts=`<div class="behavior-trends">${behaviorTrendPanel('sessions',days)}${behaviorTrendPanel('users',days)}${behaviorTrendPanel('feedback',days)}</div>`;
 return heading('用户行为分析','')+toolbar()+`<div class="behavior-dashboard"><div class="compact-stats analysis-metrics behavior-metrics">${metrics.map(item=>analysisMetric(...item,analysisMetricOptions(item[0],totals,previous))).join('')}${feedback}</div>${charts}</div>`;
}
// Health uses fixed session, turn, tool and alert records shared by every summary and chart.
let healthMockCache,healthPreviousMockCache;
const healthAlertTypes=[
 {key:'slow',name:'慢响应',formula:'help·慢响应',msg:'msg·慢响应'},
 {key:'llm',name:'LLM 报错',formula:'help·LLM 报错',msg:'msg·LLM'},
 {key:'rule',name:'规则触发异常',formula:'help·规则触发异常',msg:'msg·规则'},
 {key:'action',name:'动作执行失败',formula:'help·动作执行失败',msg:'msg·动作'}
];
const healthDurationTypes=[{key:'modelMs',name:'模型请求',color:'#4d8eff'},{key:'toolMs',name:'工具调用',color:'#18b99b'},{key:'retrievalMs',name:'知识检索',color:'#9b7aed'},{key:'ontologyMs',name:'本体操作',color:'#f0a142'}];
function healthMockRecords(previous=false){
 if(previous?healthPreviousMockCache:healthMockCache)return previous?healthPreviousMockCache:healthMockCache;
 const agents=analysisScopeCatalog().flatMap(scene=>scene.items),sessions=[],alerts=[];
 (previous?costPreviousSessions:costMockSessions).forEach((record,sessionIndex)=>{
  const session={id:(previous?'HP-':'HS-')+String(sessionIndex+1).padStart(4,'0'),date:record.date,hour:record.hour,agent:record.agent,agentName:agents.find(agent=>agent.id===record.agent).name,userId:'user-'+(sessionIndex%24+1),turns:[]};
  for(let index=0;index<record.turns;index++){
   const seed=(sessionIndex+1)*97+(index+1)*31+(previous?10000:0);
   const status=seed%53===0?'failed':seed%67===0?'no_return':seed%79===0?'interrupted':seed%89===0?'returned_error':'success';
   // Slow-response flags are fixed Mock evaluation results; no production threshold is implied.
   const slow=status==='success'&&seed%9===0,ttftMs=status==='no_return'?null:slow?3200+seed%2500:250+seed%1600;
   const tool={status:seed%41===0?'failed':'success',durationMs:300+seed%3500};
   const turn={id:session.id+'-T'+(index+1),index:index+1,status,slow,ttftMs,tool,modelMs:(ttftMs??0)+600+seed%3800,toolMs:tool.durationMs,retrievalMs:50+seed%650,ontologyMs:seed%3===0||seed%83===0?400+seed%1200:0};
   turn.durationMs=healthDurationTypes.reduce((sum,type)=>sum+turn[type.key],0);session.turns.push(turn);
   const addAlert=(type,severity,msgKey,source='Trace 规则')=>alerts.push({id:turn.id+'-'+type,type,severity,msgKey,source,sessionId:session.id,turnId:turn.id,turn:index+1,date:record.date,hour:record.hour,time:record.date+' '+String(record.hour).padStart(2,'0')+':'+String((index*7+sessionIndex%11)%60).padStart(2,'0')+':'+String(seed%60).padStart(2,'0'),agent:record.agent,agentName:session.agentName,userId:session.userId,status,ttftMs});
   if(slow)addAlert('slow','warning','msg·慢响应');
   if(status==='failed'||status==='returned_error'||seed%71===0)addAlert('llm','severe','msg·LLM','LLM 判断');
   if(seed%37===0)addAlert('rule','warning','msg·规则');
   if(seed%83===0)addAlert('action','severe','msg·动作');
  }
  session.durationMs=session.turns.reduce((sum,turn)=>sum+turn.durationMs,0);sessions.push(session);
 });
 const result={sessions,alerts};if(previous)healthPreviousMockCache=result;else healthMockCache=result;return result;
}
function healthAggregate(sessions,alerts){
 const turns=sessions.flatMap(session=>session.turns),tools=turns.map(turn=>turn.tool),completedTools=tools.filter(tool=>tool.status==='success'),ttfts=turns.filter(turn=>turn.ttftMs!==null);
 const errorSessions=sessions.filter(session=>session.turns.some(turn=>turn.status!=='success')).length,errorTurns=turns.filter(turn=>turn.status!=='success').length,slowTurns=turns.filter(turn=>turn.status==='success'&&turn.slow).length;
 const ratio=(n,d)=>d?n/d*100:0,mean=(rows,key)=>rows.length?rows.reduce((sum,row)=>sum+row[key],0)/rows.length:0;
 return {sessions:sessions.length,turns:turns.length,errorSessions,errorTurns,slowTurns,tools:tools.length,failedTools:tools.filter(tool=>tool.status==='failed').length,completedTools:completedTools.length,warningEvents:alerts.length,affectedUsers:new Set(alerts.map(alert=>alert.userId)).size,anomalousRate:ratio(errorSessions,sessions.length),turnErrorRate:ratio(errorTurns,turns.length),toolFailureRate:ratio(tools.filter(tool=>tool.status==='failed').length,tools.length),slowRate:ratio(slowTurns,turns.length),sessionAvgMs:mean(sessions,'durationMs'),toolAvgMs:mean(completedTools,'durationMs'),ttftAvgMs:mean(ttfts,'ttftMs'),validTtfts:ttfts.length,durations:healthDurationTypes.map(type=>({...type,value:turns.reduce((sum,turn)=>sum+turn[type.key],0)/1000}))};
}
function healthData(range=state.range,previous=false){
 const records=healthMockRecords(),prior=healthMockRecords(true),allSessions=[...prior.sessions,...records.sessions],allAlerts=[...prior.alerts,...records.alerts],dates=analysisWindowRows(range,previous).map(row=>row[0]),chosen=new Set(analysisScopeChosen());
 const sessions=allSessions.filter(session=>dates.includes(session.date)&&chosen.has(session.agent)),alerts=allAlerts.filter(alert=>dates.includes(alert.date)&&chosen.has(alert.agent));
 const buckets=range===1?Array.from({length:24},(_,hour)=>({date:dates[0],hour,label:String(hour).padStart(2,'0')+':00'})):dates.map(date=>({date,label:date.slice(5)}));
 return {dates,sessions,alerts,totals:healthAggregate(sessions,alerts),buckets:buckets.map(bucket=>{const matches=row=>row.date===bucket.date&&(range!==1||row.hour===bucket.hour);return {...bucket,...healthAggregate(sessions.filter(matches),alerts.filter(matches))}})};
}
function healthPercent(value){return value.toFixed(2)+'%'}
function healthSeconds(value){return (value/1000).toFixed(2)+'s'}
function healthAlertCounts(data){
 const counts=healthAlertTypes.map(type=>({...type,count:data.alerts.filter(alert=>alert.type===type.key).length}));
 const peak=Math.max(1,...counts.map(type=>type.count));
 const max=Math.max(4,Math.ceil(peak/4)*4);
 return {counts,max};
}
function healthAlertChartSVG(data,width=600,height=250){
 const {counts,max}=healthAlertCounts(data);
 const row=height/Math.max(1,counts.length),barH=Math.max(8,Math.min(16,row*0.42));
 const grid=[0,1,2,3,4].map(i=>{const x=width*i/4;return `<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#e8edf3"/>`}).join('');
 const bars=counts.map((type,i)=>{const y=(i+.5)*row;return `<rect data-health-alert-type="${type.key}" x="0" y="${y-barH/2}" width="${type.count/max*width}" height="${barH}" rx="4" fill="#0d99ff"><title>${esc(t(type.name))}: ${type.count}</title></rect>`}).join('');
 return `<svg class="health-alert-chart" width="${width}" height="${height}" preserveAspectRatio="none" role="img" aria-label="${esc(t('警告分布'))}, ${counts.map(type=>t(type.name)+' '+type.count).join(', ')}">${grid}${bars}</svg>`;
}
function healthAlertDistribution(data,aggregated=false){
 const {counts,max}=healthAlertCounts(data);
 const labels=counts.map(type=>`<div class="health-alert-ylabel"><span>${esc(t(type.name))}</span>${metricHelpIcon(type.name,type.formula)}</div>`).join('');
 const ticks=[0,1,2,3,4].map(i=>`<span>${max*i/4}</span>`).join('');
 return `<section class="${aggregated?'widget-panel widget-health-distribution health-alert-distribution':'panel health-alert-distribution'}"><div class="panelhead"><h2>${metricHelp('警告分布','help·警告分布')}</h2></div><div class="health-alert-chart-row"><div class="health-alert-ylabels">${labels}</div><div class="analysis-chart-host health-alert-plot" data-analysis-chart="health-alert">${healthAlertChartSVG(data)}</div><div class="health-alert-xaxis">${ticks}</div></div></section>`;
}
function healthAlertList(data){
 const filter=state.healthAlertSeverity||'all',events=data.alerts.filter(alert=>filter==='all'||alert.severity===filter).sort((a,b)=>b.time.localeCompare(a.time)||b.id.localeCompare(a.id));
 const emptyKey=filter==='severe'?'空警告严重':filter==='warning'?'空警告警告':'空警告全部';
 const feed=events.slice(0,20).map(alert=>{const type=healthAlertTypes.find(item=>item.key===alert.type);return `<button class="health-alert-item" onclick="healthAlertDetail('${alert.id}')" aria-label="${esc(t('查看警告')+' '+alert.time+' '+t(type.name)+' '+t(alert.agentName))}"><span class="health-alert-copy"><span class="health-alert-name"><b>${esc(t(type.name))}</b><span>${esc(t(alert.agentName))}</span><span aria-hidden="true">›</span></span><span class="health-alert-message">${esc(t(alert.msgKey||type.msg))}</span></span><span class="health-alert-meta"><span class="health-alert-badge ${alert.severity}">${esc(t(alert.severity==='severe'?'严重':'警告'))}</span><time title="${alert.time}">${state.range===1?alert.time.slice(11,16):alert.time.slice(5,16)}</time></span></button>`}).join('')||`<div class="health-alert-empty">${esc(t(emptyKey))}</div>`;
 return `<div class="panelhead"><h2>${metricHelp('实时警告','help·实时警告')}</h2><div class="segments">${[['all','全部'],['severe','严重'],['warning','警告']].map(([key,label])=>`<button data-alert-severity="${key}" class="${filter===key?'selected':''}" aria-pressed="${filter===key}" onclick="healthSetAlertSeverity('${key}',this)">${esc(t(label))}</button>`).join('')}</div></div><div class="health-alert-list"><div class="health-alert-feed">${feed}</div><div class="health-alert-footer">${esc(tf('警告共条',{n:events.length,m:Math.min(20,events.length)}))}</div></div>`;
}
function healthSetAlertSeverity(value,button){
 state.healthAlertSeverity=value;
 const active=button?.closest('[data-health-alert-list]'),data=healthData();
 document.querySelectorAll('[data-health-alert-list]').forEach(node=>{node.innerHTML=healthAlertList(data)});
 active?.querySelector(`[data-alert-severity="${value}"]`)?.focus({preventScroll:true});
}
function healthAlertDetail(id){
 const alert=healthMockRecords().alerts.find(item=>item.id===id);if(!alert)return;
 const type=healthAlertTypes.find(item=>item.key===alert.type),statusKey={success:'最终成功返回',failed:'最终失败',no_return:'无返回',interrupted:'中断',returned_error:'返回错误'}[alert.status];
 modal(t('警告详情'),`<div class="health-alert-detail-title"><b>${esc(t(type.name))}</b><span class="health-alert-badge ${alert.severity}">${esc(t(alert.severity==='severe'?'严重':'警告'))}</span></div><p>${esc(t(alert.msgKey||type.msg))}</p><div class="lineage-fields">${[[t('事件时间'),alert.time],[t('识别来源'),t(alert.source)],['Agent',t(alert.agentName)],[t('用户'),alert.userId],[t('会话编号'),alert.sessionId],[t('对话轮次'),tf('第N轮',{n:alert.turn})],[t('轮次最终状态'),t(statusKey)],[t('首 Token 输出耗时'),alert.ttftMs===null?t('无首 Token 返回'):healthSeconds(alert.ttftMs)]].map(([name,value])=>`<div class="lineage-field"><span>${esc(name)}</span><b>${esc(value)}</b></div>`).join('')}</div>`);
}
function healthSlowChartSVG(data,width=1100,height=280){
 return analysisLineChartSVG({
  width,height,
  rows:data.buckets,
  series:[{key:'slowRate',name:t('慢响应轮次率'),color:'#f0a142'}],
  ariaLabel:t('慢响应轮次率趋势')+' · '+(state.range===1?t('按小时'):t('按日')),
  yMode:'percent',
  hoverType:'health-slow',
  formatY:v=>(Number(v).toLocaleString(loc(),{maximumFractionDigits:2})+'%')
 });
}
function healthSlowTrend(data){
 if(window.AIOpsWidget)return window.AIOpsWidget.panel('health','slowTrend','',metricHelpIcon('慢响应轮次率趋势','help·慢响应轮次率趋势'));
 return `<section class="panel health-slow-panel analysis-line-panel" data-line-chart="health-slow"><div class="panelhead cost-trend-head"><h2>${metricHelp('慢响应轮次率趋势','help·慢响应轮次率趋势')}</h2><div class="health-slow-legend analysis-line-legend"><span><i style="background:#f0a142"></i>${esc(t('慢响应轮次率'))}</span></div></div><div class="health-trend-scroll analysis-chart-host" data-analysis-chart="health-slow">${healthSlowChartSVG(data)}</div>${data.totals.turns?'':'<div class="health-trend-empty">'+esc(t('所选范围暂无对话轮次数据'))+'</div>'}<div class="analysis-line-tooltip health-trend-tooltip" hidden></div></section>`;
}
function healthTrendHover(node,index){node.dataset.lineIndex=index;node.dataset.lineHover='health-slow';analysisLineHover(node)}
function healthTrendLeave(node){analysisLineLeave(node)}
function healthDurationBars(totals){
 const max=Math.max(1,...totals.durations.map(type=>type.value));
 return `<div class="step-bars">${totals.durations.map(type=>`<div class="step-row"><span><i style="background:${type.color}"></i>${esc(t(type.name))}</span><div class="step-track"><i style="width:${type.value/max*100}%;background:${type.color}"></i></div><b title="${type.value.toFixed(2)} ${esc(t('秒'))}">${type.value.toLocaleString(loc(),{maximumFractionDigits:1})}s</b></div>`).join('')}</div>`;
}
function healthDurationDistribution(totals){
 return `<section class="panel step-performance health-duration-panel"><div class="panelhead"><h2>${metricHelp('耗时分布','help·耗时分布')}</h2><small>${esc(t('累计耗时秒'))}</small></div>${healthDurationBars(totals)}</section>`;
}
function healthDurationWidget(){
 return `<div class="widget-panel widget-duration"><div class="widget-duration-head"><div class="widget-trend-label">${metricHelp('耗时分布','help·耗时分布')}</div><small>${esc(t('累计耗时秒'))}</small></div>${healthDurationBars(healthData().totals)}</div>`;
}
function healthSectionTitle(label){
 return `<h2 class="health-section-title">${esc(t(label))}</h2>`;
}
function healthPage(){
 const data=healthData(),d=data.totals,previous=healthData(state.range,true).totals,number=value=>value.toLocaleString(loc());
 return heading('健康度分析','')+toolbar()+`<div class="health-dashboard"><section class="analysis-section" id="error-analysis">${healthSectionTitle('报错分析')}<div class="health-error-metrics">`+analysisMetrics([
 ['异常会话率',healthPercent(d.anomalousRate),'','help·异常会话率'],
 ['工具调用失败率',healthPercent(d.toolFailureRate),'','help·工具调用失败率'],
 ['轮次错误率',healthPercent(d.turnErrorRate),'','help·轮次错误率'],
 ['警告事件数',number(d.warningEvents),'','help·警告事件数'],
 ['警告影响用户数',number(d.affectedUsers),'','help·警告影响用户数']
 ].map(item=>[...item,analysisMetricOptions(item[0],d,previous)]))+`</div><div class="health-section-panels"><div class="health-alert-panels">${healthAlertDistribution(data)}<section id="health-live-alerts" class="panel health-live-alerts" data-health-alert-list>${healthAlertList(data)}</section></div></div></section><section class="analysis-section" id="performance-analysis">${healthSectionTitle('性能分析')}<div class="health-performance-metrics">`+analysisMetrics([
 ['会话平均耗时',healthSeconds(d.sessionAvgMs),'','help·会话平均耗时'],
 ['慢响应轮次率',healthPercent(d.slowRate),'','help·慢响应轮次率'],
 ['工具平均耗时',healthSeconds(d.toolAvgMs),'','help·工具平均耗时'],
 ['首 token 延迟（TTFT）',healthSeconds(d.ttftAvgMs),'','help·首 token 延迟（TTFT）']
 ].map(item=>[...item,analysisMetricOptions(item[0],d,previous)]))+`</div><div class="health-section-panels"><div class="health-perf-panels">${healthSlowTrend(data)}${healthDurationDistribution(d)}</div></div></section></div>`;
}


// Fixed Mock sessions: each session belongs to one hourly bucket, so hourly and daily totals reconcile.
const costMetricDefinitions=[
 {key:'total',name:'总 Token',color:'#4d8eff',formula:'help·总 Token'},
 {key:'input',name:'输入 Token',color:'#18b99b',formula:'help·输入 Token'},
 {key:'output',name:'输出 Token',color:'#f0a142',formula:'help·输出 Token'},
 {key:'calls',name:'模型调用次数',color:'#9b7aed',formula:'help·模型调用次数'},
 {key:'perTurn',name:'平均每轮 Token 消耗',color:'#e5799d',formula:'help·平均每轮 Token 消耗'},
 {key:'perSession',name:'平均每会话 Token 消耗',color:'#f29b38',formula:'help·平均每会话 Token 消耗'}
];
function costMockDay([date,count,,,averageTurns],dayIndex,dailyTokens){
 const agents=analysisScopeCatalog().flatMap(scene=>scene.items.filter(item=>item.type==='Agent'));
 const weights=Array.from({length:count},(_,i)=>7+(i*7+dayIndex*3)%11),sum=weights.reduce((a,b)=>a+b,0);
 let consumed=0;
 return weights.map((weight,index)=>{
  const before=Math.round(consumed/sum*dailyTokens);consumed+=weight;
  const total=Math.round(consumed/sum*dailyTokens)-before,input=Math.round(total*(.68+(index+dayIndex)%9/100));
  const turns=Math.max(1,Math.round(averageTurns)+(index%3)-1);
  return {date,hour:(index*5+dayIndex*3)%24,agent:agents[(index+dayIndex)%agents.length].id,sessionId:'cost-'+date+'-'+index,input,output:total-input,calls:turns+1+index%3,turns};
 });
}
const costMockSessions=behaviorDailyMock.flatMap((row,i)=>costMockDay(row,i,[7.4,7.8,8.1,8.6,9.2,8.8,10.9,12.3,12.4,14,18.9,13.4,11.6,12.8][i]*1e6));
const costPreviousSessions=analysisPreviousDailyMock.flatMap((row,i)=>costMockDay(row,i+14,[6.8,7.1,7.4,8.2,7.7,6.9,8.1,9.2,10.1,8.9,12.1,10.2,9.6,8.8][i]*1e6));
function costAggregate(rows){
 const result={input:0,output:0,calls:0,turns:0,sessions:new Set(rows.map(row=>row.sessionId)).size};
 rows.forEach(row=>['input','output','calls','turns'].forEach(key=>result[key]+=row[key]));
 result.total=result.input+result.output;
 result.perTurn=result.turns?result.total/result.turns:0;
 result.perSession=result.sessions?result.total/result.sessions:0;
 return result;
}
function costData(range=state.range,previous=false){
 const dates=analysisWindowRows(range,previous).map(row=>row[0]),chosen=new Set(analysisScopeChosen());
 const rows=[...costPreviousSessions,...costMockSessions].filter(row=>dates.includes(row.date)&&chosen.has(row.agent));
 const buckets=range===1?Array.from({length:24},(_,hour)=>({label:String(hour).padStart(2,'0')+':00',date:dates[0],hour})):dates.map(date=>({label:date.slice(5),date}));
 return {dates,totals:costAggregate(rows),buckets:buckets.map(bucket=>({...bucket,...costAggregate(rows.filter(row=>row.date===bucket.date&&(range!==1||row.hour===bucket.hour)))}))};
}
function costNumber(value,compact=true){
 if(!compact)return value.toLocaleString(loc(),{maximumFractionDigits:1});
 if(value>=1e6)return (value/1e6).toLocaleString('en-US',{maximumFractionDigits:2})+'M';
 if(value>=1e3)return (value/1e3).toLocaleString('en-US',{maximumFractionDigits:2})+'k';
 return value.toLocaleString(loc(),{maximumFractionDigits:1});
}
const costTrendGroups=[
 {key:'total',title:'Token 用量趋势',keys:['total','input','output'],formula:'help·Token 用量趋势'},
 {key:'average',title:'平均 Token 消耗趋势',keys:['perTurn','perSession'],formula:'help·平均 Token 消耗趋势'}
];
function costChartSeries(group='total'){const keys=(costTrendGroups.find(item=>item.key===group)||costTrendGroups[0]).keys;return costMetricDefinitions.filter(item=>keys.includes(item.key))}
function costYTick(value){return value>=1e6?costNumber(value/1e6,false)+'M':value>=1e4?(lang()==='en'?costNumber(value/1e3,false)+'k':costNumber(value/1e4,false)+t('万')):costNumber(value,false)}
function costChart(buckets,width=1100,height=280,group='total'){
 const series=costChartSeries(group),title=(costTrendGroups.find(item=>item.key===group)||costTrendGroups[0]).title;
 return analysisLineChartSVG({
  width,height,rows:buckets,
  series:series.map(item=>({key:item.key,name:t(item.name),color:item.color})),
  ariaLabel:t(title)+' · '+(state.range===1?t('每小时'):t('每日'))+' · '+series.map(item=>t(item.name)).join(', '),
  yMode:'token',hoverType:'cost-'+group,formatY:costYTick
 });
}
function costChartHover(node,index){
 const group=node.closest('[data-line-chart]')?.dataset.lineChart||node.closest('[data-cost-chart]')?.dataset.costChart;
 node.dataset.lineIndex=index;node.dataset.lineHover=group&&String(group).startsWith('cost-')?group:'cost-'+(group||'total');
 analysisLineHover(node);
}
function costChartLeave(node){analysisLineLeave(node)}
function costTrendPanel(group,buckets,totals){
 if(window.AIOpsWidget){
  const helpName=group.key==='average'?'平均 Token 消耗趋势':'Token 用量趋势';
  return window.AIOpsWidget.panel('cost',group.key==='average'?'trendAvg':'trendUsage','',metricHelpIcon(helpName,'help·'+helpName));
 }
 const series=costChartSeries(group.key);
 return `<section class="panel cost-trend-panel analysis-line-panel" data-line-chart="cost-${group.key}" data-cost-chart="${group.key}"><div class="panelhead cost-trend-head"><h2>${metricHelp(group.title,group.formula)}</h2><div class="cost-trend-legend analysis-line-legend">${series.map(item=>`<span><i style="background:${item.color}"></i>${esc(t(item.name))}</span>`).join('')}</div></div><div class="cost-chart-scroll analysis-chart-host" data-analysis-chart="cost-${group.key}">${costChart(buckets,1100,280,group.key)}</div>${totals.calls?'':'<div class="cost-chart-empty">'+esc(t('所选范围暂无模型调用数据'))+'</div>'}<div class="analysis-line-tooltip cost-chart-tooltip" hidden></div></section>`;
}
function costPage(){
 const {dates,totals,buckets}=costData(),previous=costData(state.range,true).totals;
 return heading('成本分析','')+toolbar()+`<section class="cost-dashboard">${analysisMetrics(costMetricDefinitions.map(item=>[item.name,costNumber(totals[item.key],item.key!=='calls'),'',item.formula,analysisMetricOptions(item.name,totals,previous)]))}<div class="cost-trend-panels">${costTrendGroups.map(group=>costTrendPanel(group,buckets,totals)).join('')}</div></section>`;
}



  // Adapt chart host selector from #main to page root
  var _syncAnalysisCharts = syncAnalysisCharts;
  syncAnalysisCharts = function () {
    analysisChartObserver && analysisChartObserver.disconnect();
    // pageRoot (监测 + 工作台) and widget gallery preview share the same chart hosts.
    var hosts = document.querySelectorAll('[data-analysis-chart]');
    if (typeof ResizeObserver === 'function' && !analysisChartObserver) {
      analysisChartObserver = new ResizeObserver(function (entries) {
        entries.forEach(function (entry) { analysisChartResizeQueue.add(entry.target); });
        if (!analysisChartResizeFrame) {
          analysisChartResizeFrame = requestAnimationFrame(function () {
            analysisChartResizeFrame = 0;
            analysisChartResizeQueue.forEach(function (h) {
              if (h.isConnected) {
                delete h.dataset.chartSize;
                drawAnalysisChart(h);
              }
            });
            analysisChartResizeQueue.clear();
          });
        }
      });
    }
    function paint() {
      hosts.forEach(function (h) {
        delete h.dataset.chartSize;
        drawAnalysisChart(h);
        analysisChartObserver && analysisChartObserver.observe(h);
      });
    }
    paint();
    requestAnimationFrame(function () { requestAnimationFrame(paint); });
  };

  // Host paints title + time range; boards are body-only from Enhance.
  function stripEnhanceChrome(html, title) {
    return html.replace(heading(title, '') + toolbar(), '');
  }
  function costBoard() {
    return stripEnhanceChrome(costPage(), '成本分析');
  }
  function healthBoard() {
    return stripEnhanceChrome(healthPage(), '健康度分析');
  }
  function behaviorBoard() {
    return stripEnhanceChrome(behaviorPage(), '用户行为分析');
  }

  var summaryKey = '', summaryValues = {};
  function metricSummary(id) {
    var key = state.range + ':' + JSON.stringify(host.getDateRange ? host.getDateRange() : null) + ':' + analysisScopeChosen().join(',');
    if (key !== summaryKey) {
      summaryKey = key; summaryValues = {};
      var pairs = [[costData().totals, costData(state.range, true).totals, ['total','input','output','calls','perTurn','perSession']], [behaviorData().totals, behaviorData(state.range,true).totals, ['sessions','users','sessionsPerUser','averageTurns','likes','dislikes']], [healthData().totals,healthData(state.range,true).totals,['anomalousRate','toolFailureRate','turnErrorRate','warningEvents','affectedUsers','sessionAvgMs','slowRate','toolAvgMs','ttftAvgMs']]];
      pairs.forEach(function (pair) { pair[2].forEach(function (name) {
        var now = Number(pair[0][name] || 0), before = Number(pair[1][name] || 0), delta = before ? (now - before) / Math.abs(before) * 100 : now ? null : 0;
        var value = /Rate$/.test(name) ? healthPercent(now) : /Ms$/.test(name) ? healthSeconds(now) : ['sessionsPerUser','averageTurns'].indexOf(name) >= 0 ? now.toFixed(1) : costNumber(now);
        summaryValues[name] = [value, delta === null ? t('新增') : (delta > 0 ? '+' : delta < 0 ? '−' : '') + Math.abs(delta).toLocaleString(loc(), {maximumFractionDigits:1}) + '%', delta < 0 && /Rate$|Ms$/.test(name) ? 'good' : ''];
      }); });
      summaryValues.avgTurns = summaryValues.averageTurns; summaryValues.ttft = summaryValues.ttftAvgMs;
      summaryValues.feedback = [summaryValues.likes[0] + ' / ' + summaryValues.dislikes[0], ''];
    }
    return summaryValues[id];
  }

  global.AIOpsBoards = {
    dateBounds: analysisDateBounds,
    configure: function (opts) {
      Object.assign(host, opts || {});
    },
    metricSummary: metricSummary,
    healthDurationWidget: healthDurationWidget,
    healthWarningWidget: function () { return healthAlertDistribution(healthData(), true); },
    healthAlertsWidget: function () { return '<div class="widget-panel widget-health-alerts health-live-alerts" data-health-alert-list>' + healthAlertList(healthData()) + '</div>'; },
    costPage: costBoard,
    healthPage: healthBoard,
    behaviorPage: behaviorBoard,
    syncCharts: function () {
      syncAnalysisCharts();
    },
    scopePicker: function () {
      return analysisScopePicker();
    }
  };

  /* Keep help tips inside the content pane so the sidebar cannot cover them. */
  function clampMetricTooltip(help) {
    var tip = help.querySelector('.metric-tooltip');
    var pane = help.closest('.aiops-scroll');
    if (!tip || !pane) return;
    tip.style.transform = '';
    tip.style.removeProperty('--tip-shift');
    var pad = 12;
    var paneBox = pane.getBoundingClientRect();
    var tipBox = tip.getBoundingClientRect();
    var shift = 0;
    if (tipBox.left < paneBox.left + pad) shift = paneBox.left + pad - tipBox.left;
    else if (tipBox.right > paneBox.right - pad) shift = paneBox.right - pad - tipBox.right;
    if (Math.abs(shift) < 1) return;
    var base = 0;
    var matrix = getComputedStyle(tip).transform;
    if (matrix && matrix !== 'none') {
      var parts = matrix.slice(matrix.indexOf('(') + 1, matrix.lastIndexOf(')')).split(',');
      base = parseFloat(parts[4]) || 0;
    }
    tip.style.transform = 'translateX(' + (base + shift) + 'px)';
    tip.style.setProperty('--tip-shift', shift + 'px');
  }
  document.addEventListener('mouseover', function (event) {
    var help = event.target.closest && event.target.closest('.metric-help');
    if (!help || (event.relatedTarget && help.contains(event.relatedTarget))) return;
    clampMetricTooltip(help);
  });
  document.addEventListener('focusin', function (event) {
    var help = event.target.closest && event.target.closest('.metric-help');
    if (help) clampMetricTooltip(help);
  });

  Object.assign(global, {
    healthSetAlertSeverity: healthSetAlertSeverity,
    healthAlertDetail: healthAlertDetail,
    healthTrendHover: healthTrendHover,
    healthTrendLeave: healthTrendLeave,
    costChartHover: costChartHover,
    costChartLeave: costChartLeave,
    analysisLineHover: analysisLineHover,
    analysisLineLeave: analysisLineLeave,
    behaviorChartHover: behaviorChartHover,
    behaviorChartLeave: behaviorChartLeave
  });

})(window);
