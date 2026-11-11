const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes = new Map();
const classes = new Set();
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {
    innerHTML: '', value: '', dataset: {}, scrollTop: 0,
    focus() {}, setAttribute() {},
    classList: { add() {}, remove() {} }
  });
  return nodes.get(selector);
};
const context = vm.createContext({
  console, setTimeout() {}, clearTimeout() {},
  document: {
    querySelector: node,
    body: { classList: {
      remove(...values) { values.forEach(value => classes.delete(value)); },
      toggle(value, enabled) { enabled ? classes.add(value) : classes.delete(value); }
    } }
  }
});
vm.runInContext(script.slice(0, script.lastIndexOf('\nstate.composerSkill=null;')), context);
const run = code => vm.runInContext(code, context);
run('render=()=>{}');

assert.equal((html.match(/<section class="chat"/g) || []).length, 1);
for (const id of ['messages', 'prompt', 'refs']) {
  assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
}
assert(!/\.chat\{[^}]*grid-column:3/.test(html));
assert(!html.includes('右侧聊天'));
const composer = node('#prompt');
const messages = node('#messages');
const assertCenter = () => {
  assert.equal(run('state.cuiOpen'), true);
  assert.equal(run('state.guiOpen'), false);
  assert(classes.has('gui-hidden'));
  assert(!classes.has('cui-hidden'));
  assert.equal(node('#prompt'), composer);
  assert.equal(node('#messages'), messages);
};

run("openSession('workspace',0)");
assertCenter();
assert(messages.innerHTML.includes('制造业规则被否决原因'));
run("openSession('scheduled',0)");
assert.equal(run('state.page'), '定时任务');
assert.equal(run('state.guiOpen'), true);
assert.equal(run('state.cuiOpen'), false);
assert.equal(run('state.selectedConversation'), null);
run("state.refs=['旧任务引用'];state.composerSkill='定时任务';state.observedDetail={index:0};addObservedSession(0)");
assert.equal(run('state.guiOpen'), true);
assert.equal(run('state.cuiOpen'), true);
assert.equal(run('state.splitView'), true);
assert(classes.has('session-split'));
assert.equal(run('state.page'), '线上会话分析');
assert.equal(run('state.observedDetail.index'), 0);
assert.equal(run('state.mode'), 'workspace');
assert.equal(run('state.draft'), true);
assert.equal(run('state.selectedConversation'), null);
assert.equal(run('state.composerSkill'), null);
assert.equal(run('state.messages.length'), 0);
assert.equal(run('state.refs.length'), 1);
assert.equal(run('state.refs[0]'), run('sessionRef(observedSessions[0])'));
assert(node('#refs').innerHTML.includes(run('observedSessions[0].id')));
assert.equal(composer.value, '');
assert(!messages.innerHTML.includes('旧任务引用'));
for (const action of ["togglePanel('gui')", "togglePanel('cui')", "revealCui()", "setView('gui')", "setView('cui')"]) {
  run(action);
  assert.notEqual(run('state.guiOpen'), run('state.cuiOpen'), action);
}
assertCenter();
console.log('Passed: central chat for workspace and referenced production sessions; independent scheduled-task page; fresh analysis context; exclusive content/chat navigation.');

// A fresh workspace chat must retain the scheduled-task demo entry and all follow-ups.
run('focusPromptEnd=()=>{};streamDemoMessage=()=>{}');
run("newChat('workspace')");
const taskCount=run('state.tasks.length'),sessionCount=run('state.sessions.length');
run("handleComposerKey({key:' ',preventDefault(){}})");
assert.equal(composer.value,run('SCHEDULED_DEMO.input'));
assert.equal(run('state.composerSkill'),'定时任务');
run('send()');
assert.equal(run('state.tasks.length'),taskCount+1);
assert.equal(run('state.sessions.length'),sessionCount);
assert.equal(run('state.mode'),'scheduled');
assert.equal(run('state.tasks[state.selectedConversation.index].demoStage'),1);
assert(messages.innerHTML.includes('已拆解为三份结构化结果'));
for(let stage=2;stage<=4;stage++){
  run("handleComposerKey({key:' ',preventDefault(){}})");
  assert.equal(composer.value,run(`SCHEDULED_DEMO_FOLLOWUPS[${stage-2}]`));
  run('send()');
  assert.equal(run('state.tasks[state.selectedConversation.index].demoStage'),stage);
}
assert(messages.innerHTML.includes('定时任务配置已定稿'));
assert.equal(run('state.tasks[state.selectedConversation.index].outputs.length'),3);
run("handleComposerKey({key:' ',preventDefault(){}})");
assert.equal(composer.value,'');
run("newChat('workspace')");composer.value='正在编写的内容';
run("handleComposerKey({key:' ',preventDefault(){}})");
assert.equal(composer.value,'正在编写的内容');
console.log('Passed: space-triggered scheduled demo in new workspace chat, four-stage conversation, three outputs, and existing text protection.');

