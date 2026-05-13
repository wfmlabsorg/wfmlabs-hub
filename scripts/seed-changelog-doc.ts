/**
 * Seed (or update) the platform changelog as a wiki entry.
 * Run: bun run scripts/seed-changelog-doc.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SLUG = 'roc-changelog'
const TITLE = 'Changelog'
const CONTRIBUTOR_ID = 2 // Ted

async function run() {
  const changelogPath = resolve(__dirname, '../docs/CHANGELOG.md')
  const markdown = readFileSync(changelogPath, 'utf-8')

  const payload = await getPayload({ config })

  // Build minimal Lexical body from markdown
  const paragraphs = markdown.split(/\n\n+/).filter((p) => p.trim())
  const children = paragraphs.map((p) => {
    const trimmed = p.trim()

    if (trimmed === '---') {
      return {
        type: 'paragraph',
        children: [{ type: 'text', text: '---' }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }
    }

    const h1 = trimmed.match(/^#\s+(.+)/)
    if (h1)
      return {
        type: 'heading',
        tag: 'h1',
        children: [{ type: 'text', text: h1[1] }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }

    const h2 = trimmed.match(/^##\s+(.+)/)
    if (h2)
      return {
        type: 'heading',
        tag: 'h2',
        children: [{ type: 'text', text: h2[1] }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }

    const h3 = trimmed.match(/^###\s+(.+)/)
    if (h3)
      return {
        type: 'heading',
        tag: 'h3',
        children: [{ type: 'text', text: h3[1] }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }

    // Regular paragraph — preserve text as-is
    const clean = trimmed
      .replace(/^#+\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    return {
      type: 'paragraph',
      children: [{ type: 'text', text: clean }],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    }
  })

  const lexicalBody = {
    root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 },
  }

  // Check if entry already exists
  const existing = await payload.find({
    collection: 'wiki-entries',
    where: { slug: { equals: SLUG } },
    limit: 1,
    overrideAccess: true,
  })

  const data = {
    title: TITLE,
    slug: SLUG,
    description: markdown,
    body: lexicalBody as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    category: 'concept' as const,
    status: 'published' as const,
    primaryContributor: CONTRIBUTOR_ID,
  }

  if (existing.docs.length > 0) {
    await payload.update({
      collection: 'wiki-entries',
      id: existing.docs[0].id,
      data,
      overrideAccess: true,
    })
    console.log(`Updated wiki entry: ${SLUG}`)
  } else {
    await payload.create({
      collection: 'wiki-entries',
      data,
      overrideAccess: true,
    })
    console.log(`Created wiki entry: ${SLUG}`)
  }

  process.exit(0)
}

run()
