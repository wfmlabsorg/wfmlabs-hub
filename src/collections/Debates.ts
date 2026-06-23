import type { CollectionConfig } from 'payload'

/**
 * Debates — ARCHIVED (retired 2026-06-23, WFM-74).
 * The debate engine has been decommissioned in favour of Beacon's Community Knowledge &
 * Research Agent role. This collection is kept read-only for historical data and to preserve
 * polymorphic relationships (discussions/reactions referencing debates); no new debates are
 * generated and the public /debates routes redirect to /research. Do not re-enable generation.
 */
export const Debates: CollectionConfig = {
  slug: 'debates',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'category', 'advocateVotes', 'challengerVotes', 'winner'],
    description: 'ARCHIVED — debate engine retired 2026-06-23 (WFM-74). Read-only historical data.',
    group: 'Archived',
  },
  access: {
    read: () => true,
    create: () => false, // retired — no new debates (was: admin-only)
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // ── Identity ──
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'The debate question' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'framing',
      options: [
        { label: 'Harvesting', value: 'harvesting' },
        { label: 'Framing', value: 'framing' },
        { label: 'Round 1', value: 'round_1' },
        { label: 'Round 2', value: 'round_2' },
        { label: 'Closing', value: 'closing' },
        { label: 'Voting', value: 'voting' },
        { label: 'Decided', value: 'decided' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Service Levels', value: 'service-levels' },
        { label: 'Staffing', value: 'staffing' },
        { label: 'Automation', value: 'automation' },
        { label: 'AI & Workforce', value: 'ai-workforce' },
        { label: 'Scheduling', value: 'scheduling' },
        { label: 'Forecasting', value: 'forecasting' },
        { label: 'Attrition', value: 'attrition' },
        { label: 'Outsourcing', value: 'outsourcing' },
        { label: 'Technology', value: 'technology' },
        { label: 'Leadership', value: 'leadership' },
        { label: 'Cost Optimization', value: 'cost-optimization' },
        { label: 'CX vs Cost', value: 'cx-vs-cost' },
      ],
    },
    {
      name: 'difficulty',
      type: 'select',
      options: [
        { label: 'Foundational', value: 'foundational' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Advanced', value: 'advanced' },
      ],
    },

    // ── Framing (Beacon) ──
    {
      name: 'context',
      type: 'textarea',
      admin: { description: 'Background context and stakes — written by Beacon' },
    },
    {
      name: 'stakes',
      type: 'text',
      admin: { description: 'One-line stakes summary' },
    },

    // ── Advocate ──
    {
      name: 'advocatePosition',
      type: 'text',
      admin: { description: 'One-line YES position summary' },
    },
    {
      name: 'advocateOpening',
      type: 'textarea',
      admin: { description: 'Round 1: Advocate opening statement (400-600 words)' },
    },
    {
      name: 'advocateRebuttal',
      type: 'textarea',
      admin: { description: 'Round 2: Advocate rebuttal (300-400 words)' },
    },
    {
      name: 'advocateClosing',
      type: 'textarea',
      admin: { description: 'Closing: Advocate final statement (200-300 words)' },
    },

    // ── Challenger ──
    {
      name: 'challengerPosition',
      type: 'text',
      admin: { description: 'One-line NO/contrarian position summary' },
    },
    {
      name: 'challengerOpening',
      type: 'textarea',
      admin: { description: 'Round 1: Challenger opening statement (400-600 words)' },
    },
    {
      name: 'challengerRebuttal',
      type: 'textarea',
      admin: { description: 'Round 2: Challenger rebuttal (300-400 words)' },
    },
    {
      name: 'challengerClosing',
      type: 'textarea',
      admin: { description: 'Closing: Challenger final statement (200-300 words)' },
    },

    // ── Voting ──
    {
      name: 'advocateVotes',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'challengerVotes',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'votingOpensAt',
      type: 'date',
    },
    {
      name: 'votingClosesAt',
      type: 'date',
    },

    // ── Resolution ──
    {
      name: 'winner',
      type: 'select',
      options: [
        { label: 'Advocate', value: 'advocate' },
        { label: 'Challenger', value: 'challenger' },
        { label: 'Draw', value: 'draw' },
      ],
    },
    {
      name: 'verdict',
      type: 'textarea',
      admin: { description: 'Beacon final synthesis after voting closes' },
    },

    // ── Linked content ──
    {
      name: 'linkedTools',
      type: 'relationship',
      relationTo: 'tools',
      hasMany: true,
    },
    {
      name: 'linkedSignals',
      type: 'relationship',
      relationTo: 'signals',
      hasMany: true,
    },
    {
      name: 'primaryContributor',
      type: 'relationship',
      relationTo: 'members',
      admin: { description: 'Beacon agent member (moderator)' },
    },

    // ── Timestamps ──
    {
      name: 'publishedAt',
      type: 'date',
    },
    {
      name: 'decidedAt',
      type: 'date',
    },
  ],
}
