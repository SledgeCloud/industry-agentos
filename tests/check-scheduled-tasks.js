const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes=new Map(),timers=[],collections=new Map();
const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',value:'',textContent:'',dataset:{},style:{},getBoundingClientRect(){return {left:20,bottom:40,height:240}},querySelectorAll(){return []},checked:false,classList:{add(){},toggle(){}},focus(){},setAttribute(){},toggleAttribute(){}});return nodes.get(s)};
const clockDate=new Date('2026-10-18T12:00:00Z');
class TestDate extends Date {constructor(...args){super(...(args.length?args:[clockDate.getTime()]))}static now(){return clockDate.getTime()}}
const sandbox={Date:TestDate,innerWidth:1280,innerHeight:720,console,notificationNav:()=>'',setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(id){timers[id-1]=()=>{}},document:{querySelector:node,querySelectorAll:selector=>collections.get(selector)||[],body:{classList:{remove(){},toggle(){}}}}};
vm.createContext(sandbox);vm.runInContext(script.slice(0,script.lastIndexOf('\nstate.composerSkill=null;')),sandbox);const run=s=>vm.runInContext(s,sandbox);
run("go('定时任务')");assert.equal(run('state.guiOpen'),true);assert.equal(run('state.selectedConversation'),null);
assert(!node('#nav').innerHTML.includes("newChat('scheduled'"));assert(!node('#nav').innerHTML.includes("openSession('scheduled'"));
assert.equal(run('state.tasks.length'),2);assert.equal((run('taskCards()').match(/class="scheduled-card"/g)||[]).length,2);
run("state.taskQuery='  核验项  '");assert.equal((run('taskCards()').match(/class="scheduled-card"/g)||[]).length,1);
run("state.taskQuery='无匹配'");assert(run('taskCards()').includes('没有符合条件'));
run("state.taskQuery='';toggleTaskSchedule(0);state.taskFilter='paused'");assert.equal((run('taskCards()').match(/class="scheduled-card"/g)||[]).length,1);assert(run('taskCards()').includes('暂停期间不执行'));
const seededSessions=run('state.sessions.length');assert.equal(run('state.tasks.every(t=>t.history.length===3)'),true);assert.equal(run('state.sessions.filter(s=>s.runId).length'),6);
run("state.taskFilter='all';runTask(0)");assert.equal(run('state.tasks[0].running'),true);assert.equal(run('state.page'),'定时任务');assert.equal(run('state.tasks[0].history.length'),4);assert.equal(run('state.sessions.length'),seededSessions+1);
run('runTask(0)');assert.equal(run('state.tasks[0].history.length'),4);
run('pauseTaskRun(0)');assert.equal(run('state.tasks[0].history[0].status'),'paused');assert.equal(run('state.tasks[0].running'),false);
run('runTask(0)');timers.slice().forEach(fn=>fn());assert.equal(run('state.tasks[0].history[0].status'),'completed');
run('showTaskHistory(0)');assert(node('#main').innerHTML.includes('已完成'));assert(node('#main').innerHTML.includes('已暂停'));
assert.equal(node('#overlay').innerHTML,'');assert.equal(run('state.taskDetail===state.tasks[0]'),true);
assert(node('#main').innerHTML.includes('返回定时任务'));assert(!node('#main').innerHTML.includes('role="dialog"'));
run('runTask(0)');assert(node('#main').innerHTML.includes('执行中'));run('pauseTaskRun(0)');assert(node('#main').innerHTML.includes('已暂停'));
run('backToTaskList()');assert.equal(run('state.taskDetail'),null);
const cards=run('taskCards()');assert(cards.includes('role="switch"'));assert(cards.includes('showTaskHistory(0)'));assert(!cards.includes('scheduled-icon'));assert(!cards.includes('<dt>'));
assert(!cards.includes('下一次执行时间'));assert.equal(run("taskScheduleLine({time:'09:00',freq:'每天'},new Date('2026-10-18T00:00:00Z'))").includes('1小时后执行'),true);
run("state.taskFilter='paused';state.taskQuery='成本';showTaskHistory(0);backToTaskList()");assert.equal(run('state.taskFilter'),'paused');assert.equal(run('state.taskQuery'),'成本');
run("showTaskHistory(0);go('成本分析')");assert.equal(run('state.taskDetail'),null);run("go('定时任务');state.taskQuery='';state.taskFilter='all'");
assert.equal(run("nextTaskRun({time:'08:00',freq:'每周一'},new Date('2026-10-18T12:00:00Z'))"),'2026-10-19 08:00');
assert.equal(run("nextTaskRun({time:'08:00',freq:'每周一'},new Date('2026-10-19T01:00:00Z'))"),'2026-10-26 08:00');
run('createTaskManually()');assert(node('#overlay').innerHTML.includes('创建定时任务'));
for(const id of ['taskName','taskDescription','taskPrompt','taskModel','taskFreq','taskTime','taskInputs','taskWorkspace','outputEnabled','taskOutputs'])assert(node('#overlay').innerHTML.includes('id="'+id+'"'));
node('#taskName').value='测试任务';node('#taskPrompt').value='每日分析会话';node('#taskModel').value='deepseek-v4.1-flash';node('#taskTime').value='09:30';node('#taskFreq').value='daily';
run('saveTask(-1,false)');assert.equal(run('state.tasks.length'),3);assert(run('taskCards()').includes('测试任务'));
run("editTask(2)");node('#taskName').value='更新后的任务';run('saveTask(2,false)');assert.equal(run('state.tasks[2].name'),'更新后的任务');
run("state.tasks[2].description='<img src=x onerror=alert(1)>'");assert(!run('taskCards()').includes('<img src=x'));
run('runTask(2);deleteTask(2)');timers.slice().forEach(fn=>fn());assert.equal(run('state.tasks.length'),2);
for(const output of [run('scheduledTasksPage()'),run('showTaskHistory(0);scheduledTaskDetail()')])for(const match of output.matchAll(/on(?:click|input|keydown)="([^"]*)"/g))new Function(match[1].replaceAll('&quot;','"'));
// Scheduling UI omits the raw zone label; other modules may use it for date formatting.
for(const view of [run('taskCards()'),run('scheduledTasksPage()')])assert(!view.includes('Asia'+'/Shanghai'));
assert(!fs.readFileSync('dist/index.html','utf8').match(/<header\b[\s\S]*?<\/header>/)[0].includes('Asia'+'/Shanghai'));
assert(!html.includes('background:#2d3035'));assert(!html.includes('background:#2e3238'));assert(!html.includes('background:#35393f'));
// Every run opens its own workspace conversation and independent artifact snapshot.
run('closeModal();showTaskHistory(0)');assert(node('#main').innerHTML.includes('run-result-card'));assert(!node('#main').innerHTML.includes('task-history-table'));
for(const taskIndex of [0,1]){
 const ids=run(`state.tasks[${taskIndex}].history.map(r=>r.id)`);
 for(const id of ids){
  run(`openTaskRun('${id}')`);assert.equal(run('state.mode'),'workspace');assert.equal(run('state.selectedConversation.kind'),'workspace');assert.equal(run('state.sessions[state.selectedConversation.index].runId'),id);
  assert(node('#messages').innerHTML.includes('执行过程'));assert(node('#messages').innerHTML.includes('执行结果'));assert(node('#messages').innerHTML.includes('生成的产出物'));
  const count=run(`findTaskRun('${id}').artifactIds.length`),status=run(`findTaskRun('${id}').status`);
  assert.equal(count>0,status==='completed');
  for(const artifact of run(`taskRunArtifacts(findTaskRun('${id}'))`)){
   assert.equal(artifact.runId,id);assert.equal(artifact.runSnapshot,true);if(artifact.rows!=='文件')assert.equal(artifact.data.length,Number(artifact.rows));else assert.equal(artifact.rows,'文件');assert(node('#messages').innerHTML.includes(artifact.name));
  }
 }
}
const previous=run('state.sessions[state.selectedConversation.index].id');run("state.tasks[0].paused=false;checkScheduledTasks(new Date('2026-10-19T00:00:00Z'))");
assert.equal(run('state.sessions[state.selectedConversation.index].id'),previous,'Background triggers must preserve the active workspace conversation');
assert.equal(run('state.tasks[0].history[0].trigger'),'定时触发');const scheduledCount=run('state.tasks[0].history.length');run("checkScheduledTasks(new Date('2026-10-19T00:00:15Z'))");assert.equal(run('state.tasks[0].history.length'),scheduledCount);
run('openTaskRun(state.tasks[0].history[0].id)');assert(node('#messages').innerHTML.includes('执行中'));timers.slice().forEach(fn=>fn());assert(node('#messages').innerHTML.includes('本次执行产出'));
assert.equal(run('state.tasks[0].history[0].status'),'completed');assert.equal(run('state.sessions[state.selectedConversation.index].runRecord.status'),'completed');
const firstOutput=run('state.tasks[0].history[0].artifactIds[0]');run("state.tasks[0].outputs[0].name='修改后的输出名'");assert.notEqual(run(`arts.find(a=>a.id==='${firstOutput}').name`),'修改后的输出名');
run('showTaskHistory(1)');const failed=run("state.tasks[1].history.find(r=>r.status==='failed').id");run(`openTaskRun('${failed}')`);assert(node('#messages').innerHTML.includes('会话数据读取超时'));assert(node('#messages').innerHTML.includes('本次没有生成产出物'));
// The default creation action uses the task Skill in a fresh AI conversation.
run('focusPromptEnd=()=>{};createTaskWithAI()');assert.equal(run('state.draft'),true);assert.equal(run('state.composerSkill'),'定时任务');assert.equal(run('state.cuiOpen'),true);run("go('定时任务')");
assert(!run('scheduledTasksPage()').includes('通过 Skill 创建'));assert(run('scheduledTasksPage()').includes('task-create-split'));assert(run('scheduledTasksPage()').includes('AI 创建'));
// Repetition is shared by the editor, next-time preview and scheduler.
assert.equal(run("nextTaskRun({schedule:{repeat:'interval',intervalHours:5,intervalAnchor:'2026-10-18T08:00'}},new Date('2026-10-18T01:30:00Z'))"),'2026-10-18 13:00');
assert.equal(run("nextTaskRun({schedule:{repeat:'weekly',weekdays:[1,3,7],time:'09:20'}},new Date('2026-10-18T00:00:00Z'))"),'2026-10-18 09:20');
assert.equal(run("nextTaskRun({schedule:{repeat:'monthly',monthdays:[1,15,31],time:'09:20'}},new Date('2026-01-31T02:00:00Z'))"),'2026-02-01 09:20');
assert.equal(run("nextTaskRun({schedule:{repeat:'monthly',monthdays:[31],time:'09:20'}},new Date('2026-01-31T02:00:00Z'))"),'2026-03-31 09:20');
assert.equal(run("taskScheduleMatches({schedule:{repeat:'weekly',weekdays:[1,3,7],time:'09:20'}},new Date('2026-10-18T01:20:00Z'))"),true);
assert.equal(run("taskScheduleMatches({schedule:{repeat:'monthly',monthdays:[1,15],time:'09:20'}},new Date('2026-10-18T01:20:00Z'))"),false);
run('createTaskManually()');assert(!node('#overlay').innerHTML.includes('scriptFile'));assert(!node('#overlay').innerHTML.includes('按任务配置执行'));assert(!node('#overlay').innerHTML.includes('<details'));assert(!node('#overlay').innerHTML.includes('其他信息'));assert(node('#overlay').innerHTML.includes('Markdown 编辑器'));
assert(!run("taskOutputFields({type:'表',name:'test',schema:'id: string'})").includes('output-format'));assert(!run("taskOutputFields({type:'文件',name:'报告',format:'Markdown'})").includes('output-schema-text'));
assert(!run("taskOutputFields({type:'文件',name:'报告'})").includes('路径'));assert(run("taskOutputFields({type:'文件',name:'报告'})").includes('文档名称'));assert(run('taskOutputRow()').includes('数据表'));
node('#taskName').value='仅基础信息任务';node('#taskDescription').value='每天整理运行质量';node('#taskPrompt').value='';node('#taskModel').value='kimi-k3';node('#taskFreq').value='daily';node('#taskTime').value='09:30';node('#taskWorkspace').value='';node('#outputEnabled').checked=false;
run('saveTask(-1,false)');assert.equal(run('state.tasks.at(-1).prompt'),'每天整理运行质量');assert.equal(run('state.tasks.at(-1).workspace'),null);run('runTask(state.tasks.length-1)');assert.equal(run('state.sessions[0].workspace'),null);assert(run('taskWorkspaceNavigation()').includes('默认工作区'));assert(!run('taskWorkspaceNavigation()').includes('未归属工作区的会话'));
run('pauseTaskRun(state.tasks.length-1);createTaskManually()');node('#taskWorkspace').value=run('state.folders.workspace[0]');run('saveTask(-1,false);runTask(state.tasks.length-1)');assert.equal(run('state.sessions[0].workspace'),run('state.folders.workspace[0]'));
assert(!run("taskMarkdown('<script>alert(1)</script>')").includes('<script>'));assert(run("taskMarkdown('# 标题\\n**重点**')").includes('<strong>重点</strong>'));
for(const output of [run('taskRepeatFields(taskRepeat({freq:"每小时"}))'),run('taskRepeatFields(taskRepeat({freq:"每周"}))'),run('taskRepeatFields(taskRepeat({freq:"每月"}))'),node('#overlay').innerHTML])for(const match of output.matchAll(/on(?:click|input|change)="([^"]*)"/g))new Function(match[1].replaceAll('&quot;','"'));
// File outputs remain documents after saving a template and generating a run snapshot.
run("pauseTaskRun(state.tasks.length-1);state.tasks.push({name:'文档输出测试',description:'生成文档',prompt:'生成复盘文档',model:composerModels[0],workspace:null,output:true,outputs:[{type:'文件',name:'运行质量简报',format:'Markdown'}],schedule:{repeat:'daily',time:'09:00'},time:'09:00',freq:'每天'});syncTaskArtifacts(state.tasks.at(-1),state.tasks.length-1);runTask(state.tasks.length-1)");timers.slice().forEach(fn=>fn());
assert.equal(run('taskRunArtifacts(state.tasks.at(-1).history[0])[0].kind'),'file');assert.equal(run('taskRunArtifacts(state.tasks.at(-1).history[0])[0].rows'),'文件');assert.equal(run('taskRunArtifacts(state.tasks.at(-1).history[0])[0].workspace'),null);assert.equal(run('taskRunArtifacts(state.tasks.at(-1).history[0])[0].cols[0]'),'章节');
run("state.tasks.push({name:'数据表输出测试',description:'生成表',prompt:'整理运行质量',model:composerModels[0],workspace:null,output:true,outputs:[{type:'表',name:'quality_summary',schema:'date: date\\ncount: integer\\nsummary: string'}],schedule:{repeat:'daily',time:'09:00'},time:'09:00',freq:'每天'});syncTaskArtifacts(state.tasks.at(-1),state.tasks.length-1);runTask(state.tasks.length-1)");timers.slice().forEach(fn=>fn());
assert.equal(run('taskRunArtifacts(state.tasks.at(-1).history[0])[0].cols.join()'),'date,count,summary');assert.equal(run('taskRunArtifacts(state.tasks.at(-1).history[0])[0].data[0][1]'),48);
assert.equal(run("taskSchemaFields('{\"type\":\"object\",\"properties\":{\"amount\":{\"type\":\"number\"}}}')[0][1]"),'amount');
// Cascading weekday/month choices keep multi-selection while using one compact control.
run('createTaskManually()');node('#taskFreq').value='daily';run("chooseTaskRepeat('weekly');toggleTaskRepeatChoice('weekly',3);toggleTaskRepeatChoice('weekly',5)");assert.equal(run('state.taskEditorSchedule.weekdays.join()'),'1,3,5');assert(run('taskRepeatMenu()').includes('role="menuitemcheckbox"'));
run("chooseTaskRepeat('monthly');toggleTaskRepeatChoice('monthly',15);toggleTaskRepeatChoice('monthly',31)");assert.equal(run('state.taskEditorSchedule.monthdays.join()'),'1,15,31');assert(node('#overlay').innerHTML.includes('task-settings-row'));
assert.equal(run("nextTaskRun({schedule:{repeat:'interval',intervalHours:5,intervalAnchor:'2026-10-18T22:00'}},new Date('2026-10-18T15:00:00Z'))"),'2026-10-19 03:00');
assert.equal(run("taskScheduleMatches({schedule:{repeat:'interval',intervalHours:5,intervalAnchor:'2026-10-18T08:00'}},new Date('2026-10-18T05:00:30Z'))"),true);
assert.equal(run("taskScheduleMatches({schedule:{repeat:'interval',intervalHours:5,intervalAnchor:'2026-10-18T08:00'}},new Date('2026-10-18T00:00:00Z'))"),false);
assert.equal(run("scheduleIsValid({repeat:'interval',intervalHours:0,intervalAnchor:'2026-10-18T08:00'})"),false);
assert.equal(run("scheduleIsValid({repeat:'interval',intervalHours:1.5,intervalAnchor:'2026-10-18T08:00'})"),false);
assert.equal(run("nextTaskRun({schedule:{repeat:'once',onceAt:'2026-11-01T09:30'}},new Date('2026-10-18T00:00:00Z'))"),'2026-11-01 09:30');
assert.equal(run("scheduleIsValid({repeat:'once',onceAt:'2026-02-31T09:30'})"),false);assert.equal(run("scheduleIsValid({repeat:'once',onceAt:'2026-10-17T09:30'})"),false);
run('createTaskManually()');node('#taskFreq').value='once';node('#taskOnceAt').value='2026-11-01T09:30';node('#taskName').value='单次执行验证';node('#taskDescription').value='仅执行一次';node('#taskPrompt').value='';node('#taskModel').value='kimi-k3';node('#taskWorkspace').value='';node('#outputEnabled').checked=false;
run('saveTask(-1,false)');assert.equal(run('state.tasks.at(-1).freq'),'单次');assert.equal(run('state.tasks.at(-1).schedule.onceAt'),'2026-11-01T09:30');
clockDate.setTime(new Date('2026-11-01T01:30:00Z').getTime());run('checkScheduledTasks(new Date())');assert.equal(run('state.tasks.at(-1).history.length'),1);assert.equal(run('state.sessions.some(s=>s.runId===state.tasks.at(-1).history[0].id)'),true);
clockDate.setTime(clockDate.getTime()+8000);timers.slice().forEach(fn=>fn());run('checkScheduledTasks(new Date())');assert.equal(run('state.tasks.at(-1).completedOnce'),true);assert.equal(run('state.tasks.at(-1).history.length'),1);assert.equal(run('nextTaskRun(state.tasks.at(-1))'),'已执行完成');
run("state.taskCalendarDraft={date:'2026-11-02',hour:9,minute:30};state.taskCalendarMonth='2026-11'");const calendar=run('taskCalendarHTML()');assert(calendar.includes('aria-label="2026-11-02"'));assert(calendar.includes('执行年月'));assert(calendar.includes('选择分'));assert(calendar.includes('确认'));
for(const output of [run('taskRepeatMenu()'),calendar])for(const match of output.matchAll(/on(?:click|input|change|mouseenter)=\"([^\"]*)\"/g))new Function(match[1].replaceAll('&quot;','\"'));
// The execution-history page owns a complete artifact list and an independent inline preview.
run('closeModal();showTaskHistory(0)');
assert(node('#main').innerHTML.includes('该任务的全部产出物'));assert(node('#main').innerHTML.includes('task-detail-body'));
assert(run('taskProducedArtifacts(state.tasks[0]).some(a=>a.runSnapshot&&a.kind===\'file\')'));assert(!run('taskProducedArtifacts(state.tasks[0]).some(a=>a.runSnapshot&&taskArtifactKind(a)===\'table\')'));assert(run('taskProducedArtifacts(state.tasks[0]).includes(arts[0])'));
assert(!run('taskProducedArtifacts(state.tasks[0]).includes(arts[1])'));assert(run('taskProducedArtifacts(state.tasks[0]).every(a=>!a.templateOnly)'));
const previewIndex=run('arts.indexOf(taskRunArtifacts(state.tasks[0].history.find(r=>r.status===\'completed\'))[0])');
node('#main').scrollTop=230;run('state.detail=123;openTaskArtifactPreview('+previewIndex+')');
assert.equal(run('state.page'),'定时任务');assert.equal(run('state.detail'),123);assert.equal(node('#main').scrollTop,230);assert.equal(node('#overlay').innerHTML,'');
assert(!node('#taskArtifactPreviewHost').innerHTML.includes('来源执行'));assert(!node('#taskArtifactPreviewHost').innerHTML.includes('task-preview-footer'));assert(node('#taskArtifactPreviewHost').innerHTML.includes('产出物预览'));assert(node('#taskArtifactPreviewHost').innerHTML.includes('artifact-data-table'));
run("setTaskArtifactPreviewTab('schema')");assert(node('#taskArtifactPreviewHost').innerHTML.includes('schema-table'));run("setTaskArtifactPreviewTab('content');showTaskArtifactRow(0)");assert(node('#taskArtifactPreviewHost').innerHTML.includes('第 1 条记录'));
run('openTaskArtifactPreview(1)');assert.equal(run('arts.indexOf(state.taskArtifactPreview.artifact)'),previewIndex,'Another task artifact cannot open in this preview');
assert(run('taskHistoryCards(state.tasks[0].history)').includes('openTaskArtifactPreview('));assert(run('runArtifactCard(arts[0])').includes('openArt(0)'));
run('closeTaskArtifactPreview()');assert.equal(node('#taskArtifactPreviewHost').innerHTML,'');assert.equal(run('state.taskArtifactPreview'),null);assert.equal(node('#main').scrollTop,230);
const beforeArtifacts=run('taskProducedArtifacts(state.tasks[0]).length');run('runTask(0)');timers.slice().forEach(fn=>fn());assert.equal(run('taskProducedArtifacts(state.tasks[0]).length'),beforeArtifacts+1);assert(node('#main').innerHTML.includes('全部产出物 <small>'+(beforeArtifacts+1)));
run("showTaskHistory(state.tasks.findIndex(t=>t.name==='文档输出测试'));openTaskArtifactPreview(arts.indexOf(taskProducedArtifacts(state.taskDetail)[0]))");assert(node('#taskArtifactPreviewHost').innerHTML.includes('task-preview-document'));assert(node('#taskArtifactPreviewHost').innerHTML.includes('运行质量简报'));assert(!node('#taskArtifactPreviewHost').innerHTML.includes('表结构'));
assert(run("taskArtifactDocument({name:'JSON output',schema:'JSON · result',data:[['count',0],['ok',false]]})").includes('&quot;ok&quot;: false'));
assert(run("taskArtifactDocument({name:'CSV output',schema:'CSV · result',cols:['count','ok'],data:[[0,false]]})").includes('<td>false</td>'));
assert(run("taskArtifactTable({cols:['count','ok','text'],data:[[0,false,'<script>bad</script>']]},0)").includes('<dd>0</dd>'));assert(run("taskArtifactTable({cols:['count','ok','text'],data:[[0,false,'<script>bad</script>']]},0)").includes('<dd>false</dd>'));assert(!run("taskArtifactTable({cols:['text'],data:[['<script>bad</script>']]},0)").includes('<script>'));
const previewMarkup=run('taskArtifactPreviewHTML()');run('backToTaskList()');assert.equal(run('state.taskArtifactPreview'),null);
run('showTaskHistory(state.tasks.length-1)');assert.equal(run('taskProducedArtifacts(state.taskDetail).length'),0);assert(run('taskArtifactSidebar(state.taskDetail)').includes('暂无产出物'));run('go(\'定时任务\');openTaskArtifactPreview(0)');assert.equal(run('state.taskArtifactPreview'),null);
for(const output of [run('taskArtifactSidebar(state.tasks[0])'),previewMarkup,run('taskHistoryCards(state.tasks[0].history)')])for(const match of output.matchAll(/on(?:click|keydown)="([^"]*)"/g))new Function(match[1].replaceAll('&quot;','"'));
console.log('Passed: task-scoped artifact sidebar, inline table/schema/document previews, record fields and escaping, no route or scroll changes, empty states and automatic refresh after execution.');

console.log('Passed: task management, per-run sessions/artifacts, split AI/manual creation, Markdown, output-specific forms, document snapshots, workspace routing, and compact cascading schedules, multi-select recurrence, hour intervals, one-time date/time, and single-run completion.');
