/**
 * pi-workflow 命令模块（pi-studio-cli 内部边界）。
 *
 * 职责：
 * 1. 为 pi-studio 控制台内与 workflow 相关的操作提供模块级接线
 * 2. 承载 /create-workflow、/workflows 等控制台命令对 workflow 层的调用
 * 3. 复用 packages/pi-workflow 中的 registry、authoring、runtime 等能力
 *
 * 注意：
 * - 对外 CLI `pi-workflow` 命令仍由 `apps/pi-workflow-cli` 提供
 * - 本模块是 studio 控制台内的 workflow 能力边界，不是替代品
 */

import type { WorkflowCatalogService } from "../services/workflow-catalog-service.js";
import type { WorkflowAuthoringService } from "../services/workflow-authoring-service.js";
import { WorkflowCatalogServiceImpl } from "../services/workflow-catalog-service.js";
import { WorkflowAuthoringServiceImpl } from "../services/workflow-authoring-service.js";

/** studio 控制台依赖的 workflow 能力面。 */
export interface StudioWorkflowFacade {
  readonly catalog: WorkflowCatalogService;
  readonly authoring: WorkflowAuthoringService;
}

/** 预留：创建默认的 workflow facade 实现（后续阶段接入真实服务）。 */
export function createWorkflowFacade(): StudioWorkflowFacade {
  return {
    catalog: new WorkflowCatalogServiceImpl(),
    authoring: new WorkflowAuthoringServiceImpl(),
  };
}
