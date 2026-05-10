/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap.js'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = async ({ params, searchParams }: Args) => {
  try {
    return await RootPage({ config, importMap, params, searchParams })
  } catch (error: unknown) {
    const err = error as Error
    // Re-throw redirects (they use throw for control flow)
    if (err && typeof err === 'object' && 'digest' in err) {
      const digest = (err as { digest: string }).digest
      if (digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_NOT_FOUND')) {
        throw error
      }
    }
    // For real errors, render them visibly in the HTML
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace', color: 'red' }}>
        <h1>Server Error in Admin Page</h1>
        <p><strong>Name:</strong> {err?.name}</p>
        <p><strong>Message:</strong> {err?.message}</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#fff0f0', padding: '1rem', border: '1px solid red' }}>
          {err?.stack}
        </pre>
      </div>
    )
  }
}

export default Page
