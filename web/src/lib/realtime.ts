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

interface JoinOptions {
  initial:    PresenceState
  onAction:   (action: RemoteAction) => void
  onPresence: (peers: Peer[]) => void
}

export function joinAutomatonChannel(id: string, { initial, onAction, onPresence }: JoinOptions): RealtimeChannel {
  const selfKey = crypto.randomUUID()
  const channel = supabase.channel(`automaton:${id}`, {
    config: { broadcast: { self: false }, presence: { key: selfKey } },
  })

  channel
    .on('broadcast', { event: 'action' }, ({ payload }) => onAction(payload as RemoteAction))
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>()
      const peers = Object.entries(state)
        .filter(([key]) => key !== selfKey)
        .map(([key, entries]) => ({ id: key, ...entries[0] }))
      onPresence(peers)
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') channel.track(initial)
    })

  return channel
}

export function broadcastAction(channel: RealtimeChannel, action: RemoteAction): void {
  channel.send({ type: 'broadcast', event: 'action', payload: action })
}

export function trackPresence(channel: RealtimeChannel, state: PresenceState): void {
  channel.track(state)
}
