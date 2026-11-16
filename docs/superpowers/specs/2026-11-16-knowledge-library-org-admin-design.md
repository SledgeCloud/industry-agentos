# 知识库容器层 + 企业管理后台设计

日期：2026-11-16  
范围：AgentOS Mock（`dist/agentos`）  
状态：已确认，待实现

## 背景

知识库页当前根目录可直接出现文件夹与文件；资料密级与部门可见范围按单份资料配置。用户需要：

1. 根目录之上增加「知识库」容器层，根下只允许知识库
2. 知识库级密级与成员权限（阅读 / 编辑 / 管理），内部文件夹与文件完全继承
3. 头像菜单「企业组织运营」进入企业管理后台：通讯录、角色管理；角色可配置「新建知识库」权限

此前文件夹层级设计见 `2026-11-13-knowledge-folder-hierarchy-design.md`，本设计在其上叠加库容器与企业权限，不推翻库内文件夹下钻行为。

## 目标

- 根目录仅列出知识库；进入库后才有文件夹 / 文件
- 创建知识库时必选密级；可配置部门 / 用户的 read | edit | manage
- 库内资料不再单独配置密级与可见范围，一律继承所属库
- 「企业组织运营」进入 `#/org` 后台：企业通讯录、角色管理
- 角色权限含 `kb.create`；拥有该权限方可新建知识库

## 非目标

- 拖拽、跨库移动、文件夹单独 ACL
- 完整 SSO / 审批流 / 细粒度行级数据权限矩阵（仅预留字段）
- 改写出网策略模型本身（仍用同步后的 `doc.level`）
- 一期不做更多 org 菜单（计费、应用市场等）

## 信息架构与导航

### 知识库页

- 根：仅知识库行 / 卡片；无普通文件夹、无文件
- 进入知识库：沿用现有面包屑下钻（库根下 `parentId === null` 的文件夹 + 该层文件）
- 面包屑：`知识库 / {库名} / {文件夹…}`；搜索结果仍在当前库分支内递归
- 「返回上一级」：库内回父文件夹；库根回平台根；平台根禁用
- 「新建知识库」：当前用户角色含 `kb.create` 时显示，否则隐藏
- 库内按钮按库级权限显隐：read 浏览；edit 上传 / 建文件夹等；manage 库设置与删除

### 企业管理后台

- 入口：头像菜单「企业组织运营」→ `#/org`（默认通讯录）
- 独立壳：顶栏可返回主站 + 左侧菜单 + 右侧内容；与主站 `NAV` 分离
- 一期菜单：企业通讯录 `#/org/directory`、角色管理 `#/org/roles`
- 入口全员可见；无对应管理权限时页面只读或操作禁用，并提示切换具备权限的账号

## 数据模型

### libraries（知识库）

```text
{
  id: string,
  name: string,
  level: 'public' | 'internal' | 'secret' | 'confidential',
  description?: string,
  grants: [
    { type: 'dept' | 'user', id: string, role: 'read' | 'edit' | 'manage' }
  ],
  createdBy: string,
  createdAt: string,
  updatedAt: string
}
```

- 创建时必选 `level`；创建者默认写入一条 `type:'user', role:'manage'`
- 存于 `store.state.libraries`

### folders

```text
{ id: string, name: string, parentId: string | null, libraryId: string }
```

- 必须属于某知识库；`parentId === null` 表示该库根下的文件夹
- 平台根不再出现 `parentId === null` 且无 `libraryId` 的文件夹

### docs

- 新增 / 补齐 `libraryId`
- 保留 `folderId`（库内文件夹；不可为「平台根」）
- `level` 由所属库同步写入，供检索与出网复用
- 上传 / 编辑 UI 去掉密级与部门可见范围；`acl` 字段可清空或忽略，可见性改由库 `grants` 判定

### departments

- 由现有 `orgs` 字符串列表升级为：

```text
{ id: string, name: string }
```

- 存 `store.state.departments`；**保留 `user.dept` 为部门名称字符串**，与 `departments[].name` 对齐（不引入 `deptId`，降低迁移成本）

### users

- 增加 `roleIds: string[]`
- 其余字段保持：`id, name, title, dept, clearance`

### roles

```text
{
  id: string,
  name: string,
  description?: string,
  permissions: string[],   // 如 'org.manage' | 'role.manage' | 'kb.create'
  dataScope?: 'enterprise' // 一期固定本企业，预留扩展
}
```

一期权限点：

| 权限 | 含义 |
|------|------|
| `org.manage` | 管理通讯录（部门 / 用户） |
| `role.manage` | 管理角色与权限勾选 |
| `kb.create` | 新建知识库 |

种子角色示例：

