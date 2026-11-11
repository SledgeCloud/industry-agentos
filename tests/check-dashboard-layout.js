const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

function sandbox(seed = [], fail = {}) {
  const html = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new Function(script);
  const storage = new Map(seed);
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
    localStorage: {
      getItem(key) { if (fail.read) throw new Error('Storage disabled'); return storage.get(key) ?? null; },
      setItem(key, value) { if (fail.write) throw new Error('Quota exceeded'); storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    document: { querySelector: node, querySelectorAll() { return []; },
      body: { classList: { add() {}, remove() {}, toggle() {} } } }
  });
  vm.runInContext(script.slice(0, script.lastIndexOf('\nstate.composerSkill=null;')), context);
  const run = code => vm.runInContext(code, context);
  const json = code => JSON.parse(JSON.stringify(run(code)));
  run('render=()=>{}');
  return { run, json, storage, node, context };
}

const env = sandbox();
const { run, json, storage, node } = env;
run('dashboardInit()');
const key = run('dashboardStorageKey');

// Every allowed numeric density works, including five equal cards in a row.
for (let columns = 1; columns <= 6; columns++) {
  env.context.columns = columns;
  const rows = json(`dashboardLayoutRows({numberColumns:columns,metrics:Array.from({length:columns+1},(_,i)=>({id:'n-'+i,type:'number'}))})`);
  assert.deepEqual(rows.flatMap(r => r.items.map(m => m.id)), Array.from({length:columns+1},(_,i)=>'n-'+i));
  assert.equal(rows[0].items.length, columns);
  assert.equal(rows[0].columns, columns);
  assert.equal(rows[1].items.length, 1);
  assert(rows.every(r => r.kind === 'number' && r.items.length <= 6));
}

// Only consecutive cards share a row, so mixed layouts retain their exact order.
const ordered = [
  {id:'n1',type:'number'}, {id:'n2',type:'number'},
  {id:'half1',type:'chart',width:'half'}, {id:'half2',type:'chart',width:'half'},
  {id:'full',type:'chart',width:'full'},
  {id:'half3',type:'chart',width:'half'}, {id:'table',type:'table',width:'full'},
  {id:'n3',type:'number'}, {id:'n4',type:'number'}
];
env.context.ordered = ordered;
const mixedRows = json('dashboardLayoutRows({numberColumns:6,metrics:ordered})');
assert.deepEqual(mixedRows.flatMap(r=>r.items.map(m=>m.id)), ordered.map(m=>m.id));
assert(mixedRows.some(r=>r.items.map(m=>m.id).join() === 'half1,half2'));
assert.equal(mixedRows.find(r=>r.items.some(m=>m.id==='full')).items.length,1);
assert.equal(mixedRows.find(r=>r.items.some(m=>m.id==='table')).items.length,1);
assert.equal(run('JSON.stringify(ordered)'),JSON.stringify(ordered), 'Layout planning does not mutate the metric list');

// Layout edits use an isolated draft and can be discarded without a storage write.
const original = json('state.customDashboards[0]');
const originalStored = [...storage];
run("dashboardStartLayout('closing-dashboard')");
assert(run('state.dashboardLayoutDraft !== state.customDashboards[0]'));
assert(run('state.dashboardLayoutDraft.metrics !== state.customDashboards[0].metrics'));
const initialIds = json('state.dashboardLayoutDraft.metrics.map(m=>m.id)');
run('dashboardMoveLayout(0,1);dashboardSetLayoutColumns(5)');
assert.deepEqual(json('state.dashboardLayoutDraft.metrics.map(m=>m.id)'),[initialIds[1],initialIds[0],...initialIds.slice(2)]);
run("dashboardSetLayoutWidth(state.dashboardLayoutDraft.metrics.findIndex(m=>m.type==='chart'),'full')");
assert.deepEqual(json('state.customDashboards[0]'),original);
assert.deepEqual([...storage],originalStored);
run('dashboardCancelLayout()');
assert(!run('state.dashboardLayoutDraft'));
assert.deepEqual(json('state.customDashboards[0]'),original);
assert.deepEqual([...storage],originalStored);

// Boundary moves do nothing; valid moves, width and density commit together.
run("dashboardStartLayout('closing-dashboard')");
run('dashboardMoveLayout(0,-1);dashboardMoveLayout(state.dashboardLayoutDraft.metrics.length-1,1)');
assert.deepEqual(json('state.dashboardLayoutDraft.metrics.map(m=>m.id)'),initialIds);
run('dashboardMoveLayout(0,1);dashboardSetLayoutColumns(5)');
run("dashboardSetLayoutWidth(state.dashboardLayoutDraft.metrics.findIndex(m=>m.type==='chart'),'full')");
const expectedSaved = json('state.dashboardLayoutDraft');
run('dashboardSaveLayout()');
assert(!run('state.dashboardLayoutDraft'));
assert.deepEqual(json('state.customDashboards[0]'),expectedSaved);
assert(storage.has(key));

