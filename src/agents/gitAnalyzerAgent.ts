// src/agents/gitAnalyzerAgent.ts
import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { GitTools } from "../tools/gitTools";
import {
  AgentConfig,
  AnalysisResult,
  AnalysisType,
  Finding,
  ToolResult,
} from "../types";

const SYSTEM_PROMPTS: Record<AnalysisType, string> = {
  full: `You are an expert software engineer and code reviewer analysing a Git repository. 
Perform a comprehensive analysis covering: code quality, security vulnerabilities, 
performance issues, best practices, testing coverage, and documentation gaps.
Be thorough — use multiple tools to explore the codebase. Structure your final response
as a JSON object matching the AnalysisResult schema.`,

  security: `You are a security engineer performing a security audit on a Git repository.
Focus on: hardcoded secrets/credentials, SQL injection risks, XSS vulnerabilities,
insecure dependencies, improper error handling, authentication flaws, and sensitive data exposure.
Use search_code extensively to find dangerous patterns. Structure findings by severity.`,

  performance: `You are a performance engineer reviewing a codebase for bottlenecks and inefficiencies.
Look for: N+1 queries, inefficient algorithms (O(n²) or worse), memory leaks, 
blocking I/O in async code, large bundle sizes, missing caching, and unnecessary re-renders.
Prioritise actionable recommendations with estimated impact.`,

  "code-quality": `You are a senior software engineer reviewing code quality.
Assess: code duplication, naming conventions, function length, cyclomatic complexity,
SOLID principles adherence, error handling patterns, TypeScript/type safety, and maintainability.
Provide specific refactoring suggestions with before/after examples where helpful.`,

  "recent-changes": `You are a code reviewer analysing the most recent changes to a repository.
Focus on the last 10-20 commits. Look for: breaking changes, regression risks,
incomplete implementations, missing tests for new features, and code style inconsistencies.
Prioritise issues introduced in recent commits.`,

  "commit-history": `You are a software archaeologist analysing the commit history and evolution of a codebase.
Study: commit message quality, branching patterns, development velocity, contributor patterns,
technical debt accumulation, and codebase growth trends. Identify any patterns of concern.`,
};

export class GitAnalyzerAgent {
  private client: Anthropic;
  private gitTools: GitTools;
  private config: AgentConfig;
  private verbose: boolean;

  constructor(config: AgentConfig) {
    this.client = new Anthropic();
    this.gitTools = new GitTools(config.repoPath);
    this.config = config;
    this.verbose = config.verbose ?? false;
  }

  async analyze(): Promise<AnalysisResult> {
    this.log(chalk.blue.bold("\n🔍 Git Analyzer Agent Starting..."));
    this.log(chalk.gray(`  Repo: ${this.config.repoPath}`));
    this.log(chalk.gray(`  Mode: ${this.config.analysisType}\n`));

    const systemPrompt = SYSTEM_PROMPTS[this.config.analysisType];
    const userMessage = this.buildUserMessage();
    const tools = GitTools.getToolDefinitions();

    // Agentic loop
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    let iterationCount = 0;
    const MAX_ITERATIONS = 20;

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      this.log(chalk.yellow(`\n[Iteration ${iterationCount}]`));

      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8096,
        system: systemPrompt,
        tools: tools as Anthropic.Tool[],
        messages,
      });

      this.log(chalk.gray(`  Stop reason: ${response.stop_reason}`));

      // Collect tool uses from this turn
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );

      // Log text output
      for (const block of textBlocks) {
        if (block.text) {
          this.log(chalk.white("\n📝 Agent: ") + chalk.dim(block.text.slice(0, 200) + "..."));
        }
      }

      // Push assistant message
      messages.push({ role: "assistant", content: response.content });

      // If end_turn or no more tool calls, we're done
      if (response.stop_reason === "end_turn" || toolUses.length === 0) {
        this.log(chalk.green("\n✅ Analysis complete!\n"));
        return this.parseResult(response.content);
      }

      // Execute all tool calls and gather results
      const toolResults: ToolResult[] = [];

      for (const toolUse of toolUses) {
        this.log(
          chalk.cyan(`  🔧 Tool: ${toolUse.name}`) +
          chalk.gray(` (${JSON.stringify(toolUse.input).slice(0, 80)}...)`)
        );

        const result = await this.gitTools.executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        const preview = result.slice(0, 100).replace(/\n/g, " ");
        this.log(chalk.gray(`     → ${preview}...`));

        toolResults.push({
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Push all tool results in a single user message
      messages.push({
        role: "user",
        content: toolResults.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.tool_use_id,
          content: r.content,
          is_error: r.is_error,
        })),
      });
    }

    this.log(chalk.red("\n⚠️  Max iterations reached"));
    return this.buildFallbackResult("Max iterations reached");
  }

  private buildUserMessage(): string {
    const baseMessage = `Please analyse the git repository at: ${this.config.repoPath}

Analysis type: ${this.config.analysisType}
${this.config.maxCommits ? `Max commits to review: ${this.config.maxCommits}` : ""}
${this.config.filePatterns ? `Focus on files matching: ${this.config.filePatterns.join(", ")}` : ""}

Start by getting a repo overview, then dive deeper based on what you find.
Use the available tools systematically to gather information before drawing conclusions.

Return your final analysis as a JSON object with this structure:
{
  "summary": "Executive summary of the analysis",
  "findings": [
    {
      "severity": "critical|warning|info",
      "category": "security|performance|code-quality|best-practices|documentation|testing|dependencies",
      "file": "optional/file/path.ts",
      "line": 42,
      "message": "Description of the finding",
      "suggestion": "How to fix it"
    }
  ],
  "recommendations": ["Top recommendation 1", "Top recommendation 2"],
  "metrics": {
    "totalFiles": 0,
    "totalCommits": 0,
    "totalContributors": 0,
    "languages": { "TypeScript": 60, "JavaScript": 30 },
    "avgCommitSize": 0
  }
}`;

    return baseMessage;
  }

  private parseResult(content: Anthropic.ContentBlock[]): AnalysisResult {
    // Find JSON in the last text block
    const textBlocks = content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text);

    for (const text of textBlocks.reverse()) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1].trim()) as AnalysisResult;
        } catch {
          // continue
        }
      }

      // Try direct JSON parse
      const jsonStart = text.lastIndexOf("{");
      if (jsonStart !== -1) {
        try {
          return JSON.parse(text.slice(jsonStart)) as AnalysisResult;
        } catch {
          // continue
        }
      }
    }

    // Fallback: extract what we can
    return this.buildFallbackResult(textBlocks.join("\n"));
  }

  private buildFallbackResult(text: string): AnalysisResult {
    return {
      summary: text.slice(0, 500),
      findings: [],
      recommendations: [],
      metrics: {
        totalFiles: 0,
        totalCommits: 0,
        totalContributors: 0,
        languages: {},
        avgCommitSize: 0,
      },
    };
  }

  private log(message: string): void {
    if (this.verbose || true) {
      // Always log progress
      console.log(message);
    }
  }
}
