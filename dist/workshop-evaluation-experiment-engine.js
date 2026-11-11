/* Local evaluation experiment snapshots and batched Mock execution. */
'use strict';
const evExperimentStores = {};
const evExperimentTimers = new Map();
const evExperimentMetricSnapshots = new Map();
const evExperimentMetricContexts = new Map();
const evExperimentMockBatchMs = 1500;
function evExperimentExecutions(experiment){return (experiment?.runs||[]).flatMap(record=>[record,...(record.supplements||[])]);}
function evExperimentValidationExecutions(experiment){return experiment?.validationRuns||[];}
function evExperimentOperationExecutions(experiment){return [...evExperimentExecutions(experiment),...evExperimentValidationExecutions(experiment)];}
function evExperimentValidationGet(experiment,id){return evExperimentValidationExecutions(experiment).find(run=>run.id===id)||null;}
function evExperimentExecutionGet(experiment,id){return evExperimentExecutions(experiment).find(execution=>execution.id===id)||null;}
function evExperimentRecordFor(experiment,execution){
 const id=typeof execution==='string'?execution:execution?.id,found=evExperimentExecutionGet(experiment,id);
 return found?(experiment.runs||[]).find(record=>record.id===(found.parentRunId||found.id))||null:null;
}
function evExperimentActiveExecution(experiment){
 const executions=evExperimentOperationExecutions(experiment);
 return executions.find(execution=>['运行中','已暂停'].includes(execution.status))||executions.filter(execution=>execution.status==='排队中').sort((a,b)=>a.sequence-b.sequence)[0]||null;
}
function evExperimentCaseRuns(execution){return Math.max(1,Number(execution?.caseRuns??execution?.times)||1);}
function evExperimentFullRuns(execution){return Math.max(1,Number(execution?.fullRuns??execution?.rounds)||1);}
function evExperimentModeLabel(execution){return execution?.mode==='scenario_simulation'?'多轮执行':'单轮执行';}
function evExperimentEvaluationKey(evaluator,evaluators=[]){
  const value=typeof evaluator==='string'?{id:evaluator}:evaluator;
  return value.unified||evaluators.filter(item=>(typeof item==='string'?item:item.id)===value.id).length>1?value.id+'@'+value.version:value.id;
}
function evExperimentEvaluationBindings(execution={},evaluators=[]){
  const list=evaluators.map(item=>typeof item==='string'?{id:item}:item),raw=execution.evaluationBindings??[],allSelected=execution.evaluationPolicy==='all_selected';
  if(!Array.isArray(raw))throw Error('评估配置须为评估器绑定列表');
  const ids=new Set();
  for(const binding of raw){
    if(!binding||typeof binding!=='object'||Array.isArray(binding)||typeof binding.evaluatorId!=='string'||!binding.evaluatorId.trim())throw Error('请选择评估配置对应的评估器');
    if(ids.has(binding.evaluatorId))throw Error('同一评估器不能重复配置评估对象');ids.add(binding.evaluatorId);
    if(!['first_response','conversation'].includes(binding.target))throw Error('评估对象须为首轮回复或整段会话');
    if(!(allSelected&&binding.participation===undefined)&&!['gate','observe'].includes(binding.participation))throw Error('结果用途须为参与通过判定或仅观察');
    if(binding.target==='conversation'&&execution.mode!=='scenario_simulation')throw Error('整段会话评估需要选择多轮执行');
    if(list.length&&!list.some(item=>binding.evaluatorId===item.id||binding.evaluatorId===item.id+'@'+item.version))throw Error('评估配置包含未选用的评估器');
  }
  if(!list.length)return raw.map(binding=>({evaluatorId:binding.evaluatorId,target:binding.target,participation:allSelected?'gate':binding.participation}));
  return list.map(evaluator=>{
    const key=evExperimentEvaluationKey(evaluator,list),binding=raw.find(item=>item.evaluatorId===evaluator.id+'@'+evaluator.version)||raw.find(item=>item.evaluatorId===key)||raw.find(item=>item.evaluatorId===evaluator.id);
    return {evaluatorId:key,target:binding?.target||'first_response',participation:allSelected?'gate':binding?.participation||'gate'};
  });
}

