export interface DomainEntry {
  domain: string;
  sourceUrls: string[];
  tld: string;
  isValidRfc1035: boolean;
  rfc1035Error?: string;
  falsePositiveRisk: {
    isHighRisk: boolean;
    reason?: string;
    category?: 'shared_hosting' | 'cdn' | 'infrastructure' | 'auth_gateway' | 'generic';
  };
  variantGroup?: string;
  variantDomains?: string[];
  resolvedIp?: string | null;
  dnsStatus?: 'active' | 'nxdomain' | 'checking' | 'unknown';
  cnameTarget?: string | null;
  redirectTarget?: string | null;
  redirectChain?: string[];
  isRedirectOrAlias?: boolean;
  isIncluded: boolean;
  notes?: string;
}

export interface HarvestSummary {
  totalFound: number;
  uniqueCount: number;
  searchesExecutedCount: number;
  flaggedCount: number;
  variantsCount: number;
  excludedCount: number;
}

export interface SearchQueryInfo {
  query: string;
  language: 'es' | 'en' | 'mixed';
  type: 'synonym' | 'best_of' | 'top_list' | 'intent' | 'literal';
  resultsFound?: number;
}

export interface BlocklistMetadata {
  termino_busqueda: string;
  titulo_lista: string;
  descripcion: string;
  max_resultados?: number;
  timestamp: string;
  slug: string;
}

export interface HarvestResponse {
  metadata: BlocklistMetadata;
  queriesExecuted: SearchQueryInfo[];
  domains: DomainEntry[];
  summary: HarvestSummary;
  formattedOutput: string;
  limitations: string[];
}

export interface DnsCheckProgress {
  isChecking: boolean;
  processed: number;
  total: number;
  percentage: number;
}

export type ExportFormatMode =
  | 'pihole'
  | 'plain'
  | 'adguard'
  | 'dnsmasq'
  | 'unbound'
  | 'mikrotik'
  | 'pfsense'
  | 'csv';
