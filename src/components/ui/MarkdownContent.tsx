import React from 'react'

interface MarkdownContentProps {
  content: string
}

/**
 * Server-side markdown-to-HTML renderer.
 * Handles headings, bold, italic, inline code, fenced code blocks,
 * tables, unordered/ordered lists, links, and horizontal rules.
 */
function markdownToHtml(md: string): string {
  // Normalize line endings
  let text = md.replace(/\r\n/g, '\n')

  // Fenced code blocks (```lang\n...\n```)
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = escapeHtml(code.trimEnd())
    const cls = lang ? ` class="language-${lang}"` : ''
    return `<pre class="md-code-block"><code${cls}>${escaped}</code></pre>`
  })

  // Process block-level elements
  const lines = text.split('\n')
  const output: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Skip already-processed code blocks (they contain HTML tags)
    if (line.startsWith('<pre class="md-code-block">')) {
      let block = line
      while (i < lines.length && !lines[i].includes('</pre>')) {
        i++
        block += '\n' + lines[i]
      }
      output.push(block)
      i++
      continue
    }

    // Table: detect header row followed by separator row
    if (line.includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+[-|\s:]*$/.test(lines[i + 1])) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i])
        i++
      }
      output.push(renderTable(tableLines))
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      output.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      output.push('<hr />')
      i++
      continue
    }

    // Unordered list
    if (/^[\s]*[-*+]\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[\s]*[-*+]\s/, ''))
        i++
      }
      output.push('<ul>' + listItems.map(li => `<li>${inlineMarkdown(li)}</li>`).join('') + '</ul>')
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s/, ''))
        i++
      }
      output.push('<ol>' + listItems.map(li => `<li>${inlineMarkdown(li)}</li>`).join('') + '</ol>')
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Regular paragraph — collect consecutive non-blank, non-special lines
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('<pre') &&
      !/^[-*_]{3,}\s*$/.test(lines[i]) &&
      !/^[\s]*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\|?\s*[-:]+[-|\s:]*$/.test(lines[i + 1]))
    ) {
      para.push(lines[i])
      i++
    }
    if (para.length > 0) {
      output.push(`<p>${inlineMarkdown(para.join('\n'))}</p>`)
    }
  }

  return output.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineMarkdown(text: string): string {
  let s = text
  // Inline code (must come before bold/italic to avoid conflicts)
  s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>')
  // Italic
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/_(.+?)_/g, '<em>$1</em>')
  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--accent)">$1</a>')
  return s
}

function renderTable(lines: string[]): string {
  const parseRow = (row: string) =>
    row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim())

  const headers = parseRow(lines[0])
  // lines[1] is the separator — skip
  const rows = lines.slice(2).map(parseRow)

  let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>'
  for (const h of headers) {
    html += `<th>${inlineMarkdown(h)}</th>`
  }
  html += '</tr></thead><tbody>'
  for (const row of rows) {
    html += '<tr>'
    for (const cell of row) {
      html += `<td>${inlineMarkdown(cell)}</td>`
    }
    html += '</tr>'
  }
  html += '</tbody></table></div>'
  return html
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  if (!content) return null

  const html = markdownToHtml(content)

  return (
    <>
      <div className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        .md-content h1 { font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; }
        .md-content h2 { font-size: 1.25rem; font-weight: 700; margin-top: 2rem; margin-bottom: 0.75rem; padding-bottom: 0.375rem; border-bottom: 1px solid var(--border); }
        .md-content h3 { font-size: 1.0625rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; }
        .md-content h4, .md-content h5, .md-content h6 { font-size: 1rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .md-content p { margin-bottom: 1rem; }
        .md-content ul, .md-content ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .md-content li { margin-bottom: 0.25rem; line-height: 1.6; }
        .md-content hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
        .md-content strong { font-weight: 600; }
        .md-inline-code {
          font-size: 0.875em;
          background: var(--bg-surface);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: var(--font-mono, monospace);
        }
        .md-code-block {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          padding: 1rem;
          border-radius: var(--radius);
          overflow-x: auto;
          margin-bottom: 1rem;
          font-size: 0.8125rem;
          line-height: 1.6;
          font-family: var(--font-mono, monospace);
        }
        .md-code-block code {
          background: none;
          padding: 0;
          font-size: inherit;
        }
        .md-table-wrap {
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .md-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .md-table th, .md-table td {
          border: 1px solid var(--border);
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .md-table th {
          background: var(--bg-surface);
          font-weight: 600;
          font-size: 0.8125rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .md-table tr:nth-child(even) {
          background: var(--bg-surface);
        }
      `}</style>
    </>
  )
}