function evExperimentClone(value) { return JSON.parse(JSON.stringify(value)); }
function evExperimentFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(evExperimentFreeze);
    Object.freeze(value);
  }
  return value;
}
// Legacy display timestamps represent Shanghai local time.
function evExperimentTimestamp(value) {
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(!value||typeof value!=='string')return null;
  const normalized=/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00+08:00':/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(?:\.\d{1,3})?)?$/.test(value)?value.replace(' ','T')+'+08:00':value;
  const parsed=Date.parse(normalized);return Number.isFinite(parsed)?parsed:null;
}
function evExperimentPrepareResultTimes(run) {
  let cursor=run.startedAtMs;
  for(const result of run.results||[]) {
    if(!['通过','未通过','运行失败','仅观察'].includes(result.status))continue;
    const duration=Math.max(0,Number(result.durationMs)||0);
    if(!Number.isFinite(result.startedAtMs))result.startedAtMs=evExperimentTimestamp(result.startedAt);
    if(!Number.isFinite(result.endedAtMs))result.endedAtMs=evExperimentTimestamp(result.endedAt);
    if(!Number.isFinite(result.startedAtMs)&&Number.isFinite(result.endedAtMs))result.startedAtMs=result.endedAtMs-duration;
    if(!Number.isFinite(result.startedAtMs)&&Number.isFinite(cursor)){result.startedAtMs=cursor;result.timingEstimated=true;}
    if(!Number.isFinite(result.endedAtMs)&&Number.isFinite(result.startedAtMs)){result.endedAtMs=result.startedAtMs+duration;result.timingEstimated=true;}
    if(Number.isFinite(result.startedAtMs)&&!result.startedAt)result.startedAt=evExperimentTime(result.startedAtMs);
    if(Number.isFinite(result.endedAtMs)){if(!result.endedAt)result.endedAt=evExperimentTime(result.endedAtMs);cursor=result.endedAtMs;}
  }
}
// Each run owns its configuration and timing, including legacy in-memory examples.
function evExperimentPrepareRuns(experiment) {
  if (!experiment) return experiment;
  if(!Number.isFinite(experiment.createdAtMs))experiment.createdAtMs=evExperimentTimestamp(experiment.createdAt);
  if (!Number.isInteger(experiment.configurationRevision) || experiment.configurationRevision < 1) experiment.configurationRevision = 1;
  for (const run of evExperimentExecutions(experiment)) {
    if(!run.kind)run.kind=run.parentRunId?'supplement':'full';
    if(run.kind==='full'&&!Array.isArray(run.supplements))run.supplements=[];
    if (!run.snapshot) run.snapshot = evExperimentFreeze(evExperimentClone(experiment.snapshot));
    else evExperimentFreeze(run.snapshot);
    if (!Number.isInteger(run.configurationRevision) || run.configurationRevision < 1) run.configurationRevision = experiment.configurationRevision;
    if (run.experimentName === undefined) run.experimentName = experiment.name;
    if(!Number.isFinite(run.startedAtMs))run.startedAtMs=evExperimentTimestamp(run.startedAt);
    if(!Number.isFinite(run.endedAtMs))run.endedAtMs=evExperimentTimestamp(run.endedAt);
    evExperimentPrepareResultTimes(run);
    if(typeof evExperimentReportSync==='function')evExperimentReportSync(experiment,run);
  }
  return experiment;
}
function evExperimentRunContext(experiment, run) {
  if (!experiment || !run || run.experimentId !== experiment.id) return experiment || null;
  evExperimentPrepareRuns(experiment);
  const snapshot = run.snapshot, suites = snapshot.suites || [snapshot.suite], agent = snapshot.agent;
  return {
    ...experiment, name: run.experimentName, status: run.status,
    agentId: agent.id, agentName: agent.name, version: agent.version,
    suiteId: suites[0]?.id || '', suiteIds: suites.map(suite => suite.id), suiteName: suites.map(suite => suite.name).join('、'),
    evaluatorIds: (snapshot.evaluators || []).map(evaluator => evaluator.id),
    ...(experiment.evaluatorVersions?{evaluatorVersions:Object.fromEntries((snapshot.evaluators||[]).map(evaluator=>[evaluator.id,evaluator.sourceVersion||evaluator.version]))}:{}),
    execution: snapshot.execution || experiment.execution, snapshot,
    configurationRevision: run.configurationRevision, selectedRunId: run.id,
    isHistorical: evExperimentRunIsHistorical(experiment, run)
  };
}
function evExperimentRunIsHistorical(experiment, run) {
  if (!experiment || !run) return false;
  evExperimentPrepareRuns(experiment);
  const record=evExperimentRecordFor(experiment,run)||run;
  return run.configurationRevision !== experiment.configurationRevision || experiment.runs.find(item => item.configurationRevision === experiment.configurationRevision)?.id !== record.id;
}
function evExperimentTime(value = Date.now()) {
  return new Date(value).toLocaleString('sv-SE', {timeZone: 'Asia/Shanghai', hour12: false});
}
function evExperimentAgents(scene) {
  const app = evWorkspace.applications.find(a => a.sceneIds.includes(scene));
  return [...(waCatalog[scene] || []).map(a => ({...a, scene, scope: 'scene'})), ...(app ? [{...app.agent, scene, scope: 'application'}] : [])];
}
function evAgentVersions(agentId) {
  if (!evAgents().some(a => a.id === agentId)) return [];
  const versions = /^(sales|procurement)-agent-1$/.test(agentId) ? ['V3', 'V2', 'V1', 'Draft'] : /^(sales|procurement)-app-agent$/.test(agentId) ? ['V2', 'V1'] : ['Draft'];
  return versions.map(id => ({id, name: id + ' · Mock 快照'}));
}
function evEvaluationModels(){return [
  {id:'mock-eval-balanced',name:'通用评测模型 · Mock',description:'均衡质量与速度的本地演示配置'},
  {id:'mock-eval-fast',name:'快速评测模型 · Mock',description:'快速回归的本地演示配置'},
  {id:'mock-eval-reasoning',name:'推理评测模型 · Mock',description:'复杂规则分析的本地演示配置'}
];}
function evExperimentMcps(scene=studio.scene){return assetMcps.filter(m=>m.agent===scene||m.agent==='shared').map(m=>({...m,id:'mcp-'+m.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}));}
function evExperimentExecution(fields={},scene=studio.scene){
  if(!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('执行配置无效');
  const integer=(key,fallback,max,legacy='')=>{const value=fields[key]===undefined?(legacy&&fields[legacy]!==undefined?fields[legacy]:fallback):fields[key];if(!['number','string'].includes(typeof value)||String(value).trim()===''||!Number.isInteger(Number(value))||Number(value)<1||Number(value)>max)throw Error({concurrency:'执行并发数',caseRuns:'每个用例执行次数',fullRuns:'全量评测次数',maxTurns:'最大模拟轮次'}[key]+'须为 1～'+max+' 的正整数');return Number(value);};
  const modelId=fields.modelId===undefined?'mock-eval-balanced':fields.modelId;
  if(!evEvaluationModels().some(m=>m.id===modelId))throw Error('请选择可用的 Mock 评测模型');
  const ids=fields.mcpIds===undefined?[]:fields.mcpIds;if(!Array.isArray(ids)||ids.some(id=>!evExperimentMcps(scene).some(m=>m.id===id)))throw Error('MCP 不存在或不属于当前场景及共享范围');
  const mode=fields.mode??'single_turn';if(!['single_turn','scenario_simulation'].includes(mode))throw Error('执行方式须为单轮执行或多轮执行');
  if(fields.scenarioPrompt!==undefined&&typeof fields.scenarioPrompt!=='string')throw Error('场景提示词须为文本');
  const scenarioPrompt=(fields.scenarioPrompt||'').trim();if(mode==='scenario_simulation'&&!scenarioPrompt)throw Error('请填写多轮执行提示词');
  if(scenarioPrompt.length>20000)throw Error('场景提示词最多 20000 个字符');
  if(fields.evaluationPolicy!==undefined&&fields.evaluationPolicy!=='all_selected')throw Error('评估通过规则无效');
  const execution={...(fields.evaluationPolicy?{evaluationPolicy:fields.evaluationPolicy}:{}),concurrency:integer('concurrency',4,6),caseRuns:integer('caseRuns',1,5,'times'),fullRuns:integer('fullRuns',1,5,'rounds'),modelId,mcpIds:[...new Set(ids)],mode,scenarioPrompt,maxTurns:integer('maxTurns',5,20)};
  execution.evaluationBindings=evExperimentEvaluationBindings({...execution,evaluationBindings:fields.evaluationBindings});return execution;
}
function evExperimentSnapshot(data, agent, version, suite, evaluators = evEvaluatorSnapshot(evEvaluatorDefaultIds(data.scene), data.scene), execution=evExperimentExecution({},data.scene)) {
  const suites=Array.isArray(suite)?suite:[suite];
  if(!suites.length)throw Error('请至少选择一个评测集');
  for(const s of suites){if(s.agentId!==agent.id)throw Error('所有评测集必须属于所选 Agent');if(!(s.taskIds||[]).length||s.taskIds.some(id=>!data.tasks.some(t=>t.id===id&&t.agentId===agent.id)))throw Error('评测集的业务任务缺失或不属于所选 Agent');if(!s.caseIds.some(id=>data.cases.some(c=>c.id===id&&!c.archived&&c.enabled!==false)))throw Error('每个评测集至少需要一条已启用且未归档的评测用例');}
  const taskIds = [...new Set(suites.flatMap(s=>s.taskIds || []))], caseIds = [...new Set(suites.flatMap(s=>s.caseIds || []))];
  const tasks = taskIds.map(id => suites.flatMap(s=>s.taskSnapshots||[]).find(t=>t.id===id)||data.tasks.find(t => t.id === id));
  const cases = caseIds.map(id => data.cases.find(c => c.id === id)).filter(c => c && !c.archived);
  if (!tasks.length || tasks.some(t => !t)) throw new Error('评测集的业务任务已缺失，请先修复关联');
  if (tasks.some(t => t.agentId !== agent.id)) throw new Error('评测集及其业务任务必须属于所选 Agent');
  if (!cases.some(c => c.enabled !== false)) throw new Error('评测集至少需要一条已启用且未归档的评测用例');
  if (!Array.isArray(evaluators) || !evaluators.length) throw new Error('请至少选择一个离线评估器');
  execution={...evExperimentExecution(execution,data.scene),evaluationBindings:evExperimentEvaluationBindings(execution,evaluators)};
  if(cases.length*evExperimentCaseRuns(execution)*evExperimentFullRuns(execution)>300)throw Error('一次启动最多安排 300 次独立用例执行，请减少用例、全量评测次数或每个用例执行次数');
  return evExperimentFreeze(evExperimentClone({
    agent: {id: agent.id, name: agent.name, version},
    suite: evVersionExperimentSnapshot(suites[0]), suites:suites.map(evVersionExperimentSnapshot),
    tasks:tasks.map(evVersionExperimentSnapshot), cases: cases.map(c => ({...evVersionExperimentSnapshot(c), enabled: c.enabled !== false,taskBindings:suites.filter(s=>s.caseIds.includes(c.id)).flatMap(s=>evCaseBindings(s,c.id)),suiteIds:suites.filter(s=>s.caseIds.includes(c.id)).map(s=>s.id)})), evaluators,
    execution,model:evEvaluationModels().find(m=>m.id===execution.modelId),mcps:evExperimentMcps(data.scene).filter(m=>execution.mcpIds.includes(m.id))
  }));
}
function evExperimentResultRows(experiment,runId=experiment.id) {
  const execution=experiment.snapshot.execution||evExperimentExecution(),rows=[];
  for(const c of experiment.snapshot.cases)for(let attempt=1;attempt<=evExperimentCaseRuns(execution);attempt++){
   const id=runId+'-'+c.id+'-A'+attempt,conversationId=id+'-CONVERSATION';rows.push({
    id,attempt,conversationId,contextPolicy:'isolated',suiteIds:[...(c.suiteIds||[experiment.suiteId])],
    caseId: c.id, name: c.name, version: c.version, input: c.input, expected: c.expected,
    tags: [...(c.tags || [])], enabled: c.enabled !== false,
    status: c.enabled === false ? '已跳过' : '待运行', actual: '',
    reason: c.enabled === false ? '创建实验时该用例已停用，按实验快照跳过。' : '',
    dimensions: [], evaluations: [], durationMs: 0, tokens: 0,executionMode:execution.mode||'single_turn',actualTurns:0,stopReason:'',firstResponse:'',finalResponse:'',
    messages:[{id:conversationId+'-USER-1',role:'user',content:String(c.input||''),expected:String(c.expected||'')}]
  });}return rows;
}
function evExperimentSummary(run) {
  const rows = run?.results || [], count = status => rows.filter(r => r.status === status).length;
  const passed = count('通过'), failed = count('未通过'), errors = count('运行失败'), skipped = count('已跳过'), observed=count('仅观察');
  const configured=run?.snapshot?.execution?.evaluationBindings,onlyObserve=Array.isArray(configured)&&configured.length>0&&configured.every(binding=>binding.participation==='observe');
  const judged = passed + failed + (onlyObserve?0:errors), executed = passed + failed + errors + observed;
  const durationMs = rows.reduce((n, r) => n + (Number(r.durationMs) || 0), 0);
  return {
    total: rows.length, finished: executed + skipped, passed, failed, errors, skipped,observed,
    pending: count('待运行'), running: count('运行中'), executed,
    passRate: judged ? passed / judged * 100 : null,
    avgDurationMs: executed ? durationMs / executed : 0,
    durationMs, tokens: rows.reduce((n, r) => n + (Number(r.tokens) || 0), 0)
  };
}
// Keep the displayed statistics stable while the requested full-run group is
// still running; progress and per-row evidence continue to update normally.
function evExperimentMetricContext(experiment){
  return experiment&&evExperimentActiveExecution(experiment)?evExperimentMetricContexts.get(experiment.id)||experiment:experiment;
}
function evExperimentMetricsPending(experiment,run){
  if(!run)return false;
  if(['排队中','运行中','已暂停'].includes(run.status))return true;
  return run.kind==='full'&&!!run.executionGroupId&&(experiment?.runs||[]).some(record=>record.executionGroupId===run.executionGroupId&&['排队中','运行中','已暂停'].includes(record.status));
}
function evExperimentMetricResults(experiment,run){
  if(!run)return [];
  if(!evExperimentMetricsPending(experiment,run))return run.results||[];
  if(!evExperimentMetricSnapshots.has(run.id))evExperimentMetricSnapshots.set(run.id,evExperimentClone(run.results||[]));
  return evExperimentMetricSnapshots.get(run.id);
}
function evExperimentOutcome(experiment, run, index) {
  // Preset output completeness and runtime errors are independent of evaluator thresholds.
  const code = (index + run.sequence - 1 + (Number(run.supplementSequence??run.retryRevision) || 0)) % 5;
  return code === 2 ? '未通过' : code === 3 ? '运行失败' : '通过';
}
// These spans describe local demo phases only. Their time slices are explicitly
// simulated; no model, tool, or evaluator service is called by this engine.
function evExperimentMockTrace(experiment,result) {
  if(!['通过','未通过','运行失败','仅观察'].includes(result.status))return null;
  if(result.executionMode==='scenario_simulation')return evExperimentScenarioTrace(experiment,result);
  const total=Math.max(0,Math.round(Number(result.durationMs)||0)),failed=result.status==='运行失败',evaluations=failed?[]:result.evaluations||[];
  const inputDuration=Math.floor(total*.08),agentDuration=evaluations.length?Math.floor(total*.67):total-inputDuration,scoringDuration=total-inputDuration-agentDuration;
  const rootId=result.id+'-mock-trace',started=Number.isFinite(result.startedAtMs)?result.startedAtMs:null;
  const make=(suffix,name,type,offset,duration,fields={})=>({id:rootId+'-'+suffix,parentId:rootId,name,type,status:'completed',startOffsetMs:offset,...(started===null?{}:{startedAtMs:started+offset}),durationMs:duration,turn:1,attempt:result.attempt,conversationId:result.conversationId,tokens:0,mock:true,timing:'simulated',...fields});
  const root={...make('root','本地 Mock 评测','agent',0,total),id:rootId,parentId:null,status:failed?'error':'completed',tokens:result.tokens||0,input:result.input,output:{status:result.status,actual:result.actual||null},agent:experiment.agentName};
  const spans=[root,
    make('input','评测输入','user',0,inputDuration,{input:result.input,output:null}),
    make('agent','生成 Mock Agent 输出','agent',inputDuration,agentDuration,{status:failed?'error':'completed',tokens:result.tokens||0,input:result.input,output:result.actual||null,...(failed?{error:result.reason}:{})})
  ];
  let cursor=inputDuration+agentDuration;
  evaluations.forEach((evaluation,index)=>{
    const duration=index===evaluations.length-1?total-cursor:Math.floor(scoringDuration/evaluations.length);
    spans.push(make('evaluation-'+index,'本地评分 · '+evaluation.name,'other',cursor,duration,{evaluatorId:evaluation.evaluatorId,input:{actual:result.actual,expected:result.expected},output:evExperimentClone(evaluation)}));cursor+=duration;
  });
  return {mock:true,notice:'本地 Mock · 模拟轨迹，耗时为演示值；未调用真实模型、工具或评估器服务。',spans};
}
function evExperimentScenarioSections(prompt){
  const sections={};let current='';
  for(const line of String(prompt||'').split(/\r?\n/)){
    const heading=line.match(/^\s*(?:【([^】]+)】|\[([^\]]+)\]|#{1,4}\s*(.+?))\s*[:：]?\s*(.*)$/);
    if(heading){current=(heading[1]||heading[2]||heading[3]||'').trim();sections[current]=heading[4]||'';}
    else {const plain=line.match(/^\s*([^:：]{1,24})[:：]\s*(.*)$/);if(plain){current=plain[1].trim();sections[current]=plain[2];}else if(current)sections[current]=(sections[current]?sections[current]+'\n':'')+line;}
  }
  return sections;
}
function evExperimentPlannedTurns(execution,status,index=0){
  if(execution?.mode!=='scenario_simulation'||status==='运行失败')return 1;
  const limit=Math.max(1,Math.min(20,Number(execution.maxTurns)||5)),prompt=String(execution.scenarioPrompt||'');
  if(/不提前结束|持续追问|直到(?:轮次)?上限/.test(prompt))return limit;
  if(/首轮(?:即|就)?结束|无需追问/.test(prompt)&&status==='通过')return 1;
  return status==='通过'||index%2===0?Math.min(limit,3):limit;
}
function evExperimentSimulatedUser(prompt,messages,turn){
  // This is a local demonstration policy, not an LLM. It receives the user
  // contract and visible transcript only; the case reference is never read.
  const sections=evExperimentScenarioSections(prompt),facts=Object.entries(sections).find(([key])=>/已知事实|已知信息|上下文/.test(key))?.[1]?.trim()||'';
  const prior=[...messages].reverse().find(message=>message.role==='assistant')?.content||'';
  const urgent=/急躁|着急|不耐烦|简短|直接/.test(prompt),expert=/专业|技术|专家|依据/.test(prompt);
  if(turn===2&&facts&&!/^(?:请填写|填写|\[|<|待补充)/.test(facts))return '【Mock 模拟用户】关于你刚才的'+(/提供|确认|是否|[？?]/.test(prior)?'追问':'答复')+'，我能提供的已知信息是：'+facts.replace(/\s+/g,' ').slice(0,240)+'。';
  const responses=urgent?['请直接说明刚才问题的处理结果；没有提供的信息我不知道。','还有哪些事项需要我确认？请简短说明。']:expert?['请解释刚才结论的依据，以及需要我确认的业务约束。','请核对前后信息是否一致，并明确尚未验证的部分。']:['请继续说明刚才的处理结果，需要补充的信息请明确问我。','请核对我的原始诉求，说明目前已完成和尚未完成的事项。'];
  const hash=[...String(prompt||'')].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,0);
  return '【Mock 模拟用户】'+responses[(turn+hash)%responses.length];
}
function evExperimentCompleteConversation(result,execution={}){
  const conversationId=result.conversationId||(result.conversationId=result.id+'-CONVERSATION');
  if(result.conversationPrepared&&result.messages?.[0]?.id===conversationId+'-USER-1')return;
  result.contextPolicy='isolated';
  result.executionMode=execution.mode||result.executionMode||'single_turn';
  result.messages=[{id:conversationId+'-USER-1',role:'user',content:String(result.input||''),expected:String(result.expected||''),timestamp:result.startedAt}];
  result.firstResponse=String(result.actual||'');result.finalResponse=result.firstResponse;result.actualTurns=result.actual?1:0;
  result.stopReason=result.status==='运行失败'?'execution_error':'single_turn_completed';
  if(result.actual)result.messages.push({id:conversationId+'-AGENT-1',role:'assistant',content:result.firstResponse,expected:String(result.expected||''),timestamp:result.endedAt,durationMs:result.durationMs,tokens:result.tokens});
  if(result.executionMode==='scenario_simulation'&&result.actual){
    const prompt=String(execution.scenarioPrompt||''),turns=evExperimentPlannedTurns(execution,result.mockAgentPassed?'通过':'未通过',result.mockResultIndex||0);
    const complete=result.mockAgentPassed||turns>=3&&(result.mockResultIndex||0)%2===0;
    for(let turn=2;turn<=turns;turn++){
      result.messages.push({id:conversationId+'-USER-'+turn,role:'user',content:evExperimentSimulatedUser(prompt,result.messages,turn),expected:'',simulated:true,turn});
      const last=turn===turns,content=last&&complete?'【Mock Agent 输出】\n已结合本段对话中用户补充的信息核对原始诉求，并组织示例处理结果；业务动作与数据仍需以真实系统回执验证。':last?'【Mock Agent 输出】\n已记录用户追问，部分条件仍待核实，尚不能确认原始诉求已完成。':'【Mock Agent 输出】\n我会基于你刚才补充的信息继续核对；尚未提供的业务事实保持未知，不据此编造结果。';
      result.messages.push({id:conversationId+'-AGENT-'+turn,role:'assistant',content,expected:'',turn});
    }
    result.actualTurns=turns;result.finalResponse=result.messages.at(-1).content;result.mockConversationOutcome=complete?'complete':'incomplete';
    const limit=Math.max(1,Number(execution.maxTurns)||5),forced=/不提前结束|持续追问|直到(?:轮次)?上限/.test(prompt);
    result.stopReason=!forced&&complete&&(turns<limit||/首轮(?:即|就)?结束|无需追问/.test(prompt))?'goal_reached':'max_turns';
    const perTurn=Math.floor(result.durationMs/turns),perTokens=Math.floor(result.tokens/turns);
    for(const message of result.messages){const turn=Number(message.turn)||1;message.turn=turn;message.timestamp=evExperimentTime((result.startedAtMs||0)+Math.min(result.durationMs,turn*perTurn));if(message.role==='assistant'){message.durationMs=turn===turns?result.durationMs-perTurn*(turns-1):perTurn;message.tokens=turn===turns?result.tokens-perTokens*(turns-1):perTokens;}}
  }
  result.conversationPrepared=true;
}
function evExperimentScenarioTrace(experiment,result){
  const failed=result.status==='运行失败',evaluations=failed?[]:result.evaluations||[],total=Math.max(0,Number(result.durationMs)||0),rootId=result.id+'-mock-trace',started=result.startedAtMs;
  const make=(id,name,type,offset,duration,fields={})=>({id:rootId+'-'+id,parentId:rootId,name,type,status:'completed',startOffsetMs:offset,...(Number.isFinite(started)?{startedAtMs:started+offset}:{}),durationMs:duration,turn:1,attempt:result.attempt,conversationId:result.conversationId,tokens:0,mock:true,timing:'simulated',...fields});
  const root={...make('root','本地 Mock 多轮执行','agent',0,total),id:rootId,parentId:null,status:failed?'error':'completed',tokens:result.tokens||0,input:result.input,output:{status:result.status,actualTurns:result.actualTurns,stopReason:result.stopReason},agent:experiment.agentName};
  const spans=[root],conversationDuration=evaluations.length?Math.floor(total*.8):total,turns=Math.max(1,result.actualTurns||1),slice=conversationDuration/turns;
  for(let turn=1;turn<=turns;turn++){
    const user=result.messages?.find(message=>message.role==='user'&&(message.turn||1)===turn),assistant=result.messages?.find(message=>message.role==='assistant'&&(message.turn||1)===turn),offset=Math.floor((turn-1)*slice),userTime=Math.floor(slice*.2),agentTime=Math.floor(turn*slice)-offset-userTime;
    spans.push(make('user-'+turn,turn===1?'评测初始输入':'生成 Mock 模拟用户回复',turn===1?'user':'llm',offset,userTime,{turn,input:turn===1?result.input:{previousReply:result.messages?.find(message=>message.role==='assistant'&&(message.turn||1)===turn-1)?.content||''},output:user?.content||'',simulated:turn>1}));
    spans.push(make('agent-'+turn,'第 '+turn+' 轮 Mock Agent 回复','agent',offset+userTime,agentTime,{turn,status:failed?'error':'completed',input:user?.content||'',output:assistant?.content||null,tokens:assistant?.tokens||0,...(failed?{error:result.reason}:{})}));
  }
  let cursor=conversationDuration;
  evaluations.forEach((evaluation,index)=>{const duration=index===evaluations.length-1?total-cursor:Math.floor((total-conversationDuration)/evaluations.length);spans.push(make('evaluation-'+index,'本地评分 · '+evaluation.name,'other',cursor,duration,{turn:evaluation.target==='first_response'?1:turns,evaluatorId:evaluation.evaluatorId,input:{target:evaluation.target,messages:evExperimentClone(evaluation.inputMessages||[]),...(evaluation.target==='first_response'?{expected:result.expected}:{})},output:evExperimentClone(evaluation)}));cursor+=duration;});
  return {mock:true,notice:'本地 Mock · 按场景配置生成的演示对话与逐轮轨迹，未调用真实模拟用户模型、Agent、工具或评估器服务。',spans};
}
function evExperimentCompleteResult(experiment, run, index, status, completedAtMs=Date.now()) {
  experiment = evExperimentRunContext(experiment, run);
  const result = run.results[index], c = experiment.snapshot.cases.find(c=>c.id===result.caseId);
  if(experiment.snapshot.execution?.evaluationPolicy)result.evaluationPolicy=experiment.snapshot.execution.evaluationPolicy;
  if (!result.enabled) return;
  const execution=experiment.snapshot.execution||{},plannedTurns=evExperimentPlannedTurns(execution,status,index);
  result.conversationPrepared=false;result.executionMode=execution.mode||'single_turn';result.mockAgentPassed=status==='通过';result.mockResultIndex=index;
  result.status = status;
  result.durationMs = run.mockCaseDurationMs || (400 + index % 4 * 40)*plannedTurns;
  if(!Number.isFinite(result.startedAtMs))result.startedAtMs=completedAtMs-result.durationMs;
  result.endedAtMs=Math.max(completedAtMs,result.startedAtMs);
  result.startedAt=evExperimentTime(result.startedAtMs);result.endedAt=evExperimentTime(result.endedAtMs);
  result.tokens = status === '运行失败' ? 0 : (420 + Math.ceil((String(c.input || '').length + String(c.expected || '').length) / 2) + index * 37)*plannedTurns;
  if (status === '运行失败') {
    result.actual = '';
    result.reason = experiment.scene === 'sales' ? 'Mock 运行失败：库存查询工具超时，未取得完整数据；未生成业务结果。' : 'Mock 运行失败：供应商查询工具超时，未取得完整数据；未生成业务结果。';
    result.dimensions = [];
    result.evaluations = [];
    evExperimentCompleteConversation(result,execution);
    result.trace=evExperimentMockTrace(experiment,result);
    return;
  }
  const passed = status === '通过';
  result.actual = passed ? '【Mock Agent 输出】\n' + (c.expected || '已按本用例的任务定义组织示例结果。') : '【Mock Agent 输出】\n已完成部分信息核对，尚未输出完整的' + (experiment.scene === 'sales' ? '分货明细、需求缺口及规则依据。' : '寻源方案、交付缺口及准入依据。');
  evExperimentCompleteConversation(result,execution);
  const taskIds=new Set((experiment.snapshot.suites||[experiment.snapshot.suite]).filter(s=>result.suiteIds.includes(s.id)).flatMap(s=>s.taskIds||experiment.snapshot.tasks.map(t=>t.id)));
  result.dimensions = experiment.snapshot.tasks.filter(t=>taskIds.has(t.id)).flatMap(t => (t.dimensions || []).filter(d=>!c.taskBindings||c.taskBindings.some(b=>b.taskId===t.id&&b.dimensionNames.includes(d.name))).map(d => {
    const values = Array.isArray(d.values) ? d.values : [];
    return {
      taskId: t.id, taskName: t.name, name: d.name || '未命名维度', description: d.description || '',
      value: values.length ? String(values[passed ? values.length - 1 : 0]) : passed ? '符合' : '不符合',
      passed, reason: passed ? 'Mock 判定：该维度的预期要求已覆盖。' : 'Mock 判定：关键结果缺失，尚未满足该维度要求。'
    };
  }));
  const evaluationBindings=evExperimentEvaluationBindings(execution,experiment.snapshot.evaluators);
  result.evaluations = experiment.snapshot.evaluators.map((evaluator, evaluatorIndex) => {
    const binding=evaluationBindings[evaluatorIndex],targetPassed=binding.target==='conversation'?result.mockConversationOutcome==='complete':passed;
    const inputMessages=(binding.target==='conversation'?result.messages:result.messages.slice(0,2)).map(message=>({id:message.id,role:message.role,content:message.content,turn:message.turn||1})),scope=binding.target==='conversation'?'整段会话':'首轮回复';
    const criteria = evaluator.criteria.map((criterion, criterionIndex) => ({
      name: criterion.name, description: criterion.description || '', weight: Number(criterion.weight),passScore:Number(criterion.passScore??evaluator.passScore??80),
      score: targetPassed ? 88 + (index * 3 + evaluatorIndex * 2 + criterionIndex * 5) % 10 : 30 + (index * 7 + evaluatorIndex * 3 + criterionIndex * 11) % 25,
      reason: 'Mock 本地模拟：依据'+scope+'的预设'+(targetPassed?'完整':'不完整')+'证据生成分数，未调用真实评估器服务。'
    }));
    criteria.forEach(criterion=>criterion.passed=criterion.score>=criterion.passScore);
    const score = Math.round(criteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0) * 10) / 10;
    const passScore = Math.round(criteria.reduce((sum,c)=>sum+c.weight*c.passScore,0)*10)/10, evaluatorPassed = criteria.every(c=>c.passed);
    return {
      evaluatorId: evaluator.id, name: evaluator.name, version: evaluator.version,
      target:binding.target,participation:binding.participation,inputMessages,evidenceMessageIds:inputMessages.filter(message=>message.role==='assistant').map(message=>message.id),...(binding.target==='first_response'?{referenceExpected:String(c.expected||'')}:{referenceExpected:null}),
      score, passScore, passed: evaluatorPassed,
      reason: 'Mock 本地模拟评分：加权汇总分为 ' + score.toFixed(1) + ' 分；'+criteria.filter(c=>c.passed).length+'/'+criteria.length+' 个评分项达到各自通过分数。'+(evaluatorPassed?'全部评分项达标。':'存在未达标评分项。'), criteria
    };
  });
  const allSelected=execution.evaluationPolicy==='all_selected',gates=allSelected?result.evaluations:result.evaluations.filter(evaluation=>evaluation.participation!=='observe'),allPassed=gates.every(evaluation => evaluation.passed);
  result.status = gates.length?(allPassed?'通过':'未通过'):'仅观察';
  result.reason = allSelected?'Mock 本地模拟：'+gates.filter(evaluation=>evaluation.passed).length+'/'+gates.length+' 个所选评估器通过。全部所选评估器通过，用例才通过。未执行真实评估器服务。':'Mock 本地模拟：' + gates.filter(evaluation => evaluation.passed).length + '/' + gates.length + ' 个参与通过判定的评估器达到阈值；' + (!gates.length?'本次仅观察，不生成质量通过结论。':allPassed?'参与判定项全部达标，本用例通过。':'存在未达标判定项，本用例未通过。') + '仅观察项不影响通过判定。未执行真实评估器服务。';
  result.trace=evExperimentMockTrace(experiment,result);
}
function evExperimentSeedRun(experiment, number, outcomes, started) {
  const run = {
    id: experiment.id + '-RUN-' + String(number).padStart(3, '0'), experimentId: experiment.id,
    kind:'full',parentRunId:null,supplements:[],
    experimentName: experiment.name, configurationRevision: experiment.configurationRevision || 1,
    snapshot: evExperimentFreeze(evExperimentClone(experiment.snapshot)),
    sequence: number, status: '已完成', startedAt: evExperimentTime(started), startedAtMs:started, endedAt: '', endedAtMs:null,
    elapsedMs: 0, results: evExperimentResultRows(experiment,experiment.id + '-RUN-' + String(number).padStart(3, '0')), mock: true
  };
  let cursor=started;
  run.results.forEach((r, i) => {if(r.enabled){r.startedAtMs=cursor;cursor+=400+i%4*40;evExperimentCompleteResult(experiment,run,i,outcomes[i]||'通过',cursor);}});
  run.elapsedMs = evExperimentSummary(run).durationMs;
  run.status=run.results.some(r=>['未通过','运行失败'].includes(r.status))?'部分失败':'已完成';
  run.endedAtMs=started+run.elapsedMs;run.endedAt = evExperimentTime(run.endedAtMs);
  if(typeof evExperimentReportSync==='function')evExperimentReportSync(experiment,run);
  return run;
}
function evExperimentStore(scene = studio.scene) {
  if (!['sales', 'procurement'].includes(scene)) throw new Error('不支持的评测场景');
  if (evExperimentStores[scene]) {
    evExperimentStores[scene].experiments.forEach(evExperimentPrepareRuns);
    return evExperimentStores[scene];
  }
  // Historical Mock examples remain available even if live assets were edited.
  const data = evSeedScene(scene), agents = evExperimentAgents(scene), prefix = data.prefix;
  const seedEvaluators = evSeedEvaluators(scene).filter(evaluator => evaluator.enabled);
  const store = {scene, sequence: 3, experiments: []}, now = Date.now();
  const specifications = [
    {suite: data.suites[0], version: 'V3', name: scene === 'sales' ? '渠道分货核心能力验收' : '采购寻源核心能力验收'},
    {suite: data.suites[2], version: 'V2', name: scene === 'sales' ? '销售应用风险复核' : '采购应用供应风险复核'},
    {suite: data.suites[1], version: 'Draft', name: scene === 'sales' ? '库存边界回归实验' : '报价与规则回归实验'}
  ];
  specifications.forEach((spec, i) => {
    const agent = agents.find(a => a.id === spec.suite.agentId) || {id: spec.suite.agentId, name: scene === 'sales' ? '销售智能分货助手' : '采购协同助手'};
    const evaluators = seedEvaluators.slice(0, i === 1 ? 2 : 1),suites=i===2?[spec.suite,data.suites[0]]:[spec.suite],execution=evExperimentExecution(i===2?{concurrency:3,caseRuns:2,fullRuns:2,modelId:'mock-eval-fast',mcpIds:evExperimentMcps(scene).slice(0,2).map(m=>m.id)}:{},scene);
    const experiment = {
      id: prefix + '-EXP-' + String(i + 1).padStart(3, '0'), name: spec.name, scene,
      agentId: agent.id, agentName: agent.name, version: spec.version,
      suiteId: spec.suite.id, suiteName: suites.map(s=>s.name).join('、'), status: i < 2 ? '已完成' : '未运行',
      createdAt: evExperimentTime(now - (i + 1) * 3600000), createdAtMs:now-(i+1)*3600000,
      evaluatorIds: evaluators.map(evaluator => evaluator.id),suiteIds:suites.map(s=>s.id),execution,
      snapshot: evExperimentSnapshot(data, agent, spec.version, suites, evaluators,execution), runs: [], sequence: 0, configurationRevision: 1, mock: true
    };
    if (i === 0) {
      experiment.runs = [
        evExperimentSeedRun(experiment, 2, ['通过', '通过', '未通过', '运行失败', '通过'], now - 1800000),
        evExperimentSeedRun(experiment, 1, ['通过', '未通过', '未通过', '运行失败', '通过'], now - 2700000)
      ];
      experiment.sequence = 2;
    } else if (i === 1) {
      experiment.runs = [evExperimentSeedRun(experiment, 1, ['通过', '未通过', '已跳过', '已跳过'], now - 3600000)];
      experiment.sequence = 1;
    }
    if(experiment.runs.length)experiment.status=experiment.runs[0].status;
    store.experiments.push(experiment);
  });
  evExperimentStores[scene] = store;
  return store;
}
function evExperimentGet(id) {
  for (const store of Object.values(evExperimentStores)) {
    const found = store.experiments.find(e => e.id === id);
    if (found) return evExperimentPrepareRuns(found);
  }
  return evExperimentStore().experiments.find(e => e.id === id) || null;
}
function evExperimentRunGet(experiment, runId = '') {
  if (!experiment) return null;
  evExperimentPrepareRuns(experiment);
  return (runId?evExperimentExecutionGet(experiment,runId):experiment.runs.find(run=>run.configurationRevision===experiment.configurationRevision))||null;
}
function evValidateExperimentDraft(fields = {}) {
  if (!fields || typeof fields !== 'object') throw new Error('评测实验配置无效');
  let {name, agentId, version, suiteId, suiteIds, evaluatorIds} = fields;
  const data = evData(), agent = evAgents().find(a => a.id === agentId);
  name = String(name || '').trim();
  if (!name) throw new Error('请输入评测实验名称');
  if (!agent) throw new Error('请选择当前场景或所属应用的 Agent');
  if (!evAgentVersions(agentId).some(v => v.id === version)) throw new Error('请选择该 Agent 的有效 Mock 版本');
  if(suiteIds===undefined)suiteIds=suiteId?[suiteId]:[];
  if(!Array.isArray(suiteIds)||!suiteIds.length)throw Error('请至少选择一个当前场景的评测集');
  suiteIds=[...new Set(suiteIds)];const suites=suiteIds.map(id=>data.suites.find(s=>s.id===id));
  if(suites.some(s=>!s))throw Error('评测集不存在或不属于当前场景');
  const evaluators = evEvaluatorSnapshot(evaluatorIds === undefined ? evEvaluatorDefaultIds(data.scene) : evaluatorIds, data.scene,fields.evaluatorVersions);
  const evaluatorVersions=fields.evaluatorVersions===undefined?undefined:Object.fromEntries(evaluators.map(evaluator=>[evaluator.id,evaluator.sourceVersion||evaluator.version]));
  const execution=evExperimentExecution(fields.execution===undefined?{}:fields.execution,data.scene);
  execution.evaluationBindings=evExperimentEvaluationBindings(execution,evaluators);
  evExperimentSnapshot(data, agent, version, suites, evaluators,execution);
  return {name, agentId: agent.id, version, suiteId: suiteIds[0],suiteIds, evaluatorIds: evaluators.map(evaluator => evaluator.id),...(evaluatorVersions?{evaluatorVersions}:{}),execution};
}
function evCreateExperiment(fields) {
  const {name, agentId, version, suiteId,suiteIds, evaluatorIds,evaluatorVersions,execution} = evValidateExperimentDraft(fields);
  // Resolve live resources again at confirmation; draft validation never reserves
  // an ID or initializes an experiment store.
  const data = evData(), agent = evAgents().find(a => a.id === agentId), suites = suiteIds.map(id=>data.suites.find(s=>s.id===id));
  const evaluators = evEvaluatorSnapshot(evaluatorIds, data.scene,evaluatorVersions);
  const snapshot = evExperimentSnapshot(data, agent, version, suites, evaluators,execution);
  const store = evExperimentStore(),createdAtMs=Date.now();
  const experiment = {
    id: data.prefix + '-EXP-' + String(++store.sequence).padStart(3, '0'), name, scene: data.scene,
    agentId, agentName: agent.name, version, suiteId,suiteIds:[...suiteIds],suiteName:suites.map(s=>s.name).join('、'),execution:evExperimentClone(execution),evaluatorIds: snapshot.evaluators.map(evaluator => evaluator.id),...(evaluatorVersions?{evaluatorVersions:evExperimentClone(evaluatorVersions)}:{}),
    status: '未运行', createdAt: evExperimentTime(createdAtMs), createdAtMs, snapshot, runs: [], sequence: 0, configurationRevision: 1, mock: true
  };
  store.experiments.unshift(experiment);
  return experiment;
}
function evExperimentConfigurationKey(fields) {
  const execution = fields.execution || {};
  return JSON.stringify({
    agentId: fields.agentId, version: fields.version,
    suiteIds: [...(fields.suiteIds || [fields.suiteId])].sort(), evaluatorIds: [...(fields.evaluatorIds || [])].sort(),
    ...(fields.evaluatorVersions?{evaluatorVersions:Object.fromEntries(Object.entries(fields.evaluatorVersions).sort(([a],[b])=>a.localeCompare(b)))}:{}),
    execution: {...(execution.evaluationPolicy?{evaluationPolicy:execution.evaluationPolicy}:{}),concurrency: execution.concurrency, caseRuns: evExperimentCaseRuns(execution), fullRuns: evExperimentFullRuns(execution), modelId: execution.modelId, mcpIds: [...(execution.mcpIds || [])].sort(),mode:execution.mode||'single_turn',scenarioPrompt:execution.scenarioPrompt||'',maxTurns:execution.maxTurns??5,evaluationBindings:(execution.evaluationBindings?.length?evExperimentEvaluationBindings(execution):(fields.evaluatorIds||[]).map(id=>({evaluatorId:id,target:'first_response',participation:'gate'}))).sort((a,b)=>a.evaluatorId.localeCompare(b.evaluatorId))}
  });
}
function evUpdateExperiment(id, fields) {
  // Looking up an edit must not seed a new store or reserve an identifier.
  const experiment = Object.values(evExperimentStores).flatMap(store => store.experiments).find(item => item.id === id);
  if (!experiment || experiment.scene !== studio.scene) throw new Error('评测实验不存在或不属于当前场景');
  if (evExperimentActiveExecution(experiment)) throw new Error('实验正在运行，请先停止或等待运行结束后再编辑');
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('评测实验配置无效');
  if (fields.execution !== undefined && (!fields.execution || typeof fields.execution !== 'object' || Array.isArray(fields.execution))) throw new Error('执行配置无效');
  const merged = {
    name: experiment.name, agentId: experiment.agentId, version: experiment.version,
    suiteIds: [...(experiment.suiteIds || [experiment.suiteId])], evaluatorIds: [...experiment.evaluatorIds],
    ...(experiment.evaluatorVersions?{evaluatorVersions:evExperimentClone(experiment.evaluatorVersions)}:{}),
    ...fields, execution: fields.execution === undefined ? evExperimentClone(experiment.execution||{}) : {...experiment.execution, ...fields.execution}
  };
  if(fields.execution&&fields.execution.caseRuns===undefined&&fields.execution.times!==undefined)merged.execution.caseRuns=fields.execution.times;
  if(fields.execution&&fields.execution.fullRuns===undefined&&fields.execution.rounds!==undefined)merged.execution.fullRuns=fields.execution.rounds;
  if(Array.isArray(fields.evaluatorIds)&&fields.execution?.evaluationBindings===undefined)merged.execution.evaluationBindings=(merged.execution.evaluationBindings||[]).filter(binding=>fields.evaluatorIds.some(id=>id===binding.evaluatorId||id.split('@')[0]===binding.evaluatorId.split('@')[0]));
  if(Array.isArray(fields.evaluatorIds)&&fields.evaluatorVersions===undefined&&merged.evaluatorVersions)merged.evaluatorVersions=Object.fromEntries(Object.entries(merged.evaluatorVersions).filter(([id])=>fields.evaluatorIds.includes(id)));
  // A legacy singular suiteId is an explicit replacement, not an ignored alias.
  if (Object.prototype.hasOwnProperty.call(fields, 'suiteId') && !Object.prototype.hasOwnProperty.call(fields, 'suiteIds')) merged.suiteIds = fields.suiteId ? [fields.suiteId] : [];
  const valid = evValidateExperimentDraft(merged), changed = evExperimentConfigurationKey(experiment) !== evExperimentConfigurationKey(valid);
  let snapshot;
  if (changed) {
    const data = evData(), agent = evAgents().find(item => item.id === valid.agentId), suites = valid.suiteIds.map(suiteId => data.suites.find(suite => suite.id === suiteId));
    snapshot = evExperimentSnapshot(data, agent, valid.version, suites, evEvaluatorSnapshot(valid.evaluatorIds, data.scene,valid.evaluatorVersions), valid.execution);
  }
  // No mutation occurs until all fields and replacement resources have passed.
  evExperimentPrepareRuns(experiment);
  const renamed = experiment.name !== valid.name;
  experiment.name = valid.name;
  if (changed) {
    Object.assign(experiment, valid, {
      agentName: snapshot.agent.name, suiteIds: [...valid.suiteIds], suiteName: snapshot.suites.map(suite => suite.name).join('、'),
      evaluatorIds: [...valid.evaluatorIds], execution: evExperimentClone(valid.execution), snapshot,
      configurationRevision: experiment.configurationRevision + 1, status: '未运行'
    });
  }
  if (changed || renamed) evExperimentNotify(experiment, null);
  return experiment;
}
function evExperimentNotify(experiment, run) {
  if(run&&run.kind!=='validation'&&typeof evExperimentReportSync==='function')evExperimentReportSync(experiment,run);
  if (run && typeof evExperimentIssuesSync === 'function') evExperimentIssuesSync(experiment, run);
  if (typeof evExperimentRefresh === 'function') evExperimentRefresh(experiment.scene, experiment.id, run?.id || '');
}
function evExperimentNewExecution(experiment,id,sequence,snapshot,fields={}){
  return {id,experimentId:experiment.id,experimentName:experiment.name,configurationRevision:experiment.configurationRevision,
    snapshot:evExperimentFreeze(evExperimentClone(snapshot)),sequence,status:'排队中',createdAt:evExperimentTime(),createdAtMs:Date.now(),
    startedAt:'',startedAtMs:null,endedAt:'',endedAtMs:null,elapsedMs:0,results:[],mock:true,...fields};
}
function evExperimentStartExecution(experiment,execution){
  if(execution.status!=='排队中')return execution;
  if(!evExperimentMetricSnapshots.has(execution.id))evExperimentMetricSnapshots.set(execution.id,evExperimentClone(execution.results||[]));
  execution.mockCaseDurationMs=evExperimentMockBatchMs;
  execution.status='运行中';execution.startedAtMs=Date.now();execution.startedAt=evExperimentTime(execution.startedAtMs);
  if(execution.kind!=='validation')experiment.status='运行中';
  const state={scene:experiment.scene,experimentId:experiment.id,runId:execution.id,timers:new Set()};
  evExperimentTimers.set(execution.id,state);evExperimentNotify(experiment,execution);evExperimentNext(experiment,execution,state);return execution;
}
function evExperimentPrepareRetryExecution(experiment,retrySource,caseId='',options={}){
    if(!retrySource||!retrySource.id)throw Error('问题来源评测记录已不存在，请重新选择问题');
    const source=evExperimentExecutionGet(experiment,retrySource.id),record=evExperimentRecordFor(experiment,source);
    if(source!==retrySource||!record||!['已完成','部分失败',...(options.resultId||options.validationIssueId?['已停止']:[])].includes(source.status))throw Error('请选择本实验已完成的全量评测或补跑记录');
    const sourceCase=caseId?source.snapshot?.cases?.find(item=>item.id===caseId):null;
    if(caseId&&(!sourceCase||sourceCase.enabled===false))throw Error('所选用例不在来源快照中或已停用，不能补跑');
    const rows=(source.results||[]).filter(result=>(!options.resultId||result.id===options.resultId)&&(caseId?result.caseId===caseId&&['通过','未通过','运行失败','仅观察'].includes(result.status):['未通过','运行失败'].includes(result.status)));
    if(!rows.length)throw Error(caseId?'所选用例没有已执行结果可补跑':'来源记录没有失败用例可补跑');
    const validation=!!options.validationIssueId,number=validation?(options.validationSequence||(experiment.validationRuns||[]).length+1):(record.supplements||[]).length+1,executionId=validation?experiment.id+'-VALIDATION-'+String(number).padStart(3,'0'):record.id+'-SUP-'+String(number).padStart(3,'0');
    const supplement=evExperimentNewExecution(experiment,executionId,validation?number:record.sequence,source.snapshot,{kind:validation?'validation':'supplement',...(validation?{validationIssueId:options.validationIssueId,sourceRecordId:record.id,validationSequence:number}:{parentRunId:record.id}),
      sourceRunId:source.id,...(validation?{}:{retryOf:source.id,supplementKind:caseId?'case':'failed',supplementSequence:number}),
      experimentName:source.experimentName,configurationRevision:source.configurationRevision,...(caseId?{retryCaseId:caseId}:{})});
    supplement.results=rows.map((result,index)=>{
      const freshId=executionId+'-'+result.caseId+'-A'+(Number(result.attempt??result.iteration)||index+1),conversationId=freshId+'-CONVERSATION';
      const fresh={...evExperimentClone(result),id:freshId,sourceResultId:result.id,attempt:Number(result.attempt??result.iteration)||index+1,
        conversationId,contextPolicy:'isolated',...(validation?{isValidation:true}:{}),status:'待运行',actual:'',reason:'',dimensions:[],evaluations:[],durationMs:0,tokens:0,
        startedAt:'',endedAt:'',startedAtMs:null,endedAtMs:null,
        messages:[{id:conversationId+'-USER-1',role:'user',content:String(result.input||''),expected:String(result.expected||'')}]};
      for(const key of ['round','iteration','timingEstimated','conversation','turns','trace','conversationPrepared','firstResponse','finalResponse','actualTurns','stopReason','mockAgentPassed','mockResultIndex','mockConversationOutcome'])delete fresh[key];
      return fresh;
    });
    return supplement;
}
function evRunExperiment(id,retrySource=null,caseId='',options={}){
  const experiment=Object.values(evExperimentStores).flatMap(store=>store.experiments).find(item=>item.id===id)||evExperimentGet(id);
  if(!experiment||experiment.scene!==studio.scene)throw Error('评测实验已不存在或不属于当前场景');
  const active=evExperimentActiveExecution(experiment);
  if(active){if(retrySource||caseId||active.kind==='validation')throw Error('请先完成或停止当前评测记录及排队任务，再进行补跑');return active;}
  if(caseId&&!retrySource)throw Error('请选择要补跑的来源评测记录');
  if(retrySource){
    const supplement=evExperimentPrepareRetryExecution(experiment,retrySource,caseId,options),validation=!!options.validationIssueId,record=evExperimentRecordFor(experiment,retrySource);
    evExperimentMetricContexts.set(experiment.id,evExperimentClone(experiment));
    if(validation){if(!Array.isArray(experiment.validationRuns))experiment.validationRuns=[];experiment.validationRuns.push(supplement);}
    else{if(!Array.isArray(record.supplements))record.supplements=[];record.supplements.push(supplement);}
    return evExperimentStartExecution(experiment,supplement);
  }
  const count=evExperimentFullRuns(experiment.snapshot.execution),firstSequence=(Number(experiment.sequence)||0)+1,groupId=experiment.id+'-REQUEST-'+firstSequence,records=[];
  for(let index=0;index<count;index++){
    const sequence=firstSequence+index,id=experiment.id+'-RUN-'+String(sequence).padStart(3,'0');
    const record=evExperimentNewExecution(experiment,id,sequence,experiment.snapshot,{kind:'full',parentRunId:null,supplements:[],executionGroupId:groupId,groupIndex:index+1,groupSize:count});
    record.results=evExperimentResultRows({...experiment,snapshot:record.snapshot},record.id);records.push(record);
  }
  evExperimentMetricContexts.set(experiment.id,evExperimentClone(experiment));
  experiment.sequence=firstSequence+count-1;experiment.runs.unshift(...records.slice().reverse());
  for(const record of records)evExperimentNotify(experiment,record);
  return evExperimentStartExecution(experiment,records[0]);
}
function evExperimentNext(experiment,run,state){
  if(evExperimentTimers.get(run.id)!==state||run.status!=='运行中')return;
  const execution=run.snapshot.execution||evExperimentExecution();
  if(!run.results.some(result=>['待运行','运行中'].includes(result.status))){
    run.status=run.results.some(result=>['未通过','运行失败'].includes(result.status))?'部分失败':'已完成';
    run.endedAtMs=Date.now();run.endedAt=evExperimentTime(run.endedAtMs);run.elapsedMs=evExperimentSummary(run).durationMs;
    evExperimentTimers.delete(run.id);
    const next=run.kind==='full'?(experiment.runs||[]).filter(record=>record.status==='排队中'&&record.executionGroupId===run.executionGroupId).sort((a,b)=>a.sequence-b.sequence)[0]:null;
    if(run.kind!=='validation')experiment.status=next?'运行中':run.kind==='supplement'?(experiment.runs.find(record=>record.configurationRevision===experiment.configurationRevision)?.status||'未运行'):run.status;
    if(!next){evExperimentMetricContexts.delete(experiment.id);evExperimentOperationExecutions(experiment).forEach(item=>evExperimentMetricSnapshots.delete(item.id));}
    evExperimentNotify(experiment,run);
    if(next)evExperimentStartExecution(experiment,next);
    return;
  }
  // One timer owns a complete batch so callbacks never refill a half-finished
  // batch. The configured concurrency remains the cap for independent cases.
  if(run.results.some(result=>result.status==='运行中'))return;
  const batch=[],concurrency=Math.max(1,Number(execution.concurrency)||4),startedAtMs=Date.now();
  for(let index=0;index<run.results.length&&batch.length<concurrency;index++){
    const result=run.results[index];if(result.status!=='待运行')continue;
    result.status='运行中';result.startedAtMs=startedAtMs;result.startedAt=evExperimentTime(startedAtMs);
    if(result.messages?.[0])result.messages[0].timestamp=result.startedAt;
    batch.push(index);
  }
  const timer=setTimeout(()=>{
    if(evExperimentTimers.get(run.id)!==state||run.status!=='运行中')return;
    state.timers.delete(timer);
    const completedAtMs=Date.now();
    batch.forEach(index=>evExperimentCompleteResult(experiment,run,index,evExperimentOutcome(experiment,run,index),completedAtMs));
    run.elapsedMs=evExperimentSummary(run).durationMs;
    evExperimentNext(experiment,run,state);
  },evExperimentMockBatchMs);
  state.timers.add(timer);
  evExperimentNotify(experiment,run);
}
function evStopExperiment(id){
  const experiment=evExperimentGet(id);if(!experiment)return null;
  if(typeof evExperimentIssueValidationBatch==='function'&&evExperimentIssueValidationBatch(experiment))return evExperimentIssueValidationCancel(experiment);
  const active=evExperimentActiveExecution(experiment);if(!active)return null;
  const affected=evExperimentOperationExecutions(experiment).filter(execution=>execution===active||active.kind==='full'&&execution.status==='排队中'&&execution.executionGroupId===active.executionGroupId);
  for(const execution of affected){
    const state=evExperimentTimers.get(execution.id);if(state)state.timers.forEach(timer=>clearTimeout(timer));evExperimentTimers.delete(execution.id);
    execution.results.forEach(result=>{if(['待运行','运行中'].includes(result.status)){
      result.status='已跳过';result.reason='已停止';result.actual='';result.dimensions=[];result.evaluations=[];result.durationMs=0;result.tokens=0;
    }});
    execution.status='已停止';execution.endedAtMs=Date.now();execution.endedAt=evExperimentTime(execution.endedAtMs);execution.elapsedMs=evExperimentSummary(execution).durationMs;
  }
  if(active.kind!=='validation')experiment.status=active.kind==='supplement'?(experiment.runs.find(record=>record.configurationRevision===experiment.configurationRevision)?.status||'未运行'):'已停止';
  evExperimentMetricContexts.delete(experiment.id);
  evExperimentOperationExecutions(experiment).forEach(execution=>evExperimentMetricSnapshots.delete(execution.id));
  affected.forEach(execution=>evExperimentNotify(experiment,execution));return active;
}
function evDeleteExperiment(id) {
  const experiment = evExperimentGet(id);
  if (!experiment) return false;
  evStopExperiment(id);
  evExperimentOperationExecutions(experiment).forEach(run=>evExperimentMetricSnapshots.delete(run.id));
  evExperimentMetricContexts.delete(experiment.id);
  const store = evExperimentStores[experiment.scene];
  store.experiments = store.experiments.filter(e => e.id !== id);
  evExperimentNotify(experiment, null);
  return true;
}

// Pausing affects the current independent record or supplement; queued full runs wait.
function evPauseExperiment(id){
 const experiment=evExperimentGet(id);if(typeof evExperimentIssueValidationBatch==='function'&&evExperimentIssueValidationBatch(experiment))return null;
 const run=evExperimentOperationExecutions(experiment).find(execution=>execution.status==='运行中');if(!run)return null;
 const state=evExperimentTimers.get(run.id);if(state)state.timers.forEach(timer=>clearTimeout(timer));evExperimentTimers.delete(run.id);
 run.results.forEach(result=>{if(result.status==='运行中'){result.status='待运行';result.startedAtMs=null;result.startedAt='';if(result.messages?.[0])delete result.messages[0].timestamp;}});
 run.status='已暂停';if(run.kind!=='validation')experiment.status='已暂停';evExperimentNotify(experiment,run);return run;
}
function evResumeExperiment(id){
 const experiment=evExperimentGet(id),run=evExperimentOperationExecutions(experiment).find(execution=>execution.status==='已暂停');if(!run)return null;
 const state={scene:experiment.scene,experimentId:experiment.id,runId:run.id,timers:new Set()};
 run.status='运行中';if(run.kind!=='validation')experiment.status='运行中';evExperimentTimers.set(run.id,state);evExperimentNext(experiment,run,state);return run;
}
