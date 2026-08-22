import { useState } from 'react'
import { Cpu, Layers, GitBranch, Zap, Shield, Globe, ArrowRight, CheckCircle } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import styles from './HomePage.module.css'
import DfaDemo from '../components/DfaDemo'
import ZedMascot from '../components/ZedMascot'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../hooks/useAuth'
import contributors from 'virtual:contributors'

function GithubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15v3.19c0 .3.21.66.8.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

// Fallback for a contributor GitHub could not resolve to an account: initials
// on a colour picked from their name, so the same person is always the same
// colour without storing anything.
const MONOGRAM_COLORS = ['#F97316', '#2563EB', '#16A34A', '#DC2626', '#9333EA', '#0891B2']

function monogram(name: string): { initials: string; color: string } {
  const words = name.split(/[\s._-]+/).filter(Boolean)
  const initials = (words.length > 1
    ? words[0][0] + words[words.length - 1][0]
    : name.slice(0, 2)
  ).toUpperCase()

  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return { initials, color: MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length] }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  return (
    <div className={styles.page}>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <ZedMascot size={32} className={styles.navLogo} />
          <span className={styles.navName}>ZFlap</span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.btnGhost} onClick={() => setAuthOpen(true)}>Log in</button>
          <button className={styles.btnPrimary} onClick={() => setAuthOpen(true)}>
            Sign up <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onAuthenticated={() => navigate('/dashboard')}
        />
      )}

      {/* ── Hero + live demo ── */}
      <section className={styles.hero}>
        {/* Left: copy */}
        <div className={styles.heroContent}>
          <div className={styles.heroPill}>
            <Zap size={12} />
            Runs entirely in your browser — no server
          </div>

          <h1 className={styles.heroTitle}>
            Design. Simulate.<br />
            <span className={styles.heroAccent}>Understand automata.</span>
          </h1>

          <p className={styles.heroSub}>
            A visual editor for finite automata, pushdown automata, and Turing machines.
            Build state diagrams, validate strings, and step through execution — free and open source.
          </p>

          <div className={styles.heroActions}>
            <button className={styles.btnPrimary} onClick={() => navigate('/editor')}>
              Open in browser <ArrowRight size={15} />
            </button>
            <a href="https://github.com/IcedDino/ZFlap" className={styles.btnGhost} target="_blank" rel="noreferrer">
              <GithubMark size={16} /> View on GitHub
            </a>
          </div>

          <div className={styles.heroBadges}>
            {['Free forever', 'No account needed', 'Works offline'].map(t => (
              <span key={t} className={styles.heroBadge}>
                <CheckCircle size={12} /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right: live DFA demo */}
        <div className={styles.heroDemo}>
          <DfaDemo />
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features} id="features">
        <div className={styles.sectionLabel}>Features</div>
        <h2 className={styles.sectionTitle}>Everything you need for formal language theory</h2>
        <p className={styles.sectionSub}>
          From simple DFAs to Turing machines — ZFlap covers the full Chomsky hierarchy.
        </p>

        <div className={styles.featGrid}>
          {[
            {
              icon: <GitBranch size={20} />,
              title: 'Finite Automata',
              desc: 'Build DFAs, NFAs, and ε-NFAs visually. Automatic classification detects determinism and epsilon transitions.',
              color: '#60A5FA',
            },
            {
              icon: <Layers size={20} />,
              title: 'Pushdown Automata',
              desc: 'Model context-free languages with a stack. DFS-based simulation traces every path through non-determinism.',
              color: '#34D399',
            },
            {
              icon: <Cpu size={20} />,
              title: 'Turing Machines',
              desc: 'Full single-tape TM support with dynamic tape growth. Step through each read/write/move operation.',
              color: '#F0CF60',
            },
            {
              icon: <Zap size={20} />,
              title: 'WASM-powered core',
              desc: 'All computation runs in WebAssembly compiled from Rust. Near-native speed, no round-trips to a server.',
              color: '#A78BFA',
            },
            {
              icon: <Shield size={20} />,
              title: 'Private by default',
              desc: 'Your automata live in your account. Nothing is shared unless you choose to — no analytics on your diagrams.',
              color: '#F87171',
            },
            {
              icon: <Globe size={20} />,
              title: 'Open file format',
              desc: 'Save and load .zflap files. Full compatibility with the desktop version — import your existing work instantly.',
              color: '#FB923C',
            },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className={styles.featCard}>
              <span className={styles.featIcon} style={{ '--feat-color': color } as React.CSSProperties}>
                {icon}
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ── Contributors ── */}
      {/* Read from git history at build time (see plugins/contributors.ts), so
          this list never goes stale against the repo. */}
      {contributors.length > 0 && (
        <section className={styles.team}>
          <div className={styles.sectionLabel}>Contributors</div>
          <h2 className={styles.sectionTitle}>Everyone who has committed</h2>
          <div className={styles.teamGrid}>
            {contributors.map(person => {
              const mark = monogram(person.name)
              const card = (
                <>
                  {person.avatar
                    ? <img src={person.avatar} alt="" className={styles.teamAvatar} />
                    : (
                      <div className={styles.teamMonogram} style={{ background: mark.color }} aria-hidden="true">
                        {mark.initials}
                      </div>
                    )}
                  <div className={styles.teamInfo}>
                    <span className={styles.teamName}>{person.name}</span>
                    {person.login && <span className={styles.teamUsername}>@{person.login}</span>}
                    <span className={styles.teamCommits}>
                      {person.commits} {person.commits === 1 ? 'commit' : 'commits'}
                    </span>
                  </div>
                </>
              )

              return person.url
                ? (
                  <a key={person.email} href={person.url} className={styles.teamCard} target="_blank" rel="noreferrer">
                    {card}
                  </a>
                )
                : <div key={person.email} className={styles.teamCard}>{card}</div>
            })}
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <ZedMascot size={24} />
          ZFlap
        </div>
        <span className={styles.footerNote}>Built with Rust · React · WebAssembly</span>
        <a
          href="https://github.com/IcedDino/ZFlap"
          className={styles.navIconLink}
          aria-label="View on GitHub"
          target="_blank"
          rel="noreferrer"
        >
          <GithubMark size={18} />
        </a>
      </footer>

    </div>
  )
}
