const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('dist/index.html','utf8'),nodes={},queue=[];
const sandbox={document:{getElementById:id=>nodes[id]||(nodes[id]={innerHTML:''}),querySelectorAll:()=>[],addEventListener(){}},setTimeout(fn){queue.push(fn)},clearTimeout(){},console};
vm.createContext(sandbox);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);const run=s=>vm.runInContext(s,sandbox);
for(const scene of ['sales','procurement']){
 run(`studio.scene='${scene}';openWorkshopTests()`);
 assert(run('wtScreen().includes("测试任务") && wtScreen().includes("用例集") && wtScreen().includes("策略")'));
 assert.equal(run('wtData().suites.length'),4);assert.equal(run('wtData().tasks.length'),15);
 assert(run('wtData().tasks.every(t=>wtData().suites.some(s=>s.id===t.suite)&&wtData().strategies.some(s=>s.id===t.strategy))'));
 assert(run('wtData().suites.every(s=>s.reports.every(r=>wtData().tasks.some(t=>t.id===r.task))&&s.issues.every(q=>s.cases.some(c=>c.id===q.caseId))&&s.opts.every(o=>s.issues.some(q=>q.id===o.issue)))'));
 run('wtSuite(wtData().suites[0].id)');assert(run("['用例','报告','问题','优化'].every(t=>wtScreen().includes('>'+t+'</button>'))"));assert(!run("wtScreen().includes('>策略</button>')"));
 for(const tab of ['用例','报告','问题','优化']){run(`wtState.detailTab='${tab}'`);assert(run('wtScreen().length>1000'));}
}
run("studio.scene='sales';wtData();wtState.suite=wtData().suites[0].id");
const prior=run('JSON.stringify(wtCatalog.procurement)'),historic=run('JSON.stringify(wtData().tasks[0])');
run('var testA=wtCreateTask({...wtData().tasks[0],concurrency:3});var testB=wtCreateTask({...wtData().tasks[1],concurrency:2});wtCompleteTask("sales",testA.id);wtCompleteTask("sales",testB.id)');
assert.notEqual(run('testA.id'),run('testB.id'));assert.equal(run('testA.status'),'已完成');assert.equal(run('testA.concurrency'),3);
assert.equal(run('JSON.stringify(wtCatalog.procurement)'),prior);assert.equal(run('JSON.stringify(wtData().tasks.find(t=>t.id==="SAL-TASK-001"))'),historic);
assert(run('wtData().suites.flatMap(s=>s.reports).filter(r=>r.task===testA.id).length===1'));
assert(run('new Set(wtData().suites.flatMap(s=>s.reports).map(r=>r.id)).size===wtData().suites.flatMap(s=>s.reports).length'));
assert.throws(()=>run('wtCreateTask({...testA,concurrency:0})'));
run('wtDeleteCase(wtCurrentSuite().cases[0].id)');assert(run('wtCurrentSuite().cases[0].deleted'));assert(run('wtCurrentSuite().issues.some(q=>q.caseId===wtCurrentSuite().cases[0].id)'));
run('wtRepair(wtCurrentSuite().issues[0].id)');assert.equal(run('wtCurrentSuite().issues[0].status'),'处理中');
console.log('Passed: two scene catalogs, nested tabs, references, mock task/report lifecycle, unique concurrent reports, historical and scene isolation, validation, case archive, repair state.');

run("studio.scene='sales';wtData();wtTaskDetail('SAL-TASK-002')");
assert(run('wtScreen().includes("预期输出命中")&&wtScreen().includes("答案相关性")&&wtScreen().includes("Run 1")'));
assert(!run('wtScreen().includes(">用例集</button>" )'));
assert.equal(run('wtData().tasks.find(t=>t.id===wtState.task).results.length'),5);
run('wtActualResult(0)');assert(nodes.overlay.innerHTML.includes('查看实际结果'));assert(nodes.overlay.innerHTML.includes('Inputs'));assert(nodes.overlay.innerHTML.includes('Outputs'));assert(nodes.overlay.innerHTML.includes('用例预期'));
run("studio.scene='procurement';wtData();wtTaskDetail('PUR-TASK-002');wtActualResult(0)");assert(nodes.overlay.innerHTML.includes('采购'));assert(!nodes.overlay.innerHTML.includes('华东渠道'));
run("wtBackTask();studio.scene='sales';wtData();var snapshotTask=wtCreateTask({...wtData().tasks[0],concurrency:2});var originalInput=snapshotTask.results[0].input;wtData().suites.find(s=>s.id===snapshotTask.suite).cases[0].input='编辑后的测试输入';wtCompleteTask('sales',snapshotTask.id)");assert.equal(run('snapshotTask.results[0].input'),run('originalInput'));
console.log('Passed: task result page, metric columns, run expansion markup, result drawer, procurement content, immutable task case snapshot.');

