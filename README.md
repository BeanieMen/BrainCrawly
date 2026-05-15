# BrainCrawly

BrainCrawly is a Brainfuck step visualizer built with Next.js, Framer Motion, and Montserrat.
The UI lives in `web/` and renders a step-by-step execution trace with a responsive tape view.
The Rust interpreter is compiled to a wasm binary and copied into `web/pkg/` as part of the build.

## Prerequisites

- Node.js and npm.
- Bun, used to serve the static export with `bunx serve@latest out`.
- Rust with `cargo` and `rustup`.
- The `wasm32-unknown-unknown` Rust target.

install commands on Linux:

```sh
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

## Layout

- `rust/` contains the Rust source for the wasm interpreter.
- `web/app/page.jsx` contains the main visualizer UI.
- `web/lib/brainfuck.js` contains the stepper and tape model.
- `Makefile` wraps the common dev and build commands.

## Commands

- `make install` installs the web dependencies with `npm ci`.
- `make wasm` compiles the Rust interpreter to `web/pkg/crawly_wasm_bg.wasm`.
- `make dev` starts the Next.js dev server in `web/`.
- `make build` compiles the wasm binary and creates the static export in `web/out/`.
- `make start` builds and serves the static export from `web/out/` with Bun.
- `make clean` removes generated Next.js output from `web/`.

## Run

```sh
make install && make start
```

## Disclaimer

Ai was used to create the frontend ONLY