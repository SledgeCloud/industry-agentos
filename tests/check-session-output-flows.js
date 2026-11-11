const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes=new Map(),collections=new Map(),timers=[];
const node=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'',checked:false,dataset:{},style:{},scrollTop:0,classList:{add(){},remove(){},toggle(){}},querySelectorAll(){return []},focus(){},setAttribute(){},toggleAttribute(){}});return nodes.get(s)};
const sandbox={console,notificationNav:()=>'',setTimeout(fn){timers.push(fn);return timers.length},clearTimeout(id){timers[id-1]=()=>{}},document:{activeElement:{focus(){}},querySelector:node,querySelectorAll:s=>collections.get(s)||[],body:{classList:{remove(){},toggle(){}}}}};
vm.createContext(sandbox);vm.runInContext(script.slice(0,script.lastIndexOf('\nstate.composerSkill=null;')),sandbox);
const run=s=>vm.runInContext(s,sandbox),read=s=>JSON.parse(run(`JSON.stringify(${s})`)),finish=()=>timers.splice(0).forEach(fn=>fn());

// Picks persist across keyword and workspace changes, including hidden selections.
run("state.folders.workspace.push('运营复盘');state.sessions.push({name:'独立工作区会话',workspace:'运营复盘'});state.refs=['Agent'];searchSessions();toggleSessionReference(sessionRef(observedSessions[0]),true);state.sessionReferenceWorkspace='运营复盘';filterSessions('独立');toggleSessionReference('独立工作区会话',true)");
assert(node('#sessionResults').innerHTML.includes('独立工作区会话'));assert(!node('#sessionResults').innerHTML.includes('CR-1024'));
assert.equal(run('state.sessionReferenceSelection.length'),2);
run("state.sessionReferenceWorkspace='';filterSessions('CR-1024')");assert(node('#sessionResults').innerHTML.includes('checked'));
run('commitSessionReferences()');assert.deepEqual(read('state.refs'),['Agent',run('sessionRef(observedSessions[0])'),'独立工作区会话']);
run("searchSessions();toggleSessionReference('独立工作区会话',false);commitSessionReferences()");assert.equal(run("state.refs.includes('独立工作区会话')"),false);
run("searchSessions();filterSessions('不存在')");assert(node('#sessionResults').innerHTML.includes('未找到会话'));assert.equal(run('state.sessionReferenceSelection.length'),1);

// Existing tables use stable IDs and their own schema; new tables require a name.
const choices=read('taskTableChoices().map(a=>a.id)');assert.equal(choices.length,4);assert.equal(new Set(choices).size,choices.length);
assert(run("taskOutputFields({type:'表',tableId:arts[0].id})").includes('readonly'));
assert(!run("taskOutputFields({type:'表',tableId:arts[0].id})").includes('class="output-name"'));
assert(run("taskOutputFields({type:'表'})").includes('输入新数据表名称'));
const rowValues={'.output-kind':{value:'表'},'.output-table-target':{value:run('arts[0].id')},'.output-schema-text':{value:''},'.output-update-mode':{value:'overwrite'}};
sandbox.outputRow={dataset:{outputId:'stable-output'},querySelector:s=>rowValues[s]||null};
collections.set('#taskOutputs .task-output-row',[sandbox.outputRow]);const picked=read('readTaskOutputs()[0]');assert.equal(picked.tableId,run('arts[0].id'));assert.equal(picked.name,run('arts[0].name'));assert.equal(picked.schema,run('arts[0].schema'));assert.equal(picked.updateMode,'overwrite');collections.delete('#taskOutputs .task-output-row');

// Repeated executions produce one current table plus independent document files.
run("state.tasks.push({name:'数据与文档联动验证',prompt:'整理每日运行质量',description:'Mock',workspace:null,output:true,outputs:[{type:'表',name:'daily_quality',schema:'date: date\\ncount: integer\\nok: boolean\\nnote: string',updateMode:'incremental'},{type:'文件',name:'运行质量简报',format:'Markdown'}]});var customTask=state.tasks.at(-1);var customIndex=state.tasks.length-1;syncTaskArtifacts(customTask,customIndex);runTask(customIndex)");finish();
const firstRun=run('customTask.history[0].id'),firstSnapshot=read('taskRunArtifacts(customTask.history[0])[0]'),tableId=run('customTask.outputs[0].tableId');
assert(tableId);assert.equal(run('taskProducedArtifacts(customTask).length'),2);
run('runTask(customIndex)');finish();
assert.equal(run('customTask.history.length'),2);assert.equal(run('taskProducedArtifacts(customTask).filter(a=>taskArtifactKind(a)===\'table\').length'),1);assert.equal(run('taskProducedArtifacts(customTask).filter(a=>taskArtifactKind(a)===\'file\').length'),2);
assert.equal(run('arts.find(a=>a.id===customTask.outputs[0].tableId).data.length'),2,'Incremental writes preserve rows from both executions');
assert.deepEqual(read(`taskRunArtifacts(findTaskRun('${firstRun}'))[0].data`),firstSnapshot.data,'Historical batch data remains independent');
assert(!run("artifactScopeIndices('定时任务').some(i=>arts[i].runSnapshot&&taskArtifactKind(arts[i])==='table')"));
assert.equal(run('taskTableChoices().filter(a=>a.id===customTask.outputs[0].tableId).length'),1);assert.equal(run("dashboardSources().filter(s=>s.name==='daily_quality').length"),1);

