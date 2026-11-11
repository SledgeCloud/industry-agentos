const fs = require('fs'), vm = require('vm'), assert = require('assert');
const nodes = {}, jobs = new Map(); let serial = 0;
function node(id) { return nodes[id] || (nodes[id] = { innerHTML:'', textContent:'', value:'', dataset:{}, scrollTop:0, scrollHeight:1000, clientHeight:600, focus(){this.focused=true}, setAttribute(key,value){this[key]=value} }); }
const classes = new Set();
const sandbox = { document:{ getElementById:node, querySelectorAll:()=>[], addEventListener(){}, activeElement:{focus(){}}, body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(){}}} }, setTimeout(fn){const id=++serial;jobs.set(id,fn);return id}, clearTimeout(id){jobs.delete(id)}, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
const run = code => vm.runInContext(code,sandbox);
const decode = x => x.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function handlers(markup) { for (const [,code] of markup.matchAll(/\bon(?:click|input|change|keydown|scroll|submit|toggle)="([^"]*)"/g)) new Function(decode(code)); }
function open(scene){run(`useAssetAgent('${scene}')`);node('asset-chat-dialog').dataset.agent=scene;}
function send(text){node('asset-chat-input').value=text;run('sendAssetMessage()');}
function drain(){let count=0;while(jobs.size){if(++count>2000)throw new Error('Timer did not settle');let [id,fn]=jobs.entries().next().value;jobs.delete(id);fn();}}
jobs.clear();
const baseline = run('JSON.stringify({scene:studio.scene,histories:studio.histories,waCatalog,ontStores})');
open('sales');assert(classes.has('asset-chat-open'));assert(nodes.overlay.innerHTML.includes('Mock 对话'));assert(nodes['asset-chat-messages'].innerHTML.includes('建单编排'));
assert.equal(run('acSession().messages.length'),1);handlers(nodes.overlay.innerHTML);handlers(nodes['asset-chat-messages'].innerHTML);
send('');assert.equal(run('acSession().messages.length'),1);
send('看一下本周分货结果');assert.equal(run('acSession().messages.length'),3);assert.equal(run('acSession().busy'),true);
assert(run('acSession().messages.at(-1).progress<acLength(acSession().messages.at(-1).blocks)'));
assert(nodes['asset-chat-messages'].innerHTML.includes('看一下本周分货结果'));
send('重复发送');assert.equal(run('acSession().messages.length'),3);
drain();assert.equal(run('acSession().busy'),false);assert.equal(run('acSession().messages.at(-1).status'),'complete');
assert(nodes[run("'ac-content-'+acSession().messages.at(-1).id")].innerHTML.includes('11,600'));
const reply = run('acSession().messages.at(-1).id');
run(`acFeedbackOpen('${reply}','up');acMessage('${reply}').feedbackDraft.reason='分析很清楚';acFeedbackSave('${reply}')`);
assert.equal(run(`acMessage('${reply}').feedback.value`),'up');assert.equal(run(`acMessage('${reply}').feedback.reason`),'分析很清楚');
run(`acFeedbackOpen('${reply}','down');acMessage('${reply}').feedbackDraft.reason='取消反馈';acFeedbackOpen('${reply}','down')`);
assert.equal(run(`acMessage('${reply}').feedbackDraft.reason`),'取消反馈');
assert(!run(`acFeedbackHtml(acMessage('${reply}'))`).includes('已点赞'));
run(`acFeedbackCancel('${reply}')`);
assert.equal(run(`acMessage('${reply}').feedback.value`),'up');
run(`acFeedbackOpen('${reply}','down');acMessage('${reply}').feedbackDraft.reason='需要按 EAN 展示';acFeedbackSave('${reply}')`);
assert.equal(run(`acMessage('${reply}').feedback.value`),'down');
assert(!run(`acFeedbackHtml(acMessage('${reply}'))`).includes('class="ac-vote up selected"'));
run(`acFeedbackOpen('${reply}','down');acMessage('${reply}').feedbackDraft.reason='<img src=x onerror=alert(1)>';acFeedbackSave('${reply}')`);
assert(run(`acFeedbackHtml(acMessage('${reply}'))`).includes('&lt;img'));assert(!run(`acFeedbackHtml(acMessage('${reply}'))`).includes('<img src='));
run(`acFeedbackRemove('${reply}')`);assert.equal(run(`acMessage('${reply}').feedback`),null);
run(`acFeedbackOpen('${reply}','up');acFeedbackSave('${reply}')`);assert.equal(run(`acMessage('${reply}').feedback.reason`),'');
handlers(run(`acFeedbackHtml(acMessage('${reply}'))`));
run(`acFeedbackOpen('${reply}','down')`);handlers(run(`acFeedbackHtml(acMessage('${reply}'))`));run(`acFeedbackCancel('${reply}')`);
// Quick tags are multi-select, can be submitted without prose, and keep draft edits isolated.
run(`acFeedbackOpen('${reply}','up');acFeedbackToggle('${reply}',0);acFeedbackToggle('${reply}',1);acFeedbackSave('${reply}')`);
assert.deepEqual(Array.from(run(`acMessage('${reply}').feedback.tags`)),['内容准确','易于理解']);
assert.equal(run(`acMessage('${reply}').feedback.reason`),'');
run(`acFeedbackOpen('${reply}','up');acFeedbackToggle('${reply}',0)`);
assert.deepEqual(Array.from(run(`acMessage('${reply}').feedback.tags`)),['内容准确','易于理解']);
run(`acFeedbackCancel('${reply}');acFeedbackOpen('${reply}','down')`);
assert.equal(run(`acMessage('${reply}').feedbackDraft.tags.length`),0);
assert(run(`acFeedbackHtml(acMessage('${reply}'))`).includes('你觉得什么让你不满意？'));
assert(run(`acFeedbackHtml(acMessage('${reply}'))`).includes('遗忘上下文/失忆'));
run(`acFeedbackToggle('${reply}',4);acFeedbackToggle('${reply}',5);acFeedbackToggle('${reply}',6)`);
assert.equal(run(`acMessage('${reply}').feedbackDraft.expanded`),true);
handlers(run(`acFeedbackHtml(acMessage('${reply}'))`));
run(`acFeedbackSave('${reply}');acFeedbackOpen('${reply}','down')`);
assert.deepEqual(Array.from(run(`acMessage('${reply}').feedbackDraft.tags`)),['遗忘上下文/失忆','记忆使用不当/错误','其他']);
run(`acFeedbackToggle('${reply}',999)`);
assert.equal(run(`acMessage('${reply}').feedbackDraft.tags.length`),3);
run(`acFeedbackCancel('${reply}');acFeedbackOpen('${reply}','up');acFeedbackToggle('${reply}',2);acMessage('${reply}').feedbackDraft.reason='说明完整';acFeedbackSave('${reply}')`);
assert.deepEqual(Array.from(run(`acMessage('${reply}').feedback.tags`)),['内容完善']);
assert.equal(run(`acMessage('${reply}').feedback.reason`),'说明完整');
assert(run(`acFeedbackHtml(acMessage('${reply}'))`).includes('反馈标签：内容完善'));
send('这批分货留仓太多');let stale = [...jobs.values()].at(-1);run('stopAssetReply()');assert.equal(run('acSession().messages.at(-1).status'),'stopped');
const stoppedProgress = run('acSession().messages.at(-1).progress');stale();assert.equal(run('acSession().messages.at(-1).progress'),stoppedProgress);
send('<script>alert(1)</script>');drain();assert(!nodes['asset-chat-messages'].innerHTML.includes('<script>alert'));
run("acSession().draft='尚未发送的输入'");run('closeAssetChat()');assert.equal(nodes.overlay.innerHTML,'');assert(!classes.has('asset-chat-open'));
open('sales');assert.equal(run('acSession().draft'),'尚未发送的输入');assert.equal(run(`acMessage('${reply}').feedback.value`),'up');
const sales = run('JSON.stringify({messages:acSession().messages,draft:acSession().draft,topic:acSession().topic})');
open('procurement');assert.equal(run('acSession().messages.length'),1);assert(!nodes['asset-chat-messages'].innerHTML.includes('建单编排'));
send('查看供应商份额');drain();assert(run('acRenderBlocks(acSession().messages.at(-1).blocks)').includes('供应商 A'));
assert(!run('acRenderBlocks(acSession().messages.at(-1).blocks)').includes('华东经销商'));
open('sales');assert.equal(run('JSON.stringify({messages:acSession().messages,draft:acSession().draft,topic:acSession().topic})'),sales);
send('测试');stale=[...jobs.values()].at(-1);run('closeAssetChat()');nodes.overlay.innerHTML='另一个功能的弹窗';stale();assert.equal(nodes.overlay.innerHTML,'另一个功能的弹窗');
open('procurement');send('你好');open('sales');drain();assert.equal(run('assetChatSessions.procurement.messages.at(-1).status'),'stopped');
assert.equal(run('acSession().scene'),'sales');
run("var taskConversation={topic:''};acMockReply('sales','帮我起一个分货任务，周期第43周',taskConversation);var continuedTask=acRenderBlocks(acMockReply('sales','饮料',taskConversation))");
assert(run("continuedTask.includes('第 43 周')&&continuedTask.includes('饮料')"));
for(const text of ['测试','帮我起一个分货任务，周期第43周，品类饮料','查看分货参数','查一下华东经销商的 EAN 明细','这批分货留仓太多','比较分货结果','这是一个自定义问题']) {
 const source = run(`acRenderBlocks(acMockReply('sales',${JSON.stringify(text)},{topic:''}))`);assert(source.length>80);assert(!source.includes('undefined'));handlers(source);
}
for(const text of ['查看供应商份额','查看交付风险','帮我制定本月采购计划','查供应商A']) assert(run(`acRenderBlocks(acMockReply('procurement',${JSON.stringify(text)},{topic:''})).length>80`));
assert.equal(run('JSON.stringify({scene:studio.scene,histories:studio.histories,waCatalog,ontStores})'),baseline);
console.log('Passed: asset use entry, rich reply blocks, incremental streaming, stop/close/stale timers, send guard, per-message positive/negative feedback and optional reasons, cancellation/edit/retract, escaping, retained drafts, sales/procurement isolation, and unaffected workshop/ontology data.');
