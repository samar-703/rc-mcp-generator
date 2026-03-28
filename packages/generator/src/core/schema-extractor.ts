import path from 'node:path';
import { createHash } from 'node:crypto';

import SwaggerParser from '@apidevtools/swagger-parser';
import fs from 'fs-extra';

import type {
  EndpointParameter,
  EndpointSchema,
  JsonSchema,
  ProviderConfig,
} from './types.js';

const SUPPORTED_METHODS = ['delete', 'get', 'patch', 'post', 'put'] as const;
type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

interface OpenApiDocument {
  info?: { title?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  description?: string;
  operationId?: string;
  parameters?: Array<{
    description?: string;
    in?: EndpointParameter['in'];
    name?: string;
    required?: boolean;
    schema?: JsonSchema;
  }>;
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema }>;
    required?: boolean;
  };
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
  summary?: string;
  tags?: string[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheRoot = path.resolve(process.cwd(), '.cache', 'rc-mcp-generator');

const normalizeSchema = (schema: unknown): JsonSchema | undefined => {
  if (!schema || typeof schema !== 'object') {
    return undefined;
  }

  const candidate = schema as Record<string, unknown>;
  const normalized: JsonSchema = {};

  if (
    candidate.type === 'array' ||
    candidate.type === 'boolean' ||
    candidate.type === 'integer' ||
    candidate.type === 'number' ||
    candidate.type === 'object' ||
    candidate.type === 'string'
  ) {
    normalized.type = candidate.type;
  }

  if (Array.isArray(candidate.enum)) {
    normalized.enum = candidate.enum.filter(
      (value): value is string | number | boolean | null =>
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null,
    );
  }

  if (typeof candidate.description === 'string') {
    normalized.description = candidate.description;
  }

  if (typeof candidate.format === 'string') {
    normalized.format = candidate.format;
  }

  if (typeof candidate.nullable === 'boolean') {
    normalized.nullable = candidate.nullable;
  }

  if (Array.isArray(candidate.required)) {
    normalized.required = candidate.required.filter(
      (value): value is string => typeof value === 'string',
    );
  }

  if ('additionalProperties' in candidate) {
    if (typeof candidate.additionalProperties === 'boolean') {
      normalized.additionalProperties = candidate.additionalProperties;
    } else {
      normalized.additionalProperties = normalizeSchema(candidate.additionalProperties);
    }
  }

  const nestedProperties = candidate.properties;

  if (nestedProperties && typeof nestedProperties === 'object' && !Array.isArray(nestedProperties)) {
    normalized.properties = Object.fromEntries(
      Object.entries(nestedProperties)
        .map(([key, value]) => [key, normalizeSchema(value)])
        .filter((entry): entry is [string, JsonSchema] => entry[1] !== undefined),
    );
  }

  const items = normalizeSchema(candidate.items);

  if (items) {
    normalized.items = items;
  }

  if (Array.isArray(candidate.oneOf)) {
    normalized.oneOf = candidate.oneOf
      .map((value) => normalizeSchema(value))
      .filter((value): value is JsonSchema => value !== undefined);
  }

  if (Array.isArray(candidate.anyOf)) {
    normalized.anyOf = candidate.anyOf
      .map((value) => normalizeSchema(value))
      .filter((value): value is JsonSchema => value !== undefined);
  }

  if (candidate.default !== undefined) {
    normalized.default = candidate.default as
      | string
      | number
      | boolean
      | null
      | string[]
      | number[]
      | boolean[]
      | Record<string, string | number | boolean | null>;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const toToolName = (operationId: string): string =>
  operationId
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const createOperationId = (method: string, endpointPath: string): string =>
  `${method}_${endpointPath.replace(/[{}]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')}`
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const cacheFilePathFor = (source: string): string => {
  const digest = createHash('sha1').update(source).digest('hex');
  return path.resolve(cacheRoot, `${digest}.json`);
};

const readCachedSpec = async (source: string): Promise<OpenApiDocument | undefined> => {
  const cachePath = cacheFilePathFor(source);
  const exists = await fs.pathExists(cachePath);

  if (!exists) {
    return undefined;
  }

  const stats = await fs.stat(cachePath);

  if (Date.now() - stats.mtimeMs > CACHE_TTL_MS) {
    return undefined;
  }

  return fs.readJson(cachePath) as Promise<OpenApiDocument>;
};

const writeCachedSpec = async (source: string, document: OpenApiDocument): Promise<void> => {
  const cachePath = cacheFilePathFor(source);
  await fs.ensureDir(path.dirname(cachePath));
  await fs.writeJson(cachePath, document, { spaces: 2 });
};

const resolveJsonContent = (
  content?: Record<string, { schema?: JsonSchema }>,
): JsonSchema | undefined => {
  if (!content) {
    return undefined;
  }

  for (const contentType of ['application/json', 'application/json;charset=utf-8']) {
    const schema = normalizeSchema(content[contentType]?.schema);

    if (schema) {
      return schema;
    }
  }

  const firstSchema = Object.values(content)
    .map((entry) => normalizeSchema(entry.schema))
    .find((schema) => schema !== undefined);

  return firstSchema;
};

export class SchemaExtractor {
  private readonly provider: ProviderConfig;

  public constructor(provider: ProviderConfig) {
    this.provider = provider;
  }

  public async getEndpoints(domains?: string[]): Promise<EndpointSchema[]> {
    const requestedDomains = new Set(domains ?? []);
    const endpoints = (
      await Promise.all(
        this.provider.specSource.files.map(async (fileName) => {
          const domain = fileName.replace(/\.(json|ya?ml)$/i, '');

          if (requestedDomains.size > 0 && !requestedDomains.has(domain)) {
            return [];
          }

          const source = this.resolveSource(fileName);
          const document = await this.loadDocument(source);
          return this.extractEndpointsFromDocument(domain, document);
        }),
      )
    ).flat();

    return endpoints.sort((left, right) => left.operationId.localeCompare(right.operationId));
  }

  public async getEndpointsByOperationId(
    operationIds: string[],
  ): Promise<EndpointSchema[]> {
    const requested = new Set(operationIds);
    const endpoints = await this.getEndpoints();
    const selected = endpoints.filter((endpoint) => requested.has(endpoint.operationId));
    const missing = operationIds.filter(
      (operationId) => !selected.some((endpoint) => endpoint.operationId === operationId),
    );

    if (missing.length > 0) {
      throw new Error(`Unknown operationIds: ${missing.join(', ')}`);
    }

    return selected;
  }

  public async getTagSummary(domains?: string[]): Promise<Record<string, string[]>> {
    const endpoints = await this.getEndpoints(domains);
    const grouped = new Map<string, Set<string>>();

    for (const endpoint of endpoints) {
      const domainTags = grouped.get(endpoint.domain) ?? new Set<string>();

      for (const tag of endpoint.tags) {
        domainTags.add(tag);
      }

      grouped.set(endpoint.domain, domainTags);
    }

    return Object.fromEntries(
      [...grouped.entries()].map(([domain, tags]) => [domain, [...tags].sort()]),
    );
  }

  public async getEndpointsByTag(
    options?: { domains?: string[]; tags?: string[] },
  ): Promise<Record<string, Record<string, EndpointSchema[]>>> {
    const endpoints = await this.getEndpoints(options?.domains);
    const requestedTags = options?.tags ? new Set(options.tags) : undefined;
    const grouped = new Map<string, Map<string, EndpointSchema[]>>();

    for (const endpoint of endpoints) {
      for (const tag of endpoint.tags) {
        if (requestedTags && !requestedTags.has(tag)) {
          continue;
        }

        const domainEntry = grouped.get(endpoint.domain) ?? new Map<string, EndpointSchema[]>();
        const tagEntry = domainEntry.get(tag) ?? [];
        tagEntry.push(endpoint);
        domainEntry.set(tag, tagEntry);
        grouped.set(endpoint.domain, domainEntry);
      }
    }

    return Object.fromEntries(
      [...grouped.entries()].map(([domain, tagMap]) => [
        domain,
        Object.fromEntries(
          [...tagMap.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([tag, tagEndpoints]) => [
              tag,
              [...tagEndpoints].sort((left, right) => left.operationId.localeCompare(right.operationId)),
            ]),
        ),
      ]),
    );
  }

  private resolveSource(fileName: string): string {
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
      return fileName;
    }

    if (path.isAbsolute(fileName)) {
      return fileName;
    }

    return `${this.provider.specSource.baseUrl.replace(/\/+$/, '')}/${fileName}`;
  }

  private async loadDocument(source: string): Promise<OpenApiDocument> {
    const cached = await readCachedSpec(source);

    if (cached) {
      return cached;
    }

    const document = (await SwaggerParser.dereference(source)) as OpenApiDocument;
    await writeCachedSpec(source, document);

    return document;
  }

  private extractEndpointsFromDocument(
    domain: string,
    document: OpenApiDocument,
  ): EndpointSchema[] {
    const endpoints: EndpointSchema[] = [];

    for (const [endpointPath, pathItem] of Object.entries(document.paths ?? {})) {
      for (const method of SUPPORTED_METHODS) {
        const operation = pathItem[method];

        if (!operation) {
          continue;
        }

        endpoints.push(this.toEndpointSchema(domain, method, endpointPath, operation));
      }
    }

    return endpoints;
  }

  private toEndpointSchema(
    domain: string,
    method: SupportedMethod,
    endpointPath: string,
    operation: OpenApiOperation,
  ): EndpointSchema {
    const operationId = operation.operationId ?? createOperationId(method, endpointPath);
    const parameters: EndpointParameter[] = (operation.parameters ?? [])
      .filter((parameter) => parameter.name && parameter.in && parameter.schema)
      .map((parameter) => ({
        description: parameter.description,
        in: parameter.in as EndpointParameter['in'],
        name: parameter.name as string,
        required: parameter.required ?? parameter.in === 'path',
        schema: normalizeSchema(parameter.schema) ?? { type: 'string' },
      }))
      .filter((parameter) =>
        !(
          parameter.in === 'header' &&
          this.provider.authHeaderKeys.some(
            (headerName) => headerName.toLowerCase() === parameter.name.toLowerCase(),
          )
        ),
      );

    const successResponse =
      operation.responses?.['200'] ??
      operation.responses?.['201'] ??
      operation.responses?.default;

    return {
      description: operation.description ?? operation.summary ?? '',
      domain,
      method,
      operationId,
      parameters,
      path: endpointPath,
      requestBody: resolveJsonContent(operation.requestBody?.content),
      responseBody: resolveJsonContent(successResponse?.content),
      summary: operation.summary ?? operation.operationId ?? endpointPath,
      tags: operation.tags ?? [domain],
      toolName: toToolName(operationId),
    };
  }
}
