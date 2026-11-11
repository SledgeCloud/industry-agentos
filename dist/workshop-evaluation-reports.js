/* Automatic evidence reports and explicitly requested local analysis examples. */
'use strict';

function evExperimentReportClone(value){return JSON.parse(JSON.stringify(value));}
function evExperimentReportFreeze(value){
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(evExperimentReportFreeze);Object.freeze(value);}
  return value;
}
function evExperimentReportSignature(value){
  const text=JSON.stringify(value);let hash=2166136261;
  for(let index=0;index<text.length;index++){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
  return 'evidence-'+(hash>>>0).toString(16).padStart(8,'0')+'-'+text.length;
}
function evExperimentReportExecution(experiment,id){return typeof evExperimentExecutionGet==='function'?evExperimentExecutionGet(experiment,id):(experiment?.runs||[]).flatMap(run=>[run,...(run.supplements||[])]).find(run=>run.id===id)||null;}
function evExperimentReportExecutionLabel(run){return '评测记录 #'+(Number(run?.sequence)||1)+(run?.kind==='supplement'||run?.parentRunId?' · 补跑 #'+(Number(run.supplementSequence)||1):'');}
function evExperimentReportAttempt(result){return Number(result?.attempt??result?.iteration)||1;}
function evExperimentReportAttemptKey(result){return JSON.stringify([result.caseId,evExperimentReportAttempt(result)]);}
function evExperimentReportExecuted(result){return result.enabled!==false&&['通过','未通过','运行失败','待确认','仅观察'].includes(result.status);}
function evExperimentReportScope(experiment,run,snapshot){
  const kind=run.supplementKind||(run.retryCaseId?'case':run.parentRunId||run.retryOf?'failed':'full'),source=evExperimentReportExecution(experiment,run.sourceRunId||run.retryOf),baseline=[...new Set((snapshot.cases||[]).filter(item=>item.enabled!==false).map(item=>item.id))];
  let expected=[];
  if(kind==='full'){
    const execution=snapshot.execution||{},caseRuns=Math.max(1,Number(execution.caseRuns??execution.times)||1);
    for(const caseId of baseline)for(let attempt=1;attempt<=caseRuns;attempt++)expected.push(evExperimentReportAttemptKey({caseId,attempt}));
  }else{
    // A supplement owns its planned attempts, independent of later source changes.
    const sourceRows=source?.report?.evidence?.results||source?.results;
    const rows=run.kind==='supplement'||run.parentRunId?(run.results||[]).filter(item=>item.enabled!==false):sourceRows?sourceRows.filter(item=>kind==='case'?item.caseId===run.retryCaseId&&evExperimentReportExecuted(item):['未通过','运行失败'].includes(item.status)):(run.results||[]).filter(item=>item.enabled!==false);
    expected=rows.map(evExperimentReportAttemptKey);
  }
  return evExperimentReportFreeze({kind,partial:kind!=='full',label:kind==='case'?'单用例补跑':kind==='failed'?'失败用例补跑':'全量评测',sourceRunId:run.sourceRunId||run.retryOf||'',sourceSequence:source?.sequence||null,sourceSupplementSequence:source?.supplementSequence||null,caseId:run.retryCaseId||'',baselineCaseIds:baseline,expectedAttemptKeys:expected,expectedAttempts:expected.length});
}
function evExperimentReportRunFacts(experiment,run){
  const fields=['id','experimentId','experimentName','configurationRevision','kind','parentRunId','sourceRunId','sequence','supplementSequence','supplementKind','status','startedAt','startedAtMs','endedAt','endedAtMs','elapsedMs','retryOf','retryCaseId','retryRevision','lastRetryKind','retryStartedAt','retryStartedAtMs','mock'];
  const facts=Object.fromEntries(fields.filter(key=>run[key]!==undefined).map(key=>[key,run[key]]));
  facts.experimentName=facts.experimentName||experiment.name;facts.configurationRevision=facts.configurationRevision||1;
  return facts;
}
function evExperimentReportCaptureInitial(experiment,run,report){
  if(run.initialFullResult||run.kind==='supplement'||run.parentRunId||report?.scope?.partial||report?.state!=='complete'||!['已完成','部分失败'].includes(run.status))return;
  const evidence=report.evidence;
  run.initialFullResult=evExperimentReportFreeze(evExperimentReportClone({...evidence.run,run:evidence.run,results:evidence.results,summary:evidence.summary,snapshot:evidence.snapshot,report,capturedAt:report.generatedAt,capturedAtMs:report.generatedAtMs}));
}
function evExperimentReportSync(experiment,run){
  if(!experiment||!run||run.kind==='validation'||run.experimentId!==experiment.id)return null;
  const previous=run.report;
  // Final reports retain their original facts even if the live ledger changes.
  if(previous?.finalized&&previous.evidence){evExperimentReportCaptureInitial(experiment,run,previous);return previous;}
  const snapshot=previous?.evidence?.snapshot||evExperimentReportFreeze(evExperimentReportClone(run.snapshot||experiment.snapshot||{})),scope=previous?.scope||evExperimentReportScope(experiment,run,snapshot),snapshotSignature=previous?.snapshotSignature||evExperimentReportSignature(snapshot);
  const results=evExperimentReportClone(run.results||[]),facts=evExperimentReportRunFacts(experiment,run),summary=evExperimentSummary({results});
  const executed=results.filter(evExperimentReportExecuted),keys=new Set(executed.map(evExperimentReportAttemptKey)),expected=new Set(scope.expectedAttemptKeys),baseline=new Set(scope.baselineCaseIds);
  const executedCases=new Set(executed.filter(item=>baseline.has(item.caseId)).map(item=>item.caseId)),terminal=['已完成','部分失败','已停止'].includes(run.status);
  const finishedScope=scope.expectedAttempts>0&&executed.length===scope.expectedAttempts&&keys.size===executed.length&&scope.expectedAttemptKeys.every(key=>keys.has(key))&&executed.every(item=>expected.has(evExperimentReportAttemptKey(item)))&&!results.some(item=>item.enabled!==false&&['待运行','运行中','已跳过'].includes(item.status));
  const state=terminal?(finishedScope?'complete':'incomplete'):'preview',signature=evExperimentReportSignature({facts,results,snapshotSignature,scope});
  if(previous?.signature===signature&&previous.state===state){evExperimentReportCaptureInitial(experiment,run,previous);return previous;}
  const end=typeof evExperimentTimestamp==='function'?evExperimentTimestamp(run.endedAtMs??run.endedAt):null,generatedAtMs=terminal&&Number.isFinite(end)?end:Date.now();
  const evidence=evExperimentReportFreeze({run:facts,summary,results,snapshot,experiment:{id:experiment.id,scene:experiment.scene,createdAt:experiment.createdAt,createdAtMs:experiment.createdAtMs}});
  run.report=Object.assign(previous||{},{id:previous?.id||run.id+'-REPORT',runId:run.id,experimentId:experiment.id,state,revision:(previous?.revision||0)+1,generatedAt:evExperimentTime(generatedAtMs),generatedAtMs,sourceVersion:facts.configurationRevision,signature,snapshotSignature,finalized:terminal,scope,coverage:evExperimentReportFreeze({executedCases:executedCases.size,baselineCases:baseline.size,executedAttempts:executed.length,expectedAttempts:scope.expectedAttempts,fullBaseline:baseline.size>0&&executedCases.size===baseline.size}),evidence,analyses:previous?.analyses||[],selectedAnalysisVersion:previous?.selectedAnalysisVersion||null});
  evExperimentReportCaptureInitial(experiment,run,run.report);return run.report;
}
function evExperimentReportContext(experiment,report){
  const saved=report.evidence,run=evExperimentReportFreeze({...saved.run,results:saved.results,snapshot:saved.snapshot}),agent=saved.snapshot.agent||{},suites=saved.snapshot.suites||[saved.snapshot.suite].filter(Boolean);
  const historical=run.configurationRevision!==experiment.configurationRevision||(experiment.runs||[]).find(item=>item.configurationRevision===experiment.configurationRevision)?.id!==(run.parentRunId||run.id);
  const context={...experiment,...saved.experiment,name:run.experimentName,status:run.status,agentId:agent.id,agentName:agent.name,version:agent.version,suiteId:suites[0]?.id||'',suiteIds:suites.map(item=>item.id),suiteName:suites.map(item=>item.name).join('、'),execution:saved.snapshot.execution||{},snapshot:saved.snapshot,configurationRevision:run.configurationRevision,selectedRunId:run.id,isHistorical:historical};
  return {context,run};
}
function evExperimentReportCall(name,...args){return name+'('+args.map(value=>esc(JSON.stringify(value))).join(',')+')';}
function evExperimentReportSimulationSummary(snapshot,results=[]){
  const execution=snapshot.execution||{},simulation=execution.mode==='scenario_simulation',allSelected=execution.evaluationPolicy==='all_selected';
  if(!simulation&&!allSelected)return '';
  const completed=results.filter(evExperimentReportExecuted),turns=completed.reduce((sum,result)=>sum+(Number(result.actualTurns)||0),0),reasons={single_turn_completed:'单轮执行完成',max_turns:'达到最大模拟轮次',goal_reached:'模拟目标已达成',execution_error:'执行异常'},counts=new Map();
  completed.forEach(result=>{if(result.stopReason)counts.set(result.stopReason,(counts.get(result.stopReason)||0)+1);});
  const bindings=snapshot.unifiedEvaluation?.bindings?.map(binding=>({evaluatorId:binding.evaluatorRef.id,version:binding.evaluatorRef.version,target:binding.evaluationTarget||(binding.targetType==='session'?'conversation':'first_response'),participation:binding.role}))||execution.evaluationBindings||[];
  const evaluators=snapshot.unifiedEvaluation?.evaluatorVersions||snapshot.evaluators||[],bindingRows=bindings.map(binding=>{const evaluator=evaluators.find(item=>(item.id===binding.evaluatorId||item.id+'@'+item.version===binding.evaluatorId)&&(!binding.version||item.version===binding.version));return `<tr><td>${esc(evaluator?.name||binding.evaluatorId)}</td>${allSelected?`<td>${esc(binding.version||evaluator?.version||'未记录')}</td>`:''}<td>${binding.target==='conversation'?'整段会话':'首轮回复'}</td>${allSelected?'':`<td>${binding.participation==='observe'?'仅观察':'参与通过判定'}</td>`}</tr>`;});
  const configuration=evTable(allSelected?['评估器','版本','评估对象']:['评估器','评估对象','结果用途'],bindingRows),rule=allSelected?'<p class="ev-simulation-note">全部所选评估器通过，用例才通过。至少一个评估器明确未通过则未通过；没有未通过但存在证据不足或无法判定项时为待确认。各评估器按自身标准独立判定，不跨评估器平均分数。</p>':'';
  const unassessed=allSelected?[...new Set(results.flatMap(result=>result.dimensions||[]).filter(dimension=>dimension.evaluated===false||dimension.decision==='inconclusive'&&!dimension.assessmentId).map(dimension=>dimension.name).filter(Boolean))]:[],coverage=unassessed.length?`<p class="ev-simulation-note">以下业务维度未评估：${unassessed.map(esc).join('、')}。用例结论按所选评估器结果判定。</p>`:'';
  if(!simulation)return `<section class="ont-overview ev-report-policy"><h3>评估配置</h3>${configuration}${rule}${coverage}</section>`;
  return `<section class="ont-overview ev-report-simulation"><h3>多轮执行与评估配置</h3><dl class="ont-mapping"><div><dt>执行方式</dt><dd>多轮执行</dd></div><div><dt>最大模拟轮次</dt><dd>${esc(execution.maxTurns||5)} 轮（含首轮）</dd></div><div><dt>已记录对话轮次</dt><dd>${turns} 轮</dd></div><div><dt>结束原因</dt><dd>${[...counts].map(([reason,count])=>esc(reasons[reason]||reason)+' '+count+' 段').join('；')||'尚未记录'}</dd></div></dl><details><summary>查看场景提示词快照</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(execution.scenarioPrompt||'未记录')}</pre></details>${configuration}${rule}${coverage}<p class="ev-simulation-note">用例预期输出仅用于首轮回复；达到轮次上限是结束原因，不直接代表质量通过或失败。模拟对话与评分均为本地 Mock。</p></section>`;
}
function evExperimentReportAnalysisView(experiment,report){
  const selected=report.analyses.find(item=>item.version===report.selectedAnalysisVersion)||report.analyses.at(-1);
  if(!selected)return '<p class="muted ev-report-analysis-empty">点击“生成 AI 分析”后生成模拟分析，基础报告不会自动调用模型。</p>';
  const changeVersion=evExperimentReportCall('evExperimentSelectReportAnalysis',experiment.id,report.runId,'VERSION').replace('&quot;VERSION&quot;','Number(this.value)');
  const selector=`<label class="ev-report-analysis-version">分析版本 <select class="ont-button" aria-label="切换 AI 分析版本" onchange="${changeVersion}">${report.analyses.map(item=>`<option value="${item.version}" ${item.version===selected.version?'selected':''}>V${item.version} · ${esc(item.generatedAt)}</option>`).join('')}</select></label>`;
  const refs=items=>items.map(item=>`<button type="button" class="ont-link" onclick="${evExperimentReportCall('evExperimentReportEvidence',experiment.id,report.runId,item.resultId)}">${esc(item.caseId)} · 用例执行 #${evExperimentReportAttempt(item)}</button>`).join('、');
  return `<section class="ont-overview ev-report-analysis"><div class="ont-section-title"><h3>AI 分析 · 模拟示例</h3>${selector}</div><p class="ev-note">${esc(selected.notice)}</p><p>${esc(selected.summary)}</p><h4>结果观察</h4>${selected.findings.map(item=>`<p>${esc(item.text)}${item.references.length?`<br><small>引用：${refs(item.references)}</small>`:''}</p>`).join('')}<h4>待验证建议</h4><ul>${selected.recommendations.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><small class="muted">基于基础报告 ${esc(report.id)} 的修订 ${selected.reportRevision}；生成时间 ${esc(selected.generatedAt)}。</small></section>`;
}
function evExperimentReportView(experiment,run){
  if(!run)return '<div class="ont-empty">尚无基础报告，执行实验后自动生成。</div>';
  const report=evExperimentReportSync(experiment,run);if(!report)return '<div class="ont-empty">暂无可查看的基础报告。</div>';
  const {context,run:evidenceRun}=evExperimentReportContext(experiment,report),state={preview:'预览',complete:'完整',incomplete:'不完整'}[report.state],coverage=report.coverage;
  const sourceRun=evExperimentReportExecution(experiment,report.scope.sourceRunId),source=report.scope.sourceRunId?`（来源 ${sourceRun?evExperimentReportExecutionLabel(sourceRun):report.scope.sourceRunId}）`:'';
  const action=`<button type="button" class="ont-button" ${report.state==='preview'?'disabled aria-disabled="true" title="执行结束后可生成 AI 分析"':`onclick="${evExperimentReportCall('evExperimentGenerateReportAnalysis',experiment.id,run.id)}"`}>生成 AI 分析</button>`;
  const header=`<section class="ont-overview ev-report-summary"><div class="ont-section-title"><h3>基础报告</h3><div class="ont-head-actions ev-report-heading-actions"><span class="ont-badge ev-report-state ${report.state}">${state}</span>${action}</div></div><dl class="ont-mapping"><div><dt>报告编号</dt><dd>${esc(report.id)}</dd></div><div><dt>关联评测记录</dt><dd>${esc(evExperimentReportExecutionLabel(evidenceRun))}</dd></div><div><dt>执行范围</dt><dd>${esc(report.scope.label+source)}</dd></div><div><dt>用例覆盖</dt><dd>${coverage.executedCases} / ${coverage.baselineCases} 个启用用例</dd></div><div><dt>用例执行</dt><dd>${coverage.executedAttempts} / ${coverage.expectedAttempts} 次</dd></div><div><dt>生成时间</dt><dd>${esc(report.generatedAt)}</dd></div></dl>${report.scope.partial?'<p class="ev-note ev-report-scope-note">本报告仅覆盖所选补跑范围，局部结果不代表全量结论。</p>':''}${report.state==='preview'?'<p class="ev-note">当前为执行预览；暂停后继续使用同一报告，执行结束后生成最终基础报告。</p>':report.state==='incomplete'?'<p class="ev-note">当前尚未完整执行计划条目，报告仅呈现已记录的事实。</p>':''}</section>`;
  const body=typeof evExperimentReportBody==='function'?evExperimentReportBody(context,evidenceRun):'',simulation=body.includes('ev-report-simulation')||body.includes('ev-report-policy')?'':evExperimentReportSimulationSummary(report.evidence.snapshot,report.evidence.results);
  return `<div class="ev-base-report" data-report-id="${esc(report.id)}" data-report-state="${report.state}">${header}${simulation}${evExperimentReportAnalysisView(experiment,report)}${body}</div>`;
}
function evExperimentGenerateReportAnalysis(experimentId,runId){
  const experiment=evExperimentGet(experimentId),run=evExperimentReportExecution(experiment,runId);
  if(!experiment||experiment.scene!==studio.scene||!run){if(typeof toast==='function')toast('报告不存在或不属于当前场景');return false;}
  const report=evExperimentReportSync(experiment,run);
  if(!report||report.state==='preview'){if(typeof toast==='function')toast('请等待执行结束后再生成 AI 分析');return false;}
  const rows=report.evidence.results.filter(evExperimentReportExecuted),summary=report.evidence.summary,failed=rows.filter(item=>['未通过','运行失败'].includes(item.status)),groups=new Map();
  for(const result of failed){if(!groups.has(result.caseId))groups.set(result.caseId,[]);groups.get(result.caseId).push(result);}
  const reference=item=>({caseId:item.caseId,resultId:item.id,attempt:evExperimentReportAttempt(item)});
  const findings=[...groups].slice(0,5).map(([caseId,items])=>({text:`用例 ${caseId} 记录了 ${items.filter(item=>item.status==='未通过').length} 次未通过和 ${items.filter(item=>item.status==='运行失败').length} 次执行失败；这些结果表明需要复核，不足以直接确认根因。`,references:items.slice(0,3).map(reference)}));
  if(!findings.length)findings.push({text:rows.length?'本次已执行条目中未记录未通过或运行失败；该观察不覆盖未执行用例或其它配置。':'本次尚无已执行条目，无法形成质量判断。',references:rows.slice(0,2).map(reference)});
  const recommendations=[];
  if(summary.errors)recommendations.push('查看引用执行的错误和工具调用证据，核实失败发生的位置；当前报告不能直接证明具体根因。');
  if(summary.failed)recommendations.push('对照引用用例的输入、预期、实际输出及未达标评分项，确认需调整的规则或提示词，再安排复验。');
  if(report.state==='incomplete')recommendations.push('先补齐本次计划中未完成的执行条目，再评估该范围的整体质量。');
  if(report.scope.partial)recommendations.push('本次属于局部补跑；如需判断整体能力，应另行执行全量评测。');
  if(!recommendations.length)recommendations.push('保留本次结果作为证据，后续配置变更后使用相同验收条件复验。');
  const version=report.analyses.length+1,generatedAt=evExperimentTime();
  const analysis=evExperimentReportFreeze({id:report.id+'-AI-'+version,version,reportId:report.id,reportRevision:report.revision,evidenceSignature:report.signature,generatedAt,kind:'mock',notice:'AI 分析 · 模拟示例。基于本报告证据生成，未调用真实模型；建议需要进一步验证。',summary:`${evExperimentReportExecutionLabel(report.evidence.run)} ${report.scope.label}：已执行 ${summary.executed} 次，${summary.passed} 次通过，${summary.failed} 次未通过，${summary.errors} 次执行失败。`,findings,recommendations});
  report.analyses.push(analysis);report.selectedAnalysisVersion=version;
  if(typeof evExperimentCurrent==='function'&&evExperimentCurrent()?.id===experiment.id&&typeof evExperimentRefreshDetail==='function')evExperimentRefreshDetail(experiment);
  if(typeof toast==='function')toast('已生成 AI 分析 · 模拟示例 V'+version);
  return analysis;
}
function evExperimentSelectReportAnalysis(experimentId,runId,version){
  const experiment=evExperimentGet(experimentId),run=evExperimentReportExecution(experiment,runId),report=run?.report;
  if(!experiment||experiment.scene!==studio.scene||!report?.analyses.some(item=>item.version===version))return false;
  report.selectedAnalysisVersion=version;
  if(typeof evExperimentRefreshDetail==='function')evExperimentRefreshDetail(experiment);
  return true;
}
function evExperimentReportEvidence(experimentId,runId,resultId){
  const experiment=evExperimentGet(experimentId),run=evExperimentReportExecution(experiment,runId),reports=[run?.report,...[...(run?.reexecutions||[])].reverse().map(item=>item.report)].filter(Boolean),report=reports.find(item=>item.evidence?.results.some(result=>result.id===resultId)),result=report?.evidence?.results.find(item=>item.id===resultId);
  if(!experiment||experiment.scene!==studio.scene||!result||typeof evModal!=='function')return false;
  const field=(label,value)=>`<label class="ont-field ont-wide"><span>${label}</span><textarea readonly aria-label="${label}">${esc(value||'—')}</textarea></label>`;
  const simulated=result.executionMode==='scenario_simulation'||report.evidence.snapshot.execution?.mode==='scenario_simulation',conversation=simulated&&(result.messages||[]).length?`<section class="ont-form-section"><h3>完整模拟会话</h3><p class="ev-simulation-note">实际 ${esc(result.actualTurns||0)} 轮 · ${esc(({max_turns:'达到最大模拟轮次',goal_reached:'模拟目标已达成',execution_error:'执行异常'})[result.stopReason]||result.stopReason||'未记录结束原因')}</p>${(result.messages||[]).map(message=>`<article class="ont-execution"><b>${message.role==='user'?'用户':'Agent'}</b><p style="white-space:pre-wrap">${esc(message.content||'—')}</p></article>`).join('')}</section>`:'';
  evModal('基础报告证据 · '+result.caseId,`<p class="ev-note">报告 ${esc(report.id)} · ${esc(evExperimentReportExecutionLabel(report.evidence.run))} · 用例执行 #${evExperimentReportAttempt(result)} · ${esc(result.status)}</p><section class="ont-form-section"><h3>执行证据</h3><div class="ont-grid">${field('输入',result.input)}${field(simulated?'首轮预期输出':'预期结果',result.expected)}${field(simulated?'首轮实际回复':'实际结果',result.firstResponse??result.actual)}${field('判定依据',result.reason)}</div></section>${conversation}`);
  return true;
}

// Export a readable, standalone report with the pinned evidence and the selected
// analysis of its evidence revision. Interactive controls become static text.
function evExperimentExportReport(experimentId,runId){
  const experiment=evExperimentGet(experimentId),run=evExperimentReportExecution(experiment,runId);
  if(!experiment||experiment.scene!==studio.scene||!run){toast('暂无可导出的实验报告');return false;}
  const report=evExperimentReportSync(experiment,run),html=evExperimentReportView(experiment,run)
    .replace(/<button\b[^>]*>([\s\S]*?)<\/button>/g,'<span>$1</span>')
    .replace(/<select\b[^>]*>[\s\S]*?<\/select>/g,'')
    .replace(/\s(?:on[a-z]+|tabindex)="[^"]*"/g,'');
  const label=evExperimentReportExecutionLabel(run),history=[...(run.supplements||[]).map(item=>`<li>${esc(evExperimentReportExecutionLabel(item))}：${esc(item.startedAt)}，${esc(item.status)}。</li>`),...(run.reexecutions||[]).map(item=>`<li>历史补跑 ${item.revision}：${esc(item.startedAt)}，保留报告修订 ${item.report?.revision||'—'}。</li>`)].join('');
  const content=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(run.experimentName)} · ${esc(label)}实验报告</title><style>body{font:14px/1.7 system-ui,sans-serif;color:#202636;max-width:1100px;margin:40px auto;padding:0 28px}h1{font-size:26px}h3{font-size:18px;margin-top:28px}h4{font-size:15px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{border:1px solid #dce1e9;padding:9px;text-align:left;vertical-align:top}th{background:#f4f6fa}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px}dt{color:#68738a}dd{margin:0}.ont-badge,.ev-experiment-status{display:inline-block;padding:2px 7px;background:#f0f3f8;border-radius:4px}.ont-section-title{display:flex;align-items:center;justify-content:space-between}.muted,.ev-note,small{color:#68738a}.ev-table-footer,.ont-search,.ev-report-analysis-version{display:none}.ev-ellipsis{white-space:normal}section{break-inside:avoid}p,td,dd{overflow-wrap:anywhere}@media print{body{margin:0;padding:0}}</style></head><body><h1>${esc(run.experimentName)} · 实验报告</h1>${html}${history?'<h3>关联补跑记录</h3><ul>'+history+'</ul>':''}<p>本地 Mock 评测报告 · 导出时所选记录：${esc(label)} · 报告修订 ${report.revision}</p></body></html>`;
  const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download=experiment.id+'-评测记录'+run.sequence+(run.kind==='supplement'||run.parentRunId?'-补跑'+(Number(run.supplementSequence)||1):'')+'-实验报告.html';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('实验报告已导出');return {filename:link.download,content};
}
