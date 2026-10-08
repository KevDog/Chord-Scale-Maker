<template>
  <article class="max-w-3xl space-y-8">
    <header>
      <UiHeading>Privacy</UiHeading>
      <UiText class="mt-1">Short version: nothing is tracked, sold or shared.</UiText>
    </header>

    <section class="space-y-3" aria-labelledby="contact">
      <UiSubheading id="contact">The contact form</UiSubheading>
      <UiText>
        If you send a message, your name, email address and message, and any file you attach, are emailed to me
        (sent through the email service Resend) so I can read and answer it. Nothing is kept on this site. They
        aren't used for anything else, added to a mailing list or shared.
      </UiText>
    </section>

    <section class="space-y-3" aria-labelledby="stats">
      <UiSubheading id="stats">Visitor statistics</UiSubheading>
      <UiText>
        Page views are counted with Vercel Web Analytics. It uses no cookies, doesn't track you across sites or over
        time, and keeps no advertising profile.
      </UiText>
    </section>

    <section class="space-y-3" aria-labelledby="browser">
      <UiSubheading id="browser">What stays in your browser</UiSubheading>
      <UiText>
        Your theme, instrument and practice choices, and anything you type into the editor, are kept in your
        browser's own storage so they're there next time. They're never sent anywhere. Clearing your browser's data
        for this site removes them.
      </UiText>
      <UiText v-if="myCharts">
        That includes My charts: your saved and edited charts stay in this browser only. A share link carries its
        chart in the part of the address after the <UiCode>#</UiCode>, which browsers don't send to the website, and
        which is removed before a visit is counted. Downloaded files are yours alone.
      </UiText>
    </section>

    <section class="space-y-3" aria-labelledby="video">
      <UiSubheading id="video">The video on the About page</UiSubheading>
      <UiText>
        Nothing loads from YouTube until you press play. It then plays from YouTube's privacy-enhanced domain, under
        <UiTextLink href="https://policies.google.com/privacy" external>Google's privacy policy</UiTextLink>.
      </UiText>
    </section>

    <section class="space-y-3" aria-labelledby="support">
      <UiSubheading id="support">Support links</UiSubheading>
      <UiText>
        The support buttons on the About page are plain links to Ko-fi and Patreon. Nothing from either loads on this
        site; if you follow one, you're on that site, under its own privacy policy.
      </UiText>
    </section>

    <section class="space-y-3" aria-labelledby="questions">
      <UiSubheading id="questions">Questions</UiSubheading>
      <UiText>Ask through the <UiTextLink href="/contact">contact form</UiTextLink>.</UiText>
    </section>
  </article>
</template>

<script setup lang="ts">
const myCharts = useFeature('myCharts')
useHead({ title: 'Privacy · Chord Scale Maker' })
</script>
