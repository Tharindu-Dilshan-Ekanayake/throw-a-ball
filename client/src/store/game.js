import { create } from 'zustand'

import { SPHINX_STOCK_DEFAULT } from '@shared/balance'
import { createProfile, createSession } from '@shared/logic'

/**
 * Everything the UI renders from. Written by the network layer (profile, events) and
 * the 10 Hz game ticker (zones, timers) - never from a frame loop.
 *
 * Components must select narrowly (`useGame((s) => s.profile.wins)`), so a Power tick
 * re-renders the Power label and nothing else.
 */


export const useGame = create((set, get) => ({
  /** Authoritative copy of the player's save, as last sent by the server. */
  profile: createProfile('local', 'Player'),
  /** Per-connection state: session start, claimed playtime rewards. */
  session: createSession(Date.now()),
  /** True once the first real profile has arrived. */
  profileLoaded: false,
  /** True once the game is on screen; non-essential start-up work waits for it. */
  playable: false,

  net: {
    /** 'connecting' | 'online' | 'offline' */
    mode: 'connecting',
    lobbyId: null,
    /** Short code friends join with, for private lobbies. */
    code: null,
    isPrivate: false,
    players: 1,
    maxPlayers: 8,
    message: null,
  },
  sphinxStock: SPHINX_STOCK_DEFAULT,
  leaderboards: null,

  /** Where the player is standing, from the ticker. */
  zone: { lane: -1, laneNear: -1, throwArea: false, pad: -1, egg: null, portal: false, freeReward: false, sphinx: false },

  /** Which modal panel is open: 'rebirth' | 'daily' | 'pets' | 'items' | 'store' | ... */
  panel: null,
  /** Extra data for the open panel (e.g. which egg the hatch panel is for). */
  panelData: null,

  /** A flight in progress: { distance, wins, trophies, duration, startedAt }. */
  flight: null,
  /** Wins earned by the current flight, held back from the HUD until it lands. */
  pendingWins: 0,
  /** "+N Wins" popup after landing. */
  throwResult: null,
  /** Active hatch animation: { eggId, pets }. */
  hatch: null,
  /** Keep hatching the egg you're standing at (the T button). Client-side only. */
  autoHatch: false,


  // --- Actions -----------------------------------------------------------------

  setProfile: (profile, session) =>
    set((s) => ({ profile, session: session || s.session, profileLoaded: true })),
  patchProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  setZone: (zone) => set({ zone }),
  setPlayable: () => set({ playable: true }),
  setSphinxStock: (sphinxStock) => set({ sphinxStock }),
  setLeaderboards: (leaderboards) => set({ leaderboards }),

  openPanel: (panel, panelData = null) => set({ panel, panelData }),
  closePanel: () => set({ panel: null, panelData: null }),
  togglePanel: (panel) => set((s) => (s.panel === panel ? { panel: null, panelData: null } : { panel, panelData: null })),

  /** kind: 'info' | 'error' | 'success' | 'badge' */

  startFlight: (flight) => set({ flight, pendingWins: flight.wins }),
  endFlight: () => {
    const { flight } = get()
    set({ flight: null, pendingWins: 0, throwResult: flight ? { wins: flight.wins, distance: flight.distance, id: Date.now() } : null })
  },
  clearThrowResult: () => set({ throwResult: null }),

  setHatch: (hatch) => set({ hatch }),
  setAutoHatch: (autoHatch) => set({ autoHatch }),
}))

/** Non-reactive snapshot for timers and non-React code. */
export const getGame = () => useGame.getState()
