import { Link, NavLink } from 'react-router'
import { APP_NAME } from '../config'
import { copy } from '../copy'

export default function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link
            to="/"
            className="inline-flex min-h-14 items-center font-serif text-[26px] leading-none font-bold text-ink"
          >
            {APP_NAME}
          </Link>
          <span className="hidden truncate text-small text-muted md:inline">
            {copy.tagline}
          </span>
        </div>
        <nav aria-label={copy.a11y.mainNav}>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center rounded-full px-3 text-small font-semibold ${
                isActive
                  ? 'bg-accent-soft text-accent'
                  : 'text-ink hover:text-accent'
              }`
            }
          >
            {copy.nav.about}
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
