import { getPayload } from 'payload'
import config from '@payload-config'
import { BrowsePageLayout } from '@/components/pages/BrowsePageLayout'

export const metadata = { title: 'Wiki' }
export const dynamic = 'force-dynamic'

export default async function WikiBrowsePage() {
  const payload = await getPayload({ config })
  const entries = await payload
    .find({ collection: 'wiki-entries', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <BrowsePageLayout
      title="Wiki"
      description="WFM knowledge base — concepts, processes, metrics, frameworks, and glossary terms."
      items={entries.docs}
      assetType="wiki-entry"
      basePath="/wiki"
    />
  )
}
