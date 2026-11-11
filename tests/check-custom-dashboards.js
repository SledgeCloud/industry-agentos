const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {
    innerHTML: '', textContent: '', value: '', dataset: {}, scrollTop: 0, hidden: true,
    focus() {}, setAttribute() {}, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {} }
  });
  return nodes.get(selector);
};
const context = vm.createContext({
  console, setTimeout() {}, clearTimeout() {},
  document: { querySelector: node, querySelectorAll() { return []; },
    body: { classList: { add() {}, remove() {}, toggle() {} } } }
});
vm.runInContext(script.slice(0, script.lastIndexOf('\nstate.composerSkill=null;')), context);
const run = code => vm.runInContext(code, context);
const json = code => JSON.parse(JSON.stringify(run(code)));
run('render=()=>{};state.range=30');

// Only available data tables are inputs, including newly generated task snapshots.
run(`arts.push(
  {id:'dashboard-fixture',name:'测试指标输入',kind:'table',rows:'999',cols:['日期','行业','客户','金额','比例','耗时','Token'],data:[
    ['2026-10-18','制造业','C1',100,'94.2%','42.6s','12.8M'],
    ['2026-10-19','制造业','C1',300,'95.8%','10.4s','1.2M'],
    ['2026-10-19','零售业','C2',-50,'90.0%','7s','2M'],
    ['2026-10-19','零售业',null,null,null,null,null]
  ]},
  {id:'dashboard-file',name:'不能作为输入.md',kind:'file',cols:['x'],data:[[1]]},
  {id:'dashboard-template',name:'未生成的模板',kind:'table',templateOnly:true,cols:['x'],data:[]},
  {id:'dashboard-deleted',name:'已删除的表',kind:'table',deleted:true,cols:['x'],data:[[1]]},
  {id:'dashboard-snapshot',name:'任务已生成的数据表',kind:'table',runSnapshot:true,cols:['x'],data:[[1]]}
);`);
const sourceIds = json('dashboardSources().map(s=>s.id)');
for (const id of ['dashboard-file','dashboard-template','dashboard-deleted']) assert(!sourceIds.includes('artifact:'+id));
assert(sourceIds.includes('artifact:dashboard-snapshot'));
assert(sourceIds.includes('ontology:sales-order-set'));
assert.equal(run("dashboardSources().filter(s=>s.kind==='ontology').length"), 4);
run("globalThis.fixtureMetric={...dashboardNewMetric(),sourceId:'artifact:dashboard-fixture',x:'行业',y:'金额'}");
assert.equal(run('dashboardCompute(fixtureMetric).value'), 4, 'Count uses available rows rather than the display row count');
for (const [agg,expected] of [['sum',350],['avg',350/3],['min',-50],['max',300]]) {
  assert.equal(run(`dashboardCompute({...fixtureMetric,agg:'${agg}'}).value`), expected);
}
assert.equal(run("dashboardCompute({...fixtureMetric,agg:'distinct',y:'客户'}).value"), 2);
assert.equal(run("dashboardCompute({...fixtureMetric,agg:'avg',y:'比例'}).value"), (94.2+95.8+90)/3);
assert.equal(run("dashboardCompute({...fixtureMetric,agg:'sum',y:'Token'}).value"), 16000000);
assert.equal(run("dashboardCompute({...fixtureMetric,agg:'sum',y:'耗时'}).value"), 60);
assert.deepEqual(json("dashboardCompute({...fixtureMetric,agg:'sum',filterField:'行业',filterValue:'制造业'}).groups"), [{label:'制造业',value:400}]);
assert.equal(run("dashboardCompute({...fixtureMetric,filterField:'行业',filterValue:'不存在'}).value"), 0);
assert.equal(run("dashboardCompute({...fixtureMetric,agg:'avg',filterField:'行业',filterValue:'不存在'}).value"), null);
assert.deepEqual(json("dashboardNumericFields(dashboardSource('artifact:dashboard-fixture'))"), ['金额','比例','耗时','Token']);
for (const [input,expected] of [['12.8M',12800000],['1,234.50',1234.5],['94.2%',94.2],['42.6s',42.6],['500ms',.5],['2K',2000],['1B',1e9],['-0.5',-.5],['',null],['x12',null],['12abc',null],[true,null],[Infinity,null]]) {
  context.numericInput=input;
  assert.equal(run('dashboardNumeric(numericInput)'),expected,String(input));
}
assert.equal(run('dashboardFormat(null,{decimals:2})'), '—');
assert.equal(run('dashboardFormat(1234.567,{decimals:2})'), '1,234.57');

