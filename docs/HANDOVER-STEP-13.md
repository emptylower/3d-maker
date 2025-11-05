# 3D‑MARKER Step‑13 前端产品化 交接文档（M0–M3）/ 交接记录（2025‑11‑05）

本交接文档面向下一位同事，概述当前预发实现、代码位置、接口约定、环境依赖、测试与常见问题排查。对应提交已推送到 `origin/main`。

参考资料：
- 产品 PRD：`docs/PRD-3D-MARKER.md`
- Step‑13 计划：`docs/steps/step-13-frontend-ui-plan.md`
- hitem3D API 本地镜像：`docs/hitem3d-api/README.md` 与 `docs/hitem3d-api/pages/zh/api/api-reference/list/*.md`

---

## 本次交付（2025‑11‑05）

以下内容为本次对话期间完成并已合入的交付与变更，便于后续接手与生产验证。

- 生成页（多视图 + 人像，UI 对齐参考图）
  - 新增容器 `components/generator/GeneratePanel.tsx`，支持“通用/人像”切换与“单图/多视图”页签；多视图前/后/左/右布局对齐，20MB 校验；人像固定纹理与 1536 分辨率。
  - 单图/多视图表单重构为卡片样式，底部参数栏与“生成”按钮；多视图仅前视图时走 `images`，存在侧视图走 `multi_images`（顺序前/后/左/右）。
  - 新增/更新 UI 测试，确保表单参数与 FormData 构造正确。

- 后端提交与错误映射
  - `app/api/hitem3d/submit/route.ts`：`resolveCreditsCost` 抛错映射为 400；统一默认面数；固定纹理的人像支持；一图/多图互斥校验；默认 GLB。

- 任务找回与自动化
  - 兜底单个：`POST /api/hitem3d/finalize` 支持“若已存在同 task_id 的资产且缺文件则就地更新”（避免重复资产）。
  - 批量找回（管理员）：`POST /api/hitem3d/finalize/batch`，支持指定 `task_ids` 或自动扫描最近“成功但未落库”的任务（`models/generation-task:listSuccessTasksWithoutAsset`）。
  - 自动化找回（Vercel Cron）：`GET /api/cron/hitem3d-auto-finalize`（每 10 分钟），可用 `AUTO_FINALIZE_LIMIT` 控制批量数量；支持 `AUTO_FINALIZE_TOKEN` 手动触发。

- 资产预览（GLB）
  - 详情页新增“GLB 自动预览” `components/assets/AssetAutoPreviewGLB.tsx`：优先原始 GLB，其次派生 GLB；签名链接 `disposition=inline`；`<model-viewer crossorigin="anonymous">`。
  - 回调/兜底下载落库时写入正确 Content‑Type（glb：`model/gltf-binary`；图片：`image/*`）。

- 按需格式（renditions）
  - `POST /api/assets/:uuid/renditions` / `GET /renditions`：新增“供应商直链回退”尝试。若同目录存在 `file.<fmt>.zip`/`file.zip`，优先使用；否则尝试 `file.<fmt>`。
  - OBJ 打包尝试：当供应商无 zip 时，服务端抓取 `.obj`、解析 `.mtl`、拉取贴图并以 store 方式生成 zip（`file.obj.zip`）作为下载。已修正 ZIP 头与 DOS 时间戳以提升兼容性（macOS 解压器仍可能对极端情况挑剔，已提供替代方案见下）。
  - 新增“单文件下载清单”接口：`GET /api/assets/:uuid/renditions/files?format=obj` 会按需“物化” OBJ/MTL/贴图到 R2 的 `assets/<user>/<asset>/obj/` 并返回签名链接清单。前端 OBJ 下载改为新窗口打开清单并逐个下载（`components/assets/RenditionsPanel.tsx`）。
  - `RENDITIONS_INSTANT_READY_FOR_ORIGINAL=1`：当请求格式与原始一致（例如原始 GLB→生成 GLB）时，直接标记就绪并复用原始文件。

