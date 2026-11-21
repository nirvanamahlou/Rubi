# CUSTOMER-DETAIL-TITLE-1121

The title picker of the eight-digit individual-customer detail type lists active person customers in the ledger branch. Its plus action opens the compact version of the native person dialog. It collects the person code, salutation, first name, last name, national ID, birth date and telephone. The salutation options are آقا and خانم and are saved consistently with the native gender field.

Save and select returns the authorized Customer record to the title picker. The Accounting command verifies the branch and active person-customer role and uses the Customer display name. The detail keeps its native Customer foreign key. The existing number allocator issues the separate series-four detail code upon saving the accounting detail. Person codes use the existing manual entry path with leading zeros. Identity and telephone follow the existing protected person API.

Historical unlinked records can keep their original titles. This unit uses the current schema and the existing personal, corporate, and bank flows.

Verification: 25 Web tests and 15 API tests passed, including a PostgreSQL case for native customer creation and readback, protected links, number issuance and rejection of passenger-only references. Scoped lint passed.
