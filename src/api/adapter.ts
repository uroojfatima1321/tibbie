import type { TibbieData } from '../types'
import { api } from './client'

/**
 * DataAdapter abstracts away the data source. Current impl: Netlify Functions
 * → Netlify Blobs. Swap this module's default export to migrate to Neon,
 * Google Sheets, Supabase, or any other backend without touching components.
 *
 * Satisfies US-17: data source is swappable without a code rewrite.
 */
export interface DataAdapter {
  load(): Promise<TibbieData>
  save(data: TibbieData): Promise<void>
  readonly name: string
}

const netlifyBlobsAdapter: DataAdapter = {
  name: 'netlify-blobs',
  load: () => api.getData(),
  save: async (data) => { await api.putData(data) },
}

// Switch this line to swap storage backends:
export const adapter: DataAdapter = netlifyBlobsAdapter
