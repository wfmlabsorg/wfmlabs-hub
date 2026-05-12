/**
 * Migrate ROC documentation from Hugo markdown into Payload WikiEntries.
 * Run: bun run scripts/migrate-roc-docs.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, dirname } from 'path'

const ROC_DOCS = '/home/tlango/projects/roc/docs/content'
const CONTRIBUTOR_ID = 2 // Ted (tedlango@gmail.com)

interface DocFile {
  path: string
  section: string
  slug: string
  title: string
  content: string
  weight: number
}

function parseHugoFrontmatter(raw: string): { title: string; weight: number; body: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) {
    // No frontmatter — use first heading as title
    const headingMatch = raw.match(/^#\s+(.+)/m)
    return { title: headingMatch?.[1] || 'Untitled', weight: 0, body: raw }
  }
  const fm = fmMatch[1]
  const body = fmMatch[2]
  const titleMatch = fm.match(/title:\s*["']?(.+?)["']?\s*$/m)
  const weightMatch = fm.match(/weight:\s*(\d+)/)
  return {
    title: titleMatch?.[1] || 'Untitled',
    weight: weightMatch ? parseInt(weightMatch[1]) : 0,
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
      const { title, weight, body } = parseHugoFrontmatter(raw)

      // Skip empty index files
      if (entry === '_index.md' && body.trim().length < 20) continue

      const slugBase = entry === '_index.md' ? section : basename(entry, '.md')
      const slug = section ? `roc-${section}-${slugBase}` : `roc-${slugBase}`

      docs.push({
        path: fullPath,
        section: section || 'overview',
        slug: slug.replace(/_index$/, '').replace(/-+$/, ''),
        title: entry === '_index.md' ? `ROC: ${title}` : title,
        content: body,
        weight,
      })
    }
  }
  return docs
}

// Convert markdown to minimal Lexical JSON for Payload richText
function markdownToLexical(md: string): Record<string, unknown> {
  // Split into paragraphs and create Lexical paragraph nodes
  const paragraphs = md.split(/\n\n+/).filter(p => p.trim())
  const children = paragraphs.map(p => {
    const trimmed = p.trim()

    // Heading
    const h2 = trimmed.match(/^##\s+(.+)/)
    if (h2) return {
      type: 'heading', tag: 'h2', children: [{ type: 'text', text: h2[1] }], direction: 'ltr', format: '', indent: 0, version: 1
    }
    const h3 = trimmed.match(/^###\s+(.+)/)
    if (h3) return {
      type: 'heading', tag: 'h3', children: [{ type: 'text', text: h3[1] }], direction: 'ltr', format: '', indent: 0, version: 1
    }

    // Code block
    if (trimmed.startsWith('```')) {
      const code = trimmed.replace(/^```\w*\n?/, '').replace(/\n?```$/, '')
      return {
        type: 'paragraph', children: [{ type: 'text', text: code, format: 16 }], direction: 'ltr', format: '', indent: 0, version: 1
      }
    }

    // Regular paragraph — strip inline markdown
    const clean = trimmed
      .replace(/^#+\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    return {
      type: 'paragraph', children: [{ type: 'text', text: clean }], direction: 'ltr', format: '', indent: 0, version: 1
    }
  })

  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

const categoryMap: Record<string, string> = {
  architecture: 'technology',
  api: 'technology',
  database: 'technology',
  'data-pipeline': 'process',
  ovix: 'framework',
  operations: 'process',
  deployment: 'process',
  changelog: 'concept',
  overview: 'concept',
}

async function run() {
  const payload = await getPayload({ config })
  const docs = collectDocs(ROC_DOCS)

  console.log(`Found ${docs.length} docs to migrate`)

  let created = 0, skipped = 0

  for (const doc of docs) {
    // Check if already exists
    const existing = await payload.find({
      collection: 'wiki-entries',
      where: { slug: { equals: doc.slug } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      console.log(`  SKIP ${doc.slug} (exists)`)
      skipped++
      continue
    }

    const category = categoryMap[doc.section] || 'concept'
    const lexicalBody = markdownToLexical(doc.content)

    try {
      await payload.create({
        collection: 'wiki-entries',
        data: {
          title: doc.title,
          slug: doc.slug,
          description: doc.content.slice(0, 500).replace(/[#*`\[\]]/g, '').trim(),
          body: lexicalBody as any,
          category: category as any,
          status: 'published',
          primaryContributor: CONTRIBUTOR_ID,
        },
        overrideAccess: true,
      })
      console.log(`  OK   ${doc.slug} — ${doc.title}`)
      created++
    } catch (e) {
      console.error(`  FAIL ${doc.slug}:`, (e as Error).message?.slice(0, 100))
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`)
  process.exit(0)
}

run()
