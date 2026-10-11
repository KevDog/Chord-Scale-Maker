import type { InjectionKey, Ref } from 'vue'
import type { ScaleView } from '@chord-scale-maker/engine'

/** the level the sheets play blank cells at (EditorView provides it), for the grid's notes beside them */
export const SCALE_VIEW: InjectionKey<Readonly<Ref<ScaleView>>> = Symbol('scaleView')

/** with nothing provided: Standard */
export const DEFAULT_VIEW: ScaleView = { level: 'standard', seed: 0 }
