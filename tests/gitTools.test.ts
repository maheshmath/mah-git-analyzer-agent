// tests/gitTools.test.ts
import { GitTools } from "../src/tools/gitTools";

describe("GitTools", () => {
  describe("getToolDefinitions", () => {
    it("should return all 9 tool definitions", () => {
      const tools = GitTools.getToolDefinitions();
      expect(tools).toHaveLength(9);
    });

    it("each tool should have required fields", () => {
      const tools = GitTools.getToolDefinitions();
      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.input_schema).toBeDefined();
        expect(tool.input_schema.type).toBe("object");
        expect(tool.input_schema.properties).toBeDefined();
        expect(Array.isArray(tool.input_schema.required)).toBe(true);
      }
    });

    it("should include the search_code tool", () => {
      const tools = GitTools.getToolDefinitions();
      const searchTool = tools.find((t) => t.name === "search_code");
      expect(searchTool).toBeDefined();
      expect(searchTool?.input_schema.required).toContain("pattern");
    });
  });

  describe("executeToolCall", () => {
    it("should return error JSON for unknown tool", async () => {
      const gitTools = new GitTools(".");
      const result = await gitTools.executeToolCall("nonexistent_tool", {});
      const parsed = JSON.parse(result);
      expect(parsed.error).toContain("Unknown tool");
    });
  });
});
