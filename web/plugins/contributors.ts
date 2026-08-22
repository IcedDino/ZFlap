import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Plugin } from 'vite'

const run = promisify(execFile)

const VIRTUAL_ID = 'virtual:contributors'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export interface Contributor {
  name:    string
  email:   string
  commits: number
  login?:  string
  avatar?: string
  url?:    string
}

interface Options {
  /** `owner/repo` on GitHub, used to resolve commit authors to accounts. */
  repo?: string
  /** Milliseconds to wait on the GitHub API before giving up on avatars. */
  timeoutMs?: number
}

// `%aN`/`%aE` are the mailmap-applied author name and email, so the repo's
// .mailmap is what decides who counts as the same person. Without it the same
// contributor shows up once per machine or address they have committed from.
async function readGitAuthors(cwd: string): Promise<Contributor[]> {
  const { stdout } = await run(
    'git',
    ['log', '--no-merges', '--format=%aN%x1f%aE'],
    { cwd, maxBuffer: 32 * 1024 * 1024 },
  )

  const tally = new Map<string, Contributor>()
  for (const line of stdout.split('\n')) {
    if (!line) continue
    const [name, email] = line.split('\x1f')
    if (!name || !email) continue
    const key = email.toLowerCase()
    const seen = tally.get(key)
    if (seen) seen.commits++
    else tally.set(key, { name, email, commits: 1 })
  }

  return [...tally.values()].sort(
    (a, b) => b.commits - a.commits || a.name.localeCompare(b.name),
  )
}

// True when the checkout has had its history truncated. Deploy images are
// usually cloned with `--depth 1`, which leaves exactly one commit — reading
// authors from that would credit the whole project to whoever pushed last.
async function isShallowCheckout(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await run('git', ['rev-parse', '--is-shallow-repository'], { cwd })
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

// Fallback source for when local history cannot be trusted. This endpoint needs
// no clone at all and dedupes by GitHub account, so it does the job .mailmap
// does locally. Display names cost one extra lookup each and degrade to the
// login if the profile has none.
async function readGithubContributors(
  repo: string,
  timeoutMs: number,
  headers: Record<string, string>,
): Promise<Contributor[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/contributors?per_page=100`,
    { headers, signal: AbortSignal.timeout(timeoutMs) },
  )
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

  const raw = (await res.json()) as {
    login?: string; avatar_url?: string; html_url?: string
    contributions?: number; type?: string
  }[]
  if (!Array.isArray(raw)) return []

  const people = raw.filter(entry => entry.login && entry.type !== 'Bot')

  return Promise.all(people.map(async entry => {
    let name = entry.login!
    try {
      const profile = await fetch(`https://api.github.com/users/${entry.login}`, {
        headers, signal: AbortSignal.timeout(timeoutMs),
      })
      if (profile.ok) {
        const { name: displayName } = (await profile.json()) as { name?: string | null }
        if (displayName) name = displayName
      }
    } catch { /* keep the login as the name */ }

    return {
      name,
      email:   `${entry.login}@users.noreply.github.com`, // list key only
      commits: entry.contributions ?? 0,
      login:   entry.login!,
      avatar:  entry.avatar_url,
      url:     entry.html_url,
    }
  }))
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'zflap-contributors-plugin',
  }
  // Optional — only raises the 60/hr unauthenticated rate limit.
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// GitHub links a commit to an account by verified email, so asking the commits
// endpoint for one author is enough to recover their login and avatar. An
// address that was never verified comes back as `author: null`; that
// contributor keeps their git name and the UI falls back to a monogram.
async function resolveGithubIdentity(
  repo: string,
  email: string,
  timeoutMs: number,
): Promise<Pick<Contributor, 'login' | 'avatar' | 'url'> | null> {
  const url =
    `https://api.github.com/repos/${repo}/commits` +
    `?author=${encodeURIComponent(email)}&per_page=1`

  const res = await fetch(url, { headers: githubHeaders(), signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

  const commits = (await res.json()) as { author?: { login?: string; avatar_url?: string; html_url?: string } | null }[]
  const author = Array.isArray(commits) ? commits[0]?.author : null
  if (!author?.login) return null

  return { login: author.login, avatar: author.avatar_url, url: author.html_url }
}

/**
 * Exposes the repo's contributors to the app as `virtual:contributors`.
 *
 * Local history is the preferred source, since .mailmap makes it the most
 * accurate one. Deploy images are commonly cloned with `--depth 1` though, and
 * a shallow clone would credit the entire project to whoever pushed last — so
 * when history is missing or truncated the GitHub contributors API stands in.
 * If neither is reachable the build still succeeds with an empty list, and the
 * landing page hides the section rather than showing something wrong.
 */
export function contributorsPlugin(options: Options = {}): Plugin {
  const { repo, timeoutMs = 5000 } = options
  let cache: Promise<Contributor[]> | null = null
  let root = process.cwd()

  async function fromGithub(): Promise<Contributor[]> {
    if (!repo) return []
    try {
      const people = await readGithubContributors(repo, timeoutMs, githubHeaders())
      console.info(`[contributors] using the GitHub API (${people.length} contributors)`)
      return people
    } catch (err) {
      console.warn(`[contributors] GitHub API unavailable: ${(err as Error).message}`)
      return []
    }
  }

  async function collect(): Promise<Contributor[]> {
    // A truncated clone looks like a healthy repo with one contributor, so it
    // has to be ruled out explicitly rather than caught as an error.
    if (await isShallowCheckout(root)) {
      console.info('[contributors] shallow checkout — git history is not usable here')
      return fromGithub()
    }

    let authors: Contributor[]
    try {
      authors = await readGitAuthors(root)
    } catch (err) {
      // A deploy image built from an archive rather than a clone has no
      // history to read.
      console.warn(`[contributors] no git history available: ${(err as Error).message}`)
      return fromGithub()
    }

    if (authors.length === 0) return fromGithub()
    if (!repo) return authors

    const enriched = await Promise.all(
      authors.map(async author => {
        try {
          const identity = await resolveGithubIdentity(repo, author.email, timeoutMs)
          return identity ? { ...author, ...identity } : author
        } catch (err) {
          console.warn(`[contributors] could not resolve ${author.email}: ${(err as Error).message}`)
          return author
        }
      }),
    )
    return enriched
  }

  return {
    name: 'zflap:contributors',

    configResolved(config) {
      root = config.root
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null
      cache ??= collect()
      return `export default ${JSON.stringify(await cache)}`
    },

    // In dev the list would otherwise stay frozen at whatever the server
    // started with; a new commit should show up on the next reload.
    handleHotUpdate({ server }) {
      cache = null
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (mod) server.moduleGraph.invalidateModule(mod)
    },
  }
}
