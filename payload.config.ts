import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

// Collections
import { Members } from '@/collections/Members'
import { Topics } from '@/collections/Topics'
import { Papers } from '@/collections/Papers'
import { Articles } from '@/collections/Articles'
import { Briefs } from '@/collections/Briefs'
import { Tools } from '@/collections/Tools'
import { NewsletterIssues } from '@/collections/NewsletterIssues'
import { WikiEntries } from '@/collections/WikiEntries'
import { Media } from '@/collections/Media'

// Cross-cutting collections
import { Discussions } from '@/collections/Discussions'
import { AssetVersions } from '@/collections/AssetVersions'
import { AssetRelationships } from '@/collections/AssetRelationships'
import { AssetContributions } from '@/collections/AssetContributions'
import { Reactions } from '@/collections/Reactions'
import { Signals } from '@/collections/Signals'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',

  admin: {
    user: 'members',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      beforeLogin: ['/src/components/admin/OAuthLoginButton'],
    },
  },

  editor: lexicalEditor(),

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),

  plugins: [
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
        },
      },
      bucket: process.env.R2_BUCKET || 'wfmlabshub-media',
      config: {
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        endpoint: process.env.R2_ENDPOINT || '',
        region: 'auto',
        forcePathStyle: true,
      },
    }),
  ],

  collections: [
    Members,
    Topics,
    Papers,
    Articles,
    Briefs,
    Tools,
    NewsletterIssues,
    WikiEntries,
    Media,
    // Cross-cutting
    Discussions,
    AssetVersions,
    AssetRelationships,
    AssetContributions,
    Reactions,
    Signals,
  ],

  secret: process.env.PAYLOAD_SECRET || 'CHANGE-ME-IN-PRODUCTION',

  sharp,

  typescript: {
    outputFile: path.resolve(dirname, 'src/types/payload-types.ts'),
  },
})
