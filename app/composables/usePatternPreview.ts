// The "Preview" state machine shared by the Pattern library and the
// chat's @jah code cards (add-jah-code-cards, design decision 3),
// extracted unchanged from the library page. It sits over the
// `audioEngine` module singleton, so "one preview at a time" holds across
// every user of it on a page.
//
// Options (both absent in the library, which keeps its old behaviour):
//  - `beforeStart` awaited after the audio engine is ready and before the
//    snippet is evaluated. The room uses it to stop the room's playback for
//    everyone first, so nobody drifts out of sync with the room.
//  - `maxMs` stops the preview by itself this long after it STARTED
//    PLAYING — the timer begins once evaluation has resolved, so a slow
//    sample download doesn't eat the window.

type AudioEngine = typeof import('~/lib/audioEngine')

export interface PatternPreviewOptions {
  beforeStart?: () => Promise<void> | void
  maxMs?: number
}

export function usePatternPreview(options: PatternPreviewOptions = {}) {
  /** Id of the card/pattern currently playing, or null. */
  const previewingId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<{ id: string, message: string } | null>(null)

  let audio: AudioEngine | undefined
  let audioLoad: Promise<AudioEngine> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  // Load the (heavy) Strudel bundle and register the audio-unlock click
  // listener as soon as the user shows intent to preview. Doing it before
  // the Preview click means initAudioOnFirstClick() is armed before the
  // click that would satisfy it, same reasoning as the JAM room's
  // primeAudio() call.
  function preload(): Promise<AudioEngine> {
    audioLoad ??= import('~/lib/audioEngine').then((m) => {
      audio = m
      m.primeAudio()
      return m
    })
    return audioLoad
  }

  /** Ends any running preview. Safe to call when nothing is playing. */
  async function stop() {
    clearTimeout(timer)
    timer = undefined
    previewingId.value = null
    await audio?.stopPreview()
  }

  async function toggle(id: string, code: string) {
    error.value = null
    if (previewingId.value === id) {
      await stop()
      return
    }
    loading.value = true
    try {
      const engine = await preload()
      await options.beforeStart?.()
      clearTimeout(timer)
      await engine.stopPreview()
      const err = await engine.evaluatePreview(code)
      if (err) {
        error.value = { id, message: err }
        previewingId.value = null
      }
      else {
        previewingId.value = id
        if (options.maxMs) {
          timer = setTimeout(() => {
            if (previewingId.value === id) void stop()
          }, options.maxMs)
        }
      }
    }
    catch (e) {
      error.value = { id, message: (e as Error).message }
    }
    finally {
      loading.value = false
    }
  }

  onBeforeUnmount(() => {
    clearTimeout(timer)
    audio?.stopPreview()
  })

  return { previewingId, loading, error, preload, toggle, stop }
}
