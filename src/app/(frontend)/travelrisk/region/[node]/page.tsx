import { permanentRedirect } from 'next/navigation'
import { nwsDashboardHref } from '@/lib/travelrisk/nwsHref'

/**
 * REGION WINDOW — retired (Ted, 2026-10-15)
 * ============================================================================
 * The tier-2 region window (twelve domain scores + a list of panels) was the page every World Glass
 * link landed on, one click short of the panel that actually explains the weather. Ted: "retire all
 * those regional dashboards and bridge directly to the appropriate NWS". The only live panel is NWS
 * Active Warnings, so /travelrisk/region/<node> now goes straight to /travelrisk/region/<node>/nws.
 * A node outside NWS coverage gets that dashboard's honest gap page, not a US list dressed as its own.
 * The World Glass board links there directly (wg-fleet.js); this redirect catches old bookmarks.
 */

export const dynamic = 'force-dynamic'

export default async function RegionWindowPage({ params }: { params: Promise<{ node: string }> }) {
  const { node } = await params
  permanentRedirect(nwsDashboardHref(node))
}
