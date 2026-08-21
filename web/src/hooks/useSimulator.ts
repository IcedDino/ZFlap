import { useState, useCallback } from 'react'
import type { FAState, FATransition, AutomatonType } from './useAutomaton'
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
  tape:           string[]
  tmConfigs:      TMConfig[]
  tmHead:         number
  tmStateId:      string | null
  tmTapeOrigin:   number
  regex:          string
  regexError:     string | null
}

export interface TMConfig {
  stateId: string
  head: number
  tape: Record<number, string>
}

export interface SimState {
  input:          string
  head:           number
  tape:           string[]
  tmConfigs:      TMConfig[]
  tmHead:         number
  tmStateId:      string | null
  tmTapeOrigin:   number
  regex:          string
  regexError:     string | null
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
  input: string, initialId: string | null, transitions: FATransition[], initialRegex = '',
): SimState {
  if (!initialId) {
    return {
      input, head: 0, activeIds: new Set(), activeTransIds: new Set(), status: 'idle',
      log: [], history: [], tape: input.split(''), tmConfigs: [], tmHead: 0, tmStateId: null, tmTapeOrigin: 0,
      regex: initialRegex, regexError: null,
    }
  }
  const initial = epsClosure(new Set([initialId]), transitions)
  const initEps = firedEps(new Set([initialId]), transitions)
  return {
    input, head: 0,
    activeIds: initial,
    activeTransIds: initEps,
    status: 'running',
    log: [{ symbol: null, fromIds: [], toIds: [...initial], transIds: [...initEps] }],
    history: [],
    tape: input.split(''), tmConfigs: [], tmHead: 0, tmStateId: initialId, tmTapeOrigin: 0,
    regex: initialRegex, regexError: null,
  }
}

function parseTmTransition(t: FATransition): { read: string; write: string; move: -1 | 0 | 1 } | null {
  // Current format is "read/write,MOVE"; documents saved before the formats
  // were unified may still carry the legacy arrow form "read→write,MOVE".
  const match = t.label.trim().match(/^(.+?)\s*\/\s*(.+?)\s*,\s*([LRNS])$/i)
    ?? t.label.trim().match(/^(.+?)→\s*(.+?)\s*,\s*([LRNS])$/i)
  if (!match) return null
  const read = match[1].trim()
  const write = match[2].trim()
  if (read.length !== 1 || write.length !== 1) return null
  const move = match[3].toUpperCase() === 'L' ? -1 : match[3].toUpperCase() === 'R' ? 1 : 0
  return { read, write, move }
}

function cloneConfig(c: TMConfig): TMConfig {
  return { stateId: c.stateId, head: c.head, tape: { ...c.tape } }
}

function tmInitial(input: string, initialId: string | null): TMConfig[] {
  if (!initialId) return []
  const tape: Record<number, string> = {}
  for (let i = 0; i < input.length; i++) tape[i] = input[i]
  return [{ stateId: initialId, head: 0, tape }]
}

