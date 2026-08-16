import { create } from 'zustand'
import type { PartGroup } from '../parts/types'

export interface ViewerState {
  /**
   * The ONE explode scalar: 0 = fully assembled, 1 = fully apart.
   *
   * There used to be a second, independent scalar for the calibre. Two sliders
   * meant two timelines that could disagree — a half-open case around a fully
   * stripped movement — and nothing in the UI explained which did what. The
   * per-part `order` cascade already staggers the movement behind the case, so one
   * scalar covers the whole teardown.
   */
  explodeT: number
  hovered: string | null
  selected: string | null
  /** Groups currently visible; others dim out. */
  activeGroups: Record<PartGroup, boolean>
  lume: boolean
  /** 0..1 lume charge, decays over time while lume mode is on. */
  lumeCharge: number
  envIntensity: number
  envRotation: number
  showAnnotations: boolean
  /** True while the user is scrubbing, so shadows can drop to the cheap path. */
  interacting: boolean

  setExplodeT(v: number): void
  setHovered(id: string | null): void
  setSelected(id: string | null): void
  toggleGroup(g: PartGroup): void
  soloGroup(g: PartGroup | null): void
  setLume(on: boolean): void
  chargeLume(): void
  setLumeCharge(v: number): void
  setEnvRotation(v: number): void
  setShowAnnotations(v: boolean): void
  setInteracting(v: boolean): void
}

export const useViewer = create<ViewerState>((set) => ({
  explodeT: 0,
  hovered: null,
  selected: null,
  activeGroups: { case: true, dial: true, movement: true, bracelet: true },
  lume: false,
  lumeCharge: 0,
  envIntensity: 1,
  envRotation: 0,
  showAnnotations: true,
  interacting: false,

  setExplodeT: (v) => set({ explodeT: Math.max(0, Math.min(1, v)) }),
  setHovered: (hovered) => set({ hovered }),
  setSelected: (selected) => set({ selected }),
  toggleGroup: (g) =>
    set((s) => ({ activeGroups: { ...s.activeGroups, [g]: !s.activeGroups[g] } })),
  soloGroup: (g) =>
    set(() => ({
      activeGroups: {
        case: g === null || g === 'case',
        dial: g === null || g === 'dial',
        movement: g === null || g === 'movement',
        bracelet: g === null || g === 'bracelet',
      },
    })),
  setLume: (on) => set({ lume: on, lumeCharge: on ? 1 : 0 }),
  chargeLume: () => set({ lumeCharge: 1 }),
  setLumeCharge: (v) => set({ lumeCharge: Math.max(0, Math.min(1, v)) }),
  setEnvRotation: (v) => set({ envRotation: v }),
  setShowAnnotations: (v) => set({ showAnnotations: v }),
  setInteracting: (v) => set({ interacting: v }),
}))
