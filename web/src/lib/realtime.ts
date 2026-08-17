import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { RemoteAction } from '../hooks/useAutomaton'

interface JoinOptions {
  onAction:   (action: RemoteAction) => void
  onPresence: (count: number) => void
}

export function joinAutomatonChannel(id: string, { onAction, onPresence }: JoinOptions): RealtimeChannel {
  const channel = supabase.channel(`automaton:${id}`, {
    config: { broadcast: { self: false }, presence: { key: crypto.randomUUID() } },
  })

  channel
    .on('broadcast', { event: 'action' }, ({ payload }) => onAction(payload as RemoteAction))
    .on('presence', { event: 'sync' }, () => {
      onPresence(Object.keys(channel.presenceState()).length)
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') channel.track({ joined_at: Date.now() })
    })

  return channel
}

export function broadcastAction(channel: RealtimeChannel, action: RemoteAction): void {
  channel.send({ type: 'broadcast', event: 'action', payload: action })
}
