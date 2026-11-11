/* Time-scoped summaries for the local evaluation Mock. */
'use strict';
const evDashboardRanges=[{id:'all',name:'全部时间范围'},{id:'today',name:'今天'},{id:'yesterday',name:'昨天'},{id:'7d',name:'近7天'}];
const evDashboardPeriods=Object.create(null);
function evDashboardKey(scope){return (typeof studio==='undefined'?'sales':studio.scene)+':'+scope;}
function evDashboardRange(scope){return evDashboardPeriods[evDashboardKey(scope)]||'all';}
function evDashboardTimestamp(value){
  if(typeof value==='number')return Number.isFinite(value)?value:NaN;
  if(value&&typeof value.getTime==='function')return value.getTime();
  if(typeof value!=='string'||!value.trim())return NaN;
  let text=value.trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(text))text+='T00:00:00+08:00';
  else if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text))text=text.replace(' ','T')+'+08:00';
  return Date.parse(text);
}
function evDashboardWindow(scope,now=Date.now()){
  const key=evDashboardRange(scope);if(key==='all')return null;
  const ms=evDashboardTimestamp(now);if(!Number.isFinite(ms))return {start:NaN,end:NaN};
  const shifted=new Date(ms+8*3600000),start=Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate())-8*3600000,day=86400000;
  return key==='yesterday'?{start:start-day,end:start}:key==='7d'?{start:start-6*day,end:start+day}:{start,end:start+day};
}
function evDashboardMatch(value,scope,now=Date.now()){
  const range=evDashboardWindow(scope,now);if(!range)return true;
  const stamp=evDashboardTimestamp(value);return Number.isFinite(stamp)&&stamp>=range.start&&stamp<range.end;
}
function evDashboardSetRange(scope,key){
  if(typeof scope!=='string'||!evDashboardRanges.some(range=>range.id===key))return false;
  evDashboardPeriods[evDashboardKey(scope)]=key;
  document.querySelectorAll?.('.ev-period-selector[open]').forEach(menu=>menu.removeAttribute('open'));
  evRender();return true;
}
function evDashboardExperimentRuns(experiment,scope){return (experiment?.runs||[]).filter(run=>evDashboardMatch(run.startedAtMs??run.startedAt,scope));}
function evDashboardExperimentExecutions(experiment,scope){
  const executions=typeof evExperimentExecutions==='function'?evExperimentExecutions(experiment):(experiment?.runs||[]).flatMap(run=>[run,...(run.supplements||[])]);
  return executions.filter(run=>evDashboardMatch(run.startedAtMs??run.startedAt,scope));
}
function evDashboardExperimentMatches(experiment,scope){return evDashboardMatch(experiment?.createdAtMs??experiment?.createdAt,scope)||evDashboardExperimentExecutions(experiment,scope).length>0;}
function evDashboardExperimentMetrics(experiments,scope='experiment-list'){
  const source=typeof evExperimentMetricContext==='function'?(experiments||[]).map(evExperimentMetricContext):experiments||[];
  const unique=[...new Map(source.filter(item=>evDashboardExperimentMatches(item,scope)).map(item=>[item.id,item])).values()];
  let executed=0,runs=0;const pending=new Set();
  for(const experiment of unique){
    const matching=evDashboardExperimentExecutions(experiment,scope);if(matching.length)executed++;
    runs+=new Set(evDashboardExperimentRuns(experiment,scope).map(run=>run.id)).size;
    const seenRuns=new Set();
    for(const run of matching){
      if(seenRuns.has(run.id))continue;seenRuns.add(run.id);
      if(typeof evExperimentIssueLedgerSync!=='function'){
        const issues=typeof evExperimentIssuesSync==='function'?evExperimentIssuesSync(experiment,run):run.issues||[];
        for(const issue of issues)if(issue.status==='待修复')pending.add(experiment.id+':'+run.id+':'+issue.id);
      }
    }
    if(typeof evExperimentIssueLedgerSync==='function')for(const issue of evExperimentIssueLedgerSync(experiment))if(issue.status==='待修复'&&(issue.occurrences||[]).some(item=>seenRuns.has(item.runId)))pending.add(experiment.id+':'+issue.id);
  }
  return [
    {id:'experiment-total',label:'实验总数',value:unique.length,unit:'个',hint:'所选时间内新建、启动全量评测或补跑的实验，按实验编号去重；与当前列表范围一致。'},
    {id:'experiment-executed',label:'已执行实验总数',value:executed,unit:'个',hint:'所选时间内至少启动过一次全量评测或补跑的实验，按实验编号去重，包含运行中、已完成和已停止。'},
    {id:'experiment-pending',label:'待修复问题数',value:pending.size,unit:'个',hint:'按每次全量评测或补跑的开始时间筛选，统计其中出现过、当前仍待修复的台账问题；同一问题跨记录及补跑去重。待验证、验证完成和已关闭不计。'},
    {id:'experiment-runs',label:'评测记录数',value:runs,unit:'条',hint:'按评测记录开始时间筛选，每次全量评测生成独立记录；失败或指定用例补跑归入原记录，不增加评测记录数。'}
  ];
}
function evDashboardRunMetrics(experiment,run){
  const source=typeof evExperimentMetricResults==='function'?evExperimentMetricResults(experiment,run):run?.results||[];
  const pending=typeof evExperimentMetricsPending==='function'&&evExperimentMetricsPending(experiment,run);
  const rows=source.filter(result=>['通过','未通过','运行失败'].includes(result.status)),n=rows.length,passed=rows.filter(result=>result.status==='通过').length;
  const mean=key=>n&&rows.every(row=>row[key]!==null&&row[key]!==undefined&&row[key]!==''&&Number.isFinite(Number(row[key])))?rows.reduce((sum,row)=>sum+Number(row[key]),0)/n:null;
  return [
    {id:'case-executions',label:'用例执行次数',value:n,unit:'次',hint:'当前所选运行已执行的结果数：通过＋未通过＋运行失败。每次执行是一段独立对话，对话内问答轮次不重复计数；跳过、待运行和运行中不计。'},
    {id:'case-pass-rate',label:'用例执行通过率',value:n?passed/n*100:null,unit:'%',format:'rate',hint:'当前所选运行通过数 ÷ 已执行数；已执行包含未通过和运行失败。'+(pending?' 全部用例执行完成后统一更新。':'')},
    {id:'case-duration',label:'用例单次执行时长',value:mean('durationMs'),format:'duration',hint:'当前所选运行已执行用例的耗时总和 ÷ 用例执行次数，包含运行失败项的耗时，跳过项不计；这是平均单次耗时。'},
    {id:'case-tokens',label:'用例单次Token消耗',value:mean('tokens'),unit:'Token',digits:1,hint:'当前所选运行已执行用例的 Token 消耗总和 ÷ 用例执行次数，包含运行失败项已记录的消耗，跳过项不计；这是平均单次消耗。'}
  ];
}
function evDashboardIssueMetrics(experiment,run){
  const snapshot=experiment&&typeof evExperimentIssueValidationMetricSource==='function'?evExperimentIssueValidationMetricSource(experiment):null;
  const source=snapshot??(experiment&&typeof evExperimentIssueScopeIssues==='function'?evExperimentIssueScopeIssues(experiment):!run?[]:typeof evExperimentIssuesSync==='function'&&experiment?evExperimentIssuesSync(experiment,run):run.issues||[]);
  const issues=[...new Map(source.filter(issue=>issue?.id).map(issue=>[issue.id,issue])).values()],count=status=>issues.filter(issue=>issue.status===status).length;
  const scope='当前问题范围内的台账问题，同一问题跨评测记录及补跑去重；不随问题列表状态、搜索或类型筛选改变。';
  return [
    {id:'issue-pending',label:'待修复问题数',value:count('待修复'),unit:'个',hint:'等待修复的问题。'+scope},
    {id:'issue-verifying',label:'待验证问题数',value:count('待验证'),unit:'个',hint:'修复后等待验证，或验证正在执行的问题。'+scope},
    {id:'issue-verified',label:'验证完成问题数',value:count('验证完成'),unit:'个',hint:'已完成独立问题验证，验证结果可为通过或未通过。'+scope},
    {id:'issue-closed',label:'已关闭问题数',value:count('已关闭'),unit:'个',hint:'已确认关闭的问题。'+scope}
  ];
}
function evDashboardSuiteMetrics(suites,cases,tasks){
  const count=items=>new Set((items||[]).map(item=>typeof item==='string'?item:item.id)).size;
  return [
    {id:'suite-total',label:'评测集数量',value:count(suites),unit:'个',hint:'当前统计范围内的评测集数量，按评测集编号去重。详情页只统计正在查看的评测集，数量为 1。'},
    {id:'suite-cases',label:'评测用例数',value:count((cases||[]).filter(item=>!item.archived)),unit:'个',hint:'当前统计范围内评测集关联且未归档的用例，按用例编号去重；包含启用和停用用例。'},
    {id:'suite-tasks',label:'覆盖业务任务数量',value:count(suites.flatMap(evSuiteCoveredTasks)),unit:'个',hint:'当前筛选后的评测集中，至少有一条未归档用例显式关联的业务任务，按任务编号去重。仅配置任务不计覆盖；包含停用用例。'}
  ];
}
function evDashboardTimeControl(scope){
  const selected=evDashboardRange(scope),label=evDashboardRanges.find(range=>range.id===selected)?.name||'全部时间范围';
  return `<details class="ev-period-selector" onkeydown="evDashboardMenuKey(event,this)"><summary class="ont-button" role="button" aria-expanded="false" aria-label="统计时间范围" aria-haspopup="menu"><span>${esc(label)}</span>${evDropdownArrow()}</summary><div class="ev-period-menu" data-ev-popover role="menu" aria-label="时间范围选项">${evDashboardRanges.map(range=>`<button type="button" role="menuitemradio" aria-checked="${range.id===selected}" class="${range.id===selected?'selected':''}" onclick="evDashboardSetRange(${esc(JSON.stringify(scope))},'${range.id}')">${esc(range.name)}</button>`).join('')}</div></details>`;
}
function evDashboardNumber(metric){
  if(metric.value===null||metric.value===undefined||!Number.isFinite(Number(metric.value)))return {value:'—',unit:''};
  const value=Number(metric.value);
  if(metric.format==='duration')return value<1000?{value:value.toLocaleString('zh-CN',{maximumFractionDigits:1}),unit:'ms'}:{value:(value/1000).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}),unit:'s'};
  if(metric.format==='rate')return {value:value.toFixed(1),unit:'%'};
  return {value:value.toLocaleString('zh-CN',{maximumFractionDigits:metric.digits||0}),unit:metric.unit||''};
}
function evDashboardCards(metrics){
  return `<div class="ev-dashboard-grid" data-metric-count="${metrics.length}" style="--ev-metric-count:${metrics.length}">${metrics.map(metric=>{const display=evDashboardNumber(metric);return `<article class="ev-stat-card" data-ev-metric="${esc(metric.id)}" aria-label="${esc(metric.label+'：'+display.value+display.unit)}"><div class="ev-stat-heading"><span>${esc(metric.label)}</span><span class="ev-stat-help"><button type="button" aria-label="${esc(metric.label)}统计口径">i</button><span role="tooltip">${esc(metric.hint||'')}</span></span></div><div class="ev-stat-number"><strong>${esc(display.value)}</strong>${display.unit?`<small>${esc(display.unit)}</small>`:''}</div></article>`;}).join('')}</div>`;
}
function evDashboardBar(scope,metrics,options={}){
  const context=options.contextHTML||'';
  return `<section class="ev-dashboard" id="ev-dashboard-${esc(scope.replace(/[^\w-]/g,'-'))}" data-ev-dashboard-scope="${esc(scope)}" aria-label="${metrics.length?'评测统计':'执行记录'}"><div class="ev-dashboard-toolbar"><div class="ev-dashboard-context">${context}</div></div>${metrics.length?evDashboardCards(metrics):''}</section>`;
}
function evDashboardRefresh(scope,metrics){
  const node=document.getElementById('ev-dashboard-'+scope.replace(/[^\w-]/g,'-')),cards=node?.querySelector?.('.ev-dashboard-grid');
  if(cards)cards.outerHTML=evDashboardCards(metrics);
}

function evDashboardMenuKey(event,menu){
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const buttons=[...menu.querySelectorAll('[role=menuitemradio]')];if(!buttons.length)return;
  if(!menu.open){menu.open=true;evPositionPopover(menu);}
  const current=buttons.indexOf(document.activeElement),index=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(current+1)%buttons.length:current<0?buttons.length-1:(current-1+buttons.length)%buttons.length;
  event.preventDefault();buttons[index]?.focus();
}
