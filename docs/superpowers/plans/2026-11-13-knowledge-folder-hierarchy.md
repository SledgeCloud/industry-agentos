# Knowledge Folder Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AgentOS 知识库中增加独立文件夹树，支持面包屑下钻浏览，以及新建 / 重命名 / 删除空文件夹，上传与编辑资料时挂到文件夹。

**Architecture:** 新增纯函数模块 `folders.js`（路径、子项、同级重名、空文件夹判断、种子映射）；`data.js` 提供种子 `folders` 与 `docs.folderId`；`core.js` 在 `seed` / `ensurePhase3` 中迁移补齐；`knowledge.js` 实现面包屑下钻 UI 与 CRUD；样式补文件夹行与路径条。

**Tech Stack:** 静态 HTML/CSS/JS（`dist/agentos`）、`localStorage` store、Node `assert` + `vm` 单测（同 `tests/check-agentos-policy.js`）。

**Spec:** `docs/superpowers/specs/2026-11-13-knowledge-folder-hierarchy-design.md`

## Global Constraints

- 交互为面包屑下钻，不是左侧树
- 文件夹与「资料库」`library` 字段分离；`library` 仍作元数据
- 可建管：新建、重命名、删除空文件夹；上传到当前文件夹
- 对话引擎检索本期不按文件夹过滤
- 中文 UI 文案；持久化键仍为 `agentos.ironworks.v1`

## File map

| File | Responsibility |
|------|----------------|
| `dist/agentos/js/folders.js` | 纯函数：子文件夹、本层资料、路径、标签、同级重名、是否可删、种子文件夹、docs→folderId 映射 |
| `tests/check-agentos-folders.js` | 对 `folders.js` 的断言测试 |
| `dist/agentos/js/data.js` | 导出 `folders`；给每个 doc 写 `folderId` |
| `dist/agentos/js/core.js` | seed 含 folders；`ensureFolders()` 迁移 |
| `dist/agentos/index.html` | 引入 `folders.js`（在 knowledge 之前） |
| `dist/agentos/js/views/knowledge.js` | 下钻、面包屑、混排列表、CRUD、上传/编辑 folderId |
| `dist/agentos/css/agentos.css` | `.kb-path`、`.folder-row` 等 |

---

### Task 1: Pure folder helpers + unit tests

**Files:**
- Create: `dist/agentos/js/folders.js`
- Create: `tests/check-agentos-folders.js`

**Interfaces:**
- Produces: `AOS.folders` with:
  - `SEED_FOLDERS: Array<{id,name,parentId}>`
  - `defaultFolderId(doc): string | null`
  - `childrenOf(folders, parentId): folders[]` （parentId 用 `null` 表示根）
  - `docsIn(docs, folderId): docs[]`
  - `ancestors(folders, id): folders[]` （从根到该节点，不含自身可另算；约定返回从根到父，`pathFolders` 返回含自身）
  - `pathFolders(folders, id): folders[]` （根→自身）
  - `pathLabel(folders, id): string` （`科研报告 / 高炉`；`id` 空则 `全部资料`）
  - `flatOptions(folders): Array<{id,label}>` （下拉用，含 `{id:null,label:'全部资料'}`）
  - `siblingNameTaken(folders, parentId, name, exceptId?): boolean`
  - `isEmpty(folders, docs, folderId): boolean` （无子文件夹且无任何 docs.folderId===folderId，不论权限）
  - `descendantDocIds(folders, docs, folderId): string[]` （含本层与子孙；搜索用）

- [ ] **Step 1: Write the failing test file**

