// param naming intentionally verbose for ops-readability
@description('Location for all resources (SWA is limited to a subset — e.g. westeurope, eastus2, centralus, eastasia).')
param location string = 'westeurope'

@description('Base name prefix — e.g. \"dv-dashboard\" or \"dataverse-swa\". Resources are suffixed deterministically.')
param baseName string = 'dv-dashboard'

@description('Environment label used in resource names: dev | staging | prod.')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('SKU for Static Web App: Free or Standard. Free is fine for mock/dev; Standard required for custom domain + SLA.')
@allowed(['Free', 'Standard'])
param skuName string = 'Free'

@description('GitHub repo for linked deployment (optional — leave empty for manual / token deploy). e.g. \"exbald/dataverse-swa-dashboard\".')
param repositoryUrl string = ''

@description('Branch to deploy from linked repo.')
param branch string = 'main'

@description('Tags applied to all resources.')
param tags object = {
  project: 'dataverse-swa-dashboard'
  managedBy: 'bicep'
}

// ── Naming helpers ──────────────────────────────────────────────
// SWA name must be globally unique-ish + <= 40 chars; use baseName + env + short unique.
var swaName = '${baseName}-${environment}-swa'
var appInsightsName = '${baseName}-${environment}-insights'
var logAnalyticsName = '${baseName}-${environment}-logs'

// ── Optional observability: Log Analytics + App Insights ────────
// Skip if you don't need App Insights (SWA built-in logs are enough for small tenants).
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Static Web App ──────────────────────────────────────────────
resource swa 'Microsoft.Web/staticSites@2024-04-01' = {
  name: swaName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuName
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: branch
    buildProperties: {
      appLocation: '/'
      apiLocation: 'api'
      outputLocation: 'dist'
    }
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: empty(repositoryUrl) ? 'Custom' : 'GitHub'
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// ── App Settings (non-secret defaults; secrets via Key Vault refs or portal) ──
// Secrets must NOT be committed — set via `az staticwebapp appsettings set` or Key Vault reference.
// These defaults are safe placeholders; override after deployment.
resource swaSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: swa
  name: 'appsettings'
  // Note: deployment via Bicep will set these values; real secrets should be rotated via
  // `az staticwebapp appsettings set --name <swaName> --setting-names DATAVERSE_CLIENT_SECRET=<value>`
  // or Key Vault references like `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>/)`.
  properties: {
    DATAVERSE_MODE: 'mock'
    DATAVERSE_URL: 'https://your-org.crm.dynamics.com'
    DATAVERSE_TENANT_ID: '00000000-0000-0000-0000-000000000000'
    DATAVERSE_CLIENT_ID: '00000000-0000-0000-0000-000000000000'
    // Do NOT set DATAVERSE_CLIENT_SECRET here — set via portal/Key Vault after deploy.
    ENTRA_ALLOWED_TENANT_IDS: ''
    API_CACHE_TTL: '60'
    APPINSIGHTS_INSTRUMENTATIONKEY: appInsights.properties.InstrumentationKey
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
  }
}

// ── Outputs ─────────────────────────────────────────────────────
output swaName string = swa.name
output swaHostname string = swa.properties.defaultHostname
output swaId string = swa.id
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
