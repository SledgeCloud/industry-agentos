const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {
    innerHTML: '', textContent: '', value: '', dataset: {}, scrollTop: 0,
    focus() {}, setAttribute() {}, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {} }
  });
  return nodes.get(selector);
};
const storage = new Map();
storage.set('aiops.ontology-knowledge.v1','{"version":1,"tabs":[{"id":"bad","name":"误配的看板","sourceIds":[],"fields":[]}]}');
storage.set('unrelated-demo-key','preserve');
let storageReads=0,storageWrites=0;
const fixedTime = '2026-10-20T14:00:00Z';
class MockDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return Date.parse(fixedTime); }
}
const context = vm.createContext({
  console, Date: MockDate, setTimeout() {}, clearTimeout() {},
  localStorage: { getItem: key => {if(key==='aiops.ontology-knowledge.v1')storageReads++;return storage.get(key)||null;}, setItem: (key,value) => {if(key==='aiops.ontology-knowledge.v1')storageWrites++;storage.set(key,value);},removeItem: key=>storage.delete(key) },
  document: { querySelector: node, querySelectorAll() { return []; }, body: { classList: { add() {}, remove() {}, toggle() {} } } }
});
vm.runInContext(script.slice(0, script.lastIndexOf('\nstate.composerSkill=null;')), context);
const notificationStart=script.indexOf('const notificationTypes=');
const notificationEnd=script.indexOf("document.addEventListener('keydown',e=>{\n  const dialog=",notificationStart);
vm.runInContext(script.slice(notificationStart,notificationEnd),context);
const run = code => vm.runInContext(code, context);
const json = code => JSON.parse(JSON.stringify(run(code)));
run('render=()=>{};nav=()=>{}');

// Verify against the actual legacy seed AND its enrichment, rather than an invented fixture.
const legacy = fs.readFileSync('dist/index.html','utf8');
const old = vm.createContext({});
vm.runInContext(legacy.slice(legacy.indexOf('const knowledgeMock='),legacy.indexOf('function knowledgeColumnHeader')) +
  legacy.slice(legacy.indexOf('const kmLibraries='),legacy.indexOf('function kmMarkdown')), old);