// Saved source identities survive unrelated insertions and reordering.
const fixtureId = run('fixtureMetric.sourceId');
run("arts.unshift({id:'new-first-source',name:'其他表',kind:'table',cols:['x'],data:[[77]]});arts.reverse()");
assert.equal(run('dashboardCompute(fixtureMetric).value'), 4);
assert.equal(run('fixtureMetric.sourceId'), fixtureId);
assert.match(run("dashboardMetricError({...fixtureMetric,sourceId:'artifact:missing'})"), /来源不可用/);
assert.match(run("dashboardMetricError({...fixtureMetric,type:'chart',x:'已删除字段'})"), /分组字段/);
assert.match(run("dashboardMetricError({...fixtureMetric,agg:'sum',y:'客户'})"), /无法计算数值/);
assert.match(run("dashboardMetricError({...fixtureMetric,agg:'sum',y:'已删除字段'})"), /数值字段/);
assert.match(run("dashboardMetricError({...fixtureMetric,type:'table',tableMode:'detail',columns:[]})"), /至少选择/);
assert.match(run("dashboardMetricError({...fixtureMetric,type:'table',tableMode:'detail',columns:['已删除字段']})"), /字段已变更/);
assert.match(run("dashboardMetricError({...fixtureMetric,filterField:'已删除字段'})"), /筛选字段/);
run("arts.find(a=>a.id==='dashboard-fixture').deleted=true");
assert(run('dashboardCompute(fixtureMetric).error'));
run("arts.find(a=>a.id==='dashboard-fixture').deleted=false;arts.reverse();arts.splice(0,1)");

// A deleted default source must not rebind the seeded cost chart to the next table.
run('dashboardDefaultSources[0].deleted=true;dashboardInit()');
assert.equal(run("state.customDashboards[0].metrics.find(m=>m.name==='每日报告生成率').sourceId"),run("dashboardSourceId(dashboardDefaultSources[0])"));
assert.match(run("dashboardCompute(state.customDashboards[0].metrics.find(m=>m.name==='每日报告生成率')).error"),/来源不可用/);
assert.equal(run("dashboardSource(state.customDashboards[0].metrics.find(m=>m.name==='每日报告生成率').sourceId)"),undefined);
run('dashboardDefaultSources[0].deleted=false');
assert.equal(run("dashboardCompute(state.customDashboards[0].metrics.find(m=>m.name==='每日报告生成率')).error"),undefined);

