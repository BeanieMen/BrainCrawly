WEB_DIR := web
RUST_DIR := rust
NPM := npm --prefix $(WEB_DIR)
CARGO_TARGET_DIR := target
CARGO := CARGO_TARGET_DIR=$(CARGO_TARGET_DIR) cargo
WASM_OUTPUT := $(CARGO_TARGET_DIR)/wasm32-unknown-unknown/release/crawly_wasm.wasm

.DEFAULT_GOAL := build

.PHONY: install wasm web-build dev build start clean

install:
	$(NPM) ci

wasm:
	$(CARGO) build --manifest-path $(RUST_DIR)/Cargo.toml --target wasm32-unknown-unknown --release
	mkdir -p $(WEB_DIR)/pkg
	cp $(WASM_OUTPUT) $(WEB_DIR)/pkg/crawly_wasm_bg.wasm

web-build:
	$(NPM) run build

dev:
	$(NPM) run dev

build: wasm web-build

start: build
	$(NPM) run start

clean:
	rm -rf $(CARGO_TARGET_DIR) $(WEB_DIR)/.next $(WEB_DIR)/out