import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import s from './AuthModal.module.css'

type Tab = 'login' | 'signup'

interface Props {
  onClose: () => void
}

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp } = useAuth()
  const [tab, setTab]           = useState<Tab>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    if (tab === 'login') {
      const { error } = await signIn(email, password)
      setBusy(false)
      if (error) { setError(error); return }
      onClose()
    } else {
      const { error, needsConfirmation } = await signUp(email, password)
      setBusy(false)
      if (error) { setError(error); return }
      if (needsConfirmation) { setConfirmSent(true); return }
      onClose()
    }
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <button className={s.close} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <div className={s.tabs}>
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
            Create account
          </button>
        </div>

        {error && <div className={s.error}>{error}</div>}

        {confirmSent ? (
          <p className={s.confirmNote}>
            Check <strong>{email}</strong> for a confirmation link, then log in.
          </p>
        ) : (
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
            {busy ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        )}
      </div>
    </div>
  )
}
