import { useState } from 'react'
import { Cpu, Layers, GitBranch, Zap, Shield, Globe, ArrowRight, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import styles from './HomePage.module.css'
import DfaDemo from '../components/DfaDemo'
import ZedMascot from '../components/ZedMascot'
import AuthModal from '../components/AuthModal'
import { useAuth } from '../hooks/useAuth'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <div className={styles.page}>

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <ZedMascot size={32} className={styles.navLogo} />
          <span className={styles.navName}>ZFlap</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#features" className={styles.navLink}>Features</a>
        </div>
        <div className={styles.navRight}>
          {user ? (
            <>
              <span className={styles.navEmail}>{user.email}</span>
              <button className={styles.btnGhost} onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <button className={styles.btnGhost} onClick={() => setAuthOpen(true)}>Log in</button>
              <button className={styles.btnPrimary} onClick={() => setAuthOpen(true)}>
                Create account <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>
      </nav>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {/* ── Hero + live demo ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGlow2} />

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
            <a href="https://github.com/IcedDino/ZFlap" className={styles.btnGhost}>
              View on GitHub
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


      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <ZedMascot size={24} />
          ZFlap
        </div>
        <span className={styles.footerNote}>Built with Rust · React · WebAssembly</span>
      </footer>

    </div>
  )
}
