import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { getPayload } from 'payload'
import config from '@payload-config'

// Admin emails get auto-promoted to admin role on creation/login
const ADMIN_EMAILS = [
  'tedlango@gmail.com',
  'ted@kyodosolutions.com',
  'ted@roc.cloud',
  'ted@wfmlabs.com',
]

async function findOrCreateMember(
  user: { email?: string | null; name?: string | null; image?: string | null },
  account: { provider: string },
): Promise<{ id: string | number; role: string; isNew?: boolean } | null> {
  const payload = await getPayload({ config })

  if (!user.email) return null

  const isAdminEmail = ADMIN_EMAILS.includes(user.email.toLowerCase())

  // Look for existing member by email
  const existing = await payload.find({
    collection: 'members',
    where: { email: { equals: user.email } },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    const member = existing.docs[0]

    // Auto-promote admin emails if they're not already admin
    if (isAdminEmail && member.role !== 'admin') {
      await payload.update({
        collection: 'members',
        id: member.id,
        data: { role: 'admin' },
        overrideAccess: true,
      })
      return { id: member.id, role: 'admin', isNew: false }
    }

    // Check if profile is incomplete (no bio AND no title)
    const needsSetup = !member.bio && !(member.profile as Record<string, unknown>)?.title

    return { id: member.id, role: (member.role as string) || 'member', isNew: needsSetup ? true : false }
  }

  // Generate username from email
  const baseUsername = user.email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 27)

  // Deduplicate username
  let username = baseUsername
  let suffix = 1
  while (true) {
    const check = await payload.find({
      collection: 'members',
      where: { username: { equals: username } },
      limit: 1,
      overrideAccess: true,
    })
    if (check.docs.length === 0) break
    username = `${baseUsername}-${suffix}`
    suffix++
  }

  // Create new member (no password — OAuth-only)
  const role = isAdminEmail ? 'admin' : 'member'
  const member = await payload.create({
    collection: 'members',
    data: {
      email: user.email,
      displayName: user.name || user.email.split('@')[0],
      username,
      type: 'human',
      role,
      password: crypto.randomUUID() + crypto.randomUUID(),
    },
    overrideAccess: true,
  })

  return { id: member.id, role, isNew: true }
}

// Build providers conditionally
const providers = []

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  )
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  )
}

// Always add credentials provider for Payload email/password login
providers.push(
  Credentials({
    name: 'Email & Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      try {
        const payload = await getPayload({ config })
        const { user } = await payload.login({
          collection: 'members',
          data: {
            email: credentials.email as string,
            password: credentials.password as string,
          },
        })

        if (user) {
          return {
            id: String(user.id),
            email: user.email,
            name: user.displayName || user.email,
          }
        }
        return null
      } catch {
        return null
      }
    },
  }),
)

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        if (account.provider === 'credentials') {
          token.payloadMemberId = user.id
          // Look up role for credential users
          const payload = await getPayload({ config })
          const member = await payload.findByID({
            collection: 'members',
            id: Number(user.id),
            overrideAccess: true,
          })
          token.role = (member?.role as string) || 'member'
        } else {
          // OAuth — find or create member
          const result = await findOrCreateMember(user, account)
          if (result) {
            token.payloadMemberId = result.id
            token.role = result.role
            token.needsSetup = result.isNew || false
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.payloadMemberId) {
        session.user.payloadMemberId = token.payloadMemberId as string
      }
      if (token.role) {
        session.user.role = token.role as string
      }
      if (token.needsSetup) {
        session.user.needsSetup = true
      }
      return session
    },
  },
})
