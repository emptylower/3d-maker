# 实施步骤（测试先行）— Hitem3D 建模广场 MVP

本计划分阶段落地，严格遵循：先测试、后实现、再回归。在实现过程中，凡遇到不明确之处必须先与您确认，禁止擅自决定。

## 1. 约束与已知信息
- 部署：Vercel（Next.js 全栈）
- 数据库：Supabase Postgres（含 RLS），Storage 用于图片等资源
- 认证：Supabase Auth（邮箱注册/登录）
- 支付：Stripe Checkout + Webhook
- 3D 预览：Three.js/React Three Fiber，加载 Hitem3D 返回的 `.glb/.obj`（不提供下载）
- 管理员：唯一邮箱白名单（通过 env 配置）
- 广场：匿名可浏览，登录用户可发布；前期不做审核，管理员可下架

## 2. 参数确认结果（已确定）
- 注册奖励积分：80
- 建模任务扣减：v1.0=40/次；v1.5=80/次；人像=60/次（与分辨率无关）
- Stripe 套餐：plus($10)=200；pro($20)=800；pro Max($100)=4500
- 管理员邮箱：lijianjie@koi.codes（唯一管理员）
- 任务失败：自动全额退还
- 兜底轮询：启用 Supabase Scheduler
- Hitem3D 凭据：以环境变量方式提供（不入库不写仓库）

## 3. 里程碑总览
- M0 项目骨架与环境/CI
- M1 用户认证与注册积分
- M2 积分购买（Stripe）
- M3 Hitem3D API 适配与 Token 缓存
- M4 建模下单流程（上传/扣分/提交/回调/退款）
- M5 Three.js 预览组件与详情页
- M6 广场（发布/列表/详情）与管理员下架
- M7 运维与监控（RLS 校验、告警、压测）

> 每个里程碑均要求：先编写测试 → 实现业务 → 回归测试 → 生成可验证的交付物；可单独上线试运行。

---

## M0 项目骨架与环境/CI（可测试）
目标：建立可部署的 Next.js 项目与 CI 流水线，完成基础健康检查。

- 需要确认：无
- 测试优先
  - 单测：环境变量校验器（缺失关键 env 时构建失败）
  - e2e：/healthz 返回 200
- 实现步骤
  1) 初始化 Next.js + TypeScript；配置 ESLint/Prettier；添加 `/api/healthz`
  2) CI：Node 版本、安装、type-check、lint、单测、OpenAPI 验证（若存在）、构建
  3) Vercel 项目创建，设置环境变量占位（见“统一配置”）
- 验收标准
  - PR 触发 CI 全绿；预览环境可访问 `/api/healthz` 返回 200

## M1 用户认证与注册积分（可测试）
目标：接入 Supabase Auth，注册自动创建钱包并发放奖励积分（幂等）。

- 已确认：注册奖励积分=80
- 测试优先
  - 单测：注册流程服务层（创建钱包 + 发放积分，重复调用不重复发放）
  - 集成：调用 Supabase SDK 模拟用户注册/登录流程（使用测试项目/本地容器）
  - e2e：注册→登录→查看“我的积分”
- 实现步骤
  1) 连接 Supabase（URL/anon key），准备 Service Role key（仅服务端使用）
  2) 执行 `docs/spec/db_schema.sql` 初始化表与 RLS
  3) Auth callback：用户首次登录时写入 `profiles`、`credits_wallet`
  4) 注册奖励：写 `credits_ledger` 并 `wallet.balance += 奖励`
  5) 前端：登录/退出，个人页显示余额与流水列表
- 验收标准
  - 新用户登录后钱包余额 = 注册奖励；再次登录不重复发放；流水记录准确

## M2 积分购买（Stripe）（可测试）
目标：支持 Stripe Checkout 购买积分，Webhook 入账一次且可重试。

- 已确认：plus=$10/200；pro=$20/800；pro Max=$100/4500
- 测试优先
  - 单测：Webhook 处理函数（签名校验、事件幂等、余额入账）
  - 集成：创建 Checkout Session API 返回有效 URL；Webhook 模拟事件一次入账
  - e2e：从前端发起购买→支付（测试卡）→回到站点余额增加
- 实现步骤
  1) 后端 `POST /api/credits/checkout-session`：根据 package_id 创建 Session
  2) Webhook `/api/stripe/webhook`：验签→去重（`stripe_events`）→入账并记账
  3) 前端：积分中心页面、购买按钮、支付完成状态页
- 验收标准
  - 同一事件多次推送仅入账一次；余额与流水正确

## M3 Hitem3D API 适配与 Token 缓存（可测试）
目标：实现 Hitem3D 客户端（get-token/create-task/query-task），提供 token 缓存。

- 已确认：凭据走环境变量（Vercel 项目配置），不写仓库
- 测试优先
  - 单测：getToken 24h 缓存、过期刷新；错误码映射（参考提取文档）
  - 集成：mock Hitem3D API，覆盖 200/4xx/5xx、超时重试
