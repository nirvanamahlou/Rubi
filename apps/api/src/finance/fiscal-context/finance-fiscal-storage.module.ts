import { Global, Module } from '@nestjs/common';
import { FinanceFiscalStorage } from './finance-fiscal-storage';

@Global()
@Module({ providers: [FinanceFiscalStorage], exports: [FinanceFiscalStorage] })
export class FinanceFiscalStorageModule {}
