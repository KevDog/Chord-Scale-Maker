.PHONY: setup test lint e2e golden dev preview clean
setup:
	cd web && npm ci
test:
	cd web && npm run typecheck && npm test
lint:
	cd web && npm run lint
# browser tests against the production build (installs Chromium for Playwright on first run)
e2e:
	cd web && npx playwright install chromium && npm run e2e
# rewrite fixtures/golden.json from the engine after an intended change; review its diff
golden:
	cd web && npm run golden
# web app: live-reloading dev server at http://localhost:3000
dev:
	cd web && npm run dev
# web app: build the static site as it will be deployed, then serve it at http://localhost:3000
preview:
	cd web && npm run preview
clean:
	rm -rf web/.output
