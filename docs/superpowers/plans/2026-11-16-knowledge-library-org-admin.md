# Knowledge Library + Org Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AgentOS 知识库上增加「知识库」容器层（密级 + 部门/用户 read|edit|manage），根目录仅显示知识库；并实现企业管理后台（通讯录、角色），角色可授予「新建知识库」权限。

**Architecture:** 纯函数模块 `org.js`（角色功能权限）与 `libraries.js`（库 grants / 可见性）；`folders.js` 增加 `libraryId` 作用域；`data.js`/`core.js` 种子与迁移；`policy.canView` 改为按所属库判定；`knowledge.js` 根列表与库内继承；新视图 `views/org.js` + `#/org` 路由独立壳。

**Tech Stack:** 静态 HTML/CSS/JS（`dist/agentos`）、`localStorage`（`agentos.ironworks.v1`）、Node `assert` + `vm` 单测。

**Spec:** `docs/superpowers/specs/2026-11-16-knowledge-library-org-admin-design.md`

## Global Constraints

- 根目录只允许知识库，不允许文件/普通文件夹
- 库内文件夹与文件完全继承库密级与可见性；UI 不再编辑资料密级/部门 ACL
- 新建知识库需要角色权限 `kb.create`
- 库成员等级：`manage` ⊃ `edit` ⊃ `read`
- 用户 `dept` 保持部门名称字符串；`departments[].name` 对齐
- 中文 UI；持久化键不变，用结构探测向前迁移

## File map

| File | Responsibility |
|------|----------------|
| `dist/agentos/js/org.js` | 角色权限点常量、`userHasPerm`、种子 roles/departments |
| `dist/agentos/js/libraries.js` | 库种子、grants 解析、`effectiveRole`/`canRead|Edit|Manage`、`visibleLibraries`、同步 doc.level |
| `dist/agentos/js/folders.js` | 增加 `libraryId`；子项/下拉/空判断按库过滤 |
| `tests/check-agentos-org.js` | org 权限单测 |
| `tests/check-agentos-libraries.js` | libraries 权限与可见性单测 |
| `tests/check-agentos-folders.js` | 更新为带 libraryId 的断言 |
| `dist/agentos/js/data.js` | 导出 departments/roles/libraries；folders/docs/users 补字段 |
| `dist/agentos/js/core.js` | `ensureOrg`/`ensureLibraries`；store 含新字段 |
| `dist/agentos/js/policy.js` | `canView(user, doc, libraries?)` 按库判定 |
| `dist/agentos/js/views/knowledge.js` | 根库列表、新建/设置库、库内继承、权限显隐 |
| `dist/agentos/js/views/org.js` | 企业后台壳、通讯录、角色管理 |
| `dist/agentos/js/app.js` | `#/org` 路由、账号菜单入口、render 分发 |
| `dist/agentos/css/agentos.css` | org 壳、库根列表样式 |
| `dist/agentos/index.html` | 引入 org.js、libraries.js、views/org.js |

---

### Task 1: Org permission helpers + tests

**Files:**
- Create: `dist/agentos/js/org.js`
- Create: `tests/check-agentos-org.js`

**Interfaces:**
- Produces: `AOS.org` with:
  - `PERMS: { ORG_MANAGE:'org.manage', ROLE_MANAGE:'role.manage', KB_CREATE:'kb.create' }`
  - `SEED_ROLES: Array<{id,name,description,permissions,dataScope}>`
  - `SEED_DEPARTMENTS: Array<{id,name}>`
  - `userHasPerm(user, roles, perm): boolean`
  - `roleById(roles, id): role | undefined`

- [ ] **Step 1: Write failing test**

```js
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = { console }; context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/agentos/js/org.js', 'utf8'), context);
const O = context.AOS.org;
assert.ok(O.PERMS.KB_CREATE === 'kb.create');
assert.ok(O.SEED_ROLES.some(r => r.id === 'role-admin'));
assert.ok(O.SEED_DEPARTMENTS.some(d => d.name === '炼铁技术中心'));
const roles = O.SEED_ROLES;
const admin = { id: 'u-chen', roleIds: ['role-admin'] };
const member = { id: 'u-wang', roleIds: ['role-member'] };
assert.equal(O.userHasPerm(admin, roles, 'kb.create'), true);
assert.equal(O.userHasPerm(member, roles, 'kb.create'), false);
assert.equal(O.userHasPerm(member, roles, 'org.manage'), false);
assert.equal(O.userHasPerm(admin, roles, 'org.manage'), true);
console.log('check-agentos-org: ok');
```

