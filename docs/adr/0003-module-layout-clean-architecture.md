# Each API capability is a Nest module with domain, application, infrastructure and presentation layers

`apps/api/src/<capability>/` holds one capability (sales, cash-closes, inventory, …). Inside it, `domain/` has pure business rules (no Nest, no database), `application/` has the use-case service and the repository it depends on (an abstract class), `infrastructure/` has the Drizzle repository, and `presentation/` has the thin controller and its DTOs. Controllers only validate (DTOs, `uuidPipe`) and delegate. Transactions go through `UnitOfWork`, and every audited change writes the activity log through `ActivityLog` in the same transaction. Roles and `:branchId` access are enforced only by `AccessGuard`. The earlier controller-with-raw-SQL layout made rules untestable without a database and repeated transaction and validation code in every file.

## Consequences

- Business rules (business day, pricing a sale, voiding, cash reconciliation, stock movements, report windows) have unit tests that need no database; integration tests cover the HTTP behaviour.
- `domain/` throws plain `DomainError(kind, message)` (`shared/domain-error.ts`) and never imports Nest. Application services call domain rules through `asHttp(() => rule(...))`, which maps the error to the matching Nest exception, and throw Nest exceptions directly for their own checks.
- Repositories read the tables they need, including other capabilities' tables (e.g. sales reads `cash_closes`). This is a modular monolith over one database; there are no cross-module service calls.
