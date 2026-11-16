import { DomainEntry } from '../types';
import {
  parseRawBlocklistText,
  detectVariants,
  isValidRfc1035,
  assessFalsePositiveRisk
} from './domainExtractor';
import type { WorkerRequest, WorkerResponse } from '../workers/domainProcessor.worker';

const WORKER_LINE_THRESHOLD = 5000;

function estimateLineCount(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) count++;
    if (count > WORKER_LINE_THRESHOLD) return count;
  }
  return count;
}

function runWorkerTask(payload: Omit<WorkerRequest, 'id'>): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL('../workers/domainProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id === id) {
          worker.terminate();
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data);
          }
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || 'Web Worker execution failed'));
      };

      worker.postMessage({ ...payload, id });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Parses and deduplicates a blocklist text for Diff Comparison.
 * Automatically offloads to a Web Worker when > 5,000 lines are processed.
 */
export async function parseDiffListAsync(text: string): Promise<{
  parsedDomains: string[];
  totalLines: number;
  skippedLines: number;
  usedWorker: boolean;
}> {
  const isMassive = estimateLineCount(text) > WORKER_LINE_THRESHOLD;

  if (isMassive && typeof Worker !== 'undefined') {
    try {
      const res = await runWorkerTask({ action: 'DIFF_PARSE', text });
      return {
        parsedDomains: res.parsedDomains,
        totalLines: res.totalLines,
        skippedLines: res.skippedLines,
        usedWorker: true
      };
    } catch (err) {
      console.warn('Web Worker fallback to main thread:', err);
    }
  }

  const { uniqueDomains, totalLines, skippedLines } = parseRawBlocklistText(text);
  return {
    parsedDomains: uniqueDomains,
    totalLines,
    skippedLines,
    usedWorker: false
  };
}

/**
 * Parses, validates (RFC 1035), deduplicates against existingDomains (O(1) Set),
 * and builds DomainEntry[] objects. Automatically offloads to a Web Worker when > 5,000 lines.
 */
export async function buildEntriesFromTextAsync(
  text: string,
  existingDomains: string[]
): Promise<{
  entries: DomainEntry[];
  parsedDomains: string[];
  totalLines: number;
  skippedLines: number;
  usedWorker: boolean;
}> {
  const isMassive = estimateLineCount(text) > WORKER_LINE_THRESHOLD;

  if (isMassive && typeof Worker !== 'undefined') {
    try {
      const res = await runWorkerTask({
        action: 'BUILD_ENTRIES',
        text,
        existingDomains
      });
      return {
        entries: res.entries || [],
        parsedDomains: res.parsedDomains,
        totalLines: res.totalLines,
        skippedLines: res.skippedLines,
        usedWorker: true
      };
    } catch (err) {
      console.warn('Web Worker fallback to main thread:', err);
    }
  }

  const { uniqueDomains, totalLines, skippedLines } = parseRawBlocklistText(text);
  const existingSet = new Set<string>(existingDomains.map(d => d.toLowerCase()));
  const newUniqueDomains: string[] = [];

  for (let i = 0; i < uniqueDomains.length; i++) {
    const d = uniqueDomains[i];
    if (!existingSet.has(d)) {
      newUniqueDomains.push(d);
    }
  }

  const combined = [...Array.from(existingSet), ...newUniqueDomains];
  const variantMap = detectVariants(combined);

  const entries: DomainEntry[] = newUniqueDomains.map(domain => {
    const rfc = isValidRfc1035(domain);
    const risk = assessFalsePositiveRisk(domain);
    const dotIdx = domain.lastIndexOf('.');
    const tld = dotIdx !== -1 ? domain.slice(dotIdx + 1) : '';

    return {
      domain,
      sourceUrls: ['Imported / Manual'],
      tld,
      isValidRfc1035: rfc.isValid,
      rfc1035Error: rfc.error,
      falsePositiveRisk: risk,
      variantDomains: variantMap.get(domain),
      isIncluded: rfc.isValid && !risk.isHighRisk
    };
  });

  return {
    entries,
    parsedDomains: newUniqueDomains,
    totalLines,
    skippedLines,
    usedWorker: false
  };
}
