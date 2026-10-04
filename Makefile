CHART ?= charts/autumn_leaves.txt
INST  ?= concert
PY    ?= .venv/bin/python

.PHONY: pdf setup test fixtures clean
pdf:
	python3 jazz_scales.py $(CHART) -i $(INST) -o output/$(notdir $(basename $(CHART)))_$(INST)
setup:
	python3 -m venv .venv && $(PY) -m pip install -q pytest
	cd web && npm ci
test:
	$(PY) -m pytest tests
	cd web && npm run typecheck && npm test
fixtures:
	$(PY) tools/export_fixtures.py
clean:
	rm -f output/*.pdf output/*.ly
