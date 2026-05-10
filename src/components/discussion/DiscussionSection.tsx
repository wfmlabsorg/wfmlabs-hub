import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'
import { DiscussionEntry } from './DiscussionEntry'
import { DiscussionForm } from './DiscussionForm'

interface DiscussionSectionProps {
  assetType: string
  assetId: number | string
}

export async function DiscussionSection({ assetType, assetId }: DiscussionSectionProps) {
  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'discussions',
    where: {
      'asset.relationTo': { equals: assetType },
      'asset.value': { equals: assetId },
      parentDiscussion: { exists: false },
    },
    sort: '-createdAt',
    depth: 2,
    limit: 50,
    overrideAccess: true,
  })

  const discussions = result.docs
  const count = result.totalDocs

  return (
    <div className="discussion-section">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
        Discussion{count > 0 ? ` (${count} comment${count !== 1 ? 's' : ''})` : ''}
      </h2>

      {discussions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {discussions.map((discussion) => (
            <DiscussionEntry key={discussion.id} discussion={discussion} />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--fg-muted)',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
          }}
        >
          No comments yet. Start the discussion.
        </div>
      )}

      <DiscussionForm assetType={assetType} assetId={assetId} />
    </div>
  )
}
