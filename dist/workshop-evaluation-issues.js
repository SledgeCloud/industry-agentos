/* Immutable run discoveries plus experiment-scoped issue lifecycle for the local Mock. */
'use strict';
const evExperimentIssueStatuses = ['待修复','待验证','验证完成','已关闭'];
function evExperimentIssueNormalize(issue){const legacy={'待处理':'待修复','处理中':'待修复','已修复':'待验证','验证中':'待验证','已解决':'已关闭','已忽略':'已关闭'};issue.status=legacy[issue.status]||issue.status||'待修复';delete issue.owner;return issue;}
const evExperimentIssueTypes = ['运行异常','评估未达标','维度未达标','结果未通过','手工标注'];
const evExperimentIssueState = {key:'',scope:'all',search:''};
function evExperimentIssueSelectedRun(experiment){return typeof evExperimentSelectedRun==='function'?evExperimentSelectedRun(experiment):evExperimentRunGet(experiment,evExperimentState.runId);}
function evExperimentIssueExecutions(experiment){return typeof evExperimentExecutions==='function'?evExperimentExecutions(experiment):(experiment?.runs||[]).flatMap(run=>[run,...(run.supplements||[])]);}
function evExperimentIssueExecution(experiment,id){return typeof evExperimentExecutionGet==='function'?evExperimentExecutionGet(experiment,id):evExperimentIssueExecutions(experiment).find(run=>run.id===id)||null;}
function evExperimentIssueExecutionLabel(run){return typeof evExperimentReportExecutionLabel==='function'?evExperimentReportExecutionLabel(run):'评测记录 #'+(Number(run?.sequence)||1)+(run?.kind==='supplement'||run?.parentRunId?' · 补跑 #'+(Number(run.supplementSequence)||1):'');}
function evExperimentIssueAttempt(result){return Number(result?.attempt??result?.iteration)||1;}
function evExperimentIssueScopeMatches(occurrence,scope){return !scope||scope==='all'||occurrence.runId===scope||(occurrence.recordId||occurrence.runId)===scope;}

function evExperimentDetectIssues(experiment, run) {
  if (!run || run.kind==='validation' || run.experimentId !== experiment.id) return [];
  const findings=[];
  const known = new Map();
  const add = (result, suffix, values) => {
    const id = result.id + '-ISSUE-' + suffix;
    if (known.has(id)) return;
    const time = run.endedAt || run.startedAt || evExperimentTime();
    const issue = {
      id, code:'ISS-' + String(findings.length + 1).padStart(3,'0'),
      experimentId:experiment.id,runId:run.id,recordId:run.parentRunId||run.id,resultId:result.id,
      caseId:result.caseId,caseName:result.name,attempt:evExperimentIssueAttempt(result),supplementSequence:run.supplementSequence,
      severity:'中',status:'待修复',note:'',createdAt:time,updatedAt:time,
      sourceKind:'ai',sourceLabel:'AI分析',...values,name:values.rule+' · '+result.name,rootCause:values.type==='运行异常'?'初步判断：工具或数据依赖未成功返回，导致 Agent 无法完成本次执行。':values.type==='维度未达标'?'初步判断：任务要求中的「'+values.rule+'」未被完整覆盖，相关步骤或结果检查可能缺失。':values.type==='评估未达标'?'初步判断：输出未落实「'+values.rule+'」要求，可能缺少对应约束的执行检查或必要业务依据。':'初步判断：实际输出与预期存在差异，业务要求可能尚未转化为明确的生成约束和校验步骤。',history:[{time,description:'AI结果分析完成后发现问题'}]
    };
    known.set(id,issue);findings.push(issue);
  };
  for (const result of run.results || []) {
    if (result.status === '运行失败') {
      add(result,'runtime',{type:'运行异常',severity:'高',source:'Agent / 工具执行',rule:'执行异常',
        reason:result.reason || '执行失败，未产生完整的业务输出。',
        suggestion:'检查关联工具、数据源与超时配置，修复后重新运行实验验证。'});
      continue;
    }
    if (!['通过','未通过'].includes(result.status)) continue;
    let detected = false;
    for (const [evaluatorIndex,evaluator] of (result.evaluations || []).entries()) {
      const failed = (evaluator.criteria || []).map((criterion,index) => ({criterion,index})).filter(({criterion}) => criterion.passed === false);
      for (const {criterion,index} of failed) {
        detected = true;
        add(result,'eval-' + evaluatorIndex + '-criterion-' + index,{
          type:'评估未达标',source:evaluator.name || evaluator.evaluatorId || '离线评估器',
          evaluatorId:evaluator.evaluatorId,evaluatorVersion:evaluator.version,
          rule:criterion.name || '未命名评分项',standard:criterion.description || '',
          reason:criterion.reason || evaluator.reason || '该评估项未达到配置的通过条件。',
          suggestion:'结合预期结果和该评估项的判断标准，补充 Agent 提示词、业务规则或知识，并通过新运行验证。'
        });
      }
      if (!failed.length && evaluator.passed === false) {
        detected = true;
        add(result,'eval-' + evaluatorIndex,{
          type:'评估未达标',source:evaluator.name || evaluator.evaluatorId || '离线评估器',
          evaluatorId:evaluator.evaluatorId,evaluatorVersion:evaluator.version,rule:'评估条件未满足',
          reason:evaluator.reason || '评估器判定未通过。',suggestion:'核对该评估器的判断依据与业务要求，调整后重新验证。'
        });
      }
    }
    for (const [index,dimension] of (result.dimensions || []).entries()) {
      if (dimension.passed !== false) continue;
      detected = true;
      add(result,'dimension-' + index,{
        type:'维度未达标',source:dimension.taskName || '业务任务维度',
        rule:dimension.name || '未命名维度',standard:dimension.description || '',
        reason:dimension.reason || '业务任务维度未达到预期要求。',
        suggestion:'核对业务任务定义和该维度要求，补齐缺失的业务结果，再重新运行验证。'
      });
    }
    if (result.status === '未通过' && !detected) add(result,'quality',{
      type:'结果未通过',source:'用例结果',rule:'未满足预期结果',reason:result.reason || '用例结果未通过。',
      suggestion:'对照输入、预期与实际结果定位差异，修复后重新运行验证。'
    });
  }
  return findings;
}


