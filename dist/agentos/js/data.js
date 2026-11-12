/* AgentOS · 炼铁厂智能体平台演示数据（全部为 Mock） */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});

  const users = [
    { id: 'u-wang', name: '王建国', title: '高级工程师', dept: '炼铁技术中心', clearance: 'secret' },
    { id: 'u-li', name: '李敏', title: '科研项目主管', dept: '科技管理部', clearance: 'internal' },
    { id: 'u-zhang', name: '张涛', title: '情报研究员', dept: '科技情报室', clearance: 'internal' },
    { id: 'u-chen', name: '陈晓', title: '平台管理员', dept: '信息中心', clearance: 'confidential' }
  ];

  const orgs = ['炼铁技术中心', '科技管理部', '科技情报室', '信息中心', '高炉车间', '烧结车间'];

  const categories = [
    { id: 'knowledge', name: '资料查询与知识管理', icon: 'library' },
    { id: 'project', name: '课题立项与过程管理', icon: 'list-checks' },
    { id: 'rnd', name: '研发与技术攻关', icon: 'flask-conical' },
    { id: 'ip', name: '成果与知识产权', icon: 'award' },
    { id: 'intel', name: '调研与技术情报', icon: 'radar' }
  ];

  const tools = [
    {
      id: 'doc_search', name: '文档检索', icon: 'file-search', group: 'internal', phase: 1, appliesTo: 'PDF / Word',
      ingest: '版面解析，扫描件 OCR，识别表格和公式，按章节切片，保留页码',
      capability: '向量 + 关键词 + 元数据混合检索，重排后返回片段与页码',
      params: [
        { key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 5 },
        { key: 'library', label: '限定资料库', type: 'select', options: ['全部资料库', '科研报告库', '课题库', '标准库', '专家经验库'], default: '全部资料库' }
      ],
      safety: ['调用时按用户的部门权限和密级过滤', '返回结果带资料密级，供出网策略判断']
    },
    {
      id: 'cad_search', name: '图纸检索', icon: 'drafting-compass', group: 'internal', phase: 2, appliesTo: 'CAD（DWG / DXF）',
      ingest: '生成缩略图；尽量自动读取标题栏字段（图号、名称、版本、设计人、日期），读取不到时人工补录',
      capability: '按文件名、图号、标题栏字段、标签和所属课题检索，返回图纸文件与预览；不理解图纸内容',
      params: [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 5 }],
      safety: ['只检索文件信息与标题栏字段，不解析图纸几何内容']
    },
    {
      id: 'code_search', name: '代码检索', icon: 'code', group: 'internal', phase: 2, appliesTo: '代码仓库',
      ingest: '按仓库同步，按函数、类切片，保留文件路径与行号',
      capability: '代码语义检索 + 关键词检索，返回代码片段与行号',
      params: [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 3 }],
      safety: ['只读同步，不向仓库写入']
    },
    {
      id: 'db_query', name: '数据查询', icon: 'database', group: 'internal', phase: 2, appliesTo: '厂内数据库、科研管理系统',
      ingest: '不入库；维护数据字典（表、字段、含义、单位、示例值）',
      capability: '生成只读 SQL，校验后执行，返回表格或图表',
      params: [{ key: 'maxRows', label: '最大返回行数', type: 'number', min: 10, max: 1000, default: 200 }],
      safety: ['独立只读账号，只开放数据字典登记的表和字段', '只允许查询语句，限制返回行数和执行时长', '记录每次 SQL、执行人、结果行数和耗时']
    },
    {
      id: 'data_analysis', name: '数据分析', icon: 'chart-line', group: 'none', phase: 3, appliesTo: '数据查询返回的结果',
      ingest: '无',
      capability: '在内网沙箱中执行统计计算和绘图，返回分析结果与图表；不能访问网络和数据源',
      params: [{ key: 'timeout', label: '单次执行上限（秒）', type: 'number', min: 5, max: 120, default: 30 }],
      safety: ['沙箱禁止访问网络、文件系统和数据库', '限制单次执行时长和内存，超限即终止', '记录执行代码、输入摘要和输出']
    },
    {
      id: 'web_search', name: '联网搜索', icon: 'globe', group: 'public', phase: 1, appliesTo: '互联网',
      ingest: '无',
      capability: '发送检索关键词，返回网页标题、摘要和地址',
      params: [
        { key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 6 },
        { key: 'timeRange', label: '时间范围', type: 'select', options: ['不限', '近一个月', '近一年', '近三年'], default: '近三年' }
      ],
      safety: ['只发送检索关键词，不发送厂内资料内容', '经出口网关，命中敏感词即拦截并审计']
    },
    {
      id: 'web_fetch', name: '网页读取', icon: 'newspaper', group: 'public', phase: 1, appliesTo: '互联网',
      ingest: '无',
      capability: '抓取网页并提取正文',
      params: [{ key: 'maxPages', label: '单次最多读取网页数', type: 'number', min: 1, max: 10, default: 4 }],
      safety: ['只访问出口网关白名单内的域名']
    },
    {
      id: 'report_export', name: '报告导出', icon: 'file-down', group: 'none', phase: 1, appliesTo: '对话内容或报告',
      ingest: '管理员上传 Word 模板并标注章节占位（二期）',
      capability: '将对话内容或报告生成 Word / Markdown 文件；二期支持按模板章节填充',
      params: [{ key: 'format', label: '默认格式', type: 'select', options: ['Word', 'Markdown'], default: 'Word' }],
      safety: ['使用了厂内资料的报告，导出时标注最高引用资料的密级']
    }
  ];

  const v = (id, status, createdAt, note, extra) => Object.assign({ id, status, createdAt, note, trialUsers: [] }, extra || {});

  const agents = [
    {
      id: 'research-assistant', name: '科研资料助手', core: true, category: 'knowledge', icon: 'library', flow: 'research', template: 'qa', batch: 1,
      desc: '炼铁厂科研资料的查询与管理，资料类型包括 PDF、Word、CAD、代码和数据库数据',
      prompt: '你是炼铁厂科研资料助手。只依据检索到的厂内资料和公开资料回答，每个结论标注引用来源；检索不到可靠依据时明确说明“未找到相关资料”，不编造答案。',
      allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'internal',
      tools: ['doc_search', 'cad_search', 'code_search', 'db_query', 'web_search', 'web_fetch'],
      opening: '可以直接提问，也可以切换到“资料检索”模式查找报告原件或图纸。',
      suggestions: ['2号高炉低硅冶炼的主要措施有哪些？', '烧结矿转鼓强度下降一般是什么原因？', '找一下2号高炉冷却壁布置图', '近一个月2号高炉焦比和煤比的变化'],
      versions: [v('v1.0', 'online', '2026-10-20 10:00', '首次上线'), v('v1.1', 'trial', '2026-11-05 16:30', '回答增加工序筛选提示', { trialUsers: ['王建国', '李敏'] })]
    },
    {
      id: 'standard-query', name: '标准规范查询助手', category: 'knowledge', icon: 'scale', flow: 'qa', template: 'qa', batch: 2,
      desc: '查询国家、行业、企业标准条款，对比新旧版本差异，判断工艺或产品是否合规',
      prompt: '你是标准规范查询助手。引用条款时给出标准编号、条款号和版本，比较新旧版本时逐条列出差异。',
      allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'all',
      tools: ['doc_search', 'web_search', 'web_fetch'], toolParams: { doc_search: { library: '标准库' } },
      opening: '输入标准名称、编号或工艺问题，我会给出相关条款。', suggestions: ['高炉操作技术规程对炉顶压力有什么要求？', '超低排放对烧结烟气颗粒物的限值是多少？'], versions: []
    },
    {
      id: 'expert-knowledge', name: '专家经验沉淀助手', category: 'knowledge', icon: 'book-marked', flow: 'qa', template: 'workflow', batch: 2,
      desc: '将专家访谈转写稿、经验笔记整理为结构化知识条目，经确认后入库，供其他智能体检索',
      prompt: '你是专家经验沉淀助手。把访谈内容整理为“现象—判断—处置—注意事项”的知识条目，标注待专家确认的内容。',
      allowedModels: ['internal'], defaultModel: 'internal', defaultScope: 'internal',
      tools: ['doc_search', 'report_export'], toolParams: { doc_search: { library: '专家经验库' } },
      opening: '粘贴访谈转写稿或经验笔记，我会整理成知识条目。', suggestions: ['整理一下高炉炉凉的判断经验'], versions: []
    },
    {
      id: 'novelty-check', name: '立项查新助手', category: 'project', icon: 'search-check', flow: 'novelty', template: 'report', batch: 1,
      desc: '立项前检索厂内已有课题和外部论文、专利，判断是否重复，生成查新报告',
      prompt: '你是立项查新助手。先提炼查新要点和关键词请用户确认，再分别做厂内查重和外部查新，逐要点给出结论。结论仅作内部立项参考。',
      allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'all',
      tools: ['doc_search', 'web_search', 'web_fetch', 'report_export'], toolParams: { doc_search: { library: '课题库' } },
      opening: '输入拟立项课题的名称、研究内容和预期目标，我会先提炼查新要点。',
      suggestions: ['拟立项：基于机器学习的高炉炉温智能预测，目标铁水硅含量预测误差小于 0.05%', '拟立项：高比例球团矿条件下高炉低碳冶炼技术研究'],
      versions: [v('v1.0', 'online', '2026-10-28 09:00', '首次上线')]
    },
    {
      id: 'proposal-writer', name: '课题申报书助手', category: 'project', icon: 'square-pen', flow: 'report', template: 'report', batch: 2,
      desc: '按厂内模板撰写可行性研究报告和申报书，引用历史课题成果和外部数据',
      prompt: '你是课题申报书助手。按厂内申报书模板章节撰写，引用历史课题成果和外部数据并标注来源。',
      allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'all',
      tools: ['doc_search', 'web_search', 'web_fetch', 'report_export'], opening: '告诉我课题名称和研究方向，我先给出申报书大纲。', suggestions: ['写一份高炉炉缸长寿技术研究的申报书'], versions: []
    },
    {
      id: 'closure-acceptance', name: '结题验收助手', category: 'project', icon: 'clipboard-check', flow: 'report', template: 'report', batch: 2,
      desc: '汇总课题月报和试验记录，生成结题报告与验收材料，核对任务书指标完成情况',
      prompt: '你是结题验收助手。逐项核对任务书考核指标与实际完成值，未达标的指标单独列出。',
      allowedModels: ['internal'], defaultModel: 'internal', defaultScope: 'internal',
      tools: ['doc_search', 'db_query', 'report_export'], opening: '输入课题编号或名称，我会汇总材料并核对指标。', suggestions: ['核对高炉智能炉温预测模型课题的任务书指标'], versions: []
    },
    {
      id: 'process-diagnosis', name: '工艺问题诊断助手', category: 'rnd', icon: 'activity', flow: 'qa', template: 'qa', batch: 2, constraint: 'diagnosis',
      desc: '炉况异常、烧结矿质量波动、铁水成分偏差等问题出现时，检索历史攻关报告和事故分析，结合生产数据给出排查思路',
      prompt: '你是工艺问题诊断助手。只提供排查思路和历史依据，不直接给出操作指令；回答末尾注明“需由工艺人员确认后执行”。',
      allowedModels: ['internal'], defaultModel: 'internal', defaultScope: 'internal',
      tools: ['doc_search', 'db_query'], opening: '描述异常现象和发生时间，我会检索历史案例并结合生产数据给出排查思路。', suggestions: ['2号高炉近三天铁水硅含量持续偏高，可能是什么原因？'], versions: []
    },
    {
      id: 'experiment-design', name: '试验方案设计助手', category: 'rnd', icon: 'flask-conical', flow: 'report', template: 'report', batch: 2,
      desc: '根据研究目标和历史试验，生成试验方案、参数范围、检测项目和安全注意事项',
      prompt: '你是试验方案设计助手。方案包括试验目的、参数范围、检测项目、进度安排和安全注意事项，参数范围需给出历史依据。',
      allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'all',
      tools: ['doc_search', 'web_search', 'web_fetch', 'report_export'], opening: '说明研究目标和约束条件，我先给出方案大纲。', suggestions: ['设计一个提高球团矿配比至 40% 的工业试验方案'], versions: []
    },
    {
      id: 'experiment-analysis', name: '试验数据分析助手', category: 'rnd', icon: 'chart-line', flow: 'qa', template: 'qa', batch: 3,
      desc: '查询试验和生产数据，做对比、趋势分析并出图，撰写分析结论',
      prompt: '你是试验数据分析助手。先说明数据来源和统计口径，再给出趋势、对比和结论。',
      allowedModels: ['internal'], defaultModel: 'internal', defaultScope: 'internal',
      tools: ['db_query', 'data_analysis', 'report_export'], opening: '说明要分析的指标、对象和时间范围。', suggestions: ['分析近一个月2号高炉焦比与铁水硅含量的关系'], versions: []
    },
    {
      id: 'patent-disclosure', name: '专利挖掘与交底书助手', category: 'ip', icon: 'lightbulb', flow: 'report', template: 'report', batch: 2, constraint: 'patent',
      desc: '从结题报告中找出可申请专利的技术点，检索现有技术，撰写技术交底书',
      prompt: '你是专利挖掘与交底书助手。从结题报告中识别创新点，检索现有技术并说明区别，按交底书格式撰写。',
      allowedModels: ['internal'], defaultModel: 'internal', defaultScope: 'all',
      tools: ['doc_search', 'web_search', 'web_fetch', 'report_export'], opening: '指定一份结题报告或描述技术方案，我先列出可申请专利的技术点。', suggestions: ['从低硅冶炼攻关总结中挖掘专利点'], versions: []
    },
    {
      id: 'award-application', name: '成果与奖项申报助手', category: 'ip', icon: 'award', flow: 'report', template: 'report', batch: 2,
      desc: '汇总课题成果和经济效益，生成科技成果鉴定材料、科技进步奖申报书',
      prompt: '你是成果与奖项申报助手。经济效益数据必须给出来源和计算口径。',
      allowedModels: ['internal'], defaultModel: 'internal', defaultScope: 'internal',
      tools: ['doc_search', 'report_export'], opening: '告诉我要申报的成果和奖项类别。', suggestions: ['为喷煤比提升攻关成果准备科技进步奖申报材料'], versions: []
    },
    {
      id: 'tech-summary', name: '技术总结与论文助手', category: 'ip', icon: 'file-pen-line', flow: 'report', template: 'report', batch: 2,
      desc: '将课题成果整理为技术总结、内部技术报告或论文初稿',
      prompt: '你是技术总结与论文助手。区分厂内结论与公开文献，论文初稿避免出现未公开的工艺参数。',
      allowedModels: ['internal', 'external'], defaultModel: 'internal', defaultScope: 'all',
      tools: ['doc_search', 'web_search', 'web_fetch', 'report_export'], opening: '指定课题或资料，并说明要写技术总结还是论文。', suggestions: ['把炉缸侵蚀监测课题整理成论文初稿'], versions: []
    },
    {
      id: 'survey-report', name: '调研报告助手', core: true, category: 'intel', icon: 'file-text', flow: 'survey', template: 'report', batch: 1,
      desc: '根据互联网公开资料撰写调研报告，可结合厂内资料',
      prompt: '你是调研报告助手。先生成大纲请用户确认，再按章节检索并撰写；正文标注引用并区分公开来源和厂内资料，低可信来源单独标记。',
      allowedModels: ['internal', 'external'], defaultModel: 'external', defaultScope: 'public',
      tools: ['web_search', 'web_fetch', 'doc_search', 'report_export'],
      opening: '输入调研主题、用途和篇幅要求，我会先给出报告大纲。',
      suggestions: ['调研国内外氢冶金技术进展，用于技术路线论证，约 5000 字', '调研烧结烟气超低排放治理技术路线'],
      versions: [v('v1.0', 'online', '2026-10-20 10:00', '首次上线')]
    },
    {
      id: 'intel-brief', name: '技术情报简报助手', category: 'intel', icon: 'radar', flow: 'intel', template: 'report', batch: 1, scheduleBatch: 3,
      desc: '跟踪同行企业、科研院所的技术动态、专利和论文，生成月度技术情报简报',
      prompt: '你是技术情报简报助手。按技术动态、专利、论文、政策标准、行业事件分类，每条给出摘要、来源、发布时间和对本厂的关注度。',
      allowedModels: ['internal', 'external'], defaultModel: 'external', defaultScope: 'public',
      tools: ['web_search', 'web_fetch', 'report_export'],
      opening: '输入跟踪主题、关注对象和时间范围（默认上一个自然月）。',
      suggestions: ['跟踪上月高炉低碳冶炼和氢冶金技术动态', '跟踪上月烧结烟气治理技术动态'],
      versions: [v('v0.9', 'trial', '2026-11-03 14:00', '手动版试用', { trialUsers: ['张涛', '王建国'] })]
    }
  ];

  const docs = [
    { id: 'd01', type: 'pdf', title: '2号高炉低硅冶炼技术攻关总结报告', library: '科研报告库', process: '高炉', topic: '低硅冶炼', year: 2024, author: '王建国', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 86,
      keywords: ['低硅', '硅含量', '铁水硅', '炉温', '高炉', '冶炼', '2号高炉', '焦比'],
      summary: '通过提高顶压、优化布料矩阵和控制理论燃烧温度，2号高炉铁水硅含量由 0.48% 降至 0.32%，焦比下降 6 kg/t。',
      snippets: [{ loc: '第 12 页', text: '将炉顶压力由 210 kPa 提高至 225 kPa，配合中心加焦量调整，铁水硅含量月均值下降 0.09 个百分点。' }, { loc: '第 31 页', text: '理论燃烧温度控制在 2150～2200 ℃，可兼顾炉缸热量与低硅目标。' }] },
    { id: 'd02', type: 'word', title: '高比例球团矿高炉冶炼试验研究', library: '科研报告库', process: '高炉', topic: '球团矿', year: 2023, author: '赵立新', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 54,
      keywords: ['球团', '球团矿', '配比', '高炉', '低碳', '冶炼', '软熔带'],
      summary: '球团矿配比由 22% 提高到 35% 时，高炉透气性指数保持稳定，渣量下降约 18 kg/t。',
      snippets: [{ loc: '第 8 页', text: '球团矿配比每提高 5 个百分点，渣量约下降 6 kg/t，需同步关注软熔带位置上移。' }] },
    { id: 'd03', type: 'pdf', title: '烧结矿质量波动原因分析及对策', library: '科研报告库', process: '烧结', topic: '烧结矿质量', year: 2024, author: '孙海', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 42,
      keywords: ['烧结', '烧结矿', '转鼓', '强度', '碱度', 'FeO', '质量', '波动'],
      summary: '转鼓强度下降主要与混匀矿成分波动、燃料粒度偏粗和碱度控制偏差有关。',
      snippets: [{ loc: '第 15 页', text: '燃料粒度 <3 mm 比例低于 75% 时，转鼓强度平均下降 1.2 个百分点。' }, { loc: '第 22 页', text: '碱度波动超过 ±0.08 时，成品矿强度波动明显增大。' }] },
    { id: 'd04', type: 'pdf', title: '焦炭热态性能对高炉顺行的影响研究', library: '科研报告库', process: '焦化', topic: '焦炭质量', year: 2022, author: '周明', dept: '炼铁技术中心', level: 'public', acl: [], pages: 18,
      keywords: ['焦炭', '热态', 'CSR', '顺行', '高炉', '焦比'],
      summary: '焦炭反应后强度 CSR 低于 62% 时，高炉压差波动明显增大（已公开发表）。',
      snippets: [{ loc: '第 5 页', text: 'CSR 每下降 1 个百分点，燃料比约上升 1.5 kg/t。' }] },
    { id: 'd05', type: 'word', title: '高炉富氢喷吹工业试验方案', library: '科研报告库', process: '高炉', topic: '富氢喷吹', year: 2025, author: '王建国', dept: '炼铁技术中心', level: 'secret', acl: ['炼铁技术中心'], pages: 37,
      keywords: ['氢', '富氢', '喷吹', '低碳', '氢冶金', '高炉', '焦炉煤气'],
      summary: '拟在 3 号高炉开展焦炉煤气喷吹工业试验，分三阶段提高喷吹量，同步监测炉缸热状态。',
      snippets: [{ loc: '第 6 页', text: '第一阶段喷吹量按 20 m³/t 控制，稳定运行 30 天后评估置换比。' }] },
    { id: 'd06', type: 'pdf', title: '3号高炉炉缸侵蚀监测与长寿技术', library: '科研报告库', process: '高炉', topic: '炉缸长寿', year: 2023, author: '刘强', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 64,
      keywords: ['炉缸', '侵蚀', '长寿', '监测', '热电偶', '高炉'],
      summary: '建立炉缸侵蚀在线监测模型，侵蚀线计算误差控制在 50 mm 以内。',
      snippets: [{ loc: '第 19 页', text: '采用二维传热反问题模型，结合 128 个热电偶数据反演侵蚀线。' }] },
    { id: 'd07', type: 'word', title: '低碳炼铁技术路线研究（2025—2030）', library: '科研报告库', process: '综合', topic: '低碳冶炼', year: 2025, author: '技术路线研究组', dept: '科技管理部', level: 'secret', acl: [], pages: 72,
      keywords: ['低碳', '氢冶金', '富氢', 'CCUS', '技术路线', '碳排放', '高炉'],
      summary: '提出“高炉富氢 + 球团提比 + CCUS 试点”三步走路线，2030 年吨铁碳排放目标下降 15%。',
      snippets: [{ loc: '第 3 页', text: '近期以高炉富氢喷吹和提高球团矿比例为主，中期开展 CCUS 示范。' }] },
    { id: 'd08', type: 'pdf', title: '烧结烟气循环技术应用评估', library: '科研报告库', process: '烧结', topic: '烟气治理', year: 2024, author: '孙海', dept: '炼铁技术中心', level: 'public', acl: [], pages: 26,
      keywords: ['烧结', '烟气', '循环', '超低排放', '减排', '脱硫', '脱硝'],
      summary: '烟气循环率 25% 时，外排烟气量下降约 20%，固体燃耗下降 2 kg/t（会议公开论文）。',
      snippets: [{ loc: '第 9 页', text: '循环烟气含氧量需保持在 18% 以上，以免影响烧结矿质量。' }] },
    { id: 'd09', type: 'pdf', title: '高炉喷煤比提升技术攻关结题报告', library: '科研报告库', process: '高炉', topic: '喷煤', year: 2022, author: '王建国', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 58,
      keywords: ['喷煤', '煤比', '焦比', '燃料比', '高炉', '置换比'],
      summary: '喷煤比由 150 kg/t 提高到 175 kg/t，置换比 0.82，年节约焦炭约 3.1 万吨。',
      snippets: [{ loc: '第 27 页', text: '富氧率提高 1 个百分点，可支撑喷煤比提升约 12 kg/t。' }] },
    { id: 'd10', type: 'word', title: '炉料配方优化方案（2026 年度）', library: '科研报告库', process: '高炉', topic: '炉料结构', year: 2026, author: '炼铁技术中心', dept: '炼铁技术中心', level: 'confidential', acl: ['炼铁技术中心'], pages: 15,
      keywords: ['炉料', '配方', '配比', '球团', '烧结矿', '高炉'],
      summary: '2026 年度炉料结构与配比调整方案。', snippets: [{ loc: '第 2 页', text: '（机密内容）' }] },
    { id: 'd11', type: 'pdf', title: 'Q/LT 102-2024 高炉操作技术规程', library: '标准库', process: '高炉', topic: '企业标准', year: 2024, author: '标准化办公室', dept: '科技管理部', level: 'internal', acl: [], pages: 40,
      keywords: ['规程', '标准', '炉顶压力', '操作', '高炉', '条款'],
      summary: '企业标准，规定高炉开炉、休风、炉况调整等操作要求。',
      snippets: [{ loc: '第 5.3 条', text: '正常生产时炉顶压力波动范围不超过 ±10 kPa。' }] },
    { id: 'd12', type: 'word', title: '高炉炉况判断经验汇编（专家访谈整理）', library: '专家经验库', process: '高炉', topic: '专家经验', year: 2025, author: '经验沉淀小组', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 33,
      keywords: ['炉况', '炉凉', '炉热', '经验', '判断', '高炉', '硅含量', '风口'],
      summary: '整理 6 位退休专家对炉凉、炉热、悬料等炉况的判断经验。',
      snippets: [{ loc: '第 4 页', text: '风口发暗、铁水硅含量连续两炉下降超过 0.1 个百分点，应警惕炉凉。' }] },
    { id: 'd13', type: 'word', title: '2025 年度科研课题立项清单', library: '课题库', process: '综合', topic: '课题管理', year: 2025, author: '科技管理部', dept: '科技管理部', level: 'internal', acl: [], pages: 12,
      keywords: ['课题', '立项', '清单', '炉温', '预测', '球团', '低碳', '智能'],
      summary: '2025 年度立项课题 23 项，其中含“高炉炉温智能预测模型研究”“高比例球团矿冶炼”等。',
      snippets: [{ loc: '第 3 页', text: 'KJ-2025-07 高炉炉温智能预测模型研究，承担部门：炼铁技术中心，周期 18 个月。' }] },
    { id: 'd14', type: 'pdf', title: '高炉炉温智能预测模型研究课题任务书', library: '课题库', process: '高炉', topic: '智能炉温', year: 2025, author: '刘强', dept: '炼铁技术中心', level: 'internal', acl: [], pages: 16,
      keywords: ['炉温', '预测', '模型', '机器学习', '硅含量', '智能', '课题'],
      summary: '考核指标：铁水硅含量预测命中率（±0.1%）不低于 85%，模型在 2 号高炉上线运行。',
      snippets: [{ loc: '第 4 页', text: '采用 LSTM 与梯度提升树融合模型，预测提前量 2 小时。' }] },
    { id: 'c01', type: 'cad', title: '2号高炉炉体冷却壁布置图', library: '图纸库', process: '高炉', topic: '炉体结构', year: 2023, author: '刘工', dept: '炼铁技术中心', level: 'internal', acl: [],
      keywords: ['冷却壁', '布置图', '炉体', '2号高炉', '图纸'], summary: 'DWG · 标题栏自动识别',
      cad: { format: 'DWG', drawingNo: 'LT-GL2-0312', version: 'B', designer: '刘工', date: '2023-06', titleBlock: 'auto' } },
    { id: 'c02', type: 'cad', title: '烧结机台车改造总图', library: '图纸库', process: '烧结', topic: '设备改造', year: 2024, author: '马工', dept: '烧结车间', level: 'internal', acl: [],
      keywords: ['烧结机', '台车', '改造', '总图', '图纸'], summary: 'DWG · 标题栏自动识别',
      cad: { format: 'DWG', drawingNo: 'SJ-1-0108', version: 'C', designer: '马工', date: '2024-03', titleBlock: 'auto' } },
    { id: 'c03', type: 'cad', title: '热风炉燃烧器结构图', library: '图纸库', process: '高炉', topic: '热风炉', year: 2021, author: '何工', dept: '炼铁技术中心', level: 'internal', acl: [],
      keywords: ['热风炉', '燃烧器', '结构图', '图纸'], summary: 'DXF · 人工补录标题栏',
      cad: { format: 'DXF', drawingNo: 'RF-3-0021', version: 'A', designer: '何工', date: '2021-09', titleBlock: 'manual' } },
    { id: 'c04', type: 'cad', title: '喷煤系统工艺流程图', library: '图纸库', process: '高炉', topic: '喷煤', year: 2022, author: '', dept: '炼铁技术中心', level: 'internal', acl: [],
      keywords: ['喷煤', '流程图', '工艺', '图纸'], summary: 'DWG · 标题栏未识别',
      cad: { format: 'DWG', drawingNo: '', version: '', designer: '', date: '', titleBlock: 'missing' } },
    { id: 'k01', type: 'code', title: '高炉炉温预测模型（bf-temp-predict）', library: '代码库', process: '高炉', topic: '智能炉温', year: 2025, author: '刘强', dept: '炼铁技术中心', level: 'internal', acl: [],
      keywords: ['炉温', '预测', '模型', '代码', '程序', '硅含量', '特征'],
      summary: 'Python · 46 个文件 · main 分支', code: { repo: 'bf-temp-predict', branch: 'main', lang: 'Python', files: 46 },
      snippets: [{ loc: 'features/thermal.py:42', text: 'def build_thermal_index(df):\n    """综合风温、富氧率与煤比构造热状态指数"""' }] },
    { id: 'k02', type: 'code', title: '烧结配料计算程序（sinter-burden-calc）', library: '代码库', process: '烧结', topic: '配料', year: 2023, author: '孙海', dept: '炼铁技术中心', level: 'internal', acl: [],
      keywords: ['配料', '计算', '烧结', '碱度', '程序', '代码'],
      summary: 'C# · 28 个文件 · master 分支', code: { repo: 'sinter-burden-calc', branch: 'master', lang: 'C#', files: 28 },
      snippets: [{ loc: 'Core/BasicityCalculator.cs:88', text: 'public double CalcBasicity(Mix mix) => mix.CaO / mix.SiO2;' }] },
    { id: 'b01', type: 'db', title: '高炉生产日报库（MES 只读）', library: '数据库', process: '高炉', topic: '生产数据', year: 2026, author: '信息中心', dept: '信息中心', level: 'internal', acl: [],
      keywords: ['焦比', '煤比', '利用系数', '硅含量', '铁水温度', '日报', '数据', '趋势', '变化'],
      summary: '数据字典已登记 1 张表、7 个字段',
      db: { tables: [{ name: 'bf_daily', desc: '高炉生产日报', fields: [
        { name: 'prod_date', meaning: '日期', unit: '', sample: '2026-11-10' },
        { name: 'bf_no', meaning: '高炉号', unit: '', sample: '2' },
        { name: 'productivity', meaning: '利用系数', unit: 't/(m³·d)', sample: '2.46' },
        { name: 'coke_rate', meaning: '焦比', unit: 'kg/t', sample: '352' },
        { name: 'coal_rate', meaning: '煤比', unit: 'kg/t', sample: '168' },
        { name: 'hm_si', meaning: '铁水硅含量', unit: '%', sample: '0.34' },
        { name: 'hm_temp', meaning: '铁水温度', unit: '℃', sample: '1502' }] }] } },
    { id: 'b02', type: 'db', title: '科研项目管理系统（只读）', library: '数据库', process: '综合', topic: '课题管理', year: 2026, author: '科技管理部', dept: '科技管理部', level: 'internal', acl: [],
      keywords: ['课题', '项目', '经费', '进度', '指标', '验收'], summary: '数据字典已登记 1 张表、5 个字段',
      db: { tables: [{ name: 'project', desc: '科研课题', fields: [
        { name: 'project_no', meaning: '课题编号', unit: '', sample: 'KJ-2025-07' },
        { name: 'name', meaning: '课题名称', unit: '', sample: '高炉炉温智能预测模型研究' },
        { name: 'owner', meaning: '负责人', unit: '', sample: '刘强' },
        { name: 'status', meaning: '状态', unit: '', sample: '执行中' },
        { name: 'budget', meaning: '经费', unit: '万元', sample: '180' }] }] } }
  ].map(d => Object.assign({ status: 'parsed', updatedAt: d.year + '-10-15' }, d));

  const web = [
    { id: 'w01', title: '氢冶金技术进展与工程化路径综述', source: '《钢铁研究学报》', url: 'https://example.com/journal/h2-metallurgy-review', date: '2026-06-18', credibility: '高', tags: ['氢', '氢冶金', '低碳', '富氢', '高炉', '技术路线'],
      summary: '综述氢基竖炉、高炉富氢喷吹两条路线的工程进展，认为近期高炉富氢喷吹的改造成本更低。' },
    { id: 'w02', title: '某钢企 2500 m³ 高炉焦炉煤气喷吹工业试验取得阶段成果', source: '中国冶金报', url: 'https://example.com/news/coke-oven-gas-injection', date: '2026-10-21', credibility: '高', tags: ['氢', '富氢', '喷吹', '焦炉煤气', '高炉', '低碳'],
      summary: '试验期间焦比下降约 10 kg/t，吨铁碳排放下降约 3%。' },
    { id: 'w03', title: '一种高炉富氢喷吹控制方法（发明专利公开）', source: '国家知识产权局专利检索', url: 'https://example.com/patent/cn-h2-injection-control', date: '2026-10-09', credibility: '高', tags: ['专利', '富氢', '喷吹', '高炉', '氢'],
      summary: '根据炉缸热状态动态调整富氢气体喷吹量，公开了喷吹量与风口理论燃烧温度的联动规则。' },
    { id: 'w04', title: '基于深度学习的高炉铁水硅含量预测研究', source: '《钢铁》期刊', url: 'https://example.com/journal/si-prediction-dl', date: '2025-08-02', credibility: '高', tags: ['炉温', '预测', '硅含量', '机器学习', '深度学习', '模型', '智能'],
      summary: '采用 LSTM 模型预测提前 1 小时的铁水硅含量，命中率（±0.1%）达到 87%。' },
    { id: 'w05', title: '一种基于多模型融合的高炉炉温预测方法（发明专利）', source: '国家知识产权局专利检索', url: 'https://example.com/patent/cn-bf-temp-fusion', date: '2024-12-11', credibility: '高', tags: ['专利', '炉温', '预测', '模型', '融合', '机器学习'],
      summary: '公开了梯度提升树与神经网络加权融合预测铁水温度的方法。' },
    { id: 'w06', title: '钢铁行业超低排放改造进展评估报告', source: '冶金工业规划研究院', url: 'https://example.com/report/ultra-low-emission', date: '2026-03-15', credibility: '高', tags: ['超低排放', '烧结', '烟气', '脱硫', '脱硝', '政策'],
      summary: '截至 2026 年一季度，已完成全流程超低排放改造的产能占比明显提高，烧结烟气治理以活性炭和 SCR 路线为主。' },
    { id: 'w07', title: '烧结烟气循环 + 活性炭一体化治理工程案例', source: '世界金属导报', url: 'https://example.com/news/sinter-flue-gas-case', date: '2026-10-12', credibility: '中', tags: ['烧结', '烟气', '循环', '活性炭', '超低排放', '减排'],
      summary: '烟气循环率 30%，配套活性炭一体化装置，颗粒物排放稳定低于 10 mg/m³。' },
    { id: 'w08', title: '高比例球团矿高炉冶炼的软熔带特征研究', source: '《烧结球团》期刊', url: 'https://example.com/journal/pellet-cohesive-zone', date: '2025-11-20', credibility: '高', tags: ['球团', '球团矿', '软熔带', '高炉', '低碳'],
      summary: '球团比例提高后软熔带变薄、位置上移，需相应调整布料制度。' },
    { id: 'w09', title: '欧洲氢基直接还原项目最新进展', source: '行业资讯网站', url: 'https://example.com/blog/eu-dri-update', date: '2026-10-28', credibility: '低', tags: ['氢', '氢冶金', '直接还原', '低碳'],
      summary: '多个氢基直接还原示范项目推迟投产，原因包括绿氢成本和电价。（转载自自媒体，来源可信度低）' },
    { id: 'w10', title: '工信部发布钢铁行业碳达峰实施方案配套指南', source: '工业和信息化部网站', url: 'https://example.com/gov/steel-carbon-guide', date: '2026-10-16', credibility: '高', tags: ['政策', '低碳', '碳排放', '标准', '氢冶金'],
      summary: '指南提出推动高炉富氢冶炼、提高球团矿比例和废钢利用水平。' },
    { id: 'w11', title: '大型高炉炉缸长寿技术研究进展', source: '《炼铁》期刊', url: 'https://example.com/journal/hearth-longevity', date: '2025-05-09', credibility: '高', tags: ['炉缸', '长寿', '侵蚀', '监测', '高炉'],
      summary: '总结炉缸侵蚀在线监测、钛矿护炉和冷却制度优化等长寿技术。' },
    { id: 'w12', title: '宝武、河钢等企业低碳冶金技术布局对比', source: '中国钢铁工业协会', url: 'https://example.com/assoc/low-carbon-layout', date: '2026-10-05', credibility: '高', tags: ['低碳', '氢冶金', '富氢', 'CCUS', '同行', '技术路线'],
      summary: '对比国内主要钢企在富氢高炉、氢基竖炉和 CCUS 上的示范项目与投入。' }
  ];

  const models = [
    { id: 'm-qwen', name: 'Qwen3-72B-Instruct', zone: 'internal', status: 'up', qpm: 120, host: 'GPU-01 · vLLM' },
    { id: 'm-ds', name: 'DeepSeek-R1-Distill-70B', zone: 'internal', status: 'up', qpm: 60, host: 'GPU-01 · vLLM' },
    { id: 'm-ext-a', name: '外部大模型 A（通用）', zone: 'external', status: 'up', qpm: 300, host: '经出口网关' },
    { id: 'm-ext-b', name: '外部大模型 B（长文本）', zone: 'external', status: 'up', qpm: 120, host: '经出口网关' }
  ];

  const policy = {
    internalToExternal: { '炼铁技术中心': false, '科技管理部': false, '科技情报室': true, '信息中心': false, '高炉车间': false, '烧结车间': false },
    sensitiveWords: ['炉料配方', '配比参数', '绝密', '富氢喷吹工业试验方案']
  };

  const schedules = [
    { id: 'sch-1', agentId: 'intel-brief', name: '月度高炉低碳技术情报', frequency: '每月', day: 1, time: '08:00', input: '跟踪上月高炉低碳冶炼和氢冶金技术动态', subscribers: ['张涛', '王建国'], enabled: true, ownerId: 'u-zhang', runs: [] }
  ];

  const seedSessions = [
    { agentId: 'research-assistant', userId: 'u-wang', zone: 'internal', scope: 'internal', at: '2026-11-10 09:12', prompts: ['2号高炉低硅冶炼的主要措施有哪些？'], feedback: { rating: 'up' } },
    { agentId: 'research-assistant', userId: 'u-li', zone: 'internal', scope: 'internal', at: '2026-11-10 14:40', prompts: ['烧结矿转鼓强度下降一般是什么原因？'], feedback: { rating: 'down', text: '希望补充燃料粒度的控制标准' } },
    { agentId: 'research-assistant', userId: 'u-wang', zone: 'external', scope: 'all', at: '2026-11-09 16:05', prompts: ['国内外高炉富氢喷吹有哪些进展？'], feedback: { rating: 'up' } },
    { agentId: 'survey-report', userId: 'u-zhang', zone: 'external', scope: 'public', at: '2026-11-08 10:20', prompts: ['调研国内外氢冶金技术进展，用于技术路线论证，约 5000 字', '#confirm'], feedback: { rating: 'up' } },
    { agentId: 'novelty-check', userId: 'u-li', zone: 'internal', scope: 'all', at: '2026-11-07 15:33', prompts: ['拟立项：基于机器学习的高炉炉温智能预测，目标铁水硅含量预测误差小于 0.05%', '#confirm'], feedback: { rating: 'down', wrongSource: 1, text: '第 1 条厂内课题与本课题研究对象不同' } },
    { agentId: 'intel-brief', userId: 'u-zhang', zone: 'external', scope: 'public', at: '2026-11-06 09:00', prompts: ['跟踪上月高炉低碳冶炼和氢冶金技术动态', '#confirm'], feedback: {} },
    { agentId: 'research-assistant', userId: 'u-zhang', zone: 'external', scope: 'internal', at: '2026-11-05 11:18', prompts: ['低碳炼铁技术路线的近期重点是什么？'], feedback: {} }
  ];

  const skills = [
    { id: 'cite-first', name: '先引用后结论', icon: 'quote', category: '回答规范', desc: '回答前先检索并标注引用编号，结论必须对应可核验来源；无来源时明确说明。', trigger: '问答、查新、诊断类智能体', status: 'published' },
    { id: 'clearance-guard', name: '密级出网护栏', icon: 'shield-check', category: '安全合规', desc: '外网模型场景下再次核对资料密级与部门出网策略，拦截秘密及以上内容并给出可改用内网模型的提示。', trigger: '所有开放外网模型的智能体', status: 'published' },
    { id: 'process-scope', name: '工序范围收窄', icon: 'filter', category: '检索策略', desc: '先确认高炉 / 烧结 / 焦化 / 球团等工序，再缩小检索范围，避免跨工序混用结论。', trigger: '科研资料助手、工艺诊断', status: 'published' },
    { id: 'outline-confirm', name: '大纲确认再撰写', icon: 'list-tree', category: '报告流程', desc: '报告类任务先给出可勾选大纲，用户确认后再分章节检索与撰写，并支持导出。', trigger: '调研报告、申报书、交底书', status: 'published' },
    { id: 'novelty-two-pass', name: '查新双阶段', icon: 'search-check', category: '报告流程', desc: '先做厂内课题库与公开文献初检，确认范围后再生成查新结论与对比表。', trigger: '立项查新助手', status: 'published' },
    { id: 'intel-window', name: '情报时间窗', icon: 'calendar-range', category: '检索策略', desc: '按用户指定的时间窗口过滤公开情报与网页结果，并在简报中标注时间覆盖范围。', trigger: '技术情报简报助手', status: 'published' },
    { id: 'diagnosis-chain', name: '异常排查链', icon: 'git-branch', category: '研发方法', desc: '按现象 → 可能原因 → 历史案例 → 数据核对 → 建议措施组织回答，避免直接给拍脑袋结论。', trigger: '工艺问题诊断助手', status: 'published' },
    { id: 'analysis-chart', name: '指标对照作图', icon: 'chart-line', category: '数据分析', desc: '在数据查询结果上选择对比指标，生成趋势说明与简易对照图，并提示数据只读。', trigger: '试验数据分析助手', status: 'published' }
  ];

  const mcpMarket = [
    {
      id: 'std_query_api', name: '标准规范接口', icon: 'scale', group: 'internal', phase: 3, appliesTo: '标准库 API',
      ingest: '通过厂内标准系统只读接口同步目录与条款元数据',
      capability: '按标准编号、名称和关键词查询条款摘要',
      params: [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 5 }],
      safety: ['只读接口，凭证由平台托管', '结果按用户密级过滤'],
      endpoint: 'mcp://ironworks.local/std-query'
    },
    {
      id: 'rms_task', name: '科研任务读写', icon: 'clipboard-list', group: 'internal', phase: 3, appliesTo: '科研管理系统',
      ingest: '无；实时调用 RMS',
      capability: '查询课题进度、里程碑和负责人；演示环境仅模拟只读查询',
      params: [{ key: 'maxRows', label: '最大返回行数', type: 'number', min: 10, max: 200, default: 50 }],
      safety: ['演示仅开放只读动作', '写入类动作需另行审批'],
      endpoint: 'mcp://ironworks.local/rms'
    },
    {
      id: 'patent_search', name: '专利检索', icon: 'lightbulb', group: 'public', phase: 3, appliesTo: '公开专利库',
      ingest: '无',
      capability: '按技术主题检索公开专利摘要与申请号',
      params: [{ key: 'topK', label: '返回条数', type: 'number', min: 1, max: 20, default: 8 }],
      safety: ['只发送检索关键词', '经出口网关审计'],
      endpoint: 'mcp://public/patent-search'
    }
  ];

  const skillMarket = [
    { id: 'table-answer', name: '表格化作答', icon: 'table', category: '回答规范', desc: '对比类问题优先输出 Markdown 表格，并在表下给出简要结论。', trigger: '调研、查新、数据分析', status: 'published' },
    { id: 'unit-check', name: '冶金单位校对', icon: 'ruler', category: '研发方法', desc: '输出焦比、煤比、风温等指标时核对单位与常见量级，异常时提醒复核。', trigger: '试验分析、工艺诊断', status: 'published' },
    { id: 'meeting-minutes', name: '技术例会纪要', icon: 'notebook-pen', category: '报告流程', desc: '将讨论要点整理为决议、待办与负责人三栏纪要。', trigger: '工作流型智能体', status: 'published' }
  ];

  AOS.data = { users, orgs, categories, tools, skills, mcpMarket, skillMarket, agents, docs, web, models, policy, schedules, seedSessions };
})(typeof window !== 'undefined' ? window : globalThis);
