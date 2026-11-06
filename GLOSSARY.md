# Tigers ADE

The Access Data Environment for Tigers café: the point of sale and the shared view of sales, stock, spending and staff across all Tigers branches. Tigers café is the only business it serves.

## People and access

**Owner**:
The person who runs all of Tigers café and can see and act on every branch.
_Avoid_: Admin, executive

**Branch manager**:
A person responsible for one branch, who sees and acts on that branch only.
_Avoid_: Manager (alone), store manager

**Cashier**:
A user who records and voids sales at their own branch and does not see the dashboard.
_Avoid_: POS user, teller

**User**:
Anyone who can log in to ADE. Each user has one role (owner, branch manager or cashier) and a set of branches they are allowed to see.
_Avoid_: Account, login

**Staff member**:
A person who works at a branch, with a position (barista, cashier, branch manager) and a default shift. A staff member does not have to be a user, and a user (like the owner) does not have to be a staff member.
_Avoid_: Employee, crew

**Position**:
A staff member's job at the branch. It is not the same as a user's role: a position says what someone does, a role says what they can access.
_Avoid_: Job title, role (when you mean position)

## Branches and time

**Branch**:
One physical Tigers café location (Main, Annex, Pacol).
_Avoid_: Store, outlet, shop

**Business day**:
The trading day a sale belongs to, in Philippine time. It runs from one day cutoff to the next, not from midnight to midnight.
_Avoid_: Date, day (alone)

**Day cutoff**:
The time of day when one business day ends and the next one begins.
_Avoid_: Closing time, reset time

**Daily target**:
The sales amount a branch aims to reach in one business day.
_Avoid_: Goal, quota

## Selling

**Sale**:
One completed checkout at a branch, made up of one or more sale lines and paid with one payment method. The dashboard's figures (today, week, month-to-date, best-sellers) are all totals of sales that are not voided.
_Avoid_: Order, transaction, receipt

**Sale number**:
A branch's running count of its sales. It never resets and never skips a number.
_Avoid_: Receipt number, OR number

**Sale line**:
One product on a sale, with the quantity and the name, price and cost the product had at the moment of sale.
_Avoid_: Item, order line

**Payment method**:
How a sale was paid: cash, GCash, Maya or card.
_Avoid_: Tender, payment type

**Void**:
Cancelling a whole sale, with a reason. A voided sale stays on record but counts toward no totals. There is no partial void and no editing of a sale.
_Avoid_: Refund, delete, cancel

**Customers**:
The number of sales a branch made in a period, voided sales excluded. It counts checkouts, not distinct people.
_Avoid_: Visitors, foot traffic

**Growth**:
Month-to-date sales compared with sales over the same number of business days last month.
_Avoid_: Trend, change

## Products

**Product**:
Something a branch sells, with one price that is the same at every branch. Size and milk variations are separate products.
_Avoid_: Menu item, SKU

**Unit cost**:
What one unit of a product costs Tigers to make, entered by the owner.
_Avoid_: COGS, cost price

**Margin**:
The share of a product's price left after its unit cost: (price − unit cost) ÷ price.
_Avoid_: Profit, markup

## Stock

**Inventory item**:
An ingredient or supply a branch keeps in stock, such as espresso beans, oat milk or paper cups. It is not something a branch sells.
_Avoid_: Product, stock item, ingredient (alone)

**Par level**:
The minimum quantity of an inventory item a branch wants on hand. Below it, the item counts as low stock.
_Avoid_: Reorder point, minimum

**Stock movement**:
One recorded change in a branch's quantity of an inventory item: received, wastage, adjustment or count. A branch's stock on hand is the total of its stock movements. Sales do not create stock movements.
_Avoid_: Stock adjustment (for all movements), transaction

**Inventory value**:
What a branch's stock on hand is worth: each inventory item's quantity on hand times that item's current cost.
_Avoid_: Stock value, inventory worth

**Reorder request**:
A branch's request for more of an inventory item. Marking it received records a received stock movement.
_Avoid_: Purchase order, PO

## Money out and day end

**Expense**:
One amount a branch spent on one business day, in one expense category.
_Avoid_: Cost, spend

**Expense category**:
An expense type. Starts with ingredients and supplies, payroll, rent, utilities and other; the owner can add and rename categories.
_Avoid_: Expense type

**Cash close**:
A branch's end-of-business-day count of the cash drawer. Once submitted it cannot change, and no more sales or voids can be recorded for that business day. It may be submitted at any time once the day has started.
_Avoid_: EOD, Z-reading, closing

**Opening float**:
The cash in a branch's drawer at the start of a business day.
_Avoid_: Starting cash, change fund

**Expected cash**:
The opening float plus the business day's cash sales (voided sales excluded).
_Avoid_: System cash, book cash

**Cash variance**:
Counted cash minus expected cash.
_Avoid_: Discrepancy, over/short

**Operating contribution**:
Month-to-date sales minus month-to-date expenses.
_Avoid_: Profit, net income

## Oversight

**Activity log**:
The record of who changed what and when, for price and product changes, voids, stock movements, inventory items and par levels, reorder requests, cash closes, expenses, users and changes to targets or cutoffs. Entries are never edited or removed.
_Avoid_: Audit trail, history