assert.deepEqual(json('ontologyKnowledgeLegacyRecords'), JSON.parse(JSON.stringify(vm.runInContext('knowledgeList',old))));
run('ontologyKnowledgeInit()');
assert.equal(run('ontologyKnowledgeConfigError(ontologyKnowledgeState.config)'), '');
assert.deepEqual(json('ontologyKnowledgeState.config.tabs.map(t=>t.name)'),['全部知识','客户知识']);
assert.deepEqual(json('ontologyKnowledgeState.config.tabs.map(t=>ontologyKnowledgeRows(t).length)'),[10,3]);
assert.deepEqual(json('ontologyKnowledgeState.config.tabs[0].sourceIds'),['customer-knowledge','industry-knowledge','general-knowledge']);
assert.equal(run('ontologyKnowledgeState.config.tabs.flatMap(t=>ontologyKnowledgeRows(t)).length'),13);
assert.equal(run('new Set(ontologyKnowledgeState.config.tabs.flatMap(t=>ontologyKnowledgeRows(t)).map(r=>r.instanceId)).size'),10);
assert.equal(storage.has('aiops.ontology-knowledge.v1'),false,'The previously persisted bad configuration is removed');
assert.equal(storage.get('unrelated-demo-key'),'preserve');
assert.equal(storageReads,0);
assert.equal(storageWrites,0);
// Combined data fixture keeps cross-type operations covered independently of the two demo Tabs.
run(`globalThis.allKnowledgeFixture=()=>{const sourceIds=['customer-knowledge','industry-knowledge','general-knowledge'];return {version:1,tabs:[{id:'all-knowledge',name:'全部知识',sourceIds,fields:ontologyKnowledgeProperties.slice(0,6).map(p=>({id:'knowledge-'+p.id,name:p.name,mappings:Object.fromEntries(sourceIds.map(id=>[id,p.id]))}))}]}};ontologyKnowledgeState.config=allKnowledgeFixture();ontologyKnowledgeState.tabId='all-knowledge'`);
assert.deepEqual(json('ontologyKnowledgeTab().fields.map(f=>f.name)'), ['知识编号','知识描述','知识类型','客户','行业','更新时间']);
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab()).length'),10);
assert.equal(run('new Set(ontologyKnowledgeRows(ontologyKnowledgeTab()).map(r=>r.instanceId)).size'),10);
assert.deepEqual(json("ontologyKnowledgeSources().slice(0,3).map(s=>s.instances.length)"),[3,3,4]);
const customers = json("ontologyKnowledgeRows(ontologyKnowledgeTab()).find(r=>r.instanceId==='KM-002').values");
assert.equal(customers[2],'客户知识');
assert.deepEqual(customers[3],['星河零售','华东商贸']);
assert.deepEqual(customers[4],['零售']);
assert.equal(customers[5],'2026-10-15 09:05');
assert.equal(run('ontologyInstanceValue(false)'),'否');
assert.equal(run('ontologyInstanceValue(0)'),'0');
assert.equal(run('ontologyInstanceValue([])'),'—');
run("ontologyKnowledgeSearch('农业')");
assert.deepEqual(json('ontologyKnowledgeFilteredRows().map(r=>r.instanceId)'),['KM-007']);
run("ontologyKnowledgeSearch('missing');ontologyKnowledgeResults()");
assert.equal(run('ontologyKnowledgeState.page'),1);
assert.match(run('ontologyKnowledgeResults()'),/暂无匹配/);
run("ontologyKnowledgeSearch('');ontologyKnowledgeState.pageSize=5;ontologyKnowledgeState.page=2;ontologyKnowledgeOpenRow(0)");
const secondPageId = run('ontologyKnowledgeFilteredRows()[5].instanceId');
assert(node('#overlay').innerHTML.includes(secondPageId),'Details resolve the visible page row');
assert.equal((node('#overlay').innerHTML.match(/<dt>/g)||[]).length,6);
assert(!node('#overlay').innerHTML.includes('<dt>知识正文'));
assert(!node('#overlay').innerHTML.includes('<dt>知识标题'));
assert(!node('#overlay').innerHTML.includes('<dt>所属知识库'));
assert(!node('#overlay').innerHTML.includes('<details'));

// One type per Tab, multiple types per Tab, different attributes under one display column.
run('ontologyKnowledgeEdit();ontologyKnowledgeAddTab()');
run("ontologyKnowledgeRenameTab('客户与供应商');ontologyKnowledgeToggleSource('sales-customers',true);ontologyKnowledgeToggleSource('procurement-supplier-set',true)");
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab(true)).length'),21,'Rows are unioned, not joined');
run("ontologyKnowledgeTab(true).fields=[{id:'mixed-id',name:'业务编号',mappings:{'sales-customers':'客户编号','procurement-supplier-set':'供应商编号'}},{id:'mixed-name',name:'客户等级 / 供应商名称',mappings:{'sales-customers':'客户等级','procurement-supplier-set':'供应商名称'}}]");
assert.equal(run('ontologyKnowledgeConfigError(ontologyKnowledgeState.draft)'),'');
assert.deepEqual(json('ontologyKnowledgeRows(ontologyKnowledgeTab(true))[0].values'),['CU-101','重点客户']);
assert.deepEqual(json('ontologyKnowledgeRows(ontologyKnowledgeTab(true))[12].values'),['SP-201','供应商 1']);
assert.equal(run('ontologyKnowledgeState.config.tabs.length'),1,'Unsaved tabs do not alter the live config');
run('ontologyKnowledgeSave()');
assert.equal(run('ontologyKnowledgeState.draft'),null);
assert.equal(run('ontologyKnowledgeState.config.tabs.length'),2);
assert.equal(storage.has('aiops.ontology-knowledge.v1'),false,'Applying configuration never writes it to browser storage');
run("openOntologyInstanceDetail({sourceId:'procurement-supplier-set',instanceId:'SP-201',fields:ontologyKnowledgeTab().fields})");
assert.match(node('#overlay').innerHTML,/业务编号/);
assert.match(node('#overlay').innerHTML,/供应商 1/);
assert(!node('#overlay').innerHTML.includes('<dt>知识编号'),'The generic dialog does not hard-code knowledge fields');
assert.equal((node('#overlay').innerHTML.match(/<dt>/g)||[]).length,2,'Custom details contain exactly the two displayed fields');
assert(!node('#overlay').innerHTML.includes('<dt>履约评分'));
run('ontologyKnowledgeEdit();ontologyKnowledgeRenameField(0,"未保存名称");ontologyKnowledgeCancel()');
assert.equal(run('ontologyKnowledgeTab().fields[0].name'),'业务编号');