- 存储与 CORS
  - R2 CORS 建议配置（示例）：
    [
      {
        "AllowedOrigins": ["https://<your-site>", "http://localhost:3000"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedHeaders": ["Authorization","Origin","Range","Content-Type","Accept","If-None-Match","If-Modified-Since","Cache-Control"],
        "ExposeHeaders": ["Accept-Ranges","Content-Length","Content-Range","Content-Type","ETag"],
        "MaxAgeSeconds": 86400
      }
    ]

- 数据库迁移
  - 新增 `data/migrations/005-create-asset-renditions.sql`（`asset_renditions` 表），用于按需格式导出状态记录。

- 测试与稳定性
  - 当前项目测试 90+ 项通过（含此次新增逻辑的集成/UI 测试）。
  - 主要风险点：供应商是否提供多格式直链与鉴权参数继承；ZIP 兼容性（已提供“单文件清单下载”的替代方案）。

- 已知限制 / 暂缓事项
  - 供应商一次任务只产出一种格式；其它格式通过“直链尝试或再生成”实现，后者需保存源图并二次提交（未启用，方案已评估）。
  - ZIP 打包为极简 store 方案，macOS 解压器对头部严格；实际生产已优先改为“文件清单下载”。若需要“一键打包”，建议接入成熟库（fflate/yazl）。
  - 历史孤儿资产（无 task_id/无文件）建议标记删除。
  - 早期贴出过密钥的会话需要旋转：Supabase SRK、R2 AK/SK、hitem3D Secret。

### 新/变更环境变量
- `RENDITIONS_INSTANT_READY_FOR_ORIGINAL`（1/0）
- `AUTO_FINALIZE_LIMIT`、`AUTO_FINALIZE_TOKEN`
- `HITEM3D_REFERER`、`HITEM3D_APPID`、`HITEM3D_UA`（供应商防盗链头）

### 主要变更文件（增量）
- 生成与 UI：
  - `components/generator/GeneratePanel.tsx`、`components/generator/GenerateForm.tsx`、`components/generator/GenerateFormMulti.tsx`
  - `app/[locale]/(default)/generate/page.tsx`
- 预览与详情页：
  - `components/assets/ViewerGLB.tsx`、`components/assets/AssetAutoPreviewGLB.tsx`
  - `app/[locale]/(default)/(console)/my-assets/[uuid]/page.tsx`
- 任务与找回：
  - `app/api/hitem3d/finalize/route.ts`、`app/api/hitem3d/finalize/batch/route.ts`、`app/api/cron/hitem3d-auto-finalize/route.ts`
  - `models/generation-task.ts`（`listSuccessTasksWithoutAsset`）、`models/asset.ts`（`updateAssetByUuid`）
- 按需格式与下载：
  - `app/api/assets/[uuid]/renditions/route.ts`、`app/api/assets/[uuid]/download/route.ts`
  - `app/api/assets/[uuid]/renditions/files/route.ts`（新）
  - `components/assets/RenditionsPanel.tsx`（OBJ 下载改新窗口清单）
- 存储：`lib/storage.ts`（`getSignedUrl` 支持 `ResponseContentDisposition`、新增 `listObjects`）
- 迁移：`data/migrations/005-create-asset-renditions.sql`
- 定时：`vercel.json`（`crons` 每 10 分钟跑一次）

### 建议的后续工作
- 方案 A（规范）：保存源图并二次提交到供应商（format=目标格式），明确计费与成功率；UI 上标明“导出将消耗积分”。
- 方案 B（当前）：直链尝试与“文件清单下载”已上线；如需“一键打包”，建议更换 ZIP 库。
- 提供管理后台“批量 finalize”按钮与状态面板，便于运维观测（当前有接口）。
- 对历史“带查询参数的对象名”进行迁移（可选），统一清理 Key 命名。

## 0. 当前目标（Step‑13）与范围
让用户完整体验“创作（预览）→ 资产（按需生成与下载）→ 广场展示 → 登录/注册”的主流程。本阶段重点完成 M0–M3 的产品化与可用性。

## 1. 已交付内容概览（按里程碑）

### M0 导航与骨架
- 顶部导航：创作（/generate）｜资产（/my-assets）｜广场（/plaza）｜登录/注册
- 页面骨架：
  - `app/[locale]/(default)/generate/page.tsx`
  - `app/[locale]/(default)/(console)/my-assets/page.tsx`
  - `app/[locale]/(default)/(console)/my-assets/[uuid]/page.tsx`
  - `app/[locale]/plaza/page.tsx`、`/plaza/[slug]/page.tsx`
- UI 测试与 E2E 导航用例已补充。

### M1 登录/注册 UI
- 自定义邮箱/密码注册与登录 UI（NextAuth CredentialsProvider）：
  - `app/[locale]/auth/register/page.tsx`
  - `app/[locale]/auth/signin/page.tsx`
  - 组件：`components/sign/register-form.tsx`、`components/sign/credentials-login-form.tsx`
- 成功注册自动登录（服务端转发 Set-Cookie）。
- UI/集成测试覆盖输入校验与 cookie 生效。

### M2 创作页（单图/多视图 + 人像）
- 组件：`components/generator/GenerateForm.tsx`
  - 默认参数：model=hitem3dv1.5、resolution=1536、request_type=1（几何）。勾选“启用纹理”→ `request_type=3`。
  - 费用提示：基于 `resolveCreditsCost`。
  - 提交：`POST /api/hitem3d/submit`，采用 1B 策略（供应商提交成功后扣费）。
  - 默认输出格式：format=2（GLB），便于在线预览（依据 `create-task.md`）。
  - 新增容器：`components/generator/GeneratePanel.tsx`，提供“通用/人像”切换与“单图/多视图”页签：
    - 多视图表单：`components/generator/GenerateFormMulti.tsx`，前（必选）/后/左/右四视图；仅选择前视图→走 `images`，存在任一其他视图→走 `multi_images`，顺序固定“前/后/左/右”（未选不占位）。
    - 人像模式固定纹理（`request_type=3`）、固定 `model=scene-portraitv1.5` 且仅 `resolution=1536`。
    - UI/提交均对单张图片做 20MB 限制（与供应商一致）。
- 后端改进：
  - `services/hitem3d.ts`：Token 获取主/备地址回退（任意非 2xx 即回退到 `/get-token`），错误更可读。
  - `app/api/hitem3d/submit/route.ts`：
    - 参数校验与积分不足返回；
    - `face` 映射：未传或无效时按分辨率默认值：512→500k、1024→1M、1536→2M、1536pro→2M；
    - 成功后写入 `generation_tasks`（state=created）。

### M3 我的资产（按需生成+下载+GLB 预览）
- 路由新增/改造：
  - `POST /api/assets/:uuid/renditions`：创建/返回按需导出任务（state: processing/success），幂等且不扣费。
  - `GET /api/assets/:uuid/renditions?format=glb&with_texture=false`：查询按需导出状态。
  - `GET /api/assets/:uuid/download`：
    - 支持 `?format=glb|obj|stl|fbx`，未就绪→409 `{ code:'WAIT_RENDITION' }`；
    - `response=json` 或历史 `format=json` 返回预签名 URL。
  - `GET /api/hitem3d/status?task_id=...`：返回 `{ state }`，并在供应商成功时附带 `{ cover_url, url }`（直链有效期约 1h）。
  - `GET /api/assets/by-task?task_id=...`：将 task 映射到 `asset_uuid`（回调/兜底入库后可用）。
  - `POST /api/hitem3d/finalize`：兜底逻辑，在回调未达时主动 query-task 并下载供应商文件落库到 R2。
- 回调处理：`app/api/hitem3d/callback/route.ts`
  - 成功：下载 `cover_url`/`url` 到 R2，创建 `assets`，在资产记录上写入 `task_id`；
  - 失败：退款一次；
  - 幂等：重复回调直接 200。
  - 下载供应商直链时默认附带 Referer/Origin（取资源 origin）、User-Agent，兼容常见 CDN 防盗链；若配置了 `HITEM3D_APPID`，会带 `Appid` 头。
- 页面与组件：
  - “我的资产”列表：`app/[locale]/(default)/(console)/my-assets/page.tsx`
    - 显示最近任务；`TaskStatus` 轮询状态、解析 `asset_uuid`。
    - 任务成功但本地未落库时（供应商直链可用）：
      - 若为 GLB：嵌入 `<model-viewer>` 在线预览（组件 `components/assets/ViewerGLB.tsx`）。
      - 否则提示“不可在线预览（例如 OBJ 缺少 .MTL/贴图）”，提供“临时下载”。
    - 也可手动“刷新状态”（会触发 `finalize` 兜底下载）。
  - 资产详情页：`app/[locale]/(default)/(console)/my-assets/[uuid]/page.tsx`
    - 包含 `RenditionsPanel`：四种格式按需生成/轮询/下载（就绪后启用下载）。

## 2. i18n 与导航
- 暂仅中文：`i18n/locale.ts` → `locales=['zh']`，`defaultLocale='zh'`；中间件 matcher 限定 zh 系列。
- 隐藏语言切换：`i18n/pages/landing/zh.json` → `header.show_locale=false`。

## 3. 关键接口约定（新增/改造）
- `POST /api/hitem3d/submit`
  - FormData：`images/multi_images`（任一必填）`request_type`（1/3）、`model`（hitem3dv1.5 默认）、`resolution`（1536 默认）、`format=2`（GLB）、`mesh_url?`（2 时必填）。
  - 错误映射：当计费规则非法（如人像+非1536）时，返回 400 + 可读提示。
  - 1B 扣费策略：供应商提交成功后扣费；失败回调自动退款；幂等由 `generation_tasks` 保障。
- `POST /api/hitem3d/callback`：见上（回调落库）。
- `GET /api/hitem3d/status?task_id=...`：返回 `{ state, cover_url?, url? }`。
- `POST /api/hitem3d/finalize { task_id }`：状态成功但未落库时触发兜底下载与落库。
- `POST /api/assets/:uuid/renditions { format, with_texture? }`：创建/返回按需导出任务（不扣费）。
- `GET /api/assets/:uuid/renditions?format=...&with_texture=...`：查询 state。
- `GET /api/assets/:uuid/download?format=...`：按需导出就绪则下载；未就绪 409 `{ code:'WAIT_RENDITION' }`；`response=json` 返回预签名 URL。
- `GET /api/assets/by-task?task_id=...`：返回 `{ asset_uuid }`。

## 4. 环境变量（预发务必配置）
- hitem3D：
  - `HITEM3D_API_BASE`（默认 `https://api.hitem3d.ai`）
  - `HITEM3D_CLIENT_ID`、`HITEM3D_CLIENT_SECRET`
  - `HITEM3D_CALLBACK_URL`（例：`https://<域名>/api/hitem3d/callback`）
  - `HITEM3D_TOKEN_TTL_SECONDS`（可选）
  - 可选：`HITEM3D_APPID`、`HITEM3D_REFERER`、`HITEM3D_UA`
- 存储（R2/S3 兼容）：
  - `STORAGE_ENDPOINT`、`STORAGE_REGION`（R2 一般 `auto`）
  - `STORAGE_ACCESS_KEY`、`STORAGE_SECRET_KEY`
  - `STORAGE_BUCKET`（必填）
  - 可选：`STORAGE_DOMAIN`、`STORAGE_DOWNLOAD_MODE`（`presigned` 或 `proxy`）
- Auth/Next：`AUTH_SECRET` 等。

## 5. 业务决策与默认策略
- 预览优先：创作页只产出“可预览基础模型”。
- 默认输出 GLB：提交时 `format=2`，便于内嵌 `<model-viewer>` 在线预览。
- 面数默认映射（未传/无效）：512→500k、1024→1M、1536→2M、1536pro→2M。
- 按需导出/下载：详情页点击格式按钮时触发（不额外扣费，幂等不重复创建）。
- 临时预览兜底（方案 A）：任务 success 且本地未落库时，若供应商直链为 `.glb`，页面内直接预览；非 `.glb` 则提示“不可在线预览”并提供临时下载。
- 供应商直链下载兼容（方案 B）：回调/兜底下载时默认附带 Referer/Origin（取资源 origin）与 UA，必要时可加 `Appid`。

## 6. 常见问题与排查
- 提交 500：多数为缺少 `HITEM3D_CLIENT_ID/SECRET` 或 token 接口镜像问题。现已支持主/备回退；错误信息会直出（例如“分辨率/面数不合法”）。
- 面数错误：供应商提示“面数设置不合理（100000～2000000）”。服务端现已按分辨率默认面数自动填充。
- 回调未达：
  - 检查 `HITEM3D_CALLBACK_URL` 是否在供应商侧生效（是否需要白名单/签名）。
  - Vercel 日志搜 `/api/hitem3d/callback`；若没有，可以用 `POST /api/hitem3d/finalize` 兜底。
- 403 下载直链：
  - 多为 CDN 防盗链/过期。我们默认附带 Referer/Origin（资源 origin）与 UA；
  - 若仍 403：与供应商确认是否需额外头（如 Appid/Cookie/签名）与直链有效期策略；临时使用“在线预览（GLB）/临时下载”。

## 7. 测试（Vitest/Playwright）
- 运行：
  - `cd shipany-template && pnpm test`（Vitest，全量）
  - E2E（需 baseURL）：`PLAYWRIGHT_BASE_URL=<预发域> pnpm e2e`
- 主要新增测试：
  - UI：导航渲染、登录/注册表单校验、生成表单（默认 `format=2`）、任务面板等。
  - 集成：hitem3d submit/callback/status/finalize，renditions 路由、assets 下载 409/302/JSON。

## 8. 主要文件清单（新增/改动）
- 前端页面/组件：
  - 生成页：`app/[locale]/(default)/generate/page.tsx`、`components/generator/GenerateForm.tsx`
  - 我的资产列表：`app/[locale]/(default)/(console)/my-assets/page.tsx`、`components/assets/TaskStatus.tsx`、`components/assets/ViewerGLB.tsx`
  - 资产详情：`app/[locale]/(default)/(console)/my-assets/[uuid]/page.tsx`、`components/assets/RenditionsPanel.tsx`
- 路由：
  - hitem3d：`/api/hitem3d/submit`、`/status`、`/callback`、`/finalize`
  - assets：`/api/assets/[uuid]/download`、`/api/assets/[uuid]/renditions`、`/api/assets/by-task`
- i18n：`i18n/locale.ts`（仅 zh）、`i18n/pages/landing/zh.json`（导航与隐藏语言切换）

## 9. 下一步建议（未完项）
- 资产详情页：在本地文件就绪时内置 `<model-viewer>` 预览（当前仅任务卡片层面做临时预览）。
- renditions：补全资产侧落库与格式导出持久化（目前通过模型/路由模拟状态；如需 DB 迁移 `asset_renditions` 表，请补迁移）。
- Plaza（M4）：发布/下线/举报流程与 UI。
- 价格页降级逻辑（Stripe 未接入时的按钮状态）。
- 进一步的回调监控/告警：便于尽早发现回调未达。

## 10. 预发验证清单
1) 登录/注册：邮箱+密码，注册成功自动登录。
2) 生成：/zh/generate 上传小图，提交成功返回 `task_id` 并提示“预览生成中”。
3) 我的资产：/zh/my-assets 出现任务卡片，状态由 processing→success；
   - 若已落库：出现“查看详情”；
   - 若未落库且供应商直链为 GLB：页面内在线预览可用；非 GLB 显示“临时下载”。
4) 详情页按需格式：点击 GLB/OBJ/STL/FBX 触发 `POST /renditions` → 轮询 `GET /renditions`，就绪后下载 200；未就绪 409。

---

如需支持邮件沟通供应商的说明模板（回调未达与直链 403），可参考：
- 回调 URL：`https://<域名>/api/hitem3d/callback`，请求对方确认是否需要白名单/签名；
- 403 下载：我们已附带 Referer/Origin（资源 origin）与 UA，仍遇到 403，请告知是否需要额外头（Appid/Cookie/签名）与直链有效期策略。

> 注：本交接涵盖代码与配置的“现状”与“已知限制”。下一步可按“下一步建议”逐项推进，以打通端到端体验与可观测性。
