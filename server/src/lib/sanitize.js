import sanitizeHtml from 'sanitize-html'

// What the admin rich-text editor (Tiptap starter kit) produces; everything else is dropped.
const OPTIONS = {
  allowedTags: [
    'h2',
    'h3',
    'h4',
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'hr',
  ],
  allowedAttributes: { a: ['href', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

/** CMS HTML, sanitized on save; pages render this copy (CLAUDE.md security defaults). */
export function sanitizeRichText(html) {
  return sanitizeHtml(html ?? '', OPTIONS).trim()
}
