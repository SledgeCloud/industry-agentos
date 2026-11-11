/* New AIOps demo resources and deterministic business execution. Not loaded by the workshop. */
(function(global){
  'use strict';
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const isCase=id=>/^(SAL|PUR)-DEMO-EC-/.test(String(id||''));
  const isExperiment=record=>!!record&&(/^(SAL|PUR)-DEMO-EXP-/.test(record.id||'')||record.demoCatalogVersion>0);
  let installed=false,seeding=false;
  const originals={};
  const factoryOrigins=new WeakMap();
  function catalog(){return global.AIOpsEvaluationDemoCatalog;}
  function sceneData(scene){return catalog()?.scene(scene)||{tasks:[],cases:[],suites:[],experiments:[]};}
  function fixtures(caseId,phase){
    if(!isCase(caseId))return null;
    const resolved=catalog()?.fixture?.(caseId,phase);
    if(resolved)return clone(resolved);
    const scene=String(caseId).startsWith('SAL-')?'sales':'procurement',record=sceneData(scene).cases.find(item=>item.id===caseId),scenario=record?.demoScenario;
    return clone(scenario?.[phase]||phase==='initial'&&scenario?.baseline||null);
  }
  function publishResource(record){
    const value=clone(record),anchor=Date.parse(global.AIOpsEvaluationDemoOnline?.epoch?.()||new Date(Math.floor(Date.now()/60000)*60000).toISOString()),created=Date.parse(value.createdAt);if(!Number.isFinite(created)||created>anchor-3600000)value.createdAt=new Date(anchor-2*86400000).toISOString();value.publishedAt=new Date(Date.parse(value.createdAt)+1800000).toISOString();value.source=value.source||'演示场景';value.demoCatalogVersion=catalog()?.version||1;
    if(typeof evVersionPrepare==='function')evVersionPrepare(value);
    if(Array.isArray(value.demoVersionHistory))value.history=value.demoVersionHistory.map((prior,index)=>freeze({...clone(prior),createdAt:new Date(Date.parse(value.createdAt)-(index+1)*86400000).toISOString(),publishedAt:new Date(Date.parse(value.publishedAt)-(index+1)*86400000).toISOString()}));
    return value;
  }
  function appendCatalog(data,scene){
    if(!data||!['sales','procurement'].includes(scene)||!catalog())return data;
    const incoming=sceneData(scene);
    for(const kind of ['tasks','cases','suites']){
      const rows=data[kind]||(data[kind]=[]);
      for(const source of incoming[kind]||[])if(!rows.some(record=>record.id===source.id))rows.push(publishResource(source));
    }
    for(const suite of data.suites.filter(record=>record.demoCatalogVersion&&/-DEMO-ES-/.test(record.id))){
      if(!suite.taskSnapshots)suite.taskSnapshots=clone(data.tasks.filter(task=>(suite.taskIds||[]).includes(task.id)));
      if(!suite.caseBindings)suite.caseBindings={};
      for(const id of suite.caseIds||[]){
        if(suite.caseBindings[id])continue;
        const sample=data.cases.find(record=>record.id===id),bound=(sample?.taskIds||suite.taskIds||[]).filter(taskId=>(suite.taskIds||[]).includes(taskId));
        suite.caseBindings[id]=bound.map(taskId=>{const task=data.tasks.find(record=>record.id===taskId);return {taskId,dimensionNames:(task?.dimensions||[]).map(dimension=>dimension.name)};});
      }
      // Initial snapshots include explicit coverage; later user edits are never overwritten.
      if(suite.publishedSnapshot&&!suite.demoCoveragePrepared){suite.demoCoveragePrepared=true;suite.publishedSnapshot=evVersionSnapshot(suite);}
    }
    return data;
  }
  function repairSnapshot(experiment){return freeze(clone(experiment?.demoRepairs||{}));}
  function phaseFor(run,caseId){return run?.demoRepairSnapshot?.[caseId]?'repaired':'initial';}
  function caseFor(run,index){const row=run?.results?.[index];return run?.snapshot?.cases?.find(item=>item.id===row?.caseId)||null;}
  function contractHash(record){return global.AIOpsEvaluationDemoOnline?.caseContract?.(record)||null;}
  function matchesContract(record){
    const canonical=sceneData(String(record?.id).startsWith('SAL-')?'sales':'procurement').cases.find(item=>item.id===record?.id),actual=contractHash(record);
    return !!actual&&!!canonical&&actual===contractHash(canonical);
  }
  function recordForResult(result){return fixtures(result?.caseId,result?.demoEvidence?.phase||'initial');}
  function outcome(experiment,run,index){
    const record=caseFor(run,index);if(!record?.demoScenario||!matchesContract(record))return null;
    const fixture=fixtures(record.id,phaseFor(run,record.id));return fixture?.runtimeError?'运行失败':'通过';
  }
  function installCatalog(){
    if(installed)return api;installed=true;
    // Only records synchronously produced by the untouched shared factory are superseded.
    // Existing stores and imported copies have no such provenance and are never guessed from an ID.
    originals.store=global.evExperimentStore;global.evExperimentStore=function(scene=studio.scene){
      const fresh=!evExperimentStores[scene],store=originals.store(scene);
      if(fresh)for(const record of store.experiments||[])if(record.mock===true&&/^(SAL|PUR)-EXP-00[123]$/.test(record.id)&&!record.snapshot?.unifiedEvaluation)factoryOrigins.set(record,JSON.stringify(record));
      return store;
    };
    originals.seed=global.evSeedScene;global.evSeedScene=function(scene){return appendCatalog(originals.seed(scene),scene);};
    if(typeof evCatalog!=='undefined')for(const scene of ['sales','procurement'])if(evCatalog[scene])appendCatalog(evCatalog[scene],scene);
    originals.versions=global.evAgentVersions;global.evAgentVersions=function(agentId){return originals.versions(agentId).map(version=>({...version,runtime:version.runtime||{modelRef:'deepseek 4.1 flash',parameters:{temperature:0.2,maxOutputTokens:2400}},mock:true}));};
    originals.outcome=global.evExperimentOutcome;global.evExperimentOutcome=function(experiment,run,index){return outcome(experiment,run,index)||originals.outcome(experiment,run,index);};
    originals.newExecution=global.evExperimentNewExecution;global.evExperimentNewExecution=function(experiment,id,sequence,snapshot,fields){const run=originals.newExecution(experiment,id,sequence,snapshot,fields);if(snapshot?.cases?.some(record=>record.demoScenario))run.demoRepairSnapshot=repairSnapshot(experiment);return run;};
    originals.conversation=global.evExperimentCompleteConversation;global.evExperimentCompleteConversation=function(result,execution){originals.conversation(result,execution);if(result.demoEvidence)applyConversation(result,execution||{});};
    originals.trace=global.evExperimentMockTrace;global.evExperimentMockTrace=function(experiment,result){return result.demoEvidence?businessTrace(experiment,result):originals.trace(experiment,result);};
    originals.repair=global.evExperimentIssueCompleteRepair;global.evExperimentIssueCompleteRepair=function(issue,sourceRunId){
      originals.repair(issue,sourceRunId);if(!isCase(issue.caseId))return;
      const experiment=Object.values(evExperimentStores||{}).flatMap(store=>store.experiments||[]).find(record=>(record.issueLedger||[]).includes(issue));
      if(!experiment)return;experiment.demoRepairs=experiment.demoRepairs||{};
      experiment.demoRepairs[issue.caseId]={issueId:issue.id,sourceRunId,repairedAt:issue.repairedAt,revision:(experiment.demoRepairs[issue.caseId]?.revision||0)+1};
      issue.repair={...issue.repair,demoCaseId:issue.caseId,summary:fixtures(issue.caseId,'repaired')?.repairSummary||issue.repair.summary};
    };
    return api;
  }
  function applyConversation(result,execution){
    const fixture=recordForResult(result);if(!fixture)return;
    const id=result.conversationId||result.id+'-CONVERSATION',multi=execution.mode==='scenario_simulation',supplied=multi&&Array.isArray(fixture.turns)&&fixture.turns.length?fixture.turns:[{user:result.input,answer:fixture.answer||''}],turns=supplied.slice(0,multi?Math.max(1,Number(execution.maxTurns)||5):1),count=Math.max(1,turns.length),duration=Number(result.durationMs)||0,tokens=Number(result.tokens)||0,perTime=Math.floor(duration/count),perToken=Math.floor(tokens/count);
    result.messages=[];
    turns.forEach((turn,index)=>{
      const n=index+1,stamp=evExperimentTime((result.startedAtMs||Date.now())+index*perTime);
      result.messages.push({id:id+'-USER-'+n,role:'user',content:String(index===0?result.input:turn.user||'请继续核对已提供的业务信息。'),expected:index===0?String(result.expected||''):'',timestamp:stamp,turn:n,simulated:index>0});
      if(!fixture.runtimeError&&turn.answer)result.messages.push({id:id+'-AGENT-'+n,role:'assistant',content:String(turn.answer),timestamp:evExperimentTime((result.startedAtMs||Date.now())+(index+1)*perTime),turn:n,durationMs:index===count-1?duration-perTime*(count-1):perTime,tokens:index===count-1?tokens-perToken*(count-1):perToken});
    });
    const assistants=result.messages.filter(message=>message.role==='assistant');
    result.actualTurns=assistants.length;result.firstResponse=assistants[0]?.content||'';result.finalResponse=assistants.at(-1)?.content||'';result.actual=result.firstResponse;result.stopReason=fixture.runtimeError?'execution_error':multi?'goal_reached':'single_turn_completed';result.conversationPrepared=true;result.executionMode=execution.mode||'single_turn';
  }
  function businessTrace(experiment,result){
    const fixture=recordForResult(result)||{},rootId=result.id+'-demo-trace',duration=Math.max(0,Number(result.durationMs)||0),root={id:rootId,parentId:null,name:'本地 Mock 业务执行',type:'agent',status:fixture.runtimeError?'error':'completed',durationMs:duration,tokens:result.tokens||0,input:result.input,output:{actual:result.finalResponse||result.actual,completion:result.completion||'completed'},mock:true},spans=[root],turns=Math.max(1,result.actualTurns||1),slice=Math.max(1,Math.floor(duration/turns));
    for(let turn=1;turn<=turns;turn++){
      const user=result.messages.find(message=>message.role==='user'&&message.turn===turn),assistant=result.messages.find(message=>message.role==='assistant'&&message.turn===turn),offset=(turn-1)*slice;
      spans.push({id:rootId+'-INPUT-'+turn,parentId:rootId,name:'读取本轮业务请求',type:'user',turn,status:'completed',startOffsetMs:offset,durationMs:Math.floor(slice*.1),input:user?.content||result.input,output:user?.content||result.input,mock:true});
      spans.push({id:rootId+'-TOOL-'+turn,parentId:rootId,name:fixture.runtimeError?.tool||(experiment.scene==='procurement'?'Supplier Catalog':'Inventory Query'),type:'tool',turn,status:fixture.runtimeError?'error':'completed',startOffsetMs:offset+Math.floor(slice*.1),durationMs:Math.floor(slice*.35),input:{caseId:result.caseId,turn},output:fixture.runtimeError?null:clone(turns>1&&turn===1?(fixture.businessFirstResponse||{request:user?.content||result.input,evidenceState:'等待用户补充必要业务事实'}):(fixture.business||{})),...(fixture.runtimeError?{error:fixture.runtimeError.message}:{}),mock:true});
      if(assistant)spans.push({id:rootId+'-ANSWER-'+turn,parentId:rootId,name:'生成业务答复',type:'agent',turn,status:'completed',startOffsetMs:offset+Math.floor(slice*.45),durationMs:Math.floor(slice*.55),input:user?.content,output:assistant.content,tokens:assistant.tokens||0,mock:true});
    }
    (result.evaluations||[]).forEach((evaluation,index)=>spans.push({id:rootId+'-EVAL-'+index,parentId:rootId,name:'本地评分 · '+evaluation.name,type:'other',turn:evaluation.target==='conversation'?turns:1,status:'completed',durationMs:0,input:{evaluatorId:evaluation.evaluatorId,target:evaluation.target},output:{decision:evaluation.decision,score:evaluation.score},mock:true}));
    return {mock:true,complete:true,notice:'本地 Mock：来自固定业务场景的输入、业务事实、答复及独立评审夹具；未调用真实模型、工具或业务系统。',spans};
  }
  function prepareResult(experiment,run,index,status){
    const sample=caseFor(run,index);if(!sample?.demoScenario)return;
    if(!matchesContract(sample)){
      const result=run.results[index];delete result.demoEvidence;result.demoFixtureMismatch=true;result.conversationPrepared=false;
      result.actual='';result.reason=result.demoFixtureMismatchReason='本地 Mock 用例已修改，尚无对应的业务执行证据。';originals.conversation(result,run.snapshot.execution||{});result.trace=originals.trace(experiment,result);return;
    }
    const result=run.results[index],phase=phaseFor(run,sample.id),fixture=fixtures(sample.id,phase);if(!fixture)return;
    result.demoEvidence={caseId:sample.id,phase,caseContractHash:contractHash(sample)};result.actual=fixture.answer||'';result.conversationPrepared=false;result.mockAgentPassed=!fixture.runtimeError;
    if(fixture.runtimeError){result.status='运行失败';result.actual='';result.reason='Mock 运行失败：'+fixture.runtimeError.message;result.tokens=0;result.dimensions=[];result.evaluations=[];}
    evExperimentCompleteConversation(result,run.snapshot.execution||{});result.trace=businessTrace(experiment,result);return fixture.runtimeError?'运行失败':'通过';
  }
  function attachEvidence(context,experiment,run,result,caseRecord,conversation){
    if(!result?.demoEvidence)return;const fixture=recordForResult(result);if(!fixture)return;
    context.demoEvidence=clone(result.demoEvidence);context.targetOutput=context.target.output;
    context.target.context=clone(!conversation&&fixture.turns?.length>1?(fixture.businessFirstResponse||{request:result.input,evidenceState:'等待用户补充必要业务事实'}):(fixture.business||{}));
    const missing=fixture.missingEvidence||[];
    if(missing.includes('reference')){delete context.case.expected;delete context.target.reference;}
    else if(conversation&&fixture.reference!==undefined)context.target.reference=clone(fixture.reference);
    if(missing.includes('trajectory')){context.target.trajectory=[];context.target.evidenceCompleteness.trajectory='unknown';}
    if(missing.includes('messages')){context.target.messages=[];context.target.evidenceCompleteness.messages='unknown';}
    if(missing.includes('context'))delete context.target.context;
  }
  function compositeContext(experiment,run,result){return result.demoEvidence?{demoEvidence:clone(result.demoEvidence),targetOutput:result.finalResponse||result.actual,targetInput:result.input,targetReference:result.expected}:{};}
  function bindingContract(rows){return (rows||[]).map(binding=>({id:binding.id,evaluatorRef:binding.evaluatorRef,taskRef:binding.taskRef||null,role:binding.role||'gate',dimensionMappings:binding.dimensionMappings||[],target:binding.evaluationTarget||binding.target||'first_response'})).sort((a,b)=>a.id.localeCompare(b.id));}
  function same(left,right){return global.AIOpsUnifiedData.hash(left)===global.AIOpsUnifiedData.hash(right);}
  function availableBindings(rows){return (rows||[]).every(binding=>{const D=global.AIOpsUnifiedData,head=D.evaluator(binding.evaluatorRef.id);return !!D.evaluator(binding.evaluatorRef.id,binding.evaluatorRef.version)&&head?.enabled!==false&&head?.status!=='disabled';});}
  function missingDependencies(){
    const missing=new Map(),D=global.AIOpsUnifiedData;
    for(const scene of ['sales','procurement']){
      const specs=sceneData(scene),legacy=catalog().scene(scene,1),store=evExperimentStore(scene),seededIds=store.demoCatalogSeeds?.ids||(store.experiments.some(record=>record.demoCatalogVersion)?legacy.experiments.map(spec=>spec.id):[]),version=catalog().version||1;
      const pending=(specs.experiments||[]).filter(spec=>{
        const prior=store.experiments.find(record=>record.id===spec.id);
        if(!prior)return !seededIds.includes(spec.id);
        if(!prior.demoCatalogVersion||prior.demoSeedVersion>=version)return false;
        const old=legacy.experiments.find(record=>record.id===spec.id);
        return prior.configurationRevision===1&&old&&same(experimentContract(prior),experimentContract(experimentFields(old)));
      }),suiteIds=new Set(pending.flatMap(spec=>spec.suiteIds||[])),taskIds=new Set((specs.suites||[]).filter(suite=>suiteIds.has(suite.id)).flatMap(suite=>suite.taskIds||[])),bindings=[...(specs.tasks||[]).filter(task=>taskIds.has(task.id)).flatMap(task=>task.evaluationBindings||[]),...pending.flatMap(spec=>spec.bindings||spec.unifiedBindings||[])];
      for(const binding of bindings){
        const ref=binding.evaluatorRef||{},key=ref.id+'@'+ref.version;if(missing.has(key))continue;
        const head=D.evaluator(ref.id),version=D.evaluator(ref.id,ref.version);
        if(!version)missing.set(key,{...ref,reason:'缺少已发布版本'});
        else if(head?.enabled===false||head?.status==='disabled')missing.set(key,{...ref,reason:'评估器已停用'});
      }
    }
    return [...missing.values()];
  }
  function experimentSnapshotReady(record){
    const snapshot=record?.snapshot,unified=snapshot?.unifiedEvaluation;
    return !!snapshot&&Array.isArray(snapshot.cases)&&snapshot.cases.length>0&&Array.isArray(unified?.bindings)&&unified.bindings.length>0&&Array.isArray(unified.evaluatorVersions)&&unified.evaluatorVersions.length>0&&['weighted_score','custom_prompt'].includes(snapshot.execution?.evaluatorSummary?.mode);
  }
  function experimentFields(spec){return {name:spec.name,agentId:spec.agentId,version:spec.version||'V3',suiteIds:spec.suiteIds,unifiedBindings:clone(spec.bindings||spec.unifiedBindings||[]),execution:{concurrency:3,caseRuns:1,fullRuns:1,mcpIds:[],evaluationPolicy:'all_selected',...clone(spec.execution||{}),modelId:evEvaluationModels().some(model=>model.id===spec.execution?.modelId)?spec.execution.modelId:evEvaluationModels()[0].id},agentRuntimeOverride:spec.agentRuntimeOverride||{mode:'inherit',parameters:{}},judgeRuntime:spec.judgeRuntime||global.AIOpsUnifiedData.defaultJudgeRuntime()};}
  function experimentContract(record){
    const execution=record.execution||{},bindings=record.unifiedBindings||record.bindings||record.snapshot?.unifiedEvaluation?.bindings||[];
    return {name:record.name,agentId:record.agentId,version:record.version,suiteIds:[...(record.suiteIds||[])].sort(),bindings:bindingContract(bindings),agentRuntimeOverride:record.agentRuntimeOverride||record.snapshot?.agentRuntimeOverride,judgeRuntime:record.judgeRuntime||record.snapshot?.judgeRuntimeSnapshot,execution:{mode:execution.mode||'single_turn',concurrency:execution.concurrency,caseRuns:execution.caseRuns||1,fullRuns:execution.fullRuns||1,evaluationPolicy:execution.evaluationPolicy,evaluatorSummary:execution.evaluatorSummary,modelId:execution.modelId,mcpIds:[...(execution.mcpIds||[])].sort(),maxTurns:execution.maxTurns||5,scenarioPrompt:execution.scenarioPrompt||''}};
  }
  function untouchedTask(live,oldSpec,prior){
    if(!live||!oldSpec||!prior||prior.revision!==2||!same(bindingContract(prior.bindings),bindingContract(oldSpec.evaluationBindings)))return false;
    if(Object.values(prior.specification||{}).some(value=>String(value||'').trim()))return false;
    const fields=record=>Object.fromEntries(['id','name','agentId','prompt','dimensions','version'].map(key=>[key,record[key]]));return same(fields(live),fields(oldSpec));
  }
  function retireSupersededFactory(store){
    const retired=[];
    store.experiments=store.experiments.filter(record=>{
      const original=factoryOrigins.get(record);
      if(!original||original!==JSON.stringify(record))return true;
      retired.push(record.id);factoryOrigins.delete(record);
      // These untouched factory runs were never unified assessment records; only remove their local view caches.
      if(typeof evExperimentMetricContexts!=='undefined')evExperimentMetricContexts.delete(record.id);
      if(typeof evExperimentMetricSnapshots!=='undefined')for(const run of record.runs||[])evExperimentMetricSnapshots.delete(run.id);
      return false;
    });
    return retired;
  }
  function initializeExperiments(){
    installCatalog();const bridge=global.AIOpsUnifiedBridge;if(!bridge||!global.AIOpsUnifiedData||!catalog())return {ok:false,error:'演示评测依赖尚未就绪'};
    if(seeding)return {ok:true,unchanged:true};seeding=true;
    const previousScene=studio.scene,previousState=clone(evState),previousExperimentState=clone(evExperimentState),added=[],upgraded=[],preserved=[],retired=[],stores=[];
    try{
      const missing=missingDependencies();
      if(missing.length)return {ok:false,error:'新版评测实验所需评估器尚未就绪，已保留现有实验。'+missing.map(ref=>ref.id+' '+ref.version+'（'+ref.reason+'）').join('；'),missing,added,upgraded,preserved,retired};
      for(const scene of ['sales','procurement']){
        studio.scene=scene;const data=evData(),specs=sceneData(scene),legacy=catalog().scene(scene,1),store=evExperimentStore(scene);
        stores.push({store,specs});
        const seeded=store.demoCatalogSeeds||(store.demoCatalogSeeds={version:0,ids:store.experiments.some(item=>item.demoCatalogVersion)?legacy.experiments.map(item=>item.id):[]});
        const state=bridge.state(),changedTasks=new Set();
        for(const task of specs.tasks||[]){
          const live=data.tasks.find(item=>item.id===task.id),prior=state.tasks[scene+':'+task.id],oldSpec=legacy.tasks.find(item=>item.id===task.id),initial=!prior||prior.revision===1&&!prior.bindings?.length;
          if(!live||!availableBindings(task.evaluationBindings)||!initial&&!untouchedTask(live,oldSpec,prior))continue;
          if(task.evaluationBindings?.length){bridge.setTaskBindings(live.id,task.evaluationBindings);live.evaluationBindings=clone(task.evaluationBindings);}
          if(task.specification)bridge.setTaskSpecification(live.id,task.specification);
          changedTasks.add(task.id);
        }
        for(const suite of specs.suites||[])if(!state.suiteCurrent[scene+':'+suite.id]||(suite.taskIds||[]).some(id=>changedTasks.has(id)))bridge.repinSuite(suite.id,{silent:true});
        for(const spec of specs.experiments||[]){
          const prior=store.experiments.find(experiment=>experiment.id===spec.id),version=catalog().version||1;
          if(!availableBindings(spec.bindings||spec.unifiedBindings)){if(prior)preserved.push(prior.id);continue;}
          if(prior){
            if(!prior.demoCatalogVersion||prior.demoSeedVersion>=version)continue;
            const oldSpec=legacy.experiments.find(item=>item.id===spec.id),untouched=prior.configurationRevision===1&&oldSpec&&same(experimentContract(prior),experimentContract(experimentFields(oldSpec)));
            if(!untouched){preserved.push(prior.id);continue;}
            // Only the current factory plan is upgraded; frozen runs, findings and repair state retain their original evidence.
            const updated=bridge.updateExperiment(prior.id,experimentFields(spec));if(!experimentSnapshotReady(updated))throw Error('实验「'+spec.name+'」未生成完整评估快照');prior.demoCatalogVersion=version;prior.demoSeedVersion=version;upgraded.push(prior.id);continue;
          }
          if(seeded.ids.includes(spec.id))continue;
          const experiment=bridge.createExperiment(experimentFields(spec));
          if(!experimentSnapshotReady(experiment))throw Error('实验「'+spec.name+'」未生成完整评估快照');
          experiment.id=spec.id;experiment.demoCatalogVersion=version;experiment.demoState=spec.demoState;experiment.createdAtMs=Date.parse(global.AIOpsEvaluationDemoOnline?.epoch?.()||new Date().toISOString())-3*3600000;experiment.createdAt=evExperimentTime(experiment.createdAtMs);added.push(experiment.id);
          seeded.ids.push(experiment.id);seeded.version=version;
          if(['unrun','not_run','draft','ready'].includes(spec.demoState)){experiment.demoSeedVersion=version;continue;}
          if(!experiment.runs.length)seedRun(experiment,spec);
          if(spec.demoLifecycle===true||/-WEIGHT$/.test(spec.id))seedLifecycle(experiment);
          experiment.demoSeedVersion=version;
        }
      }
      // Retire the old examples only after every replacement is present with a usable frozen plan.
      // A blocked data store or missing evaluator must never turn the experiment list into an empty success.
      for(const {store,specs} of stores){
        if(!(specs.experiments||[]).length||!store.experiments.some(record=>factoryOrigins.get(record)===JSON.stringify(record)))continue;
        if(!specs.experiments.every(spec=>experimentSnapshotReady(store.experiments.find(record=>record.id===spec.id))))throw Error('新版评测实验尚未完整创建，保留原有实验');
      }
      for(const {store,specs} of stores)if((specs.experiments||[]).length)retired.push(...retireSupersededFactory(store));
      return {ok:true,added,upgraded,preserved,retired};
    }catch(error){return {ok:false,error:'新版评测实验初始化失败，已保留现有实验。'+(error?.message||'请检查评估数据是否可用。'),added,upgraded,preserved,retired};
    }finally{seeding=false;studio.scene=previousScene;evData();Object.assign(evState,previousState);Object.assign(evExperimentState,previousExperimentState);if(retired.includes(evExperimentState.id))Object.assign(evExperimentState,{id:null,runId:'',supplementId:''});}
  }
  function seedRun(experiment,spec){
    const run=evExperimentNewExecution(experiment,experiment.id+'-RUN-001',1,experiment.snapshot,{kind:'full',status:'运行中',supplements:[]});experiment.runs.unshift(run);experiment.sequence=1;run.results=evExperimentResultRows(experiment,run.id);
    let cursor=Date.now()-3600000;run.startedAtMs=cursor;run.startedAt=evExperimentTime(cursor);
    run.results.forEach((result,index)=>{if(!result.enabled)return;result.startedAtMs=cursor;cursor+=700;evExperimentCompleteResult(experiment,run,index,evExperimentOutcome(experiment,run,index),cursor);});
    run.endedAtMs=cursor;run.endedAt=evExperimentTime(cursor);run.elapsedMs=evExperimentSummary(run).durationMs;run.status=run.results.some(result=>['未通过','运行失败'].includes(result.status))?'部分失败':'已完成';experiment.status=run.status;
    if(typeof evExperimentReportSync==='function')evExperimentReportSync(experiment,run);
    if(['analyzed','issues','lifecycle','repair','closed_loop'].includes(spec.demoState))evExperimentIssueAnalyzeComplete(experiment,run);
    return run;
  }
  function seedValidation(experiment,source,issue){
    evExperimentIssueCompleteRepair(issue,source.id);
    const sequence=(experiment.validationRuns||[]).length+1,run=evExperimentPrepareRetryExecution(experiment,source,issue.caseId,{validationIssueId:issue.id,validationSequence:sequence});
    experiment.validationRuns=experiment.validationRuns||[];experiment.validationRuns.push(run);run.status='运行中';run.startedAtMs=Date.now()-120000;run.startedAt=evExperimentTime(run.startedAtMs);
    run.results.forEach((result,index)=>{result.startedAtMs=run.startedAtMs;evExperimentCompleteResult(experiment,run,index,evExperimentOutcome(experiment,run,index),run.startedAtMs+700);});
    run.endedAtMs=run.startedAtMs+700;run.endedAt=evExperimentTime(run.endedAtMs);run.elapsedMs=evExperimentSummary(run).durationMs;run.status=run.results.some(result=>['未通过','运行失败'].includes(result.status))?'部分失败':'已完成';
    evExperimentIssueSyncVerification(experiment,run);return run;
  }
  function seedLifecycle(experiment){
    const source=experiment.runs[0];if(!source)return;
    evExperimentIssueAnalyzeComplete(experiment,source);const ledger=experiment.issueLedger||[],byBehavior=behavior=>ledger.find(issue=>sceneData(experiment.scene).cases.find(record=>record.id===issue.caseId)?.demoScenario?.repairBehavior===behavior&&(behavior!=='missing'||issue.evaluatorId===catalog().evaluatorIds.evidence));
    // These are prior local demonstration actions; live CORE experiments remain untouched for first-use repair.
    const pending=byBehavior('resolved');if(pending)evExperimentIssueCompleteRepair(pending,source.id);
    const persistent=byBehavior('persists');if(persistent)seedValidation(experiment,source,persistent);
    const missing=byBehavior('missing');if(missing)seedValidation(experiment,source,missing);
    const resolved=ledger.find(issue=>issue!==pending&&issue.caseId!==pending?.caseId&&sceneData(experiment.scene).cases.find(record=>record.id===issue.caseId)?.demoScenario?.repairBehavior==='resolved');
    if(resolved){seedValidation(experiment,source,resolved);if(resolved.verificationPassed){Object.assign(evExperimentState,{id:experiment.id,tab:'问题优化',runId:source.id,supplementId:''});evExperimentIssueSetStatus(experiment.id,resolved.id,'已关闭');}}
  }
  const api={installCatalog,initializeExperiments,prepareResult,attachEvidence,compositeContext,fixture:fixtures,phaseFor,isDemoCase:isCase,isDemoExperiment:isExperiment};
  global.AIOpsEvaluationDemoRuntime=api;
})(window);
