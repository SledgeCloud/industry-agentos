/* Evaluation experiment views. Runs and reports use the local Mock engine's immutable snapshots. */
const evExperimentState={scene:'sales',id:null,runId:'',supplementId:'',tab:'用例结果',search:'',resultSearch:''};
let evExperimentEditor=null;

function evExperimentUI(){
  if(evExperimentState.scene!==studio.scene){evClearFilters('experimentResult');Object.assign(evExperimentState,{scene:studio.scene,id:null,runId:'',supplementId:'',tab:'用例结果',search:'',resultSearch:''});evExperimentEditor=null;}
  return evExperimentState;
}
function evExperimentDuration(value){const n=Number(value)||0;return n<1000?Math.round(n)+' ms':(n/1000).toFixed(2)+' s';}
function evExperimentRate(value){return value===null||value===undefined?'—':Number(value).toFixed(1)+'%';}
function evExperimentDisplayStatus(status){return ({'运行中':'执行中','未运行':'尚未执行'})[status]||status;}
function evExperimentStatus(status){status=evExperimentDisplayStatus(status);const color=['已完成','通过'].includes(status)?'success':['部分失败','未通过','运行失败'].includes(status)?'error':status==='执行中'?'running':'paused';return `<span class="ev-experiment-status ${color}"><i></i>${esc(status)}</span>`;}
function evExperimentSuiteLinks(experiment,ids=null){return '<span class="ev-suite-links">'+(experiment.snapshot.suites||[experiment.snapshot.suite]).filter(s=>!ids||ids.includes(s.id)).map(s=>`<button type="button" class="ont-link" onclick="evExperimentGoSuite('${experiment.id}','${s.id}','${s.version||''}')">${esc(s.name)} <span class="ont-badge">${esc(s.version||'当前快照')}</span></button>`).join('')+'</span>';}
function evExperimentGoSuite(experimentId,id,version){evCloseModal();if(!evOpenSuite(id)){toast('该评测集已移除，执行快照仍保留在实验配置中');return;}const record=evData().suites.find(s=>s.id===id);if(version&&evVersionOptions(record).some(v=>v.key===version)){evVersionSetSelection('suite',id,version);evRender();}}
function evExperimentMoreActions(e){const active=evExperimentActiveExecution(e);if(active?.kind==='validation')return [{label:'查看问题验证',code:`evExperimentOpen('${e.id}','${active.sourceRecordId}','问题优化');evExperimentIssueDetail('${active.validationIssueId}','all','${e.id}')`}];if(active?.status==='运行中')return [{label:'暂停',code:`evExperimentPause('${e.id}')`}];if(active?.status==='已暂停')return [{label:'继续执行',code:`evExperimentResume('${e.id}')`}];return [{label:'编辑',code:`evEditExperiment('${e.id}')`},...(e.runs[0]?.status==='部分失败'?[{label:'失败用例补跑',code:`evExperimentRetry('${e.id}')`}]:[]),{label:e.runs.length?'重新全量评测':'执行实验',code:`evExperimentStart('${e.id}')`}];}
function evExperimentPause(id){evPauseExperiment(id);evRender();}
function evExperimentResume(id){evResumeExperiment(id);evRender();}
function evExperimentRetry(id,runId=''){
 const experiment=evExperimentGet(id);if(!experiment||experiment.scene!==studio.scene)return false;
 const source=runId?evExperimentExecutionGet(experiment,runId):evExperimentState.id===id?evExperimentViewRun(experiment):experiment.runs[0];
 if(!source)return false;
 try{const run=evRunExperiment(id,source);evExperimentOpen(id,run.id);toast('已启动失败用例补跑，归入评测记录 #'+run.sequence);return run;}
 catch(error){toast(error.message||'无法重新执行失败用例');return false;}
}
function evExperimentRetryCase(experimentId,runId,caseId){
 if(typeof caseId!=='string'||!caseId.trim()){toast('请选择要重跑的用例');return false;}
 const experiment=evExperimentCurrent();
 if(!experiment||experiment.id!==experimentId||evExperimentViewRun(experiment)?.id!==runId){toast('当前实验或评测记录已变更，请重新选择用例');return false;}
 try{const source=evExperimentExecutionGet(experiment,runId),run=evRunExperiment(experimentId,source,caseId);evExperimentOpen(experimentId,run.id);toast('已启动所选用例补跑，首次全量结果保留');return run;}
 catch(error){toast(error.message||'无法重跑该用例');return false;}
}

function evExperimentRetryResult(experimentId,runId,resultId){
 const context=evExperimentCaseDetailContext(resultId);if(!context||context.validation||context.current.id!==experimentId||context.run?.id!==runId||!['未通过','运行失败'].includes(context.result.status))return false;
 try{const retry=evRunExperiment(experimentId,context.run,context.result.caseId,{resultId});evCloseModal();evExperimentOpen(experimentId,retry.id);evExperimentCaseDetail(retry.results[0].id);toast('已重新执行当前用例结果，原结果保留');return retry;}catch(error){toast(error.message||'无法重新执行');return false;}
}
function evExperimentActualLabel(result){if(result.actual)return result.actual;if(['待运行','运行中'].includes(result.status))return '等待 Agent 输出';if(result.status==='已停用')return '该用例已停用，运行时将跳过';if(result.status==='已跳过')return result.reason==='已停止'?'停止运行后跳过，未执行':'停用用例，已跳过';return '暂无输出';}
function evExperimentText(value){return `<span class="ev-ellipsis" title="${esc(value||'')}">${esc(value||'—')}</span>`;}
let evExperimentOutputPopover=null,evExperimentOutputPopoverTimer=null;
function evExperimentOutputPreview(value){
 const rows=(Array.isArray(value)?value:[value]).map(result=>({attempt:evExperimentAttemptNumber(result),status:evExperimentDisplayStatus(result.status),text:String(evExperimentActualLabel(result))})),multiple=rows.length>1;
 const label=multiple?rows.length+' 次执行输出':rows[0]?.text||'暂无输出';
 return `<span class="ev-output-preview ev-ellipsis" tabindex="0" aria-label="查看完整实际输出" data-ev-output="${esc(JSON.stringify(rows))}" onmouseenter="evExperimentShowOutput(this)" onmouseleave="evExperimentHideOutput()" onfocus="evExperimentShowOutput(this)" onblur="evExperimentHideOutput()">${esc(label)}</span>`;
}
function evExperimentCloseOutput(){
 if(evExperimentOutputPopoverTimer!==null){clearTimeout(evExperimentOutputPopoverTimer);evExperimentOutputPopoverTimer=null;}
 if(evExperimentOutputPopover){evExperimentOutputPopover.anchor?.removeAttribute('aria-describedby');evExperimentOutputPopover.panel.remove();evExperimentOutputPopover=null;}
}
function evExperimentKeepOutput(){if(evExperimentOutputPopoverTimer!==null){clearTimeout(evExperimentOutputPopoverTimer);evExperimentOutputPopoverTimer=null;}}
function evExperimentHideOutput(){evExperimentKeepOutput();evExperimentOutputPopoverTimer=setTimeout(evExperimentCloseOutput,150);}
function evExperimentShowOutput(anchor){
 evExperimentKeepOutput();if(evExperimentOutputPopover?.anchor===anchor)return;
 evExperimentCloseOutput();if(!anchor||anchor.isConnected===false)return;
 let rows;try{rows=JSON.parse(anchor.getAttribute('data-ev-output')||'[]');}catch(error){return;}
 if(!Array.isArray(rows)||!rows.length)return;
 const panel=document.createElement('div');panel.id='ev-experiment-output-tooltip';panel.className='ev-output-popover';panel.setAttribute('role','tooltip');
 panel.innerHTML='<header>实际输出</header>'+rows.map(row=>`<section>${rows.length>1?`<h4>第 ${esc(row.attempt)} 次执行 · ${esc(row.status)}</h4>`:''}<div>${esc(row.text)}</div></section>`).join('');
 panel.onmouseenter=evExperimentKeepOutput;panel.onmouseleave=evExperimentHideOutput;document.body.appendChild(panel);
 anchor.setAttribute('aria-describedby',panel.id);evExperimentOutputPopover={anchor,panel};
 const rect=anchor.getBoundingClientRect(),width=Math.min(520,Math.max(0,window.innerWidth-32));panel.style.width=width+'px';
 const bounds=panel.getBoundingClientRect(),height=Math.min(bounds.height,Math.max(0,window.innerHeight-32)),left=Math.max(16,Math.min(rect.left,window.innerWidth-width-16));
 const top=rect.bottom+8+height<=window.innerHeight-16?rect.bottom+8:Math.max(16,rect.top-height-8);
 panel.style.left=left+'px';panel.style.top=top+'px';
}
document.addEventListener('keydown',event=>{if(event.key==='Escape')evExperimentCloseOutput();});
document.addEventListener('scroll',event=>{if(!evExperimentOutputPopover?.panel.contains?.(event.target))evExperimentCloseOutput();},true);
if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('resize',evExperimentCloseOutput);
function evExperimentCurrent(){const state=evExperimentUI(),experiment=state.id?evExperimentGet(state.id):null;return experiment?.scene===studio.scene?experiment:null;}
function evExperimentDashboardScope(experiment=null){return experiment?'experiment:'+experiment.id:'experiment-list';}
function evExperimentRunsInRange(experiment){return experiment.runs||[];}
function evExperimentSelectedRecord(experiment){
 if(!experiment)return null;const state=evExperimentUI(),active=evExperimentActiveExecution(experiment);
 return experiment.runs.find(record=>record.id===state.runId)||(!state.runId&&active?evExperimentRecordFor(experiment,active):null)||experiment.runs[0]||null;
}
function evExperimentSelectedRun(experiment){const record=evExperimentSelectedRecord(experiment);return record?.supplements?.find(run=>run.id===evExperimentState.supplementId)||record;}
function evExperimentViewRun(experiment){return evExperimentState.tab==='用例结果'?evExperimentSelectedRecord(experiment):evExperimentSelectedRun(experiment);}
function evExperimentAttemptNumber(result){return Math.max(1,Number(result.attempt??result.iteration)||1);}
function evExperimentCaseRepeatCount(experiment){return Math.max(1,Number(experiment.snapshot?.execution?.caseRuns??experiment.execution?.caseRuns??experiment.snapshot?.execution?.times??experiment.execution?.times)||1);}
function evExperimentExecutionLabel(run){return run?'评测记录 #'+run.sequence+(run.kind==='supplement'?' · 补跑 #'+run.supplementSequence:''):'尚未执行';}
function evExperimentCurrentPlanAvailable(experiment){return !experiment.runs.length;}
function evExperimentCurrentPreview(experiment,run){return !run&&!evExperimentState.runId&&evExperimentCurrentPlanAvailable(experiment);}
function evExperimentRangeEmpty(experiment,run){return !run&&!evExperimentCurrentPreview(experiment,run);}
function evExperimentEmptyRun(){return '<section class="ont-overview"><div class="ont-empty">暂无评测记录。</div></section>';}

function evExperimentRunSelector(experiment,run){
 const record=evExperimentSelectedRecord(experiment);
 return `<div class="ev-run-history">评测记录 <details id="ev-experiment-history" class="ev-period-selector" onkeydown="evDashboardMenuKey(event,this)"><summary class="ont-button" aria-disabled="${!experiment.runs.length}" onclick="${experiment.runs.length?'':'event.preventDefault()'}" aria-label="选择评测记录" title="${esc(record?(record.startedAt||'等待开始')+' · '+evExperimentDisplayStatus(record.status):'尚未执行')}">${record?'记录 #'+record.sequence:'尚未执行'} ${evDropdownArrow()}</summary><div class="ev-period-menu" data-ev-popover role="menu">${experiment.runs.map(item=>`<button type="button" role="menuitemradio" aria-checked="${item.id===record?.id}" title="${esc((item.startedAt||'等待开始')+' · '+evExperimentDisplayStatus(item.status))}" onclick="evExperimentSelectRun('${item.id}')">记录 #${item.sequence} · ${esc(evExperimentDisplayStatus(item.status))}</button>`).join('')}</div></details></div>`;
}
function evExperimentDashboard(experiment=null,run=null){
 if(typeof evDashboardBar!=='function')return '';
 const scope=evExperimentDashboardScope(experiment),metrics=evExperimentDashboardMetrics(experiment,run);
 return evDashboardBar(scope,metrics,experiment?{contextHTML:(evExperimentState.tab==='实验配置'?'<span class="muted">当前实验配置 · 保存后用于后续全量评测</span>':evExperimentState.tab==='问题优化'?evExperimentIssueScopeControl(experiment):evExperimentRunSelector(experiment,run))}:{});
}
function evExperimentDashboardMetrics(experiment,run){
 if(experiment&&evExperimentState.tab==='用例结果')run=evExperimentRecordFor(experiment,run)||run;
 if(!experiment)return evDashboardExperimentMetrics(evExperimentVisible(),evExperimentDashboardScope());
 return evExperimentState.tab==='用例结果'?evDashboardRunMetrics(experiment,run):evExperimentState.tab==='问题优化'?evDashboardIssueMetrics(experiment,run):[];
}
function evExperimentRefreshHistorySelector(experiment,run,force=false){
 if(evExperimentState.tab==='实验配置')return;
 if(evExperimentState.tab==='问题优化'){
  const control=document.querySelector('#ev-experiment-dashboard .ev-issue-scope');
  if(control&&!control.querySelector('details[open]')&&!control.contains(document.activeElement))control.outerHTML=evExperimentIssueScopeControl(experiment);
  return;
 }
 const history=document.querySelector('#ev-experiment-dashboard .ev-run-history');
 if(history&&(force||!history.querySelector('details[open]')&&!history.contains(document.activeElement))){const focused=history.contains(document.activeElement);history.outerHTML=evExperimentRunSelector(experiment,run);if(force&&focused)document.querySelector('#ev-experiment-dashboard .ev-run-history summary')?.focus?.({preventScroll:true});}
}
function evExperimentRefreshDashboard(experiment=null){
 const node=document.getElementById(experiment?'ev-experiment-dashboard':'ev-experiment-list-dashboard');if(!node)return;
 const run=experiment?evExperimentViewRun(experiment):null,scope=evExperimentDashboardScope(experiment);
 if(typeof evDashboardRefresh==='function'&&node.querySelector?.('[data-ev-dashboard-scope]')){
  const metrics=evExperimentDashboardMetrics(experiment,run);if(metrics.length)evDashboardRefresh(scope,metrics);
  if(experiment){evExperimentRefreshHistorySelector(experiment,run);}
 }else evExperimentReplaceContent(node,evExperimentDashboard(experiment,run));
}
function evExperimentVisible(){
  const state=evExperimentUI(),allowed=new Set(evAgents().map(a=>a.id));
  if(evState.objectIds.length){const selected=evObjects().filter(o=>evState.objectIds.includes(o.id));const bound=new Set(selected.flatMap(o=>o.agentIds));for(const id of allowed)if(!bound.has(id))allowed.delete(id);}
  const q=state.search.trim().toLowerCase();
  return evExperimentStore(studio.scene).experiments.filter(e=>(typeof evDashboardExperimentMatches!=='function'||evDashboardExperimentMatches(e,'experiment-list'))&&allowed.has(e.agentId)&&(!evState.agentIds.length||evState.agentIds.includes(e.agentId))&&evFilterMatch('experiment','agent',e.agentId)&&evFilterMatch('experiment','status',evExperimentDisplayStatus(e.status))&&(!q||[e.id,e.name,e.agentName,e.version,e.suiteName].join(' ').toLowerCase().includes(q)));
}
function evExperimentsView(){
  evExperimentUI();evExperimentStore(studio.scene);
  const experiment=evExperimentCurrent();
  return experiment?evExperimentDetail(experiment):`<div id="ev-experiment-list-dashboard">${evExperimentDashboard()}</div><div id="ev-experiment-list">${evExperimentListTable(evExperimentVisible())}</div>`;
}

