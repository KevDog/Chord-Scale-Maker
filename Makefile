CHART ?= charts/autumn_leaves.txt
INST  ?= concert

.PHONY: pdf test clean
pdf:
	python3 jazz_scales.py $(CHART) -i $(INST) -o output/$(notdir $(basename $(CHART)))_$(INST)
test:
	python3 -m pytest tests
clean:
	rm -f output/*.pdf output/*.ly
