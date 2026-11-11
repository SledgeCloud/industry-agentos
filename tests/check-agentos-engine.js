const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = { console, Date };
for (const key of ['document', 'localStorage', 'fetch']) Object.defineProperty(context, key, { get() { throw new Error('Pure engine touched ' + key); } });
context.window = context; vm.createContext(context);
for (const file of ['policy.js', 'data.js', 'engine.js']) vm.runInContext(fs.readFileSync('dist/agentos/js/' + file, 'utf8'), context);
const { engine: E, data: D } = context.AOS;
const copy = value => JSON.parse(JSON.stringify(value));
const agent = id => D.agents.find(a => a.id === id);
const user = id => D.users.find(u => u.id === id);
const base = (agentId, text, extra) => Object.assign({
  agent: agent(agentId), text, zone: 'internal', scope: 'internal', user: user('u-wang'), policy: D.policy,
  docs: D.docs, web: D.web, toolsCatalog: D.tools, phase: 1, modelName: 'Qwen3-72B-Instruct', now: '2026-11-11T10:00:00+08:00'
}, extra || {});
const run = (agentId, text, extra) => E.respond(base(agentId, text, extra));

// 1. Internal QA cites internal documents and records tool calls.
let r = run('research-assistant', '2号高炉低硅冶炼的主要措施有哪些？');
assert.ok(r.turn.steps.some(s => s.tool === 'doc_search' && s.status === 'ok'));
assert.ok(r.turn.citations.some(c => c.refId === 'd01'), 'Low-silicon report is cited');
assert.equal(r.turn.blocked.length, 0, 'Internal model receives every visible document');
assert.equal(r.turn.sentOut.length, 0, 'Nothing leaves the network');
assert.equal(r.turn.audit.length, 0);

// 2. Clearance filtering hides confidential documents from a secret-level user.
r = run('research-assistant', '高炉炉料配方和球团配比');
assert.ok(!r.turn.citations.some(c => c.refId === 'd10'), 'Confidential formula is never cited');
assert.ok(r.turn.filteredAcl >= 1);
assert.ok(r.turn.notices.some(n => n.text.includes('过滤')));

// 3. External model + internal scope: internal documents are blocked by default and audited.
r = run('research-assistant', '低碳炼铁技术路线的近期重点是什么？', { zone: 'external', scope: 'internal', modelName: '外部大模型 A（通用）' });
assert.ok(r.turn.blocked.length > 0);
assert.ok(r.turn.blocked.every(b => b.level !== 'public'));
assert.ok(!r.turn.notices.some(n => n.text.includes('部分资料')), 'A fully blocked answer does not repeat the partial-block notice');
assert.ok(r.turn.audit.some(a => a.kind === '模型调用' && a.result === '放行'));
const partial = run('research-assistant', '低碳炼铁和球团冶炼', { zone: 'external', scope: 'all', modelName: '外部大模型 A（通用）' });
assert.ok(partial.turn.blocked.length > 0 && partial.turn.notices.some(n => n.text.includes('部分资料因密级限制未使用')));
assert.ok(r.turn.citations.every(c => c.level === 'public'), 'Only public material reaches the external model');
assert.ok(r.turn.blocks[0].text.includes('因密级限制未发送'), 'Fully blocked answers explain why instead of claiming nothing was found');
assert.ok(r.turn.actions.some(a => a.type === 'switch-internal'));

// 4. The intel office allows internal-level documents to leave, but never secret ones.
r = run('research-assistant', '低碳炼铁和球团冶炼', { zone: 'external', scope: 'internal', user: user('u-zhang'), modelName: '外部大模型 A（通用）' });
assert.ok(r.turn.sentOut.some(s => s.level === 'internal'));
assert.ok(r.turn.sentOut.every(s => s.level !== 'secret'));

// 5. Sensitive words stop an external request at the gateway.
r = run('research-assistant', '请给出富氢喷吹工业试验方案的细节', { zone: 'external', scope: 'all', modelName: '外部大模型 A（通用）' });
assert.equal(r.turn.intercepted, true);
assert.equal(r.turn.steps.length, 0, 'No tools run after interception');
assert.deepEqual(copy(r.turn.audit.map(a => a.result)), ['拦截']);
assert.ok(r.turn.actions.some(a => a.type === 'switch-internal'));

// 6. Phase 2 tools are announced as unavailable in phase 1 and work in phase 2.
r = run('research-assistant', '找一下2号高炉冷却壁布置图');
assert.ok(r.turn.notices.some(n => n.text.includes('图纸检索将在二期提供')));
r = run('research-assistant', '找一下2号高炉冷却壁布置图', { phase: 2 });
assert.ok(r.turn.steps.some(s => s.tool === 'cad_search' && s.status === 'ok'));
assert.ok(r.turn.blocks.some(b => b.t === 'files' && b.items.some(i => i.id === 'c01')));

