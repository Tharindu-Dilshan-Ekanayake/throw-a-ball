import { LEVEL_STEPS, SHOP } from '@shared/balance'
import { formatMultiplier, formatNumber } from '@shared/format'
import { hudMultiplier, isMaxLevel } from '@shared/logic'

import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import useNow from '../useNow'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from './parts'
import { GRADIENTS, u } from './style'

/** Width of the whole bar, in reference pixels: every row lines up to it. */
const WIDTH = 640

const PACKS = [
  { product: 'power100k', label: '+100K', gradient: GRADIENTS.goldButton },
  { product: 'power1m', label: '+1M', gradient: GRADIENTS.blueButton },
  { product: 'power10m', label: '+10M', gradient: GRADIENTS.purpleButton },
]

function LevelBar() {
  const level = useGame((s) => s.profile.level)
  const progress = useGame((s) => s.profile.levelProgress)
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const fill = maxed ? 1 : progress / LEVEL_STEPS

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: u(48),
        borderRadius: u(24),
        border: `${u(4)} solid #111`,
        background: 'rgba(22, 24, 30, 0.62)',
        boxShadow: `0 ${u(4)} 0 #111`,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out"
        style={{ width: `${fill * 100}%`, background: GRADIENTS.barFill, borderRadius: u(20) }}
      />
      <div className="absolute" style={{ left: u(10), right: u(10), top: u(4), height: u(12), borderRadius: u(6), background: 'rgba(255,255,255,0.25)' }} />
      <div className="absolute inset-0 flex items-center justify-between" style={{ padding: `0 ${u(18)}`, fontSize: u(30) }}>
        <StrokeText stroke={u(7)}>LEVEL {level}</StrokeText>
        <StrokeText stroke={u(7)}>{maxed ? 'MAX LEVEL' : `${progress} / ${LEVEL_STEPS}`}</StrokeText>
      </div>
    </div>
  )
}

/** A power pack: the arm, the amount, and its price in Wins - all inside the button. */
function PackButton({ product, label, gradient }) {
  const item = SHOP[product]
  const afford = useGame((s) => s.profile.wins >= item.price)
  return (
    <ChunkyButton
      gradient={gradient}
      onClick={() => buy(product)}
      title={item.name}
      radius={16}
      style={{ width: u(198), height: u(76), gap: u(6), padding: `0 ${u(10)}` }}
    >
      <Icon name="muscle" size={u(54)} />
      <span className="flex flex-col items-start" style={{ gap: u(3) }}>
        <span style={{ fontSize: u(34), lineHeight: 1 }}>
          <StrokeText stroke={u(8)}>{label}</StrokeText>
        </span>
        <Price amount={item.price} size={22} afford={afford} />
      </span>
    </ChunkyButton>
  )
}

/**
 * Bottom centre, all on one width: Power and Multiplier, the level bar, then the three
 * power packs.
 */
export function PowerBar() {
  const power = useGame((s) => s.profile.power)
  const lane = useGame((s) => s.zone.lane)
  const profile = useGame((s) => s.profile)
  const now = useNow(1000)
  const multiplier = hudMultiplier(profile, lane, now)

  return (
    <div
      className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center"
      style={{ bottom: u(20), width: u(WIDTH), gap: u(8) }}
    >
      <div className="flex w-full items-center justify-between" style={{ fontSize: u(36), padding: `0 ${u(6)}` }}>
        <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
          Power: {formatNumber(power)}
        </StrokeText>
        <StrokeText stroke={u(8)} gradient={GRADIENTS.gold}>
          Multiplier: {formatMultiplier(multiplier)}
        </StrokeText>
      </div>
      <LevelBar />
      <div className="flex w-full justify-between" style={{ marginTop: u(6) }}>
        {PACKS.map((pack) => (
          <PackButton key={pack.product} {...pack} />
        ))}
      </div>
    </div>
  )
}

export default PowerBar
