/**
 * pi-agent 命令模块（pi-studio-cli 内部边界）。
 *
 * 职责：
 * 1. 为 pi-studio 控制台内与 agent 相关的操作提供模块级接线
 * 2. 承载 /create-agent、/agents 等控制台命令对 agent 层的调用
 * 3. 复用 packages/pi-workflow 中的 registry、resolver、invoker 等能力
 *
 * 注意：
 * - 对外 CLI `pi-agent` 命令仍由 `apps/pi-workflow-cli` 提供
 * - 本模块是 studio 控制台内的 agent 能力边界，不是替代品
 */

import type { AgentCatalogService } from "../services/agent-catalog-service.js";
import type { AgentAuthoringService } from "../services/agent-authoring-service.js";

/** studio 控制台依赖的 agent 能力面。 */
export interface StudioAgentFacade {
  readonly catalog: AgentCatalogService;
  readonly authoring: AgentAuthoringService;
}

/** 预留：创建默认的 agent facade 实现（后续阶段接入真实服务）。 */
export function createAgentFacade(): StudioAgentFacade {
  const { AgentCatalogServiceImpl } =
    require("../services/agent-catalog-service.js") as typeof import("../services/agent-catalog-service.js");
  const { AgentAuthoringServiceImpl } =
    require("../services/agent-authoring-service.js") as typeof import("../services/agent-authoring-service.js");
  return {
    catalog: new AgentCatalogServiceImpl(),
    authoring: new AgentAuthoringServiceImpl(),
  };
}
