import { describe, expect, it } from 'vitest';

import {
  DOCUMENTS_CONTRACT_VERSION,
  DOCUMENTS_PHASE_A_NOTICE,
  documentsApplicationOperations,
} from './documents.contracts';

describe('documents local contract', () => {
  it('publishes every Phase A application operation as a proposal', () => {
    expect(DOCUMENTS_CONTRACT_VERSION).toBe('documents.v1-proposal');
    expect(DOCUMENTS_PHASE_A_NOTICE).toContain('persistence');
    expect(documentsApplicationOperations).toEqual([
      'listDocuments',
      'getDocument',
      'createUploadSession',
      'completeUpload',
      'cancelUpload',
      'createVersion',
      'listVersions',
      'requestAuthorizedDownload',
      'archiveDocument',
      'restoreDocument',
      'listAccessHistory',
      'placeLegalHold',
      'releaseLegalHold',
    ]);
  });
});
