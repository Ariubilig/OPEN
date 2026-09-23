import { Link } from 'react-router'
import { copy } from '../copy'
import Wordmark from './Wordmark'

export default function Footer() {
  return (
    <footer className="on-ink mt-12 bg-ink text-on-ink md:mt-24">
      <div className="mx-auto grid max-w-page gap-3.5 px-4 pt-7 pb-9 md:grid-cols-2 md:gap-16 md:px-8 md:pt-12 md:pb-14">
        <div className="flex flex-col items-start gap-3.5 md:gap-[18px]">
          <Wordmark size="sm" />
          <p className="mt-1 max-w-[460px] text-[17px] leading-6 font-semibold md:mt-0 md:text-[20px] md:leading-7">
            {copy.principle}
          </p>
        </div>
        <div className="flex flex-col gap-2.5 text-small">
          <p className="font-semibold">{copy.footer.prototype}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-on-ink-2">
            <span>{copy.footer.event}</span>
            <span aria-hidden="true">·</span>
            <Link
              to="/about"
              className="inline-flex min-h-11 items-center text-highlight underline underline-offset-3 hover:no-underline"
            >
              {copy.nav.about}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
