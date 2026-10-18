<template>
  <article class="max-w-2xl space-y-8">
    <header>
      <UiHeading>Contact</UiHeading>
      <UiText class="mt-1">Questions, ideas, a bug, or a tune you'd like in the library: send a message and I'll get back to you.</UiText>
    </header>

    <div v-if="sent" role="status" class="space-y-3 rounded-xl bg-note-50 p-6 ring-1 ring-note-200 dark:bg-note-950 dark:ring-note-900">
      <UiSubheading :level="2">Thanks, your message is on its way.</UiSubheading>
      <UiText>I'll reply to the email address you gave.</UiText>
      <UiButton outline @click="reset">Send another</UiButton>
    </div>

    <form v-else class="space-y-6" novalidate @submit.prevent="send">
      <UiFieldset :disabled="sending">
        <UiFieldGroup>
          <UiField>
            <UiLabel>Name</UiLabel>
            <UiInput v-model="form.name" name="name" autocomplete="name" :invalid="!!errors.name" :maxlength="CONTACT_LIMITS.name" required />
            <UiErrorMessage v-if="errors.name">{{ errors.name }}</UiErrorMessage>
          </UiField>
          <UiField>
            <UiLabel>Email</UiLabel>
            <UiInput v-model="form.email" type="email" name="email" autocomplete="email" :invalid="!!errors.email" required />
            <UiDescription>So I can reply. It isn't used for anything else.</UiDescription>
            <UiErrorMessage v-if="errors.email">{{ errors.email }}</UiErrorMessage>
          </UiField>
          <UiField>
            <UiLabel>Message</UiLabel>
            <UiTextarea v-model="form.message" name="message" rows="6" :invalid="!!errors.message" :maxlength="CONTACT_LIMITS.message" required />
            <UiErrorMessage v-if="errors.message">{{ errors.message }}</UiErrorMessage>
          </UiField>
          <!-- a chart from the editor, for the library (#153): attached as text, with an optional credit -->
          <div v-if="chart" class="space-y-3 rounded-lg p-4 ring-1 ring-zinc-950/10 dark:ring-white/10">
            <div class="flex items-start justify-between gap-4">
              <UiText><UiStrong>{{ chart.title }}</UiStrong> · {{ lines }} {{ lines === 1 ? 'line' : 'lines' }}, attached as {{ fileName }}</UiText>
              <UiButton plain class="text-sm!" :aria-label="`Remove the chart ${chart.title}`" @click="chart = null">Remove</UiButton>
            </div>
            <UiCheckbox v-model="credit" name="credit">Credit me as {{ form.name.trim() || 'you' }} on the tune page</UiCheckbox>
            <UiErrorMessage v-if="errors.chart">{{ errors.chart }}</UiErrorMessage>
          </div>
          <FileDrop v-model="attachment" v-model:preparing="preparing" :disabled="sending" :error="errors.attachment" />
        </UiFieldGroup>
      </UiFieldset>

      <!-- a honeypot: hidden from people and screen readers; bots that fill it are quietly ignored -->
      <div class="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true">
        <label>Website <input v-model="form.website" name="website" type="text" tabindex="-1" autocomplete="off"></label>
      </div>

      <UiText v-if="chart" class="text-sm/6!">By sending, you agree I may add this chart to the library, edit it, and publish it on the site.</UiText>
      <div class="flex flex-wrap items-center gap-4">
        <UiButton type="submit" color="note" :disabled="sending || preparing">{{ sending ? 'Sending…' : 'Send message' }}</UiButton>
        <UiText v-if="failure" role="alert" class="text-red-700! dark:text-red-400!">{{ failure }}</UiText>
      </div>
      <UiText class="text-sm/6!">Your message is emailed to me and used only to reply; see <UiTextLink href="/privacy">Privacy</UiTextLink>.</UiText>
    </form>
  </article>
</template>

<script setup lang="ts">
import { PAGE_HEAD, seoMeta } from '~/utils/site'
import type { ReadyAttachment } from '~/utils/attachment'
import { ISSUE_TEXT_KEY } from '~/utils/issueReport'
import { chartFilename, CONTACT_LIMITS, type ContactField as Field, EMAIL } from '../../server/utils/contactMessage'
import { buildChartReport, CHART_REPORT_KEY } from '~/utils/chartReport'
import { CHART_SUBMISSION_KEY, type ChartSubmission, chartSubmissionFrom, submissionMessage } from '~/utils/chartSubmission'

/** the contact form: posts to /api/contact, which emails the message (server/api/contact.post.ts) */
const blank = () => ({ name: '', email: '', message: '', website: '' })
const form = reactive(blank())
const attachment = ref<ReadyAttachment | null>(null)
const preparing = ref(false)
const errors = ref<Partial<Record<Field, string>>>({})
const sending = ref(false)
const sent = ref(false)
const failure = ref('')
let startedAt = 0
/** a chart handed over from the editor to send for the library, and whether to credit the sender */
const chart = ref<ChartSubmission | null>(null)
const credit = ref(false)
const lines = computed(() => chart.value?.text.trimEnd().split('\n').length ?? 0)
// the server's own rule, so the name shown is the name sent
const fileName = computed(() => (chart.value ? chartFilename({ text: '', title: chart.value.title, slug: chart.value.slug ?? null, credit: false }) : ''))

watch(attachment, () => {
  const { attachment: _, ...rest } = errors.value
  errors.value = rest
})

onMounted(() => {
  startedAt = Date.now()
  // a chart to send for the library (from the editor), once, then cleared
  const submission = chartSubmissionFrom(sessionStorage.getItem(CHART_SUBMISSION_KEY))
  sessionStorage.removeItem(CHART_SUBMISSION_KEY)
  if (submission) {
    chart.value = submission
    form.message = submissionMessage(submission)
  }
  // a chart-error report (from the editor) pre-fills the message, once, then is cleared
  const raw = sessionStorage.getItem(CHART_REPORT_KEY)
  if (raw) {
    sessionStorage.removeItem(CHART_REPORT_KEY)
    try {
      form.message = buildChartReport(JSON.parse(raw))
    } catch {
      /* a malformed or oversized blob: leave the form blank */
    }
  }
  // a scale disagreement (the Changes sheet's Report issue) pre-fills the message, once, then is cleared
  const issue = sessionStorage.getItem(ISSUE_TEXT_KEY)
  if (issue && !form.message) {
    sessionStorage.removeItem(ISSUE_TEXT_KEY)
    form.message = issue.slice(0, CONTACT_LIMITS.message)
  }
})

/** the same rules the server applies, so most mistakes show without a round trip */
function localErrors(): Partial<Record<Field, string>> {
  const e: Partial<Record<Field, string>> = {}
  if (!form.name.trim()) e.name = 'Please add your name.'
  const email = form.email.trim()
  if (!EMAIL.test(email) || email.length > CONTACT_LIMITS.email) e.email = 'Please add a valid email address.'
  if (!form.message.trim()) e.message = 'Please write a message.'
  return e
}

async function send(): Promise<void> {
  failure.value = ''
  errors.value = localErrors()
  if (Object.keys(errors.value).length || preparing.value) return
  sending.value = true
  try {
    const sentChart = chart.value ? { chart: { text: chart.value.text, title: chart.value.title, slug: chart.value.slug, credit: credit.value } } : {}
    await $fetch('/api/contact', { method: 'POST', body: { ...form, startedAt, attachment: attachment.value?.attachment, ...sentChart } })
    sent.value = true
  } catch (e: unknown) {
    // a 400 carries the server's field errors (the error's data); anything else is a sending problem
    const fields = (e as { data?: { data?: { errors?: Partial<Record<Field, string>> } } }).data?.data?.errors
    if (fields) errors.value = fields
    else failure.value = "Sorry, the message couldn't be sent. Please try again in a little while."
  } finally {
    sending.value = false
  }
}

function reset(): void {
  Object.assign(form, blank())
  attachment.value = null
  chart.value = null
  credit.value = false
  errors.value = {}
  sent.value = false
  startedAt = Date.now()
}

useSeoMeta(seoMeta(PAGE_HEAD.contact))
</script>
