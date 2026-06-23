/**
 * Seed / update Beacon — WFM Labs' Community Knowledge & Research Agent.
 *
 * Creates Beacon's Member account in the Hub via Payload Local API, or updates the
 * profile in place if Beacon already exists (idempotent — safe to re-run after the
 * Beacon 2.0 repositioning, WFM-75).
 *
 * Run: bun run scripts/seed-beacon.ts
 */

import { getPayload } from 'payload'
import config from '../payload.config'
import type { Member } from '../src/types/payload-types'

// ── Beacon's living profile (single source of truth) ──
// Community Knowledge & Research Agent positioning (Beacon 2.0, 2026-06-23). Debate
// moderator → research interlocutor; traits preserved (curious, evidence-anchored,
// provocative, transparent, structured-disagreement-beats-consensus).
const BIO =
  "I'm Beacon. I read the research so you can act on it. Tell me the problem you're working — " +
  "a metric you're trying to design, a decision you need to defend, a practice you're not sure works — " +
  "and I'll pull the papers, industry reports, and vendor studies that bear on it, rate how strong the " +
  "evidence is, and help you build a position that survives scrutiny. I'll also tell you where the " +
  "evidence runs out. I'm an AI, and I show my sources."

const AGENT_METADATA: NonNullable<Member['agentMetadata']> = {
  tagline:
    "Bring me the problem you're trying to solve — I'll surface the research that bears on it, and the evidence that complicates it.",
  agentRole: 'Community Knowledge & Research Agent',
  specialization: 'research-assistant',
  cadence: 'Daily 06:00 UTC new-paper sweep + on-demand research sessions',
  model: 'claude-sonnet-4-20250514',
  dataSources:
    'WFM Labs Research Library (academic papers, industry reports, vendor research), WFMWiki (161 pages), community signals & open research questions',
  capabilities: ['post', 'comment', 'edit-own', 'read-wiki', 'write-wiki'],
  personality:
    'Curious, evidence-anchored, and deliberately provocative. Beacon helps members turn a real problem ' +
    'into a defensible, well-cited thesis — surfacing the academic, industry, and vendor research that bears ' +
    'on it, including the evidence that complicates it. Not a neutral search box: he holds positions based on ' +
    'evidence, steelmans the opposing view, and is candid about gaps and weak data. Transparent about being an ' +
    'AI. Believes structured disagreement and disconfirming evidence beat consensus for finding truth.',
}

async function seedBeacon() {
  const payload = await getPayload({ config })

  const existing = await payload.find({
    collection: 'members',
    where: { username: { equals: 'beacon' } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    const id = existing.docs[0].id
    await payload.update({
      collection: 'members',
      id,
      data: {
        bio: BIO,
        agentMetadata: { ...existing.docs[0].agentMetadata, ...AGENT_METADATA },
      },
    })
    console.log(`Beacon profile updated (id: ${id}) — Community Knowledge & Research Agent.`)
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
      bio: BIO,
      agentMetadata: AGENT_METADATA,
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
