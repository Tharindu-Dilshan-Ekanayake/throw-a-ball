import { useEffect } from 'react'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { GRADIENTS, u } from './style'

/**
 * The big green THROW button, shown while standing in the throw area. E or Enter
 * throws too.
 */
export function ThrowButton() {
  const visible = useGame((s) => s.zone.throwArea && !s.flight && !s.throwResult)

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (e) => {
      if (e.repeat) return
      if (e.code === 'KeyE' || e.code === 'Enter') actions.throwPlane()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  if (!visible) return null
  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(236) }}>
      <Icon name="arrowDown" size={u(76)} className="pp-bounce" style={{ marginBottom: u(6) }} />
      <ChunkyButton gradient={GRADIENTS.greenButton} onClick={() => actions.throwPlane()} style={{ width: u(270), height: u(86) }} radius={22} border={5}>
        <span style={{ fontSize: u(62) }}>
          <StrokeText stroke={u(11)}>THROW</StrokeText>
        </span>
      </ChunkyButton>
    </div>
  )
}

export default ThrowButton