run('ontologyKnowledgeEdit();ontologyKnowledgeAddTab()');
run("ontologyKnowledgeRenameTab('独立客户');ontologyKnowledgeToggleSource('sales-customers',true);ontologyKnowledgeSave()");
assert.equal(run('ontologyKnowledgeState.config.tabs.length'),3);
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab()).length'),12);
run('globalThis.inSessionConfig=JSON.parse(JSON.stringify(ontologyKnowledgeState.config));ontologyKnowledgeState.config=null;ontologyKnowledgeInit()');
assert.deepEqual(json('ontologyKnowledgeState.config.tabs.map(t=>t.name)'),['全部知识','客户知识'],'A reload restores the two demo Tabs');
run('ontologyKnowledgeState.config=inSessionConfig;ontologyKnowledgeState.tabId=inSessionConfig.tabs[0].id');

// Structural errors remain guarded; incomplete data, empty fields and empty mappings can save.
run('ontologyKnowledgeEdit()');
const checkError = (mutation,pattern) => {
  run('globalThis.validDraft=JSON.stringify(ontologyKnowledgeState.draft)');
  run(mutation);
  assert.match(run('ontologyKnowledgeConfigError(ontologyKnowledgeState.draft)'),pattern);
  run('ontologyKnowledgeState.draft=JSON.parse(validDraft)');
};
checkError("ontologyKnowledgeState.draft.tabs[0].name=' '",/名称/);
checkError("ontologyKnowledgeState.draft.tabs[1].name=ontologyKnowledgeState.draft.tabs[0].name",/重复/);
checkError("ontologyKnowledgeState.draft.tabs[0].sourceIds=['missing']",/不可用/);
checkError("ontologyKnowledgeState.draft.tabs[0].fields[0].mappings['customer-knowledge']='removed-property'",/不可用/);
checkError('ontologyKnowledgeState.draft.tabs[0].fields[1].name=ontologyKnowledgeState.draft.tabs[0].fields[0].name',/重复/);
run("ontologyKnowledgeMapField(0,'industry-knowledge','');ontologyKnowledgeMapField(0,'general-knowledge','')");
assert.equal(run('ontologyKnowledgeConfigError(ontologyKnowledgeState.draft)'),'','Per-type empty mapping is supported');
assert.equal(run("ontologyKnowledgeRows(ontologyKnowledgeTab(true)).find(r=>r.sourceId==='industry-knowledge').values[0]"),null);
run("ontologyKnowledgeRenameField(0,'<img src=x onerror=alert(1)>')");
assert(!run('ontologyKnowledgePreview()').includes('<img src=x'));
assert(run('ontologyKnowledgePreview()').includes('&lt;img'));

// Reproduce the reported new-Tab failure: a selected type with no mapped columns must save,
// even if another Tab has incomplete fields. Unconfigured Tabs can also be saved as drafts.
run("ontologyKnowledgeState.draft.tabs.forEach(t=>t.fields.forEach(f=>{f.mappings={}}));ontologyKnowledgeAddTab();ontologyKnowledgeRenameTab('缺失数据测试');ontologyKnowledgeToggleSource('sales-order-set',true);ontologyKnowledgeTab(true).fields.forEach(f=>{f.mappings={}});ontologyKnowledgeTab(true).fields[0].name='';ontologyKnowledgeSave()");
assert.equal(run('ontologyKnowledgeState.draft'),null);
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab())[0].values.every(v=>v===null)'),true);
run('ontologyKnowledgeEdit();ontologyKnowledgeAddTab();ontologyKnowledgeSave()');
assert.equal(run('ontologyKnowledgeState.draft'),null,'A newly added Tab without sources is a valid saved draft');

