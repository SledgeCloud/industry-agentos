const fs = require('fs'), vm = require('vm'), assert = require('assert');
const nodes = {};
const sandbox = {
  document: {
    getElementById: id => nodes[id] || (nodes[id] = { innerHTML: '', textContent: '', scrollTop: 0, setAttribute(key,value) { this[key]=value; } }),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  },
  setTimeout() {}, clearTimeout() {}, console,
};
vm.createContext(sandbox);
const html = fs.readFileSync('dist/index.html', 'utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], sandbox);
const run = source => vm.runInContext(source, sandbox);
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function handlers(markup) {
  for (const [, code] of markup.matchAll(/\bon(?:click|change|input|submit|keydown|scroll|pointerdown)="([^"]*)"/g)) new Function(decode(code));
}
run("studio.scene='sales';openWorkshopOntology();ontOpenSet('sales-ontology')");
assert.deepEqual(Array.from(run('[ontData().objects.length,ontData().relations.length,ontData().rules.length,ontData().actions.length]')), [24, 39, 9, 57]);
assert(run('ontData().relations.every(r=>ontData().objects.some(o=>o.id===r.from)&&ontData().objects.some(o=>o.id===r.to))'));
assert(run('ontData().actions.every(a=>ontData().objects.some(o=>o.id===a.object))'));
assert(!run('ontScreen()').includes('运行日志'));
handlers(run('ontScreen()'));
for (const kind of ['对象','关系','规则','动作']) {
  run(`ontSelectTab('${kind}')`);
  const first = run('ontScreen()'); handlers(first);
  assert(first.includes('英文标识') && first.includes('展示名称') && first.includes('新建' + kind));
  run('ontPage(2)'); handlers(nodes['ont-table-content'].innerHTML);
  run("ontSearch('no_result_xyz')"); assert(nodes['ont-table-content'].innerHTML.includes('暂无' + kind));
  run("ontSearch('')");
}
run("ontSelectTab('对象');ontViewObject('allocatable_supply');ontSelectTab('属性')");
assert.equal(run("ontRecord('对象','allocatable_supply').properties.length"),16);
assert.equal(run("ontRows('关系').length"),4);
assert.equal(run("ontRows('动作').length"),7);
assert.equal(run("ontRows('规则').length"),1);
assert(run('ontOverview()').includes('<h3>权限控制</h3>'));
assert(!run('ontOverview()').includes('<h3>数据隔离</h3>'));
assert(run('ontOverview()').includes('用户数据隔离'));
assert(run('ontOverview()').includes('写入修改审批说明'));
assert(run('ontOverview()').includes('创建或修改该对象的实例时都会发起审批'));
assert.equal(run('ontUI().objectDraft.writeApproval'),false);
run('ontUI().objectDraft.writeApproval=true;ontCancelObject()');
assert.equal(run('ontUI().objectDraft.writeApproval'),false);
run('ontUI().objectDraft.writeApproval=true;ontSaveObject()');
assert.equal(run("ontRecord('对象','allocatable_supply').writeApproval"),true);
run("ontViewObject('allocation_task')");
assert.equal(run('ontUI().objectDraft.writeApproval'),false);
run("ontViewObject('allocatable_supply');ontSelectTab('属性')");
assert.equal(run('ontUI().objectDraft.writeApproval'),true);
assert.equal(run("ontNewRecord('对象').writeApproval"),false);
handlers(run('ontScreen()'));
run("ontOpenEditor('属性','alloc_days')"); handlers(nodes.overlay.innerHTML);
const beforeProperty = run("JSON.stringify(ontRecord('属性','alloc_days'))");
run("ontEditor.draft.name='取消属性';ontEditor.draft.required=true;ontEditorClose()");
assert.equal(run("JSON.stringify(ontRecord('属性','alloc_days'))"), beforeProperty);
run("ontUI().objectDraft.tags='尚未保存的对象标签';ontOpenEditor('属性','alloc_days');ontEditor.draft.name='销售分货天数';ontEditor.draft.required=true;ontEditor.draft.type='integer';ontSaveEditor()");
assert.equal(run("ontRecord('属性','alloc_days').name"),'销售分货天数');
assert.equal(run("ontUI().objectDraft.tags"),'尚未保存的对象标签');
assert.equal(run("ontRecord('属性','alloc_days').type"),'integer');
assert.equal(run("ontRecord('属性','alloc_days').required"),true);
run("ontOpenEditor('属性','alloc_days',true)");
assert(nodes.overlay.innerHTML.includes('查看属性')); assert(nodes.overlay.innerHTML.includes('disabled'));
run('ontEditorClose()');
run("ontSelectTab('概览');ontUI().objectDraft.name='取消对象';ontCancelObject()");
assert.equal(run("ontRecord('对象','allocatable_supply').name"),'可分货量');
run("ontUI().objectDraft.name='销售可分货量';ontSaveObject()");
assert.equal(run("ontRecord('对象','allocatable_supply').name"),'销售可分货量');
run('ontBack()');
for (const [kind,id] of [['关系','allocatable_qty'],['规则','build_b10_final_allocation_result'],['动作','fn_b10_final_allocation_result']]) {
  run(`ontOpenEditor('${kind}','${id}')`); handlers(nodes.overlay.innerHTML);
  const before = run(`JSON.stringify(ontRecord('${kind}','${id}'))`);
  run("ontEditor.draft.name='取消测试';ontEditorClose()");
  assert.equal(run(`JSON.stringify(ontRecord('${kind}','${id}'))`),before);
  run(`ontOpenEditor('${kind}','${id}');ontEditor.draft.name='保存${kind}';ontSaveEditor()`);
  assert.equal(run(`ontRecord('${kind}','${id}').name`),'保存'+kind);
  run(`ontOpenEditor('${kind}','${id}',true)`); handlers(nodes.overlay.innerHTML);
  assert(nodes.overlay.innerHTML.includes('查看'+kind)); run('ontEditorClose()');
}
run("ontOpenEditor('规则','build_b10_final_allocation_result')");
const beforeRule = run('JSON.stringify(ontEditor.draft)'), globalAction = run("JSON.stringify(ontRecord('动作','fn_b10_final_allocation_result'))");
run('ontConfigureAction(0)'); assert.equal(run('ontEditorStack.length'),1);
run("ontEditor.draft.code='function main() { return { sales: true }; }';ontSaveEditor()");
assert.equal(run('ontEditor.kind'),'规则');
assert.equal(run('ontEditor.draft.executions[0].custom.code'),'function main() { return { sales: true }; }');
assert.equal(run("JSON.stringify(ontRecord('动作','fn_b10_final_allocation_result'))"),globalAction);
run('ontEditorClose()');
assert.equal(run("JSON.stringify(ontRecord('规则','build_b10_final_allocation_result'))"),beforeRule);
run("ontOpenEditor('规则','build_b10_final_allocation_result');ontAddCondition(0);ontMoveExecution(0,1);ontSaveEditor()");
assert.equal(run("ontRecord('规则','build_b10_final_allocation_result').groups[0].conditions.length"),2);
assert.equal(run("ontRecord('规则','build_b10_final_allocation_result').executions[1].customized"),true);
run("ontOpenEditor('动作','fn_b10_final_allocation_result');ontArrayAdd('variables');ontEditor.draft.variables.at(-1).name='sales_channel';ontEditor.draft.variables.at(-1).value='华东';ontEditor.draft.code=ontFunctionCode+'\\n// sales mock';ontEditor.draft.retries=2;ontSaveEditor()");
assert.equal(run("ontRecord('动作','fn_b10_final_allocation_result').variables.at(-1).name"),'sales_channel');
assert.equal(run("ontRecord('动作','fn_b10_final_allocation_result').retries"),2);
assert(run("ontRecord('动作','fn_b10_final_allocation_result').code.endsWith('// sales mock')"));
run("ontOpenEditor('对象',null);ontEditor.draft.id='sales_region';ontEditor.draft.name='销售区域';ontSaveEditor()");
assert(run("!!ontRecord('对象','sales_region')"));
run("ontOpenEditor('对象',null);ontEditor.draft.id='sales_region';ontEditor.draft.name='重复对象';ontSaveEditor()");
assert(nodes['ont-editor-error'].textContent.includes('已存在')); run('ontEditorClose()');
run("ontViewObject('sales_region');ontSelectTab('属性');ontOpenEditor('属性',null);ontEditor.draft.id='region_code';ontEditor.draft.name='区域编码';ontSaveEditor()");
assert.equal(run("ontRecord('对象','sales_region').properties.length"),1);
run("ontOpenEditor('属性','region_code');ontEditor.draft.id='region_id';ontSaveEditor()");
assert(run("!!ontRecord('属性','region_id')"));
run('ontBack()');
const saleSnapshot = run('JSON.stringify(ontData())');
run("wiApplyImport('ontology','独立销售本体.zip','sales');ontOpenSet(wiImports.sales[0].id)");
assert.equal(run("ontData().objects.find(o=>o.id==='allocatable_supply').name"),'可分货量');
run("studio.scene='procurement';openWorkshopOntology();ontOpenSet('procurement-ontology')");
assert.equal(run('ontData().objects.length'),6);
assert(!run('ontScreen()').includes('销售可分货量'));
run("studio.scene='sales';ontOpenSet('sales-ontology')"); assert.equal(run('JSON.stringify(ontData())'),saleSnapshot);
run("ontOpenEditor('规则','build_b10_final_allocation_result');ontEditor.draft.name='<img src=x onerror=alert(1)>';ontSaveEditor();ontSelectTab('规则')");
assert(run('ontScreen()').includes('&lt;img')); assert(!run('ontScreen()').includes('<img src=x'));
run("ontSelectTab('对象集图谱');ontUI().zoom=1;ontZoom(1.2)"); assert.equal(run('ontUI().zoom'),1.2);run('ontFit()'); assert.equal(run('ontUI().zoom'),1);
for (const orientation of ['横向','纵向']) {run(`ontUI().orientation='${orientation}'`);handlers(run('ontScreen()'));}
console.log('Passed: ontology 24/39/9/57 catalogs, graph controls, lists/search/pagination, object and attribute editing, read-only views, save/cancel isolation, rule conditions and ordering, nested action customization, function and variable editing, validation, escaping, and scene/object-set isolation.');
