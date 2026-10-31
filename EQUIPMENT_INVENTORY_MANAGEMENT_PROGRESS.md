# Equipment Inventory Management System (EIMS) - Comprehensive Progress Report
**Halden's Catering Services - System Architecture & Capstone Objective Alignment**
*Date: October 2026 | Document Status: Production Final*

---

## 1. Executive Summary & Capstone Objective Alignment

### Capstone Objective 1
> **"To incorporate an Equipment Inventory Management System for proper tracking and handling of equipment. To develop an equipment inventory management system for Halden's Catering Services that enables real-time tracking of equipment availability, condition, and usage, while recording damages and associated costs to ensure that all required resources are properly monitored, maintained, and allocated for upcoming events. The system also aims to support proper equipment allocation per reservation, as well as showing resupply needs and maintenance assessment."**

### Architectural Realization
Prior to this enhancement, equipment items were monitored solely through aggregate quantity buckets (e.g., "150 Monoblock Chairs"). This aggregate model prevented the business from answering crucial operational questions:
- *Which specific chair broke?*
- *When was this specific unit purchased and from which vendor?*
- *How many times has this individual unit undergone maintenance?*
- *Is this individual unit eligible for retirement or has it gone missing?*

Through the current implementation, Halden's Catering Services now operates on a **Dual-Tier Asset Tracking Engine**:
1. **Parent Aggregate Tier (`equipment_inventory`)**: Maintains macro totals, catalog specifications, replacement costs, storage locations, and category groupings.
2. **Child Unit Serialization Tier (`equipment_units`)**: Assigns immutable unique unit serial identifiers (`EQ-XXXX-YYY`), tracking individual lifecycle state, purchase history, condition, and inspection logs.

---

## 2. Dual-Tier Data Architecture & Database Model

```
+-------------------------------------------------------------------------------+
|                       equipment_inventory (Parent Asset)                      |
+-------------------------------------------------------------------------------+
| id: EQ-0008                                                                   |
| item_name: "Rectangular Table"                                                |
| tracking_type: "individual"                                                   |
| quantity: 37 (total recorded lifetime inventory)                              |
| good_quantity: 30 (actively available for reservations)                       |
| needs_maintenance_quantity: 2 (under routine assessment / repair pipeline)    |
| broken_quantity: 0 (transferred to maintenance pipeline)                      |
| missing_quantity: 1 (reported missing during event or audit)                 |
| retired_quantity: 4 (permanently decommissioned / archived)                   |
+---------------------------------------+---------------------------------------+
                                        | 1-to-Many
                                        v
+-------------------------------------------------------------------------------+
|                         equipment_units (Child Units)                         |
+-------------------------------------------------------------------------------+
| unit_id: EQ-0008-001  | condition: retired     | supplier: Divisoria          |
| unit_id: EQ-0008-002  | condition: in_service  | supplier: Standard Supplier  |
| unit_id: EQ-0008-003  | condition: maintenance | supplier: Standard Supplier  |
| ...                   | ...                    | ...                          |
| unit_id: EQ-0008-037  | condition: in_service  | supplier: Standard Supplier  |
+-------------------------------------------------------------------------------+
```

### Tracking Type Stratification
The system enforces strict operational differentiation between high-value capital assets and bulk consumables:
- **Individual-Based Tracking (`tracking_type = 'individual'`)**:
  - Applicable to: Rectangular Tables, Round Banquet Tables, Tiffany Chairs, Monoblock Chairs, Major Chafing Dishes, High-Value Décor.
  - Generates dedicated serial identifiers (`EQ-XXXX-YYY`) with individual QR codes.
  - Tracks individual purchase dates, unique supplier origins, incident history, and repair counts.
  - Prohibits batch splitting (`+ Add Incident` is hidden; quantities are strictly locked to 1 per unit).
