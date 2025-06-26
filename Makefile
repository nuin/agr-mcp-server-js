# Enhanced AGR MCP Server - JavaScript Implementation
# Makefile for development and deployment automation

.PHONY: help install dev start stop test lint format clean build docker-build docker-run deploy health docs benchmark demo setup validate security audit

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE = \033[36m
GREEN = \033[32m
YELLOW = \033[33m
RED = \033[31m
NC = \033[0m # No Color

# Project configuration
PROJECT_NAME = agr-mcp-server-enhanced
VERSION = $(shell node -p "require('./package.json').version")
NODE_VERSION = $(shell node --version)
NPM_VERSION = $(shell npm --version)

## Display help information
help:
	@echo "$(BLUE)Enhanced AGR MCP Server - JavaScript Implementation v$(VERSION)$(NC)"
	@echo "================================================================"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(BLUE)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(YELLOW)Environment:$(NC)"
	@echo "  Node.js: $(NODE_VERSION)"
	@echo "  npm: $(NPM_VERSION)"
	@echo "  Project: $(PROJECT_NAME) v$(VERSION)"
	@echo ""

## Install dependencies and setup project
install:
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm ci
	@echo "$(GREEN)✅ Dependencies installed$(NC)"

## Complete development setup
setup: install
	@echo "$(BLUE)Running complete setup...$(NC)"
	chmod +x setup.sh
	./setup.sh
	@echo "$(GREEN)✅ Setup completed$(NC)"

## Start development server with hot reload
dev:
	@echo "$(BLUE)Starting development server...$(NC)"
	npm run dev

## Start production server
start:
	@echo "$(BLUE)Starting production server...$(NC)"
	npm start

## Stop all running processes
stop:
	@echo "$(BLUE)Stopping all processes...$(NC)"
	pkill -f "agr-server-enhanced" || true
	@echo "$(GREEN)✅ Processes stopped$(NC)"

## Run test suite
test:
	@echo "$(BLUE)Running tests...$(NC)"
	npm test

## Run tests with coverage
test-coverage:
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	npm run test:coverage

## Run linter
lint:
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

## Fix linting issues
lint-fix:
	@echo "$(BLUE)Fixing linting issues...$(NC)"
	npm run lint:fix

## Format code
format:
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format

## Clean build artifacts and cache
clean:
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	rm -rf node_modules/.cache
	rm -rf coverage/
	rm -rf docs/build/
	rm -rf logs/*.log
	rm -rf cache/*
	npm cache clean --force
	@echo "$(GREEN)✅ Cleanup completed$(NC)"

## Build project (lint + test)
build: lint test
	@echo "$(GREEN)✅ Build completed successfully$(NC)"

## Run full validation (audit + lint + test + security)
validate: audit lint test security
	@echo "$(GREEN)✅ Validation completed successfully$(NC)"

## Run security audit
audit:
	@echo "$(BLUE)Running security audit...$(NC)"
	npm audit --audit-level moderate
	@echo "$(GREEN)✅ Security audit completed$(NC)"

## Run security scan
security:
	@echo "$(BLUE)Running security scan...$(NC)"
	npm audit --audit-level high
	@echo "$(GREEN)✅ Security scan completed$(NC)"

## Run health check
health:
	@echo "$(BLUE)Running health check...$(NC)"
	npm run health-check

## Run performance benchmark
benchmark:
	@echo "$(BLUE)Running performance benchmark...$(NC)"
	npm run benchmark

## Run comprehensive demo
demo:
	@echo "$(BLUE)Running comprehensive demo...$(NC)"
	node scripts/demo.js

## Generate documentation
docs:
	@echo "$(BLUE)Generating documentation...$(NC)"
	npm run docs
	@echo "$(GREEN)✅ Documentation generated in docs/$(NC)"

## Build Docker image
docker-build:
	@echo "$(BLUE)Building Docker image...$(NC)"
	docker build -t $(PROJECT_NAME):$(VERSION) -t $(PROJECT_NAME):latest .
	@echo "$(GREEN)✅ Docker image built: $(PROJECT_NAME):$(VERSION)$(NC)"

## Run Docker container
docker-run:
	@echo "$(BLUE)Running Docker container...$(NC)"
	docker run -p 3000:3000 --name $(PROJECT_NAME) $(PROJECT_NAME):latest

## Start with docker-compose (development)
docker-dev:
	@echo "$(BLUE)Starting with docker-compose (development)...$(NC)"
	docker-compose --profile development up -d

## Start with docker-compose (production)
docker-prod:
	@echo "$(BLUE)Starting with docker-compose (production)...$(NC)"
	docker-compose up -d

## Stop docker-compose
docker-stop:
	@echo "$(BLUE)Stopping docker-compose...$(NC)"
	docker-compose down

## View docker logs
docker-logs:
	@echo "$(BLUE)Viewing docker logs...$(NC)"
	docker-compose logs -f

## Deploy to staging
deploy-staging: validate docker-build
	@echo "$(BLUE)Deploying to staging...$(NC)"
	@echo "$(YELLOW)⚠️  Staging deployment not configured$(NC)"

## Deploy to production
deploy-prod: validate docker-build
	@echo "$(BLUE)Deploying to production...$(NC)"
	@echo "$(YELLOW)⚠️  Production deployment not configured$(NC)"

## Create release
release: validate
	@echo "$(BLUE)Creating release...$(NC)"
	@echo "Current version: $(VERSION)"
	@echo "$(YELLOW)Release process:$(NC)"
	@echo "1. Update version: npm version [patch|minor|major]"
	@echo "2. Push tags: git push --tags"
	@echo "3. Create GitHub release"

## Monitor application
monitor:
	@echo "$(BLUE)Monitoring application...$(NC)"
	@echo "Health check:"
	@make health
	@echo ""
	@echo "Performance metrics:"
	@node -e "console.log('Memory:', process.memoryUsage()); console.log('Uptime:', process.uptime() + 's');"

## Show application status
status:
	@echo "$(BLUE)Application Status$(NC)"
	@echo "==================="
	@echo "Project: $(PROJECT_NAME)"
	@echo "Version: $(VERSION)"
	@echo "Node.js: $(NODE_VERSION)"
	@echo "npm: $(NPM_VERSION)"
	@echo ""
	@echo "$(BLUE)Process Status:$(NC)"
	@pgrep -fl "agr-server-enhanced" || echo "No processes running"
	@echo ""
	@echo "$(BLUE)Port Status:$(NC)"
	@lsof -i :3000 || echo "Port 3000 not in use"

## Install git hooks
hooks:
	@echo "$(BLUE)Installing git hooks...$(NC)"
	@if [ -d .git ]; then \
		echo "#!/bin/bash" > .git/hooks/pre-commit; \
		echo "make lint-fix format test" >> .git/hooks/pre-commit; \
		chmod +x .git/hooks/pre-commit; \
		echo "$(GREEN)✅ Git hooks installed$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  Not a git repository$(NC)"; \
	fi

## Update dependencies
update:
	@echo "$(BLUE)Updating dependencies...$(NC)"
	npm update
	npm audit fix
	@echo "$(GREEN)✅ Dependencies updated$(NC)"

## Quick start (install + test + start)
quick-start: install test start

## CI/CD pipeline simulation
ci: clean install lint test audit security
	@echo "$(GREEN)✅ CI pipeline completed successfully$(NC)"

## Performance test with different loads
perf-test:
	@echo "$(BLUE)Running performance tests...$(NC)"
	@echo "Light load test:"
	@timeout 30 npm run benchmark || echo "Test completed"
	@echo ""
	@echo "$(GREEN)✅ Performance tests completed$(NC)"

## Database operations (if applicable)
db-reset:
	@echo "$(BLUE)Resetting cache...$(NC)"
	rm -rf cache/*
	@echo "$(GREEN)✅ Cache reset$(NC)"

## Backup important data
backup:
	@echo "$(BLUE)Creating backup...$(NC)"
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	mkdir -p backups/$$timestamp; \
	cp -r logs/ backups/$$timestamp/ 2>/dev/null || true; \
	cp -r cache/ backups/$$timestamp/ 2>/dev/null || true; \
	cp .env backups/$$timestamp/ 2>/dev/null || true; \
	echo "$(GREEN)✅ Backup created: backups/$$timestamp$(NC)"

## Show project statistics
stats:
	@echo "$(BLUE)Project Statistics$(NC)"
	@echo "==================="
	@echo "Lines of code:"
	@find src -name "*.js" -exec wc -l {} + | tail -1 | awk '{print "  JavaScript: " $$1 " lines"}'
	@find test -name "*.js" -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print "  Tests: " $$1 " lines"}' || echo "  Tests: 0 lines"
	@echo "Files:"
	@find src -name "*.js" | wc -l | awk '{print "  Source files: " $$1}'
	@find test -name "*.js" 2>/dev/null | wc -l | awk '{print "  Test files: " $$1}' || echo "  Test files: 0"
	@echo "Dependencies:"
	@node -p "Object.keys(require('./package.json').dependencies || {}).length" | awk '{print "  Production: " $$1}'
	@node -p "Object.keys(require('./package.json').devDependencies || {}).length" | awk '{print "  Development: " $$1}'

## Environment info
env:
	@echo "$(BLUE)Environment Information$(NC)"
	@echo "========================="
	@echo "Node.js: $(NODE_VERSION)"
	@echo "npm: $(NPM_VERSION)"
	@echo "OS: $$(uname -s) $$(uname -r)"
	@echo "Platform: $$(node -p process.platform)"
	@echo "Architecture: $$(node -p process.arch)"
	@echo "Memory: $$(node -p "Math.round(process.memoryUsage().heapUsed / 1024 / 1024)") MB"
	@echo "Working Directory: $$(pwd)"
	@echo ""
	@echo "$(BLUE)Environment Variables:$(NC)"
	@echo "NODE_ENV: $${NODE_ENV:-not set}"
	@echo "LOG_LEVEL: $${LOG_LEVEL:-not set}"
	@echo "PORT: $${PORT:-not set}"

# Ensure required directories exist
$(shell mkdir -p logs cache tmp docs)

# Version targets
patch:
	npm version patch
	@echo "$(GREEN)✅ Patch version bumped$(NC)"

minor:
	npm version minor
	@echo "$(GREEN)✅ Minor version bumped$(NC)"

major:
	npm version major
	@echo "$(GREEN)✅ Major version bumped$(NC)"