import { getPayload } from 'payload'
import config from '@payload-config'
import { BrowsePageLayout } from '@/components/pages/BrowsePageLayout'

export const metadata = { title: 'Compass' }
export const dynamic = 'force-dynamic'

export default async function CompassBrowsePage() {
  const payload = await getPayload({ config })
  const issues = await payload
    .find({ collection: 'newsletter-issues', limit: 50, sort: '-publishDate', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <BrowsePageLayout
      title="Contact Center Compass"
      description="Newsletter archive — weekly insights on workforce management trends, tools, and techniques."
      items={issues.docs}
      assetType="newsletter-issue"
      basePath="/compass"
    />
  )
}
