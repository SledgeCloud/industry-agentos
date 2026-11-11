const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = { console };
for (const key of ['document', 'localStorage', 'fetch']) Object.defineProperty(context, key, { get() { throw new Error('Pure policy touched ' + key); } });
context.window = context; vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/agentos/js/policy.js', 'utf8'), context);
const P = context.AOS.policy;
const copy = value => JSON.parse(JSON.stringify(value));

const policy = { internalToExternal: { '炼铁技术中心': false, '科技情报室': true }, sensitiveWords: ['炉料配方', '绝密'] };
const wang = { id: 'u1', dept: '炼铁技术中心', clearance: 'secret' };
const zhang = { id: 'u2', dept: '科技情报室', clearance: 'internal' };

// Levels are ordered and labelled.
assert.deepEqual(copy(P.LEVELS.map(l => l.id)), ['public', 'internal', 'secret', 'confidential']);
assert.equal(P.levelLabel('secret'), '秘密');
assert.equal(P.levelRank('confidential'), 3);

// Viewing requires clearance and, when an ACL exists, department membership.
assert.equal(P.canView(wang, { level: 'secret', acl: [] }), true);
assert.equal(P.canView(wang, { level: 'confidential', acl: [] }), false, 'Clearance caps the level');
assert.equal(P.canView(zhang, { level: 'secret', acl: [] }), false);
assert.equal(P.canView(zhang, { level: 'internal', acl: ['炼铁技术中心'] }), false, 'ACL restricts departments');
assert.equal(P.canView(wang, { level: 'internal', acl: ['炼铁技术中心'] }), true);

// Egress: public always, internal per org (default deny), secret and above never.
assert.equal(P.egressAllowed('public', '炼铁技术中心', policy), true);
assert.equal(P.egressAllowed('internal', '炼铁技术中心', policy), false);
assert.equal(P.egressAllowed('internal', '科技情报室', policy), true);
assert.equal(P.egressAllowed('internal', '未配置部门', policy), false, 'Unconfigured org defaults to deny');
assert.equal(P.egressAllowed('secret', '科技情报室', { internalToExternal: { '科技情报室': true } }), false);
assert.equal(P.egressAllowed('confidential', '科技情报室', policy), false);

const docs = [{ id: 'a', level: 'public' }, { id: 'b', level: 'internal' }, { id: 'c', level: 'secret' }];
let split = P.partitionForModel(docs, 'internal', '炼铁技术中心', policy);
assert.deepEqual(copy(split.allowed.map(d => d.id)), ['a', 'b', 'c'], 'Internal model receives everything');
assert.equal(split.blocked.length, 0);
split = P.partitionForModel(docs, 'external', '炼铁技术中心', policy);
assert.deepEqual(copy(split.allowed.map(d => d.id)), ['a']);
assert.deepEqual(copy(split.blocked.map(d => d.id)), ['b', 'c']);
split = P.partitionForModel(docs, 'external', '科技情报室', policy);
assert.deepEqual(copy(split.allowed.map(d => d.id)), ['a', 'b']);
assert.deepEqual(copy(split.blocked.map(d => d.id)), ['c']);

// Scope decides which tool groups are callable; output tools are never restricted.
const catalog = [
  { id: 'doc_search', group: 'internal', phase: 1 }, { id: 'cad_search', group: 'internal', phase: 2 },
  { id: 'web_search', group: 'public', phase: 1 }, { id: 'web_fetch', group: 'public', phase: 1 },
  { id: 'report_export', group: 'none', phase: 1 }, { id: 'data_analysis', group: 'none', phase: 3 }
];
const agent = { tools: ['doc_search', 'cad_search', 'web_search', 'web_fetch', 'report_export', 'data_analysis'] };
assert.deepEqual(copy(P.effectiveTools(agent, 'internal', 1, catalog)), ['doc_search', 'report_export']);
assert.deepEqual(copy(P.effectiveTools(agent, 'public', 1, catalog)), ['web_search', 'web_fetch', 'report_export']);
assert.deepEqual(copy(P.effectiveTools(agent, 'all', 3, catalog)), agent.tools);
assert.deepEqual(copy(P.effectiveTools({ tools: ['web_search'] }, 'internal', 3, catalog)), [], 'Unticked tools stay unavailable');

// Model options and locking.
assert.equal(P.isLocked({ allowedModels: ['internal'] }), true);
assert.equal(P.isLocked({ allowedModels: ['internal', 'external'] }), false);
assert.equal(P.isLocked({ allowedModels: ['external'] }), false, 'Only an internal-only agent counts as locked');

// Sensitive word detection returns the first hit.
assert.equal(P.findSensitive('请给出炉料配方细节', policy.sensitiveWords), '炉料配方');
assert.equal(P.findSensitive('高炉利用系数', policy.sensitiveWords), null);

// Data flow summary used by the composer.
assert.equal(P.dataFlow('internal', 'internal', '炼铁技术中心', policy).egress, false);
assert.equal(P.dataFlow('internal', 'all', '炼铁技术中心', policy).egress, true, 'Web search leaves the network even with an internal model');
assert.equal(P.dataFlow('external', 'public', '炼铁技术中心', policy).tone, 'external');
const risky = P.dataFlow('external', 'internal', '炼铁技术中心', policy);
assert.equal(risky.tone, 'warn');
assert.equal(risky.needsConfirm, true);
assert.equal(P.dataFlow('external', 'public', '炼铁技术中心', policy).needsConfirm, false);

console.log('check-agentos-policy: ok');
