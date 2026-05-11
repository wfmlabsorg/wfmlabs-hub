import type { Access } from 'payload'

export const isModerator: Access = ({ req: { user } }) => {
  return user?.role === 'admin' || user?.role === 'moderator'
}