```js
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

assert.deepEqual(F.childrenOf(folders, null).map(x => x.id), ['f-report', 'f-topic']);
assert.deepEqual(F.childrenOf(folders, 'f-report').map(x => x.id), ['f-report-bf']);
assert.deepEqual(F.docsIn(docs, null).map(x => x.id), ['d2']);
assert.deepEqual(F.docsIn(docs, 'f-report-bf').map(x => x.id), ['d1']);
assert.equal(F.pathLabel(folders, null), '全部资料');
assert.equal(F.pathLabel(folders, 'f-report-bf'), '科研报告 / 高炉');
assert.deepEqual(F.pathFolders(folders, 'f-report-bf').map(x => x.id), ['f-report', 'f-report-bf']);
assert.equal(F.siblingNameTaken(folders, null, '课题库'), true);
assert.equal(F.siblingNameTaken(folders, null, '课题库', 'f-topic'), false);
assert.equal(F.siblingNameTaken(folders, null, '  新库  '), false);
assert.equal(F.isEmpty(folders, docs, 'f-report'), false);
assert.equal(F.isEmpty(folders, docs, 'f-topic'), false);
assert.equal(F.isEmpty(folders, [{ id: 'x', folderId: 'f-topic' }], 'f-report-bf'), true);
assert.ok(F.descendantDocIds(folders, docs, 'f-report').includes('d1'));
assert.equal(F.defaultFolderId({ library: '科研报告库', process: '高炉' }), 'f-report-bf');
assert.equal(F.defaultFolderId({ library: '图纸库', process: '烧结' }), 'f-drawing');
assert.ok(Array.isArray(F.SEED_FOLDERS) && F.SEED_FOLDERS.length >= 6);
assert.ok(F.flatOptions(folders).some(o => o.id === null && o.label === '全部资料'));

console.log('check-agentos-folders: ok');
```

- [ ] **Step 2: Run test — expect FAIL**（文件不存在）

```bash
node tests/check-agentos-folders.js
```

Expected: `Cannot find module` / `ENOENT` for `folders.js`

- [ ] **Step 3: Implement `dist/agentos/js/folders.js`**

```js
/* AgentOS · 知识库文件夹纯逻辑 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const SEED_FOLDERS = [
    { id: 'f-report', name: '科研报告', parentId: null },
    { id: 'f-report-bf', name: '高炉', parentId: 'f-report' },
    { id: 'f-report-sinter', name: '烧结', parentId: 'f-report' },
    { id: 'f-topic', name: '课题库', parentId: null },
    { id: 'f-drawing', name: '图纸库', parentId: null },
    { id: 'f-drawing-bf', name: '高炉', parentId: 'f-drawing' },
    { id: 'f-std', name: '标准库', parentId: null },
    { id: 'f-expert', name: '专家经验', parentId: null }
  ];

  function normId(id) { return id == null || id === '' ? null : id; }
  function childrenOf(folders, parentId) {
    const p = normId(parentId);
    return (folders || []).filter(f => normId(f.parentId) === p);
  }
  function docsIn(docs, folderId) {
    const p = normId(folderId);
    return (docs || []).filter(d => normId(d.folderId) === p);
  }
  function byId(folders, id) { return (folders || []).find(f => f.id === id); }
  function pathFolders(folders, id) {
    const out = [];
    let cur = normId(id);
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const f = byId(folders, cur);
      if (!f) break;
      out.unshift(f);
      cur = normId(f.parentId);
    }
    return out;
  }
  function pathLabel(folders, id) {
    if (normId(id) == null) return '全部资料';
    const parts = pathFolders(folders, id).map(f => f.name);
    return parts.length ? parts.join(' / ') : '全部资料';
  }
  function flatOptions(folders) {
    const roots = childrenOf(folders, null);
    const walk = (list, prefix) => {
      const rows = [];
      list.forEach(f => {
        const label = prefix ? prefix + ' / ' + f.name : f.name;
        rows.push({ id: f.id, label });
        rows.push.apply(rows, walk(childrenOf(folders, f.id), label));
      });
      return rows;
    };
    return [{ id: null, label: '全部资料' }].concat(walk(roots, ''));
  }
  function siblingNameTaken(folders, parentId, name, exceptId) {
    const n = String(name || '').trim();
    if (!n) return true;
    return childrenOf(folders, parentId).some(f => f.id !== exceptId && f.name.trim() === n);
  }
  function isEmpty(folders, docs, folderId) {
    const id = normId(folderId);
    if (id == null) return false;
    return childrenOf(folders, id).length === 0 && docsIn(docs, id).length === 0;
  }
  function descendantFolderIds(folders, folderId) {
    const id = normId(folderId);
    if (id == null) return (folders || []).map(f => f.id);
    const out = [id];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      childrenOf(folders, cur).forEach(c => { out.push(c.id); queue.push(c.id); });
    }
    return out;
  }
  function descendantDocIds(folders, docs, folderId) {
    const ids = new Set(descendantFolderIds(folders, folderId));
    const root = normId(folderId) == null;
    return (docs || []).filter(d => {
      const fid = normId(d.folderId);
      if (root) return true;
      return fid && ids.has(fid);
    }).map(d => d.id);
  }
  function defaultFolderId(doc) {
    const lib = doc.library || '';
    const proc = doc.process || '';
    if (lib === '科研报告库') {
      if (proc === '高炉') return 'f-report-bf';
      if (proc === '烧结') return 'f-report-sinter';
      return 'f-report';
    }
    if (lib === '课题库') return 'f-topic';
    if (lib === '图纸库') return proc === '高炉' ? 'f-drawing-bf' : 'f-drawing';
    if (lib === '标准库') return 'f-std';
    if (lib === '专家经验库') return 'f-expert';
    return null;
  }

  AOS.folders = {
    SEED_FOLDERS, defaultFolderId, childrenOf, docsIn, pathFolders, pathLabel,
    flatOptions, siblingNameTaken, isEmpty, descendantDocIds, descendantFolderIds, normId
  };
})(typeof window !== 'undefined' ? window : globalThis);
```

