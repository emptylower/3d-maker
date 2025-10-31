# Hitem3D 建模广场 MVP 实施计划

## 目标范围
- **部署**：使用 Vercel 承载 Next.js 应用，后端 API 通过 Next.js Route/Edge Function 实现。
- **存储**：Supabase Postgres 作为主数据库，Supabase Storage 保存上传图片等展示资源。
- **认证**：Supabase Auth 支持邮箱注册/登录；注册自动发放基础积分。
- **积分体系**：积分来源包括注册赠送与 Stripe 付费购买，所有扣减记录写入流水。
- **建模流程**：前端上传图像 → 后端获取 Token → 调用 Hitem3D 创建任务 → 回调/轮询查询 → 保存生成的 `.glb/.obj` 链接并供 Three.js 预览。
- **广场功能**：匿名可浏览，登录用户可分享建模成果；管理员（指定邮箱）可下架展示内容。

## 系统架构
- **前端层**：Next.js + React（SWR/React Query），Three.js 或 React Three Fiber 实现 3D 预览；Playwright 负责端到端测试。
- **后端层**：Next.js API Route 提供用户、积分、建模、广场、管理接口；封装 Hitem3D API（获取 token、创建任务、查询任务）。
- **数据层**：
  - `users`、`profiles`、`credits_wallet`、`credits_ledger`、`model_tasks`、`model_assets`、`showcase_posts`、`stripe_events`、`admin_flags` 等表。
  - Storage 存储上传图片、可选的模型封面；模型源文件由 Hitem3D 托管，仅引用其 URL。
- **第三方服务**：Stripe Checkout（积分购买）、Hitem3D API、Supabase Auth/Storage/Postgres。

## 核心数据模型（关键字段）
| 表名 | 关键字段 |
| --- | --- |
| `users` | `id`, `email`, `created_at` |
| `profiles` | `user_id`, `display_name`, `avatar_url`, `role`（`user`/`admin`） |
| `credits_wallet` | `user_id`, `balance`, `updated_at` |
| `credits_ledger` | `id`, `user_id`, `delta`, `reason`, `external_ref`, `created_at` |
| `model_tasks` | `id`, `user_id`, `status`, `hitem_task_id`, `request_payload`, `hitem_model_urls`, `created_at` |
| `model_assets` | `id`, `task_id`, `asset_type`, `url`, `metadata`, `expires_at` |
| `showcase_posts` | `id`, `task_id`, `title`, `description`, `asset_url`, `status`, `created_at` |
| `stripe_events` | `event_id`, `payload`, `processed_at` |
| `admin_flags` | `id`, `admin_user_id`, `target_type`, `target_id`, `action`, `reason`, `created_at` |

## 关键业务流程
1. **注册/登录**：通过 Supabase Auth 完成邮箱注册，服务层负责创建积分钱包并发放注册奖励（幂等处理）。
2. **积分购买**：前端创建 Stripe Checkout Session → 支付完成后由 Webhook 更新 `credits_wallet` 与 `credits_ledger`，避免重复处理。
3. **建模任务**：
   - 上传图片到 Supabase Storage，服务端检查积分余额并扣减。
   - 调用 Hitem3D API：缓存 token（有效期 24 小时）、创建任务、记录返回的 `task_id`。
   - 任务完成：优先依赖 `callback_url`；如无回调则定时轮询 `query-task`；失败自动退回积分。
4. **模型展示**：成功任务可发布为广场帖子，仅展示 Hitem3D 返回的 `.glb/.obj`，Three.js 前端加载。
5. **广场与管理**：匿名浏览、登录发布；管理员通过唯一邮箱登录管理面板，可下架内容。

## 里程碑与测试策略（测试先行）
| 里程碑 | 主要内容 | 测试优先项 | 可独立交付的成果 |
| --- | --- | --- | --- |
| **M0** 项目骨架 | Next.js + TypeScript + CI/CD（Vercel Preview） | 构建流程/环境检查单测 | 基础项目可部署，CI 通过 |
| **M1** 用户 & 注册积分 | Supabase Auth 集成、注册钱包与积分赠送 | 服务层单测（注册幂等）、Playwright 登录流程 | 可注册/登录，注册即有积分 |
| **M2** 积分购买 | Stripe Checkout + Webhook，积分流水 | Stripe Webhook 单测、余额变更集成测 | 可支付并充值积分，流水记录完整 |
| **M3** Hitem3D API 封装 | Token 缓存、任务提交/查询适配 | Mock Hitem3D 的服务单测、错误码覆盖 | 具备可靠的 API 客户端模块 |
| **M4** 建模下单流程 | 上传、扣积分、创建任务、回调/轮询、失败退款 | 端到端自动化（mock Hitem3D） | 用户可提交建模任务并跟踪状态 |
| **M5** Three.js 预览 | 3D 模型加载组件、错误处理 | 组件单测、Playwright 渲染校验 | 页面可预览 `.glb/.obj`，失败有提示 |
| **M6** 广场功能 | 帖子发布、列表、详情、管理员下架 | API 单测、发布/下架 e2e | 用户可分享作品，管理员可下架 |
| **M7** 运维与监控 | Supabase RLS、安全、日志监控 | 压测脚本、告警演练 | Preview/Production 环境可控，监控上线 |

> 每个里程碑均遵循：**先编写测试 → 实现业务 → 回归测试 → 手动验收**。未通过测试不得合并到主干或部署。

## 测试体系
- **单元测试**：服务模块、积分计算、Hitem3D API 适配器等。
- **集成测试**：Mock Stripe/Hitem3D，验证流程完整性。
- **端到端测试**：Playwright 覆盖注册、购买、建模提交、广场发布与浏览。
- **性能/安全测试**：关键接口压测（建模提交、广场列表），文件大小与鉴权校验。
- **CI/CD**：所有测试在 CI 中执行；部署到 Preview 前必须绿灯。

## 风险与后续关注
- **Hitem3D 资源有效期**：官方返回的模型 URL 若短期失效，需增加迁移至自有存储的异步任务。
- **长任务调度**：Vercel 无常驻定时任务，可使用 Supabase Scheduler/外部任务服务定期轮询。
- **支付异常**：Stripe 事件去重与重试机制需到位，避免积分错发。
- **管理员权限**：唯一管理员邮箱存放于环境变量，后续若扩展需调整角色体系。
- **扩展能力**：后续可添加多语言、更多展示形式（截图/视频）、积分等级等。

---

如需调整或补充，请更新此文档并通知相关团队成员。*** End Patch
