const STORAGE_KEY = 'jaime-display-name'

// A signed-in user's display name comes from their account and persists
// across sessions and devices. Anonymous users get a sessionStorage
// name that carries between rooms in this tab but not across a browser
// restart (identity spec) — see add-identity-and-transport-ui and
// add-user-auth.
export function useDisplayName() {
  const { user, updateDisplayName: updateAccountName } = useAuth()

  const sessionName = useState<string>('display-name', () => {
    if (import.meta.client) {
      return sessionStorage.getItem(STORAGE_KEY) ?? ''
    }
    return ''
  })

  // Account name wins when signed in.
  const displayName = computed(() => user.value?.displayName || sessionName.value)

  async function setDisplayName(name: string) {
    const trimmed = name.trim()
    if (user.value) {
      if (trimmed) await updateAccountName(trimmed)
      return
    }
    sessionName.value = trimmed
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
