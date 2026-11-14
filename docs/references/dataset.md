# Challenge dataset (S-Pankki, synthetic)

> Where the dataset lives, its schema, what the values look like, and the traps when using it.

**Last verified:** 2026-11-14

## Getting it
- Source: <https://github.com/hackjunction/Junction-2026-S-pankki>. Local copy goes in `data/raw/` (gitignored, never committed; see the data-location decision).
- `tx_junction_transactions.csv` is a Git LFS file. "Download ZIP" may give a 134-byte pointer starting with `version https://git-lfs...` instead of the data. Direct download that works:
  `curl -L -o data/raw/tx_junction_transactions.csv https://media.githubusercontent.com/media/hackjunction/Junction-2026-S-pankki/main/tx_junction_transactions.csv`
- Check: 362,796,501 bytes, SHA-256 `49b3265d8e44e751de305a074dcffcda732bb79aa1e07b46fcca774ce76f1e63`.
- All CSVs start with a UTF-8 BOM: read with `encoding="utf-8-sig"` or the first column name gets a stray character.
- Browser downloads saved as `name (1).csv` got their names shuffled once in this project. Identify files by header, not by name.

| File | Size | Rows | Contents |
|---|---|---|---|
| `tx_junction_transactions.csv` | 346 MB | 3,626,755 | All transactions |
| `tx_customers_junction.csv` | 100 KB | 5,100 | Customer age and postal code |
| `mtg_negotiation_history.csv` | 640 KB | 3,452 | Mortgage application events, 200 applicants |
| `mtg_tx_customer_link_and_final_mtg_infio.csv` | 18 KB | 200 | Mortgage applicant → `customer_id`, final outcome |

## Transactions
Columns: `customer_id`, `bank_account_id`, `tx_date` (YYYY-MM-DD), `tx_timestamp` (`03OCT24:09:04:04`), `category`, `tx_amount_eur` (negative = money out), `balance_after_eur`, `transaction_type`, `merchant_id`, `mcc_code`.

- 5,100 customers, **exactly one account each** (`CUST00001` ↔ `ACC000001` style), no shared accounts.
- Period **2024-10-01 to 2026-09-30** (24 full months). Every customer is active every month, ~150k transactions per month.
- 148–1,543 transactions per customer (median 700). No exact duplicate rows.
- `tx_timestamp`'s date always equals `tx_date`. Purchases happen 05:00–23:59 only, peaking 15–18.
- `balance_after_eur` is a running balance: previous balance + amount = new balance for all but 177 of 3.6 M rows (ordering by timestamp). 3,526 accounts go negative at some point (89k rows).
- Median customer-month: 3,210 € in, 2,928 € out.

### Categories and transaction types
Every category maps to one transaction type, except `purchase`, which covers eight categories.

| transaction_type | category | Rows | Median € | Pattern per customer |
|---|---|---|---|---|
| `purchase` | Groceries, Restaurants, Transportation, Entertainment, Health, Home & Tech, Lifestyle, Travel | 3,000,711 | −47 | ~25 per month on ~15 days |
| `utilities_payment` | Utilities | 342,728 | −50 | ~3 per month, amounts vary (CV 0.39), no merchant |
| `salary` | Salary | 121,725 | +3,164 | 1 per month; 79% on the 15th, the rest around month-end; amount stable (CV 0.08) |
| `housing_payment` | Housing | 112,903 | −1,037 | 1 per month, near-fixed amount (CV 0.03) and day (sd 2.3 days), no merchant |
| `investment_deposit` | Invest Deposit | 35,668 | −296 | 1 per month, 1,500 customers |
| `other_income` | Other Income | 6,299 | +2,081 | occasional, 2,401 customers |
| `salary_sweep` | Salary Sweep | 6,189 | −3,877 | 264 customers; 98.5% within 3 days after a salary. Looks like salary moved to another account/bank (relevant to the PSD2 multi-bank angle) |
| `investment_withdrawal` | Invest Withdraw | 532 | +1,341 | rare, 435 customers |

