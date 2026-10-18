.PHONY: setup test lint e2e a11y docs golden og dev preview clean
# installs the dependencies and the repo's git hooks (.githooks/pre-push runs `make docs` and `make a11y` when a push touches what they check)
setup:
	npm ci
	git config core.hooksPath .githooks
test:
	npm run typecheck && npm test
lint:
	npm run lint
# browser tests against the production build (installs Chromium for Playwright on first run)
e2e:
	cd web && npx playwright install chromium && npm run e2e
# accessibility: the app's template lint (vuejs-accessibility) and the axe scans of key pages and popovers (web/e2e/a11y/)
a11y:
	npm run lint -w web
	cd web && npx playwright install chromium && npm run a11y
# documentation: each decision's anchor is on its page (web/test/docs/), and every internal link on the built site resolves
docs:
	cd web && npx vitest run test/docs && npm run build && npm run check:links
# rewrite engine/fixtures/golden.json and analysis.json from the engine after an intended change; review their diffs
golden:
	npm run golden -w engine
# draw the link preview of each library song whose heading or first bars changed (web/public/og/); review a few by eye
og:
	cd web && npx playwright install chromium && npm run og
# web app: live-reloading dev server at http://localhost:3000
dev:
	cd web && npm run dev
# web app: build the static site as it will be deployed, then serve it at http://localhost:3000
preview:
	cd web && npm run preview
clean:
	rm -rf web/.output
