export interface AccountingTaxpayerSeller {
  version: number;
  values: {
    fvwMain_lkpPartyType_ComboBox_Input: 'شخص' | 'شرکت' | 'مشارکت مدنی';
    fvwMain_txtNationalID: string;
    fvwMain_txtEconomicID: string;
    fvwMain_txtCivilParticipationID: string;
  };
}
