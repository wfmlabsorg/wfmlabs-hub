import { getPayload } from 'payload'
import config from '@payload-config'
import { BrowsePageLayout } from '@/components/pages/BrowsePageLayout'

export const metadata = { title: 'Research' }

export default async function ResearchBrowsePage() {
  const payload = await getPayload({ config })
  const papers = await payload
    .find({ collection: 'papers', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <BrowsePageLayout
      title="Research"
      description="Curated academic papers, industry reports, and vendor research with practitioner commentary."
      items={papers.docs}
      assetType="paper"
      basePath="/research"
    />
  )
}
