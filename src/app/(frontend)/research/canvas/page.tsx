import React from 'react'
import { BeaconCaseCanvas } from '@/components/beacon/BeaconCaseCanvas'

/**
 * Beacon Case Canvas — the analyst workbench (research-018 / WFM-92).
 *
 * Lives at /research/canvas (linked from /research) so the classic chat Beacon stays reachable until
 * FOREMAN cuts over. The whole UI is the client component; auth + the premium gate are handled there.
 */

export const metadata = { title: 'Beacon Case Canvas | WFM Labs Hub' }
export const dynamic = 'force-dynamic'

export default function BeaconCanvasPage() {
  return (
    <div style={{ maxWidth: '84rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <BeaconCaseCanvas />
    </div>
  )
}