// Execution and rendering do not discover problems. Only an explicit completed
// analysis or a saved annotation may add raw findings to the issue ledger.
function evExperimentIssuesSync(experiment,run){
 if(!experiment||!run||run.experimentId!==experiment.id)return [];
 if(!Array.isArray(run.issues))run.issues=[];
 if(run.validationIssueId)evExperimentIssueSyncVerification(experiment,run);
 return run.issues;
}
function evExperimentIssueAnalyzeComplete(experiment,run,resultIds=null){
 if(!experiment||experiment.scene!==studio.scene||!run||run.kind==='validation'||run.experimentId!==experiment.id||evExperimentIssueExecution(experiment,run.id)!==run)throw Error('当前实验或评测记录已变更，请重新发起结果分析');
 if(!['已完成','部分失败','已停止'].includes(run.status)||!run.results?.some(result=>['通过','未通过','运行失败'].includes(result.status)))throw Error('请等待评测记录产生完整执行结果后再分析');
 const selected=resultIds===null?null:new Set(resultIds);if(selected&&(!selected.size||[...selected].some(id=>!run.results.some(result=>result.id===id&&['通过','未通过','运行失败'].includes(result.status)))))throw Error('所选用例结果不可分析');
 const findings=evExperimentDetectIssues(experiment,run).filter(finding=>!selected||selected.has(finding.resultId)),existing=evExperimentIssuesSync(experiment,run),known=new Set(existing.map(issue=>issue.id)),time=evExperimentTime();
 for(const finding of findings)if(!known.has(finding.id)){finding.createdAt=finding.updatedAt=time;existing.push(finding);known.add(finding.id);}
 const completedIds=run.results.filter(result=>['通过','未通过','运行失败'].includes(result.status)).map(result=>result.id),analyzed=[...new Set([...(run.issueAnalysis?.resultIds||[]),...(selected?[...selected]:completedIds)])];
 run.issueAnalysis={status:completedIds.every(id=>analyzed.includes(id))?'completed':'partial',completedAt:time,completedAtMs:Date.now(),resultIds:analyzed,findingCount:existing.filter(item=>item.sourceKind==='ai').length};
 evExperimentIssueLedgerSync(experiment);return existing;
}
function evExperimentIssueFromAnnotation(context,annotation,targetKey){
 const {current:experiment,run,result}=context||{};
 if(!experiment||experiment.scene!==studio.scene||!run||run.kind==='validation'||!result||run.experimentId!==experiment.id||evExperimentIssueExecution(experiment,run.id)!==run||evExperimentIssueResult(run,result.id)!==result||!annotation?.note||typeof targetKey!=='string')return false;
 const findings=evExperimentIssuesSync(experiment,run),id=result.id+'-ANNOTATION-'+encodeURIComponent(targetKey),time=annotation.updatedAt||evExperimentTime(),existing=findings.find(issue=>issue.id===id);
 const label=annotation.label||(annotation.targetType==='output'?'第 '+annotation.turn+' 轮 Agent 输出':'评估结果'),values={name:annotation.problemType+' · '+result.name,type:'手工标注',problemType:annotation.problemType,sourceKind:'annotation',sourceLabel:'手工标注',source:label,rule:label,targetKey,annotationTarget:targetKey,reason:String(annotation.note),rootCause:String(annotation.note),suggestion:'根据标注内容核对业务要求，完善 Agent 输出或相关规则后验证。',updatedAt:time};
 if(existing)Object.assign(existing,values);
 else findings.push({id,code:'ANN-'+String(findings.length+1).padStart(3,'0'),experimentId:experiment.id,runId:run.id,recordId:run.parentRunId||run.id,resultId:result.id,caseId:result.caseId,caseName:result.name,attempt:evExperimentIssueAttempt(result),supplementSequence:run.supplementSequence,severity:'中',status:'待修复',note:'',createdAt:time,...values,history:[{time,description:'根据手工标注创建问题'}]});
 const ledger=evExperimentIssueLedgerSync(experiment);return ledger.find(issue=>issue.occurrences.some(item=>item.rawIssueId===id&&item.runId===run.id))||false;
}
function evExperimentIssueVerify(experimentId,issueId){
 const current=typeof evExperimentCurrent==='function'?evExperimentCurrent():undefined,experiment=typeof evExperimentGet==='function'?evExperimentGet(experimentId):current;
 if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene||current!==undefined&&current?.id!==experimentId){if(typeof toast==='function')toast('当前实验或场景已变更');return false;}
 if(typeof evExperimentIssueValidationBatch==='function'&&evExperimentIssueValidationBatch(experiment)||typeof evExperimentIssueRepairBatch==='function'&&evExperimentIssueRepairBatch(experiment)){if(typeof toast==='function')toast('问题正在批量处理，请等待完成');return false;}
 const issue=evExperimentIssueLedgerSync(experiment).find(item=>item.id===issueId);
 if(!issue||!['待验证','验证完成'].includes(issue.status)||issue.verifying||evExperimentIssueRepairPhase(experiment,issue)){if(typeof toast==='function')toast('请先完成问题修复，再进行验证');return false;}
 const occurrence=issue.occurrences.at(-1),source=evExperimentIssueExecution(experiment,occurrence?.runId);
 try{
  const execution=evRunExperiment(experiment.id,source,issue.caseId,{validationIssueId:issue.id});
  issue.status='待验证';issue.verifying=true;issue.validationRunId=execution.id;issue.updatedAt=evExperimentTime();issue.history.push({time:issue.updatedAt,kind:'validation-started',runId:execution.id,description:'启动问题验证，独立执行关联用例。'});
  if(typeof evRender==='function')evRender();if(typeof toast==='function')toast('已启动问题验证');return execution;
 }catch(error){if(typeof toast==='function')toast(error.message||'无法启动验证');return false;}
}
function evExperimentIssueSyncVerification(experiment,run){
 if(!run.validationIssueId||!['已完成','部分失败','已停止'].includes(run.status))return;
 const issue=(experiment.issueLedger||[]).find(item=>item.id===run.validationIssueId);if(!issue)return;
 const rows=(run.results||[]).filter(result=>result.caseId===issue.caseId);if(!rows.length)return;
 const complete=rows.every(result=>['通过','未通过','运行失败'].includes(result.status)),passed=complete&&rows.every(result=>result.status==='通过');
 if(issue.verifications.some(item=>item.validationRunId===run.id))return;
 const time=run.endedAt||evExperimentTime();
 for(const [index,result] of rows.entries()){
  const verified=['通过','未通过','运行失败'].includes(result.status),entry={runId:run.id,validationRunId:run.id,sourceRecordId:run.sourceRecordId,kind:'validation',validationSequence:run.validationSequence,resultId:result.id,attempt:evExperimentIssueAttempt(result),sequence:Number(run.sequence)||0,time:result.endedAt||time,verifiedAtMs:evExperimentIssueStamp(result.endedAtMs)||evExperimentIssueStamp(time),order:evExperimentIssueEvidenceOrder(run,index),status:result.status==='通过'?'验证通过':verified?'验证未通过':'验证未完成',passed:result.status==='通过',explicit:true};
  issue.verifications.push(entry);issue.latestVerification=entry;
 }
 issue.verifying=false;issue.verificationPassed=passed;issue.status=complete?'验证完成':'待验证';issue.updatedAt=time;
 issue.history.push({time,kind:'validated',runId:run.id,description:passed?'问题验证通过，等待确认关闭。':complete?'问题验证完成，结果未通过，可重新修复。':'验证未完成，保留待验证状态。'});
}

