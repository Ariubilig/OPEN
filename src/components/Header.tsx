import { Link, NavLink } from 'react-router'
import { copy } from '../copy'
import Wordmark from './Wordmark'

// display is set per link: the home link only shows from md (the wordmark is home on phones)
function navClass({ isActive }: { isActive: boolean }) {
  return `min-h-11 items-center rounded-full px-3.5 text-small font-semibold transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink hover:bg-surface'
  }`
}

export default function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-15 max-w-page items-center justify-between gap-4 px-4 md:h-18 md:px-8">
        <Link to="/" className="inline-flex min-h-11 items-center">
          <Wordmark />
        </Link>
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
