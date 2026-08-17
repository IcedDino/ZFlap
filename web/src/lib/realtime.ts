import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { RemoteAction } from '../hooks/useAutomaton'

const PEER_COLORS = ['#F97316', '#2563EB', '#16A34A', '#DC2626', '#9333EA', '#0891B2']

export function randomPeerColor(): string {
  return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
}

// Anonymous collaborators get a Google-Docs-style animal identity instead
// of a name — assigned once per session, not tied to any account.
const ANIMALS = [
  { name: 'Panda',    emoji: '🐼' },
  { name: 'Otter',    emoji: '🦦' },
  { name: 'Fox',      emoji: '🦊' },
  { name: 'Koala',    emoji: '🐨' },
  { name: 'Penguin',  emoji: '🐧' },
  { name: 'Owl',      emoji: '🦉' },
  { name: 'Tiger',    emoji: '🐯' },
  { name: 'Bear',     emoji: '🐻' },
  { name: 'Rabbit',   emoji: '🐰' },
  { name: 'Turtle',   emoji: '🐢' },
]

export function randomAnonIdentity(): { initial: string; name: string } {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  return { initial: animal.emoji, name: `Anonymous ${animal.name}` }
}

// Presence payload — "here's my current live state," visible to every
// other connected client and cleaned up automatically on disconnect.
// `initial` is what renders inside the avatar circle/cursor tag: a
// signed-in user's first letter, or an anonymous animal's emoji.
export interface PresenceState {
  color:      string
  initial:    string
  name:       string
  x:          number | null
  y:          number | null
  selectedId: string | null
}

export interface Peer extends PresenceState {
  id: string
}

// A stable per-tab id — generate once (EditorPage keeps it in a ref) and
// reuse across reconnects. Both the broadcast self-filter below and the
// presence key are keyed on it, so a mid-session rejoin (see
// leaveAutomatonChannel) doesn't change "who I am" to the rest of the
// channel — it's the same tab either way.
export function createClientId(): string {
  return crypto.randomUUID()
}

interface JoinOptions {
  clientId:   string
  initial:    PresenceState
  onAction:   (action: RemoteAction) => void
  onPresence: (peers: Peer[]) => void
}

export function joinAutomatonChannel(id: string, { clientId, initial, onAction, onPresence }: JoinOptions): RealtimeChannel {
  const channel = supabase.channel(`automaton:${id}`, {
    config: { broadcast: { self: false }, presence: { key: clientId } },
  })

  channel
    .on('broadcast', { event: 'action' }, ({ payload }) => {
      // Belt-and-suspenders alongside broadcast.self:false — that flag is
      // tied to the underlying connection's identity, which can shift
      // across a reconnect; this check doesn't depend on it, so a stale
      // echo of our own (possibly throttle-delayed) action can never get
      // reapplied over a newer local edit and cause it to jump back.
      if (payload.senderId === clientId) return
      onAction(payload.action as RemoteAction)
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>()
      const peers = Object.entries(state)
        .filter(([key]) => key !== clientId)
        .map(([key, entries]) => ({ id: key, ...entries[0] }))
      onPresence(peers)
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') channel.track(initial)
    })

  return channel
}

export function broadcastAction(channel: RealtimeChannel, clientId: string, action: RemoteAction): void {
  channel.send({ type: 'broadcast', event: 'action', payload: { senderId: clientId, action } })
}

// Not channel.unsubscribe() — that just async-leaves the topic without
// synchronously removing the channel from the client's registry. Under
// StrictMode's dev-mode double-effect-invoke (mount → cleanup → mount),
// a second channel for the same topic can get created before the first
// one's leave finishes, and the client gets confused about which one is
// authoritative — broadcasts silently stop delivering. removeChannel()
// tears down the registry entry immediately instead.
export function leaveAutomatonChannel(channel: RealtimeChannel): void {
  supabase.removeChannel(channel)
}

export function trackPresence(channel: RealtimeChannel, state: PresenceState): void {
  channel.track(state)
}