// Raw discoveries stay on each execution. Handling spans records and supplements.
function evExperimentIssueStamp(value){
  if(typeof value==='number')return Number.isFinite(value)?value:0;
  if(!value||typeof value!=='string')return 0;
  if(typeof evExperimentTimestamp==='function')return evExperimentTimestamp(value)||0;
  const text=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)?value.replace(' ','T')+'+08:00':value;
  return Date.parse(text)||0;
}
function evExperimentIssueCanonical(value){
  if(Array.isArray(value))return value.map(evExperimentIssueCanonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,evExperimentIssueCanonical(value[key])]));
  return value;
}
function evExperimentIssueDefinition(criterion={}){return {id:criterion.id||'',name:criterion.name||'',description:criterion.description||'',weight:criterion.weight??null,passScore:criterion.passScore??null};}
function evExperimentIssueIdentity(experiment,run,raw,result){
  const snapshot=run.snapshot||experiment.snapshot||{},sample=(snapshot.cases||[]).find(item=>item.id===(raw.caseId||result?.caseId))||{};
  const identity={caseId:raw.caseId||result?.caseId||'',expected:sample.expected??result?.expected??'',type:raw.type};
  if(raw.sourceKind==='annotation')identity.judgment={kind:'annotation',sourceKind:'annotation',runId:run.id,resultId:result?.id||raw.resultId,targetKey:raw.targetKey||raw.annotationTarget||''};
  else if(raw.type==='评估未达标'){
    const match=/-ISSUE-eval-(\d+)(?:-criterion-(\d+))?$/.exec(raw.id||''),evaluations=result?.evaluations||[],evaluation=(match?evaluations[Number(match[1])]:null)||evaluations.find(item=>item.evaluatorId===raw.evaluatorId)||{};
    const evaluator=(snapshot.evaluators||[]).find(item=>item.id===(evaluation.evaluatorId||raw.evaluatorId))||{};
    const criterion=match?.[2]!==undefined?(evaluation.criteria||[])[Number(match[2])]:(evaluation.criteria||[]).find(item=>item.name===raw.rule),definition=criterion?((evaluator.criteria||[]).find(item=>item.id&&item.id===criterion.id)||(evaluator.criteria||[]).find(item=>item.name===criterion.name)||criterion):null;
    identity.judgment={kind:criterion||match?.[2]!==undefined?'criterion':'evaluator',evaluatorId:evaluation.evaluatorId||raw.evaluatorId||evaluator.id||raw.source||'',version:evaluation.version||raw.evaluatorVersion||evaluator.version||'',description:evaluator.description||'',passScore:evaluator.passScore??evaluation.passScore??null};
    if(definition)identity.judgment.criterion=evExperimentIssueDefinition({...definition,passScore:definition.passScore??criterion?.passScore??evaluator.passScore??null});
    else if(match?.[2]!==undefined)identity.judgment.criterion={name:raw.rule||'',description:raw.standard||''};
    else identity.judgment.criteria=(evaluator.criteria||evaluation.criteria||[]).map(evExperimentIssueDefinition).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }else if(raw.type==='维度未达标'){
    const match=/-ISSUE-dimension-(\d+)$/.exec(raw.id||''),dimension=(match?(result?.dimensions||[])[Number(match[1])]:null)||(result?.dimensions||[]).find(item=>item.name===raw.rule&&(!raw.taskId||item.taskId===raw.taskId))||{};
    const task=(snapshot.tasks||[]).find(item=>item.id===dimension.taskId)||{},definition=(task.dimensions||[]).find(item=>item.id&&item.id===dimension.id)||(task.dimensions||[]).find(item=>item.name===(dimension.name||raw.rule))||dimension;
    identity.judgment={kind:'dimension',taskId:dimension.taskId||task.id||dimension.taskName||raw.source||'',id:definition.id||'',name:definition.name||raw.rule||'',description:definition.description||raw.standard||'',values:definition.values||[]};
  }else if(raw.type==='运行异常')identity.judgment={kind:'runtime',rule:raw.rule||'执行异常',mcps:(snapshot.mcps||[]).map(item=>({id:item.id||item.name,version:item.version||''})).sort((a,b)=>String(a.id).localeCompare(String(b.id)))};
  else identity.judgment={kind:'result',rule:raw.rule||'未满足预期结果',evaluators:(snapshot.evaluators||[]).map(item=>({id:item.id,version:item.version,description:item.description,criteria:(item.criteria||[]).map(evExperimentIssueDefinition)})),tasks:(snapshot.tasks||[]).map(task=>({id:task.id,dimensions:task.dimensions||[]}))};
  return evExperimentIssueCanonical(identity);
}
function evExperimentIssueFingerprint(experiment,run,raw,result){return JSON.stringify(evExperimentIssueIdentity(experiment,run,raw,result));}
function evExperimentIssueResult(run,resultId){return run?.results?.find(item=>item.id===resultId)||(run?.reexecutions||[]).flatMap(item=>item.results||[]).find(item=>item.id===resultId)||null;}
function evExperimentIssueEvidenceRuns(experiment){
  return evExperimentIssueExecutions(experiment).flatMap(run=>[
    ...(run.reexecutions||[]).map(archive=>({...archive.run,snapshot:archive.snapshot||archive.report?.evidence?.snapshot||run.snapshot,results:archive.results,issues:JSON.parse(JSON.stringify(archive.issues||[])),retryRevision:archive.revision-1,legacyArchiveRevision:archive.revision})),
    run
  ]).sort((a,b)=>evExperimentIssueExecutionStamp(a)-evExperimentIssueExecutionStamp(b)||(Number(a.sequence)||0)-(Number(b.sequence)||0)||(Number(a.supplementSequence)||0)-(Number(b.supplementSequence)||0)||(Number(a.retryRevision)||0)-(Number(b.retryRevision)||0));
}
function evExperimentIssueExecutionStamp(run){return evExperimentIssueStamp(run.retryStartedAtMs||run.retryStartedAt||run.startedAtMs||run.startedAt);}
function evExperimentIssueEvidenceOrder(run,index){const stamp=evExperimentIssueExecutionStamp(run),revision=Number(run.supplementSequence??run.retryRevision)||0;return stamp?stamp*1000+Math.min(revision,99)*10+index:(Number(run.sequence)||0)*100000000+revision*10000+index;}
function evExperimentIssueOccurrence(run,raw,result,index){
  const time=result?.endedAt||raw.createdAt||run.endedAt||run.startedAt||'',detectedAtMs=evExperimentIssueStamp(result?.endedAtMs)||evExperimentIssueStamp(time)||evExperimentIssueStamp(run.startedAtMs)||evExperimentIssueStamp(run.startedAt);
  return {runId:run.id,recordId:run.parentRunId||run.id,kind:run.kind,parentRunId:run.parentRunId,supplementSequence:run.supplementSequence,legacyArchiveRevision:run.legacyArchiveRevision,resultId:raw.resultId,rawIssueId:raw.id,sequence:Number(run.sequence)||0,attempt:evExperimentIssueAttempt(raw.attempt===undefined?result:raw),time,detectedAtMs,order:evExperimentIssueEvidenceOrder(run,index),agentVersion:run.snapshot?.agent?.version||'',caseVersion:result?.version||'',reason:raw.reason||'',standard:raw.standard||'',rule:raw.rule||'',source:raw.source||'',sourceKind:raw.sourceKind||'ai',sourceLabel:raw.sourceLabel||'AI分析'};
}
function evExperimentIssueImportHandling(issue,raw,occurrence){
 const status=evExperimentIssueNormalize({status:raw.status}).status;
 if(status==='待修复'&&!raw.note)return;
 const stamp=evExperimentIssueStamp(raw.updatedAt)||occurrence.detectedAtMs;if(stamp<Math.max(issue.lastUserUpdateAtMs||0,issue.lastLegacyUpdateAtMs||0))return;
 issue.status=evExperimentIssueStatuses.includes(status)?status:issue.status;issue.note=raw.note||issue.note||'';issue.updatedAt=raw.updatedAt||occurrence.time;issue.lastLegacyUpdateAtMs=stamp;
 if(issue.status==='已关闭'){issue.closedAtMs=stamp;issue.closedAfterOrder=occurrence.order;}
}
function evExperimentIssueLedgerSync(experiment){
  if(!experiment)return [];
  if(!Array.isArray(experiment.issueLedger))experiment.issueLedger=[];
  const ledger=experiment.issueLedger;ledger.forEach(evExperimentIssueNormalize);const byFingerprint=new Map(ledger.map(issue=>[issue.fingerprint,issue]));
  experiment.issueLedgerSequence=Math.max(Number(experiment.issueLedgerSequence)||0,...ledger.map(issue=>Number(String(issue.id).split('-').at(-1))||0),0);
  const runs=evExperimentIssueEvidenceRuns(experiment);
  for(const run of runs){
    const rawIssues=evExperimentIssuesSync(experiment,run),failed=new Set(),results=new Map((run.results||[]).map((result,index)=>[result.id,{result,index}]));
    for(const raw of rawIssues){
      if(!results.has(raw.resultId))continue;
      const found=results.get(raw.resultId)||{},result=found.result,fingerprint=evExperimentIssueFingerprint(experiment,run,raw,result);failed.add(fingerprint);
      let issue=byFingerprint.get(fingerprint);
      if(!issue){
        const number=++experiment.issueLedgerSequence;
        issue={id:experiment.id+'-LEDGER-'+String(number).padStart(4,'0'),code:'ISS-'+String(number).padStart(3,'0'),fingerprint,definition:evExperimentIssueIdentity(experiment,run,raw,result),caseId:raw.caseId,caseName:raw.caseName,type:raw.type,severity:raw.severity,source:raw.source,sourceKind:raw.sourceKind||'ai',sourceLabel:raw.sourceLabel||'AI分析',name:raw.name||raw.rule,rootCause:raw.rootCause||raw.reason||'',problemType:raw.problemType||'',rule:raw.rule,standard:raw.standard||'',reason:raw.reason||'',suggestion:raw.suggestion||'',evaluatorId:raw.evaluatorId,evaluatorVersion:raw.evaluatorVersion,status:'待修复',note:'',occurrences:[],verifications:[],history:[],createdAt:raw.createdAt||run.startedAt||'',updatedAt:raw.updatedAt||raw.createdAt||run.startedAt||''};
        ledger.push(issue);byFingerprint.set(fingerprint,issue);
      }
      if(issue.occurrences.some(item=>item.runId===run.id&&item.rawIssueId===raw.id&&item.legacyArchiveRevision===run.legacyArchiveRevision)){if(raw.sourceKind==='annotation')for(const key of ['name','rootCause','reason','suggestion','problemType','sourceKind','sourceLabel'])if(raw[key]!==undefined)issue[key]=raw[key];continue;}
      const occurrence=evExperimentIssueOccurrence(run,raw,result,found.index||0);issue.occurrences.push(occurrence);
      if(issue.firstSeenOrder===undefined||occurrence.order<issue.firstSeenOrder){issue.firstSeenOrder=occurrence.order;issue.firstSeenAt=occurrence.time;issue.firstSeenAtMs=occurrence.detectedAtMs;}
      const newer=issue.lastSeenOrder===undefined||occurrence.order>issue.lastSeenOrder;
      if(newer){issue.lastSeenOrder=occurrence.order;issue.lastSeenAt=occurrence.time;issue.lastSeenAtMs=occurrence.detectedAtMs;for(const key of ['caseName','severity','source','sourceKind','sourceLabel','name','rootCause','problemType','rule','standard','reason','suggestion','evaluatorId','evaluatorVersion'])if(raw[key]!==undefined)issue[key]=raw[key];}
      issue.history.push({time:occurrence.time,description:evExperimentIssueExecutionLabel(occurrence)+' 发现问题（用例执行 #'+occurrence.attempt+'）。',kind:'discovery',runId:run.id,resultId:raw.resultId});
      evExperimentIssueImportHandling(issue,raw,occurrence);
      const closed=issue.status==='已关闭',laterThanClose=occurrence.detectedAtMs>Number(issue.closedAtMs||0)||(!occurrence.detectedAtMs&&occurrence.order>Number(issue.closedAfterOrder||0));
      if(newer&&(closed&&laterThanClose||['待验证','验证完成'].includes(issue.status)&&occurrence.order>Number(issue.latestVerification?.order||0))){issue.status='待修复';issue.updatedAt=occurrence.time;issue.history.push({time:occurrence.time,description:evExperimentIssueExecutionLabel(occurrence)+' 相同问题再次出现，重新打开为待修复。',kind:'reopened',runId:run.id});}
    }
  }
  for(const validation of experiment.validationRuns||[])evExperimentIssueSyncVerification(experiment,validation);
  return ledger;
}
function evExperimentIssuesSummary(run){const issues=run?.issues||[],count=status=>issues.filter(issue=>evExperimentIssueNormalize(issue).status===status).length;return {total:issues.length,pending:count('待修复'),verify:count('待验证'),verified:count('验证完成'),closed:count('已关闭')};}
function evExperimentIssuesUI(experiment){
  const key=experiment.scene+':'+experiment.id;
  if(evExperimentIssueState.key!==key){Object.assign(evExperimentIssueState,{key,scope:'all',search:''});if(typeof evClearFilters==='function')evClearFilters('experimentIssue');}
  if(evExperimentIssueState.scope!=='all'&&!evExperimentIssueExecution(experiment,evExperimentIssueState.scope))evExperimentIssueState.scope='all';
  return evExperimentIssueState;
}
function evExperimentIssueScopeIssues(experiment){const state=evExperimentIssuesUI(experiment),issues=evExperimentIssueLedgerSync(experiment);return state.scope==='all'?issues:issues.filter(issue=>issue.occurrences.some(occurrence=>evExperimentIssueScopeMatches(occurrence,state.scope)));}
function evExperimentIssueScopeControl(experiment){
  const state=evExperimentIssuesUI(experiment);
  return `<div class="ev-issue-scope"><label for="ev-experiment-issue-scope">问题范围：</label><select id="ev-experiment-issue-scope" class="ont-button" aria-label="问题范围" onchange="evExperimentIssueSetScope(${esc(JSON.stringify(experiment.id))},this.value)"><option value="all" ${state.scope==='all'?'selected':''}>全部评测记录</option>${evExperimentIssueExecutions(experiment).map(run=>`<option value="${esc(run.id)}" ${state.scope===run.id?'selected':''}>${esc(evExperimentIssueExecutionLabel(run))}${run.parentRunId?'':'（含补跑）'}</option>`).join('')}</select></div>`;
}
function evExperimentIssueSetScope(experimentId,scope){const experiment=evExperimentCurrent();if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene||scope!=='all'&&!evExperimentIssueExecution(experiment,scope))return false;evExperimentIssuesUI(experiment).scope=scope;evExperimentIssuesRefresh();return true;}
function evExperimentIssueStatus(status){return `<span class="ont-enabled ${status==='已关闭'?'':'draft'} ${status==='待修复'?'ev-issue-pending':''}">${esc(status)}</span>`;}
function evExperimentIssueRepairPhase(experiment,issue){
 const batch=typeof evExperimentIssueRepairBatch==='function'?evExperimentIssueRepairBatch(experiment):null,entry=batch?.items.find(item=>item.id===issue.id);
 if(entry)return entry.phase;
 const assistant=typeof evExperimentAssistantState==='function'?evExperimentAssistantState():null;
 return assistant?.mode==='repair'&&assistant.phase==='running'&&assistant.issueId===issue.id?'running':'';
}
function evExperimentIssueValidationPhase(experiment,issue){
 const batch=typeof evExperimentIssueValidationBatch==='function'?evExperimentIssueValidationBatch(experiment):null,entry=batch?.items.find(item=>item.id===issue.id);
 return entry?.phase||(issue.verifying?'running':'');
}
function evExperimentIssueRepairStatus(experiment,issue){
 const validation=evExperimentIssueValidationPhase(experiment,issue);
 if(validation==='running'||validation==='queued')return `<span class="ev-row-activity is-${validation}" role="status"><i class="${validation==='running'?'ev-row-spinner':'ev-row-waiting'}" aria-hidden="true"></i>${validation==='running'?'验证中':'等待验证'}</span>`;
 const phase=evExperimentIssueRepairPhase(experiment,issue);
 if(phase==='running'||phase==='queued')return `<span class="ev-row-activity is-${phase}" role="status"><i class="${phase==='running'?'ev-row-spinner':'ev-row-waiting'}" aria-hidden="true"></i>${phase==='running'?'修复中':'等待修复'}</span>`;
 return evExperimentIssueStatus(phase==='completed'?'待验证':issue.status);
}
function evExperimentIssueAction(name,...args){return name+'('+args.map(value=>esc(JSON.stringify(String(value)))).join(',')+')';}
function evExperimentIssuesNote(){return '问题台账跨评测记录及补跑跟踪处理；首次全量结果与各次补跑报告独立保留。';}
function evExperimentIssuesView(experiment){evExperimentIssuesUI(experiment);evExperimentIssueLedgerSync(experiment);return `<p class="ev-issue-context" id="ev-experiment-issue-note">${esc(evExperimentIssuesNote())}</p><div id="ev-experiment-issues-table" role="region" aria-label="问题优化列表">${evExperimentIssuesTable(experiment)}</div>`;}
function evExperimentIssueName(issue){return issue.name||issue.rule||issue.type||'待分析问题';}
function evExperimentIssueOrigin(issue){return issue.sourceLabel||issue.originLabel||(issue.sourceKind==='annotation'?'手工标注':'AI分析');}
function evExperimentIssueRootCause(issue){return issue.rootCause||issue.reason||'暂未记录问题根因';}
function evExperimentIssueSuggestion(issue){return issue.suggestion||'对照预期结果和实际输出，补充业务规则与必要约束后进行验证。';}
function evExperimentIssueCanVerify(issue){return ['待验证','验证完成'].includes(issue.status)&&!issue.verifying;}
function evExperimentIssueCaseMenu(experiment,issue,scope=''){
 const canEdit=evData().cases.some(item=>item.id===issue.caseId&&!item.archived);
 return evMore([{label:'新增用例',code:evExperimentIssueAction('evExperimentIssueCreateCase',experiment.id,issue.id,scope)},{label:'优化关联用例',code:evExperimentIssueAction('evExperimentIssueOptimizeCase',experiment.id,issue.id,scope),disabled:!canEdit,title:canEdit?'编辑关联用例的当前内容':'关联用例已移除，无法优化'}]).replace('class="ev-more"','class="ev-more ev-issue-case-menu"').replace('class="ont-link" role="button"','class="ont-button" role="button"').replace('aria-label="更多操作"','aria-label="优化用例"').replace('aria-label="更多操作菜单"','aria-label="优化用例操作"').replace('>更多</summary>','>优化用例 '+evDropdownArrow()+'</summary>');
}
function evExperimentIssueSetStatus(experimentId,issueId,status){
 const context=evExperimentIssueContext(experimentId,'all',issueId);if(!context||context.issue.verifying||evExperimentIssueRepairPhase(context.experiment,context.issue)||evExperimentIssueValidationPhase(context.experiment,context.issue)||!['已关闭','待修复'].includes(status))return false;
 const issue=context.issue;issue.status=status;issue.updatedAt=evExperimentTime();issue.lastUserUpdateAtMs=Date.now();if(status==='已关闭'){issue.closedAtMs=Date.now();issue.closedAfterOrder=issue.lastSeenOrder;}
 issue.history.push({time:issue.updatedAt,kind:'status',description:status==='已关闭'?'手动关闭问题。':'重新打开问题，等待修复。'});evRender();return true;
}
function evExperimentIssueLatestValidation(experimentId,issueId){
 const context=evExperimentIssueContext(experimentId,'all',issueId),latest=context?.issue.verifications?.at(-1);return latest?evExperimentIssueValidationDetail(experimentId,latest.runId,latest.resultId):false;
}
function evExperimentIssueActions(experiment,issue,scope='',includeCreate=false){
 evExperimentIssueNormalize(issue);const busy=!!issue.verifying||!!evExperimentIssueRepairPhase(experiment,issue)||!!evExperimentIssueValidationPhase(experiment,issue);
 const action=(name,label,args,primary=false)=>`<button type="button" class="${includeCreate?'ont-button'+(primary?' strong':''):'ont-link'}" ${busy?'disabled aria-disabled="true"':''} onclick="${evExperimentIssueAction(name,...args)}">${label}</button>`,id=[experiment.id,issue.id];
 let buttons=includeCreate?evExperimentIssueCaseMenu(experiment,issue,scope):'';
 if(issue.status==='待修复')buttons+=action('evExperimentIssueRepair','问题修复',id,true);
 if(issue.status==='待验证')buttons+=action('evExperimentIssueVerify',busy?'正在验证':'验证',id,true)+action('evExperimentIssueRepair','重新修复',id);
 if(issue.status==='验证完成'){buttons+=action('evExperimentIssueLatestValidation','验证详情',id)+action('evExperimentIssueRepair','重新修复',id,issue.verificationPassed===false)+action('evExperimentIssueVerify','再次验证',id);}
 buttons+=issue.status==='已关闭'?action('evExperimentIssueSetStatus','重新打开',[...id,'待修复'],true):action('evExperimentIssueSetStatus','关闭',[...id,'已关闭'],issue.status==='验证完成'&&issue.verificationPassed===true);
 if(!includeCreate)buttons+=action('evExperimentIssueDetail','查看',[issue.id,scope,experiment.id]);
 return `<div class="ev-actions ev-optimization-actions${includeCreate?' is-detail-actions':''}">${buttons}</div>`;
}
function evExperimentIssueFiltered(experiment){
 const state=evExperimentIssuesUI(experiment),q=state.search.trim().toLowerCase();
 return evExperimentIssueScopeIssues(experiment).filter(issue=>(typeof evFilterMatch!=='function'||evFilterMatch('experimentIssue','status',issue.status))&&(!q||[issue.code,evExperimentIssueName(issue),issue.caseId,issue.caseName,issue.source,evExperimentIssueOrigin(issue),issue.rule,evExperimentIssueRootCause(issue),issue.note].join(' ').toLowerCase().includes(q))).sort((a,b)=>evExperimentIssueStatuses.indexOf(a.status)-evExperimentIssueStatuses.indexOf(b.status)||(b.lastSeenOrder||0)-(a.lastSeenOrder||0));
}
function evExperimentIssuesTable(experiment,run=null,contentOnly=false){
 const state=evExperimentIssuesUI(experiment),issues=evExperimentIssueScopeIssues(experiment),filtered=evExperimentIssueFiltered(experiment);
 const headers=['问题编号','问题名称','来源',evFilterHeader('状态','experimentIssue','status',evExperimentIssueStatuses.map(status=>({id:status,name:status}))),'评测记录','关联用例','问题根因','最近发现','操作'];
 const rows=filtered.map(issue=>{
  const records=[...new Map((issue.occurrences||[]).map(item=>[item.recordId||item.runId,item])).values()].map(item=>'记录 #'+item.sequence).join('、')||'—',name=evExperimentIssueName(issue),cause=evExperimentIssueRootCause(issue);
  const validation=evExperimentIssueValidationPhase(experiment,issue),phase=validation||evExperimentIssueRepairPhase(experiment,issue);
  return `<tr data-issue-id="${esc(issue.id)}"${phase?` class="ev-batch-row is-${phase}" ${validation?'data-validation-phase':'data-repair-phase'}="${phase}" aria-busy="${phase==='running'||phase==='queued'}"`:''}><td><span class="ont-id">${esc(issue.code)}</span></td><td><button type="button" class="ont-link ev-name-link ev-optimization-cell" title="${esc(name)}" onclick="${evExperimentIssueAction('evExperimentIssueDetail',issue.id,state.scope,experiment.id)}">${esc(name)}</button></td><td>${esc(evExperimentIssueOrigin(issue))}</td><td>${evExperimentIssueRepairStatus(experiment,issue)}</td><td><span class="ev-optimization-cell is-record" title="${esc(records)}">${esc(records)}</span></td><td><button type="button" class="ont-link ev-optimization-cell is-case" title="${esc(issue.caseId+' · '+issue.caseName)}" onclick="${evExperimentIssueAction('evExperimentIssueOpenCase',experiment.id,issue.id,state.scope)}">${esc(issue.caseId)} · ${esc(issue.caseName)}</button></td><td><span class="ev-optimization-cell is-cause" title="${esc(cause)}">${esc(cause)}</span></td><td>${esc(issue.lastSeenAt||'—')}</td><td>${evExperimentIssueActions(experiment,issue,state.scope)}</td></tr>`;
 });
 const empty=issues.length?'<div class="ont-empty">暂无匹配的问题</div>':'<div class="ont-empty">暂无问题，运行结果分析或手工标注后，问题会显示在这里。</div>';
 const toolbar=`<label class="ont-search"><input aria-label="搜索实验问题" placeholder="搜索问题、用例、根因或来源" value="${esc(state.search)}" oninput="evExperimentIssueState.search=this.value;evExperimentIssuesRefresh()"><svg viewBox="0 0 18 18"><circle cx="7" cy="7" r="5"/><path d="m11 11 4 4"/></svg></label>`;
 return contentOnly?evTableContent(headers,rows,empty):evTable(headers,rows,empty,toolbar);
}
function evExperimentIssuesRefresh(){
  const experiment=evExperimentCurrent(),node=document.getElementById('ev-experiment-issues-table');if(!experiment||!node)return;
  const controls=document.getElementById('ev-experiment-run-controls');if(controls&&evExperimentState.tab==='问题优化'&&typeof evExperimentHeaderControls==='function')controls.innerHTML=evExperimentHeaderControls(experiment);
  const issues=evExperimentIssueScopeIssues(experiment);
  const count=document.getElementById('ev-experiment-issue-count');if(count)count.textContent=String(issues.length);
  const content=node.querySelector?.('.ev-table-content'),markup=evExperimentIssuesTable(experiment,null,true);
  let refreshed=false;
  if(content&&document.createElement){const staging=document.createElement('div');staging.innerHTML=markup;const body=content.querySelector('tbody'),next=staging.querySelector('tbody');if(body&&next){evExperimentReplaceContent(body,next.innerHTML);const footer=content.querySelector('.ev-table-footer'),nextFooter=staging.querySelector('.ev-table-footer');if(footer&&nextFooter)footer.innerHTML=nextFooter.innerHTML;refreshed=true;}}
  if(!refreshed){if(content)evExperimentReplaceContent(content,markup);else evExperimentReplaceContent(node,evExperimentIssuesTable(experiment));}
  if(typeof evExperimentRefreshDashboard==='function')evExperimentRefreshDashboard(experiment);
}
function evExperimentIssueContext(experimentId,runId,issueId){
  const experiment=evExperimentCurrent();if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene)return null;
  if(runId&&runId!=='all'&&!evExperimentIssueExecution(experiment,runId))return null;
  const ledger=evExperimentIssueLedgerSync(experiment),issue=ledger.find(item=>item.id===issueId&&item.occurrences.some(occurrence=>evExperimentIssueScopeMatches(occurrence,runId)))||ledger.find(item=>item.occurrences.some(occurrence=>occurrence.rawIssueId===issueId&&evExperimentIssueScopeMatches(occurrence,runId)));if(!issue)return null;
  const occurrence=[...issue.occurrences].reverse().find(item=>evExperimentIssueScopeMatches(item,runId))||issue.occurrences.at(-1),run=evExperimentIssueExecution(experiment,occurrence?.runId),result=evExperimentIssueResult(run,occurrence?.resultId),rawIssue=run?.issues?.find(item=>item.id===occurrence.rawIssueId);
  return {experiment,run,issue,result,rawIssue,occurrence};
}
function evExperimentIssueOpenEvidence(experimentId,runId,resultId=''){
  const experiment=evExperimentCurrent(),run=evExperimentIssueExecution(experiment,runId);if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene||!run||resultId&&!evExperimentIssueResult(run,resultId))return false;
  evCloseModal();evExperimentOpen(experimentId,runId,'用例结果');if(resultId&&typeof evExperimentCaseDetail==='function')evExperimentCaseDetail(resultId);return true;
}
function evExperimentIssueValidationDetail(experimentId,runId,resultId=''){
 const experiment=evExperimentCurrent(),run=typeof evExperimentValidationGet==='function'?evExperimentValidationGet(experiment,runId):null;
 if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene||!run)return false;
 const result=run.results.find(item=>item.id===resultId)||run.results[0];if(!result)return false;
 return evExperimentCaseDetail(result.id);
}
function evExperimentIssueOpenCase(experimentId,issueId,scope=''){
 const context=evExperimentIssueContext(experimentId,scope,issueId);if(!context)return false;
 const sample=evData().cases.find(item=>item.id===context.issue.caseId&&!item.archived);if(!sample){toast('关联用例已移除，问题详情仍保留原始输入输出。');return false;}
 evCaseDetail(sample.id);return true;
}
async function evExperimentIssueCopy(experimentId,issueId,field,scope=''){
 const context=evExperimentIssueContext(experimentId,scope,issueId);if(!context||!['reason','suggestion'].includes(field))return false;
 const text=field==='reason'?evExperimentIssueRootCause(context.issue):evExperimentIssueSuggestion(context.issue);
 try{if(typeof navigator==='undefined'||!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(text);toast(field==='reason'?'问题根因已复制':'优化建议已复制');return true;}catch(error){toast('复制未完成，请选中文字复制。');return false;}
}
function evExperimentIssueCreateCase(experimentId,issueId,scope=''){
 const context=evExperimentIssueContext(experimentId,scope,issueId);if(!context)return false;
 const {experiment,issue,result}=context,snapshotCase=context.run?.snapshot?.cases?.find(item=>item.id===issue.caseId),draft={name:evExperimentIssueName(issue)+' · 回归用例',input:result?.input??snapshotCase?.input??'',expected:result?.expected??snapshotCase?.expected??'',inputAttachments:evVersionClone(snapshotCase?.inputAttachments||[]),tags:['问题回归'],enabled:true};
 const agentId=context.run?.snapshot?.agent?.id||experiment.agentId,suites=(evData().suites||[]).filter(suite=>suite.agentId===agentId);
 evEditCase('','',draft,{title:'从问题新增用例',sourceIssueId:issue.id,sourceExperimentId:experiment.id,requireSuite:true,suiteChoices:suites,optimizationHint:evExperimentIssueSuggestion(issue)});return draft;
}
function evExperimentIssueOptimizeCase(experimentId,issueId,scope=''){
 const context=evExperimentIssueContext(experimentId,scope,issueId);if(!context)return false;
 const sample=evData().cases.find(item=>item.id===context.issue.caseId&&!item.archived);if(!sample){toast('关联用例已移除，无法优化');return false;}
 evEditCase(sample.id,'',null,{title:'优化关联用例',sourceIssueId:context.issue.id,sourceExperimentId:context.experiment.id,optimizationHint:evExperimentIssueSuggestion(context.issue)});return true;
}
function evExperimentIssueHeading(context,scope){
 const {experiment,issue,run}=context,tone=issue.status==='已关闭'||issue.status==='验证完成'&&issue.verificationPassed?'success':issue.status==='待修复'?'neutral':'running',records=[...new Set((issue.occurrences||[]).map(item=>'#'+item.sequence))].join('、');
 return `<div class="ev-result-heading ev-issue-detail-heading"><div class="ev-result-heading-main"><div class="ev-result-title"><h2>${esc(evExperimentIssueName(issue))}</h2><div><span>问题编号</span><code>${esc(issue.code)}</code><span class="ev-result-evidence-tag">${esc(evExperimentIssueOrigin(issue))}</span></div></div>${evExperimentIssueActions(experiment,issue,scope,true)}</div><section class="ev-result-summary is-${tone}" aria-label="问题总览"><div class="ev-result-outcome"><div><span>问题状态</span><strong>${esc(issue.status)}</strong>${issue.verifying?'<small>正在验证</small>':issue.status==='验证完成'?`<small>${issue.verificationPassed?'验证通过':'验证未通过'}</small>`:''}<small>${esc(issue.type)} · ${esc(issue.severity||'中')}优先级</small></div></div><dl class="ev-issue-detail-overview"><div><dt>评测记录</dt><dd>${esc(records||'—')}</dd></div><div><dt>关联用例</dt><dd><button type="button" class="ont-link" onclick="${evExperimentIssueAction('evExperimentIssueOpenCase',experiment.id,issue.id,scope)}">${esc(issue.caseId)} · ${esc(issue.caseName)}</button></dd></div><div><dt>Agent 版本</dt><dd>${esc(run?.snapshot?.agent?.version||'—')}</dd></div><div><dt>最近发现</dt><dd>${esc(issue.lastSeenAt||'—')}</dd></div></dl></section></div>`;
}
function evExperimentIssueDetail(issueId,runId='',experimentId=''){
 const current=evExperimentCurrent();if(!current)return false;const scope=runId||evExperimentIssuesUI(current).scope,context=evExperimentIssueContext(experimentId||current.id,scope,issueId);if(!context)return false;
 const {experiment,issue,result}=context,copy=(field,label)=>`<button type="button" class="ont-link ev-issue-detail-copy" aria-label="复制${label}" onclick="${evExperimentIssueAction('evExperimentIssueCopy',experiment.id,issue.id,field,scope)}">复制</button>`,section=(label,value,action='',kind='')=>`<section class="ev-issue-detail-card${kind?' is-'+kind:''}"><header><h3>${kind?`<span class="ev-issue-detail-card-icon" aria-hidden="true">${kind==='root-cause'?'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3M7 5v3M7 9v.2"/></svg>':'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 10c0-1.5-2-2-2-4a5 5 0 0 1 10 0c0 2-2 2.5-2 4M5 10h6M5.5 12h5M6.5 14h3"/></svg>'}</span>`:''}${label}</h3>${action}</header><div class="ev-issue-detail-text">${esc(value||'—')}</div></section>`;
 const checks=issue.verifications||[],verifications=checks.length?`<ol class="ev-issue-detail-validation-list" aria-label="验证记录">${[...checks].reverse().map((item,index)=>{const number=checks.length-index,status=item.status||(item.passed===false?'验证未通过':'验证通过'),tone=status==='验证通过'?'passed':status==='验证未通过'?'failed':'pending';return `<li class="ev-issue-detail-validation"><header class="ev-issue-detail-validation-head"><div><span class="ev-issue-detail-validation-number">${String(number).padStart(2,'0')}</span><b>验证 #${number}</b></div><span class="ev-issue-detail-validation-status is-${tone}">${esc(status)}</span></header><dl class="ev-issue-detail-validation-meta"><div><dt>验证编号</dt><dd>${esc(item.runId)}</dd></div><div><dt>验证执行</dt><dd>第 ${evExperimentIssueAttempt(item)} 次</dd></div><div class="is-time"><dt>验证时间</dt><dd><time>${esc(item.time||'—')}</time></dd></div></dl>${item.resultId?`<footer><button type="button" class="ont-link" onclick="${evExperimentIssueAction('evExperimentIssueValidationDetail',experiment.id,item.runId,item.resultId)}">查看验证详情</button></footer>`:''}</li>`;}).join('')}</ol>`:`<div class="ev-issue-detail-empty">${issue.verifying?'正在执行验证，完成后会在这里显示验证结果。':'暂无验证记录，修复后可执行验证。'}</div>`;
 const body=`<div class="ev-issue-detail" data-issue-id="${esc(issue.id)}" data-issue-scope="${esc(scope)}" data-experiment-id="${esc(experiment.id)}"><div class="ev-issue-detail-two-columns"><section class="ev-issue-detail-reason" aria-label="问题根因与优化建议">${section('问题根因',evExperimentIssueRootCause(issue),copy('reason','问题根因'),'root-cause')}${section('优化建议',evExperimentIssueSuggestion(issue),copy('suggestion','优化建议'),'suggestion')}<section class="ev-issue-detail-card"><header><h3>验证记录</h3></header><div class="ev-issue-detail-validations">${verifications}</div></section></section><aside class="ev-issue-detail-evidence" aria-label="问题输入与输出">${section('输入',result?.input)}${section('预期结果',result?.expected)}${section('实际结果',result?.actual||'本次执行未产生业务输出')}</aside></div></div>`;
 evModal('查看问题详情',body,'','',evExperimentIssueHeading(context,scope));const modal=document.querySelector('.ev-modal');modal?.classList.add('ev-experiment-issue');const nav=modal?.querySelector('.ev-form-nav');if(nav){nav.hidden=true;nav.innerHTML='';}return true;
}
function evSaveExperimentIssue(form,experimentId,runId,issueId){
 const context=evExperimentIssueContext(experimentId,runId,issueId),values=new FormData(form);if(!context||values.get('scene')!==studio.scene||evExperimentIssueRepairPhase(context.experiment,context.issue)||evExperimentIssueValidationPhase(context.experiment,context.issue))return false;
 const status=String(values.get('status')||''),note=String(values.get('note')||'').trim();if(!evExperimentIssueStatuses.includes(status)||note.length>4000)return false;
 const issue=context.issue,changes=[];if(issue.status!==status)changes.push('状态：'+issue.status+' → '+status);if(issue.note!==note)changes.push('处理说明：'+note);
 if(changes.length){issue.status=status;issue.note=note;issue.updatedAt=evExperimentTime();issue.lastUserUpdateAtMs=Date.now();if(status==='已关闭'){issue.closedAtMs=Date.now();issue.closedAfterOrder=issue.lastSeenOrder;}issue.history.push({time:issue.updatedAt,kind:'handling',description:changes.join('；')});}delete issue.owner;
 evCloseModal();evExperimentIssuesRefresh();return true;
}