function evExperimentListTable(experiments,contentOnly=false){
 const state=evExperimentUI(),headers=['编号','名称',evFilterHeader('Agent','experiment','agent',evAgents().map(a=>({id:a.id,name:a.name}))),'评测集','最新评测记录','用例数','耗时','Token消耗',evFilterHeader('状态','experiment','status',['已完成','部分失败','已暂停','执行中'].map(v=>({id:v,name:v}))),'通过率','创建时间','操作'];
 const timeFiltered=typeof evDashboardRange==='function'&&evDashboardRange('experiment-list')!=='all';
 const rows=experiments.map(e=>{
  const matching=timeFiltered?evDashboardExperimentExecutions(e,'experiment-list'):[],run=timeFiltered?matching.reduce((latest,item)=>!latest||evExperimentTimestamp(item.startedAtMs??item.startedAt)>evExperimentTimestamp(latest.startedAtMs??latest.startedAt)?item:latest,null):e.runs.find(item=>['运行中','已暂停'].includes(item.status))||e.runs[0]||null;
  const view=run?evExperimentRunContext(e,run):e,summary=run?evExperimentSummary({...run,results:evExperimentMetricResults(e,run)}):null,status=run?.status||e.status,open=`evExperimentOpen('${e.id}'${timeFiltered&&run?`,'${run.id}'`:''})`;
  const more=evExperimentMoreActions(e);if(run)more.push({label:'报告',code:`evExperimentOpen('${e.id}','${run.id}','实验报告')`});
  return `<tr><td><span class="ont-id">${esc(e.id)}</span></td><td><button type="button" class="ont-link" onclick="${open}">${esc(view.name)}</button></td><td>${esc(view.agentName)} <span class="ont-badge">${esc(view.version)}</span></td><td>${evExperimentSuiteLinks(view)}</td><td>${run?'记录 #'+run.sequence+(run.kind==='supplement'?' · 补跑 #'+run.supplementSequence:''):'—'}</td><td>${run?new Set(run.results.map(r=>r.caseId)).size:view.snapshot.cases.length}</td><td title="当前评测记录中已执行用例的耗时之和">${summary?.executed?evExperimentDuration(summary.durationMs):'—'}</td><td title="当前评测记录中已执行用例的 Token 消耗之和">${summary?.executed?Number(summary.tokens).toLocaleString('zh-CN'):'—'}</td><td>${evExperimentStatus(status)}</td><td>${summary?evExperimentRate(summary.passRate):'—'}</td><td>${esc(e.createdAt)}</td><td><div class="ev-actions"><button type="button" class="ont-link" onclick="${open}">查看</button>${evMore(more)}</div></td></tr>`;
 });
 const empty='<div class="ont-empty">暂无匹配的评测实验</div>',toolbar=`<label class="ont-search"><input aria-label="搜索评测实验" placeholder="搜索编号、名称、Agent 或评测集" value="${esc(state.search)}" oninput="evExperimentState.search=this.value;evExperimentRefreshList()"><svg viewBox="0 0 18 18"><circle cx="7" cy="7" r="5"/><path d="m11 11 4 4"/></svg></label><div class="ont-head-actions">${evCreateMenu('experiment')}</div>`;
 return contentOnly?evTableContent(headers,rows,empty):evTable(headers,rows,empty,toolbar);
}

function evExperimentReplaceContent(node,markup){
  evExperimentCloseOutput();
  const previous=[...(node.querySelectorAll?.('.ev-table-scroll')||[])].map(el=>({left:el.scrollLeft||0,top:el.scrollTop||0})),active=document.activeElement,focused=active&&node.contains?.(active)?{id:active.id,action:active.getAttribute?.('onclick'),label:active.getAttribute?.('aria-label')}:null;
  node.innerHTML=markup;
  if(focused){const target=[...(node.querySelectorAll?.('button,input,select,textarea,a[href]')||[])].find(el=>focused.id?el.id===focused.id:focused.action?el.getAttribute('onclick')===focused.action:focused.label&&el.getAttribute('aria-label')===focused.label);target?.focus?.({preventScroll:true});}
  [...(node.querySelectorAll?.('.ev-table-scroll')||[])].forEach((el,i)=>{if(previous[i]){el.scrollLeft=previous[i].left;el.scrollTop=previous[i].top;}});
}
function evExperimentRefreshList(){if(document.getElementById('ev-experiment-list'))evRefreshList('experiment');}
function evExperimentOpen(id,runId='',tab='用例结果'){
  evExperimentCloseOutput();
  const experiment=evExperimentGet(id);if(!experiment||experiment.scene!==studio.scene){toast('评测实验不属于当前场景或已不存在');return false;}
  const state=evExperimentUI();const selected=evExperimentExecutionGet(experiment,runId),record=selected&&evExperimentRecordFor(experiment,selected);Object.assign(state,{id,runId:record?.id||'',supplementId:selected?.kind==='supplement'?selected.id:'',tab:['用例结果','问题优化','实验报告','实验配置'].includes(tab)?tab:'用例结果',resultSearch:''});evState.tab='评测实验';evState.suiteId=null;evClearFilters('experimentResult');evRender();return true;
}
function evExperimentBack(){evExperimentCloseOutput();evClearFilters('experimentResult');Object.assign(evExperimentState,{id:null,runId:'',supplementId:'',tab:'用例结果',resultSearch:''});evRender();}
function evExperimentEligibleSuites(agentId){if(!evAgents().some(a=>a.id===agentId))return [];return evData().suites.filter(s=>s.agentId===agentId&&s.taskIds.length&&s.taskIds.every(id=>evData().tasks.some(t=>t.id===id&&t.agentId===agentId)));}
function evExperimentSuiteCount(suite){const cases=suite.caseIds.map(id=>evData().cases.find(c=>c.id===id&&!c.archived)).filter(Boolean);return {total:cases.length,enabled:cases.filter(c=>c.enabled).length};}
function evExperimentVersionOptions(agentId,selected=''){return `<option value="">${agentId?'请选择 Agent 版本':'请先选择 Agent'}</option>`+(agentId?evAgentVersions(agentId):[]).map(v=>`<option value="${esc(v.id)}" ${v.id===selected?'selected':''}>${esc(v.name)}</option>`).join('');}
function evExperimentSuiteOptions(agentId,version,selected=[]){
 const ids=Array.isArray(selected)?selected:selected?[selected]:[],options=agentId&&version?evExperimentEligibleSuites(agentId).map(s=>{const count=evExperimentSuiteCount(s);return {id:s.id,name:s.name,description:count.enabled+' 条启用 / 共 '+count.total+' 条'+(!count.enabled&&ids.includes(s.id)?' · 已不可用，请取消选择':''),disabled:!count.enabled&&!ids.includes(s.id)};}):[];
 for(const id of ids)if(!options.some(o=>o.id===id)){const old=evExperimentEditor?.snapshot?.suites?.find(s=>s.id===id)||evExperimentEditor?.snapshot?.suite;options.push({id,name:old?.id===id?old.name:id,description:'已不可用，请取消选择'});}
 return evMultiSelect({name:'suiteIds',label:!agentId?'请先选择 Agent':!version?'请先选择 Agent 版本':'选择评测集',options,selected:ids,onchange:'evExperimentSuiteChange()'});
}
function evExperimentEvaluationTargetLabel(target){return target==='conversation'?'整段会话':'首轮回复';}
function evExperimentEvaluationParticipationLabel(participation){return participation==='observe'?'仅观察':'参与通过判定';}
function evExperimentScenarioTemplate(){return `【当前场景】
围绕本条用例的初始输入开展对话，说明用户当前的业务阶段与诉求。

【用户画像】
描述用户的角色、专业程度、表达习惯、情绪和耐心程度。

【已知事实与上下文】
仅使用本条输入及本场景明确提供的事实；未提供的信息回答“不知道”，不得编造。

【行为规则】
根据 Agent 上一轮回复自然回应；被追问时再提供已知信息，不主动改变原始目标。
不读取用例预期输出或评分标准，不替 Agent 补充答案或完成任务。

【用户目标与结束意愿】
描述用户想完成的事情，以及何时认为已解决、放弃或无法继续。`;}
function evExperimentEvaluatorVersionOptions(id,snapshot=null){
 const evaluator=evEvaluatorStore().evaluators.find(item=>item.id===id),versions=evEvaluatorPublishedVersions(evaluator),old=snapshot?.evaluators?.find(item=>item.id===id),selected=evExperimentEditor?.evaluatorVersions?.[id]||old?.sourceVersion||old?.version||versions[0]?.version||'';
 return (selected&&!versions.some(item=>item.version===selected)?`<option value="${esc(selected)}" selected disabled>${esc(selected)} · 原版本不可用，请重新选择</option>`:'')+(!selected?'<option value="">请选择已发布版本</option>':'')+versions.map(item=>`<option value="${esc(item.version)}" ${item.version===selected?'selected':''}>${esc(item.version)}${item.version===versions[0]?.version?' · 最新已发布':''}</option>`).join('');
}
function evExperimentEvaluatorVersionChange(control){
 if(!evExperimentEditor)return;const id=control.getAttribute('data-evaluator-id');if(!id)return;
 evExperimentEditor.evaluatorVersions={...(evExperimentEditor.evaluatorVersions||{}),[id]:control.value};evExperimentClearError();
}
function evExperimentBindingsMarkup(selected=[],config={},snapshot=null){
 const simulation=config.mode==='scenario_simulation',bindings=config.evaluationBindings||[],evaluators=evEvaluatorStore().evaluators;
 if(!selected.length)return '';
 return selected.map(id=>{const evaluator=evaluators.find(e=>e.id===id)||snapshot?.evaluators?.find(e=>e.id===id),binding=bindings.find(b=>b.evaluatorId===id)||{},target=simulation&&binding.target==='conversation'?'conversation':'first_response';
  return `<article class="ev-experiment-evaluation-binding" data-evaluator-id="${esc(id)}"><div class="ont-grid ev-experiment-evaluator-row">${evField('评估器',`<input class="ev-experiment-evaluator-name" value="${esc(evaluator?.name||id)}" aria-label="评估器 ${esc(evaluator?.name||id)}" title="${esc((evaluator?.name||id)+' · '+id)}" readonly>`,'',false)}${evField('版本',`<select name="evaluatorVersion.${esc(id)}" data-ev-evaluator-version data-evaluator-id="${esc(id)}" aria-label="评估器版本 ${esc(evaluator?.name||id)}" required onchange="evExperimentEvaluatorVersionChange(this)">${evExperimentEvaluatorVersionOptions(id,snapshot)}</select>`)}${evField('评估对象',`<select name="evaluationTarget.${esc(id)}" data-ev-binding-target data-evaluator-id="${esc(id)}" aria-label="评估对象 ${esc(evaluator?.name||id)}" onchange="evExperimentBindingChange()"><option value="first_response" ${target==='first_response'?'selected':''}>首轮回复</option><option value="conversation" ${target==='conversation'?'selected':''} ${simulation?'':'disabled'}>整段会话${simulation?'':'（多轮执行可选）'}</option></select>`)}</div></article>`;
 }).join('');
}
function evExperimentCaptureBindings(){
 const editor=evExperimentEditor;if(!editor)return;
 for(const control of document.querySelectorAll('[data-ev-evaluator-version]')){const id=control.getAttribute('data-evaluator-id');if(id)editor.evaluatorVersions={...(editor.evaluatorVersions||{}),[id]:control.value};}
 const saved=new Map((editor.execution?.evaluationBindings||[]).map(binding=>[binding.evaluatorId,{...binding}]));
 for(const control of document.querySelectorAll('[data-ev-binding-target]')){const id=control.getAttribute('data-evaluator-id');if(!id)continue;const binding=saved.get(id)||{evaluatorId:id,target:'first_response',participation:'gate'};binding.target=control.value;saved.set(id,binding);}
 editor.execution={...(editor.execution||{}),evaluationPolicy:'all_selected',evaluationBindings:[...saved.values()].map(binding=>({...binding,participation:'gate'}))};
}
function evExperimentBindingChange(){evExperimentCaptureBindings();evExperimentClearError();}
function evExperimentEvaluatorChange(){
 const editor=evExperimentEditor;if(!editor)return;evExperimentCaptureBindings();
 editor.evaluatorIds=[...document.querySelectorAll('#ev-form input[name="evaluatorIds"]:checked')].map(control=>control.value);
 const node=document.getElementById('ev-experiment-evaluation-bindings');if(node)node.innerHTML=evExperimentBindingsMarkup(editor.evaluatorIds,editor.execution,editor.snapshot);evExperimentClearError();
}
function evExperimentModeChange(selectOrValue){
 const editor=evExperimentEditor;if(!editor)return;evExperimentCaptureBindings();
 const previousMode=editor.execution?.mode,mode=typeof selectOrValue==='string'?selectOrValue:selectOrValue?.value,simulation=mode==='scenario_simulation';
 if(previousMode==='scenario_simulation'&&!simulation)editor.scenarioEvaluationBindings=(editor.execution.evaluationBindings||[]).map(binding=>({...binding}));
 if(previousMode!=='scenario_simulation'&&simulation&&editor.scenarioEvaluationBindings){const targets=new Map(editor.scenarioEvaluationBindings.map(binding=>[binding.evaluatorId,binding.target]));editor.execution.evaluationBindings=(editor.execution.evaluationBindings||[]).map(binding=>({...binding,target:targets.get(binding.evaluatorId)||binding.target}));}
 editor.execution={...(editor.execution||{}),mode:simulation?'scenario_simulation':'single_turn'};
 const panel=document.getElementById('ev-experiment-simulation-config'),prompt=document.getElementById('ev-experiment-scenario-prompt'),maxTurns=document.getElementById('ev-experiment-max-turns');if(panel)panel.hidden=!simulation;if(prompt)prompt.required=simulation;if(maxTurns){maxTurns.required=simulation;maxTurns.disabled=!simulation;}
 const node=document.getElementById('ev-experiment-evaluation-bindings');if(node)node.innerHTML=evExperimentBindingsMarkup(editor.evaluatorIds||[],editor.execution,editor.snapshot);
 if(typeof AIOpsUnifiedBridge!=='undefined'&&typeof AIOpsUnifiedBridge.executionModeChange==='function')AIOpsUnifiedBridge.executionModeChange(editor.execution.mode);
 evExperimentClearError();
}
function evExperimentInsertScenarioTemplate(){
 const input=document.getElementById('ev-experiment-scenario-prompt');if(!input)return;
 const template=evExperimentScenarioTemplate();input.value=input.value.trim()?input.value.trim()+'\n\n'+template:template;
 if(evExperimentEditor)evExperimentEditor.execution.scenarioPrompt=input.value;input.focus();evExperimentClearError();
}
function evExperimentReadBindings(fields,evaluatorIds){
 return evaluatorIds.map(evaluatorId=>({evaluatorId,target:String(fields.get('evaluationTarget.'+evaluatorId)||'first_response'),participation:'gate'}));
}
function evExperimentEvaluatorChoices(selected=evEvaluatorDefaultIds(studio.scene),snapshot=null,config=evExperimentEditor?.execution||{}){
 const options=evEvaluatorStore().evaluators.map(e=>{const versions=evEvaluatorPublishedVersions(e);return {id:e.id,name:e.name,description:e.id+' · '+(versions.length?versions.length+' 个已发布版本':'暂无已发布版本')+(e.enabled?'':' · 已停用'+(selected.includes(e.id)?'，请取消选择':'')),disabled:(!e.enabled||!versions.length)&&!selected.includes(e.id)};});
 for(const id of selected)if(!options.some(o=>o.id===id)){const old=snapshot?.evaluators?.find(e=>e.id===id);options.push({id,name:old?old.name+' '+old.version:id,description:'已不存在，请取消选择'});}
 return `<section id="ev-experiment-evaluation-config" data-ev-experiment-evaluation-config class="ont-form-section"><h3>评估配置</h3>${evField('选用评估器',evMultiSelect({name:'evaluatorIds',label:'选择评估器',options,selected,searchable:true,searchPlaceholder:'搜索评估器名称或编号',onchange:'evExperimentEvaluatorChange()'}))}<div id="ev-experiment-evaluation-bindings">${evExperimentBindingsMarkup(selected,config,snapshot)}</div></section>`;
}
function evExperimentEvaluatorNames(experiment){return (experiment.snapshot.evaluators||[]).map(e=>e.name+' '+e.version).join('、')||'—';}
function evExperimentEvaluationConfigRead(experiment){
 const config=experiment.snapshot.execution||experiment.execution||{},bindings=config.evaluationBindings||[],allSelected=config.evaluationPolicy==='all_selected';
 return `<section class="ont-overview ev-experiment-evaluation-read"><div class="ont-section-title"><h3>评估配置</h3><button type="button" class="ont-link" onclick="evExperimentScoringSnapshot('current')">查看评分标准</button></div>${evTable(['评估器','版本','评估对象',...(allSelected?[]:['历史结果用途'])],(experiment.snapshot.evaluators||[]).map(e=>{const binding=bindings.find(b=>b.evaluatorId===e.id)||{};return `<tr><td>${esc(e.name)}</td><td>${esc(e.version)}</td><td>${evExperimentEvaluationTargetLabel(binding.target)}</td>${allSelected?'':`<td>${evExperimentEvaluationParticipationLabel(binding.participation)}</td>`}</tr>`;}))}${allSelected?'':'<p class="ev-simulation-note">此历史配置沿用保存时的判定规则。</p>'}</section>`;
}

