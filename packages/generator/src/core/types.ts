export interface ProviderSpecSource {
  baseUrl: string;
  files: readonly string[];
}

export interface ProviderConfig {
  apiBasePath: string;
  authHeaderKeys: readonly string[];
  name: string;
  specSource: ProviderSpecSource;
}

export interface EndpointParameter {
  description?: string;
  in: 'cookie' | 'header' | 'path' | 'query';
  name: string;
  required: boolean;
  schema: JsonSchema;
}

export interface EndpointSchema {
  description: string;
  domain: string;
  method: 'delete' | 'get' | 'patch' | 'post' | 'put';
  operationId: string;
  path: string;
  requestBody?: JsonSchema;
  responseBody?: JsonSchema;
  summary: string;
  tags: string[];
  toolName: string;
  parameters: EndpointParameter[];
}

export interface WorkflowDefinition {
  description: string;
  exampleArgs: Record<string, unknown>;
  exampleResultSummary: string;
  name: string;
  relatedApiMethods: string[];
  sourceTestFile: string;
  sourceToolFile: string;
  title: string;
}

export interface GeneratedToolDescriptor {
  description: string;
  fileName: string;
  name: string;
  testFileName: string;
  type: 'endpoint' | 'workflow';
}

export interface ValidationSummary {
  deepChecked: boolean;
  errors: string[];
  info: string[];
  serverDir: string;
  valid: boolean;
}

export interface MinimalityReport {
  componentReductionPercent: number;
  estimatedTokenReductionPercent: number;
  estimatedTokens: {
    full: number;
    minimal: number;
  };
  fullEndpointCount: number;
  minimalComponentCount: number;
  minimalEndpointCount: number;
  minimalSchemaBytes: number;
  fullSchemaBytes: number;
  reductionPercent: number;
}

export type JsonPrimitive = boolean | null | number | string;

export interface JsonSchema {
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  default?: JsonPrimitive | JsonPrimitive[] | Record<string, JsonPrimitive>;
  description?: string;
  enum?: JsonPrimitive[];
  format?: string;
  items?: JsonSchema;
  nullable?: boolean;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string';
}

export interface SearchResult {
  endpoint: EndpointSchema;
  score: number;
}

export interface SuggestionCluster {
  endpoints: EndpointSchema[];
  reasoning: string;
  title: string;
}
