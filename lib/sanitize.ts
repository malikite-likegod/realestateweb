import sanitizeHtml from 'sanitize-html'

/**
 * Sanitizes rich HTML content (blog posts, market reports, email bodies).
 * Allows common formatting tags while stripping scripts and event handlers.
 */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'b', 'em', 'i', 'u', 's', 'strike',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    allowedAttributes: {
      'a':   ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'width', 'height'],
      '*':   ['class', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    // Force external links to be safe
    transformTags: {
      'a': (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.href?.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
        },
      }),
    },
  })
}
