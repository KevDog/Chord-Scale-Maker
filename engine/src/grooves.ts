/**
 * The pattern sets' drums (#509, #540): the kit's voices a groove plays. Pure: the app sounds them (clickSounds.ts).
 * ride and bell: the ride cymbal's stick and bell; hat: the hi-hat foot's chick; tip: a closed hat struck; open: an open
 * hat; stick: a cross-stick on the snare; kick; sweep and brush: a brush swept round the snare, and a brush tap.
 */
export const DRUM_KINDS = ['ride', 'bell', 'hat', 'tip', 'open', 'stick', 'kick', 'sweep', 'brush'] as const
export type DrumKind = (typeof DRUM_KINDS)[number]
