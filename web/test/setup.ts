import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach } from 'vitest'

// the Interface level is decided when the app starts (plugins/interface.client.ts), and a new browser starts at
// Essentials: the tests start at Everything, as a browser that chose it, unless they pick a level
localStorage.setItem('csm-interface', 'everything')

// a mounted page left behind would keep its window listeners (⌘Z, #315) answering for the next test's
enableAutoUnmount(afterEach)
