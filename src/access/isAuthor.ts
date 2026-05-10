import type { Access } from 'payload'

export const isAuthor = (authorField: string): Access =>
  ({ req: { user }, id }) => {
    if (!user) return false
    if (user.type === 'admin') return true
    // For update/delete, restrict to where author matches current user
    return {
      [authorField]: { equals: user.id },
    }
  }
