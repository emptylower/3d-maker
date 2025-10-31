# 环境变量与密钥管理

> 注意：以下值在 Vercel/Supabase 控制台中配置，严禁提交到仓库。

## 核心环境变量（Vercel）
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY（仅服务端使用）
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- ADMIN_EMAIL = lijianjie@koi.codes
- HITEM3D_BASE_URL = https://api.hitem3d.ai
- HITEM3D_CLIENT_ID（来自 Hitem3D Access Key）
- HITEM3D_CLIENT_SECRET（来自 Hitem3D Secret Key）

## 配置建议
- 在 Vercel 的 Project Settings → Environment Variables 设置上述键值；
- 为 Preview/Production 分别配置不同的 Stripe/Supabase 项目 key；
- 本地开发使用 `.env.local`（不提交），CI 在 Vercel 或密钥管理器中注入。

