# 积分与计费规范（MVP）

## 注册与积分
- 注册奖励：80 积分（首次登录创建钱包时发放，幂等）

## 任务计费（消耗积分）
- 计费与分辨率无关，按模型版本计价：
  - 通用模型 v1.0：40 积分/次
  - 通用模型 v1.5：80 积分/次
  - 人像模型：60 积分/次

> 版本名映射：
> - v1.0 → `hitem3dv1`
> - v1.5 → `hitem3dv1.5`
> - 人像 → `scene-portraitv1.5`

- 策略：创建任务前先扣积分；若任务最终失败，自动原路退回（写负向流水）。

## Stripe 套餐映射
- plus：$10 → 200 积分
- pro：$20 → 800 积分
- pro Max：$100 → 4500 积分

> Webhook 幂等：同一事件仅入账一次，按 `stripe_events.event_id` 去重。

## 服务实现建议
- 服务端函数 `calculateRequiredCredits(model: string): number`：
  - `hitem3dv1` → 40
  - `hitem3dv1.5` → 80
  - `scene-portraitv1.5` → 60
  - 未知模型：返回错误（400）

- 任务失败退款：
  - 回调/轮询判断 `failed` 时：创建 ledger 记录 `delta = +requiredCredits, reason = refund, external_ref = task_id`，并将 `wallet.balance += requiredCredits`；保证事务一致性。

