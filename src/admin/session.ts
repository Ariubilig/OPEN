import {
  redirect,
  useRouteLoaderData,
  type LoaderFunctionArgs,
} from 'react-router'
import { maybe, supabase, type StaffMember } from './supabase'

export type StaffSession = {
  email: string
  /** null: signed in, but not on the team */
  staff: StaffMember | null
}

/** Only paths inside the admin are followed after sign-in (no open redirect). */
export function safeNext(next: string | null): string {
  return next && /^\/admin(\/|$|\?)/.test(next) && !next.startsWith('//')
    ? next
    : '/admin'
}

/** Guard for every staff page: no session → sign-in page, with the way back in `next`. */
export async function staffLoader({
  request,
}: LoaderFunctionArgs): Promise<StaffSession> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    const url = new URL(request.url)
    throw redirect(
      `/admin/login?next=${encodeURIComponent(url.pathname + url.search)}`,
    )
  }
  const staff = await maybe(
    supabase
      .from('staff')
      .select('user_id, name, role')
      .eq('user_id', session.user.id)
      .maybeSingle(),
  )
  return { email: session.user.email ?? '', staff }
}

export function useStaffSession(): StaffSession {
  const data = useRouteLoaderData('staff') as StaffSession | undefined
  if (!data) throw new Error('useStaffSession() needs the staff route loader')
  return data
}

/** The signed-in team member (staff pages only render for team members). */
export function useStaff(): StaffMember {
  const { staff } = useStaffSession()
  if (!staff) throw new Error('useStaff() outside a team member session')
  return staff
}
