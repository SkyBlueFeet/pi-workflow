import type { HostCallableToolRecord } from "@pi-workflow/core";
import { readFileTool } from "./tools/read.js";
import { writeFileTool } from "./tools/write.js";
import { editFileTool } from "./tools/edit.js";
import { lsTool } from "./tools/ls.js";
import { grepTool } from "./tools/grep.js";
import { findTool } from "./tools/find.js";

export function registerBuiltinTools(): HostCallableToolRecord[] {
  return [
    {
      name: "read",
      description: "读取文件内容，支持 offset/limit 和截断续读提示",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" },
          offset: { type: "number", description: "读取起始位置" },
          limit: { type: "number", description: "最大读取字符数" },
        },
        required: ["path"],
      },
      capability: "fs.read",
      source: "builtin",
      execute: async (params) => {
        const result = await readFileTool(params as any);
        return result;
      },
    },
    {
      name: "write",
      description: "写入文件内容，自动创建父目录",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" },
          content: { type: "string", description: "文件内容" },
        },
        required: ["path", "content"],
      },
      capability: "fs.write",
      source: "builtin",
      execute: async (params) => {
        const result = await writeFileTool(params as any);
        return result;
      },
    },
    {
      name: "edit",
      description: "基于精确文本匹配替换文件内容，支持多段替换",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径" },
          edits: {
            type: "array",
            description: "替换项列表",
            items: {
              type: "object",
              properties: {
                oldText: { type: "string", description: "被替换的原文" },
                newText: { type: "string", description: "替换后的新文本" },
              },
              required: ["oldText", "newText"],
            },
          },
        },
        required: ["path", "edits"],
      },
      capability: "fs.write",
      source: "builtin",
      execute: async (params) => {
        const result = await editFileTool(params as any);
        return result;
      },
    },
    {
      name: "ls",
      description: "列举目录项，区分文件和目录",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "目录路径" },
        },
        required: ["path"],
      },
      capability: "fs.read",
      source: "builtin",
      execute: async (params) => {
        const result = await lsTool(params as any);
        return result;
      },
    },
    {
      name: "grep",
      description: "在文件或目录中搜索文本模式",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "搜索模式（正则）" },
          path: { type: "string", description: "文件或目录路径" },
          recursive: { type: "boolean", description: "是否递归搜索子目录" },
          maxResults: { type: "number", description: "最大结果数" },
        },
        required: ["pattern", "path"],
      },
      capability: "fs.read",
      source: "builtin",
      execute: async (params) => {
        const result = await grepTool(params as any);
        return result;
      },
    },
    {
      name: "find",
      description: "按名称模式查找文件",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "文件名称模式（支持 * 和 ?）" },
          path: { type: "string", description: "搜索根目录" },
          maxDepth: { type: "number", description: "最大递归深度" },
          maxResults: { type: "number", description: "最大结果数" },
        },
        required: ["pattern", "path"],
      },
      capability: "fs.read",
      source: "builtin",
      execute: async (params) => {
        const result = await findTool(params as any);
        return result;
      },
    },
  ];
}
