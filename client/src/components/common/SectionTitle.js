import { ST, allPublicMessages } from './ST'

/** Home section heading: the translated default unless Admin wrote a custom title. */
export function SectionTitle({ section }) {
  const key = `home.section.${section.type}`
  const fallback = allPublicMessages[key]
  if (!section.title || section.title === fallback?.en) return <ST k={key} />
  return section.title
}
