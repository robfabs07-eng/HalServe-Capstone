# Booking Demand Forecast: Boundary & Accuracy Audit Fixes

## 1. Guarantee: Core PA-WMA Formula Remains 100% Untouched

The **Pax-Adjusted Weighted Moving Average (PA-WMA)** formula in `calculateWeightedMonthlyDemandForecast` (`admin.js` lines `26854–26990`):
`Y_hat_m = round( sum(w_i * P_{i,m} * B_{i,m}) / sum(w_i * P_{i,m}) )`
and all predicted booking counts and monthly accuracy scores for **2023, 2024, 2025, and 2026** remain **100% unchanged**.

The fixes below strictly address **date-range boundaries and baseline-year handling** when stretching the filter window (e.g., typing `100` in Custom Range).

---

## 2. Identified Issues (Why Stretching to 100 Months Shows 82% & What Panelists Will Catch)

| # | Issue | Location in `admin.js` | Why It Happens & Why Panelists Flag It |
| :--- | :--- | :--- | :--- |
| **1** | **Pre-2022 Ghost Months (`2018–2021`) Show `100%` Accuracy** | `renderForecastAccuracyCard` (lines `30508–30616`) & `calcForecastAccuracy` (line `27009`) | Historical data starts in **Jan 2022**. Stretching Custom Range to `100` months generates buckets back to **June 2018**. For 2018–2021, `Actual = 0` and `Forecast = 0`. Because `calcForecastAccuracy(0, 0)` returns `100`, List Mode claims `100%` accuracy for 43 months before the system had data, while `totalAct += 0` and `totalErr += 0` keep Total Accuracy frozen at `82%` whether you enter `50`, `100`, or `999` months. |
| **2** | **2022 Baseline Year Data Leakage (`Forecast = Actual = 100%`)** | `getForecastDetailsForYearMonth` (lines `26910–26915`) & `renderForecastAccuracyCard` (lines `30661–30673`) | Because `2022` is the earliest recorded year, there are no prior years (`yr < 2022`) to forecast from (`pastYears.length === 0`). Line `26912` falls back to setting `forecast = countsByYear[2022][m]` (setting 2022's Forecast equal to 2022's Actual). When the range includes 2022, all 12 months of 2022 are treated as `0` error (`100%` accuracy) and added to `totalAct`, artificially inflating the multi-year Total Accuracy % to `82%`. |
| **3** | **Hardcoded Future Month Check (`m.year === 2026 && m.month >= 10`)** | `renderForecastAnnualBreakdownList` (line `27051`) & `renderForecastAccuracyCard` (lines `30590`, `30666`) | Future months are checked with `m.year === 2026 && m.month >= 10`. If a user or panelist navigates the anchor year to `2027`, `m.year === 2026` is `false`, so future months in 2027 are treated as completed past months with `0` bookings and penalized! |
| **4** | **Off-by-One Month Count in `getAdminMonthRangeKeys`** | `getAdminMonthRangeKeys` (lines `45853–45865`) | `const nBack = filter.rangeMonths === 1 ? 0 : filter.rangeMonths` loops from `i = nBack` down to `0` inclusive (`nBack + 1` months). Clicking **Last 6 Months** actually displays **7 months**, and **Last 12 Months** displays **13 months**. |

---

## 3. Step-by-Step Implementation Instructions (`admin.js`)

### Fix 1: Clamp Forecast Date Ranges to Start No Earlier Than January 2022 (or Earliest Recorded Year)
**Locations:**
* `renderForecastPastDataTable` (line `30434`)
* `renderForecastAccuracyCard` (line `30508`)

In `renderForecastAccuracyCard` (and `renderForecastPastDataTable`), filter the generated `months` array so it never includes unrecorded ghost months prior to **January 2022**:
```javascript
const rawMonths = getAdminMonthRangeKeys(filter);
const months = rawMonths.filter(m => m.year >= 2022);
```
* **Result:** Even if a panelist types `100` or `999` in Custom Range, the chart and table cleanly stop at **January 2022** (the beginning of recorded history) instead of plotting 2018–2021 with `0` actual and `100%` accuracy.

---

### Fix 2: Exclude the First Baseline Year (`2022`) from Being Treated as a 100%-Accurate Forecast
**Location:** `renderForecastAccuracyCard` (lines `30516–30673`)

1. **Identify Baseline Months (`m.year === 2022` or `pastYears.length === 0`):**
   * In **List Mode** (lines `30587–30616`), when `m.year === 2022` (the founding baseline year with no prior year to forecast from), render the row consistently with `renderForecastAnnualBreakdownList` (line `27056`):
     ```javascript
     if (m.year <= 2022) {
       rowsHtml += `
         <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
           <td style="padding:8px 12px; font-weight:700; color:var(--cream);">${m.fullLabel}</td>
           <td style="padding:8px 12px; color:var(--text-dim); font-style:italic;">&mdash; (Baseline)</td>
           <td style="padding:8px 12px; color:#2d8a4e; font-weight:700;">${act}</td>
           <td style="padding:8px 12px; color:var(--text-dim);">&mdash;</td>
           <td style="padding:8px 12px; color:var(--gold); font-size:11px; font-weight:700;">Baseline Year</td>
         </tr>`;
       return;
     }
     ```
2. **Exclude `2022` Baseline Months from `totalAct` and `totalErr` (lines `30661–30673`):**
   ```javascript
   let totalAct = 0;
   let totalErr = 0;
   months.forEach((mObj, i) => {
     const fc = projectedData[i];
     const act = actualData[i];
     const isBaseline = (mObj.year <= 2022);
     const isFuture = (mObj.year > 2026 || (mObj.year === 2026 && mObj.month >= 10)) && act === 0;
     if (isBaseline || isFuture) return;
     totalAct += act;
     totalErr += Math.abs(act - fc);
   });
   ```
   * **Result:** The **Total Accuracy %** stat box strictly measures true out-of-sample predictions (`2023–2026`) and is never artificially padded by `2022` baseline events.

---

### Fix 3: Fix Hardcoded Future Month Check Across All Forecast Views
**Locations:**
* `renderForecastAnnualBreakdownList` (line `27051`)
* `renderForecastAccuracyCard` (lines `30590` and `30666`)

Replace:
```javascript
const isFuture = (m.year === 2026 && m.month >= 10);
```
with:
```javascript
const isFuture = (m.year > 2026 || (m.year === 2026 && m.month >= 10)) && act === 0;
```
* **Result:** Any uncompleted future month in late `2026` or `2027+` is properly recognized as `(Upcoming)` and excluded from accuracy penalties.

---

### Fix 4: Fix Off-by-One Month Window Count in `getAdminMonthRangeKeys`
**Location:** `getAdminMonthRangeKeys` (line `45854`)

Replace:
```javascript
const nBack = Math.max(0, filter.rangeMonths === 1 ? 0 : (filter.rangeMonths || 12));
```
with:
```javascript
const nBack = Math.max(0, (filter.rangeMonths || 12) - 1);
```
* **Result:**
  * **This Month (`1`)** -> `nBack = 0` -> **1 month**
  * **Last 3 Months (`3`)** -> `nBack = 2` -> **3 months**
  * **Last 6 Months (`6`)** -> `nBack = 5` -> **6 months**
  * **Last 12 Months (`12`)** -> `nBack = 11` -> **12 months**
