import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, Cpu, GitBranch, Regex } from 'lucide-react'
import ZedMascot from '../components/ZedMascot'
import AutomatonPreview from '../components/AutomatonPreview'
import { useAuth } from '../hooks/useAuth'
import { classifyAutomaton, clearLocalDraft, type AutomatonType } from '../hooks/useAutomaton'
import { listMine, remove, type AutomatonRow } from '../lib/automatonService'
import s from './DashboardPage.module.css'

export default function DashboardPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const navigate = useNavigate()

  const [rows, setRows]     = useState<AutomatonRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    listMine().then(r => { setRows(r); setLoaded(true) }).catch(() => setLoaded(true))
  }, [user])

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!confirm('Delete this automaton? This can\'t be undone.')) return
    await remove(id)
    setRows(rows.filter(r => r.id !== id))
  }

  if (!authLoading && !user) return <Navigate to="/" replace />

  function handleNew(type: AutomatonType = 'dfa') {
    clearLocalDraft()
    localStorage.setItem('zflap-new-type', type)
    setNewOpen(false)
    navigate('/editor')
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link to="/" className={s.brand}>
          <ZedMascot size={32} />
          <span className={s.brandName}>ZFlap</span>
        </Link>
        <div className={s.headerSpacer} />
        {user && <span className={s.email}>{user.email}</span>}
        <button className={s.btnGhost} onClick={signOut}>Sign out</button>
      </header>

      {newOpen && (
        <div className={s.modalBackdrop} onMouseDown={e => { if (e.target === e.currentTarget) setNewOpen(false) }}>
          <div className={s.modal} role="dialog" aria-modal="true" aria-labelledby="new-automaton-title">
            <div className={s.modalHeader}>
              <div>
                <h2 id="new-automaton-title">New automaton</h2>
                <p>Choose the machine you want to design and simulate.</p>
              </div>
              <button className={s.modalClose} onClick={() => setNewOpen(false)} aria-label="Close">×</button>
            </div>
            <div className={s.typeGrid}>
              {[
                { type: 'dfa' as const, title: 'Finite automaton', desc: 'Build a DFA or NFA — ZFlap detects it automatically', icon: <GitBranch size={19} /> },
                { type: 'tm-deterministic' as const, title: 'Turing machine', desc: 'Build a deterministic or nondeterministic TM — detected automatically', icon: <Cpu size={19} /> },
                { type: 'regex' as const, title: 'Regular expression', desc: 'Evaluate strings and generate examples from a regex', icon: <Regex size={19} /> },
              ].map(option => (
                <button key={option.type} className={s.typeCard} onClick={() => handleNew(option.type)}>
                  <span className={s.typeIcon}>{option.icon}</span>
                  <span><strong>{option.title}</strong><small>{option.desc}</small></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className={s.main}>
        <div className={s.titleRow}>
          <h1 className={s.title}>Your automata</h1>
          <button className={s.btnPrimary} onClick={() => setNewOpen(true)}>
            <Plus size={14} /> New automaton
          </button>
        </div>

        {!loaded ? null : rows.length === 0 ? (
          <div className={s.empty}>
            <p className={s.emptyText}>No saved automata yet.</p>
            <button className={s.btnPrimary} onClick={() => setNewOpen(true)}>
              <Plus size={14} /> Build your first one
            </button>
          </div>
        ) : (
          <div className={s.grid}>
            {rows.map(row => {
              const { label, color } = classifyAutomaton(row.data.states, row.data.transitions, row.data.initialId)
              const storedType = row.data.automatonType
              const typeLabel = storedType === 'tm-deterministic' ? 'Deterministic TM' : storedType === 'tm-nondeterministic' ? 'Nondeterministic TM' : storedType === 'regex' ? 'Regex' : label
              const chipClass =
                color === 'green'  ? s.chipGreen :
                color === 'orange' ? s.chipOrange :
                                      s.chip
              return (
                <div key={row.id} className={s.card} onClick={() => navigate(`/editor/${row.id}`)}>
                  <div className={s.cardPreview}>
                    <AutomatonPreview
                      states={row.data.states}
                      transitions={row.data.transitions}
                      initialId={row.data.initialId}
                    />
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.cardTop}>
                      <span className={s.cardName}>{row.name}</span>
                      <button className={s.cardDelete} onClick={e => handleDelete(e, row.id)} aria-label="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className={s.cardMeta}>
                      <span className={chipClass}>{typeLabel}</span>
                      {row.is_public && <span className={s.publicBadge}><Eye size={10} /> Public</span>}
                    </div>
                    <div className={s.cardStats}>
                      {row.data.states.length} state{row.data.states.length !== 1 ? 's' : ''} ·{' '}
                      {row.data.transitions.length} transition{row.data.transitions.length !== 1 ? 's' : ''}
                    </div>
                    <div className={s.cardDate}>
                      Updated {new Date(row.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