// 7. Data query (phase 2) runs read-only SQL; analysis (phase 3) adds a chart.
r = run('research-assistant', '近一个月2号高炉焦比和煤比的变化', { phase: 2 });
const sqlStep = r.turn.steps.find(s => s.tool === 'db_query');
assert.ok(/^SELECT /.test(sqlStep.params.sql));
assert.ok(r.turn.blocks.some(b => b.t === 'table'));
r = run('experiment-analysis', '分析近一个月2号高炉焦比与铁水硅含量的关系', { phase: 3 });
assert.ok(r.turn.blocks.some(b => b.t === 'chart'));

// 8. Survey report: outline first, then a cited report; low-credibility sources need consent.
let s = run('survey-report', '调研国内外氢冶金技术进展，用于技术路线论证，约 5000 字', { zone: 'external', scope: 'public', modelName: '外部大模型 A（通用）' });
assert.equal(s.state.stage, 'outline');
assert.ok(s.turn.actions.some(a => a.type === 'confirm'));
assert.equal(s.turn.steps.length, 0, 'No retrieval before the outline is confirmed');
let edited = run('survey-report', '增加一章投资估算', { zone: 'external', scope: 'public', modelName: '外部大模型 A（通用）', state: copy(s.state) });
assert.ok(edited.state.outline.some(h => h.includes('投资估算')));
let done = run('survey-report', '#confirm', { zone: 'external', scope: 'public', modelName: '外部大模型 A（通用）', state: copy(s.state) });
const report = done.turn.blocks.find(b => b.t === 'report');
assert.ok(report && report.sections.length === 6);
assert.ok(done.turn.citations.length > 0);
assert.ok(!done.turn.citations.some(c => c.credibility === '低'), 'Low-credibility sources are left out by default');
assert.ok(done.turn.actions.some(a => a.type === 'include-low'));
const withLow = run('survey-report', '#include-low', { zone: 'external', scope: 'public', modelName: '外部大模型 A（通用）', state: copy(done.state) });
assert.ok(withLow.turn.citations.some(c => c.credibility === '低'));
const headings = report.sections.map(x => x.heading);
assert.equal(new Set(report.sections.slice(1).map(x => x.paras[0])).size, report.sections.length - 1, 'Sections do not repeat the same paragraph');
assert.equal(headings[0], '一、研究背景与目的');

// 9. Novelty check finds the existing in-house project on furnace temperature prediction.
s = run('novelty-check', '拟立项：基于机器学习的高炉炉温智能预测，目标铁水硅含量预测误差小于 0.05%', { scope: 'all' });
assert.equal(s.state.stage, 'points');
assert.ok(s.state.points.length >= 3);
done = run('novelty-check', '#confirm', { scope: 'all', state: copy(s.state) });
const nov = done.turn.blocks.find(b => b.t === 'report');
assert.ok(['存在重复', '建议调整研究内容'].includes(nov.verdict));
assert.ok(done.turn.citations.some(c => c.refId === 'd14' || c.refId === 'd13'));
assert.ok(nov.sections.some(x => x.paras.some(p => p.includes('不替代正式科技查新机构'))));

// 10. Intel brief only keeps items from the previous natural month.
s = run('intel-brief', '跟踪上月高炉低碳冶炼和氢冶金技术动态', { zone: 'external', scope: 'public', user: user('u-zhang'), modelName: '外部大模型 A（通用）' });
assert.deepEqual(copy([s.state.range.from, s.state.range.to]), ['2026-10-01', '2026-10-31']);
done = run('intel-brief', '#confirm', { zone: 'external', scope: 'public', user: user('u-zhang'), modelName: '外部大模型 A（通用）', state: copy(s.state) });
const brief = done.turn.blocks.find(b => b.t === 'report');
assert.ok(brief.title.includes('2026 年 10 月'));
const cited = done.turn.citations.map(c => D.web.find(w => w.id === c.refId));
assert.ok(cited.length > 0 && cited.every(w => w.date >= '2026-10-01' && w.date <= '2026-10-31'));
assert.equal(brief.sections[0].heading, '本期要点');

// 11. Unavailable model is reported instead of answering.
r = run('survey-report', '调研烧结烟气治理', { zone: 'external', scope: 'public', modelName: null });
assert.ok(r.turn.blocks[0].text.includes('暂不可用'));

// 12. Export keeps the classification mark and citations.
const doc = { title: '测试报告', agentName: '调研报告助手', time: '2026-11-11 10:00', level: 'internal', blocks: done.turn.blocks, citations: done.turn.citations };
const md = E.toMarkdown(doc), html = E.toWordHtml(doc);
assert.ok(md.startsWith('# 测试报告') && md.includes('密级：内部') && md.includes('## 参考来源'));
assert.ok(html.includes('<h1>测试报告</h1>') && html.includes('密级：内部'));

console.log('check-agentos-engine: ok');
