interface Props { params: Promise<{ uuid: string }> }

export const dynamic = 'force-dynamic'
import RenditionsPanel from '@/components/assets/RenditionsPanel'
import AssetAutoPreviewGLB from '@/components/assets/AssetAutoPreviewGLB'

export default async function AssetDetailPage({ params }: Props) {
  const { uuid } = await params
  return (
    <div className="container py-10" data-testid="page-my-asset-detail">
      <h1 className="text-2xl font-semibold mb-2">资产详情</h1>
      <p className="text-muted-foreground mb-4">资产 ID：{uuid}</p>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">GLB 预览</h2>
        <AssetAutoPreviewGLB assetUuid={uuid} />
      </div>

      <h2 className="text-lg font-semibold mb-2">格式生成与下载</h2>
      <RenditionsPanel assetUuid={uuid} />
    </div>
  )
}
