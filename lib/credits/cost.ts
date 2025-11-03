export type CreditsInput = {
  model: 'hitem3dv1' | 'hitem3dv1.5' | 'scene-portraitv1.5'
  request_type: 1 | 2 | 3 // 1: geometry only; 2: texture; 3: geo+tex
  resolution: '512' | '1024' | '1536' | '1536pro'
}

// Map of [version|resolution|texture] -> credits
const RULES: Record<string, number> = {
  // V1.0
  'V1.0|512|no': 5,
  'V1.0|512|yes': 15,
  'V1.0|1024|no': 10,
  'V1.0|1024|yes': 20,
  'V1.0|1536|no': 40,
  'V1.0|1536|yes': 50,

  // V1.5
  'V1.5|512|no': 5,
  'V1.5|512|yes': 15,
  'V1.5|1024|no': 10,
  'V1.5|1024|yes': 20,
  'V1.5|1536|no': 40,
  'V1.5|1536|yes': 50,
  'V1.5|1536pro|no': 60,
  'V1.5|1536pro|yes': 70,

  // Portrait (only 1536 supported per docs)
  '人像|1536|no': 40,
  '人像|1536|yes': 50,
}

function modelToVersion(model: CreditsInput['model']): 'V1.0' | 'V1.5' | '人像' {
  if (model === 'hitem3dv1') return 'V1.0'
  if (model === 'hitem3dv1.5') return 'V1.5'
  return '人像'
}

function isTexture(request_type: CreditsInput['request_type']): boolean {
  // request_type=1 => geometry only => no texture; 2 or 3 imply texture processing
  return request_type !== 1
}

export function resolveCreditsCost(input: CreditsInput): number {
  const version = modelToVersion(input.model)
  const texture = isTexture(input.request_type) ? 'yes' : 'no'

  // Portrait model supports only 1536 resolution according to docs
  if (version === '人像' && input.resolution !== '1536') {
    throw new Error('UNDEFINED_RULE: portrait model only supports 1536 resolution')
  }

  const key = `${version}|${input.resolution}|${texture}`
  const cost = RULES[key]
  if (typeof cost !== 'number') {
    throw new Error('UNDEFINED_RULE: no matching credits rule')
  }
  return cost
}

