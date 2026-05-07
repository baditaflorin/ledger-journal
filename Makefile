.PHONY: help install-hooks dev build data test test-integration smoke lint fmt pages-preview docker-build docker-push release compose-up compose-down clean hooks-pre-commit hooks-commit-msg hooks-pre-push audit

help: ## List targets.
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "%-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install-hooks: ## Wire local git hooks.
	git config core.hooksPath .githooks
	chmod +x .githooks/*

dev: ## Run the frontend development server.
	npm run dev

build: ## Build the GitHub Pages app into docs/.
	npm run build

data: ## No-op: Mode A stores personal data locally in the browser.
	@echo "Mode A: no static data pipeline."

test: ## Run unit tests.
	npm run test

test-integration: ## No integration suite is required for v0.1.0 Mode A.
	@echo "Mode A: no integration tests configured."

smoke: ## Build and run the Playwright smoke test against docs/.
	npm run build
	npm run smoke

lint: ## Run linters and type checks.
	npm run fmt:check
	npm run lint
	npm run typecheck
	npm run audit

fmt: ## Format source files.
	npm run fmt

pages-preview: ## Serve docs/ locally under the GitHub Pages base path.
	npm run pages-preview

docker-build: ## No-op: Mode A has no Docker backend.
	@echo "Mode A: Docker backend omitted."

docker-push: ## No-op: Mode A has no Docker backend.
	@echo "Mode A: Docker backend omitted."

release: ## Tag the current commit as v$(VERSION), default v0.1.0.
	test -n "$(VERSION)" || (echo "Set VERSION, for example VERSION=0.1.0" && exit 1)
	git tag "v$(VERSION)"
	git push origin "v$(VERSION)"

compose-up: ## No-op: Mode A has no Compose stack.
	@echo "Mode A: Compose stack omitted."

compose-down: ## No-op: Mode A has no Compose stack.
	@echo "Mode A: Compose stack omitted."

clean: ## Remove local build artifacts.
	rm -rf node_modules/.vite coverage

hooks-pre-commit: ## Run the pre-commit hook manually.
	.githooks/pre-commit

hooks-commit-msg: ## Run the commit-msg hook manually.
	.githooks/commit-msg .git/COMMIT_EDITMSG

hooks-pre-push: ## Run the pre-push hook manually.
	.githooks/pre-push

audit: ## Run high/critical dependency audit.
	npm run audit