- 实现步骤
  1) 模块 `hitem3dClient`：
     - getToken：Basic base64(client_id:client_secret)
     - submitTask：按 `docs/spec/api.openapi.yaml` 约定的数据结构转换为 Hitem3D 参数
     - queryTask：按 task_id 获取状态
  2) Token 缓存：新增 `api_tokens`（或复用 DB KV），字段：provider, token, expires_at
  3) 规范错误码：将 Hitem3D 错误码映射为本系统错误（含“余额不足”提示联动）
- 验收标准
  - 测试证明 token 复用与过期刷新正确；错误码分支完善

## M4 建模下单流程（上传/扣分/提交/回调/退款）（可测试）
目标：完整闭环，失败自动退款（需您确认策略）。

- 已确认：
  - 扣分策略：v1.0=40/次；v1.5=80/次；人像=60/次
  - 失败自动全额退还
  - 启用 Supabase Scheduler 兜底轮询
- 测试优先
  - 单测：扣分事务（异常回滚）、退款流水、状态机（pending→processing→succeeded/failed）
  - 集成：mock Hitem3D submit/query/callback；覆盖失败与重试
  - e2e：上传→扣分→创建任务→回调/轮询更新→成功展示；失败后余额回补
- 实现步骤
  1) 上传：前端直传 Supabase Storage（限大小/格式），得到公共/签名 URL
  2) 后端 `POST /api/modeling/tasks`：
     - 校验登录与参数
     - 事务：检查余额≥需求 → 扣余额 + 记 ledger → 提交任务
     - 成功：落库 `model_tasks`（status=pending/processing），返回任务对象
  3) 回调 `/api/modeling/callback`：更新任务状态与 `hitem_model_urls`；失败时退积分并记负向流水
  4) 兜底轮询（可选）：Scheduler 定时 `query-task` 对超时任务进行刷新
- 验收标准
  - 正常成功链路打通；失败链路自动退款；并发提交不超扣

## M5 Three.js 预览与详情（可测试）
目标：在详情页加载 `.glb/.obj`，失败时提示。

- 需要确认：是否需要列表卡片封面图（可后续）
- 测试优先
  - 组件单测：加载成功/失败分支；loading/fallback
  - e2e：打开任务详情或帖子详情进行 3D 预览
- 实现步骤
  1) `<ModelViewer>` 组件：支持 glb/obj，OrbitControls，错误捕获
  2) 任务详情页/帖子详情页：读取 asset_url/模型链接并渲染
- 验收标准
  - 真实 glb/obj 能正常渲染；失败时有 fallback UI

## M6 广场与管理员下架（可测试）
目标：发布、列表、详情、下架。

- 需要确认：列表排序（时间倒序/热门），是否需要搜索/筛选（MVP 可不做）
- 测试优先
  - 单测：帖子 CRUD、状态流转
  - e2e：匿名浏览列表/详情；登录用户发布；管理员下架后列表不显示
- 实现步骤
  1) `POST /api/showcase/posts`（登录）：从成功任务选择或直接贴 asset_url
  2) `GET /api/showcase/posts`（公开）：分页列表，仅 `published`
  3) `GET /api/showcase/posts/{id}`（公开）：详情
  4) `DELETE /api/showcase/posts/{id}`（管理员）：下架，记录原因
  5) 前端页面：广场列表、详情、发布表单、管理员面板
- 验收标准
  - 流程可闭环；非管理员无法下架；被下架帖子对外不可见

## M7 运维与监控（可测试）
目标：RLS 校验、告警、压测，达到上线标准。

- 需要确认：监控/日志平台（Sentry/Logtail）
- 测试优先
  - 脚本：k6/artillery 对建模与列表接口压测
  - 安全：仅本人资源可读写；Webhook 验签；限流策略
- 实现步骤
  1) 接入日志与错误上报；关键指标埋点
  2) 压测分析并调优索引/分页/缓存
  3) 环境与回滚预案文档化
- 验收标准
  - 压测达标；安全策略生效；报警可用

---

## 统一配置与环境变量清单
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY（仅服务端）
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- ADMIN_EMAIL（管理员唯一邮箱）
- HITEM3D_BASE_URL（默认 https://api.hitem3d.ai）
- HITEM3D_CLIENT_ID / HITEM3D_CLIENT_SECRET（获取 token）

> 缺失以上任一关键变量，构建/启动即失败（M0 测试覆盖）。

## 风险与对策
- Hitem3D 资源有效期：若后续发现过期，考虑异步迁移到自有存储（非 MVP）。
- Vercel 无常驻定时：回调优先；若需轮询，使用 Supabase Scheduler。
- 资金与账务：Stripe 事件幂等与回滚必须到位；账务数据写入后不可修改，仅追加流水。

## Definition of Done（跨里程碑）
- 每个里程碑包含：测试代码、实现代码、文档更新、可验证的演示路径（URL 或脚本）
- PR 必须通过：lint、type-check、单元/集成/端到端、OpenAPI 校验、SQL 迁移 dry-run
- 生产变更须附上线/回滚步骤

---

如需修改流程或参数，请直接在“待确认清单”中批注或回复，我会据此更新实现与测试计划。
