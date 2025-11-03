export function buildAssetKey({
  user_uuid,
  asset_uuid,
  filename,
}: {
  user_uuid: string
  asset_uuid: string
  filename: string
}) {
  if (!user_uuid || !asset_uuid || !filename) {
    throw new Error('INVALID_PARAMS')
  }
  return `assets/${user_uuid}/${asset_uuid}/${filename}`
}

