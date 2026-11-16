const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { console }; context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/agentos/js/libraries.js', 'utf8'), context);
const L = context.AOS.libraries;
const lib = {
  id: 'lib-report', name: '科研报告库', level: 'internal',
  grants: [
    { type: 'dept', id: '炼铁技术中心', role: 'edit' },
    { type: 'user', id: 'u-chen', role: 'manage' }
  ]
};
const wang = { id: 'u-wang', dept: '炼铁技术中心', clearance: 'secret' };
const li = { id: 'u-li', dept: '科技管理部', clearance: 'internal' };
const chen = { id: 'u-chen', dept: '信息中心', clearance: 'confidential' };
assert.equal(L.effectiveRole(lib, wang), 'edit');
assert.equal(L.effectiveRole(lib, chen), 'manage');
assert.equal(L.effectiveRole(lib, li), null);
assert.equal(L.canEdit(lib, wang), true);
assert.equal(L.canManage(lib, wang), false);
assert.equal(L.canRead(lib, li), false);
const synced = L.syncDocFromLibrary({ id: 'd1', level: 'secret', acl: ['炼铁技术中心'] }, lib);
assert.equal(synced.level, 'internal');
assert.equal(synced.libraryId, 'lib-report');
assert.deepEqual(synced.acl, []);
assert.ok(Array.isArray(L.SEED_LIBRARIES) && L.SEED_LIBRARIES.length >= 5);
const levelRank = id => ({ public:0, internal:1, secret:2, confidential:3 }[id] || 0);
const low = { id: 'u-x', dept: '炼铁技术中心', clearance: 'public' };
const secretLib = Object.assign({}, lib, { level: 'secret' });
assert.equal(L.visibleLibraries([secretLib], low, levelRank).length, 0);
assert.equal(L.visibleLibraries([secretLib], wang, levelRank).length, 1);
assert.equal(L.isLibraryEmpty('lib-report', [{ id: 'f1', libraryId: 'lib-report' }], []), false);
assert.equal(L.isLibraryEmpty('lib-report', [], []), true);
console.log('check-agentos-libraries: ok');