// Source and attribute dropdowns use names/codes, expose attribute counts and support search.
run('ontologyKnowledgeState.draft=null;ontologyKnowledgeState.config=allKnowledgeFixture();ontologyKnowledgeState.tabId="all-knowledge";ontologyKnowledgeEdit()');
run("ontologyKnowledgeState.picker={kind:'sources',query:'customer_knowledge'}");
assert.match(run('ontologyKnowledgePickerList()'),/客户知识/);
assert.match(run('ontologyKnowledgePickerList()'),/customer_knowledge/);
assert.match(run('ontologyKnowledgePickerList()'),/19 个属性/);
assert(!run('ontologyKnowledgePickerList()').includes('条实例'));
assert(!run('ontologyKnowledgePickerList()').includes('industry_knowledge'));
run("ontologyKnowledgeState.picker={kind:'property',query:'updatedAt',sourceId:'customer-knowledge',fieldIndex:0}");
assert.match(run('ontologyKnowledgePickerList()'),/更新时间/);
assert.match(run('ontologyKnowledgePickerList()'),/updatedAt/);
assert(!run('ontologyKnowledgePickerList()').includes('知识描述'));
assert.match(run('ontologyKnowledgeEditor()'),/ok-mapping-transposed/);
run('ontologyKnowledgeCancel()');

// Column filters use actual multi-value entries, with OR inside one column and AND across columns.
run("ontologyKnowledgeState.page=1;ontologyKnowledgeState.pageSize=10;ontologyKnowledgeState.filters={'knowledge-knowledgeType':['行业知识'],'knowledge-industries':['制造业']}");
assert.deepEqual(json('ontologyKnowledgeFilteredRows().map(r=>r.instanceId)'),['KM-005']);
run("ontologyKnowledgeState.filters={'knowledge-customers':['华东商贸']};ontologyKnowledgeState.picker={kind:'filter',fieldIndex:3,fieldId:'knowledge-customers',query:'华东',selected:[]}");
assert.match(run('ontologyKnowledgePickerList()'),/华东商贸/);
assert(!run('ontologyKnowledgePickerList()').includes('星河零售'));
assert.equal(run('ontologyKnowledgeFilteredRows().length'),4);
run('ontologyKnowledgeResetFilters()');
assert.equal(run('ontologyKnowledgeFilteredRows().length'),10);
run("state.range=30");
const statsBefore = json('ontologyKnowledgeStats(ontologyKnowledgeTab())');
assert.deepEqual(statsBefore,{total:10,added:9,modified:2,discarded:0});
run("state.range='custom';state.customDates={start:'2026-09-01',end:'2026-09-30'}");
assert.deepEqual(json('ontologyKnowledgeStats(ontologyKnowledgeTab())'),{total:1,added:1,modified:0,discarded:0});
run('state.range=30');

// Edit/cancel, empty optional values, toggle and two-step deletion affect every Tab using the source.
run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-002'});ontologyKnowledgeUpdateInstanceProperty(1,'新的知识描述');ontologyKnowledgeState.instanceEdit=null");
assert.notEqual(run("ontologyKnowledgeSource('customer-knowledge').instances[0].values.desc"),'新的知识描述');
run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-002'});ontologyKnowledgeUpdateInstanceProperty(1,'新的知识描述');ontologyKnowledgeUpdateInstanceProperty(3,'');ontologyKnowledgeSaveInstance()");
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances[0].values.desc"),'新的知识描述');
assert.deepEqual(json("ontologyKnowledgeSource('customer-knowledge').instances[0].values.customers"),[]);
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances[0].values.tags.some(t=>t.startsWith('客户：'))"),false,'Derived customers and source tags stay consistent');
assert.equal(run("ontologyKnowledgeStats(ontologyKnowledgeTab()).modified"),3);
const beforeEnabled=run('ontologyKnowledgeVisibleRow(0).enabled');
run('ontologyKnowledgeToggleRow(0)');
assert.equal(run('ontologyKnowledgeVisibleRow(0).enabled'),!beforeEnabled);
run('ontologyKnowledgeToggleRow(0)');
assert.equal(run('ontologyKnowledgeVisibleRow(0).enabled'),beforeEnabled);
run('ontologyKnowledgeDeleteRow(0)');
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab()).length'),10,'Opening confirmation must not delete');
assert.match(node('#overlay').innerHTML,/确认删除/);
run('ontologyKnowledgeState.pendingDelete=null;closeModal()');
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab()).length'),10);
run('ontologyKnowledgeDeleteRow(0);ontologyKnowledgeConfirmDelete()');
assert.equal(run('ontologyKnowledgeRows(ontologyKnowledgeTab()).length'),9);
assert.equal(run('ontologyKnowledgeStats(ontologyKnowledgeTab()).discarded'),1);
assert.equal(run("ontologyKnowledgeRows({...ontologyKnowledgeTab(),sourceIds:['customer-knowledge']}).length"),2);
assert.equal(run('ontologyKnowledgeLegacyRecords.length'),10,'Original legacy records are untouched');
assert.match(run('ontologyKnowledgePage()'),/本期新增/);
assert(!run('ontologyKnowledgePage()').includes('ok-source-tags'));
assert(!run('ontologyKnowledgePage()').includes('客户、行业取自'));
assert.match(run('ontologyKnowledgeResults()'),/修改 KM-/);
assert.match(run('ontologyKnowledgeResults()'),/删除 KM-/);

