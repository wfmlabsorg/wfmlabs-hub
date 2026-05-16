/**
 * Bulk update papers with sourceName and category.
 * Run: bun run scripts/bulk-update-papers.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const updates: Record<number, { sourceName: string; category: string }> = {
  1:  { sourceName: 'NBER / Stanford', category: 'ai-ml' },
  2:  { sourceName: 'American Economic Review', category: 'economics-finance' },
  3:  { sourceName: 'Springer (Lecture Notes)', category: 'operations-management' },
  4:  { sourceName: 'Annual Review of Resource Economics', category: 'operations-management' },
  5:  { sourceName: 'Transport Reviews', category: 'operations-management' },
  6:  { sourceName: 'Springer (International Series)', category: 'queuing-theory' },
  7:  { sourceName: 'Econometrica', category: 'queuing-theory' },
  8:  { sourceName: 'UK Government Office for Science', category: 'workforce-management' },
  9:  { sourceName: 'McKinsey & Company', category: 'customer-experience' },
  10: { sourceName: 'MIT Press', category: 'operations-management' },
  11: { sourceName: 'Trends in Cognitive Sciences', category: 'workforce-management' },
  12: { sourceName: 'Annual Review of Economics', category: 'economics-finance' },
  13: { sourceName: 'Computers & Operations Research', category: 'queuing-theory' },
  14: { sourceName: 'Harvard Business Review', category: 'customer-experience' },
  15: { sourceName: 'NBER Working Papers', category: 'technology' },
}

async function run() {
  const payload = await getPayload({ config })

  for (const [id, data] of Object.entries(updates)) {
    try {
      await payload.update({
        collection: 'papers',
        id: Number(id),
        data: {
          sourceName: data.sourceName,
          category: data.category,
        } as any,
        overrideAccess: true,
      })
      console.log(`Updated paper ${id}: ${data.sourceName} / ${data.category}`)
    } catch (e) {
      console.error(`Failed paper ${id}:`, (e as Error).message)
    }
  }

  console.log('Done.')
  process.exit(0)
}

run()
