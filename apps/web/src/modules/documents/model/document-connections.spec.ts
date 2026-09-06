import {
  DOCUMENT_DOMAIN_CODES,
  type DocumentRelationV1,
} from '@rubi/contracts';
import { describe, expect, it } from 'vitest';

import {
  createDocumentConnectionHref,
  DOCUMENT_CONNECTIONS,
  documentRelationSourceLabel,
  documentRelationTypeLabel,
  getDocumentConnection,
  getDocumentRelationConnection,
} from './document-connections';

const relation: DocumentRelationV1 = {
  id: 'relation/id with spaces',
  relationType: 'PRIMARY_CASE',
  sourceModule: 'documents-demo',
  sourceEntityType: 'SyntheticDocumentFixture',
  sourceEntityIdMasked: '***secret-source-id',
  displayLabel: 'پرونده آزمایشی',
};

describe('Documents connection map', () => {
  it('defines one internal and external destination for every domain', () => {
    expect(DOCUMENT_CONNECTIONS.map((item) => item.domain)).toEqual(
      DOCUMENT_DOMAIN_CODES,
    );
    expect(new Set(DOCUMENT_CONNECTIONS.map((item) => item.domain)).size).toBe(
      DOCUMENT_DOMAIN_CODES.length,
    );

    for (const connection of DOCUMENT_CONNECTIONS) {
      expect(connection.documentsSection).toBeTruthy();
      expect(connection.sectionLabel).toBeTruthy();
      expect(connection.moduleLabel).toBeTruthy();
      if (connection.domain !== 'GENERAL') {
        expect(connection.moduleHref).toMatch(/^\/(?!\/)/);
      }
    }
  });

  it('maps source-module aliases without exposing technical demo names', () => {
    expect(
      getDocumentRelationConnection(
        { sourceModule: 'sales-contracts' },
        'GENERAL',
      ).domain,
    ).toBe('SALES');
    expect(documentRelationSourceLabel(relation, 'CUSTOMER_IDENTITY')).toBe(
      'داده آزمایشیِ مشتریان و مسافران',
    );
    expect(
      documentRelationSourceLabel(relation, 'CUSTOMER_IDENTITY'),
    ).not.toContain('documents-demo');
    expect(documentRelationTypeLabel(relation.relationType)).toBe(
      'پرونده اصلی',
    );
  });

  it('builds an authenticated module link using only opaque Documents ids', () => {
    const href = createDocumentConnectionHref(
      getDocumentConnection('CUSTOMER_IDENTITY'),
      { documentId: 'document/id', relationId: relation.id },
    );

    expect(href).toBe(
      '/customers?from=documents&document=document%2Fid&relation=relation%2Fid+with+spaces',
    );
    expect(href).not.toContain(relation.sourceEntityIdMasked);
    expect(createDocumentConnectionHref(getDocumentConnection('GENERAL'))).toBe(
      null,
    );
  });
});
