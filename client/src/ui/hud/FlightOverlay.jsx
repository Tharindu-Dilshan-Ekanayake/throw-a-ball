import { useCallback } from 'react'

import { formatNumber } from '@shared/format'

import { setDistanceElement } from '../../game/flight/hudLink'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** "409m" under the Auto Throw button while a frisbee is in the air. */
function DistanceCounter() {
  // A callback ref: registered when the element mounts, cleared when it unmounts.
  const ref = useCallback((el) => setDistanceElement(el), [])
  return (
    <div ref={ref} className="pointer-events-none absolute left-1/2 -translate-x-1/2" style={{ top: u(148), fontSize: u(76) }}>
      <span className="pp-text">
        <span data-distance aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(14) }}>
          0m
        </span>
        <span
          data-distance
          className="pp-text-fill"
          style={{ backgroundImage: GRADIENTS.gold, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
        >
          0m
        </span>
      </span>
    </div>
  )
}

/** The landing receipt: "+N Wins" in the middle of the screen. */
function ThrowResult({ result }) {
  return (
    <div key={result.id} className="pp-result pointer-events-none absolute left-1/2 top-[38%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
      <div className="flex items-center" style={{ gap: u(14), fontSize: u(110) }}>
        <Icon name="trophy" size={u(130)} />
        <StrokeText stroke={u(18)} gradient={GRADIENTS.gold}>
          +{formatNumber(result.wins)} Wins
        </StrokeText>
      </div>
      <div style={{ fontSize: u(48) }}>
        <StrokeText stroke={u(10)}>{formatNumber(result.distance)}m</StrokeText>
      </div>
    </div>
  )
}

export function FlightOverlay() {
  const flying = useGame((s) => Boolean(s.flight))
  const result = useGame((s) => s.throwResult)
  return (
    <>
      {flying && <DistanceCounter />}
      {result && <ThrowResult result={result} />}
    </>
  )
}

export default FlightOverlay
