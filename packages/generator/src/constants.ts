import { getWorkflowDefinitions } from './core/workflow-registry.js';

export const GENERATOR_NAME = 'rc-mcp-generator';
export const GENERATED_SERVER_NAME = 'generated-rc-mcp-server';

export const AVAILABLE_WORKFLOWS = getWorkflowDefinitions();
export type WorkflowName = (typeof AVAILABLE_WORKFLOWS)[number]['name'];

export const WORKFLOW_MAP = new Map(
  AVAILABLE_WORKFLOWS.map((workflow) => [workflow.name, workflow]),
);
