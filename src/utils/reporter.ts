// src/utils/reporter.ts
import chalk from "chalk";
import { AnalysisResult, Finding } from "../types";

export class Reporter {
  static printReport(result: AnalysisResult, repoPath: string): void {
    const divider = chalk.gray("─".repeat(70));

    console.log("\n" + divider);
    console.log(chalk.bold.white("  📊 GIT REPOSITORY ANALYSIS REPORT"));
    console.log(chalk.gray(`  ${repoPath}`));
    console.log(divider);

    // Summary
    console.log("\n" + chalk.bold.cyan("SUMMARY"));
    console.log(chalk.white(result.summary));

    // Metrics
    console.log("\n" + chalk.bold.cyan("METRICS"));
    const m = result.metrics;
    console.log(`  Files:        ${chalk.yellow(m.totalFiles)}`);
    console.log(`  Commits:      ${chalk.yellow(m.totalCommits)}`);
    console.log(`  Contributors: ${chalk.yellow(m.totalContributors)}`);
    console.log(`  Avg Commit:   ${chalk.yellow(m.avgCommitSize)} lines`);

    if (Object.keys(m.languages).length > 0) {
      console.log(`  Languages:`);
      for (const [lang, pct] of Object.entries(m.languages)) {
        const bar = "█".repeat(Math.floor((pct as number) / 5));
        console.log(`    ${lang.padEnd(20)} ${chalk.blue(bar)} ${pct}%`);
      }
    }

    // Findings by severity
    const critical = result.findings.filter((f) => f.severity === "critical");
    const warnings = result.findings.filter((f) => f.severity === "warning");
    const info = result.findings.filter((f) => f.severity === "info");

    console.log("\n" + chalk.bold.cyan("FINDINGS"));
    console.log(
      `  ${chalk.red("●")} Critical: ${chalk.red.bold(critical.length)}  ` +
      `${chalk.yellow("●")} Warnings: ${chalk.yellow.bold(warnings.length)}  ` +
      `${chalk.blue("●")} Info: ${chalk.blue.bold(info.length)}`
    );

    if (critical.length > 0) {
      console.log("\n" + chalk.red.bold("  ❌ CRITICAL ISSUES"));
      critical.forEach((f) => this.printFinding(f));
    }

    if (warnings.length > 0) {
      console.log("\n" + chalk.yellow.bold("  ⚠️  WARNINGS"));
      warnings.forEach((f) => this.printFinding(f));
    }

    if (info.length > 0) {
      console.log("\n" + chalk.blue.bold("  ℹ️  INFO"));
      info.forEach((f) => this.printFinding(f));
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      console.log("\n" + chalk.bold.cyan("RECOMMENDATIONS"));
      result.recommendations.forEach((rec, i) => {
        console.log(`  ${chalk.green(i + 1 + ".")} ${rec}`);
      });
    }

    console.log("\n" + divider + "\n");
  }

  private static printFinding(f: Finding): void {
    const icon =
      f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵";
    const cat = chalk.gray(`[${f.category}]`);
    const loc = f.file
      ? chalk.gray(` ${f.file}${f.line ? ":" + f.line : ""}`)
      : "";

    console.log(`\n    ${icon} ${cat}${loc}`);
    console.log(`    ${chalk.white(f.message)}`);
    if (f.suggestion) {
      console.log(`    ${chalk.green("→ " + f.suggestion)}`);
    }
  }

  static printJSON(result: AnalysisResult): void {
    console.log(JSON.stringify(result, null, 2));
  }

  static getCounts(result: AnalysisResult) {
    return {
      critical: result.findings.filter((f) => f.severity === "critical").length,
      warnings: result.findings.filter((f) => f.severity === "warning").length,
      info: result.findings.filter((f) => f.severity === "info").length,
    };
  }
}
