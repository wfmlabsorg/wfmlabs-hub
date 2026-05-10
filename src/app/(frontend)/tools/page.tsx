import { getPayload } from 'payload'
import config from '@payload-config'
import { BrowsePageLayout } from '@/components/pages/BrowsePageLayout'

export const metadata = { title: 'Tools' }

export default async function ToolsBrowsePage() {
  const payload = await getPayload({ config })
  const tools = await payload
    .find({ collection: 'tools', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <BrowsePageLayout
      title="Tools"
      description="Interactive calculators, planning tools, and analytical utilities for WFM practitioners."
      items={tools.docs}
      assetType="tool"
      basePath="/tools"
    />
  )
}
