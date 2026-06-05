'use client'

import { useRef, useEffect } from 'react'

export interface ReportPreviewData {
  title: string
  reportMonth: string
  area: string
  excerpt: string
  body: string
  coverImage: string
  authorName: string
  ctaTitle: string
  ctaSubtitle: string
}

function buildSrcDoc(body: string): string {
  const trimmed = body.trimStart()
  if (/^<!doctype|^<html/i.test(trimmed)) return body
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #1c1917;
    line-height: 1.75;
    margin: 0;
    padding: 0.25rem 0 1.5rem;
    font-size: 16px;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: Georgia, serif;
    font-weight: 700;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    color: #111827;
  }
  h1 { font-size: 2em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  p { margin-top: 0; margin-bottom: 1em; }
  a { color: #b45309; text-decoration: underline; }
  img { max-width: 100%; height: auto; display: block; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.25em; font-size: 0.9em; }
  th, td { border: 1px solid #e5e7eb; padding: 0.5em 0.75em; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  tr:nth-child(even) td { background: #f9fafb; }
  blockquote {
    border-left: 4px solid #d4a520;
    padding: 0.5em 0 0.5em 1em;
    margin: 1em 0;
    color: #6b7280;
    font-style: italic;
  }
  pre { background: #f9fafb; padding: 1em; border-radius: 6px; overflow-x: auto; font-size: 0.875em; }
  code { background: #f9fafb; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.875em; font-family: monospace; }
  ul, ol { padding-left: 1.5em; margin-bottom: 1em; }
  li { margin-bottom: 0.25em; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
</style>
</head>
<body>${body}</body>
</html>`
}

export function MarketReportPreview({ data }: { data: ReportPreviewData }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return
    const resize = () => {
      try {
        const h = el.contentDocument?.documentElement.scrollHeight ?? 300
        el.style.height = (h + 24) + 'px'
      } catch {}
    }
    el.addEventListener('load', resize)
    return () => el.removeEventListener('load', resize)
  }, [data.body])

  return (
    <div className="border border-charcoal-200 rounded-xl overflow-hidden bg-white">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-charcoal-400 bg-charcoal-50 border-b border-charcoal-100 px-4 py-2">
        Preview — how visitors will see this report
      </div>

      {/* Page header mock */}
      <div className="bg-gray-50 px-8 py-6 border-b border-charcoal-100">
        <div className="flex items-center gap-2 mb-3">
          {data.area && (
            <span className="text-xs font-semibold uppercase tracking-widest text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
              {data.area}
            </span>
          )}
          {data.reportMonth && (
            <span className="text-xs font-semibold uppercase tracking-widest text-charcoal-500 bg-charcoal-100 px-3 py-1 rounded-full">
              {data.reportMonth}
            </span>
          )}
        </div>
        <h1 className="font-serif text-2xl font-bold text-charcoal-900">
          {data.title || <em className="font-normal text-charcoal-400">Untitled report</em>}
        </h1>
        {data.excerpt && <p className="mt-2 text-sm text-charcoal-500">{data.excerpt}</p>}
        {data.authorName && <p className="mt-1 text-xs text-charcoal-400">By {data.authorName}</p>}
      </div>

      {/* Cover image */}
      {data.coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.coverImage} alt={data.title} className="w-full object-cover max-h-56" />
      )}

      {/* Body + lead form sidebar */}
      <div className="grid grid-cols-3 gap-8 p-8">
        <div className="col-span-2">
          <iframe
            key={data.body}
            ref={iframeRef}
            srcDoc={buildSrcDoc(data.body)}
            sandbox="allow-same-origin"
            title="Report body preview"
            className="w-full border-0"
            style={{ minHeight: '200px', height: '400px' }}
          />
        </div>
        <div className="col-span-1">
          <div className="sticky top-6 rounded-2xl border border-charcoal-100 bg-charcoal-50 p-5">
            {data.ctaTitle && (
              <h3 className="font-serif text-base font-bold text-charcoal-900 mb-1">{data.ctaTitle}</h3>
            )}
            {data.ctaSubtitle && (
              <p className="text-xs text-charcoal-400 mb-4">{data.ctaSubtitle}</p>
            )}
            <div className="space-y-2.5">
              <div className="h-8 bg-charcoal-200 rounded-lg" />
              <div className="h-8 bg-charcoal-200 rounded-lg" />
              <div className="h-8 bg-charcoal-200 rounded-lg" />
              <div className="h-8 bg-yellow-400 rounded-lg opacity-60" />
            </div>
            <p className="text-[10px] text-charcoal-400 mt-3 text-center italic">Lead capture form</p>
          </div>
        </div>
      </div>
    </div>
  )
}