- **Quantity-Based Tracking (`tracking_type = 'quantity'`)**:
  - Applicable to: Glassware (wine glasses, water goblets), Flatware (spoons, forks), Linens (napkins, table runners).
  - Tracked as pooled quantities with aggregate condition counters.
  - Supports batch splitting and pooled incident deductions.

---

## 3. Core Modules & Implementation Highlights

### 3.1 QR Scanner & Scan Area (`scan.html`)
- **Unit Scan Isolation**: Scanning an individual unit QR code (`scan.html?unit_id=EQ-0008-001`) displays the exact metrics for that specific unit (Quantity: 1, Unit Condition: Retired/Good/Maintenance, Unit Purchase Date, and Single-Unit Purchase History).
- **Parent Scan Aggregation**: Scanning the parent QR code (`scan.html?id=EQ-0008`) displays the master asset summary (30 Available, 2 In Maintenance, 1 Missing, 4 Retired, 37 Total).
- **Condition Matching**: Elimination of condition mismatch discrepancies. A unit with condition "Needs Maintenance" never renders under "Good".
- **Dynamic Realtime Updates**: Incident reports filed in the scan area immediately reflect in the scan area UI without requiring hard page refreshes.

### 3.2 Routine Checking & Active Inspection Staging
- **Staging Pipeline (Zero Premature Commits)**:
  - Inspections conducted in `scan.html` or the Routine Checking tab are staged into active inspection memory (`_activeInspectionDraft`).
  - Condition changes do **not** write prematurely to `equipment_inventory` until the administrator explicitly clicks **"Submit & Log Check"**.
  - Prevents half-completed audits or accidental taps from corrupting production asset counts.
- **Specific Unit Identifier Recording**:
  - When inspecting individual-based equipment, the system records the exact `unit_id` (e.g., `EQ-0008-003`) instead of generic integer quantities.
- **Exclusion of Decommissioned Units**:
  - Units marked as `missing` or `retired` are automatically excluded from Routine Checking inspection dropdowns and QR checklists.

### 3.3 Equipment Assets Table (`admin.html` & `admin.js`)
- **Instant Reactive Updates**: Modifying a unit's status in any modal or inspection immediately triggers `renderEquipment()`, refreshing the main asset table in real-time.
- **Discrepancy Elimination**:
  - Ensured mathematical equality across all views:
    $$\text{Total Quantity} = \text{Good} + \text{Maintenance} + \text{Broken} + \text{Missing} + \text{Retired}$$
  - Supplier names reflect genuine database values (preventing "Divisoria" from erroneously overwriting "Standard Supplier").
- **Tracking Mode Persistence**: Fixed tracking dropdown saves in the Edit Equipment modal so administrators can toggle between Individual and Quantity tracking seamlessly.

### 3.4 Equipment Maintenance Pipeline & Lifecycle State Machine
- **Preservation of Unit IDs Across Transitions**:
  - `sendToRepair`: Transitions unit from `broken` to `in_repair` while preserving `EQ-XXXX-YYY`.
  - `returnToService`: Transitions unit back to `in_service` (incrementing parent `good_quantity` and decrementing `needs_maintenance_quantity`).
  - `retireMaintenanceEquipment`: Transitions unit to `retired` (incrementing parent `retired_quantity`, decrementing `needs_maintenance_quantity`, and logging to Archived Retired Equipment).
  - `markMaintenanceEquipmentMissing`: Transitions unit to `missing` with audit logging.
- **Resupply Module Synchronization**:
  - Resupply recommendations read real unit retirements and loss counts directly from `equipment_inventory` and `equipment_maintenance`.
  - Displays actual unit IDs with quantity 1 rather than simulated placeholders.

