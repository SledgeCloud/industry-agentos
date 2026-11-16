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
  { id: 'f-report', name: '科研报告', parentId: null, libraryId: 'lib-report' },
  { id: 'f-report-bf', name: '高炉', parentId: 'f-report', libraryId: 'lib-report' },
  { id: 'f-topic', name: '课题', parentId: null, libraryId: 'lib-topic' }
];
const docs = [
  { id: 'd1', folderId: 'f-report-bf', libraryId: 'lib-report' },
  { id: 'd2', folderId: null, libraryId: 'lib-report' },
  { id: 'd3', folderId: null, libraryId: 'lib-topic' }
];

assert.deepEqual(copy(F.childrenOf(folders, null).map(x => x.id)), ['f-report', 'f-topic']);
assert.deepEqual(copy(F.childrenOf(folders, 'f-report').map(x => x.id)), ['f-report-bf']);
assert.deepEqual(copy(F.childrenOf(folders, null, 'lib-report').map(x => x.id)), ['f-report']);
assert.deepEqual(copy(F.childrenOf(folders, null, 'lib-topic').map(x => x.id)), ['f-topic']);
assert.deepEqual(copy(F.childrenOf(folders, 'f-report', 'lib-report').map(x => x.id)), ['f-report-bf']);
assert.deepEqual(copy(F.childrenOf(folders, 'f-report', 'lib-topic').map(x => x.id)), []);

assert.deepEqual(copy(F.docsIn(docs, null).map(x => x.id)), ['d2', 'd3']);
assert.deepEqual(copy(F.docsIn(docs, 'f-report-bf').map(x => x.id)), ['d1']);
assert.deepEqual(copy(F.docsIn(docs, null, 'lib-report').map(x => x.id)), ['d2']);
assert.deepEqual(copy(F.docsIn(docs, null, 'lib-topic').map(x => x.id)), ['d3']);
assert.deepEqual(copy(F.docsIn(docs, 'f-report-bf', 'lib-report').map(x => x.id)), ['d1']);
assert.deepEqual(copy(F.docsIn(docs, 'f-report-bf', 'lib-topic').map(x => x.id)), []);

assert.equal(F.pathLabel(folders, null), '全部资料');
assert.equal(F.pathLabel(folders, 'f-report-bf'), '科研报告 / 高炉');
assert.equal(F.pathLabel(folders, null, 'lib-report'), '库根目录');
assert.deepEqual(copy(F.pathFolders(folders, 'f-report-bf').map(x => x.id)), ['f-report', 'f-report-bf']);

assert.equal(F.siblingNameTaken(folders, null, '课题'), true);
assert.equal(F.siblingNameTaken(folders, null, '课题', 'f-topic'), false);
assert.equal(F.siblingNameTaken(folders, null, '  新库  '), false);
assert.equal(F.siblingNameTaken(folders, null, '课题', null, 'lib-report'), false);
assert.equal(F.siblingNameTaken(folders, null, '科研报告', null, 'lib-report'), true);

assert.equal(F.isEmpty(folders, docs, 'f-report'), false);
assert.equal(F.isEmpty(folders, docs, 'f-topic'), true);
assert.equal(F.isEmpty(folders, [{ id: 'x', folderId: 'f-topic' }], 'f-report-bf'), true);
assert.equal(F.isEmpty(folders, docs, null, 'lib-report'), false);
assert.equal(F.isEmpty([], [{ id: 'x', folderId: null, libraryId: 'lib-topic' }], null, 'lib-report'), true);

assert.ok(copy(F.descendantDocIds(folders, docs, 'f-report')).includes('d1'));
assert.deepEqual(copy(F.descendantDocIds(folders, docs, null, 'lib-report')).sort(), ['d1', 'd2']);
assert.deepEqual(copy(F.descendantFolderIds(folders, null, 'lib-report')).sort(), ['f-report', 'f-report-bf']);
assert.ok(!copy(F.descendantFolderIds(folders, 'f-report', 'lib-report')).includes('f-topic'));

assert.equal(F.defaultFolderId({ library: '科研报告库', process: '高炉' }), 'f-report-bf');
assert.equal(F.defaultFolderId({ library: '图纸库', process: '烧结' }), 'f-drawing');

assert.ok(Array.isArray(F.SEED_FOLDERS) && F.SEED_FOLDERS.length >= 6);
assert.ok(F.SEED_FOLDERS.every(f => typeof f.libraryId === 'string' && f.libraryId));
const seedById = Object.fromEntries(F.SEED_FOLDERS.map(f => [f.id, f]));
assert.equal(seedById['f-report'].libraryId, 'lib-report');
assert.equal(seedById['f-report-bf'].libraryId, 'lib-report');
assert.equal(seedById['f-report-sinter'].libraryId, 'lib-report');
assert.equal(seedById['f-topic'].libraryId, 'lib-topic');
assert.equal(seedById['f-drawing'].libraryId, 'lib-drawing');
assert.equal(seedById['f-drawing-bf'].libraryId, 'lib-drawing');
assert.equal(seedById['f-std'].libraryId, 'lib-std');
assert.equal(seedById['f-expert'].libraryId, 'lib-expert');

assert.ok(copy(F.flatOptions(folders)).some(o => o.id === null && o.label === '全部资料'));
const scopedOpts = copy(F.flatOptions(folders, 'lib-report'));
assert.equal(scopedOpts[0].id, null);
assert.equal(scopedOpts[0].label, '库根目录');
assert.ok(scopedOpts.every(o => o.id == null || folders.find(f => f.id === o.id).libraryId === 'lib-report'));
assert.ok(!scopedOpts.some(o => o.id === 'f-topic'));

console.log('check-agentos-folders: ok');
