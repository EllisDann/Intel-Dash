export abstract class BaseIntegration {
  constructor(public tenantId: string, public integrationId?: string) {}

  abstract getAuthorizationUrl(state: string): string;
  abstract createStateToken(): Promise<string>;
  abstract handleCallback(code: string, state: string): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract validateConnection(): Promise<boolean>;
  abstract fetchData(): Promise<any>;
}
