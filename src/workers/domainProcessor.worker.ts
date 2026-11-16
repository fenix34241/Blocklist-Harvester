import {
  parseRawBlocklistText,
  detectVariants,
  isValidRfc1035,
  assessFalsePositiveRisk
} from '../utils/domainExtractor';
import { DomainEntry } from '../types';

export interface WorkerRequest {
  id: string;
  action: 'DIFF_PARSE' | 'BUILD_ENTRIES';
  text: string;
  existingDomains?: string[];
}

export interface WorkerResponse {
  id: string;
  action: 'DIFF_PARSE' | 'BUILD_ENTRIES';
  parsedDomains: string[];
  entries?: DomainEntry[];
  totalLines: number;
  skippedLines: number;
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, action, text, existingDomains } = event.data;

  try {
    const { uniqueDomains, totalLines, skippedLines } = parseRawBlocklistText(text);

    if (action === 'DIFF_PARSE') {
      const response: WorkerResponse = {
        id,
        action,
        parsedDomains: uniqueDomains,
        totalLines,
        skippedLines
      };
      self.postMessage(response);
      return;
    }

    if (action === 'BUILD_ENTRIES') {
      const existingSet = new Set<string>(
        (existingDomains || []).map(d => d.toLowerCase())
      );

      // Filter out duplicates already in existingSet using O(1) lookup
      const newUniqueDomains: string[] = [];
      for (let i = 0; i < uniqueDomains.length; i++) {
        const d = uniqueDomains[i];
        if (!existingSet.has(d)) {
          newUniqueDomains.push(d);
        }
      }

      // Compute variants across combined set
      const combined = [...Array.from(existingSet), ...newUniqueDomains];
      const variantMap = detectVariants(combined);

      const entries: DomainEntry[] = new Array(newUniqueDomains.length);
      for (let i = 0; i < newUniqueDomains.length; i++) {
        const domain = newUniqueDomains[i];
        const rfc = isValidRfc1035(domain);
        const risk = assessFalsePositiveRisk(domain);
        const dotIdx = domain.lastIndexOf('.');
        const tld = dotIdx !== -1 ? domain.slice(dotIdx + 1) : '';

        entries[i] = {
          domain,
          sourceUrls: ['Imported / Manual'],
          tld,
          isValidRfc1035: rfc.isValid,
          rfc1035Error: rfc.error,
          falsePositiveRisk: risk,
          variantDomains: variantMap.get(domain),
          isIncluded: rfc.isValid && !risk.isHighRisk
        };
      }

      const response: WorkerResponse = {
        id,
        action,
        parsedDomains: newUniqueDomains,
        entries,
        totalLines,
        skippedLines
      };
      self.postMessage(response);
    }
  } catch (err: any) {
    const response: WorkerResponse = {
      id,
      action,
      parsedDomains: [],
      totalLines: 0,
      skippedLines: 0,
      error: err?.message || 'Error en Web Worker'
    };
    self.postMessage(response);
  }
};
