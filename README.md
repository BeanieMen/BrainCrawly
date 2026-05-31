# BrainCrawly

BrainCrawly is a Brainfuck step visualizer built with Next.js.

## What is WASM?

WASM is a compact binary format that lets code written in languages like Rust run in the browser.
In this project, the Brainfuck interpreter is written in Rust and compiled to WASM so the web UI can call it.
Learn more at the official WebAssembly site: [webassembly.org](https://webassembly.org/).

## What is Brainfuck?

Brainfuck is a tiny weird programming language with only 8 commands that manipulate a tape of byte cells.
This visualizer lets you step through those commands and watch the tape change in real time.
If you wanna learn more about brainfuck, see [the Brainfuck page](https://esolangs.org/wiki/Brainfuck).

## Prerequisites

- Node.js and npm.
- Bun, used to serve the static export with `bunx serve@latest out`.
- Rust with `cargo` and `rustup`.
- The `wasm32` Rust target (see [Rust target support](https://doc.rust-lang.org/rustc/platform-support.html)).

Install pre-requisites on Linux:

```sh
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```


## Run

If you already have Rust and Bun installed, make sure the WASM build target is available:

```sh
rustup target add wasm32-unknown-unknown
```

Then use the Makefile helpers to build and serve the app:

```sh
make install && make start
```

## Disclaimer

AI was used to create the frontend only.