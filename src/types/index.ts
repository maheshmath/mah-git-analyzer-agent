// src/types/index.ts

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
}

export interface GitFile {
  path: string;
  content: string;
  extension: string;
  size: number;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  patch: string;
}

export interface AnalysisResult {
  summary: string;
  findings: Finding[];
  recommendations: string[];
  metrics: CodeMetrics;
}

export interface Finding {
  severity: "critical" | "warning" | "info";
  category: FindingCategory;
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export type FindingCategory =
  | "security"
  | "performance"
  | "code-quality"
  | "best-practices"
  | "documentation"
  | "testing"
  | "dependencies";

export interface CodeMetrics {
  totalFiles: number;
  totalCommits: number;
  totalContributors: number;
  languages: Record<string, number>;
  avgCommitSize: number;
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface AgentConfig {
  repoPath: string;
  analysisType: AnalysisType;
  maxCommits?: number;
  filePatterns?: string[];
  verbose?: boolean;
}

export type AnalysisType =
  | "full"
  | "security"
  | "performance"
  | "code-quality"
  | "recent-changes"
  | "commit-history";
