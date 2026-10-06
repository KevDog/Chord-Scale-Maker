import { HeartIcon, StarIcon } from '@heroicons/vue/16/solid'

/** ways to chip in (the About page's buttons, and their small versions in the footer): plain links, no widgets */
export const SUPPORT = [
  { name: 'Ko-fi', label: 'Buy me a coffee on Ko-fi', url: 'https://ko-fi.com/kcstevens90266', icon: HeartIcon },
  { name: 'Patreon', label: 'Become a patron on Patreon', url: 'https://www.patreon.com/kcstevens', icon: StarIcon },
] as const
