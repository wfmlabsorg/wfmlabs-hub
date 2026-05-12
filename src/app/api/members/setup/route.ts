import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { INDUSTRY_VALUES, WORKFORCE_TYPE_VALUES } from '@/lib/constants/taxonomies'

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })

    // Try Payload JWT from cookie first (same pattern as discussions route)
    let memberId: string | number | null = null
    const cookieHeader = req.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/payload-token=([^;]+)/)

    if (tokenMatch) {
      try {
        const authHeaders = new Headers()
        authHeaders.set('Authorization', `JWT ${tokenMatch[1]}`)
        const { user } = await payload.auth({ headers: authHeaders })
        if (user) memberId = user.id
      } catch {
        // Fall through to NextAuth
      }
    }

    // Try NextAuth session
    if (!memberId) {
      const session = await auth()
      if (session?.user?.payloadMemberId) {
        memberId = session.user.payloadMemberId
      }
    }

    if (!memberId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      displayName,
      username,
      title,
      company,
      bio,
      location,
      linkedinUrl,
      githubUsername,
      websiteUrl,
      expertise,
      visibility,
      // Tier 1 new fields
      industry,
      workforceTypes,
      // Tier 2 OVIX profile
      ovixProfile,
    } = body

    // Validate required fields
    if (!displayName || !username) {
      return Response.json({ error: 'Display name and username are required' }, { status: 400 })
    }

    // Validate username format
    if (!/^[a-z0-9-]{3,30}$/.test(username)) {
      return Response.json(
        { error: 'Username must be 3-30 characters, lowercase letters, numbers, and hyphens only' },
        { status: 400 },
      )
    }

    // Validate industry if provided
    if (industry && !INDUSTRY_VALUES.includes(industry)) {
      return Response.json({ error: 'Invalid industry value' }, { status: 400 })
    }

    // Validate workforceTypes if provided
    if (workforceTypes && Array.isArray(workforceTypes)) {
      for (const wt of workforceTypes) {
        if (!WORKFORCE_TYPE_VALUES.includes(wt)) {
          return Response.json({ error: `Invalid workforce type: ${wt}` }, { status: 400 })
        }
      }
    }

    // Check username uniqueness (exclude current user)
    const existing = await payload.find({
      collection: 'members',
      where: {
        and: [
          { username: { equals: username } },
          { id: { not_equals: Number(memberId) } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      return Response.json({ error: 'Username is already taken' }, { status: 409 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      displayName,
      username,
      bio: bio || undefined,
      profile: {
        title: title || undefined,
        company: company || undefined,
        location: location || undefined,
        linkedinUrl: linkedinUrl || undefined,
        githubUsername: githubUsername || undefined,
        websiteUrl: websiteUrl || undefined,
      },
    }

    // Tier 1 new fields
    if (industry !== undefined) {
      updateData.industry = industry || null
    }
    if (workforceTypes !== undefined) {
      updateData.workforceTypes = Array.isArray(workforceTypes) ? workforceTypes : []
    }

    // Add expertise if provided (array of topic IDs)
    if (expertise !== undefined) {
      updateData.expertise = Array.isArray(expertise) ? expertise : []
    }

    // Add visibility settings if provided
    if (visibility && typeof visibility === 'object') {
      updateData.visibility = {
        showProfessional: visibility.showProfessional !== false,
        showIndustry: visibility.showIndustry !== false,
        showBio: visibility.showBio !== false,
        showLinks: visibility.showLinks !== false,
        showInDirectory: visibility.showInDirectory !== false,
        showEmail: visibility.showEmail === true,
        showOvixData: visibility.showOvixData === true,
      }
    }

    // Tier 2: OVIX profile
    if (ovixProfile && typeof ovixProfile === 'object') {
      const ovix: Record<string, unknown> = {
        isOvixContributor: ovixProfile.isOvixContributor === true,
        isBpo: ovixProfile.isBpo === true,
      }

      if (ovixProfile.clientIndustries && Array.isArray(ovixProfile.clientIndustries)) {
        ovix.clientIndustries = ovixProfile.clientIndustries
      }

      if (ovixProfile.workforceFootprint && Array.isArray(ovixProfile.workforceFootprint)) {
        ovix.workforceFootprint = ovixProfile.workforceFootprint.map(
          (row: Record<string, unknown>) => ({
            city: row.city || undefined,
            stateProvince: row.stateProvince || undefined,
            country: row.country || 'US',
            headcount: row.headcount ? Number(row.headcount) : undefined,
            sourcing: row.sourcing || undefined,
            workforceType: row.workforceType || undefined,
          }),
        )
      }

      if (ovixProfile.customerGeography && typeof ovixProfile.customerGeography === 'object') {
        const geo = ovixProfile.customerGeography
        ovix.customerGeography = {
          scope: geo.scope || undefined,
          usRegions: Array.isArray(geo.usRegions) ? geo.usRegions : undefined,
          usState: geo.usState || undefined,
          euCountries: geo.euCountries || undefined,
          internationalRegions: geo.internationalRegions || undefined,
        }
      }

      updateData.ovixProfile = ovix
    }

    const updated = await payload.update({
      collection: 'members',
      id: Number(memberId),
      data: updateData,
      overrideAccess: true,
    })

    return Response.json({ success: true, member: { id: updated.id, username: updated.username } })
  } catch (e) {
    console.error('Member setup error:', e)
    return Response.json({ error: 'Server error', detail: String(e) }, { status: 500 })
  }
}
