import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { DetailPageLayout } from '@/components/pages/DetailPageLayout'
import { RichTextContent } from '@/components/ui/RichTextContent'
import React from 'react'

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'papers',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const paper = result.docs[0]
  if (!paper) notFound()

  return (
    <DetailPageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Research', href: '/research' },
        { label: paper.title },
      ]}
      title={paper.title}
      status={paper.status}
      tier={paper.tier}
      primaryContributor={paper.primaryContributor}
      publishedAt={paper.publishedAt}
      updatedAt={paper.updatedAt}
      topics={paper.topics}
      stats={paper.stats}
      sidebar={
        <>
          {paper.sourceType && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                Source
              </h3>
              <span className="badge badge-type">{paper.sourceType}</span>
              {paper.sourceUrl && (
                <div style={{ marginTop: '0.375rem' }}>
                  <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem' }}>
                    View original &rarr;
                  </a>
                </div>
              )}
            </div>
          )}
          {paper.authors && paper.authors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                Authors
              </h3>
              {paper.authors.map((a, i) => (
                <div key={i} style={{ fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 500 }}>{a.name}</span>
                  {a.affiliation && <span style={{ color: 'var(--fg-faint)' }}> — {a.affiliation}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      }
    >
      {paper.abstract && (
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>Abstract</h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>{paper.abstract}</p>
        </div>
      )}
      {paper.curatorSummary && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Curator Summary</h2>
          <RichTextContent content={paper.curatorSummary} />
        </div>
      )}
      {paper.whyItMatters && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Why It Matters</h2>
          <RichTextContent content={paper.whyItMatters} />
        </div>
      )}
      {paper.caveats && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>Caveats</h2>
          <RichTextContent content={paper.caveats} />
        </div>
      )}
    </DetailPageLayout>
  )
}
