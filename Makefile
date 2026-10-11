.PHONY: setup test lint e2e golden dev preview clean
setup:
	npm ci
test:
	npm run typecheck && npm test
lint:
	npm run lint
# browser tests against the production build (installs Chromium for Playwright on first run)
e2e:
	cd web && npx playwright install chromium && npm run e2e
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
