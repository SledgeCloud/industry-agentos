/* New AIOps showcase traffic and independent fixture judges. No model is called. */
(function (global) {
  'use strict';
  var VERSION=2, epochValue=null, rowsCache=null;
  var PREFIX='UJ-SHOWCASE-', COMPOSITE_PROMPT='依据各评估器的真实结果、理由与证据判断：关键业务约束、准入和风险识别满足要求时通过；明确违反关键要求时未通过；必要证据不足时待确认。';
  var IDS={constraints:'UE-DEMO-V2-CONSTRAINTS',admission:'UE-DEMO-V2-ADMISSION',quality:'UE-DEMO-V2-QUALITY',risk:'UE-DEMO-V2-RISK',evidence:'UE-DEMO-V2-EVIDENCE',observation:'UE-DEMO-V2-OBSERVATION',composite:'UE-DEMO-V2-COMPOSITE',prompt:'UE-DEMO-V2-PROMPT',final:'UE-DEMO-V2-FINAL'};
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function catalog(){return global.AIOpsEvaluationDemoCatalog;}
  function data(){return global.AIOpsUnifiedData;}
  function values(value){return Array.isArray(value)?value:Object.values(value || {});}
  function epoch(){
    if(epochValue)return epochValue;
    epochValue=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
    return epochValue;
  }
  function iso(minutes){return new Date(Date.parse(epoch())+minutes*60000).toISOString();}
  function local(value){var date=new Date(Date.parse(value)+8*3600000);return date.toISOString().slice(0,16).replace('T',' ');}
  function agentInfo(scene,sourceId){
    var index=/app-agent$/.test(String(sourceId || ''))||String(sourceId || '')===scene+':agents:1'?1:0,id=scene+':agents:'+index,available=[];
    try{available=global.AIOpsOnlineEvaluatorData&&global.AIOpsOnlineEvaluatorData.agents?global.AIOpsOnlineEvaluatorData.agents(scene):[];}catch(_){}
    var selected=available.find(function(agent){return agent.id===sourceId || agent.id===id;});
    return selected?clone(selected):{id:id,name:index===1?(scene==='sales'?'销售管理应用 Agent':'采购管理应用 Agent'):(scene==='sales'?'销售智能分货助手':'采购协同助手')};
  }
  function sceneInfo(scene,requestedVersion){
    var record=catalog().scene(scene,requestedVersion),current=[];try{current=global.AIOpsEvaluation&&global.AIOpsEvaluation.taskCatalog?global.AIOpsEvaluation.taskCatalog():[];}catch(_){}
    return {record:record,cases:values(record.cases),tasks:values(record.tasks).map(function(task){var found=current.find(function(item){return item.id===task.id&&(item.sceneId || item.scene)===scene;});if(found&&requestedVersion!==1)return clone(found);var agent=agentInfo(scene,task.agentId);return Object.assign({},clone(task),{sceneId:scene,scene:scene,sourceAgentId:task.sourceAgentId || task.agentId,agentId:agent.id,agent:agent.name});}),experiments:values(record.experiments)};
  }
  function fixture(caseId,phase){return catalog().fixture(caseId,phase || 'initial');}
  function caseContract(record){var value={};['id','version','input','expected','inputAttachments','attachments','skill','skills','prompt','expectedOutput','context'].forEach(function(key){if(Object.prototype.hasOwnProperty.call(record || {},key))value[key]=clone(record[key]);});return data()?'sha256:'+data().hash(value):null;}
  function answer(value){return String(value==null?'':value).replace(/^【Mock Agent 输出】\s*/,'').trim();}
  function grading(value){var result={};['id','version','authoringMode','supportedTargets','method','inputSchema','metrics','aggregation','decision'].forEach(function(key){if(Object.prototype.hasOwnProperty.call(value,key))result[key]=clone(value[key]);});if(value.authoringMode!=='prompt'&&value.decision&&value.decision.policyVersion===4&&Object.prototype.hasOwnProperty.call(value,'additionalPrompt'))result.additionalPrompt=value.additionalPrompt;return result;}
  function expectedEvaluators(){
    var D=data(),result={};if(!D||!catalog())return result;
    (catalog().legacyEvaluators?catalog().legacyEvaluators():[]).concat(catalog().evaluators()).forEach(function(spec){var derived=D.deriveEvaluatorContract(clone(spec));if(derived.ok){var value=derived.record;value.id=spec.id;value.version=spec.version || 'V1';result[spec.id+'@'+value.version]={record:value,hash:'sha256:'+D.hash(grading(value))};}});return result;
  }
  function definition(expected,ref){return ref&&expected[ref.id+'@'+ref.version];}
  function validInputHash(snapshot){if(!snapshot||typeof snapshot.inputHash!=='string')return false;var raw=clone(snapshot);delete raw.inputHash;return snapshot.inputHash==='sha256:'+data().hash(raw);}
  function knownRuntime(runtime){
    if(!runtime || !data())return false;
    var allowed=[data().defaultJudgeRuntime()];['sales','procurement'].forEach(function(scene){sceneInfo(scene).experiments.forEach(function(spec){if(spec.judgeRuntime)allowed.push(spec.judgeRuntime);});});
    return allowed.some(function(value){var expected={modelRef:value.modelRef,parameters:Object.assign({},data().defaultJudgeRuntime().parameters,value.parameters || {})};return data().hash(expected)===data().hash(runtime);});
  }
  function locate(source,allowNoInput){
    source=source || {};var ref=source.demoEvidence || source.target&&source.target.demoEvidence,actual=source.targetOutput;
    if(actual==null&&source.target)actual=source.target.output;
    if(!ref || typeof ref.caseId!=='string' || !/^(SAL|PUR)-DEMO-EC-\d\d$/.test(ref.caseId)||!['initial','repaired'].includes(ref.phase))return null;
    var value=fixture(ref.caseId,ref.phase);if(!value)return null;
    var caseRow=sceneInfo(ref.caseId.startsWith('SAL-')?'sales':'procurement').cases.find(function(row){return row.id===ref.caseId;}),providedInput=source.target&&source.target.input!=null?source.target.input:source.targetInput!=null?source.targetInput:source.case&&source.case.input;
    if(!caseRow||ref.caseContractHash!==caseContract(caseRow))return null;
    if(providedInput&&typeof providedInput==='object'&&!Array.isArray(providedInput)){if(!Object.prototype.hasOwnProperty.call(providedInput,'text')||data().hash(providedInput.attachments || [])!==data().hash(caseRow.inputAttachments || []))return null;providedInput=providedInput.text;}else if((caseRow.inputAttachments || []).length&&providedInput!=null)return null;
    var allowedInputs=[caseRow.input].concat((value.turns || []).map(function(turn){return turn.user;}),[(value.turns || []).map(function(turn){return turn.user;}).join('\n')]).filter(function(item){return item!=null&&String(item).trim();});
    if(providedInput==null&&!allowNoInput||providedInput!=null&&!allowedInputs.some(function(item){return answer(providedInput)===answer(item);}))return null;
    var providedReference=source.target&&Object.prototype.hasOwnProperty.call(source.target,'reference')?source.target.reference:source.case&&Object.prototype.hasOwnProperty.call(source.case,'expected')?source.case.expected:source.targetReference,expectedReference=value.reference!==undefined?value.reference:caseRow.expected,allowsMissing=(value.missingEvidence || []).includes('reference')||value.reference===null;
    if(providedReference!=null&&data().hash(providedReference)!==data().hash(expectedReference))return null;
    if(ref.sourceReferenceHash&&ref.sourceReferenceHash!==data().hash(providedReference==null?null:providedReference))return null;
    if(providedReference==null&&!allowsMissing&&source.target&&source.target.type==='case_output'&&source.case&&Object.prototype.hasOwnProperty.call(source.case,'expected'))return null;
    var first=source.target&&source.target.type==='case_output',text=answer(actual),expected=first&&value.firstResponse?value.firstResponse:value.answer;
    if(text!==answer(expected))return null;
    return {caseId:ref.caseId,phase:ref.phase,value:value,fault:ref.fault==='invalid_score'&&source.target&&String(source.target.sessionId || source.target.id || '').startsWith('EVAL-DEMO-PUR-4')?'invalid_score':null,caseRow:caseRow,first:first&&!!value.firstResponse&&answer(value.firstResponse)!==answer(value.answer)};
  }
  function reason(found){return '本地 Mock 评估：依据固定业务用例 '+found.caseId+' 的'+(found.phase==='repaired'?'修复后':'初始')+'证据独立判定；未调用真实模型。';}
  function judge(request){
    if(!request||request.protocol!=='aiops.demo_judge.request.v1'||!catalog()||!data())return null;
    var expected=expectedEvaluators(),source=request.source || {},found=locate(source,request.stage==='composite_final'),snapshot=request.inputSnapshot;
    if(!found)return null;
    if(request.stage==='metrics'){
      var asset=request.evaluator,known=definition(expected,asset);
      if(!known||request.evaluatorConfigHash!==known.hash||!knownRuntime(request.judgeRuntimeSnapshot))return null;
      if(request.inputs&&request.inputs.reference!=null&&Object.prototype.hasOwnProperty.call(asset.inputSchema.properties,'reference')&&data().hash(request.inputs.reference)!==data().hash(found.caseRow.expected))return null;
      var supplied=found.first?(found.value.evaluatorValuesFirstResponse || {})[asset.id]:(found.value.evaluatorValues || {})[asset.id],flat=found.first?found.value.judgeValuesFirstResponse:found.value.judgeValues,packet={};
      (asset.metrics || []).forEach(function(metric){
        var value=supplied&&Object.prototype.hasOwnProperty.call(supplied,metric.id)?supplied[metric.id]:flat&&Object.prototype.hasOwnProperty.call(flat,metric.id)?flat[metric.id]:null;
        if(asset.authoringMode==='prompt'&&metric.id==='overall_verdict')value=found.first&&Object.prototype.hasOwnProperty.call(found.value,'promptVerdictFirstResponse')?found.value.promptVerdictFirstResponse:found.value.promptVerdict;
        if(found.fault==='invalid_score'&&metric.valueType==='number')value='较好';
        var boxed=value&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,'value');
        packet[metric.id]={value:boxed?clone(value.value):value==null?null:clone(value),reason:boxed&&value.reason?reason(found)+' '+value.reason:reason(found),evidenceRefs:clone(source.target&&source.target.evidenceRefs || [])};
      });
      return {protocol:'aiops.demo_judge.metrics.v1',requestHash:request.requestHash,fixtureRef:{caseId:found.caseId,phase:found.phase,fault:found.fault},metricValues:packet};
    }
    if(request.stage==='evaluator_final'){
      var selected=snapshot&&definition(expected,snapshot.evaluatorRef);
      if(!selected||snapshot.evaluatorConfigHash!==selected.hash||snapshot.customPrompt!==selected.record.decision.customPrompt||!knownRuntime(snapshot.judgeRuntimeSnapshot)||!validInputHash(snapshot))return null;
      var judged=(snapshot.itemResults || []).filter(function(item){return item.valueType!=='text';}),finalValue=judged.some(function(item){return item.decision==='failed';})?false:!judged.length||judged.some(function(item){return item.validationStatus!=='valid'||item.decision!=='passed';})?null:true;
      return {protocol:'aiops.final_verdict.v1',requestHash:request.requestHash,inputHash:snapshot.inputHash,value:finalValue,reason:reason(found)+(judged.length?' 结论依据本次真实评估项；明确失败不能被观察记录抵消。':' 仅归档观察，不产生分数或自动通过结论。'),evidenceRefs:clone(source.target&&source.target.evidenceRefs || [])};
    }
    if(request.stage==='composite_final'){
      if(!snapshot||!knownRuntime(snapshot.judgeRuntimeSnapshot)||!snapshot.ownerRef||!validInputHash(snapshot))return null;
      var allowed=[];
      [jobs(),legacyJobs()].forEach(function(specs){specs.forEach(function(spec){if(spec.passPolicy.mode==='custom_prompt')allowed.push({id:spec.id,prompt:spec.passPolicy.customPrompt});});});
      ['sales','procurement'].forEach(function(scene){[catalog().scene(scene),catalog().scene(scene,1)].forEach(function(record){record.experiments.forEach(function(spec){var policy=spec.execution&&spec.execution.evaluatorSummary;if(policy&&policy.mode==='custom_prompt')allowed.push({id:spec.id,prompt:policy.customPrompt});});});});
      if(!allowed.some(function(spec){return spec.id===snapshot.ownerRef.id&&spec.prompt===(snapshot.policySnapshot&&snapshot.policySnapshot.customPrompt);}))return null;
      if(!(snapshot.evaluatorResults || []).length || snapshot.evaluatorResults.some(function(entry){var value=definition(expected,entry.evaluatorRef);return !value||entry.evaluatorConfigHash!==value.hash;}))return null;
      var gates=snapshot.evaluatorResults.filter(function(entry){return entry.participation!=='observe';}),finalValue=gates.some(function(entry){return entry.executionStatus==='succeeded'&&entry.decision==='failed';})?false:!gates.length||gates.some(function(entry){return entry.executionStatus!=='succeeded'||entry.decision!=='passed';})?null:true;
      return {protocol:'aiops.composite_verdict.v1',requestHash:request.requestHash,inputHash:snapshot.inputHash,value:finalValue,reason:reason(found)+' 按当前参与判定结果逐一核验；失败不被其他通过结果抵消，缺证不补分。',evidenceRefs:(snapshot.evaluatorResults || []).flatMap(function(entry){return entry.evidenceRefs || [];})};
    }
    return null;
  }
  function buildRows(){
    if(rowsCache)return rowsCache;if(!catalog())return [];
    var rows=[];
    ['sales','procurement'].forEach(function(scene){
      var info=sceneInfo(scene),task=info.tasks[0],agent=agentInfo(scene,task&&task.agentId),agentId=agent.id,agentName=agent.name,short=scene==='sales'?'SAL':'PUR';
      var chosen=scene==='sales'?[{index:0,phase:'initial',suffix:'健康交付'},{index:1,phase:'initial',suffix:'约束违规'},{index:2,phase:'initial',suffix:'边界处理'},{index:6,phase:'repaired',suffix:'参考证据待补'}]:[{index:0,phase:'initial',suffix:'健康交付'},{index:6,phase:'initial',suffix:'准入证据待补'},{index:2,phase:'initial',suffix:'准入失效'},{index:0,phase:'initial',suffix:'评估结果格式异常',fault:'invalid_score'}];
      chosen.forEach(function(spec,index){
        var test=info.cases[spec.index] || info.cases[index] || info.cases[0];if(!test)return;
        var entry=fixture(test.id,spec.phase);if(!entry)return;
        var id='EVAL-DEMO-'+short+'-'+(index+1),at=iso(-90+index*15),inputId=id+'-U',outputId=id+'-A',tags=['评测演示',scene];if(index===0)tags.push('业务任务命中边界');
        var row={id:id,name:(scene==='sales'?'销售分货':'采购寻源')+' · '+spec.suffix,agentId:agentId,agent:agentName,sceneId:scene,time:local(at),user:index%2?'demo.reviewer':'demo.operator',messages:2,tokens:'0.0012',usage:{totalTokens:1200},errors:entry.runtimeError?1:0,warnings:(entry.missingEvidence || []).length?1:0,mark:entry.promptVerdict===true?'优质':entry.promptVerdict===false?'劣质':'未标记',by:'演示用户',markedAt:local(at),status:'closed',endedAt:at,environment:index===2?'staging':'production',tags:tags,modelRef:data()?data().defaultJudgeRuntime().modelRef:'deepseek 4.1 flash',parameters:{temperature:0},evaluationDemoSource:true,inputAttachments:clone(test.inputAttachments || []),demoEvidence:{caseId:test.id,phase:spec.phase,fault:spec.fault || null,caseContractHash:caseContract(test)},context:{business:clone(entry.business || {}),source:'本地演示业务记录'},conversation:{rounds:[{n:1,name:(scene==='sales'?'分货':'寻源')+'执行链路',inputId:inputId,outputId:outputId,input:test.input || '执行业务任务',attachment:(test.inputAttachments || [])[0]?(test.inputAttachments || [])[0].name:null,output:entry.answer,hasOutput:true,inputAt:new Date(Date.parse(at)-30000).toISOString(),outputAt:at,context:clone(entry.business || {})}],records:[{id:id+'-TOOL',round:1,type:'tool',name:scene==='sales'?'inventory.query':'supplier.lookup',toolName:scene==='sales'?'inventory.query':'supplier.lookup',status:'completed',input:'读取本次业务数据',output:JSON.stringify(entry.business || {}),endedAt:new Date(Date.parse(at)-10000).toISOString(),tokens:0},{id:id+'-MODEL',round:1,type:'model',name:'生成业务交付',modelRef:'deepseek 4.1 flash',parameters:{temperature:0},status:'completed',input:test.input || '执行业务任务',output:entry.answer,endedAt:at,tokens:1200,usage:{totalTokens:1200}}]},taskExecutions:task?[{id:id+'-EXEC',taskId:task.id,startMessageId:inputId,completionMessageId:outputId,completion:'completed',completedAt:at,output:entry.answer,evidence:[inputId,outputId]}]:[]};
        if(!(entry.missingEvidence || []).includes('reference')&&entry.reference!==null){row.reference=clone(test.expected || test.expectedOutput || '按已确认业务规则执行，保留原始依据。');row.conversation.rounds[0].reference=clone(row.reference);row.taskExecutions.forEach(function(execution){execution.reference=clone(row.reference);});}
        row.demoEvidence.sourceReferenceHash=data().hash(row.reference==null?null:row.reference);rows.push(row);
      });
      var id='EVAL-DEMO-'+short+'-'+(scene==='sales'?'CHAT':'WAIT'),at=scene==='sales'?iso(-20):iso(-2),inputId=id+'-U',outputId=id+'-A';
      rows.push({id:id,name:scene==='sales'?'销售咨询 · 未命中业务任务':'采购处理中 · 等待交付',agentId:agentId,agent:agentName,sceneId:scene,time:local(at),user:'demo.visitor',messages:scene==='sales'?2:1,tokens:'0.0004',usage:{totalTokens:400},errors:0,warnings:0,mark:'未标记',by:'',markedAt:'',status:scene==='sales'?'closed':'running',endedAt:scene==='sales'?at:undefined,environment:'production',tags:['评测演示',scene,scene==='sales'?'业务任务命中边界':'等待就绪'],evaluationDemoSource:true,conversation:{rounds:[{n:1,inputId:inputId,outputId:outputId,input:scene==='sales'?'今天仓库几点下班？':'请确认供应商资格后再生成方案。',output:scene==='sales'?'仓库营业时间请向业务管理员确认，本次没有执行分货。':'',hasOutput:scene==='sales',inputAt:at,outputAt:scene==='sales'?at:undefined}],records:[{id:id+'-TOOL',round:1,type:'tool',name:scene==='sales'?'business.info':'supplier.lookup',status:scene==='sales'?'completed':'running',input:'查询信息',output:scene==='sales'?'未执行业务任务':'',startedAt:at,endedAt:scene==='sales'?at:undefined}]},taskExecutions:[]});
    });
    rowsCache=rows;return rowsCache;
  }
  function sessions(baseRows){var original=(baseRows || []).slice(),ids=new Set(original.map(function(row){return row.id;}));return original.concat(buildRows().filter(function(row){return !ids.has(row.id);}).map(clone));}
  function binding(id,evaluatorId,target,version){var asset=data().evaluator(evaluatorId,version||'V1');return {id:id,evaluatorRef:{id:evaluatorId,version:version||'V1'},role:evaluatorId===IDS.observation?'observe':'gate',targetType:target,dimensionMappings:[],inputMapping:asset?data().defaultInputMapping(asset,target):{}};}
  function legacyJobs(){
    var D=data(),sources=buildRows(),defaults=D.defaultJudgeRuntime(),specs=[
      {key:'SALES-QUALITY',name:'销售交付质量加权巡检',scene:'sales',target:'session',mode:'manual',refs:[IDS.composite,IDS.constraints],policy:'weighted_score',rate:100},
      {key:'SALES-TASK',name:'销售业务任务命中与验收',scene:'sales',target:'task_execution',mode:'manual',refs:[IDS.constraints,IDS.risk],policy:'item_count',boundary:true,rate:100},
      {key:'PURCHASE-TRACE',name:'采购执行链路证据抽检',scene:'procurement',target:'trace',mode:'scheduled',repeat:'interval',refs:[IDS.evidence,IDS.quality],policy:'item_count',minimum:1,rate:50},
      {key:'MODEL-SPAN',name:'模型执行步骤质量检查',scene:'procurement',target:'span',mode:'scheduled',repeat:'daily',refs:[IDS.composite],policy:'weighted_score',enabled:false,rate:100},
      {key:'FEEDBACK',name:'用户点踩整体质量复评',scene:'sales',target:'trace',mode:'automatic',event:'negative_feedback',refs:[IDS.prompt],policy:'item_count',rate:100},
      {key:'SENTIMENT',name:'负面反馈关键业务复核',scene:'procurement',target:'session',mode:'automatic',event:'negative_sentiment',refs:[IDS.final,IDS.evidence],policy:'custom_prompt',rate:100},
      {key:'LOW-SCORE',name:'低分交付准入二次评估',scene:'procurement',target:'session',mode:'automatic',event:'evaluation_result',refs:[IDS.quality,IDS.admission],policy:'weighted_score',rate:100},
      {key:'READY',name:'新增就绪会话增量抽检',scene:'sales',target:'session',mode:'automatic',event:'ready',refs:[IDS.constraints],policy:'item_count',enabled:false,firstOnly:true,rate:25},
      {key:'OBSERVATION',name:'采购交付观察归档',scene:'procurement',target:'session',mode:'manual',refs:[IDS.observation],policy:'item_count',rate:100}
    ];
    return specs.map(function(spec,index){
      var info=sceneInfo(spec.scene,1),source=sources.find(function(row){return row.sceneId===spec.scene;}),scopedTasks=info.tasks.filter(function(task){return [task.agentId,task.sourceAgentId].indexOf(source.agentId)>=0;}),id=PREFIX+spec.key,bindings=spec.refs.map(function(ref,i){return binding('UB-SHOWCASE-'+spec.key+'-'+i,ref,spec.target);}),policy={type:'composite_policy',policyVersion:1,mode:spec.policy,missingEvidence:'inconclusive'};
      if(spec.policy==='weighted_score'){policy.passThreshold=80;policy.weights=bindings.map(function(row,i){return {bindingId:row.id,weight:bindings.length===1?1:i===0?0.7:0.3};});}
      else if(spec.policy==='custom_prompt')policy.customPrompt=COMPOSITE_PROMPT;else policy.summary=spec.minimum?{type:'at_least',minPassed:spec.minimum}:{type:'all'};
      return {id:id,name:spec.name,description:'本地 Mock 演示：'+({weighted_score:'按真实评估器结果加权判定',item_count:'按评估器通过数量验收',custom_prompt:'独立综合判断关键业务条件'}[spec.policy])+'。',enabled:spec.enabled!==false,selector:{sceneId:spec.scene,agentId:source.agentId,targetType:spec.target,taskIds:spec.target==='task_execution'?scopedTasks.map(function(task){return task.id;}):[],spanTypes:spec.target==='span'?['model']:[],filter:{text:'',status:'all',logic:'all',conditions:[{id:'demo-scope',field:'tags',operator:'contains',value:spec.boundary?'业务任务命中边界':'评测演示'}]}},sampling:{rate:spec.rate,seed:id},readiness:{mode:spec.event==='ready'?'idle':spec.target==='trace'||spec.target==='span'?'completed':'any',idleMinutes:10},trigger:{mode:spec.mode,events:[spec.event || 'ready'],evaluationCondition:{key:'quality',operator:'lte',value:0.6}},schedule:{repeat:spec.mode==='scheduled'?spec.repeat:'manual',timezone:'Asia/Shanghai',time:'10:00',intervalHours:1,weekdays:[1,3,5],monthdays:[1],onceAt:''},reEvaluation:{mode:spec.firstOnly?'first_only':'on_change'},passPolicy:policy,bindings:bindings,taskSnapshots:spec.target==='task_execution'?clone(scopedTasks):[],judgeRuntime:clone(defaults),revision:1,createdAt:iso(-120),updatedAt:iso(-120),armedAt:epoch(),incrementalSince:iso(-120),source:'mock',demoCatalog:'evaluation-showcase-v2',demoVersion:1};
    });
  }
  function jobs(){
    return legacyJobs().map(function(job){
      job.demoVersion=VERSION;
      var current=sceneInfo(job.selector.sceneId),ids=(job.taskSnapshots || []).map(function(task){return task.id;});
      job.taskSnapshots=current.tasks.filter(function(task){return ids.includes(task.id);}).map(clone);
      job.bindings=job.bindings.map(function(row){var asset=catalog().evaluators().find(function(item){return item.id===row.evaluatorRef.id;}),next=binding(row.id,row.evaluatorRef.id,job.selector.targetType,asset&&asset.version||'V2');next.dimensionMappings=clone(row.dimensionMappings || []);return next;});
      var custom=job.id.endsWith('SENTIMENT')||job.id.endsWith('FEEDBACK')||job.id.endsWith('OBSERVATION'),gates=job.bindings.filter(function(row){return row.role==='gate';});
      if(custom){job.passPolicy={type:'composite_policy',policyVersion:1,mode:'custom_prompt',missingEvidence:'inconclusive',customPrompt:job.id.endsWith('OBSERVATION')?'阅读 {{evaluatorResults}}，只归档业务解释与待办，观察项不构成通过门槛，不输出虚构分数。':COMPOSITE_PROMPT};}
      else {job.passPolicy={type:'composite_policy',policyVersion:1,mode:'weighted_score',missingEvidence:'inconclusive',passThreshold:job.id.endsWith('SALES-TASK')||job.id.endsWith('READY')?100:80,weights:gates.map(function(row,index){return {bindingId:row.id,weight:gates.length===1?1:index===0?0.7:0.3};})};}
      job.description='本地 Mock 演示：'+(custom?job.id.endsWith('OBSERVATION')?'归档业务观察与后续待办。':'依据固定业务标准综合判断，关键失败不能抵消。':'按真实评估器得分及所配置权重计算总分，缺证保留待确认。');
      return job;
    });
  }
  function initialize(D){
    D=D || data();if(!D || !catalog())return {ok:false,error:'演示数据模块尚未就绪。'};
    try{
      var planned=jobs(),result=D.seedDemoCatalog({id:'evaluation-showcase-v2',version:VERSION,epoch:epoch(),evaluators:catalog().evaluators(),jobs:planned,previous:{version:1,evaluators:catalog().legacyEvaluators(),jobs:legacyJobs()},historyJobIds:planned.filter(function(job){return job.enabled;}).map(function(job){return job.id;})});
      if(!result.ok)return result;
      if(typeof D.repairDemoAgentReferences==='function'){var repairs=planned.map(function(job){return {id:job.id,from:job.selector.sceneId==='sales'?'sales-agent-1':'procurement-agent-1',to:job.selector.agentId};}),fixed=D.repairDemoAgentReferences(repairs);if(!fixed.ok)return fixed;result.agentReferencesRepaired=fixed.repaired;}
      return result;
    }catch(error){return {ok:false,error:error.message || '演示数据初始化失败。'};}
  }
  global.AIOpsEvaluationDemoOnline={version:VERSION,sessions:sessions,evaluationDataOptions:function(){return {evaluationDemoJudge:judge};},initialize:initialize,judge:judge,caseContract:caseContract,epoch:epoch,jobSpecs:jobs,legacyJobSpecs:legacyJobs,ids:clone(IDS)};
})(window);