调整测试中 `defaultFolderId({ library: '图纸库', process: '烧结' })` 期望为 `'f-drawing'`（与上表一致）。

- [ ] **Step 4: Run tests — expect PASS**

```bash
node tests/check-agentos-folders.js
```

Expected: `check-agentos-folders: ok`

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/folders.js tests/check-agentos-folders.js
git commit -m "feat: add knowledge folder pure helpers and tests"
```

---

### Task 2: Seed data + store migration + script tag

**Files:**
- Modify: `dist/agentos/js/data.js`（docs 数组与 `AOS.data` 导出）
- Modify: `dist/agentos/js/core.js`（`seed`、`ensurePhase3` / 新 `ensureFolders`）
- Modify: `dist/agentos/index.html`（在 `knowledge.js` 前加载 `folders.js`）

**Interfaces:**
- Consumes: `AOS.folders.SEED_FOLDERS`, `AOS.folders.defaultFolderId`
- Produces: `AOS.data.folders`；`store.state.folders`；每个 `doc.folderId`

- [ ] **Step 1: 在 `data.js` 的 docs 定义后、`AOS.data =` 前加入**

```js
const folders = (AOS.folders && AOS.folders.SEED_FOLDERS)
  ? AOS.folders.SEED_FOLDERS.map(f => Object.assign({}, f))
  : [];
docs.forEach(d => {
  if (d.folderId == null && AOS.folders) d.folderId = AOS.folders.defaultFolderId(d);
});
```

并将 `AOS.data = { ..., docs, ...}` 改为包含 `folders`。

注意：`index.html` 中 `folders.js` 必须在 `data.js` 之前加载。

- [ ] **Step 2: `index.html` 脚本顺序**

在现有 `data.js` 之前插入：

```html
<script src="js/folders.js"></script>
```

（保持 `policy.js` → `folders.js` → `data.js` → `engine.js` → `core.js` → views…）

- [ ] **Step 3: `core.js` — seed 与迁移**

在 `seed()` 创建 state 时加入 `folders: d.folders || []`：

```js
state = {
  settings: { phase: 3, userId: 'u-wang' },
  agents: d.agents,
  docs: d.docs,
  folders: copy(d.folders || (AOS.folders ? AOS.folders.SEED_FOLDERS : [])),
  sessions: [], audit: [], policy: d.policy, models: d.models, schedules: d.schedules,
  customTools: [], customSkills: [], seq: 1
};
```

在 `ensurePhase3()` 末尾调用 `ensureFolders()`：

```js
function ensureFolders() {
  const F = AOS.folders;
  if (!F) return;
  if (!Array.isArray(state.folders) || !state.folders.length) {
    state.folders = copy(F.SEED_FOLDERS);
  }
  (state.docs || []).forEach(d => {
    if (d.folderId == null || d.folderId === '') {
      d.folderId = F.defaultFolderId(d);
    }
  });
}
```

- [ ] **Step 4: 浏览器快速验证**（需已启本地服务）

打开控制台执行思路：刷新后 `JSON.parse(localStorage['agentos.ironworks.v1']).folders.length` 应 ≥ 6。若本地已有旧 state，可先点演示重置或 `localStorage.removeItem('agentos.ironworks.v1')` 再刷新。

也可用 Node 抽查 data 加载（可选）：在临时脚本里按 index 顺序 vm 加载 `folders.js`+`data.js`，断言 `AOS.data.docs.every(d => 'folderId' in d)`。

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/data.js dist/agentos/js/core.js dist/agentos/index.html
git commit -m "feat: seed knowledge folders and migrate store state"
```

