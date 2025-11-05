export const dynamic = 'force-static'
import GenerateForm from '@/components/generator/GenerateForm'

export default function GeneratePage() {
  return (
    <div className="container py-10" data-testid="page-generate">
      <h1 className="text-2xl font-semibold mb-4">创作 3D 模型</h1>
      <p className="text-muted-foreground mb-6">上传图片，选择参数，一键生成可预览的基础模型。</p>
      <GenerateForm />
    </div>
  )
}
