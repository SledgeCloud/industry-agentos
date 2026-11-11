/* Explicit result analysis and issue repair conversations for the local evaluation Mock. */
'use strict';
let evExperimentAssistantSerial=0;
const evExperimentAssistantTimers=new Map();
const evExperimentIssueRepairBatches=new Map();
const evExperimentIssueValidationBatches=new Map();
function evExperimentIssueRepairBatch(experiment){return experiment?evExperimentIssueRepairBatches.get(experiment.scene+':'+experiment.id)||null:null;}
function evExperimentIssueRepairTargets(experiment){return evExperimentIssueFiltered(experiment).filter(issue=>!issue.verifying&&(issue.status==='待修复'||issue.status==='验证完成'&&issue.verificationPassed===false));}
function evExperimentIssueRepairControls(experiment){
 const batch=evExperimentIssueRepairBatch(experiment),assistant=evExperimentAssistantState(),busy=!!batch||!!evExperimentIssueValidationBatch(experiment)||assistant?.phase==='running',count=batch?.items.length||evExperimentIssueRepairTargets(experiment).length;
 const label=batch?'修复中 '+batch.items.filter(item=>item.phase==='completed').length+'/'+count:'问题修复';
 return `<button type="button" id="ev-experiment-repair-all" class="ont-button strong" ${busy||!count?'disabled aria-disabled="true"':''} title="${batch?'正在分批修复列表中的问题':'修复当前列表中全部待修复或验证未通过的问题'}" onclick="evExperimentIssueRepairAll(${esc(JSON.stringify(experiment.id))})">${batch?'<i class="ev-row-spinner" aria-hidden="true"></i>':''}${label}</button>`;
}
function evExperimentIssueCompleteRepair(issue,sourceRunId){
 issue.status='待验证';issue.updatedAt=evExperimentTime();issue.repairedAt=issue.updatedAt;issue.repair={mode:'mock',completedAt:issue.updatedAt,sourceRunId,summary:issue.suggestion||'补充对输入、预期结果及业务约束的检查。'};
 issue.history=issue.history||[];issue.history.push({time:issue.updatedAt,kind:'repair',description:'本地 Mock 修复流程已完成，等待用例验证。'});
}
function evExperimentIssueRepairBatchRefresh(experiment){
 if(experiment.scene!==studio.scene||evState.tab!=='评测实验'||evExperimentState.id!==experiment.id||evExperimentState.tab!=='问题优化')return;
 evExperimentIssuesRefresh();
 if(typeof evExperimentRefreshIssueDrawer==='function')evExperimentRefreshIssueDrawer(experiment);
}
function evExperimentIssueRepairAll(experimentId){
 const experiment=evExperimentCurrent();if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene)return false;
 const active=evExperimentIssueRepairBatch(experiment);if(active)return active;
 if(evExperimentAssistantState()?.phase==='running'){toast('当前分析或修复正在进行');return false;}
 if(evExperimentIssueValidationBatch(experiment)){toast('问题正在批量验证，请等待完成');return false;}
 const targets=evExperimentIssueRepairTargets(experiment);if(!targets.length){toast('当前列表没有需要修复的问题');return false;}
 const items=targets.map(issue=>({id:issue.id,issue,sourceRunId:issue.occurrences.at(-1)?.runId||'',phase:'queued'})),key=experiment.scene+':'+experiment.id;
 const batch={experimentId:experiment.id,scene:experiment.scene,phase:'running',batchSize:Math.min(5,Math.max(3,Math.ceil(items.length/2))),items,startedAt:evExperimentTime(),timer:null};
 evExperimentIssueRepairBatches.set(key,batch);
 const startNext=()=>{
  const running=items.filter(item=>item.phase==='queued').slice(0,batch.batchSize);for(const item of running)item.phase='running';
  evExperimentIssueRepairBatchRefresh(experiment);
  batch.timer=setTimeout(()=>{
   batch.timer=null;for(const item of running)item.phase='completed';
   if(items.some(item=>item.phase==='queued')){startNext();return;}
   // Commit lifecycle changes together, so summary metrics stay stable while
   // completed rows and the next batch animate independently in the list.
   for(const item of items)evExperimentIssueCompleteRepair(item.issue,item.sourceRunId);
   batch.phase='completed';batch.completedAt=evExperimentTime();evExperimentIssueRepairBatches.delete(key);evExperimentIssueRepairBatchRefresh(experiment);
   if(experiment.scene===studio.scene&&evExperimentState.id===experiment.id)toast('已完成 '+items.length+' 个问题的 Mock 修复，等待验证');
  },1500);
 };
 startNext();return batch;
}
// Bulk validation owns one timer per group batch, while each issue keeps its
// own immutable source snapshot, independent conversation and validation record.
function evExperimentIssueValidationBatch(experiment){return experiment?evExperimentIssueValidationBatches.get(experiment.scene+':'+experiment.id)||null:null;}
function evExperimentIssueValidationTargets(experiment){return evExperimentIssueFiltered(experiment).filter(issue=>issue.status==='待验证'&&!issue.verifying&&!evExperimentIssueRepairPhase(experiment,issue));}
function evExperimentIssueValidationMetricSource(experiment){
 const batch=evExperimentIssueValidationBatch(experiment);if(!batch)return null;
 const scope=evExperimentIssuesUI(experiment).scope;
 return scope==='all'?batch.metricIssues:batch.metricIssues.filter(issue=>issue.occurrences.some(occurrence=>evExperimentIssueScopeMatches(occurrence,scope)));
}
function evExperimentIssueValidationControls(experiment){
 const batch=evExperimentIssueValidationBatch(experiment),assistant=evExperimentAssistantState(),count=batch?.items.length||evExperimentIssueValidationTargets(experiment).length;
 const busy=!!batch||!!evExperimentIssueRepairBatch(experiment)||assistant?.phase==='running'||!!evExperimentActiveExecution(experiment);
 const label=batch?'验证中 '+batch.items.filter(item=>item.phase==='completed').length+'/'+count:'问题验证';
 return `<button type="button" id="ev-experiment-verify-all" class="ont-button" ${busy||!count?'disabled aria-disabled="true"':''} title="${batch?'正在分批验证列表中的问题':'验证当前列表中全部待验证的问题'}" onclick="evExperimentIssueVerifyAll(${esc(JSON.stringify(experiment.id))})">${batch?'<i class="ev-row-spinner" aria-hidden="true"></i>':''}${label}</button>`;
}
function evExperimentIssueVerifyAll(experimentId){
 const experiment=evExperimentCurrent();if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene)return false;
 const active=evExperimentIssueValidationBatch(experiment);if(active)return active;
 if(evExperimentIssueRepairBatch(experiment)||evExperimentAssistantState()?.phase==='running'||evExperimentActiveExecution(experiment)){toast('当前执行、分析或修复正在进行，请等待完成');return false;}
 const targets=evExperimentIssueValidationTargets(experiment);if(!targets.length){toast('当前列表没有待验证的问题');return false;}
 // Prepare every source before registering any work, so an invalid historical
 // case cannot leave behind a partially created group or reserved identifiers.
 const base=(experiment.validationRuns||[]).length,key=experiment.scene+':'+experiment.id,groupId=experiment.id+'-VALIDATE-REQUEST-'+(base+1);
 let items;
 try{items=targets.map((issue,index)=>{
  const occurrence=issue.occurrences.at(-1),source=evExperimentIssueExecution(experiment,occurrence?.runId);
  const run=evExperimentPrepareRetryExecution(experiment,source,issue.caseId,{validationIssueId:issue.id,validationSequence:base+index+1});
  run.validationGroupId=groupId;
  return {id:issue.id,issue,run,phase:'queued'};
 });}catch(error){toast(error.message||'无法启动问题验证');return false;}
 const batch={experimentId:experiment.id,scene:experiment.scene,phase:'running',batchSize:Math.min(5,Math.max(3,Math.ceil(items.length/2))),items,metricIssues:evExperimentClone(evExperimentIssueLedgerSync(experiment)),startedAt:evExperimentTime(),timer:null};
 evExperimentIssueValidationBatches.set(key,batch);
 evExperimentMetricContexts.set(experiment.id,evExperimentClone(experiment));
 if(!Array.isArray(experiment.validationRuns))experiment.validationRuns=[];
 for(const item of items){
  experiment.validationRuns.push(item.run);item.issue.verifying=true;item.issue.validationRunId=item.run.id;
 }
 const startNext=()=>{
  if(evExperimentIssueValidationBatches.get(key)!==batch)return;
  const running=items.filter(item=>item.phase==='queued').slice(0,batch.batchSize),startedAtMs=Date.now();
  for(const item of running){
   item.phase='running';const run=item.run;run.status='运行中';run.startedAtMs=startedAtMs;run.startedAt=evExperimentTime(startedAtMs);run.mockCaseDurationMs=1500;
   for(const result of run.results){result.status='运行中';result.startedAtMs=startedAtMs;result.startedAt=run.startedAt;if(result.messages?.[0])result.messages[0].timestamp=run.startedAt;}
   item.issue.updatedAt=run.startedAt;item.issue.history.push({time:run.startedAt,kind:'validation-started',runId:run.id,description:'启动批量问题验证，独立执行关联用例。'});
  }
  evExperimentIssueRepairBatchRefresh(experiment);
  batch.timer=setTimeout(()=>{
   if(evExperimentIssueValidationBatches.get(key)!==batch)return;
   batch.timer=null;const endedAtMs=Date.now();
   for(const item of running){
    const run=item.run;run.results.forEach((result,index)=>evExperimentCompleteResult(experiment,run,index,evExperimentOutcome(experiment,run,index),endedAtMs));
    run.status=run.results.some(result=>['未通过','运行失败'].includes(result.status))?'部分失败':'已完成';run.endedAtMs=endedAtMs;run.endedAt=evExperimentTime(endedAtMs);run.elapsedMs=evExperimentSummary(run).durationMs;
    item.phase='completed';evExperimentNotify(experiment,run);
   }
   if(items.some(item=>item.phase==='queued')){startNext();return;}
   batch.phase='completed';batch.completedAt=evExperimentTime();evExperimentIssueValidationBatches.delete(key);evExperimentMetricContexts.delete(experiment.id);items.forEach(item=>evExperimentMetricSnapshots.delete(item.run.id));evExperimentIssueRepairBatchRefresh(experiment);
   if(experiment.scene===studio.scene&&evExperimentState.id===experiment.id)toast('已完成 '+items.length+' 个问题的 Mock 验证');
  },1500);
 };
 startNext();return batch;
}
function evExperimentIssueValidationCancel(experiment){
 const batch=evExperimentIssueValidationBatch(experiment);if(!batch)return null;
 const active=batch.items.find(item=>item.phase==='running')?.run||batch.items.find(item=>item.phase==='queued')?.run||null;
 if(batch.timer!==null)clearTimeout(batch.timer);batch.timer=null;batch.phase='cancelled';
 evExperimentIssueValidationBatches.delete(experiment.scene+':'+experiment.id);evExperimentMetricContexts.delete(experiment.id);batch.items.forEach(item=>evExperimentMetricSnapshots.delete(item.run.id));
 for(const item of batch.items){
  if(item.phase==='completed')continue;item.phase='cancelled';const run=item.run;
  run.results.forEach(result=>{if(['待运行','运行中'].includes(result.status)){result.status='已跳过';result.reason='已停止';result.actual='';result.dimensions=[];result.evaluations=[];result.durationMs=0;result.tokens=0;}});
  run.status='已停止';run.endedAtMs=Date.now();run.endedAt=evExperimentTime(run.endedAtMs);run.elapsedMs=evExperimentSummary(run).durationMs;evExperimentNotify(experiment,run);
 }
 evExperimentIssueRepairBatchRefresh(experiment);return active;
}
function evExperimentAssistantState(){
 const state=evState.optimizationAssistant;
 if(!state||evState.tab!=='评测实验'||state.scene!==studio.scene||state.experimentId!==evExperimentState.id)return null;
 const experiment=evExperimentCurrent(),record=experiment&&evExperimentSelectedRecord(experiment);
 return experiment&&record?.id===state.recordId?state:null;
}
function evExperimentAssistantClose(){
 const state=evState.optimizationAssistant;
 if(state){
  const timer=evExperimentAssistantTimers.get(state.token);if(timer!==undefined)clearTimeout(timer);evExperimentAssistantTimers.delete(state.token);
  if(state.phase==='running'){state.phase='cancelled';state.messages.push({role:'assistant',text:'本次任务已取消，可以重新发起分析或修复。'});}
 }
 evState.optimizationAssistant=null;
}
function evExperimentAssistantDismiss(){evExperimentAssistantClose();evRender();}
function evExperimentAssistantShow(state){
 evCloseModal();evExperimentAssistantClose();evState.copilot=null;evState.scopeOpen=false;evState.optimizationAssistant=state;
 evState.tab='评测实验';evExperimentState.runId=state.recordId;evExperimentState.supplementId='';
 if(studio.panels){studio.panels.chat=true;studio.panels.gui=true;studio.weights={docs:10,chat:34,gui:56};}
 evRender();return state;
}
function evExperimentAssistantNew(experiment,record,mode,issue=null){
 return {token:'ev-optimization-'+(++evExperimentAssistantSerial),scene:experiment.scene,experimentId:experiment.id,recordId:record.id,mode,issueId:issue?.id||'',phase:'running',input:'',messages:[],createdAt:evExperimentTime(),mock:true};
}
function evExperimentAssistantContext(state){
 if(!state||evState.optimizationAssistant!==state||state.scene!==studio.scene||evState.tab!=='评测实验'||currentSection!=='studio'||!wtState.open)return null;
 const experiment=evExperimentCurrent(),record=experiment&&evExperimentSelectedRecord(experiment);
 if(!experiment||experiment.id!==state.experimentId||record?.id!==state.recordId)return null;
 return {experiment,record};
}
function evExperimentAssistantSchedule(state,complete,delay=900){
 const timer=setTimeout(()=>{
  evExperimentAssistantTimers.delete(state.token);
  const context=evExperimentAssistantContext(state);
  if(!context){state.phase='cancelled';state.messages.push({role:'assistant',text:'实验、评测记录或场景已切换，本次任务已取消。'});return;}
  try{complete(context);state.phase='completed';}
  catch(error){state.phase='error';state.messages.push({role:'assistant',text:error.message||'任务未完成，请重试。'});}
  evRender();const scroll=document.getElementById('ev-optimization-chat-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;
 },delay);
 evExperimentAssistantTimers.set(state.token,timer);
}
function evExperimentAnalyze(experimentId,runId='',resultId=''){
 const experiment=evExperimentCurrent(),selectedRun=experiment&&runId?evExperimentExecutionGet(experiment,runId):null,record=selectedRun?evExperimentRecordFor(experiment,selectedRun):experiment&&evExperimentSelectedRecord(experiment),run=selectedRun||record;
 if(!experiment||experiment.id!==experimentId||experiment.scene!==studio.scene||!record){toast('请先选择已完成的评测记录');return false;}
 if(evExperimentIssueRepairBatch(experiment)){toast('问题正在批量修复，请等待完成');return false;}
 if(evExperimentIssueValidationBatch(experiment)){toast('问题正在批量验证，请等待完成');return false;}
 if(!run||run.kind==='validation'||!['已完成','部分失败',...(resultId?['已停止']:[])].includes(run.status)||!resultId&&(run.results||[]).some(result=>['待运行','运行中'].includes(result.status))||resultId&&!run.results.some(result=>result.id===resultId&&result.status==='未通过')){toast('请等待本条全量评测记录执行完成后再分析');return false;}
 const active=evExperimentAssistantState();if(active?.phase==='running'){toast('当前分析或修复正在进行');return active;}
 const state=evExperimentAssistantNew(experiment,record,'analysis');state.sourceRunId=run.id;state.resultId=resultId;
 state.messages.push({role:'user',text:`请分析「${experiment.name}」的评测记录 #${record.sequence}${resultId?'中用例「'+run.results.find(result=>result.id===resultId).name+'」的本次未通过结果':''}，结合用例输入、预期输出、实际输出及各评估器结果，定位问题根因并给出优化建议，将确认的问题归入问题优化。`});
 evExperimentAssistantShow(state);
 evExperimentAssistantSchedule(state,({experiment,record})=>{
  const source=evExperimentExecutionGet(experiment,state.sourceRunId),discoveries=evExperimentIssueAnalyzeComplete(experiment,source,state.resultId?[state.resultId]:null),issues=evExperimentIssueLedgerSync(experiment).filter(issue=>issue.sourceKind==='ai'&&(issue.occurrences||[]).some(item=>item.runId===source.id&&(!state.resultId||item.resultId===state.resultId)));
  state.issueCount=issues.length;
  state.messages.push({role:'assistant',text:issues.length?`已完成结果分析，归纳 ${issues.length} 个问题。\n已结合输入、预期结果、实际结果和评分依据整理问题根因与优化建议。请在问题优化中查看、发起修复或补充标注。`:'已完成结果分析，本条评测记录未发现需要优化的问题。',action:issues.length?'issues':'',rawCount:Array.isArray(discoveries)?discoveries.length:0});
 });return state;
}
function evExperimentAnalyzeResult(experimentId,runId,resultId){return evExperimentAnalyze(experimentId,runId,resultId);}
function evExperimentIssueRepair(experimentId,issueId){
 const context=typeof evExperimentIssueContext==='function'?evExperimentIssueContext(experimentId,'all',issueId):null;
 if(!context){toast('当前问题或实验已变更，请重新打开');return false;}
 const {experiment,issue,result,run}=context,record=evExperimentRecordFor(experiment,run)||evExperimentSelectedRecord(experiment);
 if(!record){toast('问题来源评测记录已不存在');return false;}
 if(evExperimentIssueRepairBatch(experiment)){toast('问题正在批量修复，请等待完成');return false;}
 if(evExperimentIssueValidationBatch(experiment)){toast('问题正在批量验证，请等待完成');return false;}
 const active=evExperimentAssistantState();if(active?.phase==='running'){toast('当前分析或修复正在进行');return active;}
 if(issue.verifying||issue.status==='已关闭'){toast('问题正在验证，请等待验证完成');return false;}
 // Select the discovery record while keeping the issue tab and evidence scope.
 evExperimentState.runId=record.id;evExperimentState.supplementId='';
 const state=evExperimentAssistantNew(experiment,record,'repair',issue);
 state.messages.push({role:'user',text:`请修复问题「${issue.code} · ${issue.name||issue.rule}」。\n问题根因：${issue.rootCause||issue.reason||'待定位'}\n优化建议：${issue.suggestion||'结合预期结果补充业务规则与约束。'}\n输入：${result?.input||''}\n预期结果：${result?.expected||''}\n实际结果：${result?.actual||'本次执行未产生输出'}\n请给出针对性的调整，并在修复后保留验证入口。`});
 evExperimentAssistantShow(state);
 evExperimentAssistantSchedule(state,({experiment})=>{
  const current=evExperimentIssueLedgerSync(experiment).find(item=>item.id===issueId);if(!current)throw Error('该问题已不存在，请重新分析。');
  evExperimentIssueCompleteRepair(current,run.id);
  state.messages.push({role:'assistant',text:`已完成本地 Mock 修复流程。\n调整方向：${current.suggestion||'补齐业务约束、异常处理及预期输出要求。'}\n问题已进入待验证状态。请运行验证，核对修复后的输出和评估结果；验证结果将单独保存，不改写首次全量结果。`,action:'verify'});
 },1500);return state;
}
function evExperimentAssistantOpenIssues(){
 const state=evExperimentAssistantState();if(!state)return false;
 evExperimentState.tab='问题优化';evExperimentIssuesUI(evExperimentCurrent()).scope=state.recordId;evRender();return true;
}
function evExperimentAssistantVerify(){const state=evExperimentAssistantState();return state?.issueId?evExperimentIssueVerify(state.experimentId,state.issueId):false;}
function evExperimentAssistantRemember(value){const state=evExperimentAssistantState();if(state)state.input=String(typeof value==='string'?value:value?.value||'');}
function evExperimentAssistantSend(){
 const state=evExperimentAssistantState();if(!state||state.phase==='running')return false;
 const input=document.getElementById('ev-optimization-chat-input'),request=String(input?.value??state.input??'').trim();if(!request)return false;
 state.messages.push({role:'user',text:request});state.input='';state.phase='running';evRender();
 evExperimentAssistantSchedule(state,({experiment})=>{
  const issue=state.issueId?evExperimentIssueLedgerSync(experiment).find(item=>item.id===state.issueId):null;
  const reason=issue?.rootCause||issue?.reason;
  state.messages.push({role:'assistant',text:reason?`结合当前问题，建议重点核对：\n${reason}\n\n${issue.suggestion||'对照预期输出补充约束，并用独立对话验证。'}\n当前为本地 Mock 对话，补充讨论不会改写已有评测证据。`:'建议先对照用例预期结果检查业务正确性、约束遵循和依据可追溯性，再逐项验证优化效果。可在问题优化中查看本次分析归纳的问题。当前为本地 Mock 对话。'});
 });return true;
}
function evExperimentAssistantChat(){
 const state=evExperimentAssistantState();if(!state)return '';
 const title=state.mode==='repair'?'问题修复':'结果分析',running=state.phase==='running';
 return `<div class="studio-panel-top ev-optimization-chat-top"><span class="ev-spark" aria-hidden="true">✧</span><b>评测助手</b><span>${title}</span><button type="button" aria-label="关闭评测助手" onclick="evExperimentAssistantDismiss()">×</button></div><div class="ev-optimization-chat-scroll" id="ev-optimization-chat-scroll"><div class="ev-optimization-chat-context">评测记录 #${esc(evExperimentSelectedRecord(evExperimentCurrent())?.sequence||'')}<span>本地 Mock</span></div>${state.messages.map(message=>`<article class="ev-optimization-chat-message is-${message.role}"><span>${message.role==='user'?'你':'AI'}</span><div>${esc(message.text)}</div>${message.action==='issues'?'<button type="button" class="ont-button" onclick="evExperimentAssistantOpenIssues()">查看问题</button>':message.action==='verify'?'<button type="button" class="ont-button" onclick="evExperimentAssistantVerify()">验证修复</button>':''}</article>`).join('')}${running?`<div class="ev-optimization-chat-loading" role="status"><i></i>${title==='结果分析'?'正在分析评测结果…':'正在处理问题…'}</div>`:''}</div><form class="ev-optimization-chat-composer" onsubmit="event.preventDefault();evExperimentAssistantSend()"><textarea id="ev-optimization-chat-input" aria-label="评测助手对话输入" placeholder="继续讨论当前评测问题" ${running?'disabled':''} oninput="evExperimentAssistantRemember(this)" onkeydown="if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();evExperimentAssistantSend()}">${esc(state.input||'')}</textarea><div><span>Enter 发送 · Shift + Enter 换行</span><button class="ont-button strong" type="submit" ${running?'disabled':''}>发送</button></div></form>`;
}
