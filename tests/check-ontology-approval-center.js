const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);

function fixture() {
  const nodes = new Map();
  const node = selector => {
    if (/^#overlay \.notification-[\w-]*(?:dialog|editor)$/.test(selector)) selector = '#overlay .modal';
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', textContent: '', value: '', scrollTop: 0, dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      focus() {}, setAttribute() {}, querySelectorAll() { return []; }
    });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    console, setTimeout() {}, clearTimeout() {},
    document: {
      querySelector: node, querySelectorAll: () => context.inputs || [],
      getElementById() { return null; },
      body: { classList: { add() {}, remove() {}, toggle() {} } }
    }
  });
  vm.runInContext(script.slice(0, script.lastIndexOf('\nstate.composerSkill=null;')), context);
  const start = script.indexOf('const notificationTypes=');
  const end = script.indexOf("document.addEventListener('keydown',e=>{\n  const dialog=", start);
  vm.runInContext(script.slice(start, end), context);
  const run = code => vm.runInContext(code, context);
  const read = code => JSON.parse(JSON.stringify(run(code)));
  run("render=()=>{};nav=()=>{};state.page='本体知识运营';ontologyKnowledgeInit()");
  return { run, read, node, context, dialog: () => node('#overlay').innerHTML };
}

let f = fixture();
f.run("Object.assign(state.notifications,{type:'approval',category:'knowledge',query:'审核',page:2,selected:['N-011']});globalThis.previousNotifications=state.notifications;openOntologyApprovalCenter()");
assert.equal(f.run('state.page'), '本体知识运营');
assert.equal(f.run('state.ontologyApprovalCenter.view'), 'list');
assert(f.dialog().includes('审批中心') && f.dialog().includes('批量修改'));
assert(!f.dialog().includes('<h1>消息通知</h1>'));
assert(!f.dialog().includes('新增审核知识待审批'));
assert.deepEqual(f.read('filteredNotifications().map(n=>n.id).sort()'), f.read("notifications.filter(n=>n.type==='approval'&&n.category==='ontology').map(n=>n.id).sort()"));
assert(f.dialog().includes('可分货量调整审批已通过') && f.dialog().includes('可分货量修改审批未通过'), 'The dedicated center includes processed history');
assert.match(f.run('notificationOverview()'), /5<\/b>条审批.*2<\/b>条未读.*3<\/b>项待审批/);

f.run("state.notifications.pageSize=2;selectAllNotificationApprovals(true);changeNotificationPage(1)");
assert.equal(f.run('state.notifications.page'), 2);
assert.deepEqual(f.read('state.notifications.selected.slice().sort()'), ['N-013', 'N-014', 'N-015']);
f.run("setNotificationRange('history')");
assert.equal(f.run("filteredNotifications().every(n=>n.category==='ontology')"), true);
assert(f.node('#ontologyApprovalContent').innerHTML.includes('历史消息'));
f.run("setNotificationType('evaluation');setNotificationApprovalCategory('knowledge');resetNotificationFilters()");
assert.equal(f.run('state.notifications.type'), 'approval');
assert.equal(f.run('state.notifications.category'), 'ontology');
assert.equal(f.run('filteredNotifications().length'), 5);

f.run("state.notifications.query='可分货量';state.notifications.pageSize=2;state.notifications.page=2");
f.node('#overlay .modalbody').scrollTop = 120;
f.run("openNotification('N-013')");
assert.equal(f.run('state.ontologyApprovalCenter.view'), 'detail');
assert(f.dialog().includes('返回审批中心') && f.dialog().includes('全部通过'));
assert(f.dialog().includes('修改前') && f.dialog().includes('查看当前实例 AS-20261019-006'));
assert.equal(f.run("notifications.find(n=>n.id==='N-013').read"), true);
f.run("decideNotificationInstance('N-013','AS-20261020-001','approved');closeModal()");
assert.equal(f.run('state.ontologyApprovalCenter.view'), 'list');
assert.equal(f.run('state.notifications.query'), '可分货量');
assert.equal(f.run('state.notifications.page'), 2);
assert.equal(f.node('#overlay .modalbody').scrollTop, 120);
assert.equal(f.run("notificationInstanceStore['ontology::可分货量::AS-20261020-001'].data['可分货量']"), 180);
f.run('closeModal()');
assert.equal(f.run('state.notifications===previousNotifications'), true);
assert.equal(f.run('state.notifications.query'), '审核');
assert.deepEqual(f.read('state.notifications.selected'), ['N-011']);
assert.equal(f.run('state.ontologyApprovalCenter'), null);
assert.equal(f.dialog(), '');
assert.equal(f.run("notifications.find(n=>n.id==='N-013').changes[0].status"), 'approved', 'Decisions remain visible in the original notification records');

