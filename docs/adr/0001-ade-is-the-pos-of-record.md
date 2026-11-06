# ADE is the point of sale, and every dashboard figure is derived from sales

Tigers café records every sale through ADE's own POS (cashiers log in and ring up sales), rather than importing from a third-party POS or having managers type in daily totals. Dashboard figures such as today, week, month-to-date, best-sellers, customers, growth and expected cash are computed from sale lines at query time and are never stored as columns. Only the sale-level data supports voids, best-sellers, ticket counts and cash-close reconciliation. At three branches the data volume is too small to need pre-computed totals.

## Consequences

- ADE does not claim BIR compliance (CAS/POS accreditation, official receipts). This must be confirmed with Tigers' accountant before ADE is used at the counter, and the outcome could reopen this decision in favour of importing from a registered POS.
- There is no offline mode in v1, so a branch cannot record sales while its internet is down.
- The server sets every price. The POS sends product IDs and quantities, and the API copies the current price and cost onto each sale line.