function evExperimentEvidence(experiment,run){return run&&experiment.selectedRunId!==run.id?evExperimentRunContext(experiment,run):experiment;}
function evExperimentScoringSnapshot(scope='run'){
 const current=evExperimentCurrent();if(!current)return;const run=scope==='current'?null:evExperimentViewRun(current);if(scope!=='current'&&evExperimentRangeEmpty(current,run)){toast('当前时间范围内没有可查看的运行评分标准');return;}const experiment=evExperimentEvidence(current,run);
 const body=(experiment.snapshot.evaluators||[]).map(e=>{const binding=(experiment.snapshot.execution?.evaluationBindings||[]).find(b=>b.evaluatorId===e.id)||{};return `<section class="ont-form-section ev-experiment-report ev-scoring-standards"><h3>${esc(e.name)} <span class="ont-badge">${esc(e.version)}</span></h3><p>${esc(e.description)}</p><p class="ev-simulation-note">${evExperimentEvaluationTargetLabel(binding.target)}${experiment.snapshot.execution?.evaluationPolicy==='all_selected'?'':' · '+evExperimentEvaluationParticipationLabel(binding.participation)}</p><p class="ev-note">每个评分项须分别达到自身通过分数；权重仅用于汇总得分。</p>${evTable(['评分项','评分标准','权重','通过分数'],e.criteria.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.description)}</td><td>${c.weight}</td><td>${c.passScore} / 100</td></tr>`))}</section>`;}).join('');
 evModal('查看实验评分标准',`<p class="ev-note">${run?'以下为所选运行 '+esc(run.id)+' 保存的评分标准快照。':'以下为当前实验配置保存的评分标准快照。'}</p>${body}`);
}


function evExperimentScoringResults(result){
 const evaluations=result.evaluations||[];
 if(!evaluations.length)return `<section class="ont-form-section ev-result-evaluations"><header class="ev-result-evaluations-heading"><h3>评估结果</h3><span>0 个评估器</span></header><div class="ev-result-scores-empty"><span aria-hidden="true">◇</span><b>暂无评估结果</b><p class="ev-note">${['运行失败','已跳过'].includes(result.status)?'该用例未产生可评分的输出，无评估器分数。':'尚未产生评估器分数。'}</p></div></section>`;
 return `<section class="ont-form-section ev-result-evaluations"><header class="ev-result-evaluations-heading"><h3>评估结果</h3><span>${evaluations.length} 个评估器</span></header>${evaluations.map((e,index)=>{
  const annotation=evExperimentResultAnnotation(result.id,e.evaluatorId),tipId='ev-evaluator-tip-'+index,criteria=e.criteria||[],standards=criteria.map(c=>`${c.name}：${c.description||'—'}；权重 ${c.weight}；通过分数 ${c.passScore} / 100`).join('\n');
  return `<article class="ev-result-evaluation"><div class="ev-result-evaluation-head"><span class="ev-result-evaluator-symbol" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><div class="ev-result-hover"><button type="button" class="ont-link ev-result-evaluator-link" aria-describedby="${tipId}" title="${esc(e.version+'\n'+standards)}" onclick="evExperimentResultEvaluator(${esc(JSON.stringify(result.id))},${esc(JSON.stringify(e.evaluatorId))})">${esc(e.name)}</button><div id="${tipId}" class="ev-result-tooltip" role="tooltip"><b>${esc(e.name)} · ${esc(e.version)}</b>${criteria.map(c=>`<div><strong>${esc(c.name)}</strong><p>评分标准：${esc(c.description||'—')}</p><p>权重：${esc(c.weight)} · 通过分数：${esc(c.passScore)} / 100</p></div>`).join('')}</div></div><span class="ev-result-score" aria-label="得分"><small class="ev-result-total-label">总分</small>${evExperimentResultMetric(e.score)===null?'—':Number(e.score).toFixed(1)}<small> / 100</small></span></div><p class="ev-result-evaluation-scope">${evExperimentEvaluationTargetLabel(e.target||e.evaluationTarget)}${result.evaluationPolicy==='all_selected'?'':' · '+evExperimentEvaluationParticipationLabel(e.participation||e.role)}</p>${criteria.length?`<dl class="ev-result-criteria" aria-label="评分项得分">${criteria.map(criterion=>`<div><dt>${esc(criterion.name)}</dt><dd class="${criterion.passed===false?'is-failed':''}">${evExperimentResultMetric(criterion.score)===null?'—':Number(criterion.score).toFixed(1)}<small> 分</small></dd></div>`).join('')}</dl>`:''}<div class="ev-result-reason"><span>评分依据</span><p>${esc(e.reason||'暂无评分依据')}</p></div>${evExperimentAnnotationSummary(annotation)}${result.isValidation?'':`<footer>${evAnnotationButton(`evExperimentAnnotateResult(${JSON.stringify(result.id)},${JSON.stringify(e.evaluatorId)})`,annotation?'编辑评估结果标注':'标注评估结果',!!annotation)}<span>${annotation?'已标注':'未标注'}</span></footer>`}</article>`;
 }).join('')}</section>`;
}


function evExperimentEvaluatorReport(experiment,run){
 experiment=evExperimentEvidence(experiment,run);
 const rows=(experiment.snapshot.evaluators||[]).map(e=>{const values=run.results.flatMap(r=>r.evaluations||[]).filter(v=>v.evaluatorId===e.id&&v.version===e.version),passed=values.filter(v=>v.passed).length,average=values.length?values.reduce((total,v)=>total+v.score,0)/values.length:null;return `<tr><td>${esc(e.name)}</td><td>${esc(e.version)}</td><td>${values.length}</td><td>${average===null?'—':average.toFixed(1)}</td><td>全部评分项分别达标</td><td>${passed}</td><td>${values.length-passed}</td></tr>`;});
 return `<section class="ont-overview"><div class="ont-section-title"><h3>评估结果</h3><button type="button" class="ont-link" onclick="evExperimentScoringSnapshot()">查看评分标准</button></div><p class="ev-note">按所选运行保存的评估器版本统计；${experiment.snapshot.execution?.evaluationPolicy==='all_selected'?'全部所选评估器通过，用例才通过。':'汇总分不抵消未达标的评分项。'}运行失败与跳过项无分数。</p>${evTable(['评估器','版本','已评分执行','平均汇总分','通过条件','通过','未通过'],rows)}</section>`;
}

function evNewExperiment(){return evExperimentForm();}
function evEditExperiment(id){
 const experiment=evExperimentGet(id);if(!experiment||experiment.scene!==studio.scene){toast('评测实验不属于当前场景或已不存在');return false;}
 if(['运行中','已暂停'].includes(experiment.status)||experiment.runs.some(r=>['运行中','已暂停'].includes(r.status))){toast('实验运行中，请先停止运行后再编辑');return false;}
 return evExperimentForm(experiment);
}
function evExperimentForm(experiment=null){
 evExperimentUI();
 const editing=!!experiment,agentId=experiment?.agentId||'',version=experiment?.version||'',suiteIds=[...(experiment?.suiteIds||[experiment?.suiteId].filter(Boolean))],selectedEvaluators=editing?[...(experiment.evaluatorIds||[])]:evEvaluatorDefaultIds(studio.scene),config={concurrency:4,caseRuns:1,fullRuns:1,modelId:'mock-eval-balanced',mcpIds:[],mode:'single_turn',scenarioPrompt:'',maxTurns:5,...(experiment?.execution||experiment?.snapshot?.execution||{})};
 config.evaluationPolicy='all_selected';config.evaluationBindings=(config.evaluationBindings||[]).map(binding=>({...binding,participation:'gate'}));
 evExperimentEditor={scene:studio.scene,id:experiment?.id||'',name:experiment?.name||'',agentId,version,suiteId:suiteIds[0]||'',suiteIds,evaluatorIds:[...selectedEvaluators],evaluatorVersions:{...(experiment?.evaluatorVersions||{}),...Object.fromEntries(selectedEvaluators.map(id=>{const old=experiment?.snapshot?.evaluators?.find(item=>item.id===id),record=evEvaluatorStore().evaluators.find(item=>item.id===id);return [id,experiment?.evaluatorVersions?.[id]||old?.sourceVersion||old?.version||evEvaluatorPublishedVersions(record)[0]?.version||''];}))},execution:config,snapshot:experiment?.snapshot||null};
 const agents=evAgents(),models=evEvaluationModels(),mcps=evExperimentMcps().map(m=>({id:m.id,name:m.name,description:m.description})),simulation=config.mode==='scenario_simulation';
 for(const id of config.mcpIds||[])if(!mcps.some(m=>m.id===id)){const old=experiment?.snapshot.mcps?.find(m=>m.id===id);mcps.push({id,name:old?.name||id,description:'已不可用，请取消选择'});}
 const unavailableAgent=agentId&&!agents.some(a=>a.id===agentId)?`<option value="${esc(agentId)}" selected>${esc(experiment.agentName)} · 已不可用，请重新选择</option>`:'',versionOptions=evExperimentVersionOptions(agentId,version)+(version&&!evAgentVersions(agentId).some(v=>v.id===version)?`<option value="${esc(version)}" selected>原版本已不可用，请重新选择</option>`:'');
 const basic=`<section class="ont-form-section"><h3>基本信息</h3><div class="ont-grid">${evField('所属 Agent',`<select id="ev-experiment-agent" name="agentId" aria-label="实验所属 Agent" required onchange="evExperimentAgentChange(this)"><option value="">请选择 Agent</option>${unavailableAgent}${agents.map(a=>`<option value="${esc(a.id)}" ${a.id===agentId?'selected':''}>${esc(a.name)}${a.scope==='application'?' · 所属应用':''}</option>`).join('')}</select>`)}${evField('Agent 版本',`<select id="ev-experiment-version" name="version" aria-label="实验 Agent 版本" required ${agentId?'':'disabled'} onchange="evExperimentVersionChange(this)">${versionOptions}</select>`)}<div class="ont-wide">${evField('实验名称',`<input id="ev-experiment-name" name="name" aria-label="评测实验名称" value="${esc(experiment?.name||'')}" required maxlength="100" placeholder="请输入实验名称" oninput="if(evExperimentEditor)evExperimentEditor.name=this.value">`)}</div><div class="ont-wide">${evField('评测集',`<div id="ev-experiment-suite">${evExperimentSuiteOptions(agentId,version,suiteIds)}</div>`,'可多选该 Agent 的评测集；重复用例按编号合并。')}</div></div></section>`;
 const mode=evField('执行方式',`<select id="ev-experiment-mode" name="mode" aria-label="实验执行方式" onchange="evExperimentModeChange(this)"><option value="single_turn" ${simulation?'':'selected'}>单轮执行</option><option value="scenario_simulation" ${simulation?'selected':''}>多轮执行</option></select>`);
 const simulationConfig=`<div id="ev-experiment-simulation-config" class="ev-experiment-simulation-config" ${simulation?'':'hidden'}><div class="ev-experiment-scenario-heading"><label for="ev-experiment-scenario-prompt">场景提示词</label><button type="button" class="ont-link" onclick="evExperimentInsertScenarioTemplate()">插入模板</button></div><textarea id="ev-experiment-scenario-prompt" name="scenarioPrompt" aria-label="场景提示词" rows="10" maxlength="12000" ${simulation?'required':''} placeholder="描述当前场景、用户画像、已知事实及模拟回复规则" oninput="if(evExperimentEditor)evExperimentEditor.execution.scenarioPrompt=this.value;evExperimentClearError()">${esc(config.scenarioPrompt)}</textarea><p class="ev-simulation-note">全部用例使用同一模拟规则，以各自输入开始独立对话。仅使用已提供的事实，未知信息不编造；预期输出只供评分，不提供给模拟用户。</p><div class="ont-grid">${evField('最大模拟轮次',`<input id="ev-experiment-max-turns" name="maxTurns" aria-label="最大模拟轮次" type="number" min="1" max="20" value="${esc(config.maxTurns)}" ${simulation?'required':'disabled'} oninput="if(evExperimentEditor)evExperimentEditor.execution.maxTurns=this.value;evExperimentClearError()">`)}</div><p class="ev-simulation-note">含首轮；1 轮 = 用户消息及对应 Agent 回复，工具调用不计轮次。最多 20 轮，目标达成可提前结束。</p></div>`;
 const execution=`<section class="ont-form-section"><h3>执行配置</h3><div class="ont-grid"><div class="ont-wide">${mode}</div></div>${simulationConfig}<p class="ev-note">每次全量评测生成独立评测记录；同一用例的每次执行都启动独立对话，使用相同输入且不继承上次上下文。例如 10 条启用用例，每条执行 3 次，全量评测 2 次，将生成 2 条记录，每条包含 30 段独立对话。</p><div class="ont-grid">${evField('执行并发数',`<input name="concurrency" aria-label="执行并发数" type="number" min="1" max="6" value="${esc(config.concurrency)}" required>`,'同时执行的独立对话数，最多 6。')}${evField('全量评测次数',`<input name="fullRuns" aria-label="全量评测次数" type="number" min="1" max="5" value="${esc(evExperimentFullRuns(config))}" required>`,'每次生成独立评测记录和报告，按顺序执行。')}${evField('每个用例执行次数',`<input name="caseRuns" aria-label="每个用例执行次数" type="number" min="1" max="5" value="${esc(evExperimentCaseRuns(config))}" required>`,'使用相同输入启动多段独立对话，用于观察稳定性。')}${evField('评测模型',`<select name="modelId" aria-label="评测模型">${models.map(m=>`<option value="${esc(m.id)}" ${m.id===config.modelId?'selected':''}>${esc(m.name)}</option>`).join('')}${models.some(m=>m.id===config.modelId)?'':`<option value="${esc(config.modelId)}" selected>原模型已不可用，请重新选择</option>`}</select>`)}<div class="ont-wide">${evField('选用 MCP',evMultiSelect({name:'mcpIds',label:'选择 MCP',options:mcps,selected:config.mcpIds||[],onchange:'evExperimentClearError()'}),'仅可选择当前场景或共享 MCP。',false)}</div></div></section>`;
 const body=`<input type="hidden" name="scene" value="${esc(studio.scene)}"><input type="hidden" name="experimentId" value="${esc(experiment?.id||'')}">${basic}${execution}${evExperimentEvaluatorChoices(selectedEvaluators,experiment?.snapshot,config)}<p id="ev-experiment-form-error" class="ont-error" role="alert"></p>`;
 evModal(editing?'编辑评测实验':'新建评测实验',body,`<button type="submit" class="ont-button strong">${editing?'保存修改':'创建实验'}</button>`,'evSubmitExperiment(this)');return true;
}

function evExperimentFormControl(id,selectOrString){const control=typeof selectOrString==='string'?document.getElementById(id):selectOrString;return {control,value:typeof selectOrString==='string'?selectOrString:selectOrString?.value||''};}

function evExperimentAgentChange(selectOrString){
 const editor=evExperimentEditor;if(!editor||editor.scene!==studio.scene)return;const {control,value}=evExperimentFormControl('ev-experiment-agent',selectOrString),agentId=evAgents().some(a=>a.id===value)?value:'';if(control)control.value=agentId;if(editor.agentId===agentId)return;
 Object.assign(editor,{agentId,version:'',suiteId:'',suiteIds:[]});const version=document.getElementById('ev-experiment-version'),suite=document.getElementById('ev-experiment-suite');if(version){version.innerHTML=evExperimentVersionOptions(agentId);version.value='';version.disabled=!agentId;}if(suite)suite.innerHTML=evExperimentSuiteOptions(agentId,'');evExperimentClearError();
}


function evExperimentVersionChange(selectOrString){
 const editor=evExperimentEditor;if(!editor||editor.scene!==studio.scene)return;const {control,value}=evExperimentFormControl('ev-experiment-version',selectOrString),version=evAgentVersions(editor.agentId).some(v=>v.id===value)?value:'';if(control)control.value=version;if(editor.version===version)return;
 Object.assign(editor,{version,suiteId:'',suiteIds:[]});const suite=document.getElementById('ev-experiment-suite');if(suite)suite.innerHTML=evExperimentSuiteOptions(editor.agentId,version);evExperimentClearError();
}


function evExperimentSuiteChange(value){
 const editor=evExperimentEditor;if(!editor||editor.scene!==studio.scene)return;
 const selected=Array.isArray(value)?value:typeof value==='string'?[value]:[...document.querySelectorAll('#ev-experiment-suite input[name="suiteIds"]:checked')].map(el=>el.value),allowed=evExperimentEligibleSuites(editor.agentId).filter(s=>evExperimentSuiteCount(s).enabled).map(s=>s.id);
 editor.suiteIds=editor.version?[...new Set(selected.filter(id=>allowed.includes(id)))]:[];editor.suiteId=editor.suiteIds[0]||'';evExperimentClearError();
}

function evExperimentClearError(){const error=document.getElementById('ev-experiment-form-error');if(error)error.textContent='';}

function evSubmitExperiment(form){
 const f=new FormData(form),name=String(f.get('name')||'').trim(),id=String(f.get('experimentId')||evExperimentEditor?.id||'');
 try{if(f.get('scene')&&f.get('scene')!==studio.scene)throw Error('当前场景已变更，请重新打开实验表单');if(!name)throw Error('请输入实验名称');if(id){const current=evExperimentGet(id);if(!current||current.scene!==studio.scene)throw Error('评测实验不属于当前场景或已不存在');if(current.status==='运行中'||current.runs.some(r=>r.status==='运行中'))throw Error('实验运行中，请先停止运行后再编辑');}
 const selected=f.getAll('suiteIds').map(String),suiteIds=selected.length?selected:f.get('suiteId')?[String(f.get('suiteId'))]:[],evaluatorIds=f.getAll('evaluatorIds').map(String),mode=String(f.get('mode')||'single_turn'),savedMax=Number(evExperimentEditor?.execution?.maxTurns),maxTurns=f.get('maxTurns')??(Number.isInteger(savedMax)&&savedMax>=1&&savedMax<=20?savedMax:5),fields={name,agentId:String(f.get('agentId')||''),version:String(f.get('version')||''),suiteIds,evaluatorIds,execution:{evaluationPolicy:'all_selected',concurrency:f.get('concurrency')??4,caseRuns:f.get('caseRuns')??f.get('times')??1,fullRuns:f.get('fullRuns')??f.get('rounds')??1,modelId:f.get('modelId')??'mock-eval-balanced',mcpIds:f.getAll('mcpIds').map(String),mode,scenarioPrompt:String(f.get('scenarioPrompt')||''),maxTurns,evaluationBindings:evExperimentReadBindings(f,evaluatorIds)}};const evaluatorVersions={};for(const evaluatorId of evaluatorIds){const selectedVersion=f.get('evaluatorVersion.'+evaluatorId);if(selectedVersion!==null&&selectedVersion!==undefined)evaluatorVersions[evaluatorId]=String(selectedVersion);}if(Object.keys(evaluatorVersions).length)fields.evaluatorVersions=evaluatorVersions;const experiment=id?evUpdateExperiment(id,fields):evCreateExperiment(fields);
 evExperimentEditor=null;evCloseModal();evExperimentOpen(experiment.id);toast(id?'实验配置已保存，历史运行记录保留':'实验已创建，点击运行开始本地 Mock 评测');return experiment;}
 catch(error){const message=error.message||'保存实验失败',node=document.getElementById('ev-experiment-form-error');if(node)node.textContent=message;toast(message);return false;}
}

function evExperimentStart(id){const experiment=evExperimentGet(id);if(!experiment||experiment.scene!==studio.scene){toast('评测实验不属于当前场景');return false;}try{const run=evRunExperiment(id);Object.assign(evExperimentState,{scene:studio.scene,id,runId:run.id,supplementId:'',tab:'用例结果',resultSearch:''});evState.tab='评测实验';evClearFilters('experimentResult');evRender();toast('已创建 '+evExperimentFullRuns(experiment.execution)+' 条独立评测记录');return run;}catch(error){toast(error.message||'无法开始实验');return false;}}
function evExperimentStop(id){const experiment=evExperimentGet(id);if(!experiment||experiment.scene!==studio.scene)return false;try{const result=evStopExperiment(id);evExperimentRefresh(studio.scene,id,evExperimentState.runId);toast('实验已停止，已完成结果和历史运行记录保留');return result;}catch(error){toast(error.message||'无法停止实验');return false;}}
function evExperimentSelectRun(runId){
 const experiment=evExperimentCurrent(),run=experiment&&evExperimentExecutionGet(experiment,runId);if(!run)return;
 const record=evExperimentRecordFor(experiment,run);evExperimentState.runId=record.id;evExperimentState.supplementId=run.kind==='supplement'?run.id:'';evExperimentState.resultSearch='';evClearFilters('experimentResult');
 const search=document.querySelector('#ev-experiment-results-table input[aria-label="搜索实验用例结果"]');if(search)search.value='';
 document.querySelectorAll('#ev-experiment-results-table .ev-column-filter input').forEach(input=>input.checked=false);
 evExperimentRefreshDetail(experiment);evExperimentRefreshHistorySelector(experiment,evExperimentSelectedRun(experiment),true);
}
function evExperimentSelectSupplement(id){const experiment=evExperimentCurrent(),record=evExperimentSelectedRecord(experiment);if(!record||id&&!record.supplements?.some(run=>run.id===id))return false;evExperimentSelectRun(id||record.id);return true;}

function evExperimentSelectTab(tab){if(!['用例结果','问题优化','实验报告','实验配置'].includes(tab))return;evExperimentState.tab=tab;evRender();}

function evExperimentDetail(experiment){
 const run=evExperimentViewRun(experiment);
 return `<div id="ev-experiment-dashboard">${evExperimentDashboard(experiment,run)}</div><div id="ev-experiment-detail-top" data-run-id="${esc(run?.id||'')}">${evExperimentDetailTop(experiment,run)}</div><div id="ev-experiment-detail-content">${evExperimentDetailContent(experiment,run)}</div>`;
}
function evExperimentDetailContent(experiment,run){if(evExperimentState.tab==='问题优化')return evExperimentIssuesView(experiment,run);if(evExperimentRangeEmpty(experiment,run))return evExperimentEmptyRun(experiment);return evExperimentState.tab==='实验配置'?'':evExperimentState.tab==='实验报告'?evExperimentReport(experiment,run):evExperimentResults(experiment,run);}
function evExperimentFunctionButtons(experiment){
 const tab=evExperimentState.tab,active=evExperimentActiveExecution(experiment),run=evExperimentViewRun(experiment);
 if(tab==='实验配置')return `<button type="button" class="ont-button" onclick="evEditExperiment('${experiment.id}')" ${active?'disabled aria-disabled="true" title="请先完成当前执行后再编辑"':''}>编辑</button>`;
 if(tab==='实验报告')return `<button type="button" class="ont-button" onclick="evExperimentExportReport('${experiment.id}','${run?.id||''}')" ${run?'':'disabled aria-disabled="true" title="执行实验后可导出报告"'}>导出</button>`;
 if(tab==='问题优化')return (typeof evExperimentIssueRepairControls==='function'?evExperimentIssueRepairControls(experiment):'')+(typeof evExperimentIssueValidationControls==='function'?evExperimentIssueValidationControls(experiment):'');
 if(tab!=='用例结果')return '';
 const canAnalyze=run&&['已完成','部分失败'].includes(run.status)&&run.results.some(result=>['通过','未通过','运行失败'].includes(result.status));
 const analysisButton=`<button type="button" class="ont-button ev-experiment-analyze" onclick="evExperimentAnalyze('${experiment.id}')" ${canAnalyze?'':'disabled aria-disabled="true" title="执行完成后可分析所选评测记录"'}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m10 3 1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8L10 3Z"/><path d="m16 1 .7 2.3L19 4l-2.3.7L16 7l-.7-2.3L13 4l2.3-.7L16 1Z"/></svg>结果分析</button>`;
 if(active?.kind==='validation')return analysisButton+`<button type="button" class="ont-button" disabled>问题验证中</button>`;
 if(active)return analysisButton+ `<button type="button" class="ont-button" onclick="evExperiment${active.status==='已暂停'?'Resume':'Pause'}('${experiment.id}')">${active.status==='已暂停'?'继续执行':'暂停'}</button>`;
 if(!experiment.runs.some(item=>item.configurationRevision===experiment.configurationRevision))return analysisButton+`<button type="button" class="ont-button strong" onclick="evExperimentStart('${experiment.id}')">执行</button>`;
 const failed=run?.status==='部分失败'&&run.results.some(result=>['未通过','运行失败'].includes(result.status));
 return analysisButton+`<details class="ev-period-selector ev-experiment-rerun" onkeydown="evDashboardMenuKey(event,this)"><summary class="ont-button strong" aria-label="重新执行">重新执行 ${evDropdownArrow()}</summary><div class="ev-period-menu" data-ev-popover role="menu"><button type="button" role="menuitem" ${failed?`onclick="evExperimentRetry('${experiment.id}','${run.id}')"`:'disabled aria-disabled="true"'} title="为所选结果中的失败用例创建补跑，保留首次全量结果">失败用例补跑</button><button type="button" role="menuitem" onclick="evExperimentStart('${experiment.id}')" title="按全量评测次数生成独立评测记录">全量评测</button></div></details>`;
}
function evExperimentHeaderControls(experiment){return `<div class="ev-experiment-functions" role="group" aria-label="实验功能按钮">${evExperimentFunctionButtons(experiment)}</div>`;}
function evExperimentDetailActions(experiment){return `<div id="ev-experiment-run-controls" data-status="${experiment.status}">${evExperimentHeaderControls(experiment)}</div>`;}

