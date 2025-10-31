export const metadata = {
  title: 'Hitem3D 建模广场',
  description: 'Next.js + Supabase + Stripe MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
