// src/index.ts
import * as dotenv from "dotenv";
import { Command } from "commander";
import * as path from "path";
import { GitAnalyzerAgent } from "./agents/gitAnalyzerAgent";
import { Reporter } from "./utils/reporter";
import { AgentConfig, AnalysisType } from "./types";

dotenv.config();

const program = new Command();

program
  .name("git-analyzer")
  .description("AI-powered Git repository analyser using Claude")
  .version("1.0.0");

program
  .argument("[repo-path]", "Path to the git repository", ".")
  .option(
    "-t, --type <type>",
    "Analysis type: full | security | performance | code-quality | recent-changes | commit-history",
    "full"
  )
  .option("-c, --commits <number>", "Max commits to analyse", "50")
  .option("-f, --files <patterns>", "File patterns to focus on (comma-separated)")
  .option("-o, --output <format>", "Output format: pretty | json", "pretty")
  .option("-v, --verbose", "Verbose logging")
  .action(async (repoPath: string, options) => {
    const resolvedPath = path.resolve(repoPath);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        "❌ Error: ANTHROPIC_API_KEY environment variable is required.\n" +
        "   Set it in a .env file or export it in your shell."
      );
      process.exit(1);
    }

    const config: AgentConfig = {
      repoPath: resolvedPath,
      analysisType: options.type as AnalysisType,
      maxCommits: parseInt(options.commits, 10),
      filePatterns: options.files
        ? options.files.split(",").map((s: string) => s.trim())
        : undefined,
      verbose: options.verbose,
    };

    try {
      const agent = new GitAnalyzerAgent(config);
      const result = await agent.analyze();

      if (options.output === "json") {
        Reporter.printJSON(result);
      } else {
        Reporter.printReport(result, resolvedPath);
      }

      // Exit with non-zero if critical issues found
      const { critical } = Reporter.getCounts(result);
      process.exit(critical > 0 ? 1 : 0);
    } catch (error) {
      console.error(
        chalk_red("❌ Analysis failed: ") + (error as Error).message
      );
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(2);
    }
  });

program.parse();

// Fallback chalk for error message (avoid import cycle)
function chalk_red(s: string) {
  return `\x1b[31m${s}\x1b[0m`;
}
