# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Compile TypeScript → dist/
npm run dev            # Run directly with ts-node (no build required)
npm run analyze        # Alias for dev
npm start              # Run compiled dist/index.js
npm test               # Run Jest tests
npx jest tests/gitTools.test.ts   # Run a single test file
```

Typical invocations during development:
```bash
npm run dev . -- --type security --output json
npm run dev /path/to/repo -- --type code-quality --files "*.ts"
```

Requires `ANTHROPIC_API_KEY` in `.env` (see `.env.example`).

## Architecture

A CLI tool that wraps Claude in an agentic loop to analyze git repositories. Claude autonomously calls git tools until it has enough information, then emits a structured JSON result.

### Agentic loop — `src/agents/gitAnalyzerAgent.ts`

The core of the project. Sends a system prompt (customized per `AnalysisType`) plus 9 tool definitions to Claude, then iterates up to 20 rounds: execute tool calls → feed results back → repeat until `end_turn`. The final Claude text response is parsed as JSON into an `AnalysisResult`.

Model: `claude-sonnet-4-20250514`, 8096 max output tokens.

### Git tools — `src/tools/gitTools.ts`

`GitTools.getToolDefinitions()` returns tool schemas Claude can request. `executeToolCall()` dispatches to `simple-git` implementations. The 9 tools are: `get_repo_overview`, `get_recent_commits`, `get_file_content`, `get_file_diff`, `list_files`, `get_commit_details`, `get_blame`, `get_contributors`, `search_code`. File content is capped at 500 KB. Directory traversal skips `node_modules`, `.git`, `dist`, `build`, `.next`, `coverage`.

### Entry point — `src/index.ts`

Commander.js CLI. Validates env, instantiates the agent, runs analysis, passes `AnalysisResult` to `reporter.ts`. Exits with code 1 if any `critical` findings exist, enabling use as a CI/CD gate.

### Types — `src/types/index.ts`

Central type definitions. `AnalysisType` (`full | security | performance | code-quality | recent-changes | commit-history`) controls which system prompt the agent uses. `Finding` has `severity` (`critical | high | medium | low | info`) and `category`. `AnalysisResult` is the exact JSON schema Claude must return.

### Reporter — `src/utils/reporter.ts`

Formats `AnalysisResult` for the terminal (colorized, severity indicators, language bar charts) or as raw JSON when `--output json` is passed.
