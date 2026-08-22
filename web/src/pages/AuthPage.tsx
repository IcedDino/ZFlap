import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ZedMascot from '../components/ZedMascot'
import { useAuth } from '../hooks/useAuth'
import s from './AuthPage.module.css'

type Mode = 'login' | 'signup'

// How far the form has walked the machine. The states are the real gate
// conditions, not decoration: q1 needs an address, q2 needs a usable password.
type Stage = 0 | 1 | 2
type Status = 'idle' | 'busy' | 'rejected' | 'accepted'

const MIN_PASSWORD = 6

// Deliberately as permissive as the browser's own type="email" check. This
// only drives the machine's position, so it must never look stuck on an
// address the form would happily submit.
function emailLooksComplete(value: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(value.trim())
}

// ── The machine ───────────────────────────────────────────────────────────────
// Signing in is a string the machine either accepts or rejects, so the page
// draws that machine rather than a stock illustration. It steps as the form is
// filled, which makes it a progress indicator that happens to be honest.

interface MachineProps {
  stage:  Stage
  status: Status
  mode:   Mode
}

function AuthMachine({ stage, status, mode }: MachineProps) {
  const rejected = status === 'rejected'

  // A state is "live" when the input has reached it; the last one also carries
  // accept/reject, which is the only place colour changes meaning.
  function stateClass(index: Stage) {
    if (rejected && index === stage) return s.stateRejected
    if (index === 2 && stage === 2) return s.stateAccepted
    if (index === stage) return s.stateLive
    if (index < stage) return s.statePast
    return s.stateIdle
  }

  // Stroke and arrowhead have to move together, so they are chosen as a pair.
  function edge(index: 0 | 1) {
    if (rejected && stage > index) return { className: s.edgeRejected, markerEnd: 'url(#authArrowRejected)' }
    return stage > index
      ? { className: s.edgeTaken, markerEnd: 'url(#authArrowTaken)' }
      : { className: s.edgeIdle,  markerEnd: 'url(#authArrowIdle)' }
  }

  return (
    <svg
      className={s.machine}
      viewBox="0 0 268 92"
      role="img"
      aria-label={`Sign-in machine: step ${stage + 1} of 3`}
    >
      <defs>
        {(['Start', 'Idle', 'Taken', 'Rejected'] as const).map(tone => (
          <marker key={tone} id={`authArrow${tone}`} markerWidth="9" markerHeight="8"
            refX="8" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path className={s[`arrow${tone}`]} d="M0,0.5 L0,7.5 L8,4 z" />
          </marker>
        ))}
      </defs>

      {/* Initial-state arrow, same grammar the editor uses */}
      <line className={s.edgeStart} x1="4" y1="58" x2="20" y2="58" markerEnd="url(#authArrowStart)" />

      {/* q0 → q1, consuming the address */}
      <line {...edge(0)} x1="56" y1="58" x2="122" y2="58" />
      <text className={s.symbol} x="89" y="34" textAnchor="middle">email</text>

      {/* q1 → q2, consuming the secret */}
      <line {...edge(1)} x1="154" y1="58" x2="214" y2="58" />
      <text className={s.symbol} x="184" y="34" textAnchor="middle">password</text>

      <g className={stateClass(0)}>
        <circle cx="40" cy="58" r="16" />
        <text x="40" y="58" textAnchor="middle" dominantBaseline="central">q0</text>
      </g>

      <g className={stateClass(1)}>
        <circle cx="138" cy="58" r="16" />
        <text x="138" y="58" textAnchor="middle" dominantBaseline="central">q1</text>
      </g>

      {/* Accepting state — the double ring is what makes it final */}
      <g className={stateClass(2)}>
        <circle className={s.acceptRing} cx="236" cy="58" r="22" />
        <circle cx="236" cy="58" r="16" />
        <text x="236" y="58" textAnchor="middle" dominantBaseline="central">
          {mode === 'login' ? 'in' : 'up'}
        </text>
      </g>
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthPage({ mode }: { mode: Mode }) {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  // Where to land afterwards. Carried by whoever sent the person here, so an
  // interrupted save in the editor returns to the editor rather than the
  // dashboard. Only same-site paths are honoured.
  const raw = params.get('next')
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'

  if (!loading && user) return <Navigate to={next} replace />

  const stage: Stage = !emailLooksComplete(email) ? 0
                     : password.length < MIN_PASSWORD ? 1
                     : 2
  const status: Status = busy ? 'busy' : error ? 'rejected' : confirmSent ? 'accepted' : 'idle'

  const otherMode: Mode = mode === 'login' ? 'signup' : 'login'
  const otherHref = `/${otherMode}${location.search}`

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      setBusy(false)
      if (error) { setError(error); return }
      navigate(next, { replace: true })
      return
    }

    const { error, needsConfirmation } = await signUp(email, password)
    setBusy(false)
    if (error) { setError(error); return }
    if (needsConfirmation) { setConfirmSent(true); return }
    navigate(next, { replace: true })
  }

  // The status line reads like the editor's, so the machine is narrated in the
  // same voice the rest of the app uses.
  const statusLine = confirmSent ? 'accepted · confirmation pending'
                   : busy        ? 'running…'
                   : error       ? 'rejected · check the input below'
                   : stage === 0 ? 'q0 · waiting for an email address'
                   : stage === 1 ? `q1 · waiting for a password (${MIN_PASSWORD}+ characters)`
                   : 'q2 · ready to run'

  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <Link to="/" className={s.brand}>
          <ZedMascot size={26} />
          <span className={s.brandName}>ZFlap</span>
        </Link>
        <Link to="/" className={s.back}>
          <ArrowLeft size={14} /> <span>Back to home</span>
        </Link>
      </header>

      <main className={s.main}>
        <section className={s.card} aria-labelledby="auth-heading">
          <div className={s.machineWrap}>
            <AuthMachine stage={stage} status={status} mode={mode} />
            <p className={s.status} aria-live="polite">{statusLine}</p>
          </div>

          {confirmSent ? (
            <div className={s.done}>
              <h1 id="auth-heading" className={s.heading}>Check your email</h1>
              <p className={s.lede}>
                A confirmation link is on its way to <span className={s.mono}>{email}</span>.
                Open it, then log in here.
              </p>
              <Link to={`/login${location.search}`} className={s.submit}>Go to log in</Link>
            </div>
          ) : (
            <>
              <h1 id="auth-heading" className={s.heading}>
                {mode === 'login' ? 'Log in' : 'Create an account'}
              </h1>
              <p className={s.lede}>
                {mode === 'login'
                  ? 'Your saved automata, on every machine you use.'
                  : 'Save automata to the cloud and share them with a link.'}
              </p>

              {error && <p className={s.error} role="alert">{error}</p>}

              <form className={s.form} onSubmit={handleSubmit}>
                <div className={s.field}>
                  <label className={s.label} htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    className={s.input}
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(null) }}
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>

                <div className={s.field}>
                  <label className={s.label} htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    className={s.input}
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null) }}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={MIN_PASSWORD}
                    required
                  />
                  {mode === 'signup' && (
                    <span className={s.hint}>At least {MIN_PASSWORD} characters.</span>
                  )}
                </div>

                <button className={s.submit} type="submit" disabled={busy}>
                  {busy ? 'Running…' : mode === 'login' ? 'Log in' : 'Create account'}
                </button>
              </form>
            </>
          )}
        </section>

        <p className={s.switch}>
          {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
          <Link to={otherHref} className={s.switchLink}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </Link>
        </p>

        <p className={s.escape}>
          Or <Link to="/editor" className={s.switchLink}>use the editor without an account</Link> — it
          saves to this browser.
        </p>
      </main>
    </div>
  )
}