---

### Task 3: Knowledge UI — breadcrumb drill-down + mixed list

**Files:**
- Modify: `dist/agentos/js/views/knowledge.js`
- Modify: `dist/agentos/css/agentos.css`

**Interfaces:**
- Consumes: `AOS.folders.*`, `store.state.folders`, `docs.folderId`
- Produces: 可下钻的知识库列表与面包屑（尚不含新建/删，可在本任务预留按钮占位，下一任务接线）

- [ ] **Step 1: 在 `knowledge.js` 顶部引入 F，增加导航状态**

```js
const F = AOS.folders;
let currentFolderId = null; // null = 根
```

- [ ] **Step 2: 重写 `list` / `draw` 核心**

逻辑要点（实现时写入完整函数，勿留伪代码）：

1. `folders = store.state.folders`
2. 可见资料：`visibleDocs = store.state.docs.filter(d => P.canView(user, d))`
3. 若 `f.q` 非空：在 `descendantDocIds(folders, visibleDocs, currentFolderId)` 对应资料上做现有字段匹配；列表**只显示资料行**（可带路径副标题），不显示文件夹行
4. 若 `f.q` 为空：
   - `childFolders = F.childrenOf(folders, currentFolderId)`
   - `layerDocs = F.docsIn(visibleDocs, currentFolderId)` 再套用 tab/process/level/status 过滤（与现有 `list()` 条件一致）
5. 渲染 `#kPath` 面包屑：
   - 链接「知识库」→ `currentFolderId = null`
   - `pathFolders` 每一级可点
   - 当前级用 `<strong>`
6. 文件夹行：`tr.folder-row.clickable`，`data-folder-id`，首列 folder 图标 + 名 + `small muted` 计数（子文件夹数 + 本层可见资料数）；其余列可空或显示「文件夹」
7. 资料行保持现有列；搜索模式下标题下增加 `F.pathLabel(folders, d.folderId)`
8. 非「全部」Tab 时仍渲染子文件夹行（便于下钻）

页面骨架在 toolbar 与 table 之间插入：

```html
<nav class="kb-path" id="kPath" aria-label="文件夹路径"></nav>
```

工具栏右侧预留：

```html
<button class="btn" id="newFolderBtn">...</button>
```

（点击可在 Task 4 再绑；本任务可 `toast('下一任务接线')` 或先实现新建——**推荐本任务只做浏览，Task 4 做 CRUD**。）

- [ ] **Step 3: CSS**

```css
.kb-path {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
  margin: 0 0 12px; font-size: 12px; color: var(--muted);
}
.kb-path a { color: var(--muted); }
.kb-path a:hover { color: var(--ink); }
.kb-path strong { color: var(--ink); font-weight: 500; }
.kb-path .sep { opacity: 0.5; }
.tbl tr.folder-row td { background: #fafafa; }
.tbl tr.folder-row:hover td { background: #f3f3f3; }
.folder-title { display: flex; align-items: center; gap: 10px; min-width: 260px; }
.folder-title .t { color: var(--ink); font-weight: 500; }
.folder-title .agent-icon { width: 28px; height: 28px; }
```

- [ ] **Step 4: 手动验收**

