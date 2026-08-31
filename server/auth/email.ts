export interface SendResult {
  ok: boolean
  error?: string
}

// Test seam: when set, links are captured here instead of being sent.
// Used by the auth unit / route tests.
let capture: ((email: string, link: string) => void) | null = null
export function __setEmailCapture(fn: ((email: string, link: string) => void) | null): void {
  capture = fn
}

function bodies(link: string): { text: string, html: string } {
  const disclaimer
    = 'This link works once and expires in 15 minutes. If you didn\'t '
      + 'request it, ignore this email — nothing changes until you click it.'
  return {
    text: `Sign in to jaime:\n\n${link}\n\n${disclaimer}`,
    html: `<p>Sign in to jaime:</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#666;font-size:14px">${disclaimer}</p>`,
  }
}

export async function sendSignInEmail(
  env: Env,
  email: string,
  link: string,
): Promise<SendResult> {
  if (capture) {
    capture(email, link)
    return { ok: true }
  }
  if (!env.EMAIL) {
    return { ok: false, error: 'email binding unavailable' }
  }
  const { text, html } = bodies(link)
  try {
    await env.EMAIL.send({
      from: { name: 'jaime', email: 'noreply@jaime.stream' },
      to: email,
      subject: 'Your jaime sign-in link',
      text,
      html,
    })
    return { ok: true }
  }
  catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
