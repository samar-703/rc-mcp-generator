import type {
  EndpointSchema,
  SearchResult,
  SuggestionCluster,
  WorkflowDefinition,
} from './types.js';

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

const SYNONYMS: Record<string, string[]> = {
  announcement: ['announcement', 'broadcast', 'post', 'message'],
  archive: ['archive', 'close'],
  channel: ['channel', 'room', 'conversation'],
  dm: ['dm', 'direct', 'message'],
  export: ['export', 'history', 'messages'],
  mention: ['mention', 'notification', 'unread'],
  onboarding: ['onboard', 'invite', 'welcome', 'user'],
  search: ['search', 'find', 'lookup'],
  standup: ['standup', 'status', 'update'],
  support: ['support', 'ticket', 'incident'],
  user: ['user', 'member', 'teammate'],
};

const tokenize = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const expandTokens = (tokens: string[]): string[] => {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (token === key || values.includes(token)) {
        expanded.add(key);

        for (const synonym of values) {
          expanded.add(synonym);
        }
      }
    }
  }

  return [...expanded];
};

const scoreText = (tokens: string[], value: string, weight: number): number => {
  const haystack = value.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += weight;
    }
  }

  return score;
};

export const searchEndpoints = (
  endpoints: EndpointSchema[],
  query: string,
  limit = 10,
  domains?: string[],
): SearchResult[] => {
  const expandedTokens = expandTokens(tokenize(query));
  const domainFilter = domains ? new Set(domains) : undefined;

  return endpoints
    .filter((endpoint) => (domainFilter ? domainFilter.has(endpoint.domain) : true))
    .map((endpoint) => ({
      endpoint,
      score:
        scoreText(expandedTokens, endpoint.operationId, 6) +
        scoreText(expandedTokens, endpoint.summary, 4) +
        scoreText(expandedTokens, endpoint.path, 3) +
        scoreText(expandedTokens, endpoint.tags.join(' '), 2) +
        scoreText(expandedTokens, endpoint.description, 1),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
};

export const suggestWorkflows = (
  workflows: WorkflowDefinition[],
  intent: string,
): WorkflowDefinition[] => {
  const expandedTokens = expandTokens(tokenize(intent));

  return workflows
    .map((workflow) => ({
      score:
        scoreText(expandedTokens, workflow.name, 5) +
        scoreText(expandedTokens, workflow.title, 4) +
        scoreText(expandedTokens, workflow.description, 3),
      workflow,
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map((result) => result.workflow);
};

export const buildSuggestionClusters = (
  searchResults: SearchResult[],
): SuggestionCluster[] => {
  const grouped = new Map<string, EndpointSchema[]>();

  for (const result of searchResults) {
    const key = `${result.endpoint.domain}::${result.endpoint.tags[0] ?? 'misc'}`;
    const cluster = grouped.get(key) ?? [];
    cluster.push(result.endpoint);
    grouped.set(key, cluster);
  }

  return [...grouped.entries()].slice(0, 5).map(([key, endpoints]) => {
    const [domain, tag] = key.split('::');

    return {
      endpoints,
      reasoning: `These endpoints cluster around ${domain}/${tag} and match the intent keywords.`,
      title: `${domain} · ${tag}`,
    };
  });
};

