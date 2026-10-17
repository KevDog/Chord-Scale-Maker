<template>
  <span class="inline-flex items-center gap-1 align-middle text-zinc-700 dark:text-zinc-300 print:text-black">
    <svg v-if="segno" viewBox="0 0 546 786" class="h-4 w-3" aria-label="Segno" role="img">
      <path d="M131 94Q136 94 140 96Q145 99 147 107L149 114Q153 137 169 167Q185 197 222 200Q253 200 272 183Q291 165 291 133Q291 110 283 86Q269 52 229 37Q189 23 149 23Q94 25 48 78Q3 131 0 208Q0 244 16 282Q48 340 118 391Q187 442 201 447Q207 449 207 455Q207 461 201 471Q187 497 123 613Q59 728 50 744Q47 750 47 757Q47 769 55 777Q63 786 75 786Q83 786 89 782Q96 778 100 771Q110 754 178 630Q246 507 258 485Q258 485 263 483Q267 480 270 480Q293 483 383 524Q473 565 485 637Q485 666 469 685Q453 703 427 707L424 708Q408 708 397 697Q386 686 386 663V652Q385 623 370 605Q355 587 333 586Q327 586 321 588Q292 594 272 609Q251 624 250 653Q252 700 288 733Q325 766 371 767Q391 767 413 760Q474 739 510 693Q545 648 546 585Q546 571 544 556Q524 472 450 414Q377 357 359 351Q350 346 346 342Q342 339 342 335Q342 332 344 329Q357 306 426 182Q494 59 504 42Q506 38 507 35Q508 32 508 28Q508 16 500 8Q492 0 480 0Q472 0 466 4Q459 7 455 14Q445 32 375 159Q304 286 290 310Q288 314 286 316Q284 318 281 318Q277 318 271 315Q256 311 184 278Q113 245 85 209Q80 200 76 186Q71 172 71 156Q70 135 82 117Q94 100 125 94ZM411 293Q412 317 428 333Q444 349 468 350Q493 349 509 333Q524 317 525 293Q524 268 509 252Q493 237 468 236Q444 237 428 252Q412 268 411 293ZM136 495Q135 471 120 455Q104 439 79 438Q55 439 39 455Q23 471 22 495Q23 520 39 535Q55 551 79 552Q104 551 120 535Q135 520 136 495Z" fill="currentColor" />
    </svg>
    <svg v-if="coda" viewBox="0 0 16 16" class="h-4 w-4" aria-label="Coda" role="img">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.4" />
      <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" stroke-width="1.4" />
      <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.4" />
    </svg>
    <span v-if="nav" class="text-xs font-semibold whitespace-nowrap italic">{{ nav }}</span>
  </span>
</template>

<script setup lang="ts">
/** the navigation marks above a Changes bar: a segno 𝄋 (Bravura's outline), a coda ⊕ (both inline SVG, CSP-safe), and an instruction */
defineProps<{ segno: boolean; coda: boolean; nav: string }>()
</script>
