import { useState, useCallback } from 'react'
import type { FAState, FATransition } from './useAutomaton'

const BLANK = '_'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TmStatus = 'idle' | 'running' | 'accepted' | 'halted'

export interface TmLogEntry {
  read:     string
  write:    string
  dir:      'L' | 'R' | 'S'
  fromState: string
  toState:   string
}

interface TmHistoryEntry {
  tape:   string[]
  head:   number
  state:  string
  status: TmStatus
}

export interface TmSimState {
  input:  string
  tape:   string[]
  head:   number
  state:  string            // current state ID (single — TMs are deterministic)
  status: TmStatus
  log:    TmLogEntry[]
  history: TmHistoryEntry[]
}

// ── Transition label parser ────────────────────────────────────────────────────
// Format: "read→write,dir" e.g. "a→X,R" or "_→_,S"

export function parseTmLabel(label: string): { read: string; write: string; dir: 'L' | 'R' | 'S' } | null {
  const match = label.match(/^(.)→(.),([LRS])$/)
  if (!match) return null
  return { read: match[1], write: match[2], dir: match[3] as 'L' | 'R' | 'S' }
}

export function makeTmLabel(read: string, write: string, dir: 'L' | 'R' | 'S'): string {
  return `${read}→${write},${dir}`
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveTransition(
  stateId: string, readSym: string, transitions: FATransition[]
): FATransition | null {
  for (const t of transitions) {
    if (t.fromId !== stateId) continue
    const parsed = parseTmLabel(t.label)
    if (parsed && parsed.read === readSym) return t
  }
  return null
}

function makeInitial(input: string, initialId: string | null): TmSimState {
  if (!initialId) {
    return { input, tape: [BLANK], head: 0, state: '', status: 'idle', log: [], history: [] }
  }
  // Tape: blank + input + blanks for room to move
  const tape = [BLANK, BLANK, ...input.split(''), BLANK, BLANK, BLANK]
  const head = 2 // start at first real character
  return {
    input, tape, head,
    state:  initialId,
    status: 'running',
    log:    [],
    history: [],
  }
}

function ensureTapeBounds(tape: string[], head: number): { tape: string[]; head: number } {
  const t = [...tape]
  let h = head
  while (h < 0) { t.unshift(BLANK); h++ }
  while (h >= t.length) t.push(BLANK)
  return { tape: t, head: h }
}

function isFinalState(stateId: string, states: FAState[]): boolean {
  return states.some(s => s.id === stateId && s.isFinal)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTmSimulator(
  states:      FAState[],
  transitions: FATransition[],
  initialId:   string | null,
) {
  const [sim, setSim] = useState<TmSimState>(() =>
    makeInitial('', initialId)
  )

  const setInput = useCallback((input: string) => {
    setSim(makeInitial(input, initialId))
  }, [initialId])

  const reset = useCallback(() => {
    setSim(prev => makeInitial(prev.input, initialId))
  }, [initialId])

  const step = useCallback(() => {
    setSim(prev => {
      if (prev.status !== 'running') return prev
      if (!prev.state) return { ...prev, status: 'idle' }

      // Save snapshot for step-back
      const snap: TmHistoryEntry = {
        tape: [...prev.tape], head: prev.head,
        state: prev.state, status: prev.status,
      }

      const readSym = prev.tape[prev.head] ?? BLANK
      const rule = resolveTransition(prev.state, readSym, transitions)

      if (!rule) {
        // No transition → halt (reject if not in final state)
        const accepted = isFinalState(prev.state, states)
        return {
          ...prev,
          status: accepted ? 'accepted' : 'halted',
          log: [...prev.log, {
            read: readSym, write: readSym, dir: 'S',
            fromState: prev.state, toState: prev.state,
          }],
          history: [...prev.history, snap],
        }
      }

      const parsed = parseTmLabel(rule.label)!
      const newTape = [...prev.tape]
      newTape[prev.head] = parsed.write

      let newHead = prev.head
      if (parsed.dir === 'R') newHead++
      else if (parsed.dir === 'L') newHead--

      const bounded = ensureTapeBounds(newTape, newHead)
      const accepted = isFinalState(rule.toId, states)

      return {
        ...prev,
        tape:   bounded.tape,
        head:   bounded.head,
        state:  rule.toId,
        status: accepted ? 'accepted' : 'running',
        log: [...prev.log, {
          read: readSym, write: parsed.write, dir: parsed.dir,
          fromState: prev.state, toState: rule.toId,
        }],
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
        tape:   last.tape,
        head:   last.head,
        state:  last.state,
        status: last.status,
        log:    prev.log.slice(0, -1),
        history: prev.history.slice(0, -1),
      }
    })
  }, [])

  const run = useCallback(() => {
    setSim(prev => {
      if (prev.status !== 'running' || !prev.state) return prev

      let { tape, head, state } = prev
      const log    = [...prev.log]
      const history = [...prev.history]

      // Max 1000 steps to prevent infinite loops
      for (let i = 0; i < 1000; i++) {
        if (!state) break
        const readSym = tape[head] ?? BLANK
        const rule = resolveTransition(state, readSym, transitions)
        if (!rule) break

        history.push({ tape: [...tape], head, state, status: 'running' })

        const parsed = parseTmLabel(rule.label)!
        tape = [...tape]
        tape[head] = parsed.write
        if (parsed.dir === 'R') head++
        else if (parsed.dir === 'L') head--

        const bounded = ensureTapeBounds(tape, head)
        tape = bounded.tape
        head = bounded.head

        log.push({
          read: readSym, write: parsed.write, dir: parsed.dir,
          fromState: state, toState: rule.toId,
        })
        state = rule.toId
      }

      const accepted = isFinalState(state, states)
      const status: TmStatus = accepted ? 'accepted' : 'halted'

      return { ...prev, tape, head, state, status, log, history }
    })
  }, [transitions, states])

  return { sim, setInput, step, stepBack, run, reset }
}
