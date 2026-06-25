import { permanentRedirect } from 'next/navigation'

/**
 * /research/canvas — legacy URL. The Beacon Case Canvas is now the /research experience itself
 * (research-022 / WFM-98), so this path permanently redirects there. Kept only so old links and
 * bookmarks resolve; there is no second mount of the canvas.
 */

export const dynamic = 'force-dynamic'

export default function BeaconCanvasRedirect() {
  permanentRedirect('/research')
}
