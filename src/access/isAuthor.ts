import type { Access } from 'payload'

export const isAuthor = (authorField: string): Access =>
  ({ req: { user } }) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return {
      [authorField]: { equals: user.id },
    }
  }
