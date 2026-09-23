import { APP_NAME } from '../config'

/** APP_NAME on a tilted highlighter stroke (a lettermark, never an emblem or logo). */
export default function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-block -rotate-2 rounded-lg bg-highlight px-2.5 pt-[3px] pb-[5px] leading-none font-extrabold tracking-[-0.03em] text-ink ${
        size === 'sm' ? 'text-[22px]' : 'text-[24px] md:text-[28px]'
      }`}
    >
      {APP_NAME}
    </span>
  )
}
