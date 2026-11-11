/* New AIOps only. Shared workshop resources and legacy evaluator stores stay intact. */
(function (global) {
  'use strict';
  const KEY = 'aiops.unified-evaluation-bridge.v1';
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const text = value => String(value == null ? '' : value);
  const html = value => typeof esc === 'function' ? esc(text(value)) : text(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hash = value => { let n=2166136261; for (const c of text(value)) n=Math.imul(n^c.charCodeAt(0),16777619); return (n>>>0).toString(36); };
  let storage = null, memory = null, transaction = null, formPlan = null, formRuntime = null, formEvaluatorSummary = null, submitting = false, initialized = false;
  const original = {};
  const source = name => original[name];
  function db() {
    if (memory) return memory;
    let saved; try { saved=JSON.parse(storage?.getItem(KEY) || 'null'); } catch (_) {}
    memory=saved && saved.schemaVersion===1 ? saved : {schemaVersion:1,sequence:0,tasks:{},suiteCurrent:{},suiteSnapshots:{},assetSnapshots:{},assessments:[]};
    return memory;
  }
  function save() { try { storage?.setItem(KEY,JSON.stringify(db())); } catch (_) {} }
  function data() { return evData(); }
  function scene() { return studio.scene; }
  function taskScene(task) { return task.scene || task.sceneId || (/^(PUR|procurement)/.test(task.id)?'procurement':/^(SAL|sales)/.test(task.id)?'sales':scene()); }
  function model() { if (!global.AIOpsUnifiedData) throw Error('评估器模块尚未加载'); return global.AIOpsUnifiedData; }
  function runtimeModels(kind) {
    const method=kind==='judge'?'judgeModels':'runtimeModels',provided=typeof model()[method]==='function'?model()[method]():[];
    return (provided.length?provided:['deepseek 4.1 flash','GPT-6.1 Sol','Claude 5.5 Opus'].map(name=>({id:name,name}))).map(item=>typeof item==='string'?{id:item,name:item}:item);
  }
  function defaultJudgeRuntime() { return clone(typeof model().defaultJudgeRuntime==='function'?model().defaultJudgeRuntime():{modelRef:'deepseek 4.1 flash',parameters:{temperature:0,maxOutputTokens:1200}}); }
  function parameters(value) { if(value==null)return {};if(typeof value!=='object'||Array.isArray(value))throw Error('模型参数须为对象');return clone(value); }
  function normalizeAgentOverride(value) {
    value=value||{mode:'inherit'};
    if(!['inherit','override'].includes(value.mode))throw Error('请选择沿用 Agent 配置模型或更换模型');
    if(value.mode==='inherit')return {mode:'inherit',parameters:{}};
    if(!text(value.modelRef).trim())throw Error('请选择更换的评测执行模型');
    return {mode:'override',modelRef:text(value.modelRef).trim(),parameters:parameters(value.parameters)};
  }
  function normalizeJudgeRuntime(value,fallback) {
    const defaults=fallback||defaultJudgeRuntime(),runtime=value||defaults;
    if(!text(runtime.modelRef).trim())throw Error('请选择评估模型');
    return {modelRef:text(runtime.modelRef).trim(),parameters:parameters(runtime.parameters===undefined?defaults.parameters:runtime.parameters)};
  }
  function runtimeConfiguration(fields={},current=null) {
    return {agentRuntimeOverride:normalizeAgentOverride(fields.agentRuntimeOverride??current?.agentRuntimeOverride??current?.snapshot?.agentRuntimeOverride),judgeRuntime:normalizeJudgeRuntime(fields.judgeRuntime??current?.judgeRuntime??current?.snapshot?.judgeRuntimeSnapshot,current?.judgeRuntime||current?.snapshot?.judgeRuntimeSnapshot)};
  }
  function agentRuntimeSnapshot(agent,version,override) {
    const agentRef={id:agent.id,version};
    if(override.mode==='override')return {mode:'override',agentRef,modelRef:override.modelRef,parameters:clone(override.parameters),source:'experiment_override',resolution:'resolved',executionMode:'mock'};
    const entry=evAgentVersions(agent.id).find(item=>item.id===version),runtime=entry?.runtime||entry?.modelRuntime,modelRef=runtime?.modelRef||entry?.modelRef||null;
    return {mode:'inherit',agentRef,modelRef,parameters:parameters(runtime?.parameters||entry?.parameters),source:'agent_version',resolution:modelRef?'resolved':'unknown',executionMode:'mock'};
  }
  function runtimeModelName(kind,ref) { return (typeof model().modelDisplayName==='function'?model().modelDisplayName(ref):'')||runtimeModels(kind).find(item=>item.id===ref)?.name||ref; }
  function runtimeRead(snapshot={},historical=false) {
    const agent=snapshot.agentRuntimeSnapshot,judge=snapshot.judgeRuntimeSnapshot;
    const agentLabel=agent?agent.mode==='override'?runtimeModelName('agent',agent.modelRef):agent.modelRef?'沿用 Agent 配置模型：'+runtimeModelName('agent',agent.modelRef):'沿用 Agent 配置模型（未记录具体模型）':historical?'历史未记录评测执行模型配置':'沿用 Agent 配置模型（未记录具体模型）';
    const judgeLabel=judge===null?'无需评估模型（规则校验）':judge?runtimeModelName('judge',judge.modelRef):historical?'历史未记录评估模型配置':'尚未配置，请编辑实验选择';
    return `<section class="ont-overview ub-runtime-summary"><div class="ont-section-title"><h3>${historical?'运行模型快照':'模型运行配置'}</h3></div><dl class="ont-mapping"><div><dt>评测执行模型</dt><dd>${html(agentLabel)}</dd></div><div><dt>评估模型</dt><dd>${html(judgeLabel)}</dd></div></dl></section>`;
  }
  function runtimeOptions(kind,selected) {
    const options=runtimeModels(kind),present=options.some(item=>item.id===selected);
    return (!selected?'<option value="">请选择模型</option>':'')+(!present&&selected?`<option value="${html(selected)}" selected>${html(runtimeModelName(kind,selected))} · 已保存配置</option>`:'')+options.map(item=>`<option value="${html(item.id)}" ${item.id===selected?'selected':''}>${html(item.name||item.id)}</option>`).join('');
  }
  function runtimeEditor(configuration) {
    const agent=configuration.agentRuntimeOverride,judge=configuration.judgeRuntime,bindings=configuration.unifiedBindings||evExperimentEditor?.unifiedBindings||[],needsJudge=configuration.execution?.evaluatorSummary?.mode==='custom_prompt'||evExperimentEditor?.execution?.evaluatorSummary?.mode==='custom_prompt'||!bindings.length||bindings.some(binding=>getEvaluator(binding.evaluatorRef).method?.type==='llm_judge');
    return `<section class="ont-form-section" id="ub-runtime-editor" data-unified-runtime><h3>模型运行配置</h3><div class="ont-grid">${evField('评测执行模型',`<select name="agentRuntimeMode" aria-label="评测执行模型" onchange="AIOpsUnifiedBridge.runtimeChange('agentMode',this.value)"><option value="inherit" ${agent.mode==='inherit'?'selected':''}>沿用 Agent 配置模型</option><option value="override" ${agent.mode==='override'?'selected':''}>更换模型</option></select>`)}${agent.mode==='override'?evField('模型',`<select name="agentModelRef" aria-label="评测执行模型选择" onchange="AIOpsUnifiedBridge.runtimeChange('agentModel',this.value)">${runtimeOptions('agent',agent.modelRef||'')}</select>`):''}${evField('评估模型',`<select name="judgeModelRef" aria-label="评估模型" ${needsJudge?'':'disabled'} onchange="AIOpsUnifiedBridge.runtimeChange('judgeModel',this.value)">${runtimeOptions('judge',judge.modelRef)}</select>`,'',needsJudge)}</div></section>`;
  }
  function refreshRuntimeEditor(editor) {
    const node=global.document?.querySelector('[data-unified-runtime]')||global.document?.getElementById('ub-runtime-editor');
    if(!node)return;
    const markup=runtimeEditor(editor);
    node.outerHTML=node.id?markup.replace('id="ub-runtime-editor"','id="'+html(node.id)+'"'):markup;
  }
  function stripLegacyModel(markup) { return markup.replace(/<div><dt>评测模型<\/dt><dd>[\s\S]*?<\/dd><\/div>/g,''); }
  function published() {
    // A task's scene selects its business data, not the reusable evaluator catalog.
    return model().listEvaluators().filter(item=>item.enabled!==false&&item.status!=='disabled').flatMap(item => (item.versions || []).map(version => {
      const value=typeof version==='object'?version.version:version;
      return model().evaluator(item.id,value);
    }).filter(Boolean));
  }
  function metrics(evaluator) { return evaluator.metrics || evaluator.output?.metrics || []; }
  function numericAggregate(value) {
    const candidate=typeof value==='number'?value:value&&typeof value==='object'?(value.value??value.score):null;
    return typeof candidate==='number'&&Number.isFinite(candidate)?candidate:null;
  }
  function inputMapping(evaluator,targetType='case_output') {
    const reference=targetType==='case_output'?'/case/expected':'/target/reference';
    const sources={actual:'/target/output',output:'/target/output',answer:'/target/output',reference,expected:reference,taskDefinition:'/task',task:'/task',messages:'/target/messages',trajectory:'/target/trajectory',context:'/target/context',input:'/target/input'};
    const automatic=typeof model().defaultInputMapping==='function'?clone(model().defaultInputMapping(evaluator,targetType)):{};
    return {...Object.fromEntries(Object.keys(evaluator.inputSchema?.properties||{actual:{},reference:{}}).filter(key=>sources[key]).map(key=>[key,sources[key]])),...automatic};
  }
  function allSelected(execution) { return execution?.evaluationPolicy==='all_selected'; }
  function promptAuthored(evaluator) { return typeof model().isPromptEvaluator==='function'?model().isPromptEvaluator(evaluator):evaluator?.authoringMode==='prompt'; }

  function evaluatorSummaryPolicy(execution) { return clone(execution?.evaluatorSummary||{type:'all'}); }
  function evaluatorGateCount(bindings) { return bindings.filter(binding=>binding.role==='gate').length; }
  function compositeSummary(policy) { return typeof model().compositePolicy==='function'?clone(model().compositePolicy(policy)):policy?.type==='composite_policy'?clone(policy):{type:'composite_policy',policyVersion:1,mode:'item_count',missingEvidence:'inconclusive',summary:policy?.type==='at_least'?{type:'at_least',minPassed:policy.minPassed}:{type:'all'}}; }
  function newCompositeSummary(mode='weighted_score') { return {type:'composite_policy',policyVersion:1,mode,missingEvidence:'inconclusive',...(mode==='weighted_score'?{passThreshold:80,weights:[]}:mode==='custom_prompt'?{customPrompt:''}:{summary:{type:'all'}})}; }
  function authoringCompositeSummary(policy) {
    if(typeof model().prepareCompositePolicyForAuthoring==='function')return clone(model().prepareCompositePolicyForAuthoring(policy));
    const value=compositeSummary(policy);if(['weighted_score','custom_prompt'].includes(value.mode))return value;
    return {...newCompositeSummary('custom_prompt'),customPrompt:value.summary?.type==='at_least'?`根据各评估器的真实结果，至少 ${value.summary.minPassed} 个参与判定的评估器通过时通过；无法明确判定时保留待确认。`:'根据各评估器的真实结果，全部参与判定的评估器通过时通过；任一未通过时未通过；缺证或执行异常时保留待确认。'};
  }
  function summaryValidationBindings(bindings) { return bindings.map(binding=>({...clone(binding),evaluatorSnapshot:clone(bindingEvaluator(binding))})); }
  function normalizeEvaluatorSummary(execution,bindings) {
    const policy=evaluatorSummaryPolicy(execution),total=evaluatorGateCount(bindings);
    if(policy?.type==='composite_policy'){
      if(!allSelected(execution))throw Error('请按所选评估器配置实验通过判定');
      const errors=typeof model().validateCompositePolicy==='function'?model().validateCompositePolicy(policy,summaryValidationBindings(bindings)):[];
      if(errors.length)throw Error(errors.map(error=>error.message||String(error)).join('；'));
      return compositeSummary(policy);
    }
    if(!policy||!['all','at_least'].includes(policy.type))throw Error('请选择评估器全部通过或部分通过');
    if(policy.type==='all')return {type:'all'};
    if(!allSelected(execution))throw Error('部分通过需要重新保存为按所选评估器评估的实验配置');
    if(!Number.isInteger(policy.minPassed)||policy.minPassed<1||policy.minPassed>total)throw Error('至少通过评估器数须为 1 至 '+total+' 的整数，请调整汇总判定');
    return {type:'at_least',minPassed:policy.minPassed};
  }
  function evaluatorSummaryLabel(execution,bindings) {
    const policy=evaluatorSummaryPolicy(execution),total=evaluatorGateCount(bindings||[]);
    if(policy.type==='composite_policy'){
      if(policy.mode==='custom_prompt')return '根据自定义提示词判定用例整体是否通过';
      if(policy.mode==='weighted_score')return '评估器加权总分 ≥ '+policy.passThreshold+' / 100，用例才通过';
      return !total?'没有参与判定的评估器，结果仅观察':policy.summary?.type==='at_least'?'至少 '+policy.summary.minPassed+' / '+total+' 个评估器通过，用例才通过':'全部参与判定的评估器通过，用例才通过';
    }
    return !total?'没有参与判定的评估器，结果仅观察':policy.type==='at_least'?'至少 '+policy.minPassed+' / '+total+' 个评估器通过，用例才通过':'全部参与判定的评估器通过，用例才通过';
  }
  function evaluatorSummaryRead(result,compact=false) {
    const policy=result.evaluatorPolicyResult,summary=result.evaluatorSummaryResult;
    if(policy){
      const mode=({weighted_score:'评分',item_count:'通过数量',custom_prompt:'自定义'})[policy.mode]||policy.mode;
      const stats=policy.mode==='weighted_score'?`<div><dt>总分 / 通过阈值</dt><dd>${html(policy.score??'—')} / ${html(policy.threshold)}</dd></div>`:policy.mode==='item_count'&&summary?`<div><dt>已通过 / 参与评估器</dt><dd>${html(summary.passed)} / ${html(summary.total)}</dd></div><div><dt>至少通过</dt><dd>${html(summary.required)}</dd></div>`:'';
      const contributions=policy.mode==='weighted_score'?(policy.contributions||[]).map(part=>`<div class="ub-composite-contribution"><span>${html(part.name||part.evaluatorName||part.bindingId)}</span><span>${html(part.normalizedScore??part.score??'—')} × ${html(part.weight)} = <b>${html(part.weightedScore??'—')}</b></span></div>`).join(''):'';
      const showReason=policy.reason&&(!compact||policy.mode==='custom_prompt'||policy.decision==='inconclusive'),evidence=policy.evidenceRefs?.length?'<p class="ub-result-evidence">证据：'+policy.evidenceRefs.map(ref=>html(typeof ref==='object'?JSON.stringify(ref):ref)).join('、')+'</p>':'';
      return `<div class="ub-final-stat-grid"><dl class="ont-mapping"><div><dt>判定方式</dt><dd>${html(mode)}</dd></div>${stats}</dl></div>${showReason?'<p class="ub-result-reason">'+html(policy.reason)+'</p>':''}${contributions?'<div class="ub-composite-contributions">'+contributions+'</div>':''}${evidence?(compact?'<details class="ub-result-details"><summary>查看判定证据</summary>'+evidence+'</details>':evidence):''}${result.evaluatorFinalJudgeInputSnapshot?'<details class="ub-result-details"><summary>查看最终判定快照</summary><pre class="ue-pre">'+html(JSON.stringify({input:result.evaluatorFinalJudgeInputSnapshot,result:result.evaluatorFinalJudgeResult},null,2))+'</pre></details>':''}`;
    }
    if(!summary)return '';
    return `<dl class="ont-mapping ub-evaluator-summary-result"><div><dt>评估器汇总判定</dt><dd>${summary.total?html(summary.mode==='at_least'?'至少 '+summary.required+' / '+summary.total+' 个评估器通过':'全部 '+summary.total+' 个评估器通过'):'仅观察'}</dd></div><div><dt>评估器结果</dt><dd>通过 ${html(summary.passed)} · 未通过 ${html(summary.failed)} · 待确认 ${html(summary.inconclusive)} · 仅观察 ${html(summary.observed)}</dd></div></dl>`;
  }
  function summarizeEvaluators(execution,assessments,context={}) {
    const gates=assessments.filter(item=>item.role==='gate'&&hasPassDecision(item.evaluatorSnapshot)),policy=evaluatorSummaryPolicy(execution);
    if(policy.type==='composite_policy'){
      const evaluated=model().evaluateCompositePolicy(policy,assessments,context);
      return {...evaluated,summary:evaluated.summaryResult||evaluated.summary||{mode:policy.mode,required:evaluated.required,total:evaluated.counts.total,passed:evaluated.counts.passed,failed:evaluated.counts.failed,inconclusive:evaluated.counts.inconclusive,observed:evaluated.counts.observed,lowerBound:evaluated.counts.passed,upperBound:evaluated.counts.passed+evaluated.counts.inconclusive}};
    }
    const passed=gates.filter(item=>item.executionStatus==='succeeded'&&item.decision==='passed').length,failed=gates.filter(item=>item.executionStatus==='succeeded'&&item.decision==='failed').length,inconclusive=gates.length-passed-failed,required=policy.type==='at_least'?policy.minPassed:gates.length;
    const summary={mode:policy.type,required,total:gates.length,passed,failed,inconclusive,observed:assessments.length-gates.length,lowerBound:passed,upperBound:passed+inconclusive};
    return {summary,decision:!gates.length?'not_applicable':passed>=required?'passed':passed+inconclusive<required?'failed':'inconclusive'};
  }
  function v4Evaluator(evaluator) { return typeof model().isV4Evaluator==='function'?model().isV4Evaluator(evaluator):!promptAuthored(evaluator)&&evaluator?.decision?.type==='evaluation_policy'&&evaluator.decision.policyVersion===4; }
  function itemCentric(evaluator) { return evaluator?.decision?.type==='item_summary'&&evaluator.decision.policyVersion===3||v4Evaluator(evaluator); }
  function itemTypeLabel(metric) { return ({boolean:'判断',category:'分类',number:'评分',text:'文本'})[metric?.valueType]||metric?.valueType||'—'; }
  function passConditions(evaluator) {
    const decision=evaluator?.decision||{};
    if(decision.type!=='aggregate_threshold'&&typeof model().decisionRules==='function')return model().decisionRules(evaluator);
    if(decision.type==='all_rules')return decision.rules||[];
    if(decision.type==='all_conditions')return decision.conditions||[];
    if(decision.type==='boolean_equals')return [{metricId:decision.metricId,operator:'equals',value:decision.value}];
    if(decision.type==='category_in')return [{metricId:decision.metricId,operator:'in',value:decision.values}];
    if(decision.type==='aggregate_threshold')return [{metricId:'@aggregate',operator:decision.operator,value:decision.threshold}];
    return [];
  }
  function hasPassDecision(evaluator) { return typeof model().hasDecision==='function'?model().hasDecision(evaluator):itemCentric(evaluator)?metrics(evaluator).some(metric=>metric.valueType!=='text'):passConditions(evaluator).length>0; }
  function metricParticipates(evaluator,metricId) { return itemCentric(evaluator)?metrics(evaluator).some(metric=>metric.id===metricId&&metric.valueType!=='text'):!evaluator?.decision||(evaluator.decision.type==='aggregate_threshold'?(evaluator.aggregation?.weights||[]).some(weight=>weight.metricId===metricId):passConditions(evaluator).some(condition=>condition.metricId===metricId)); }
  function metricDecision(evaluator,result) { return metricParticipates(evaluator,result.metricId)||['missing','invalid'].includes(result.validationStatus)?result.decision||'inconclusive':'not_applicable'; }
  function conditionLabel(evaluator,condition) {
    const metric=metrics(evaluator).find(item=>item.id===condition.metricId),value=condition.value;
    const label=item=>metric?.valueType==='category'?metric.categories?.find(category=>category.code===item)?.label||item:typeof item==='boolean'?(item?'true':'false'):typeof item==='object'?JSON.stringify(item):text(item);
    if(condition.operator==='between')return '['+(Array.isArray(value)?value:[]).map(label).join(', ')+']（含边界）';
    if(condition.operator==='in')return '属于 {'+(Array.isArray(value)?value:[]).map(label).join('、')+'}';
    return (({equals:'=',not_equals:'≠',gt:'>',gte:'≥',lt:'<',lte:'≤'})[condition.operator]||condition.operator)+' '+label(value);
  }
  function gradingRead(evaluator) {
    if(!evaluator)return '<p>历史未记录评估标准</p>';
    if(promptAuthored(evaluator))return `<div class="ub-grading-contract ub-prompt-grading"><h4>原文提示词</h4><pre class="ue-pre">${html(evaluator.method?.prompt||'')}</pre><p>输出整体判定、判断理由和证据；信息不足时保留待确认。</p></div>`;
    if(itemCentric(evaluator))return itemGradingRead(evaluator);
    const conditions=passConditions(evaluator),aggregation=evaluator.aggregation||{type:'none'},legacyAggregate=evaluator.decision?.type==='aggregate_threshold';
    const conditionRows=conditions.map(condition=>`<tr><td>${html(condition.metricId==='@aggregate'?'历史汇总值':metrics(evaluator).find(metric=>metric.id===condition.metricId)?.name||condition.metricId)}</td><td>${html(conditionLabel(evaluator,condition))}</td></tr>`);
    const weights=(aggregation.weights||[]).map(weight=>(metrics(evaluator).find(metric=>metric.id===weight.metricId)?.name||weight.metricId)+' × '+weight.weight).join('；');
    return `<div class="ub-grading-contract"><h4>${conditions.length?'通过条件（全部满足）':'仅观察（未配置通过条件）'}</h4>${conditionRows.length?evTable(['指标','通过条件'],conditionRows):''}<h4>${legacyAggregate?'历史汇总配置':'汇总展示（独立于通过判定）'}</h4><p>${html(aggregation.type==='weighted_mean'?'加权平均：'+weights:'不汇总')}</p></div>`;
  }
  function itemRuleLabel(metric,evaluator) {
    if(metric.valueType==='boolean')return '结果为 '+text(metric.boolean?.passValue);
    if(metric.valueType==='category')return '分类属于 {'+(metric.categories||[]).filter(category=>category.pass).map(category=>category.label||category.code).join('、')+'}';
    if(metric.valueType==='number')return (v4Evaluator(evaluator)?'本项得分':'本项加权得分')+' ≥ '+text(metric.scoring?.passThreshold)+' / 100';
    return '仅观察';
  }
  function itemSummaryLabel(evaluator) {
    const total=metrics(evaluator).filter(metric=>metric.valueType!=='text').length,summary=evaluator.decision?.summary||{};
    if(v4Evaluator(evaluator)&&evaluator.decision.mode==='weighted_score')return total?'加权总分 ≥ '+evaluator.decision.passThreshold+' / 100':'仅观察（没有参与判定的评估项）';
    if(v4Evaluator(evaluator)&&evaluator.decision.mode==='custom_prompt')return '根据独立的总体评估提示词判定';
    return !total?'仅观察（没有参与判定的评估项）':summary.type==='at_least'?'至少 '+summary.minPassed+' 个评估项通过（共 '+total+' 项，不含文本项）':'全部 '+total+' 个参与判定的评估项通过（不含文本项）';
  }
  function itemGradingRead(evaluator) {
    const items=metrics(evaluator).map(metric=>{
      let rules='';
      if(metric.valueType==='boolean')rules=evTable(['判断结果','判断标准','本项判定'],[[true,metric.boolean?.trueStandard],[false,metric.boolean?.falseStandard]].map(([value,standard])=>`<tr><td>${value}</td><td>${html(standard||'—')}</td><td>${metric.boolean?.passValue===value?'通过':'未通过'}</td></tr>`));
      else if(metric.valueType==='category')rules=evTable(['分类','分类标准','本项判定'],(metric.categories||[]).map(category=>`<tr><td>${html(category.label||category.code)}</td><td>${html(category.standard||'—')}</td><td>${category.pass?'通过':'未通过'}</td></tr>`));
      else if(metric.valueType==='number')rules=v4Evaluator(evaluator)?'<p>依据本项标准直接返回 0–100 分。</p>':evTable(['评分子项','评分标准','权重','分数范围'],(metric.scoring?.items||[]).map(item=>`<tr><td>${html(item.name||item.id)}</td><td>${html(item.standard||'—')}</td><td>${html(item.weight)}</td><td>0–100</td></tr>`));
      return `<article class="ub-item-standard"><h4>${html(metric.name||metric.id)} · ${html(itemTypeLabel(metric))}</h4><p>${html(metric.standard||'—')}</p>${rules}<p class="ub-item-pass-rule">${html(itemRuleLabel(metric,evaluator))}</p></article>`;
    }).join('');
    const additional=v4Evaluator(evaluator)&&text(evaluator.additionalPrompt).trim()?`<h4>补充提示词</h4><pre class="ue-pre">${html(evaluator.additionalPrompt)}</pre>`:'';
    return `<div class="ub-grading-contract ub-item-grading">${additional}<h4>逐项评估标准</h4>${items}${v4Evaluator(evaluator)?policyConfigRead(evaluator):'<h4>评估器汇总</h4><p>'+html(itemSummaryLabel(evaluator))+'</p>'}</div>`;
  }
  function policyConfigRead(evaluator) {
    const decision=evaluator.decision,mode=decision.mode;
    const weights=mode==='weighted_score'?evTable(['评估项','权重','计分方式'],metrics(evaluator).filter(metric=>metric.valueType!=='text').map(metric=>`<tr><td>${html(metric.name||metric.id)}</td><td>${html(metric.weight)}</td><td>${metric.valueType==='number'?'实际分数':'本项通过 100 分，未通过 0 分'}</td></tr>`)):'';
    return `<h4>总体评估方式 · ${html(({weighted_score:'加权评分',item_count:'通过项数',custom_prompt:'自定义提示词'})[mode]||mode)}</h4><p>${html(itemSummaryLabel(evaluator))}</p>${weights}${mode==='custom_prompt'?'<pre class="ue-pre">'+html(decision.customPrompt||'')+'</pre>':''}`;
  }
  function summaryResultRead(assessment) {
    const summary=assessment.summaryResult;if(!summary)return '';
    if(summary.total===0)return `<p class="ub-item-summary-result">仅观察：${html(summary.observed)} 个文本评估项，无总体通过判定。</p>`;
    return `<dl class="ont-mapping ub-item-summary-result"><div><dt>评估项汇总结果</dt><dd>通过 ${html(summary.passed)} · 未通过 ${html(summary.failed)} · 待确认 ${html(summary.inconclusive)} · 仅观察 ${html(summary.observed)}</dd></div><div><dt>通过项数 / 要求</dt><dd>${html(summary.passed)} / ${html(summary.required)}（参与判定 ${html(summary.total)} 项）</dd></div><div><dt>可达通过项数</dt><dd>${html(summary.lowerBound)}–${html(summary.upperBound)}</dd></div></dl>`;
  }
  function policyResultRead(evaluator,assessment) {
    const policy=assessment.policyResult;if(!policy)return '<p class="ub-policy-result">尚无总体评估结果</p>';
    const evidence=(policy.evidenceRefs||[]).map(ref=>`<span class="ont-badge">${html(typeof ref==='object'?JSON.stringify(ref):ref)}</span>`).join(' '),heading=`<h4>总体评估结果 · ${html(({weighted_score:'加权评分',item_count:'通过项数',custom_prompt:'自定义提示词'})[policy.mode]||policy.mode)}</h4><p>整体判定：${html(decisionLabel(policy.decision))}</p>`;
    let details='';
    if(policy.mode==='weighted_score'){
      const rows=(policy.contributions||[]).map(part=>{const metric=metrics(evaluator).find(item=>item.id===part.metricId),result=(assessment.metricResults||[]).find(item=>item.metricId===part.metricId),value=metric?.valueType==='category'?metric.categories?.find(category=>category.code===part.value)?.label||part.value:part.value;return `<tr><td>${html(metric?.name||part.metricId)}</td><td>${html(value??'—')}</td><td>${html(part.normalizedScore??'—')}</td><td>${html(part.weight)}</td><td>${html(part.weightedScore??'—')}</td><td>${html(decisionLabel(result?.decision))}</td></tr>`;});
      details=`<p class="ub-policy-score">加权总分：<b>${html(aggregateDisplay(evaluator,policy.score))}</b> / 100 · 整体阈值：${html(policy.threshold)}</p>${evTable(['评估项','实际结果','计入分数','权重','贡献分','本项判定'],rows)}`;
    }else if(policy.mode==='item_count')details=summaryResultRead(assessment);
    else{
      const input=assessment.finalJudgeInputSnapshot,final=assessment.finalJudgeResult;
      details=`${final?'<p>最终评判结果：'+html(final.validationStatus==='valid'?'已取得':final.validationStatus==='invalid'?'协议或快照不匹配':'待取得独立判定')+'</p>':''}${input?'<details><summary>最终评判输入快照</summary><p>输入标识：<code>'+html(input.inputHash)+'</code></p><pre class="ue-pre">'+html(JSON.stringify(input,null,2))+'</pre></details>':''}${final?'<details><summary>最终评判返回</summary><pre class="ue-pre">'+html(JSON.stringify(final,null,2))+'</pre></details>':''}`;
    }
    return `<div class="ub-policy-result">${heading}${details}<p>${html(policy.reason||'—')}</p>${evidence?'<p>证据：'+evidence+'</p>':''}</div>`;
  }
  function aggregateDisplay(evaluator,value) { const number=numericAggregate(value),precision=evaluator?.aggregation?.precision;return number===null?'—':Number(number.toFixed(Number.isInteger(precision)&&precision>=0&&precision<=10?precision:2)); }
  function aggregateRead(evaluator,assessment) { return promptAuthored(evaluator)?'':v4Evaluator(evaluator)?policyResultRead(evaluator,assessment):itemCentric(evaluator)?summaryResultRead(assessment):evaluator?.aggregation?.type==='weighted_mean'?`<p class="ub-aggregate-result">${evaluator.decision?.type==='aggregate_threshold'?'历史判定汇总值':'汇总展示值'}：<b>${html(aggregateDisplay(evaluator,assessment.aggregate))}</b></p>`:''; }
  function promptResultRead(assessment) {
    const result=(assessment.metricResults||[]).find(metric=>metric.metricId==='overall_verdict'),reason=result?.reason||assessment.reason||assessment.error?.message||'尚无判断理由',evidence=result?.evidenceRefs||[];
    return `<dl class="ont-mapping ub-prompt-result"><div><dt>整体判定</dt><dd>${html(decisionLabel(assessment.decision))}</dd></div><div><dt>判断理由</dt><dd>${html(reason)}</dd></div><div><dt>证据</dt><dd>${evidence.length?evidence.map(ref=>`<span class="ont-badge">${html(typeof ref==='object'?JSON.stringify(ref):ref)}</span>`).join(' '):'尚无可核验证据'}</dd></div></dl>`;
  }
  function scoringResultRead(metric,result) {
    const rows=(metric.scoring?.items||[]).map(item=>{const actual=result.subResults?.find(sub=>sub.id===item.id),value=actual?.validationStatus==='invalid'&&Object.prototype.hasOwnProperty.call(actual,'rawValue')?actual.rawValue:actual?.value;return `<tr><td>${html(item.name||item.id)}</td><td>${html(item.standard||'—')}</td><td>${html(value??'—')}</td><td>${html(item.weight)}</td><td>${html(actual?.weightedValue??'—')}</td><td>${html(actual?.validationStatus==='valid'?'已取得':actual?.validationStatus==='invalid'?'分数格式异常':'缺少子项分数')}</td></tr>`;});
    return `<div class="ub-scoring-result">${evTable(['评分子项','评分标准','实际分数','权重','加权分','证据状态'],rows)}<p>本项加权得分：<b>${html(result.value??'—')}</b> / 100 · 通过阈值：${html(metric.scoring?.passThreshold)}${result.value==null?' · 子项证据不完整，未生成本项总分':''}</p></div>`;
  }
  function directScoreResultRead(metric,result) {
    const raw=result.validationStatus==='invalid'&&Object.prototype.hasOwnProperty.call(result,'rawValue')?result.rawValue:result.value;
    return `<p class="ub-direct-score-result">本项得分：<b>${html(raw??'—')}</b> / 100 · 本项阈值：${html(metric.scoring?.passThreshold)}${result.validationStatus==='invalid'?' · 原始分数无效，保留待确认':result.value==null?' · 缺少本项分数':''}</p>`;
  }
  function metricResultsRead(evaluator,assessment) {
    if(promptAuthored(evaluator))return promptResultRead(assessment);
    return evTable([itemCentric(evaluator)?'评估项':'指标','实际结果','判定','证据说明'],(assessment.metricResults||[]).map(result=>{
      const selected=metricParticipates(evaluator,result.metricId),metric=metrics(evaluator||{}).find(item=>item.id===result.metricId),value=result.validationStatus==='invalid'&&Object.prototype.hasOwnProperty.call(result,'rawValue')?result.rawValue:result.value,decision=metricDecision(evaluator,result),label=selected?decisionLabel(decision):'仅观察'+(result.validationStatus==='missing'?' · 缺少结果':result.validationStatus==='invalid'?' · 结果格式异常':'');
      const category=itemCentric(evaluator)&&metric?.valueType==='category'&&metric.categories?.find(category=>category.code===value),actual=itemCentric(evaluator)&&metric?.valueType==='number'?(v4Evaluator(evaluator)?directScoreResultRead(metric,result):scoringResultRead(metric,result)):category?`<span title="${html(value)}">${html(category.label||category.code)}</span>`:html(value==null?'—':typeof value==='object'?JSON.stringify(value):value);
      return `<tr><td>${html(metric?.name||result.metricId)}${itemCentric(evaluator)?'<small> · '+html(itemTypeLabel(metric))+'</small>':''}</td><td>${actual}</td><td>${html(label)}</td><td>${html(result.reason)}</td></tr>`;
    }));
  }
  function assessmentEvaluator(assessment,snapshot) { return assessment.evaluatorSnapshot||snapshot?.unifiedEvaluation?.evaluatorVersions.find(item=>refKey(evaluatorRef(item))===refKey(assessment.evaluatorRef))||model().evaluator(assessment.evaluatorRef.id,assessment.evaluatorRef.version); }
  function allSelectedBindings(bindings,tasks=[]) {
    tasks=[...new Map(tasks.map(task=>[task.id+'@'+task.version,task])).values()];
    return bindings.map(binding=>{
      const evaluator=getEvaluator(binding.evaluatorRef),value={...clone(binding),role:binding.role==='observe'||!hasPassDecision(evaluator)?'observe':'gate',dimensionMappings:[],inputMapping:inputMapping(evaluator,evaluationTarget(binding)==='conversation'?'session':'case_output')};
      delete value.taskRef;
      value.businessMappings=tasks.flatMap(task=>(task.evaluationBindings||[]).filter(recommended=>refKey(recommended.evaluatorRef)===refKey(binding.evaluatorRef)).map(recommended=>({taskRef:taskRef(task),dimensionMappings:clone(recommended.dimensionMappings)})));
      return value;
    });
  }
  function experimentFormBindings(bindings,deduplicate=true) {
    const normalized=bindings.map(binding=>({...clone(binding),role:binding.role==='observe'||!hasPassDecision(bindingEvaluator(binding))?'observe':'gate'}));
    return deduplicate?[...new Map(normalized.map(binding=>[refKey(binding.evaluatorRef),binding])).values()]:normalized;
  }
  function evaluationTarget(binding) { return binding.evaluationTarget || (binding.targetType==='session'?'conversation':'first_response'); }
  function targetLabel(target) { return target==='conversation'?'整段会话':'首轮回复'; }
  function roleLabel(role) { return role==='observe'?'仅观察':'参与通过判定'; }
  function automaticEvidence(evaluator) { const contract=evaluator.inputSchema?.['x-aiops-evidence'];return contract?.version===1&&['prompt_variables','rule_paths'].includes(contract.source)||contract?.version===2&&contract.source==='item_standards'||contract?.version===3&&contract.source==='evaluation_policy'; }
  function supportsTarget(evaluator,targetType) { return automaticEvidence(evaluator)||(evaluator.supportedTargets||[]).includes(targetType); }
  function supportsConversation(evaluator) { return supportsTarget(evaluator,'session')&&(automaticEvidence(evaluator)||!(evaluator.inputSchema?.required||[]).some(key=>['reference','expected'].includes(key))); }
  function attachSourceEvidence(context,result,caseRecord,conversation) {
    const target=context.target,files=Array.isArray(caseRecord.inputAttachments)?caseRecord.inputAttachments:[],input=result.input??caseRecord.input;
    if(files.length)target.input={...(typeof input==='string'&&input.trim()?{text:input}:input!==undefined&&input!==null?{value:clone(input)}:{}),attachments:clone(files)};
    else if(input===undefined||input===null||typeof input==='string'&&!input.trim())delete target.input;
    const sourceContext=caseRecord.context??result.context;
    if(sourceContext!==undefined&&sourceContext!==null)target.context=clone(sourceContext);
    if(!conversation&&(context.case.expected===undefined||context.case.expected===null||typeof context.case.expected==='string'&&!context.case.expected.trim()))delete context.case.expected;
    // Completeness is relative to the runtime-selected target, never an evaluator-wide granularity requirement.
    const messages=Array.isArray(target.messages)?target.messages:[],turns=Math.max(1,Number(result.actualTurns)||1),assistantCount=messages.filter(message=>['assistant','agent'].includes(message.role)).length;
    const messagesPartial=result.messagesTruncated===true||result.messagesComplete===false||conversation&&assistantCount<turns;
    const trace=result.trace,trajectory=Array.isArray(target.trajectory)?target.trajectory:[],traceTurns=new Set(trajectory.map(span=>Number(span.turn)||1));
    const trajectoryPartial=trace?.truncated===true||trace?.complete===false||result.trajectoryTruncated===true||conversation&&traceTurns.size<turns;
    const recorded=result.conversationPrepared===true&&!!result.endedAt;
    target.evaluationTarget=conversation?'conversation':'first_response';
    target.evidenceCompleteness={targetType:target.type,messages:messages.length?messagesPartial?'partial':recorded&&assistantCount>0?'complete':'unknown':'unknown',trajectory:trajectory.length?trajectoryPartial?'partial':recorded?'complete':'unknown':'unknown'};
  }
  function executionBindings(execution,bindings) {
    const result=clone(execution||{}),groups=new Map();
    for(const binding of bindings){const id=refKey(binding.evaluatorRef),prior=groups.get(id);if(!prior)groups.set(id,{evaluatorId:id,target:evaluationTarget(binding),participation:binding.role});else if(binding.role==='gate')prior.participation='gate';}
    result.evaluationBindings=[...groups.values()];return result;
  }
  function applyExecutionBindings(bindings,execution) {
    return bindings.map(binding=>{const configured=(execution?.evaluationBindings||[]).find(item=>item.evaluatorId===refKey(binding.evaluatorRef)||item.evaluatorId===binding.evaluatorRef.id);return configured?{...clone(binding),evaluationTarget:configured.target,targetType:configured.target==='conversation'?'session':'case_output',role:configured.participation||binding.role}:binding;});
  }
  function refKey(ref) { return ref.id+'@'+ref.version; }
  function evaluatorName(ref) { const evaluator=model().evaluator(ref.id,ref.version);return evaluator?(evaluator.name+' '+ref.version):refKey(ref); }
  function evaluatorRef(evaluator) { return {id:evaluator.id,version:evaluator.version}; }
  function getEvaluator(ref) { const value=model().evaluator(ref.id,ref.version); if (!value) throw Error('评估器已发布版本不可用：'+refKey(ref)); return value; }
  function taskState(task) {
    const key=taskScene(task)+':'+task.id, state=db().tasks[key] || (db().tasks[key]={dimensions:[],bindings:[],specification:{inputContract:'',outputContract:'',completionCriteria:''},revision:1});
    if(!state.specification)state.specification={inputContract:'',outputContract:'',completionCriteria:''};
    const previous=state.dimensions;
    if(!state.dimensionHistory)state.dimensionHistory=previous.map(item=>({id:item.id,names:[item.name]}));
    state.dimensions=(task.dimensions||[]).map((dimension,index)=>{
      const prior=previous.find(item=>item.name===dimension.name) || state.dimensionHistory.find(item=>item.names.includes(dimension.name)) || (previous[index] && !(task.dimensions||[]).some(item=>item.name===previous[index].name) ? previous[index] : null);
      const id=dimension.id || prior?.id || task.id+'-DIM-'+(++db().sequence),historic=state.dimensionHistory.find(item=>item.id===id);
      if(historic){if(!historic.names.includes(dimension.name))historic.names.push(dimension.name);}else state.dimensionHistory.push({id,names:[dimension.name]});
      return {id,name:dimension.name};
    });
    return state;
  }
  function taskSnapshot(task) {
    const state=taskState(task), value=clone(task);
    delete value.history; delete value.publishedSnapshot;
    value.dimensions=(value.dimensions||[]).map((dimension,index)=>({...dimension,id:state.dimensions[index].id}));
    value.evaluationBindings=clone(state.bindings); value.specification=clone(state.specification);value.unifiedRevision=state.revision;
    return value;
  }
  function storeAsset(kind,record) {
    const snapshot=kind==='task'?taskSnapshot(record):clone(record);
    delete snapshot.history; delete snapshot.publishedSnapshot;
    const version=record.version || 'V1', snapshotId=kind+':'+record.id+':'+version+':'+hash(JSON.stringify(snapshot));
    const ref={id:record.id,version,snapshotId};
    db().assetSnapshots[snapshotId]=snapshot;
    return {ref,snapshot};
  }
  function suiteSignature(suite) { return hash(JSON.stringify([suite.version||'V1',suite.agentId,suite.taskIds,suite.caseIds,suite.caseBindings])); }
  function captureSuite(suite,refresh=false) {
    const state=db(), key=scene()+':'+suite.id, prior=state.suiteSnapshots[state.suiteCurrent[key]], signature=suiteSignature(suite);
    if (!refresh && prior?.signature===signature) return clone(prior);
    if (!refresh) { const historical=Object.values(state.suiteSnapshots).filter(item=>item.suiteRef.id===suite.id&&item.signature===signature).at(-1);if(historical)return clone(historical); }
    const tasks=(suite.taskIds||[]).map(id => (refresh?data().tasks.find(task=>task.id===id):null) || (suite.taskSnapshots||[]).find(task=>task.id===id) || data().tasks.find(task=>task.id===id)).filter(Boolean).map(task=>storeAsset('task',task));
    const cases=(suite.caseIds||[]).map(id=>data().cases.find(item=>item.id===id && !item.archived)).filter(Boolean).map(item=>storeAsset('case',item));
    const bindings=Object.fromEntries(cases.map(item=>[item.ref.id,(suite.caseBindings?.[item.ref.id]||[]).map(binding=>{
      const task=tasks.find(item=>item.ref.id===binding.taskId);
      return {taskId:binding.taskId,dimensionIds:(binding.dimensionNames||[]).map(name=>task?.snapshot.dimensions.find(dimension=>dimension.name===name)?.id).filter(Boolean),dimensionNames:[...(binding.dimensionNames||[])]};
    })]));
    const id=key+':'+(suite.version||'V1')+':'+(++state.sequence), record={id,signature,suiteRef:{id:suite.id,version:suite.version||'V1',snapshotId:id},taskRefs:tasks.map(item=>item.ref),caseRefs:cases.map(item=>item.ref),caseBindings:bindings,capturedAt:new Date().toISOString()};
    state.suiteSnapshots[id]=record;state.suiteCurrent[key]=id;save();return clone(record);
  }
  function resolveSuite(suite) {
    const pinned=captureSuite(suite), result=clone(suite);
    result.taskSnapshots=pinned.taskRefs.map(ref=>clone(db().assetSnapshots[ref.snapshotId]));
    result.caseBindings=Object.fromEntries(Object.entries(pinned.caseBindings).map(([id,bindings])=>[id,bindings.map(binding=>({taskId:binding.taskId,dimensionNames:binding.dimensionNames}))]));
    return {suite:result,pinned,tasks:result.taskSnapshots,cases:pinned.caseRefs.map(ref=>clone(db().assetSnapshots[ref.snapshotId]))};
  }
  function taskRef(task) { return {id:task.id,version:task.version||'V1'}; }
  function defaultBindings(suites=[]) {
    const taskIds=[...new Set(suites.flatMap(suite=>suite.taskIds||[]))], recommended=taskIds.flatMap(id=>{
      const task=data().tasks.find(item=>item.id===id);return task?clone(taskState(task).bindings):[];
    });
    if (recommended.length) return recommended;
    const evaluator=pickerCatalog().map(entry=>entry.versions[0]).find(Boolean);
    return evaluator?[{id:'BIND-'+(++db().sequence),evaluatorRef:evaluatorRef(evaluator),role:hasPassDecision(evaluator)?'gate':'observe',targetType:'case_output',dimensionMappings:[],inputMapping:inputMapping(evaluator)}]:[];
  }
  function normalizedBindings(bindings,execution={}) {
    if (!Array.isArray(bindings)||!bindings.length) throw Error('请至少绑定一个已发布的评估器');
    if(allSelected(execution)){const refs=bindings.map(binding=>refKey(binding.evaluatorRef));if(new Set(refs).size!==refs.length)throw Error('同一评估器版本只需选择一次');}
    return bindings.map((item,index)=>{
      const evaluator=getEvaluator(item.evaluatorRef),target=evaluationTarget(item),targetType=target==='conversation'?'session':'case_output',binding={...clone(item),id:item.id||'BIND-'+(++db().sequence),role:allSelected(execution)?(item.role==='observe'||!hasPassDecision(evaluator)?'observe':'gate'):item.role||'gate',evaluationTarget:target,targetType,dimensionMappings:allSelected(execution)?[]:clone(item.dimensionMappings||[]),inputMapping:clone(allSelected(execution)?inputMapping(evaluator,targetType):item.inputMapping||inputMapping(evaluator,targetType))};
      if(allSelected(execution)){delete binding.taskRef;delete binding.businessMappings;}
      if(!['first_response','conversation'].includes(target))throw Error('请选择首轮回复或整段会话作为评估对象');
      if(target==='conversation'&&!supportsConversation(evaluator))throw Error('评估器「'+evaluator.name+'」不支持整段会话，或必须使用单条用例预期输出，请改为首轮回复');
      if(target==='conversation')for(const [key,path] of Object.entries(binding.inputMapping))if(path==='/case/expected')binding.inputMapping[key]='/target/reference';
      const head=model().evaluator(binding.evaluatorRef.id);
      if(head && (head.enabled===false||head.status==='disabled'))throw Error('评估器「'+head.name+'」已停用，请选择启用的已发布版本');
      if (!['gate','observe'].includes(binding.role)) throw Error('评估器角色须为 gate 或 observe');
      const task=binding.taskRef&&(Object.entries(db().assetSnapshots).filter(([key,task])=>key.startsWith('task:')&&task.id===binding.taskRef.id&&(task.version||'V1')===binding.taskRef.version).map(([,task])=>task).find(task=>(binding.dimensionMappings||[]).every(mapping=>task.dimensions?.some(dimension=>dimension.id===mapping.dimensionId)))||api.taskDefinition(binding.taskRef.id));
      // Definition validation has no execution input yet. The frozen task is authoritative; assess validates actual evidence later.
      const errors=(model().validateBinding(binding,task?{task}:undefined,{skipInput:true}) || []).filter(error=>error.field!=='input');
      if (errors.length) throw Error('绑定 '+(index+1)+'：'+errors.map(error=>typeof error==='string'?error:error.message||JSON.stringify(error)).join('；'));
      return binding;
    });
  }
  function adapter(evaluator) {
    if(promptAuthored(evaluator))return {...clone(evaluator),criteria:[],unified:true};
    const list=metrics(evaluator);
    return {...clone(evaluator),criteria:(list.length?list:[{id:'result',name:'评估结果'}]).map(metric=>({id:metric.id,name:metric.name||metric.id,description:metric.standard||metric.description||evaluator.description||'统一评估指标',weight:v4Evaluator(evaluator)&&evaluator.decision.mode==='weighted_score'?metric.weight??null:itemCentric(evaluator)?null:1/(list.length||1),passScore:itemCentric(evaluator)?metric.scoring?.passThreshold??null:80})),unified:true};
  }
  function frozenPlan(sourceData,agent,version,suites,bindings,execution) {
    if(execution?.mode!=='scenario_simulation'&&bindings.some(binding=>evaluationTarget(binding)==='conversation'))throw Error('整段会话评估需要选择多轮执行方式');
    const resolved=suites.map(resolveSuite), taskRefs=resolved.flatMap(item=>item.pinned.taskRefs), caseRefs=resolved.flatMap(item=>item.pinned.caseRefs);
    for (const refs of [taskRefs,caseRefs]) {
      const seen=new Map(); for (const ref of refs) { if (seen.has(ref.id)&&seen.get(ref.id)!==ref.snapshotId) throw Error('所选评测集固定了不同的资源版本：'+ref.id+'，请在评测集中统一引用版本'); seen.set(ref.id,ref.snapshotId); }
    }
    const tasks=[...new Map(resolved.flatMap(item=>item.tasks).map(task=>[task.id,task])).values()], cases=[...new Map(resolved.flatMap(item=>item.cases).map(item=>[item.id,item])).values()];
    if(allSelected(execution))bindings=allSelectedBindings(bindings,tasks);
    const primaryMappings=new Set();
    for (const binding of bindings) {
      const evaluator=getEvaluator(binding.evaluatorRef), task=binding.taskRef&&tasks.find(item=>item.id===binding.taskRef.id);
      if(allSelected(execution))for(const business of binding.businessMappings||[]){const mappedTask=tasks.find(item=>item.id===business.taskRef.id&&item.version===business.taskRef.version);for(const mapping of business.dimensionMappings||[])if(!mappedTask?.dimensions.some(item=>item.id===mapping.dimensionId)||!metrics(evaluator).some(item=>item.id===mapping.metricId))throw Error('业务任务推荐的维度映射与所选评估器版本不兼容，请在业务任务中更新配置');}
      if (binding.taskRef && !task) throw Error('评估绑定的业务任务不在所选评测集中');
      if (task && binding.taskRef.version!==(task.version||'V1')) throw Error('评估绑定与评测集固定的业务任务版本不一致');
      for (const mapping of binding.dimensionMappings||[]) {
        if (!task?.dimensions.some(dimension=>dimension.id===mapping.dimensionId)) throw Error('评估维度不属于该绑定的业务任务');
        if (!metrics(evaluator).some(metric=>metric.id===mapping.metricId)) throw Error('映射的评估指标不存在');
        const key=task.id+':'+mapping.dimensionId;
        if(binding.role==='gate'&&primaryMappings.has(key))throw Error('同一业务维度只允许一个 gate 指标来源，请将其他绑定设为 observe');
        if(binding.role==='gate')primaryMappings.add(key);
      }
    }
    const evaluatorVersions=[...new Map(bindings.map(binding=>{const evaluator=getEvaluator(binding.evaluatorRef);return [refKey(binding.evaluatorRef),clone(evaluator)];})).values()];
    const snapshot=source('evExperimentSnapshot')({...sourceData,tasks,cases},agent,version,resolved.map(item=>item.suite),evaluatorVersions.map(adapter),executionBindings(execution,bindings));
    const copy=clone(snapshot);
    copy.execution={...executionBindings(copy.execution,bindings),evaluatorSummary:clone(transaction?.evaluatorSummary||normalizeEvaluatorSummary(execution,bindings))};
    const runtime=transaction?.runtime||runtimeConfiguration();
    copy.agentRuntimeOverride=clone(runtime.agentRuntimeOverride);
    copy.agentRuntimeSnapshot=agentRuntimeSnapshot(agent,version,runtime.agentRuntimeOverride);
    copy.judgeRuntimeSnapshot=copy.execution.evaluatorSummary?.mode==='custom_prompt'||evaluatorVersions.some(evaluator=>evaluator.method?.type==='llm_judge')?clone(runtime.judgeRuntime):null;
    copy.runtimeConfigurationHash=typeof model().hash==='function'?'sha256:'+model().hash({agentRuntimeSnapshot:copy.agentRuntimeSnapshot,judgeRuntimeSnapshot:copy.judgeRuntimeSnapshot}):'local:'+hash(JSON.stringify(runtime));
    copy.unifiedEvaluation={schemaVersion:1,bindings:clone(bindings),evaluatorVersions,taskRefs:clone(taskRefs),caseRefs:clone(caseRefs),suiteRefs:resolved.map(item=>item.pinned.suiteRef),caseBindings:Object.fromEntries(copy.cases.map(item=>[item.id,resolved.flatMap(record=>record.pinned.caseBindings[item.id]||[])]))};
    return freeze(copy);
  }
  function createExperiment(fields) {
    // Seed the existing legacy experiment examples before the scoped unified adapter is active.
    evExperimentStore();
    const suites=(fields.suiteIds||[fields.suiteId].filter(Boolean)).map(id=>data().suites.find(item=>item.id===id)).filter(Boolean);
    const editor=submitting&&evExperimentEditor&&!evExperimentEditor.id?evExperimentEditor:null,execution={...(fields.execution||{}),...(editor?{evaluationPolicy:'all_selected',evaluatorSummary:editor.execution.evaluatorSummary}:{})}, previous=transaction;
    let bindings=normalizedBindings(applyExecutionBindings(fields.unifiedBindings || editor?.unifiedBindings || defaultBindings(suites),editor?null:execution),execution);
    if(allSelected(execution))bindings=allSelectedBindings(bindings,suites.flatMap(suite=>resolveSuite(suite).tasks));
    const runtime=runtimeConfiguration({...fields,agentRuntimeOverride:fields.agentRuntimeOverride??editor?.agentRuntimeOverride,judgeRuntime:fields.judgeRuntime??editor?.judgeRuntime});
    transaction={bindings,runtime,evaluatorSummary:normalizeEvaluatorSummary(execution,bindings)};
    try { const result=source('evCreateExperiment')({...fields,execution:executionBindings(execution,bindings),evaluatorIds:bindings.map(binding=>refKey(binding.evaluatorRef))});result.unifiedEvaluation=true;result.execution=clone(result.snapshot.execution);result.agentRuntimeOverride=clone(runtime.agentRuntimeOverride);result.judgeRuntime=clone(runtime.judgeRuntime);save();return result; } finally { transaction=previous; }
  }
  function updateExperiment(id,fields) {
    const current=evExperimentGet(id),editorBindings=submitting&&evExperimentEditor?.id===id?evExperimentEditor.unifiedBindings:null;
    if (!current || !current?.snapshot?.unifiedEvaluation && !fields.unifiedBindings && !editorBindings&&!fields.agentRuntimeOverride&&!fields.judgeRuntime) return source('evUpdateExperiment')(id,fields);
    const selectedSuites=(fields.suiteIds||current.suiteIds||[current.suiteId]).map(id=>data().suites.find(item=>item.id===id)).filter(Boolean);
    const execution={...(current.execution||{}),...(fields.execution||{}),...(editorBindings?{evaluationPolicy:'all_selected',evaluatorSummary:evExperimentEditor.execution.evaluatorSummary}:{})}, previous=transaction;
    let bindings=normalizedBindings(applyExecutionBindings(fields.unifiedBindings || editorBindings || current.snapshot.unifiedEvaluation?.bindings||defaultBindings(selectedSuites),editorBindings?null:fields.execution),execution);
    if(allSelected(execution))bindings=allSelectedBindings(bindings,selectedSuites.flatMap(suite=>resolveSuite(suite).tasks));
    if (evExperimentActiveExecution(current)) throw Error('实验正在运行，请先完成或停止执行');
    const editor=submitting&&evExperimentEditor?.id===id?evExperimentEditor:null,runtime=runtimeConfiguration({...fields,agentRuntimeOverride:fields.agentRuntimeOverride??editor?.agentRuntimeOverride,judgeRuntime:fields.judgeRuntime??editor?.judgeRuntime},current);
    transaction={bindings,runtime,evaluatorSummary:normalizeEvaluatorSummary(execution,bindings)};
    try {
      const before=JSON.stringify(current.snapshot.unifiedEvaluation?.bindings||[]),revision=current.configurationRevision,result=source('evUpdateExperiment')(id,{...fields,execution:executionBindings(execution,bindings),evaluatorIds:bindings.map(binding=>refKey(binding.evaluatorRef))});
      // Mapping/role changes also produce a new frozen configuration, even when refs did not change.
      if (before!==JSON.stringify(bindings)) {
        const suites=result.suiteIds.map(id=>data().suites.find(item=>item.id===id)), agent=evAgents().find(item=>item.id===result.agentId);
        result.snapshot=frozenPlan(data(),agent,result.version,suites,bindings,result.execution);
        if(result.configurationRevision===revision)result.configurationRevision++; result.status='未运行';
      }
      result.unifiedEvaluation=true;result.execution=clone(result.snapshot.execution);result.agentRuntimeOverride=clone(runtime.agentRuntimeOverride);result.judgeRuntime=clone(runtime.judgeRuntime);save();return result;
    } finally { transaction=previous; }
  }
  function relevantBindings(snapshot,caseRecord) {
    const coverage=snapshot.unifiedEvaluation.caseBindings[caseRecord.id]||[];
    if(allSelected(snapshot.execution))return snapshot.unifiedEvaluation.bindings;
    return snapshot.unifiedEvaluation.bindings.filter(binding=>!binding.taskRef || coverage.some(item=>item.taskId===binding.taskRef.id && (!(binding.dimensionMappings||[]).length || binding.dimensionMappings.some(mapping=>item.dimensionIds.includes(mapping.dimensionId)))));
  }
  function decisionLabel(value) { return ({passed:'通过',failed:'未通过',inconclusive:'证据不足',not_applicable:'不适用',not_evaluated:'未评估'})[value] || '待评估'; }
  function recordAssessment(assessment,context={}) {
    const record={...clone(assessment),taskRef:clone(context.taskRef||context.task&&taskRef(context.task)),completion:context.completion||'completed',acceptance:assessment.decision,experimentId:context.experimentId||'',caseId:context.caseId||'',taskName:context.task?.name||context.taskName||''};
    const key=record.id||[record.runId,record.bindingId,record.targetRef?.id].join(':'), ledger=db().assessments;
    const index=ledger.findIndex(item=>(item.id||[item.runId,item.bindingId,item.targetRef?.id].join(':'))===key);if(index>=0)ledger[index]=record;else ledger.unshift(record);
    if(ledger.length>2000)ledger.length=2000;save();return record;
  }
  function completeResult(experiment,run,index,status,completedAtMs) {
    if (!run.snapshot?.unifiedEvaluation) return source('evExperimentCompleteResult')(experiment,run,index,status,completedAtMs);
    // Preserve the established Agent/conversation/trace lifecycle; its temporary legacy scores are replaced below.
    source('evExperimentCompleteResult')(experiment,run,index,status,completedAtMs);
    const demoStatus=global.AIOpsEvaluationDemoRuntime?.prepareResult(experiment,run,index,status);if(demoStatus)status=demoStatus;
    const snapshot=run.snapshot, result=run.results[index], caseRecord=snapshot.cases.find(item=>item.id===result.caseId);
    result.completion=status==='运行失败'?'failed':'completed';if(allSelected(snapshot.execution))result.evaluationPolicy='all_selected';result.assessments=[];result.dimensions=[];result.evaluations=[];
    if(Object.prototype.hasOwnProperty.call(snapshot,'agentRuntimeSnapshot'))result.agentRuntimeSnapshot=freeze(clone(snapshot.agentRuntimeSnapshot));
    if(Object.prototype.hasOwnProperty.call(snapshot,'judgeRuntimeSnapshot'))result.judgeRuntimeSnapshot=freeze(clone(snapshot.judgeRuntimeSnapshot));
    if (!result.enabled || status==='运行失败') {result.acceptance='inconclusive';return;}
    const bindings=relevantBindings(snapshot,caseRecord),simple=allSelected(snapshot.execution),coverage=snapshot.unifiedEvaluation.caseBindings[caseRecord.id]||[];
    for (const binding of bindings) {
      const target=evaluationTarget(binding),conversation=target==='conversation',allMessages=clone(result.messages||[]).map(message=>{delete message.expected;return message;}),firstAssistant=allMessages.findIndex(message=>message.role==='assistant'||message.role==='agent'),inputMessages=conversation?allMessages:allMessages.slice(0,firstAssistant<0?1:firstAssistant+1),evidenceMessageIds=inputMessages.map(message=>message.id).filter(Boolean);
      const evaluator=snapshot.unifiedEvaluation.evaluatorVersions.find(item=>refKey(evaluatorRef(item))===refKey(binding.evaluatorRef)),related=(binding.businessMappings||[]).filter(item=>coverage.some(covered=>covered.taskId===item.taskRef.id)),coveredTasks=snapshot.tasks.filter(item=>coverage.some(covered=>covered.taskId===item.id)),task=binding.taskRef?snapshot.tasks.find(item=>item.id===binding.taskRef.id):simple?(related.length===1?snapshot.tasks.find(item=>item.id===related[0].taskRef.id):coveredTasks.length===1?coveredTasks[0]:undefined):undefined,context={runId:run.id,bindingId:binding.id,target:{type:conversation?'session':'case_output',id:conversation?result.conversationId:result.id,snapshotId:run.id+':'+result.id+':'+target,sessionId:result.conversationId,input:result.input,output:conversation?(result.finalResponse||[...allMessages].reverse().find(message=>message.role==='assistant'||message.role==='agent')?.content||result.actual):(result.firstResponse??result.actual),messages:inputMessages,trajectory:clone((result.trace?.spans||[]).filter(span=>span.parentId&&!/本地评分/.test(span.name||'')&&(conversation||span.turn===1))),evidenceRefs:evidenceMessageIds.length?evidenceMessageIds:[result.id],completion:result.completion,completed:result.completion==='completed'},case:conversation?{input:caseRecord.input}:{input:caseRecord.input,expected:caseRecord.expected},...(task?{task}:{} ),...(snapshot.judgeRuntimeSnapshot?{judgeRuntime:clone(snapshot.judgeRuntimeSnapshot)}:{}),...(snapshot.agentRuntimeSnapshot?{agentRuntimeSnapshot:clone(snapshot.agentRuntimeSnapshot)}:{})};
      attachSourceEvidence(context,result,caseRecord,conversation);
      global.AIOpsEvaluationDemoRuntime?.attachEvidence(context,experiment,run,result,caseRecord,conversation);
      const effectiveBinding={...binding,evaluationTarget:target,targetType:context.target.type,inputMapping:clone(binding.inputMapping||inputMapping(evaluator,context.target.type))};
      if(conversation)for(const [key,path] of Object.entries(effectiveBinding.inputMapping))if(path==='/case/expected')effectiveBinding.inputMapping[key]='/target/reference';
      let assessment;
      try { assessment=model().assess(evaluator,context,effectiveBinding); }
      catch (error) { assessment={id:run.id+':'+binding.id+':'+result.id,runId:run.id,bindingId:binding.id,targetRef:context.target,evaluatorRef:binding.evaluatorRef,executionStatus:'failed',decision:'inconclusive',metricResults:[],aggregate:null,usage:{tokens:0,cost:0,currency:'USD'},evaluatedAt:new Date().toISOString(),error:{message:error.message}}; }
      assessment={...assessment,evaluatorSnapshot:clone(evaluator),bindingSnapshot:clone(effectiveBinding),bindingId:binding.id,role:binding.role,target,participation:binding.role,inputMessages:clone(inputMessages),evidenceMessageIds:clone(evidenceMessageIds)};result.assessments.push(assessment);
      if(simple){const attributedTasks=[...new Map(related.map(item=>[item.taskRef.id,snapshot.tasks.find(task=>task.id===item.taskRef.id)])).values()].filter(Boolean);for(const attributed of attributedTasks)recordAssessment({...assessment,id:assessment.id+':task:'+attributed.id,sourceAssessmentId:assessment.id},{task:attributed,completion:result.completion,experimentId:experiment.id,caseId:result.caseId});}
      else if(task)recordAssessment(assessment,{task,completion:result.completion,experimentId:experiment.id,caseId:result.caseId});
      const scored=assessment.metricResults||[], aggregate=assessment.aggregate;
      result.evaluations.push({evaluatorId:evaluator.id,name:evaluator.name,version:evaluator.version,bindingId:binding.id,role:binding.role,target,participation:binding.role,inputMessages:clone(inputMessages),evidenceMessageIds:clone(evidenceMessageIds),decision:assessment.decision,passed:assessment.decision==='passed'?true:assessment.decision==='failed'?false:null,score:v4Evaluator(evaluator)&&evaluator.decision.mode==='weighted_score'?numericAggregate(aggregate):promptAuthored(evaluator)||itemCentric(evaluator)?null:numericAggregate(aggregate),policyResult:clone(assessment.policyResult),finalJudgeInputSnapshot:clone(assessment.finalJudgeInputSnapshot),finalJudgeResult:clone(assessment.finalJudgeResult),summaryResult:clone(assessment.summaryResult),reason:assessment.policyResult?.reason||scored.map(item=>item.reason).filter(Boolean).join('；')||assessment.error?.message||decisionLabel(assessment.decision),criteria:promptAuthored(evaluator)?[]:scored.map(item=>{const metric=metrics(evaluator).find(metric=>metric.id===item.metricId),decision=metricDecision(evaluator,item);return {id:item.metricId,name:metric?.name||item.metricId,description:metric?.standard||metric?.description||'',standard:metric?.standard||'',score:typeof item.value==='number'?item.value:null,value:clone(item.value),passed:decision==='passed'?true:decision==='failed'?false:null,decision,participates:metricParticipates(evaluator,item.metricId),validationStatus:item.validationStatus,rawValue:clone(item.rawValue),subResults:clone(item.subResults),weight:metric?.weight||0,passScore:metric?.scoring?.passThreshold??metric?.threshold?.value??null,reason:item.reason};})});
      const attribution=binding.role!=='gate'?[]:simple?(binding.businessMappings||[]).flatMap(business=>{const attributedTask=snapshot.tasks.find(item=>item.id===business.taskRef.id);return (business.dimensionMappings||[]).map(mapping=>({mapping,task:attributedTask}));}):(binding.role==='gate'?binding.dimensionMappings||[]:[]).map(mapping=>({mapping,task}));
      for (const {mapping,task} of attribution) {
        if(!metricParticipates(evaluator,mapping.metricId))continue;
        const covered=(snapshot.unifiedEvaluation.caseBindings[caseRecord.id]||[]).some(item=>item.taskId===task?.id && item.dimensionIds.includes(mapping.dimensionId));
        if(!covered)continue;
        const dimension=task.dimensions.find(item=>item.id===mapping.dimensionId), metricResult=scored.find(item=>item.metricId===mapping.metricId);
        result.dimensions.push({taskId:task.id,taskName:task.name,dimensionId:dimension.id,name:dimension.name,description:dimension.description||'',value:clone(metricResult?.value??null),decision:metricResult?.decision||'inconclusive',passed:metricResult?.decision==='passed'?true:metricResult?.decision==='failed'?false:null,reason:metricResult?.reason||'未生成对应指标结果',assessmentId:assessment.id,evaluatorRef:clone(binding.evaluatorRef),metricId:mapping.metricId,subResults:clone(metricResult?.subResults)});
      }
    }
    // A covered business dimension needs an explicit primary source; never infer a pass from a generic judge.
    const missing=[];
    for(const coverage of snapshot.unifiedEvaluation.caseBindings[caseRecord.id]||[])for(const id of coverage.dimensionIds||[]){
      if(result.dimensions.some(item=>item.taskId===coverage.taskId&&item.dimensionId===id))continue;
      const task=snapshot.tasks.find(item=>item.id===coverage.taskId),dimension=task?.dimensions.find(item=>item.id===id);
      if(!dimension)continue;
      missing.push(dimension.name);result.dimensions.push({taskId:task.id,taskName:task.name,dimensionId:id,name:dimension.name,description:dimension.description||'',value:null,decision:simple?'not_evaluated':'inconclusive',passed:null,reason:simple?'该业务维度未配置参与通过判定的指标，未评估':'必测维度未配置 gate 条件指标映射，尚未评估'});
    }
    const gates=result.assessments.filter(item=>item.role==='gate'&&hasPassDecision(item.evaluatorSnapshot));
    result.evaluationExecutionStatus=result.assessments.some(item=>item.executionStatus==='failed')?'failed':result.assessments.some(item=>item.executionStatus==='succeeded')?'succeeded':'skipped';
    const evaluatedSummary=summarizeEvaluators(snapshot.execution,result.assessments,{ownerRef:{type:'experiment',id:experiment.id,configurationRevision:run.configurationRevision||snapshot.configurationRevision||null},targetRef:{type:'case_output',id:result.id,snapshotId:run.id+':'+result.id},judgeRuntimeSnapshot:snapshot.judgeRuntimeSnapshot,runId:run.id,...(global.AIOpsEvaluationDemoRuntime?.compositeContext(experiment,run,result)||{})});
    result.evaluatorSummaryResult=evaluatedSummary.summary;
    if(evaluatedSummary.policyResult){result.evaluatorPolicyResult=clone(evaluatedSummary.policyResult);result.evaluatorFinalJudgeInputSnapshot=clone(evaluatedSummary.finalJudgeInputSnapshot);result.evaluatorFinalJudgeResult=clone(evaluatedSummary.finalJudgeResult);}
    result.acceptance=simple?evaluatedSummary.decision:!gates.length?'not_applicable':gates.some(item=>item.decision==='failed')?'failed':!missing.length&&gates.every(item=>item.decision==='passed'&&item.executionStatus==='succeeded')?'passed':'inconclusive';
    result.status=({passed:'通过',failed:'未通过',inconclusive:'待确认',not_applicable:'仅观察'})[result.acceptance];
    result.reason=simple&&evaluatedSummary.policyResult?evaluatedSummary.policyResult.reason:simple?(gates.length?'评估结果：'+evaluatedSummary.summary.passed+' / '+gates.length+' 个参与判定的评估器通过；'+evaluatorSummaryLabel(snapshot.execution,bindings)+'；其余结果仅观察。':'评估已完成；没有参与通过判定的条件，仅观察。')+(result.acceptance==='inconclusive'?'部分条件缺少证据或无法判定，保留待确认。':''):'评估 · '+bindings.length+' 个适用绑定；业务完成：'+(result.completion==='completed'?'已完成':'未完成')+'；质量验收：'+decisionLabel(result.acceptance)+'。observe 结果仅供观察。'+(missing.length?'缺少维度映射：'+missing.join('、')+'。':'');
    evExperimentCompleteConversation(result,snapshot.execution);
    result.trace=evExperimentMockTrace(evExperimentRunContext(experiment,run),{...result,status:result.acceptance==='failed'?'未通过':'通过'});
    if(result.trace?.spans?.[0])result.trace.spans[0].output={status:result.status,completion:result.completion,acceptance:result.acceptance,actual:result.actual};
  }
  function pickerCatalog() {
    const groups=new Map();
    for(const evaluator of published()){
      if(!groups.has(evaluator.id))groups.set(evaluator.id,{id:evaluator.id,name:evaluator.name,description:evaluator.description||'',versions:[]});
      groups.get(evaluator.id).versions.push(evaluator);
    }
    for(const entry of groups.values()){
      entry.versions.sort((a,b)=>String(b.version).localeCompare(String(a.version),undefined,{numeric:true}));
      entry.name=entry.versions[0].name;entry.description=entry.versions[0].description||'';
    }
    return [...groups.values()];
  }
  function bindingEvaluator(binding) {
    return model().evaluator(binding.evaluatorRef.id,binding.evaluatorRef.version)
      || evExperimentEditor?.snapshot?.unifiedEvaluation?.evaluatorVersions?.find(item=>item.id===binding.evaluatorRef.id&&item.version===binding.evaluatorRef.version)
      || {id:binding.evaluatorRef.id,version:binding.evaluatorRef.version,name:binding.evaluatorRef.id,metrics:[],supportedTargets:[],inputSchema:{properties:{}}};
  }
  function evaluatorPicker(binding,index,callback,kind='experiment') {
    const entries=pickerCatalog(),selected=entries.find(item=>item.id===binding.evaluatorRef.id),record=bindingEvaluator(binding),label='绑定 '+(index+1)+' 选择评估器';
    const unavailable=selected?'':`<p class="ub-picker-unavailable">${html(record.name)} 已停用、已删除或没有已发布版本，请重新选择。</p>`;
    return `<details class="ev-multiselect ub-evaluator-picker"><summary class="ev-multiselect-trigger" aria-label="${label}"><span>${html(selected?.name||record.name||'请选择评估器')}</span>${evDropdownArrow()}</summary><div class="ev-choice-popover ub-evaluator-popover" data-ev-popover role="listbox" aria-label="${label}选项"><label class="ub-evaluator-search"><input type="search" aria-label="搜索绑定 ${index+1} 评估器" placeholder="搜索评估器名称或编号" oninput="AIOpsUnifiedBridge.filterEvaluatorPicker(this)"></label>${unavailable}${entries.map(entry=>`<button type="button" role="option" aria-selected="${entry.id===binding.evaluatorRef.id}"  data-ub-evaluator-option data-search-text="${html([entry.id,entry.name,entry.description].join(' ').toLowerCase())}" onclick="AIOpsUnifiedBridge.${callback}(${index},'evaluatorId',${html(JSON.stringify(entry.id))})"><span><b>${html(entry.name)}</b><small>${html(entry.id)}${!entry.versions.some(hasPassDecision)?' · 仅观察':''}</small></span><span class="ub-picker-check" aria-hidden="true">${entry.id===binding.evaluatorRef.id?'✓':''}</span></button>`).join('')}<p class="ub-evaluator-empty" data-ub-evaluator-empty ${entries.length?'hidden':''}>暂无匹配的已发布评估器</p></div></details>`;
  }
  function evaluatorVersionOptions(binding,kind='experiment') {
    const entry=pickerCatalog().find(item=>item.id===binding.evaluatorRef.id),versions=entry?.versions||[],selected=binding.evaluatorRef.version,available=versions.some(item=>item.version===selected);
    return (!available?`<option value="${html(selected)}" selected disabled>${html(selected)} · 原版本不可用，请更换</option>`:'')+versions.map((item,index)=>`<option value="${html(item.version)}" ${item.version===selected?'selected':''}>${html(item.version)}${!hasPassDecision(item)?' · 仅观察':index===0?' · 最新发布':''}</option>`).join('');
  }
  function replaceBindingEvaluator(binding,evaluator) {
    if(!evaluator)return;
    const sameEvaluator=binding.evaluatorRef.id===evaluator.id,metricIds=new Set(metrics(evaluator).map(metric=>metric.id));
    binding.evaluatorRef=evaluatorRef(evaluator);
    if(!hasPassDecision(evaluator))binding.role='observe';
    binding.dimensionMappings=sameEvaluator?(binding.dimensionMappings||[]).filter(mapping=>metricIds.has(mapping.metricId)):[];
    if(evaluationTarget(binding)==='conversation'&&!supportsConversation(evaluator)){binding.evaluationTarget='first_response';binding.targetType='case_output';}
    binding.inputMapping=inputMapping(evaluator,binding.targetType||'case_output');
  }
  function selectedTasks() { return (evExperimentEditor?.suiteIds||[]).flatMap(id=>{const suite=data().suites.find(item=>item.id===id);return suite?resolveSuite(suite).tasks:[];}).filter((task,index,list)=>list.findIndex(item=>item.id===task.id)===index); }
  function nextExperimentEvaluator(bindings) {
    const selected=new Set(bindings.map(binding=>binding.evaluatorRef.id));
    return pickerCatalog().find(entry=>!selected.has(entry.id))?.versions[0]||null;
  }
  function bindingEditor(bindings,kind='experiment',task=null) {
    const tasks=task?[task]:selectedTasks(),simulation=evExperimentEditor?.execution?.mode==='scenario_simulation',canAdd=kind==='task'||!!nextExperimentEvaluator(bindings),policy=kind==='experiment'?authoringCompositeSummary(evaluatorSummaryPolicy(evExperimentEditor?.execution)):null;
    return `<div id="ub-bindings" data-unified-bindings>${bindings.map((binding,index)=>{
      const evaluator=bindingEvaluator(binding),boundTask=tasks.find(task=>task.id===binding.taskRef?.id),callback=kind==='task'?'taskBindingChange':'bindingChange',target=evaluationTarget(binding),conversation=target==='conversation',showWeight=kind==='experiment'&&policy.mode==='weighted_score'&&binding.role==='gate'&&hasPassDecision(evaluator);
      const controls=[evField('评估器',evaluatorPicker(binding,index,callback,kind)),evField('版本',`<select name="unifiedEvaluatorVersion.${html(binding.id)}" aria-label="绑定 ${index+1} 评估器版本" onchange="AIOpsUnifiedBridge.${callback}(${index},'version',this.value)">${evaluatorVersionOptions(binding,kind)}</select>`)];
      if(kind!=='task')controls.push(evField('评估对象',`<select name="unifiedEvaluationTarget.${html(binding.id)}" aria-label="绑定 ${index+1} 评估对象" onchange="AIOpsUnifiedBridge.${callback}(${index},'target',this.value)"><option value="first_response" ${!conversation?'selected':''} ${supportsTarget(evaluator,'case_output')?'':'disabled'}>首轮回复</option><option value="conversation" ${conversation?'selected':''} ${simulation&&supportsConversation(evaluator)?'':'disabled'}>整段会话${!simulation?'（多轮执行可选）':!supportsConversation(evaluator)?'（当前评估器不兼容）':''}</option></select>`));
      else {
        controls.push(evField('作用',`<select name="unifiedEvaluationRole.${html(binding.id)}" aria-label="绑定 ${index+1} 作用" onchange="AIOpsUnifiedBridge.${callback}(${index},'role',this.value)"><option value="gate" ${binding.role==='gate'?'selected':''} ${hasPassDecision(evaluator)?'':'disabled'}>参与通过判定</option><option value="observe" ${binding.role==='observe'?'selected':''}>仅观察</option></select><small class="ub-binding-help">配置业务任务的推荐判定方式；离线实验单独设置评估器汇总判定。</small>`));
        if(!automaticEvidence(evaluator))for(const key of Object.keys(evaluator.inputSchema?.properties||{}))controls.push(evField('输入变量「'+key+'」',`<select aria-label="绑定 ${index+1} 输入 ${html(key)}" onchange="AIOpsUnifiedBridge.${callback}(${index},'input:${html(key)}',this.value)"><option value="">不提供</option>${[['/target/output','实际回复'],['/target/input','实际输入'],['/case/expected','用例预期输出（首轮）'],['/target/messages','本次对话记录'],['/target/trajectory','执行轨迹'],['/task','业务任务定义']].map(([path,label])=>`<option value="${path}" ${binding.inputMapping?.[key]===path?'selected':''}>${label}</option>`).join('')}</select>`,'',(evaluator.inputSchema?.required||[]).includes(key)));
        if(boundTask)for(const dimension of boundTask.dimensions||[])controls.push(evField('维度「'+dimension.name+'」对应指标',`<select aria-label="维度 ${html(dimension.id)} 对应指标" onchange="AIOpsUnifiedBridge.${callback}(${index},'dimension:${html(dimension.id)}',this.value)"><option value="">不映射此维度</option>${metrics(evaluator).map(metric=>`<option value="${html(metric.id)}" ${binding.dimensionMappings?.some(mapping=>mapping.dimensionId===dimension.id&&mapping.metricId===metric.id)?'selected':''} ${metricParticipates(evaluator,metric.id)?'':'disabled'}>${html(metric.name||metric.id)}${metricParticipates(evaluator,metric.id)?'':' · 仅观察'}</option>`).join('')}</select><small class="ub-binding-help">离线实验会继承这里配置的业务维度与评估指标关系。</small>`,'',false));
      }
      if(showWeight){const weight=policy.weights?.find(part=>part.bindingId===binding.id);controls.push(evField('权重',`<input name="evaluatorSummaryWeight.${html(binding.id)}" aria-label="评估器权重 ${html(evaluator.name||binding.evaluatorRef.id)}" type="number" min="0" max="1" step="0.01" placeholder="0–1" value="${html(weight?.weight??'')}" oninput="AIOpsUnifiedBridge.evaluatorSummaryChange('weight:${html(binding.id)}',this.value)">`));}
      return `<section class="ont-execution" data-ub-binding-id="${html(binding.id)}"><div class="ont-grid${kind==='task'?'':' ub-experiment-evaluator-row'}${showWeight?' has-weight':''}">${controls.join('')}</div><button type="button" class="ont-link danger" onclick="AIOpsUnifiedBridge.${kind==='task'?'removeTaskBinding':'removeBinding'}(${index})">${kind==='task'?'移除此绑定':'移除评估器'}</button></section>`;
    }).join('')}<button type="button" class="ont-button" ${canAdd?'':'disabled aria-disabled="true" '}onclick="AIOpsUnifiedBridge.${kind==='task'?'addTaskBinding':'addBinding'}()">${kind==='task'?'＋ 添加评估绑定':canAdd?'＋ 添加评估器':pickerCatalog().length?'全部可用评估器已添加':'暂无可用评估器'}</button></div>`;
  }
  function choices() {
    const bindings=experimentFormBindings(clone(formPlan || defaultBindings([])));
    if(evExperimentEditor){if(evExperimentEditor.evaluatorWeightsInitialized===undefined)evExperimentEditor.evaluatorWeightsInitialized=!!formEvaluatorSummary?.weights?.length;evExperimentEditor.unifiedBindings=bindings;evExperimentEditor.execution={...evExperimentEditor.execution,evaluationPolicy:'all_selected',evaluatorSummary:clone(formEvaluatorSummary||newCompositeSummary())};initializeSummaryWeights(evExperimentEditor);}
    return `<section id="ev-experiment-evaluation-config" data-ev-experiment-evaluation-config class="ont-form-section"><h3>评估配置</h3>${evaluatorSummaryEditor()}<h4>评估器</h4>${bindingEditor(bindings)}</section>`;
  }
  function initializeSummaryWeights(editor) {
    const policy=editor.execution?.evaluatorSummary,gates=(editor.unifiedBindings||[]).filter(binding=>binding.role==='gate');
    if(policy?.mode==='weighted_score'&&!editor.evaluatorWeightsInitialized&&gates.length){policy.weights=gates.map(binding=>({bindingId:binding.id,weight:1/gates.length}));editor.evaluatorWeightsInitialized=true;}
  }

  function evaluatorSummaryEditor() {
    const editor=evExperimentEditor||{},policy=authoringCompositeSummary(evaluatorSummaryPolicy(editor.execution));
    const mode=evField('判定方式',`<select name="evaluatorSummaryMode" aria-label="实验通过判定方式" onchange="AIOpsUnifiedBridge.evaluatorSummaryChange('mode',this.value)">${[['weighted_score','评分'],['custom_prompt','自定义']].map(([value,label])=>`<option value="${value}" ${policy.mode===value?'selected':''}>${label}</option>`).join('')}</select>`);
    const fields=policy.mode==='weighted_score'?evField('总分通过阈值 ≥',`<input name="evaluatorSummaryThreshold" aria-label="实验总分通过阈值" type="number" min="0" max="100" step="1" value="${html(policy.passThreshold??'')}" oninput="AIOpsUnifiedBridge.evaluatorSummaryChange('threshold',this.value)">`):evField('最终判断提示词',`<textarea name="evaluatorSummaryPrompt" aria-label="实验最终判断提示词" rows="5" placeholder="依据真实评估器结果，定义整体通过、未通过和待确认的条件。" oninput="AIOpsUnifiedBridge.evaluatorSummaryChange('prompt',this.value)">${html(policy.customPrompt||'')}</textarea>`,'',true);
    return `<div id="ub-evaluator-summary" class="ub-evaluator-summary"><h4>通过判定</h4><div class="ont-grid">${mode}${fields}</div></div>`;
  }
  function readCompositeSummaryFields(fields,editor) {
    const previous=authoringCompositeSummary(editor.execution.evaluatorSummary),mode=fields.get('evaluatorSummaryMode')||previous.mode;
    if(!['weighted_score','custom_prompt'].includes(mode)||fields.get('evaluatorSummaryType')!=null||fields.get('evaluatorSummaryMinPassed')!=null)throw Error('通过判定只支持评分或自定义，请重新配置');
    const policy=newCompositeSummary(mode),number=value=>value==null||String(value).trim()===''?'':Number(value);
    if(mode==='weighted_score'){policy.passThreshold=number(fields.get('evaluatorSummaryThreshold')??previous.passThreshold);policy.weights=(editor.unifiedBindings||[]).filter(binding=>binding.role==='gate').map(binding=>({bindingId:binding.id,weight:number(fields.get('evaluatorSummaryWeight.'+binding.id)??previous.weights?.find(part=>part.bindingId===binding.id)?.weight)}));}
    else policy.customPrompt=fields.get('evaluatorSummaryPrompt')??previous.customPrompt??'';
    return policy;
  }
  function refreshEvaluatorSummary() { const node=global.document?.getElementById('ub-evaluator-summary');if(node)node.outerHTML=evaluatorSummaryEditor(); }
  function mutateBinding(bindings,index,key,value,tasks) {
    const binding=bindings[index];if(!binding)return;
    if(key==='evaluator'){replaceBindingEvaluator(binding,published().find(item=>refKey(evaluatorRef(item))===value));}
    else if(key==='evaluatorId'){if(value!==binding.evaluatorRef.id)replaceBindingEvaluator(binding,pickerCatalog().find(item=>item.id===value)?.versions[0]);}
    else if(key==='version'){replaceBindingEvaluator(binding,published().find(item=>item.id===binding.evaluatorRef.id&&item.version===value));}
    else if(key==='target'){binding.evaluationTarget=value;binding.targetType=value==='conversation'?'session':'case_output';for(const [variable,path] of Object.entries(binding.inputMapping||{}))if(path==='/case/expected'||path==='/target/reference')binding.inputMapping[variable]=value==='conversation'?'/target/reference':'/case/expected';}
    else if(key==='role')binding.role=value;
    else if(key==='task'){const task=tasks.find(item=>item.id===value);if(task)binding.taskRef=taskRef(task);else delete binding.taskRef;binding.dimensionMappings=[];}
    else if(key.startsWith('dimension:')){const dimensionId=key.slice(10);binding.dimensionMappings=(binding.dimensionMappings||[]).filter(item=>item.dimensionId!==dimensionId);if(value)binding.dimensionMappings.push({dimensionId,metricId:value});}
    else if(key.startsWith('input:')){const variable=key.slice(6);binding.inputMapping=binding.inputMapping||{};if(value)binding.inputMapping[variable]=value;else delete binding.inputMapping[variable];}
  }
  function refreshBindings() { const node=global.document?.getElementById('ub-bindings');if(evExperimentEditor){if(allSelected(evExperimentEditor.execution))evExperimentEditor.unifiedBindings=experimentFormBindings(evExperimentEditor.unifiedBindings||[],false);evExperimentEditor.execution=executionBindings(evExperimentEditor.execution,evExperimentEditor.unifiedBindings||[]);initializeSummaryWeights(evExperimentEditor);if(node)node.outerHTML=bindingEditor(evExperimentEditor.unifiedBindings||[]);refreshEvaluatorSummary();}if(evExperimentEditor?.judgeRuntime)refreshRuntimeEditor(evExperimentEditor); }
  function newBinding(task,evaluator=pickerCatalog().map(entry=>entry.versions[0]).find(Boolean)) { if(!evaluator)throw Error('请先发布一个评估器');return {id:'BIND-'+(++db().sequence),evaluatorRef:evaluatorRef(evaluator),...(task?{taskRef:taskRef(task)}:{}),role:hasPassDecision(evaluator)?'gate':'observe',targetType:'case_output',dimensionMappings:[],inputMapping:inputMapping(evaluator)}; }
  let taskForm=null;
  function editTaskBindings(id) {const task=data().tasks.find(item=>item.id===id);if(!task)return false;taskForm={task:taskSnapshot(task),bindings:clone(taskState(task).bindings)};const spec=taskForm.task.specification;evModal('配置业务任务评估绑定',`<section class="ont-form-section"><h3>结构化任务契约</h3><p class="ev-note">保留原自由提示词。请明确填写任务输入、输出和完成条件；历史提示词不会自动成为完成标准。</p>${[['inputContract','输入要求'],['outputContract','输出要求'],['completionCriteria','完成条件']].map(([key,label])=>evField(label,`<textarea id="ub-task-${key}" aria-label="业务任务${label}" rows="3">${html(spec[key])}</textarea>`)).join('')}</section><section class="ont-form-section"><h3>推荐评估绑定</h3><p class="ev-note">这些推荐绑定可用于离线实验与在线评测；维度使用稳定编号，重命名后编号保留。</p>${bindingEditor(taskForm.bindings,'task',taskForm.task)}</section>`,'<button type="button" class="ont-button strong" onclick="AIOpsUnifiedBridge.saveTaskBindings()">保存任务契约与绑定</button>');return true;}
  function taskResults(id) {
    const offline=clone(db().assessments.filter(item=>item.taskRef?.id===id)),online=typeof model().assessments==='function'?model().assessments().filter(item=>(item.taskSnapshot?.id||item.taskRef?.id||item.bindingSnapshot?.taskRef?.id)===id).map(item=>{
      const target=item.targetSnapshot||{},task=item.taskSnapshot||{},job=typeof model().job==='function'?model().job(item.jobId):null;
      const completion=target.completion || (target.completed===true?'completed':target.error?'failed':'running');
      return {...clone(item),taskRef:item.taskRef||{id:task.id||id,version:task.version||item.bindingSnapshot?.taskRef?.version},completion,acceptance:item.decision,sourceName:'在线评测 · '+(job?.name||item.jobId||'会话分析')};
    }):[];
    return [...new Map([...offline,...online].map(item=>[item.id,item])).values()].sort((a,b)=>text(b.evaluatedAt).localeCompare(text(a.evaluatedAt)));
  }
  function enrichTask(task) {
    if(!task)return null;
    const id=taskScene(task),catalog=evCatalog[id]||(evCatalog[id]=evSeedScene(id)),raw=catalog.tasks.find(item=>item.id===task.id)||task,snapshot=taskSnapshot({...raw,scene:id});
    return {...clone(task),dimensions:snapshot.dimensions,specification:snapshot.specification,evaluationBindings:snapshot.evaluationBindings,unifiedRevision:snapshot.unifiedRevision,input:snapshot.specification.inputContract,output:snapshot.specification.outputContract,completion:snapshot.specification.completionCriteria};
  }
  function summary(run) {
    if(!run?.snapshot?.unifiedEvaluation&&!run?.results?.some(item=>item.assessments))return source('evExperimentSummary')(run);
    const rows=run.results||[],count=value=>rows.filter(item=>item.status===value).length,passed=count('通过'),failed=count('未通过'),errors=count('运行失败'),skipped=count('已跳过'),inconclusive=count('待确认'),observed=count('仅观察'),executed=passed+failed+errors+inconclusive+observed,durationMs=rows.reduce((sum,item)=>sum+(Number(item.durationMs)||0),0),decided=passed+failed;
    return {total:rows.length,finished:executed+skipped,passed,failed,errors,skipped,inconclusive,observed,pending:count('待运行'),running:count('运行中'),executed,decided,passRate:decided?passed/decided*100:null,durationMs,avgDurationMs:executed?durationMs/executed:0,tokens:rows.reduce((sum,item)=>sum+(Number(item.tokens)||0),0)};
  }
  function suiteCoverage(suite) {
    const resolved=resolveSuite(suite), dimensions=resolved.tasks.flatMap(task=>task.dimensions.map(dimension=>({task,dimension}))), covered=new Set(), configured=new Set();
    Object.values(resolved.pinned.caseBindings).flat().forEach(binding=>binding.dimensionIds.forEach(id=>covered.add(binding.taskId+':'+id)));
    for(const {task,dimension} of dimensions)if((task.evaluationBindings||[]).some(binding=>(binding.dimensionMappings||[]).some(mapping=>mapping.dimensionId===dimension.id)))configured.add(task.id+':'+dimension.id);
    return {total:dimensions.length,caseCovered:covered.size,bindingCovered:configured.size,pinned:resolved.pinned};
  }
  function caseVerdictLabel(decision) { return ({passed:'通过',failed:'未通过',inconclusive:'待确认',not_applicable:'仅观察',not_evaluated:'未评估'})[decision]||'待确认'; }
  function caseVerdictTag(decision,label,extra='') {
    const kind=decision==='passed'?'good':decision==='failed'?'bad':'';
    return `<span class="ont-badge ub-result-verdict ${kind}${extra?' '+extra:''}" data-decision="${html(decision||'inconclusive')}">${html(label||caseVerdictLabel(decision||'inconclusive'))}</span>`;
  }
  function caseValueLabel(value) { return value==null?'待确认':typeof value==='number'?String(Number(value.toPrecision(12))):typeof value==='object'?JSON.stringify(value):String(value); }
  function caseOptionPass(evaluator,metric,value) {
    if(!metricParticipates(evaluator,metric.id))return null;
    if(itemCentric(evaluator)) {
      if(metric.valueType==='boolean')return typeof metric.boolean?.passValue==='boolean'?metric.boolean.passValue===value:null;
      if(metric.valueType==='category')return metric.categories?.find(category=>category.code===value)?.pass??null;
    }
    const rules=passConditions(evaluator).filter(rule=>rule.metricId===metric.id);
    if(!rules.length)return null;
    const checks=rules.map(rule=>{
      if(rule.operator==='equals')return value===rule.value;
      if(rule.operator==='not_equals')return value!==rule.value;
      if(rule.operator==='in')return Array.isArray(rule.value)?rule.value.includes(value):null;
      return null;
    });
    return checks.includes(null)?null:checks.every(Boolean);
  }
  function caseItemOptionsRead(evaluator,metric,result) {
    const options=metric.valueType==='boolean'?[{code:true,label:'true'},{code:false,label:'false'}]:metric.valueType==='category'?(metric.categories||[]):[];
    if(!options.length)return '';
    return `<div class="ub-item-rule-options" aria-label="${html((metric.name||metric.id)+'的取值与通过规则')}">${options.map(option=>{
      const pass=caseOptionPass(evaluator,metric,option.code),selected=result.value!=null&&!['missing','invalid'].includes(result.validationStatus)&&result.value===option.code,decision=pass===null?'not_applicable':pass?'passed':'failed';
      return `<div class="ub-item-rule-option" data-value="${html(option.code)}" data-selected="${selected}" data-pass="${pass===null?'observe':pass}"><span>${html(option.label||option.code)}${selected?'<small class="ub-item-selected-label">本次结果</small>':''}</span>${caseVerdictTag(decision,pass===null?'仅观察':pass?'通过':'未通过')}</div>`;
    }).join('')}</div>`;
  }
  function caseItemResultsRead(evaluator,assessment) {
    if(promptAuthored(evaluator))return '<div class="ub-prompt-observation"><span class="ub-result-context">提示词配置 · 整体判断</span></div>';
    const items=(assessment.metricResults||[]).map(result=>{
      const metric=metrics(evaluator||{}).find(item=>item.id===result.metricId)||{id:result.metricId,name:result.metricId,valueType:'text'},participates=assessment.legacyResultView?result.recordedParticipation!==false:metricParticipates(evaluator,result.metricId),decision=assessment.legacyResultView?result.decision||'inconclusive':metricDecision(evaluator,result),label=participates?caseVerdictLabel(decision):'仅观察'+(result.validationStatus==='missing'?' · 缺少结果':result.validationStatus==='invalid'?' · 结果格式异常':''),tagDecision=participates?decision:'not_applicable',raw=result.validationStatus==='invalid'&&Object.prototype.hasOwnProperty.call(result,'rawValue')?result.rawValue:result.value,category=metric.valueType==='category'?metric.categories?.find(item=>item.code===raw):null;
      let actual='';
      if(metric.valueType==='number'&&itemCentric(evaluator))actual=v4Evaluator(evaluator)?directScoreResultRead(metric,result):`<p>本项加权得分：<b>${html(raw??'—')}</b> / 100 · 通过阈值：${html(metric.scoring?.passThreshold)}</p>`;
      else actual=`<div class="ub-metric-value"><span>${metric.valueType==='text'?'观察结果':'本次结果'}</span><strong>${html(category?.label||caseValueLabel(raw))}</strong></div>`;
      const rules=!itemCentric(evaluator)?passConditions(evaluator).filter(rule=>rule.metricId===metric.id).map(rule=>conditionLabel(evaluator,rule)).join('，'):'';
      const weight=v4Evaluator(evaluator)&&evaluator.decision.mode==='weighted_score'&&metric.valueType!=='text'?`<span class="ub-item-weight">权重 ${html(metric.weight)}</span>`:'';
      return `<article class="ub-metric-result" data-metric-id="${html(result.metricId)}" data-decision="${html(tagDecision)}"><header><strong>${html(metric.name||result.metricId)}</strong><span class="ont-badge ub-item-type">${html(itemTypeLabel(metric))}</span>${caseVerdictTag(tagDecision,label)}</header>${actual}${caseItemOptionsRead(evaluator,metric,result)}${rules?'<p class="ub-item-threshold">通过条件：'+html(rules)+'</p>':''}${weight}</article>`;
    }).join('');
    return `<div class="ub-metric-results" aria-label="评估项结果">${items||'<div class="ont-empty">尚无评估项结果</div>'}</div>`;
  }
  function caseAssessmentPolicyRead(evaluator,assessment) {
    const policy=assessment.policyResult,summary=assessment.summaryResult;
    if(assessment.legacyResultView)return `<div class="ub-assessment-score"><span>汇总得分：<b>${html(aggregateDisplay(evaluator,assessment.aggregate))}</b> / 100</span><span>历史运行结果</span></div>`;
    if(promptAuthored(evaluator))return '';
    if(policy?.mode==='weighted_score')return `<div class="ub-assessment-score"><span>加权总分：<b>${html(aggregateDisplay(evaluator,policy.score))}</b> / 100</span><span>整体阈值：${html(policy.threshold)}</span></div>`;
    if(policy?.mode==='custom_prompt')return '<div class="ub-assessment-score"><span>判定方式</span><span>自定义</span></div>';
    if(summary)return summary.total?'<div class="ub-assessment-score"><span>历史评估结果</span></div>':'<div class="ub-assessment-score"><span>文本评估项</span><span>仅观察</span></div>';
    return aggregateRead(evaluator,assessment);
  }
  function caseEvaluatorRead(result,assessment,snapshot) {
    const evaluated=(result.evaluations||[]).find(item=>item.bindingId===assessment.bindingId),evaluator=assessmentEvaluator(assessment,snapshot),name=evaluated?.name||evaluator?.name||evaluatorName(assessment.evaluatorRef),version=assessment.evaluatorRef?.version||evaluated?.version||'',decision=assessment.executionStatus==='failed'?'inconclusive':assessment.decision||'inconclusive';
    return {assessment,evaluated,evaluator,name,version,decision};
  }
  function caseDecisionRecord(paragraphs) {
    return `<details class="ub-result-details ub-decision-record"><summary>判定记录</summary>${paragraphs.filter(Boolean).map(value=>'<p class="ub-result-reason">'+html(value)+'</p>').join('')||'<p class="ub-result-reason">本次运行未保存判定原因。</p>'}</details>`;
  }
  function caseAssessmentRecord(assessment,evaluator) {
    const policy=assessment.policyResult,paragraphs=[],label=caseVerdictLabel(assessment.decision);
    if(assessment.executionStatus!=='succeeded')paragraphs.push(assessment.error?.message||'本次评估未完成，尚无可靠的评估结果，保留待确认。');
    if(policy?.mode==='weighted_score') {
      const parts=(policy.contributions||[]).map(part=>{const item=metrics(evaluator||{}).find(metric=>metric.id===part.metricId);return `${item?.name||part.metricId}：${part.normalizedScore==null?'待确认':caseValueLabel(part.normalizedScore)+' 分'}，权重 ${caseValueLabel(part.weight)}，计入 ${part.weightedScore==null?'待确认':caseValueLabel(part.weightedScore)+' 分'}`;});
      paragraphs.push(parts.join('；')+(parts.length?'。':''));
      paragraphs.push(policy.score==null?'参与评分的评估项缺证或结果无效，未补零或重分权重，本次保留待确认。':`加权总分为 ${caseValueLabel(policy.score)} 分，通过阈值为 ${caseValueLabel(policy.threshold)} 分，本次结果为${label}。`);
    } else if(policy?.mode==='custom_prompt') {
      if(evaluator?.decision?.customPrompt)paragraphs.push('自定义评估标准：'+evaluator.decision.customPrompt);
      paragraphs.push(assessment.finalJudgeResult?.reason||policy.reason||assessment.reason);
    } else if(promptAuthored(evaluator))paragraphs.push((assessment.metricResults||[]).find(item=>item.metricId==='overall_verdict')?.reason||assessment.reason);
    else paragraphs.push(assessment.reason);
    for(const result of assessment.metricResults||[]) {
      if(promptAuthored(evaluator))break;
      const metric=metrics(evaluator||{}).find(item=>item.id===result.metricId),name=metric?.name||result.metricId,decision=assessment.legacyResultView?result.decision:metricDecision(evaluator,result),value=caseValueLabel(result.value);
      if(result.validationStatus==='invalid')paragraphs.push(`${name}：返回值 ${caseValueLabel(result.rawValue)} 不符合当前评估项的类型或范围要求，结果待确认。`);
      else if(result.value==null)paragraphs.push(`${name}：缺少可核验结果，保留待确认。`);
      else if(metric?.valueType==='text')paragraphs.push(`${name}：记录观察信息，仅展示，不计入评分。`);
      else {
        const category=metric?.valueType==='category'?metric.categories?.find(item=>item.code===result.value):null,actual=category?.label||value,rule=itemCentric(evaluator)&&metric?itemRuleLabel(metric,evaluator):passConditions(evaluator).filter(item=>item.metricId===result.metricId).map(item=>conditionLabel(evaluator,item)).join('，');
        paragraphs.push(`${name}：本次结果为 ${actual}${metric?.valueType==='number'?' 分':''}${rule?'，通过条件为“'+rule+'”':''}，本项${caseVerdictLabel(decision)}。`);
      }
      if(result.reason&&!/^本地 (?:Mock|LLM Judge Mock)/.test(result.reason))paragraphs.push(result.reason);
      if(result.subResults?.length)paragraphs.push('历史评分分项：'+result.subResults.map(part=>`${part.name||part.id} ${caseValueLabel(part.value)} 分${part.weight!=null?'，权重 '+caseValueLabel(part.weight):''}`).join('；')+'。');
    }
    if(assessment.role==='observe')paragraphs.push('该评估器本次仅观察，不参与用例最终通过判定。');
    return caseDecisionRecord([...new Set(paragraphs.filter(Boolean))]);
  }
  function caseFinalRecord(result,snapshot,entries) {
    const policy=result.evaluatorPolicyResult,paragraphs=[],label=caseVerdictLabel(result.acceptance),outcomes=entries.map(entry=>entry.name+'：'+caseVerdictLabel(entry.decision)+(entry.assessment.role==='observe'?'（仅观察）':''));
    if(outcomes.length)paragraphs.push('各评估器结果：'+outcomes.join('；')+'。');
    if(policy?.mode==='weighted_score') {
      const parts=(policy.contributions||[]).map(part=>`${part.name||part.evaluatorName||part.bindingId} ${caseValueLabel(part.normalizedScore??part.score)} × ${caseValueLabel(part.weight)} = ${caseValueLabel(part.weightedScore)}`);
      if(parts.length)paragraphs.push('评分过程：'+parts.join('；')+'。');
      paragraphs.push(policy.score==null?'参与评分的结果缺证或执行异常，尚不能形成可靠的总分；本次保留待确认。':`加权总分 ${caseValueLabel(policy.score)} 分，通过阈值 ${caseValueLabel(policy.threshold)} 分，因此本次${label}。`);
    } else if(policy?.mode==='custom_prompt') {
      const prompt=result.evaluatorFinalJudgeInputSnapshot?.policySnapshot?.customPrompt||snapshot.execution?.evaluatorSummary?.customPrompt;
      if(prompt)paragraphs.push('本次自定义标准：'+prompt);
      paragraphs.push(result.evaluatorFinalJudgeResult?.reason||policy.reason||result.reason);
      if(result.acceptance==='not_applicable')paragraphs.push('没有参与最终判定的评估器，本次仅记录观察。');
    } else paragraphs.push(result.reason||policy?.reason||'本次按历史运行保存的结论展示，未重新评判。');
    if(result.completion==='failed')paragraphs.push('业务执行未完成，尚无完整交付可供最终判定。');
    return caseDecisionRecord([...new Set(paragraphs.filter(Boolean))]);
  }
  function caseLegacyResultView(result,snapshot) {
    const assessments=(result.evaluations||[]).map((evaluation,index)=>{
      const fixed=(snapshot.unifiedEvaluation?.evaluatorVersions||snapshot.evaluators||[]).find(item=>item.id===evaluation.evaluatorId&&item.version===evaluation.version),criteria=(evaluation.criteria||[]).map((item,itemIndex)=>{
        const standards=fixed?.criteria||[],named=!item.id&&item.name?standards.filter(candidate=>candidate.name===item.name):[];
        const standard=item.id?standards.find(candidate=>candidate.id===item.id):named.length===1?named[0]:!item.name?standards[itemIndex]:null;
        return {...clone(standard||{}),...clone(item),id:item.id||standard?.id||'legacy-item-'+itemIndex};
      }),definition=fixed?.metrics?clone(fixed):{id:evaluation.evaluatorId,version:evaluation.version,name:evaluation.name,metrics:criteria.map(item=>({id:item.id,name:item.name,standard:item.description||item.standard||'',valueType:typeof item.value==='boolean'?'boolean':(Object.prototype.hasOwnProperty.call(item,'score')||typeof item.value==='number')?'number':'text',range:{min:0,max:100}})),aggregation:{type:'none'},decision:{type:'all_rules',rules:criteria.filter(item=>typeof item.passScore==='number').map(item=>({metricId:item.id,operator:'gte',value:item.passScore}))}};
      const decision=evaluation.decision||(evaluation.passed===true?'passed':evaluation.passed===false?'failed':'inconclusive');
      return {legacyResultView:true,legacyCriteria:criteria,id:'legacy-view-'+index,bindingId:evaluation.bindingId||'legacy-binding-'+index,evaluatorRef:{id:evaluation.evaluatorId,version:evaluation.version},evaluatorSnapshot:definition,role:evaluation.role||evaluation.participation||'gate',target:evaluation.target||evaluation.evaluationTarget,executionStatus:evaluation.executionStatus||'succeeded',decision,aggregate:evaluation.score??null,reason:evaluation.reason,metricResults:criteria.map(item=>({metricId:item.id,value:Object.prototype.hasOwnProperty.call(item,'value')?clone(item.value):item.score??null,decision:item.decision||(item.passed===true?'passed':item.passed===false?'failed':'inconclusive'),recordedParticipation:item.participates!==false,validationStatus:item.validationStatus,rawValue:clone(item.rawValue),reason:item.reason,subResults:clone(item.subResults)}))};
    });
    return {...result,legacyResultView:true,assessments,acceptance:result.acceptance||({通过:'passed',未通过:'failed',待确认:'inconclusive',仅观察:'not_applicable'})[result.status]||'inconclusive',completion:result.completion||(result.status==='运行失败'?'failed':'completed')};
  }
  function caseLegacyAnnotationRead(result,assessment) {
    if(!assessment.legacyResultView||typeof evExperimentResultAnnotation!=='function')return '';
    const id=assessment.evaluatorRef.id,annotation=evExperimentResultAnnotation(result.id,id);
    return evExperimentAnnotationSummary(annotation)+(result.isValidation?'':`<footer>${evAnnotationButton(`evExperimentAnnotateResult(${JSON.stringify(result.id)},${JSON.stringify(id)})`,annotation?'编辑评估结果标注':'标注评估结果',!!annotation)}<span>${annotation?'已标注':'未标注'}</span></footer>`);
  }
  function caseFinalResultRead(result,snapshot,entries) {
    const acceptance=result.acceptance||'inconclusive',policy=result.evaluatorPolicyResult,configured=evaluatorSummaryPolicy(snapshot.execution),mode=policy?.mode||(configured.type==='composite_policy'?configured.mode:null),modeLabel=({weighted_score:'评分',custom_prompt:'自定义'})[mode]||'历史判定';
    const stats=mode==='weighted_score'?`<div><dt>总分 / 通过阈值</dt><dd>${html(aggregateDisplay(null,policy?.score))} / ${html(policy?.threshold??configured.passThreshold??'—')}</dd></div>`:'';
    const outcomes=entries.map(({assessment,evaluator,name,version,decision})=>{
      const contribution=policy?.contributions?.find(item=>item.bindingId===assessment.bindingId),score=contribution?.normalizedScore??contribution?.score,observe=assessment.role==='observe'||!assessment.legacyResultView&&!hasPassDecision(evaluator),value=contribution?`${score==null?'待确认':caseValueLabel(score)+' 分'} · 权重 ${caseValueLabel(contribution.weight)}`:v4Evaluator(evaluator)&&assessment.policyResult?.mode==='weighted_score'?aggregateDisplay(evaluator,assessment.policyResult.score)+' / 100':assessment.legacyResultView&&typeof assessment.aggregate==='number'?caseValueLabel(assessment.aggregate)+' / 100':'';
      return `<div class="ub-final-evaluator" data-binding-id="${html(assessment.bindingId)}" data-decision="${html(decision)}"><div class="ub-final-evaluator-main"><strong>${html(name)}</strong><span class="ont-badge ub-result-version">${html(version||'版本未记录')}</span>${observe&&decision!=='not_applicable'?'<small class="ub-result-context">仅观察</small>':''}</div>${value?'<span class="ub-final-evaluator-value">'+html(value)+'</span>':''}${caseVerdictTag(decision)}</div>`;
    }).join('');
    return `<section class="ub-final-result" data-decision="${html(acceptance)}" aria-label="最终判定"><header class="ub-final-result-head"><strong>最终判定</strong><span class="ont-badge ub-final-mode">${html(modeLabel)}</span></header><div class="ub-final-verdict" data-decision="${html(acceptance)}">${html(caseVerdictLabel(acceptance))}</div>${stats?'<div class="ub-final-policy-summary"><div class="ub-final-stat-grid"><dl class="ont-mapping">'+stats+'</dl></div></div>':''}<div class="ub-final-outcomes" aria-label="各评估器最终结果">${outcomes||'<div class="ont-empty">尚无评估器结果</div>'}</div>${caseFinalRecord(result,snapshot,entries)}</section>`;
  }
  function assessmentCards(result) {
    const context=typeof evExperimentCaseDetailContext==='function'?evExperimentCaseDetailContext(result.id):null,snapshot=context?.run?.snapshot||{agentRuntimeSnapshot:result.agentRuntimeSnapshot,judgeRuntimeSnapshot:result.judgeRuntimeSnapshot};
    if(!result.assessments){if(!result.evaluations?.length)return source('evExperimentScoringResults')(result);result=caseLegacyResultView(result,snapshot);}
    const entries=result.assessments.map(assessment=>caseEvaluatorRead(result,assessment,snapshot)),cards=entries.map(({assessment,evaluated,evaluator,name,version,decision})=>{
      return `<article class="ub-evaluator-result" data-binding-id="${html(assessment.bindingId)}" data-decision="${html(decision)}"><header class="ub-evaluator-result-head"><strong>${html(name)}</strong><div class="ub-result-tags"><span class="ont-badge ub-result-version">${html(version||'版本未记录')}</span>${caseVerdictTag(decision)}</div></header><p class="ub-result-context">${html(targetLabel(assessment.target||evaluated?.target))} · ${html(({succeeded:'评估完成',failed:'评估异常',skipped:'未执行'})[assessment.executionStatus]||'历史未记录执行状态')}${assessment.role==='observe'?' · 仅观察':''}</p>${caseAssessmentPolicyRead(evaluator,assessment)}${caseItemResultsRead(evaluator,assessment)}${caseAssessmentRecord(assessment,evaluator)}${caseLegacyAnnotationRead(result,assessment)}</article>`;
    }).join('');
    return `<section class="ont-form-section ev-result-evaluations"><header class="ev-result-evaluations-heading"><h3>评估结果</h3><span>${entries.length} 个评估器</span></header>${caseFinalResultRead(result,snapshot,entries)}<div class="ub-evaluator-results">${cards||'<div class="ont-empty">该用例没有适用的评估绑定。</div>'}</div></section>`;
  }
  function issueVerificationDecision(issue,row,originalRow) {
    const unique=rows=>rows.length===1?rows[0]:null,unknown='inconclusive',judgment=issue.definition?.judgment;
    const decision=value=>!value||['missing','invalid'].includes(value.validationStatus)||value.participates===false?unknown:['passed','failed'].includes(value.decision)?value.decision:value.decision?unknown:value.passed===true?'passed':value.passed===false?'failed':unknown;
    const sameEvaluator=(value,id,version)=>(value.evaluatorRef?.id||value.evaluatorId)===id&&(value.evaluatorRef?.version||value.version)===version;
    const matchingAssessment=original=>unique((row.assessments||[]).filter(value=>sameEvaluator(value,original.evaluatorRef?.id||original.evaluatorId,original.evaluatorRef?.version||original.version)&&(!original.bindingId||value.bindingId===original.bindingId)&&(!original.target||value.target===original.target)));
    const assessmentDecision=value=>value?.executionStatus==='succeeded'?decision(value):unknown;
    if(!judgment||!originalRow||row.enabled===false||['待运行','运行中','已跳过','已停用'].includes(row.status))return unknown;
    if(judgment.kind==='runtime')return row.completion==='completed'?'passed':row.completion==='failed'||row.status==='运行失败'?'failed':unknown;
    if(judgment.kind==='dimension')return decision(unique((row.dimensions||[]).filter(value=>value.taskId===judgment.taskId&&(judgment.id?(value.dimensionId||value.id)===judgment.id:value.name===judgment.name&&value.description===judgment.description))));
    if(['criterion','evaluator'].includes(judgment.kind)){
      const original=unique((originalRow.evaluations||[]).filter(value=>sameEvaluator(value,judgment.evaluatorId,judgment.version)));
      if(!original)return unknown;
      const assessment=matchingAssessment(original);if(assessment?.executionStatus!=='succeeded')return unknown;
      if(judgment.kind==='evaluator')return decision(assessment);
      const definition=judgment.criterion||{},criterion=unique((original.criteria||[]).filter(value=>definition.id?value.id===definition.id:value.name===definition.name&&value.description===definition.description));
      return criterion?decision(unique((assessment.metricResults||[]).filter(value=>value.metricId===criterion.id))):unknown;
    }
    if(judgment.kind==='result'){
      const values=(originalRow.assessments||[]).filter(value=>value.role==='gate'&&hasPassDecision(value.evaluatorSnapshot)).map(value=>assessmentDecision(matchingAssessment(value)));
      return !values.length?unknown:values.includes('failed')?'failed':values.every(value=>value==='passed')?'passed':unknown;
    }
    return unknown;
  }
  function install() {
    if(initialized)return;initialized=true;
    for(const name of ['evModal','evField','evTaskDetail','evEditTask','evSaveTask','evSaveSuite','evSaveCaseBinding','evApplyCasePicker','evSaveCase','evRemoveSuiteCase','evPublishResource','evExperimentForm','evExperimentEvaluatorChoices','evExperimentEvaluationConfigRead','evEvaluatorSnapshot','evExperimentSnapshot','evCreateExperiment','evUpdateExperiment','evExperimentCompleteResult','evExperimentScoringResults','evExperimentScoringSnapshot','evExperimentResultEvaluator','evExperimentEvaluatorReport','evExperimentSuiteChange','evExperimentSummary','evExperimentDetectIssues','evExperimentReportExecuted','evExperimentReportBody','evExperimentResultHeading','evExperimentResultTurns','evExperimentCaseActions','evRunExperiment','evDashboardRunMetrics','evSubmitExperiment','evExperimentConfigurationKey','evExperimentNewExecution','evExperimentRunContext','evExperimentDetailTop','evExperimentReportRunFacts','evExperimentReportSimulationSummary','evExperimentIssueSyncVerification'])original[name]=global[name];
    evEvaluatorSnapshot=function(...args){return transaction?transaction.bindings.map(binding=>adapter(getEvaluator(binding.evaluatorRef))):source('evEvaluatorSnapshot')(...args);};
    evExperimentSnapshot=function(sourceData,agent,version,suites,evaluators,execution){return transaction?frozenPlan(sourceData,agent,version,Array.isArray(suites)?suites:[suites],transaction.bindings,execution):source('evExperimentSnapshot')(sourceData,agent,version,suites,evaluators,execution);};
    evCreateExperiment=createExperiment;evUpdateExperiment=updateExperiment;evExperimentCompleteResult=completeResult;
    evExperimentConfigurationKey=function(fields){
      const baseline=source('evExperimentConfigurationKey')(fields),unified=!!(transaction||fields.unifiedEvaluation||fields.snapshot?.unifiedEvaluation||fields.agentRuntimeOverride||fields.judgeRuntime);
      if(!unified)return baseline;
      const base=JSON.parse(baseline);delete base.execution.modelId;
      const runtime=transaction&&!fields.id?transaction.runtime:runtimeConfiguration(fields);
      const runtimeKey=typeof model().hash==='function'?model().hash(runtime):JSON.stringify(runtime);
      const evaluatorSummary=transaction&&!fields.id?transaction.evaluatorSummary:evaluatorSummaryPolicy(fields.execution||fields.snapshot?.execution);
      return JSON.stringify({base,runtimeKey,evaluatorSummary,modelLayers:fields.id&&!fields.snapshot?.unifiedEvaluation?'legacy':'separate'});
    };
    evExperimentNewExecution=function(experiment,id,sequence,snapshot,fields){
      const run=source('evExperimentNewExecution')(experiment,id,sequence,snapshot,fields);
      for(const key of ['agentRuntimeSnapshot','judgeRuntimeSnapshot'])if(Object.prototype.hasOwnProperty.call(run.snapshot||{},key))run[key]=freeze(clone(run.snapshot[key]));
      return run;
    };
    evExperimentRunContext=function(experiment,run){
      const result=source('evExperimentRunContext')(experiment,run);
      if(!run||run.experimentId!==experiment?.id)return result;
      for(const key of ['agentRuntimeOverride','agentRuntimeSnapshot','judgeRuntimeSnapshot']){if(Object.prototype.hasOwnProperty.call(run.snapshot||{},key))result[key]=clone(run.snapshot[key]);else delete result[key];}
      if(run.snapshot?.judgeRuntimeSnapshot)result.judgeRuntime=clone(run.snapshot.judgeRuntimeSnapshot);else delete result.judgeRuntime;
      return result;
    };
    evExperimentReportRunFacts=function(experiment,run){const facts=source('evExperimentReportRunFacts')(experiment,run);for(const key of ['agentRuntimeSnapshot','judgeRuntimeSnapshot'])if(Object.prototype.hasOwnProperty.call(run.snapshot||{},key))facts[key]=clone(run.snapshot[key]);return facts;};
    evExperimentReportSimulationSummary=function(snapshot,results=[]){
      const markup=source('evExperimentReportSimulationSummary')?.(snapshot,results)||'';
      if(!snapshot.unifiedEvaluation||!allSelected(snapshot.execution))return markup;
      const rule=evaluatorSummaryLabel(snapshot.execution,snapshot.unifiedEvaluation.bindings);
      return markup.replace(/<p class="ev-simulation-note">全部所选评估器通过，用例才通过。[\s\S]*?<\/p>/,`<p class="ev-simulation-note">${html(rule)}。按每次用例执行分别汇总；仅观察的评估器不计入数量。缺少证据或评估异常保留待确认，未通过的评估器结果仍完整保留。</p>`);
    };
    evExperimentDetailTop=function(experiment,run){const markup=stripLegacyModel(source('evExperimentDetailTop')(experiment,run));return markup?markup+runtimeRead(run?.snapshot||experiment.snapshot,!!run):markup;};
    evExperimentEvaluationConfigRead=function(experiment){
      const plan=experiment.snapshot?.unifiedEvaluation;if(!plan)return source('evExperimentEvaluationConfigRead')?.(experiment)||'';
      const simple=allSelected(experiment.snapshot.execution),headers=['评估器','版本','评估对象',...(simple?[]:['结果用途'])];
      return `<section class="ont-overview ev-experiment-evaluation-read"><div class="ont-section-title"><h3>评估配置</h3><button type="button" class="ont-link" onclick="evExperimentScoringSnapshot('current')">查看评估标准</button></div>${evTable([...headers,'固定条件与汇总'],plan.bindings.map(binding=>{const evaluator=plan.evaluatorVersions.find(item=>item.id===binding.evaluatorRef.id&&item.version===binding.evaluatorRef.version);return `<tr><td>${html(evaluator?.name||binding.evaluatorRef.id)}</td><td>${html(binding.evaluatorRef.version)}</td><td>${targetLabel(evaluationTarget(binding))}</td>${simple?'':`<td>${roleLabel(binding.role)}</td>`}<td><details><summary>查看固定标准</summary>${gradingRead(evaluator)}</details></td></tr>`;}))}<dl class="ont-mapping"><div><dt>评估器汇总判定</dt><dd>${html(evaluatorSummaryLabel(experiment.snapshot.execution,plan.bindings))}</dd></div></dl>${simple?'':'<p class="ev-simulation-note">历史配置：首轮回复结合用例预期输出；整段会话使用完整交互。仅观察的结果不影响通过判定。</p>'}</section>`;
    };
    evExperimentSummary=summary;
    evDashboardRunMetrics=function(experiment,run){
      const baseline=source('evDashboardRunMetrics')(experiment,run);if(!run?.snapshot?.unifiedEvaluation)return baseline;
      const s=summary(run),values={'case-executions':s.executed,'case-pass-rate':s.passRate,'case-duration':s.executed?s.durationMs/s.executed:null,'case-tokens':s.executed?s.tokens/s.executed:null},hints={'case-executions':'当前运行已执行的独立对话数，包含通过、未通过、待确认、仅观察和运行异常；跳过与尚在执行的用例不计。','case-pass-rate':'质量通过 ÷ 已有明确质量结论的用例；待确认、仅观察、运行异常均不进入质量通过率分母。','case-duration':'全部已执行独立对话的耗时 ÷ 执行次数，包含待确认、仅观察及运行异常。','case-tokens':'全部已执行独立对话的 Token 消耗 ÷ 执行次数，包含待确认、仅观察及运行异常。'};
      if(allSelected(run.snapshot.execution))Object.assign(hints,{'case-executions':'当前运行已执行的独立对话数，包含通过、未通过、待确认、仅观察和运行异常；跳过与尚在执行的用例不计。','case-pass-rate':evaluatorSummaryLabel(run.snapshot.execution,run.snapshot.unifiedEvaluation.bindings)+'；其余结果仅观察。通过率 = 通过 ÷ 已有明确质量结论；待确认、仅观察及运行异常不进入分母。','case-duration':'全部已执行独立对话的耗时 ÷ 执行次数，包含待确认、仅观察及运行异常。','case-tokens':'全部已执行独立对话的 Token 消耗 ÷ 执行次数，包含待确认、仅观察及运行异常。'});
      return baseline.map(metric=>({...metric,value:values[metric.id],hint:hints[metric.id],...(metric.id==='case-pass-rate'?{label:'质量验收通过率'}:{})}));
    };
    evExperimentDetectIssues=function(experiment,run){
      if(!run?.snapshot?.unifiedEvaluation)return source('evExperimentDetectIssues')(experiment,run);
      // Preserve original positions: shared finding IDs refer back to the frozen evaluator/item/dimension arrays.
      return source('evExperimentDetectIssues')(experiment,{...run,results:(run.results||[]).map(result=>({...result,evaluations:(result.evaluations||[]).map(item=>({...item,passed:item.role==='gate'&&item.decision==='failed'?false:null,criteria:(item.criteria||[]).map(criterion=>({...criterion,passed:item.role==='gate'&&criterion.decision==='failed'?false:null}))})),dimensions:(result.dimensions||[]).map(item=>({...item,passed:item.decision==='failed'&&!result.assessments?.some(assessment=>assessment.id===item.assessmentId&&assessment.role==='observe')?false:null}))}))});
    };
    evExperimentIssueSyncVerification=function(experiment,run){
      if(run?.kind!=='validation'||!run.snapshot?.unifiedEvaluation||!['at_least','composite_policy'].includes(run.snapshot.execution?.evaluatorSummary?.type)&&!run.snapshot.unifiedEvaluation.evaluatorVersions.some(v4Evaluator))return source('evExperimentIssueSyncVerification')(experiment,run);
      const issue=(experiment.issueLedger||[]).find(item=>item.id===run.validationIssueId);if(!issue)return source('evExperimentIssueSyncVerification')(experiment,run);
      const occurrence=issue.occurrences?.at(-1),originalRun=evExperimentIssueExecution(experiment,occurrence?.runId),originalRow=evExperimentIssueResult(originalRun,occurrence?.resultId);
      const adapted={...run,results:(run.results||[]).map(row=>row.caseId!==issue.caseId?row:{...row,status:({passed:'通过',failed:'未通过',inconclusive:'待确认'})[issueVerificationDecision(issue,row,originalRow)]})};
      return source('evExperimentIssueSyncVerification')(experiment,adapted);
    };
    evExperimentReportExecuted=function(result){return result.assessments?result.enabled!==false&&!['待运行','运行中','已跳过','已停用'].includes(result.status):source('evExperimentReportExecuted')(result);};
    evExperimentReportBody=function(experiment,run){
      const snapshot=run?.snapshot||experiment.snapshot,result=stripLegacyModel(source('evExperimentReportBody')(experiment,run))+runtimeRead(snapshot,true)+(typeof evExperimentReportSimulationSummary==='function'?evExperimentReportSimulationSummary(snapshot,run?.results||[]):'');
      if(!run?.snapshot?.unifiedEvaluation)return result;
      const s=summary(run),simple=allSelected(snapshot.execution);
      if(simple){const rule=evaluatorSummaryLabel(snapshot.execution,snapshot.unifiedEvaluation.bindings);return result.replace('通过 ÷ 已执行；已执行 = 通过 + 未通过 + 运行失败','通过 ÷ 已有明确质量结论；待确认及运行异常不进入质量通过率').replace('所有所选评估器的评分项均分别达标',html(rule)).replace('通过率不包含已跳过、待运行和运行中的用例','质量通过率仅统计已有明确通过／未通过结论的用例')+`<section class="ont-overview"><h3>判定覆盖</h3><p>已执行 ${s.executed} · 有明确质量结论 ${s.decided} · 待确认 ${s.inconclusive} · 仅观察 ${s.observed} · 运行异常 ${s.errors}。${html(rule)}；业务维度未映射只显示未评估。</p></section>`;}
      return result.replace('通过 ÷ 已执行；已执行 = 通过 + 未通过 + 运行失败','质量通过 ÷ 已有明确质量结论；待确认、仅观察及运行异常不进入质量通过率').replace('所有所选评估器的评分项均分别达标','所有适用 gate 绑定均通过且必测维度已映射').replace('通过率不包含已跳过、待运行和运行中的用例','质量通过率仅统计已有明确通过／未通过结论的用例')+`<section class="ont-overview"><h3>判定覆盖</h3><p>已执行 ${s.executed} · 有明确质量结论 ${s.decided} · 待确认 ${s.inconclusive} · 仅观察 ${s.observed} · 运行异常 ${s.errors}。缺失证据与缺失维度映射不作为业务质量失败。</p></section>`;
    };
    evExperimentResultHeading=function(context){
      const record=context.result,adapt=record?.assessments&&!['通过','未通过','运行失败'].includes(record.status);let markup=source('evExperimentResultHeading')(adapt?{...context,result:{...record,status:'通过'}}:context);
      if(adapt)markup=markup.replace('is-success','is-neutral').replace('<strong>通过</strong>','<strong>'+html(record.status)+'</strong>');
      const policy=record?.evaluatorPolicyResult;if(policy){
        const score=Number.isFinite(policy.score)?Number(policy.score.toFixed(2)):'—',summary=record.evaluatorSummaryResult,note=policy.mode==='weighted_score'?'加权 '+score+' 分 / 阈值 '+policy.threshold:policy.mode==='custom_prompt'?'自定义判定':summary?.total?summary.passed+' / '+summary.total+' 个评估器通过 · 至少 '+summary.required+' 个': '仅观察';
        markup=markup.replace(/(<div class="ev-result-outcome"[\s\S]*?<small>)[\s\S]*?(<\/small>)/,(_match,before,after)=>before+html(note)+after);
      }
      return markup;
    };
    evExperimentResultTurns=function(result){return source('evExperimentResultTurns')(result.assessments&&result.completion==='completed'?{...result,status:'通过'}:result);};
    evExperimentCaseActions=function(experiment,run,result,attempts,key){return source('evExperimentCaseActions')(experiment,run,result,(attempts||[result]).map(item=>item.assessments&&['待确认','仅观察'].includes(item.status)?{...item,status:'通过'}:item),key);};
    evRunExperiment=function(id,retrySource,caseId,options){
      if(!caseId||!retrySource?.snapshot?.unifiedEvaluation)return source('evRunExperiment')(id,retrySource,caseId,options);
      const rows=retrySource.results,adapted=rows.map(item=>item.caseId===caseId&&['待确认','仅观察'].includes(item.status)?{...item,status:'通过'}:item);
      // A synchronous compatibility view lets the existing rerun engine select completed cases without rewriting history.
      retrySource.results=adapted;try{return source('evRunExperiment')(id,retrySource,caseId,options);}finally{retrySource.results=rows;}
    };
    evExperimentEvaluatorChoices=choices;
    evExperimentForm=function(experiment){const previous=formPlan,previousRuntime=formRuntime,previousSummary=formEvaluatorSummary;formPlan=experiment?.snapshot?.unifiedEvaluation?.bindings || defaultBindings((experiment?.suiteIds||[]).map(id=>data().suites.find(item=>item.id===id)).filter(Boolean));formRuntime=runtimeConfiguration({},experiment);formEvaluatorSummary=experiment?authoringCompositeSummary(evaluatorSummaryPolicy(experiment?.snapshot?.execution||experiment?.execution)):newCompositeSummary();try{return source('evExperimentForm')(experiment);}finally{formPlan=previous;formRuntime=previousRuntime;formEvaluatorSummary=previousSummary;}};
    evField=function(label,control,...args){
      if(formRuntime&&label==='评测模型'){const selected=control.match(/<option value="([^"]+)" selected/)?.[1]||'mock-eval-balanced';return `<input type="hidden" name="modelId" value="${html(selected)}">`;}
      if(formRuntime)args[0]='';
      return source('evField')(label,control,...args);
    };
    evSubmitExperiment=function(form){
      if(!evExperimentEditor?.unifiedBindings)return source('evSubmitExperiment')(form);
      const previous=submitting;
      try{const fields=new FormData(form),editor=evExperimentEditor;editor.execution={...editor.execution,evaluationPolicy:'all_selected'};for(const binding of editor.unifiedBindings){const target=fields.get('unifiedEvaluationTarget.'+binding.id);if(target)mutateBinding(editor.unifiedBindings,editor.unifiedBindings.indexOf(binding),'target',target,selectedTasks());binding.role=binding.role==='observe'||!hasPassDecision(bindingEvaluator(binding))?'observe':'gate';}editor.execution.evaluatorSummary=normalizeEvaluatorSummary({...editor.execution,evaluatorSummary:readCompositeSummaryFields(fields,editor)},editor.unifiedBindings);editor.agentRuntimeOverride=normalizeAgentOverride({mode:fields.get('agentRuntimeMode')??editor.agentRuntimeOverride?.mode??'inherit',modelRef:fields.get('agentModelRef')??editor.agentRuntimeOverride?.modelRef,parameters:editor.agentRuntimeOverride?.parameters});editor.judgeRuntime=normalizeJudgeRuntime({modelRef:fields.get('judgeModelRef')??editor.judgeRuntime?.modelRef,parameters:editor.judgeRuntime?.parameters});submitting=true;return source('evSubmitExperiment')(form);}
      catch(error){const node=global.document?.getElementById('ev-experiment-form-error');if(node)node.textContent=error.message;toast(error.message);return false;}
      finally{submitting=previous;}
    };
    evExperimentSuiteChange=function(...args){const result=source('evExperimentSuiteChange')(...args);refreshBindings();return result;};
    evSaveTask=function(...args){const before=clone(data().tasks.map(item=>({id:item.id,dimensions:taskState(item).dimensions}))),result=source('evSaveTask')(...args);if(result){const id=args[1]||data().tasks[0].id,task=data().tasks.find(item=>item.id===id), prior=before.find(item=>item.id===id);if(prior)taskState(task).dimensions=prior.dimensions;taskState(task);save();}return result;};
    evModal=function(title,body,...args){if(formRuntime&&['新建评测实验','编辑评测实验'].includes(title)){evExperimentEditor.agentRuntimeOverride=clone(formRuntime.agentRuntimeOverride);evExperimentEditor.judgeRuntime=clone(formRuntime.judgeRuntime);body=body.replace(/<p\b[^>]*class="[^"]*\bev-note\b[^"]*"[^>]*>[\s\S]*?<\/p>/g,'')+runtimeEditor(formRuntime);}return source('evModal')(title,body,...args);};
    for(const name of ['evSaveSuite','evSaveCaseBinding','evApplyCasePicker','evSaveCase','evRemoveSuiteCase','evPublishResource'])global[name]=function(...args){const result=source(name)(...args);for(const suite of data().suites)captureSuite(suite);return result;};
    evExperimentScoringResults=assessmentCards;
    evExperimentResultEvaluator=function(resultId,evaluatorId){
      const context=evExperimentCaseDetailContext(resultId),evaluation=context?.result.evaluations?.find(item=>item.evaluatorId===evaluatorId),snapshot=context?.run?.snapshot||context?.experiment?.snapshot,evaluator=snapshot?.unifiedEvaluation?.evaluatorVersions.find(item=>item.id===evaluatorId&&item.version===evaluation?.version);
      if(!promptAuthored(evaluator)&&!v4Evaluator(evaluator))return source('evExperimentResultEvaluator')(resultId,evaluatorId);
      const assessment=context.result.assessments?.find(item=>item.evaluatorRef.id===evaluator.id&&item.evaluatorRef.version===evaluator.version&&item.bindingId===evaluation.bindingId);
      evModal('查看评估标准快照',`<section class="ont-form-section"><h3>${html(evaluator.name+' '+evaluator.version)}</h3>${gradingRead(evaluator)}${assessment?aggregateRead(evaluator,assessment)+metricResultsRead(evaluator,assessment):''}</section>`,`<button type="button" class="ont-button" onclick="evExperimentCaseDetail(${html(JSON.stringify(resultId))})">${context.validation?'返回验证详情':'返回用例结果'}</button>`);return true;
    };
    evExperimentEvaluatorReport=function(experiment,run){
      const context=evExperimentEvidence(experiment,run);if(!context.snapshot.unifiedEvaluation)return source('evExperimentEvaluatorReport')(experiment,run);
      const assessments=(run?.results||[]).flatMap(result=>result.assessments||[]),simple=allSelected(context.snapshot.execution),headers=['评估器版本','评估对象',...(simple?[]:['作用']),'执行数','通过','未通过','证据不足','仅观察','评估异常',context.snapshot.unifiedEvaluation.evaluatorVersions.some(promptAuthored)?'评估结果':'汇总 / 评分项结果'];
      const rows=context.snapshot.unifiedEvaluation.bindings.map(binding=>{const rows=assessments.filter(item=>item.bindingId===binding.id),evaluator=context.snapshot.unifiedEvaluation.evaluatorVersions.find(item=>refKey(evaluatorRef(item))===refKey(binding.evaluatorRef)),totals=rows.map(item=>numericAggregate(item.aggregate)).filter(value=>value!==null),average=totals.length?totals.reduce((sum,value)=>sum+value,0)/totals.length:null,results=promptAuthored(evaluator)?`<details><summary>整体判定结果（${rows.length} 次）</summary>${rows.map(row=>`<article><h4>${html(row.targetRef?.id)}</h4>${promptResultRead(row)}</article>`).join('')}</details>`:itemCentric(evaluator)?`<details><summary>逐项结果（${rows.length} 次）</summary>${rows.map(row=>`<article><h4>${html(row.targetRef?.id)}</h4>${v4Evaluator(evaluator)?policyResultRead(evaluator,row):summaryResultRead(row)}${metricResultsRead(evaluator,row)}</article>`).join('')}</details>`:html(aggregateDisplay(evaluator,average));return `<tr><td>${html(evaluator?.name||binding.evaluatorRef.id)} ${html(binding.evaluatorRef.version)}<details><summary>${promptAuthored(evaluator)?'固定提示词':'固定条件与汇总'}</summary>${gradingRead(evaluator)}</details></td><td>${targetLabel(evaluationTarget(binding))}</td>${simple?'':`<td>${roleLabel(binding.role)}</td>`}<td>${rows.length}</td><td>${rows.filter(item=>item.decision==='passed').length}</td><td>${rows.filter(item=>item.decision==='failed').length}</td><td>${rows.filter(item=>item.decision==='inconclusive').length}</td><td>${rows.filter(item=>item.decision==='not_applicable').length}</td><td>${rows.filter(item=>item.executionStatus==='failed').length}</td><td>${results}</td></tr>`;});
      return `<section class="ont-overview"><h3>评估统计</h3>${simple?'<p class="ev-note">'+html(evaluatorSummaryLabel(context.snapshot.execution,context.snapshot.unifiedEvaluation.bindings))+'；其余结果仅观察。</p>':''}${evTable(headers,rows)}</section>`;
    };
    evExperimentScoringSnapshot=function(scope='run'){
      const current=evExperimentCurrent(),run=scope==='current'?null:current&&evExperimentViewRun(current),context=current&&evExperimentEvidence(current,run);
      if(!context?.snapshot.unifiedEvaluation)return source('evExperimentScoringSnapshot')(scope);
      const simple=allSelected(context.snapshot.execution),sections=context.snapshot.unifiedEvaluation.bindings.map(binding=>{
        const evaluator=context.snapshot.unifiedEvaluation.evaluatorVersions.find(item=>refKey(evaluatorRef(item))===refKey(binding.evaluatorRef));
        const legacyRubrics=metrics(evaluator).filter(metric=>text(metric.rubric).trim()),standard=promptAuthored(evaluator)||itemCentric(evaluator)?'':evaluator.method?.type==='llm_judge'?`<h4>评估标准</h4><pre class="ue-pre">${html(evaluator.method.prompt)}</pre>`:`<h4>校验规则</h4><pre class="ue-pre">${html(JSON.stringify(evaluator.method?.checks||[],null,2))}</pre>`;
        const historical=legacyRubrics.length?`<h4>历史指标评分标准</h4>${evTable(['指标','历史评分标准'],legacyRubrics.map(metric=>`<tr><td>${html(metric.name||metric.id)}</td><td>${html(metric.rubric)}</td></tr>`))}`:'';
        return `<section class="ont-form-section"><h3>${html(evaluator.name+' '+evaluator.version)} · ${targetLabel(evaluationTarget(binding))}${simple?'':' · '+roleLabel(binding.role)}</h3><p>${html(evaluator.description)}</p>${standard}${gradingRead(evaluator)}${itemCentric(evaluator)?'':`<h4>历史评估项</h4>${evTable(['指标','类型','作用','说明'],metrics(evaluator).map(metric=>`<tr><td>${html(metric.name||metric.id)}</td><td>${html(metric.valueType==='number'?'数值（历史）':metric.valueType)}</td><td>${metricParticipates(evaluator,metric.id)?'参与通过判定':'仅观察'}</td><td>${html(metric.description||'—')}</td></tr>`))}`}${historical}${simple?'':`<p>维度映射：${html((binding.dimensionMappings||[]).map(item=>item.dimensionId+' ← '+item.metricId).join('；')||'通用评估')}</p>`}</section>`;
      }).join('');
      evModal('查看评估标准',(simple?'<p class="ev-note">'+html(evaluatorSummaryLabel(context.snapshot.execution,context.snapshot.unifiedEvaluation.bindings))+'；其余结果仅观察。以下为固定的已发布评估标准；输入自动带入，业务维度沿用任务配置。</p>':'<p class="ev-note">历史配置：固定的已发布评估器版本、任务映射及 gate / observe 角色。</p>')+runtimeRead(context.snapshot,!!run)+sections);
    };
  }
  const api={
    configure(options={}){storage=options.storage||null;memory=null;return api;},
    initialize(){install();data().tasks.forEach(taskState);data().suites.forEach(suite=>captureSuite(suite));save();return api;},
    taskSnapshot,taskResults,recordAssessment,captureSuite,resolveSuite,suiteCoverage,relevantBindings,createExperiment,updateExperiment,
    enrichTask,
    taskDefinition(id,sceneId){const ids=sceneId?[sceneId]:['sales','procurement'];for(const candidate of ids){const catalog=evCatalog[candidate]||(evCatalog[candidate]=evSeedScene(candidate)),task=catalog.tasks.find(item=>item.id===id);if(task)return enrichTask({...task,scene:candidate});}return null;},
    recommendedBindings(id){return clone(api.taskDefinition(id)?.evaluationBindings||[]);},
    references(id){return Object.values(evExperimentStores).flatMap(store=>store.experiments||[]).filter(experiment=>experiment.snapshot?.unifiedEvaluation?.bindings.some(binding=>binding.evaluatorRef.id===id)).map(experiment=>({id:experiment.id,name:experiment.name,type:'experiment',versions:[...new Set(experiment.snapshot.unifiedEvaluation.bindings.filter(binding=>binding.evaluatorRef.id===id).map(binding=>binding.evaluatorRef.version))]}));},
    editTaskBindings,
    saveTaskBindings(){if(!taskForm)return false;try{const bindings=taskForm.bindings.length?normalizedBindings(taskForm.bindings):[],task=data().tasks.find(item=>item.id===taskForm.task.id),state=taskState(task);state.bindings=bindings;state.specification=Object.fromEntries(['inputContract','outputContract','completionCriteria'].map(key=>[key,text(global.document?.getElementById('ub-task-'+key)?.value||'').trim()]));state.revision++;save();evCloseModal();evRender();toast('业务任务契约与推荐绑定已保存');return true;}catch(error){toast(error.message);return false;}},
    setTaskSpecification(id,specification){const task=data().tasks.find(item=>item.id===id);if(!task)throw Error('业务任务不存在');const state=taskState(task);state.specification={...state.specification,...clone(specification)};state.revision++;save();return taskSnapshot(task);},
    taskBindingChange(index,key,value){if(!taskForm)return;mutateBinding(taskForm.bindings,index,key,value,[taskForm.task]);const node=global.document?.getElementById('ub-bindings');if(node)node.outerHTML=bindingEditor(taskForm.bindings,'task',taskForm.task);},
    addTaskBinding(){if(!taskForm)return;taskForm.bindings.push(newBinding(taskForm.task));const node=global.document?.getElementById('ub-bindings');if(node)node.outerHTML=bindingEditor(taskForm.bindings,'task',taskForm.task);},
    removeTaskBinding(index){if(!taskForm)return;taskForm.bindings.splice(index,1);const node=global.document?.getElementById('ub-bindings');if(node)node.outerHTML=bindingEditor(taskForm.bindings,'task',taskForm.task);},
    setTaskBindings(id,bindings){const task=data().tasks.find(item=>item.id===id);if(!task)throw Error('业务任务不存在');const state=taskState(task);state.bindings=normalizedBindings(bindings);state.revision++;save();return taskSnapshot(task);},
    filterEvaluatorPicker(input){
      const picker=input.closest?.('.ub-evaluator-picker');if(!picker)return;
      const query=String(input.value||'').trim().toLowerCase();let count=0;
      picker.querySelectorAll('[data-ub-evaluator-option]').forEach(option=>{const visible=!query||String(option.getAttribute('data-search-text')||'').includes(query);option.hidden=!visible;if(visible)count++;});
      const empty=picker.querySelector('[data-ub-evaluator-empty]');if(empty)empty.hidden=count>0;
      if(typeof evPositionPopover==='function')evPositionPopover(picker);
    },
    bindingChange(index,key,value){if(!evExperimentEditor)return;mutateBinding(evExperimentEditor.unifiedBindings,index,key,value,selectedTasks());refreshBindings();},
    addBinding(){
      if(!evExperimentEditor)return false;
      const evaluator=nextExperimentEvaluator(evExperimentEditor.unifiedBindings);
      if(!evaluator){toast(pickerCatalog().length?'全部可用评估器已添加':'请先发布一个评估器');return false;}
      evExperimentEditor.unifiedBindings.push(newBinding(null,evaluator));refreshBindings();
      const row=global.document?.getElementById('ub-bindings')?.querySelector('section.ont-execution:last-of-type');
      row?.scrollIntoView?.({block:'nearest'});row?.querySelector('.ub-evaluator-picker > summary')?.focus?.({preventScroll:true});
      return true;
    },
    removeBinding(index){if(!evExperimentEditor)return;evExperimentEditor.unifiedBindings.splice(index,1);refreshBindings();},
    useTaskRecommendations(){if(!evExperimentEditor)return;const suites=evExperimentEditor.suiteIds.map(id=>data().suites.find(item=>item.id===id)).filter(Boolean);evExperimentEditor.unifiedBindings=defaultBindings(suites);refreshBindings();},
    executionModeChange(mode){if(!evExperimentEditor?.unifiedBindings)return;for(const binding of evExperimentEditor.unifiedBindings){if(mode!=='scenario_simulation'){binding.scenarioEvaluationTarget=evaluationTarget(binding);mutateBinding(evExperimentEditor.unifiedBindings,evExperimentEditor.unifiedBindings.indexOf(binding),'target','first_response',selectedTasks());}else if(binding.scenarioEvaluationTarget){mutateBinding(evExperimentEditor.unifiedBindings,evExperimentEditor.unifiedBindings.indexOf(binding),'target',binding.scenarioEvaluationTarget,selectedTasks());delete binding.scenarioEvaluationTarget;}}refreshBindings();},
    runtimeChange(key,value){if(!evExperimentEditor)return false;const editor=evExperimentEditor;if(key==='agentMode')editor.agentRuntimeOverride.mode=value;else if(key==='agentModel')editor.agentRuntimeOverride.modelRef=value;else if(key==='judgeModel')editor.judgeRuntime.modelRef=value;if(key==='agentMode')refreshRuntimeEditor(editor);return true;},
    evaluatorSummaryChange(key,value){
      if(!evExperimentEditor||['type','minPassed','summary','minimum'].includes(key)||key==='mode'&&!['weighted_score','custom_prompt'].includes(value))return false;
      const editor=evExperimentEditor,total=evaluatorGateCount(editor.unifiedBindings||[]),current=authoringCompositeSummary(evaluatorSummaryPolicy(editor.execution)),number=value=>String(value??'').trim()===''?'':Number(value);
      editor.evaluatorPolicyDrafts=editor.evaluatorPolicyDrafts||{};
      if(key==='mode'){
        editor.evaluatorPolicyDrafts[current.mode]=clone(current);const next=clone(editor.evaluatorPolicyDrafts[value]||newCompositeSummary(value));
        if(value==='weighted_score'&&!editor.evaluatorWeightsInitialized){next.weights=(editor.unifiedBindings||[]).filter(binding=>binding.role==='gate').map(binding=>({bindingId:binding.id,weight:total?1/total:null}));editor.evaluatorWeightsInitialized=true;}
        editor.execution.evaluatorSummary=next;const node=global.document?.getElementById('ub-bindings');if(node)node.outerHTML=bindingEditor(editor.unifiedBindings||[]);refreshEvaluatorSummary();refreshRuntimeEditor(editor);return true;
      }
      if(key==='threshold')current.passThreshold=number(value);
      else if(key==='prompt')current.customPrompt=value;
      else if(key.startsWith('weight:')){const id=key.slice(7);current.weights=(current.weights||[]).filter(part=>part.bindingId!==id).concat([{bindingId:id,weight:number(value)}]);}
      editor.execution.evaluatorSummary=current;return true;
    },
    runtimeConfiguration,runtimeRead,
    repinSuite(id,options={}){const suite=data().suites.find(item=>item.id===id);if(!suite)return false;captureSuite(suite,true);if(!options.silent){evRender();toast('评测集已固定当前任务与用例快照');}return true;},
    state(){return clone(db());},storageKey:KEY
  };
  global.AIOpsUnifiedBridge=api;
  install();
})(window);
