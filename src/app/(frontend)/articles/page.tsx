import { getPayload } from 'payload'
import config from '@payload-config'
import { BrowsePageLayout } from '@/components/pages/BrowsePageLayout'

export const metadata = { title: 'Articles' }

export default async function ArticlesBrowsePage() {
  const payload = await getPayload({ config })
  const articles = await payload
    .find({ collection: 'articles', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <BrowsePageLayout
      title="Articles"
      description="Community articles, thought pieces, and practitioner perspectives on workforce management."
      items={articles.docs}
      assetType="article"
      basePath="/articles"
    />
  )
}
