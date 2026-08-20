import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import ZedMascot from './ZedMascot'
import { useAuth } from '../hooks/useAuth'
import s from './AuthModal.module.css'

type Tab = 'login' | 'signup'

interface Props {
  onClose: () => void
  onAuthenticated?: () => void
}

// A state entering "accepted" — the same visual grammar DiagramCanvas uses
// for a final state, doing the explaining instead of a stock icon.
function AcceptedStateGraphic() {
  return (
    <svg width={96} height={56} viewBox="0 0 96 56" fill="none">
      <line x1="4" y1="28" x2="26" y2="28" stroke="#AAA49A" strokeWidth="1.5" />
      <path d="M19,23 L27,28 L19,33" fill="none" stroke="#AAA49A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="58" cy="28" r="26" fill="none" stroke="#16A34A" strokeWidth="1.5" opacity="0.5" />
      <circle cx="58" cy="28" r="19" fill="#F0FDF4" stroke="#16A34A" strokeWidth="2" />
      <path d="M50,28.5 L55.5,34 L67,20.5" fill="none" stroke="#16A34A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AuthModal({ onClose, onAuthenticated }: Props) {
  const { signIn, signUp } = useAuth()
  const [tab, setTab]           = useState<Tab>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    if (tab === 'login') {
      const { error } = await signIn(email, password)
      setBusy(false)
      if (error) { setError(error); return }
      onClose()
      onAuthenticated?.()
    } else {
      const { error, needsConfirmation } = await signUp(email, password)
      setBusy(false)
      if (error) { setError(error); return }
      if (needsConfirmation) { setConfirmSent(true); return }
      onClose()
      onAuthenticated?.()
    }
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <ZedMascot size={24} />
          <span className={s.brandName}>ZFlap</span>
          <button className={s.close} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {confirmSent ? (
          <div className={s.confirm}>
            <div className={s.confirmGraphic}><AcceptedStateGraphic /></div>
            <div className={s.confirmEyebrow}>Confirmation sent</div>
            <p className={s.confirmBody}>
              We sent a link to <span className={s.confirmEmail}>{email}</span>.
              Open it, then log in here.
            </p>
          </div>
        ) : (
          <>
            <div className={s.tabs} data-tab={tab}>
              <div className={s.tabIndicator} />
              <button
                className={`${s.tab} ${tab === 'login' ? s.tabActive : ''}`}
                onClick={() => { setTab('login'); setError(null) }}
              >
                Log in
              </button>
              <button
                className={`${s.tab} ${tab === 'signup' ? s.tabActive : ''}`}
                onClick={() => { setTab('signup'); setError(null) }}
              >
                Sign up
              </button>
            </div>

            {error && <div className={s.error}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className={s.field}>
                <label className={s.label} htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  className={s.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
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
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                />
              </div>
              <button className={s.submit} type="submit" disabled={busy}>
                {busy ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Sign up'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