// Rejection validation and batch operations retain the dedicated scope and return path.
f = fixture();
f.run("openOntologyApprovalCenter();showNotificationRejection('N-013','AS-20261020-001');confirmNotificationRejection()");
assert.equal(f.node('#notificationRejectError').textContent, '请填写不通过理由');
f.node('#notificationRejectReason').value = '请补充依据';
f.run('confirmNotificationRejection();closeModal();selectAllNotificationApprovals(true);openNotificationBatch("approved");decideNotificationBatch()');
assert.equal(f.run('state.notifications.lastBatchResult.processed.length'), 11);
assert.equal(f.run("notifications.find(n=>n.id==='N-011').status"), 'pending');
assert.equal(f.run("notifications.find(n=>n.id==='N-008').status"), 'pending');
assert(f.dialog().includes('批量审批结果'));
f.run('closeModal()');
assert.equal(f.run('state.ontologyApprovalCenter.view'), 'list');
assert.equal(f.run("filteredNotifications().filter(n=>n.status==='pending').length"), 0);
f.run("setNotificationApprovalStatus('mixed')");
assert.deepEqual(f.read('filteredNotifications().map(n=>n.id)'), ['N-013']);

f = fixture();
f.run('openOntologyApprovalCenter();selectAllNotificationApprovals(true);openNotificationBatch("rejected");decideNotificationBatch()');
assert.equal(f.node('#notificationBatchError').textContent, '请填写不通过理由');
f.node('#notificationBatchReason').value = '需要核对数据来源';
f.run('decideNotificationBatch();closeModal()');
assert.equal(f.run('state.notifications.lastBatchResult.processed.length'), 12);
assert.equal(f.run("filteredNotifications().filter(n=>n.status==='pending').length"), 0);
assert.equal(f.run("notifications.find(n=>n.id==='N-004').status"), 'pending');

f = fixture();
f.run('openOntologyApprovalCenter();selectAllNotificationApprovals(true);openNotificationBatch("amended")');
f.context.inputs = [{ dataset: { amendNotification: 'N-013', amendIndex: '0', amendField: '可分货量', valueType: 'number' }, value: '175' }];
f.run('saveNotificationAmendment();closeModal()');
assert.equal(f.run('state.ontologyApprovalCenter.view'), 'list');
assert.equal(f.run('state.notifications.lastBatchResult.processed.length'), 12);
assert.equal(f.run("notifications.find(n=>n.id==='N-013').changes[0].after['可分货量']"), 175);
assert.equal(f.run("notifications.find(n=>n.id==='N-013').changes[0].after['数据来源']"), '人工输入');
assert.equal(f.run("notifications.find(n=>n.id==='N-011').status"), 'pending');

// New knowledge review requests join the same list and write back through the shared handler.
f = fixture();
f.run("ontologyKnowledgeEditInstance({sourceId:'customer-knowledge',instanceId:'KM-003'});ontologyKnowledgeUpdateInstanceProperty(1,'审批中心核对后的月结口径');ontologyKnowledgeSaveInstance();globalThis.reviewId=notifications[0].id;openOntologyApprovalCenter()");
assert.equal(f.run('filteredNotifications().some(n=>n.id===reviewId)'), true);
f.run("openNotification(reviewId);decideNotification(reviewId,'approved');closeModal();closeModal()");
assert.equal(f.run("ontologyKnowledgeSource('customer-knowledge').instances.find(r=>r.id==='KM-003').values.desc"), '审批中心核对后的月结口径');
assert.equal(f.run('notifications.find(n=>n.id===reviewId).status'), 'approved');
f.run('openOntologyApprovalCenter();openNotification(reviewId);openNotificationSource(reviewId)');
assert.equal(f.run('state.ontologyApprovalCenter'), null);
assert.equal(f.run('state.page'), '本体知识运营');
assert.equal(f.dialog(), '');

console.log('PASS: dedicated ontology scope, historical records, isolated filters and cross-page selection, shared read/decision state, detail return and scroll restoration, required rejection reasons, all batch modes, knowledge writeback and source navigation');