for(const scene of ['sales','procurement']){
 run(`studio.scene='${scene}';openWorkshopOntology()`);assert.equal(run('studio.stage'),2);assert.equal(run('wtState.open'),false);assert.equal(run('woState.tab'),'对象集');
 assert(run('woData().relations.every(([a,r,b])=>woData().objects.includes(a)&&woData().objects.includes(b))'));
 for(const tab of ['本体图谱','对象集','对象','关系','规则','动作']){run(`woTab('${tab}')`);assert(run('woScreen().length>1000'));}
 run('woSetDetail()');assert(nodes.overlay.innerHTML.includes(scene==='sales'?'销售业务本体':'采购业务本体'));
}
run('woClose()');assert.equal(run('woState.open'),false);run('openWorkshopTests()');assert.equal(run('woState.open'),false);assert.equal(run('wtState.open'),true);
console.log('Passed: ontology entry, stage, six tabs, scene isolation, relationship integrity and workspace close/switch.');
run("studio.scene='sales';openWorkshopOntology();openWorkshopAgents()");assert.equal(run('waState.ontologyTab'),true);assert(run('waScreen().includes("全部 · 1")&&waScreen().includes("销售智能分货助手")'));assert(!run('waScreen().includes("采购协同助手")'));
run('openWorkshopOntology()');assert(run('woScreen().includes("智能体" )'));run('openWorkshopAgents()');
const procurementAgents=run('JSON.stringify(waCatalog.procurement)');run("waSave({elements:{name:{value:'销售验收 Agent'},description:{value:'核对分货结果'},type:{value:'单智能体－工作流'}}},'')");assert.equal(run('waCatalog.sales.length'),2);assert.equal(run('JSON.stringify(waCatalog.procurement)'),procurementAgents);
run("studio.scene='procurement'");assert(run('waScreen().includes("全部 · 1")&&waScreen().includes("采购协同助手")'));assert(!run('waScreen().includes("销售验收 Agent")'));
run('waClose()');assert.equal(run('waState.open'),false);assert.equal(run('woState.open'),true);run('openWorkshopTests()');assert.equal(run('waState.pinned'),false);
console.log('Passed: Agent listing, retained workspace tabs, scene-isolated creation, card counts, close and testing workspace switch.');

run("studio.scene='sales';openWorkshopAgents();wiExport('agent',waCatalog.sales[0].id)");assert.equal((nodes.overlay.innerHTML.match(/ checked/g)||[]).length,5);
run("wiExportConfirm('agent',waCatalog.sales[0].id,{querySelectorAll:()=>[{value:'Skill'},{value:'本体对象集'}]})");assert(nodes.overlay.innerHTML.includes('ZIP 包可以直接导入 AgentOS'));assert(nodes.overlay.innerHTML.includes('Skill、本体对象集'));assert(!nodes.overlay.innerHTML.includes('Skill、MCP'));
run("wiExport('ontology',wiObjects()[0].id)");assert(nodes.overlay.innerHTML.includes('V2.0'));assert(nodes.overlay.innerHTML.includes('V1.0'));
run("wiExportConfirm('ontology',wiObjects()[0].id,{elements:{version:{value:'V1.0'}}})");assert(nodes.overlay.innerHTML.includes('V1.0'));run('wiExportDone()');assert(nodes.overlay.innerHTML.includes('导出成功'));
const salesBefore=run('waCatalog.sales.length'),procBefore=run('waCatalog.procurement.length');run("wiApplyImport('agent','采购导入.zip','procurement')");assert.equal(run('waCatalog.procurement.length'),procBefore+1);assert.equal(run('waCatalog.sales.length'),salesBefore);
run("wiApplyImport('ontology','销售对象集.zip','sales')");assert.equal(run('wiObjects().length'),2);assert(run('wiObjectCards().includes("销售对象集")'));assert(run('woScreen().includes("导入对象集")'));assert(run('waScreen().includes("导入智能体")'));
console.log('Passed: all five export defaults, selected content confirmation, version selection, Mock export success, scene-isolated ZIP imports and new cards.');

run("currentSection='assets';assetTab='Agent';studio.scene='sales';wiAssetScene='procurement'");assert(run('assetsPage().includes("导入智能体")'));assert(run('assetsPage().includes("采购协同助手")'));
run("wiExport('agent','procurement-agent-1')");assert(nodes.overlay.innerHTML.includes('采购协同助手'));assert.equal(run('studio.scene'),'sales');
run("wiExport('ontology','procurement-ontology')");assert(nodes.overlay.innerHTML.includes('采购业务本体'));assert(!nodes.overlay.innerHTML.includes('<option >V2.0'));
run("assetTab='本体'");assert(run('assetsPage().includes("导入对象集")'));run("wiImport('ontology')");assert(nodes.overlay.innerHTML.includes('导入场景'));
const allAgents=run('wiAllAgents().length'),allSets=run('wiAllObjects().length');run("wiApplyImport('agent','资产采购助手.zip','procurement');wiApplyImport('ontology','资产采购本体.zip','procurement')");assert.equal(run('wiAllAgents().length'),allAgents+1);assert.equal(run('wiAllObjects().length'),allSets+1);assert(run('assetsPage().includes("资产采购本体")'));run("assetTab='Agent'");assert(run('assetsPage().includes("资产采购助手")'));
run("currentSection='studio';studio.scene='procurement'");assert(run('waScreen().includes("资产采购助手")'));assert(run('wiObjectCards().includes("资产采购本体")'));
console.log('Passed: asset overview import/export entries, cross-scene export without workshop mutation, target scene selection and shared imported cards.');
