import { Link, NavLink, useLocation } from 'react-router'
import { copy } from '../copy'
import Wordmark from './Wordmark'

// display is set per link: the home link only shows from md (the wordmark is home on phones)
function navClass({ isActive }: { isActive: boolean }) {
  return `min-h-11 items-center rounded-full px-3.5 text-small font-semibold transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink hover:bg-surface'
  }`
}

export default function Header() {
  // The feed sets the tagline as its headline; other pages show it next to the wordmark (≥ 768px).
  const onFeed = useLocation().pathname === '/'
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-15 max-w-page items-center justify-between gap-4 px-4 md:h-18 md:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link to="/" className="inline-flex min-h-11 shrink-0 items-center">
            <Wordmark />
          </Link>
          {!onFeed && (
            <p className="hidden truncate text-small font-semibold text-muted md:block">
              {copy.tagline}
            </p>
          )}
        </div>
        <nav aria-label={copy.a11y.mainNav} className="flex items-center gap-1">
          <NavLink
            to="/"
            end
            className={(s) => `hidden md:inline-flex ${navClass(s)}`}
          >
            {copy.nav.home}
          </NavLink>
          <NavLink to="/about" className={(s) => `inline-flex ${navClass(s)}`}>
            {copy.nav.about}
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
