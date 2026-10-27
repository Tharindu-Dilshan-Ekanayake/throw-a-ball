import { TUTORIAL } from '@shared/balance'
import { isMaxLevel, rebirthProgress } from '@shared/logic'

import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** The tutorial line, with a progress bar on the rebirth step. */
function TutorialBanner() {
  const step = useGame((s) => s.profile.tutorialStep)
  const inThrowArea = useGame((s) => s.zone.throwArea)
  const flying = useGame((s) => Boolean(s.flight))
  const progress = useGame((s) => rebirthProgress(s.profile))
  const maxed = useGame((s) => isMaxLevel(s.profile))

  const current = TUTORIAL[step]
  if (!current || flying) return null
  let text = current.text
  if (current.event === 'throw' && inThrowArea) text = 'Press on the Throw button'

  return (
    <div className="flex flex-col items-center">
      <div
        style={{
          padding: `${u(4)} ${u(22)}`,
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.32) 15%, rgba(0,0,0,0.32) 85%, rgba(0,0,0,0) 100%)',
          fontSize: u(46),
        }}
      >
        <StrokeText stroke={u(9)}>{text}</StrokeText>
      </div>
      {current.event === 'rebirth' && (
        <div
          className="relative overflow-hidden"
          style={{ width: u(770), height: u(36), border: `${u(3)} solid #111`, background: 'rgba(0,0,0,0.45)', marginTop: u(6) }}
        >
          <div className="absolute inset-y-0 left-0" style={{ width: `${progress * 100}%`, background: GRADIENTS.barFill }} />
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(20) }}>
            <StrokeText stroke={u(5)}>{maxed ? 'MAX LEVEL - REBIRTH!' : `${Math.floor(progress * 100)}% TO MAX LEVEL`}</StrokeText>
          </div>
        </div>
      )}
    </div>
  )
}

export function TopCenter() {
  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(10) }}>
      <TutorialBanner />
    </div>
  )
}

export default TopCenter
