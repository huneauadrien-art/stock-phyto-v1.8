import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Movement, Parcel, Preparation, Product, Treatment } from '../types'

type TableName = 'products' | 'movements' | 'preparations' | 'treatments' | 'parcels'

type CloudRow<T> = { id: string; data: T }

async function loadTable<T>(table: TableName): Promise<T[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from(table).select('id,data').order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as CloudRow<T>[]).map((row) => row.data)
}

async function replaceTable<T extends { id: string }>(table: TableName, user: User, values: T[]) {
  if (!supabase) return
  const { data: existing, error: readError } = await supabase.from(table).select('id')
  if (readError) throw readError
  const existingIds = new Set((existing ?? []).map((row) => row.id as string))
  const nextIds = new Set(values.map((value) => value.id))
  const idsToDelete = [...existingIds].filter((id) => !nextIds.has(id))

  if (values.length) {
    const { error } = await supabase.from(table).upsert(
      values.map((value) => ({ id: value.id, user_id: user.id, data: value, updated_at: new Date().toISOString() })),
    )
    if (error) throw error
  }
  if (idsToDelete.length) {
    const { error } = await supabase.from(table).delete().in('id', idsToDelete)
    if (error) throw error
  }
}

export async function loadCloudData() {
  const [products, movements, preparations, treatments, parcels] = await Promise.all([
    loadTable<Product>('products'),
    loadTable<Movement>('movements'),
    loadTable<Preparation>('preparations'),
    loadTable<Treatment>('treatments'),
    loadTable<Parcel>('parcels'),
  ])
  return { products, movements, preparations, treatments, parcels }
}

export const cloud = {
  saveProducts: (user: User, values: Product[]) => replaceTable('products', user, values),
  saveMovements: (user: User, values: Movement[]) => replaceTable('movements', user, values),
  savePreparations: (user: User, values: Preparation[]) => replaceTable('preparations', user, values),
  saveTreatments: (user: User, values: Treatment[]) => replaceTable('treatments', user, values),
  saveParcels: (user: User, values: Parcel[]) => replaceTable('parcels', user, values),
}
