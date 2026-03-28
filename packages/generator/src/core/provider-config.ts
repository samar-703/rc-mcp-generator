import type { ProviderConfig } from './types.js';

const SPEC_BASE_URL =
  'https://raw.githubusercontent.com/RocketChat/Rocket.Chat-Open-API/main';

export const ROCKET_CHAT_PROVIDER: ProviderConfig = {
  apiBasePath: '/api/v1',
  authHeaderKeys: ['X-Auth-Token', 'X-User-Id'],
  name: 'rocketchat',
  specSource: {
    baseUrl: SPEC_BASE_URL,
    files: [
      'authentication.yaml',
      'content-management.yaml',
      'integrations.yaml',
      'marketplace-apps.yaml',
      'messaging.yaml',
      'miscellaneous.yaml',
      'notifications.yaml',
      'omnichannel.yaml',
      'rooms.yaml',
      'settings.yaml',
      'statistics.yaml',
      'user-management.yaml',
    ],
  },
};
