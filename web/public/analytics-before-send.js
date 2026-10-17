// Vercel Web Analytics sends the page's full address; share links carry a whole chart after the "#", which must
// stay in the browser. Queued before the analytics script loads (both deferred, so this runs first).
window.vaq = window.vaq || []
// the queue stub @vercel/analytics would add inline: calls made before the script loads wait in vaq
window.va =
  window.va ||
  function () {
    window.vaq.push(arguments)
  }
window.vaq.push([
  'beforeSend',
  function (event) {
    var url = new URL(event.url)
    url.hash = ''
    return Object.assign({}, event, { url: url.href })
  },
])
