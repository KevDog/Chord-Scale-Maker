<template>
  <div class="lg:grid lg:grid-cols-[minmax(0,42rem)_14rem] lg:gap-12">
    <!-- from lg: the text, and its index in a column beside it -->
    <article class="max-w-3xl space-y-8">
      <header>
        <UiHeading>Privacy</UiHeading>
        <UiText class="mt-1">Short version: Nothing is tracked, sold or shared. I don't know anything about you, and you don't know anything about me.</UiText>
        <PageIndex :sections="SECTIONS" />
      </header>

      <section class="space-y-3" aria-labelledby="contact">
        <UiSubheading id="contact" class="scroll-mt-6">The contact form</UiSubheading>
        <UiText>
          If you send a message, your name, email address and message, and any file you attach, are emailed to me
          (sent through the email service Resend) so I can read and answer it. Nothing is kept on this site. They
          aren't used for anything else, added to a mailing list or shared.
        </UiText>
      </section>

      <section class="space-y-3" aria-labelledby="stats">
        <UiSubheading id="stats" class="scroll-mt-6">Visitor statistics</UiSubheading>
        <UiText>
          Page views are counted with Vercel Web Analytics. It uses no cookies, doesn't track you across sites or over
          time, and keeps no advertising profile.
        </UiText>
      </section>

      <section class="space-y-3" aria-labelledby="browser">
        <UiSubheading id="browser" class="scroll-mt-6">What stays in your browser</UiSubheading>
        <UiText>
          Your theme, instrument and practice choices, and anything you type into the editor, are kept in your
          browser's own storage so they're there next time. They're never sent anywhere. Clearing your browser's data
          for this site removes them.
        </UiText>
        <UiText>
          That includes My charts: your saved and edited charts stay in this browser only. A share link carries its
          chart in the part of the address after the <UiCode>#</UiCode>, which browsers don't send to the website, and
          which is removed before a visit is counted. Downloaded files are yours alone.
        </UiText>
      </section>

      <section class="space-y-3" aria-labelledby="video">
        <UiSubheading id="video" class="scroll-mt-6">The video on the About page</UiSubheading>
        <UiText>
          Nothing loads from YouTube until you press play. It then plays from YouTube's privacy-enhanced domain, under
          <UiTextLink href="https://policies.google.com/privacy" external>Google's privacy policy</UiTextLink>.
        </UiText>
      </section>

      <section class="space-y-3" aria-labelledby="support">
        <UiSubheading id="support" class="scroll-mt-6">Support links</UiSubheading>
        <UiText>
          The support buttons on the About page are plain links to Ko-fi and Patreon. Nothing from either loads on this
          site; if you follow one, you're on that site, under its own privacy policy.
        </UiText>
      </section>

      <section class="space-y-3" aria-labelledby="questions">
        <UiSubheading id="questions" class="scroll-mt-6">Questions</UiSubheading>
        <UiText>Ask through the <UiTextLink href="/contact">contact form</UiTextLink>.</UiText>
      </section>
    </article>
    <PageIndex :sections="SECTIONS" column :current="current" />
  </div>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'
const SECTIONS = [
  { id: 'contact', title: 'The contact form' },
  { id: 'stats', title: 'Visitor statistics' },
  { id: 'browser', title: 'What stays in your browser' },
  { id: 'video', title: 'The video on the About page' },
  { id: 'support', title: 'Support links' },
  { id: 'questions', title: 'Questions' },
]
const current = useCurrentSection(() => SECTIONS.map((s) => s.id))

useSeoMeta(seoMeta(PAGE_HEAD.privacy))
</script>
