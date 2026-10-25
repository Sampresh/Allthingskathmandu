'use client'

import { CrudPage } from '@/components/admin/CrudPage'
import { synonyms } from '@/services/admin.service'

export default function SynonymsPage() {
  return (
    <CrudPage
      title="Search synonyms"
      queryKey="synonyms"
      api={synonyms}
      itemLabel={(s) => s.term}
      deleteMessage={(s) => `Delete the synonyms for “${s.term}”?`}
      columns={[
        { key: 'term', header: 'Term' },
        { key: 'synonyms', header: 'Also matches', render: (s) => s.synonyms.join(', ') },
      ]}
      fields={[
        { name: 'term', label: 'Term', hint: 'e.g. plumber' },
        {
          name: 'synonyms',
          label: 'Also matches',
          hint: 'Comma separated, English or Nepali: dhara mistri, धारा मिस्त्री',
        },
      ]}
      toForm={(s) => ({ term: s?.term ?? '', synonyms: s?.synonyms.join(', ') ?? '' })}
      toBody={(f) => ({
        term: f.term.trim(),
        synonyms: f.synonyms
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      })}
    />
  )
}
