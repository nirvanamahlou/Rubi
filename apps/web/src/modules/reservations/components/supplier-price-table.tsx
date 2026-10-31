import type { ReservationFormIntake } from '../model/reservation-form';
import { supplierPriceTableData } from '../model/supplier-form-prices';
import styles from './reservation-form-sheet.module.css';
export function SupplierPriceTable({
  intake,
}: {
  intake: ReservationFormIntake;
}) {
  const data = supplierPriceTableData(intake);
  return (
    <>
      <div className={styles.heading}>
        <b>06</b>
        <strong>PRICES</strong>
        <span>Supplier quotation</span>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            {data.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((value, index) => (
                <td key={index} dir="ltr">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
