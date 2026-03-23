export class RocketChatError extends Error {
  public readonly statusCode?: number;
  public readonly errorType?: string;
  public readonly details?: unknown;

  public constructor(options: {
    message: string;
    statusCode?: number;
    errorType?: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'RocketChatError';
    this.statusCode = options.statusCode;
    this.errorType = options.errorType;
    this.details = options.details;
  }
}

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class ToolExecutionError extends Error {
  public readonly details?: unknown;

  public constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ToolExecutionError';
    this.details = details;
  }
}

export const isRocketChatError = (error: unknown): error is RocketChatError =>
  error instanceof RocketChatError;

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

