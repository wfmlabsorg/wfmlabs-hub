import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { DetailPageLayout } from '@/components/pages/DetailPageLayout'
import { RichTextContent } from '@/components/ui/RichTextContent'
import React from 'react'

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'tools',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const tool = result.docs[0]
  if (!tool) notFound()

  return (
    <DetailPageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Tools', href: '/tools' },
        { label: tool.title },
      ]}
      title={tool.title}
      status={tool.status}
      tier={tool.tier}
      primaryContributor={tool.primaryContributor}
      publishedAt={tool.publishedAt}
      updatedAt={tool.updatedAt}
      topics={tool.topics}
      stats={tool.stats}
      sidebar={
        <>
          {tool.category && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Category</h3>
              <span className="badge badge-type">{tool.category}</span>
            </div>
          )}
          {tool.version && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Version</h3>
              <span style={{ fontSize: '0.875rem' }}>{tool.version}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tool.embedUrl && (
              <a href={tool.embedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textAlign: 'center' }}>
                Launch Tool
              </a>
            )}
            {tool.sourceCodeUrl && (
              <a href={tool.sourceCodeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textAlign: 'center' }}>
                Source Code
              </a>
            )}
          </div>
        </>
      }
    >
      {tool.description && (
        <p style={{ fontSize: '1.0625rem', color: 'var(--fg-muted)', lineHeight: 1.6, marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          {tool.description}
        </p>
      )}
      {tool.methodology && (
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Methodology</h2>
          <RichTextContent content={tool.methodology} />
        </div>
      )}
    </DetailPageLayout>
  )
}
