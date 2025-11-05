export const dynamic = 'force-dynamic'
import { getUserUuid } from '@/services/user'
import { listGenerationTasks } from '@/models/generation-task'
import TaskStatus from '@/components/assets/TaskStatus'

export default async function MyAssetsPage() {
  const user_uuid = await getUserUuid()
  let tasks: any[] = []
  if (user_uuid) {
    // 简单拉取最近的任务（按创建时间倒序），这里服务端不做用户过滤的版本我们先取全部再前端过滤
    const all = await listGenerationTasks(1, 50)
    tasks = all.filter((t: any) => t.user_uuid === user_uuid)
  }
  return (
    <div className="container py-10" data-testid="page-my-assets">
      <h1 className="text-2xl font-semibold mb-2">我的资产</h1>
      <p className="text-muted-foreground mb-6">查看、预览与下载你生成的 3D 模型。GLB 可在线预览。</p>

      {(!tasks || tasks.length === 0) && (
        <div className="text-sm text-muted-foreground">暂无生成记录。去“创作”上传图片开始生成。</div>
      )}

      <div className="grid gap-4">
        {tasks.map((t) => (
          <div key={t.task_id} className="border rounded-md p-4">
            <div className="text-sm text-muted-foreground">任务ID：{t.task_id}</div>
            <div className="mt-1">模型：{t.model_version}，分辨率：{t.resolution}，类型：{t.request_type}</div>
            <div className="mt-2">
              <TaskStatus taskId={t.task_id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
