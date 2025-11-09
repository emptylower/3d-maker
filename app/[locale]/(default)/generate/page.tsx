export const dynamic = 'force-static'
import GeneratePanel from '@/components/generator/GeneratePanel'

export default function GeneratePage() {
  return (
    <div className="container py-12" data-testid="page-generate">
      {/* Hero */}
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="hero-brand text-4xl md:text-6xl font-extrabold tracking-wider">
          AI3DMARK
        </div>
        <p className="mt-3 text-base md:text-xl text-muted-foreground max-w-3xl">
          AI驱动的3D模型生成器
        </p>
        <p className="mt-2 text-sm md:text-lg text-muted-foreground max-w-4xl">
          体验次世代3D建模——Ultra3D 的高效性与 Sparc3D 的精准度深度融合，
          在无缝工作流中实现前所未有的速度与保真度。
        </p>
      </div>

      <GeneratePanel />
    </div>
  )
}
