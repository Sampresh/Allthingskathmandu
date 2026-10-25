/** Both languages in the HTML; CSS shows the one picked by <html data-lang>. */
export function Bilingual({ entry }) {
  if (!entry.ne || entry.ne === entry.en) return entry.en
  return (
    <>
      <span className="i18n-en" lang="en">
        {entry.en}
      </span>
      <span className="i18n-ne" lang="ne">
        {entry.ne}
      </span>
    </>
  )
}