// Another task can update that same historical table without making another asset.
run("state.tasks.push({name:'复用历史表',prompt:'更新已有表',workspace:null,output:true,outputs:[{type:'表',tableId:customTask.outputs[0].tableId,name:'daily_quality',schema:customTask.outputs[0].schema,updateMode:'overwrite'}]});var reuseTask=state.tasks.at(-1);runTask(state.tasks.length-1)");finish();
assert.equal(run('arts.find(a=>a.id===customTask.outputs[0].tableId).data.length'),1,'Overwrite replaces current contents');
assert.equal(run('taskProducedArtifacts(reuseTask).filter(a=>taskArtifactKind(a)===\'table\').length'),1);
assert.equal(run('arts.filter(a=>!a.deleted&&!a.templateOnly&&!a.runSnapshot&&a.name===\'daily_quality\').length'),1);
assert.deepEqual(read(`taskRunArtifacts(findTaskRun('${firstRun}'))[0].data`),firstSnapshot.data);

// Complete-data browsing resolves a batch snapshot to the current table, reads
// every field, and can search records beyond the preview or first page.
run("var fullTable=arts.find(a=>a.id===customTask.outputs[0].tableId);fullTable.data=Array.from({length:130},(_,i)=>['2026-10-20',i,i%2===0,i===129?'<script>unsafe</script>':'record-'+i]);fullTable.rows='130';openArtifactFullData(arts.indexOf(taskRunArtifacts(findTaskRun('"+firstRun+"'))[0]))");
assert.equal(run('state.artifactFullData.index'),run('arts.indexOf(fullTable)'));
assert.equal((node('#artifactFullDataResults').innerHTML.match(/data-full-data-row=/g)||[]).length,50);
run('state.artifactFullData.page=2;renderArtifactFullData()');assert(node('#artifactFullDataResults').innerHTML.includes('data-full-data-row="129"'));assert(node('#artifactFullDataResults').innerHTML.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert(!node('#artifactFullDataResults').innerHTML.includes('<script>unsafe'));
run("filterArtifactFullData('unsafe')");assert.equal((node('#artifactFullDataResults').innerHTML.match(/data-full-data-row=/g)||[]).length,1);assert(node('#artifactFullDataResults').innerHTML.includes('<td>false</td>'));
run("filterArtifactFullData('');state.artifactFullData.pageSize=0;renderArtifactFullData()");assert.equal((node('#artifactFullDataResults').innerHTML.match(/data-full-data-row=/g)||[]).length,130);
run('openArt(arts.indexOf(fullTable))');assert(run('artifactPreviewHTML()').includes('查看完整数据'));assert.equal((run('artifactPreviewBody(fullTable)').match(/<tr onclick/g)||[]).length,10);
run('showTaskHistory(customIndex);openTaskArtifactPreview(arts.indexOf(fullTable))');assert(run('taskArtifactPreviewHTML()').includes('查看完整数据'));
run(`openTaskArtifactPreview(arts.indexOf(taskRunArtifacts(findTaskRun('${firstRun}'))[0]))`);assert.equal(run('state.taskArtifactPreview.artifact.runId'),firstRun);
for(const markup of [node('#overlay').innerHTML,node('#sessionResults').innerHTML,run('taskOutputFields({type:"表"})'),run('taskOutputFields({type:"表",tableId:arts[0].id})'),run('taskArtifactPreviewHTML()'),node('#artifactFullDataResults').innerHTML])for(const match of markup.matchAll(/on(?:click|change|input)="([^"]*)"/g))new Function(match[1].replaceAll('&quot;','"'));
console.log('Passed: cross-workspace multi-session selection; stable historical-table targets; repeated writes with one current table and per-run documents; overwrite and shared table reuse; immutable execution snapshots; complete data search, pagination, all fields and escaping.');