// Drag and drop commits the exact destination order, then clears drag state.
run("dashboardStartLayout('closing-dashboard')");
const beforeDrag = json('state.dashboardLayoutDraft.metrics.map(m=>m.id)');
let dragData = null, preventCount = 0;
env.context.dragEvent = {
  dataTransfer: { setData(type,value) { dragData = [type,value]; } },
  currentTarget: { closest() { return {classList:{add(){}}}; }, classList:{add(){},remove(){}}, contains(){return false;} },
  preventDefault() { preventCount++; }, relatedTarget:null
};
run('dashboardDragStart(dragEvent,0);dashboardDragOver(dragEvent);dashboardDropLayout(dragEvent,2)');
assert.deepEqual(dragData,['text/plain','0']);
assert(preventCount >= 2);
assert.deepEqual(json('state.dashboardLayoutDraft.metrics.map(m=>m.id)'),[beforeDrag[1],beforeDrag[2],beforeDrag[0],...beforeDrag.slice(3)]);
assert.equal(run('state.dashboardDragIndex'),null);
const droppedIds=json('state.dashboardLayoutDraft.metrics.map(m=>m.id)');
run('dashboardDropLayout(dragEvent,0)');
assert.deepEqual(json('state.dashboardLayoutDraft.metrics.map(m=>m.id)'),droppedIds,'An unrelated external drop does not reorder cards');
run('dashboardSetLayoutColumns(0);dashboardSetLayoutColumns(7);dashboardSetLayoutColumns(1.5)');
assert.equal(run('state.dashboardLayoutDraft.numberColumns'),5);
const firstWidth=run('state.dashboardLayoutDraft.metrics[0].width');
run("dashboardSetLayoutWidth(0,'quarter')");
assert.equal(run('state.dashboardLayoutDraft.metrics[0].width'),firstWidth);
run('dashboardCancelLayout()');

// Reload restores saved cards, their sequence and their individual widths.
const restored = sandbox([...storage]);
restored.run('dashboardInit()');
assert.deepEqual(restored.json('state.customDashboards'),json('state.customDashboards'));
const maxId = Math.max(...restored.json('state.customDashboards.flatMap(d=>[d.id,...d.metrics.map(m=>m.id)]).map(id=>Number(id.match(/(\\d+)$/)?.[1])||0)'));
assert(Number(restored.run('dashboardNewMetric().id').match(/(\d+)$/)[1]) > maxId);

// Reordering in the metric editor keeps the active metric selected by identity.
run("editDashboard('closing-dashboard');state.dashboardMetricIndex=0");
const selected = run('state.dashboardEditor.metrics[0].id');
run('dashboardMoveEditorMetric(0,1)');
assert.equal(run('state.dashboardEditor.metrics[state.dashboardMetricIndex].id'),selected);
assert.equal(run('state.dashboardMetricIndex'),1);
run('dashboardCancel()');
assert.deepEqual(json('state.customDashboards[0]'),expectedSaved);

// Bad persisted data falls back to a usable default rather than breaking the page.
for (const value of ['{broken', '{}', 'null', '[]', '{"version":999,"dashboards":[]}']) {
  const bad = sandbox([[key,value]]);
  bad.run('dashboardInit()');
  assert(bad.run('Array.isArray(state.customDashboards) && state.customDashboards.length>0'));
  assert(bad.run('state.customDashboards.every(d=>d.metrics.length>0)'));
}
const older = JSON.parse(storage.get(key));
for (const dashboard of older.dashboards) {
  delete dashboard.numberColumns;
  for (const metric of dashboard.metrics) delete metric.width;
}
const legacy = sandbox([[key,JSON.stringify(older)]]);
legacy.run('dashboardInit()');
assert.equal(legacy.run('state.customDashboards[0].numberColumns'),6);
assert(legacy.run("state.customDashboards[0].metrics.every(m=>['half','full'].includes(m.width))"));
const duplicate = JSON.parse(storage.get(key));
duplicate.dashboards[0].metrics[1].id = duplicate.dashboards[0].metrics[0].id;
const duplicateEnv = sandbox([[key,JSON.stringify(duplicate)]]);
duplicateEnv.run('dashboardInit()');
assert(duplicateEnv.run('new Set(state.customDashboards[0].metrics.map(m=>m.id)).size===state.customDashboards[0].metrics.length'));
const noRead = sandbox([], {read:true});
noRead.run('dashboardInit()');
assert(noRead.run('state.customDashboards.length>0'));
const noWrite = sandbox([], {write:true});
noWrite.run('dashboardInit()');
assert.equal(noWrite.run('dashboardPersist()'),false);
noWrite.run("dashboardStartLayout('closing-dashboard');dashboardSetLayoutColumns(4);dashboardSaveLayout()");
assert(noWrite.node('#toast').innerHTML.includes('浏览器存储不可用'), 'Saving with unavailable storage gives visible feedback');
assert.equal(noWrite.run('state.customDashboards[0].numberColumns'),4, 'The active page retains changes when storage is unavailable');
assert.equal(noWrite.storage.size,0);

