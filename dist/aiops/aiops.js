/* AI Ops — left nav from Figma AgentOS-2.0 319:48545; homepage = configurable widgets schematic */

(function () {
  var state = {
    page: '工作台',
    workspaceSchedulePage: null,
    range: 7,
    monitoringDateRange: undefined,
    notifyType: 'all',
    newOpen: false,
    lang: 'zh',
    homeWidgets: null,
    galleryOpen: false,
    galleryType: 'cost',
    galleryHidden: false,
    sessionPage: 1,
    sessionViewId: null,
    sessionListScroll: null,
    sessionQuery: '',
    sessionSort: { key: 'time', direction: 'desc' },
    sessionFilters: { agent: [], user: [], mark: [], by: [] },
    sessionFilterMenu: null,
    sessionDateRange: null,
    sessionDateMenu: null,
    sessionSearchOpen: false,
    sessionComposing: false,
    sessionPointerDown: false,
    sessionFocus: null,
    sessionSelected: {},
    sessionMarks: {},
    sessionMarkIds: [],
    sessionMarkAnchor: null,
    cuiExtra: {},
    cuiFocus: false,
    railOpen: false,
    railMax: false,
    railSection: null,
    railTabs: [],
    railCurrent: null,
    railContexts: Object.create(null),
    railOwner: null,
    cuiDrafts: Object.create(null),
    cuiDraftId: 0,
    cuiSeed: null,
    cuiWs: 'audit',
    cuiModel: 'Auto',
    cuiIntensity: 'Default',
    configId: null,
    deleteAsk: null,
    drag: null,
    /* Demo-only: Figma widget visual skins — border | raised | inset. Default: 白底灰卡 */
    widgetSkin: 'inset'
  };

  var WIDGET_SKINS = [
    { id: 'border', label: '白底描边' },
    { id: 'raised', label: '灰底白卡' },
    { id: 'inset', label: '白底灰卡' }
  ];

  var I18N = {
    '切换场景': { zh: '切换场景', en: 'Switch scenario' },
    '工作台': { zh: '工作台', en: 'Workbench' },
    '定时任务': { zh: '定时任务', en: 'Schedules' },
    '线上会话': { zh: '线上会话', en: 'Live sessions' },
    '评测': { zh: '评测', en: 'Evaluation' },
    '业务任务': { zh: '业务任务', en: 'Business tasks' },
    '评测实验': { zh: '评测实验', en: 'Evaluation experiments' },
    '评测集': { zh: '评测集', en: 'Evaluation suites' },
    '统一评估器': { zh: '评估器', en: 'Evaluators' },
    '评测任务': { zh: '在线评测任务', en: 'Online evaluation tasks' },
    '离线评估器': { zh: '离线评估器（备份）', en: 'Offline evaluators (backup)' },
    '在线评估器': { zh: '在线评估器（备份）', en: 'Online evaluators (backup)' },
    '产出物': { zh: '产出物', en: 'Artifacts' },
    '成本分析': { zh: '成本分析', en: 'Cost analysis' },
    '健康度分析': { zh: '健康度分析', en: 'Health analysis' },
    '用户行为分析': { zh: '用户行为分析', en: 'User behavior' },
    '自定义看板': { zh: '自定义看板', en: 'Custom dashboards' },
    '分析任务': { zh: '分析任务', en: 'Analysis task' },
    '新任务': { zh: '新任务', en: 'New task' },
    '消息通知': { zh: '消息通知', en: 'Notifications' },
    '默认工作区': { zh: '默认工作区', en: 'Default workspace' },
    '暂无任务': { zh: '暂无任务', en: 'No tasks yet' },
    '关联审核智能体': { zh: '关联审核智能体', en: 'Linked audit agents' },
    '成本分析智能体': { zh: '成本分析智能体', en: 'Cost analysis agent' },
    '会话质量分析智能体': { zh: '会话质量分析智能体', en: 'Session quality agent' },
    '制造业规则审核智能体': { zh: '制造业规则审核智能体', en: 'Manufacturing rules agent' },
    '制造业规则被否决原因': { zh: '制造业规则被否决原因', en: 'Manufacturing rule rejections' },
    '10 月 9 日成本峰值排查': { zh: '10 月 9 日成本峰值排查', en: 'Oct 9 cost spike review' },
    '高频重复提问与用户反馈': { zh: '高频重复提问与用户反馈', en: 'Repeat questions & feedback' },
    '两会话问题复盘': { zh: '两会话问题复盘', en: 'Two-session postmortem' },
    '成本与业务指标日报': { zh: '成本与业务指标日报', en: 'Cost & business daily' },
    '核验项与规则变更抽取': { zh: '核验项与规则变更抽取', en: 'Checks & rule-change extract' },
    '监测': { zh: '监测', en: 'Monitor' },
    '监测看板': { zh: '监测看板', en: 'Monitor boards' },
    '工作区': { zh: '工作区', en: 'Workspace' },
    '本期不包含': { zh: '本期不包含', en: 'Not in this release' },
    '新建': { zh: '新建', en: 'New' },
    '创建工作区': { zh: '创建工作区', en: 'Create workspace' },
    '新建工作区': { zh: '新建工作区', en: 'New workspace' },
    '今日': { zh: '今日', en: 'Today' },
    '天': { zh: '天', en: 'd' },
    '全部': { zh: '全部', en: 'All' },
    '添加组件': { zh: '添加组件', en: 'Add widget' },
    '添加成功': { zh: '添加成功', en: 'Added' },
    '更新后缀': { zh: '更新', en: 'updated' },
    '总 Token': { zh: '总 Token', en: 'Total tokens' },
    '输入 Token': { zh: '输入 Token', en: 'Input tokens' },
    '输出 Token': { zh: '输出 Token', en: 'Output tokens' },
    '模型调用次数': { zh: '模型调用次数', en: 'Model calls' },
    '平均每轮 Token 消耗': { zh: '平均每轮 Token 消耗', en: 'Avg tokens / turn' },
    '平均每会话 Token 消耗': { zh: '平均每会话 Token 消耗', en: 'Avg tokens / session' },
    'Token 用量趋势': { zh: 'Token 用量趋势', en: 'Token usage trend' },
    '平均 Token 消耗趋势': { zh: '平均 Token 消耗趋势', en: 'Avg token trend' },
    '定时任务执行情况': { zh: '定时任务执行情况', en: 'Schedule status' },
    '全部任务': { zh: '全部任务', en: 'All tasks' },
    '成功': { zh: '成功', en: 'Success' },
    '失败': { zh: '失败', en: 'Failed' },
    '今日时': { zh: '今日', en: 'Today' },
    '昨日': { zh: '昨日', en: 'Yesterday' },
    '慢响应周报': { zh: '慢响应周报', en: 'Slow-response weekly' },
    '最近更新': { zh: '最近更新', en: 'Recently updated' },
    '查看全部': { zh: '查看全部', en: 'View all' },
    '成本与性能日报': { zh: '成本与性能日报', en: 'Cost & performance daily' },
    '核验项明细': { zh: '核验项明细', en: 'Check-item details' },
    '表 · 系统': { zh: '表 · 系统', en: 'Table · System' },
    '文档 · Feng Zhu': { zh: '文档 · Feng Zhu', en: 'Doc · Feng Zhu' },
    '昨天': { zh: '昨天', en: 'Yesterday' },
    '异常会话率': { zh: '异常会话率', en: 'Abnormal session rate' },
    '慢响应轮次率': { zh: '慢响应轮次率', en: 'Slow-turn rate' },
    '工具调用失败率': { zh: '工具调用失败率', en: 'Tool failure rate' },
    '轮次错误率': { zh: '轮次错误率', en: 'Turn error rate' },
    '警告事件数': { zh: '警告事件数', en: 'Warning events' },
    '警告影响用户数': { zh: '警告影响用户数', en: 'Users affected' },
    '警告分布': { zh: '警告分布', en: 'Warning mix' },
    '实时警告': { zh: '实时警告', en: 'Live alerts' },
    '会话平均耗时': { zh: '会话平均耗时', en: 'Avg session duration' },
    '工具平均耗时': { zh: '工具平均耗时', en: 'Avg tool duration' },
    '首 token 延迟（TTFT）': { zh: '首 token 延迟（TTFT）', en: 'TTFT' },
    '慢响应轮次趋势': { zh: '慢响应轮次趋势', en: 'Slow-turn trend' },
    '耗时分布': { zh: '耗时分布', en: 'Duration mix' },
    '报错分析': { zh: '报错分析', en: 'Error analysis' },
    '性能分析': { zh: '性能分析', en: 'Performance' },
    '活跃会话数': { zh: '活跃会话数', en: 'Active sessions' },
    '活跃用户数': { zh: '活跃用户数', en: 'Active users' },
    '人均会话数': { zh: '人均会话数', en: 'Sessions / user' },
    '平均会话轮次': { zh: '平均会话轮次', en: 'Avg turns / session' },
    '点赞': { zh: '点赞', en: 'Like' },
    '点踩': { zh: '点踩', en: 'Dislike' },
    '点赞点踩次数': { zh: '点赞点踩次数', en: 'Likes & dislikes' },
    '活跃会话趋势': { zh: '活跃会话趋势', en: 'Session trend' },
    '活跃用户趋势': { zh: '活跃用户趋势', en: 'User trend' },
    '点赞点踩趋势': { zh: '点赞点踩趋势', en: 'Feedback trend' },
    '任务执行情况': { zh: '任务执行情况', en: 'Task runs' },
    'Dashboards': { zh: '监测看板', en: 'Dashboards' },
    '搜索组件': { zh: '搜索组件', en: 'Search widgets' },
    '完成': { zh: '完成', en: 'Done' },
    '添加': { zh: '添加', en: 'Add' },
    '配置': { zh: '配置', en: 'Configure' },
    '删除': { zh: '删除', en: 'Delete' },
    '删除成功': { zh: '删除成功', en: 'Deleted' },
    '确认删除组件': { zh: '确定删除该组件？', en: 'Remove this widget?' },
    '拖拽': { zh: '拖拽', en: 'Drag' },
    '显示指标': { zh: '显示指标', en: 'Metrics' },
    '保存配置': { zh: '保存', en: 'Save' },
    '取消': { zh: '取消', en: 'Cancel' },
    '关闭': { zh: '关闭', en: 'Close' },
    '新建定时任务': { zh: '新建定时任务', en: 'New schedule' },
    '定时任务提示': { zh: '帮我创建一个定时任务：', en: 'Help me create a scheduled task: ' },
    '移除技能': { zh: '移除技能', en: 'Remove skill' },
    '本期不包含短': { zh: '本期不包含', en: 'Not in this release' },
    '组件库': { zh: '组件库', en: 'Widget gallery' },
    '没有匹配的组件': { zh: '没有匹配的组件', en: 'No matching widgets' },
    '调整宽度': { zh: '拖拽调整大小', en: 'Drag to resize' },
    '皮肤切换': { zh: '卡片皮肤', en: 'Card skin' },
    '白底描边': { zh: '白底描边', en: 'White + border' },
    '灰底白卡': { zh: '灰底白卡', en: 'Gray canvas' },
    '白底灰卡': { zh: '白底灰卡', en: 'Inset gray' },
    '日环比': { zh: '日环比', en: 'DoD' },
    '7天环比': { zh: '7天环比', en: '7d' },
    '14天环比': { zh: '14天环比', en: '14d' },
    '待执行': { zh: '待执行', en: 'Pending' },
    '补跑成功': { zh: '补跑成功', en: 'Rerun OK' },
    '数据表': { zh: '数据表', en: 'Table' },
    '空指标提示': { zh: '点击配置选择要展示的指标', en: 'Configure metrics to show' },
    '此组件无可配置指标': { zh: '此组件无可配置指标', en: 'No configurable metrics' },
    '详情': { zh: '详情', en: 'Details' },
    '返回': { zh: '返回', en: 'Back' },
    '说明': { zh: '说明', en: 'Notes' },
    '执行时间': { zh: '执行时间', en: 'Run time' },
    '采购 Agent 连续失败': { zh: '采购 Agent 连续失败', en: 'Procurement agent failing' },
    '骨架说明': { zh: '页面骨架示意，细节与交互稍后按你的反馈调整。', en: 'Page scaffold — details to refine with your feedback.' },
    '分析任务副': { zh: '描述分析需求，创建一次探索。', en: 'Describe an analysis need and start exploring.' },
    '分析占位': { zh: '描述分析需求，@ 引用上下文，/ 选择技能', en: 'Describe need, @ context, / skills' },
    '附件': { zh: '＋ 附件', en: '+ Attach' },
    '发送': { zh: '发送', en: 'Send' },
    '搜索任务': { zh: '搜索任务名称或描述…', en: 'Search task name or description…' },
    '创建': { zh: '创建', en: 'Create' },
    '查看': { zh: '查看', en: 'View' },
    '运行中': { zh: '运行中', en: 'Running' },
    '任务描述1': { zh: '汇总前一日成本、token、平均耗时与报告生成率。', en: 'Summarize prior-day cost, tokens, latency, and report rate.' },
    '任务描述2': { zh: '抽取核验项明细与规则变更，写入产出物。', en: 'Extract check items and rule changes into artifacts.' },
    '每天': { zh: '每天', en: 'Daily' },
    '搜索会话': { zh: '搜索会话信息、编号或用户', en: 'Search session, ID, or user' },
    '会话数': { zh: '4 个会话', en: '4 sessions' },
    '昨天': { zh: '昨天', en: 'Yesterday' },
    '上一页': { zh: '上一页', en: 'Previous page' },
    '下一页': { zh: '下一页', en: 'Next page' },
    '会话': { zh: '会话', en: 'Session' },
    '选择全部会话': { zh: '选择全部会话', en: 'Select all sessions' },
    '会话信息': { zh: '会话信息', en: 'Session' },
    '最新会话时间': { zh: '最新会话时间', en: 'Latest session time' },
    '消息': { zh: '消息', en: 'Messages' },
    'token 消耗': { zh: 'token 消耗', en: 'Token use' },
    '警告': { zh: '警告', en: 'Warnings' },
    '标记': { zh: '标记', en: 'Mark' },
    '标记用户': { zh: '标记用户', en: 'Marked by' },
    '标记时间': { zh: '标记时间', en: 'Marked at' },
    '操作': { zh: '操作', en: 'Actions' },
    '未标记': { zh: '未标记', en: 'Unmarked' },
    '优质': { zh: '优质', en: 'Good' },
    '劣质': { zh: '劣质', en: 'Poor' },
    '边界': { zh: '边界', en: 'Borderline' },
    'AI分析': { zh: 'AI分析', en: 'AI analysis' },
    'AI 分析': { zh: 'AI 分析', en: 'AI analysis' },
    '返回列表': { zh: '返回列表', en: 'Back to list' },
    '原始对话': { zh: '原始对话', en: 'Conversation' },
    '执行记录': { zh: '执行记录', en: 'Execution' },
    '对话轮次': { zh: '对话轮次', en: 'Turns' },
    '消息 / 轮次': { zh: '消息 / 轮次', en: 'Messages / turns' },
    '耗时': { zh: '耗时', en: 'Duration' },
    '运行信号': { zh: '运行信号', en: 'Signals' },
    '智能体': { zh: '智能体', en: 'Agent' },
    '系统消息': { zh: '系统消息', en: 'System message' },
    '复制': { zh: '复制', en: 'Copy' },
    '模型': { zh: '模型', en: 'Model' },
    '工具': { zh: '工具', en: 'Tool' },
    '本体': { zh: '本体', en: 'Ontology' },
    '知识': { zh: '知识', en: 'Knowledge' },
    '输出': { zh: '输出', en: 'Output' },
    '仅异常': { zh: '仅异常', en: 'Issues only' },
    '搜索执行': { zh: '搜索步骤、结果或错误码', en: 'Search steps, results, or error codes' },
    '没有匹配的记录': { zh: '没有匹配的记录', en: 'No matching records' },
    '清除筛选': { zh: '清除筛选', en: 'Clear filters' },
    '输入': { zh: '输入', en: 'Input' },
    '成功': { zh: '成功', en: 'Success' },
    '告警': { zh: '告警', en: 'Warning' },
    '错误': { zh: '错误', en: 'Error' },
    '轮次': { zh: '轮次', en: 'Turn' },
    '编号': { zh: '编号', en: 'ID' },
    '错误数': { zh: '错误', en: 'errors' },
    '警告数': { zh: '警告', en: 'warnings' },
    '用户': { zh: '用户', en: 'User' },
    '状态': { zh: '状态', en: 'Status' },
    '最新时间': { zh: '最新时间', en: 'Updated' },
    '消息数': { zh: '消息数', en: 'Messages' },
    '异常': { zh: '异常', en: 'Error' },
    '正常': { zh: '正常', en: 'OK' },
    '警告态': { zh: '警告', en: 'Warn' },
    '销售分货 Agent': { zh: '销售分货 Agent', en: 'Sales allocation agent' },
    '采购计划 Agent': { zh: '采购计划 Agent', en: 'Procurement plan agent' },
    '销售订单 Agent': { zh: '销售订单 Agent', en: 'Sales order agent' },
    '供应商评估 Agent': { zh: '供应商评估 Agent', en: 'Supplier eval agent' },
    '搜索产出物': { zh: '搜索名称、描述或更新人', en: 'Search name, description, or updater' },
    '名称': { zh: '名称', en: 'Name' },
    '类型': { zh: '类型', en: 'Type' },
    '更新人': { zh: '更新人', en: 'Updated by' },
    '更新时间': { zh: '更新时间', en: 'Updated at' },
    '表': { zh: '表', en: 'Table' },
    '文档': { zh: '文档', en: 'Doc' },
    '系统': { zh: '系统', en: 'System' },
    '关账审核智能体': { zh: '关账审核智能体', en: 'Close-audit agent' },
    '总Token': { zh: '总 Token', en: 'Total tokens' },
    '输入Token': { zh: '输入 Token', en: 'Input tokens' },
    '输出Token': { zh: '输出 Token', en: 'Output tokens' },
    '模型调用次数': { zh: '模型调用次数', en: 'Model calls' },
    '次': { zh: '次', en: '' },
    '平均每轮 Token 消耗': { zh: '平均每轮 Token 消耗', en: 'Avg tokens / turn' },
    '平均每会话 Token 消耗': { zh: '平均每会话 Token 消耗', en: 'Avg tokens / session' },
    'help总': { zh: '所选范围内使用的 Token 总量。', en: 'Total tokens in the selected range.' },
    'help入': { zh: '输入侧 Token 总量。', en: 'Input-side token total.' },
    'help出': { zh: '输出侧 Token 总量。', en: 'Output-side token total.' },
    'help次': { zh: '所选范围内模型调用总次数。', en: 'Model call count in range.' },
    'help轮': { zh: '总 Token / 轮次。', en: 'Total tokens / turns.' },
    'help会话': { zh: '总 Token / 会话数。', en: 'Total tokens / sessions.' },
    'Token 用量趋势': { zh: 'Token 用量趋势', en: 'Token usage trend' },
    '按日统计': { zh: 'Mock · 按日统计', en: 'Mock · daily' },
    '报错分析': { zh: '报错分析', en: 'Error analysis' },
    '工具调用失败率': { zh: '工具调用失败率', en: 'Tool failure rate' },
    '轮次错误率': { zh: '轮次错误率', en: 'Turn error rate' },
    '警告事件数': { zh: '警告事件数', en: 'Warning events' },
    '日环比下': { zh: '−0.3% 日环比', en: '−0.3% DoD' },
    '日环比上': { zh: '+0.2% 日环比', en: '+0.2% DoD' },
    '日环比平': { zh: '0% 日环比', en: '0% DoD' },
    '日环比警': { zh: '+8.0% 日环比', en: '+8.0% DoD' },
    'help异常': { zh: '异常会话 / 总会话。', en: 'Abnormal / total sessions.' },
    'help工具': { zh: '失败工具调用 / 总调用。', en: 'Failed tool calls / total.' },
    'help轮错': { zh: '错误轮次 / 总轮次。', en: 'Error turns / total turns.' },
    'help警告': { zh: '告警事件总数。', en: 'Total warning events.' },
    '健康度趋势': { zh: '健康度趋势', en: 'Health trend' },
    '活跃会话数': { zh: '活跃会话数', en: 'Active sessions' },
    '活跃用户数': { zh: '活跃用户数', en: 'Active users' },
    '人均会话数': { zh: '人均会话数', en: 'Sessions / user' },
    '平均会话轮次': { zh: '平均会话轮次', en: 'Avg turns / session' },
    '个会话': { zh: '个会话', en: 'sessions' },
    '位用户': { zh: '位用户', en: 'users' },
    '次每人': { zh: '次 / 人', en: '/ user' },
    '轮会话': { zh: '轮 / 会话', en: 'turns / session' },
    '活跃趋势': { zh: '活跃会话 / 活跃用户趋势', en: 'Sessions / users trend' },
    '自定义看板副': { zh: '围绕业务目标，组合数据与指标', en: 'Compose metrics around business goals' },
    '新建看板': { zh: '新建看板', en: 'New dashboard' },
    '自定义': { zh: '自定义', en: 'Custom' },
    '关账业务效果': { zh: '关账业务效果', en: 'Close-audit impact' },
    '关账描述': { zh: '追踪关账核验通过率与规则变更', en: 'Track pass rate and rule changes' },
    '销售分货健康度': { zh: '销售分货健康度', en: 'Sales allocation health' },
    '销售描述': { zh: '异常会话、慢响应与规则触发', en: 'Errors, slow turns, rule hits' },
    '指标数6': { zh: '6 个指标', en: '6 metrics' },
    '指标数4': { zh: '4 个指标', en: '4 metrics' },
    '全部标为已读': { zh: '全部标为已读', en: 'Mark all read' },
    '严重问题': { zh: '严重问题', en: 'Critical' },
    '今天': { zh: '今天', en: 'Today' },
    '工作区骨架': { zh: '工作区会话 / 任务详情骨架', en: 'Workspace session / task scaffold' },
    '继续提问': { zh: '继续问，或让 Agent 接着查…', en: 'Ask a follow-up, or have the Agent keep looking…' },
    '对话问候': { zh: 'AgentOS Chat，有什么可以帮你', en: 'AgentOS Chat, here to help' },
    '分析问候前': { zh: '想在 ', en: 'What do you want to analyze in ' },
    '分析问候后': { zh: ' 里分析什么', en: '?' },
    '切换工作区': { zh: '切换工作区', en: 'Switch workspace' },
    '上传': { zh: '上传', en: 'Upload' },
    '对话占位': { zh: '随便问，或把任务交给 Agent…', en: 'Ask anything, or hand a task to the Agent…' },
    '添加': { zh: '添加', en: 'Add' },
    '发送消息': { zh: '发送', en: 'Send' },
    '筛选范围': { zh: '筛选范围', en: 'Filter scope' },
    '统计时间': { zh: '统计时间', en: 'Time range' },
    'Language': { zh: '选择语言', en: 'Language' },
    'Profile': { zh: '个人资料', en: 'Profile' },
    'Version update': { zh: '版本更新', en: 'Version update' },
    'Log out': { zh: '退出登录', en: 'Log out' },
    '账号菜单': { zh: '账号菜单', en: 'Account menu' },
    '切换项目': { zh: '切换项目', en: 'Switch project' }
  };

  function t(key) {
    var row = I18N[key];
    if (!row) return key;
    return row[state.lang] || row.zh || key;
  }

  function daysLabel(n) {
    return state.lang === 'en' ? n + 'd' : n + ' ' + t('天');
  }

  function updatedLabel() {
    return window.AIOpsBoards.dateBounds().end + ' 00:00 ' + t('更新后缀');
  }

  var NAV_PRIMARY = [
    { id: '工作台', icon: 'house' },
    { id: '定时任务', icon: 'clock' },
    { id: '线上会话', icon: 'messages-square' },
    { id: '产出物', icon: 'file-text' }
  ];

  var NAV_MONITOR = [
    { id: '成本分析', icon: 'report-money', iconSet: 'tabler' },
    { id: '健康度分析', icon: 'heartbeat', iconSet: 'tabler' },
    { id: '用户行为分析', icon: 'users-round' },
    { id: '本体知识运营', icon: 'database' },
    { id: '自定义看板', icon: 'layout-grid' }
  ];

  var NAV_EVALUATION = [
    { id: '评测实验', icon: 'flask-conical' },
    { id: '评测集', icon: 'folders' },
    { id: '业务任务', icon: 'clipboard-check' },
    { id: '统一评估器', icon: 'sliders-horizontal' },
    { id: '评测任务', icon: 'list-checks' },
    { id: '离线评估器', icon: 'sliders-horizontal' },
    { id: '在线评估器', icon: 'scan-line' }
  ];

  var WS_CHILDREN = [
    { id: '制造业规则被否决原因', kind: 'session' },
    { id: '10 月 9 日成本峰值排查', kind: 'session' },
    { id: '高频重复提问与用户反馈', kind: 'session' },
    { id: '两会话问题复盘', kind: 'session' },
    { id: '成本与业务指标日报', taskId: 'task-cost', kind: 'schedule' },
    { id: '核验项与规则变更抽取', taskId: 'task-extract', kind: 'schedule' }
  ];
  var WS_DEFAULT = [];

  /* Tabler outline paths — stroke 1.5 to match Lucide nav chrome */
  var TABLER_ICONS = {
    'report-money':
      '<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/>' +
      '<path d="M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2"/>' +
      '<path d="M14 11h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5"/>' +
      '<path d="M12 17v1m0 -8v1"/>',
    heartbeat:
      '<path d="M19.5 13.572l-7.5 7.428l-2.896 -2.868m-6.117 -8.104a5 5 0 0 1 9.013 -3.022a5 5 0 1 1 7.5 6.572"/>' +
      '<path d="M3 13h2l2 3l2 -6l1 3h3"/>',
    'layout-grid-add':
      '<path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/>' +
      '<path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/>' +
      '<path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/>' +
      '<path d="M14 17h6m-3 -3v6"/>'
  };

  function lucideIcon(name) {
    return '<i data-lucide="' + name + '"></i>';
  }

  function tablerIcon(name) {
    var body = TABLER_ICONS[name];
    if (!body) return lucideIcon(name);
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon" data-tabler="' +
      name +
      '" aria-hidden="true">' +
      body +
      '</svg>'
    );
  }

  function navIcon(item) {
    if (!item || !item.icon) return lucideIcon('layout-grid');
    if (item.iconSet === 'tabler') return tablerIcon(item.icon);
    return lucideIcon(item.icon);
  }

  function paintIcons() {
    if (typeof lucide === 'undefined' || !lucide.createIcons) return;
    lucide.createIcons({
      attrs: {
        width: 16,
        height: 16,
        'stroke-width': 1.5,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }
    });
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function navigationPage() {
    return state.page === '定时任务' && state.workspaceSchedulePage && window.AIOpsCapability && window.AIOpsCapability.isConversation()
      ? state.workspaceSchedulePage : state.page;
  }
  function navItem(item) {
    var page = navigationPage();
    var active = page === item.id || (item.id === '产出物' && page === '产出物详情');
    return (
      '<button class="aiops-nav-item' + (active ? ' is-active' : '') + '" type="button" data-page="' + esc(item.id) + '"' +
        (active ? ' aria-current="page"' : '') + '>' +
        '<span class="ico" aria-hidden="true">' + navIcon(item) + '</span>' +
        '<span class="aiops-nav-label">' + esc(t(item.id)) + '</span>' +
        (item.note ? '<span class="aiops-nav-note">' + esc(t(item.note)) + '</span>' : '') +
      '</button>'
    );
  }

  function allWsChildren() {
    return window.AIOpsWorkspaces.children();
  }

  function isWsChild(id) {
    return allWsChildren().some(function (c) {
      return c.id === id;
    });
  }

  function syncSessionActionWidth(root) {
    var table = root.querySelector('.page.is-sessions .table-body > .data-table');
    var cell = table && table.querySelector('td.session-actions');
    if (!cell) return;
    var group = cell.querySelector('.session-actions-group'), style = getComputedStyle(cell);
    var width = Math.ceil(group.getBoundingClientRect().width + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight));
    table.querySelector('col:last-child').style.width = width + 'px';
  }
  function renderNav() {
    var nav = document.getElementById('aiopsNav');
    if (!nav) return;

    nav.innerHTML =
      '<div class="aiops-nav-group">' +
        NAV_PRIMARY.map(navItem).join('') +
      '</div>' +
      '<div class="aiops-nav-group">' +
        '<div class="aiops-side-label">' + esc(t('监测')) + '</div>' +
        NAV_MONITOR.map(navItem).join('') +
      '</div>' +
      '<div class="aiops-nav-group">' +
        '<div class="aiops-side-label">' + esc(t('评测')) + '</div>' +
        NAV_EVALUATION.map(navItem).join('') +
      '</div>' +
      '<div class="aiops-nav-group is-last">' +
        '<div class="aiops-side-label has-action">' +
          '<span>' + esc(t('工作区')) + '</span>' +
          '<button type="button" class="aiops-label-plus" data-wsn="create" aria-label="' + esc(t('创建工作区')) + '" title="' + esc(t('创建工作区')) + '">' +
            lucideIcon('plus') +
          '</button>' +
        '</div>' +
        window.AIOpsWorkspaces.markup() +
      '</div>';

    var notify = document.getElementById('navNotify');
    if (notify) notify.classList.toggle('is-active', state.page === '消息通知');

    var newMenu = document.getElementById('newMenu');
    var btnNew = document.getElementById('btnNew');
    if (newMenu) newMenu.hidden = !state.newOpen;
    if (btnNew) {
      btnNew.setAttribute('aria-expanded', state.newOpen ? 'true' : 'false');
      btnNew.classList.toggle('is-open', state.newOpen);
    }
  }

  function rangeSegment() {
    return sessionDateControl('monitoring');
  }

  function rangeActions(updated) {
    updated = updated || updatedLabel();
    return (
      '<div class="res-toolbar-actions">' +
        '<span class="res-count">' + esc(updated) + '</span>' +
        '<span class="res-toolbar-sep" aria-hidden="true"></span>' +
        rangeSegment() +
        scopeButton() +
      '</div>'
    );
  }

  function scopeButton() { return window.AIOpsResources.scopeTrigger(isAnalysisPage(state.page)); }

  function isAnalysisPage(page) {
    return page === '成本分析' || page === '健康度分析' || page === '用户行为分析';
  }

  function heading(title, sub) {
    return (
      '<div class="page-heading">' +
        '<h1>' + esc(title) + '</h1>' +
        (sub ? '<p>' + esc(sub) + '</p>' : '') +
      '</div>'
    );
  }

  /* Title left; update time + range filters flush right of the heading row */
  function headingWithRange(title, updated, sub) {
    var titleHtml = sub
      ? '<div class="page-heading-main"><h1>' + esc(title) + '</h1><p>' + esc(sub) + '</p></div>'
      : '<h1>' + esc(title) + '</h1>';
    return (
      '<div class="page-heading has-actions">' +
        titleHtml +
        rangeActions(updated) +
      '</div>'
    );
  }

  function metricCards(items) {
    return (
      '<div class="ov-metrics ov-metrics-' + Math.min(items.length, 6) + '">' +
        items
          .map(function (m) {
            return (
              '<div class="ov-card">' +
                '<div class="ov-card-label">' +
                  esc(m.name) +
                  '<span class="ov-info" title="' + esc(m.help || '') + '" aria-hidden="true">' + lucideIcon('info') + '</span>' +
                '</div>' +
                '<strong class="ov-value">' + esc(m.value) + '</strong>' +
                (m.unit ? '<span class="ov-unit">' + esc(m.unit) + '</span>' : '') +
                (m.change
                  ? '<span class="ov-change ' + (m.dir || 'is-neutral') + '">' + esc(m.change) + '</span>'
                  : '') +
              '</div>'
            );
          })
          .join('') +
      '</div>'
    );
  }

  function chartPlaceholder(title, note) {
    return (
      '<div class="ov-chart">' +
        '<div class="ov-chart-head"><div class="ov-chart-title">' + esc(title) + '</div></div>' +
        '<div class="chart-placeholder" aria-hidden="true">' +
          '<svg viewBox="0 0 640 160" preserveAspectRatio="none">' +
            '<line x1="40" y1="20" x2="40" y2="130" stroke="#f0f0f0"/>' +
            '<line x1="40" y1="130" x2="620" y2="130" stroke="#f0f0f0"/>' +
            '<polyline fill="none" stroke="#0d99ff" stroke-width="2" points="40,110 120,90 200,95 280,60 360,70 440,45 520,55 600,35"/>' +
            '<polyline fill="none" stroke="#f59e0b" stroke-width="2" points="40,120 120,115 200,100 280,105 360,88 440,92 520,78 600,70"/>' +
          '</svg>' +
        '</div>' +
        (note ? '<p class="chart-note">' + esc(note) + '</p>' : '') +
      '</div>'
    );
  }

  function panel(title, body) {
    return (
      '<section class="panel">' +
        '<div class="panel-head"><h2>' + esc(title) + '</h2></div>' +
        body +
      '</section>'
    );
  }

  function scaffoldNote() {
    return '<p class="ov-note">' + esc(t('骨架说明')) + '</p>';
  }

  function applyStaticLang() {
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
    var menu = document.getElementById('acctMenu');
    if (menu) {
      menu.querySelectorAll('.lang-seg button').forEach(function (b) {
        b.classList.toggle('is-on', b.getAttribute('data-lang') === state.lang);
      });
    }
    try {
      localStorage.setItem('aiops-lang', state.lang);
    } catch (e) {}
  }

  function setLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'zh';
    applyStaticLang();
    render();
  }

  /* ─── Homepage widgets (gallery + multi-instance) ─── */

  var METRIC_MOCK = {
    total: ['95.4M', '+5.1%'],
    input: ['64.2M', '+4.8%'],
    output: ['31.2M', '+5.6%'],
    calls: ['128.4k', '+3.2%'],
    perTurn: ['2.4k', '−1.1%'],
    perSession: ['18.6k', '+2.0%'],
    anomalousRate: ['2.4%', '−0.3%', 'good'],
    toolFailureRate: ['1.1%', '+0.2%'],
    turnErrorRate: ['0.8%', '0%'],
    warningEvents: ['47', '+8'],
    affectedUsers: ['19', '+3'],
    sessionAvgMs: ['12.4s', '−0.6s', 'good'],
    slowRate: ['4.2%', '−0.4%', 'good'],
    toolAvgMs: ['1.8s', '+0.1s'],
    ttft: ['620ms', '−40ms', 'good'],
    sessions: ['328', '+4.2%'],
    users: ['186', '+2.8%'],
    sessionsPerUser: ['1.76', '+0.04'],
    avgTurns: ['6.2', '−0.1', 'good'],
    feedback: ['👍 86 / 👎 12', '']
  };

  var WIDGET_TYPES = [
    {
      id: 'cost',
      group: 'dashboard',
      title: '成本分析',
      icon: 'report-money',
      iconSet: 'tabler',
      page: '成本分析',
      span: 4,
      rows: 4,
      configurable: true,
      defaults: ['total', 'input', 'output', 'trendUsage'],
      metrics: [
        { id: 'total', label: '总 Token', kind: 'stat' },
        { id: 'input', label: '输入 Token', kind: 'stat' },
        { id: 'output', label: '输出 Token', kind: 'stat' },
        { id: 'calls', label: '模型调用次数', kind: 'stat' },
        { id: 'perTurn', label: '平均每轮 Token 消耗', kind: 'stat' },
        { id: 'perSession', label: '平均每会话 Token 消耗', kind: 'stat' },
        { id: 'trendUsage', label: 'Token 用量趋势', kind: 'chart' },
        { id: 'trendAvg', label: '平均 Token 消耗趋势', kind: 'chart' }
      ]
    },
    {
      id: 'health',
      group: 'dashboard',
      title: '健康度分析',
      icon: 'heartbeat',
      iconSet: 'tabler',
      page: '健康度分析',
      span: 4,
      rows: 4,
      configurable: true,
      defaults: ['anomalousRate', 'slowRate', 'warningEvents', 'slowTrend'],
      metrics: [
        { id: 'anomalousRate', label: '异常会话率', kind: 'stat', section: '报错分析' },
        { id: 'toolFailureRate', label: '工具调用失败率', kind: 'stat', section: '报错分析' },
        { id: 'turnErrorRate', label: '轮次错误率', kind: 'stat', section: '报错分析' },
        { id: 'warningEvents', label: '警告事件数', kind: 'stat', section: '报错分析' },
        { id: 'affectedUsers', label: '警告影响用户数', kind: 'stat', section: '报错分析' },
        { id: 'warningDist', label: '警告分布', kind: 'chart', section: '报错分析' },
        { id: 'liveAlerts', label: '实时警告', kind: 'list', section: '报错分析' },
        { id: 'sessionAvgMs', label: '会话平均耗时', kind: 'stat', section: '性能分析' },
        { id: 'slowRate', label: '慢响应轮次率', kind: 'stat', section: '性能分析' },
        { id: 'toolAvgMs', label: '工具平均耗时', kind: 'stat', section: '性能分析' },
        { id: 'ttft', label: '首 token 延迟（TTFT）', kind: 'stat', section: '性能分析' },
        { id: 'slowTrend', label: '慢响应轮次趋势', kind: 'chart', section: '性能分析' },
        { id: 'durationDist', label: '耗时分布', kind: 'chart', section: '性能分析' }
      ]
    },
    {
      id: 'behavior',
      group: 'dashboard',
      title: '用户行为分析',
      icon: 'users-round',
      page: '用户行为分析',
      span: 4,
      rows: 4,
      configurable: true,
      defaults: ['sessions', 'users', 'sessionsPerUser', 'trendSessions'],
      metrics: [
        { id: 'sessions', label: '活跃会话数', kind: 'stat' },
        { id: 'users', label: '活跃用户数', kind: 'stat' },
        { id: 'sessionsPerUser', label: '人均会话数', kind: 'stat' },
        { id: 'avgTurns', label: '平均会话轮次', kind: 'stat' },
        { id: 'feedback', label: '点赞点踩次数', kind: 'stat' },
        { id: 'trendSessions', label: '活跃会话趋势', kind: 'chart' },
        { id: 'trendUsers', label: '活跃用户趋势', kind: 'chart' },
        { id: 'trendFeedback', label: '点赞点踩趋势', kind: 'chart' }
      ]
    },
    {
      id: 'custom',
      group: 'dashboard',
      title: '自定义看板',
      icon: 'layout-grid',
      span: 2,
      rows: 4,
      disabled: true,
      configurable: false,
      defaults: [],
      metrics: []
    },
    {
      id: 'schedules',
      group: 'schedule',
      title: '定时任务',
      icon: 'clock',
      page: '定时任务',
      span: 2,
      rows: 4,
      configurable: false,
      defaults: [],
      metrics: []
    },
    {
      id: 'artifacts',
      group: 'artifact',
      title: '产出物',
      icon: 'file-text',
      page: '产出物',
      span: 2,
      rows: 4,
      configurable: false,
      defaults: [],
      metrics: []
    }
  ];

  var widgetSeq = 0;

  function widgetType(id) {
    for (var i = 0; i < WIDGET_TYPES.length; i++) {
      if (WIDGET_TYPES[i].id === id) return WIDGET_TYPES[i];
    }
    return null;
  }

  function defaultHomeWidgets() {
    // 6-col grid. Row 1–4: 成本分析 + 产出物. Row 5–8: 用户行为 + 健康度 + 定时任务.
    return [
      makeWidget('cost', ['total', 'input', 'output', 'calls', 'trendUsage'], 4, 4, 1, 1),
      makeWidget('schedules', null, 2, 4, 5, 5),
      makeWidget('artifacts', null, 2, 4, 5, 1),
      makeWidget('behavior', ['sessions', 'users', 'trendSessions'], 2, 4, 1, 5),
      makeWidget('health', ['anomalousRate', 'warningEvents', 'slowTrend'], 2, 4, 3, 5)
    ];
  }

  function ensureHomeWidgets() {
    if (!state.homeWidgets) state.homeWidgets = defaultHomeWidgets();
    ensureWidgetCoords(state.homeWidgets, WIDGET_GRID_COLS);
    return state.homeWidgets;
  }

  function makeWidget(typeId, metrics, span, rows, col, row) {
    var type = widgetType(typeId);
    widgetSeq += 1;
    return {
      id: 'w' + widgetSeq + '-' + Date.now().toString(36),
      type: typeId,
      span: span || (type && type.span) || 1,
      rows: rows || (type && type.rows) || 4,
      col: col > 0 ? col : 0,
      row: row > 0 ? row : 0,
      metrics: metrics
        ? metrics.slice()
        : type && type.defaults
          ? type.defaults.slice()
          : []
    };
  }

  var WIDGET_GRID_COLS = 6;
  var WIDGET_GRID_ROWS = 6;

  function widgetSpan(inst, type) {
    var s = inst && inst.span != null ? Number(inst.span) : type && type.span;
    s = Math.round(s || 1);
    if (s < 1) s = 1;
    if (s > WIDGET_GRID_COLS) s = WIDGET_GRID_COLS;
    return s;
  }

  function widgetRows(inst, type) {
    var r = inst && inst.rows != null ? Number(inst.rows) : type && type.rows;
    r = Math.round(r || 4);
    if (r < 1) r = 1;
    if (r > WIDGET_GRID_ROWS) r = WIDGET_GRID_ROWS;
    return r;
  }

  function rectsOverlap(a, b) {
    return (
      a.col < b.col + b.span &&
      a.col + a.span > b.col &&
      a.row < b.row + b.rows &&
      a.row + a.rows > b.row
    );
  }

  function normalizeWidgetLayout(w, type, cols) {
    type = type || widgetType(w.type);
    cols = cols || WIDGET_GRID_COLS;
    w.span = widgetSpan(w, type);
    w.rows = widgetRows(w, type);
    if (w.span > cols) w.span = cols;
    w.col = Math.round(Number(w.col) || 0);
    w.row = Math.round(Number(w.row) || 0);
    if (w.col < 1) w.col = 1;
    if (w.row < 1) w.row = 1;
    if (w.col + w.span - 1 > cols) w.col = Math.max(1, cols - w.span + 1);
    return w;
  }

  function cloneLayoutItem(w) {
    return {
      id: w.id,
      type: w.type,
      col: w.col,
      row: w.row,
      span: w.span,
      rows: w.rows
    };
  }

  function cloneLayout(list) {
    return (list || []).map(cloneLayoutItem);
  }

  function findOpenSpot(occupied, span, rows, cols) {
    cols = cols || WIDGET_GRID_COLS;
    span = Math.min(span || 1, cols);
    rows = rows || 4;
    for (var row = 1; row < 400; row++) {
      for (var col = 1; col <= cols - span + 1; col++) {
        var cand = { col: col, row: row, span: span, rows: rows };
        var hit = false;
        for (var i = 0; i < occupied.length; i++) {
          if (rectsOverlap(cand, occupied[i])) {
            hit = true;
            break;
          }
        }
        if (!hit) return { col: col, row: row };
      }
    }
    return { col: 1, row: 1 };
  }

  /**
   * Expand: try push right; if it won't fit, insert a band just below the primary
   * (preserving overflow items' relative layout) and shift everything that was
   * at/below that line further down. Shrink never pulls anyone back.
   */
  function resolveCollisions(list, primaryId, cols) {
    cols = cols || WIDGET_GRID_COLS;
    var primary = null;
    list.forEach(function (w) {
      if (w.id === primaryId) primary = w;
    });
    if (!primary) return;
    normalizeWidgetLayout(primary, widgetType(primary.type), cols);

    var displaced = [];
    list.forEach(function (w) {
      if (w.id === primaryId) return;
      if (rectsOverlap(primary, w)) displaced.push(w);
    });

    var stuck = [];
    displaced.forEach(function (w) {
      var rightCol = primary.col + primary.span;
      var verticalOverlap =
        primary.row < w.row + w.rows && primary.row + primary.rows > w.row;
      if (verticalOverlap && rightCol + w.span - 1 <= cols) {
        var prevCol = w.col;
        w.col = rightCol;
        if (!rectsOverlap(primary, w)) return;
        w.col = prevCol;
      }
      stuck.push(w);
    });

    if (stuck.length) {
      var insertRow = primary.row + primary.rows;
      var minRow = stuck[0].row;
      stuck.forEach(function (w) {
        if (w.row < minRow) minRow = w.row;
      });
      var bandBottom = insertRow;
      var stuckIds = {};
      stuck.forEach(function (w) {
        stuckIds[w.id] = true;
        w.row = insertRow + (w.row - minRow);
        if (w.col + w.span - 1 > cols) {
          w.col = Math.max(1, cols - w.span + 1);
        }
        var bottom = w.row + w.rows;
        if (bottom > bandBottom) bandBottom = bottom;
      });
      var bandHeight = bandBottom - insertRow;
      list.forEach(function (w) {
        if (w.id === primaryId || stuckIds[w.id]) return;
        if (w.row >= insertRow) {
          w.row += bandHeight;
        } else if (w.row + w.rows > insertRow) {
          w.row = bandBottom;
        }
      });
    }

    // Remaining overlaps: keep earlier (higher) items, push later ones down only.
    var guard = 0;
    while (guard++ < 40) {
      var moved = false;
      var sorted = list.slice().sort(function (a, b) {
        if (a.id === primaryId) return -1;
        if (b.id === primaryId) return 1;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      for (var i = 0; i < sorted.length; i++) {
        for (var j = i + 1; j < sorted.length; j++) {
          var a = sorted[i];
          var b = sorted[j];
          if (b.id === primaryId || !rectsOverlap(a, b)) continue;
          b.row = a.row + a.rows;
          if (b.col + b.span - 1 > cols) {
            b.col = Math.max(1, cols - b.span + 1);
          }
          moved = true;
        }
      }
      if (!moved) break;
    }

    list.forEach(function (w) {
      normalizeWidgetLayout(w, widgetType(w.type), cols);
    });
  }

  function ensureWidgetCoords(list, cols) {
    cols = cols || WIDGET_GRID_COLS;
    var occupied = [];
    list.forEach(function (w) {
      var type = widgetType(w.type);
      w.span = widgetSpan(w, type);
      w.rows = widgetRows(w, type);
      if (w.span > cols) w.span = cols;
      if (Number(w.col) > 0 && Number(w.row) > 0) {
        normalizeWidgetLayout(w, type, cols);
        occupied.push(w);
        return;
      }
      var spot = findOpenSpot(occupied, w.span, w.rows, cols);
      w.col = spot.col;
      w.row = spot.row;
      occupied.push(w);
    });
    return list;
  }

  function applyPlacement(el, col, row, span, rows) {
    if (!el) return;
    var colS = String(col);
    var rowS = String(row);
    var spanS = String(span);
    var rowsS = String(rows);
    if (
      el.getAttribute('data-col') === colS &&
      el.getAttribute('data-row') === rowS &&
      el.getAttribute('data-span') === spanS &&
      el.getAttribute('data-rows') === rowsS
    ) {
      return;
    }
    el.style.gridColumn = col + ' / span ' + span;
    el.style.gridRow = row + ' / span ' + rows;
    el.setAttribute('data-col', String(col));
    el.setAttribute('data-row', String(row));
    el.setAttribute('data-span', String(span));
    el.setAttribute('data-rows', String(rows));
    el.classList.remove(
      'is-span-1',
      'is-span-2',
      'is-span-3',
      'is-span-4',
      'is-span-5',
      'is-span-6',
      'is-row-1',
      'is-row-2',
      'is-row-3',
      'is-row-4',
      'is-row-5',
      'is-row-6'
    );
    el.classList.add('is-span-' + span, 'is-row-' + rows);
  }

  function paintLayout(list, placeholderId, placeholderEl) {
    (list || []).forEach(function (w) {
      if (placeholderId && w.id === placeholderId && placeholderEl) {
        applyPlacement(placeholderEl, w.col, w.row, w.span, w.rows);
        return;
      }
      var el = document.querySelector(
        '#homeWidgetGrid .widget[data-widget-id="' + w.id + '"]'
      );
      if (el) applyPlacement(el, w.col, w.row, w.span, w.rows);
    });
  }

  function commitLayout(list) {
    var map = {};
    list.forEach(function (s) {
      map[s.id] = s;
    });
    ensureHomeWidgets().forEach(function (w) {
      var s = map[w.id];
      if (!s) return;
      w.col = s.col;
      w.row = s.row;
      w.span = s.span;
      w.rows = s.rows;
    });
  }

  /* Sidebar and the workbench header are not drop targets. */
  function pointerInDragDeadZone(clientX, clientY) {
    var side = document.querySelector('.aiops-side');
    var grid = document.getElementById('homeWidgetGrid');
    var sideRect = side ? side.getBoundingClientRect() : null;
    var gridRect = grid ? grid.getBoundingClientRect() : null;
    if (
      sideRect &&
      clientX >= sideRect.left &&
      clientX <= sideRect.right &&
      clientY >= sideRect.top &&
      clientY <= sideRect.bottom
    ) {
      return true;
    }
    if (gridRect && clientY < gridRect.top && (!sideRect || clientX > sideRect.right)) {
      return true;
    }
    var hit = document.elementFromPoint(clientX, clientY);
    return !!(hit && hit.closest && (hit.closest('.aiops-side') || hit.closest('.home-top')));
  }

  function rejectDragPreview() {
    var drag = state.drag;
    if (!drag || !drag.placeholder) return;
    drag.dropRejected = true;
    if (drag.kind === 'reorder' && drag.startLayout) {
      var origin = null;
      drag.startLayout.forEach(function (w) {
        if (w.id === drag.widgetId) origin = w;
      });
      if (origin) {
        applyPlacement(drag.placeholder, origin.col, origin.row, origin.span, origin.rows);
      }
      drag.placeholder.style.visibility = '';
      paintLayout(drag.startLayout, drag.widgetId, drag.placeholder);
      return;
    }
    if (drag.kind === 'gallery' && drag.startLayout) {
      drag.placeholder.style.visibility = 'hidden';
      paintLayout(drag.startLayout);
      return;
    }
    drag.placeholder.style.visibility = 'hidden';
  }

  function previewInsertLayout(startLayout, widgetId, typeId, col, row, span, rows, cols) {
    var live = cloneLayout(startLayout);
    var item = {
      id: widgetId,
      type: typeId,
      col: col,
      row: row,
      span: span,
      rows: rows
    };
    live.push(item);
    normalizeWidgetLayout(item, widgetType(typeId), cols);
    resolveCollisions(live, widgetId, cols);
    return live;
  }

  function updateActiveDragTarget(clientX, clientY) {
    var drag = state.drag;
    if (!drag || !drag.placeholder) return;
    if (drag.kind !== 'reorder' && drag.kind !== 'gallery') return;
    if (pointerInDragDeadZone(clientX, clientY)) {
      if (!drag.dropRejected) rejectDragPreview();
      return;
    }
    drag.dropRejected = false;
    if (drag.placeholder.style.visibility === 'hidden') {
      drag.placeholder.style.visibility = '';
    }
    var cell = pointToGridCell(clientX, clientY, drag.span, drag.rows);
    drag.dropCol = cell.col;
    drag.dropRow = cell.row;
    if (drag.kind === 'reorder') {
      var liveR = previewMoveLayout(
        drag.startLayout,
        drag.widgetId,
        cell.col,
        cell.row,
        drag.span,
        drag.rows,
        cell.cols
      );
      drag.liveLayout = liveR;
      paintLayout(liveR, drag.widgetId, drag.placeholder);
      return;
    }
    var liveG = previewInsertLayout(
      drag.startLayout,
      drag.placeholderId,
      drag.typeId,
      cell.col,
      cell.row,
      drag.span,
      drag.rows,
      cell.cols
    );
    drag.liveLayout = liveG;
    paintLayout(liveG, drag.placeholderId, drag.placeholder);
  }

  function dragScrollTop() {
    var scroller = document.getElementById('pageRoot');
    return scroller ? scroller.scrollTop : 0;
  }

  function dragScrollEdge(clientX, clientY) {
    if (pointerInDragDeadZone(clientX, clientY)) return 0;
    var scroller = document.getElementById('pageRoot');
    if (!scroller) return 0;
    var rect = scroller.getBoundingClientRect();
    var edge = 72;
    if (clientY > rect.bottom - edge) return 1;
    if (clientY < rect.top + edge) return -1;
    return 0;
  }

  function stepDragScroll() {
    var drag = state.drag;
    var scroller = document.getElementById('pageRoot');
    if (!drag || !scroller) return 0;
    var dir = dragScrollEdge(drag.pointerX, drag.pointerY);
    if (!dir) return 0;
    var rect = scroller.getBoundingClientRect();
    var edge = 72;
    var dist = dir > 0 ? drag.pointerY - (rect.bottom - edge) : rect.top + edge - drag.pointerY;
    var speed = Math.max(8, Math.min(28, Math.round(8 + (dist / edge) * 20)));
    var prev = scroller.scrollTop;
    var max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    var next = Math.max(0, Math.min(max, prev + dir * speed));
    if (next === prev) return 0;
    scroller.scrollTop = next;
    return next - prev;
  }

  function kickDragScroll() {
    var drag = state.drag;
    if (!drag || drag.scrollRaf) return;
    if (!dragScrollEdge(drag.pointerX, drag.pointerY)) return;
    function tick() {
      if (!state.drag || !state.drag.active) {
        if (state.drag) state.drag.scrollRaf = 0;
        return;
      }
      var moved = stepDragScroll();
      if (moved) updateActiveDragTarget(state.drag.pointerX, state.drag.pointerY);
      if (state.drag && state.drag.active && dragScrollEdge(state.drag.pointerX, state.drag.pointerY)) {
        state.drag.scrollRaf = requestAnimationFrame(tick);
      } else if (state.drag) {
        state.drag.scrollRaf = 0;
      }
    }
    drag.scrollRaf = requestAnimationFrame(tick);
  }

  function activeGridMetrics() {
    var live = gridColMetrics();
    var frozen = state.drag && state.drag.gridMetrics;
    if (!frozen) return live;
    return {
      col: frozen.col,
      row: frozen.row,
      gap: frozen.gap,
      cols: frozen.cols,
      rows: frozen.rows,
      grid: live.grid || frozen.grid
    };
  }

  /* Card top-left follows the grab point, then snaps to the nearest cell. */
  function dragAnchorOffset() {
    var drag = state.drag;
    return {
      x: drag && drag.anchorX != null ? drag.anchorX : 24,
      y: drag && drag.anchorY != null ? drag.anchorY : 18
    };
  }

  function placeDragGhost(clientX, clientY) {
    if (!dragGhost) return;
    var anchor = dragAnchorOffset();
    dragGhost.style.left = '0';
    dragGhost.style.top = '0';
    dragGhost.style.transform =
      'translate3d(' +
      (clientX - anchor.x) +
      'px,' +
      (clientY - anchor.y) +
      'px,0) rotate(1.5deg) scale(1.02)';
  }

  function pointToGridCell(clientX, clientY, span, rows) {
    var metrics = activeGridMetrics();
    var grid = metrics.grid;
    var cols = metrics.cols || WIDGET_GRID_COLS;
    span = Math.min(span || 1, cols);
    rows = rows || 4;
    if (!grid) return { col: 1, row: 1, cols: cols };
    var rect = grid.getBoundingClientRect();
    var unitX = metrics.col + metrics.gap;
    var unitY = metrics.row + metrics.gap;
    if (unitX < 1) unitX = 1;
    if (unitY < 1) unitY = 1;
    var anchor = dragAnchorOffset();
    var rawCol = (clientX - anchor.x - rect.left) / unitX;
    var rawRow = (clientY - anchor.y - rect.top) / unitY;
    var col = Math.floor(rawCol + 0.5) + 1;
    var row = Math.floor(rawRow + 0.5) + 1;
    if (col < 1) col = 1;
    if (row < 1) row = 1;
    if (col + span - 1 > cols) col = Math.max(1, cols - span + 1);
    return { col: col, row: row, cols: cols };
  }

  function scheduleChartSync() {
    if (state._chartSyncTimer) clearTimeout(state._chartSyncTimer);
    state._chartSyncTimer = setTimeout(function () {
      state._chartSyncTimer = null;
      if (window.AIOpsBoards) window.AIOpsBoards.syncCharts();
    }, 48);
  }

  function persistHomeWidgets() {
    try {
      localStorage.setItem('aiops-home-widgets', JSON.stringify(state.homeWidgets || []));
      localStorage.setItem('aiops-widget-grid-cols', String(WIDGET_GRID_COLS));
      localStorage.setItem('aiops-widget-grid-layout', 'coords-v1');
    } catch (e) {}
  }

  function loadHomeWidgets() {
    try {
      var raw = localStorage.getItem('aiops-home-widgets');
      if (!raw) return null;
      var list = JSON.parse(raw);
      if (!Array.isArray(list) || !list.length) return null;
      // Legacy 3-col spans (1–3) → 6-col (×2) so widths stay the same.
      var gridVer = localStorage.getItem('aiops-widget-grid-cols');
      var migrateFrom3 = gridVer !== String(WIDGET_GRID_COLS);
      var mapped = list
        .filter(function (w) {
          return w && w.type && widgetType(w.type) && !widgetType(w.type).disabled;
        })
        .map(function (w) {
          widgetSeq += 1;
          var type = widgetType(w.type);
          var rawSpan = w.span != null ? Number(w.span) : type && type.span;
          if (migrateFrom3 && rawSpan >= 1 && rawSpan <= 3) rawSpan = rawSpan * 2;
          return {
            id: w.id || 'w' + widgetSeq,
            type: w.type,
            span: widgetSpan({ span: rawSpan }, type),
            rows: widgetRows(w, type),
            col: Number(w.col) > 0 ? Math.round(Number(w.col)) : 0,
            row: Number(w.row) > 0 ? Math.round(Number(w.row)) : 0,
            metrics: Array.isArray(w.metrics) ? w.metrics.slice() : []
          };
        });
      ensureWidgetCoords(mapped, WIDGET_GRID_COLS);
      if (migrateFrom3 && mapped.length) {
        try {
          localStorage.setItem('aiops-widget-grid-cols', String(WIDGET_GRID_COLS));
          localStorage.setItem('aiops-home-widgets', JSON.stringify(mapped));
          localStorage.setItem('aiops-widget-grid-layout', 'coords-v1');
        } catch (err) {}
      }
      return mapped;
    } catch (e) {
      return null;
    }
  }

  // Map home widget chart metrics → same analysis-boards hosts as 监测 dashboards.
  var WIDGET_CHART_KIND = {
    trendUsage: 'cost-total',
    trendAvg: 'cost-average',
    slowTrend: 'health-slow',
    trendSessions: 'behavior-sessions',
    trendUsers: 'behavior-users',
    trendFeedback: 'behavior-feedback'
  };

  function widgetTrendLegend(chartKind) {
    var items = null;
    if (chartKind === 'cost-total') {
      items = [
        { name: t('总 Token'), color: '#4d8eff' },
        { name: t('输入 Token'), color: '#18b99b' },
        { name: t('输出 Token'), color: '#f0a142' }
      ];
    } else if (chartKind === 'cost-average') {
      items = [
        { name: t('平均每轮 Token 消耗'), color: '#e5799d' },
        { name: t('平均每会话 Token 消耗'), color: '#f29b38' }
      ];
    } else if (chartKind === 'behavior-feedback') {
      items = [
        { name: t('点赞'), color: '#4d8eff' },
        { name: t('点踩'), color: '#f0a142' }
      ];
    } else if (chartKind === 'health-slow') {
      items = [{ name: t('慢响应轮次率'), color: '#f0a142' }];
    }
    if (!items) return '';
    return (
      '<div class="widget-trend-legend">' +
        items
          .map(function (item) {
            return (
              '<span><i style="background:' +
              item.color +
              '"></i>' +
              esc(item.name) +
              '</span>'
            );
          })
          .join('') +
      '</div>'
    );
  }

  function trendPanelHtml(title, chartKind, extraClass, helpHtml) {
    return (
      '<div class="widget-trend analysis-line-panel' +
      (extraClass ? ' ' + extraClass : '') +
      '" data-line-chart="' +
      esc(chartKind) +
      '">' +
        '<div class="widget-trend-head">' +
          '<div class="widget-trend-label"><span class="widget-trend-label-text" title="' + esc(title) + '">' +
          esc(title) + '</span>' +
          (helpHtml || '') +
          '</div>' +
          widgetTrendLegend(chartKind) +
        '</div>' +
        '<div class="widget-spark analysis-chart-host" data-analysis-chart="' +
        esc(chartKind) +
        '"></div>' +
        '<div class="analysis-line-tooltip widget-trend-tooltip" hidden></div>' +
      '</div>'
    );
  }

  function metricCompareLabel() {
    if (state.range === 1) return t('日环比');
    return state.lang === 'en' ? state.range + 'd comparison' : state.range + '天环比';
  }

  function metricStatHtml(metricId) {
    var mock = (window.AIOpsBoards && window.AIOpsBoards.metricSummary(metricId)) || METRIC_MOCK[metricId] || ['—', ''];
    var label = metricId;
    for (var i = 0; i < WIDGET_TYPES.length; i++) {
      for (var j = 0; j < WIDGET_TYPES[i].metrics.length; j++) {
        if (WIDGET_TYPES[i].metrics[j].id === metricId) {
          label = t(WIDGET_TYPES[i].metrics[j].label);
        }
      }
    }
    var deltaRow = mock[1]
      ? '<div class="widget-metric-delta' +
        (mock[2] === 'good' ? ' is-good' : '') +
        '"><em>' +
        esc(mock[1]) +
        '</em><span>' +
        esc(metricCompareLabel()) +
        '</span></div>'
      : '';
    return (
      '<div class="widget-metric">' +
        '<span class="widget-metric-label" title="' + esc(label) + '">' +
        esc(label) +
        '</span><strong>' +
        esc(mock[0]) +
        '</strong>' +
        deltaRow +
      '</div>'
    );
  }

  function widgetRowGo() {
    return (
      '<span class="widget-row-go" aria-hidden="true">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="m9 18 6-6-6-6"/>' +
        '</svg>' +
      '</span>'
    );
  }

  function scheduleRuns() {
    return [
      { id: 'check-1800', page: '核验项与规则变更抽取', time: t('今日时') + ' 18:00', status: '待执行', tone: 'pending', desc: '任务描述2' },
      { id: 'cost-0800', page: '成本与业务指标日报', time: t('今日时') + ' 08:00', status: '成功', tone: 'ok', desc: '任务描述1' },
      { id: 'check-0800', page: '核验项与规则变更抽取', time: t('今日时') + ' 08:00', status: '成功', tone: 'ok', desc: '任务描述2' },
      { id: 'cost-y-0805', page: '成本与业务指标日报', time: t('昨天') + ' 08:05', status: '补跑成功', tone: 'ok', desc: '任务描述1' },
      { id: 'cost-y-0800', page: '成本与业务指标日报', time: t('昨天') + ' 08:00', status: '失败', tone: 'err', desc: '任务描述1' }
    ];
  }

  function artifactItems() {
    return [
      { id: 'cost-perf', kind: 'table', name: t('成本与性能日报'), time: t('今日时') + ' 18:00 ' + t('更新后缀'), type: t('数据表'), desc: t('任务描述1') },
      { id: 'session-md', kind: 'md', name: '会话质量复盘.md', time: t('今日时') + ' 18:00 ' + t('更新后缀'), type: 'Markdown', desc: t('任务描述2') },
      { id: 'summary-json', kind: 'json', name: '分析摘要.json', time: t('昨天') + ' 18:00 ' + t('更新后缀'), type: 'JSON', desc: t('任务描述1') },
      { id: 'check-items', kind: 'table', name: t('核验项明细'), time: '10-20 18:00 ' + t('更新后缀'), type: t('数据表'), desc: t('任务描述2') },
      { id: 'rule-log', kind: 'table', name: '规则变更记录', time: '10-20 18:00 ' + t('更新后缀'), type: t('数据表'), desc: t('任务描述2') }
    ];
  }

  function joinWidgetListItems(items) {
    var sep = '<li class="widget-list-sep" aria-hidden="true"></li>';
    return items.filter(Boolean).join(sep);
  }

  function widgetBodyHtml(inst, type) {
    if (type.id === 'schedules') {
      return (
        '<div class="widget-panel">' +
          '<ul class="widget-list is-mission">' +
            joinWidgetListItems(
              scheduleRuns().map(function (r) {
                return (
                  '<li>' +
                    '<button type="button" class="widget-row" data-page="' + esc(r.page) + '" data-schedule-run="' + esc(r.id) + '">' +
                      '<div class="widget-mission-main">' +
                        '<b>' + esc(t(r.page)) + '</b>' +
                        '<span class="widget-mission-meta">' +
                          '<span class="widget-mission-time">' + esc(r.time) + '</span>' +
                          '<span class="widget-pill is-' + r.tone + '"><span class="dot" aria-hidden="true"></span>' + esc(t(r.status)) + '</span>' +
                        '</span>' +
                      '</div>' +
                      widgetRowGo() +
                    '</button>' +
                  '</li>'
                );
              })
            ) +
          '</ul>' +
        '</div>'
      );
    }
    if (type.id === 'artifacts') {
      return (
        '<div class="widget-panel">' +
          '<ul class="widget-list is-output">' +
            joinWidgetListItems(
              artifactItems().map(function (r) {
                var chip =
                  r.kind === 'md'
                    ? '<span class="widget-file-chip is-md">MD</span>'
                    : r.kind === 'json'
                      ? '<span class="widget-file-chip is-json">' + lucideIcon('code-2') + '</span>'
                      : '<span class="widget-file-chip is-table">' + lucideIcon('table-2') + '</span>';
                return (
                  '<li>' +
                    '<button type="button" class="widget-row" data-artifact="' + esc(r.id) + '">' +
                      '<div class="widget-output-main">' +
                        '<div class="widget-output-title">' + chip + '<b>' + esc(r.name) + '</b></div>' +
                        window.AIOpsCapability.widgetArtifactMeta(r.id) +
                      '</div>' +
                      widgetRowGo() +
                    '</button>' +
                  '</li>'
                );
              })
            ) +
          '</ul>' +
        '</div>'
      );
    }

    var selected = {};
    (inst.metrics || []).forEach(function (id) {
      selected[id] = true;
    });
    var stats = [];
    var charts = [];
    var lists = [];
    type.metrics.forEach(function (m) {
      if (!selected[m.id]) return;
      if (m.kind === 'stat') stats.push(m.id);
      else if (m.kind === 'list') lists.push(m.id);
      else charts.push(m.id);
    });

    if (!stats.length && !charts.length && !lists.length) {
      return '<div class="widget-empty">' + esc(t('空指标提示')) + '</div>';
    }

    var html = '';
    if (stats.length) {
      var cols = Math.min(4, Math.max(2, stats.length));
      html +=
        '<div class="widget-metrics" style="grid-template-columns:repeat(' +
        cols +
        ',minmax(0,1fr))">' +
        stats.map(metricStatHtml).join('') +
        '</div>';
    }
    charts.forEach(function (id) {
      var chartTitle = id;
      for (var i = 0; i < type.metrics.length; i++) {
        if (type.metrics[i].id === id) chartTitle = t(type.metrics[i].label);
      }
      if (id === 'durationDist') html += window.AIOpsBoards.healthDurationWidget();
      else if (id === 'warningDist') html += window.AIOpsBoards.healthWarningWidget();
      else if (WIDGET_CHART_KIND[id]) html += trendPanelHtml(chartTitle, WIDGET_CHART_KIND[id]);
    });
    if (lists.indexOf('liveAlerts') >= 0) html += window.AIOpsBoards.healthAlertsWidget();
    return html;
  }

  function widgetChrome(inst, type, mode) {
    var hoverBtns = '';
    if (mode === 'gallery' && !type.disabled) {
      hoverBtns =
        '<button type="button" class="widget-tool" data-gallery-add="' +
        esc(type.id) +
        '" title="' +
        esc(t('添加')) +
        '" aria-label="' +
        esc(t('添加')) +
        '">' +
        lucideIcon('plus') +
        '</button>';
    } else {
      hoverBtns =
        '<button type="button" class="widget-tool" data-widget-drag="' +
        esc(inst.id) +
        '" title="' +
        esc(t('拖拽')) +
        '" aria-label="' +
        esc(t('拖拽')) +
        '">' +
        lucideIcon('grip-vertical') +
        '</button>' +
        (type.configurable
          ? '<button type="button" class="widget-tool" data-widget-config="' +
            esc(inst.id) +
            '" aria-haspopup="menu" aria-expanded="' + (state.configId === inst.id) + '" aria-controls="widgetConfigMenu" title="' +
            esc(t('配置')) +
            '" aria-label="' +
            esc(t('配置')) +
            '">' +
            lucideIcon('settings') +
            '</button>'
          : '<button type="button" class="widget-tool" data-widget-delete="' +
            esc(inst.id) +
            '" title="' +
            esc(t('删除')) +
            '" aria-label="' +
            esc(t('删除')) +
            '">' +
            lucideIcon('trash-2') +
            '</button>') +
        (type.page
          ? '<button type="button" class="widget-tool" data-page="' +
            esc(type.page) +
            '" title="' +
            esc(t('详情')) +
            '" aria-label="' +
            esc(t('详情')) +
            '">' +
            lucideIcon('arrow-right') +
            '</button>'
          : '');
    }

    var ico = type.iconSet === 'tabler' ? tablerIcon(type.icon) : lucideIcon(type.icon || 'layout-grid');
    var span = widgetSpan(inst, type);
    var rows = widgetRows(inst, type);
    var col = Number(inst.col) > 0 ? Number(inst.col) : 1;
    var row = Number(inst.row) > 0 ? Number(inst.row) : 1;
    var cls =
      'widget is-span-' +
      span +
      ' is-row-' +
      rows +
      (mode === 'gallery' ? ' is-gallery-preview' : '') +
      (state.configId === inst.id ? ' is-configuring' : '');

    var resizeHandle =
      mode === 'canvas'
        ? '<button type="button" class="widget-resize" data-widget-resize="' +
          esc(inst.id) +
          '" aria-label="' +
          esc(t('调整宽度')) +
          '">' +
          '<svg class="widget-resize-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
          '<path d="M2 14h7.5A4.5 4.5 0 0 0 14 9.5V2" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '</button>'
        : '';

    var placeAttr =
      mode === 'canvas'
        ? ' data-col="' +
          col +
          '" data-row="' +
          row +
          '" style="grid-column:' +
          col +
          ' / span ' +
          span +
          ';grid-row:' +
          row +
          ' / span ' +
          rows +
          '"'
        : '';

    return (
      '<section class="' +
      cls +
      '" data-widget-id="' +
      esc(inst.id) +
      '" data-widget-type="' +
      esc(type.id) +
      '" data-span="' +
      span +
      '" data-rows="' +
      rows +
      '"' +
      placeAttr +
      (mode === 'gallery' && !type.disabled ? ' data-gallery-preview="1"' : '') +
      '>' +
      '<header class="widget-head">' +
      '<div class="widget-title">' +
      '<span class="widget-ico" aria-hidden="true">' +
      ico +
      '</span>' +
      '<strong title="' + esc(t(type.title)) + '">' +
      esc(t(type.title)) +
      '</strong>' +
      '</div>' +
      '<div class="widget-actions"><div class="widget-tools">' +
      hoverBtns +
      '</div></div>' +
      '</header>' +
      '<div class="widget-body">' +
      widgetBodyHtml(inst, type) +
      '</div>' +
      resizeHandle +
      '</section>'
    );
  }

  function currentSkin() {
    var id = state.widgetSkin || 'border';
    for (var i = 0; i < WIDGET_SKINS.length; i++) {
      if (WIDGET_SKINS[i].id === id) return WIDGET_SKINS[i];
    }
    return WIDGET_SKINS[0];
  }

  function cycleWidgetSkin() {
    var idx = 0;
    for (var i = 0; i < WIDGET_SKINS.length; i++) {
      if (WIDGET_SKINS[i].id === state.widgetSkin) {
        idx = i;
        break;
      }
    }
    state.widgetSkin = WIDGET_SKINS[(idx + 1) % WIDGET_SKINS.length].id;
    try {
      localStorage.setItem('aiops-widget-skin', state.widgetSkin);
    } catch (e) {}
    render();
  }

  function configCloseSvg() {
    return (
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  function closeConfigMenu(restoreFocus) {
    var id = state.configId;
    var trigger = id && document.querySelector('[data-widget-config="' + id + '"]');
    // Focus the still-visible trigger before clearing the menu's active styling.
    if (restoreFocus && trigger) trigger.focus({ preventScroll: true });
    state.configId = null;
    renderConfigPopover();
  }

  function positionConfigMenu(panel, trigger) {
    var rect = trigger.getBoundingClientRect();
    var below = window.innerHeight - rect.bottom - 14, above = rect.top - 14;
    var down = below >= Math.min(420, panel.scrollHeight) || below >= above;
    panel.style.maxHeight = Math.max(96, Math.min(420, down ? below : above)) + 'px';
    var left = Math.max(8, Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 8));
    var top = down ? rect.bottom + 6 : rect.top - panel.offsetHeight - 6;
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(Math.max(8, top)) + 'px';
  }

  function applyWidgetConfigLive(id) {
    var host = document.getElementById('widgetConfigHost');
    if (!host) return;
    var checked = [];
    host.querySelectorAll('[data-config-metric]').forEach(function (input) {
      if (input.getAttribute('aria-checked') === 'true') checked.push(input.getAttribute('data-config-metric'));
    });
    var inst = null;
    ensureHomeWidgets().forEach(function (w) {
      if (w.id === id) {
        w.metrics = checked;
        inst = w;
      }
    });
    persistHomeWidgets();
    if (!inst) return;
    var type = widgetType(inst.type);
    var card = document.querySelector('.widget[data-widget-id="' + id + '"]');
    if (card && type) {
      var body = card.querySelector('.widget-body');
      if (body) {
        body.innerHTML = widgetBodyHtml(inst, type);
        paintIcons();
        if (window.AIOpsBoards) window.AIOpsBoards.syncCharts();
      }
    }
  }

  function renderConfigPopover() {
    var host = document.getElementById('widgetConfigHost');
    if (!host) return;
    document.querySelectorAll('[data-widget-config]').forEach(function (button) {
      var on = button.getAttribute('data-widget-config') === state.configId;
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-controls', 'widgetConfigMenu');
      button.setAttribute('aria-expanded', String(on));
      button.closest('.widget').classList.toggle('is-configuring', on);
    });
    if (!state.configId) { host.innerHTML = ''; host.hidden = true; return; }
    var inst = ensureHomeWidgets().filter(function (w) { return w.id === state.configId; })[0];
    var type = inst && widgetType(inst.type);
    var trigger = document.querySelector('[data-widget-config="' + state.configId + '"]');
    if (!inst || !type || !trigger) { closeConfigMenu(false); return; }
    var selected = {}, sections = {}, order = [];
    (inst.metrics || []).forEach(function (id) { selected[id] = true; });
    (type.metrics || []).forEach(function (m) {
      var section = m.section || '';
      if (!sections[section]) { sections[section] = []; order.push(section); }
      sections[section].push(m);
    });
    var check = '<svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m2.5 6 2.2 2.2 4.8-4.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var body = order.map(function (section) {
      return (section ? '<div class="wg-config-sec" role="presentation">' + esc(t(section)) + '</div>' : '') + sections[section].map(function (m) {
        return '<button type="button" class="acct-item wg-config-option" role="menuitemcheckbox" tabindex="-1" aria-checked="' + !!selected[m.id] + '" data-config-metric="' + esc(m.id) + '" data-config-live="' + esc(inst.id) + '"><span class="wg-config-check" aria-hidden="true">' + check + '</span><span class="wg-config-option-label" title="' + esc(t(m.label)) + '">' + esc(t(m.label)) + '</span></button>';
      }).join('');
    }).join('');
    host.hidden = false;
    host.innerHTML = '<div class="cap-menu wg-config-card" id="widgetConfigMenu" role="menu" aria-label="' + esc(t(type.title) + ' · ' + t('配置')) + '"><div class="wg-config-menu-label" role="presentation">' + esc(t('显示指标')) + '</div><div class="wg-config-body" role="presentation">' + body + '</div><div class="wg-config-foot" role="presentation"><button type="button" role="menuitem" tabindex="-1" class="acct-item is-danger" data-widget-delete="' + esc(inst.id) + '">' + lucideIcon('trash-2') + '<span>' + esc(t('删除')) + '</span></button></div></div>';
    positionConfigMenu(host.querySelector('.wg-config-card'), trigger);
    paintIcons();
  }

  function galleryTypeList(filter) {
    var q = (filter || '').trim().toLowerCase();
    return WIDGET_TYPES.filter(function (type) {
      if (!q) return true;
      return t(type.title).toLowerCase().indexOf(q) >= 0 || type.id.indexOf(q) >= 0;
    });
  }

  var galleryAnchorUntil = 0;

  function galleryCatalogGroups() {
    return [
      { key: 'default', label: '监测看板', ids: ['cost', 'health', 'behavior'] },
      { key: 'custom', label: '自定义看板', ids: ['custom'] },
      { key: 'schedule', label: '定时任务', ids: ['schedules'] },
      { key: 'artifact', label: '产出物', ids: ['artifacts'] }
    ];
  }

  function galleryTypesIn(listed, ids) {
    return ids
      .map(function (id) {
        for (var i = 0; i < listed.length; i++) {
          if (listed[i].id === id) return listed[i];
        }
        return null;
      })
      .filter(Boolean);
  }

  function scrollGalleryAnchor(targetId) {
    var scroller = document.querySelector('#widgetGallery .wg-catalog');
    var target = document.getElementById(targetId);
    if (!scroller || !target) return;
    var top =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    galleryAnchorUntil = Date.now() + 450;
    scroller.scrollTo({ top: Math.max(0, top - 4), behavior: 'smooth' });
  }

  function placeGalleryAnchorIndicator() {
    var nav = document.querySelector('#widgetGallery .wg-anchor-tabs');
    if (!nav) return;
    var active = nav.querySelector('.wg-anchor-tab.is-active');
    if (!active) return;
    var indicator = nav.querySelector('.wg-anchor-indicator');
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'wg-anchor-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      nav.insertBefore(indicator, nav.firstChild);
    }
    indicator.style.width = active.offsetWidth + 'px';
    indicator.style.height = active.offsetHeight + 'px';
    indicator.style.transform = 'translate(' + active.offsetLeft + 'px,' + active.offsetTop + 'px)';
  }

  function setGalleryAnchorActive(typeId) {
    state.galleryType = typeId;
    document.querySelectorAll('#widgetGallery [data-gallery-anchor]').forEach(function (btn) {
      var on = btn.getAttribute('data-gallery-anchor') === typeId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    placeGalleryAnchorIndicator();
  }

  function bindGalleryCatalogScroll() {
    var scroller = document.querySelector('#widgetGallery .wg-catalog');
    if (!scroller) return;
    scroller.addEventListener(
      'scroll',
      function () {
        if (Date.now() < galleryAnchorUntil) return;
        var sections = scroller.querySelectorAll('.wg-catalog-group');
        if (!sections.length) return;
        var edge = scroller.getBoundingClientRect().top + 28;
        var current = sections[0].id.replace('wg-group-', '');
        for (var i = 0; i < sections.length; i++) {
          if (sections[i].getBoundingClientRect().top <= edge) {
            current = sections[i].id.replace('wg-group-', '');
          }
        }
        if (current && current !== state.galleryType) setGalleryAnchorActive(current);
      },
      { passive: true }
    );
  }

  function renderGallery() {
    var root = document.getElementById('widgetGallery');
    if (!root) return;
    if (!state.galleryOpen) {
      root.hidden = true;
      root.classList.remove('is-stash');
      document.body.classList.remove('is-gallery-open');
      return;
    }
    document.body.classList.add('is-gallery-open');
    root.hidden = false;
    root.classList.toggle('is-stash', !!state.galleryHidden);

    var listed = galleryTypeList();
    var groups = galleryCatalogGroups().filter(function (g) {
      return galleryTypesIn(listed, g.ids).length;
    });
    if (!groups.some(function (g) { return g.key === state.galleryType; })) {
      state.galleryType = groups.length ? groups[0].key : 'default';
    }

    var tabs = groups
      .map(function (g) {
        var on = state.galleryType === g.key;
        return (
          '<button type="button" role="tab" class="wg-anchor-tab' +
            (on ? ' is-active' : '') +
            '" data-gallery-anchor="' + esc(g.key) + '" aria-selected="' + (on ? 'true' : 'false') + '">' +
            esc(t(g.label)) +
          '</button>'
        );
      })
      .join('');

    var catalog = groups
      .map(function (g) {
        var cards = galleryTypesIn(listed, g.ids)
          .map(function (x) {
            var inst = {
              id: 'gallery-' + x.id,
              type: x.id,
              metrics: (x.defaults || []).slice()
            };
            return (
              '<div class="wg-catalog-card' +
                (x.disabled ? ' is-disabled' : '') +
                '" id="wg-card-' + esc(x.id) + '" data-gallery-card="' + esc(x.id) + '">' +
                widgetChrome(inst, x, 'gallery') +
              '</div>'
            );
          })
          .join('');
        if (!cards) return '';
        return (
          '<section class="wg-catalog-group" id="wg-group-' + esc(g.key) + '">' +
            cards +
          '</section>'
        );
      })
      .join('');

    if (!catalog) {
      catalog = '<div class="wg-catalog-empty">' + esc(t('没有匹配的组件')) + '</div>';
    }

    root.innerHTML =
      '<div class="wg-backdrop" data-gallery-close="1"></div>' +
      '<div class="wg-sheet" role="dialog" aria-modal="true" aria-label="' + esc(t('组件库')) + '" data-widget-skin="' + esc(currentSkin().id) + '">' +
        '<div class="wg-sheet-main">' +
          '<div class="wg-sheet-head">' +
            '<h2>' + esc(t('添加组件')) + '</h2>' +
            '<button type="button" class="wg-config-close" data-gallery-close="1" aria-label="' +
            esc(t('关闭')) +
            '">' +
            configCloseSvg() +
            '</button>' +
          '</div>' +
          '<nav class="wg-anchor-tabs" role="tablist" aria-label="' + esc(t('组件库')) + '">' + tabs + '</nav>' +
          '<div class="wg-catalog">' + catalog + '</div>' +
        '</div>' +
      '</div>';
    paintIcons();
    if (window.AIOpsBoards) window.AIOpsBoards.syncCharts();
    bindGalleryCatalogScroll();
    placeGalleryAnchorIndicator();
    requestAnimationFrame(placeGalleryAnchorIndicator);
  }

  function setGalleryStash(hidden) {
    state.galleryHidden = !!hidden;
    var root = document.getElementById('widgetGallery');
    if (root) root.classList.toggle('is-stash', state.galleryHidden);
  }

  function fitGalleryPreview() {
    if (state.drag || state.galleryHidden) return;
    var wrap = document.querySelector('#widgetGallery .wg-preview-wrap');
    var card = wrap && wrap.querySelector('.widget.is-gallery-preview');
    if (!wrap || !card) return;
    card.style.transform = 'none';
    card.style.marginLeft = '0px';
    card.style.marginRight = '0px';
    card.style.marginBottom = '0px';
    var naturalW = card.offsetWidth;
    var naturalH = card.offsetHeight;
    var availW = wrap.clientWidth - 24;
    var availH = wrap.clientHeight - 24;
    if (naturalW < 1 || naturalH < 1 || availW < 1 || availH < 1) return;
    var scale = Math.min(availW / naturalW, availH / naturalH, 1);
    if (scale > 0.995) {
      card.style.transform = '';
      card.style.marginLeft = '';
      card.style.marginRight = '';
      card.style.marginBottom = '';
      return;
    }
    var dx = naturalW * (1 - scale);
    var dy = naturalH * (1 - scale);
    card.style.transformOrigin = 'top center';
    card.style.transform = 'scale(' + scale.toFixed(4) + ')';
    card.style.marginLeft = -dx / 2 + 'px';
    card.style.marginRight = -dx / 2 + 'px';
    card.style.marginBottom = -dy + 'px';
  }

  function openGallery() {
    state.galleryOpen = true;
    state.galleryHidden = false;
    state.configId = null;
    if (!widgetType(state.galleryType) || widgetType(state.galleryType).disabled) {
      state.galleryType = 'cost';
    }
    renderGallery();
    var sheet = document.querySelector('#widgetGallery .wg-sheet');
    if (sheet) sheet.classList.add('is-entering');
    renderConfigPopover();
  }

  function closeGallery() {
    state.galleryOpen = false;
    state.galleryHidden = false;
    renderGallery();
  }

  function addWidgetInstance(typeId, place) {
    var type = widgetType(typeId);
    if (!type || type.disabled) return;
    var list = ensureHomeWidgets();
    var cols = WIDGET_GRID_COLS;
    var inst = makeWidget(typeId);
    normalizeWidgetLayout(inst, type, cols);
    if (place && Number(place.col) > 0 && Number(place.row) > 0) {
      inst.col = Math.round(Number(place.col));
      inst.row = Math.round(Number(place.row));
      normalizeWidgetLayout(inst, type, cols);
    } else {
      var spot = findOpenSpot(list, inst.span, inst.rows, cols);
      inst.col = spot.col;
      inst.row = spot.row;
    }
    list.push(inst);
    resolveCollisions(list, inst.id, cols);
    persistHomeWidgets();
    state.page = '工作台';
    render(place && place.scrollTop != null ? { scrollTop: place.scrollTop } : undefined);
    showToast(t('添加成功'));
  }

  var toastTimer = null;
  function showToast(message, semantic) {
    var warning = semantic === 'warning';
    var host = document.getElementById('ui-toast');
    if (!host) {
      host = document.createElement('div');
      host.id = 'ui-toast';
      host.className = 'ui-toast';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = null;
    host.innerHTML = '';
    var el = document.createElement('div');
    el.className = 'ui-toast__item' + (warning ? ' ui-toast__item--warning' : '');
    el.setAttribute('role', 'status');
    var icon = document.createElement('img');
    icon.className = 'ui-toast__icon';
    icon.src = warning ? 'aiops/assets/toast-warning.svg' : 'aiops/assets/toast-success.svg';
    icon.width = 16;
    icon.height = 16;
    icon.alt = '';
    var text = document.createElement('span');
    text.className = 'ui-toast__text';
    text.textContent = message;
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'ui-toast__close';
    close.setAttribute('aria-label', t('关闭'));
    var closeIcon = document.createElement('img');
    closeIcon.src = warning ? 'aiops/assets/toast-warning-close.svg' : 'aiops/assets/toast-close.svg';
    closeIcon.width = 12;
    closeIcon.height = 12;
    closeIcon.alt = '';
    close.appendChild(closeIcon);
    el.appendChild(icon);
    el.appendChild(text);
    el.appendChild(close);
    host.appendChild(el);
    var hideTimer = null;
    function dismiss() {
      if (toastTimer === hideTimer) toastTimer = null;
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = null;
      el.classList.remove('ui-toast__item--in');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }
    close.addEventListener('click', dismiss);
    requestAnimationFrame(function () {
      el.classList.add('ui-toast__item--in');
    });
    hideTimer = setTimeout(dismiss, 2200);
    toastTimer = hideTimer;
  }

  function deleteWidgetInstance(id) {
    var list = ensureHomeWidgets();
    var next = list.filter(function (w) { return w.id !== id; });
    if (next.length === list.length) return;
    state.homeWidgets = next;
    if (state.configId === id) {
      state.configId = null;

    }
    persistHomeWidgets();
    render();
    showToast(t('删除成功'));
  }

  function closeDeleteConfirm() {
    state.deleteAsk = null;
    var pop = document.getElementById('widgetDeleteConfirm');
    if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    document.querySelectorAll('.widget.is-delete-confirm').forEach(function (el) {
      el.classList.remove('is-delete-confirm');
    });
    document.querySelectorAll('[data-widget-delete].is-delete-ask').forEach(function (el) {
      el.classList.remove('is-delete-ask');
      el.removeAttribute('aria-expanded');
    });
  }

  function positionDeleteConfirm(pop, anchor) {
    var rect = anchor.getBoundingClientRect();
    var width = pop.offsetWidth;
    var height = pop.offsetHeight;
    var left = rect.right - width;
    var top = rect.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 6);
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  function openDeleteConfirm(id, anchor) {
    if (!id || !anchor) return;
    if (state.deleteAsk === id) {
      closeDeleteConfirm();
      return;
    }
    closeDeleteConfirm();
    state.deleteAsk = id;
    var widget = document.querySelector('.widget[data-widget-id="' + CSS.escape(id) + '"]');
    if (widget) widget.classList.add('is-delete-confirm');
    anchor.classList.add('is-delete-ask');
    anchor.setAttribute('aria-expanded', 'true');

    var pop = document.createElement('div');
    pop.id = 'widgetDeleteConfirm';
    pop.className = 'wg-delete-confirm';
    pop.setAttribute('role', 'alertdialog');
    pop.setAttribute('aria-label', t('确认删除组件'));
    pop.innerHTML =
      '<p>' +
      esc(t('确认删除组件')) +
      '</p>' +
      '<div class="wg-delete-confirm-actions">' +
      '<button type="button" class="btn-soft" data-delete-cancel="1">' +
      esc(t('取消')) +
      '</button>' +
      '<button type="button" class="wg-delete-ok" data-delete-confirm="' +
      esc(id) +
      '">' +
      esc(t('删除')) +
      '</button>' +
      '</div>';
    document.body.appendChild(pop);
    positionDeleteConfirm(pop, anchor);
    var cancelBtn = pop.querySelector('[data-delete-cancel]');
    if (cancelBtn) cancelBtn.focus();
  }

  function setWidgetSpan(id, span, rows) {
    var cols = WIDGET_GRID_COLS;
    span = Math.max(1, Math.min(cols, Math.round(span)));
    if (rows != null) rows = Math.max(1, Math.min(WIDGET_GRID_ROWS, Math.round(rows)));
    var list = ensureHomeWidgets();
    var target = null;
    list.forEach(function (w) {
      if (w.id === id) target = w;
    });
    if (!target) return;
    // Keep top-left anchor; only grow/shrink. Neighbors push on expand, never pull on shrink.
    target.span = span;
    if (rows != null) target.rows = rows;
    normalizeWidgetLayout(target, widgetType(target.type), cols);
    resolveCollisions(list, id, cols);
    persistHomeWidgets();
    render();
  }

  function setWidgetPosition(id, col, row, opts) {
    var cols = WIDGET_GRID_COLS;
    var list = ensureHomeWidgets();
    var target = null;
    list.forEach(function (w) {
      if (w.id === id) target = w;
    });
    if (!target) return;
    target.col = col;
    target.row = row;
    normalizeWidgetLayout(target, widgetType(target.type), cols);
    resolveCollisions(list, id, cols);
    persistHomeWidgets();
    render(opts);
  }

  function gridColMetrics() {
    var grid = document.getElementById('homeWidgetGrid');
    if (!grid) return { col: 280, row: 88, gap: 16, cols: WIDGET_GRID_COLS, rows: WIDGET_GRID_ROWS };
    var styles = window.getComputedStyle(grid);
    var gap = parseFloat(styles.rowGap || styles.columnGap || styles.gap) || 16;
    // Coordinate space stays 6-col; only stack at phone width.
    var cols = WIDGET_GRID_COLS;
    if (window.matchMedia('(max-width: 760px)').matches) cols = 1;
    var width = grid.clientWidth;
    var col = cols > 1 ? (width - gap * (cols - 1)) / cols : width;
    var row = parseFloat(styles.gridAutoRows) || parseFloat(styles.getPropertyValue('--widget-row')) || 88;
    return { col: col, row: row, gap: gap, cols: cols, rows: WIDGET_GRID_ROWS, grid: grid };
  }

  function makePlaceholder(span, rows, col, row) {
    var el = document.createElement('div');
    el.className =
      'widget-placeholder is-span-' +
      (span || 1) +
      ' is-row-' +
      (rows || 4);
    el.setAttribute('aria-hidden', 'true');
    applyPlacement(el, col || 1, row || 1, span || 1, rows || 4);
    return el;
  }

  function previewMoveLayout(startLayout, widgetId, col, row, span, rows, cols) {
    var live = cloneLayout(startLayout);
    var item = null;
    live.forEach(function (w) {
      if (w.id === widgetId) item = w;
    });
    if (!item) return live;
    if (col != null) item.col = col;
    if (row != null) item.row = row;
    if (span != null) item.span = span;
    if (rows != null) item.rows = rows;
    normalizeWidgetLayout(item, widgetType(item.type), cols);
    resolveCollisions(live, widgetId, cols);
    return live;
  }

  function pageHome() {
    ensureHomeWidgets();

    var cards = state.homeWidgets
      .map(function (inst) {
        var type = widgetType(inst.type);
        if (!type) return '';
        return widgetChrome(inst, type, 'canvas');
      })
      .join('');

    var skin = currentSkin();
    return (
      '<div class="home-content" data-widget-skin="' +
      esc(skin.id) +
      '">' +
        '<div class="home-top">' +
          '<div class="page-heading"><h1>' +
          esc(t('工作台')) +
          '</h1></div>' +
          '<div class="home-top-actions">' +
            rangeSegment() +
            scopeButton() +
            '<button type="button" class="btn-soft" id="btnWidgetSkin" title="' +
            esc(t('皮肤切换') + ' · Demo') +
            '">' +
            lucideIcon('palette') +
            ' ' +
            esc(t(skin.label)) +
            '</button>' +
            '<button type="button" class="btn-soft" id="btnAddWidget">' +
            tablerIcon('layout-grid-add') +
            ' ' +
            esc(t('添加组件')) +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="widget-grid" id="homeWidgetGrid">' +
        cards +
        '</div>' +
      '</div>'
    );
  }


  function pageNewTask() {
    return cuiShell('分析任务', false, '');
  }

  function pageSchedules() {
    if (window.AIOpsCapability) return window.AIOpsCapability.schedulesPage();
    return heading(t('定时任务'));
  }

  function sessionRows(includeEvaluationDemo) {
    var rows = [
      { id: 'CR-1028', name: '模型调用成本趋势分析', agent: '成本分析智能体', time: '2026-10-14 13:20', user: 'zeyu.jiang', messages: 25, tokens: '3.7', errors: 0, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1027', name: '制造业规则阈值复核', agent: '制造业规则审核智能体', time: '2026-10-14 12:55', user: 'david.wong', messages: 34, tokens: '5.2', errors: 0, warnings: 1, mark: '优质', by: 'Siqi Yang', markedAt: '2026-10-14 13:05' },
      { id: 'CR-1026', name: '高频追问与回答质量复盘', agent: '会话质量分析智能体', time: '2026-10-14 12:10', user: 'amy.chen', messages: 22, tokens: '2.9', errors: 0, warnings: 0, mark: '边界', by: 'amy.chen', markedAt: '2026-10-14 12:40' },
      { id: 'CR-1025', name: '成本与 token 异常排查', agent: '成本分析智能体', time: '2026-10-14 11:20', user: 'mary.li', messages: 30, tokens: '4.6', errors: 0, warnings: 2, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1024', name: '制造业月末报表审核', time: '2026-10-14 10:32', user: 'zeyu.jiang', messages: 42, tokens: '8.6', errors: 1, warnings: 2, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1023', name: '跨期预提费用复核', time: '2026-10-14 09:48', user: 'amy.chen', messages: 28, tokens: '4.2', errors: 0, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1022', name: '收入确认规则核验', time: '2026-10-14 09:16', user: 'david.wong', messages: 21, tokens: '3.1', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1021', name: '关联方余额对账', time: '2026-10-13 17:32', user: 'zeyu.jiang', messages: 16, tokens: '1.8', errors: 0, warnings: 0, mark: '劣质', by: 'Feng Zhu', markedAt: '2026-10-14 11:37' },
      { id: 'CR-1020', name: '存货减值准备审核', time: '2026-10-13 16:45', user: 'amy.chen', messages: 24, tokens: '2.8', errors: 0, warnings: 0, mark: '优质', by: 'Feng Zhu', markedAt: '2026-10-14 11:32' },
      { id: 'CR-1019', name: '9 月关账报告生成', time: '2026-10-13 15:10', user: 'mary.li', messages: 36, tokens: '5.4', errors: 1, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1018', name: '制造业规则适用范围确认', time: '2026-10-13 14:28', user: 'david.wong', messages: 18, tokens: '2.1', errors: 0, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1017', name: '客户费用科目复核', time: '2026-10-13 11:06', user: 'mary.li', messages: 12, tokens: '1.2', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1016', name: '费用跨期冲回核对', time: '2026-10-13 10:22', user: 'zeyu.jiang', messages: 19, tokens: '2.4', errors: 0, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1015', name: '税金计提差异复核', time: '2026-10-12 18:05', user: 'amy.chen', messages: 31, tokens: '4.8', errors: 1, warnings: 2, mark: '劣质', by: 'Feng Zhu', markedAt: '2026-10-13 09:18' },
      { id: 'CR-1014', name: '固定资产折旧核验', time: '2026-10-12 16:41', user: 'david.wong', messages: 14, tokens: '1.6', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1013', name: '往来重分类检查', time: '2026-10-12 15:12', user: 'mary.li', messages: 22, tokens: '2.9', errors: 0, warnings: 0, mark: '优质', by: 'Feng Zhu', markedAt: '2026-10-12 17:46' },
      { id: 'CR-1012', name: '成本结转规则核对', time: '2026-10-12 11:38', user: 'zeyu.jiang', messages: 27, tokens: '3.6', errors: 0, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1011', name: '暂估入库冲销复核', time: '2026-10-11 17:20', user: 'amy.chen', messages: 18, tokens: '2.2', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1010', name: '银行余额调节核对', time: '2026-10-11 15:04', user: 'david.wong', messages: 33, tokens: '5.1', errors: 1, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1009', name: '薪酬计提与发放核对', time: '2026-10-11 10:47', user: 'mary.li', messages: 15, tokens: '1.9', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1008', name: '租赁负债计量复核', time: '2026-10-10 16:33', user: 'zeyu.jiang', messages: 26, tokens: '3.4', errors: 0, warnings: 0, mark: '优质', by: 'Feng Zhu', markedAt: '2026-10-10 18:02' },
      { id: 'CR-1007', name: '政府补助递延核对', time: '2026-10-10 14:18', user: 'amy.chen', messages: 11, tokens: '1.1', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1006', name: '内部交易抵消检查', time: '2026-10-10 11:26', user: 'david.wong', messages: 29, tokens: '4.0', errors: 0, warnings: 2, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1005', name: '合同资产减值核验', time: '2026-10-09 17:55', user: 'mary.li', messages: 20, tokens: '2.6', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1004', name: '收入截止性测试', time: '2026-10-09 15:40', user: 'zeyu.jiang', messages: 37, tokens: '6.2', errors: 1, warnings: 1, mark: '劣质', by: 'Feng Zhu', markedAt: '2026-10-09 18:21' },
      { id: 'CR-1003', name: '费用科目映射复核', time: '2026-10-09 10:12', user: 'amy.chen', messages: 13, tokens: '1.5', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1002', name: '关账检查清单执行', time: '2026-10-08 16:08', user: 'david.wong', messages: 41, tokens: '7.4', errors: 0, warnings: 1, mark: '未标记', by: '', markedAt: '' },
      { id: 'CR-1001', name: '报表附注一致性核对', time: '2026-10-08 09:36', user: 'mary.li', messages: 17, tokens: '2.0', errors: 0, warnings: 0, mark: '未标记', by: '', markedAt: '' }
    ].map(function (row) { return Object.assign({ agent: '关账审核智能体' }, row, state.sessionMarks[row.id] || {}); });
    if (includeEvaluationDemo === false || !window.AIOpsEvaluationDemoOnline) return rows;
    return window.AIOpsEvaluationDemoOnline.sessions(rows).map(function (row) {
      return Object.assign({}, row, state.sessionMarks[row.id] || {});
    });
  }

  function sessionTokenLabel(millions) {
    return Math.round(parseFloat(millions) * 1e6).toLocaleString('en-US');
  }

  function sessionMarkHtml(mark) {
    var cls = mark === '优质' ? ' is-good' : mark === '劣质' ? ' is-bad' : '';
    var icon = mark === '边界' ? lucideIcon('circle-help') : mark === '未标记'
      ? '<span aria-hidden="true">⊖</span>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"' +
        (mark === '劣质' ? ' style="transform:rotate(180deg)"' : '') +
        '><path d="M7 10v11H3V10h4Zm0 0 5-8c3 0 3 3 2 7h5a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7"/></svg>';
    return '<span class="session-mark' + cls + '">' + icon + esc(t(mark)) + '</span>';
  }

  function sessionRowHtml(row) {
    var agent = t(row.agent);
    return (
      '<tr tabindex="0" aria-label="' + esc((state.lang === 'en' ? 'View session: ' : '查看会话：') + row.name) + '" data-session-view="' + esc(row.id) + '"' + (state.sessionSelected[row.id] ? ' class="is-selected"' : '') + '>' +
        '<td class="session-check"><input type="checkbox" data-session-select="' + esc(row.id) + '" aria-label="' + esc(row.name) + '"' +
          (state.sessionSelected[row.id] ? ' checked' : '') + '></td>' +
        '<td><span class="session-name" title="' + esc(row.name + ' · ' + row.id) + '">' + esc(row.name) + '</span></td>' +
        '<td class="is-muted">' + esc(agent) + '</td>' +
        '<td class="is-muted">' + esc(row.time) + '</td>' +
        '<td class="is-muted">' + esc(row.user) + '</td>' +
        '<td class="is-numeric is-muted">' + esc(String(row.messages)) + '</td>' +
        '<td class="is-numeric is-muted">' + esc(sessionTokenLabel(row.tokens)) + '</td>' +
        '<td class="is-numeric is-muted" title="' + esc(row.errors + ' ' + t('错误数') + ' / ' + row.warnings + ' ' + t('警告数')) + '">' +
          esc(String(row.warnings)) + '</td>' +
        '<td>' + sessionMarkHtml(row.mark) + '</td>' +
        '<td class="is-muted">' + esc(row.by || '—') + '</td>' +
        '<td class="is-muted">' + esc(row.markedAt || '—') + '</td>' +
        '<td class="session-actions"><span class="session-actions-group"><button type="button" data-session-mark="' + esc(row.id) + '">' + esc(t('标记')) +
          '</button><button type="button" data-session-analyze="' + esc(row.id) + '">' + esc(t('AI分析')) + '</button></span></td>' +
      '</tr>'
    );
  }

  function sessionPager(page, pages, total) {
    var nums = '';
    var i;
    for (i = 1; i <= pages; i++) {
      nums +=
        '<button type="button" data-session-page="' + i + '"' +
        (i === page ? ' class="is-active" aria-current="page"' : '') + '>' +
        i +
        '</button>';
    }
    var totalLabel = state.lang === 'en' ? total + ' total' : '共 ' + total + ' 条';
    return (
      '<div class="table-pager">' +
        '<span class="table-pager-total">' + esc(totalLabel) + '</span>' +
        '<div class="table-pager-pages">' +
          '<button type="button" data-session-page="prev" aria-label="' + esc(t('上一页')) + '"' +
            (page <= 1 ? ' disabled' : '') + '>' + lucideIcon('chevron-left') + '</button>' +
          nums +
          '<button type="button" data-session-page="next" aria-label="' + esc(t('下一页')) + '"' +
            (page >= pages ? ' disabled' : '') + '>' + lucideIcon('chevron-right') + '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function sessionScene(row) { return /成本/.test(row.agent) ? 'cost' : /制造业/.test(row.agent) ? 'manufacturing' : 'audit'; }

  function sessionFilterValue(row, key) {
    return key === 'by' ? row.by || '__unmarked__' : row[key];
  }

  function compareSessionRows(a, b, sort) {
    var av = a[sort.key], bv = b[sort.key];
    // Undated/unmarked rows stay at the end in either direction.
    if (av == null || av === '') return bv == null || bv === '' ? 0 : 1;
    if (bv == null || bv === '') return -1;
    var numeric = ['messages', 'tokens', 'warnings'].indexOf(sort.key) >= 0;
    var result = numeric ? Number(av) - Number(bv) : String(av).localeCompare(String(bv), 'zh-CN', { numeric: true });
    return sort.direction === 'desc' ? -result : result;
  }

  function filteredSessionRows() {
    var q = (state.sessionQuery || '').trim().toLowerCase();
    var rows = sessionRows().filter(function (row) {
      var scene = sessionScene(row);
      if (!window.AIOpsResources.scopeHasAgent(scene, row.agent)) return false;
      if (q && (row.name + ' ' + row.id + ' ' + row.user).toLowerCase().indexOf(q) < 0) return false;
      var range = state.sessionDateRange;
      if (range && (row.time.slice(0, 10) < range.start || row.time.slice(0, 10) > range.end)) return false;
      return Object.keys(state.sessionFilters).every(function (key) {
        var values = state.sessionFilters[key];
        return !values.length || values.indexOf(sessionFilterValue(row, key)) >= 0;
      });
    });
    if (state.sessionSort) rows.sort(function (a, b) { return compareSessionRows(a, b, state.sessionSort); });
    return rows;
  }

  function sessionColumnLabel(key) {
    return { name: t('会话信息'), agent: 'Agent', time: t('最新会话时间'), user: t('用户'), messages: t('消息'), tokens: t('token 消耗'), warnings: t('警告'), mark: t('标记'), by: t('标记用户'), markedAt: t('标记时间') }[key];
  }

  function sessionColumnHeading(key, filter) {
    var label = sessionColumnLabel(key);
    if (filter) {
      var active = state.sessionFilters[key].length > 0;
      return '<th scope="col"><button type="button" class="session-col-control' + (active ? ' is-filtered' : '') + '" data-session-filter="' + key + '" aria-label="' + esc((state.lang === 'en' ? 'Filter ' : '筛选') + label) + '" aria-haspopup="dialog" aria-expanded="false" title="' + esc(label + (active ? ' · ' + state.sessionFilters[key].length : '')) + '"><span>' + esc(label) + '</span>' + lucideIcon('list-filter') + '</button></th>';
    }
    var sort = state.sessionSort;
    var direction = sort && sort.key === key ? sort.direction : '';
    var ariaSort = direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none';
    var next = direction === 'asc' ? (state.lang === 'en' ? 'Descending' : '降序') : direction === 'desc' ? (state.lang === 'en' ? 'Reset sort' : '恢复默认排序') : (state.lang === 'en' ? 'Ascending' : '升序');
    return '<th scope="col" aria-sort="' + ariaSort + '"><button type="button" class="session-col-control" data-session-sort="' + key + '" aria-label="' + esc((state.lang === 'en' ? 'Sort ' : '排序') + label) + '" title="' + esc(next) + '"><span>' + esc(label) + '</span><span class="session-sort-indicator" aria-hidden="true"><span class="' + (direction === 'asc' ? 'is-active' : '') + '">' + '<svg viewBox="0 0 8 5" aria-hidden="true"><path d="M4 0 8 5H0Z" fill="currentColor"/></svg>' + '</span><span class="' + (direction === 'desc' ? 'is-active' : '') + '">' + '<svg viewBox="0 0 8 5" aria-hidden="true"><path d="M0 0h8L4 5Z" fill="currentColor"/></svg>' + '</span></span></button></th>';
  }

  function sessionFilterOptions(key) {
    if (key === 'mark') return ['优质', '劣质', '边界', '未标记'];
    var values = [];
    sessionRows().forEach(function (row) {
      var value = sessionFilterValue(row, key);
      if (values.indexOf(value) < 0) values.push(value);
    });
    return values.sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
  }

  function closeSessionFilter(restoreFocus) {
    var active = state.sessionFilterMenu;
    var panel = document.getElementById('sessionColumnFilter');
    if (panel) panel.remove();
    if (active && active.anchor.isConnected) {
      active.anchor.setAttribute('aria-expanded', 'false');
      if (restoreFocus) active.anchor.focus({ preventScroll: true });
    }
    state.sessionFilterMenu = null;
  }

  function openSessionFilter(key, anchor) {
    var same = state.sessionFilterMenu && state.sessionFilterMenu.key === key;
    closeSessionFilter(); closeSessionMark(); closeSessionDate();
    if (same) return;
    state.sessionFilterMenu = { key: key, anchor: anchor };
    var panel = document.createElement('div');
    panel.id = 'sessionColumnFilter'; panel.className = 'session-column-filter';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', (state.lang === 'en' ? 'Filter ' : '筛选') + sessionColumnLabel(key));
    panel.innerHTML = '<header class="session-column-filter-header"><span>' + esc(sessionColumnLabel(key)) + '</span><button type="button" class="session-filter-clear" data-session-filter-reset="' + key + '"' + (state.sessionFilters[key].length ? '' : ' disabled') + '>' + (state.lang === 'en' ? 'Clear' : '清空') + '</button></header><div class="session-column-filter-options">' + sessionFilterOptions(key).map(function (value) {
      var label = value === '__unmarked__' ? t('未标记') : key === 'agent' || key === 'mark' ? t(value) : value;
      return '<label class="session-column-filter-option session-column-check"><input type="checkbox" data-session-filter-option value="' + esc(value) + '"' + (state.sessionFilters[key].indexOf(value) >= 0 ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
    }).join('') + '</div>';
    document.body.appendChild(panel);
    positionSessionPopover(panel, anchor);
    anchor.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('input'); if (first) first.focus({ preventScroll: true });
  }

  function applySessionFilter(key, values) {
    state.sessionFilters[key] = values.slice();
    state.sessionPage = 1; state.sessionSelected = {};
    var panel = document.getElementById('sessionColumnFilter');
    if (panel) {
      panel.querySelectorAll('input').forEach(function (input) { input.checked = values.indexOf(input.value) >= 0; });
      panel.querySelector('[data-session-filter-reset]').disabled = !values.length;
    }
    rerenderSessions(true, true);
  }

  function positionSessionPopover(panel, anchor) {
    var rect = anchor.getBoundingClientRect();
    panel.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8)) + 'px';
    panel.style.top = Math.max(8, rect.bottom + panel.offsetHeight + 6 > window.innerHeight ? rect.top - panel.offsetHeight - 6 : rect.bottom + 6) + 'px';
  }

  function sessionToday() {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function sessionPresetRange(days, today) {
    var end = today || sessionToday();
    var start = new Date(end + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - days + 1);
    return { start: start.toISOString().slice(0, 10), end: end };
  }

  function monitoringDateRange() {
    if (state.monitoringDateRange !== undefined) return state.monitoringDateRange;
    return sessionPresetRange(state.range);
  }

  function dateRangeFor(context) {
    if (context === 'rail-picker') return window.AIOpsRailPicker.dateRange();
    return context === 'monitoring' ? monitoringDateRange() : state.sessionDateRange;
  }

  function dateRangeDays(range) {
    return Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86400000) + 1;
  }

  function sessionPresetLabel(days) {
    return state.lang === 'en' ? days === 1 ? 'Today' : 'Last ' + days + ' days' : days === 1 ? '今天' : '最近 ' + days + ' 天';
  }

  function sessionPresetDays(range) {
    return range && [1, 7, 14].find(function (days) {
      var preset = sessionPresetRange(days);
      return range.start === preset.start && range.end === preset.end;
    });
  }

  function sessionDateControl(context) {
    context = context || 'sessions';
    var range = dateRangeFor(context);
    var days = sessionPresetDays(range);
    var dates = range ? range.start + ' – ' + range.end : '';
    var emptyLabel = context !== 'monitoring' ? (state.lang === 'en' ? 'Any time' : '不限时间范围') : (state.lang === 'en' ? 'Date range' : '时间范围');
    var label = days ? sessionPresetLabel(days) : dates || emptyLabel;
    var clearable = context !== 'monitoring' && range;
    var clearLabel = state.lang === 'en' ? 'Clear date range' : '清空时间范围';
    return '<div class="session-date-control' + (clearable ? ' is-clearable' : '') + '"><button type="button" class="session-date-trigger" data-session-date-open data-date-context="' + context + '" aria-haspopup="dialog" aria-expanded="false" aria-label="' + (state.lang === 'en' ? 'Select date range' : '选择时间范围') + '" title="' + esc(dates || label) + '">' + lucideIcon('calendar-days') + '<span>' + esc(label) + '</span>' + lucideIcon('chevron-down') + '</button>' + (clearable ? '<button type="button" class="session-date-inline-clear" data-session-date-clear aria-label="' + clearLabel + '" title="' + clearLabel + '">' + lucideIcon('x') + '</button>' : '') + '</div>';
  }

  function closeSessionDate(restoreFocus) {
    var menu = state.sessionDateMenu;
    var panel = document.getElementById('sessionDatePicker');
    if (panel) panel.remove();
    if (menu && menu.anchor.isConnected) {
      menu.anchor.setAttribute('aria-expanded', 'false');
      if (restoreFocus) menu.anchor.focus({ preventScroll: true });
    }
    state.sessionDateMenu = null;
  }

  function openSessionDate(anchor) {
    var same = !!state.sessionDateMenu;
    closeSessionDate(); closeSessionFilter(); closeSessionMark();
    if (same) return;
    var context = anchor.getAttribute('data-date-context') || 'sessions';
    state.sessionDateMenu = { anchor: anchor, context: context };
    var selectedRange = dateRangeFor(context);
    var range = selectedRange || { start: '', end: '' };
    var en = state.lang === 'en';
    var panel = document.createElement('div');
    panel.id = 'sessionDatePicker'; panel.className = 'session-date-picker';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', en ? 'Date range' : '时间范围');
    panel.innerHTML = '<header class="session-column-filter-header"><span>' + (en ? 'Date range' : '时间范围') + '</span><button type="button" class="session-date-clear" data-session-date-clear aria-label="' + (en ? 'Clear date range' : '清空时间范围') + '" title="' + (en ? 'Clear date range' : '清空时间范围') + '"' + (selectedRange ? '' : ' disabled') + '>' + lucideIcon('x') + '</button></header><div class="session-date-presets">' + [1, 7, 14].map(function (days) {
      var preset = sessionPresetRange(days);
      var active = range.start === preset.start && range.end === preset.end;
      return '<button type="button" data-session-date-preset="' + days + '" class="' + (active ? 'is-active' : '') + '">' + sessionPresetLabel(days) + '</button>';
    }).join('') + '</div><div class="session-date-fields">' + ['start', 'end'].map(function (field) {
      var label = en ? field === 'start' ? 'Start date' : 'End date' : field === 'start' ? '开始日期' : '结束日期';
      return (field === 'end' ? '<span aria-hidden="true">–</span>' : '') + '<div class="session-date-field-group"><span>' + label + '</span><input type="hidden" data-session-date-' + field + ' value="' + esc(range[field]) + '"><button type="button" class="session-date-field" data-session-date-field="' + field + '" aria-label="' + label + '" aria-expanded="false" aria-controls="sessionDateCalendar"><span>' + esc(range[field] || (en ? 'Select date' : '选择日期')) + '</span>' + lucideIcon('calendar-days') + '</button></div>';
    }).join('') + '</div><div id="sessionDateCalendar" class="session-date-calendar" role="group" hidden></div><p class="session-date-error" role="alert" hidden></p><footer><button type="button" class="btn-soft" data-session-date-cancel>' + esc(t('取消')) + '</button><button type="button" class="btn-ink" data-session-date-apply>' + (en ? 'Apply' : '确定') + '</button></footer>';
    (context === 'rail-picker' ? anchor.closest('.rail-picker-overlay') : document.body).appendChild(panel);
    paintIcons();
    positionSessionPopover(panel, anchor);
    anchor.setAttribute('aria-expanded', 'true');
  }

  function renderSessionCalendar() {
    var menu = state.sessionDateMenu, panel = document.getElementById('sessionDatePicker');
    if (!menu || !panel) return;
    var calendar = panel.querySelector('.session-date-calendar'), field = menu.calendarField;
    calendar.hidden = !field;
    panel.querySelectorAll('[data-session-date-field]').forEach(function (button) {
      button.setAttribute('aria-expanded', button.getAttribute('data-session-date-field') === field ? 'true' : 'false');
    });
    if (!field) { positionSessionPopover(panel, menu.anchor); return; }
    var month = new Date(menu.calendarMonth + '-01T00:00:00Z');
    var start = panel.querySelector('[data-session-date-start]').value;
    var end = panel.querySelector('[data-session-date-end]').value;
    var first = new Date(month); first.setUTCDate(1 - (month.getUTCDay() + 6) % 7);
    var en = state.lang === 'en', today = sessionToday();
    var monthLabel = new Intl.DateTimeFormat(en ? 'en-US' : 'zh-CN', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(month);
    calendar.setAttribute('aria-label', en ? 'Choose ' + field + ' date' : field === 'start' ? '选择开始日期' : '选择结束日期');
    calendar.innerHTML = '<div class="session-calendar-heading"><button type="button" data-session-date-month="-1" aria-label="' + (en ? 'Previous month' : '上个月') + '">' + lucideIcon('chevron-left') + '</button><span aria-live="polite">' + esc(monthLabel) + '</span><button type="button" data-session-date-month="1" aria-label="' + (en ? 'Next month' : '下个月') + '">' + lucideIcon('chevron-right') + '</button></div><div class="session-calendar-weekdays" aria-hidden="true">' + (en ? ['Mo','Tu','We','Th','Fr','Sa','Su'] : ['一','二','三','四','五','六','日']).map(function (day) { return '<span>' + day + '</span>'; }).join('') + '</div><div class="session-calendar-days">' + Array.from({ length: 42 }, function (_, i) {
      var day = new Date(first); day.setUTCDate(first.getUTCDate() + i);
      var date = day.toISOString().slice(0, 10), selected = date === start || date === end;
      var disabled = field === 'end' && start && date < start;
      var classes = (date.slice(0, 7) !== menu.calendarMonth ? ' is-other-month' : '') + (start && end && date > start && date < end ? ' is-in-range' : '') + (selected ? ' is-selected' : '') + (date === today ? ' is-today' : '');
      return '<button type="button" class="session-calendar-day' + classes + '" data-session-date-day="' + date + '" aria-label="' + date + '" aria-pressed="' + selected + '"' + (date === today ? ' aria-current="date"' : '') + (disabled ? ' disabled' : '') + '>' + day.getUTCDate() + '</button>';
    }).join('') + '</div>';
    paintIcons(); positionSessionPopover(panel, menu.anchor);
  }

  function openSessionCalendar(field) {
    var menu = state.sessionDateMenu, panel = document.getElementById('sessionDatePicker');
    if (!menu || !panel) return;
    var value = panel.querySelector('[data-session-date-' + field + ']').value || panel.querySelector('[data-session-date-start]').value || sessionToday();
    menu.calendarField = field; menu.calendarMonth = value.slice(0, 7);
    renderSessionCalendar();
  }

  function selectSessionCalendarDay(date) {
    var menu = state.sessionDateMenu, panel = document.getElementById('sessionDatePicker');
    if (!menu || !panel) return;
    var field = menu.calendarField, input = panel.querySelector('[data-session-date-' + field + ']');
    input.value = date;
    if (field === 'start' && panel.querySelector('[data-session-date-end]').value < date) panel.querySelector('[data-session-date-end]').value = '';
    panel.querySelectorAll('[data-session-date-field]').forEach(function (button) {
      var value = panel.querySelector('[data-session-date-' + button.getAttribute('data-session-date-field') + ']').value;
      button.querySelector('span').textContent = value || (state.lang === 'en' ? 'Select date' : '选择日期');
    });
    panel.querySelector('.session-date-error').hidden = true;
    panel.querySelectorAll('[data-session-date-preset]').forEach(function (button) { button.classList.remove('is-active'); });
    if (field === 'start') {
      menu.calendarField = 'end'; menu.calendarMonth = date.slice(0, 7);
    } else menu.calendarField = null;
    renderSessionCalendar();
    if (field === 'end') panel.querySelector('[data-session-date-field="end"]').focus({ preventScroll: true });
    else {
      var next = panel.querySelector('[data-session-date-day="' + date + '"]'); if (next) next.focus({ preventScroll: true });
    }
  }

  function applySessionDate(range) {
    var context = state.sessionDateMenu ? state.sessionDateMenu.context : 'sessions';
    if (context === 'rail-picker') { closeSessionDate(); window.AIOpsRailPicker.applyDateRange(range); return; }
    if (context === 'monitoring') {
      state.monitoringDateRange = range;
      state.range = dateRangeDays(range || window.AIOpsBoards.dateBounds());
      render();
      return;
    }
    state.sessionDateRange = range;
    state.sessionPage = 1; state.sessionSelected = {};
    rerenderSessions(true);
  }

  function sessionSearchControl() {
    var label = t('搜索会话');
    if (state.sessionSearchOpen || (state.sessionQuery || '').trim()) {
      return (
        '<label class="search-field session-search-field">' + lucideIcon('search') +
          '<input id="sessionSearch" type="text" data-session-query placeholder="' + esc(label) + '" value="' +
          esc(state.sessionQuery || '') + '" aria-label="' + esc(label) + '" autocomplete="off"></label>'
      );
    }
    return (
      '<button type="button" class="fb-tool" data-session-search-open title="' + esc(label) + '" aria-label="' +
        esc(label) + '">' + lucideIcon('search') + '</button>'
    );
  }

  function selectedSessions() {
    return sessionRows().filter(function (row) { return !!state.sessionSelected[row.id]; });
  }

  function sessionBulkBar() {
    var count = selectedSessions().length;
    if (!count) return '';
    return '<div class="session-bulk-dock" role="toolbar" aria-label="' + (state.lang === 'en' ? 'Session actions' : '会话批量操作') + '">' +
      '<span class="session-bulk-count" aria-live="polite">' + esc(state.lang === 'en' ? count + ' selected' : '已选择 ' + count + ' 个会话') + '</span>' +
      '<span class="session-bulk-divider" aria-hidden="true"></span>' +
      '<button type="button" data-session-bulk="mark" aria-haspopup="menu" aria-expanded="false">' + lucideIcon('tag') + esc(state.lang === 'en' ? 'Mark' : '批量标记') + lucideIcon('chevron-down') + '</button>' +
      '<button type="button" data-session-bulk="analyze">' + lucideIcon('sparkles') + esc(t('AI 分析')) + '</button>' +
      '<button type="button" class="session-bulk-clear" data-session-bulk="clear" aria-label="' + esc(state.lang === 'en' ? 'Clear selection' : '取消选择') + '" title="' + esc(state.lang === 'en' ? 'Clear selection' : '取消选择') + '">' + lucideIcon('x') + '</button></div>';
  }

  function rerenderSessions(resetTop, keepFilter) {
    var body = document.querySelector('.page.is-sessions .table-body');
    var left = body ? body.scrollLeft : 0;
    var top = !resetTop && body ? body.scrollTop : 0;
    render({ keepSessionFilter: keepFilter });
    if (keepFilter && state.sessionFilterMenu) {
      var menu = state.sessionFilterMenu;
      menu.anchor = document.querySelector('[data-session-filter="' + menu.key + '"]');
      menu.anchor.setAttribute('aria-expanded', 'true');
      positionSessionPopover(document.getElementById('sessionColumnFilter'), menu.anchor);
    }
    body = document.querySelector('.page.is-sessions .table-body');
    if (body) { body.scrollLeft = left; body.scrollTop = top; }
    syncSessionShades();
  }

  function closeSessionMark(restoreFocus) {
    var menu = document.getElementById('sessionMarkMenu');
    if (menu) menu.remove();
    var anchor = state.sessionMarkAnchor;
    document.querySelectorAll('[data-session-mark][aria-expanded], [data-session-bulk="mark"]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
    state.sessionMarkIds = [];
    state.sessionMarkAnchor = null;
    if (restoreFocus && anchor && anchor.isConnected) anchor.focus({ preventScroll: true });
  }

  function openSessionMark(ids, anchor, focusMenu) {
    var parent = anchor.closest('#sessionActionsMenu');
    var same = anchor.getAttribute('aria-expanded') === 'true';
    if (same && parent) {
      var existing = document.getElementById('sessionMarkMenu');
      if (focusMenu !== false && existing) existing.querySelector('button').focus({ preventScroll: true });
      return;
    }
    closeSessionMark();
    if (same || !ids.length) return;
    state.sessionMarkIds = ids.slice();
    state.sessionMarkAnchor = anchor;
    var menu = document.createElement('div');
    menu.id = 'sessionMarkMenu'; menu.className = 'session-mark-menu'; menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', state.lang === 'en' ? 'Mark sessions' : '标记会话');
    menu.innerHTML = ['优质', '劣质', '边界', '未标记'].map(function (mark) {
      var icon = mark === '优质' ? 'thumbs-up' : mark === '劣质' ? 'thumbs-down' : mark === '边界' ? 'circle-help' : 'circle-minus';
      return '<button type="button" role="menuitem" data-session-set-mark="' + mark + '">' + lucideIcon(icon) + esc(mark === '未标记' ? (state.lang === 'en' ? 'Remove mark' : '取消标记') : t(mark)) + '</button>';
    }).join('');
    document.body.appendChild(menu); paintIcons();
    var rect = anchor.getBoundingClientRect();
    if (parent) {
      menu.classList.add('is-submenu');
      var parentRect = parent.getBoundingClientRect();
      var left = parentRect.right + 4;
      if (left + menu.offsetWidth > window.innerWidth - 8) left = parentRect.left - menu.offsetWidth - 4;
      menu.style.left = Math.max(8, left) + 'px';
      menu.style.top = Math.max(8, Math.min(rect.top - 6, window.innerHeight - menu.offsetHeight - 8)) + 'px';
    } else {
      menu.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
      var above = !!anchor.closest('.session-bulk-dock') || rect.bottom + menu.offsetHeight + 8 > window.innerHeight;
      menu.style.top = Math.max(8, above ? rect.top - menu.offsetHeight - 8 : rect.bottom + 6) + 'px';
    }
    anchor.setAttribute('aria-expanded', 'true');
    if (focusMenu !== false) menu.querySelector('button').focus({ preventScroll: true });
  }

  function markSessions(ids, mark) {
    var timestamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    ids.forEach(function (id) { state.sessionMarks[id] = { mark: mark, by: mark === '未标记' ? '' : 'Siqi Yang', markedAt: mark === '未标记' ? '' : timestamp }; });
    rerenderSessions();
    showToast(state.lang === 'en' ? 'Updated ' + ids.length + ' sessions' : '已更新 ' + ids.length + ' 个会话的标记');
  }

  function analyzeSessions(ids) {
    var refs = sessionRows().filter(function (row) { return ids.indexOf(row.id) >= 0; });
    if (!refs.length) return;
    var prompt = state.lang === 'en' ? 'Analyze the referenced sessions and summarize key issues and improvements.' : '请分析引用的会话，梳理主要问题与改进建议。';
    if (referenceInConversation(refs, prompt)) return;
    var detailId = state.sessionViewId;
    openNewTask({ page: '分析任务', skill: '', sessionRefs: refs, prompt: prompt }, detailId ? 'ses:' + detailId : null);
  }

  function sessionReferenceHtml(refs, editable) {
    if (!refs || !refs.length) return '';
    return '<div class="cui-session-refs" role="group" aria-label="' + (state.lang === 'en' ? 'Referenced sessions' : '引用的内容') + '">' + refs.map(function (row) {
      var artifact = row.kind === 'artifact';
      var table = artifact && (row.type === '数据表' || row.type === 'Table');
      return '<span class="cui-session-ref" data-session-reference="' + esc(row.id) + '" title="' + esc(row.path || row.name + ' · ' + row.id) + '"><button type="button" class="cui-reference-open" data-cui-reference-open="' + esc(row.id) + '" data-reference-kind="' + esc(row.kind || 'session') + '" aria-label="' + esc('预览引用：' + row.name) + '"><span class="cui-session-ref-icon' + (table ? ' is-table' : '') + '">' + window.AIOpsContext.icon(row) + '</span><span class="cui-session-ref-label">' + esc(row.name) + '</span></button>' + (editable ? '<button type="button" data-cui-session-remove="' + esc(row.id) + '" aria-label="' + esc((state.lang === 'en' ? 'Remove ' : '移除引用：') + row.name) + '">' + lucideIcon('x') + '</button>' : '') + '</span>';
    }).join('') + '</div>';
  }

  function openSessionDetail(id) {
    if (!sessionRows().some(function (row) { return row.id === id; })) return;
    var body = document.querySelector('.page.is-sessions .table-body');
    if (body) state.sessionListScroll = { left: body.scrollLeft, top: body.scrollTop };
    state.sessionViewId = id;
    window.AIOpsResources.open('session', sessionRows().filter(function (row) { return row.id === id; })[0]);
    render({ resetScroll: true });
  }

  function closeSessionDetail() {
    var scroll = state.sessionListScroll || { left: 0, top: 0 };
    state.sessionViewId = null;
    render({ resetScroll: true });
    var body = document.querySelector('.page.is-sessions .table-body');
    if (body) { body.scrollLeft = scroll.left; body.scrollTop = scroll.top; }
    syncSessionShades();
  }

  function compactSessions() {
    var rows = filteredSessionRows();
    return '<div class="page-heading"><h1>' + esc(t('线上会话')) + '</h1></div><div class="resource-list-controls">' + sessionSearchControl() + sessionDateControl() + scopeButton() + '</div><div class="resource-list-scroll">' + (rows.length ? rows.map(function (row) {
      return '<div class="resource-list-item' + (state.sessionViewId === row.id ? ' is-active' : '') + '" role="button" tabindex="0" data-session-view="' + esc(row.id) + '" aria-label="' + esc('查看会话：' + row.name) + '"><div><strong title="' + esc(row.name) + '">' + esc(row.name) + '</strong></div><button type="button" class="resource-icon" data-session-more="' + esc(row.id) + '" aria-label="' + esc(row.name + '的更多操作') + '" aria-haspopup="menu">' + lucideIcon('ellipsis') + '</button></div>';
    }).join('') : '<div class="sd-empty">' + (state.lang === 'en' ? 'No matching sessions' : '没有匹配的会话') + '</div>') + '</div>';
  }
  function closeSessionActions(restoreFocus) {
    var menu = document.getElementById('sessionActionsMenu');
    if (!menu) return;
    var anchor = menu.sessionAnchor;
    closeSessionMark();
    menu.remove();
    if (anchor && anchor.isConnected) {
      anchor.setAttribute('aria-expanded', 'false');
      if (restoreFocus) anchor.focus({ preventScroll: true });
    }
  }
  function sessionActionsMenu(id, anchor) {
    var old = document.getElementById('sessionActionsMenu');
    var same = old && old.sessionAnchor === anchor;
    closeSessionActions(); closeSessionMark();
    if (same) return;
    var menu = document.createElement('div'); menu.id = 'sessionActionsMenu'; menu.className = 'cap-menu cap-art-action-menu'; menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', state.lang === 'en' ? 'Session actions' : '会话操作');
    menu.sessionAnchor = anchor;
    menu.innerHTML = '<button type="button" role="menuitem" data-session-mark="' + esc(id) + '" aria-haspopup="menu" aria-expanded="false" aria-controls="sessionMarkMenu">' + lucideIcon('tag') + esc(t('标记')) + '<span class="session-submenu-arrow">' + lucideIcon('chevron-right') + '</span></button><button type="button" role="menuitem" data-session-analyze="' + esc(id) + '">' + lucideIcon('sparkles') + esc(t('AI分析')) + '</button>';
    document.body.appendChild(menu); var r = anchor.getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8)) + 'px'; paintIcons(); anchor.setAttribute('aria-expanded', 'true'); menu.querySelector('button').focus();
  }
  document.addEventListener('pointerover', function (e) {
    var item = e.target.closest('#sessionActionsMenu > [role="menuitem"]');
    if (!item) return;
    if (item.hasAttribute('data-session-mark')) openSessionMark([item.getAttribute('data-session-mark')], item, false);
    else closeSessionMark();
  });

  function pageSessions() {
    if (state.sessionViewId && window.AIOpsSessionDetail) {
      var detailRow = sessionRows().filter(function (row) { return row.id === state.sessionViewId; })[0];
      if (detailRow) return window.AIOpsResources.shell('session', compactSessions(), window.AIOpsSessionDetail.page(detailRow, true));
      state.sessionViewId = null;
    }
    var rows = filteredSessionRows();
    var pageSize = 20;
    var pages = Math.max(1, Math.ceil(rows.length / pageSize));
    var page = Math.min(Math.max(state.sessionPage || 1, 1), pages);
    state.sessionPage = page;
    var visible = rows.slice((page - 1) * pageSize, page * pageSize);
    var header = '<div class="page-heading has-actions session-list-head"><h1>' + esc(t('线上会话')) + '</h1>' +
        '<div class="session-heading-actions">' +
          sessionSearchControl() +
          '<div class="session-filters">' + sessionDateControl() + scopeButton() + '</div>' +
        '</div></div>';
    if (!rows.length) return header + '<div class="session-list-empty" role="status"><p>' + (state.lang === 'en' ? 'No matching sessions' : '没有匹配的会话') + '</p><button type="button" class="btn-soft" data-session-filters-clear>' + (state.lang === 'en' ? 'Reset filters' : '重置筛选') + '</button></div>';
    return (
      header +
      '<div class="table-wrap">' +
        '<div class="table-body">' +
          '<table class="data-table"><colgroup><col style="width:3%"><col style="width:17%"><col style="width:12%"><col style="width:11%"><col style="width:8%"><col style="width:4.5%"><col style="width:8%"><col style="width:4.5%"><col style="width:6%"><col style="width:7%"><col style="width:10%"><col style="width:9%"></colgroup>' +
            '<thead><tr>' +
              '<th class="session-check"><input type="checkbox" data-session-select="all" aria-label="' + esc(t('选择全部会话')) + '">' +
                '<span class="session-col-shade is-left" aria-hidden="true"></span></th>' +
              sessionColumnHeading('name', false) + sessionColumnHeading('agent', true) + sessionColumnHeading('time', false) + sessionColumnHeading('user', true) +
              sessionColumnHeading('messages', false) + sessionColumnHeading('tokens', false) + sessionColumnHeading('warnings', false) + sessionColumnHeading('mark', true) +
              sessionColumnHeading('by', true) + sessionColumnHeading('markedAt', false) + '<th scope="col">' + esc(t('操作')) +
                '<span class="session-col-shade is-right" aria-hidden="true"></span></th>' +
            '</tr></thead>' +
            '<tbody>' + visible.map(sessionRowHtml).join('') + '</tbody>' +
          '</table>' +
        '</div>' +
        sessionPager(page, pages, rows.length) +
      '</div>' + sessionBulkBar()
    );
  }

  function pageArtifacts() {
    if (window.AIOpsCapability) return window.AIOpsCapability.artifactsPage();
    return heading(t('产出物'));
  }

  function pageCost() {
    return (
      headingWithRange(t('成本分析')) +
      (window.AIOpsBoards ? window.AIOpsBoards.costPage() : scaffoldNote())
    );
  }

  function pageHealth() {
    return (
      '<div class="analysis-sticky-chrome">' +
        headingWithRange(t('健康度分析')) +
      '</div>' +
      (window.AIOpsBoards ? window.AIOpsBoards.healthPage() : scaffoldNote())
    );
  }

  function pageBehavior() {
    return (
      headingWithRange(t('用户行为分析')) +
      (window.AIOpsBoards ? window.AIOpsBoards.behaviorPage() : scaffoldNote())
    );
  }

  function pageCustomDash() {
    return (
      heading(t('自定义看板'), t('自定义看板副')) +
      '<div class="tool-row end"><button type="button" class="btn-ink">' + lucideIcon('plus') +
        ' ' + esc(t('新建看板')) + '</button></div>' +
      '<div class="dash-grid">' +
        '<button type="button" class="dash-card"><span class="dash-tag">' + esc(t('自定义')) +
        '</span><strong>' + esc(t('关账业务效果')) + '</strong><span class="muted">' +
        esc(t('关账描述')) + '</span><span class="dash-meta">' + esc(t('指标数6')) +
        '</span></button>' +
        '<button type="button" class="dash-card"><span class="dash-tag">' + esc(t('自定义')) +
        '</span><strong>' + esc(t('销售分货健康度')) + '</strong><span class="muted">' +
        esc(t('销售描述')) + '</span><span class="dash-meta">' + esc(t('指标数4')) +
        '</span></button>' +
      '</div>' +
      scaffoldNote()
    );
  }

  function pageNotify() {
    var items = [
      { type: t('审批'), title: t('规则变更待审批'), time: t('今天') + ' 18:20', unread: true },
      { type: t('严重问题'), title: t('采购 Agent 连续失败'), time: t('今天') + ' 18:21', unread: true },
      { type: t('告警'), title: t('慢响应轮次率升高'), time: t('今天') + ' 17:58', unread: true }
    ];
    return (
      '<div class="notify-head">' +
        heading(t('消息通知'), '') +
        '<button type="button" class="btn-soft">' + esc(t('全部标为已读')) + '</button>' +
      '</div>' +
      '<div class="card-list">' +
        items.map(function (n) {
          return (
            '<article class="list-card' + (n.unread ? ' is-unread' : '') + '">' +
              '<div><span class="pill">' + esc(n.type) + '</span><h3>' + esc(n.title) +
              '</h3><p class="muted">' + esc(n.time) + '</p></div>' +
              '<button type="button" class="btn-soft">' + esc(t('查看')) + '</button>' +
            '</article>'
          );
        }).join('') +
      '</div>' +
      scaffoldNote()
    );
  }

  function detailFacts(rows) {
    return (
      '<section class="panel"><dl class="detail-facts">' +
        rows
          .map(function (row) {
            return '<dt>' + esc(row[0]) + '</dt><dd>' + esc(row[1]) + '</dd>';
          })
          .join('') +
      '</dl></section>'
    );
  }

  function pageScheduleSession(name) {
    var runs = scheduleRuns().filter(function (item) { return item.page === name; });
    var run = null;
    runs.forEach(function (item) {
      if (item.id === state.scheduleRun) run = item;
    });
    if (!run) run = runs[0];
    if (!run) return heading(t(name), t('工作区骨架')) + scaffoldNote();
    return (
      '<button type="button" class="btn-soft detail-back" data-page="定时任务">' + esc(t('返回')) + '</button>' +
      heading(t(name), run.time) +
      detailFacts([
        [t('状态'), t(run.status)],
        [t('执行时间'), run.time],
        [t('说明'), t(run.desc)]
      ])
    );
  }

  function pageArtifactDetail() {
    var item = null;
    artifactItems().forEach(function (row) {
      if (row.id === state.artifactId) item = row;
    });
    if (!item) return pageArtifacts();
    return (
      '<button type="button" class="btn-soft detail-back" data-page="产出物">' + esc(t('返回')) + '</button>' +
      heading(item.name, item.type) +
      detailFacts([
        [t('类型'), item.type],
        [t('更新时间'), item.time],
        [t('说明'), item.desc]
      ])
    );
  }

  function pickLang(row) {
    if (!row) return '';
    return state.lang === 'en' ? row.en : row.zh;
  }

  var WS_CHATS = {
    '制造业规则被否决原因': {
      user: {
        zh: '帮我看看制造业规则为什么会被否决，是不是集中在某几条规则上。',
        en: 'Look at why manufacturing rules were rejected, and whether it clusters on a few rules.'
      },
      secs: 2,
      cost: '1.2',
      time: '16:40',
      steps: [
        { zh: '先看看工作区里有没有和规则否决相关的会话或产出物。', en: 'Check the workspace for sessions or files about rejected rules.' },
        { items: [
          { zh: '已检索线上会话', en: 'Searched live sessions', details: [
            { zh: '制造业规则适用范围确认', en: 'Manufacturing rule scope check' }
          ]},
          { zh: '已核对产出物', en: 'Checked artifacts', details: [
            { zh: '制造业规则被否决原因 · Feng Zhu · 10 月 12 日', en: 'Manufacturing rule rejections · Feng Zhu · Oct 12' }
          ]}
        ]}
      ],
      answer: [
        {
          zh: '最近被否决的并不散，主要集中在适用范围，不是规则条文写错。10 月 12 日 Feng Zhu 整理的文档里，被打回的核验项多是「物料类型不在规则覆盖范围」和「组织未启用该规则」。',
          en: 'Rejections cluster on scope, not on bad rule text. In Feng Zhu’s Oct 12 note, most bounced checks are “material type outside the rule” or “org has not enabled this rule.”'
        },
        {
          zh: '我先把范围定下来：要按规则汇总，还是按否决原因汇总？时间用最近一次关账，还是 10 月整月？',
          en: 'Two things to pin down: summarize by rule, or by rejection reason? Last close, or all of October?'
        }
      ]
    },
    '10 月 9 日成本峰值排查': {
      user: {
        zh: '10 月 9 日成本突然升高，帮我看是哪类调用拉起来的。',
        en: 'Cost jumped on Oct 9. Which kind of calls drove it?'
      },
      secs: 3,
      cost: '2.4',
      time: '11:06',
      steps: [
        { zh: '先对一下 10 月 9 日前后的 token 消耗和失败重试。', en: 'Compare token use and failed retries around Oct 9.' },
        { items: [
          { zh: '已检索成本分析', en: 'Searched cost analysis', details: [
            { zh: '当日消耗明显高于前后两天', en: 'That day is well above the days around it' }
          ]},
          { zh: '已核对线上会话', en: 'Checked live sessions', details: [
            { zh: '关账检查清单执行、规则批量重跑', en: 'Close checklist, bulk rule rerun' }
          ]}
        ]}
      ],
      answer: [
        {
          zh: '峰值主要来自关账检查的批量重跑，不是新会话变多。失败后的自动重试把同一批核验项又跑了一遍，token 消耗大约是平日的两倍。',
          en: 'The spike is bulk reruns of the close check, not more new sessions. Automatic retries ran the same checks again, about twice a normal day’s tokens.'
        },
        {
          zh: '要继续拆的话，我可以按 Agent、按会话，或者只看失败重试。你想先看哪一块？',
          en: 'I can split this by agent, by session, or by failed retries only. Which first?'
        }
      ]
    },
    '高频重复提问与用户反馈': {
      user: {
        zh: '用户是不是在反复问同一类问题？把高频问题和反馈对一下。',
        en: 'Are people asking the same thing over and over? Line that up with the feedback.'
      },
      secs: 2,
      cost: '0.8',
      time: '15:22',
      steps: [
        { zh: '先按问题意图归一下近期会话，再对用户标记和反馈。', en: 'Group recent sessions by intent, then match marks and feedback.' },
        { items: [
          { zh: '已检索线上会话', en: 'Searched live sessions', details: [
            { zh: '重复意图集中在规则适用范围和关账进度', en: 'Repeats cluster on rule scope and close progress' }
          ]},
          { zh: '已核对用户反馈', en: 'Checked user feedback', details: [
            { zh: '慢响应、回答没有给出来源', en: 'Slow replies, answers without a source' }
          ]}
        ]}
      ],
      answer: [
        {
          zh: '重复提问主要是两类：规则能不能用在这家工厂，以及这次关账走到哪一步了。反馈里对应的是回答太慢，以及没有点出依据。',
          en: 'Repeats are two intents: can this rule apply at this plant, and where is this close. Feedback matches that: replies were slow, and they didn’t cite a source.'
        },
        {
          zh: '要往下看的话，我可以列出重复最多的原话，或者只看被标过的会话。你更想先看哪边？',
          en: 'Next I can list the most repeated wording, or only the marked sessions. Which do you want?'
        }
      ]
    },
    '两会话问题复盘': {
      user: {
        zh: '把最近两段有问题的会话放在一起看，问题是不是同一类。',
        en: 'Put the two recent problem sessions side by side. Is it the same issue?'
      },
      secs: 2,
      cost: '1.6',
      time: '18:05',
      steps: [
        { zh: '先找出有警告的会话，对比输入和后续追问。', en: 'Find the sessions with warnings and compare the follow-ups.' },
        { items: [
          { zh: '已检索线上会话', en: 'Searched live sessions', details: [
            { zh: '制造业规则适用范围确认、关账检查清单执行', en: 'Rule scope check, close checklist' }
          ]},
          { zh: '已对比追问', en: 'Compared follow-ups', details: [
            { zh: '两段都在规则命中后追问「为什么被否决」', en: 'Both follow up with “why was this rejected” after a rule hit' }
          ]}
        ]}
      ],
      answer: [
        {
          zh: '两段会话卡在同一处：规则命中之后没有把否决原因讲清楚，用户又追问了一轮。不是两个独立故障。',
          en: 'Both stall in the same place: after a rule hits, the rejection reason isn’t clear, so the user asks again. Not two separate faults.'
        },
        {
          zh: '复盘可以按「缺了哪条依据」来写，也可以按「用户追问了什么」来写。你要哪一种？',
          en: 'The write-up can follow the missing evidence, or the user’s follow-up questions. Which one?'
        }
      ]
    }
  };

  function wsActivityChevron() {
    return '<svg class="activity-hover-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4.5 10 8 6 11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function wsCollapse(inner) {
    return '<div class="collapse"><div class="collapse-clip"><div class="collapse-content">' + inner + '</div></div></div>';
  }

  function wsDetailRows(details) {
    return '<div class="activity-details">' + details.map(function (line) {
      return '<div class="activity-row detail"><span>' + esc(pickLang(line)) + '</span></div>';
    }).join('') + '</div>';
  }

  function wsActivityGroup(items) {
    var joiner = state.lang === 'en' ? ', ' : '、';
    var summary = items.map(function (item) { return pickLang(item); }).join(joiner);
    var children = items.map(function (item) {
      var details = item.details || [];
      if (!details.length) {
        return '<div class="activity-row nested"><span>' + esc(pickLang(item)) + '</span></div>';
      }
      if (items.length === 1) return wsDetailRows(details);
      return '<div>' +
        '<button type="button" class="activity-row nested" data-ws-activity aria-expanded="false">' +
          '<span>' + esc(pickLang(item)) + '</span>' + wsActivityChevron() +
        '</button>' +
        wsCollapse(wsDetailRows(details)) +
      '</div>';
    }).join('');
    return '<div class="activity-block">' +
      '<button type="button" class="activity-row" data-ws-activity aria-expanded="false">' +
        '<span>' + esc(summary) + '</span>' + wsActivityChevron() +
      '</button>' +
      wsCollapse('<div class="activity-composite tool-summary-items">' + children + '</div>') +
    '</div>';
  }

  function wsTurnFoot(cost, time) {
    var en = state.lang === 'en';
    var groups = [
      [
        [en ? 'Copy' : '复制', 'copy'],
        [en ? 'Helpful' : '有帮助', 'thumbs-up'],
        [en ? 'Not helpful' : '没帮助', 'thumbs-down']
      ],
      [
        [en ? 'Regenerate' : '重新生成', 'rotate-ccw'],
        [en ? 'Share' : '分享', 'share']
      ],
      [
        [en ? 'More' : '更多', 'ellipsis']
      ]
    ];
    function iconBtn(item) {
      var copy = item[1] === 'copy' ? ' data-ws-copy' : '';
      return '<button type="button" class="ao-icon-btn" title="' + esc(item[0]) + '" aria-label="' + esc(item[0]) + '"' + copy + '>' +
        lucideIcon(item[1]) + '</button>';
    }
    var actions = groups.map(function (group, i) {
      return (i ? '<span class="ao-turn-actions-sep" aria-hidden="true"></span>' : '') + group.map(iconBtn).join('');
    }).join('');
    return '<div class="ao-turn-foot">' +
      '<div class="ao-turn-actions">' + actions + '</div>' +
      '<div class="ao-turn-foot-meta">' +
        '<span>' + esc(cost) + '</span>' +
        '<span class="ao-turn-foot-dot" aria-hidden="true"></span>' +
        '<span>AgentOS</span>' +
        '<span class="ao-turn-foot-dot" aria-hidden="true"></span>' +
        '<span>' + esc(time) + '</span>' +
      '</div>' +
    '</div>';
  }

  function wsChatTurn(chat) {
    var elapsed = state.lang === 'en' ? chat.secs + 's' : '用时 ' + chat.secs + '秒';
    var steps = (chat.steps || []).map(function (step) {
      if (step.items) return wsActivityGroup(step.items);
      return '<div class="answer">' + esc(pickLang(step)) + '</div>';
    }).join('');
    var paras = (chat.answer || []).map(function (p) {
      return '<p>' + esc(pickLang(p)) + '</p>';
    }).join('');
    var cost = state.lang === 'en' ? chat.cost + ' used' : '共消耗 ' + chat.cost;
    return (
      '<div class="chat-msg-assistant">' +
        '<div class="ao-turn">' +
          '<div class="ao-process">' +
            '<div class="status-row done">' +
              '<button type="button" class="ghost-btn" data-ws-process aria-expanded="false">' +
                esc(elapsed) +
                '<span class="status-chevron closed" aria-hidden="true">' +
                  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
                    '<path d="M4 6.5 8 10.5 12 6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
                  '</svg>' +
                '</span>' +
              '</button>' +
            '</div>' +
            '<div class="collapse process-collapse">' +
              '<div class="collapse-clip"><div class="collapse-content">' +
                '<div class="process-viewport"><div class="process-items">' + steps + '</div></div>' +
              '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="ao-answer chat-prose"><div class="chat-md">' + paras + '</div></div>' +
          wsTurnFoot(cost, chat.time) +
        '</div>' +
      '</div>'
    );
  }

  function spaceName() {
    var el = document.getElementById('teamName');
    return (el && el.textContent.trim()) || '企业全景';
  }

  var CUI_MODELS = [
    'Auto',
    'deepseek-v4-pro',
    'MiniMax-M3',
    'qwen3.7-max',
    'kimi-k2.7-code',
    'kimi-k3',
    'glm-5.3',
    'glm-5.3-flash',
    'deepseek-v4-flash',
    'deepseek-v4.1-flash-free',
    'qwen3.8-flash'
  ];
  var CUI_INTENSITIES = ['Default', 'Low', 'Medium', 'High'];
  var cuiModelMenu = null;
  var cuiModelKind = 'model';

  function cuiModelSummary() {
    return state.cuiModel === 'Auto' ? 'Auto' : state.cuiModel + ' ' + state.cuiIntensity;
  }

  function cuiModelControl() {
    var chevDown = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    var chevRight = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
    return (
      '<div class="cui-model" id="cui-model">' +
        '<button type="button" class="cui-model-trigger" id="cui-model-trigger" aria-haspopup="dialog" aria-expanded="false">' +
          '<span class="cui-model-summary" id="cui-model-summary">' + esc(cuiModelSummary()) + '</span>' +
          chevDown +
        '</button>' +
        '<div class="cui-model-panel" id="cui-model-panel" hidden>' +
          '<button type="button" class="cui-model-row" data-cui-model-open="model">' +
            '<span class="cui-model-row-label">Model</span>' +
            '<span class="cui-model-row-value"><span id="cui-model-value">' + esc(state.cuiModel) + '</span>' + chevRight + '</span>' +
          '</button>' +
          '<button type="button" class="cui-model-row" data-cui-model-open="intensity">' +
            '<span class="cui-model-row-label">Reasoning</span>' +
            '<span class="cui-model-row-value"><span id="cui-intensity-value">' + esc(state.cuiIntensity) + '</span>' + chevRight + '</span>' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }

  function ensureCuiModelMenu() {
    if (cuiModelMenu && cuiModelMenu.isConnected) return cuiModelMenu;
    cuiModelMenu = document.createElement('div');
    cuiModelMenu.className = 'cui-model-menu';
    cuiModelMenu.id = 'cui-model-menu';
    cuiModelMenu.setAttribute('role', 'menu');
    cuiModelMenu.hidden = true;
    document.body.appendChild(cuiModelMenu);
    return cuiModelMenu;
  }

  function syncCuiModelView() {
    var summary = document.getElementById('cui-model-summary');
    var modelValue = document.getElementById('cui-model-value');
    var intensityValue = document.getElementById('cui-intensity-value');
    var trigger = document.getElementById('cui-model-trigger');
    var panel = document.getElementById('cui-model-panel');
    if (summary) summary.textContent = cuiModelSummary();
    if (modelValue) modelValue.textContent = state.cuiModel;
    if (intensityValue) intensityValue.textContent = state.cuiIntensity;
    if (trigger) trigger.setAttribute('aria-expanded', panel && !panel.hidden ? 'true' : 'false');
    if (panel) {
      var menuOpen = cuiModelMenu && !cuiModelMenu.hidden;
      panel.querySelectorAll('[data-cui-model-open]').forEach(function (row) {
        row.classList.toggle('is-active', !panel.hidden && menuOpen && row.getAttribute('data-cui-model-open') === cuiModelKind);
      });
    }
  }

  function cuiModelPointerInBridge(e) {
    var panel = document.getElementById('cui-model-panel');
    if (!panel || panel.hidden || !cuiModelMenu || cuiModelMenu.hidden) return false;
    var pr = panel.getBoundingClientRect();
    var mr = cuiModelMenu.getBoundingClientRect();
    var top = Math.min(pr.top, mr.top);
    var bottom = Math.max(pr.bottom, mr.bottom);
    return e.clientX >= mr.right - 1 && e.clientX <= pr.left + 1 && e.clientY >= top && e.clientY <= bottom;
  }

  function hideCuiModelSubmenu() {
    if (cuiModelMenu) cuiModelMenu.hidden = true;
    var panel = document.getElementById('cui-model-panel');
    if (panel) {
      panel.querySelectorAll('.cui-model-row.is-active').forEach(function (row) {
        row.classList.remove('is-active');
      });
    }
  }

  function alignCuiModelMenu() {
    var panel = document.getElementById('cui-model-panel');
    var menu = cuiModelMenu;
    if (!panel || !menu || menu.hidden || panel.hidden) return;
    var row = panel.querySelector('[data-cui-model-open="' + cuiModelKind + '"]');
    if (!row) return;
    var panelRect = panel.getBoundingClientRect();
    var rowRect = row.getBoundingClientRect();
    menu.style.visibility = 'hidden';
    menu.hidden = false;
    var menuWidth = menu.offsetWidth || 200;
    var menuHeight = menu.offsetHeight || 0;
    var top = rowRect.top;
    var maxTop = window.innerHeight - menuHeight - 8;
    if (top > maxTop) top = Math.max(8, maxTop);
    var left = panelRect.left - menuWidth - 4;
    if (left < 8) left = 8;
    menu.style.top = Math.round(top) + 'px';
    menu.style.left = Math.round(left) + 'px';
    menu.style.right = 'auto';
    menu.style.visibility = '';
  }

  function closeCuiModel() {
    var panel = document.getElementById('cui-model-panel');
    var trigger = document.getElementById('cui-model-trigger');
    if (panel) panel.hidden = true;
    if (cuiModelMenu) {
      cuiModelMenu.hidden = true;
      cuiModelMenu.style.top = '';
      cuiModelMenu.style.left = '';
      cuiModelMenu.style.right = '';
      cuiModelMenu.style.visibility = '';
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (panel) {
      panel.querySelectorAll('.cui-model-row.is-active').forEach(function (row) {
        row.classList.remove('is-active');
      });
    }
  }

  function renderCuiModelMenu(kind) {
    cuiModelKind = kind || cuiModelKind || 'model';
    var menu = ensureCuiModelMenu();
    var items = cuiModelKind === 'model' ? CUI_MODELS : CUI_INTENSITIES;
    var current = cuiModelKind === 'model' ? state.cuiModel : state.cuiIntensity;
    var check = '<svg class="cui-model-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    menu.innerHTML = items.map(function (item) {
      var selected = item === current;
      return (
        '<button type="button" class="cui-model-option' + (selected ? ' is-selected' : '') + '" role="menuitemradio" aria-checked="' + (selected ? 'true' : 'false') + '" data-value="' + esc(item) + '">' +
          '<span>' + esc(item) + '</span>' +
          (selected ? check : '') +
        '</button>'
      );
    }).join('');
    menu.hidden = false;
    syncCuiModelView();
    alignCuiModelMenu();
  }

  function openCuiModel() {
    var panel = document.getElementById('cui-model-panel');
    if (!panel) return;
    closeNewMenu();
    closeTeam();
    closeAcct();
    panel.hidden = false;
    hideCuiModelSubmenu();
    var trigger = document.getElementById('cui-model-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function handleCuiModelClick(e) {
    if (!e.target.closest) return false;
    var trigger = e.target.closest('#cui-model-trigger');
    var inPicker = e.target.closest('#cui-model') || e.target.closest('#cui-model-menu');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      var panel = document.getElementById('cui-model-panel');
      if (panel && !panel.hidden) closeCuiModel();
      else openCuiModel();
      return true;
    }
    var option = e.target.closest('.cui-model-option');
    if (option && option.closest('#cui-model-menu')) {
      e.preventDefault();
      e.stopPropagation();
      var value = option.getAttribute('data-value');
      if (value) {
        if (cuiModelKind === 'model') state.cuiModel = value;
        else state.cuiIntensity = value;
        renderCuiModelMenu(cuiModelKind);
      }
      return true;
    }
    if (!inPicker) closeCuiModel();
    return !!inPicker;
  }

  function composerSeed(page) {
    return page === '分析任务' ? state.cuiSeed : state.cuiDrafts[page];
  }

  function saveComposerDraft(page, prompt, parts) {
    var seed = composerSeed(page) || { page: page, prompt: '', skill: '', sessionRefs: [] };
    seed.prompt = prompt;
    if (parts) seed.parts = parts;
    else if (seed.parts && window.AIOpsComposer.textOf(seed.parts) !== prompt) seed.parts = null;
    if (page === '分析任务') state.cuiSeed = seed;
    else state.cuiDrafts[page] = seed;
    return seed;
  }

  function referenceInConversation(refs, prompt) {
    var form = isCuiPage() && document.querySelector('#pageRoot [data-cui-composer]');
    if (!form) return false;
    var field = form.querySelector('.cui-input');
    var seed = saveComposerDraft(form.getAttribute('data-cui-page'), window.AIOpsComposer.text(field), window.AIOpsComposer.parts(field));
    seed.sessionRefs = (seed.sessionRefs || []).slice();
    refs.forEach(function (ref) {
      if (!seed.sessionRefs.some(function (item) { return item.id === ref.id && (item.kind || 'session') === (ref.kind || 'session'); })) seed.sessionRefs.push(ref);
    });
    if (prompt && seed.prompt.indexOf(prompt) < 0) {
      var added = (seed.prompt.trim() ? '\n' : '') + prompt;
      seed.prompt += added;
      seed.parts.push({ type: 'text', text: added });
    }
    state.cuiFocus = true;
    render({ keepRailBody: true });
    return true;
  }

  function cuiComposer(page, draft) {
    var seed = composerSeed(page);
    var prompt = seed ? seed.prompt : draft != null ? draft : '';
    var refs = seed && seed.sessionRefs ? seed.sessionRefs : [];
    return (
      '<form class="cui-composer" data-cui-composer data-cui-page="' + esc(page) + '">' +
        '<div class="cui-card' + (prompt.trim() || refs.length ? ' has-text' : '') + '">' +
          sessionReferenceHtml(refs, true) +
          '<div class="cui-input" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="' + esc(t('对话占位')) + '" aria-label="' + esc(t('对话占位')) + '">' + window.AIOpsComposer.html(prompt, seed && seed.parts) + '</div>' +
            '<div class="cui-toolbar">' +
            '<div class="cui-toolbar-left">' +
              '<button type="button" class="cui-plus" data-cui-context-open aria-label="' + esc(t('添加')) + '">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
              '</button>' +
              '<button type="button" class="cui-plus" data-cui-upload aria-label="' + esc(t('上传')) + '">' +
                '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11.5-8.6 8.6a5.2 5.2 0 0 1-7.4-7.4l8.8-8.8a3.5 3.5 0 0 1 4.9 4.9l-8.8 8.8a1.8 1.8 0 0 1-2.5-2.5l8.1-8.1"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="cui-toolbar-right">' +
              cuiModelControl() +
              '<button type="button" class="cui-token" aria-label="Context usage">' +
                '<svg width="18" height="18" viewBox="0 0 20 20">' +
                  '<circle cx="10" cy="10" r="7.2" fill="none" stroke="#e6e6e6" stroke-width="2.2"/>' +
                  '<circle cx="10" cy="10" r="7.2" fill="none" stroke="#8c8c8c" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="6.8 38.4" transform="rotate(-90 10 10)"/>' +
                '</svg>' +
              '</button>' +
              '<button type="submit" class="cui-send" aria-label="' + esc(t('发送消息')) + '">' +
                '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M9 13.5V4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.25 8.25 9 4.5 12.75 8.25" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</form>'
    );
  }

  function cuiWsName() {
    return window.AIOpsWorkspaces.name(state.cuiWs);
  }

  function cuiHero() {
    var check = '<svg class="cui-ws-check" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2.5 6.3L5 8.8l4.5-5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var items = window.AIOpsWorkspaces.choices();
    var menu = '<div class="cui-ws-menu" id="cui-ws-menu" role="menu" hidden>' +
      items.map(function (item, index) {
        var on = (state.cuiWs || 'audit') === item.id;
        return '<button type="button" class="cui-ws-option' + (on ? ' is-on' : '') + '" role="menuitemradio" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(item.label) + '" aria-describedby="cui-ws-tooltip-' + index + '" data-cui-ws="' + item.id + '">' +
          '<span class="cui-ws-option-label">' + esc(item.label) + '</span>' +
          (on ? check : '') +
          '<span class="metric-tooltip cui-ws-tooltip" role="tooltip" id="cui-ws-tooltip-' + index + '">' + esc(item.label) + '</span>' +
        '</button>';
      }).join('') +
      '<div class="cui-ws-divider" role="separator"></div><button type="button" class="cui-ws-option cui-ws-create" role="menuitem" data-cui-ws-create><i data-lucide="plus" aria-hidden="true"></i><span>' + esc(t('新建工作区')) + '</span></button>' +
    '</div>';
    var name = '<span class="cui-ws-wrap"><button type="button" class="cui-ws" id="cui-ws" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(t('切换工作区')) + '">' + lucideIcon('folder-closed') + '<span class="cui-ws-label">' + esc(cuiWsName()) + '</span>' + lucideIcon('chevron-down') + '</button>' + menu + '</span>';
    var line = '<span>' + esc(t('分析问候前').trim()) + '</span>' + name + '<span>' + esc(t('分析问候后').trim()) + '</span>';
    return '<div class="cui-hero"><h1>' + line + '</h1></div>';
  }

  function cuiShell(page, started, threadHtml, options) {
    options = options || {};
    var title = options.title || (started ? t(page) : t('新任务'));
    return (
      '<div class="cui">' +
        '<header class="cui-head">' + (options.back || '') + '<h1 class="cui-head-title" title="' + esc(title) + '">' + esc(title) + '</h1>' +
          '<button type="button" class="ws-btn" id="toggle-right-rail" aria-label="Open agent panel" aria-pressed="false">' +
            '<svg class="ws-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M15 4.5v15"/></svg>' +
          '</button></header>' +
        '<div class="cui-stage' + (started ? ' is-started' : '') + '">' +
          '<div class="cui-wrap">' +
            cuiHero() +
            '<div class="cui-thread"><div class="cui-scroll"><div class="chat-thread">' + threadHtml + '</div></div></div>' +
            cuiComposer(page, options.draft) +
            '<div class="cui-spacer" aria-hidden="true"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function userBubble(text, refs) {
    return '<div class="chat-msg-user"><div class="chat-bubble-user">' + sessionReferenceHtml(refs, false) + esc(text) + '</div></div>';
  }

  function sessionThread(name) {
    var chat = WS_CHATS[name];
    if (!chat) return '';
    var html = userBubble(pickLang(chat.user), chat.sessionRefs) + wsChatTurn(chat);
    (state.cuiExtra[name] || []).forEach(function (extra) {
      html += userBubble(extra.user, extra.sessionRefs) + wsChatTurn(extra.chat);
    });
    return html;
  }

  function clockNow() {
    var now = new Date();
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return pad(now.getHours()) + ':' + pad(now.getMinutes());
  }

  function clipText(text, max) {
    var clean = String(text).replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max) + '…';
  }

  function replyChat(userText, first) {
    var quoted = clipText(userText, 42);
    if (first) {
      return {
        secs: 2,
        cost: '0.6',
        time: clockNow(),
        steps: [
          { zh: '先看看工作区里有没有和这次分析相关的会话或素材。', en: 'Check the workspace for sessions or files related to this analysis.' },
          { items: [
            { zh: '已检索工作区', en: 'Searched the workspace', details: [
              { zh: '线上会话暂无直接对应，产出物暂无直接对应', en: 'No matching live session, no matching artifact' }
            ]},
            { zh: '已检索知识库', en: 'Searched the knowledge base', details: [
              { zh: '知识库中没有相关文档', en: 'No related document in the knowledge base' }
            ]}
          ]}
        ],
        answer: [
          {
            zh: '明白了，你想做一次分析：' + quoted + '。工作区里还没有现成结果，我先把范围定下来。',
            en: 'You want an analysis: ' + quoted + '. Nothing in the workspace covers it yet, so I’ll pin the scope first.'
          },
          {
            zh: '这次主要看哪一段？最近一次关账，还是你指定的日期？结果要按规则汇总，还是按会话展开？',
            en: 'Which window: the last close, or dates you name? Summarize by rule, or expand by session?'
          }
        ]
      };
    }
    return {
      secs: 2,
      cost: '0.4',
      time: clockNow(),
      steps: [
        { zh: '先按你刚说的，对一下工作区里已有的会话和产出物。', en: 'Check existing sessions and artifacts against what you just said.' },
        { items: [
          { zh: '已检索工作区', en: 'Searched the workspace', details: [
            { zh: '线上会话、产出物', en: 'Live sessions, artifacts' }
          ]},
          { zh: '已检索知识库', en: 'Searched the knowledge base', details: [
            { zh: '知识库中没有更近的文档', en: 'No closer document in the knowledge base' }
          ]}
        ]}
      ],
      answer: [
        { zh: '收到。我按「' + quoted + '」继续往下看。', en: 'Got it. I’ll keep going from “' + quoted + '”.' },
        {
          zh: '要收窄的话，告诉我时间范围，或者要按规则、按会话，还是按产出物来拆。',
          en: 'To narrow it, give a time range, or say whether to split by rule, session, or artifact.'
        }
      ]
    };
  }

  function taskTitle(text) {
    var title = clipText(text, 18).replace(/…$/, '');
    if (!title) title = state.lang === 'en' ? 'New analysis' : '新分析';
    var id = title;
    var n = 2;
    while (WS_CHATS[id] || isWsChild(id)) {
      id = title + ' ' + n;
      n += 1;
    }
    return id;
  }

  function startTask(text) {
    var id = taskTitle(text);
    WS_CHATS[id] = replyChat(text, true);
    WS_CHATS[id].user = { zh: text, en: text };
    var refs = state.cuiSeed && state.cuiSeed.sessionRefs ? state.cuiSeed.sessionRefs.slice() : [];
    WS_CHATS[id].sessionRefs = refs;
    if (refs.length) {
      WS_CHATS[id].steps = [{ zh: '已关联 ' + refs.length + ' 份引用内容', en: 'Linked ' + refs.length + ' references', details: refs.map(function (row) { return { zh: row.name + ' · ' + row.id, en: row.name + ' · ' + row.id }; }) }];
      WS_CHATS[id].answer = [{ zh: '已将所选内容作为本次任务的分析上下文。你可以补充关注的问题、时间范围或期望的输出。', en: 'The selected content is linked as context for this task. You can add a focus, date range, or desired output.' }];
    }
    window.AIOpsWorkspaces.addTask(state.cuiWs, { id: id, kind: 'session' });
    var draftRail = captureRailContext(), draftOwner = state.railOwner;
    state.cuiSeed = null;
    state.cuiFocus = true;
    go(id);
    restoreRailContext(draftRail);
    delete state.railContexts[draftOwner];
    syncRail();
  }

  function appendTurn(page, text, refs) {
    if (!state.cuiExtra[page]) state.cuiExtra[page] = [];
    state.cuiExtra[page].push({ user: text, sessionRefs: refs, chat: replyChat(text, false) });
    delete state.cuiDrafts[page];
    state.cuiFocus = true;
    render();
  }

  function pageWorkspaceChat(name) {
    var chat = WS_CHATS[name];
    if (!chat) return heading(t(name), t('工作区骨架')) + scaffoldNote();
    return cuiShell(name, true, sessionThread(name));
  }

  var RAIL_HOME = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/></svg>';
  var RAIL_FILE = '<svg class="ws-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8.5L14 3.5Z"/><path d="M14 3.5V8.5h4"/></svg>';
  var RAIL_MSG = '<svg class="ws-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17.5 4 20v-4.2A7.5 7.5 0 1 1 7 17.5Z"/></svg>';

  function railArts() {
    return window.AIOpsCapability.railArtifacts();
  }

  function railSessions() {
    return sessionRows().map(function (row) {
      var msgs = row.messages + (state.lang === 'en' ? ' messages' : ' 条消息');
      return {
        id: 'ses:' + row.id,
        sessionId: row.id,
        name: row.name,
        mark: state.lang === 'en' ? 'Chat' : '会话',
        markCls: 'is-chat',
        folder: '线上会话',
        meta: [msgs, row.time, row.user].join(' · ')
      };
    });
  }

  function railCatalog() {
    var map = {};
    railArts().concat(railSessions()).forEach(function (doc) { map[doc.id] = doc; });
    window.AIOpsContext.documents().forEach(function (ref) { map['ctx:' + ref.id] = { id: 'ctx:' + ref.id, contextId: ref.id, name: ref.name, reference: ref }; });
    return map;
  }

  function isCuiPage() {
    return state.page === '分析任务' || isWsSession(state.page) || (state.page === '定时任务' && window.AIOpsCapability.isConversation());
  }

  function canOpenArtifactRail() {
    return isCuiPage() || (state.page === '定时任务' && window.AIOpsCapability.isTaskDefinition());
  }

  function railHasDirectory() { return isCuiPage(); }

  function captureRailContext() {
    var nodes = Array.from(document.querySelectorAll('#cuiRailScroll, #cuiRailScroll *'));
    return {
      railOpen: state.railOpen, railMax: state.railMax, railSection: state.railSection,
      railTabs: state.railTabs.slice(), railCurrent: state.railCurrent,
      width: window.AIOpsColumns.savedRailWidth(),
      scrolls: nodes.map(function (node, index) { return { index: index, top: node.scrollTop, left: node.scrollLeft }; }).filter(function (position) { return position.top || position.left; })
    };
  }

  function restoreRailContext(saved) {
    state.railOpen = saved ? saved.railOpen : false;
    state.railMax = saved ? saved.railMax : false;
    state.railSection = saved ? saved.railSection : null;
    state.railTabs = saved ? saved.railTabs.slice() : [];
    state.railCurrent = saved ? saved.railCurrent : null;
    window.AIOpsColumns.restoreRailWidth(saved ? saved.width : null);
  }

  function selectRailContext() {
    var key = state.page === '定时任务' ? window.AIOpsCapability.railContextKey() : null;
    if (state.page === '分析任务') key = 'draft:' + state.cuiDraftId;
    key = key || (isCuiPage() ? 'chat:' : 'page:') + state.page;
    if (state.railOwner === key) return null;
    if (state.railOwner) state.railContexts[state.railOwner] = captureRailContext();
    state.railOwner = key;
    var saved = state.railContexts[key];
    restoreRailContext(saved);
    window.AIOpsSessionDetail.setContext(key);
    window.AIOpsCapability.setRailContext(key);
    var scroll = document.getElementById('cuiRailScroll');
    scroll.innerHTML = ''; delete scroll.dataset.resourceId;
    return saved;
  }

  function paintRail(keepBody) {
    var rail = document.getElementById('cuiRail');
    var tabsEl = document.getElementById('cuiRailTabs');
    var body = document.getElementById('cuiRailBody');
    var view = document.getElementById('cuiRailView');
    var meta = document.getElementById('cuiRailMeta');
    var scroll = document.getElementById('cuiRailScroll');
    if (!rail || !tabsEl || !body || !view) return;
    var catalog = railCatalog();
    var directory = railHasDirectory();
    if (!directory && !catalog[state.railCurrent]) state.railCurrent = state.railTabs.filter(function (id) { return !!catalog[id]; }).slice(-1)[0] || null;
    var current = catalog[state.railCurrent] || null;
    if (state.railCurrent && !current) state.railCurrent = null;
    rail.classList.toggle('is-file', !!current);
    view.hidden = !current;
    body.hidden = !!current || !directory;
    body.classList.remove('is-list');
    body.innerHTML = directory ? '<ul class="rp-launch" aria-label="' + esc(state.lang === 'en' ? 'Directory' : '目录') + '">' +
      '<li><button type="button" class="rp-launch-item" data-rail-section="ses" aria-haspopup="dialog">' +
        RAIL_MSG + '<span>' + esc(t('线上会话')) + '</span></button></li>' +
      '<li><button type="button" class="rp-launch-item" data-rail-section="art" aria-haspopup="dialog">' +
        RAIL_FILE + '<span>' + esc(t('产出物')) + '</span></button></li></ul>' : '';
    var tabs = directory ? '<button type="button" class="fd-home' + (current ? '' : ' is-active') + '" data-rail-home aria-label="' + esc(state.lang === 'en' ? 'Directory' : '目录') + '" aria-pressed="' + !current + '">' + RAIL_HOME + '</button>' : '';
    tabs += window.AIOpsResources.tabsMarkup('', state.railTabs.filter(function (id) { return !!catalog[id]; }).map(function (id) {
      var doc = catalog[id]; return { id: id, name: doc.name, kind: doc.sessionId ? 'session' : 'artifact', iconMarkup: doc.reference ? window.AIOpsContext.icon(doc.reference) : null };
    }), current && current.id, true);
    tabsEl.innerHTML = tabs;
    meta.hidden = true;
    if (!current) { scroll.innerHTML = ''; delete scroll.dataset.resourceId; paintIcons(); return; }
    var newResource = scroll.dataset.resourceId !== current.id;
    if (keepBody && !newResource) { paintIcons(); return; }
    scroll.dataset.resourceId = current.id;
    if (current.contextId) { scroll.innerHTML = window.AIOpsContext.detail(current.contextId); paintIcons(); return; }
    if (current.artifactId) {
      scroll.innerHTML = window.AIOpsCapability.railArtifactDetail(current.artifactId);
      paintIcons();
      return;
    }
    var session = sessionRows().filter(function (row) { return row.id === current.sessionId; })[0];
    scroll.innerHTML = session ? window.AIOpsSessionDetail.page(session, true) : '';
    paintIcons();
    window.AIOpsSessionDetail.afterRender(newResource);
  }

  function railOpenDoc(id) {
    if (state.railTabs.indexOf(id) < 0) state.railTabs.push(id);
    state.railCurrent = id;
    paintRail();
  }

  function openComposerResource(id) {
    if (!isCuiPage()) return;
    var open = function () { state.railOpen = true; railOpenDoc(id); syncRail(true); };
    if (!state.railOpen && window.AIOpsColumns) window.AIOpsColumns.animate(open); else open();
  }

  function railCloseDoc(id) {
    var i = state.railTabs.indexOf(id);
    if (i < 0) return;
    state.railTabs.splice(i, 1);
    if (state.railCurrent === id) {
      state.railCurrent = state.railTabs.length ? state.railTabs[Math.min(i, state.railTabs.length - 1)] : null;
    }
    syncRail();
  }

  function syncRail(keepBody) {
    var cui = canOpenArtifactRail();
    var catalog = railCatalog();
    var hasContent = railHasDirectory() || state.railTabs.some(function (id) { return !!catalog[id]; });
    var open = !!(state.railOpen && cui && hasContent);
    var max = open && !!state.railMax;
    if (!open) state.railMax = false;
    var app = document.querySelector('.aiops-app');
    var rail = document.getElementById('cuiRail');
    if (app) {
      app.classList.toggle('is-rail-open', open);
      app.classList.toggle('is-rail-max', max);
      if (open && !max) {
        var nav = document.querySelector('.aiops-side');
        var room = app.clientWidth - (nav && !nav.hidden ? nav.getBoundingClientRect().width : 0) - 400;
        app.style.setProperty('--rail-w', (window.AIOpsColumns ? window.AIOpsColumns.railWidth(room) : Math.max(220, Math.min(800, room))) + 'px');
      }
    }
    if (rail) {
      rail.hidden = !open && !(window.AIOpsColumns && window.AIOpsColumns.isAnimating());
      rail.inert = !open;
      rail.setAttribute('aria-hidden', String(!open));
      if (open) paintRail(keepBody);
      else { var scroll = document.getElementById('cuiRailScroll'); scroll.innerHTML = ''; delete scroll.dataset.resourceId; }
    }
    var btn = document.getElementById('toggle-right-rail');
    if (btn) {
      btn.hidden = open || !hasContent;
      btn.setAttribute('aria-pressed', open ? 'true' : 'false');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-controls', 'cuiRail');
      btn.setAttribute('aria-label', state.lang === 'en' ? (open ? 'Close agent panel' : 'Open agent panel') : (open ? '收起右侧边栏' : '展开右侧边栏'));
    }
    var closeBtn = document.getElementById('cuiRailClose');
    if (closeBtn) {
      var collapsible = railHasDirectory();
      var closeLabel = state.lang === 'en' ? (collapsible ? 'Collapse agent panel' : 'Close panel') : (collapsible ? '收起右侧边栏' : '关闭侧边栏');
      closeBtn.setAttribute('aria-label', closeLabel);
      closeBtn.title = closeLabel;
      closeBtn.querySelector('.rail-collapse-ico').toggleAttribute('hidden', !collapsible);
      closeBtn.querySelector('.rail-close-ico').toggleAttribute('hidden', collapsible);
    }
    var maxBtn = document.getElementById('cuiRailMax');
    if (maxBtn) {
      maxBtn.setAttribute('aria-pressed', max ? 'true' : 'false');
      var maxLabel = max
        ? (state.lang === 'en' ? 'Minimize agent panel' : '最小化侧边栏')
        : (state.lang === 'en' ? 'Expand agent panel' : '放大侧边栏');
      maxBtn.setAttribute('aria-label', maxLabel);
      maxBtn.setAttribute('title', maxLabel);
      var maxIco = maxBtn.querySelector('.rail-max-ico');
      var minIco = maxBtn.querySelector('.rail-min-ico');
      if (maxIco) maxIco.toggleAttribute('hidden', max);
      if (minIco) minIco.toggleAttribute('hidden', !max);
    }
    if (window.AIOpsColumns) window.AIOpsColumns.afterRender();
  }

  function isWsSession(id) {
    return allWsChildren().some(function (item) {
      return item.id === id && item.kind === 'session';
    });
  }

  function pageWorkspaceStub(name) {
    var child = null;
    allWsChildren().forEach(function (item) {
      if (item.id === name) child = item;
    });
    if (child && child.kind === 'schedule') return pageScheduleSession(name);
    if (child && child.kind === 'session') return pageWorkspaceChat(name);
    return heading(t(name), t('工作区骨架')) + scaffoldNote();
  }

  var PAGES = {
    '工作台': pageHome,
    '分析任务': pageNewTask,
    '定时任务': pageSchedules,
    '线上会话': pageSessions,
    '评测实验': function () { return window.AIOpsEvaluation.page('评测实验'); },
    '评测集': function () { return window.AIOpsEvaluation.page('评测集'); },
    '业务任务': function () { return window.AIOpsEvaluation.page('业务任务'); },
    '统一评估器': function () { return window.AIOpsUnifiedPages.page('统一评估器'); },
    '评测任务': function () { return window.AIOpsUnifiedPages.page('评测任务'); },
    '离线评估器': function () { return window.AIOpsEvaluation.page('离线评估器'); },
    '在线评估器': function () { return window.AIOpsOnlineEvaluators.page().replace(/>在线评估器</g, '>在线评估器（备份）<').replace(/>在线评估器列表 /g, '>在线评估器（备份）列表 '); },
    '产出物': pageArtifacts,
    '产出物详情': pageArtifactDetail,
    '成本分析': pageCost,
    '健康度分析': pageHealth,
    '用户行为分析': pageBehavior,
    '自定义看板': function () { return window.AIOpsExtensions.markup('自定义看板'); },
    '消息通知': function () { return window.AIOpsExtensions.markup('消息通知'); },
    '本体知识运营': function () { return window.AIOpsExtensions.markup('本体知识运营'); },
    'Agent评测': function () { return window.AIOpsExtensions.markup('Agent评测'); },
    '监测看板': pageCustomDash
  };

  function syncSessionShades() {
    var body = document.querySelector('.page.is-sessions .table-body');
    if (!body) return;
    var table = body.querySelector('.data-table');
    var shades = body.querySelectorAll('.session-col-shade');
    if (table) {
      var h = table.offsetHeight + 'px';
      for (var i = 0; i < shades.length; i++) shades[i].style.height = h;
    }
    var max = Math.max(0, body.scrollWidth - body.clientWidth);
    body.classList.toggle('is-shade-left', body.scrollLeft > 1);
    body.classList.toggle('is-shade-right', body.scrollLeft < max - 1);
  }

  function syncSessionSelectAll(root) {
    var box = root && root.querySelector('[data-session-select="all"]');
    if (!box) return;
    var rows = filteredSessionRows();
    var picked = rows.filter(function (row) { return state.sessionSelected[row.id]; }).length;
    box.checked = picked > 0 && picked === rows.length;
    box.indeterminate = picked > 0 && picked < rows.length;
    var count = selectedSessions().length;
    root.querySelectorAll('[data-session-select]').forEach(function (input) { window.AIOpsSelectionLimit.sync(input, count, 'ses'); });
  }

  function render(opts) {
    opts = opts || {};
    window.AIOpsExtensions.beforeRender();
    window.AIOpsEvaluation.beforeRender(state.page);
    if (window.AIOpsUnifiedPages) window.AIOpsUnifiedPages.beforeRender(state.page);
    window.AIOpsComposer.destroy();
    var restoredRail = selectRailContext();
    closeCuiModel();
    closeSessionActions();
    closeDeleteConfirm();
    closeSessionMark();
    if (!opts.keepSessionFilter) closeSessionFilter();
    closeSessionDate();
    renderSceneSwitcher();
    renderNav();
    var root = document.getElementById('pageRoot');
    if (!root) return;
    var oldList = root.querySelector('.resource-list-scroll');
    var listScroll = oldList ? oldList.scrollTop : 0;
    var keepScroll = !opts.resetScroll;
    var scrollTop = opts.scrollTop != null ? opts.scrollTop : keepScroll ? root.scrollTop : 0;
    var fn = PAGES[state.page] || function () { return pageWorkspaceStub(state.page); };
    var oldPanel = opts.keepSessionPanel || opts.keepResourcePanel ? root.querySelector('.resource-panel') : null;
    var panelScrolls = oldPanel ? Array.from(oldPanel.querySelectorAll('*')).filter(function (node) { return node.scrollTop || node.scrollLeft; }).map(function (node) { return { node: node, top: node.scrollTop, left: node.scrollLeft }; }) : [];
    var content = evaluationStartupNotice() + fn();
    if (isCuiPage() && state.page !== '定时任务') content += window.AIOpsCapability.conversationOverlays();
    root.innerHTML =
      '<div class="page' +
      (state.page === '工作台' ? ' is-home' : '') +
      (state.page === '线上会话' ? ' is-sessions' : '') +
      (isCuiPage() ? ' is-cui' : '') +
      (isAnalysisPage(state.page) ? ' is-analysis' : '') +
      '">' +
      content +
      '</div>';
    if (oldPanel && root.querySelector('.resource-panel')) root.querySelector('.resource-panel').replaceWith(oldPanel);
    window.AIOpsComposer.bind(root);
    if (keepScroll) root.scrollTop = scrollTop;
    var nextList = root.querySelector('.resource-list-scroll'); if (nextList && keepScroll) nextList.scrollTop = listScroll;
    if (state.sessionRestore && state.page === '线上会话' && !state.sessionViewId) {
      var restoredBody = root.querySelector('.table-body');
      if (restoredBody && state.sessionListScroll) { restoredBody.scrollLeft = state.sessionListScroll.left; restoredBody.scrollTop = state.sessionListScroll.top; }
      state.sessionRestore = false;
    }
    paintIcons();
    syncRail(!!opts.keepRailBody);
    if (state.cuiFocus) {
      state.cuiFocus = false;
      requestAnimationFrame(function () {
        var input = root.querySelector('.cui-input');
        var scroll = root.querySelector('.cui-scroll');
        if (scroll) scroll.scrollTop = scroll.scrollHeight;
        if (input) {
          window.AIOpsComposer.focusEnd(input);
        }
      });
    }
    window.AIOpsExtensions.afterRender(state.page);
    window.AIOpsEvaluation.afterRender(state.page);
    if (window.AIOpsUnifiedPages) window.AIOpsUnifiedPages.afterRender(state.page);
    window.AIOpsPageTabs.afterRender(state.page);
    syncSessionActionWidth(root);
    syncSessionSelectAll(root);
    if (state.sessionFocus) {
      var sessionFocus = state.sessionFocus;
      state.sessionFocus = null;
      var sessionField = root.querySelector(sessionFocus.sel);
      if (sessionField) {
        sessionField.focus();
        if (sessionFocus.pos != null && sessionField.setSelectionRange) {
          var sessionPos = Math.min(sessionFocus.pos, sessionField.value.length);
          sessionField.setSelectionRange(sessionPos, sessionPos);
        }
      }
    }
    syncSessionShades();
    requestAnimationFrame(syncSessionShades);
    if (window.AIOpsCapability) window.AIOpsCapability.afterRender();
    if (window.AIOpsSessionDetail) window.AIOpsSessionDetail.afterRender();
    window.AIOpsResources.afterRender();
    if (opts.restoreResourceView) window.AIOpsResources.restoreView();
    window.AIOpsColumns.afterRender();
    if (restoredRail && restoredRail.scrolls) {
      var railNodes = document.querySelectorAll('#cuiRailScroll, #cuiRailScroll *');
      restoredRail.scrolls.forEach(function (saved) { var node = railNodes[saved.index]; if (node) { node.scrollTop = saved.top; node.scrollLeft = saved.left; } });
    }
    panelScrolls.forEach(function (saved) { saved.node.scrollTop = saved.top; saved.node.scrollLeft = saved.left; });
    if (window.AIOpsBoards && (isAnalysisPage(state.page) || state.page === '工作台')) {
      window.AIOpsBoards.syncCharts();
    }
    renderGallery();
    renderConfigPopover();
    if (!keepScroll) return;
    // Replacing the grid can clamp scroll before the new card exists. Put it back
    // after layout, including the chart paint frames.
    requestAnimationFrame(function () {
      if (root.isConnected) root.scrollTop = scrollTop;
      requestAnimationFrame(function () {
        if (root.isConnected) root.scrollTop = scrollTop;
      });
    });
  }

  function openScheduleChat() {
    var parts = [{ type: 'skill', id: 'create-schedule', name: 'create-schedule' }, { type: 'text', text: ' ' + t('定时任务提示') }];
    openNewTask({ page: '分析任务', prompt: window.AIOpsComposer.textOf(parts), parts: parts });
  }

  function openNewTask(seed, detailId) {
    if (seed && seed.sessionRefs && seed.sessionRefs.length) state.cuiWs = 'default';
    state.cuiSeed = seed || null;
    state.cuiDraftId += 1;
    state.cuiFocus = true;
    go('分析任务');
    if (detailId) {
      state.railOpen = true;
      railOpenDoc(detailId);
      syncRail(true);
    }
  }

  function go(page, opts) {
    opts = opts || {};
    var freshLocation=!!(opts.pageTabNewLocation||opts.workspaceSchedulePage||(state.cuiSeed&&state.cuiSeed.page===page));
    var pageTabView=window.AIOpsPageTabs.beforeNavigate(page,{resume:!freshLocation,capture:!opts.pageTabNewLocation});
    window.AIOpsOnlineEvaluators.onNavigate(page);
    window.AIOpsResources.rememberView();
    if (state.cuiSeed && state.cuiSeed.page !== page) state.cuiSeed = null;
    if (window.AIOpsCapability) window.AIOpsCapability.onNavigate(page);
    state.page = page;
    state.workspaceSchedulePage = opts.workspaceSchedulePage || null;
    state.sessionViewId = page === '线上会话' ? window.AIOpsResources.active('session') : null;
    state.newOpen = false;
    if (page !== '工作台') {
      state.galleryOpen = false;
      state.galleryHidden = false;
      state.configId = null;
    }
    window.AIOpsPageTabs.restoreView(page);
    render({ resetScroll: !pageTabView, scrollTop:pageTabView?.scrollTop, restoreResourceView: true });
  }

  function closeNewMenu() {
    if (!state.newOpen) return;
    state.newOpen = false;
    var newMenu = document.getElementById('newMenu');
    var btnNew = document.getElementById('btnNew');
    if (newMenu) newMenu.hidden = true;
    if (btnNew) {
      btnNew.setAttribute('aria-expanded', 'false');
      btnNew.classList.remove('is-open');
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#widgetDeleteConfirm')) {
      e.stopPropagation();
      if (e.target.closest('[data-delete-cancel]')) {
        closeDeleteConfirm();
        return;
      }
      var deleteConfirm = e.target.closest('[data-delete-confirm]');
      if (deleteConfirm) {
        var confirmId = deleteConfirm.getAttribute('data-delete-confirm');
        closeDeleteConfirm();
        deleteWidgetInstance(confirmId);
      }
      return;
    }

    if (state.deleteAsk && !e.target.closest('[data-widget-delete]')) closeDeleteConfirm();

    if (handleCuiModelClick(e)) return;

    var wsCreate = e.target.closest('[data-cui-ws-create]');
    if (wsCreate) {
      e.preventDefault(); e.stopPropagation();
      document.getElementById('cui-ws-menu').hidden = true;
      var wsTrigger = document.getElementById('cui-ws');
      wsTrigger.setAttribute('aria-expanded', 'false');
      window.AIOpsWorkspaces.create(wsTrigger);
      return;
    }

    var wsPick = e.target.closest('[data-cui-ws]');
    if (wsPick) {
      e.preventDefault();
      e.stopPropagation();
      window.AIOpsWorkspaces.pick(wsPick.getAttribute('data-cui-ws'));
      var draft = document.querySelector('.cui-input');
      if (draft && state.page === '分析任务') {
        state.cuiSeed = state.cuiSeed || { page: '分析任务', prompt: '', skill: '' };
        state.cuiSeed.page = '分析任务';
        state.cuiSeed.prompt = window.AIOpsComposer.text(draft);
        state.cuiSeed.parts = window.AIOpsComposer.parts(draft);
      }
      render();
      return;
    }

    var wsBtn = e.target.closest('#cui-ws');
    if (wsBtn) {
      e.preventDefault();
      e.stopPropagation();
      var wsMenu = document.getElementById('cui-ws-menu');
      if (wsMenu) {
        var wsOpen = wsMenu.hidden;
        wsMenu.hidden = !wsOpen;
        wsBtn.setAttribute('aria-expanded', wsOpen ? 'true' : 'false');
      }
      return;
    }
    var wsMenuOpen = document.getElementById('cui-ws-menu');
    if (wsMenuOpen && !wsMenuOpen.hidden && !e.target.closest('.cui-ws-wrap')) wsMenuOpen.hidden = true;

    var btnNew = e.target.closest('#btnNew');
    if (btnNew) {
      e.stopPropagation();
      state.newOpen = !state.newOpen;
      if (state.newOpen && window.AIOpsCapability && window.AIOpsCapability.dismissMenus) {
        window.AIOpsCapability.dismissMenus();
      }
      renderNav();
      paintIcons();
      return;
    }

    var newItem = e.target.closest('[data-new]');
    if (newItem) {
      e.stopPropagation();
      var kind = newItem.getAttribute('data-new');
      if (kind === '分析任务') {
        openNewTask();
      }
      else if (kind === '定时任务') {
        if (window.AIOpsCapability) window.AIOpsCapability.startCreate('manual');
        go('定时任务');
      }
      else if (kind === '自定义看板') go('自定义看板');
      return;
    }

    if (e.target.closest('#btnAddWidget')) {
      e.stopPropagation();
      openGallery();
      return;
    }

    if (e.target.closest('#btnWidgetSkin')) {
      e.stopPropagation();
      cycleWidgetSkin();
      return;
    }

    var galleryClose = e.target.closest('[data-gallery-close]');
    if (galleryClose) {
      e.stopPropagation();
      closeGallery();
      return;
    }

    var galleryTypeBtn = e.target.closest('[data-gallery-anchor]');
    if (galleryTypeBtn) {
      e.stopPropagation();
      var anchorId = galleryTypeBtn.getAttribute('data-gallery-anchor');
      setGalleryAnchorActive(anchorId);
      scrollGalleryAnchor('wg-group-' + anchorId);
      return;
    }

    var galleryAdd = e.target.closest('[data-gallery-add]');
    if (galleryAdd) {
      e.stopPropagation();
      addWidgetInstance(galleryAdd.getAttribute('data-gallery-add'));
      return;
    }

    var configMetric = e.target.closest('[data-config-metric]');
    if (configMetric) {
      e.preventDefault(); e.stopPropagation();
      configMetric.setAttribute('aria-checked', String(configMetric.getAttribute('aria-checked') !== 'true'));
      applyWidgetConfigLive(configMetric.getAttribute('data-config-live'));
      return;
    }

    var configClose = e.target.closest('[data-config-close]');
    if (configClose) {
      e.stopPropagation();
      state.configId = null;

      renderConfigPopover();
      return;
    }

    var widgetConfig = e.target.closest('[data-widget-config]');
    if (widgetConfig) {
      e.stopPropagation();
      var configId = widgetConfig.getAttribute('data-widget-config');
      if (state.configId === configId) { closeConfigMenu(false); return; }
      state.configId = configId;

      state.galleryOpen = false;
      renderGallery();
      renderConfigPopover();
      document.querySelector('#widgetConfigMenu [role="menuitemcheckbox"]')?.focus({ preventScroll: true });
      return;
    }

    var widgetDelete = e.target.closest('[data-widget-delete]');
    if (widgetDelete) {
      e.stopPropagation();
      openDeleteConfirm(widgetDelete.getAttribute('data-widget-delete'), widgetDelete);
      closeConfigMenu(false);
      return;
    }

    if (
      state.configId &&
      !e.target.closest('#widgetConfigHost') &&
      !e.target.closest('[data-widget-config]')
    ) {
      state.configId = null;

      renderConfigPopover();
    }

    var artifactBtn = e.target.closest('[data-artifact]');
    if (artifactBtn && !artifactBtn.closest('.is-gallery-preview')) {
      e.stopPropagation();
      var artifactKey = artifactBtn.getAttribute('data-artifact');
      if (window.AIOpsCapability && window.AIOpsCapability.focusArtifact(artifactKey)) {
        go('产出物');
        return;
      }
      state.artifactId = artifactKey;
      go('产出物详情');
      return;
    }

    var pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.closest('.is-gallery-preview')) {
      var scheduleRun = pageBtn.getAttribute('data-schedule-run');
      if (scheduleRun) state.scheduleRun = scheduleRun;
      var nextPage = pageBtn.getAttribute('data-page');
      var scheduleName = window.AIOpsWorkspaces.taskName(nextPage);
      if (window.AIOpsCapability && window.AIOpsCapability.isTaskName(scheduleName)) {
        if (scheduleRun) { state.railOpen = false; state.railMax = false; }
        var widgetRun = scheduleRun && scheduleRuns().filter(function (run) { return run.id === scheduleRun; })[0];
        window.AIOpsCapability.focusTask(scheduleName, widgetRun && widgetRun.tone === 'pending');
        go('定时任务', { workspaceSchedulePage: pageBtn.matches('#aiopsNav .aiops-nav-item.is-child') ? nextPage : null });
        return;
      }
      go(nextPage);
      return;
    }

    if (e.target.closest('[data-session-date-clear]')) { applySessionDate(null); return; }
    var dateOpen = e.target.closest('[data-session-date-open]');
    if (dateOpen) { openSessionDate(dateOpen); return; }
    var datePreset = e.target.closest('[data-session-date-preset]');
    if (datePreset) { applySessionDate(sessionPresetRange(Number(datePreset.getAttribute('data-session-date-preset')))); return; }
    var dateField = e.target.closest('[data-session-date-field]');
    if (dateField) { openSessionCalendar(dateField.getAttribute('data-session-date-field')); return; }
    var dateMonth = e.target.closest('[data-session-date-month]');
    if (dateMonth && state.sessionDateMenu) {
      var month = new Date(state.sessionDateMenu.calendarMonth + '-01T00:00:00Z');
      month.setUTCMonth(month.getUTCMonth() + Number(dateMonth.getAttribute('data-session-date-month')));
      state.sessionDateMenu.calendarMonth = month.toISOString().slice(0, 7);
      renderSessionCalendar();
      document.querySelector('[data-session-date-month="' + dateMonth.getAttribute('data-session-date-month') + '"]').focus({ preventScroll: true });
      return;
    }
    var dateDay = e.target.closest('[data-session-date-day]');
    if (dateDay && !dateDay.disabled) { selectSessionCalendarDay(dateDay.getAttribute('data-session-date-day')); return; }
    if (e.target.closest('[data-session-date-cancel]')) { closeSessionDate(true); return; }
    if (e.target.closest('[data-session-date-apply]')) {
      var datePanel = document.getElementById('sessionDatePicker');
      var startDate = datePanel.querySelector('[data-session-date-start]').value;
      var endDate = datePanel.querySelector('[data-session-date-end]').value;
      if ((!startDate && !endDate) || (startDate && endDate && startDate <= endDate)) {
        applySessionDate(startDate ? { start: startDate, end: endDate } : null);
      } else {
        var error = datePanel.querySelector('.session-date-error');
        error.textContent = state.lang === 'en' ? 'Choose both dates; start must be on or before end.' : '请选择完整日期范围，开始日期不能晚于结束日期。';
        error.hidden = false;
      }
      return;
    }
    if (!e.target.closest('#sessionDatePicker')) closeSessionDate();

    var sessionSortButton = e.target.closest('[data-session-sort]');
    if (sessionSortButton) {
      var sortKey = sessionSortButton.getAttribute('data-session-sort');
      var currentSort = state.sessionSort;
      state.sessionSort = currentSort && currentSort.key === sortKey
        ? currentSort.direction === 'asc' ? { key: sortKey, direction: 'desc' } : null
        : { key: sortKey, direction: 'asc' };
      state.sessionPage = 1; rerenderSessions(true); return;
    }
    var sessionFilterButton = e.target.closest('[data-session-filter]');
    if (sessionFilterButton) { openSessionFilter(sessionFilterButton.getAttribute('data-session-filter'), sessionFilterButton); return; }
    var resetSessionFilter = e.target.closest('[data-session-filter-reset]');
    if (resetSessionFilter) { applySessionFilter(resetSessionFilter.getAttribute('data-session-filter-reset'), []); return; }
    if (e.target.closest('[data-session-filters-clear]')) {
      state.sessionFilters = { agent: [], user: [], mark: [], by: [] };
      state.sessionQuery = ''; state.sessionPage = 1; state.sessionSelected = {}; state.sessionDateRange = null;
      rerenderSessions(true); return;
    }
    if (!e.target.closest('#sessionColumnFilter')) closeSessionFilter();

    var sessionMarkChoice = e.target.closest('[data-session-set-mark]');
    if (sessionMarkChoice) { markSessions(state.sessionMarkIds.slice(), sessionMarkChoice.getAttribute('data-session-set-mark')); return; }
    var sessionBulk = e.target.closest('[data-session-bulk]');
    if (sessionBulk) {
      var bulkAction = sessionBulk.getAttribute('data-session-bulk');
      var selectedIds = selectedSessions().map(function (row) { return row.id; });
      if (bulkAction === 'mark') openSessionMark(selectedIds, sessionBulk);
      if (bulkAction === 'analyze') analyzeSessions(selectedIds);
      if (bulkAction === 'clear') { state.sessionSelected = {}; rerenderSessions(); }
      return;
    }
    var sessionMore = e.target.closest('[data-session-more]');
    if (sessionMore) { sessionActionsMenu(sessionMore.getAttribute('data-session-more'), sessionMore); return; }
    var sessionActionMenu = document.getElementById('sessionActionsMenu'); if (sessionActionMenu && !e.target.closest('#sessionActionsMenu, #sessionMarkMenu')) closeSessionActions();
    var sessionMark = e.target.closest('[data-session-mark]');
    if (sessionMark) { openSessionMark([sessionMark.getAttribute('data-session-mark')], sessionMark); return; }
    var sessionAnalyze = e.target.closest('[data-session-analyze]');
    if (sessionAnalyze) { closeSessionActions(); analyzeSessions([sessionAnalyze.getAttribute('data-session-analyze')]); return; }
    var referenceOpen = e.target.closest('[data-cui-reference-open]');
    if (referenceOpen) {
      e.preventDefault();
      var kind = referenceOpen.dataset.referenceKind;
      openComposerResource((kind === 'session' ? 'ses:' : kind === 'artifact' ? 'art:' : 'ctx:') + referenceOpen.dataset.cuiReferenceOpen);
      return;
    }
    var removeSessionRef = e.target.closest('[data-cui-session-remove]');
    if (removeSessionRef) {
      var refForm = removeSessionRef.closest('[data-cui-composer]');
      var refSeed = refForm && composerSeed(refForm.getAttribute('data-cui-page'));
      if (refSeed) refSeed.sessionRefs = (refSeed.sessionRefs || []).filter(function (row) { return row.id !== removeSessionRef.getAttribute('data-cui-session-remove'); });
      state.cuiFocus = true; render({ keepRailBody: true }); return;
    }
    if (!e.target.closest('#sessionMarkMenu')) closeSessionMark();

    var sessionView = e.target.closest('[data-session-view]');
    if (
      sessionView &&
      !e.target.closest('.session-check') &&
      !e.target.closest('.session-actions') &&
      !e.target.closest('button') &&
      !e.target.closest('input')
    ) {
      openSessionDetail(sessionView.getAttribute('data-session-view'));
      return;
    }

    var sessionSelect = e.target.closest('[data-session-select]');
    if (sessionSelect) {
      var key = sessionSelect.getAttribute('data-session-select');
      var ids = key === 'all' ? filteredSessionRows().map(function (row) { return row.id; }) : [key];
      var selected = window.AIOpsSelectionLimit.select(selectedSessions().map(function (row) { return row.id; }), ids, sessionSelect.checked, 'ses');
      state.sessionSelected = {};
      selected.forEach(function (id) { state.sessionSelected[id] = true; });
      rerenderSessions(); return;
    }

    var sessionSearchBtn = e.target.closest('[data-session-search-open]');
    if (sessionSearchBtn) {
      e.preventDefault();
      state.sessionSearchOpen = true;
      state.sessionFocus = { sel: '#sessionSearch', pos: (state.sessionQuery || '').length };
      render();
      return;
    }

    var sessionPageBtn = e.target.closest('[data-session-page]');
    if (sessionPageBtn && !sessionPageBtn.disabled) {
      var rows = filteredSessionRows();
      var pageSize = 20;
      var pages = Math.max(1, Math.ceil(rows.length / pageSize));
      var which = sessionPageBtn.getAttribute('data-session-page');
      if (which === 'prev') state.sessionPage = Math.max(1, state.sessionPage - 1);
      else if (which === 'next') state.sessionPage = Math.min(pages, state.sessionPage + 1);
      else state.sessionPage = Number(which) || 1;
      render();
      return;
    }

    var rangeBtn = e.target.closest('[data-range]');
    if (rangeBtn) {
      state.range = Number(rangeBtn.getAttribute('data-range'));
      render();
      return;
    }

    var processBtn = e.target.closest('[data-ws-process]');
    if (processBtn) {
      var open = processBtn.getAttribute('aria-expanded') === 'true';
      processBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      var col = processBtn.parentNode && processBtn.parentNode.nextElementSibling;
      if (col) col.classList.toggle('is-open', !open);
      var chev = processBtn.querySelector('.status-chevron');
      if (chev) chev.classList.toggle('closed', open);
      return;
    }

    var copyBtn = e.target.closest('[data-ws-copy]');
    if (copyBtn) {
      var turn = copyBtn.closest('.ao-turn');
      var answer = turn && turn.querySelector('.ao-answer');
      var text = answer ? answer.innerText.trim() : '';
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
          showToast(state.lang === 'en' ? 'Copied' : '已复制');
        });
      }
      return;
    }

    var activityBtn = e.target.closest('[data-ws-activity]');
    if (activityBtn) {
      var actOpen = activityBtn.getAttribute('aria-expanded') === 'true';
      activityBtn.setAttribute('aria-expanded', actOpen ? 'false' : 'true');
      var actCol = activityBtn.nextElementSibling;
      if (actCol && actCol.classList.contains('collapse')) actCol.classList.toggle('is-open', !actOpen);
      return;
    }

    if (!e.target.closest('#newMenu') && !e.target.closest('#btnNew')) closeNewMenu();
  });

  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'sessionSearch') {
      if (!e.target.isConnected || e.isComposing || state.sessionComposing) return;
      state.sessionQuery = e.target.value;
      state.sessionSelected = {};
      state.sessionPage = 1;
      state.sessionFocus = {
        sel: '#sessionSearch',
        pos: e.target.selectionStart == null ? e.target.value.length : e.target.selectionStart
      };
      render();
      return;
    }
    var field = e.target && e.target.closest && e.target.closest('.cui-input');
    if (!field) return;
    var runPage = field.closest('[data-cui-page]');
    var value = window.AIOpsComposer.text(field);
    if (runPage && runPage.getAttribute('data-cui-page').indexOf('schedule-run:') === 0) window.AIOpsCapability.setRunDraft(runPage.getAttribute('data-cui-page').slice(13), value);
    var seed = saveComposerDraft(runPage.getAttribute('data-cui-page'), value, window.AIOpsComposer.parts(field));
    var card = field.closest('.cui-card');
    if (card) card.classList.toggle('has-text', value.trim().length > 0 || !!(seed.sessionRefs && seed.sessionRefs.length));
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight, 168) + 'px';
  });

  document.addEventListener('compositionstart', function (e) {
    if (e.target && e.target.id === 'sessionSearch') state.sessionComposing = true;
  });

  document.addEventListener('compositionend', function (e) {
    if (!e.target || e.target.id !== 'sessionSearch') return;
    state.sessionComposing = false;
    if (!e.target.isConnected) return;
    state.sessionQuery = e.target.value;
    state.sessionPage = 1;
    state.sessionFocus = { sel: '#sessionSearch', pos: e.target.value.length };
    render();
  });

  document.addEventListener('pointerdown', function () { state.sessionPointerDown = true; }, true);
  document.addEventListener('pointerup', function () {
    setTimeout(function () { state.sessionPointerDown = false; }, 0);
  }, true);

  document.addEventListener('focusout', function (e) {
    if (!e.target || e.target.id !== 'sessionSearch' || state.sessionComposing || !state.sessionPointerDown) return;
    if (String(e.target.value || '').trim()) return;
    setTimeout(function () {
      if (document.activeElement && document.activeElement.id === 'sessionSearch') return;
      state.sessionQuery = '';
      state.sessionSearchOpen = false;
      render();
    }, 0);
  });

  document.addEventListener('pointerdown', function (e) {
    if (state.configId && !e.target.closest('#widgetConfigHost, [data-widget-config]')) closeConfigMenu(false);
  }, true);
  document.addEventListener('keydown', function (e) {
    var menu = document.getElementById('widgetConfigMenu');
    if (!menu || !menu.contains(e.target)) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeConfigMenu(true); return; }
    if (e.key === 'Tab') { closeConfigMenu(true); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var items = Array.from(menu.querySelectorAll('[role="menuitemcheckbox"], [role="menuitem"]'));
    var index = items.indexOf(e.target);
    var next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-session-view]')) {
      e.preventDefault(); openSessionDetail(e.target.getAttribute('data-session-view')); return;
    }
    var actions = document.getElementById('sessionActionsMenu');
    var markMenu = document.getElementById('sessionMarkMenu');
    if (markMenu && (e.key === 'Escape' || (actions && e.key === 'ArrowLeft'))) { closeSessionMark(true); e.preventDefault(); return; }
    if (markMenu && markMenu.contains(e.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) >= 0) {
      var options = Array.from(markMenu.querySelectorAll('button'));
      var index = options.indexOf(document.activeElement);
      var next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next].focus(); e.preventDefault(); return;
    }
    if (actions && e.key === 'Escape') { closeSessionActions(true); e.preventDefault(); return; }
    if (actions && e.key === 'Tab') { closeSessionActions(true); return; }
    if (actions && e.key === 'ArrowRight' && e.target.matches('[data-session-mark]')) { openSessionMark([e.target.getAttribute('data-session-mark')], e.target); e.preventDefault(); return; }
    if (actions && actions.contains(e.target) && ['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(e.key) >= 0) {
      var buttons = Array.from(actions.querySelectorAll('button'));
      var at = buttons.indexOf(document.activeElement);
      var nextAction = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : (at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      closeSessionMark(); buttons[nextAction].focus(); e.preventDefault(); return;
    }
    var calendarDay = e.target.closest('[data-session-date-day]');
    var dayStep = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (calendarDay && state.sessionDateMenu && dayStep) {
      e.preventDefault();
      var nextDay = new Date(calendarDay.getAttribute('data-session-date-day') + 'T00:00:00Z');
      nextDay.setUTCDate(nextDay.getUTCDate() + dayStep);
      var nextDate = nextDay.toISOString().slice(0, 10);
      var startDate = document.querySelector('[data-session-date-start]').value;
      if (state.sessionDateMenu.calendarField === 'end' && startDate && nextDate < startDate) return;
      state.sessionDateMenu.calendarMonth = nextDate.slice(0, 7);
      renderSessionCalendar();
      document.querySelector('[data-session-date-day="' + nextDate + '"]').focus({ preventScroll: true });
      return;
    }
    if (state.sessionDateMenu && e.key === 'Escape') { closeSessionDate(true); e.preventDefault(); return; }
    if (state.sessionFilterMenu && e.key === 'Escape') { closeSessionFilter(true); e.preventDefault(); return; }
    if (e.key === 'Enter' && e.target && e.target.id === 'sessionSearch' && !e.isComposing && !state.sessionComposing) {
      e.preventDefault();
      e.stopPropagation();
      state.sessionSearchOpen = true;
      state.sessionQuery = '';
      state.sessionPage = 1;
      state.sessionFocus = { sel: '#sessionSearch', pos: 0 };
      render();
      return;
    }
    var field = e.target && e.target.closest && e.target.closest('.cui-input');
    if (!field || e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    var form = field.closest('[data-cui-composer]');
    if (form && form.requestSubmit) form.requestSubmit();
  });

  document.addEventListener('submit', function (e) {
    var form = e.target && e.target.closest && e.target.closest('[data-cui-composer]');
    if (!form) return;
    e.preventDefault();
    var field = form.querySelector('.cui-input');
    var text = window.AIOpsComposer.text(field).trim();
    var page = form.getAttribute('data-cui-page');
    var seed = composerSeed(page);
    var refs = seed && seed.sessionRefs ? seed.sessionRefs.slice() : [];
    if (!text && !refs.length) return;
    if (!text) text = state.lang === 'en' ? 'Analyze the referenced content.' : '分析引用的内容。';
    if (page.indexOf('schedule-run:') === 0) { delete state.cuiDrafts[page]; window.AIOpsCapability.continueRun(page.slice(13), text, refs); return; }
    if (page === '分析任务') startTask(text);
    else appendTurn(page, text, refs);
  });

  document.addEventListener('change', function (e) {
    var filterOption = e.target && e.target.closest('[data-session-filter-option]');
    if (filterOption && state.sessionFilterMenu) {
      var key = state.sessionFilterMenu.key;
      var values = state.sessionFilters[key].filter(function (value) { return value !== filterOption.value; });
      if (filterOption.checked) values.push(filterOption.value);
      applySessionFilter(key, values);
      return;
    }
  });

  /* Drag: gallery → canvas · canvas reorder (live placeholder) · corner resize */
  var dragGhost = null;

  function clearDragDecor() {
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    dragGhost = null;
    document.querySelectorAll('.widget-placeholder').forEach(function (el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    document.querySelectorAll('.widget.is-dragging, .widget.is-resizing').forEach(function (el) {
      el.classList.remove('is-dragging', 'is-resizing');
      el.style.pointerEvents = '';
      el.style.display = '';
    });
    var grid = document.getElementById('homeWidgetGrid');
    if (grid) grid.classList.remove('is-dropping');
  }

  function makeGhostFrom(el, x, y) {
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    dragGhost = el.cloneNode(true);
    dragGhost.classList.add('widget-drag-ghost');
    dragGhost.querySelectorAll('[data-widget-resize]').forEach(function (n) {
      n.remove();
    });
    var rect = el.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;
    dragGhost.style.width = w + 'px';
    dragGhost.style.height = h + 'px';
    dragGhost.style.maxWidth = 'none';
    dragGhost.style.boxSizing = 'border-box';
    // Cloned charts keep their drawn coordinates. Give them a viewBox so a
    // 1px box mismatch scales inside the card instead of spilling out.
    var srcHosts = el.querySelectorAll('.analysis-chart-host');
    var ghostHosts = dragGhost.querySelectorAll('.analysis-chart-host');
    for (var i = 0; i < ghostHosts.length; i++) {
      var host = ghostHosts[i];
      var src = srcHosts[i];
      var box = src ? src.getBoundingClientRect() : null;
      if (box && box.width > 0 && box.height > 0) {
        host.style.flex = '0 0 auto';
        host.style.width = box.width + 'px';
        host.style.height = box.height + 'px';
      }
      host.style.overflow = 'hidden';
      var svg = host.querySelector('svg');
      if (!svg) continue;
      var sw = parseFloat(svg.getAttribute('width'));
      var sh = parseFloat(svg.getAttribute('height'));
      if (sw > 0 && sh > 0 && !svg.getAttribute('viewBox')) {
        svg.setAttribute('viewBox', '0 0 ' + sw + ' ' + sh);
      }
      svg.style.overflow = 'hidden';
    }
    var skinRoot = el.closest ? el.closest('.home-content') : null;
    var skin = skinRoot && skinRoot.getAttribute('data-widget-skin');
    if (skin) dragGhost.setAttribute('data-widget-skin', skin);
    document.body.appendChild(dragGhost);
    placeDragGhost(x, y);
  }

  /* Gallery drag ghost: same chrome as the gallery card, at the new card's grid size. */
  function galleryDragSource(type) {
    var span = (type && type.span) || 1;
    var rows = (type && type.rows) || 4;
    var metrics = gridColMetrics();
    var width = span * metrics.col + Math.max(0, span - 1) * metrics.gap;
    var height = rows * metrics.row + Math.max(0, rows - 1) * metrics.gap;
    var page = document.querySelector('.home-content');
    var host = document.createElement('div');
    host.className = 'home-content';
    host.setAttribute('data-widget-skin', (page && page.getAttribute('data-widget-skin')) || 'inset');
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:' + width + 'px;padding:0;pointer-events:none;';
    host.innerHTML = widgetChrome(
      {
        id: 'gallery-drag',
        type: type.id,
        span: span,
        rows: rows,
        col: 1,
        row: 1,
        metrics: (type.defaults || []).slice()
      },
      type,
      'gallery'
    );
    var card = host.querySelector('.widget');
    if (card) {
      card.style.width = width + 'px';
      card.style.height = height + 'px';
    }
    document.body.appendChild(host);
    if (window.AIOpsBoards) window.AIOpsBoards.syncCharts();
    paintIcons();
    return card || host;
  }

  function endDragSession() {
    if (state.drag && state.drag.scrollRaf) cancelAnimationFrame(state.drag.scrollRaf);
    if (state.drag && state.drag.captureEl) {
      try {
        state.drag.captureEl.releasePointerCapture(state.drag.pointerId);
      } catch (err) {}
    }
    state.drag = null;
    clearDragDecor();
  }

  document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    if (
      state.deleteAsk &&
      !e.target.closest('#widgetDeleteConfirm') &&
      !e.target.closest('[data-widget-delete]')
    ) {
      closeDeleteConfirm();
    }

    var resizeBtn = e.target.closest('[data-widget-resize]');
    if (resizeBtn) {
      var rid = resizeBtn.getAttribute('data-widget-resize');
      var rcard = document.querySelector('.widget[data-widget-id="' + rid + '"]');
      if (!rcard) return;
      var metrics = gridColMetrics();
      var rrect = rcard.getBoundingClientRect();
      var startLayout = cloneLayout(ensureHomeWidgets());
      state.drag = {
        kind: 'resize',
        widgetId: rid,
        startX: e.clientX,
        startY: e.clientY,
        startSpan: Number(rcard.getAttribute('data-span') || 1),
        startRows: Number(rcard.getAttribute('data-rows') || 4),
        startCol: Number(rcard.getAttribute('data-col') || 1),
        startRow: Number(rcard.getAttribute('data-row') || 1),
        startLayout: startLayout,
        left: rrect.left,
        top: rrect.top,
        col: metrics.col,
        row: metrics.row,
        gap: metrics.gap,
        maxCols: metrics.cols || WIDGET_GRID_COLS,
        maxRows: metrics.rows || WIDGET_GRID_ROWS,
        active: true,
        pointerId: e.pointerId,
        captureEl: resizeBtn
      };
      rcard.classList.add('is-resizing');
      try {
        resizeBtn.setPointerCapture(e.pointerId);
      } catch (err) {}
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    var galleryPreview = e.target.closest('[data-gallery-preview]');
    var canvasDrag = e.target.closest('[data-widget-drag]');

    if (galleryPreview && !e.target.closest('[data-gallery-add]')) {
      state.drag = {
        kind: 'gallery',
        typeId: galleryPreview.getAttribute('data-widget-type'),
        startX: e.clientX,
        startY: e.clientY,
        anchorX: 24,
        anchorY: 18,
        active: false,
        pointerId: e.pointerId,
        captureEl: galleryPreview,
        gridMetrics: gridColMetrics()
      };
      try {
        galleryPreview.setPointerCapture(e.pointerId);
      } catch (err) {}
      return;
    }

    if (canvasDrag) {
      var id = canvasDrag.getAttribute('data-widget-drag');
      var grabbed = document.querySelector('.widget[data-widget-id="' + id + '"]');
      var grabbedRect = grabbed ? grabbed.getBoundingClientRect() : null;
      state.drag = {
        kind: 'reorder',
        widgetId: id,
        startX: e.clientX,
        startY: e.clientY,
        anchorX: grabbedRect ? e.clientX - grabbedRect.left : 24,
        anchorY: grabbedRect ? e.clientY - grabbedRect.top : 18,
        active: false,
        pointerId: e.pointerId,
        captureEl: canvasDrag,
        gridMetrics: gridColMetrics()
      };
      try {
        canvasDrag.setPointerCapture(e.pointerId);
      } catch (err) {}
      e.preventDefault();
    }
  });

  document.addEventListener('pointermove', function (e) {
    if (!state.drag || state.drag.pointerId !== e.pointerId) return;

    if (state.drag.kind === 'resize') {
      var width = e.clientX - state.drag.left;
      var height = e.clientY - state.drag.top;
      var colUnit = state.drag.col + state.drag.gap;
      var rowUnit = state.drag.row + state.drag.gap;
      var spanExact = (width + state.drag.gap) / colUnit;
      var rowsExact = (height + state.drag.gap) / rowUnit;
      var span = Math.round(spanExact);
      var rows = Math.round(rowsExact);
      if (state.drag.liveSpan != null && Math.abs(spanExact - state.drag.liveSpan) < 0.7) {
        span = state.drag.liveSpan;
      }
      if (state.drag.liveRows != null && Math.abs(rowsExact - state.drag.liveRows) < 0.7) {
        rows = state.drag.liveRows;
      }
      var maxSpan = Math.min(
        state.drag.maxCols,
        state.drag.maxCols - state.drag.startCol + 1
      );
      span = Math.max(1, Math.min(maxSpan, span));
      rows = Math.max(1, Math.min(state.drag.maxRows, rows));
      var sizeChanged = span !== state.drag.liveSpan || rows !== state.drag.liveRows;
      state.drag.liveSpan = span;
      state.drag.liveRows = rows;
      var live = previewMoveLayout(
        state.drag.startLayout,
        state.drag.widgetId,
        state.drag.startCol,
        state.drag.startRow,
        span,
        rows,
        state.drag.maxCols
      );
      state.drag.liveLayout = live;
      paintLayout(live);
      if (sizeChanged) scheduleChartSync();
      return;
    }

    var dx = e.clientX - state.drag.startX;
    var dy = e.clientY - state.drag.startY;
    if (!state.drag.active && dx * dx + dy * dy < 36) return;

    if (!state.drag.active) {
      state.drag.active = true;
      var grid = document.getElementById('homeWidgetGrid');

      if (state.drag.kind === 'gallery') {
        setGalleryStash(true);
        grid = document.getElementById('homeWidgetGrid');
        var type = widgetType(state.drag.typeId);
        var gSpan = (type && type.span) || 1;
        var gRows = (type && type.rows) || 4;
        var source = galleryDragSource(type);
        makeGhostFrom(source, e.clientX, e.clientY);
        var mount = source.classList && source.classList.contains('home-content') ? source : source.parentNode;
        if (mount && mount.parentNode) mount.parentNode.removeChild(mount);

        state.drag.span = gSpan;
        state.drag.rows = gRows;
        state.drag.startLayout = cloneLayout(ensureHomeWidgets());
        state.drag.placeholderId = '__new__';
        if (grid) {
          var cell0 = pointToGridCell(e.clientX, e.clientY, gSpan, gRows);
          var ph = makePlaceholder(gSpan, gRows, cell0.col, cell0.row);
          state.drag.placeholder = ph;
          grid.appendChild(ph);
          grid.classList.add('is-dropping');
          state.drag.dropCol = cell0.col;
          state.drag.dropRow = cell0.row;
        }
      } else if (state.drag.kind === 'reorder') {
        var card = document.querySelector('.widget[data-widget-id="' + state.drag.widgetId + '"]');
        if (card && grid) {
          var span2 = Number(card.getAttribute('data-span') || 1);
          var rows2 = Number(card.getAttribute('data-rows') || 4);
          var col2 = Number(card.getAttribute('data-col') || 1);
          var row2 = Number(card.getAttribute('data-row') || 1);
          makeGhostFrom(card, e.clientX, e.clientY);
          state.drag.span = span2;
          state.drag.rows = rows2;
          state.drag.startLayout = cloneLayout(ensureHomeWidgets());
          state.drag.placeholderId = state.drag.widgetId;
          var ph2 = makePlaceholder(span2, rows2, col2, row2);
          state.drag.placeholder = ph2;
          grid.appendChild(ph2);
          card.classList.add('is-dragging');
          card.style.display = 'none';
          grid.classList.add('is-dropping');
          state.drag.dropCol = col2;
          state.drag.dropRow = row2;
          var live0 = previewMoveLayout(
            state.drag.startLayout,
            state.drag.widgetId,
            col2,
            row2,
            span2,
            rows2,
            WIDGET_GRID_COLS
          );
          state.drag.liveLayout = live0;
          paintLayout(live0, state.drag.widgetId, ph2);
        }
      }
    }

    if (dragGhost) placeDragGhost(e.clientX, e.clientY);

    if (state.drag.kind === 'reorder' || state.drag.kind === 'gallery') {
      state.drag.pointerX = e.clientX;
      state.drag.pointerY = e.clientY;
      updateActiveDragTarget(e.clientX, e.clientY);
      kickDragScroll();
    }
  });

  document.addEventListener('pointerup', function (e) {
    if (!state.drag || state.drag.pointerId !== e.pointerId) return;
    var drag = state.drag;

    if (drag.kind === 'resize') {
      var span = drag.liveSpan != null ? drag.liveSpan : drag.startSpan;
      var rows = drag.liveRows != null ? drag.liveRows : drag.startRows;
      var liveLayout = drag.liveLayout;
      endDragSession();
      if (liveLayout) {
        commitLayout(liveLayout);
        persistHomeWidgets();
        render();
      } else {
        setWidgetSpan(drag.widgetId, span, rows);
      }
      return;
    }

    if (!drag.active) {
      endDragSession();
      if (drag.kind === 'gallery') setGalleryStash(false);
      return;
    }

    if (drag.kind === 'gallery') {
      var rejected = pointerInDragDeadZone(e.clientX, e.clientY);
      if (!rejected) updateActiveDragTarget(e.clientX, e.clientY);
      var dropCol = drag.dropCol;
      var dropRow = drag.dropRow;
      var savedScroll = dragScrollTop();
      endDragSession();
      if (!rejected && dropCol && dropRow) {
        state.galleryHidden = false;
        state.galleryOpen = false;
        addWidgetInstance(drag.typeId, { col: dropCol, row: dropRow, scrollTop: savedScroll });
      } else {
        setGalleryStash(false);
      }
      return;
    }

    if (drag.kind === 'reorder') {
      var rejectedReorder = pointerInDragDeadZone(e.clientX, e.clientY);
      if (!rejectedReorder) updateActiveDragTarget(e.clientX, e.clientY);
      var liveReorder = rejectedReorder ? null : drag.liveLayout;
      var dropC = drag.dropCol;
      var dropR = drag.dropRow;
      var savedReorderScroll = dragScrollTop();
      endDragSession();
      if (rejectedReorder) {
        render({ scrollTop: savedReorderScroll });
      } else if (liveReorder) {
        commitLayout(liveReorder);
        persistHomeWidgets();
        render({ scrollTop: savedReorderScroll });
      } else if (dropC && dropR) {
        setWidgetPosition(drag.widgetId, dropC, dropR, { scrollTop: savedReorderScroll });
      } else {
        render({ scrollTop: savedReorderScroll });
      }
      return;
    }

    endDragSession();
  });

  document.addEventListener('scroll', function (e) {
    var target = e.target;
    if (target && target.classList && target.classList.contains('table-body')) syncSessionShades();
  }, true);

  window.addEventListener('resize', syncSessionShades);

  document.addEventListener('pointercancel', function (e) {
    if (!state.drag || (e.pointerId != null && state.drag.pointerId !== e.pointerId)) return;
    var wasGallery = state.drag.kind === 'gallery';
    endDragSession();
    if (wasGallery) setGalleryStash(false);
    else render();
  });

  /* Scenario + account popovers — same placement rules as Workbench */
  var teamBtn = document.getElementById('teamBtn');
  var teamMenu = document.getElementById('teamMenu');
  var userBtn = document.getElementById('userBtn');
  var acctMenu = document.getElementById('acctMenu');

  function renderSceneSwitcher() {
    var resources = window.AIOpsResources;
    var name = resources.sceneLabel();
    document.getElementById('teamName').textContent = name;
    teamBtn.title = name;
    teamMenu.innerHTML = resources.sceneMenuMarkup();
  }

  function placeScenePopover() {
    var r = teamBtn.getBoundingClientRect(), pad = 8;
    teamMenu.style.top = r.bottom + 6 + 'px';
    teamMenu.style.left = r.left + 'px';
    teamMenu.hidden = false;
    var box = teamMenu.getBoundingClientRect();
    if (box.right > window.innerWidth - pad) teamMenu.style.left = Math.max(pad, window.innerWidth - pad - box.width) + 'px';
    if (box.bottom > window.innerHeight - pad) teamMenu.style.top = Math.max(pad, r.top - 6 - box.height) + 'px';
  }

  function placeSidebarPopover(el, anchor, side) {
    var sb = document.querySelector('.aiops-side').getBoundingClientRect();
    var rc = anchor.getBoundingClientRect();
    var gap = 8;
    el.style.width = Math.max(0, sb.width - gap * 2) + 'px';
    el.style.left = sb.left + gap + 'px';
    if (side === 'below') {
      el.style.top = rc.bottom + 4 + 'px';
      el.style.bottom = 'auto';
    } else {
      el.style.top = 'auto';
      el.style.bottom = window.innerHeight - rc.top + 4 + 'px';
    }
  }

  function closeTeam() {
    if (!teamMenu || !teamBtn) return;
    teamMenu.hidden = true;
    teamBtn.classList.remove('is-open');
    teamBtn.setAttribute('aria-expanded', 'false');
  }

  function closeAcct() {
    if (!acctMenu || !userBtn) return;
    acctMenu.hidden = true;
    userBtn.classList.remove('is-open');
    userBtn.setAttribute('aria-expanded', 'false');
  }

  function openAcct() {
    closeTeam();
    closeNewMenu();
    if (window.AIOpsCapability && window.AIOpsCapability.dismissMenus) window.AIOpsCapability.dismissMenus();
    placeSidebarPopover(acctMenu, userBtn, 'above');
    acctMenu.hidden = false;
    userBtn.classList.add('is-open');
    userBtn.setAttribute('aria-expanded', 'true');
  }

  if (userBtn && acctMenu) {
    userBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (acctMenu.hidden) openAcct();
      else closeAcct();
    });

    acctMenu.addEventListener('click', function (e) {
      e.stopPropagation();
      var langBtn = e.target.closest('.lang-seg button');
      if (langBtn) {
        setLang(langBtn.getAttribute('data-lang'));
        return;
      }
      if (e.target.closest('.acct-item')) closeAcct();
    });
  }

  if (teamBtn && teamMenu) {
    teamBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeNewMenu();
      closeAcct();
      if (window.AIOpsCapability && window.AIOpsCapability.dismissMenus) window.AIOpsCapability.dismissMenus();
      if (!teamMenu.hidden) {
        closeTeam();
        return;
      }
      window.AIOpsResources.closeScope();
      renderSceneSwitcher();
      placeScenePopover();
      teamBtn.classList.add('is-open');
      teamBtn.setAttribute('aria-expanded', 'true');
      teamMenu.querySelector('[aria-checked="true"]').focus({ preventScroll: true });
    });

    teamMenu.addEventListener('click', function (e) {
      e.stopPropagation();
      var it = e.target.closest('.ov-menu-item[data-scene]');
      if (!it) return;
      closeTeam();
      window.AIOpsResources.selectScene(it.dataset.scene);
      teamBtn.focus({ preventScroll: true });
    });
    teamMenu.addEventListener('keydown', function (e) {
      var items = Array.from(teamMenu.querySelectorAll('[data-scene]'));
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTeam(); teamBtn.focus(); return; }
      if (['ArrowDown','ArrowUp','Home','End'].indexOf(e.key) < 0) return;
      e.preventDefault(); e.stopPropagation();
      var index = items.indexOf(document.activeElement);
      var next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    });
    teamBtn.addEventListener('keydown', function (e) {
      if (['ArrowDown', 'ArrowUp'].indexOf(e.key) < 0) return;
      e.preventDefault();
      if (teamMenu.hidden) teamBtn.click();
      var items = teamMenu.querySelectorAll('[data-scene]');
      items[e.key === 'ArrowUp' ? items.length - 1 : 0].focus();
    });
    window.addEventListener('resize', function () { if (!teamMenu.hidden) placeScenePopover(); });
  }

  document.addEventListener('click', function () {
    closeTeam();
    closeAcct();
  });
  document.addEventListener('mouseover', function (e) {
    if (!e.target.closest) return;
    var panel = document.getElementById('cui-model-panel');
    if (!panel || panel.hidden) return;
    var row = e.target.closest('[data-cui-model-open]');
    if (row && panel.contains(row)) {
      var kind = row.getAttribute('data-cui-model-open');
      if (kind === cuiModelKind && cuiModelMenu && !cuiModelMenu.hidden) return;
      renderCuiModelMenu(kind);
      return;
    }
    if (e.target.closest('#cui-model-panel') || e.target.closest('#cui-model-menu') || cuiModelPointerInBridge(e)) return;
    hideCuiModelSubmenu();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var modelPanel = document.getElementById('cui-model-panel');
      if (modelPanel && !modelPanel.hidden) {
        closeCuiModel();
        e.preventDefault();
        return;
      }
      if (state.deleteAsk) {
        closeDeleteConfirm();
        e.preventDefault();
        return;
      }
      closeTeam();
      closeAcct();
      closeNewMenu();
      if (state.configId) {
        state.configId = null;

        renderConfigPopover();
      } else if (state.galleryOpen) {
        closeGallery();
      }
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#cuiRailMax')) {
      e.preventDefault();
      if (!state.railOpen) state.railOpen = true;
      state.railMax = !state.railMax;
      syncRail(true);
      return;
    }
    if (e.target.closest('#toggle-right-rail') || e.target.closest('#cuiRailClose')) {
      e.preventDefault();
      var toggleRail = function () {
        var closedId = state.railCurrent;
        var dismiss = !railHasDirectory() && e.target.closest('#cuiRailClose');
        state.railOpen = !state.railOpen;
        if (!state.railOpen) state.railMax = false;
        if (dismiss) { state.railOpen = false; state.railTabs = []; state.railCurrent = null; state.railSection = null; }
        syncRail();
        var focus = document.getElementById(state.railOpen ? 'cuiRailClose' : 'toggle-right-rail');
        if (dismiss) focus = Array.from(document.querySelectorAll('#pageRoot [data-cap="task-art"]')).filter(function (button) { return 'art:' + button.dataset.id === closedId; })[0] || document.querySelector('#pageRoot .aiops-back');
        if (focus) focus.focus({ preventScroll: true });
      };
      if (window.AIOpsColumns) window.AIOpsColumns.animate(toggleRail);
      else toggleRail();
      return;
    }
    if (!e.target.closest('#cuiRail')) return;
    var section = e.target.closest('[data-rail-section]');
    if (section) {
      window.AIOpsRailPicker.open(section.getAttribute('data-rail-section'), section);
      return;
    }
    var closer = e.target.closest('[data-rail-x]');
    if (closer) {
      railCloseDoc(closer.getAttribute('data-rail-x'));
      return;
    }
    if (e.target.closest('[data-rail-home]') && railHasDirectory()) {
      state.railCurrent = null;
      state.railSection = null;
      paintRail();
      return;
    }
    var tab = e.target.closest('[data-rail-tab]');
    if (tab) {
      railOpenDoc(tab.getAttribute('data-rail-tab'));
      return;
    }
    var file = e.target.closest('[data-rail-open]');
    if (file) railOpenDoc(file.getAttribute('data-rail-open'));
  });

  window.addEventListener('resize', function () {
    closeTeam();
    closeAcct();
    if (state.railOpen) syncRail(true);
    if (state.deleteAsk) closeDeleteConfirm();
    if (state.galleryOpen) fitGalleryPreview();
    if (cuiModelMenu && !cuiModelMenu.hidden) alignCuiModelMenu();
    if (state.configId) closeConfigMenu(false);
  });
  document.addEventListener('scroll', function () {
    if (cuiModelMenu && !cuiModelMenu.hidden) alignCuiModelMenu();
  }, true);
  var pageRootEl = document.getElementById('pageRoot');
  if (pageRootEl) {
    pageRootEl.addEventListener(
      'scroll',
      function () {
        if (state.deleteAsk) closeDeleteConfirm();
      },
      { passive: true }
    );
  }

  document.addEventListener('scroll', function (e) {
    if (e.target.isConnected === false) return;
    if (state.configId && !e.target.closest?.('#widgetConfigHost')) closeConfigMenu(false);
    if (state.sessionFilterMenu && !e.target.closest?.('#sessionColumnFilter')) {
      if (e.target.matches?.('.page.is-sessions .table-body')) positionSessionPopover(document.getElementById('sessionColumnFilter'), state.sessionFilterMenu.anchor);
      else closeSessionFilter();
    }
    if (state.sessionDateMenu && !e.target.closest?.('#sessionDatePicker')) closeSessionDate();
  }, true);
  window.addEventListener('resize', function () { closeSessionActions(); closeSessionMark(); closeSessionFilter(); closeSessionDate(); });

  window.AIOpsWidget = {
    /* Monitoring pages tile the chart panel itself. The widget card chrome stays on 工作台. */
    panel: function (typeId, metricId, extraClass, helpHtml) {
      var type = widgetType(typeId);
      if (!type || !WIDGET_CHART_KIND[metricId]) return '';
      var chartTitle = metricId;
      for (var i = 0; i < type.metrics.length; i++) {
        if (type.metrics[i].id === metricId) chartTitle = t(type.metrics[i].label);
      }
      return trendPanelHtml(chartTitle, WIDGET_CHART_KIND[metricId], extraClass || '', helpHtml || '');
    }
  };

  if (window.AIOpsBoards) {
    window.AIOpsBoards.configure({
      getRange: function () {
        return state.range;
      },
      getDateRange: monitoringDateRange,
      setRange: function (v) {
        state.range = Number(v) || 1;
      },
      getPage: function () {
        return state.page;
      },
      getPageRoot: function () {
        return document.getElementById('pageRoot');
      },
      getLang: function () {
        return state.lang;
      },
      t: t,
      rerender: function () {
        render();
      }
    });
  }

  try {
    var savedLang = localStorage.getItem('aiops-lang');
    if (savedLang === 'en' || savedLang === 'zh') state.lang = savedLang;
    // rev 2: product default moved to 白底灰卡; drop the previously saved demo skin once.
    var skinRev = localStorage.getItem('aiops-widget-skin-rev');
    var savedSkin = localStorage.getItem('aiops-widget-skin');
    if (skinRev !== '2') {
      state.widgetSkin = 'inset';
      localStorage.setItem('aiops-widget-skin', 'inset');
      localStorage.setItem('aiops-widget-skin-rev', '2');
    } else if (savedSkin === 'border' || savedSkin === 'raised' || savedSkin === 'inset') {
      state.widgetSkin = savedSkin;
    }
  } catch (e) {}
  window.AIOpsSelectionLimit.configure({ lang: function () { return state.lang; }, toast: showToast });
  window.AIOpsRailPicker.configure({
    lang: function () { return state.lang; }, icons: paintIcons,
    dateControl: function () { return sessionDateControl('rail-picker'); }, closeDate: closeSessionDate, sceneForSession: sessionScene,
    owner: function () { return state.railOwner; },
    opened: function () { return state.railTabs.slice(); },
    items: function (kind) { return kind === 'ses' ? sessionRows().map(function (row) { return Object.assign({}, row, { id: 'ses:' + row.id }); }) : railArts(); },
    open: function (ids, owner) {
      if (!isCuiPage() || state.railOwner !== owner) return;
      var catalog = railCatalog();
      ids = ids.filter(function (id) { return !!catalog[id]; });
      if (!ids.length) return;
      ids.forEach(function (id) { if (state.railTabs.indexOf(id) < 0) state.railTabs.push(id); });
      state.railOpen = true; state.railCurrent = ids[0]; syncRail();
      var tab = document.querySelector('[data-rail-tab="' + ids[0] + '"]'); if (tab) tab.focus({ preventScroll: true });
    }
  });
  window.AIOpsContext.configure({
    lang: function () { return state.lang; },
    icons: paintIcons, toast: showToast,
    sessions: function () { return sessionRows().map(function (row) { return Object.assign({}, row, { kind: 'session', path: '线上会话 / ' + row.name }); }); },
    artifacts: function () { return railArts().map(function (row) { return { id: row.artifactId, kind: 'artifact', name: row.name, type: row.type, path: row.folder + ' / ' + row.name, updatedAt: row.updatedAt }; }); },
    owner: function () { var form = document.querySelector('[data-cui-composer]'); return { page: form.getAttribute('data-cui-page'), draftId: state.cuiDraftId }; },
    attach: function (refs, context) {
      var owner = context.owner;
      if (owner.page === '分析任务' && owner.draftId !== state.cuiDraftId) return;
      var seed = saveComposerDraft(owner.page, context.prompt, context.parts);
      seed.sessionRefs = (seed.sessionRefs || []).slice();
      refs.forEach(function (ref) { if (!seed.sessionRefs.some(function (row) { return row.id === ref.id && (row.kind || 'session') === (ref.kind || 'session'); })) seed.sessionRefs.push(ref); });
      var form = document.querySelector('[data-cui-composer]');
      if (form && form.getAttribute('data-cui-page') === owner.page) { state.cuiFocus = true; render({ keepRailBody: true }); }
    },
    open: function (id) { openComposerResource('ctx:' + id); },
    refresh: function (id) { if (state.railOpen && state.railCurrent === 'ctx:' + id) paintRail(); }
  });
  window.AIOpsWorkspaces.configure({
    lang: function () { return state.lang; }, t: t, page: navigationPage,
    render: render, renderNav: function () { renderNav(); paintIcons(); }, icons: paintIcons,
    toast: showToast, currentWorkspace: function () { return state.cuiWs; },
    scheduleLabel: function (item) { return window.AIOpsCapability && window.AIOpsCapability.workspaceTaskLabel(item.taskId); },
    pickWorkspace: function (id) { state.cuiWs = id; },
    newTask: function () { openNewTask(); },
    goHome: function () { state.page = '工作台'; },
    closeMenus: function () { closeNewMenu(); closeTeam(); closeAcct(); },
    moveWorkspace: function (oldName, newName) { if (window.AIOpsCapability) window.AIOpsCapability.moveWorkspace(oldName, newName); },
    renameTask: function (item, name) {
      if (item.kind === 'schedule' && window.AIOpsCapability) window.AIOpsCapability.renameByName(item.label || item.id, name);
    },
    deleteTask: function (item) {
      if (item.kind === 'schedule' && window.AIOpsCapability) window.AIOpsCapability.deleteByName(item.label || item.id);
      else { delete WS_CHATS[item.id]; delete state.cuiExtra[item.id]; }
    }
  }, [
    { id: 'audit', name: '关联审核智能体', items: WS_CHILDREN, open: true, scope: ['audit:agents:0', 'audit:objects:0', 'audit:objects:1'] },
    { id: 'default', name: '默认工作区', items: WS_DEFAULT, open: false, scope: ['audit:agents:0'] }
  ]);
  if (window.AIOpsCapability) window.AIOpsCapability.moveWorkspace('关账审核智能体', '关联审核智能体');
  state.homeWidgets = loadHomeWidgets() || defaultHomeWidgets();
  ensureWidgetCoords(state.homeWidgets, WIDGET_GRID_COLS);
  persistHomeWidgets();
  applyStaticLang();
  if (window.AIOpsCapability) {
    window.AIOpsCapability.bind({
      lang: function () { return state.lang; },
      t: t,
      referenceHtml: sessionReferenceHtml,
      toast: showToast,
      taskSaved: function (task) { if ((task.history || []).length) window.AIOpsWorkspaces.syncTask(task); else window.AIOpsWorkspaces.removeTask(task); },
      taskDeleted: function (task) { window.AIOpsWorkspaces.removeTask(task); },
      openConversationArtifact: function (id) {
        if (!canOpenArtifactRail()) return false;
        var open = function () { state.railOpen = true; railOpenDoc('art:' + id); syncRail(); };
        if (!state.railOpen && window.AIOpsColumns) window.AIOpsColumns.animate(open);
        else open();
        return true;
      },
      refreshRail: function () { paintRail(); paintIcons(); },
      conversationShell: function (task, record, thread, back, title) { return cuiShell('schedule-run:' + (record ? record.id : task.id), true, thread, { title: title, back: back, draft: record && record.chatDraft || '' }); },
      rerender: function (opts) { render(opts); },
      openScheduleChat: openScheduleChat,
      referenceArtifacts: function (refs, detail) {
        if (referenceInConversation(refs)) return;
        openNewTask({ page: '分析任务', skill: '', sessionRefs: refs, prompt: '' }, detail ? 'art:' + detail.id : null);
      },
      closeShellMenus: function () {
        closeNewMenu();
        closeTeam();
        closeAcct();
      }
    });
  }
  if (window.AIOpsSessionDetail) window.AIOpsSessionDetail.bind({
    lang: function () { return state.lang; },
    row: function (id) { return sessionRows().filter(function (row) { return row.id === id; })[0]; },
    render: function () {
      if (isCuiPage() && state.railOpen && state.railCurrent && state.railCurrent.indexOf('ses:') === 0) paintRail();
      else render();
    }, back: closeSessionDetail, analyze: function (id) { analyzeSessions([id]); }, toast: showToast
  });
  window.AIOpsResources.configure({
    lang: function () { return state.lang; }, icons: paintIcons, render: render,
    changed: function (reason) {
      state.sessionPage = 1; state.sessionSelected = {};
      if (reason === 'scene') {
        window.AIOpsPageTabs.clearViews();
        state.sessionFilters = { agent: [], user: [], mark: [], by: [] };
        window.AIOpsBusinessTasks.onSceneChange();
        window.AIOpsEvaluation.onSceneChange();
        window.AIOpsOnlineEvaluators.onSceneChange();
        if (window.AIOpsUnifiedPages) window.AIOpsUnifiedPages.onSceneChange();
      }
      state.sessionViewId = null;
      window.AIOpsResources.dismiss('session');
    },
    select: function (kind, id) { if (kind === 'session') { state.sessionViewId = id; if (!id) state.sessionRestore = true; } else window.AIOpsCapability.selectDetail(id); }
  });
  if (window.AIOpsEvaluationDemoRuntime) window.AIOpsEvaluationDemoRuntime.installCatalog();
  // Evaluation is a page-local prototype: every reload starts from the fixed demo catalog.
  var evaluationValues = Object.create(null);
  var evaluationStorage = {
    getItem: function (key) { return evaluationValues[key] || null; },
    setItem: function (key, value) { evaluationValues[key] = String(value); }
  };
  var evaluationStartupErrors = [];
  function evaluationStartupStep(label, work) {
    try {
      var result = work();
      if (result && result.ok === false) { evaluationStartupErrors.push(label + '：' + result.error); return false; }
      return true;
    } catch (error) { evaluationStartupErrors.push(label + '：' + error.message); return false; }
  }
  function evaluationStartupNotice() {
    if (!['评测实验', '评测集', '业务任务', '统一评估器', '评测任务'].includes(state.page)) return '';
    var messages = (evaluationStartupErrors || []).slice();
    return messages.length ? '<div class="ae-startup-notice" role="status">' + messages.map(esc).join('<br>') + '</div>' : '';
  }
  var legacyEvaluationSessions = function () { return sessionRows(false); };
  window.AIOpsBusinessTasks.configure({ lang: function () { return state.lang; }, sessions: legacyEvaluationSessions, render: render, icons: paintIcons, toast: showToast });
  window.AIOpsOnlineEvaluators.configure({ lang: function () { return state.lang; }, sessions: legacyEvaluationSessions, render: render, icons: paintIcons, toast: showToast });
  window.AIOpsApp = { navigate: go, refresh: render, page: function () { return state.page; } };
  if (window.AIOpsUnifiedBridge) window.AIOpsUnifiedBridge.configure({ storage: evaluationStorage });
  var evaluationDataReady = false;
  if (window.AIOpsUnifiedData) {
    window.AIOpsUnifiedData.configure(Object.assign({
      storage: evaluationStorage,
      seedOnlineTaskDemos: true,
      sessions: sessionRows,
      businessTasks: function () {
        return window.AIOpsEvaluation.taskCatalog().map(function (task) {
          return window.AIOpsUnifiedBridge && window.AIOpsUnifiedBridge.enrichTask ? window.AIOpsUnifiedBridge.enrichTask(task) : task;
        });
      },
      legacyEvaluators: function () {
        return ['sales', 'procurement'].flatMap(function (sceneId) {
          return evEvaluatorStore(sceneId).evaluators.map(function (record) { return Object.assign({ sceneId: sceneId }, JSON.parse(JSON.stringify(record))); });
        });
      },
      onRun: function () { if (state.page === '评测任务') render({ resetScroll: false }); }
    }, window.AIOpsEvaluationDemoOnline ? window.AIOpsEvaluationDemoOnline.evaluationDataOptions() : {}));
    evaluationDataReady = evaluationStartupStep('评估数据初始化失败', function () { return window.AIOpsUnifiedData.initialize(); });
  }
  if (window.AIOpsUnifiedBridge) evaluationStartupStep('评测关联初始化失败', function () { return window.AIOpsUnifiedBridge.initialize(); });
  var evaluationCatalogReady = evaluationDataReady;
  if (evaluationDataReady && window.AIOpsEvaluationDemoOnline) evaluationCatalogReady = evaluationStartupStep('演示评估器初始化失败', function () { return window.AIOpsEvaluationDemoOnline.initialize(window.AIOpsUnifiedData); });
  if (evaluationCatalogReady && window.AIOpsEvaluationDemoRuntime) evaluationStartupStep('演示实验初始化失败', function () { return window.AIOpsEvaluationDemoRuntime.initializeExperiments(); });
  if (evaluationDataReady && window.AIOpsUnifiedData.startScheduler) window.AIOpsUnifiedData.startScheduler();
  if (window.AIOpsUnifiedPages) window.AIOpsUnifiedPages.configure({ refresh: render, render: render, navigate: go, icons: paintIcons, toast: showToast });
  var pageViewKeys=['range','monitoringDateRange','workspaceSchedulePage','sessionPage','sessionViewId','sessionListScroll','sessionQuery','sessionSort','sessionFilters','sessionDateRange','sessionSelected','artifactId','notifyType'];
  function copyPageValue(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
  window.AIOpsPageTabs.configure({
    navigate:go,currentPage:function(){return state.page;},label:t,icons:paintIcons,
    reset:function(page){if(window.AIOpsEvaluation.isPage(page))window.AIOpsEvaluation.resetView(page);if(page==='在线评估器')window.AIOpsOnlineEvaluators.onSceneChange();if(window.AIOpsUnifiedPages)window.AIOpsUnifiedPages.resetView(page);},
    icon:function(page){return navIcon(NAV_PRIMARY.concat(NAV_MONITOR,NAV_EVALUATION).filter(function(item){return item.id===page;})[0]);},
    capture:function(page){
      var values={};pageViewKeys.forEach(function(key){values[key]=copyPageValue(state[key]);});
      return {page:state.page,scrollTop:document.getElementById('pageRoot').scrollTop,values:values,
        evaluation:window.AIOpsEvaluation.isPage(page)?window.AIOpsEvaluation.captureView(page):null,
        online:page==='在线评估器'?window.AIOpsOnlineEvaluators.captureView():null,
        unified:['统一评估器','评测任务'].includes(page)&&window.AIOpsUnifiedPages?window.AIOpsUnifiedPages.captureView(page):null,
        capability:['定时任务','产出物'].indexOf(page)>=0?window.AIOpsCapability.captureView(page):null};
    },
    restore:function(page,saved){
      if(!saved)return;
      Object.keys(saved.values||{}).forEach(function(key){state[key]=copyPageValue(saved.values[key]);});
      state.page=saved.page;
      if(saved.evaluation)window.AIOpsEvaluation.restoreView(saved.evaluation,page);
      if(saved.online)window.AIOpsOnlineEvaluators.restoreView(saved.online);
      if(saved.unified&&window.AIOpsUnifiedPages)window.AIOpsUnifiedPages.restoreView(saved.unified,page);
      if(saved.capability)window.AIOpsCapability.restoreView(page,saved.capability);
    }
  });
  render();
})();
