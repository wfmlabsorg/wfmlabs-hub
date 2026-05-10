import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { DetailPageLayout } from '@/components/pages/DetailPageLayout'
import { RichTextContent } from '@/components/ui/RichTextContent'
import React from 'react'

export default async function WikiDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'wiki-entries',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const entry = result.docs[0]
  if (!entry) notFound()

  return (
    <DetailPageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Wiki', href: '/wiki' },
        { label: entry.title },
      ]}
      title={entry.title}
      status={entry.status}
      tier={entry.tier}
      primaryContributor={entry.primaryContributor}
      publishedAt={entry.publishedAt}
      updatedAt={entry.updatedAt}
      topics={entry.topics}
      stats={entry.stats}
      sidebar={
        <>
          {entry.category && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--fg-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                Category
              </h3>
              <span className="badge badge-type">{entry.category}</span>
            </div>
          )}
          {entry.definedTerms && entry.definedTerms.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--fg-muted)',
                  marginBottom: '0.5rem',
                }}
              >
                Defined Terms
              </h3>
              {entry.definedTerms.map((dt, i) => (
                <div key={i} style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{dt.term}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                    {dt.definition}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      }
    >
      {entry.description && (
        <p
          style={{
            fontSize: '1.0625rem',
            color: 'var(--fg-muted)',
            lineHeight: 1.6,
            marginBottom: '1.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {entry.description}
        </p>
      )}
      <RichTextContent content={entry.body} />
    </DetailPageLayout>
  )
}
