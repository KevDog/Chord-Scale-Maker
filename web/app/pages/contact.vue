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
          <FileDrop v-model="attachment" v-model:preparing="preparing" :disabled="sending" :error="errors.attachment" />
        </UiFieldGroup>
      </UiFieldset>

      <!-- a honeypot: hidden from people and screen readers; bots that fill it are quietly ignored -->
      <div class="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true">
        <label>Website <input v-model="form.website" name="website" type="text" tabindex="-1" autocomplete="off"></label>
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <UiButton type="submit" color="note" :disabled="sending || preparing">{{ sending ? 'Sending…' : 'Send message' }}</UiButton>
        <UiText v-if="failure" role="alert" class="text-red-700! dark:text-red-400!">{{ failure }}</UiText>
      </div>
      <UiText class="text-sm/6!">Your message is emailed to me and used only to reply; see <UiTextLink href="/privacy">Privacy</UiTextLink>.</UiText>
    </form>
  </article>
</template>

<script setup lang="ts">
import type { ReadyAttachment } from '~/utils/attachment'
import { CONTACT_LIMITS, type ContactField as Field, EMAIL } from '../../server/utils/contactMessage'

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

watch(attachment, () => {
  const { attachment: _, ...rest } = errors.value
  errors.value = rest
})

onMounted(() => {
  startedAt = Date.now()
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
    await $fetch('/api/contact', { method: 'POST', body: { ...form, startedAt, attachment: attachment.value?.attachment } })
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
  errors.value = {}
  sent.value = false
  startedAt = Date.now()
}

useHead({ title: 'Contact · Chord Scale Maker' })
</script>