function evExperimentDetailTabs(experiment){
 const run=evExperimentSelectedRecord(experiment),count=evExperimentDisplayResults(experiment,run).length,issues=evExperimentIssueScopeIssues(experiment).length;
 return `<nav class="ont-tabs" id="ev-experiment-detail-tabs" aria-label="评测实验详情页签">${['用例结果','问题优化','实验报告','实验配置'].map(tab=>`<button type="button" class="${evExperimentState.tab===tab?'active':''}" onclick="evExperimentSelectTab('${tab}')">${tab}${tab==='用例结果'?`<span class="ont-count" id="ev-experiment-result-count">${count}</span>`:tab==='问题优化'?`<span class="ont-count" id="ev-experiment-issue-count">${issues}</span>`:''}</button>`).join('')}</nav>`;
}
function evExperimentHistorical(experiment,run){return !!run&&(experiment.isHistorical===true||evExperimentRunIsHistorical(experiment,run));}
function evExperimentDetailTop(experiment,run){
 if(evExperimentState.tab!=='实验配置')return '';
 run=null;
 const config=experiment.snapshot.execution||experiment.execution||{},suites=experiment.snapshot.suites||[experiment.snapshot.suite];
 return `<section class="ont-overview"><div class="ont-section-title"><h3>基本信息</h3><span class="ont-badge">${run?(evExperimentHistorical(experiment,run)?'历史运行 · ':'')+esc(run.id):'当前实验配置'}</span></div><dl class="ont-mapping"><div><dt>实验编号</dt><dd>${esc(experiment.id)}</dd></div><div><dt>Agent / 版本</dt><dd>${esc(experiment.agentName)} / ${esc(experiment.version)}</dd></div><div><dt>状态</dt><dd id="ev-experiment-overview-status">${evExperimentStatus(experiment.status)}</dd></div><div><dt>创建时间</dt><dd>${esc(experiment.createdAt)}</dd></div><div><dt>评测集快照</dt><dd>${evExperimentSuiteLinks(experiment)}</dd></div><div><dt>去重用例数</dt><dd>${experiment.snapshot.cases.length}</dd></div><div><dt>业务任务快照</dt><dd>${esc(experiment.snapshot.tasks.map(t=>t.name+' '+t.version).join('、'))}</dd></div></dl></section><section class="ont-overview"><div class="ont-section-title"><h3>执行配置</h3></div><dl class="ont-mapping"><div><dt>执行方式</dt><dd>${config.mode==='scenario_simulation'?'多轮执行':'单轮执行'}</dd></div>${config.mode==='scenario_simulation'?`<div><dt>最大模拟轮次</dt><dd>${Number(config.maxTurns)||5} 轮（含首轮）</dd></div>`:''}<div><dt>执行并发数</dt><dd>${config.concurrency||4}</dd></div><div><dt>每个用例执行次数</dt><dd>${evExperimentCaseRuns(config)}</dd></div><div><dt>全量评测次数</dt><dd>${evExperimentFullRuns(config)}</dd></div><div><dt>评测模型</dt><dd>${esc(experiment.snapshot.model?.name||'通用评测模型 · Mock')}</dd></div><div><dt>MCP 快照</dt><dd>${esc((experiment.snapshot.mcps||[]).map(m=>m.name).join('、')||'—')}</dd></div></dl>${config.mode==='scenario_simulation'?`<div class="ev-experiment-scenario-read"><b>场景提示词快照</b><pre>${esc(config.scenarioPrompt||'—')}</pre></div>`:''}</section>${evExperimentEvaluationConfigRead(experiment)}`;
}

