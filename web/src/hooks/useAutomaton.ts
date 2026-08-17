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

export interface FATransition {
  id:     string
  fromId: string
  toId:   string
  label:  string
}

interface AutomatonData {
  states:      FAState[]
  transitions: FATransition[]
  initialId:   string | null
  selectedId:  string | null
}

type Action =
  | { type: 'ADD_STATE';    id: string; label: string; x: number; y: number }
  | { type: 'MOVE_STATE';   id: string; x: number; y: number }
  | { type: 'DELETE_STATE'; id: string }
  | { type: 'TOGGLE_FINAL'; id: string }
  | { type: 'RENAME_STATE'; id: string; label: string }
  | { type: 'SET_INITIAL';  id: string | null }
  | { type: 'ADD_TRANSITION';    id: string; fromId: string; toId: string; label: string }
  | { type: 'DELETE_TRANSITION'; id: string }
  | { type: 'SELECT';            id: string | null }
  | { type: 'DELETE_SELECTED' }
  | { type: 'LOAD'; states: FAState[]; transitions: FATransition[]; initialId: string | null }

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(data: AutomatonData, action: Action): AutomatonData {
  switch (action.type) {

    case 'ADD_STATE':
      return {
        ...data,
        states: [...data.states, {
          id: action.id, label: action.label,
          x: action.x, y: action.y, isFinal: false,
        }],
        initialId:  data.initialId  ?? action.id,
        selectedId: action.id,
      }

    case 'MOVE_STATE':
      return {
        ...data,
        states: data.states.map(s =>
          s.id === action.id ? { ...s, x: action.x, y: action.y } : s
        ),
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

    case 'ADD_TRANSITION':
      return {
        ...data,
        transitions: [...data.transitions, {
          id: action.id, fromId: action.fromId,
          toId: action.toId, label: action.label,
        }],
        selectedId: action.id,
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
      }

    default: return data
  }
}

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'zflap-automaton'

function loadFromStorage(): Pick<AutomatonData, 'states' | 'transitions' | 'initialId'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* corrupted — ignore */ }
  return { states: [], transitions: [], initialId: null }
}

function saveToStorage(data: AutomatonData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      states:      data.states,
      transitions: data.transitions,
      initialId:   data.initialId,
    }))
  } catch { /* quota exceeded or private mode */ }
}

function nextId(ids: string[], prefix: string): number {
  const nums = ids.map(id => parseInt(id.slice(prefix.length))).filter(n => !isNaN(n))
  return nums.length === 0 ? 0 : Math.max(...nums) + 1
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAutomaton(opts?: { persistLocal?: boolean }) {
  const persistLocal = opts?.persistLocal ?? true

  const [data, dispatch] = useReducer(reducer, null, () => {
    const saved = loadFromStorage()
    return { ...saved, selectedId: null }
  })

  const sidRef = useRef(nextId(data.states.map(s => s.id), 's'))
  const tidRef = useRef(nextId(data.transitions.map(t => t.id), 't'))

  // Debounced save — 300ms so rapid drag moves don't thrash localStorage
  useEffect(() => {
    if (!persistLocal) return
    const id = setTimeout(() => saveToStorage(data), 300)
    return () => clearTimeout(id)
  }, [data, persistLocal])

  const addState = useCallback((x: number, y: number) => {
    const n = sidRef.current++
    dispatch({ type: 'ADD_STATE', id: `s${n}`, label: `q${n}`, x, y })
  }, [])

  const moveState = useCallback((id: string, x: number, y: number) => {
    dispatch({ type: 'MOVE_STATE', id, x, y })
  }, [])

  const deleteState = useCallback((id: string) => {
    dispatch({ type: 'DELETE_STATE', id })
  }, [])

  const toggleFinal = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_FINAL', id })
  }, [])

  const renameState = useCallback((id: string, label: string) => {
    dispatch({ type: 'RENAME_STATE', id, label })
  }, [])

  const setInitial = useCallback((id: string | null) => {
    dispatch({ type: 'SET_INITIAL', id })
  }, [])

  const addTransition = useCallback((fromId: string, toId: string, label: string) => {
    const n = tidRef.current++
    dispatch({ type: 'ADD_TRANSITION', id: `t${n}`, fromId, toId, label })
  }, [])

  const deleteTransition = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRANSITION', id })
  }, [])

  const select = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT', id })
  }, [])

  const deleteSelected = useCallback(() => {
    dispatch({ type: 'DELETE_SELECTED' })
  }, [])

  const load = useCallback((loaded: Pick<AutomatonData, 'states' | 'transitions' | 'initialId'>) => {
    dispatch({ type: 'LOAD', ...loaded })
    sidRef.current = nextId(loaded.states.map(s => s.id), 's')
    tidRef.current = nextId(loaded.transitions.map(t => t.id), 't')
  }, [])

  return {
    ...data,
    addState,
    moveState,
    deleteState,
    toggleFinal,
    renameState,
    setInitial,
    addTransition,
    deleteTransition,
    select,
    deleteSelected,
    load,
  }
}

export type UseAutomatonReturn = ReturnType<typeof useAutomaton>

// ── Classification helper ─────────────────────────────────────────────────────

export function classifyAutomaton(
  states: FAState[], transitions: FATransition[], initialId: string | null
): { label: string; color: 'green' | 'orange' | 'dim' } {
  if (states.length === 0)  return { label: 'Empty',          color: 'dim'    }
  if (!initialId)           return { label: 'No initial state', color: 'dim'  }

  const hasEps = transitions.some(t => t.label === 'ε' || t.label === '')
  if (hasEps) return { label: 'ε-NFA', color: 'orange' }

  const syms = [...new Set(transitions.map(t => t.label))]
  const isNFA = states.some(st =>
    syms.some(sym =>
      transitions.filter(t => t.fromId === st.id && t.label === sym).length > 1
    )
  )
  return isNFA
    ? { label: 'NFA', color: 'orange' }
    : { label: 'DFA', color: 'green'  }
}
