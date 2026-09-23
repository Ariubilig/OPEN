import { useEffect, useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router'
import { copy } from '../copy'
import Footer from './Footer'
import Header from './Header'

// We restore scroll ourselves (per history entry), so the browser should not.
if (typeof history !== 'undefined') history.scrollRestoration = 'manual'

export default function Layout() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const currentKey = useRef(location.key)
  const previousPath = useRef(location.pathname)
  const mainRef = useRef<HTMLElement>(null)

  // Remember the scroll position of each history entry: while scrolling, and again at the moment
  // a navigation starts (a click on a link / "Буцах", or browser back/forward), which runs before
  // React renders the next page. Entries are keyed by whichever page is current at that moment.
  useEffect(() => {
    const save = () => positions.current.set(currentKey.current, window.scrollY)
    window.addEventListener('scroll', save, { passive: true })
    document.addEventListener('click', save, true)
    window.addEventListener('popstate', save)
    return () => {
      window.removeEventListener('scroll', save)
      document.removeEventListener('click', save, true)
      window.removeEventListener('popstate', save)
    }
  }, [])

  useLayoutEffect(() => {
    currentKey.current = location.key
    const pageChanged = previousPath.current !== location.pathname
    previousPath.current = location.pathname
    const saved = positions.current.get(location.key)
    // Back/forward → where the reader was (e.g. the feed after "Буцах").
    // New page → top. Query-only changes (feed filters) keep the position.
    if (navigationType === 'POP' && saved !== undefined) {
      window.scrollTo(0, saved)
    } else if (pageChanged) {
      window.scrollTo(0, 0)
    }
    // Move focus into the new page so screen readers and keyboard users start there.
    if (pageChanged) mainRef.current?.focus({ preventScroll: true })
  }, [location.key, location.pathname, navigationType])

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-card focus:bg-surface focus:px-4 focus:py-3 focus:text-accent"
      >
        {copy.a11y.skipToContent}
      </a>
      <Header />
      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        className="flex-1 focus:outline-none"
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
