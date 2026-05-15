import { GitHubIntegration } from './github';
import { JiraIntegration } from './jira';

export const createIntegrationClient = (type: string, tenantId: string, integrationId?: string) => {
  switch (type) {
    case 'github':
      return new GitHubIntegration(tenantId, integrationId);
    case 'jira':
      return new JiraIntegration(tenantId, integrationId);
    default:
      throw new Error(`Unsupported integration type: ${type}`);
  }
};
