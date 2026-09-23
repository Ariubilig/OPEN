import { Link } from 'react-router'
import { copy } from '../copy'

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-small text-muted">
        <p className="font-semibold text-ink">{copy.principle}</p>
        <p>{copy.footer.prototype}</p>
        <p className="flex flex-wrap items-center gap-x-2">
          <span>{copy.footer.event}</span>
          <span aria-hidden="true">·</span>
          <Link
            to="/about"
            className="inline-flex min-h-11 items-center text-accent underline underline-offset-2"
          >
            {copy.nav.about}
          </Link>
        </p>
      </div>
    </footer>
  )
}
