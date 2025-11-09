export const dynamic = 'force-static'
import GeneratePanel from '@/components/generator/GeneratePanel'

export default function GeneratePage() {
  return (
    <div className="container py-12" data-testid="page-generate">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
          Hitem3D - AI驱动的3D模型生成器
        </h1>
        <p className="mt-3 text-base md:text-xl text-muted-foreground max-w-4xl">
          体验次世代3D建模——Ultra3D的高效性与Sparc3D的精准度深度融合，在无缝工作流中实现前所未有的速度与保真度。
        </p>
      </div>

      <GeneratePanel />
    </div>
  )
}
