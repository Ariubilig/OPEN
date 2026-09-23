import { createContext, useContext } from 'react'
import type { Source } from '../data/schema'

export type SourceSheetApi = {
  /** Marker number for each source id (see numberSources) */
  numbers: Map<string, number>
  sources: Map<string, Source>
  /** Open the sheet for one cited sentence; focus returns to `trigger` on close. */
  open: (sourceId: string, sentence: string, trigger: HTMLElement) => void
}

export const SourceSheetContext = createContext<SourceSheetApi | null>(null)

export function useSourceSheet(): SourceSheetApi {
  const api = useContext(SourceSheetContext)
  if (!api) throw new Error('useSourceSheet() needs a <SourceSheetProvider>')
  return api
}
