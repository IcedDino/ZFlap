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

// Presence is for "who's here" + static identity, tracked once per join
// and only re-tracked when identity actually changes (e.g. signing in
// mid-session) — Presence is a membership/low-rate primitive, not built
// for continuous updates. Cursor position and selection change far too
// often (every mousemove) for that, so they travel as a separate
// high-frequency broadcast event instead (see CursorState/broadcastCursor
// below) — mixing the two onto Presence destabilized it specifically
// while someone was actively dragging (far more Presence pushes),
// visible as that person's own avatar flickering out of everyone else's
// list mid-edit, and eventually broke the whole channel from the churn.
export interface PresenceState {
  color:   string
  initial: string
  name:    string
}

export interface CursorState {
  x:          number | null
  y:          number | null
  selectedId: string | null
}

export interface Peer extends PresenceState, CursorState {
  id: string
}

// Broadcast identity is per tab so two tabs can still exchange edits without
// echoing their own messages. Presence identity is shared by tabs in the same
// browser profile, so opening the same app in another tab does not appear as a
// second person.
export function createClientId(): string {
  return crypto.randomUUID()
}

const PRESENCE_STORAGE_KEY = 'zflap:presence-id'

export function createPresenceId(): string {
  try {
    const existing = localStorage.getItem(PRESENCE_STORAGE_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(PRESENCE_STORAGE_KEY, id)
    return id
  } catch {
    // Private browsing/storage-disabled environments still get a stable id
    // for this mounted tab; collaboration remains functional, but presence
    // may be tab-scoped when the browser does not expose localStorage.
    return crypto.randomUUID()
  }
}

interface JoinOptions {
  clientId:    string
  presenceId:  string
  getPresence: () => PresenceState // called fresh on every (re)join, never a stale snapshot
  onAction:    (action: RemoteAction) => void
  onPresence:  (peers: { id: string; color: string; initial: string; name: string }[]) => void
  onCursor:    (senderId: string, cursor: CursorState) => void
}

// Channels we've intentionally told to leave — lets the retry logic below
// tell "the connection dropped out from under us" apart from "we meant to
// close this," without needing the caller to coordinate anything.
const closingChannels = new WeakSet<RealtimeChannel>()

export function joinAutomatonChannel(id: string, { clientId, presenceId, getPresence, onAction, onPresence, onCursor }: JoinOptions): RealtimeChannel {
  const channel = supabase.channel(`automaton:${id}`, {
    config: { broadcast: { self: false }, presence: { key: presenceId } },
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
    .on('broadcast', { event: 'cursor' }, ({ payload }) => {
      if (payload.senderId === clientId) return
      onCursor(payload.presenceId as string, payload.cursor as CursorState)
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceState>()
      const peers = Object.entries(state)
        .filter(([key]) => key !== presenceId)
        .map(([key, entries]) => ({ id: key, ...entries[0] }))
      onPresence(peers)
    })

  // Retry on the SAME channel object (same topic, same presence key)
  // instead of tearing down and recreating one — that's what caused
  // duplicated/flickering presence entries earlier. Heartbeat timeouts
  // and brief network blips are normal for a long-lived WebSocket;
  // re-subscribing after CHANNEL_ERROR/TIMED_OUT/CLOSED is the
  // documented way to recover without losing the channel's identity.
  function subscribe() {
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { channel.track(getPresence()); return }
      const dropped = status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'
      if (dropped && !closingChannels.has(channel)) setTimeout(subscribe, 1000)
    })
  }
  subscribe()

  return channel
}

export function broadcastAction(channel: RealtimeChannel, clientId: string, action: RemoteAction): void {
  channel.send({ type: 'broadcast', event: 'action', payload: { senderId: clientId, action } })
}

export function broadcastCursor(channel: RealtimeChannel, clientId: string, presenceId: string, cursor: CursorState): void {
  channel.send({ type: 'broadcast', event: 'cursor', payload: { senderId: clientId, presenceId, cursor } })
}

// Re-track identity — rare (only fires if someone signs in mid-session),
// unlike cursor position this genuinely belongs on Presence.
export function trackIdentity(channel: RealtimeChannel, state: PresenceState): void {
  channel.track(state)
}

// Not channel.unsubscribe() — that just async-leaves the topic without
// synchronously removing the channel from the client's registry. Under
// StrictMode's dev-mode double-effect-invoke (mount → cleanup → mount),
// a second channel for the same topic can get created before the first
// one's leave finishes, and the client gets confused about which one is
// authoritative — broadcasts silently stop delivering. removeChannel()
// tears down the registry entry immediately instead.
export function leaveAutomatonChannel(channel: RealtimeChannel): void {
  closingChannels.add(channel)
  supabase.removeChannel(channel)
}