### 3.5 Immutable Equipment Activity Logs (`equipment_activity_logs`)
- Every lifecycle event across all six equipment tabs automatically records an immutable audit entry:
  - **Action Types**: `ROUTINE_CHECK`, `INCIDENT_REPORT`, `REPAIR_DISPATCHED`, `RETURNED_TO_SERVICE`, `UNIT_RETIRED`, `UNIT_MISSING`, `STOCK_ADDED`, `TRACKING_CHANGED`.
  - **Recorded Fields**: `asset_id`, `unit_id`, `action`, `details`, `logged_by`, `timestamp`.
  - Guarantees complete non-repudiation during capstone demonstration.

---

## 4. Discrepancy Resolution Matrix

| Discrepancy Identified | Root Cause | Technical Resolution Implemented |
| :--- | :--- | :--- |
| **Main table showed 27 available while Scan showed 30** | Stale local cache in `scan.html` read out-of-sync Supabase row; parent `good_quantity` had not been recalculated following child unit retirement. | Created database synchronization script `sync_all_equipment.sql` and implemented bi-directional parent-child cache synchronization in `syncParentFromUnits()`. |
| **Retired unit EQ-0008-001 showed as "Broken" in Equipment Assets** | Unit condition was updated in `equipment_units` but parent asset was not updated, and maintenance table lacked matching foreign key row. | Integrated `equipment_maintenance` query into `renderEquipmentHistory()`; synchronized unit status to `retired` across all tables. |
| **Individual equipment displayed Split button** | Split logic did not check `tracking_type === 'individual'`. | Added strict guard in `admin.js`: `if (eq.tracking_type === 'individual') return;` disabling Split for serial units. |
| **Incident reports displayed fake 001 unit IDs** | Fallback code defaulted to `${assetId}-001` when `unit_id` was empty. | Modified all incident ingestion pipelines to capture and enforce authentic `unit_id` from inspection forms. |
| **Routine checks committed immediately without final confirmation** | Direct Supabase `.update()` was invoked on form input. | Re-routed Routine Checking in `scan.html` to append to `activeInspectionDraft` in memory; persisted only upon "Submit & Log Check". |

---

## 5. Capstone Defense & Panelist Alignment

### Defense Strategy: Questions & Answers for Panelists

#### Q1: "Why do you have two tables (equipment_inventory and equipment_units) instead of just one?"
> **Answer**: "Halden's Catering manages two distinct classes of equipment. High-value equipment (such as chafing dishes, tables, and Tiffany chairs) requires individual serial tracking for maintenance cycles, supplier warranty claims, and loss prevention. In contrast, bulk items (such as teaspoons or wine glasses) would incur unacceptable administrative overhead if serialized individually. The dual-tier architecture provides unit-level granularity for high-value assets while allowing bulk quantity management for low-value dinnerware, fully fulfilling Capstone Objective 1."

#### Q2: "What happens when an equipment unit is retired or lost? Can that ID be reused?"
> **Answer**: "No. In accordance with enterprise asset management standards, unit serial IDs are immutable and permanent. If `EQ-0008-001` is retired or lost, that identifier is archived forever in `equipment_maintenance` and `equipment_activity_logs`. The counter continues sequentially (e.g., `EQ-0008-038`), guaranteeing that historical audit logs and incident records remain tamper-proof and traceable."

#### Q3: "How does the system ensure that data in the QR scan area matches the admin dashboard?"
> **Answer**: "Both modules interface with the same Supabase relational database and execute synchronized state logic. Whenever a unit changes condition (e.g., from Good to Needs Maintenance), the system atomically updates the child record in `equipment_units`, recomputes the parent counts in `equipment_inventory`, logs the event in `equipment_activity_logs`, and refreshes the reactive UI cache."

---

## 6. Verification & Validation Summary

- **Syntax & Compilation**: Verified zero syntax errors via `node -c admin.js` and `node -c equipment_unit_tracker.js`.
- **Character Encoding**: 100% UTF-8 compliant. Zero mojibake or distorted currency/checkmark glyphs.
- **Design Standards**: Adheres strictly to the project UI guidelines (zero emoticons, zero colored pill backgrounds, clean high-contrast dark theme styling).
