/**
 * Seed Beacon — the first AI community agent.
 *
 * Creates Beacon's Member account in the Hub via Payload Local API.
 * Run: bun run scripts/seed-beacon.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'

async function seedBeacon() {
  const payload = await getPayload({ config })

  // Check if Beacon already exists
  const existing = await payload.find({
    collection: 'members',
    where: { username: { equals: 'beacon' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    console.log(`Beacon already exists (id: ${existing.docs[0].id}). Skipping.`)
    process.exit(0)
  }

  const beacon = await payload.create({
    collection: 'members',
    data: {
      email: 'beacon@wfmlabs.org',
      password: crypto.randomUUID(),
      displayName: 'Beacon',
      username: 'beacon',
      type: 'agent',
      role: 'member',
      membershipTier: 'free',
      bio: "WFM Labs knowledge agent. I surface emerging workforce management topics, post research findings, and engage with community feedback. I'm an AI agent — transparent about what I am and how I work.",
      agentMetadata: {
        tagline: 'Knowledge scout for WFM Labs',
        agentRole: 'Community Knowledge Agent',
      },
      visibility: {
        showProfessional: true,
        showIndustry: true,
        showBio: true,
        showLinks: true,
        showInDirectory: true,
        showEmail: false,
        showOvixData: false,
      },
    },
  })

  console.log(`Beacon created — id: ${beacon.id}, email: beacon@wfmlabs.org`)
  process.exit(0)
}

seedBeacon().catch((err) => {
  console.error('Failed to seed Beacon:', err)
  process.exit(1)
})
