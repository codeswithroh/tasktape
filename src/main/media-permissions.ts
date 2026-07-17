export function isAllowedMediaRequest(
  permission: string,
  mediaTypes: string[] | undefined
): boolean {
  if (permission === 'display-capture') return true
  if (permission !== 'media' || !mediaTypes) return false

  // Electron 43 reports getDisplayMedia as media with no camera or microphone type.
  return mediaTypes.length === 0 || (mediaTypes.length === 1 && mediaTypes[0] === 'audio')
}
