# KingCobra Snake DQN — common tasks.   `make help` lists them.
#
# KINGCOBRA is the interpreter; override it if it is not on your PATH:
#     make serve KINGCOBRA=/path/to/kingcobra
KINGCOBRA ?= kingcobra
MAIN      := src/main.kc
ARGS      ?=

.PHONY: help train serve eval watch info test test-kc test-web check ablate assets screenshots video clean

help:  ## show this help
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

train:  ## train the agent (ARGS="--episodes 400 --seed 7")
	$(KINGCOBRA) run $(MAIN) train $(ARGS)

serve:  ## start the web dashboard on http://127.0.0.1:8765
	$(KINGCOBRA) run $(MAIN) serve $(ARGS)

eval:  ## play 100 greedy games with the saved model
	$(KINGCOBRA) run $(MAIN) eval $(ARGS)

watch:  ## watch the saved model play in the terminal
	$(KINGCOBRA) run $(MAIN) watch $(ARGS)

info:  ## print the saved model's card
	$(KINGCOBRA) run $(MAIN) info $(ARGS)

test: test-kc test-web   ## run every test

test-kc:  ## KingCobra unit + end-to-end tests
	$(KINGCOBRA) test tests/

test-web:  ## front-end tests (needs node): pure helpers + a live smoke test
	node tests/web/pure.test.js
	KINGCOBRA=$(KINGCOBRA) ./scripts/test_web.sh

check:  ## parse + type-check every source file
	$(KINGCOBRA) check src/ tests/

ablate:  ## re-run the ablation table from docs/TRAINING.md (about 10 minutes)
	@for v in "agent.double=false" "agent.n_step=1" "replay.prioritized=true" "features.flood=false"; do \
	  n=$$(echo $$v | tr '.=' '__'); echo "== $$v"; \
	  $(KINGCOBRA) run $(MAIN) train --out /tmp/snake_ablate --name $$n --set $$v | tail -2; \
	done

assets:  ## regenerate the SVG banners, icons, diagram and terminal pictures (needs node)
	node scripts/build_assets.js

screenshots:  ## retake the dashboard screenshots (needs playwright; run `make serve` first)
	python3 scripts/screenshots.py

video:  ## re-record the gameplay video (needs playwright + ffmpeg; run `make serve` first)
	python3 scripts/record_video.py

clean:  ## remove scratch files (the shipped model is kept)
	rm -rf /tmp/snake_ablate
	find . -name '*.tmp' -delete
