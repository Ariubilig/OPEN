import { useRouteLoaderData } from 'react-router'
import type { SiteData } from './api'

/** Channels and tax rules, loaded once by the root route. */
export function useSite(): SiteData {
  const data = useRouteLoaderData('root') as SiteData | undefined
  if (!data) throw new Error('useSite() needs the root route loader')
  return data
}
