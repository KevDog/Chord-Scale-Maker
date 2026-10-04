CHART ?= charts/autumn_leaves.txt
INST  ?= concert
PY    ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)

.PHONY: pdf setup test lint e2e fixtures dev preview clean
pdf:
	python3 jazz_scales.py $(CHART) -i $(INST) -o output/$(notdir $(basename $(CHART)))_$(INST)
setup:
	python3 -m venv .venv && $(PY) -m pip install -q pytest
	cd web && npm ci
test:
	$(PY) -m pytest tests
	cd web && npm run typecheck && npm test
lint:
	cd web && npm run lint
# browser tests against the production build (installs Chromium for Playwright on first run)
e2e:
	cd web && npx playwright install chromium && npm run e2e
fixtures:
	$(PY) tools/export_fixtures.py
# web app: live-reloading dev server at http://localhost:3000
dev:
	cd web && npm run dev
# web app: build the static site as it will be deployed, then serve it at http://localhost:3000
preview:
	cd web && npm run preview
clean:
	rm -f output/*.pdf output/*.ly
	rm -rf web/.output
