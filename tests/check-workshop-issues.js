const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes=new Map();
const node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',querySelector(){return null;}});return nodes.get(id);};
const escape=value=>String(value??'').replace(/[&<>"']/g,value=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[value]));
class FormDataMock{constructor(form){this.values=form.values;}get(key){return this.values[key]??null;}}
let current=null,modal=null,notifications=[];
const context={evListFilters:{},evFilterHeader:label=>`<button aria-label="筛选${label}">${label}</button>`,evFilterMatch:(kind,key,value)=>!context.evListFilters[kind]?.[key]?.length||context.evListFilters[kind][key].includes(value),console,JSON,FormData:FormDataMock,studio:{scene:'sales'},evExperimentState:{runId:''},
  document:{getElementById:node,querySelector(){return null;}},esc:escape,evExperimentTime:()=> '2026-11-02 12:00:00',
  evExperimentCurrent:()=>current?.scene===context.studio.scene?current:null,
  evData:()=>({cases:(current?.runs||[]).flatMap(run=>run.results||[]).map(result=>({id:result.caseId,name:result.name,archived:false}))}),
  evDropdownArrow:()=>'<svg aria-hidden="true"></svg>',
  evMore:items=>`<details class="ev-more"><summary class="ont-link" role="button" aria-label="更多操作">更多</summary><div role="menu" aria-label="更多操作菜单">${items.map(item=>`<button type="button" role="menuitem" ${item.disabled?'disabled':''} onclick="${escape(item.code)}">${escape(item.label)}</button>`).join('')}</div></details>`,
  evExperimentRunGet:(experiment,id='')=>experiment.runs.find(run=>!id||run.id===id)||null,
  evExperimentText:value=>`<span>${escape(value||'—')}</span>`,
  evField:(label,control,hint='')=>`<label><span>${escape(label)}</span>${control}<small>${escape(hint)}</small></label>`,
  evTableContent:(headers,rows,empty)=>`<table><thead><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${rows.join('')||empty}</tbody></table>`,
  evTable:(headers,rows,empty,toolbar='')=>`<div class="toolbar">${toolbar}</div><div class="ev-table-content">${context.evTableContent(headers,rows,empty)}</div>`,
  evExperimentReplaceContent:(node,markup)=>node.innerHTML=markup,
  evModal:(title,body,footer,submit)=>modal={title,body,footer,submit},
  evCloseModal:()=>{modal=null;},toast:message=>notifications.push(message)};
vm.createContext(context);vm.runInContext(fs.readFileSync('dist/workshop-evaluation-issues.js','utf8'),context);
const run=code=>vm.runInContext(code,context),copy=value=>JSON.parse(JSON.stringify(value));
const result=(id,status,overrides={})=>({id,caseId:'SAL-EC-'+id,name:'评测用例 '+id,attempt:1,status,input:'测试输入',expected:'完整业务结果',actual:'缺少部分业务结果',evaluations:[],dimensions:[],...overrides});
const criterion=(name,passed)=>({name,passed,description:'完整输出规则',reason:'关键业务字段缺失'});
current={id:'SAL-EXP-001',scene:'sales',runs:[{id:'SAL-EXP-001-RUN-001',experimentId:'SAL-EXP-001',sequence:1,status:'已完成',startedAt:'2026-11-02 11:00:00',endedAt:'2026-11-02 11:01:00',results:[
  result('A','未通过',{evaluations:[{evaluatorId:'EV-1',name:'业务质量评估器',version:'V2',passed:false,criteria:[criterion('正确性',false),criterion('完整性',false),criterion('措辞',true)]},{evaluatorId:'EV-2',name:'合规评估器',version:'V1',passed:false,criteria:[criterion('风险提示',false)]}],dimensions:[{taskName:'业务任务',name:'约束覆盖',passed:false,description:'全部硬约束',reason:'缺少库存约束'}]}),
  result('B','运行失败',{reason:'库存查询工具超时'}),result('C','通过'),result('D','已跳过'),result('E','待运行'),result('F','运行中'),result('G','未通过',{reason:'预期字段未覆盖'})
]}]};
context.experiment=current;context.trial=current.runs[0];context.evExperimentState.runId=current.runs[0].id;
const originalResults=copy(current.runs[0].results);
assert.equal(run('evExperimentIssuesSync(experiment,trial).length'),0,'rendering an unanalysed execution does not create problems');
assert.equal(run('evExperimentDetectIssues(experiment,trial).length'),6,'pure detection can inspect all failed criteria without committing');
assert.equal(context.trial.issues.length,0);
assert.equal(run('evExperimentIssueAnalyzeComplete(experiment,trial).length'),6,'explicit completed analysis commits all candidates');
assert.equal(run('evExperimentIssuesSync(experiment,trial).length'),6,'sync must be idempotent');
assert.equal(run('new Set(trial.issues.map(issue=>issue.id)).size'),6);
assert.deepEqual(copy(current.runs[0].results),originalResults,'derivation must preserve original execution evidence');
assert.deepEqual(copy(run('evExperimentIssuesSummary(trial)')),{total:6,pending:6,verify:0,verified:0,closed:0});
const issues=current.runs[0].issues;
assert.equal(issues.filter(issue=>issue.type==='评估未达标').length,3,'independent evaluator findings stay separate');
assert.equal(issues.filter(issue=>issue.type==='运行异常')[0].severity,'高');
assert(!issues.some(issue=>['C','D','E','F'].includes(issue.resultId)),'healthy, skipped and unfinished executions create no issue');
assert(run('evExperimentIssuesView(experiment,null)').includes('问题台账跨评测记录及补跑'));
assert.equal(run('evExperimentIssueLedgerSync(experiment).length'),6);assert.equal(run('evExperimentIssueState.scope'),'all');assert(!Object.hasOwn(run('evExperimentIssueState'),'status'));
assert(run('evExperimentIssuesTable(experiment,trial)').includes('筛选状态'));
run('evListFilters.experimentIssue={status:["已关闭"]}');assert(run('evExperimentIssuesTable(experiment,trial)').includes('暂无匹配的问题'));
run('evListFilters.experimentIssue={};evExperimentIssueState.search="合规评估器"');
let filtered=run('evExperimentIssuesTable(experiment,trial,true)');assert(filtered.includes('风险提示')&&!filtered.includes('库存查询工具超时'));
run('evExperimentIssueState.search=""');
const rawFirst=issues[0],rawEvidence=copy(issues);context.issueId=rawFirst.id;const first=run('evExperimentIssueContext(experiment.id,trial.id,issueId).issue');
assert.equal(run('evExperimentIssueDetail(issueId)'),true);assert(modal.body.includes('问题根因')&&modal.body.includes('优化建议')&&!modal.body.includes('每次发现证据')&&!modal.body.includes('处理记录'));
const decode=code=>code.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
assert.doesNotThrow(()=>new Function(decode(modal.submit)),'modal submission handler must be valid JavaScript');
assert(!modal.submit||typeof modal.submit==='string');
for(const markup of [modal.body,run('evExperimentIssuesView(experiment,trial)')])for(const match of markup.matchAll(/(?:onclick|onchange|onsubmit|oninput)="([^"]*)"/g))assert.doesNotThrow(()=>new Function(decode(match[1])));
context.form={values:{scene:'sales',status:'待验证',note:'补充库存与渠道优先级规则'}};
assert.equal(run('evSaveExperimentIssue(form,experiment.id,trial.id,issueId)'),true);
assert.equal(first.status,'待验证');assert.equal(first.owner,undefined);assert.equal(first.history.length,2);assert(first.history[1].description.includes('待修复 → 待验证'));
run('evExperimentIssuesSync(experiment,trial)');assert.equal(first.note,'补充库存与渠道优先级规则','refresh retains handling notes');
assert.equal(run('evSaveExperimentIssue(form,experiment.id,trial.id,issueId)'),true);assert.equal(first.history.length,2,'unchanged save does not duplicate history');
const beforeInvalid=copy(first);context.form.values.status='自动完成';
assert.equal(run('evSaveExperimentIssue(form,experiment.id,trial.id,issueId)'),false);assert.deepEqual(copy(first),beforeInvalid,'invalid status must not partially mutate');
context.form.values.status='已关闭';first.rootCause='<script>unsafe</script>';context.form.values.note='补齐规则后复验';
assert.equal(run('evSaveExperimentIssue(form,experiment.id,trial.id,issueId)'),true);
assert(run('evExperimentIssuesTable(experiment,trial)').includes('&lt;script&gt;unsafe&lt;/script&gt;'));
assert.equal(run('evExperimentIssueLedgerSync(experiment).filter(issue=>issue.status==="已关闭").length'),1);assert.equal(run('evExperimentIssuesSummary(trial).closed'),0,'raw evidence keeps discovery state');
const newer={id:'SAL-EXP-001-RUN-002',experimentId:current.id,sequence:2,status:'运行中',startedAt:'2026-11-02 12:00:00',results:[result('NEW','运行中')]};
current.runs.unshift(newer);context.newer=newer;context.evExperimentState.runId=newer.id;
assert(run('evExperimentIssuesView(experiment,newer)').includes('问题台账跨评测记录及补跑'));assert.equal(newer.issues.length,0);assert.equal(run('evExperimentIssueScopeIssues(experiment).length'),6,'selecting case results from another batch retains all-batch problems');
assert.equal(run('evSaveExperimentIssue(form,experiment.id,trial.id,issueId)'),true,'ledger handling is independent of the case-result selected batch');
assert.equal(first.status,'已关闭');assert.equal(first.history.length,3);
newer.status='已停止';newer.results[0].status='已跳过';assert.equal(run('evExperimentIssueSetScope(experiment.id,newer.id)'),true);assert(run('evExperimentIssuesView(experiment,newer)').includes('运行结果分析或手工标注后'));assert.deepEqual(copy(issues),rawEvidence,'triage preserves original issue records');
context.studio.scene='procurement';context.evExperimentState.runId=current.runs[1].id;
assert.equal(run('evExperimentIssueDetail(issueId,trial.id,experiment.id)'),false,'foreign scene issues cannot be opened');
assert.equal(run('evSaveExperimentIssue(form,experiment.id,trial.id,issueId)'),false,'foreign scene issues cannot be edited');
assert.deepEqual(copy(current.runs[1].results),originalResults,'triage preserves execution results throughout status changes');
assert.deepEqual(copy(run('evExperimentIssuesSync(experiment,{experimentId:"foreign",results:[]})')),[]);
console.log('Workshop experiment issues checks passed.');