// Manual creation: required fields, several independently configured metrics, save, reopen, cancel.
run('createDashboardManually()');
assert.equal(run('state.page'), '自定义看板');
assert.equal(run('state.dashboardEditor.metrics.length'), 1);
const initialCount=run('state.customDashboards.length');
run('saveDashboard()');
assert.equal(run('state.customDashboards.length'), initialCount);
assert(node('#toast').innerHTML.includes('看板名称'));
run("state.dashboardEditor.name='销售订单看板';saveDashboard()");
assert(node('#toast').innerHTML.includes('主要目标'));
run("state.dashboardEditor.goal='关注每日销售趋势';dashboardSetCount(3)");
assert.equal(run('state.dashboardEditor.metrics.length'), 3);
assert.equal(run('new Set(state.dashboardEditor.metrics.map(m=>m.id)).size'),3);
for (const invalid of [0,21,1.5,'abc']) {
  run(`dashboardSetCount(${JSON.stringify(invalid)})`);
  assert.equal(run('state.dashboardEditor.metrics.length'),3);
}
run("dashboardUpdateMetric('sourceId','ontology:sales-order-set');dashboardUpdateMetric('name','订单金额',false);dashboardUpdateMetric('agg','sum');dashboardUpdateMetric('y','订单金额');dashboardUpdateMetric('unit','元',false)");
assert.equal(run('dashboardCompute(state.dashboardEditor.metrics[0]).value'), 176940);
run("dashboardSelectMetric(1);dashboardUpdateMetric('sourceId','ontology:sales-order-set');dashboardUpdateMetric('name','行业订单分布',false);dashboardUpdateMetric('type','chart');dashboardUpdateMetric('x','行业');dashboardUpdateMetric('chart','donut')");
assert.equal(run('dashboardCompute(state.dashboardEditor.metrics[1]).groups.length'),3);
run("dashboardSelectMetric(2);dashboardUpdateMetric('sourceId','artifact:dashboard-fixture');dashboardUpdateMetric('name','明细',false);dashboardUpdateMetric('type','table');dashboardToggleColumn(0,false)");
assert(!run("state.dashboardEditor.metrics[2].columns.includes('日期')"));
run('saveDashboard()');
assert.equal(run('state.dashboardEditor'),null);
assert.equal(run('state.customDashboards.length'),initialCount+1);
const savedId=run('state.dashboardId');
assert.equal(run('state.customDashboards.at(-1).metrics.length'),3);
assert(run('dashboardDetailPage()').includes('配置'));
assert(!run('dashboardDetailPage()').includes('analysis-scope'));
run(`editDashboard('${savedId}');state.dashboardEditor.name='未保存修改';state.dashboardEditor.metrics[0].name='被取消指标';dashboardCancel()`);
assert.equal(run('state.customDashboards.at(-1).name'),'销售订单看板');
assert.equal(run('state.customDashboards.at(-1).metrics[0].name'),'订单金额');
run(`editDashboard('${savedId}');state.dashboardEditor.goal='新目标';saveDashboard()`);
assert.equal(run('state.customDashboards.at(-1).goal'),'新目标');
assert.equal(run('state.customDashboards.length'),initialCount+1);
run(`editDashboard('${savedId}');dashboardSetCount(1)`);
assert.equal(run('state.dashboardEditor.metrics.length'),3, 'Reducing metrics needs the displayed confirmation');
assert(node('#overlay').innerHTML.includes('确认调整'));
run('dashboardResize(1);closeModal();dashboardRemoveMetric()');
assert.equal(run('state.dashboardEditor.metrics.length'),1);
run('dashboardResize(20);dashboardAddMetric()');
assert.equal(run('state.dashboardEditor.metrics.length'),20);
run('dashboardCancel();createDashboardManually();dashboardChangeSourceKind("ontology")');
assert(run('state.dashboardEditor.metrics[0].sourceId').startsWith('ontology:'));
run("dashboardUpdateMetric('agg','sum');dashboardUpdateMetric('y','订单金额');dashboardUpdateMetric('filterField','行业');dashboardUpdateMetric('filterValue','制造业',false);dashboardChangeSourceKind('artifact')");
assert.equal(run('state.dashboardEditor.metrics[0].agg'),'count');
assert.equal(run('state.dashboardEditor.metrics[0].y'),'');
assert.equal(run('state.dashboardEditor.metrics[0].filterField'),'');
assert.equal(run('state.dashboardEditor.metrics[0].filterValue'),'');

