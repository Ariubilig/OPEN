// /admin/*: keeps search engines out of the admin (robots.txt says the same).
import { useEffect } from 'react'
import { Outlet } from 'react-router'

export function Component() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.append(meta)
    return () => meta.remove()
  }, [])
  return <Outlet />
}
