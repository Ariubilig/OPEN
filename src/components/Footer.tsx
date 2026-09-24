import { Link } from 'react-router'
import { copy } from '../copy'
import { channels } from '../data'
import { today } from '../lib/format'
import DataText from './DataText'
import Icon from './Icon'
import Wordmark from './Wordmark'

/** Principle, the official channels we send people to, and who we are (not an official site). */
export default function Footer() {
  const year = today().slice(0, 4)
  const linked = channels.filter((c) => c.url !== null)
  return (
    <footer className="on-ink mt-12 bg-ink text-on-ink md:mt-24">
      <div className="mx-auto max-w-page px-4 pt-7 pb-9 md:px-8 md:pt-12 md:pb-10">
        <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,auto)] md:gap-16">
          <div className="flex flex-col items-start gap-3.5 md:gap-[18px]">
            <Wordmark size="sm" />
            <p className="mt-1 max-w-[460px] text-[17px] leading-6 font-semibold md:mt-0 md:text-[20px] md:leading-7">
              {copy.principle}
            </p>
          </div>
          {linked.length > 0 && (
            <nav aria-labelledby="footer-channels" className="min-w-0">
              <p id="footer-channels" className="eyebrow text-on-ink-3">
                {copy.footer.channels}
              </p>
              <ul className="mt-1.5 flex flex-col">
                {linked.map((c) => (
                  <li key={c.id}>
                    <a
                      href={c.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-small font-semibold text-on-ink hover:text-highlight md:min-h-10"
                    >
                      <span>
                        <DataText value={c.name} />
                        <Icon
                          name="externalLink"
                          className="ml-1.5 inline size-3.5 align-[-0.125em] text-on-ink-3"
                        />
                        <span className="sr-only"> ({copy.a11y.newTab})</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <div className="mt-7 flex flex-col gap-1 border-t border-ink-line pt-5 text-small md:mt-10 md:flex-row md:items-center md:justify-between md:gap-8">
          <p className="font-semibold">{copy.footer.independent}</p>
          <p className="flex shrink-0 flex-wrap items-center gap-x-2 text-on-ink-2">
            <span>{copy.footer.copyright(year)}</span>
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