function tmStep(configs: TMConfig[], transitions: FATransition[], finals: Set<string>, deterministic: boolean) {
  const next: TMConfig[] = []
  const fired = new Set<string>()
  let accepted = false
  let moved = false
  for (const config of configs) {
    if (finals.has(config.stateId)) {
      accepted = true
      continue
    }
    const read = config.tape[config.head] ?? '_'
    const choices = transitions.filter(t => {
      if (t.fromId !== config.stateId) return false
      const parsed = parseTmTransition(t)
      return !!parsed && parsed.read === read
    })
    if (choices.length === 0) {
      if (finals.has(config.stateId)) accepted = true
      continue
    }
    const usable = deterministic ? choices.slice(0, 1) : choices
    for (const t of usable) {
      const parsed = parseTmTransition(t)!
      const copy = cloneConfig(config)
      copy.tape[copy.head] = parsed.write
      copy.head += parsed.move
      copy.stateId = t.toId
      next.push(copy)
      fired.add(t.id)
      moved = true
      if (finals.has(copy.stateId)) accepted = true
      if (next.length >= 128) break
    }
    if (next.length >= 128) break
  }
  return { next, fired, accepted, moved }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSimulator(
  states:      FAState[],
  transitions: FATransition[],
  initialId:   string | null,
  automatonType: AutomatonType = 'dfa',
  initialRegex = '',
) {
  const [sim, setSim] = useState<SimState>(() =>
    makeInitial('', initialId, transitions, initialRegex)
  )

  const setInput = useCallback((input: string) => {
    setSim(prev => ({
      ...makeInitial(input, initialId, transitions, prev.regex),
      regex: prev.regex,
      regexError: prev.regexError,
      status: automatonType === 'regex'
        ? (prev.regexError ? 'idle' : 'running')
        : 'running',
    }))
  }, [initialId, transitions, automatonType])

  const setRegex = useCallback((regex: string) => {
    let error: string | null = null
    if (regex.trim()) {
      try { new RegExp(`^(?:${regex})$`) } catch (err) { error = err instanceof Error ? err.message : 'Invalid regular expression' }
    }
    setSim(prev => ({ ...prev, regex, regexError: error, status: error ? 'idle' : prev.status }))
  }, [])

  const reset = useCallback(() => {
    setSim(prev => {
      const input = automatonType === 'regex' ? '' : prev.input
      return {
        ...makeInitial(input, initialId, transitions, prev.regex),
        regex: prev.regex,
        regexError: prev.regexError,
      }
    })
  }, [initialId, transitions, automatonType])

  const step = useCallback(() => {
    setSim(prev => {
      if (automatonType === 'regex') {
        if (!prev.regex.trim()) return { ...prev, status: 'idle' }
        if (prev.regexError) return prev
        try {
          const accepted = new RegExp(`^(?:${prev.regex})$`).test(prev.input)
          return { ...prev, status: accepted ? 'accepted' : 'rejected', head: prev.input.length }
        } catch (err) {
          return { ...prev, status: 'idle', regexError: err instanceof Error ? err.message : 'Invalid regular expression' }
        }
      }
      if (automatonType.startsWith('tm-')) {
        if (prev.status !== 'running') return prev
        const finals = new Set(states.filter(s => s.isFinal).map(s => s.id))
        const result = tmStep(prev.tmConfigs.length ? prev.tmConfigs : tmInitial(prev.input, initialId), transitions, finals, automatonType === 'tm-deterministic')
        const nextConfigs = result.next
        const activeIds = new Set(nextConfigs.map(c => c.stateId))
        const first = nextConfigs[0]
        const status = result.accepted ? 'accepted' : result.moved ? 'running' : 'rejected'
        const tapeKeys = first ? Object.keys(first.tape).map(Number) : []
        const tapeMin = tapeKeys.length ? Math.min(...tapeKeys) : prev.tmTapeOrigin
        const tapeMax = tapeKeys.length ? Math.max(...tapeKeys) : prev.tmTapeOrigin
        const tape = first ? Array.from({ length: tapeMax - tapeMin + 1 }, (_, i) => first.tape[tapeMin + i] ?? '_') : prev.tape
        return { ...prev, tmConfigs: nextConfigs, activeIds, activeTransIds: result.fired, tmHead: first?.head ?? prev.tmHead, tmStateId: first?.stateId ?? prev.tmStateId, tmTapeOrigin: first ? tapeMin : prev.tmTapeOrigin, tape, status, head: prev.head + 1, log: [...prev.log, { symbol: prev.tape[prev.tmHead] ?? '_', fromIds: [...prev.activeIds], toIds: [...activeIds], transIds: [...result.fired] }], history: [...prev.history, { head: prev.head, activeIds: prev.activeIds, activeTransIds: prev.activeTransIds, status: prev.status, tape: prev.tape, tmConfigs: prev.tmConfigs, tmHead: prev.tmHead, tmStateId: prev.tmStateId, tmTapeOrigin: prev.tmTapeOrigin, regex: prev.regex, regexError: prev.regexError }] }
      }
      if (prev.status !== 'running') return prev

      // Save current state to history
      const snap: HistoryEntry = {
        head: prev.head, activeIds: prev.activeIds,
        activeTransIds: prev.activeTransIds, status: prev.status,
        tape: prev.tape, tmConfigs: prev.tmConfigs, tmHead: prev.tmHead,
        tmStateId: prev.tmStateId, tmTapeOrigin: prev.tmTapeOrigin, regex: prev.regex, regexError: prev.regexError,
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
  }, [transitions, states, automatonType, initialId])

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
        tape:           last.tape,
        tmConfigs:      last.tmConfigs,
        tmHead:         last.tmHead,
        tmStateId:      last.tmStateId,
        regex:          last.regex,
        regexError:     last.regexError,
        log:            prev.log.slice(0, -1),
        history:        prev.history.slice(0, -1),
      }
    })
  }, [])

  const run = useCallback(() => {
    setSim(prev => {
      if (automatonType === 'regex') {
        if (!prev.regex.trim() || prev.regexError) return prev
        try {
          const accepted = new RegExp(`^(?:${prev.regex})$`).test(prev.input)
          return { ...prev, status: accepted ? 'accepted' : 'rejected', head: prev.input.length }
        } catch (err) {
          return { ...prev, status: 'idle', regexError: err instanceof Error ? err.message : 'Invalid regular expression' }
        }
      }
      if (automatonType.startsWith('tm-')) {
        if (prev.status !== 'running') return prev
        let current = prev.tmConfigs.length ? prev.tmConfigs : tmInitial(prev.input, initialId)
        let activeTransIds = prev.activeTransIds
        let head = prev.head
        let activeIds = new Set(current.map(c => c.stateId))
        const log = [...prev.log]
        let status: SimStatus = 'running'
        const finals = new Set(states.filter(s => s.isFinal).map(s => s.id))
        for (let i = 0; i < 2048 && current.length > 0; i++) {
          const result = tmStep(current, transitions, finals, automatonType === 'tm-deterministic')
          activeTransIds = result.fired
          const next = result.next
          activeIds = new Set(next.map(c => c.stateId))
          log.push({
            symbol: current[0] ? (current[0].tape[current[0].head] ?? '_') : '_',
            fromIds: [...activeIds],
            toIds: [...new Set(next.map(c => c.stateId))],
            transIds: [...result.fired],
          })
          head++
          if (result.accepted) { status = 'accepted'; current = next; break }
          if (!result.moved) { status = 'rejected'; current = []; break }
          current = next
        }
        const first = current[0]
        const tapeKeys = first ? Object.keys(first.tape).map(Number) : []
        const tapeMin = tapeKeys.length ? Math.min(...tapeKeys) : prev.tmTapeOrigin
        const tapeMax = tapeKeys.length ? Math.max(...tapeKeys) : prev.tmTapeOrigin
        const tape = first ? Array.from({ length: tapeMax - tapeMin + 1 }, (_, i) => first.tape[tapeMin + i] ?? '_') : prev.tape
        return { ...prev, tmConfigs: current, activeIds, activeTransIds, tmHead: first?.head ?? prev.tmHead, tmStateId: first?.stateId ?? prev.tmStateId, tmTapeOrigin: first ? tapeMin : prev.tmTapeOrigin, tape, head, log, status }
      }
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

        history.push({ head, activeIds, activeTransIds, status: 'running', tape: prev.tape, tmConfigs: prev.tmConfigs, tmHead: prev.tmHead, tmStateId: prev.tmStateId, tmTapeOrigin: prev.tmTapeOrigin, regex: prev.regex, regexError: prev.regexError })
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
  }, [transitions, states, automatonType, initialId])

  return { sim, setInput, setRegex, step, stepBack, run, reset }
}
