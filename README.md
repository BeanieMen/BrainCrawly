# BrainCrawly

BrainCrawly is a Brainfuck step visualizer built with Next.js, Framer Motion, and Montserrat.
The UI lives in `web/` and renders a step-by-step execution trace with a responsive tape view.

It builds rust to web assembly to be able to run on the browser and uses a custom interpreter to run brainfuck code

## Layout

- `web/app/page.jsx` contains the main visualizer UI.
- `web/lib/brainfuck.js` contains the stepper and tape model.
- `Makefile` wraps the common dev and build commands.

## Commands

- `make install` installs the web dependencies with `npm ci`.
- `make dev` starts the Next.js dev server in `web/`.
- `make build` creates the static export in `web/out/`.
- `make start` builds and serves the static export from `web/out/`.
- `make clean` removes generated Next.js output from `web/`.

## Disclaimer

Ai was used to create the frontend ONLY