const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const escape=value=>String(value??'').replace(/[&<>"']/g,value=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[value]));
let modal=null,openedCase=null,newCase=null,clipboard=null,notifications=[];
const sample={id:'CASE-1',name:'库存边界',input:'输入 <script>alert(1)</script>',expected:'预期\n完整输出',inputAttachments:[]};
const result={id:'ROOT-CASE-1-A1',caseId:sample.id,name:sample.name,input:sample.input,expected:sample.expected,actual:'实际\n输出',status:'未通过',attempt:1};
const root={id:'ROOT',experimentId:'EXP',kind:'full',sequence:3,results:[result],snapshot:{agent:{version:'V3'},cases:[sample]},issues:[]};
const issue={id:'ISSUE-1',code:'ISS-001',name:'业务正确性不足',rule:'业务正确性',rootCause:'缺少明确库存约束\n<script>unsafe</script>',suggestion:'补齐库存上下文\n验证边界',sourceKind:'ai',sourceLabel:'AI分析',type:'评估未达标',severity:'中',status:'待验证',caseId:sample.id,caseName:sample.name,owner:'张三',lastSeenAt:'2026-11-07 15:00:00',occurrences:[{runId:root.id,recordId:root.id,resultId:result.id,rawIssueId:'RAW-1',sequence:3}],verifications:[{runId:root.id,recordId:root.id,resultId:result.id,sequence:3,attempt:1,time:'2026-11-07 16:00:00',status:'验证未通过',passed:false},{runId:'ROOT-SUP-1',recordId:root.id,parentRunId:root.id,kind:'supplement',supplementSequence:1,resultId:'ROOT-SUP-1-CASE-A2',sequence:3,attempt:2,time:'2026-11-07 16:30:00',status:'验证通过',passed:true}],history:[]};
root.issues=[{id:'RAW-1',resultId:result.id}];
const experiment={id:'EXP',scene:'sales',runs:[root],issueLedger:[issue]};
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',classList:{add(){}},querySelector(){return null;}});return elements.get(id);};
const context={evListFilters:{},evFilterHeader:label=>`<button aria-label="筛选${label}">${label}</button>`,evFilterMatch:(kind,key,value)=>!context.evListFilters[kind]?.[key]?.length||context.evListFilters[kind][key].includes(value),console,JSON,Date,studio:{scene:'sales'},evExperimentState:{runId:root.id},document:{getElementById:element,querySelector(){return element('modal');}},navigator:{clipboard:{async writeText(value){clipboard=value;}}},
 esc:escape,evExperimentTime:()=> '2026-11-07 17:00:00',toast:value=>notifications.push(value),evExperimentCurrent:()=>experiment,
 evExperimentRunGet:(exp,id)=>exp.runs.find(run=>!id||run.id===id),evData:()=>({cases:[sample]}),evVersionClone:value=>JSON.parse(JSON.stringify(value)),
 evDropdownArrow:()=>'<svg></svg>',evMore:items=>`<details class="ev-more"><summary class="ont-link" role="button" aria-label="更多操作">更多</summary><div aria-label="更多操作菜单">${items.map(item=>`<button onclick="${item.code}">${item.label}</button>`).join('')}</div></details>`,evCaseDetail:id=>openedCase=id,evEditCase:(...args)=>newCase=args,evCloseModal:()=>{modal=null;},
 evModal:(title,body,footer,submit,heading)=>modal={title,body,footer,submit,heading},evExperimentReplaceContent:(node,markup)=>node.innerHTML=markup,
 evTableContent:(headers,rows,empty)=>`<table><thead><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr></thead><tbody>${rows.join('')||empty}</tbody></table>`,
 evTable:(headers,rows,empty,toolbar='')=>`<div>${toolbar}</div>${context.evTableContent(headers,rows,empty)}`};
context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('dist/workshop-evaluation-issues.js','utf8'),context);
context.experiment=experiment;context.issue=issue;
const run=source=>vm.runInContext(source,context),decode=value=>value.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
run('evExperimentIssueLedgerSync=function(){return experiment.issueLedger;}');
let table=run('evExperimentIssuesTable(experiment)');
for(const label of ['问题编号','问题名称','评测记录','关联用例','问题根因'])assert(table.includes('<th>'+label+'</th>'));
assert(!table.includes('出现记录 / 次数'));assert(!table.includes('<small')&&!table.includes('<br'),'list rows remain single-line');
assert(table.includes('evExperimentIssueOpenCase')&&table.includes('CASE-1')&&table.includes('库存边界'),'case links identify and open their resource');
assert(table.includes('重新修复')&&table.includes('查看')&&table.includes('验证'),'repaired issues expose verification alongside repair and view');
assert(table.includes('&lt;script&gt;unsafe&lt;/script&gt;')&&!table.includes('<script>'),'root cause is safely escaped');
assert(run('evExperimentIssueDetail(issue.id,"all",experiment.id)'));
assert(modal.heading.includes('问题状态')&&modal.heading.includes('待验证')&&modal.heading.includes('问题总览'));
assert(modal.heading.includes('优化用例')&&modal.heading.includes('新增用例')&&modal.heading.includes('优化关联用例')&&modal.heading.includes('evExperimentIssueCreateCase'));
assert(modal.body.includes('ev-issue-detail-two-columns')&&modal.body.includes('问题根因与优化建议')&&modal.body.includes('问题输入与输出'));
for(const label of ['问题根因','优化建议','输入','预期结果','实际结果','验证记录','查看验证详情'])assert(modal.body.includes(label));
assert(modal.body.includes('复制问题根因')&&modal.body.includes('复制优化建议')&&!modal.body.includes('问题原因'));
assert(modal.body.includes('ev-issue-detail-card is-root-cause')&&modal.body.includes('ev-issue-detail-card is-suggestion'),'cause and suggestion use distinct card treatments');
assert.equal((modal.body.match(/<li class="ev-issue-detail-validation">/g)||[]).length,2,'each validation remains a separate list item');
assert(modal.body.includes('<ol class="ev-issue-detail-validation-list" aria-label="验证记录">'));
assert(modal.body.indexOf('验证 #2')<modal.body.indexOf('验证 #1'),'validation items show newest first while retaining their sequence');
assert(modal.body.includes('ev-issue-detail-validation-status is-failed')&&modal.body.includes('ev-issue-detail-validation-status is-passed'));
assert(modal.body.includes('验证编号')&&modal.body.includes('ROOT-SUP-1')&&modal.body.includes('第 2 次')&&modal.body.includes('2026-11-07 16:30:00'),'each item identifies its record, attempt and timestamp');
assert(!modal.body.includes('每次发现证据')&&!modal.body.includes('处理记录')&&!modal.body.includes('复验记录'));
assert(modal.body.includes('验证未通过'),'failed validation is retained and shown honestly');
assert(modal.body.includes('&lt;script&gt;alert(1)&lt;/script&gt;')&&!modal.body.includes('<script>'));
for(const html of [table,modal.body,modal.heading])for(const match of html.matchAll(/(?:onclick|onchange|oninput)="([^"]*)"/g))assert.doesNotThrow(()=>new Function('event',decode(match[1])));
run('evExperimentIssueOpenCase(experiment.id,issue.id,"all")');assert.equal(openedCase,sample.id);
const before=JSON.stringify(result);const draft=run('evExperimentIssueCreateCase(experiment.id,issue.id,"all")');
assert.equal(newCase[0],'');assert.equal(newCase[1],'');assert.equal(draft.input,sample.input);assert.equal(draft.expected,sample.expected);assert.equal(newCase[3].title,'从问题新增用例');assert.equal(newCase[3].sourceIssueId,issue.id);assert.equal(newCase[3].requireSuite,true);
draft.input='可编辑的新输入';assert.equal(JSON.stringify(result),before,'editing a proposed regression case cannot rewrite execution evidence');
(async()=>{
 assert(await run('evExperimentIssueCopy(experiment.id,issue.id,"reason","all")'));assert.equal(clipboard,issue.rootCause);assert.equal(notifications.at(-1),'问题根因已复制');
 assert(await run('evExperimentIssueCopy(experiment.id,issue.id,"suggestion","all")'));assert.equal(clipboard,issue.suggestion);
 context.studio.scene='procurement';assert.equal(run('evExperimentIssueCreateCase(experiment.id,issue.id,"all")'),false,'foreign scene cannot create from stale evidence');
 console.log('PASS one-line issue list, dual-column review, safe copy, validation details and editable regression-case prefill');
})().catch(error=>{console.error(error);process.exitCode=1;});
