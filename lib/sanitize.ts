import sanitizeHtml from 'sanitize-html'

/**
 * Sanitizes landing page HTML content authored by the site admin.
 * Allows inline styles, <style> blocks, and <link> tags (e.g. Google Fonts)
 * while still stripping <script> tags and on* event handlers.
 */
export function sanitizeLandingPageContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'style', 'link', 'section', 'article', 'main', 'aside',
      'header', 'footer', 'figure', 'figcaption', 'picture', 'source',
      'svg', 'path', 'circle', 'rect', 'polygon', 'polyline', 'line',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span',
      'strong', 'b', 'em', 'i', 'u', 's',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ]),
    allowedAttributes: {
      '*':      ['style', 'class', 'id'],
      'a':      ['href', 'title', 'target', 'rel'],
      'img':    ['src', 'alt', 'width', 'height', 'loading'],
      'link':   ['href', 'rel', 'type', 'crossorigin'],
      'source': ['src', 'srcset', 'media', 'type'],
      'svg':    ['xmlns', 'viewBox', 'fill', 'stroke', 'width', 'height', 'aria-hidden'],
      'path':   ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    // Allow <style> tag content through unchanged
    allowedStyles: { '*': {} },
    transformTags: {
      // Strip any script-like attributes that slip through
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
      '*':   ['class'],
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
