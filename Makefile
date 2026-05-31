WEB_DIR := web

.DEFAULT_GOAL := build

.PHONY: install web-build dev build start clean

install:
	cd $(WEB_DIR) && bun install

web-build:
	cd $(WEB_DIR) && bun run build

dev:
	cd $(WEB_DIR) && bun run dev

build: web-build

start: build
	cd $(WEB_DIR) && bun run start

clean:
	rm -rf $(WEB_DIR)/.next $(WEB_DIR)/out