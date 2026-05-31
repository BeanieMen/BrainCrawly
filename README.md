# BrainCrawly

BrainCrawly is a Brainfuck step visualizer built with Next.js.
The interpreter runs in JavaScript, so there is no Rust or WASM setup required.

## What is Brainfuck?

Brainfuck is a tiny weird programming language with only 8 commands that manipulate a tape of byte cells.
This visualizer lets you step through those commands and watch the tape change in real time.
If you wanna learn more about brainfuck, see [the Brainfuck page](https://esolangs.org/wiki/Brainfuck).

## Prerequisites

- Node.js and npm.
- Bun, used to serve the static export with `bunx serve@latest out`.

Install pre-requisites on Linux:

```sh
curl -fsSL https://bun.sh/install | bash
```


## Run

Use the Makefile helpers to install and serve the app:

```sh
make install && make start
```

## Disclaimer

AI was used to create the frontend only.