interface Props { params: Promise<{ slug: string }> }

export const dynamic = 'force-dynamic'

export default async function PlazaDetailPage({ params }: Props) {
  const { slug } = await params
  return (
    <div className="container py-10" data-testid="page-plaza-detail">
      <h1 className="text-2xl font-semibold mb-2">广场详情</h1>
      <p className="text-muted-foreground">作品：{slug}</p>
    </div>
  )
}

