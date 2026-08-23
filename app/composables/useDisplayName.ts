const STORAGE_KEY = 'jaime-display-name'

// sessionStorage, not localStorage: a display name should carry over
// when this tab navigates between rooms, but must not survive an actual
// browser restart (identity's "Display Name Does Not Persist Across
// Sessions" requirement) — see design.md in
// add-identity-and-transport-ui.
export function useDisplayName() {
  const displayName = useState<string>('display-name', () => {
    if (import.meta.client) {
      return sessionStorage.getItem(STORAGE_KEY) ?? ''
    }
    return ''
  })

  function setDisplayName(name: string) {
    const trimmed = name.trim()
    displayName.value = trimmed
    if (import.meta.client) {
      if (trimmed) {
        sessionStorage.setItem(STORAGE_KEY, trimmed)
      }
      else {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }

  return { displayName, setDisplayName }
}