// Seed source identities stay stable regardless of artifact access order on reload.
const sourceRestore = sandbox([...storage]);
sourceRestore.run('artifactMeta(arts[2]);artifactMeta(arts[0]);artifactMeta(arts[1]);dashboardInit()');
for (const metric of sourceRestore.json('state.customDashboards[0].metrics')) {
  sourceRestore.context.metric = metric;
  const before = env.run(`dashboardSource(${JSON.stringify(metric.sourceId)})?.name`);
  assert.equal(sourceRestore.run('dashboardSource(metric.sourceId)?.name'), before);
}

// Session-local table IDs cannot accidentally rebind after a page reload.
const transientA = sandbox();
transientA.run("arts.push({id:'artifact-local-999',name:'临时业务明细',kind:'table',cols:['记录'],data:[[1]]});dashboardInit()");
const transientId = transientA.run("dashboardSources().find(s=>s.name==='临时业务明细').id");
transientA.context.transientId=transientId;
transientA.run('state.range=30;state.customDashboards[0].metrics[0].sourceId=transientId;dashboardPersist()');
assert.equal(transientA.run('dashboardCompute(state.customDashboards[0].metrics[0]).value'),1);
const transientB = sandbox([...transientA.storage]);
transientB.run("arts.push({id:'artifact-local-999',name:'无关的新表',kind:'table',cols:['记录'],data:[[900]]});dashboardInit()");
assert.equal(transientB.run('state.customDashboards[0].metrics[0].sourceId'),transientId);
assert.notEqual(transientB.run("dashboardSources().find(s=>s.name==='无关的新表').id"),transientId);
assert(transientB.run('dashboardCompute(state.customDashboards[0].metrics[0]).error.includes("来源不可用")'));
for(const scope of [transientA,transientB])scope.run("arts.push({id:'RUN-20261019-output-0',name:'稳定执行产出',kind:'table',runSnapshot:true,cols:['记录'],data:[[20]]})");
assert.equal(transientA.run("dashboardSources().find(s=>s.name==='稳定执行产出').id"),transientB.run("dashboardSources().find(s=>s.name==='稳定执行产出').id"));

// Reselecting an active display type preserves an explicitly saved card width.
run("editDashboard('closing-dashboard');state.dashboardMetricIndex=state.dashboardEditor.metrics.findIndex(m=>m.type==='chart');dashboardUpdateMetric('width','full')");
assert.equal(run('state.dashboardEditor.metrics[state.dashboardMetricIndex].width'),'full');
run("dashboardUpdateMetric('type','chart')");
assert.equal(run('state.dashboardEditor.metrics[state.dashboardMetricIndex].width'),'full');
run("dashboardUpdateMetric('width','half');dashboardUpdateMetric('type','chart')");
assert.equal(run('state.dashboardEditor.metrics[state.dashboardMetricIndex].width'),'half');
run('dashboardCancel()');
assert.deepEqual(json('state.customDashboards[0]'),expectedSaved);

