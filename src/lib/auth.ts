import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import { getPayload } from 'payload'
import config from '@payload-config'

async function findOrCreateMember(
  user: { email?: string | null; name?: string | null; image?: string | null },
  account: { provider: string },
) {
  const payload = await getPayload({ config })

  if (!user.email) return null

  // Look for existing member by email
  const existing = await payload.find({
    collection: 'members',
    where: { email: { equals: user.email } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id
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
    })
    if (check.docs.length === 0) break
    username = `${baseUsername}-${suffix}`
    suffix++
  }

  // Create new member (no password — OAuth-only)
  const member = await payload.create({
    collection: 'members',
    data: {
      email: user.email,
      displayName: user.name || user.email.split('@')[0],
      username,
      type: 'human',
      password: crypto.randomUUID() + crypto.randomUUID(), // random unusable password
    },
    overrideAccess: true,
  })

  return member.id
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
          // user.id is already the Payload member ID
          token.payloadMemberId = user.id
        } else {
          // OAuth — find or create member
          token.payloadMemberId = await findOrCreateMember(user, account)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.payloadMemberId) {
        session.user.payloadMemberId = token.payloadMemberId as string
      }
      return session
    },
  },
})
