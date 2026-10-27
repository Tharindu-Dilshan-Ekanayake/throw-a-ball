import { schema, t } from '@colyseus/schema'

/**
 * Synced state, kept deliberately small: only what other players need to draw you.
 * Everything private (inventory, items, boosts...) goes to its owner alone as
 * 'profile' messages, never through the shared state.
 */
export const PlayerState = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    rotY: t.float32(),
    /** 'idle' | 'walk' | 'jump' | 'throw' */
    anim: t.string(),
    /** Throws so far (any kind); each new one plays the throw for everyone watching. */
    throws: t.uint32(),
    /** What their Bloxity avatar wears, as JSON `{ equipped, proportions }` ('' = base). */
    look: t.string(),
    planeId: t.string(),
    /** Equipped pet species, at most 3. */
    petIds: t.array('string'),
    power: t.float64(),
    wins: t.float64(),
    rebirths: t.uint16(),
    level: t.uint16(),
  },
  'PlayerState',
)

export const GameState = schema(
  {
    /** sessionId -> player */
    players: t.map(PlayerState),
    /** Short code for private lobbies ('' for public ones). */
    code: t.string(),
    isPrivate: t.boolean(),
  },
  'GameState',
)
