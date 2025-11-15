import { getUserInfo } from '@/services/user'
import { getSupabaseClient } from '@/models/db'

function isAdmin(email?: string | null) {
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!email) return false
  return admins.includes(email)
}

type AssetRow = {
  uuid: string
  user_uuid: string
  task_id: string | null
  status?: string | null
  file_key_full?: string | null
  created_at?: string | null
}

export async function POST(req: Request) {
  try {
    const user = await getUserInfo()
    const email = (user as any)?.email as string | undefined
    if (!isAdmin(email)) {
      return Response.json({ code: -1, message: 'forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const dryRun = url.searchParams.get('dry_run') === '1'

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('assets')
      .select('uuid,user_uuid,task_id,status,file_key_full,created_at')
      .order('created_at', { ascending: true })

    if (error) {
      return Response.json(
        { code: -1, message: `fetch assets failed: ${error.message}` },
        { status: 500 },
      )
    }

    const rows = (data || []) as AssetRow[]

    const groups = new Map<string, AssetRow[]>()

    for (const row of rows) {
      if (!row.task_id) continue
      if (row.status && row.status !== 'active') continue
      const key = `${row.user_uuid}|${row.task_id}`
      const arr = groups.get(key)
      if (arr) {
        arr.push(row)
      } else {
        groups.set(key, [row])
      }
    }

    let groupsWithDuplicates = 0
    const duplicates: string[] = []

    for (const [, assets] of groups) {
      if (assets.length <= 1) continue
      groupsWithDuplicates += 1

      const sorted = [...assets].sort((a, b) => {
        const aHasFile = !!a.file_key_full
        const bHasFile = !!b.file_key_full
        if (aHasFile && !bHasFile) return -1
        if (!aHasFile && bHasFile) return 1
        const at = a.created_at || ''
        const bt = b.created_at || ''
        if (at < bt) return -1
        if (at > bt) return 1
        return a.uuid < b.uuid ? -1 : 1
      })

      const keep = sorted[0]
      for (const extra of sorted.slice(1)) {
        if (extra.uuid !== keep.uuid) {
          duplicates.push(extra.uuid)
        }
      }
    }

    let updatedCount = 0
    if (!dryRun && duplicates.length > 0) {
      const { error: updateError } = await supabase
        .from('assets')
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString(),
        })
        .in('uuid', duplicates)

      if (updateError) {
        return Response.json(
          { code: -1, message: `mark duplicates failed: ${updateError.message}` },
          { status: 500 },
        )
      }
      updatedCount = duplicates.length
    } else {
      updatedCount = duplicates.length
    }

    return Response.json({
      code: 0,
      data: {
        dry_run: dryRun,
        groups_with_duplicates: groupsWithDuplicates,
        duplicates_found: duplicates.length,
        duplicates_marked_deleted: dryRun ? 0 : updatedCount,
      },
    })
  } catch (e: any) {
    const msg = e?.message || 'cleanup failed'
    return Response.json({ code: -1, message: msg }, { status: 500 })
  }
}

