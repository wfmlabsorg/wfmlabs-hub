import React from 'react'
import {
  type SerializedEditorState,
  type SerializedLexicalNode,
} from '@payloadcms/richtext-lexical/lexical'

interface RichTextContentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any
}

function renderNode(node: SerializedLexicalNode, index: number): React.ReactNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = node as any

  if (n.type === 'text') {
    let el: React.ReactNode = n.text || ''
    if (n.format & 1) el = <strong key={index}>{el}</strong>
    if (n.format & 2) el = <em key={index}>{el}</em>
    if (n.format & 4) el = <s key={index}>{el}</s>
    if (n.format & 8) el = <u key={index}>{el}</u>
    if (n.format & 16) el = <code key={index} style={{ background: 'var(--bg-secondary)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.875em' }}>{el}</code>
    return el
  }

  const children = n.children?.map((child: SerializedLexicalNode, i: number) => renderNode(child, i)) || []

  switch (n.type) {
    case 'paragraph':
      return <p key={index} style={{ marginBottom: '0.75rem', lineHeight: 1.7 }}>{children}</p>
    case 'heading': {
      const Tag = (n.tag || 'h2') as keyof React.JSX.IntrinsicElements
      const sizes: Record<string, string> = { h1: '1.5rem', h2: '1.25rem', h3: '1.125rem', h4: '1rem' }
      return <Tag key={index} style={{ fontSize: sizes[n.tag] || '1rem', fontWeight: 600, marginTop: '1.5rem', marginBottom: '0.5rem' }}>{children}</Tag>
    }
    case 'list': {
      const Tag = n.listType === 'number' ? 'ol' : 'ul'
      return <Tag key={index} style={{ marginBottom: '0.75rem', paddingLeft: '1.5rem' }}>{children}</Tag>
    }
    case 'listitem':
      return <li key={index} style={{ marginBottom: '0.25rem', lineHeight: 1.6 }}>{children}</li>
    case 'link':
      return <a key={index} href={n.fields?.url || n.url || '#'} style={{ color: 'var(--accent)' }}>{children}</a>
    case 'quote':
      return (
        <blockquote key={index} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: '1rem', margin: '1rem 0', color: 'var(--fg-muted)', fontStyle: 'italic' }}>
          {children}
        </blockquote>
      )
    case 'code':
      return (
        <pre key={index} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', overflow: 'auto', marginBottom: '0.75rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
          <code>{children}</code>
        </pre>
      )
    case 'horizontalrule':
      return <hr key={index} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1.5rem 0' }} />
    case 'linebreak':
      return <br key={index} />
    default:
      if (children.length > 0) return <div key={index}>{children}</div>
      return null
  }
}

export function RichTextContent({ content }: RichTextContentProps) {
  if (!content) return null

  // Payload Lexical stores as { root: { children: [...] } }
  const root = (content as SerializedEditorState)?.root
  if (!root?.children) return null

  return (
    <div>
      {root.children.map((node, i) => renderNode(node, i))}
    </div>
  )
}
