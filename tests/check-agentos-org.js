const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { console }; context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/agentos/js/org.js', 'utf8'), context);
const O = context.AOS.org;
assert.ok(O.PERMS.KB_CREATE === 'kb.create');
assert.ok(O.SEED_ROLES.some(r => r.id === 'role-admin'));
assert.deepEqual(JSON.parse(JSON.stringify(O.DATA_SCOPES.map(s => s.id))), ['all', 'dept', 'self']);
assert.equal(O.normDataScope('enterprise'), 'all');
assert.equal(O.dataScopeLabel('dept'), '本部门');
assert.equal(O.dataScopeLabel('self'), '仅本人');
assert.ok(O.SEED_DEPARTMENTS.some(d => d.name === '炼铁技术中心'));
assert.equal(O.SEED_DEPARTMENTS.find(d => d.id === 'dept-bf').parentId, 'dept-iron');
const copy = v => JSON.parse(JSON.stringify(v));
assert.deepEqual(copy(O.childrenOf(O.SEED_DEPARTMENTS, 'dept-iron').map(d => d.id).sort()), ['dept-bf', 'dept-sinter']);
assert.ok(copy(O.descendantIds(O.SEED_DEPARTMENTS, 'dept-iron')).includes('dept-bf'));
assert.ok(copy(O.flatOptions(O.SEED_DEPARTMENTS)).some(o => o.id === 'dept-bf' && o.depth === 1));
assert.equal(O.siblingNameTaken(O.SEED_DEPARTMENTS, 'dept-iron', '高炉车间'), true);
assert.equal(O.wouldCycle(O.SEED_DEPARTMENTS, 'dept-iron', 'dept-bf'), true);
assert.equal(O.wouldCycle(O.SEED_DEPARTMENTS, 'dept-bf', 'dept-tech'), false);
const flatLegacy = [
  { id: 'dept-iron', name: '炼铁技术中心' },
  { id: 'dept-tech', name: '科技管理部' },
  { id: 'dept-intel', name: '科技情报室' },
  { id: 'dept-it', name: '信息中心' }
];
const upgraded = O.upgradeDepartments(flatLegacy);
assert.equal(upgraded.find(d => d.id === 'dept-intel').parentId, 'dept-tech');
assert.ok(upgraded.some(d => d.id === 'dept-bf' && d.parentId === 'dept-iron'));
let seq = 0;
const synced = O.applyDingTalkSync(
  [{ id: 'dept-iron', name: '炼铁技术中心', parentId: null }],
  [{ id: 'u-wang', name: '王建国', title: '工程师', dept: '炼铁技术中心', roleIds: ['role-member'] }],
  O.DINGTALK_MOCK,
  p => p + '-x' + (++seq)
);
assert.ok(synced.departments.some(d => d.name === '质量部'));
assert.ok(synced.departments.some(d => d.name === '质检室' && d.parentId === synced.departments.find(x => x.name === '质量部').id));
assert.ok(synced.users.some(u => u.name === '马芳' && u.dept === '质检室'));
assert.equal(synced.users.find(u => u.name === '王建国').title, '高级工程师');
assert.ok(synced.stats.addedDepts >= 1 && synced.stats.addedUsers >= 1);
const multi = { name: '试', dept: '炼铁技术中心' };
O.syncUserDeptFields(multi, ['炼铁技术中心', '高炉车间', '炼铁技术中心']);
assert.deepEqual(JSON.parse(JSON.stringify(O.userDepts(multi))), ['炼铁技术中心', '高炉车间']);
assert.equal(O.userDeptLabel(multi), '炼铁技术中心、高炉车间');
assert.equal(O.userBelongsToAny(multi, ['高炉车间']), true);
assert.equal(O.userBelongsToAny(multi, ['信息中心']), false);
const roles = O.SEED_ROLES;
const admin = { id: 'u-chen', roleIds: ['role-admin'] };
const member = { id: 'u-wang', roleIds: ['role-member'] };
assert.equal(O.userHasPerm(admin, roles, 'kb.create'), true);
assert.equal(O.userHasPerm(member, roles, 'kb.create'), false);
assert.equal(O.userHasPerm(member, roles, 'org.manage'), false);
assert.equal(O.userHasPerm(admin, roles, 'org.manage'), true);
console.log('check-agentos-org: ok');
