const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('dist/aiops-extensions.html','utf8'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const context=vm.createContext({console,setTimeout(){},clearTimeout(){}});
vm.runInContext(source.slice(0,source.lastIndexOf('\nstate.composerSkill=null;')),context);
const run=code=>vm.runInContext(code,context),read=code=>JSON.parse(run(`JSON.stringify(${code})`));
run("render=()=>{};filterObservedSessions=()=>{};refreshObservedFilterOptions=()=>{};state.page='线上会话分析';state.observedRange=7");
const all=read('filteredObservedSessions().map(s=>s.id)');assert.equal(all.length,8);
// Conversation scope accepts Agents only; changing it must not lose the dashboard's ontology selection.
assert(read("analysisScopeCatalog().flatMap(s=>s.items).every(x=>x.type==='Agent')"));
assert(read("analysisScopeCatalog().flatMap(s=>s.items).some(x=>x.name===observedSessions[0].agent)"));
const dashboardSelection=read('analysisScopeState.scopeSelection');
run('analysisScopeBulk(false)');assert.equal(read('filteredObservedSessions().length'),0);
run("analysisScopeToggle(onlineSessionScopes().find(s=>s.id==='sales').items.map(x=>x.id))");assert.equal(read('filteredObservedSessions().length'),0);
run("analysisScopeToggle(onlineSessionScopes().find(s=>s.id==='session-ungrouped').items.map(x=>x.id))");assert.equal(read('filteredObservedSessions().length'),8);
run("state.page='成本分析'");assert(read("analysisScopeCatalog().flatMap(s=>s.items).some(x=>x.type==='本体对象集')"));assert.deepEqual(read('analysisScopeChosen()'),dashboardSelection);
run("state.page='线上会话分析';analysisScopeBulk(true)");
// Search is case-insensitive, and searching options never changes the applied selection.
assert.equal(read("observedFilterOptions('agent','  关账  ').length"),1);assert.equal(read("observedFilterOptions('agent','不存在').length"),0);
assert.equal(read("observedFilterOptions('user','ZEYU')[0].value"),'zeyu.jiang');assert.equal(read('filteredObservedSessions().length'),8);
run("setObservedFilterSelection('user',['zeyu.jiang','amy.chen'])");assert.equal(read('filteredObservedSessions().length'),4);
run("setObservedFilterSelection('mark',['优质','劣质'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.index)'),[3,4]);
run("setObservedFilterSelection('by',['Feng Zhu'])");assert.equal(read('filteredObservedSessions().length'),2);
run("setObservedFilterSelection('signal',['issues'])");assert.equal(read('filteredObservedSessions().length'),0);
run('resetObservedFilters()');assert.equal(read('filteredObservedSessions().length'),8);
run("setObservedFilterSelection('signal',['issues'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.index)'),[0,1,5,6],'An error-only session must count as abnormal even when its warning count is zero');
run("setObservedFilterSelection('signal',null);setObservedFilterSelection('agent',[])");assert.equal(read('filteredObservedSessions().length'),0);
run("toggleObservedFilter('agent',observedSessions[0].agent)");assert.equal(read('filteredObservedSessions().length'),8);assert.equal(read("observedFilterValue('agent')"),null);
run("setObservedFilterSelection('by',[''])");assert.equal(read('filteredObservedSessions().length'),6);assert(read('filteredObservedSessions().every(s=>!observedMeta(s.index).by)'));
run("resetObservedFilters();state.sessionQuery='cr-1024'");assert.equal(read('filteredObservedSessions()[0].id'),'CR-1024');
run("state.sessionQuery='';state.observedRange=1");assert.equal(read('filteredObservedSessions().length'),3);run('state.observedRange=7');
// Numeric sorts, stable ties, and missing marking times keep their intended ordering.
for(const key of ['messages','tokens','warnings']){
 run(`state.sessionSort='${key}';state.sessionAscending=false`);const values=read(`filteredObservedSessions().map(s=>${key==='tokens'?'parseFloat(s.tokens)':`s.${key}`})`);assert.deepEqual(values,[...values].sort((a,b)=>b-a));
 run(`sortObservedSessions('${key}')`);const ascending=read(`filteredObservedSessions().map(s=>${key==='tokens'?'parseFloat(s.tokens)':`s.${key}`})`);assert.deepEqual(ascending,[...ascending].sort((a,b)=>a-b));
}
run("state.sessionSort='markedAt';state.sessionAscending=false");assert.deepEqual(read('filteredObservedSessions().slice(0,2).map(s=>s.index)'),[3,4]);
run("sortObservedSessions('markedAt')");assert.deepEqual(read('filteredObservedSessions().slice(0,2).map(s=>s.index)'),[4,3]);assert(read('filteredObservedSessions().slice(2).every(s=>!observedMeta(s.index).markedAt)'));
const page=read('sessionAnalysisPage()');assert(!page.includes('全部标记'));assert(!page.includes('点击会话查看原始输入输出'));assert(!page.includes('only-issues'));assert(!page.includes('<select'));
for(const label of ['Agent','用户','点赞','点踩','标记','标记用户'])assert(page.includes('筛选'+label));
assert(page.includes('按点赞排序'));assert(page.includes('按点踩排序'));
// Feedback counts use committed assistant-message feedback, separately from session marks.
run("resetObservedFilters();state.sessionSort='time';state.sessionAscending=false");
assert.deepEqual(read('observedFeedbackCounts(observedSessions[0])'),{likes:1,dislikes:1});
assert.deepEqual(read('observedFeedbackCounts(observedSessions[3])'),{likes:0,dislikes:0});
assert.deepEqual(read("observedFilterOptions('dislikes').map(x=>x.label)"),['有点踩','无点踩']);
run("setObservedFilterSelection('dislikes',['has'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.id)'),['CR-1024','CR-1018']);
run("setObservedFilterSelection('likes',['has'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.id)'),['CR-1024'],'A session with both directions must match both filters');
run("setObservedFilterSelection('likes',['none'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.id)'),['CR-1018']);
run("setObservedFilterSelection('dislikes',['none'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.id)'),['CR-1021','CR-1020','CR-1019','CR-1017']);
run("setObservedFilterSelection('likes',[])");assert.equal(read('filteredObservedSessions().length'),0);assert(read('observedSessionRows()').includes('colspan="14"'));
run("resetObservedFilters();setObservedFilterSelection('likes',['has']);setObservedFilterSelection('user',['amy.chen'])");assert.deepEqual(read('filteredObservedSessions().map(s=>s.id)'),['CR-1023']);
run("resetObservedFilters();setObservedFilterSelection('dislikes',['has']);state.sessionQuery='cr-1018'");assert.equal(read('filteredObservedSessions().length'),1);
run("state.sessionQuery='';state.observedRange=1");assert.deepEqual(read('filteredObservedSessions().map(s=>s.id)'),['CR-1024']);
run("state.observedRange=7;resetObservedFilters();observedRecord(observedSessions[1]).turns[1].output.feedback={value:'up',tags:['内容准确','易于理解']};observedRecord(observedSessions[0]).turns[2].output.feedback={value:'down'}");
assert.deepEqual(read('observedFeedbackCounts(observedSessions[1])'),{likes:2,dislikes:0},'Multiple tags on one reply count as one vote');
for(const key of ['likes','dislikes']){
 run(`state.sessionSort='${key}';state.sessionAscending=false`);const values=read(`filteredObservedSessions().map(s=>s.${key})`);assert.deepEqual(values,[...values].sort((a,b)=>b-a));
 run(`sortObservedSessions('${key}')`);const ascending=read(`filteredObservedSessions().map(s=>s.${key})`);assert.deepEqual(ascending,[...ascending].sort((a,b)=>a-b));
}
assert(read('observedSessionRows()').includes('2 条点赞回复'));assert(read('observedSessionRows()').includes('2 条点踩回复'));
run('observedRecord(observedSessions[1]).turns[1].output.feedback=null;observedRecord(observedSessions[0]).turns[2].output.feedback=null');
for(const match of page.matchAll(/on(?:click|input|change)="([^"]*)"/g))new Function(match[1].replaceAll('&quot;','"'));
console.log('Passed: Agent-only session scope; searchable combined filters; empty/all/reset; error/date/query intersections; numeric sorts; per-reply like/dislike counts, independent presence filters, mixed feedback, count sorting and 14-column empty layout.');
