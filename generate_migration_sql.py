import csv
import json
import os
import glob

existing_ids_path = r"c:\Users\Admin\Desktop\SMARTSERVE\existing_new_reservation_ids.txt"
output_sql_path = r"c:\Users\Admin\Desktop\SMARTSERVE\insert_missing_reservations.sql"

# Load existing IDs
with open(existing_ids_path, "r", encoding="utf-8") as f:
    existing_ids = set(line.strip().lower() for line in f if line.strip())

int_cols = {
    "pax", "settlement_amount", "downpayment_amount", "initial_fee", "venue_surcharge",
    "price_per_head", "out_of_town_charge", "outoftowncharge", "service_charge_pct",
    "base_price", "final_payment_amount", "exec_charges_amount_paid", "exec_charges_change",
    "exec_extra_overhead_units", "exec_overtime_units", "exec_floor_access_units",
    "final_received", "final_change", "downpayment_remaining", "final_remaining",
    "initial_fee_remaining", "additional_charges_remaining", "initial_fee_received",
    "additional_charges_received", "additional_items_charge"
}

float_cols = {
    "exec_incident_charges", "exec_extra_overhead_amount", "exec_overtime_amount",
    "exec_floor_access_amount", "exec_total_charges", "exec_tip", "exec_transport_driver_amount",
    "exec_rentals_amount", "exec_staff_expense_amount", "exec_dishes_ingredients_expense",
    "exec_consumables_amount", "exec_total_expenses", "exec_total_revenue", "exec_net_profit"
}

bool_cols = {
    "settled", "initial_fee_paid", "cancellation_requested", "is_locked",
    "downpayment_paid", "final_paid", "isVIP"
}

json_cols = {
    "vip", "meeting_times", "staff", "seating_layout", "execution_plan", "food_tasted",
    "rundown_data", "design_selections", "customer_equipment", "execution_agenda",
    "package_items", "activity_logs", "staffing", "hired_personnel", "logistics_milestones",
    "timeline_tasks", "final_rundown", "price_tiers", "contract_urls", "exec_personnel_breakdown",
    "exec_consumables_returned", "payment_history", "downpayment_history", "final_history",
    "initial_fee_history", "additional_charges_history", "additional_items", "custom_items",
    "items", "proposed_meeting_times", "proposedMeetingTimes", "packageItems", "venue_coords",
    "admin_location", "admin_route"
}

def format_val(col, val):
    if val is None or val == "" or (isinstance(val, str) and val.strip().lower() == "null"):
        return "NULL"
    
    if isinstance(val, (dict, list)):
        clean_json = json.dumps(val).replace("'", "''")
        return f"'{clean_json}'::jsonb"

    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"

    val_strip = str(val).strip()

    if col in bool_cols:
        if val_strip.lower() in ("true", "t", "1"):
            return "TRUE"
        if val_strip.lower() in ("false", "f", "0"):
            return "FALSE"
        return "NULL"

    if col in int_cols:
        try:
            return str(int(float(val_strip)))
        except ValueError:
            return "NULL"

    if col in float_cols:
        try:
            return str(float(val_strip))
        except ValueError:
            return "NULL"

    if col in json_cols or val_strip.startswith("{") or val_strip.startswith("["):
        try:
            parsed = json.loads(val_strip)
            clean_json = json.dumps(parsed).replace("'", "''")
            return f"'{clean_json}'::jsonb"
        except Exception:
            escaped = val_strip.replace("'", "''")
            return f"'{escaped}'::jsonb"

    escaped = val_strip.replace("'", "''")
    return f"'{escaped}'"

all_records = {} # map id -> dict

# 1. Check for reservations.json
json_path = r"c:\Users\Admin\Desktop\SMARTSERVE\reservations.json"
if os.path.exists(json_path):
    try:
        with open(json_path, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)
            if isinstance(data, list):
                for r in data:
                    if isinstance(r, dict) and "id" in r:
                        all_records[r["id"].lower()] = r
            elif isinstance(data, dict):
                # could be wrapped like {"data": [...]} or single row with json_agg
                for k, v in data.items():
                    if isinstance(v, list):
                        for r in v:
                            if isinstance(r, dict) and "id" in r:
                                all_records[r["id"].lower()] = r
        print(f"Loaded {len(all_records)} records from reservations.json")
    except Exception as e:
        print("Error reading reservations.json:", e)

# 2. Check all reservations*.csv files
csv_files = glob.glob(r"c:\Users\Admin\Desktop\SMARTSERVE\reservations*.csv")
for cf in csv_files:
    try:
        with open(cf, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                res_id = (row.get("id") or "").strip().lower()
                if res_id:
                    all_records[res_id] = row
                    count += 1
            print(f"Loaded {count} rows from {os.path.basename(cf)}")
    except Exception as e:
        print(f"Error reading {cf}:", e)

missing_records = [r for rid, r in all_records.items() if rid not in existing_ids]

print(f"Total unique records found: {len(all_records)}")
print(f"Already in new DB: {len(all_records) - len(missing_records)}")
print(f"Missing records to insert: {len(missing_records)}")

if not missing_records:
    print("No missing records to write.")
    exit(0)

# Get complete list of columns from sample record or DB columns
first_rec = missing_records[0]
all_cols = list(first_rec.keys())

sql_lines = []
sql_lines.append("-- =============================================================================")
sql_lines.append(f"-- SMARTSERVE: Migration Query for Missing Reservations ({len(missing_records)} records)")
sql_lines.append(f"-- Total unique records gathered: {len(all_records)} | Target: Halserve-live")
sql_lines.append("-- =============================================================================\n")
sql_lines.append("BEGIN;\n")

col_list_str = ", ".join(f'"{c}"' for c in all_cols)

for row in missing_records:
    vals = [format_val(c, row.get(c)) for c in all_cols]
    vals_str = ", ".join(vals)
    stmt = f"INSERT INTO reservations ({col_list_str})\nVALUES ({vals_str})\nON CONFLICT (id) DO NOTHING;\n"
    sql_lines.append(stmt)

sql_lines.append("COMMIT;\n")

with open(output_sql_path, "w", encoding="utf-8") as f:
    f.writelines(sql_lines)

print(f"Successfully generated {output_sql_path} with {len(missing_records)} INSERT statements.")
