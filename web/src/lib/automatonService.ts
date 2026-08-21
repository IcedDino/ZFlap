import { supabase } from './supabase'
import type { FAState, FATransition, AutomatonType } from '../hooks/useAutomaton'

export interface AutomatonPayload {
  states:      FAState[]
  transitions: FATransition[]
  initialId:   string | null
  automatonType?: AutomatonType
  regex?: string
}

export interface AutomatonRow {
  id:         string
  owner_id:   string
  name:       string
  data:       AutomatonPayload
  is_public:  boolean
  created_at: string
  updated_at: string
}

export async function listMine(): Promise<AutomatonRow[]> {
  const { data, error } = await supabase
    .from('automatons')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as AutomatonRow[]
}

export async function getById(id: string): Promise<AutomatonRow | null> {
  const { data, error } = await supabase
    .from('automatons')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as AutomatonRow | null
}

export async function create(name: string, data: AutomatonPayload): Promise<AutomatonRow> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: row, error } = await supabase
    .from('automatons')
    .insert({ name, data, owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return row as AutomatonRow
}

export async function update(id: string, patch: { name?: string; data?: AutomatonPayload }): Promise<void> {
  const { error } = await supabase.from('automatons').update(patch).eq('id', id)
  if (error) throw error
}

export async function setPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from('automatons').update({ is_public: isPublic }).eq('id', id)
  if (error) throw error
}

export async function remove(id: string): Promise<void> {
  const { error } = await supabase.from('automatons').delete().eq('id', id)
  if (error) throw error
}
