import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { DetailPageLayout } from '@/components/pages/DetailPageLayout'
import { RichTextContent } from '@/components/ui/RichTextContent'
import React from 'react'

export default async function CompassDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'newsletter-issues',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const issue = result.docs[0]
  if (!issue) notFound()

  return (
    <DetailPageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Compass', href: '/compass' },
        { label: issue.title },
      ]}
      title={issue.title}
      status={issue.status}
      tier={issue.tier}
      primaryContributor={issue.primaryContributor}
      publishedAt={issue.publishDate}
      updatedAt={issue.updatedAt}
      topics={issue.topics}
      stats={issue.stats}
      sidebar={
        issue.issueNumber ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
              Issue
            </h3>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
              #{issue.issueNumber}
            </span>
          </div>
        ) : undefined
      }
    >
      {issue.summary && (
        <p style={{ fontSize: '1.0625rem', color: 'var(--fg-muted)', lineHeight: 1.6, marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          {issue.summary}
        </p>
      )}
      <RichTextContent content={issue.body} />
    </DetailPageLayout>
  )
}