- `role-admin` 企业管理员：上述全部
- `role-member` 普通成员：无上述管理项

种子用户：陈晓挂 `role-admin`；其余挂 `role-member`（可按演示微调）。

## 权限判定

### 功能权限

- `userHasPerm(user, perm)`：用户任一角色的 `permissions` 含该点
- 新建知识库：需要 `kb.create`
- 通讯录写操作：`org.manage`；角色写操作：`role.manage`

### 知识库成员角色（grants）

等级包含关系：`manage` ⊃ `edit` ⊃ `read`

用户对库的有效角色取本人 grant 与所属部门 grant 中的最高级。

| 能力 | read | edit | manage |
|------|------|------|--------|
| 进入库、浏览文件夹/文件、打开详情、可被检索 | ✓ | ✓ | ✓ |
| 上传、改资料元数据、新建/重命名文件夹 | | ✓ | ✓ |
| 改库密级与 grants、删除资料/空文件夹/空库 | | | ✓ |

### 资料可见（替换原「仅看 doc.acl」路径）

对文档 `d`：

1. 解析所属 `library`（`d.libraryId`）
2. `levelRank(user.clearance) >= levelRank(library.level)`
3. 用户对库有效角色至少为 `read`
4. 出网 / 分区逻辑仍使用同步后的 `d.level` 与现有 policy

平台管理员（演示账号陈晓）若同时为企业管理员：库访问仍走 grants；种子数据给陈晓对全部库 `manage`，避免演示「建得了库却看不见旧库」。

## 界面要点

### 知识库根列表

- 列：名称、密级、你的权限、更新时间、更多（有 manage 时：设置、删除）
- 无可见库时空态；有 `kb.create` 显示新建按钮

### 新建 / 设置知识库

- 字段：名称、密级（必选）、描述（可选）、grants 编辑（部门/用户 × 等级）
- 设置仅 `manage` 可进

### 库内页

- 去掉资料编辑中的密级与部门可见范围
- 根列表可用密级筛选知识库；进入库内后工具栏保留工序/状态等，**不再按资料密级筛选**（资料密级已与库一致）
- 上传默认 `libraryId = 当前库`，文件夹选项限于当前库

### 企业通讯录

- 左部门、右用户表；增删改部门与用户；用户可改职务、密级、部门、角色
- 需 `org.manage` 才可写

### 角色管理

- 列表 + 编辑抽屉/弹窗：名称、说明、权限勾选、`dataScope` 展示为「本企业」
- 需 `role.manage` 才可写
- 系统种子角色可允许编辑权限勾选（演示友好）；名称锁定可选

## 种子与迁移

1. 为每个原顶层文件夹创建对应 `library`（名称可带「库」后缀与现 `library` 元数据对齐，如科研报告 → 科研报告库）
2. 原顶层及子孙文件夹写入同一 `libraryId`；顶层 `parentId` 改为 `null`（相对库根）
3. docs 按原 `folderId` / `defaultFolderId` 映射补 `libraryId`，`level` 对齐库
4. `departments` ← 原 `orgs`；`roles` 种子；用户补 `roleIds`
5. `ensureLibraries` / `ensureOrg`：加载 state 时若缺则补齐，不破坏会话与其它字段
6. localStorage key 可保持 `agentos.ironworks.v1`，用结构探测做向前迁移

### 示例 grants（可微调）

- 科研报告库：炼铁技术中心 edit；科技管理部 read；陈晓 manage
- 图纸库：炼铁技术中心 edit；陈晓 manage
- 标准库 / 课题库等：科技管理部 edit；相关中心 read；陈晓 manage

## 测试要点

- 根目录不能出现文件或无 `libraryId` 的文件夹
- 无 `kb.create` 看不到新建；有则可建且成为 manage
- 密级不足或无 grant 时库与其下资料均不可见（含智能体检索）
- edit 不能改 grants；manage 可以
- 无 `org.manage` 不能改通讯录；无 `role.manage` 不能改角色
- 迁移后旧资料落在正确库内且 `level` 与库一致

## 实现落点（指导）

- 新逻辑模块：`js/libraries.js`（库 CRUD 纯函数、权限解析）、可选 `js/org.js`（角色权限判定）
- 视图：扩展 `knowledge.js`；新增 `views/org.js`（后台壳 + 通讯录 + 角色）
- 路由 / 入口：`app.js` 解析 `#/org…`，账号菜单绑定
- 数据 / 迁移：`data.js`、`core.js` store ensure*
- 策略：`policy.js` 的 `canView` 改为基于 library + grants（或包装一层 `canViewDoc`）
- 样式：`agentos.css` 增加 org 壳与库根列表样式
- 测试：纯函数单测（libraries / org 权限），必要时补充 check 脚本
