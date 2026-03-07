import type { HttpTransport } from '../http.js';
import type {
  ContractDefinition,
  ContractTestResult,
} from '../types.js';

export function contractDomain(http: HttpTransport) {
  return {
    /** List all contract definitions. */
    list: () => http.get<ContractDefinition[]>('/api/contracts'),

    /** Get a single contract definition by ID. */
    get: (id: string) => http.get<ContractDefinition>(`/api/contracts/${encodeURIComponent(id)}`),

    /** Run contract tests against a block. Returns fitness score with feature breakdown. */
    test: (contractId: string, blockId: string) =>
      http.post<ContractTestResult>(
        `/api/contracts/${encodeURIComponent(contractId)}/test?blockId=${encodeURIComponent(blockId)}`
      ),
  };
}
