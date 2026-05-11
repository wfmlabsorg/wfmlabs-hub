import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      payloadMemberId?: string
      role?: string // admin | moderator | member
      needsSetup?: boolean
    }
  }
}
