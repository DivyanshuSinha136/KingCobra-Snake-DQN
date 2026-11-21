<p align="center">
  <img src="docs/img/banner-contributing.svg" alt="Contributing to KingCobra Snake DQN" width="100%">
</p>

Thanks for helping! The whole workflow fits on one screen.

<p align="center"><img src="docs/img/divider.svg" alt="" width="100%"></p>

## <img src="docs/img/icons/rocket.svg" width="26" height="26" align="top" alt=""> Set up

1. Install KingCobra 1.0 (`kingcobra` on your `PATH`) and, for the front-end tests, Node.js 18+.
2. Clone the repo and run `make serve` to confirm everything works with the bundled model.

## <img src="docs/img/icons/test.svg" width="26" height="26" align="top" alt=""> Before you open a pull request

`make check` (parse + type-check) and `make test` must pass.

<p align="center">
  <img src="docs/img/terminal-test.svg" alt="make test output: 48 passed, 0 failed" width="86%">
</p>

## <img src="docs/img/icons/list.svg" width="26" height="26" align="top" alt=""> Ground rules

* **Keep modules stateless.** In KingCobra each `import` makes its own module instance, so pass state as objects
  (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)).
* **No closures on the request path.** The server avoids `fn(...)` closures because they have crashed the interpreter
  on Windows; use plain loops there.
* **A change to learning behaviour needs a test.**
* **Changed the model's inputs or the environment rules?** Retrain the shipped model (`make train`) and update the
  numbers in `README.md` and `docs/TRAINING.md`. Old models are incompatible with a new input size.
* **Style:** 4-space indent in KingCobra, 2 in web files (`.editorconfig`), doc comments (`///`) on public functions.

## <img src="docs/img/icons/camera.svg" width="26" height="26" align="top" alt=""> Changing the look

The banners, icons, diagrams and terminal pictures in `docs/img/` are generated, so edit the generator rather than the SVGs:

```sh
make assets         # node scripts/build_assets.js  -> banners, icons, diagram, results card, terminal shots
make screenshots    # needs: pip install playwright && playwright install chromium; run `make serve` first
make video          # same requirements plus ffmpeg; rewrites docs/media/gameplay.mp4 and docs/img/gameplay.gif
```

<p align="center">
  <img src="docs/img/board.png" alt="Close-up of the board card in the dashboard" width="38%">
</p>

If you change the UI, retake the screenshots and the video so the docs match what people will see.

## <img src="docs/img/icons/bug.svg" width="26" height="26" align="top" alt=""> Reporting bugs

Please include the command you ran, `--seed`, your OS, and the output of `kingcobra run src/main.kc info`. For
dashboard problems, the browser console output helps most.
