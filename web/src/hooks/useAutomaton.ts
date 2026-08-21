import { useReducer, useCallback, useRef, useEffect } from 'react'

export const STATE_R   = 64   // circle radius (world units)
export const FINAL_GAP = 16   // extra radius for final-state outer ring

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FAState {
  id:      string
  label:   string
  x:       number
  y:       number
  isFinal: boolean
}

export type FATransitionKind = 'symbol' | 'range'

export type AutomatonType = 'dfa' | 'nfa' | 'tm-deterministic' | 'tm-nondeterministic' | 'regex'

export interface FATransition {
  id:         string
  fromId:     string
  toId:       string
  label:      string
  /**
   * `symbol` is the legacy/default representation. `range` keeps one
   * visual/semantic transition while matching every character in the range.
   * Older saved automata may omit this field; they are treated as symbols.
   */
  kind?:      FATransitionKind
  rangeStart?: string
  rangeEnd?:   string
}

interface AutomatonData {
  states:        FAState[]
  transitions:   FATransition[]
  initialId:     string | null
  selectedId:    string | null
  automatonType: AutomatonType
  regex: string
}

type Action =
  | { type: 'ADD_STATE';    id: string; label: string; x: number; y: number }
  | { type: 'MOVE_STATE';   id: string; x: number; y: number }
  | { type: 'MOVE_STATES';  updates: { id: string; x: number; y: number }[] }
  | { type: 'DELETE_STATE'; id: string }
  | { type: 'TOGGLE_FINAL'; id: string }
  | { type: 'RENAME_STATE'; id: string; label: string }
  | { type: 'SET_INITIAL';  id: string | null }
  | { type: 'ADD_TRANSITION';    id: string; fromId: string; toId: string; label: string; kind?: FATransitionKind; rangeStart?: string; rangeEnd?: string }
  | { type: 'EDIT_TRANSITION';   id: string; label: string; kind?: FATransitionKind; rangeStart?: string; rangeEnd?: string }
  | { type: 'DELETE_TRANSITION'; id: string }
  | { type: 'SELECT';            id: string | null }
  | { type: 'DELETE_SELECTED' }
  | { type: 'LOAD'; states: FAState[]; transitions: FATransition[]; initialId: string | null; automatonType?: AutomatonType; regex?: string }

// Broadcastable over the network to other live collaborators — excludes
// SELECT (per-user local UI state), LOAD (initial fetch only, would
// clobber other clients' in-progress state), and DELETE_SELECTED (means
// "delete whatever *my* selectedId is" — meaningless to a peer whose
// selection isn't synced; deleteSelected() below resolves it to a
// concrete DELETE_STATE/DELETE_TRANSITION before broadcasting instead).
export type RemoteAction = Exclude<Action, { type: 'SELECT' } | { type: 'LOAD' } | { type: 'DELETE_SELECTED' }>


function transitionTokens(label: string): string[] {
  return label.split(',').map(token => token.trim()).filter(Boolean)
}

function tokenCoversSymbol(token: string, symbol: string): boolean {
  if (token === symbol) return true
  const match = token.match(/^(.)(?:\s*-\s*)(.)$/)
  if (!match || symbol.length !== 1) return false
  const a = match[1].charCodeAt(0)
  const b = match[2].charCodeAt(0)
  const code = symbol.charCodeAt(0)
  return a <= code && code <= b
}

function mergeTransitionLabels(existing: string, incoming: string): { label: string; changed: boolean } {
  const oldTokens = transitionTokens(existing)
  const newTokens = transitionTokens(incoming)
  const result = [...oldTokens]
  let changed = false
  for (const token of newTokens) {
    const duplicate = result.some(existingToken =>
      existingToken === token || tokenCoversSymbol(existingToken, token)
    )
    if (!duplicate) {
      result.unshift(token)
      changed = true
    }
  }
  return { label: result.join(','), changed }
}

