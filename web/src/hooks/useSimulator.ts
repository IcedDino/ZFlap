import { useState, useCallback } from 'react'
import type { FAState, FATransition } from './useAutomaton'
import { transitionMatchesSymbol } from './useAutomaton'

export type SimStatus = 'idle' | 'running' | 'accepted' | 'rejected'

export interface LogEntry {
  symbol:   string | null  // null = initial placement
  fromIds:  string[]
  toIds:    string[]
  transIds: string[]
}

interface HistoryEntry {
  head:           number
  activeIds:      Set<string>
  activeTransIds: Set<string>
  status:         SimStatus
}

export interface SimState {
  input:          string
  head:           number
  activeIds:      Set<string>
  activeTransIds: Set<string>   // transitions that fired on the last step
  status:         SimStatus
  log:            LogEntry[]    // one entry per step (index 0 = initial placement)
  history:        HistoryEntry[] // stack for step-back
}

// ── Automata helpers ──────────────────────────────────────────────────────────

function epsClosure(ids: Set<string>, transitions: FATransition[]): Set<string> {
  const closed = new Set(ids)
  const queue  = [...ids]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const t of transitions) {
      if (t.fromId === id && (t.label === 'ε' || t.label === '') && !closed.has(t.toId)) {
        closed.add(t.toId)
        queue.push(t.toId)
      }
    }
  }
  return closed
}

function moveOn(ids: Set<string>, symbol: string, transitions: FATransition[]): Set<string> {
  const next = new Set<string>()
  for (const id of ids) {
    for (const t of transitions) {
      if (t.fromId === id && transitionMatchesSymbol(t, symbol)) next.add(t.toId)
    }
  }
  return next
}

// Transitions that directly consumed `symbol` from `fromIds`
function firedOnSymbol(
  fromIds: Set<string>, symbol: string, transitions: FATransition[]
): Set<string> {
  const fired = new Set<string>()
  for (const id of fromIds) {
    for (const t of transitions) {
      if (t.fromId === id && transitionMatchesSymbol(t, symbol)) fired.add(t.id)
    }
  }
  return fired
}

// ε-transitions that are reachable from `ids` (used to highlight ε arcs)
function firedEps(ids: Set<string>, transitions: FATransition[]): Set<string> {
  const fired   = new Set<string>()
  const visited = new Set(ids)
  const queue   = [...ids]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const t of transitions) {
      if (t.fromId === id && (t.label === 'ε' || t.label === '')) {
        fired.add(t.id)
        if (!visited.has(t.toId)) { visited.add(t.toId); queue.push(t.toId) }
      }
    }
  }
  return fired
}

function computeFired(
  fromIds: Set<string>, symbol: string, transitions: FATransition[]
): Set<string> {
  const direct = firedOnSymbol(fromIds, symbol, transitions)
  const moved  = moveOn(fromIds, symbol, transitions)
  const eps    = firedEps(moved, transitions)
  return new Set([...direct, ...eps])
}

function deriveStatus(
  ids: Set<string>, head: number, input: string, states: FAState[]
): SimStatus {
  if (head < input.length) return ids.size > 0 ? 'running' : 'rejected'
  if (ids.size === 0)      return 'rejected'
  return [...ids].some(id => states.find(s => s.id === id)?.isFinal) ? 'accepted' : 'rejected'
}

function makeInitial(
  input: string, initialId: string | null, transitions: FATransition[],
): SimState {
  if (!initialId) {
    return { input, head: 0, activeIds: new Set(), activeTransIds: new Set(), status: 'idle', log: [], history: [] }
  }
  const initial = epsClosure(new Set([initialId]), transitions)
  const initEps = firedEps(new Set([initialId]), transitions)
  return {
    input, head: 0,
    activeIds:      initial,
    activeTransIds: initEps,
    status:         'running',
    log: [{ symbol: null, fromIds: [], toIds: [...initial], transIds: [...initEps] }],
    history: [],
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSimulator(
  states:      FAState[],
  transitions: FATransition[],
  initialId:   string | null,
) {
  const [sim, setSim] = useState<SimState>(() =>
    makeInitial('', initialId, transitions)
  )

  const setInput = useCallback((input: string) => {
    setSim(makeInitial(input, initialId, transitions))
  }, [initialId, transitions])

  const reset = useCallback(() => {
    setSim(prev => makeInitial(prev.input, initialId, transitions))
  }, [initialId, transitions])

  const step = useCallback(() => {
    setSim(prev => {
      if (prev.status !== 'running') return prev

      // Save current state to history
      const snap: HistoryEntry = {
        head: prev.head, activeIds: prev.activeIds,
        activeTransIds: prev.activeTransIds, status: prev.status,
      }

      // Empty-string test: all input consumed, just resolve
      if (prev.head >= prev.input.length) {
        const status = deriveStatus(prev.activeIds, prev.head, prev.input, states)
        return {
          ...prev,
          status,
          log: [...prev.log, { symbol: null, fromIds: [...prev.activeIds], toIds: [...prev.activeIds], transIds: [] }],
          history: [...prev.history, snap],
        }
      }

      const symbol   = prev.input[prev.head]
      const moved    = moveOn(prev.activeIds, symbol, transitions)
      const closed   = epsClosure(moved, transitions)
      const fired    = computeFired(prev.activeIds, symbol, transitions)
      const newHead  = prev.head + 1
      const status   = deriveStatus(closed, newHead, prev.input, states)

      return {
        ...prev,
        head:           newHead,
        activeIds:      closed,
        activeTransIds: fired,
        status,
        log:     [...prev.log, { symbol, fromIds: [...prev.activeIds], toIds: [...closed], transIds: [...fired] }],
        history: [...prev.history, snap],
      }
    })
  }, [transitions, states])

  const stepBack = useCallback(() => {
    setSim(prev => {
      if (prev.history.length === 0) return prev
      const last = prev.history[prev.history.length - 1]
      return {
        ...prev,
        head:           last.head,
        activeIds:      last.activeIds,
        activeTransIds: last.activeTransIds,
        status:         last.status,
        log:            prev.log.slice(0, -1),
        history:        prev.history.slice(0, -1),
      }
    })
  }, [])

  const run = useCallback(() => {
    setSim(prev => {
      if (prev.status !== 'running') return prev

      let { head, activeIds, input } = prev
      let activeTransIds = prev.activeTransIds
      const log     = [...prev.log]
      const history = [...prev.history]

      // Empty-string test
      if (head >= input.length) {
        return { ...prev, status: deriveStatus(activeIds, head, input, states) }
      }

      while (head < input.length && activeIds.size > 0) {
        const symbol = input[head]
        const moved  = moveOn(activeIds, symbol, transitions)
        const closed = epsClosure(moved, transitions)
        const fired  = computeFired(activeIds, symbol, transitions)

        history.push({ head, activeIds, activeTransIds, status: 'running' })
        log.push({ symbol, fromIds: [...activeIds], toIds: [...closed], transIds: [...fired] })

        activeTransIds = fired
        activeIds      = closed
        head++
      }

      return {
        ...prev, head, activeIds, activeTransIds, log, history,
        status: deriveStatus(activeIds, head, input, states),
      }
    })
  }, [transitions, states])

  return { sim, setInput, step, stepBack, run, reset }
}