// Empty data and chart values preserve valid SVG coordinates across styles.
for (const chart of ['bar','line','hbar','pie','donut']) {
  const output=run(`dashboardChartSVG({...fixtureMetric,type:'chart',chart:'${chart}',agg:'sum'},[{label:'制造业',value:400},{label:'零售业',value:50}],420,260)`);
  assert(output.includes('<svg'));
  assert(output.includes('制造业'));
  assert(!/NaN|Infinity/.test(output));
  const empty=run(`dashboardChartSVG({...fixtureMetric,type:'chart',chart:'${chart}'},[],320,220)`);
  assert(empty.includes('暂无'));
}
for (const chart of ['bar','line','hbar']) {
  const output=run(`dashboardChartSVG({...fixtureMetric,type:'chart',chart:'${chart}'},[{label:'负值',value:-4},{label:'零值',value:0},{label:'正值',value:10}],320,220)`);
  assert(!/NaN|Infinity|height="-/.test(output));
}
assert(run("dashboardChartSVG({...fixtureMetric,type:'chart',chart:'pie'},[{label:'负值',value:-1}],320,220)").includes('不支持负值'));
assert(run("dashboardChartSVG({...fixtureMetric,type:'chart',chart:'donut'},[{label:'零值',value:0}],320,220)").includes('合计为 0'));

// All-zero series put the zero data on the baseline and keep all grid lines in the plot.
for (const chart of ['bar','line']) {
  const output=run(`dashboardChartSVG({...fixtureMetric,type:'chart',chart:'${chart}'},[{label:'零一',value:0},{label:'零二',value:0}],320,220)`);
  const gridY=[...output.matchAll(/<line[^>]*y1="([^"]*)"[^>]*y2="([^"]*)"/g)].flatMap(m=>[Number(m[1]),Number(m[2])]);
  assert.equal(gridY.length,10);
  assert(gridY.every(y=>y>=26&&y<=172),`${chart}: grid stays in plot bounds`);
  if(chart==='line') {
    const points=[...output.matchAll(/<circle[^>]*cy="([^"]*)"/g)].map(m=>Number(m[1]));
    assert.deepEqual(points,[172,172]);
  } else {
    const bars=[...output.matchAll(/<rect[^>]*y="([^"]*)"[^>]*height="([^"]*)"/g)].map(m=>[Number(m[1]),Number(m[2])]);
    assert.deepEqual(bars,[[172,0],[172,0]]);
  }
  assert(/<text[^>]*y="176"[^>]*>0<\/text>/.test(output),'Zero tick labels the baseline');
}

// Null-valued pie groups are absent from both slices and legend; surviving colors stay aligned.
run("arts.push({id:'pie-null-fixture',name:'饼图空值输入',kind:'table',cols:['分组','数值'],data:[['A空值',null],['B有效',2],['C有效',3]]})");
run("globalThis.pieMetric={...dashboardNewMetric(),name:'饼图空值回归',sourceId:'artifact:pie-null-fixture',type:'chart',chart:'pie',x:'分组',y:'数值',agg:'sum'}");
const pieOutput=run('dashboardMetricCard(pieMetric)');
const legend=pieOutput.match(/<div class="cd-legend">([\s\S]*?)<\/div>/)[1];
assert(!legend.includes('A空值'));
assert(!pieOutput.includes('<title>A空值'));
assert(legend.includes('background:#4d8eff"></i>B有效'));
assert(legend.includes('background:#25b7a6"></i>C有效'));
assert(/fill="#4d8eff"><title>B有效/.test(pieOutput));
assert(/fill="#25b7a6"><title>C有效/.test(pieOutput));

const hostile='<img src=x onerror="alert(1)">';context.hostile=hostile;
assert(!run('dashboardTable([hostile],[[hostile]])').includes('<img'));
assert(!run("dashboardChartSVG({...fixtureMetric,name:hostile},[{label:hostile,value:1}],320,220)").includes('<img'));
run('state.dashboardEditor.name=hostile;state.dashboardEditor.goal=hostile;state.dashboardEditor.metrics[0].name=hostile');
assert(!run('dashboardEditorPage()').includes('<img'));
assert(run('dashboardEditorPage()').includes('&lt;img'));
const menu=run('dashboardCreateControls()');
assert(menu.includes('手动创建'));
assert(menu.includes('AI 创建'));
assert(menu.includes('待接入 Skill'));
assert(/<button[^>]*disabled[^>]*>[^]*?AI 创建/.test(menu));
assert(!html.includes('自定义数据看板'));
assert(!html.includes('新建数据看板'));
// All event handlers generated by the builder parse after HTML entity decoding.
for (const output of [menu,run('dashboardEditorPage()'),run('dashboardMetricEditor()'),run('dashboardDetailPage()')]) {
  for (const match of output.matchAll(/on(?:click|input|change)="([^"]*)"/g)) {
    new Function(match[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&'));
  }
}
console.log('PASS: custom dashboard inputs, calculations, chart styles, manual creation, save/edit/cancel, metric counts, source changes and escaping.');
