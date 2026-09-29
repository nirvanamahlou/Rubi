import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  options: vi.fn(),
  readFile: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('../documents/api/client', () => ({
  documentsApi: { options: mocks.options, upload: mocks.upload },
}));
vi.mock('./contextual-hr-form', () => ({
  readHrAttachmentFile: mocks.readFile,
}));

import { uploadEmployeeDocumentToArchive } from './hr-documents-integration';

describe('HR Documents public API integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockResolvedValue(
      new File(['%PDF'], 'certificate.pdf', { type: 'application/pdf' }),
    );
    mocks.options.mockResolvedValue({
      data: {
        currentUserId: 'user-1',
        branches: [
          { id: 'branch-1', code: 'NIY', name: 'نیایش سیر' },
          { id: 'branch-2', code: 'JAH', name: 'جهان باستان' },
        ],
        documentTypes: [
          {
            id: 'type-hr',
            code: 'HR_DOCUMENT',
            name: 'اسناد منابع انسانی',
            domain: 'HUMAN_RESOURCES',
          },
        ],
        categories: [{ id: 'category-hr', code: 'HR', name: 'منابع انسانی' }],
        owners: [{ id: 'user-1', displayName: 'مدیر منابع انسانی' }],
      },
    });
    mocks.upload.mockResolvedValue({
      data: { id: 'document-1', archiveCode: 'DOC-1405-001' },
    });
  });

  it('uploads the selected file with an employee source reference', async () => {
    const result = await uploadEmployeeDocumentToArchive({
      employeeId: 'HR-1001',
      employeeName: 'سارا محمدی',
      branchName: 'نیایش سیر',
      title: 'گواهی طب کار',
      documentType: 'گواهی سلامت و طب کار',
      issuer: 'مرکز طب کار',
      confidentiality: 'خیلی محرمانه',
      validUntil: '2027-09-07',
      fileReference: 'hr-attachment://document-1|certificate.pdf',
    });
    expect(result).toEqual({ id: 'document-1', archiveCode: 'DOC-1405-001' });
    const form = mocks.upload.mock.calls[0]?.[0] as FormData;
    expect(form.get('documentTypeId')).toBe('type-hr');
    expect(form.get('branchId')).toBe('branch-1');
    expect(form.get('sourceModule')).toBe('HUMAN_RESOURCES');
    expect(form.get('sourceEntityType')).toBe('Employee');
    expect(form.get('sourceEntityId')).toBe('HR-1001');
    expect(form.get('confidentiality')).toBe('RESTRICTED');
    expect(form.get('file')).toBeInstanceOf(File);
  });
});
