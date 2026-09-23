import { useParams } from 'react-router'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function Story() {
  const { id } = useParams()
  useDocumentTitle(id)
  return <div className="mx-auto max-w-reading px-4 pt-8" />
}
