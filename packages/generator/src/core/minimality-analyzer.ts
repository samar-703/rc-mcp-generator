import type { EndpointSchema, MinimalityReport } from './types.js';

const estimateTokens = (bytes: number): number => Math.max(1, Math.ceil(bytes / 4));

const schemaSize = (endpoints: EndpointSchema[]): number =>
  Buffer.byteLength(JSON.stringify(endpoints), 'utf8');

const componentCount = (endpoints: EndpointSchema[]): number =>
  endpoints.reduce((total, endpoint) => {
    const parameterCount = endpoint.parameters.length;
    const requestBodyCount = endpoint.requestBody ? 1 : 0;
    const responseBodyCount = endpoint.responseBody ? 1 : 0;

    return total + parameterCount + requestBodyCount + responseBodyCount;
  }, 0);

export const analyzeMinimality = (
  fullEndpoints: EndpointSchema[],
  selectedEndpoints: EndpointSchema[],
): MinimalityReport => {
  const fullSchemaBytes = schemaSize(fullEndpoints);
  const minimalSchemaBytes = schemaSize(selectedEndpoints);
  const fullEndpointCount = fullEndpoints.length;
  const minimalEndpointCount = selectedEndpoints.length;
  const fullComponentCount = componentCount(fullEndpoints);
  const minimalComponentCount = componentCount(selectedEndpoints);
  const reductionPercent =
    fullEndpointCount === 0
      ? 0
      : Number(
          (((fullEndpointCount - minimalEndpointCount) / fullEndpointCount) * 100).toFixed(1),
        );
  const componentReductionPercent =
    fullComponentCount === 0
      ? 0
      : Number(
          (((fullComponentCount - minimalComponentCount) / fullComponentCount) * 100).toFixed(1),
        );
  const estimatedTokens = {
    full: estimateTokens(fullSchemaBytes),
    minimal: estimateTokens(minimalSchemaBytes),
  };
  const estimatedTokenReductionPercent =
    estimatedTokens.full === 0
      ? 0
      : Number(
          (
            ((estimatedTokens.full - estimatedTokens.minimal) / estimatedTokens.full) *
            100
          ).toFixed(1),
        );

  return {
    componentReductionPercent,
    estimatedTokenReductionPercent,
    estimatedTokens,
    fullEndpointCount,
    fullSchemaBytes,
    minimalComponentCount,
    minimalEndpointCount,
    minimalSchemaBytes,
    reductionPercent,
  };
};

