# 安全、运维与非功能规范（MVP）

## 安全
- 认证与授权：Supabase Auth JWT；后端对所有需要身份的接口验证 JWT；管理员邮箱通过 env 白名单校验。
- RLS：按 `docs/spec/db_schema.sql` 的 policy 执行；后端使用 Service Role 执行需要越权的操作（扣积分、回调写入、下架）。
- Webhook 验签：Stripe 使用官方签名校验；Hitem3D 回调建议带自定义签名/secret header。
- 限流防刷：建议 Upstash/自建 Redis + token-bucket；关键接口（任务创建、广场投稿）限制 QPS 与用户日配额。
- 输入校验：文件大小/类型校验与请求参数校验（基于 OpenAPI/Schema）。
- 日志脱敏：对 email、token、签名、回调 payload 中的敏感字段脱敏。

## 可靠性与可观测性
- 失败重试：Webhook/回调处理失败（5xx）触发重试；外部 API 超时/5xx 使用指数退避。
- 幂等：
  - Stripe 事件：依据 `event_id` 去重；
  - 任务创建：提供幂等键（可选）避免重复扣积分。
- 监控与日志：接入 Sentry 或 Vercel/Logtail；关键指标：建模成功率、平均耗时、失败原因、支付入账错误率。

## 运维与部署
- 环境：Preview（PR）、Staging（可选）、Production；环境变量严格校验（构建即失败）。
- 数据迁移：使用 Supabase migrations；每次发版前进行 dry-run。
- Cron/定时：回调优先；若需轮询，采用 Supabase Scheduler 或外部调度（避免 Vercel 无常驻任务问题）。
- 备份与保留：Postgres 每日备份；Storage 生命周期策略（临时上传清理）。

## 性能目标
- API P95 < 300ms（外部调用除外）；列表接口分页；数据库加入必要索引；前端使用缓存与增量静态化。

