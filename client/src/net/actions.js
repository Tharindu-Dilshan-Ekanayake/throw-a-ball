/**
 * Player intents. The UI never changes game state itself: it calls one of these, the
 * authority (the Colyseus room, or the offline stand-in) validates it, and the result
 * comes back as an updated profile or an event.
 */

let transport = null

/** Installs the active connection: `{ send(type, payload) }`. */
export function setTransport(next) {
  transport = next
}

export function send(type, payload) {
  if (!transport) return
  transport.send(type, payload)
}

export const actions = {
  throwPlane: () => send('throw'),
  /** A click throw anywhere outside the throw area (see ClickThrow). */
  click: () => send('click'),
  enterLane: (lane) => send('enterLane', { lane }),
  leaveLane: () => send('leaveLane'),
  rebirth: () => send('rebirth'),
  buyPlane: (id) => send('buyPlane', { id }),
  equipPlane: (id) => send('equipPlane', { id }),
  hatch: (eggId, count = 1) => send('hatch', { eggId, count }),
  openEggItem: (itemId) => send('openEggItem', { itemId }),
  equipPet: (uid) => send('equipPet', { uid }),
  unequipPet: (uid) => send('unequipPet', { uid }),
  equipBestPets: () => send('equipBest'),
  deletePet: (uid) => send('deletePet', { uid }),
  usePotion: (itemId) => send('usePotion', { itemId }),
  claimDaily: (day) => send('claimDaily', { day }),
  claimPlaytime: (index) => send('claimPlaytime', { index }),
  claimFreeReward: () => send('claimFreeReward'),
  setSetting: (key, value) => send('setting', { key, value }),
  portal: () => send('portal'),
  /** Buys a shop item with Wins; see shop.js. */
  purchase: (productId) => send('purchase', { productId }),
}
