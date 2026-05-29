export abstract class BaseIntegration {
  constructor(public tenantId: string, public integrationId?: string) {}

  abstract getAuthorizationUrl(state: string): string;
  abstract createStateToken(returnUrl?: string): Promise<string>;
  abstract handleCallback(code: string, state: string): Promise<{ returnUrl?: string }>;
  abstract disconnect(): Promise<void>;
  abstract validateConnection(): Promise<boolean>;
  abstract fetchData(): Promise<any>;
}
