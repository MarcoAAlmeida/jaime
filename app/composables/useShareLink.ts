/**
 * Share a URL in one action: the device's native share sheet where it
 * exists, otherwise copy-to-clipboard with a short-lived "copied"
 * confirmation. Used for room invite links (add-responsive-rooms).
 */
export function useShareLink() {
  // Decided once at mount — `navigator.share` presence doesn't change
  // within a session, and the button label shouldn't flicker.
  const canShare = ref(false)
  const copied = ref(false)

  onMounted(() => {
    canShare.value = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  })

  const label = computed(() => (canShare.value ? 'Share' : 'Copy invite link'))

  /**
   * Must be called synchronously from a user gesture (`navigator.share`
   * requires transient activation).
   */
  async function share(url: string, title?: string) {
    if (canShare.value) {
      try {
        await navigator.share({ url, title })
      }
      catch (err) {
        // A deliberate dismiss is not a failure — don't fall back to a
        // surprise clipboard write.
        if ((err as DOMException)?.name !== 'AbortError') copyToClipboard(url)
      }
      return
    }
    copyToClipboard(url)
  }

  function copyToClipboard(url: string) {
    void navigator.clipboard?.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  }

  return { label, copied, canShare, share }
}