// The rendered editing controls remain valid after saving a layout.
run("dashboardStartLayout('closing-dashboard')");
const layoutHTML=run('dashboardDetailPage()');
assert(layoutHTML.includes('保存布局'));
assert(layoutHTML.includes('取消'));
assert(layoutHTML.includes('draggable="true"'));
for(const match of layoutHTML.matchAll(/on(?:click|change|dragstart|dragover|dragleave|dragend|drop)="([^"]*)"/g)) {
  new Function(match[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&'));
}
console.log('PASS: dashboard ordering, 1–6 numeric cards, half/full charts, save/cancel, reload persistence, selection and storage failures.');

// Each card resizes from its own edge handle, with no count/width menus in the UI.
const resizing = sandbox();
resizing.run(`dashboardInit();state.customDashboards[0].metrics=[
 ...Array.from({length:6},(_,i)=>({...dashboardNewMetric(i),name:'数字'+(i+1)})),
 {...dashboardNewMetric(6),name:'图表A',type:'chart',width:'half'},
 {...dashboardNewMetric(7),name:'图表B',type:'chart',width:'half'}
];dashboardStartLayout('closing-dashboard')`);
const resizingSaved = resizing.json('state.customDashboards[0]');
const rectWidth = (1200+16)/6-16;
let prevented = 0;
resizing.context.resizeDown = {
  button:0,pointerId:7,clientX:rectWidth,
  preventDefault(){prevented++;},stopPropagation(){},
  currentTarget:{closest(selector){return selector==='.cd-layout-item'?{getBoundingClientRect(){return {width:rectWidth};},classList:{add(){}}}:{getBoundingClientRect(){return {width:1200};}};}}
};
resizing.context.resizeMove = {pointerId:7,clientX:592,preventDefault(){prevented++;}};
resizing.run('dashboardResizeStart(resizeDown,0);dashboardResizeMove(resizeMove)');
assert(prevented>0);
assert.equal(resizing.run('state.dashboardLayoutDraft.metrics[0].numberWidth'),2);
assert.equal(resizing.run('dashboardNumberWidth(state.dashboardLayoutDraft.metrics[1],state.dashboardLayoutDraft)'),6,'Resizing one number does not resize its neighbors');
assert.deepEqual(resizing.json('dashboardLayoutRows(state.dashboardLayoutDraft).flatMap(row=>row.items.map(m=>m.id))'),resizing.json('state.dashboardLayoutDraft.metrics.map(m=>m.id)'));
assert.deepEqual(resizing.json('state.customDashboards[0]'),resizingSaved,'Pointer preview never changes saved cards');
resizing.run('dashboardResizeEnd(resizeMove,true)');
assert.equal(resizing.run('dashboardNumberWidth(state.dashboardLayoutDraft.metrics[0],state.dashboardLayoutDraft)'),6,'Pointer cancellation restores the starting width');
assert.equal(resizing.run('state.dashboardResizeGesture'),null);
resizing.run('dashboardResizeStart(resizeDown,0)');
resizing.context.foreignMove={pointerId:8,clientX:1200};
resizing.run('dashboardResizeMove(foreignMove)');
assert.equal(resizing.run('dashboardNumberWidth(state.dashboardLayoutDraft.metrics[0],state.dashboardLayoutDraft)'),6);
resizing.run('dashboardResizeMove(resizeMove);dashboardResizeEnd(resizeMove)');
assert.equal(resizing.run('state.dashboardLayoutDraft.metrics[0].numberWidth'),2);
assert.equal(resizing.run('state.dashboardResizeGesture'),null);
for(const [input,expected] of [[-500,6],[0,6],[187,6],[227,5],[288,4],[389,3],[592,2],[5000,1]]){
  assert.equal(resizing.run(`dashboardResizeChoice({type:'number'},${input},1200)`),expected);
}
assert.equal(resizing.run("dashboardResizeChoice({type:'chart'},300,1200)"),'half');
assert.equal(resizing.run("dashboardResizeChoice({type:'chart'},1200,1200)"),'full');
for(const [key,expected] of [['ArrowLeft',3],['ArrowRight',2],['Home',6],['End',1]]){
  resizing.context.resizeKey={key,preventDefault(){},stopPropagation(){}};
  resizing.run('dashboardResizeKey(resizeKey,0)');
  assert.equal(resizing.run('state.dashboardLayoutDraft.metrics[0].numberWidth'),expected);
}
resizing.run('state.dashboardLayoutDraft.metrics[0].numberWidth=3;dashboardSaveLayout()');
const resizeReload = sandbox([...resizing.storage]);
resizeReload.run('dashboardInit()');
assert.equal(resizeReload.run('state.customDashboards[0].metrics[0].numberWidth'),3);
assert.equal(resizeReload.run('dashboardNumberWidth(state.customDashboards[0].metrics[1],state.customDashboards[0])'),6);
resizing.run("dashboardStartLayout('closing-dashboard')");
const resizeHTML=resizing.run('dashboardDetailPage()');
assert.equal((resizeHTML.match(/role="slider"/g)||[]).length,8);
assert(!/数字指标每行|一行|整行|半行|dashboardLayoutColumns|cd-layout-width/.test(resizeHTML));
assert(resizeHTML.includes('拖动卡片边缘的箭头调整宽度'));
for(const match of resizeHTML.matchAll(/on(?:pointerdown|keydown)="([^"]*)"/g))new Function(match[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&'));
resizing.run("dashboardResizeKey({key:'ArrowLeft',preventDefault(){},stopPropagation(){}},0);dashboardCancelLayout()");
assert.equal(resizing.run('state.customDashboards[0].metrics[0].numberWidth'),3);
console.log('PASS: edge-handle pointer resizing, per-card widths, snapping, cancellation, keyboard controls and persistence.');
