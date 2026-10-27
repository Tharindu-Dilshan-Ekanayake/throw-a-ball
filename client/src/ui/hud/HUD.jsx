import { useGame } from '../../store/game'
import EggPanel from './EggPanel'
import FlightOverlay from './FlightOverlay'
import InteractPrompt from './InteractPrompt'
import LeftMenu from './LeftMenu'
import PowerBar from './PowerBar'
import StatsPanel from './StatsPanel'
import ThrowButton from './ThrowButton'
import TopBar from './TopBar'
import TopCenter from './TopCenter'

/**
 * The heads-up display: the logo's corner top-left, your name tag top-right, menu tiles
 * on the left, stats bottom-left, and power, level and power packs bottom-centre.
 *
 * The root ignores pointer events so the canvas and joystick underneath keep working;
 * only the buttons themselves opt back in. While a panel is open the HUD steps aside,
 * as in the reference.
 */
export function HUD() {
  const panelOpen = useGame((s) => s.panel !== null)
  // While a frisbee is in the air the side menus clear out, as in the reference.
  const watching = useGame((s) => Boolean(s.flight || s.throwResult))
  return (
    <div className="pp-font pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: panelOpen ? 0 : 1, visibility: panelOpen ? 'hidden' : 'visible' }}>
        <TopBar />
        <TopCenter />
        {/* Hidden, not unmounted, while a frisbee flies: remounting them at the moment
            of the throw cost a visible hitch on slow phones. */}
        <div className="contents" style={{ visibility: watching ? 'hidden' : 'visible' }}>
          <LeftMenu />
        </div>
        <StatsPanel />
        <PowerBar />
        <ThrowButton />
        <InteractPrompt />
        <EggPanel />
        <FlightOverlay />
      </div>
    </div>
  )
}

export default HUD
