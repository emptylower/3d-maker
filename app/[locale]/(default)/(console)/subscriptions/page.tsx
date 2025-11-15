import { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function SubscriptionsPage(): ReactNode {
  return (
    <div className="container py-10" data-testid="page-subscriptions">
      <h1 className="text-2xl font-semibold mb-2">订阅管理</h1>
      <p className="text-sm text-muted-foreground">
        本站还处于内测阶段，暂不开放充值，可免费使用。
      </p>
    </div>
  )
}

