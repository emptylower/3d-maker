export const dynamic = 'force-dynamic'
import { getUserUuid } from '@/services/user'
import { getMyAssetsOverview } from '@/services/my-assets'
import MyAssetsClient from '@/components/assets/MyAssetsClient'

export default async function MyAssetsPage() {
  const user_uuid = await getUserUuid()

  if (!user_uuid) {
    return (
      <div className="container py-10" data-testid="page-my-assets">
        <h1 className="text-2xl font-semibold mb-2">我的资产</h1>
        <p className="text-sm text-muted-foreground">
          请先登录后查看你的 3D 资产与生成任务。
        </p>
      </div>
    )
  }

  const { tasks, assets } = await getMyAssetsOverview(user_uuid, 1, 50)

  return (
    <div className="container py-10" data-testid="page-my-assets">
      <MyAssetsClient initialTasks={tasks} initialAssets={assets} />
    </div>
  )
}
