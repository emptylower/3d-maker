interface Props { params: Promise<{ uuid: string }> }

export const dynamic = 'force-dynamic'
import RenditionsPanel from '@/components/assets/RenditionsPanel'
import AssetAutoPreviewOBJ from '@/components/assets/AssetAutoPreviewOBJ'
import AssetAutoPreviewSTL from '@/components/assets/AssetAutoPreviewSTL'

export default async function AssetDetailPage({ params }: Props) {
  const { uuid } = await params
  return (
    <div className="container py-10" data-testid="page-my-asset-detail">
      <h1 className="text-2xl font-semibold mb-2">资产详情</h1>
      <p className="text-muted-foreground mb-4">资产 ID：{uuid}</p>

      <div className="mb-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">OBJ 预览（含纹理任务）</h2>
          <AssetAutoPreviewOBJ assetUuid={uuid} />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">STL 预览（纯几何任务）</h2>
          <AssetAutoPreviewSTL assetUuid={uuid} />
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-2">格式生成与下载</h2>
      <RenditionsPanel assetUuid={uuid} />
    </div>
  )
}
