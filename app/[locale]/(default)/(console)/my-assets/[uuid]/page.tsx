import Link from 'next/link'
import { notFound } from 'next/navigation'
import AssetDetailPreview from '@/components/assets/AssetDetailPreview'
import AssetDownloadButton from '@/components/assets/AssetDownloadButton'
import { findAssetByUuid } from '@/models/asset'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ uuid: string }>
}

export default async function AssetDetailPage({ params }: Props) {
  const { uuid } = await params
  const asset = await findAssetByUuid(uuid)
  if (!asset) {
    notFound()
  }

  const title = asset.title || '未命名资产'
  const created = asset.created_at ? new Date(asset.created_at) : null
  const format = asset.file_format ? asset.file_format.toUpperCase() : undefined

  return (
    <div
      className="fixed inset-0 z-40 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50"
      data-testid="page-my-asset-detail"
    >
      <div className="flex h-full flex-col">
        {/* 顶部条：关闭按钮 + 面包屑 */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 sm:px-10">
          <Link
            href="/my-assets"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/80 bg-slate-900/70 text-slate-100 shadow-md hover:border-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="关闭详情，返回我的资产"
          >
            <span className="text-lg leading-none">&times;</span>
          </Link>
          <div className="hidden text-sm text-slate-400 sm:block">
            <span className="text-slate-500">我的资产</span>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-slate-200">{title}</span>
          </div>
        </div>

        {/* 主体：左侧大预览 + 右侧信息栏 */}
        <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-2 sm:px-10 sm:pb-10 lg:flex-row lg:items-stretch">
          <div className="flex min-h-[320px] flex-1 items-center justify-center">
            <div className="w-full max-w-5xl">
              <AssetDetailPreview assetUuid={uuid} />
            </div>
          </div>

          <div className="w-full max-w-sm shrink-0">
            <div className="flex h-full flex-col rounded-3xl bg-slate-900/80 p-5 shadow-2xl border border-slate-700/60">
              <div className="mb-3 space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                  模型详情
                </div>
                <div className="text-lg font-semibold text-slate-50 line-clamp-2">
                  {title}
                </div>
                {created && (
                  <div className="text-xs text-slate-400">
                    创建时间：{created.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="space-y-1 rounded-2xl bg-slate-800/70 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    文件格式
                  </div>
                  <div className="text-sm font-medium text-slate-50">
                    {format || '待生成'}
                  </div>
                </div>
                <div className="space-y-1 rounded-2xl bg-slate-800/70 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    访问权限
                  </div>
                  <div className="text-sm font-medium text-slate-50">仅本人可下载</div>
                </div>
              </div>

              <div className="mt-auto space-y-3 pt-2">
                <AssetDownloadButton assetUuid={uuid} />
                <p className="text-xs leading-relaxed text-slate-400">
                  下载链接为短期有效的预签名地址，仅当前登录账号可用。请勿外泄或分享给他人。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
