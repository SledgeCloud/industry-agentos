# 部署到 Vercel

本项目是直接运行的 HTML / CSS / JavaScript 静态交互 Demo。`dist/` 保存可编辑的程序源码，无需安装依赖或编译，也没有服务器、数据库或 API Key。

## 从 GitHub 导入

1. 在 Vercel 选择 **Add New → Project**，导入 `zhufeng62/AgentOS-Ops-RFT`。这是私有仓库，需要为 Vercel 的 GitHub 集成授予该仓库访问权限。
2. 使用下列设置。根目录必须保持仓库根目录，使 Vercel 能读取根目录中的 `vercel.json`。

| 配置项 | 值 |
| --- | --- |
| Framework Preset | Other |
| Root Directory | `.`（默认仓库根目录） |
| Build Command | 留空，跳过构建 |
| Output Directory | `dist` |
| Install Command | 留空，跳过安装 |
| Environment Variables | 无需配置 |
| Production Branch | `main` |

3. 点击 **Deploy**。仓库内的 `vercel.json` 已声明构建、安装与输出设置，通常无需再次覆盖。若界面要求手动填写命令，打开对应 Override 并留空。
4. 部署成功后访问域名根路径。后续推送到生产分支 `main`，由 Vercel Git 集成触发部署。

## 页面入口

| 路径 | 页面 |
| --- | --- |
| `/` | 原 AI Ops 首页，包含全新 AIOps 入口 |
| `/new-aiops.html` | 全新 AIOps |
| `/enterprise-space.html` | 企业空间 |
| `/enterprise-organization.html` | 企业组织运营 |

页面之间使用相对路径，独立企业管理文档通过同源 iframe 打开。`cleanUrls: false` 保留 `.html` 文件名，保证新 AIOps 来源识别、企业管理切换和返回上下文。保持该设置；无需配置 SPA 通配重写。

Vercel 仅对外提供 `dist/` 内容。`tests/` 和说明文档留在 Git 仓库中，不作为网站文件公开；`.vercelignore` 也限制了未来 CLI 上传的文件范围。

## 部署后的检查

1. 打开根路径，再通过导航进入全新 AIOps。
2. 分别直接访问其余三个页面，并刷新确认可加载。
3. 从新旧 AIOps 右上角 **Feng Zhu** 进入企业空间和企业组织运营，切换后返回，确认原页面上下文仍在。
4. 确认浏览器没有 CSS / JS 的 404 或脚本错误。

当前业务数据为 Mock。大部分状态在刷新后复位；部分配置使用浏览器 localStorage，企业管理演示使用 sessionStorage。更换域名不会迁移原浏览器存储。Vercel 环境变量不会自动成为浏览器中的服务配置；本版本无需填写模型、数据库或鉴权密钥。

## 本地预览与验证

在仓库根目录执行：

```sh
python3 -m http.server 8088 --bind 127.0.0.1 --directory dist
```

访问 `http://127.0.0.1:8088/`。本地 HTTP 预览可以检查页面和资源；它不等同于 Vercel 云端部署验收。

测试仅需本机安装 Node.js，无第三方依赖。运行单项或全部现有检查：

```sh
node tests/check-enterprise-management.js
for test_file in tests/check-*.js; do node "$test_file" || exit 1; done
```

静态托管方式依据 [Vercel 构建设置](https://vercel.com/docs/builds/configure-a-build)，配置字段参见 [vercel.json 参考](https://vercel.com/docs/project-configuration/vercel-json)。
