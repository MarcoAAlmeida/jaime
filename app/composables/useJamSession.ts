export function useJamSession() {
  const code = useState('jam-session-code', () => '')

  return {
    code,
  }
}
