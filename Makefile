.PHONY: setup test lint e2e a11y golden dev preview clean
# installs the dependencies and the repo's git hooks (.githooks/pre-push runs `make a11y` when a push touches web/app/)
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
# rewrite engine/fixtures/golden.json and analysis.json from the engine after an intended change; review their diffs
golden:
	npm run golden -w engine
# web app: live-reloading dev server at http://localhost:3000
dev:
	cd web && npm run dev
# web app: build the static site as it will be deployed, then serve it at http://localhost:3000
preview:
	cd web && npm run preview
clean:
	rm -rf web/.output
