import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor, MasterDataRecord } from '@nora/contracts';

import {
  DocumentsService,
  type DocumentRequestMetadata,
  type UploadedDocumentFile,
} from '../documents/documents.service';
import { MasterDataService } from './master-data.service';

const logoResources = new Set([
  'banks',
  'insurers',
  'airlines',
  'rail-companies',
  'bus-companies',
  'hotels',
  'hotel-chains',
  'organizations',
  'suppliers',
  'brokers',
]);

export interface MasterDataLogoMutationResult {
  data: MasterDataRecord;
  warning?: string;
}

@Injectable()
export class MasterDataLogoService {
  constructor(
    @Inject(MasterDataService)
    private readonly masterData: MasterDataService,
    @Inject(DocumentsService)
    private readonly documents: DocumentsService,
  ) {}

  private async current(resourceValue: string, id: string, version: number) {
    const resource = this.masterData.resource(resourceValue);
    if (!logoResources.has(resource))
      throw new ConflictException('این بخش فیلد لوگو ندارد.');
    const current = await this.masterData.detail(resource, id);
    if (current.data.version !== version)
      throw new ConflictException({
        code: 'CONCURRENT_MODIFICATION',
        message: 'رکورد هم‌زمان تغییر کرده است؛ صفحه را تازه کنید.',
      });
    return { resource, record: current.data };
  }

  async replace(
    resourceValue: string,
    id: string,
    input: { title: string; version: number },
    file: UploadedDocumentFile | undefined,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
    requestedBranch?: string,
  ): Promise<MasterDataLogoMutationResult> {
    const { resource, record } = await this.current(
      resourceValue,
      id,
      input.version,
    );
    const previousLogo = String(
      record.attributes.logoFileReference ?? '',
    ).trim();
    const uploaded = await this.documents.uploadMasterDataLogo(
      {
        ...(requestedBranch ? { branchId: requestedBranch } : {}),
        resource,
        recordId: record.id,
        title: input.title,
      },
      file,
      actor,
      metadata,
    );

    let attached: MasterDataLogoMutationResult;
    try {
      attached = await this.masterData.update(
        resource,
        record.id,
        { logoFileReference: uploaded.id },
        record.version,
        actor,
        requestedBranch,
      );
    } catch (error) {
      if (!uploaded.reused)
        await this.documents
          .archiveMasterDataLogo(
            {
              documentId: uploaded.id,
              resource,
              recordId: record.id,
            },
            actor,
            metadata,
          )
          .catch(() => undefined);
      throw error;
    }

    if (!previousLogo || previousLogo === uploaded.id) return attached;
    try {
      await this.documents.archiveMasterDataLogo(
        { documentId: previousLogo, resource, recordId: record.id },
        actor,
        metadata,
      );
      return attached;
    } catch (error) {
      return {
        ...attached,
        warning: `لوگوی جدید ثبت شد، اما بایگانی لوگوی قبلی نیازمند اقدام مجدد است: ${
          error instanceof Error ? error.message : 'خطای نامشخص'
        }`,
      };
    }
  }

  async remove(
    resourceValue: string,
    id: string,
    version: number,
    actor: AuthenticatedActor,
    metadata: DocumentRequestMetadata,
    requestedBranch?: string,
  ): Promise<MasterDataLogoMutationResult> {
    const { resource, record } = await this.current(resourceValue, id, version);
    const previousLogo = String(
      record.attributes.logoFileReference ?? '',
    ).trim();
    if (!previousLogo) return { data: record };

    const detached = await this.masterData.update(
      resource,
      record.id,
      { logoFileReference: null },
      record.version,
      actor,
      requestedBranch,
    );
    try {
      await this.documents.archiveMasterDataLogo(
        { documentId: previousLogo, resource, recordId: record.id },
        actor,
        metadata,
      );
      return detached;
    } catch (error) {
      return {
        ...detached,
        warning: `لوگو از رکورد جدا شد، اما بایگانی فایل نیازمند اقدام مجدد است: ${
          error instanceof Error ? error.message : 'خطای نامشخص'
        }`,
      };
    }
  }
}
