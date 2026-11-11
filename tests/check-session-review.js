const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

const html = fs.readFileSync('dist/aiops-extensions.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(script);
const nodes = new Map();
const streamTicks = [], stoppedStreams = new Set();
let streamElements = [], streamNodes = [];
const node = selector => {
  if (!nodes.has(selector)) nodes.set(selector, {
    innerHTML: '', value: '', textContent: '', dataset: {}, scrollTop: 0,
    classList: { add() {}, remove() {}, toggle() {} },
    focus() {}, setAttribute() {}, toggleAttribute() {},
    querySelectorAll() { return []; }
  });
  return nodes.get(selector);
};
const context = vm.createContext({
  console, notificationNav: () => '', setTimeout() {}, clearTimeout() {},
  setInterval(tick) { streamTicks.push(tick); return streamTicks.length; },
  clearInterval(id) { stoppedStreams.add(id); },
  document: {
    querySelector: node, querySelectorAll: () => streamElements,
    createTreeWalker() { let i=0; return { nextNode: () => streamNodes[i++] }; },
    body: { classList: { remove() {}, toggle() {} } }
  }
});
vm.runInContext(script.slice(0, script.lastIndexOf('\nstate.composerSkill=null;')), context);
const run = code => vm.runInContext(code, context);
const json = code => JSON.parse(run(`JSON.stringify(${code})`));
run('render=()=>{};focusPromptEnd=()=>{}');
const prompt = node('#prompt'), messages = node('#messages');
const send = value => { prompt.value = value; run('send()'); };
const reviewIndex = run('state.sessions.findIndex(s=>s.sessionReview)');
const openReview = () => run(`openSession('workspace',${reviewIndex})`);
openReview();
assert(messages.innerHTML.includes('让我一起分析问题与根因'));
assert.equal(run('state.sessions.filter(s=>s.sessionReview).length'), 1);
assert.equal(run('sessionReviewCurrent().stage'), 0);

// Stage 0 requires two distinct source sessions, and editing is never overwritten.
run('fillSessionReviewPrompt(0)');
assert.deepEqual(json('state.refs'), json('SESSION_REVIEW_DEMO.sourceIds.map(id=>sessionRef(observedSessions.find(s=>s.id===id)))'));
assert(node('#refs').innerHTML.includes('CR-1024'));
assert(node('#refs').innerHTML.includes('CR-1023'));
const input = prompt.value;
run('fillSessionReviewPrompt(0)');
assert.equal(prompt.value, input);
run('state.refs.pop()');
run('send()');
assert.equal(run('sessionReviewCurrent().stage'), 0);
assert(messages.innerHTML.includes('两个不同的会话'));
run('fillSessionReviewPrompt(0);send()');
assert.equal(run('sessionReviewCurrent().stage'), 1);
assert.deepEqual(json('sessionReviewCurrent().sourceIds'), ['CR-1024', 'CR-1023']);
assert(messages.innerHTML.includes('初步发现，等你修正'));
assert(messages.innerHTML.includes('根因假设'));
assert(!messages.innerHTML.includes('已关联 12 个会话'));
assert.equal(json('state.messages.filter(m=>m.type==="user").at(-1).refs').length, 2);

// Confirmation cannot skip the correction round, and old actions cannot rerun analysis.
send('确认');
assert.equal(run('sessionReviewCurrent().stage'), 1);
assert(messages.innerHTML.includes('请先补充一轮修正意见'));
assert.equal(run('fillSessionReviewPrompt(0)'), false);
run("state.refs=[sessionRef(observedSessions[2])]");
send('把分析范围换成这个会话');
assert.equal(run('sessionReviewCurrent().stage'), 1);
assert.deepEqual(json('sessionReviewCurrent().sourceIds'), ['CR-1024', 'CR-1023']);
run("handleComposerKey({key:' ',preventDefault(){}})");
assert.equal(prompt.value, run('SESSION_REVIEW_DEMO.correction'));
run('send()');
assert.equal(run('sessionReviewCurrent().stage'), 2);
assert.equal(run('sessionReviewCurrent().demoCorrection'), true);
assert(messages.innerHTML.includes('撤回'));
assert(messages.innerHTML.includes('合并为 1 个问题'));
assert(messages.innerHTML.includes('适用范围待核验'));
assert(!messages.innerHTML.includes('最终问题已确认'));

// Opening evidence retains the review, conversation, references and unsent correction.
prompt.value = '尚未发送的补充';
const selectedBefore = json('state.selectedConversation');
const beforeCount = run('state.messages.length');
run("openSessionReviewSource('CR-1023')");
assert.deepEqual(json('state.selectedConversation'), selectedBefore);
assert.equal(run('state.observedDetail.index'), 1);
assert.equal(run('state.splitView'), true);
assert.equal(run('state.messages.length'), beforeCount);
assert.equal(prompt.value, '尚未发送的补充');
openReview();
assert.equal(run('sessionReviewCurrent().stage'), 2);
assert.equal(run('sessionReviewCurrent().corrections[0]'), run('SESSION_REVIEW_DEMO.correction'));
run("handleComposerKey({key:' ',preventDefault(){}});send()");
assert.equal(run('sessionReviewCurrent().stage'), 3);
assert.equal(run('sessionReviewCurrent().final.status'), 'confirmed');
assert(messages.innerHTML.includes('最终问题已确认'));
assert(messages.innerHTML.includes('已确认 · 待处理'));
assert(messages.innerHTML.includes('仍待验证'));
const final = json('sessionReviewCurrent().final');
send('我还有其他问题');
assert.deepEqual(json('sessionReviewCurrent().final'), final);
openReview();
assert(messages.innerHTML.includes('最终问题已确认'));

// The same flow works when a new chat references two sessions with @.
run("newChat('workspace');ref(sessionRef(observedSessions[0]));ref(sessionRef(observedSessions[1]))");
send('分析两个会话的问题与根因');
assert.equal(run('sessionReviewCurrent().stage'), 1);
const correction = '<img src=x onerror=alert(1)> 请保留为证据不足，不认定业务错误。';
send(correction);
assert.equal(run('sessionReviewCurrent().stage'), 2);
assert(messages.innerHTML.includes('&lt;img'));
assert(!messages.innerHTML.includes('<img src=x'));
assert.equal(run('sessionReviewCurrent().demoCorrection'), false);
assert(!run('state.messages.at(-1).html').includes('线下凭证已补齐'));
send('暂不确认，请继续保留为待核验');
assert.equal(run('sessionReviewCurrent().stage'), 2);
assert.equal(run('sessionReviewCurrent().corrections.length'), 2);
send('确认以上修正后的问题');
assert.equal(run('sessionReviewCurrent().stage'), 3);
for (const text of ['不确认', '不同意', '确认吗？', '确认，但是还需要修改', '确认最终问题，但凭证还没有同步']) {
  assert.equal(run(`isSessionReviewConfirmation(${JSON.stringify(text)})`), false);
}

// Other pairs use their actual mock topics; duplicates do not start a two-session review.
run("newChat('workspace');state.refs=[sessionRef(observedSessions[2]),sessionRef(observedSessions[3])]");
send('分析两个会话');
assert.deepEqual(json('sessionReviewCurrent().sourceIds'), ['CR-1022', 'CR-1021']);
assert(run('state.messages.at(-1).html').includes('收入确认规则核验'));
assert(!run('state.messages.at(-1).html').includes('两笔预提费用疑似未冲回'));
run("newChat('workspace');state.refs=[sessionRef(observedSessions[0]),sessionRef(observedSessions[0])]");
send('分析两个会话');
assert.equal(run('sessionReviewCurrent()'), undefined);

// Every task-created workspace session gets an icon, including historical/manual/new runs.
run('nav()');
assert.equal((node('#nav').innerHTML.match(/aria-label="定时任务会话"/g) || []).length, run('state.sessions.filter(s=>s.runId).length'));
assert.equal(run("sessionTaskIcon({name:'定时任务讨论'})"), '');
run("state.sessions.find(s=>s.runId).name='改名后的执行会话';nav()");
assert(node('#nav').innerHTML.includes('定时任务会话'));
assert(run("workspaceOverview('工作区')").includes('session-task-icon'));
const activeRecord = run('currentChatRecord()');
run('runTask(0)');
assert.equal(run('currentChatRecord()'), activeRecord);
run('nav()');
assert(node('#nav').innerHTML.includes('手动执行'));
const latest = run('state.tasks[0].history[0]');
assert(run('sessionTaskIcon(state.sessions.find(s=>s.runId===state.tasks[0].history[0].id))').includes('定时任务会话'));
run('pauseTaskRun(0)');
assert.equal(latest.status, 'paused');

for (const output of [messages.innerHTML, node('#nav').innerHTML, run("workspaceOverview('工作区')")]) {
  for (const match of output.matchAll(/on(?:click|input|keydown)="([^"]*)"/g)) {
    new Function(match[1].replaceAll('&quot;', '"'));
  }
}
console.log('Passed: two-session review, evidence links, correction and explicit confirmation, custom input escaping, independent conversation state, and task-origin icons for all workspace runs.');

