const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/agentos/js/folders.js', 'utf8'), context);
const F = context.AOS.folders;
const copy = v => JSON.parse(JSON.stringify(v));

const folders = [
  { id: 'f-report', name: '科研报告', parentId: null },
  { id: 'f-report-bf', name: '高炉', parentId: 'f-report' },
  { id: 'f-topic', name: '课题库', parentId: null }
];
const docs = [
  { id: 'd1', folderId: 'f-report-bf' },
  { id: 'd2', folderId: null },
  { id: 'd3', folderId: 'f-topic' }
];

assert.deepEqual(copy(F.childrenOf(folders, null).map(x => x.id)), ['f-report', 'f-topic']);
assert.deepEqual(copy(F.childrenOf(folders, 'f-report').map(x => x.id)), ['f-report-bf']);
assert.deepEqual(copy(F.docsIn(docs, null).map(x => x.id)), ['d2']);
assert.deepEqual(copy(F.docsIn(docs, 'f-report-bf').map(x => x.id)), ['d1']);
assert.equal(F.pathLabel(folders, null), '全部资料');
assert.equal(F.pathLabel(folders, 'f-report-bf'), '科研报告 / 高炉');
assert.deepEqual(copy(F.pathFolders(folders, 'f-report-bf').map(x => x.id)), ['f-report', 'f-report-bf']);
assert.equal(F.siblingNameTaken(folders, null, '课题库'), true);
assert.equal(F.siblingNameTaken(folders, null, '课题库', 'f-topic'), false);
assert.equal(F.siblingNameTaken(folders, null, '  新库  '), false);
assert.equal(F.isEmpty(folders, docs, 'f-report'), false);
assert.equal(F.isEmpty(folders, docs, 'f-topic'), false);
assert.equal(F.isEmpty(folders, [{ id: 'x', folderId: 'f-topic' }], 'f-report-bf'), true);
assert.ok(copy(F.descendantDocIds(folders, docs, 'f-report')).includes('d1'));
assert.equal(F.defaultFolderId({ library: '科研报告库', process: '高炉' }), 'f-report-bf');
assert.equal(F.defaultFolderId({ library: '图纸库', process: '烧结' }), 'f-drawing');
assert.ok(Array.isArray(F.SEED_FOLDERS) && F.SEED_FOLDERS.length >= 6);
assert.ok(copy(F.flatOptions(folders)).some(o => o.id === null && o.label === '全部资料'));

console.log('check-agentos-folders: ok');