function transitionKindForLabel(label: string): FATransitionKind | undefined {
  return /^.(?:\s*-\s*).$/.test(label.trim()) && !label.includes(',') ? 'range' : undefined
}

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(data: AutomatonData, action: Action): AutomatonData {
  switch (action.type) {

    case 'ADD_STATE':
      // Doesn't touch selectedId — selection is per-user, not part of the
      // shared graph. addState() below dispatches a local-only SELECT
      // follow-up so the person who added it sees it selected, without
      // hijacking a remote peer's selection when this arrives via
      // applyRemote (both paths go through this same reducer).
      return {
        ...data,
        states: [...data.states, {
          id: action.id, label: action.label,
          x: action.x, y: action.y, isFinal: false,
        }],
        initialId: data.initialId ?? action.id,
      }

    case 'MOVE_STATE':
      return {
        ...data,
        states: data.states.map(s =>
          s.id === action.id ? { ...s, x: action.x, y: action.y } : s
        ),
      }

    case 'MOVE_STATES': {
      const updates = new Map(action.updates.map(update => [update.id, update]))
      return {
        ...data,
        states: data.states.map(s => {
          const update = updates.get(s.id)
          return update ? { ...s, x: update.x, y: update.y } : s
        }),
      }
    }

    case 'DELETE_STATE':
      return {
        ...data,
        states:      data.states.filter(s => s.id !== action.id),
        transitions: data.transitions.filter(t => t.fromId !== action.id && t.toId !== action.id),
        initialId:   data.initialId  === action.id ? null : data.initialId,
        selectedId:  data.selectedId === action.id ? null : data.selectedId,
      }

    case 'TOGGLE_FINAL':
      return {
        ...data,
        states: data.states.map(s =>
          s.id === action.id ? { ...s, isFinal: !s.isFinal } : s
        ),
      }

    case 'RENAME_STATE':
      return {
        ...data,
        states: data.states.map(s =>
          s.id === action.id ? { ...s, label: action.label } : s
        ),
      }

    case 'SET_INITIAL':
      return { ...data, initialId: action.id }

    case 'ADD_TRANSITION': {
      const incomingLabel = action.kind === 'range' && action.rangeStart && action.rangeEnd
        ? `${action.rangeStart}-${action.rangeEnd}`
        : action.label
      const existing = data.transitions.find(t => t.fromId === action.fromId && t.toId === action.toId)
      if (!existing) {
        return {
          ...data,
          transitions: [...data.transitions, {
            id: action.id, fromId: action.fromId, toId: action.toId, label: incomingLabel,
            kind: action.kind === 'range' ? 'range' : transitionKindForLabel(incomingLabel),
            rangeStart: action.kind === 'range' ? action.rangeStart : undefined,
            rangeEnd: action.kind === 'range' ? action.rangeEnd : undefined,
          }],
        }
      }
      const merged = mergeTransitionLabels(existing.label, incomingLabel)
      if (!merged.changed) return data
      return {
        ...data,
        transitions: data.transitions.map(t => t.id === existing.id
          ? { ...t, label: merged.label, kind: transitionKindForLabel(merged.label), rangeStart: undefined, rangeEnd: undefined }
          : t
        ),
      }
    }

    case 'EDIT_TRANSITION':
      return {
        ...data,
        transitions: data.transitions.map(t =>
          t.id === action.id
            ? {
                ...t,
                label: action.label,
                kind: action.kind,
                rangeStart: action.rangeStart,
                rangeEnd: action.rangeEnd,
              }
            : t
        ),
      }

    case 'DELETE_TRANSITION':
      return {
        ...data,
        transitions: data.transitions.filter(t => t.id !== action.id),
        selectedId:  data.selectedId === action.id ? null : data.selectedId,
      }

    case 'SELECT':
      return { ...data, selectedId: action.id }

    case 'DELETE_SELECTED': {
      const id = data.selectedId
      if (!id) return data
      if (data.states.some(s => s.id === id)) {
        return reducer(data, { type: 'DELETE_STATE', id })
      }
      if (data.transitions.some(t => t.id === id)) {
        return reducer(data, { type: 'DELETE_TRANSITION', id })
      }
      return data
    }

    case 'LOAD':
      return {
        states: action.states, transitions: action.transitions,
        initialId: action.initialId, selectedId: null,
        automatonType: action.automatonType ?? data.automatonType,
        regex: action.regex ?? data.regex,
      }

    default: return data
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'zflap-automaton'

function loadFromStorage(): Pick<AutomatonData, 'states' | 'transitions' | 'initialId' | 'automatonType' | 'regex'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted — ignore */ }
  return { states: [], transitions: [], initialId: null, automatonType: 'dfa', regex: '' }
}