// Review replies use ordinary conversation text; no review cards, step bars or action buttons.
for (const reply of [run('sessionReviewIntro()'), run('sessionReviewInitial({sourceIds:SESSION_REVIEW_DEMO.sourceIds})'), run('sessionReviewRevised({sourceIds:SESSION_REVIEW_DEMO.sourceIds,demoCorrection:true,corrections:[]})')]) {
  assert(!/class="review-|<article|<button|<h3/.test(reply));
}
assert(!html.includes('.review-issue'));

// Text appears incrementally, with the complete saved reply retained for reopening.
const streamBox = { isConnected: true, attrs: {}, setAttribute(k,v) { this.attrs[k]=v; }, closest() { return { querySelector: () => streamMeta }; } };
const streamMeta = { textContent: '', innerHTML: '' };
streamElements = [{ querySelector: () => streamBox }];
streamNodes = [{ textContent: '这是普通会话的流式输出。' }, { textContent: '保留问题、根因以及用户修正。' }];
const completeText = streamNodes.map(n=>n.textContent).join('');
const savedReply = run('state.messages[0].html');
run('streamConversationMessage(0)');
assert.equal(streamMeta.textContent, '生成中');
assert.equal(streamBox.attrs['aria-busy'], 'true');
assert.equal(streamNodes.map(n=>n.textContent).join(''), '');
streamTicks[0]();
assert.equal(streamNodes.map(n=>n.textContent).join('').length, 8);
for (let i=0; i<10 && !stoppedStreams.has(1); i++) streamTicks[0]();
assert.equal(streamNodes.map(n=>n.textContent).join(''), completeText);
assert.equal(streamBox.attrs['aria-busy'], 'false');
assert(stoppedStreams.has(1));
assert.equal(run('state.messages[0].html'), savedReply);
console.log('Passed: ordinary text replies without review cards/actions, progressive streaming, generation completion, and complete conversation persistence.');
