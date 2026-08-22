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

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'zflap-contributors-plugin',
  }
  // Optional — only raises the 60/hr unauthenticated rate limit.
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

  const commits = (await res.json()) as { author?: { login?: string; avatar_url?: string; html_url?: string } | null }[]
  const author = Array.isArray(commits) ? commits[0]?.author : null
  if (!author?.login) return null

  return { login: author.login, avatar: author.avatar_url, url: author.html_url }
}

/**
 * Exposes the repo's contributors to the app as `virtual:contributors`.
 *
 * The list comes from `git log` at build time, so it is never hand-maintained.
 * Avatars are a best-effort enrichment: if git or the GitHub API is
 * unavailable the build still succeeds, just with less in each entry, and the
 * landing page renders monograms instead of photos.
 */
export function contributorsPlugin(options: Options = {}): Plugin {
  const { repo, timeoutMs = 5000 } = options
  let cache: Promise<Contributor[]> | null = null
  let root = process.cwd()

  async function collect(): Promise<Contributor[]> {
    let authors: Contributor[]
    try {
      authors = await readGitAuthors(root)
    } catch (err) {
      // A deploy image built from an archive rather than a clone has no
      // history to read. Better an empty section than a failed build.
      console.warn(`[contributors] no git history available: ${(err as Error).message}`)
      return []
    }

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
