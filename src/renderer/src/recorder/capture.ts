const MIME_TYPE_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

export function selectRecordingMimeType(): string {
  const mimeType = MIME_TYPE_CANDIDATES.find((candidate) =>
    MediaRecorder.isTypeSupported(candidate)
  )
  if (!mimeType) throw new Error('This device cannot create a supported WebM recording.')
  return mimeType
}

function createSyntheticCapture(): MediaStream {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const context = canvas.getContext('2d')

  if (!context) throw new Error('Unable to create the test capture surface.')

  let frame = 0
  let animationFrame = 0
  const draw = (): void => {
    frame += 1
    context.fillStyle = '#eef3ef'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#172019'
    context.font = '600 46px system-ui'
    context.fillText('TaskTape test workflow', 72, 110)
    context.fillStyle = '#176b4b'
    context.fillRect(72, 180, 380 + (frame % 120), 38)
    context.fillStyle = '#d8dfda'
    context.fillRect(72, 250, 720, 30)
    context.fillRect(72, 310, 540, 30)
    animationFrame = requestAnimationFrame(draw)
  }

  draw()
  const stream = canvas.captureStream(15)
  stream.getVideoTracks()[0]?.addEventListener('ended', () => cancelAnimationFrame(animationFrame))
  return stream
}

export async function requestCaptureStream(testMode: boolean): Promise<MediaStream> {
  if (testMode) return createSyntheticCapture()

  return navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 30, max: 30 }
    },
    audio: false
  })
}
