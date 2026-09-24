import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { copy } from '../copy'
import { scrollBehavior } from '../lib/motion'
import Icon from './Icon'
import { SEARCH_ID } from './SearchField'
import Wordmark from './Wordmark'

// display is set per link: the home link only shows from md (the wordmark is home on phones)
function navClass({ isActive }: { isActive: boolean }) {
  return `min-h-11 items-center rounded-full px-3.5 text-small font-semibold transition-colors ${
    isActive ? 'bg-ink text-white' : 'text-ink hover:bg-surface'
  }`
}

/** Search from any page: on the feed it focuses the search box, elsewhere it opens the feed first. */
function SearchButton() {
  const navigate = useNavigate()
  const onFeed = useLocation().pathname === '/'
  return (
    <button
      type="button"
      aria-label={copy.nav.search}
      title={copy.nav.search}
      onClick={() => {
        const input = document.getElementById(SEARCH_ID)
        if (onFeed && input) {
          input.focus({ preventScroll: true })
          input.scrollIntoView({ block: 'center', behavior: scrollBehavior() })
        } else {
          navigate('/', { state: { focusSearch: true } })
        }
      }}
      className="inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
    >
      <Icon name="search" className="size-5" />
    </button>
  )
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
          <SearchButton />
        </nav>
      </div>
    </header>
  )
}
