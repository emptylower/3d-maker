# 回调与兜底轮询（Supabase Scheduler）

## 回调优先
- Hitem3D 回调路径：`POST /api/modeling/callback`
- 校验：建议在 header 中携带自定义签名/secret，服务端验证后再入库。
- 行为：
  - 成功：更新 `model_tasks.status = succeeded`，写入 `hitem_model_urls`
  - 失败：更新 `status = failed`，执行退款事务（wallet + ledger）

## 兜底轮询（启用）
- 场景：回调未达、网络抖动或回调失败需重试时。
- 平台：Supabase Scheduler（或 Edge Functions 定时触发）。
- 任务：
  - 周期：每 5 分钟
  - 扫描条件：`status in ('pending','processing') and updated_at < now() - interval '10 minutes'`
  - 动作：调用 `query-task` 获取最新状态，同“回调优先”流程更新；失败按退款策略执行。
- 速率限制：
  - 单批最多处理 200 条；对 Hitem3D API 使用并发池（例如 10 并发）；
  - 对相同 `hitem_task_id` 的重复查询需间隔 ≥ 2 分钟
- 失败重试：指数退避（1m, 2m, 5m, 10m），最大 5 次。

## 监控与告警
- 指标：待处理任务数、超时任务数、查询失败率、平均完成时长。
- 告警：超过阈值发送到 Slack/邮件（可后续接入）。