- [ ] **Step 2: Run — expect FAIL**

```bash
node tests/check-agentos-org.js
```

Expected: ENOENT `org.js`

- [ ] **Step 3: Implement `dist/agentos/js/org.js`**

```js
/* AgentOS · 企业角色与功能权限 */
(function (root) {
  const AOS = root.AOS || (root.AOS = {});
  const PERMS = {
    ORG_MANAGE: 'org.manage',
    ROLE_MANAGE: 'role.manage',
    KB_CREATE: 'kb.create'
  };
  const SEED_DEPARTMENTS = [
    { id: 'dept-iron', name: '炼铁技术中心' },
    { id: 'dept-tech', name: '科技管理部' },
    { id: 'dept-intel', name: '科技情报室' },
    { id: 'dept-it', name: '信息中心' },
    { id: 'dept-bf', name: '高炉车间' },
    { id: 'dept-sinter', name: '烧结车间' }
  ];
  const SEED_ROLES = [
    {
      id: 'role-admin', name: '企业管理员', description: '管理通讯录、角色，并可新建知识库',
      permissions: [PERMS.ORG_MANAGE, PERMS.ROLE_MANAGE, PERMS.KB_CREATE], dataScope: 'enterprise'
    },
    {
      id: 'role-member', name: '普通成员', description: '使用平台与被授权的知识库',
      permissions: [], dataScope: 'enterprise'
    }
  ];
  function roleById(roles, id) { return (roles || []).find(r => r.id === id); }
  function userHasPerm(user, roles, perm) {
    const ids = (user && user.roleIds) || [];
    return ids.some(rid => {
      const r = roleById(roles, rid);
      return r && Array.isArray(r.permissions) && r.permissions.includes(perm);
    });
  }
  AOS.org = { PERMS, SEED_ROLES, SEED_DEPARTMENTS, roleById, userHasPerm };
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run test — expect PASS**

```bash
node tests/check-agentos-org.js
```

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/org.js tests/check-agentos-org.js
git commit -m "feat: add org role permission helpers"
```

---

### Task 2: Libraries helpers + tests

**Files:**
- Create: `dist/agentos/js/libraries.js`
- Create: `tests/check-agentos-libraries.js`

**Interfaces:**
- Produces: `AOS.libraries` with:
  - `ROLE_RANK: { read:1, edit:2, manage:3 }`
  - `SEED_LIBRARIES: Array<library>`（含 grants；顶层文件夹对应的库）
  - `byId(libraries, id)`
  - `effectiveRole(library, user): 'read'|'edit'|'manage'|null`
  - `canRead|canEdit|canManage(library, user): boolean`
  - `visibleLibraries(libraries, user, levelRankFn): library[]`（clearance ≥ level 且 canRead）
  - `syncDocFromLibrary(doc, library): doc`（写 `doc.level = library.level`，`doc.libraryId = library.id`，`doc.acl = []`）
  - `isLibraryEmpty(libraryId, folders, docs): boolean`
  - `mapLegacyTopFolderToLibraryId(folderIdOrName): string | null`（迁移用）

- [ ] **Step 1: Write failing test**

```js
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
```

- [ ] **Step 2: Run — expect FAIL**

```bash
node tests/check-agentos-libraries.js
```

- [ ] **Step 3: Implement `libraries.js`**

实现上述接口。`SEED_LIBRARIES` 至少包含：科研报告库、课题库、图纸库、标准库、专家经验库（代码库/数据库可一并建库便于挂载现有 docs）。每库 `grants` 按 spec 示例；均含 `{ type:'user', id:'u-chen', role:'manage' }`。

`effectiveRole`：收集匹配 `type==='user' && id===user.id` 与 `type==='dept' && id===user.dept` 的 role，取 `ROLE_RANK` 最高者；无则 `null`。

`visibleLibraries`：`levelRankFn(user.clearance) >= levelRankFn(lib.level) && canRead(lib, user)`。

- [ ] **Step 4: Run — expect PASS**