// Completed demo tables must expose complete, consistent batch data through Artifacts.
const demoIndex=run('state.tasks.findIndex(t=>t.demo)');
const batch=JSON.parse(run(`JSON.stringify(state.tasks[${demoIndex}].demoBatch)`));
const expectedCounts={close_session_message:16,close_findings_detail:12,close_rule_changes:6};
const generated=JSON.parse(run(`JSON.stringify(arts.filter(a=>a.ownerTask===${demoIndex}))`));
assert.equal(generated.length,3);
const sessionIds=new Set(batch.tables.close_session_message.map(r=>r.session_id));
assert.equal(sessionIds.size,8);
for(const artifact of generated){
  assert.equal(artifact.data.length,expectedCounts[artifact.name]);
  assert.equal(Number(artifact.rows),artifact.data.length);
  assert.equal(artifact.mock,true);
  for(const row of artifact.data)assert.equal(row.length,artifact.cols.length);
  for(const record of batch.tables[artifact.name]){
    assert.deepEqual(Object.keys(record).sort(),[...artifact.cols].sort());
    assert(sessionIds.has(record.session_id));
    assert.equal(record.batch_id,batch.id);
    assert.equal(record.session_date,batch.date);
    assert.equal(JSON.parse(record.raw_record).mock,true);
  }
  const outputIndex=run(`state.tasks[${demoIndex}].outputs.findIndex(o=>o.name===${JSON.stringify(artifact.name)})`);
  run(`openTaskOutput(${demoIndex},${outputIndex})`);
  assert.equal(run('state.page'),'工作区');
  assert.equal(run('state.artifactPreview.mode'),'inline');
  assert.equal(run('state.splitView'),true);
  assert.equal(run('arts[state.detail].name'),artifact.name);
  assert(run('artifactPreviewHTML()').includes(artifact.name));
  assert(run('artifactSchemaTable(arts[state.detail])').includes('batch_id'));
  assert(run('scheduledDemoArtifactHistory(arts[state.detail])').includes(batch.id));
  run('artifactEvidence(0)');
  assert(node('#overlay').innerHTML.includes(artifact.name+' · 记录详情'));
  assert(node('#overlay').innerHTML.includes(batch.id));
  assert(node('#overlay').innerHTML.includes(artifact.cols[artifact.cols.length-1]));
}
for(const message of batch.tables.close_session_message){
  assert.equal(typeof message.has_report_url,'boolean');
  assert.equal(typeof message.contain_file_name,'boolean');
  assert.equal(message.has_report_url,Boolean(message.report_url));
  assert.equal(message.contain_file_name,Boolean(message.file_names));
}
const falseMessage=batch.tables.close_session_message.findIndex(r=>!r.has_report_url);
run(`openTaskOutput(${demoIndex},0);artifactEvidence(${falseMessage})`);
assert(node('#overlay').innerHTML.includes('<b>false</b>'));
const totalBefore=run('arts.length');
run(`syncTaskArtifacts(state.tasks[${demoIndex}],${demoIndex})`);
assert.equal(run('arts.length'),totalBefore);
assert.equal(run(`state.tasks[${demoIndex}].demoBatch.id`),batch.id);
console.log('Passed: three clickable demo artifacts; 16/12/6 full-schema rows; shared session/date/batch lineage; boolean fidelity; record and schema views; repeat sync without duplicates.');