// The review case is a real local workflow: pending proposals do not mutate business data.
run("state.page='本体知识运营';ontologyKnowledgeState.instanceEdit=null");
assert.equal(run("ontologyKnowledgeRequiresReview('customer-knowledge','KM-003')"),true);
assert.equal(run("ontologyKnowledgeRequiresReview('customer-knowledge','KM-002')"),false);
const reviewBefore=run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc");
const countBefore=run('notifications.length');
run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'})");
assert.match(node('#overlay').innerHTML,/发起评审/);
assert(!node('#overlay').innerHTML.includes('>保存修改<'));
assert.equal((node('#overlay').innerHTML.match(/class="ok-record-field"/g)||[]).length,6);
run("ontologyKnowledgeUpdateInstanceProperty(1,'申请评审的新描述');ontologyKnowledgeSaveInstance()");
assert.equal(run('notifications.length'),countBefore+1);
const reviewId=run('notifications[0].id');
assert.equal(run(`notifications.find(n=>n.id==='${reviewId}').status`),'pending');
assert.equal(run(`notifications.find(n=>n.id==='${reviewId}').read`),false);
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),reviewBefore);
run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'});ontologyKnowledgeUpdateInstanceProperty(1,'重复提交');ontologyKnowledgeSaveInstance()");
assert.equal(run('notifications.length'),countBefore+1,'Duplicate pending requests are blocked');
assert.match(node('#ok-instance-edit-error').textContent,/已有待评审/);
run(`openNotification('${reviewId}')`);
assert.equal(run(`notifications.find(n=>n.id==='${reviewId}').read`),true);
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),reviewBefore,'Reading does not approve');
run(`decideNotification('${reviewId}','approved',true)`);
assert.equal(run(`notifications.find(n=>n.id==='${reviewId}').status`),'approved');
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),'申请评审的新描述');
run(`decideNotification('${reviewId}','approved',true)`);
assert.equal(run(`notificationInstanceStore[notificationInstanceKey(notifications.find(n=>n.id==='${reviewId}'),notifications.find(n=>n.id==='${reviewId}').changes[0])].version`),2,'Repeated approval does not apply twice');

run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'});ontologyKnowledgeUpdateInstanceProperty(1,'将被驳回的描述');ontologyKnowledgeSaveInstance()");
const rejectionId=run('notifications[0].id');
node('#overlay .notification-dialog').dataset.notification=rejectionId;
node('#notificationRejectReason').value='';
run(`decideNotification('${rejectionId}','rejected')`);
assert.equal(run(`notifications.find(n=>n.id==='${rejectionId}').status`),'pending');
node('#notificationRejectReason').value='业务口径仍需确认';
node('#overlay .notification-rejection-dialog').dataset.rejection=run('state.notifications.rejection.token');
run('confirmNotificationRejection()');
assert.equal(run(`notifications.find(n=>n.id==='${rejectionId}').status`),'rejected');
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),'申请评审的新描述');