function evExperimentResults(experiment,run){
  return `<div id="ev-experiment-results-table">${evExperimentResultTable(experiment,run)}</div>`;
}
function evExperimentDisplayResults(experiment,run){if(!run&&evExperimentState.id===experiment.id&&evExperimentRangeEmpty(experiment,run))return [];return run?run.results:evExperimentResultRows(experiment,experiment.id+'-PREVIEW').map(r=>({...r,status:r.enabled?'待运行':'已停用'}));}
function evExperimentCaseActions(experiment,run,result,attempts=[result],key=''){
 const current=evExperimentGet(experiment.id)||experiment,active=!!evExperimentActiveExecution(current),sourceCase=run?.snapshot?.cases?.find(item=>item.id===result.caseId),eligible=!!sourceCase&&sourceCase.enabled!==false&&['已完成','部分失败'].includes(run.status)&&attempts.some(item=>['通过','未通过','运行失败'].includes(item.status));
 const reason=active?'请先完成当前执行':!run?'执行后可重跑':!eligible?'该用例没有可重跑的已执行结果':'';
 const view=`<button type="button" class="ont-link" aria-label="查看结果详情 ${esc(result.caseId)}" onclick="evExperimentCaseDetail('${result.id}')">查看结果详情</button>`;
 const more=[{label:'补跑',ariaLabel:'补跑用例 '+result.caseId,code:`evExperimentRetryCase('${experiment.id}','${run?.id||''}','${result.caseId}')`,disabled:!!reason,title:reason}];
 if(attempts.length>1)more.push({label:evExperimentExpanded.has(key)?'收起执行结果':'展开执行结果',code:`evExperimentToggleAttempts('${key}')`});
 const menu=evMore(more).replace('aria-label="更多操作"',`aria-label="用例 ${esc(result.caseId)} 的更多操作"`);
 return `<div class="ev-actions ev-case-actions">${view}${menu}</div>`;
}

function evExperimentResultPhase(results,run){
 if(!run||!['运行中','排队中'].includes(run.status))return '';
 return results.some(result=>result.status==='运行中')?'running':results.some(result=>result.status==='待运行')?'queued':'';
}
function evExperimentResultActivity(results,run){
 const phase=evExperimentResultPhase(results,run);if(!phase)return '';
 return `<span class="ev-row-activity is-${phase}" role="status"><i class="${phase==='running'?'ev-row-spinner':'ev-row-waiting'}" aria-hidden="true"></i>${phase==='running'?'执行中':'待运行'}</span>`;
}
function evExperimentResultRowAttributes(results,run){
 const phase=evExperimentResultPhase(results,run);return phase?` data-execution-phase="${phase}" aria-busy="true"`:'';
}

function evExperimentResultTable(experiment,run,contentOnly=false){
 run=evExperimentRecordFor(experiment,run)||run;
 experiment=evExperimentEvidence(experiment,run);
 const state=evExperimentState,q=state.resultSearch.trim().toLowerCase(),headers=['用例编号','名称',evFilterHeader('状态','experimentResult','status',['待运行','运行中','通过','未通过','运行失败','已跳过','已停用'].map(v=>({id:v,name:v}))),'用例执行','来源评测集','输入','预期结果','实际结果','耗时','Tokens','操作'];
 const results=evExperimentDisplayResults(experiment,run).filter(r=>evFilterMatch('experimentResult','status',r.status)&&(!q||[r.id,r.caseId,r.name,r.input,r.expected,r.actual,...(r.tags||[])].join(' ').toLowerCase().includes(q)));
 const groups=new Map();for(const r of evExperimentDisplayResults(experiment,run)){if(!groups.has(r.caseId))groups.set(r.caseId,[]);groups.get(r.caseId).push(r);}
 const visible=new Set(results.map(r=>r.caseId)),rows=[];
 for(const [caseId,attempts] of [...groups].sort(([a],[b])=>a.localeCompare(b))){if(!visible.has(caseId))continue;const r=attempts.at(-1),phase=evExperimentResultPhase(attempts,run),multiple=attempts.length>1,key=(run?.id||experiment.id)+':'+caseId,expanded=evExperimentExpanded.has(key),s=evExperimentSummary({results:attempts});
 if(multiple)rows.push(`<tr class="ev-case-group ev-batch-row${phase?' is-'+phase:''}" data-case-id="${esc(caseId)}"${evExperimentResultRowAttributes(attempts,run)}><td><span class="ont-id">${esc(caseId)}</span></td><td><button type="button" class="ont-link" aria-expanded="${expanded}" onclick="evExperimentToggleAttempts('${key}')">${expanded?'▾':'▸'} ${esc(r.name)}</button> <span class="ont-badge">${esc(r.version)}</span></td><td>${evExperimentResultActivity(attempts,run)}${phase?'<br>':''}${s.passed} 通过 / ${s.failed+s.errors} 失败<br><small class="muted">${s.finished} / ${s.total} 已处理</small></td><td><button type="button" class="ont-link" onclick="evExperimentToggleAttempts('${key}')">${attempts.length} 次结果 ${expanded?'收起':'展开'}</button></td><td>${evExperimentSuiteLinks(experiment,r.suiteIds||[])}</td><td>${evExperimentText(r.input)}</td><td>${evExperimentText(r.expected)}</td><td>${evExperimentOutputPreview(attempts)}</td><td>${s.durationMs?evExperimentDuration(s.durationMs):'—'}</td><td>${s.tokens||'—'}</td><td>${evExperimentCaseActions(experiment,run,r,attempts,key)}</td></tr>`);
 if(!multiple||expanded)for(const item of attempts.filter(a=>results.some(r=>r.id===a.id))){rows.push(`<tr class="${multiple?'ev-attempt-row ':''}ev-batch-row${evExperimentResultPhase([item],run)?' is-'+evExperimentResultPhase([item],run):''}" data-result-id="${esc(item.id)}"${evExperimentResultRowAttributes([item],run)}><td><span class="ont-id">${multiple?'↳ ':''}${esc(item.caseId)}</span></td><td><button type="button" class="ont-link ev-name-link" onclick="evExperimentCaseDetail('${item.id}')">${multiple?'用例执行 '+evExperimentAttemptNumber(item)+' / '+evExperimentCaseRepeatCount(experiment):esc(item.name)}</button></td><td>${evExperimentResultActivity([item],run)||evExperimentStatus(item.status)}</td><td>第 ${evExperimentAttemptNumber(item)} / ${evExperimentCaseRepeatCount(experiment)} 次</td><td>${evExperimentSuiteLinks(experiment,item.suiteIds||[])}</td><td>${evExperimentText(item.input)}</td><td>${evExperimentText(item.expected)}</td><td>${evExperimentOutputPreview(item)}</td><td>${item.durationMs?evExperimentDuration(item.durationMs):'—'}</td><td>${item.tokens||'—'}</td><td>${multiple?`<button type="button" class="ont-link" onclick="evExperimentCaseDetail('${item.id}')">查看结果详情</button>`:evExperimentCaseActions(experiment,run,item)}</td></tr>`);}
 }
 const toolbar=`<label class="ont-search"><input aria-label="搜索实验用例结果" placeholder="搜索用例编号、名称或内容" value="${esc(state.resultSearch)}" oninput="evExperimentState.resultSearch=this.value;evExperimentRefreshResults()"><svg viewBox="0 0 18 18"><circle cx="7" cy="7" r="5"/><path d="m11 11 4 4"/></svg></label><span class="muted">按用例汇总，每次执行是一段独立对话</span>`;

 const markup=contentOnly?evTableContent(headers,rows,'<div class="ont-empty">暂无匹配的用例结果</div>'):evTable(headers,rows,'<div class="ont-empty">暂无匹配的用例结果</div>',toolbar);
 return markup.replace(`<span class="ev-total">共 ${rows.length} 条</span>`,`<span class="ev-total">共 ${visible.size} 条用例 · ${results.length} 次结果</span>`);
}


function evExperimentRefreshResults(){
 evExperimentCloseOutput();
 const experiment=evExperimentCurrent(),run=experiment&&evExperimentSelectedRecord(experiment),node=document.getElementById('ev-experiment-results-table');if(!experiment||!node)return;
 const markup=evExperimentResultTable(experiment,run,true),content=node.querySelector?.('.ev-table-content');
 if(content&&document.createElement){const staging=document.createElement('div');staging.innerHTML=markup;const body=content.querySelector('tbody'),next=staging.querySelector('tbody');if(body&&next){const scroll=content.querySelector('.ev-table-scroll'),left=scroll?.scrollLeft||0,top=scroll?.scrollTop||0;evExperimentReplaceContent(body,next.innerHTML);const footer=content.querySelector('.ev-table-footer'),nextFooter=staging.querySelector('.ev-table-footer');if(footer&&nextFooter)footer.innerHTML=nextFooter.innerHTML;if(scroll){scroll.scrollLeft=left;scroll.scrollTop=top;}return;}}
 if(content)evExperimentReplaceContent(content,markup);else evExperimentReplaceContent(node,evExperimentResultTable(experiment,run));
}

