/**
 * Re-migrate ROC docs: update description field with FULL markdown content.
 * Fixes the original migration which truncated to 500 chars and stripped formatting.
 * Run: bun run scripts/remigrate-roc-docs.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

const ROC_DOCS = '/home/tlango/projects/roc/docs/content'

interface DocFile {
  slug: string
  title: string
  content: string
}

function parseHugoFrontmatter(raw: string): { title: string; body: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) {
    const headingMatch = raw.match(/^#\s+(.+)/m)
    return { title: headingMatch?.[1] || 'Untitled', body: raw }
  }
  const fm = fmMatch[1]
  const body = fmMatch[2]
  const titleMatch = fm.match(/title:\s*["']?(.+?)["']?\s*$/m)
  return {
    title: titleMatch?.[1] || 'Untitled',
    body: body.trim(),
  }
}

function collectDocs(dir: string, section = ''): DocFile[] {
  const docs: DocFile[] = []
  const entries = readdirSync(dir)

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      docs.push(...collectDocs(fullPath, entry))
    } else if (entry.endsWith('.md')) {
      const raw = readFileSync(fullPath, 'utf-8')
      const { title, body } = parseHugoFrontmatter(raw)

      if (entry === '_index.md' && body.trim().length < 20) continue

      const slugBase = entry === '_index.md' ? section : basename(entry, '.md')
      const slug = section ? `roc-${section}-${slugBase}` : `roc-${slugBase}`

      docs.push({
        slug: slug.replace(/_index$/, '').replace(/-+$/, ''),
        title: entry === '_index.md' ? `ROC: ${title}` : title,
        content: body,
      })
    }
  }
  return docs
}

async function run() {
  const payload = await getPayload({ config })
  const docs = collectDocs(ROC_DOCS)

  console.log(`Found ${docs.length} docs to re-migrate`)

  let updated = 0, notFound = 0, errors = 0

  for (const doc of docs) {
    const existing = await payload.find({
      collection: 'wiki-entries',
      where: { slug: { equals: doc.slug } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length === 0) {
      console.log(`  MISS ${doc.slug} (not in DB)`)
      notFound++
      continue
    }

    const entry = existing.docs[0]

    try {
      await payload.update({
        collection: 'wiki-entries',
        id: entry.id,
        data: {
          description: doc.content,
        },
        overrideAccess: true,
      })
      console.log(`  OK   ${doc.slug} — ${doc.content.length} chars`)
      updated++
    } catch (e) {
      console.error(`  FAIL ${doc.slug}:`, (e as Error).message?.slice(0, 200))
      errors++
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found, ${errors} errors`)
  process.exit(0)
}

run()