Purchase amounts by category (€, p50 / p90 / p99): Restaurants 23 / 91 / 251, Entertainment 35 / 134 / 370, Transportation 41 / 70 / 109, Health 54 / 202 / 559, Groceries 64 / 110 / 167, Lifestyle 103 / 486 / 1,390, Home & Tech 111 / 517 / 1,592, Travel 130 / 567 / 1,698.
Purchases of 500 € or more (one-off cost candidates) are mostly Home & Tech (12.1k), Lifestyle (10.6k), Travel (7.9k) and Health (2.0k). The maximum is ~31k €.

### Merchants and MCC codes
- 515 merchants, 36 MCC codes. A merchant ID encodes its category (`MRC-GRO-0032`, `MRC-RES-…`, `MRC-TRN-…`). Each MCC belongs to exactly one category. There are **no merchant names**.
- `merchant_id` and `mcc_code` are both empty on 21.7% of rows: all non-purchase rows, plus ~160k purchases (75k of them Transportation).

| Category | MCC codes | Merchants |
|---|---|---|
| Groceries | 5411 5422 5451 5499 | 80 |
| Restaurants | 5812 5813 5814 | 90 |
| Transportation | 4111 4121 5541 5542 7523 | 65 |
| Entertainment | 7832 7922 7991 7996 7999 | 55 |
| Health | 5912 8011 8021 8099 | 55 |
| Home & Tech | 5200 5251 5712 5732 5734 | 60 |
| Lifestyle | 5651 5691 5941 5942 5945 5999 | 65 |
| Travel | 4511 4722 7011 7512 | 45 |

MCC 4121 is taxis/limousines, the brief's "taxis" example; most Transportation is fuel (5541/5542), parking (7523) and commuter transport (4111).

## Customers
- 5,100 rows, one per `customer_id`. Every customer has transactions and every transaction has a customer.
- Age 18–90, median 44. Bands: <20: 182, 20s: 535, 30s: 976, 40s: 2,096, 50s: 946, 60+: 365.
- Postal code: 290 distinct values, all starting with `00`, `01` or `02` (Helsinki capital region: Helsinki, Vantaa, Espoo). Keep codes as strings: leading zeros matter.

## Mortgages
- `mtg_tx_customer_link_and_final_mtg_infio.csv`: 200 applicants (`C0004` style) linked to `customer_id`. 150 approved, 50 rejected (reasons: insufficient_collateral, insufficient_income, insufficient_equity, existing_debt). Columns include final property price, requested loan, equity, collateral value, required monthly income, and the misspelled `lfinal_loan_to_value`.
- `mtg_negotiation_history.csv`: 3,452 events (2026), 12 event types (customer_contact, expense_recorded, property_added, collateral_valuation, loan_decision, …), with free-text `note`s. Property types: apartment, terraced_house, detached_house. Expense types: valuation_fee, renovation, existing_loan, transfer_tax, maintenance_fee, bank_fee.
- `decision` and `loan_amount` are **carried forward** onto later events once set (256 "approved" values for 200 decisions), so take the outcome from the `loan_decision` event or the link file.

## Traps
- **Sort by parsed time, never by `tx_timestamp` text**: `01APR26` sorts before `01AUG25`. Parse with `%d%b%y:%H:%M:%S`, or sort by `tx_date` then time.
- **The data ends 2026-09-30.** Relative questions ("last month", "this week") need a fixed reference date, otherwise they hit months with no data.
- Amounts are signed; categories never mix signs (income categories are always positive, spending always negative).
- Profiling: the full CSV fits in DuckDB in memory in a few seconds (`read_csv` with explicit `VARCHAR` types for IDs and postal codes).
- **Salary-sweep customers look like almost-non-spenders.** The 264 customers with `salary_sweep` move most of each salary to another account within days, so only ~11% of their income shows up as spending (median 474 €/month vs 2,875 € for the other 4,836). Their low spending, restaurant shares and negative-balance rates are not comparable to other customers: exclude them when picking typical profiles or computing benchmarks, or label them as "partial view" in the UI.