1. 打开 `#/knowledge`，根目录见「科研报告」「课题库」等
2. 进入「科研报告」→「高炉」，见对应报告
3. 点面包屑返回
4. 类型 Tab / 筛选仍过滤本层资料

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/views/knowledge.js dist/agentos/css/agentos.css
git commit -m "feat: knowledge breadcrumb drill-down with folder rows"
```

---

### Task 4: Folder CRUD + upload/edit folderId

**Files:**
- Modify: `dist/agentos/js/views/knowledge.js`

**Interfaces:**
- Consumes: `F.siblingNameTaken`, `F.isEmpty`, `F.flatOptions`, `store.uid`
- Produces: 持久化的文件夹增删改；资料 `folderId` 可设

- [ ] **Step 1: 新建文件夹**

`#newFolderBtn` → `ui.modal`：名称输入；确认时：

```js
const name = m.querySelector('#nfName').value.trim();
if (!name) { /* show err */ return; }
if (F.siblingNameTaken(store.state.folders, currentFolderId, name)) {
  ui.toast('同级已有同名文件夹', 'warn'); return;
}
store.state.folders.push({ id: store.uid('f'), name, parentId: currentFolderId });
store.save(); close(); draw(); ui.toast('已创建文件夹');
```

- [ ] **Step 2: 文件夹行 ⋯ 菜单**

复用 `.card-more` 结构（放在文件夹行操作列），`click` 时 `stopPropagation`：

- 重命名：modal，校验 `siblingNameTaken(..., exceptId)`
- 删除：若 `!F.isEmpty(store.state.folders, store.state.docs, id)` → toast「文件夹非空，无法删除」；否则 `folders = folders.filter(...)`，若 `currentFolderId===id` 则回到 `parentId`，save + draw

- [ ] **Step 3: 上传**

创建 doc 时设 `folderId: 所选 || currentFolderId`；弹窗增加：

```html
<div class="field"><label for="upFolder">文件夹</label>
<select class="select" id="upFolder">...</select></div>
```

选项来自 `F.flatOptions(store.state.folders)`，默认选中 `currentFolderId`。

- [ ] **Step 4: 编辑资料**

`openEditor` 增加文件夹下拉，保存时 `d.folderId = select.value || null`（空字符串转 `null`）。

- [ ] **Step 5: 验收**

1. 新建 → 刷新后仍在  
2. 重命名更新面包屑  
3. 有资料时无法删除；移走或删资料后可删  
4. 上传出现在当前文件夹  
5. 编辑改文件夹后资料出现在目标层  

- [ ] **Step 6: Commit**

```bash
git add dist/agentos/js/views/knowledge.js
git commit -m "feat: create rename delete folders and assign docs"
```

---

### Task 5: Recursive search path display + final verify

**Files:**
- Modify: `dist/agentos/js/views/knowledge.js`（若 Task 3 未完整实现搜索分支则补全）

- [ ] **Step 1: 确认搜索分支**

当 `f.q` 有值：用 `F.descendantDocIds` 限制在当前子树，再套 Tab/工序/密级/状态；资料副标题或额外列显示 `F.pathLabel`；不渲染文件夹行。清空搜索恢复混排。

- [ ] **Step 2: 跑单测 + 页面走查**

```bash
node tests/check-agentos-folders.js
```

浏览器对照 spec「测试 / 验收」8 条全部勾过。

- [ ] **Step 3: Commit（若有改动）**

```bash
git add dist/agentos/js/views/knowledge.js
git commit -m "fix: knowledge subtree search shows folder paths"
```

---

## Spec coverage checklist

| Spec 项 | Task |
|---------|------|
| 面包屑下钻 | 3 |
| 独立 folders + folderId | 1, 2 |
| 种子与迁移 | 2 |
| 新建/重命名/删空 | 4 |
| 上传/编辑挂文件夹 | 4 |
| 搜索子树 + 路径 | 3/5 |
| 权限过滤不变 | 3（沿用 canView） |
| 引擎检索不改 | —（刻意不做） |

## Placeholder / consistency self-review

- 无 TBD；函数名统一 `childrenOf` / `docsIn` / `pathLabel` / `isEmpty` / `siblingNameTaken` / `defaultFolderId` / `SEED_FOLDERS`
- `parentId` / 根目录一律用 `null`（经 `normId`）
- 图纸库非高炉工序 → `f-drawing`（与测试一致）
