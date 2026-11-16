const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = { console };
context.window = context;
vm.createContext(context);
for (const file of ['folders.js', 'libraries.js', 'org.js', 'data.js']) {
  vm.runInContext(fs.readFileSync('dist/agentos/js/' + file, 'utf8'), context);
}

const { folders: F, libraries: L, data: D, org: O } = context.AOS;
assert.ok(F && L && D && O);

const tops = F.SEED_FOLDERS.filter(f => f.parentId == null || f.parentId === '');
assert.ok(tops.length >= 5, 'seed has top-level folders');
tops.forEach(f => {
  assert.ok(f.libraryId, f.id + ' missing libraryId');
  assert.ok(L.byId(L.SEED_LIBRARIES, f.libraryId), f.id + ' libraryId ' + f.libraryId);
});

assert.ok(Array.isArray(D.docs) && D.docs.length > 0, 'seed docs mapped');
const mapped = D.docs.filter(d => d && d.libraryId && L.byId(D.libraries, d.libraryId));
assert.equal(mapped.length, D.docs.length, 'every seed doc maps to a library');
mapped.forEach(d => {
  assert.equal(d.level, L.byId(D.libraries, d.libraryId).level, d.id + ' level inherited');
  assert.ok(Array.isArray(d.acl) && d.acl.length === 0, d.id + ' acl cleared');
});

console.log('check-agentos-library-migration: ok (' + tops.length + ' top folders, ' + mapped.length + ' docs)');
