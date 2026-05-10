import type { Access } from 'payload'

export const isMember: Access = ({ req: { user } }) => {
  return Boolean(user)
}