```bash
node tests/check-agentos-libraries.js
```

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/libraries.js tests/check-agentos-libraries.js
git commit -m "feat: add knowledge library ACL helpers"
```

---

### Task 3: Folders scoped by libraryId

**Files:**
- Modify: `dist/agentos/js/folders.js`
- Modify: `tests/check-agentos-folders.js`

**Interfaces:**
- Update: `SEED_FOLDERS` 每项增加 `libraryId`
- Update: `childrenOf(folders, parentId, libraryId?)` — 若传入 `libraryId`，仅返回该库内且 `parentId` 匹配的项
- Update: `docsIn(docs, folderId, libraryId?)` — `folderId==null` 且有 `libraryId` 时返回该库根资料（`libraryId` 匹配且 folderId 空）
- Update: `flatOptions(folders, libraryId)` — 仅该库；首项 `{id:null,label:'库根目录'}`
- Update: `pathLabel` / `siblingNameTaken` / `isEmpty` / `descendant*` 在传入 `libraryId` 时限制范围
- Update: `defaultFolderId` 仍返回 folder id；调用方再补 libraryId

- [ ] **Step 1: Update test expectations**（示例关键断言）

```js
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
assert.deepEqual(copy(F.childrenOf(folders, null, 'lib-report').map(x => x.id)), ['f-report']);
assert.deepEqual(copy(F.docsIn(docs, null, 'lib-report').map(x => x.id)), ['d2']);
assert.ok(copy(F.flatOptions(folders, 'lib-report')).every(o => o.id == null || folders.find(f => f.id === o.id).libraryId === 'lib-report'));
```

保留并调整原有其它断言以匹配新 SEED（顶层带 libraryId）。

- [ ] **Step 2: Run — expect FAIL**（旧实现不识 libraryId 过滤）

```bash
node tests/check-agentos-folders.js
```

- [ ] **Step 3: Implement folder scoping** in `folders.js`

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/folders.js tests/check-agentos-folders.js
git commit -m "feat: scope folders and docs by libraryId"
```

---

### Task 4: Seed data + store migration

**Files:**
- Modify: `dist/agentos/js/data.js`
- Modify: `dist/agentos/js/core.js`
- Modify: `dist/agentos/index.html`（先引入 `org.js`、`libraries.js`，在 `folders.js` 之前或之后：`policy → org → libraries → folders → data`）

**Interfaces:**
- `AOS.data` 增加：`departments`, `roles`, `libraries`；`users[].roleIds`；`folders[].libraryId`；`docs[].libraryId`
- `store.state` 增加同名字段；`ensureOrg()` / `ensureLibraries()` 在 load/seed 调用
- `orgs` 可保留为 `departments.map(d => d.name)` 兼容旧引用，或全局替换为 `departments`——实现时：**`AOS.data.orgs` 继续导出名称数组**（由 departments 派生），减少无关改动

- [ ] **Step 1: Wire script tags in `index.html`**

在 `policy.js` 后增加：

```html
<script src="js/org.js"></script>
<script src="js/libraries.js"></script>
```

- [ ] **Step 2: Update `data.js`**

- users：陈晓 `roleIds:['role-admin']`，其余 `['role-member']`
- `departments` / `roles` / `libraries` 从 `AOS.org` / `AOS.libraries` 拷贝
- folders：使用带 `libraryId` 的 SEED；顶层 `parentId: null`
- docs：补 `libraryId`（按 folder 或 `library` 元数据字段映射）；调用 `syncDocFromLibrary` 对齐 level
- `orgs = departments.map(d => d.name)`

- [ ] **Step 3: Update `core.js` seed + ensure**

```js
function ensureOrg() {
  const O = AOS.org;
  if (!O) return;
  if (!Array.isArray(state.departments) || !state.departments.length) {
    state.departments = copy(O.SEED_DEPARTMENTS);
  }
  if (!Array.isArray(state.roles) || !state.roles.length) {
    state.roles = copy(O.SEED_ROLES);
  }
  (AOS.data.users || []).forEach(u => {
    // users live on AOS.data; if mutable copies exist on state, sync roleIds there
  });
}
function ensureLibraries() {
  const L = AOS.libraries; const F = AOS.folders;
  if (!L) return;
  if (!Array.isArray(state.libraries) || !state.libraries.length) {
    state.libraries = copy(L.SEED_LIBRARIES);
  }
  // folders missing libraryId: map from legacy top folder ids
  // docs missing libraryId: from folder or library name field
  // then syncDocFromLibrary for each doc
}
```

在 `load` / `seed` 路径调用 `ensureOrg()`、`ensureFolders()`、`ensureLibraries()`（顺序：org → folders → libraries）。

`svc` 增加便捷方法（可放 core）：

```js
svc.userHasPerm = (perm) => AOS.org.userHasPerm(svc.currentUser(), store.state.roles || AOS.data.roles, perm);
svc.library = (id) => (store.state.libraries || []).find(l => l.id === id);
```

- [ ] **Step 4: Sanity check**

