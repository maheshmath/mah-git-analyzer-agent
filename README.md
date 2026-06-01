# 🔍 Git Analyzer Agent

An AI-powered Git repository analysis tool built with TypeScript and Claude. The agent uses an **agentic loop** with tool use to autonomously explore your codebase and produce structured findings.

## Features

- **Multi-mode analysis**: full audit, security, performance, code quality, recent changes, commit history
- **Agentic tool use**: Claude autonomously decides which git tools to call and iterates until analysis is complete
- **9 built-in tools**: repo overview, file reading, diffs, blame, contributor stats, code search, and more
- **Structured output**: findings categorised by severity with actionable suggestions
- **CLI interface**: easy to integrate into CI/CD pipelines

## Installation

```bash
npm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

## Usage

```bash
# Full analysis of current directory
npm run dev

# Analyse a specific repo
npm run dev /path/to/repo

# Security audit only
npm run dev /path/to/repo -- --type security

# Code quality review of recent changes
npm run dev . -- --type recent-changes

# JSON output for CI/CD integration
npm run dev . -- --type full --output json

# Focus on specific file types
npm run dev . -- --files "*.ts,*.tsx" --type code-quality
```

## Analysis Types

| Type | Description |
|------|-------------|
| `full` | Comprehensive review of everything |
| `security` | Security vulnerabilities and risks |
| `performance` | Bottlenecks and inefficiencies |
| `code-quality` | Code smells and maintainability |
| `recent-changes` | Focus on last 10-20 commits |
| `commit-history` | Historical patterns and trends |

## Available Tools (Claude uses these autonomously)

| Tool | Description |
|------|-------------|
| `get_repo_overview` | Branch info, status, file tree |
| `get_recent_commits` | Commit log with metadata |
| `get_file_content` | Read any file |
| `get_file_diff` | Diffs between commits |
| `list_files` | List files with extension filters |
| `get_commit_details` | Deep dive into a commit |
| `get_blame` | Line-by-line authorship |
| `get_contributors` | Contributor statistics |
| `search_code` | Regex search across codebase |

## Project Structure

```
src/
├── agents/
│   └── gitAnalyzerAgent.ts   # Core agentic loop
├── tools/
│   └── gitTools.ts           # All git tool implementations
├── utils/
│   └── reporter.ts           # Pretty-print results
├── types/
│   └── index.ts              # TypeScript type definitions
└── index.ts                  # CLI entry point
```

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Security Audit
  run: |
    npm run dev . -- --type security --output json > report.json
    # Exits with code 1 if critical issues found
```

## Output Example

```
──────────────────────────────────────────────────────────────────────
  📊 GIT REPOSITORY ANALYSIS REPORT
──────────────────────────────────────────────────────────────────────

SUMMARY
  The repository is a well-structured TypeScript project with 42 files...

METRICS
  Files:        42
  Commits:      156
  Contributors: 4
  Languages:
    TypeScript           ████████████ 60%
    JavaScript           ██████ 30%

FINDINGS
  🔴 Critical: 2  ⚠️ Warnings: 8  ℹ️ Info: 12

  ❌ CRITICAL ISSUES
    🔴 [security] src/config/database.ts:14
    Hardcoded database password found in source code
    → Move to environment variables, rotate the exposed credential
```