run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'});ontologyKnowledgeUpdateInstanceProperty(1,'过时的评审快照');ontologyKnowledgeSaveInstance()");
const staleId=run('notifications[0].id');
run("ontologyKnowledgeToggleRow(ontologyKnowledgeFilteredRows().findIndex(r=>r.instanceId==='KM-003'))");
run(`decideNotification('${staleId}','approved',true)`);
assert.equal(run(`notifications.find(n=>n.id==='${staleId}').status`),'pending');
run(`showNotificationRejection('${staleId}')`);
node('#overlay .notification-rejection-dialog').dataset.rejection=run('state.notifications.rejection.token');
node('#notificationRejectReason').value='数据已变化，重新核对后申请';
run('confirmNotificationRejection()');
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),'申请评审的新描述');

run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'});ontologyKnowledgeUpdateInstanceProperty(1,'批量评审通过后的描述');ontologyKnowledgeSaveInstance()");
const batchReviewId=run('notifications[0].id');
run(`state.notifications.batch={ids:['${batchReviewId}'],targets:[{id:'${batchReviewId}',ids:notificationPendingRows(notifications.find(n=>n.id==='${batchReviewId}')).map(c=>c.instanceId)}],decision:'approved',token:'knowledge-test'}`);
node('#overlay .notification-batch-dialog').dataset.batch='knowledge-test';
run('decideNotificationBatch()');
assert.equal(run(`notifications.find(n=>n.id==='${batchReviewId}').status`),'approved');
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),'批量评审通过后的描述');

run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'});ontologyKnowledgeUpdateInstanceProperty(1,'待调整的评审描述');ontologyKnowledgeSaveInstance();const amendedReview=notifications[0];openNotificationAmendment(amendedReview.id);const amendedToken=state.notifications.amendmentEditor.token,amendedDraft=JSON.parse(JSON.stringify(amendedReview.changes));amendedDraft[0].after['知识描述']='人工核对后的评审描述'");
assert(!node('#overlay').innerHTML.includes('data-amend-field="知识编号"'),'Mapped identifiers remain read-only in the approval editor');
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),'批量评审通过后的描述','An approval draft does not mutate live knowledge');
assert.equal(run('approveNotificationAmendment(amendedReview.id,amendedDraft,amendedToken).ok'),true);
assert.equal(run('amendedReview.status'),'approved');
assert.equal(run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"),'人工核对后的评审描述','The approved amendment is committed through the real local knowledge workflow');
assert.equal(run("amendedReview.amendment.originalChanges[0].after['知识描述']"),'待调整的评审描述');
assert.equal(run("amendedReview.changes[0].after['数据来源']"),'人工输入');
assert.equal(run('approveNotificationAmendment(amendedReview.id,amendedDraft,amendedToken).ok'),false,'Amended knowledge reviews cannot be applied twice');

// No browser storage is needed for applying edits, and stale persisted data cannot return.
run("ontologyKnowledgeEdit();localStorage.getItem=()=>{throw Error('must not read')};localStorage.setItem=()=>{throw Error('must not write')};ontologyKnowledgeSave()");
assert.equal(run('ontologyKnowledgeState.draft'),null);
storage.set('aiops.ontology-knowledge.v1','{"version":1,"tabs":[]}');
run('ontologyKnowledgeState.config=null;ontologyKnowledgeInit()');
assert.deepEqual(json('ontologyKnowledgeState.config.tabs.map(t=>t.name)'),['全部知识','客户知识']);
assert.equal(storage.has('aiops.ontology-knowledge.v1'),false);
assert.equal(storageReads,0);
assert.equal(storageWrites,0);
run("ontologyKnowledgeState.config=null;localStorage.removeItem=()=>{throw Error('storage blocked')};ontologyKnowledgeInit()");
assert.equal(run('ontologyKnowledgeState.config.tabs.length'),2,'Demo initialization works even when browser storage is blocked');
assert.match(run('ontologyKnowledgePage()'),/本体知识运营/);
run('ontologyKnowledgeEdit()');
assert.match(run('ontologyKnowledgeEditor()'),/配置本体知识运营/);
console.log('PASS: two seeded demo Tabs, stale configuration cleanup, no storage reads/writes, reload reset, configured details/editing, direct save, review notifications/writeback, filters, lifecycle counts and confirmed deletion');
