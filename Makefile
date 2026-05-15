WEB_DIR := web
NPM := npm --prefix $(WEB_DIR)

.DEFAULT_GOAL := build

.PHONY: install dev build start clean

install:
	$(NPM) ci

dev:
	$(NPM) run dev

build:
	$(NPM) run build

start: build
	$(NPM) run start

clean:
	rm -rf $(WEB_DIR)/.next $(WEB_DIR)/out