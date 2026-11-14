import englishCatalog from './en-catalog.json';
import accountingDocuments from './en-accounting-documents.json';
import accountingPageKpis from './en-accounting-page-kpis.json';
import integrations from './en-integrations.json';
import siteCommerce from './en-site-commerce.json';
import englishOverrides from './en-overrides.json';
import noraContracts from './en-nora-contract-evidence.json';
export function mergeEnglishUiCatalog(): Readonly<Record<string, string>> {
  return {
    ...englishCatalog,
    ...accountingDocuments,
    ...accountingPageKpis,
    ...integrations,
    ...noraContracts,
    ...siteCommerce,
    ...englishOverrides,
  };
}
