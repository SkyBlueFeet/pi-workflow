#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { agentCommand } from "./commands/agent.js";
import { loadCliEnvFiles } from "./env.js";

loadCliEnvFiles();

yargs(hideBin(process.argv))
  .scriptName("pi-agent")
  .command({
    command: "run <id>",
    describe: "启动 PI 原生界面",
    builder: (yargs) =>
      yargs
        .positional("id", { type: "string", demandOption: true, describe: "智能体 ID" })
        .option("config", { type: "string", demandOption: true, describe: "配置文件路径" })
        .option("model", { type: "string", describe: "模型覆盖" })
        .option("debug", { type: "boolean", default: false, describe: "输出调试信息" }),
    handler: async (argv) => {
      const args = ["run", argv.id as string, "--config", argv.config as string];
      if (argv.model) args.push("--model", argv.model as string);
      if (argv.debug) args.push("--debug");
      await agentCommand(args);
    },
  })
  .command({
    command: "list",
    describe: "列出所有智能体",
    builder: (yargs) =>
      yargs.option("config", { type: "string", demandOption: true, describe: "配置文件路径" }),
    handler: async (argv) => {
      await agentCommand(["list", "--config", argv.config as string]);
    },
  })
  .command({
    command: "show <id>",
    describe: "查看智能体详情",
    builder: (yargs) =>
      yargs
        .positional("id", { type: "string", demandOption: true, describe: "智能体 ID" })
        .option("config", { type: "string", demandOption: true, describe: "配置文件路径" }),
    handler: async (argv) => {
      await agentCommand(["show", argv.id as string, "--config", argv.config as string]);
    },
  })
  .command({
    command: "resolve <id>",
    describe: "查看合并后的智能体配置",
    builder: (yargs) =>
      yargs
        .positional("id", { type: "string", demandOption: true, describe: "智能体 ID" })
        .option("config", { type: "string", demandOption: true, describe: "配置文件路径" }),
    handler: async (argv) => {
      await agentCommand(["resolve", argv.id as string, "--config", argv.config as string]);
    },
  })
  .command({
    command: "once <id>",
    describe: "单轮执行 - 适用于脚本/管道批处理场景",
    builder: (yargs) =>
      yargs
        .positional("id", { type: "string", demandOption: true, describe: "智能体 ID" })
        .option("config", { type: "string", demandOption: true, describe: "配置文件路径" })
        .option("input", { type: "string", describe: "输入 JSON 文件路径" })
        .option("prompt", { type: "string", describe: "直接指定本轮 prompt" })
        .option("model", { type: "string", describe: "模型覆盖" })
        .option("debug", { type: "boolean", default: false, describe: "输出调试信息" }),
    handler: async (argv) => {
      const args = ["once", argv.id as string];
      args.push("--config", argv.config as string);
      if (argv.input) args.push("--input", argv.input as string);
      if (argv.prompt) args.push("--prompt", argv.prompt as string);
      if (argv.model) args.push("--model", argv.model as string);
      if (argv.debug) args.push("--debug");
      await agentCommand(args);
    },
  })
  .demandCommand(1, "请指定子命令: run | once | list | show | resolve")
  .strict()
  .help()
  .parse();