function saveToStorage(data: AutomatonData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      states:      data.states,
      transitions: data.transitions,
      initialId:   data.initialId,
      automatonType: data.automatonType,
      regex: data.regex,
    }))
  } catch { /* quota exceeded or private mode */ }
}

// Called before navigating to a fresh /editor so the new session doesn't
// inherit whatever draft the last unsaved local session left behind.
export function clearLocalDraft() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// Numbers only the display label ("q0", "q1", ...) — ids are random
// UUIDs (see addState/addTransition below) so concurrent collaborators
// can never collide on one, unlike a locally-computed sequential id.
function nextLabelNum(labels: string[]): number {
  const nums = labels
    .filter(l => l.startsWith('q'))
    .map(l => parseInt(l.slice(1)))
    .filter(n => !isNaN(n))
  return nums.length === 0 ? 0 : Math.max(...nums) + 1
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutomaton(opts?: { persistLocal?: boolean; onAction?: (action: RemoteAction) => void }) {
  const persistLocal = opts?.persistLocal ?? true

  // Mirrored to a ref (same pattern DiagramCanvas uses for its callback
  // props) so the dispatch wrappers below can keep stable `[]` deps
  // while still calling whatever onAction the caller passed most recently.
  const onActionRef = useRef(opts?.onAction)
  onActionRef.current = opts?.onAction

  const [data, dispatch] = useReducer(reducer, null, () => {
    const saved = loadFromStorage()
    return {
      states: saved.states ?? [],
      transitions: saved.transitions ?? [],
      initialId: saved.initialId ?? null,
      selectedId: null,
      automatonType: saved.automatonType ?? 'dfa',
      regex: saved.regex ?? '',
    }
  })

  const labelNumRef = useRef(nextLabelNum(data.states.map(s => s.label)))

  // Debounced save — 300ms so rapid drag moves don't thrash localStorage
  useEffect(() => {
    if (!persistLocal) return
    const id = setTimeout(() => saveToStorage(data), 300)
    return () => clearTimeout(id)
  }, [data, persistLocal])

  const addState = useCallback((x: number, y: number) => {
    const n = labelNumRef.current++
    const action: RemoteAction = { type: 'ADD_STATE', id: crypto.randomUUID(), label: `q${n}`, x, y }
    dispatch(action)
    dispatch({ type: 'SELECT', id: action.id }) // local-only, never broadcast
    onActionRef.current?.(action)
  }, [])

  const moveState = useCallback((id: string, x: number, y: number) => {
    const action: RemoteAction = { type: 'MOVE_STATE', id, x, y }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const moveStates = useCallback((updates: { id: string; x: number; y: number }[]) => {
    if (updates.length === 0) return
    const action: RemoteAction = { type: 'MOVE_STATES', updates }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const deleteState = useCallback((id: string) => {
    const action: RemoteAction = { type: 'DELETE_STATE', id }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const toggleFinal = useCallback((id: string) => {
    const action: RemoteAction = { type: 'TOGGLE_FINAL', id }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const renameState = useCallback((id: string, label: string) => {
    const action: RemoteAction = { type: 'RENAME_STATE', id, label }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const setInitial = useCallback((id: string | null) => {
    const action: RemoteAction = { type: 'SET_INITIAL', id }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const addTransition = useCallback((
    fromId: string,
    toId: string,
    label: string,
    kind: FATransitionKind = 'symbol',
    rangeStart?: string,
    rangeEnd?: string,
  ) => {
    const existing = data.transitions.find(t => t.fromId === fromId && t.toId === toId)
    const incomingLabel = kind === 'range' && rangeStart && rangeEnd ? `${rangeStart}-${rangeEnd}` : label
    if (existing && !mergeTransitionLabels(existing.label, incomingLabel).changed) {
      dispatch({ type: 'SELECT', id: existing.id })
      return
    }
    const action: RemoteAction = {
      type: 'ADD_TRANSITION',
      id: existing?.id ?? crypto.randomUUID(),
      fromId, toId, label: incomingLabel, kind, rangeStart, rangeEnd,
    }
    dispatch(action)
    dispatch({ type: 'SELECT', id: action.id })
    onActionRef.current?.(action)
  }, [data.transitions])

  const editTransition = useCallback((
    id: string,
    label: string,
    kind: FATransitionKind = 'symbol',
    rangeStart?: string,
    rangeEnd?: string,
  ) => {
    const action: RemoteAction = {
      type: 'EDIT_TRANSITION',
      id,
      label,
      kind,
      rangeStart,
      rangeEnd,
    }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const deleteTransition = useCallback((id: string) => {
    const action: RemoteAction = { type: 'DELETE_TRANSITION', id }
    dispatch(action)
    onActionRef.current?.(action)
  }, [])

  const select = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT', id })
  }, [])

  const setAutomatonType = useCallback((automatonType: AutomatonType) => {
    dispatch({ type: 'LOAD', states: data.states, transitions: data.transitions, initialId: data.initialId, automatonType, regex: data.regex })
  }, [data.states, data.transitions, data.initialId, data.regex])

  const setRegex = useCallback((regex: string) => {
    dispatch({ type: 'LOAD', states: data.states, transitions: data.transitions, initialId: data.initialId, automatonType: data.automatonType, regex })
  }, [data.states, data.transitions, data.initialId, data.automatonType])

  const deleteSelected = useCallback(() => {
    const id = data.selectedId
    dispatch({ type: 'DELETE_SELECTED' })
    if (!id) return
    if (data.states.some(s => s.id === id)) {
      onActionRef.current?.({ type: 'DELETE_STATE', id })
    } else if (data.transitions.some(t => t.id === id)) {
      onActionRef.current?.({ type: 'DELETE_TRANSITION', id })
    }
  }, [data])

  const load = useCallback((loaded: Pick<AutomatonData, 'states' | 'transitions' | 'initialId'> & { automatonType?: AutomatonType; regex?: string }) => {
    dispatch({ type: 'LOAD', ...loaded })
    labelNumRef.current = nextLabelNum(loaded.states.map(s => s.label))
  }, [])

  // Replays an action received from another live collaborator — bypasses
  // the wrappers above (and their onAction mirroring) since the action
  // already carries its final id; re-broadcasting it would echo forever.
  const applyRemote = useCallback((action: RemoteAction) => {
    dispatch(action)
  }, [])

  return {
    ...data,
    addState,
    moveState,
    moveStates,
    deleteState,
    toggleFinal,
    renameState,
    setInitial,
    addTransition,
    editTransition,
    deleteTransition,
    select,
    setAutomatonType,
    setRegex,
    deleteSelected,
    load,
    applyRemote,
  }
}

export type UseAutomatonReturn = ReturnType<typeof useAutomaton>

// ── Range helpers ─────────────────────────────────────────────────────────────

export function isRangeKind(t: FATransition): boolean {
  return t.kind === 'range' && !!t.rangeStart && !!t.rangeEnd
}

export function transitionMatchesSymbol(t: FATransition, symbol: string): boolean {
  if (isRangeKind(t)) {
    const start = t.rangeStart!.charCodeAt(0)
    const end   = t.rangeEnd!.charCodeAt(0)
    const code  = symbol.charCodeAt(0)
    return symbol.length === 1 && start <= code && code <= end
  }
  return transitionTokens(t.label).some(token => tokenCoversSymbol(token, symbol))
}

function rangeCharacters(t: FATransition): string[] {
  if (!isRangeKind(t)) return []
  const start = t.rangeStart!.charCodeAt(0)
  const end   = t.rangeEnd!.charCodeAt(0)
  const chars: string[] = []
  for (let code = start; code <= end; code++) chars.push(String.fromCharCode(code))
  return chars
}

function transitionCharacterSet(t: FATransition): Set<string> {
  if (isRangeKind(t)) return new Set(rangeCharacters(t))
  const result = new Set<string>()
  for (const token of transitionTokens(t.label)) {
    if (token === 'ε') continue
    const range = token.match(/^(.)(?:\s*-\s*)(.)$/)
    if (range) {
      const a = range[1].charCodeAt(0), b = range[2].charCodeAt(0)
      for (let code = a; code <= b && code - a < 512; code++) result.add(String.fromCharCode(code))
    } else if (token.length === 1) result.add(token)
  }
  return result
}

function rangesOverlap(a: FATransition, b: FATransition): boolean {
  const aSet = transitionCharacterSet(a)
  const bSet = transitionCharacterSet(b)
  for (const symbol of aSet) if (bSet.has(symbol)) return true
  return false
}

// ── Classification helper ─────────────────────────────────────────────────────


export function detectAutomatonType(
  states: FAState[],
  transitions: FATransition[],
  initialId: string | null,
  declaredType: AutomatonType = 'dfa',
): AutomatonType {
  if (declaredType === 'regex') return 'regex'
  if (declaredType.startsWith('tm-')) {
    const readsByState = new Map<string, Set<string>>()
    for (const t of transitions) {
      const match = t.label.trim().match(/^(.+?)\s*\//)
      if (!match) continue
      const read = match[1].trim()
      if (!read) continue
      const reads = readsByState.get(t.fromId) ?? new Set<string>()
      if (reads.has(read)) return 'tm-nondeterministic'
      reads.add(read)
      readsByState.set(t.fromId, reads)
    }
    return 'tm-deterministic'
  }
  const detected = classifyAutomaton(states, transitions, initialId)
  return detected.label === 'DFA' ? 'dfa' : 'nfa'
}

export function classifyAutomaton(
  states: FAState[], transitions: FATransition[], initialId: string | null
): { label: string; color: 'green' | 'orange' | 'dim' } {
  if (states.length === 0)  return { label: 'Empty',            color: 'dim'    }
  if (!initialId)           return { label: 'No initial state', color: 'dim'    }

  const hasEps = transitions.some(t => t.label === 'ε' || t.label === '')
  if (hasEps) return { label: 'ε-NFA', color: 'orange' }

  const outgoingByState = new Map<string, FATransition[]>()
  for (const transition of transitions) {
    const outgoing = outgoingByState.get(transition.fromId)
    if (outgoing) outgoing.push(transition)
    else outgoingByState.set(transition.fromId, [transition])
  }

  const isNFA = states.some(st => {
    const outgoing = outgoingByState.get(st.id)
    if (!outgoing || outgoing.length < 2) return false
    for (let i = 0; i < outgoing.length; i++) {
      for (let j = i + 1; j < outgoing.length; j++) {
        if (rangesOverlap(outgoing[i], outgoing[j])) return true
      }
    }
    return false
  })

  return isNFA
    ? { label: 'NFA', color: 'orange' }
    : { label: 'DFA', color: 'green'  }
}