function evExperimentDimensionRows(run){
  const groups=new Map();for(const result of run.results)for(const dimension of result.dimensions||[]){if(typeof dimension.passed!=='boolean')continue;const key=(dimension.taskId||dimension.taskName)+'\u0000'+dimension.name;if(!groups.has(key))groups.set(key,{taskId:dimension.taskId,taskName:dimension.taskName,name:dimension.name,total:0,passed:0,values:new Set()});const g=groups.get(key);g.total++;if(dimension.passed)g.passed++;g.values.add(String(dimension.value??'—'));}
  return [...groups.values()];
}
function evExperimentReport(experiment,run){return evExperimentReportView(experiment,run);}
function evExperimentReportBody(experiment,run){
  if(!run)return '<div class="ont-empty">尚无实验报告，执行后自动生成。</div>';
  const historical=evExperimentHistorical(experiment,run);experiment=evExperimentEvidence(experiment,run);
  const s=evExperimentSummary(run),dimensions=evExperimentDimensionRows(run),failures=run.results.filter(r=>['未通过','运行失败'].includes(r.status)),conclusion=run.status==='运行中'?`实验正在运行，已处理 ${s.finished} / ${s.total} 条。当前统计会随结果更新。`:run.status==='已停止'?`本次执行已中断：已执行 ${s.executed} 条，跳过 ${s.skipped} 条；报告仅覆盖已记录的结果。`:run.status==='已暂停'?`实验已暂停：已执行 ${s.executed} 条，跳过 ${s.skipped} 条；已完成的结果保留。`:`实验已完成：${s.passed} 条通过，${s.failed} 条未通过，${s.errors} 条运行失败，${s.skipped} 条跳过。`;
  const metrics=[['执行总数',s.total,run.retryCaseId?'本次指定用例补跑的执行条目数':run.retryOf?'本次失败用例补跑的执行条目数':'用例数 × 每个用例执行次数'],['已处理',s.finished,'已执行 + 已跳过'],['通过',s.passed,'所有所选评估器的评分项均分别达标'],['未通过',s.failed,'已执行但存在不满足预期的结果'],['运行失败',s.errors,'Agent 执行出错，计入已执行用例'],['已跳过',s.skipped,'停用用例或停用的用例'],['待运行 / 运行中',s.pending+' / '+s.running,'尚未获得完整执行结果'],['通过率',evExperimentRate(s.passRate),'通过 ÷ 已执行；已执行 = 通过 + 未通过 + 运行失败'],['总耗时',evExperimentDuration(s.durationMs),'所有用例耗时之和'],['平均耗时',evExperimentDuration(s.avgDurationMs),'总耗时 ÷ 已执行用例数'],['Tokens',Number(s.tokens||0).toLocaleString('zh-CN'),'所有用例 Tokens 之和']];
  const config=experiment.snapshot.execution||experiment.execution,suites=experiment.snapshot.suites||[experiment.snapshot.suite];
  return `<div class="ev-experiment-report"><section class="ont-overview"><div class="ont-section-title"><h3>执行信息与结果</h3><span class="ont-badge">${historical?'历史运行 · ':''}本地 Mock · ${esc(run.id)}</span></div><p>${esc(conclusion)}</p><dl class="ont-mapping"><div><dt>运行时实验名称</dt><dd>${esc(experiment.name)}</dd></div><div><dt>Agent / 版本</dt><dd>${esc(experiment.agentName)} / ${esc(experiment.version)}</dd></div><div><dt>评测集快照</dt><dd>${evExperimentSuiteLinks(experiment)}</dd></div><div><dt>执行配置</dt><dd>并发 ${config.concurrency} · 每个用例执行 ${evExperimentCaseRuns(config)} 次</dd></div><div><dt>评测模型</dt><dd>${esc(experiment.snapshot.model?.name||config.modelId)}</dd></div><div><dt>MCP 快照</dt><dd>${esc((experiment.snapshot.mcps||[]).map(m=>m.name).join('、')||'—')}</dd></div></dl><p class="muted">通过率不包含已跳过、待运行和运行中的用例；没有已执行用例时显示「—」。报告来自当前选中运行的用例结果与配置快照。</p></section>${evTable(['指标','数值','计算口径'],metrics.map(([label,value,note])=>`<tr><td>${esc(label)}</td><td>${esc(value)}</td><td>${esc(note)}</td></tr>`))}${evExperimentEvaluatorReport(experiment,run)}<section class="ont-overview"><div class="ont-section-title"><h3>业务任务评估维度</h3></div><p class="muted">仅统计已产生维度判定的用例；运行失败与已跳过的用例不产生维度判定。</p>${evTable(['业务任务','评估维度','已评估','通过','未通过','通过率','出现的枚举值'],dimensions.map(d=>`<tr><td>${esc(d.taskName)}</td><td>${esc(d.name)}</td><td>${d.total}</td><td>${d.passed}</td><td>${d.total-d.passed}</td><td>${evExperimentRate(d.total?d.passed/d.total*100:null)}</td><td>${[...d.values].map(v=>esc(v)).join('、')}</td></tr>`),'<div class="ont-empty">暂无已完成的维度评估</div>')}</section></div><section class="ont-overview"><div class="ont-section-title"><h3>未通过与运行失败</h3></div>${evTable(['用例编号','名称','状态','原因','操作'],failures.map(r=>`<tr><td><span class="ont-id">${esc(r.caseId)}</span></td><td>${esc(r.name)}</td><td>${evExperimentStatus(r.status)}</td><td>${evExperimentText(r.reason)}</td><td><button type="button" class="ont-link" onclick="evExperimentCaseDetail('${r.id}')">查看</button></td></tr>`),'<div class="ont-empty">当前运行没有未通过或运行失败的用例</div>')}</section>`;
}
const evExperimentResultAnnotations=new Map(),evExperimentResultDetailTabs=new Map();
const evExperimentAnnotationProblemTypes=['输出不准确','约束未遵循','内容不完整','评分不合理','执行异常','其他'];
let evExperimentAnnotationEditor=null,evExperimentAnnotationSequence=0;
function evExperimentCaseDetailContext(resultId){
 const current=evExperimentCurrent();if(!current)return null;
 const validationRun=(typeof evExperimentValidationExecutions==='function'?evExperimentValidationExecutions(current):[]).find(run=>run.results.some(result=>result.id===resultId));
 if(validationRun){const experiment={...evExperimentRunContext(current,validationRun),isHistorical:false};return {current,run:validationRun,experiment,results:validationRun.results,result:validationRun.results.find(result=>result.id===resultId),archived:false,validation:true};}
 const record=evExperimentSelectedRecord(current),executions=record?[record,...(record.supplements||[])]:[];
 let run=executions.find(execution=>(execution.results||[]).some(row=>row.id===resultId)||(execution.reexecutions||[]).some(revision=>(revision.results||[]).some(row=>row.id===resultId)))||evExperimentViewRun(current);
 const experiment=evExperimentEvidence(current,run),results=evExperimentDisplayResults(experiment,run),archives=(run?.reexecutions||[]).flatMap(revision=>revision.results||[]),all=[...results,...archives];
 const result=all.find(row=>row.id===resultId)||(results.filter(row=>row.caseId===resultId).length===1?results.find(row=>row.caseId===resultId):null);
 return result?{current,run,experiment,results,result,archived:!results.includes(result)}:null;
}
function evExperimentResultReviewKey(context,evaluatorId=''){
 return JSON.stringify([studio.scene,context.current.id,context.run?.id||'',context.result.id,evaluatorId]);
}
function evExperimentResultAnnotation(resultId,evaluatorId){
 const context=evExperimentCaseDetailContext(resultId);return context?evExperimentResultAnnotations.get(evExperimentResultReviewKey(context,evaluatorId))||null:null;
}
function evExperimentOutputAnnotation(resultId,turnNumber){return evExperimentResultAnnotation(resultId,'output:'+turnNumber);}
function evExperimentAnnotationSummary(annotation){
 return annotation?`<div class="ev-result-annotation"><b>${esc(annotation.problemType||annotation.decision||'已标注')}</b><p>${esc(annotation.note||'未填写标注内容')}</p><small>${esc(annotation.updatedAt)}</small></div>`:'';
}
function evExperimentResultMessages(result){
 const supplied=result.messages||result.conversation;
 if(Array.isArray(supplied)&&supplied.length)return supplied.filter(message=>['user','assistant','agent'].includes(message.role)).map((message,index)=>({...message,role:message.role==='user'?'user':'assistant',content:String(message.content??message.text??''),expected:String(message.expected??(index<2?result.expected:'')??'')}));
 if(Array.isArray(result.turns)&&result.turns.length)return result.turns.flatMap((turn,index)=>[{...turn,role:'user',content:String(turn.input??''),expected:String(turn.expected??(index===0?result.expected:'')??''),timestamp:turn.inputAt},...(turn.hasOutput===false||turn.output==null&&turn.actual==null?[]:[{...turn,role:'assistant',content:String(turn.output??turn.actual??''),expected:String(turn.expected??(index===0?result.expected:'')??''),timestamp:turn.outputAt}])]);
 const input={role:'user',content:String(result.input||''),expected:String(result.expected||''),timestamp:result.startedAt};
 return result.actual?[input,{role:'assistant',content:evExperimentActualLabel(result),expected:String(result.expected||''),timestamp:result.endedAt,durationMs:result.durationMs,tokens:result.tokens}]:[input];
}
function evExperimentResultMetric(value){return ['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;}
function evExperimentResultTokenCount(value){const n=evExperimentResultMetric(value);return n===null?'—':n.toLocaleString('zh-CN');}
function evExperimentResultTurns(result){
 const completed=['通过','未通过','运行失败'].includes(result.status),messages=evExperimentResultMessages(result),turns=[];let pending=null;
 const append=(input,output)=>{
  const metric=output||input||{},usage=metric.usage||{},start=input?.timestamp||input?.created_at||metric.inputAt||'',end=output?metric.timestamp||metric.created_at||metric.outputAt||'':metric.outputAt||'';
  let duration=evExperimentResultMetric(metric.durationMs??metric.duration_ms??metric.elapsedMs),tokens=evExperimentResultMetric(metric.tokens??usage.total_tokens??usage.totalTokens);
  if(duration===null&&start&&end){const from=evExperimentTimestamp(start),to=evExperimentTimestamp(end);if(from&&to&&to>=from)duration=to-from;}
  if(tokens===null&&usage.input_tokens!=null&&usage.output_tokens!=null){const a=evExperimentResultMetric(usage.input_tokens),b=evExperimentResultMetric(usage.output_tokens);if(a!==null&&b!==null)tokens=a+b;}
  turns.push({n:turns.length+1,input:String(input?.content??''),output:String(output?.content??''),expected:String(output?.expected??input?.expected??(turns.length===0?result.expected:'')??''),hasInput:!!input,hasOutput:!!output,durationMs:duration,tokens,inputAt:start,outputAt:end});
 };
 for(const message of messages){if(message.role==='user'){if(pending)append(pending,null);pending=message;}else{append(pending,message);pending=null;}}
 if(pending)append(pending,null);
 if(turns.length===1&&completed){if(turns[0].durationMs===null)turns[0].durationMs=evExperimentResultMetric(result.durationMs);if(turns[0].tokens===null)turns[0].tokens=evExperimentResultMetric(result.tokens);}
 return turns;
}
function evExperimentResultGlyph(name){
 const paths={user:'<circle cx="8" cy="5" r="2.5"/><path d="M3 14v-1a5 5 0 0 1 10 0v1"/>',agent:'<rect x="2" y="4" width="12" height="10" rx="3"/><path d="M8 1v3M5 8h.01M11 8h.01M5 11h6"/>',clock:'<circle cx="8" cy="8" r="6"/><path d="M8 4v4l3 2"/>',tokens:'<path d="m8 1 6 3.5v7L8 15l-6-3.5v-7zM2 4.5 8 8l6-3.5M8 8v7"/>',pass:'<circle cx="8" cy="8" r="6"/><path d="m5 8 2 2 4-4"/>',fail:'<circle cx="8" cy="8" r="6"/><path d="m6 6 4 4m0-4-4 4"/>',pending:'<circle cx="8" cy="8" r="6"/><path d="M8 4v4m0 3h.01"/>'};
 return `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.pending}</svg>`;
}
function evExperimentSimulationSummary(result,execution={}){
 const mode=result.executionMode||execution.mode;if(mode!=='scenario_simulation')return '';
 const actual=Number.isFinite(Number(result.actualTurns))?Number(result.actualTurns):evExperimentResultTurns(result).filter(turn=>turn.hasOutput).length,limit=Number(execution.maxTurns)||5,reason=({max_turns:'达到最大轮次',goal_reached:'用户目标已达成',user_abandoned:'模拟用户主动结束',cannot_continue:'无法继续',runtime_error:'运行异常',execution_error:'运行异常',stopped:'已停止'})[result.stopReason]||result.stopReason||(['待运行','运行中'].includes(result.status)?'尚未结束':'未记录');
 return `<div class="ev-result-simulation-summary"><span class="ont-badge">多轮执行</span><span>实际 ${actual} / ${limit} 轮</span><span>结束原因：${esc(reason)}</span></div>`;
}
function evExperimentResultConversation(context){
 const {result,experiment}=context,record=experiment.snapshot.cases.find(row=>row.id===result.caseId),turns=evExperimentResultTurns(result);
 return `${evExperimentSimulationSummary(result,experiment.snapshot.execution||experiment.execution)}<div class="ev-result-conversation-heading"><span>对话记录</span><span>${turns.length} 轮 · 一问一答</span></div><div class="ev-result-turns">${turns.map(turn=>{
  const annotation=evExperimentOutputAnnotation(result.id,turn.n),tooltipId='ev-expected-output-'+turn.n,at=value=>value?`<time title="${esc(value)}">${esc(String(value).match(/\d{2}:\d{2}:\d{2}/)?.[0]||value)}</time>`:'';
  return `<section class="ev-result-turn" data-turn="${turn.n}" aria-label="第 ${turn.n} 轮对话"><header class="ev-result-turn-heading"><div><span class="ev-result-turn-number">${String(turn.n).padStart(2,'0')}</span><b>第 ${turn.n} 轮</b></div><div class="ev-result-turn-metrics" aria-label="第 ${turn.n} 轮统计"><span title="本轮时间消耗">${evExperimentResultGlyph('clock')}<span>耗时 <strong>${turn.durationMs===null?'—':evExperimentDuration(turn.durationMs)}</strong></span></span><span title="本轮 Token 消耗">${evExperimentResultGlyph('tokens')}<span>Token <strong>${evExperimentResultTokenCount(turn.tokens)}</strong></span></span></div></header><div class="ev-result-turn-dialogue"><article class="ev-result-message is-input"><header><div class="ev-result-message-source"><span class="ev-result-avatar">${evExperimentResultGlyph('user')}</span><b>${turn.n===1?'评测输入':(result.executionMode||experiment.snapshot.execution?.mode)==='scenario_simulation'?'模拟用户回复':'用户回复'}</b></div>${at(turn.inputAt)}</header><div class="ev-result-message-text">${esc(turn.hasInput?turn.input||'—':'未记录本轮输入')}</div>${turn.n===1&&record?.inputAttachments?.length?`<div class="ev-case-attachments" aria-label="输入附件">${evCaseAttachmentRows(record.inputAttachments,true)}</div>`:''}</article><article class="ev-result-message is-agent"><header><div class="ev-result-message-source"><span class="ev-result-avatar is-agent">${evExperimentResultGlyph('agent')}</span><b>Agent 输出</b></div><div class="ev-result-message-actions">${at(turn.outputAt)}${turn.n===1||turn.expected?`<div class="ev-result-hover"><button type="button" class="ont-button ev-expected-output" aria-describedby="${tooltipId}" title="${esc(turn.expected||'未配置预期输出')}">预期输出</button><div id="${tooltipId}" class="ev-result-tooltip" role="tooltip"><b>预期输出 · 第 ${turn.n} 轮</b><p>${esc(turn.expected||'未配置预期输出')}</p></div></div>`:''}${turn.hasOutput&&!result.isValidation?evAnnotationButton(`evExperimentAnnotateOutput(${JSON.stringify(result.id)},${turn.n})`,annotation?'编辑第 '+turn.n+' 轮 Agent 输出标注':'标注第 '+turn.n+' 轮 Agent 输出',!!annotation):''}</div></header><div class="ev-result-message-text ${turn.hasOutput?'':'is-pending'}">${esc(turn.hasOutput?turn.output||'—':result.status==='运行失败'?'本次执行未产生输出':['已跳过','已停用'].includes(result.status)?'用例未执行，无 Agent 输出':'等待 Agent 输出')}</div>${turn.hasOutput?evExperimentAnnotationSummary(annotation):''}</article></div></section>`;
 }).join('')}</div>`;
}
const evExperimentTraceViews=new Map();
function evExperimentTraceNumber(value){return value!==null&&value!==undefined&&value!==''&&typeof value!=='boolean'&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=Number.MAX_SAFE_INTEGER?Number(value):null;}
function evExperimentTraceTime(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='boolean'&&Number.isFinite(Number(value)))return Math.abs(Number(value))<=8640000000000000?Number(value):null;
 const stamp=Date.parse(value);return Number.isFinite(stamp)?stamp:null;
}
function evExperimentTraceDisplay(value){return value===null||value===undefined?'未记录':typeof value==='string'?value:JSON.stringify(value,null,2);}
function evExperimentTraceType(value){
 const type=String(value||'other').toLowerCase(),aliases={llm:'model',generation:'model',function:'tool',retrieval:'knowledge',retriever:'knowledge',database:'ontology',chain:'agent',guardrail:'guard',input:'user'};
 return aliases[type]||(['model','tool','agent','ontology','knowledge','memory','guard','user'].includes(type)?type:'other');
}
function evExperimentTraceTypeLabel(type){return ({model:'模型',tool:'工具',agent:'Agent',ontology:'本体',knowledge:'知识',memory:'记忆',guard:'安全围栏',user:'用户输入',other:'其他'})[type]||'其他';}
function evExperimentTraceStatus(value){
 const status=String(value||'');
 if(['error','failed','failure','运行失败','失败','错误'].includes(status.toLowerCase()))return {kind:'error',label:'失败'};
 if(['warning','warn','警告','异常'].includes(status.toLowerCase()))return {kind:'warning',label:'警告'};
 if(['running','pending','运行中','待运行','执行中'].includes(status.toLowerCase()))return {kind:'pending',label:status==='pending'||status==='待运行'?'待执行':'执行中'};
 if(['ok','success','complete','completed','done','passed','完成','已完成','成功','通过'].includes(status.toLowerCase()))return {kind:'success',label:'已完成'};
 return {kind:'unknown',label:status||'未记录'};
}
function evExperimentTraceRecords(result){
 const source=Array.isArray(result.trace)?result.trace:result.trace?.spans;
 if(!Array.isArray(source))return [];
 const rows=source.filter(span=>span&&typeof span==='object').map((span,index)=>{
  const type=evExperimentTraceType(span.type||span.spanType||span.span_type),duration=evExperimentTraceNumber(span.durationMs??span.duration_ms),start=evExperimentTraceTime(span.startedAtMs??span.startTimeMs??span.start_time_ms??span.startedAt??span.startTime??span.start_time??span.timestamp),offset=evExperimentTraceNumber(span.startOffsetMs??span.offsetMs);
  return {index,raw:span,id:String(span.id??span.spanId??span.span_id??'span-'+index),parentId:span.parentId??span.parentSpanId??span.parent_span_id??null,name:String(span.name||span.operation||span.type||'未命名记录'),type,duration,start,offset,status:evExperimentTraceStatus(span.status),depth:0};
 });
 const byId=new Map();rows.forEach(row=>{if(!byId.has(row.id))byId.set(row.id,row);});
 const children=new Map(),roots=[];
 rows.forEach(row=>{const parent=row.parentId===null?null:byId.get(String(row.parentId));if(parent&&parent!==row){row.parentIndex=parent.index;if(!children.has(parent.index))children.set(parent.index,[]);children.get(parent.index).push(row);}else roots.push(row);});
 const ordered=[],visited=new Set(),visit=(row,depth)=>{if(visited.has(row.index))return;visited.add(row.index);row.depth=Math.min(depth,12);ordered.push(row);for(const child of children.get(row.index)||[])visit(child,depth+1);};
 roots.forEach(row=>visit(row,0));rows.forEach(row=>visit(row,0));return ordered;
}
function evExperimentTraceView(context){
 const key=evExperimentResultReviewKey(context);if(!evExperimentTraceViews.has(key))evExperimentTraceViews.set(key,{index:null,expanded:[]});return evExperimentTraceViews.get(key);
}
function evExperimentTraceSelect(resultId,index){
 const context=evExperimentCaseDetailContext(resultId);if(!context)return false;
 const record=evExperimentTraceRecords(context.result).find(row=>row.index===Number(index));if(!record)return false;
 evExperimentTraceView(context).index=record.index;evExperimentCaseDetailTab(resultId,'trace');
 document.getElementById('ev-review-trace-record-'+record.index)?.focus?.({preventScroll:true});return true;
}
function evExperimentTraceToggle(resultId,index){
 const context=evExperimentCaseDetailContext(resultId);if(!context)return false;
 const record=evExperimentTraceRecords(context.result).find(row=>row.index===Number(index));if(!record)return false;
 const state=evExperimentTraceView(context),expanded=state.expanded||[];
 state.expanded=expanded.includes(record.index)?expanded.filter(value=>value!==record.index):[...expanded,record.index];
 return evExperimentTraceSelect(resultId,record.index);
}
function evExperimentTraceKey(event,resultId,index){
 if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const context=evExperimentCaseDetailContext(resultId);if(!context)return;
 const records=evExperimentTraceRecords(context.result),position=records.findIndex(row=>row.index===Number(index));if(position<0)return;
 const current=records[position],next=event.key==='Home'?records[0]:event.key==='End'?records.at(-1):event.key==='ArrowUp'?records[Math.max(0,position-1)]:event.key==='ArrowDown'?records[Math.min(records.length-1,position+1)]:event.key==='ArrowLeft'?records.find(row=>row.index===current.parentIndex):records.find(row=>row.parentIndex===current.index);
 event.preventDefault();event.stopPropagation?.();if(next)evExperimentTraceSelect(resultId,next.index);
}
function evExperimentResultTrace(context){
 const {result,run}=context,records=evExperimentTraceRecords(result);
 if(!records.length)return `<div class="ev-review-trace-empty"><span aria-hidden="true">⌁</span><h3>暂无 Trace 记录</h3><p>${run?'当前为本地 Mock，未记录真实模型或工具调用 Trace。':'尚未执行，暂无 Trace。'}</p></div>`;
 const state=evExperimentTraceView(context),focusIndex=records.some(row=>row.index===state.index)?state.index:records[0].index,expanded=state.expanded||[];
 const hasOffsets=records.every(row=>row.offset!==null),hasStarts=records.every(row=>row.start!==null),actualTimeline=hasOffsets||hasStarts,origin=Math.min(...records.map(row=>row.start).filter(value=>value!==null));
 const offset=row=>hasOffsets?row.offset:hasStarts?row.start-origin:0,total=Math.max(...records.map(row=>offset(row)+(row.duration||0)),0),args=esc(JSON.stringify(result.id));
 const scale=actualTimeline?'执行时间线':'记录耗时',format=value=>value===null?'—':evExperimentDuration(value),typeBadge=row=>`<span class="ev-review-trace-type is-${row.type}">${evExperimentTraceTypeLabel(row.type)}</span>`;
 return `<div class="ev-review-trace"><header class="ev-review-trace-heading"><strong>执行轨迹${result.trace?.mock?' · 本地 Mock':''}</strong><span>${records.length} 条记录 · 点击展开原始记录</span></header>${result.trace?.mock?`<p class="ev-review-trace-timing-note" role="note">${esc(result.trace.notice||'本地 Mock · 模拟轨迹，耗时为演示值。')}</p>`:''}<div class="ev-review-trace-scale"><span>${scale}</span><span>${total?format(total):records.every(row=>row.duration===0)?'0 ms':'未记录耗时'}</span></div><div class="ev-review-trace-records" role="tree" aria-label="Trace 记录">${records.map(row=>{
  const active=row.index===state.index,open=expanded.includes(row.index),start=total?offset(row)/total*100:0,width=total&&row.duration!==null?row.duration/total*100:0,panelId='ev-review-trace-raw-'+row.index;
  return `<div class="ev-review-trace-span ${open?'is-expanded':''}" role="none"><button type="button" id="ev-review-trace-record-${row.index}" class="ev-review-trace-record is-${row.type} ${active?'is-selected':''}" role="treeitem" aria-level="${row.depth+1}" aria-expanded="${open}" aria-controls="${panelId}" tabindex="${row.index===focusIndex?0:-1}" aria-label="查看 Trace：${esc(row.name)}" data-trace-index="${row.index}" style="--trace-depth:${row.depth}" onclick="evExperimentTraceToggle(${args},${row.index})" onkeydown="evExperimentTraceKey(event,${args},${row.index})"><span class="ev-review-trace-record-main"><span class="ev-review-trace-chevron" aria-hidden="true"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="m4 2 4 4-4 4"/></svg></span>${typeBadge(row)}<strong title="${esc(row.name)}">${esc(row.name)}</strong>${row.status.kind==='error'||row.status.kind==='warning'?`<i class="ev-review-trace-status is-${row.status.kind}">${row.status.label}</i>`:''}</span><span class="ev-review-trace-record-time"><span class="ev-review-trace-bar-track" aria-hidden="true"><i class="ev-review-trace-bar is-${row.type}" style="left:${start.toFixed(3)}%;width:${width.toFixed(3)}%"></i></span><span>${format(row.duration)}</span></span></button><div id="${panelId}" class="ev-review-trace-raw" role="region" aria-label="${esc(row.name)}的原始记录" ${open?'':'hidden'}>${open?`<pre>${esc(JSON.stringify(row.raw,null,2))}</pre>`:''}</div></div>`;
 }).join('')}</div>${actualTimeline?'':'<p class="ev-review-trace-timing-note">记录未包含完整开始时间，条形仅比较各记录耗时。</p>'}</div>`;
}
function evExperimentCaseDetailTab(resultId,tab){
 const context=evExperimentCaseDetailContext(resultId);if(!context||!['conversation','trace'].includes(tab))return false;
 evExperimentResultDetailTabs.set(evExperimentResultReviewKey(context),tab);evExperimentCaseDetail(resultId);document.getElementById('ev-result-'+tab+'-tab')?.focus?.({preventScroll:true});return true;
}
function evExperimentResultTabKey(event,resultId){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 const context=evExperimentCaseDetailContext(resultId);if(!context)return;
 event.preventDefault();event.stopPropagation?.();
 const current=evExperimentResultDetailTabs.get(evExperimentResultReviewKey(context))||'conversation';
 evExperimentCaseDetailTab(resultId,event.key==='Home'?'conversation':event.key==='End'?'trace':current==='trace'?'conversation':'trace');
}
function evExperimentResultEvaluator(resultId,evaluatorId){
 const context=evExperimentCaseDetailContext(resultId),evaluation=context?.result.evaluations?.find(row=>row.evaluatorId===evaluatorId);if(!evaluation)return false;
 const record=evEvaluatorStore().evaluators.find(row=>row.id===evaluatorId),option=record&&evVersionOptions(record).find(row=>row.record.version===evaluation.version&&row.status!=='draft');
 if(option){
  const opened=evEvaluatorDetail(evaluatorId,option.key);
  if(opened&&!window.AIOpsEvaluation?.isPage(window.AIOpsApp?.page()))document.querySelector('.ev-modal .ont-head-actions')?.insertAdjacentHTML?.('afterbegin',`<button type="button" class="ont-button" onclick="evExperimentCaseDetail(${esc(JSON.stringify(resultId))})">${context.validation?'返回验证详情':'返回用例结果'}</button>`);
  return opened;
 }
 const body=`<section class="ont-form-section"><h3>${esc(evaluation.name)} · ${esc(evaluation.version)}</h3><p class="ev-note">本次评测保存的评估器快照</p>${evTable(['评分项','评分标准','权重','通过分数'],(evaluation.criteria||[]).map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(row.description)}</td><td>${esc(row.weight)}</td><td>${esc(row.passScore)}</td></tr>`))}</section>`;
 evModal('查看离线评估器快照',body,`<button type="button" class="ont-button" onclick="evExperimentCaseDetail(${esc(JSON.stringify(resultId))})">${context.validation?'返回验证详情':'返回用例结果'}</button>`);return true;
}
function evExperimentAnnotationTarget(context,key){
 if(!context?.run||context.validation||typeof key!=='string')return null;
 const output=/^output:([1-9]\d*)$/.exec(key);
 if(output){const turn=evExperimentResultTurns(context.result).find(row=>row.n===Number(output[1]));return turn?.hasOutput?{targetType:'output',turn:turn.n,label:'第 '+turn.n+' 轮 · Agent 输出'}:null;}
 const evaluator=context.result.evaluations?.find(row=>row.evaluatorId===key);return evaluator?{targetType:'evaluator',evaluatorId:key,label:evaluator.name}:null;
}
function evExperimentAnnotationDialog(resultId,key){
 const context=evExperimentCaseDetailContext(resultId),target=evExperimentAnnotationTarget(context,key);if(!target)return false;
 const annotation=evExperimentResultAnnotation(resultId,key);
 evExperimentAnnotationEditor={scene:studio.scene,experimentId:context.current.id,runId:context.run.id,resultId,targetKey:key,...target,key:evExperimentResultReviewKey(context,key),token:String(++evExperimentAnnotationSequence)};
 const body=`<input type="hidden" name="scene" value="${esc(studio.scene)}"><input type="hidden" name="annotationToken" value="${esc(evExperimentAnnotationEditor.token)}"><section class="ont-form-section"><div class="ev-annotation-target"><span>标注对象</span><strong>${esc(target.label)}</strong><small>${esc(context.result.name)}</small></div>${evField('问题类型',`<select name="problemType" aria-label="问题类型" required><option value="" disabled ${annotation?.problemType?'':'selected'}>请选择问题类型</option>${evExperimentAnnotationProblemTypes.map(value=>`<option value="${value}" ${value===annotation?.problemType?'selected':''}>${value}</option>`).join('')}</select>`)}${evField('标注内容',`<textarea name="note" aria-label="标注内容" maxlength="4000" required placeholder="描述发现的问题、相关依据或改进建议">${esc(annotation?.note||'')}</textarea>`)}<p id="ev-result-annotation-error" class="ont-error" role="alert"></p></section>`;
 const args=[resultId,key].map(value=>esc(JSON.stringify(value))).join(',');
 evModal(target.targetType==='output'?'标注Agent输出':'标注评估结果',body,'<button type="submit" class="ont-button strong">保存标注</button>',`evSaveExperimentResultAnnotation(event,${args})`);return true;
}
function evExperimentAnnotateResult(resultId,evaluatorId){return evExperimentAnnotationDialog(resultId,evaluatorId);}
function evExperimentAnnotateOutput(resultId,turnNumber){return evExperimentAnnotationDialog(resultId,'output:'+turnNumber);}
function evSaveExperimentResultAnnotation(event,resultId,targetKey){
 event?.preventDefault?.();const context=evExperimentCaseDetailContext(resultId),editor=evExperimentAnnotationEditor,form=event?.currentTarget||event?.target||event;
 const fail=message=>{const node=document.getElementById('ev-result-annotation-error');if(node)node.textContent=message;toast(message);return false;};
 const target=evExperimentAnnotationTarget(context,targetKey);
 if(!target||!editor||editor.scene!==studio.scene||editor.key!==evExperimentResultReviewKey(context,targetKey))return fail('当前实验、评测记录或标注对象已变更，请重新打开标注。');
 const values=new FormData(form);if(values.get('annotationToken')!==editor.token||values.get('scene')!==editor.scene)return fail('标注表单已过期，请重新打开标注。');
 const problemType=String(values.get('problemType')||''),note=String(values.get('note')||'').trim();
 if(!evExperimentAnnotationProblemTypes.includes(problemType))return fail('请选择有效的问题类型。');
 if(!note)return fail('请输入标注内容。');
 if(note.length>4000)return fail('标注说明不能超过 4000 字。');
 const previous=evExperimentResultAnnotations.get(editor.key),entry={problemType,note,updatedAt:evExperimentTime()},annotation={...entry,...target,scene:studio.scene,experimentId:context.current.id,runId:context.run.id,resultId,history:[...(previous?.history||[]),entry]};
 evExperimentResultAnnotations.set(editor.key,evExperimentFreeze(annotation));if(typeof evExperimentIssueFromAnnotation==='function'){evExperimentIssueFromAnnotation(context,annotation,targetKey);evExperimentRefreshDetail(context.current);}evExperimentAnnotationEditor=null;evExperimentCaseDetail(resultId);toast('标注已保存');return annotation;
}
function evExperimentResultActions(context){
 const {current,run,result}=context;if(context.validation||!run||!['未通过','运行失败'].includes(result.status))return '';
 const busy=!!evExperimentActiveExecution(current),args=[current.id,run.id,result.id].map(value=>esc(JSON.stringify(value))).join(',');
 return `<div class="ev-result-detail-actions">${result.status==='未通过'?`<button type="button" class="ont-button ev-experiment-analyze" onclick="evExperimentAnalyzeResult(${args})"><span aria-hidden="true">✧</span>结果分析</button>`:''}<button type="button" class="ont-button strong" ${busy?'disabled aria-disabled="true" title="请等待当前执行完成"':''} onclick="evExperimentRetryResult(${args})">重新执行</button></div>`;
}
function evExperimentResultHeading(context){
 const {current,run,experiment,results,result,archived,validation}=context,attempts=results.filter(row=>row.caseId===result.caseId);
 if(archived)attempts.unshift(result);
 const finished=['通过','未通过','运行失败'].includes(result.status),evaluations=result.evaluations||[],status=result.status==='待运行'?'待执行':evExperimentDisplayStatus(result.status),tone=result.status==='通过'?'success':['未通过','运行失败'].includes(result.status)?'danger':result.status==='运行中'?'running':'neutral';
 const glyph=result.status==='通过'?'pass':['未通过','运行失败'].includes(result.status)?'fail':'pending',note=evaluations.length?evaluations.filter(row=>row.passed).length+' / '+evaluations.length+' 个评估器通过':result.status==='运行失败'?'执行异常 · 未完成评估':finished?'本次评估已结束':'等待评测结果';
 const attemptPicker=attempts.length>1?`<label class="ev-result-attempt-picker"><span>${validation?'验证执行':'执行结果'}</span><select aria-label="${validation?'选择验证执行结果':'选择用例执行结果'}" onchange="evExperimentCaseDetail(this.value)">${attempts.map(row=>`<option value="${esc(row.id)}" ${row.id===result.id?'selected':''}>${row===result&&archived?'重跑前证据 · ':''}第 ${evExperimentAttemptNumber(row)} / ${evExperimentCaseRepeatCount(experiment)} 次 · ${esc(row.status)}</option>`).join('')}</select></label>`:'';
 const timestamp=(text,milliseconds)=>text||(Number.isFinite(milliseconds)?evExperimentTime(milliseconds):'—'),duration=finished||result.status==='运行中'?evExperimentResultMetric(result.durationMs):null,tokens=finished||result.status==='运行中'?evExperimentResultMetric(result.tokens):null;
 const metrics=[['开始时间',timestamp(result.startedAt,result.startedAtMs),'time'],['结束时间',timestamp(result.endedAt,result.endedAtMs),'time'],['耗时',duration===null?'—':evExperimentDuration(duration),'duration'],['Token 消耗',evExperimentResultTokenCount(tokens),'tokens']];
 return `<div class="ev-result-heading"><div class="ev-result-heading-main"><div class="ev-result-title"><h2>${validation?'问题验证 · ':''}${esc(result.name)}</h2><div>${validation?`<span>验证编号</span><code>${esc(run.id)}</code>`:''}<span>${validation?'关联用例':'用例编号'}</span><code>${esc(result.caseId)}</code>${archived?'<span class="ev-result-evidence-tag">重跑前证据</span>':''}${!validation&&evExperimentHistorical(current,run)?'<span class="ev-result-evidence-tag">历史评测记录</span>':''}</div></div><div class="ev-result-heading-tools">${attemptPicker}${evExperimentResultActions(context)}</div></div><section class="ev-result-summary is-${tone}" aria-label="执行概览"><div class="ev-result-outcome" title="${esc(result.reason||'')}"><span class="ev-result-outcome-icon">${evExperimentResultGlyph(glyph)}</span><div><span>${validation?'验证结果':'评测结果'}</span><strong>${esc(status)}</strong><small>${esc(note)}</small></div></div><div class="ev-result-summary-meta"><div class="ev-result-run-identity"><div><span>版本</span><b>用例 ${esc(result.version)}</b><b title="${esc(experiment.agentName)}">Agent ${esc(experiment.version)}</b></div><div><span>执行定位</span><strong>${validation?'问题验证 #'+run.validationSequence:run?'评测记录 #'+run.sequence:'尚未执行'} <i>/</i> ${validation?'验证执行':'用例执行'} ${evExperimentAttemptNumber(result)} / ${validation?results.length:evExperimentCaseRepeatCount(experiment)}${!validation&&run?.kind==='supplement'?' · 补跑 #'+run.supplementSequence:''}</strong></div></div><dl class="ev-result-run-metrics">${metrics.map(([label,value,kind])=>`<div class="is-${kind}"><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl></div></section><div class="ev-result-origin"><span>Agent <b>${esc(experiment.agentName)}</b></span><span>来源评测集 ${evExperimentSuiteLinks(experiment,result.suiteIds||[])}</span>${result.conversationId?`<span class="ev-result-conversation-id">独立对话 <code title="${esc(result.conversationId)}">${esc(result.conversationId)}</code></span>`:''}<span class="ev-result-environment">本地 Mock</span></div>${result.status==='运行失败'?`<p class="ev-result-execution-error" role="note">${esc(result.reason)}</p>`:''}</div>`;
}
function evExperimentCaseDetail(resultId){
 evExperimentAnnotationEditor=null;
 const context=evExperimentCaseDetailContext(resultId);if(!context)return false;
 const {run,result}=context,tab=evExperimentResultDetailTabs.get(evExperimentResultReviewKey(context))||'conversation',args=esc(JSON.stringify(result.id));
 const body=`<div class="ev-result-detail" data-review-kind="${context.validation?'validation':'result'}" data-result-id="${esc(result.id)}"><div class="ev-result-columns"><section class="ev-result-conversation" aria-label="评测输入与 Agent 输出"><nav class="ev-result-tabs" role="tablist" aria-label="用例执行内容" onkeydown="evExperimentResultTabKey(event,${args})"><button id="ev-result-conversation-tab" type="button" role="tab" aria-controls="ev-result-conversation-panel" aria-selected="${tab==='conversation'}" tabindex="${tab==='conversation'?0:-1}" onclick="evExperimentCaseDetailTab(${args},'conversation')">输入与输出</button><button id="ev-result-trace-tab" type="button" role="tab" aria-controls="ev-result-trace-panel" aria-selected="${tab==='trace'}" tabindex="${tab==='trace'?0:-1}" onclick="evExperimentCaseDetailTab(${args},'trace')">Trace</button></nav><div id="ev-result-conversation-panel" role="tabpanel" aria-labelledby="ev-result-conversation-tab" class="ev-result-conversation-content" ${tab==='conversation'?'':'hidden'}>${evExperimentResultConversation(context)}</div><div id="ev-result-trace-panel" role="tabpanel" aria-labelledby="ev-result-trace-tab" class="ev-result-conversation-content" ${tab==='trace'?'':'hidden'}>${evExperimentResultTrace(context)}</div></section><aside class="ev-result-assessment" aria-label="评估结果">${evExperimentScoringResults(result)}</aside></div></div>`;
 evModal(context.validation?'查看问题验证详情':run?'查看用例结果':'查看待运行用例',body,'','',evExperimentResultHeading(context));
 const modal=document.querySelector('.ev-modal');modal?.classList.add('ev-experiment-case');const nav=modal?.querySelector('.ev-form-nav');if(nav){nav.hidden=true;nav.innerHTML='';}return true;
}

function evExperimentRefreshDetail(experiment,updatedRunId=''){
 if(experiment.scene!==studio.scene||evExperimentState.id!==experiment.id)return;
 const run=evExperimentViewRun(experiment),top=document.getElementById('ev-experiment-detail-top'),content=document.getElementById('ev-experiment-detail-content'),controls=document.getElementById('ev-experiment-run-controls'),count=document.getElementById('ev-experiment-result-count');
 if(controls){const focused=controls.contains?.(document.activeElement);controls.innerHTML=evExperimentHeaderControls(experiment);controls.dataset.status=experiment.status;if(focused)controls.querySelector('button:not([disabled])')?.focus?.({preventScroll:true});}
 evExperimentRefreshDashboard(experiment);
 if(count)count.textContent=String(evExperimentDisplayResults(experiment,run).length);
 const issueCount=document.getElementById('ev-experiment-issue-count');if(issueCount)issueCount.textContent=String(evExperimentIssueScopeIssues(experiment).length);
 if(evExperimentState.tab==='问题优化'){
  if(top)top.innerHTML='';
  if(content){if(!updatedRunId)evExperimentReplaceContent(content,evExperimentIssuesView(experiment,run));else evExperimentIssuesRefresh();}
  return;
 }
 if(evExperimentRangeEmpty(experiment,run)){if(top)top.innerHTML='';if(content)evExperimentReplaceContent(content,evExperimentEmptyRun(experiment));return;}
 if(top){
  const changedRun=top.dataset.runId!==(run?.id||'');top.dataset.runId=run?.id||'';
  if(evExperimentState.tab==='实验配置'){if(!updatedRunId||changedRun)evExperimentReplaceContent(top,evExperimentDetailTop(experiment,run));else{const status=document.getElementById('ev-experiment-overview-status');if(status)status.innerHTML=evExperimentStatus(experiment.status);}}
  else if(top.innerHTML)top.innerHTML='';
 }
 if(updatedRunId&&run?.id!==updatedRunId)return;
 if(content){if(evExperimentState.tab==='用例结果'&&document.getElementById('ev-experiment-results-table'))evExperimentRefreshResults();else evExperimentReplaceContent(content,evExperimentDetailContent(experiment,run));}
}

function evExperimentRefreshReviewDrawer(experiment,runId){
 const node=document.querySelector('.ev-result-detail[data-result-id]');if(!node||document.querySelector('.ev-annotation-dialog')||window.AIOpsEvaluation?.isPage(window.AIOpsApp?.page()))return;
 const id=node.getAttribute('data-result-id'),context=evExperimentCaseDetailContext(id);if(!context||context.current.id!==experiment.id||runId&&context.run?.id!==runId)return;
 const left=node.querySelector('.ev-result-conversation-content:not([hidden])'),right=node.querySelector('.ev-result-assessment'),scroll=[left?.scrollTop||0,right?.scrollTop||0];evExperimentCaseDetail(id);
 const next=document.querySelector('.ev-result-detail[data-result-id]');if(next){const l=next.querySelector('.ev-result-conversation-content:not([hidden])'),r=next.querySelector('.ev-result-assessment');if(l)l.scrollTop=scroll[0];if(r)r.scrollTop=scroll[1];}
}
function evExperimentRefreshIssueDrawer(experiment=evExperimentCurrent()){
 const node=document.querySelector('.ev-issue-detail[data-issue-id]');
 if(!node||!experiment||node.getAttribute('data-experiment-id')!==experiment.id||window.AIOpsEvaluation?.isPage(window.AIOpsApp?.page()))return;
 const left=node.querySelector('.ev-issue-detail-reason'),right=node.querySelector('.ev-issue-detail-evidence'),scrolls=[left?.scrollTop||0,right?.scrollTop||0],scope=node.getAttribute('data-issue-scope')||'all';
 evExperimentIssueDetail(node.getAttribute('data-issue-id'),scope,experiment.id);
 const next=document.querySelector('.ev-issue-detail[data-issue-id]');if(next){const l=next.querySelector('.ev-issue-detail-reason'),r=next.querySelector('.ev-issue-detail-evidence');if(l)l.scrollTop=scrolls[0];if(r)r.scrollTop=scrolls[1];}
}
function evExperimentRefresh(scene,id,runId){
  if(studio.scene!==scene||evExperimentState.scene!==scene||currentSection!=='studio'||!wtState.open||evState.tab!=='评测实验')return;
  if(evExperimentState.id){if(evExperimentState.id===id){const experiment=evExperimentGet(id);if(experiment){evExperimentRefreshDetail(experiment,runId);evExperimentRefreshIssueDrawer(experiment);evExperimentRefreshReviewDrawer(experiment,runId);}}}
  else evExperimentRefreshList();
}

const evExperimentExpanded=new Set();
function evExperimentToggleAttempts(key){if(evExperimentExpanded.has(key))evExperimentExpanded.delete(key);else evExperimentExpanded.add(key);evExperimentRefreshResults();}