```bash
node --check dist/agentos/js/data.js
node --check dist/agentos/js/core.js
node tests/check-agentos-org.js
node tests/check-agentos-libraries.js
node tests/check-agentos-folders.js
```

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/index.html dist/agentos/js/data.js dist/agentos/js/core.js
git commit -m "feat: seed libraries roles and migrate store"
```

---

### Task 5: policy.canView uses libraries

**Files:**
- Modify: `dist/agentos/js/policy.js`
- Modify: `tests/check-agentos-policy.js`（若有 canView 用例则更新；否则新增最小用例文件或在 libraries 测试中覆盖集成）

**Interfaces:**
- Change: `canView(user, doc, libraries)`  
  - 若 `libraries` 与 `doc.libraryId` 可解析到库：clearance ≥ `library.level` 且 `AOS.libraries.canRead(library, user)`  
  - 若无库（异常）：回退旧逻辑 `doc.level` + `doc.acl`（兼容）

- [ ] **Step 1: Add/adjust test** loading both `policy.js` 与 `libraries.js`

```js
// after loading policy + libraries
const libs = [/* lib-report as above */];
const doc = { id: 'd1', libraryId: 'lib-report', level: 'internal', acl: [] };
assert.equal(P.canView(wang, doc, libs), true);
assert.equal(P.canView(li, doc, libs), false);
```

- [ ] **Step 2: Implement canView change**

- [ ] **Step 3: Update call sites**（`knowledge.js`、`core.js` 打开资料等）传入 `store.state.libraries`

```js
P.canView(user, d, store.state.libraries)
```

- [ ] **Step 4: Run tests**

```bash
node tests/check-agentos-policy.js
node tests/check-agentos-libraries.js
```

- [ ] **Step 5: Commit**

```bash
git add dist/agentos/js/policy.js tests/check-agentos-policy.js dist/agentos/js/core.js
git commit -m "feat: gate document visibility by library grants"
```

---

### Task 6: Knowledge UI — library root + create/settings

**Files:**
- Modify: `dist/agentos/js/views/knowledge.js`
- Modify: `dist/agentos/css/agentos.css`

**Interfaces:**
- State: `currentLibraryId`（`null` = 平台根）、`currentFolderId`（库内）
- 根：列出 `visibleLibraries`；操作「进入」、更多（设置/删除需 manage）
- 有 `kb.create` 显示「新建知识库」；创建弹窗：名称、密级、描述、grants 编辑器（部门/用户 × 等级）；创建者自动 manage
- 设置弹窗同字段，仅 manage
- 删除库：`isLibraryEmpty` 才可删
- 进入库后：现有文件夹/文件 UI；面包屑含库名；返回上一级按 spec
- 上传/建文件夹：需 `canEdit`；隐藏资料密级与可见部门字段；保存时 `syncDocFromLibrary`
- 库内隐藏密级筛；根列表可用密级筛库
- 无 `canEdit` 隐藏上传/新建文件夹；无 `canManage` 隐藏删资料等

- [ ] **Step 1: Refactor navigation state**

```js
let currentLibraryId = null;
let currentFolderId = null;
function goUp() {
  if (f.q) { f.q = ''; /* clear input */ return draw(); }
  if (currentLibraryId && currentFolderId) {
    const cur = store.state.folders.find(x => x.id === currentFolderId);
    currentFolderId = F.normId(cur && cur.parentId);
    return draw();
  }
  if (currentLibraryId) { currentLibraryId = null; currentFolderId = null; return draw(); }
}
```

- [ ] **Step 2: Root list HTML**（表格或列表）

列：名称、密级、你的权限、更新时间、更多

- [ ] **Step 3: Create/settings modal** with grants editor

Grants 编辑最小实现：多行「类型(部门/用户) + 选择 + 等级」；保存写入 `library.grants`。

- [ ] **Step 4: Inside-library draw** 使用 `childrenOf(..., libraryId)` / `docsIn(..., libraryId)`；权限按钮显隐

- [ ] **Step 5: Manual smoke**（浏览器）：重置演示数据 → 根仅库 → 陈晓可建库 → 王建国见科研报告库可编辑 → 李敏若无 grant 不可见

- [ ] **Step 6: Commit**

```bash
git add dist/agentos/js/views/knowledge.js dist/agentos/css/agentos.css
git commit -m "feat: knowledge library root with ACL UI"
```

---

### Task 7: Enterprise admin shell — directory + roles

**Files:**
- Create: `dist/agentos/js/views/org.js`
- Modify: `dist/agentos/js/app.js`
- Modify: `dist/agentos/css/agentos.css`
- Modify: `dist/agentos/index.html`

**Interfaces:**
- Routes: `#/org` → directory；`#/org/directory`；`#/org/roles`
- `AOS.views.org` 渲染独立布局（可替换 `#view` 内容为 org 壳，或临时隐藏主 nav——推荐：**在 view 内画完整 org 布局**，左侧菜单 + 内容；主站 sidebar 仍在，可接受一期；更优：org 路由时 `body` 加 class `mode-org` 隐藏主 nav，顶栏保留返回）
- 通讯录：左 departments CRUD；右用户表；编辑用户（dept/clearance/roleIds/title）；需 `org.manage` 才可写
- 角色：列表 + 编辑 permissions 勾选；需 `role.manage`
- 账号菜单 `data-demo="org"` 改为 `location.hash = '#/org'`

