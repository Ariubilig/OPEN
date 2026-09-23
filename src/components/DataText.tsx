import { Fragment } from 'react'
import { TODO } from '../data/schema'
import Placeholder from './Placeholder'

/**
 * Renders any string that comes from data. Every TODO_VERIFY — the whole value or a token
 * inside it ("…зүйл, заалт: TODO_VERIFY") — becomes a visible placeholder.
 */
export default function DataText({ value }: { value: string }) {
  if (!value.includes(TODO)) return <>{value}</>
  const parts = value.split(TODO)
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <Placeholder />}
        </Fragment>
      ))}
    </>
  )
}
