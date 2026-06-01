// src/tools/gitTools.ts
import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as path from "path";
import { AgentTool, GitCommit, GitDiff, GitFile } from "../types";

export class GitTools {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath);
    this.git = simpleGit(this.repoPath);
  }

  // ─── Tool Definitions (passed to Claude) ──────────────────────────────────

  static getToolDefinitions(): AgentTool[] {
    return [
      {
        name: "get_repo_overview",
        description:
          "Get a high-level overview of the repository including branch info, recent activity, and file structure",
        input_schema: {
          type: "object",
          properties: {
            include_tree: {
              type: "boolean",
              description: "Whether to include directory tree",
            },
          },
          required: [],
        },
      },
      {
        name: "get_recent_commits",
        description: "Get recent commit history with messages and metadata",
        input_schema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of commits to retrieve (default: 20)",
            },
            branch: {
              type: "string",
              description: "Branch name (default: current branch)",
            },
          },
          required: [],
        },
      },
      {
        name: "get_file_content",
        description: "Read the content of a specific file in the repository",
        input_schema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Relative path to the file",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_file_diff",
        description:
          "Get the diff/changes for a file between commits or in working directory",
        input_schema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Relative path to the file",
            },
            from_commit: {
              type: "string",
              description: "Starting commit hash (optional)",
            },
            to_commit: {
              type: "string",
              description: "Ending commit hash (optional, defaults to HEAD)",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "list_files",
        description:
          "List files in the repository matching optional pattern filters",
        input_schema: {
          type: "object",
          properties: {
            directory: {
              type: "string",
              description: "Directory to list (default: root)",
            },
            extensions: {
              type: "array",
              items: { type: "string" },
              description: "File extensions to filter by (e.g. ['.ts', '.js'])",
            },
            recursive: {
              type: "boolean",
              description: "Whether to list recursively",
            },
          },
          required: [],
        },
      },
      {
        name: "get_commit_details",
        description:
          "Get detailed information about a specific commit including changed files and diffs",
        input_schema: {
          type: "object",
          properties: {
            commit_hash: {
              type: "string",
              description: "The commit hash to inspect",
            },
          },
          required: ["commit_hash"],
        },
      },
      {
        name: "get_blame",
        description:
          "Get git blame for a file to see who changed each line and when",
        input_schema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Relative path to the file",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_contributors",
        description:
          "Get list of contributors and their commit statistics",
        input_schema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "search_code",
        description:
          "Search for patterns or strings across the codebase using git grep",
        input_schema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "The search pattern (regex supported)",
            },
            file_pattern: {
              type: "string",
              description: "Glob pattern to restrict search (e.g. '*.ts')",
            },
          },
          required: ["pattern"],
        },
      },
    ];
  }

  // ─── Tool Implementations ─────────────────────────────────────────────────

  async executeToolCall(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<string> {
    try {
      switch (toolName) {
        case "get_repo_overview":
          return await this.getRepoOverview(toolInput.include_tree as boolean);
        case "get_recent_commits":
          return await this.getRecentCommits(
            toolInput.limit as number,
            toolInput.branch as string
          );
        case "get_file_content":
          return await this.getFileContent(toolInput.file_path as string);
        case "get_file_diff":
          return await this.getFileDiff(
            toolInput.file_path as string,
            toolInput.from_commit as string,
            toolInput.to_commit as string
          );
        case "list_files":
          return await this.listFiles(
            toolInput.directory as string,
            toolInput.extensions as string[],
            toolInput.recursive as boolean
          );
        case "get_commit_details":
          return await this.getCommitDetails(toolInput.commit_hash as string);
        case "get_blame":
          return await this.getBlame(toolInput.file_path as string);
        case "get_contributors":
          return await this.getContributors();
        case "search_code":
          return await this.searchCode(
            toolInput.pattern as string,
            toolInput.file_pattern as string
          );
        default:
          return JSON.stringify({ error: `Unknown tool: ${toolName}` });
      }
    } catch (error) {
      return JSON.stringify({
        error: `Tool execution failed: ${(error as Error).message}`,
      });
    }
  }

  private async getRepoOverview(includeTree = false): Promise<string> {
    const [status, log, branches, remotes] = await Promise.all([
      this.git.status(),
      this.git.log({ maxCount: 1 }),
      this.git.branch(),
      this.git.getRemotes(true),
    ]);

    const overview: Record<string, unknown> = {
      currentBranch: branches.current,
      allBranches: branches.all,
      latestCommit: log.latest,
      status: {
        staged: status.staged,
        modified: status.modified,
        untracked: status.not_added,
      },
      remotes: remotes.map((r) => ({ name: r.name, url: r.refs.fetch })),
    };

    if (includeTree) {
      overview.fileTree = this.buildFileTree(this.repoPath);
    }

    return JSON.stringify(overview, null, 2);
  }

  private async getRecentCommits(
    limit = 20,
    branch?: string
  ): Promise<string> {
    const options: Record<string, unknown> = { maxCount: limit };
    if (branch) options["--first-parent"] = branch;

    const log = await this.git.log(options);
    const commits: GitCommit[] = log.all.map((c) => ({
      hash: c.hash,
      message: c.message,
      author: c.author_name,
      date: c.date,
      filesChanged: [],
    }));

    return JSON.stringify(commits, null, 2);
  }

  private async getFileContent(filePath: string): Promise<string> {
    const fullPath = path.join(this.repoPath, filePath);

    if (!fs.existsSync(fullPath)) {
      return JSON.stringify({ error: `File not found: ${filePath}` });
    }

    const stats = fs.statSync(fullPath);
    if (stats.size > 500_000) {
      return JSON.stringify({
        error: "File too large (>500KB). Use search_code for specific patterns.",
      });
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const file: GitFile = {
      path: filePath,
      content,
      extension: path.extname(filePath),
      size: stats.size,
    };

    return JSON.stringify(file, null, 2);
  }

  private async getFileDiff(
    filePath: string,
    fromCommit?: string,
    toCommit = "HEAD"
  ): Promise<string> {
    let diff: string;

    if (fromCommit) {
      diff = await this.git.diff([`${fromCommit}..${toCommit}`, "--", filePath]);
    } else {
      diff = await this.git.diff(["HEAD", "--", filePath]);
    }

    if (!diff) {
      diff = await this.git.diff(["HEAD~1..HEAD", "--", filePath]);
    }

    const lines = diff.split("\n");
    const additions = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const deletions = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

    const result: GitDiff = {
      file: filePath,
      additions,
      deletions,
      patch: diff.slice(0, 10_000), // Cap patch size
    };

    return JSON.stringify(result, null, 2);
  }

  private async listFiles(
    directory = ".",
    extensions?: string[],
    recursive = true
  ): Promise<string> {
    const targetDir = path.join(this.repoPath, directory);

    const allFiles = this.walkDirectory(targetDir, recursive);

    const filtered = extensions
      ? allFiles.filter((f) => extensions.includes(path.extname(f)))
      : allFiles;

    const relative = filtered.map((f) =>
      path.relative(this.repoPath, f).replace(/\\/g, "/")
    );

    return JSON.stringify({ files: relative, total: relative.length }, null, 2);
  }

  private async getCommitDetails(commitHash: string): Promise<string> {
    const [show, diffStat] = await Promise.all([
      this.git.show([commitHash, "--stat", "--format=%H%n%an%n%ae%n%ai%n%s%n%b"]),
      this.git.diff([`${commitHash}~1..${commitHash}`, "--stat"]),
    ]);

    return JSON.stringify({ details: show.slice(0, 5000), stat: diffStat }, null, 2);
  }

  private async getBlame(filePath: string): Promise<string> {
    const blame = await this.git.raw(["blame", "--line-porcelain", filePath]);
    // Parse and truncate for readability
    const lines = blame.split("\n").slice(0, 200);
    return JSON.stringify({ blame: lines.join("\n") }, null, 2);
  }

  private async getContributors(): Promise<string> {
    const log = await this.git.raw([
      "shortlog",
      "-sne",
      "--all",
    ]);
    return JSON.stringify({ contributors: log }, null, 2);
  }

  private async searchCode(
    pattern: string,
    filePattern?: string
  ): Promise<string> {
    const args = ["grep", "-n", "--count", pattern];
    if (filePattern) args.push("--", filePattern);

    try {
      const result = await this.git.raw(args);
      const lines = result.split("\n").slice(0, 100); // Cap results
      return JSON.stringify({ matches: lines, pattern }, null, 2);
    } catch {
      // git grep returns exit code 1 when no matches found
      return JSON.stringify({ matches: [], pattern, message: "No matches found" }, null, 2);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private walkDirectory(dir: string, recursive: boolean): string[] {
    const results: string[] = [];
    const ignore = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && recursive) {
        results.push(...this.walkDirectory(fullPath, recursive));
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private buildFileTree(dir: string, prefix = "", depth = 0): string {
    if (depth > 4) return "";
    const ignore = new Set(["node_modules", ".git", "dist", "build", ".next"]);
    let tree = "";

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry, i) => {
      if (ignore.has(entry.name)) return;
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      tree += `${prefix}${connector}${entry.name}\n`;
      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLast ? "    " : "│   ");
        tree += this.buildFileTree(path.join(dir, entry.name), newPrefix, depth + 1);
      }
    });

    return tree;
  }
}
