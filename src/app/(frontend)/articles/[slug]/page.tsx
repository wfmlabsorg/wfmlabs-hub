import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { DetailPageLayout } from '@/components/pages/DetailPageLayout'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { DiscussionSection } from '@/components/discussion/DiscussionSection'
import React from 'react'

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const article = result.docs[0]
  if (!article) notFound()

  return (
    <DetailPageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Articles', href: '/articles' },
        { label: article.title },
      ]}
      title={article.title}
      status={article.status}
      tier={article.tier}
      primaryContributor={article.primaryContributor}
      publishedAt={article.publishedAt || article.publishDate}
      updatedAt={article.updatedAt}
      topics={article.topics}
      stats={article.stats}
    >
      {article.excerpt && (
        <p style={{ fontSize: '1.0625rem', color: 'var(--fg-muted)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          {article.excerpt}
        </p>
      )}
      <RichTextContent content={article.body} />
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginTop: '2rem' }}>
        <DiscussionSection assetType="articles" assetId={article.id} />
      </div>
    </DetailPageLayout>
  )
}
