# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript MCP server for Alliance of Genome Resources data. Source code lives in `src/`: `index.ts` creates the MCP server, `client.ts` is the facade, `clients/` contains AGR and AllianceMine API clients, and `tools/` registers MCP tools and resources. Shared types and configuration are in `src/types.ts`, `src/config.ts`, and `src/defaults.json`. Manual smoke scripts are in `tests/`. Docs live in `docs/`, demo materials in `presentation/`, and planning notes in `future/`. Build output goes to `dist/`.

## Build, Test, and Development Commands

- `npm ci` installs dependencies from `package-lock.json`.
- `npm run dev` starts the server from `src/index.ts` with `tsx`.
- `npm run build` compiles TypeScript into `dist/`.
- `npm start` runs the compiled server at `dist/index.js`.
- `make install` and `make dev` wrap common npm commands.
- `docker compose up` starts the containerized setup when Docker testing is needed.

Some Makefile targets reference scripts not currently declared in `package.json`; confirm the script exists before relying on targets such as `make test` or `make lint`.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, and NodeNext-compatible imports. Keep local imports extension-aware, for example `import { AllianceClient } from "./client.js";`. Use two-space indentation. Prefer `camelCase` for variables, functions, and methods; `PascalCase` for classes, interfaces, and exported types; and descriptive file names such as `agr-tools.ts` and `mine-client.ts`. Keep tool registration in `src/tools/` and API transport in `src/clients/`.

## Testing Guidelines

Run `npm run build` before submitting changes. The `tests/` directory contains manual Node smoke scripts for MCP behavior; update or add focused scripts there when changing tool registration or client behavior. Name test files with a `test-*.js` pattern. For external AGR or AllianceMine calls, include a small query example and any required environment variables.

## Commit & Pull Request Guidelines

Recent commits use concise imperative summaries, often with release context, for example `Add allele drill-down and gene-models tools; release 5.3.0`. Keep subjects specific and under one line when possible. Pull requests should describe the behavior change, list validation commands run, link related issues, and include sample MCP requests or responses for tool changes.

## Security & Configuration Tips

Configuration defaults come from `src/defaults.json` and can be overridden with `AGR_API_URL` and `ALLIANCEMINE_URL`. AllianceMine list-management operations require `ALLIANCEMINE_TOKEN`; do not commit tokens, local MCP client config, generated logs, or `dist/` artifacts unless a release process requires them.
