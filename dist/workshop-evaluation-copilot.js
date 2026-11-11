/* Evaluation Skills use the workshop composer and natural-language requests. */
const evSkills = {
  task: {name: '业务任务设计', id: 'business-task-authoring', label: '业务任务'},
  suite: {name: '评测集构建', id: 'evaluation-set-builder', label: '评测集'},
  case: {name: '评测用例生成', id: 'evaluation-case-generator', label: '评测用例'},
  evaluator: {name: '离线评估器设计', id: 'offline-evaluator-authoring', label: '离线评估器'},
  experiment: {name: '评测实验编排', id: 'evaluation-experiment-builder', label: '评测实验'}
};

function evCopilotDirectKind(kind){return kind==='evaluator'||kind==='experiment';}
function evCopilotClone(value){return JSON.parse(JSON.stringify(value));}
function evCopilotSuiteIds(fields){return fields.suiteIds===undefined?(fields.suiteId?[fields.suiteId]:[]):fields.suiteIds;}
function evCopilotExecutionFields(fields){
  const execution={...fields};
  if(execution.caseRuns===undefined&&execution.times!==undefined)execution.caseRuns=execution.times;
  if(execution.fullRuns===undefined&&execution.rounds!==undefined)execution.fullRuns=execution.rounds;
  delete execution.times;delete execution.rounds;return execution;
}
function evCopilotExperimentMissing(fields){
  const missing=[],agent=evAgents().find(a=>a.id===fields.agentId),ids=evCopilotSuiteIds(fields);
  if(!agent)missing.push('缺少当前场景或所属应用的可用 Agent');
  else if(!evAgentVersions(agent.id).some(v=>v.id===fields.version))missing.push('缺少所选 Agent 的可用版本');
  if(!Array.isArray(ids)||!ids.length)missing.push('所选 Agent 缺少可用的评测集');
  else for(const id of ids){const suite=evData().suites.find(s=>s.id===id);if(!suite||suite.agentId!==fields.agentId)missing.push('评测集不属于所选 Agent 或已不存在');else if(!suite.caseIds.some(id=>evData().cases.some(c=>c.id===id&&!c.archived&&c.enabled)))missing.push('评测集「'+suite.name+'」缺少已启用的用例');}
  try{evEvaluatorSnapshot(fields.evaluatorIds,studio.scene);}catch(error){missing.push(error.message);}
  try{evExperimentExecution(fields.execution,studio.scene);}catch(error){missing.push(error.message);}
  return [...new Set(missing)];
}
function evCopilotNewDefaults(kind,context={}){
  const d=evData(),provided=context.fields||{},topic=studio.scene==='sales'?'销售分货':'采购寻源';
  if(kind==='evaluator'){const seed=evSeedEvaluators(studio.scene)[0];return {name:topic+'综合质量评估',description:seed.description,criteria:evCopilotClone(seed.criteria),...provided};}
  const agents=evAgents(),has=key=>Object.prototype.hasOwnProperty.call(provided,key),requested=has('suiteIds')?provided.suiteIds:has('suiteId')?[provided.suiteId]:context.suiteIds??(context.suiteId?[context.suiteId]:null),firstId=Array.isArray(requested)?requested[0]:'',knownSuite=d.suites.find(s=>s.id===firstId),agentId=has('agentId')?provided.agentId:context.agentId||knownSuite?.agentId||(evState.agentIds.length===1?evState.agentIds[0]:'')||agents[0]?.id||'',version=has('version')?provided.version:evAgentVersions(agentId)[0]?.id||'',fallbackSuite=d.suites.find(s=>s.agentId===agentId&&s.taskIds.length&&s.taskIds.every(id=>d.tasks.some(t=>t.id===id&&t.agentId===agentId))&&s.caseIds.some(id=>d.cases.some(c=>c.id===id&&!c.archived&&c.enabled))),suiteIds=requested===null?(fallbackSuite?[fallbackSuite.id]:[]):requested,defaults={concurrency:2,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[]},execution=has('execution')&&(!provided.execution||typeof provided.execution!=='object'||Array.isArray(provided.execution))?provided.execution:{...defaults,...evCopilotExecutionFields(provided.execution||{})};
  return {name:topic+'质量评测实验',agentId,version,evaluatorIds:has('evaluatorIds')?provided.evaluatorIds:evEvaluatorDefaultIds(studio.scene),...provided,suiteIds,suiteId:Array.isArray(suiteIds)?suiteIds[0]||'':'',execution};
}
function evCopilotNewPrefill(kind,fields){
  const path=evWorkspace.name+' / '+evApplication().name+' / '+studioSceneData[studio.scene].name+'场景';
  if(kind==='evaluator')return `请使用「${evSkills[kind].name}」Skill，在「${path}」创建离线评估器「${fields.name}」。\n评估器简介：「${fields.description}」\n`+(Array.isArray(fields.criteria)?fields.criteria:[]).map(c=>`评分项「${c.name}」：权重 ${c.weight}；通过阈值 ${c.passScore??fields.passScore??80} 分；标准「${c.description}」`).join('\n')+'\n权重使用小数且合计1；每项按0～100分评分，所有评分项达到各自阈值时通过。请生成草稿，等待我确认创建。';
  const agent=evAgents().find(a=>a.id===fields.agentId),ids=evCopilotSuiteIds(fields),suites=Array.isArray(ids)?ids.map(id=>evData().suites.find(s=>s.id===id)||{id,name:id}):[],evaluators=evEvaluatorStore().evaluators,refs=Array.isArray(fields.evaluatorIds)?fields.evaluatorIds.map(id=>evaluators.find(e=>e.id===id)||{id,name:id,version:'待确认'}):[],execution=evCopilotExecutionFields(fields.execution||{}),model=evEvaluationModels().find(m=>m.id===execution.modelId),mcps=evExperimentMcps(studio.scene),tools=Array.isArray(execution.mcpIds)?execution.mcpIds.map(id=>mcps.find(m=>m.id===id)||{id,name:id}):[],missing=evCopilotExperimentMissing(fields);
  return `请使用「${evSkills[kind].name}」Skill，在「${path}」创建评测实验「${fields.name}」。\n选择 Agent「${agent?.name||fields.agentId||'待选择'}」，Agent版本「${fields.version||'待选择'}」。\n`+(suites.length?'使用'+suites.map(s=>`评测集「${s.name}」`).join('、')+'。':'请补充该 Agent 的可用评测集。')+'\n'+(refs.length?'使用'+refs.map(e=>`离线评估器「${e.name}」（版本「${e.version}」）`).join('、')+'。':'请补充至少一个启用的离线评估器。')+`\n并发数：${execution.concurrency??'待选择'}；每个用例执行次数：${execution.caseRuns??'待选择'}；全量评测次数：${execution.fullRuns??'待选择'}。\n每次全量执行生成独立评测记录；用例的每次执行启动独立对话，不共享上下文；轮次仅表示对话中的问答。\n评测模型「${model?.name||execution.modelId||'待选择'}」。\n`+(tools.length?'使用'+tools.map(m=>`MCP「${m.name}」`).join('、')+'。':'MCP：无。')+'\n请保存以上配置与资源快照，等待我确认创建。'+(missing.length?'\n当前缺少资源：'+missing.join('；')+'。':'');
}
function evCopilotLastQuoted(request,label){const values=[...request.matchAll(new RegExp('(?:'+label+')'+String.raw`\s*(?:改为|设为|选择|使用|是|为|[:：])?\s*[「“"]([\s\S]*?)[」”"]`,'gi'))];return values.at(-1)?.[1]?.trim()||'';}
function evCopilotLastLine(request,label){const values=[...request.matchAll(new RegExp(String.raw`(?:^|\n)\s*(?:${label})\s*[:：]\s*(.+)`,'gi'))];return values.at(-1)?.[1]?.trim()||'';}
function evCopilotCleanRef(value){return String(value||'').trim().replace(/^[「“"\s]+|[」”"\s。]+$/g,'').trim();}
function evCopilotLatestRef(request,label,quotedLabel=label){
  const candidates=[];
  for(const m of request.matchAll(new RegExp('(?:'+quotedLabel+')'+String.raw`\s*(?:改为|设为|改用|仅使用|改成|选择|使用|是|为|[:：])?\s*[「“"]([\s\S]*?)[」”"]`,'gi')))candidates.push({index:m.index,priority:3,value:m[1]});
  for(const m of request.matchAll(new RegExp(String.raw`(?:^|\n)\s*(?:${label})\s*[:：]\s*([^\n]*)`,'gi')))candidates.push({index:m.index,priority:1,value:m[1]});
  for(const m of request.matchAll(new RegExp('(?:'+label+')'+String.raw`\s*(?:改为|设为|改用|仅使用|改成)\s*([^，。；;\n]*)`,'gi')))candidates.push({index:m.index,priority:2,value:m[1]});
  return candidates.sort((x,y)=>x.index-y.index||x.priority-y.priority).at(-1)||null;
}
function evCopilotResolveRef(rows,reference,label,preferredId=''){
  const ref=evCopilotCleanRef(reference),exact=rows.find(r=>r.id===ref);if(exact)return exact;
  const matches=rows.filter(r=>r.name===ref);if(matches.length===1)return matches[0];if(matches.length>1){const preferred=matches.find(r=>r.id===preferredId);if(preferred)return preferred;throw Error(label+'名称不唯一，请在请求中使用资源编号。');}
  throw Error('请求中的'+label+'不存在或不属于当前场景：'+ref);
}
function evCopilotMultiRefs(request,label){
  const events=[],ops='改为|设为|改用|仅使用|改成|增加|追加|添加|选择|使用|是|为|[:：]';
  for(const m of request.matchAll(new RegExp('(?:'+label+')'+String.raw`\s*(?:(${ops})\s*)?[「“"]([^」”"]+)[」”"](?:\s*[（(]\s*版本\s*[「“"]([^」”"]+)[」”"]\s*[）)])?`,'gi'))){
    const prefix=request.slice(Math.max(0,m.index-8),m.index),replace=/改为|设为|改用|仅使用|改成/.test(m[1]||'')||/(?:改为|设为|改用|仅使用|改成)\s*$/.test(prefix),refs=[{reference:m[2].trim(),version:m[3]?.trim()||''}];
    let cursor=m.index+m[0].length,continuation;
    while((continuation=request.slice(cursor).match(/^\s*(?:[、,，]|以及|及|与|和)\s*[「“"]([^」”"]+)[」”"](?:\s*[（(]\s*版本\s*[「“"]([^」”"]+)[」”"]\s*[）)])?/))){refs.push({reference:continuation[1].trim(),version:continuation[2]?.trim()||''});cursor+=continuation[0].length;}
    events.push({index:m.index,replace,refs});
  }
  for(const pattern of [new RegExp('(?:'+label+')'+String.raw`\s*(改为|设为|改用|仅使用|改成|增加|追加|添加)\s*([^。；;\n]*)`,'gi'),new RegExp(String.raw`(改为|设为|改用|仅使用|改成|增加|追加|添加)\s*(?:${label})\s*([^。；;\n]*)`,'gi')])for(const m of request.matchAll(pattern)){if(/[「“"]/.test(m[2]))continue;events.push({index:m.index,replace:/改为|设为|改用|仅使用|改成/.test(m[1]),refs:m[2].split(/[、,，]/).map(evCopilotCleanRef).filter(Boolean).map(reference=>({reference,version:''}))});}
  for(const m of request.matchAll(new RegExp(String.raw`(?:^|\n)\s*(?:${label})\s*[:：]\s*([^\n]*)`,'gi'))){if(/[「“"]/.test(m[1]))continue;const raw=evCopilotCleanRef(m[1]);events.push({index:m.index,replace:true,refs:/^(?:无|不使用|无MCP|none|不选|空)$/i.test(raw)?[]:raw.split(/[、,，]/).map(evCopilotCleanRef).filter(Boolean).map(reference=>({reference,version:''}))});}
  if(!events.length)return null;let refs=[];for(const event of events.sort((x,y)=>x.index-y.index)){if(event.replace)refs=[];refs.push(...event.refs);}return refs;
}
function evCopilotConfigNumber(request,label,current){
  const values=[...request.matchAll(new RegExp('(?:'+label+')'+String.raw`\s*(?:(?:改为|设为|是|为|[:：])\s*|(?=[+\-]?\d))([^，,。；;\n]*)`,'g'))];if(!values.length)return current;const raw=evCopilotCleanRef(values.at(-1)[1]),match=raw.match(/^([+\-]?\d+(?:\.\d+)?)\s*(?:次|轮|个)?$/);if(!match)throw Error('请用有效整数说明'+label.split('|')[0]+'。');return Number(match[1]);
}
function evCopilotReadNewRequest(request,c){
  const f=evCopilotClone(c.fields),label=evSkills[c.kind].label,name=evCopilotLatestRef(request,label+'名称|名称',label);
  if(name)f.name=evCopilotCleanRef(name.value);f.request=request;f.instructions=evCopilotLastLine(request,'补充要求')||'';
  if(c.kind==='evaluator'){
    const description=evCopilotLatestRef(request,'评估器简介|简介|评估器描述|描述');f.description=description?description.value.trim():(request!==c.initialRequest?request:f.description);
    if(/(?:^|\n)\s*(?:通过阈值|通过分数|阈值)\s*[:：]/.test(request))throw Error('请在每个评分项中设置通过阈值，不再使用独立的全局阈值。');
    const starts=[...request.matchAll(/评分项\s*[「“"]([^」”"]*)[」”"]/g)],criteria=[...request.matchAll(/评分项\s*[「“"]([^」”"]*)[」”"]\s*[:：]?\s*权重\s*[:：]?\s*([+\-]?\d+(?:\.\d+)?)\s*[；;，,]\s*(?:通过阈值|阈值)\s*[:：]?\s*([+\-]?\d+(?:\.\d+)?)\s*分?\s*[；;，,]\s*(?:评分标准|标准)\s*[:：]?\s*[「“"]([\s\S]*?)[」”"]/g)].map(m=>({name:m[1].trim(),weight:Number(m[2]),passScore:Number(m[3]),description:m[4].trim()}));
    if(starts.length&&criteria.length!==starts.length)throw Error('每个评分项需要名称、小数权重、通过阈值和评分标准，例如：评分项「正确性」：权重0.5；通过阈值80分；标准「明确的评分规则」。');
    if(criteria.length)f.criteria=criteria;return f;
  }
  const agentRef=evCopilotLatestRef(request,'所属[ ]*Agent|Agent');if(agentRef)f.agentId=evCopilotResolveRef(evAgents(),agentRef.value,'Agent',f.agentId).id;
  const versionRef=evCopilotLatestRef(request,'Agent[ ]*版本|版本','Agent[ ]*版本');if(versionRef)f.version=evCopilotCleanRef(versionRef.value).replace(/^版本\s*/,'');
  const suiteRefs=evCopilotMultiRefs(request,'评测集');if(suiteRefs){const preferred=Array.isArray(f.suiteIds)?f.suiteIds:f.suiteId?[f.suiteId]:[];f.suiteIds=suiteRefs.map((ref,index)=>{if(ref.version)throw Error('评测集按当前资源保存快照，不支持独立的版本引用。');return evCopilotResolveRef(evData().suites,ref.reference,'评测集',preferred[index]).id;});f.suiteId=f.suiteIds[0]||'';}
  const evaluatorRefs=evCopilotMultiRefs(request,'(?:离线)?评估器');if(evaluatorRefs){const store=evEvaluatorStore(),preferred=Array.isArray(f.evaluatorIds)?f.evaluatorIds:[];f.evaluatorIds=evaluatorRefs.map((ref,index)=>{const e=evCopilotResolveRef(store.evaluators,ref.reference,'离线评估器',preferred[index]);if(!e.enabled)throw Error('请求中的离线评估器已停用：'+e.name);if(ref.version&&ref.version!==e.version)throw Error('离线评估器「'+e.name+'」当前版本为'+e.version+'，请求中的'+ref.version+'不可用。');return e.id;});}
  const execution=f.execution&&typeof f.execution==='object'&&!Array.isArray(f.execution)?evCopilotExecutionFields(f.execution):f.execution;if(!execution||typeof execution!=='object'||Array.isArray(execution))throw Error('执行配置无效');
  execution.concurrency=evCopilotConfigNumber(request,'并发数|并发',execution.concurrency);
  execution.caseRuns=evCopilotConfigNumber(request,'每个用例执行次数|单个用例执行次数|用例执行次数|每个用例重复次数|用例重复次数|每个用例重复执行|每个用例执行|(?<!全量)(?<!评测集)执行次数',execution.caseRuns);
  execution.fullRuns=evCopilotConfigNumber(request,'全量评测次数|全量执行次数|评测集执行次数|全量评测|全量执行|执行轮次|执行轮数',execution.fullRuns);
  const modelRef=evCopilotLatestRef(request,'评测模型|模型');if(modelRef)execution.modelId=evCopilotResolveRef(evEvaluationModels(),modelRef.value,'评测模型',execution.modelId).id;
  const mcpRefs=evCopilotMultiRefs(request,'MCP');if(mcpRefs){const preferred=Array.isArray(execution.mcpIds)?execution.mcpIds:[];execution.mcpIds=mcpRefs.map((ref,index)=>{if(ref.version)throw Error('MCP 不支持独立的版本引用。');return evCopilotResolveRef(evExperimentMcps(studio.scene),ref.reference,'MCP',preferred[index]).id;});}
  f.execution=execution;return f;
}
function evCopilotBuildEvaluatorDraft(fields){const normalized=evEvaluatorValidate(fields);return {...normalized};}
function evCopilotBuildExperimentDraft(fields){const normalized=evValidateExperimentDraft(fields),ids=normalized.suiteIds||[normalized.suiteId],suites=ids.map(id=>evData().suites.find(s=>s.id===id)),evaluators=evEvaluatorSnapshot(normalized.evaluatorIds,studio.scene),caseIds=[...new Set(suites.flatMap(s=>s.caseIds))],cases=caseIds.map(id=>evData().cases.find(c=>c.id===id&&!c.archived)).filter(Boolean),model=evEvaluationModels().find(m=>m.id===normalized.execution.modelId),mcps=evExperimentMcps(studio.scene);return {...normalized,agentName:evAgentName(normalized.agentId),suiteName:suites.map(s=>s.name).join('、'),suiteRefs:suites.map(s=>({id:s.id,name:s.name})),caseCount:cases.length,enabledCaseCount:cases.filter(c=>c.enabled).length,recordCount:normalized.execution.fullRuns,recordResultCount:cases.length*normalized.execution.caseRuns,resultCount:cases.length*normalized.execution.caseRuns*normalized.execution.fullRuns,modelName:model.name,mcpRefs:normalized.execution.mcpIds.map(id=>{const m=mcps.find(m=>m.id===id);return {id:m.id,name:m.name};}),evaluatorRefs:evaluators.map(e=>({id:e.id,name:e.name,version:e.version,criteria:e.criteria.map(item=>({name:item.name,weight:item.weight,passScore:item.passScore}))}))};}
function evCopilotExperimentResources(fields){const f=evValidateExperimentDraft(fields),d=evData(),suites=(f.suiteIds||[f.suiteId]).map(id=>d.suites.find(s=>s.id===id)),agent=evAgents().find(a=>a.id===f.agentId),taskIds=[...new Set(suites.flatMap(s=>s.taskIds))],caseIds=[...new Set(suites.flatMap(s=>s.caseIds))],mcps=evExperimentMcps(studio.scene);return {agent:{...evCopilotClone(agent),version:f.version},suites:evCopilotClone(suites),tasks:taskIds.map(id=>evCopilotClone(d.tasks.find(t=>t.id===id))),cases:caseIds.map(id=>{const c=d.cases.find(c=>c.id===id);return c?evCopilotClone(c):null;}),evaluators:evEvaluatorSnapshot(f.evaluatorIds,studio.scene),execution:evCopilotClone(f.execution),model:evCopilotClone(evEvaluationModels().find(m=>m.id===f.execution.modelId)),mcps:f.execution.mcpIds.map(id=>evCopilotClone(mcps.find(m=>m.id===id)))};}
function evCopilotDraftPreview(c){const draft=evCopilotDirectKind(c.kind)?c.generatedDraft||c.draft:c.draft;if(c.kind==='evaluator')return `评估器简介：${draft.description}\n`+draft.criteria.map(d=>`• ${d.name}：权重${d.weight}；通过阈值${d.passScore}分；${d.description}`).join('\n')+'\n所有评分项达到各自阈值时通过；权重仅影响加权总分。';if(c.kind==='experiment')return `Agent：${draft.agentName} / ${draft.version}\n评测集：${draft.suiteName}\n用例去重后共${draft.caseCount}条，${draft.enabledCaseCount}条启用；计划生成${draft.recordCount}条独立评测记录，每条记录${draft.recordResultCount}条用例结果，共${draft.resultCount}条结果。\n离线评估器：`+draft.evaluatorRefs.map(e=>`${e.name} ${e.version}（${e.criteria.map(item=>item.name+'≥'+item.passScore+'分').join('、')}）`).join('；')+`\n执行配置：并发${draft.execution.concurrency}；每个用例执行次数${draft.execution.caseRuns}；全量评测次数${draft.execution.fullRuns}\n用例每次执行均从相同输入启动独立对话，不共享上下文；轮次仅表示问答。\n评测模型：${draft.modelName}\nMCP：${draft.mcpRefs.length?draft.mcpRefs.map(m=>m.name).join('、'):'无'}\n确认后仅创建实验；运行操作由你发起。`;return c.kind==='task'?evTaskPrompt(draft):c.kind==='suite'?draft.target:draft.input;}
function evCopilotDraftSmall(c){const draft=c.generatedDraft||c.draft;if(c.kind==='evaluator')return draft.criteria.length+'个评分项 · 权重总计1 · 逐项达标';if(c.kind==='experiment')return draft.evaluatorRefs.length+'个离线评估器 · 保存资源快照';return c.kind==='task'?(c.draft.dimensions||[]).length+' 个评估维度':c.kind==='suite'?c.draft.taskIds.length+' 个业务任务':'预期结果：'+c.draft.expected;}

function evCopilotDefaults(kind, context = {}) {
  if(evCopilotDirectKind(kind))return evCopilotNewDefaults(kind,context);
  const d = evData(), suite = d.suites.find(s => s.id === context.suiteId);
  const provided = context.fields || {}, agents = evAgents();
  const agentId = provided.agentId || context.agentId || suite?.agentId ||
    (evState.agentIds.length === 1 ? evState.agentIds[0] : '') || agents[0]?.id || '';
  const tasks = d.tasks.filter(t => t.agentId === agentId);
  const sales = studio.scene === 'sales', topic = sales ? '销售分货' : '采购寻源';
  return {
    name: kind === 'task' ? topic + '质量评测' : kind === 'suite' ? topic + '核心能力评测' : topic + '边界条件校验',
    agentId,
    description: sales ? '根据销售订单、可供库存和已确认规则生成可追溯的分货方案。' : '根据采购需求、供应商准入、报价和交期生成可评审的寻源建议。',
    target: '验证业务约束、输出完整性和异常处理能力。',
    taskIds: (suite ? suite.taskIds : tasks.slice(0, 2).map(t => t.id)).filter(id => tasks.some(t => t.id === id)),
    input: sales ? '需求100件，可供库存80件，请按已确认规则生成分货方案。' : '净需求100件，合格供应商可按期提供80件，请生成采购建议。',
    expected: '输出符合业务约束的方案，明确20件缺口和规则依据，并保留人工确认节点。',
    tags: '边界条件，业务约束',
    ...(kind === 'task' ? {dimensions: [
      {name: '业务正确性', description: '结果是否遵守已确认的业务约束。', values: ['不符合', '部分符合', '符合']},
      {name: '结果完整性', description: '是否覆盖必要结果、异常说明和依据。', values: ['不完整', '基本完整', '完整']}
    ]} : {}),
    ...provided
  };
}

function evCopilotPrefill(kind, fields, context = {}) {
  if(evCopilotDirectKind(kind))return evCopilotNewPrefill(kind,fields,context);
  const scene = studioSceneData[studio.scene].name, agent = evAgentName(fields.agentId);
  const request = `请使用「${evSkills[kind].name}」Skill，为「${scene}」场景的 Agent「${agent}」`;
  if (kind === 'task') return request + `创建业务任务「${fields.name}」。任务描述：「${fields.description}」\n请把任务描述、处理范围、输入、完成与优秀标准、正例和反例整理成一段可自由编辑的提示词，并建议评估维度。模板内容不要求逐项填写。`;
  if (kind === 'suite') {
    const names = fields.taskIds.map(id => evData().tasks.find(t => t.id === id)?.name).filter(Boolean);
    return request + `创建评测集「${fields.name}」。测试目标是「${fields.target}」。\n` +
      (names.length ? '关联' + names.map(name => `业务任务「${name}」`).join('、') + '。' : '请选用该 Agent 相关的业务任务。') +
      '请给出可编辑的评测集草稿。';
  }
  const suite = evData().suites.find(s => s.id === context.suiteId);
  return request + `创建评测用例「${fields.name}」。${suite ? `用于评测集「${suite.name}」。` : ''}\n输入是「${fields.input}」。预期结果是「${fields.expected}」。标签为「${fields.tags}」。请生成可编辑的用例草稿。`;
}

function evCopilot(kind, context = {}) {
  evData();
  if (!evSkills[kind]) return;
  if(typeof evExperimentAssistantClose==='function')evExperimentAssistantClose();
  const fields = evCopilotDefaults(kind, context), input = evCopilotPrefill(kind, fields, context);
  evCloseModal();
  evState.copilot = {kind, context, scene: studio.scene, phase: 'input', draft: null, fields,
    input, initialRequest: input, request: '', error: kind==='experiment'?evCopilotExperimentMissing(fields).join('；'):''};
  evState.scopeOpen = false;
  studio.panels.chat = true;
  studio.panels.gui = true;
  studio.weights = {docs: 10, chat: 34, gui: 56};
  evRender();
  document.getElementById('studio-message-input')?.focus();
}

function evCopilotRemember(value) {
  const c = evState.copilot;
  if (!c) return;
  c.input = typeof value === 'string' ? value : String(value?.value || '');
  c.error = '';
}

function evCopilotRevise() {
  const c = evState.copilot;
  if (!c) return;
  c.phase = 'input';
  c.input = c.request || c.initialRequest;
  c.error = '';
  evRender();
  document.getElementById('studio-message-input')?.focus();
}

function evCopilotChat() {
  const c = evState.copilot, s = evSkills[c.kind], review = ['review', 'saved'].includes(c.phase);
  const preview = review ? evCopilotDraftPreview(c) : '';
  const direct=evCopilotDirectKind(c.kind);
  return `<div class="studio-panel-top studio-chat-tabs ev-copilot-top"><span class="ev-spark">✧</span><b>Copilot</b><span class="ev-chat-status">评测助手</span><button aria-label="退出评测 Copilot" onclick="evState.copilot=null;evRender()">×</button></div>
    <div class="studio-chat-scroll ev-copilot-scroll" id="studio-chat-scroll">
      <div class="ev-copilot-intro"><span class="studio-ai-dot">AI</span><h3>${s.label}创建助手</h3><p>已选中「${s.name}」Skill，并把当前场景信息写入下方请求。直接修改这段话并发送即可。</p></div>
      <div class="ev-context-pill">${esc(evWorkspace.name)} / ${esc(evApplication().name)} / ${esc(studioSceneData[studio.scene].name)}场景</div>
      ${c.request ? `<div class="studio-chat-bubble user ev-copilot-user">${esc(c.request)}</div>` : ''}
      ${review ? `<article class="ev-copilot-result"><span>${c.phase === 'saved' ? '已保存到当前场景' : '草稿已生成 · Mock'}</span><h3>${esc(c.draft.name)}</h3><p>${esc(!direct&&preview.length > 360 ? preview.slice(0, 360) + '…' : preview)}</p><small>${esc(evCopilotDraftSmall(c))}</small>${direct&&c.phase==='review'?'<small>草稿对应上方已发送的请求；修改后请先发送，再确认创建。</small>':''}<button class="ont-button strong" onclick="${c.phase === 'saved' ? 'evCopilotOpenSaved()' : direct?'evCopilotConfirm()':'evCopilotReview()'}">${c.phase === 'saved' ? '查看已保存的' : direct?'确认创建':'查看并保存'}${s.label} →</button><button class="ont-link" onclick="${c.phase === 'saved' ? 'evCopilotContinue()' : 'evCopilotRevise()'}">${c.phase === 'saved' ? '继续创建' : '修改请求'}</button></article>` : ''}
      ${c.error ? `<p class="ont-error" role="status">${esc(c.error)}</p>` : ''}
    </div>
    <form id="ev-copilot-composer" class="studio-composer ev-natural-composer${direct&&review?' ev-natural-composer-compact':''}" onsubmit="event.preventDefault();evCopilotSend()">
      <div class="ev-selected-skill" aria-label="已选中 Skill"><span>✧ ${s.name}</span><code>/${s.id}</code></div>
      <textarea id="studio-message-input" name="request" aria-label="Copilot 对话输入" placeholder="直接描述你希望生成的${s.label}，可以补充范围、约束或示例。" oninput="evCopilotRemember(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();evCopilotSend()}">${esc(c.input)}</textarea>
      <div class="studio-compose-foot"><span>Enter 发送 · Shift + Enter 换行</span><button class="ont-button strong" type="submit" aria-label="发送 Copilot 请求">发送</button></div>
    </form>`;
}

function evCopilotReadRequest(request, c) {
  if(evCopilotDirectKind(c.kind))return evCopilotReadNewRequest(request,c);
  const quoted = label => {
    const match = request.match(new RegExp(label + String.raw`\s*(?:是|为|[:：])?\s*[「“"]([\s\S]*?)[」”"]`, 'i'));
    return match?.[1]?.trim() || '';
  };
  const line = label => {
    const match = request.match(new RegExp(String.raw`(?:^|\n)\s*(?:${label})\s*[:：]\s*(.+)`, 'i'));
    return match?.[1]?.trim() || '';
  };
  const f = {...c.fields}, name = quoted(evSkills[c.kind].label) || line('名称|' + evSkills[c.kind].label + '名称');
  if (name) f.name = name;
  const agentName = quoted('Agent') || line('Agent|所属 Agent|所属Agent');
  if (agentName) {
    const agent = evAgents().find(a => a.id === agentName || a.name === agentName);
    if (!agent) throw Error('请求中的 Agent 不属于当前场景或所属应用，请调整 Agent 名称。');
    f.agentId = agent.id;
  }
  f.description = quoted('任务描述') || line('任务描述') || (request !== c.initialRequest ? request : f.description);
  f.target = quoted('测试目标') || line('测试目标') || (request !== c.initialRequest ? request : f.target);
  f.input = quoted('输入') || line('输入') || f.input;
  f.expected = quoted('预期结果') || line('预期结果') || f.expected;
  f.tags = quoted('标签') || line('标签') || f.tags;
  f.instructions = line('补充要求') || '';
  f.request = request;
  if (c.kind === 'suite') {
    const names = [...request.matchAll(/业务任务\s*[「“"]([^」”"]+)[」”"]/g)].map(m => m[1].trim());
    const lineTasks = line('业务任务');
    if (lineTasks) names.push(...lineTasks.split(/[、,，]/).map(x => x.trim()).filter(Boolean));
    const allowed = evSuiteTasks(f.agentId);
    if (names.length) {
      f.taskIds = names.map(taskName => allowed.find(t => t.id === taskName || t.name === taskName)?.id);
      if (f.taskIds.some(id => !id)) throw Error('请求中的业务任务需属于所选 Agent，请调整任务名称或 Agent。');
    } else f.taskIds = (f.taskIds || []).filter(id => allowed.some(t => t.id === id));
    if (!f.taskIds.length) f.taskIds = allowed.slice(0, 2).map(t => t.id);
    if (!f.taskIds.length) throw Error('该 Agent 暂无业务任务，请先创建业务任务。');
  }
  return f;
}

function evCopilotSend(optionalRequest) {
  const c = evState.copilot;
  if (!c || c.scene !== studio.scene) return;
  const request = String(typeof optionalRequest === 'string' ? optionalRequest :
    document.getElementById('studio-message-input')?.value ?? c.input ?? '').trim();
  if (!request) return;
  c.input = request;
  try {
    const fields = evCopilotReadRequest(request, c);
    c.fields = fields;
    c.draft = c.kind === 'evaluator'?evCopilotBuildEvaluatorDraft(fields):c.kind==='experiment'?evCopilotBuildExperimentDraft(fields):c.kind === 'task' ? evBuildTaskDraft({...fields,
      prompt: typeof fields.prompt === 'string' ? fields.prompt : evTaskTemplate(fields.description || request)
    }) : c.kind === 'suite' ? evBuildSuiteDraft(fields) :
      evBuildCaseDraft({...fields, suiteId: c.context.suiteId});
    c.draft.sourceRequest = request;
    if(evCopilotDirectKind(c.kind)){c.generatedDraft=evCopilotClone(c.draft);c.draftResources=c.kind==='experiment'?evCopilotExperimentResources(c.draft):null;delete c.savedId;delete c.savedRecord;}
    c.request = request;
    c.input = '';
    c.phase = 'review';
    c.error = '';
  } catch (error) {
    if(evCopilotDirectKind(c.kind)){c.phase='input';c.request=request;c.input=request;c.draft=null;}
    c.error = error.message || '请求暂时无法生成，请补充说明。';
  }
  evRender();
  const scroll = document.getElementById('studio-chat-scroll');
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function evCopilotGenerate(source) {
  if (typeof source === 'string') return evCopilotSend(source);
  const f = new FormData(source);
  return evCopilotSend(String(f.get('request') || ''));
}

function evCopilotContinue() {
  const c = evState.copilot;
  if (c) evCopilot(c.kind, c.context);
}

function evCopilotSaved(kind, record) {
  const c = evState.copilot;
  if (!c || c.kind !== kind || c.scene !== studio.scene || !record) return;
  record.sourceRequest = c.request;
  c.phase = 'saved';
  c.savedId = record.id;
  if(evCopilotDirectKind(kind))c.savedRecord=record;
  c.draft = JSON.parse(JSON.stringify(record));
}

function evCopilotOpenSaved() {
  const c = evState.copilot;
  if (!c || c.scene !== studio.scene) return;
  if(c.kind==='evaluator'){evState.tab='离线评估器';evState.suiteId=null;evEvaluatorState.search='';evEvaluatorState.status='全部状态';if(typeof evClearFilters==='function')evClearFilters('evaluator');evRender();evEvaluatorDetail(c.savedId);}
  else if(c.kind==='experiment'){if(typeof evClearFilters==='function')evClearFilters('experiment');evExperimentOpen(c.savedId);}
  else if (c.kind === 'task') evTaskDetail(c.savedId);
  else if (c.kind === 'suite') evOpenSuite(c.savedId);
  else {
    evState.tab = '评测用例库';
    evState.suiteId = null;
    evAssetState.caseSearch = '';
    evAssetState.caseTag = '';
    evAssetState.caseStatus = 'active';
    evRender();
    evEditCase(c.savedId);
  }
}

function evCopilotReview() {
  const c = evState.copilot;
  if (!c?.draft || c.phase !== 'review' || c.scene !== studio.scene) return;
  if(evCopilotDirectKind(c.kind)){evCopilotConfirm();return;}
  if (c.kind === 'task') evEditTask('', c.draft);
  else if (c.kind === 'suite') evEditSuite('', c.draft);
  else evEditCase('', c.context.suiteId || '', c.draft);
}

function evCopilotConfirm(){
  const c=evState.copilot;if(!c||!evCopilotDirectKind(c.kind)||c.scene!==studio.scene)return false;
  if(c.phase==='saved')return c.savedRecord||false;if(c.phase!=='review'||!c.draft)return false;
  if(c.input.trim()&&c.input.trim()!==c.request.trim()){c.error='输入框有尚未发送的修改，请先发送请求生成新草稿，再确认创建。';evRender();return false;}
  try{
    let record;
    if(c.kind==='evaluator')record=evSaveEvaluatorDraft(evCopilotBuildEvaluatorDraft(c.draft));
    else{const normalized=evValidateExperimentDraft(c.draft),resources=evCopilotExperimentResources(normalized);if(JSON.stringify(resources)!==JSON.stringify(c.draftResources))throw Error('相关 Agent、评测集、业务任务、用例、评估器、模型或 MCP 已变更，请修改请求并重新生成草稿后确认。');record=evCreateExperiment(normalized);}
    record.sourceRequest=c.request;evCopilotSaved(c.kind,record);c.error='';
    if(c.kind==='evaluator'){evState.tab='离线评估器';evState.suiteId=null;evEvaluatorState.search='';evEvaluatorState.status='全部状态';if(typeof evClearFilters==='function')evClearFilters('evaluator');evRender();}
    else{if(typeof evClearFilters==='function')evClearFilters('experiment');evExperimentOpen(record.id);}
    const scroll=document.getElementById('studio-chat-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;
    return record;
  }catch(error){c.error=error.message||'创建失败，请检查请求及当前资源。';c.input=c.request||c.initialRequest;evRender();return false;}
}

studioChat = function() {
  evData();
  if(typeof evExperimentAssistantState==='function'&&evExperimentAssistantState())return evExperimentAssistantChat();
  return evState.copilot?.scene === studio.scene ? evCopilotChat() : evOriginalStudioChat();
};
sendStudioMessage = function() {
  if(typeof evExperimentAssistantState==='function'&&evExperimentAssistantState()){evExperimentAssistantSend();return;}
  if (evState.copilot) { evCopilotSend(); return; }
  evOriginalSendStudioMessage();
};
