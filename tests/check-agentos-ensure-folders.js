const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const KEY = 'agentos.ironworks.v1';
const rootDoc = { id: 'root-doc', libraryId: 'lib-report', library: '科研报告库', process: '高炉', folderId: null };
const legacyDoc = { id: 'legacy-doc', library: '科研报告库', process: '高炉', folderId: null };
const persisted = {
  settings: { phase: 3, userId: 'u-wang' },
  agents: [],
  docs: [rootDoc, legacyDoc],
  folders: [{ id: 'f-report', name: '科研报告', parentId: null, libraryId: 'lib-report' }],
  libraries: [],
  customTools: [],
  customSkills: []
};

const context = { console };
context.window = context;
context.localStorage = {
  _m: { [KEY]: JSON.stringify(persisted) },
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
  setItem(k, v) { this._m[k] = String(v); },
  removeItem(k) { delete this._m[k]; }
};
vm.createContext(context);
for (const file of ['org.js', 'libraries.js', 'folders.js', 'data.js', 'core.js']) {
  vm.runInContext(fs.readFileSync('dist/agentos/js/' + file, 'utf8'), context);
}

const { folders: F, store } = context.AOS;
assert.equal(F.defaultFolderId(legacyDoc), 'f-report-bf');
store.load();

const docs = store.state.docs;
const root = docs.find(d => d.id === 'root-doc');
const legacy = docs.find(d => d.id === 'legacy-doc');
assert.equal(root.folderId, null, 'library-root doc must keep folderId null');
assert.equal(root.libraryId, 'lib-report');
assert.equal(legacy.folderId, 'f-report-bf', 'doc without libraryId still gets defaultFolderId');
assert.equal(legacy.libraryId, 'lib-report');

console.log('check-agentos-ensure-folders: ok');
