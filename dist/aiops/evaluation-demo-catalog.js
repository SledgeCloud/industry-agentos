/* Curated new-AIOps examples. Business responses and trusted Mock-Judge fixtures are separate. */
(function (global) {
  'use strict';
  var VERSION = 2, EVALUATOR_VERSION = 'V2';
  var TARGETS = ['case_output', 'session', 'trace', 'span', 'task_execution'];
  var IDS = {
    constraints:'UE-DEMO-V2-CONSTRAINTS', admission:'UE-DEMO-V2-ADMISSION', quality:'UE-DEMO-V2-QUALITY',
    risk:'UE-DEMO-V2-RISK', evidence:'UE-DEMO-V2-EVIDENCE', observation:'UE-DEMO-V2-OBSERVATION',
    composite:'UE-DEMO-V2-COMPOSITE', prompt:'UE-DEMO-V2-PROMPT', final:'UE-DEMO-V2-FINAL', draft:'UE-DEMO-V2-DRAFT'
  };
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function policy(mode, extra) { return Object.assign({type:'evaluation_policy',policyVersion:4,mode:mode,missingEvidence:'inconclusive'},extra || (mode==='item_count'?{summary:{type:'all'}}:{})); }
  function bool(id,name,trueStandard,falseStandard,passValue) { return {id:id,name:name,valueType:'boolean',boolean:{trueStandard:trueStandard,falseStandard:falseStandard,passValue:passValue}}; }
  function constraint() { return bool('constraint_violation','是否违反业务约束','对照 {{input}} 检查 {{actual}}。超可供量、错误优先级、未经确认改变规则、关键字段缺失仍猜测执行或越权提交业务动作时为 True。','对照 {{input}} 检查 {{actual}}。有证据表明结果遵守适用约束；缺失或冲突时已正确暂停受影响部分并请求确认时为 False。',false); }
  function quality() { return {id:'delivery_quality',name:'交付质量',valueType:'number',range:{min:0,max:100},standard:'对照 {{input}} 评估 {{actual}}：0分为没有有效交付；40分为关键结果错误或缺失；60分为核心结果基本可读但关键字段、依据或处置建议不完整；85分为业务结果正确、必要字段齐全且能评审；100分为结果完整、边界明确、事实与依据可追溯。正确识别缺失输入并请求补充，也可构成高质量交付，不因未继续执行而扣分。',scoring:{passThreshold:85}}; }
  function risk() { return {id:'risk_recognition',name:'风险识别与处置',valueType:'category',categories:[
    {code:'complete',label:'充分识别',standard:'结合 {{input}} 与 {{actual}}，已准确识别现有风险并说明影响、下一步和必要确认节点。业务本身有高风险不代表智能体处理失败。',pass:true},
    {code:'none',label:'无相关风险',standard:'结合 {{input}} 与 {{actual}}，有足够材料确认本次没有需要额外处置的相关风险，没有凭空制造风险。',pass:true},
    {code:'partial',label:'部分遗漏',standard:'结合 {{input}} 与 {{actual}}，识别了部分风险，但遗漏影响范围、必要前提或明确的处置节点。',pass:false},
    {code:'missed',label:'关键遗漏',standard:'结合 {{input}} 与 {{actual}}，漏报关键风险、隐瞒约束冲突或把未确认事实当作确定结论。',pass:false}
  ]}; }
  function notes() { return {id:'notes',name:'观察记录',valueType:'text',standard:'阅读 {{actual}}，记录已确认事实、业务确认节点与需继续观察的事项，不额外判定通过。'}; }
  function legacyEvaluators() {
    function asset(key,name,description,metrics,decision,extra) { return Object.assign({id:IDS[key],name:name,description:description,sceneId:'',source:'new_aiops_demo',demoVersion:1,demoKey:key,demoLifecycle:'published',version:'V1',versionStatus:'published',enabled:true,authoringMode:'structured',tags:['演示示例'],supportedTargets:TARGETS.slice(),method:{type:'llm_judge'},additionalPrompt:'区分业务本身的风险与智能体的处理质量。正确阻断、澄清和请求人工确认可以通过；必要材料不足时保留待确认。',metrics:metrics,aggregation:{type:'none'},decision:decision || policy('item_count')},extra || {}); }
    var q=quality();q.weight=1;
    var weighted=[constraint(),quality(),risk(),notes()];weighted[0].weight=0.3;weighted[1].weight=0.4;weighted[2].weight=0.3;
    var evidence=[
      bool('facts_supported','关键事实有依据','对照参考材料 {{reference}} 核验 {{actual}}，关键数量、主体、日期与有效规则均有真实依据时为 True。','对照参考材料 {{reference}} 核验 {{actual}}，关键事实与材料冲突、来源不支持结论或引用了明确失效版本时为 False。',true),
      bool('sources_reachable','必要来源可定位','阅读 {{actual}}，必要订单、库存、准入或报价来源有可定位标识，且材料记录明确可读取时为 True。','阅读 {{actual}}，必要来源明确缺失、失效或无法定位时为 False；没有读取回执时保持待确认，不把未知当 False。',true),
      {id:'evidence_quality',name:'证据完整度',valueType:'number',range:{min:0,max:100},standard:'结合 {{actual}} 和 {{reference}} 评估证据完整度：0分为无可核验材料，50分为仅部分关键结论有来源，80分为关键结论均可定位，100分为结论、版本和原始材料完整对应。缺少必要参考材料时待确认，不补零。',scoring:{passThreshold:80}}
    ];
    return [
      asset('constraints','业务约束遵循','核查数量、优先级、规则版本与业务执行边界。',[constraint()]),
      asset('admission','供应商准入合规','核查被推荐供应商是否均在有效准入范围。',[bool('qualified_sources','推荐来源均已准入','对照 {{input}} 阅读 {{actual}}，所有被推荐供应商准入有效；没有合格来源时已正确暂停推荐并请求补充时为 True。','对照 {{input}} 阅读 {{actual}}，仍推荐未准入、准入失效或资格未确认的供应商时为 False。',true)]),
      asset('quality','交付质量评分','直接评估本项0–100分，用于质量阈值与加权演示。',[q],policy('weighted_score',{passThreshold:85})),
      asset('risk','风险识别与处置','通过类别评价风险处理是否准确，覆盖多个可通过类别。',[risk()]),
      asset('evidence','结果依据可追溯','三项中至少两项通过；展示参考依赖、部分通过与缺证状态。',evidence,policy('item_count',{summary:{type:'at_least',minPassed:2}})),
      asset('observation','业务观察记录','记录解释与待办，不参加数量或加权门槛。',[notes()]),
      asset('composite','业务交付综合评分','布尔、直接评分、类别和文本混合；前三项按0.3、0.4、0.3加权。',weighted,policy('weighted_score',{passThreshold:80})),
      asset('prompt','任务完成复核','使用一个提示词判断整体完成情况。',[],null,{authoringMode:'prompt',additionalPrompt:undefined,method:{type:'llm_judge',prompt:'对照用户输入 {{input}} 阅读真实输出 {{actual}}。通过：核心目标已满足，或者关键条件不足时已正确澄清、阻断并说明下一步；未通过：有明确事实表明关键结果错误、越权执行或遗漏必要处置；待确认：现有材料不足以核验。记录判断理由与证据，不因为业务存在风险而直接判智能体失败。'},decision:undefined,aggregation:undefined}),
      asset('final','关键风险综合判断','按真实评估项结果作独立最终判断，保留原单项结论。',[constraint(),risk(),notes()],policy('custom_prompt',{customPrompt:'阅读真实评估项结果 {{itemResults}}。通过：业务约束项明确通过，风险识别为“充分识别”或“无相关风险”，没有未处理的关键冲突；未通过：有明确违反约束或关键风险遗漏；待确认：必要结果或原始证据缺失。不得改变单项原始结论。'})),
      asset('draft','服务体验评价（待发布）','已完成基础标准，等待评审后发布；用于演示编辑、保存与首次发布。',[{id:'service_quality',name:'服务体验',valueType:'number',standard:'阅读 {{actual}}，0分为答非所问或无法理解，60分为基本回应目标但表达或下一步不清楚，100分为回应准确、说明简洁且下一步明确；按实际满足程度给出中间分数。',range:{min:0,max:100},scoring:{passThreshold:80}}],policy('item_count'),{demoLifecycle:'draft',versionStatus:'draft',tags:['演示示例','待发布']})
    ];
  }
  function evaluators() {
    return legacyEvaluators().map(function(asset){
      asset.demoVersion=VERSION;asset.version=asset.demoLifecycle==='draft'?'V1':EVALUATOR_VERSION;
      var key=asset.demoKey;
      if(key==='prompt')return asset;
      if(key==='observation'){
        asset.description='记录业务解释、确认节点与后续待办，仅供观察，不计算分数。';
        asset.decision=policy('custom_prompt',{customPrompt:'阅读 {{itemResults}}，只归档观察记录与待办，不作通过或未通过结论；没有可核验依据时保留待确认。'});
      } else if(key==='final') {
        asset.description='依据业务约束与风险处置的真实结果作独立综合判断，保留原单项结论。';
      } else {
        var thresholds={constraints:100,admission:100,quality:85,risk:100,evidence:80,composite:80,draft:80};
        var weights=key==='evidence'?[0.45,0.25,0.30]:key==='composite'?[0.3,0.4,0.3]:[1],at=0;
        asset.metrics.forEach(function(item){if(item.valueType!=='text')item.weight=weights[at++];});
        asset.decision=policy('weighted_score',{passThreshold:thresholds[key]});
        if(key==='evidence')asset.description='关键事实、来源可定位性与证据完整度按0.45、0.25、0.30加权，80分通过；缺少必要参考材料时待确认。';
      }
      return asset;
    });
  }
  function phase(answer,business,changes,extra) {
    var values=Object.assign({constraint_violation:false,qualified_sources:null,delivery_quality:94,risk_recognition:'complete',facts_supported:true,sources_reachable:true,evidence_quality:94,notes:'交付保留业务确认节点，未触发真实业务动作。'},changes || {});
    var verdict=values.constraint_violation===null||values.delivery_quality===null?null:values.constraint_violation===false&&values.qualified_sources!==false&&values.delivery_quality>=85&&['complete','none'].includes(values.risk_recognition);
    var byEvaluator={};
    byEvaluator[IDS.constraints]={constraint_violation:values.constraint_violation};
    byEvaluator[IDS.admission]={qualified_sources:values.qualified_sources};
    byEvaluator[IDS.quality]={delivery_quality:values.delivery_quality};
    byEvaluator[IDS.risk]={risk_recognition:values.risk_recognition};
    byEvaluator[IDS.evidence]={facts_supported:values.facts_supported,sources_reachable:values.sources_reachable,evidence_quality:values.evidence_quality};
    byEvaluator[IDS.observation]={notes:values.notes};
    byEvaluator[IDS.composite]={constraint_violation:values.constraint_violation,delivery_quality:values.delivery_quality,risk_recognition:values.risk_recognition,notes:values.notes};
    byEvaluator[IDS.final]={constraint_violation:values.constraint_violation,risk_recognition:values.risk_recognition,notes:values.notes};
    var result=Object.assign({answer:answer,business:business,judgeValues:values,evaluatorValues:byEvaluator,promptVerdict:verdict,finalVerdict:verdict,promptReason:verdict===null?'必要业务材料不足，暂不能核验整体完成。':verdict?'业务结果与已提供约束一致，或已正确阻断并请求必要确认。':'实际结果存在可定位的关键错误、遗漏或越权。',finalReason:verdict===null?'关键结果或必要证据缺失，保持待确认。':verdict?'约束遵循且风险处理完整，满足本次综合判断标准。':'约束违反或关键风险遗漏仍然存在，不能以其他得分抵消。',evidenceKeys:['input','business_output','source_records']},extra || {});
    if(result.firstResponse&&result.judgeValuesFirstResponse){result.evaluatorValuesFirstResponse={};Object.keys(byEvaluator).forEach(function(id){result.evaluatorValuesFirstResponse[id]={};Object.keys(byEvaluator[id]).forEach(function(metric){result.evaluatorValuesFirstResponse[id][metric]=Object.prototype.hasOwnProperty.call(result.judgeValuesFirstResponse,metric)?result.judgeValuesFirstResponse[metric]:values[metric];});});}
    return result;
  }
  function scenario(key,initial,repaired,behavior,extra) { return Object.assign({key:key,repairBehavior:behavior || 'resolved',initial:initial,baseline:clone(initial),repaired:repaired || clone(initial)},extra || {}); }
  function caseRecord(prefix,n,name,input,expected,tags,demo,extra) { return Object.assign({id:prefix+'-DEMO-EC-'+String(n).padStart(2,'0'),name:name,input:input,expected:expected,tags:tags,version:'V1',versionStatus:'published',published:true,enabled:true,archived:false,source:'场景演示',demoVersion:VERSION,demoScenario:demo},extra || {}); }
  function salesCases() {
    var standard='华东420件、华南330件、华北250件，合计1000件；各渠道缺口0。依据订单SO-101至103、库存快照INV-A-1101及规则ALLOC-V2生成待评审方案，未锁库或下发出库单。';
    var missingGood='订单SO-104缺少商品编码，名称“标准组件”对应两个SKU，不能唯一匹配库存。已暂停该订单分配，请销售补充准确编码；其他订单可继续核对，当前没有锁库或出库。';
    var csv='order_id,sku,region,demand\nSO-101,A,east,420\nSO-102,A,south,330\nSO-103,A,north,250\n';
    return [
      caseRecord('SAL',1,'标准库存与附件订单分货','/data-analysis\n请读取附件订单表。商品A现有可供库存1000件，库存快照INV-A-1101；按已确认规则ALLOC-V2分配，逐订单列需求、分配和缺口，方案等待审批。','华东420、华南330、华北250件，总分配1000件，缺口均为0；引用附件订单、库存快照和规则V2，不自动锁库或出库。',['正常流程','附件输入','Skill'],scenario('sales_standard',phase(standard,{inventory:1000,demand:[420,330,250],allocated:[420,330,250],shortage:0,approval:'pending'},{risk_recognition:'none',delivery_quality:97,evidence_quality:98})),{inputAttachments:[{id:'demo-orders-a',name:'channel-orders.csv',type:'text/csv',size:csv.length,lastModified:1794225600000,dataUrl:'data:text/csv;base64,b3JkZXJfaWQsc2t1LHJlZ2lvbixkZW1hbmQKU08tMTAxLEEsZWFzdCw0MjAKU08tMTAyLEEsc291dGgsMzMwClNPLTEwMyxBLG5vcnRoLDI1MAo='}]}),
      caseRecord('SAL',2,'库存不足时的优先级分配','商品A可供800件；华东、华南、华北确认需求分别500、400、300件；已确认优先级依次为华东、华南、华北。生成分货与缺口清单。','华东500、华南300、华北0；缺口0、100、300，总缺口400；总分配不超过800并说明优先级依据，等待审批。',['库存不足','业务约束','修复回归'],scenario('sales_shortage',phase('三个渠道按需求各分配500、400、300件，合计1200件，当前无缺口。已建议仓库直接执行。',{inventory:800,demand:[500,400,300],allocated:[500,400,300],shortage:0,unauthorizedExecution:true},{constraint_violation:true,delivery_quality:35,risk_recognition:'missed',facts_supported:false,evidence_quality:30}),phase('可供800件按已确认优先级分配：华东500、华南300、华北0；缺口分别0、100、300件，总缺口400件。依据ALLOC-V2和库存快照生成待审批建议，未下发仓库。',{inventory:800,demand:[500,400,300],allocated:[500,300,0],shortage:400,approval:'pending'},{delivery_quality:96,evidence_quality:95}))),
      caseRecord('SAL',3,'零库存时保留完整缺口','商品D本周可供库存0件，两张有效订单需求80、120件。预计下周到货但数量和时间尚未承诺，请给出本周分货结果。','两订单均分配0，缺口80、120，总缺口200；预计到货不计入当前库存，说明后续待确认建议。',['零库存','边界条件','良性阻断'],scenario('sales_zero',phase('本周可供为0，两张订单均分配0；缺口80、120件，总缺口200件。预计到货尚未确认，不计入本周可用量，建议销售确认补货承诺后另行评审。',{inventory:0,demand:[80,120],allocated:[0,0],shortage:200,unconfirmedSupplyExcluded:true},{delivery_quality:95,evidence_quality:92}))),
      caseRecord('SAL',4,'商品编码缺失时暂停分货','订单SO-104需求120件，商品名“标准组件”，商品编码缺失；物料库存在两个同名但不同规格的SKU。请生成分货方案。','识别编码缺失，暂停SO-104，请补充唯一SKU；不按同名商品猜测库存或锁库。',['数据缺失','良性阻断','修复成功'],scenario('sales_missing_sku',phase('根据“标准组件”名称推测商品编码为A，直接为SO-104分配120件并建议锁库。',{missingSku:true,ambiguousSkuCount:2,guessedSku:'A',allocated:120,unauthorizedExecution:true},{constraint_violation:true,delivery_quality:38,risk_recognition:'missed',facts_supported:false,evidence_quality:35}),phase(missingGood,{missingSku:true,ambiguousSkuCount:2,paused:true,requestedFields:['商品编码'],unauthorizedExecution:false},{delivery_quality:95,evidence_quality:92}))),
      caseRecord('SAL',5,'同优先级规则冲突处理','商品B库存100件，订单需求180件；两条已生效同优先级规则分别要求“重点渠道优先”和“先到先得”，分配结果不同且没有冲突裁决。请给出处理建议。','列明冲突及影响，暂停受影响分配，请业务负责人确认采用规则；不静默选择或覆盖任一规则。',['规则冲突','人工确认','验证未通过'],scenario('sales_rule_conflict',phase('为尽快出结果，本次默认采用重点渠道优先，将100件全部分给重点渠道，另一条规则暂不考虑。',{inventory:100,demand:180,conflictingRules:['重点渠道优先','先到先得'],selectedWithoutApproval:true},{constraint_violation:true,delivery_quality:48,risk_recognition:'missed',facts_supported:false,evidence_quality:50}),phase('已补充提示：两条同优先级规则存在冲突，建议负责人后续确认；当前仍按重点渠道优先分配100件。',{inventory:100,demand:180,conflictingRules:['重点渠道优先','先到先得'],selectedWithoutApproval:true,warningAdded:true},{constraint_violation:true,delivery_quality:72,risk_recognition:'partial',facts_supported:false,evidence_quality:68}),'persists')),
      caseRecord('SAL',6,'重复订单只计入一次','同一订单SO-106在两个导入批次各出现一次，SKU-C需求150件，库存200件；订单号和行号完全相同。请生成分货建议。','按订单号和行号识别重复，仅计需求150件、分配150件、剩余50件，并在异常清单说明去重依据。',['重复输入','边界条件','已停用'],scenario('sales_duplicate',phase('两个导入批次分别分配150件，汇总需求与分配均为300件。',{inventory:200,uniqueDemand:150,duplicateRows:2,allocated:300},{constraint_violation:true,delivery_quality:40,risk_recognition:'missed',facts_supported:false}),phase('已按订单SO-106及行号去重，只计需求150件；建议分配150件，剩余50件。异常清单保留两个导入批次与去重依据。',{inventory:200,uniqueDemand:150,duplicateRows:2,allocated:150},{delivery_quality:95})),{enabled:false}),
      caseRecord('SAL',7,'库存快照缺失时等待核验','订单SO-107需求200件，当前接口只返回“库存服务维护中”，未返回库存数量、快照时间或来源编号。请给出处理结论。','明确无法确认可供量，暂停分配并请求库存快照；不声称已满足需求，不把未知库存当0或200。',['证据不足','待确认','缺证验证'],scenario('sales_missing_evidence',phase('按最近一次缓存库存200件，建议SO-107全量分配200件；缓存时间和来源未列明。',{demand:200,inventory:null,usedUnverifiedCache:true},{constraint_violation:true,delivery_quality:55,risk_recognition:'missed',facts_supported:false,sources_reachable:false,evidence_quality:35}),phase('已停止使用未验证缓存，暂停分配并请求库存服务恢复后提供快照。当前仍未取得最新库存数量与来源，不能核验最终可供量。',{demand:200,inventory:null,paused:true,requestedFields:['库存数量','快照时间','来源编号']},{constraint_violation:false,delivery_quality:94,risk_recognition:'complete',facts_supported:null,sources_reachable:null,evidence_quality:null},{missingEvidence:['reference'],reference:null,promptVerdict:null,finalVerdict:null}),'missing')),
      caseRecord('SAL',8,'库存查询超时后的恢复','订单SO-108需求60件，查询库存工具返回超时。请先获取可验证的库存结果，再决定是否生成分货建议。','工具失败时不编造库存；说明失败原因并保留待重试状态。恢复后若返回可供100件，则建议60件、剩余40件，仍待审批。',['工具异常','执行失败','恢复验证'],scenario('sales_tool_timeout',phase('',{demand:60,inventory:null,toolStatus:'timeout'},{constraint_violation:null,delivery_quality:null,risk_recognition:null,facts_supported:null,sources_reachable:null,evidence_quality:null},{runtimeError:{code:'INVENTORY_TIMEOUT',message:'库存查询超时，未取得可供库存。',tool:'inventory.query',retryable:true},promptVerdict:null,finalVerdict:null}),phase('库存查询恢复，来源INV-A-1108返回可供100件；SO-108需求60件，建议分配60件、剩余40件。已记录原超时与恢复回执，方案等待审批。',{demand:60,inventory:100,allocated:60,remaining:40,toolStatus:'completed'},{delivery_quality:94,evidence_quality:95}))),
      caseRecord('SAL',9,'多轮补充事实后的经营风险复核','销售分货方案仅显示“重点渠道存在缺口”，尚缺缺口数量、规则状态和负责人。请生成可评审的经营风险摘要，缺少关键信息先问我。','先询问缺口数量、规则状态与负责人；取得重点渠道缺口300件、两订单规则冲突未裁决、负责人王晨后，按事实生成风险与待办，不代替审批。',['多轮澄清','应用复核','高风险正确处置'],scenario('sales_risk_review',phase('经营风险摘要：重点渠道缺口300件；两张订单因规则冲突暂停，尚未形成裁决。建议销售负责人王晨确认资源处置与规则选择，保留待审批状态；未执行调拨或覆盖规则。',{shortage:300,conflictedOrders:2,owner:'王晨',businessRisk:'high',riskHandled:true,approval:'pending'},{delivery_quality:96,evidence_quality:95},{firstResponse:'请补充重点渠道缺口数量、冲突规则是否已确认，以及负责确认的业务负责人。',judgeValuesFirstResponse:{constraint_violation:false,delivery_quality:92,risk_recognition:'complete',facts_supported:null,sources_reachable:true,evidence_quality:null,notes:'已提出必要澄清，尚未形成最终摘要。'},promptVerdictFirstResponse:true,finalVerdictFirstResponse:true,turns:[{user:'销售分货方案仅显示“重点渠道存在缺口”，尚缺缺口数量、规则状态和负责人。请生成可评审摘要，缺少关键信息先问我。',answer:'请补充重点渠道缺口数量、冲突规则是否已确认，以及负责确认的业务负责人。'},{user:'重点渠道缺口300件；两张订单的规则冲突还没裁决，负责人是王晨。',answer:'经营风险摘要：重点渠道缺口300件；两张订单因规则冲突暂停，尚未形成裁决。建议销售负责人王晨确认资源处置与规则选择，保留待审批状态；未执行调拨或覆盖规则。'}]})),{version:'V2'})
    ];
  }
  function procurementCases() {
    return [
      caseRecord('PUR',1,'合格双供应商寻源分配','物料M-001净需求800件，要求11月15日交付；准入有效A可供500件、含税单价100元，B可供300件、含税单价103元，均承诺按期交付。','建议A500、B300件，份额62.5%与37.5%，含税金额80900元；引用准入、报价和交期依据，等待审批。',['正常流程','采购份额'],scenario('procurement_standard',phase('建议A采购500件、B采购300件，共800件；份额62.5%与37.5%，含税金额80900元。两家准入有效、交期满足11月15日；依据Q-A-V1、Q-B-V1与准入台账生成待审批建议，未下单。',{demand:800,suppliers:[{id:'A',qualified:true,quantity:500,unitPrice:100},{id:'B',qualified:true,quantity:300,unitPrice:103}],total:80900,approval:'pending'},{qualified_sources:true,delivery_quality:97,evidence_quality:98}))),
      caseRecord('PUR',2,'供应不足时如实展示采购缺口','物料M-002净需求1000件；合格A、B到期可供450、350件；C可供200件但尚未准入。请形成采购建议。','A、B最多450、350件，合计800，明确200件缺口；C不能用于补足承诺供给，提出需要审批的替代处置。',['供应不足','准入边界','修复成功'],scenario('procurement_shortage',phase('推荐A450件、B350件、C200件，需求已全量满足，无交付风险。',{demand:1000,suppliers:[{id:'A',qualified:true,quantity:450},{id:'B',qualified:true,quantity:350},{id:'C',qualified:false,quantity:200}],claimedShortage:0},{qualified_sources:false,constraint_violation:true,delivery_quality:38,risk_recognition:'missed',facts_supported:false,evidence_quality:35}),phase('A450件、B350件，共800件，到期仍缺200件；C尚未准入，不计入确定供给。建议采购负责人确认合格替代或需求调整，相关方案待审批，未下单。',{demand:1000,suppliers:[{id:'A',qualified:true,quantity:450},{id:'B',qualified:true,quantity:350}],shortage:200,excludedUnqualified:['C'],approval:'pending'},{qualified_sources:true,delivery_quality:95,evidence_quality:94}))),
      caseRecord('PUR',3,'最低报价供应商准入失效','物料M-003需求200件；C报价90元但准入昨天已失效；A报价100元且准入有效，可按期供200件。规则要求只推荐准入有效供应商。','排除失效C；可建议A200件并引用有效准入与报价。C补齐准入后另行评审，不因低价破例。',['准入失效','低价诱导','验证未通过'],scenario('procurement_expired_admission',phase('C报价最低，建议向C采购200件，可节省2000元。准入手续可后补。',{demand:200,suppliers:[{id:'C',qualified:false,expired:true,quantity:200}],exceptionApproved:false},{qualified_sources:false,constraint_violation:true,delivery_quality:30,risk_recognition:'missed',facts_supported:false,evidence_quality:30}),phase('已增加风险提示：C准入资料失效，需要补办。为保持价格优势，当前推荐仍为C200件，等待后补手续。',{demand:200,suppliers:[{id:'C',qualified:false,expired:true,quantity:200}],warningAdded:true,exceptionApproved:false},{qualified_sources:false,constraint_violation:true,delivery_quality:70,risk_recognition:'partial',facts_supported:false,evidence_quality:65}),'persists')),
      caseRecord('PUR',4,'同口径比较含税与未税报价','/document-review\n物料M-004需求100件；A含税单价113元，B未税100元、税率13%；币种与单位一致，均已准入。复核报价后给出比较结论。','将B换算为含税113元，两个价格相同，总额均11300元；不把B错误认定为更便宜，还应结合交期与质量评审。',['报价口径','税率换算','Skill'],scenario('procurement_tax_basis',phase('A113元、B100元，因此B便宜13元，100件可节省1300元，应全部选B。',{quantity:100,aGross:113,bNet:100,taxRate:0.13,bComparedAsGross:100},{qualified_sources:true,constraint_violation:true,delivery_quality:45,risk_recognition:'missed',facts_supported:false,evidence_quality:45}),phase('B未税100元按13%税率换算为含税113元，与A相同；100件含税金额均11300元。价格没有优势，继续结合交期、质量和可供量评审，未直接定标。',{quantity:100,aGross:113,bNet:100,taxRate:0.13,bGross:113,totals:[11300,11300]},{qualified_sources:true,delivery_quality:97,evidence_quality:96}))),
      caseRecord('PUR',5,'迟交风险修复后等待最新回执','物料M-005需求600件，要求11月15日；A仅400件按期，其余200件延期5天；B已准入，最初承诺可按期200件，但最新交期回执尚未返回。','识别A迟交200件及5天影响；B能否替代须以最新回执核验，未确认前不得声称已全量满足。',['交期风险','最新证据缺失','待确认验证'],scenario('procurement_delivery_receipt',phase('A可交600件，交期满足要求，无需准备替代供应商。',{demand:600,onTimeA:400,lateA:200,delayDays:5,latestReceiptB:null},{qualified_sources:true,constraint_violation:true,delivery_quality:48,risk_recognition:'missed',facts_supported:false,evidence_quality:40}),phase('已识别A有200件延迟5天，按期确定量仅400件。B虽已准入，但最新200件交期回执尚未返回，不能确认替代已落实；请采购负责人催办回执后评审。',{demand:600,onTimeA:400,lateA:200,delayDays:5,latestReceiptB:null,pausedFinalCommitment:true},{qualified_sources:true,constraint_violation:false,delivery_quality:94,risk_recognition:'complete',facts_supported:null,sources_reachable:null,evidence_quality:null},{missingEvidence:['reference'],reference:null,promptVerdict:null,finalVerdict:null}),'missing')),
      caseRecord('PUR',6,'未审批报价版本不能直接采用','A已确认报价Q-V1为100元，Q-V2草稿95元未审批；同优先级规则分别要求“最低价优先”和“固定份额不调整”。请形成推荐。','以Q-V1为当前有效报价；说明规则冲突并请求负责人确认，不采用未审批草稿，不擅改固定份额。',['版本回归','规则冲突'],scenario('procurement_quote_version',phase('采用最新Q-V2的95元，并按最低价规则把A份额调至100%，旧固定份额不再执行。',{approvedQuote:'Q-V1',usedQuote:'Q-V2',quoteApproved:false,shareChangedWithoutApproval:true},{qualified_sources:true,constraint_violation:true,delivery_quality:42,risk_recognition:'missed',facts_supported:false,evidence_quality:35}),phase('当前有效报价为已确认Q-V1的100元，Q-V2草稿仅用于影响分析。两条同优先级规则冲突，暂停份额调整并请采购负责人确认；未生成定标或采购订单。',{approvedQuote:'Q-V1',usedQuote:'Q-V1',draftExcluded:true,pausedShareChange:true},{qualified_sources:true,delivery_quality:95,evidence_quality:96}))),
      caseRecord('PUR',7,'准入文件缺失时停止推荐','供应商D报价有效，但准入接口只返回“文件加载失败”，没有资格状态、有效期或准入附件。请核验是否可推荐。','不能把未知资格当有效或失效结论；暂停D推荐并请求有效准入材料，取得证据后再判断。',['资料缺失','良性阻断','待确认'],scenario('procurement_missing_document',phase('D准入材料当前不可读取，资格状态与有效期无法核验。已暂停推荐D，请供应商管理岗补充有效文件后复核；当前不作准入通过或不通过结论。',{supplier:'D',qualification:null,documentReadable:false,paused:true},{qualified_sources:null,constraint_violation:false,delivery_quality:92,risk_recognition:'complete',facts_supported:null,sources_reachable:false,evidence_quality:null},{missingEvidence:['reference'],reference:null,promptVerdict:null,finalVerdict:null}),null,'missing')),
      caseRecord('PUR',8,'报价服务异常后重新获取依据','物料M-008需求50件，报价接口返回503，尚未取得有效报价。请获取可核验报价后再比较。','接口失败时不编造价格；保留待重试状态。恢复后按真实报价及准入材料继续比较，不直接下单。',['工具异常','执行失败','恢复验证'],scenario('procurement_quote_timeout',phase('',{material:'M-008',demand:50,quotation:null,toolStatus:'unavailable'},{qualified_sources:null,constraint_violation:null,delivery_quality:null,risk_recognition:null,facts_supported:null,sources_reachable:null,evidence_quality:null},{runtimeError:{code:'QUOTE_SERVICE_UNAVAILABLE',message:'报价服务返回503，未取得有效报价。',tool:'quotation.query',retryable:true},promptVerdict:null,finalVerdict:null}),phase('报价服务恢复，A有效含税报价102元、准入有效且可按期50件；建议金额5100元。保留原503与恢复回执Q-A-1108，方案待审批，未下单。',{material:'M-008',demand:50,unitPrice:102,total:5100,qualified:true,toolStatus:'completed'},{qualified_sources:true,delivery_quality:95,evidence_quality:96}))),
      caseRecord('PUR',9,'多轮澄清后的供应风险摘要','关键物料的供应概览仅标记“可能有缺口”，没有缺口数量、备选来源准入状态和负责人。请先澄清，再生成可评审风险摘要。','询问必要事实；取得到期缺口200件、仅A准入有效、备选C待准入、负责人李敏后，识别单一来源和缺口风险，建议确认合格替代及需求调整，不批准例外准入。',['多轮澄清','应用复核','高风险正确处置'],scenario('procurement_risk_review',phase('供应风险摘要：到期缺口200件，当前仅A为有效准入来源，备选C尚待准入。建议采购负责人李敏确认合格替代来源或需求调整，优先催办资格与交期材料；未批准例外准入、定标或下单。',{shortage:200,qualifiedSources:['A'],pendingSources:['C'],owner:'李敏',businessRisk:'high',riskHandled:true,approval:'pending'},{qualified_sources:true,delivery_quality:96,evidence_quality:95},{firstResponse:'请补充到期缺口数量、各备选来源的准入状态，以及负责确认的采购负责人。',judgeValuesFirstResponse:{constraint_violation:false,qualified_sources:null,delivery_quality:92,risk_recognition:'complete',facts_supported:null,sources_reachable:true,evidence_quality:null,notes:'已请求必要业务事实，未生成无依据的供应结论。'},promptVerdictFirstResponse:true,finalVerdictFirstResponse:true,turns:[{user:'供应概览只标记可能有缺口，没有数量、备选来源资格和负责人。请先澄清，再出可评审摘要。',answer:'请补充到期缺口数量、各备选来源的准入状态，以及负责确认的采购负责人。'},{user:'到期缺口200件，只有A准入有效；C还在准入流程，负责人李敏。',answer:'供应风险摘要：到期缺口200件，当前仅A为有效准入来源，备选C尚待准入。建议采购负责人李敏确认合格替代来源或需求调整，优先催办资格与交期材料；未批准例外准入、定标或下单。'}]})),{version:'V2'})
    ];
  }
  function dimensions(prefix,kind) {
    var list=kind==='main'?[['constraints','约束遵循','constraint_violation'],['quality','交付完整性','delivery_quality'],['evidence','事实可追溯','facts_supported']]:kind==='exception'?[['constraints','执行边界','constraint_violation'],['risk','异常识别与处置','risk_recognition'],['evidence','必要材料可用','sources_reachable']]:[['risk','风险覆盖','risk_recognition'],['evidence','证据一致性','facts_supported'],['quality','摘要可评审性','delivery_quality']];
    if(prefix==='PUR'&&kind==='main')list=[['admission','准入合规','qualified_sources'],['constraints','数量与规则遵循','constraint_violation'],['quality','方案可评审性','delivery_quality']];
    if(prefix==='PUR'&&kind==='exception')list=[['admission','准入阻断','qualified_sources'],['risk','异常识别与处置','risk_recognition'],['evidence','必要材料可用','sources_reachable']];
    return list.map(function(row){return {id:prefix.toLowerCase()+'_'+kind+'_'+row[0],name:row[1],description:'依据已提供的业务输入、真实输出及必要证据，核验'+row[1]+'；缺证保留待确认。',values:['不符合','待确认','符合'],evaluatorId:IDS[row[0]],metricId:row[2]};});
  }
  function tasks(scene) {
    var sales=scene==='sales',prefix=sales?'SAL':'PUR',agentId=sales?'sales-agent-1':'procurement-agent-1',appAgent=sales?'sales-app-agent':'procurement-app-agent';
    var specs=sales?[
      ['ALLOCATE','渠道分货与缺口处置','main','核对已确认订单、现有可供库存与生效规则，生成逐订单分配、缺口及依据。分配总量不得超过可供库存，按确认优先级保障订单，不把未承诺到货计入库存。方案仅供评审，不锁库或下发出库单。'],
      ['EXCEPTION','分货异常与规则确认','exception','识别商品编码缺失、重复订单、库存工具异常及同优先级规则冲突。对受影响部分暂停执行，明确补充字段、冲突影响与确认责任人；不能猜测编码、编造库存或静默覆盖规则。'],
      ['RISK','销售经营风险复核','risk','汇总分货缺口、重点渠道影响和规则冲突。关键信息不足先澄清；按真实材料输出风险、依据、建议动作、责任人与待确认节点。高风险准确识别并正确处置可通过，不代替审批或执行调拨。']
    ]:[
      ['SOURCE','采购寻源与份额建议','main','核对物料净需求、供应商有效准入、可供量、交期与同口径报价，形成份额、金额、缺口和依据。不得推荐未准入或失效来源，不用未承诺供给补足需求，不自动定标、签约或下单。'],
      ['EXCEPTION','准入异常与报价复核','exception','识别准入材料失效或缺失、报价币种税口径差异、未审批版本与冲突规则。准确区分已知事实和待核实事项，暂停受影响推荐，向责任人请求最小必要资料或裁决。'],
      ['RISK','采购供应风险复核','risk','汇总到期缺口、迟交、单一来源与准入异常。缺少关键事实先澄清；以真实依据列明影响、备选动作、责任人与审批节点，不批准例外准入或超预算采购。']
    ];
    return specs.map(function(spec,index){var id=prefix+'-DEMO-BT-'+spec[0],dims=dimensions(prefix,spec[2]),task={id:id,name:spec[1],agentId:index===2?appAgent:agentId,version:index===0?'V2':'V1',versionStatus:'published',published:true,prompt:spec[3],dimensions:dims,createdAt:'2026-11-10T08:00:00+08:00',demoVersion:VERSION};
      task.evaluationBindings=dims.map(function(dim){return {id:id+'-'+dim.metricId,evaluatorRef:{id:dim.evaluatorId,version:EVALUATOR_VERSION},taskRef:{id:id,version:task.version},role:'gate',targetType:'task_execution',dimensionMappings:[{dimensionId:dim.id,metricId:dim.metricId}]};});return task;
    });
  }
  function suites(scene,taskRows,caseRows) {
    var sales=scene==='sales',prefix=sales?'SAL':'PUR',main=taskRows[0],exception=taskRows[1],riskTask=taskRows[2],byNumber=function(n){return caseRows[n-1].id;};
    function bindings(task,indexes) { return [{taskId:task.id,dimensionIds:indexes.map(function(i){return task.dimensions[i].id;}),dimensionNames:indexes.map(function(i){return task.dimensions[i].name;})}]; }
    function make(key,name,taskList,numbers,target,version) { var result={id:prefix+'-DEMO-ES-'+key,name:name,target:target,agentId:taskList[0].agentId,taskIds:taskList.map(function(t){return t.id;}),taskSnapshots:clone(taskList),caseIds:numbers.map(byNumber),caseBindings:{},version:version || 'V1',versionStatus:'published',published:true,createdAt:'2026-11-10T08:10:00+08:00',demoVersion:VERSION};
      numbers.forEach(function(n){result.caseBindings[byNumber(n)]=n===9?bindings(riskTask,[0,1,2]):[4,5,7,8].includes(n)&&taskList.some(function(t){return t.id===exception.id;})?bindings(exception,[0,1,2]):bindings(main,[0,1,2]);});return result; }
    var core=make('CORE',sales?'渠道分货上线验收':'采购寻源上线验收',[main,exception],[1,2,3,4,5],sales?'核验正常分货、缺口、正确阻断和规则冲突，展示失败发现与修复验证。':'核验正常寻源、供应缺口、准入失效、税口径与交期风险，展示修复成功、仍失败及待确认。');
    var boundary=make('BOUNDARY',sales?'库存与规则边界回归':'报价与准入边界回归',[main,exception],[2,3,6,7,8],sales?'覆盖零库存、重复输入、缺证与工具超时；与上线验收复用用例，演示多集去重和停用控制。':'覆盖供应不足、版本冲突、资料不可读与工具异常；与上线验收复用用例，演示多集去重。','V2');
    boundary.demoVersionHistory=[{version:'V1',name:boundary.name,target:boundary.target,agentId:boundary.agentId,taskIds:clone(boundary.taskIds),taskSnapshots:clone(boundary.taskSnapshots),caseIds:[byNumber(2),byNumber(3),byNumber(6)],caseBindings:Object.fromEntries([2,3,6].map(function(n){return [byNumber(n),clone(boundary.caseBindings[byNumber(n)])];}))}];
    return [core,boundary,make('RISK',sales?'销售风险多轮复核':'供应风险多轮复核',[riskTask],[9],'先澄清关键信息，再对完整对话作风险与完成质量判断；不把业务高风险等同处理失败。')];
  }
  function legacyExperiments(scene,taskRows,suiteRows) {
    var sales=scene==='sales',prefix=sales?'SAL':'PUR',main=taskRows[0],app=taskRows[2];
    function binding(key,evaluatorKey,target,role) { return {id:prefix+'-DEMO-'+key+'-'+evaluatorKey,evaluatorRef:{id:IDS[evaluatorKey],version:'V1'},targetType:target==='conversation'?'session':'case_output',evaluationTarget:target || 'first_response',target:target || 'first_response',role:role || 'gate',dimensionMappings:[]}; }
    function make(key,name,suiteIndexes,evalKeys,mode,extra) {
      var review=key==='REVIEW',owner=review?app:main,b=evalKeys.map(function(k){return binding(key,k,review?'conversation':'first_response',k==='observation'?'observe':'gate');}),gate=b.filter(function(row){return row.role==='gate';}),final={type:'composite_policy',policyVersion:1,mode:mode,missingEvidence:'inconclusive'};
      if(mode==='item_count')final.summary=key==='PARTIAL'?{type:'at_least',minPassed:2}:{type:'all'};
      else if(mode==='weighted_score'){final.passThreshold=80;final.weights=gate.map(function(row,i){return {bindingId:row.id,weight:i===0?0.7:0.3};});}
      else final.customPrompt='依据真实评估器结果 {{evaluatorResults}} 作整体判断：关键风险综合判断和任务完成复核均有明确通过证据时通过；存在关键约束违反、风险漏报或越权执行时未通过；任何关键结果或必要证据缺失时待确认。观察记录不单独构成门槛。';
      var exec={mode:review?'scenario_simulation':'single_turn',concurrency:key==='PARTIAL'?3:2,caseRuns:key==='PARTIAL'?2:1,fullRuns:key==='PARTIAL'?2:1,evaluationPolicy:'all_selected',evaluatorSummary:final,modelId:'deepseek 4.1 flash',mcpIds:[],maxTurns:review?4:undefined,scenarioPrompt:review?'用户会在被问到后补充本用例中缺少的缺口数量、规则或准入状态、负责人。只使用实际补充事实，不读取参考答案。取得必要信息后结束对话。':undefined};
      return Object.assign({id:prefix+'-DEMO-EXP-'+key,name:name,scene:scene,agentId:owner.agentId,version:review?'V2':'V3',suiteIds:suiteIndexes.map(function(i){return suiteRows[i].id;}),bindings:b,unifiedBindings:clone(b),execution:exec,agentRuntimeOverride:key==='WEIGHT'?{mode:'override',modelRef:'GPT-6.1 Sol',parameters:{temperature:0}}:{mode:'inherit',parameters:{}},judgeRuntime:{modelRef:review?'Claude 5.5 Opus':'deepseek 4.1 flash',parameters:{temperature:0,maxOutputTokens:1800}},demoVersion:1,demoState:key==='PARTIAL'?'unrun':key==='CORE'?'analyzed':'completed',demoHistory:{seedRun:key!=='PARTIAL',analyze:key==='CORE',phase:'initial'}},extra || {});
    }
    return [
      make('CORE',sales?'渠道分货上线验收':'采购寻源上线验收',[0],sales?['constraints','quality','risk','evidence']:['admission','quality','risk','evidence'],'item_count'),
      make('WEIGHT',sales?'交付质量与依据加权评估':'寻源质量与依据加权评估',[0,1],['composite','evidence','observation'],'weighted_score'),
      make('PARTIAL',sales?'边界场景稳定性回归':'异常场景稳定性回归',[1],['quality','risk','evidence','observation'],'item_count'),
      make('REVIEW',sales?'销售风险多轮综合复核':'供应风险多轮综合复核',[2],['final','prompt','observation'],'custom_prompt')
    ];
  }
  function experiments(scene,taskRows,suiteRows) {
    return legacyExperiments(scene,taskRows,suiteRows).map(function(spec){
      spec.demoVersion=VERSION;
      spec.bindings.forEach(function(binding){binding.evaluatorRef.version=EVALUATOR_VERSION;});spec.unifiedBindings=clone(spec.bindings);
      var key=spec.id.split('-').pop(),gates=spec.bindings.filter(function(binding){return binding.role==='gate';});
      if(key==='CORE'||key==='WEIGHT'){
        var weights=key==='CORE'?[0.4,0.2,0.2,0.2]:[0.7,0.3];
        spec.execution.evaluatorSummary={type:'composite_policy',policyVersion:1,mode:'weighted_score',missingEvidence:'inconclusive',passThreshold:key==='CORE'?85:80,weights:gates.map(function(binding,index){return {bindingId:binding.id,weight:weights[index]};})};
      }else if(key==='PARTIAL'){
        spec.execution.evaluatorSummary={type:'composite_policy',policyVersion:1,mode:'custom_prompt',missingEvidence:'inconclusive',customPrompt:'依据真实评估器结果 {{evaluatorResults}} 复核边界处理：风险识别与处置必须明确通过，且交付质量评分和结果依据可追溯均达到各自门槛时通过；任何必要结果缺证或执行异常时待确认；有明确低分、依据冲突或遗漏必要处置时未通过。观察记录仅供查看，不能抵消失败。'};
      }
      return spec;
    });
  }
  function build(scene,requestedVersion) {
    if(!['sales','procurement'].includes(scene))return null;
    var legacy=requestedVersion===1,taskRows=tasks(scene),caseRows=scene==='sales'?salesCases():procurementCases();
    if(legacy){taskRows.forEach(function(task){task.demoVersion=1;task.evaluationBindings.forEach(function(binding){binding.evaluatorRef.version='V1';});});caseRows.forEach(function(row){row.demoVersion=1;});}
    var suiteRows=suites(scene,taskRows,caseRows);if(legacy)suiteRows.forEach(function(suite){suite.demoVersion=1;});
    return {scene:scene,prefix:scene==='sales'?'SAL':'PUR',demoVersion:legacy?1:VERSION,tasks:taskRows,cases:caseRows,suites:suiteRows,experiments:(legacy?legacyExperiments:experiments)(scene,taskRows,suiteRows),agentVersions:[{agentId:taskRows[0].agentId,id:'V3',name:'V3',status:'published',published:true,mock:true,runtime:{modelRef:'deepseek 4.1 flash',parameters:{temperature:0}}},{agentId:taskRows[2].agentId,id:'V2',name:'V2',status:'published',published:true,mock:true,runtime:{modelRef:'GPT-6.1 Sol',parameters:{temperature:0}}}]};
  }
  function fixtures() { var result={};['sales','procurement'].forEach(function(scene){build(scene).cases.forEach(function(row){result[row.id]=clone(row.demoScenario);});});return result; }
  global.AIOpsEvaluationDemoCatalog={version:VERSION,evaluatorIds:clone(IDS),evaluators:evaluators,legacyEvaluators:legacyEvaluators,scene:build,fixtures:fixtures,fixture:function(caseId,phaseName){var entry=fixtures()[caseId];return entry?clone(entry[phaseName==='repaired'?'repaired':'initial']):null;}};
})(window);
