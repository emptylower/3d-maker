import { getUserUuid } from '@/services/user'
import { getUserCredits, decreaseCredits, CreditsTransType } from '@/services/credit'
import { resolveCreditsCost } from '@/lib/credits/cost'
import { submitTask, Hitem3DClientError } from '@/services/hitem3d'
import { insertGenerationTask } from '@/models/generation-task'

type RequestType = 1 | 2 | 3
type ModelType = 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
type Resolution = '512' | '1024' | '1536' | '1536pro'
type FileFormat = 1 | 2 | 3 | 4

function isValidRequestType(n: number): n is RequestType {
  return n === 1 || n === 2 || n === 3
}

function isValidModel(m: string): m is ModelType {
  return m === 'hitem3dv1' || m === 'hitem3dv1.5' || m === 'scene-portraitv1.5'
}

function isValidResolution(r: string): r is Resolution {
  return r === '512' || r === '1024' || r === '1536' || r === '1536pro'
}

function isValidFormat(n: number): n is FileFormat {
  return n === 1 || n === 2 || n === 3 || n === 4
}

export async function POST(req: Request) {
  try {
    const user_uuid = await getUserUuid()
    if (!user_uuid) {
      return Response.json({ code: -1, message: 'no auth' }, { status: 401 })
    }

    const form = await req.formData()

    // request_type
    const requestTypeStr = String(form.get('request_type') || '')
    const request_typeNum = Number(requestTypeStr)
    if (!Number.isFinite(request_typeNum) || !isValidRequestType(request_typeNum)) {
      return Response.json({ code: -1, message: 'invalid request_type' }, { status: 400 })
    }
    const request_type: RequestType = request_typeNum as RequestType

    // model
    const modelStr = String(form.get('model') || '')
    if (!isValidModel(modelStr)) {
      return Response.json({ code: -1, message: 'invalid model' }, { status: 400 })
    }
    const model: ModelType = modelStr

    // resolution required for cost rules
    const resolutionStr = String(form.get('resolution') || '')
    if (!isValidResolution(resolutionStr)) {
      return Response.json({ code: -1, message: 'invalid resolution' }, { status: 400 })
    }
    const resolution: Resolution = resolutionStr

    // optional
    // face: only forward when valid range [100000, 2000000]
    const faceRaw = form.get('face')
    let face: number | undefined = undefined
    if (typeof faceRaw === 'string' && faceRaw.trim() !== '') {
      const fv = Number(faceRaw)
      if (Number.isFinite(fv) && fv >= 100000 && fv <= 2000000) {
        face = fv
      }
    }
    const formatStr = form.get('format')?.toString()
    const formatNum = formatStr !== undefined ? Number(formatStr) : undefined
    const format: FileFormat | undefined =
      formatNum !== undefined && Number.isFinite(formatNum) && isValidFormat(formatNum)
        ? (formatNum as FileFormat)
        : undefined

    const mesh_urlRaw = form.get('mesh_url')
    const mesh_url = typeof mesh_urlRaw === 'string' ? mesh_urlRaw : undefined

    // images vs multi_images (xor)
    const images = form.getAll('images')
    const multi_images = form.getAll('multi_images')

    const hasImages = images.length > 0
    const hasMulti = multi_images.length > 0
    if ((hasImages && hasMulti) || (!hasImages && !hasMulti)) {
      return Response.json({ code: -1, message: 'invalid images: images or multi_images required exclusively' }, { status: 400 })
    }

    // request_type=2 requires mesh_url
    if (request_type === 2 && !mesh_url) {
      return Response.json({ code: -1, message: 'mesh_url required when request_type=2' }, { status: 400 })
    }

    // compute credits cost
    const credits_cost = resolveCreditsCost({ model, request_type, resolution })

    // check user credits balance
    const userCredits = await getUserCredits(user_uuid)
    const left = userCredits?.left_credits || 0
    if (left < credits_cost) {
      return Response.json({ code: 2000, message: 'INSUFFICIENT_CREDITS' })
    }

    // map files to service input
    const toFilePayload = async (f: any) => {
      // f expected to be File from formData
      const file = f as File
      const content = new Uint8Array(await file.arrayBuffer())
      const payload = { filename: file.name || 'file.bin', content, contentType: file.type || 'application/octet-stream' }
      return payload
    }

    const svcInput: any = {
      request_type,
      model,
      resolution,
      face,
      format,
      mesh_url,
    }
    if (hasImages) {
      svcInput.images = await Promise.all(images.map(toFilePayload))
    } else if (hasMulti) {
      svcInput.multi_images = await Promise.all(multi_images.map(toFilePayload))
    }

    // 1B) submit to hitem3D first
    const submitRes = await submitTask(svcInput)
    const task_id = submitRes.task_id

    // then decrease credits
    await decreaseCredits({ user_uuid, trans_type: CreditsTransType.Generate3D, credits: credits_cost })

    // and write generation task (state=created)
    try {
      await insertGenerationTask({
        task_id,
        user_uuid,
        request_type,
        model_version: model,
        resolution,
        face: typeof face === 'number' && Number.isFinite(face) ? (face as number) : undefined,
        format,
        state: 'created',
        credits_charged: credits_cost,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (e) {
      // swallow for now; route should still succeed to return task_id
      console.error('insert generation task failed:', e)
    }

    return Response.json({ code: 0, message: 'ok', data: { task_id } })
  } catch (e: any) {
    console.error('submit failed:', e)
    const msg = e instanceof Hitem3DClientError ? e.message : 'submit failed'
    return Response.json({ code: -1, message: msg }, { status: 500 })
  }
}