- [ ] **Step 1: Add CSS**

```css
.mode-org .sidebar { display: none; }
.org-layout { display: flex; min-height: calc(100vh - 52px); }
.org-nav { width: 200px; border-right: 1px solid var(--line); padding: 12px; }
.org-nav a { display: flex; ... }
.org-nav a.on { background: var(--hover); font-weight: 500; }
.org-main { flex: 1; min-width: 0; }
.dir-split { display: flex; gap: 0; min-height: 420px; }
.dir-depts { width: 220px; border-right: 1px solid var(--line); }
```

- [ ] **Step 2: Implement `views/org.js`**

```js
AOS.views.org = function (el, page) {
  // page: 'directory' | 'roles'
  const canOrg = svc.userHasPerm(AOS.org.PERMS.ORG_MANAGE);
  const canRole = svc.userHasPerm(AOS.org.PERMS.ROLE_MANAGE);
  document.body.classList.add('mode-org');
  // on cleanup return () => document.body.classList.remove('mode-org');
  ...
};
```

保证 `app.js` 的 view 清理钩子会调用返回的 dispose（若现有 render 已支持 disposer；否则在再次 render 时移除 class）。

- [ ] **Step 3: Wire `app.js` parse + render**

```js
if (a === 'org') return { view: 'org', nav: 'org', orgPage: b || 'directory' };
// render:
if (r.view === 'org') disposer = AOS.views.org(viewEl, r.orgPage);
```

账号菜单：

```js
if (demo === 'org') { location.hash = '#/org'; return; }
```

- [ ] **Step 4: Script tag**

```html
<script src="js/views/org.js"></script>
```

- [ ] **Step 5: Smoke** — 普通成员进 org 只读；陈晓可改角色勾选 `kb.create` 后换账号验证新建按钮

- [ ] **Step 6: Commit**

```bash
git add dist/agentos/js/views/org.js dist/agentos/js/app.js dist/agentos/css/agentos.css dist/agentos/index.html
git commit -m "feat: enterprise admin directory and roles"
```

---

### Task 8: Final verification

**Files:**
- Create (optional): `tests/check-agentos-library-migration.js` — 用 vm 加载 folders+libraries+org，断言 SEED 顶层文件夹均有 libraryId、SEED docs 映射非空

- [ ] **Step 1: Run all agentos checks**

```bash
node tests/check-agentos-org.js
node tests/check-agentos-libraries.js
node tests/check-agentos-folders.js
node tests/check-agentos-policy.js
node --check dist/agentos/js/views/knowledge.js
node --check dist/agentos/js/views/org.js
node --check dist/agentos/js/app.js
```

Expected: 全部 ok / 无 SyntaxError

- [ ] **Step 2: Browser checklist**

1. 重置演示数据  
2. 知识库根仅显示库  
3. 进入库可见文件夹/文件；资料详情无密级编辑  
4. 陈晓可新建库、设 grants  
5. 去掉某用户 grant 后该用户不可见  
6. 企业组织运营 → 通讯录/角色  
7. 去掉角色 `kb.create` 后新建按钮消失  

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "test: verify library and org admin flows"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| 根仅知识库 | 6 |
| 库密级 + grants | 2, 4, 6 |
| 完全继承密级/可见 | 2, 5, 6 |
| read/edit/manage 能力 | 2, 6 |
| kb.create 建库 | 1, 6, 7 |
| #/org 通讯录 | 7 |
| 角色管理 | 7 |
| 迁移种子 | 3, 4 |
| canView 按库 | 5 |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-16-knowledge-library-org-admin.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每任务新开子代理，任务间复审，迭代快  

**2. Inline Execution** — 本会话按 executing-plans 连续执行并设检查点  

Which approach?
