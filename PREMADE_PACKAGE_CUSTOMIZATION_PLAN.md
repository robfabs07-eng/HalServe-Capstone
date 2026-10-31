# SmartServe Premade Package Customization Plan & Implementation Guide

## 1. Executive Overview & Core Architecture: The "Base Bundle + Add-On Layer" Model

In professional catering operations, a **Premade Package**—whether priced **Dynamically Set (`per-head`, e.g., ₱500/pax)**, **Majorly Set (`tiered` flat pricing, e.g., 50 Pax = ₱50,000 flat)**, or **Completely Set (`fixed` price)**—is sold as a curated, discounted bundle.

To give customers complete freedom to enhance a premade package without breaking bundle margins or causing pricing confusion, SmartServe uses a **Two-Layer Pricing & Item Model**:

1. **Layer 1: Bundled Package Baseline (`isOriginal = true`)**
   * Covered by the **Base Package Price** (determined by the package's pricing rule: Tiered Flat Price, Per-Head × Pax, or Fixed Price).
   * Core bundled items and baseline setup equipment cannot be removed or reduced below the package baseline, because doing so would not reduce the bundled base price and would be counterintuitive to the customer.
2. **Layer 2: Extra / Newly Added Customization Layer (`extraPax > 0`, `isOriginal = false`, or `customQty > baselineQty`)**
   * Customers can:
     * Add **Extra Pax (`extraPax`)** to any **existing bundled food item** in the premade package.
     * Freely browse the entire menu and catalog while a premade package is active and add **new extra dishes, drinks, desserts, add-ons, decorations, or standalone equipment** on top of the package.
     * Increase **existing bundled/setup equipment quantities** above the bundled baseline.
   * All extra pax on bundled food, newly added items, and extra equipment units above the bundled baseline are summed into **`Additional Charges`**.
   * **Final Package Total Formula:**
     `Total Estimate = Base Package Price + Additional Charges (Extra Pax on Bundled Food + Newly Added Items + Extra Equipment Units)`

---

## 2. Detailed Rules by Item Category

### A. Original Bundled Food & Dessert Items (`isOriginal = true` or `isFreeChoiceApplied = true`)

* **Removal Policy (`Can Remove?` -> ❌ NO):**
  * Customers **cannot** remove original bundled items from a premade package.
  * **Business Rationale:** Because the package base price is a bundled rate (e.g., ₱50,000 flat for 50 pax or ₱500/head), removing a bundled dish does not lower the package price.
* **Replacement / Swapping Policy (`Can Swap?` -> 🔄 Via `Free Choices` Slots Only):**
  * Fixed signature items in the package stay locked as **`Included in Package`**.
  * Package flexibility is handled cleanly through the package's **"Free Choices of Food From Menu" (`freeChoices`)** allowance (where the customer can freely pick or swap their chosen free-choice dishes from the allowed categories at `₱0` base cost).
* **Extra Pax Customization (`Can Add Extra Pax?` -> ✅ YES, via `extraPax`):**
  * Instead of changing/reducing the base pax of an existing bundled food item, the customization box on original bundled food items asks for **`Extra Pax`** (`inPkg.extraPax`, starting from `0`).
  * Whatever number of pax the customer inputs is treated strictly as **extra portions on top of the bundled package pax**.
  * **Pricing & Additional Charges Labeling Rule:**
    * Base package pax remains `₱0` extra (`Included in Package`).
    * When `inPkg.extraPax > 0`, the price for those extra portions is calculated as:
      `Extra Food Charge = Item Unit Price × extraPax`
    * This amount is added directly to **`Additional Charges`** and recorded in `additionalChargesItems` (`extraItemsList`) labeled as:
      **`"{Food item name}" ({extraPax} extra pax)`** *(e.g., `"Chicken Teriyaki" (20 extra pax)` — `+₱3,300`)*.
* **Dietary Notes & Specifications (`Can Edit Notes?` -> ✅ YES):**
  * Inside the same `Customize Extra Pax / Notes` box, customers can add preparation instructions or dietary notes (`inPkg.specifications`, e.g., *"Less oil"*, *"No pork/peanuts"*, *"Separate sauce"*).

---

### B. Newly Added Food Items, Drinks & Desserts (`isOriginal = false`)

* **Catalog Visibility & Addition (`Can Add Straight Up?` -> ✅ YES):**
  * When a premade package is active (`activePkg !== null`), the catalog **must not** hide non-package items.
  * Instead, the full catalog remains visible across all tabs (`Menu Items`, `Desserts`, `Drinks`, `Event Setup & Equipment`, `Decoration`, `Add-on`).
  * Original bundled items display an **`Included in Package`** badge, while all other catalog items display an **`+ Add to Package`** button.
* **Removal Policy (`Can Remove?` -> ✅ YES):**
  * Because newly added items are optional extras added by the customer, they can be toggled off or removed from the package summary drawer at any time.
* **Portion Pax Customization (`Can Customize Pax?` -> ✅ YES):**
  * Newly added Food and Dessert items **have `Customize Pax` enabled** (`1` to `999` pax, defaulting to the package guest count `pax`).
  * **Business Rationale:** A customer booking a 100-pax premade package may want to add an extra dish (e.g., *Fish Fillet* or *Kids' Spaghetti*) for only **30 or 50 pax** rather than all 100 guests.
  * **Pricing Rule:** Each newly added per-pax food/dessert/drink item adds its dynamic price based on its customized portion pax (`Item Price × Custom Portion Pax`, or `Item Price × Package Pax` if not customized) directly to **`Additional Charges`**.
* **Dietary Notes & Specifications (`Can Edit Notes?` -> ✅ YES):**
  * Full support for adding custom preparation notes on newly added dishes.

---

### C. Newly Added Add-ons & Decorations (`isOriginal = false`)

* **Addition & Removal (`Can Add / Remove?` -> ✅ YES):**
  * Customers can freely add any extra **Add-on** (e.g., *Chocolate Fountain*, *Mobile Bar*, *Lechon*) or **Decoration** upgrade on top of their premade package, and remove them anytime.
* **Pricing Rule:**
  * Adds the item's flat price (or per-pax price if configured as per-pax) directly to **`Additional Charges`**.

---

### D. Equipment Modifications: Bundled Baseline vs. Newly Added Equipment

Equipment in a premade package operates under two clear rules depending on whether the equipment is part of the package's bundled baseline or newly added:

#### 1. Existing / Bundled Equipment (Included in Package or Auto-Allocated by the Package's Included Event Setup)
* **Baseline Quantity (`bundledBaselineQty`):**
  * Determined by the premade package's fixed equipment list (`pkg.itemQtys[id]`) and/or its locked Event Setup auto-allocation rules (`autoQty` scaled to the package's guest count `pax` and bundled dishes).
  * This baseline quantity is **100% included in the Base Package Price (`₱0` extra charge)**.
* **Minimum Quantity Floor (`Can Decrease Below Baseline?` -> ❌ NO):**
  * Customers cannot reduce bundled equipment below `bundledBaselineQty` (or equivalently, they input **`Extra Quantity`** on top of the bundled baseline).
* **Increasing Quantity Above Baseline (`Can Increase Above Baseline?` -> ✅ YES, up to `999` / `maxStock`):**
  * Customers **can** increase the quantity of any existing equipment above the bundled baseline (for example, if a 100-pax package includes `10 Banquet Tables`, the customer can increase it to `12 Banquet Tables` for a gift/registration table).
  * **Delta Pricing Rule:** Only the extra units **above** the bundled baseline are charged to **`Additional Charges`** as **`"{Equipment Name}" ({extraQty} extra pcs)`**:
    `Extra Equipment Charge = max(0, Current Qty - Bundled Baseline Qty) × Equipment Unit Price`
* **Dynamic Dish-Triggered Equipment Auto-Allocation on Premade Packages:**
  * If a premade package includes a **Complete Setup** and the customer adds **1 new extra Hot Food dish**:
    * The system automatically allocates the extra serving gear required for that new dish (`+1 Chafing Dish`, `+1 Food Pan`, `+1 Food Tray Cover`, `+1 Serving Tong/Spoon`).
    * Because those extra serving items were triggered by an *extra* dish outside the original bundle, their delta cost above the original bundled equipment baseline is added to **`Additional Charges`**.

#### 2. Newly Added Standalone Equipment (`isOriginal = false`)
* **Addition & Removal (`Can Add / Remove?` -> ✅ YES):**
  * Customers can add any standalone equipment item from the catalog that was not part of the premade package.
* **Quantity Customization (`Can Customize Qty?` -> ✅ YES, `1` to `999`):**
  * Quantity can be freely adjusted or removed completely.
* **Pricing Rule:**
  * Full quantity is charged to **`Additional Charges`**:
    `Extra Equipment Charge = Qty × Equipment Unit Price`

---

## 3. Summary Matrix of Premade Package Modification Rules

| Item Category | Can Remove from Package? | Pax / Quantity Customization Rule | Can Add Dietary / Prep Notes? | Pricing Impact on Package |
| :--- | :---: | :---: | :---: | :--- |
| **Original Bundled Food / Desserts** (`isOriginal = true`) | ❌ **No** *(Locked in Bundle)* | ✅ **Add Extra Pax (`extraPax >= 0`)** on top of bundled package pax | ✅ **Yes** | Base pax is `₱0`. Extra pax adds `Price × extraPax` to **Additional Charges** as **`"Food Name" (X extra pax)`** |
| **Free Choice Menu Slots** (`isFreeChoiceApplied = true`) | 🔄 **Can Swap** within allowed categories | ✅ **Add Extra Pax (`extraPax >= 0`)** on top of bundled package pax | ✅ **Yes** | Base pax is `₱0`. Extra pax adds `Price × extraPax` to **Additional Charges** as **`"Food Name" (X extra pax)`** |
| **Original Bundled Add-ons / Decorations** (`isOriginal = true`) | ❌ **No** *(Locked in Bundle)* | N/A *(Flat Item)* | ✅ **Yes** | `₱0` extra *(Included in Base Package Price)* |
| **Newly Added Food / Drinks / Desserts** (`isOriginal = false`) | ✅ **Yes** | ✅ **Customize Portion Pax** (`1` to `999`, defaults to package `pax`) | ✅ **Yes** | Adds `Price × Custom Pax` to **Additional Charges** |
| **Newly Added Add-ons & Decorations** (`isOriginal = false`) | ✅ **Yes** | N/A *(Flat Item)* | ✅ **Yes** | Adds flat/dynamic price to **Additional Charges** |
| **Existing Bundled Equipment** (`Included in Pkg / Setup`) | ❌ **No** *(Cannot go below bundled baseline)* | ✅ **Increase Above Baseline Only** (`Baseline Qty` to `999`) | ✅ **Yes** | Only extra units **above** baseline (`(Qty - Baseline) × Price`) add to **Additional Charges** as **`"Equip Name" (X extra pcs)`** |
| **Newly Added Standalone Equipment** (`isOriginal = false`) | ✅ **Yes** | ✅ **Customize Qty** (`1` to `999`) | ✅ **Yes** | Adds `Qty × Price` to **Additional Charges** |

---

## 4. Step-by-Step Implementation Instructions (`app.js`)

Follow these exact steps in `app.js` to implement the Premade Package Modifications safely without breaking Custom Packages.

### Step 1: Unlock the Catalog Filter When `activePkg` Is Selected (`renderCat`)
**Location:** `renderCat()` (around lines `2720–2731`)

1. **Current Behavior:** When `activePkg` is truthy, `renderCat()` filters `items` to only show items that are already inside `customPkgItems` (unless `hasFreeChoicePlaceholder` is active for `food`).
2. **Change Required:**
   * Remove the `if (activePkg) { items = items.filter(...); }` restriction so the customer can see the **entire catalog** across all categories (`food`, `dessert`, `drink`, `equipment`, `decoration`, `addons`) even while a premade package is active.
   * Keep the `hasFreeChoicePlaceholder` banner/helper logic so that if the package still has unused `"Free Choices of Food From Menu"` slots, picking a food item consumes the free choice first before adding paid extras.

---

### Step 2: Update Card Buttons & Customization Controls in `renderCat()`
**Location:** `renderCat()` (around lines `2811–2922`)

1. **Identify Whether an Item Is an Original Bundled Item vs. a Newly Added Extra:**
   ```javascript
   const origItemIds = new Set((activePkg && activePkg.itemIds) ? activePkg.itemIds.map(String) : []);
   const isOrigBundled = !!(activePkg && inPkg && (origItemIds.has(String(item.id)) || inPkg.isFreeChoiceApplied || inPkg.isEventSetupEquipment || inPkg.isOriginalPkgItem));
   const isExtraAdded = !!(activePkg && inPkg && !isOrigBundled);
   ```

2. **Enable Customization Controls Based on Item Role:**
   * **Case 1: Original Bundled Food / Dessert Item (`activePkg && inPkg && isOrigBundled && isItemPerPaxScalable(item)`):**
     * Render a **`Customize Extra Pax`** button (`onclick="toggleCustomizePax('${item.id}')"`):
       * Button label: `${inPkg.extraPax ? 'Extra Pax: +' + inPkg.extraPax + ' pax' : 'Add Extra Pax / Notes'}`
       * When open (`inPkg._showCustomizePax`), show:
         * **Input:** `Extra Pax to Add (on top of ${totalPaxNum} bundled pax):` with `min="0" max="999"` bound to `updateItemExtraPax('${item.id}', this.value)`.
         * **Helper preview:** If `inPkg.extraPax > 0`, show `+₱${((parseFloat(item.price) || 0) * inPkg.extraPax).toLocaleString()} added to Additional Charges`.
         * **Specifications input:** Bound to `updateItemCustomSpecs('${item.id}', this.value)`.
   * **Case 2: Newly Added Food / Dessert Item (`(!activePkg || isExtraAdded) && inPkg && isItemPerPaxScalable(item)`):**
     * Render the standard **`Customize Pax`** box (`Portion Pax`, `min="1"`, `max="${totalPaxNum}"`) and `Specifications` input so the customer can set the exact portion pax for their newly added dish.
   * **Case 3: Original Bundled / Setup Equipment (`activePkg && inPkg && isEquipment && isOrigBundled`):**
     * Calculate the bundled baseline quantity `baselineQty` (using `getEquipmentAllocatedQty`).
     * Render a **`Customize Extra Equipment`** box where the minimum allowed quantity is `baselineQty` (or an `Extra Count` input `min="0"`), displaying:
       * `Included in Package: ${baselineQty} pcs`
       * `Total Quantity (${baselineQty} - 999):` input where any unit above `baselineQty` adds `+₱${((curQty - baselineQty) * unitPrice).toLocaleString()}` to Additional Charges.
   * **Case 4: Newly Added Standalone Equipment (`(!activePkg || isExtraAdded) && inPkg && isEquipment && !isOrigBundled`):**
     * Render the standard **`Customize Equipment`** box (`1 - 999 pcs`).
   * **Case 5: Decorations, Add-ons & Drinks (`inPkg && (isDecorOrAddon || isDrinksPkg)`):**
     * Allow `Customize Notes` (`inPkg.specifications`) in both Custom and Premade packages.

3. **Update the Add / Locked Button on Catalog Cards (`lines 2905–2920`):**
   * Show the item price on catalog cards even when `activePkg` is active so customers can see how much extra items cost.
   * If `activePkg && isOrigBundled && !inPkg.isFreeChoiceApplied`:
     * Show `<button class="btn-add added" style="margin-top:12px; opacity:0.75; cursor:not-allowed;" disabled>Locked &bull; Included in Package</button>`
   * If `activePkg && inPkg && inPkg.isFreeChoiceApplied`:
     * Show `<button class="btn-add added" onclick="event.stopPropagation(); toggleItem('${item.id}')" style="margin-top:12px;">&#10003; Free Choice Selected (Click to Swap)</button>`
   * Otherwise (for all non-bundled items when `activePkg` is active, or any item in Custom Package):
     * Show `<button class="btn-add ${inPkg ? 'added' : ''}" onclick="event.stopPropagation(); toggleItem('${item.id}')" style="margin-top:12px;">${inPkg ? '&#10003; Added (Extra)' : '+ Add to Package'}</button>`
   * Always render `${customizePaxHtml}` right below the button!

---

### Step 3: Add `updateItemExtraPax` and `resetItemExtraPax` Helper Functions
**Location:** Right after `resetItemCustomPax` (around line `2960`)

Add the handlers for `extraPax` on original bundled food items:
```javascript
function updateItemExtraPax(itemId, extraPaxVal, shouldReRenderCat = true) {
  const inPkg = customPkgItems.find(c => String(c.id) === String(itemId));
  if (!inPkg) return;
  let ep = parseInt(extraPaxVal, 10);
  if (isNaN(ep) || ep < 0) ep = 0;
  if (ep > 999) ep = 999;
  if (ep === 0) {
    delete inPkg.extraPax;
  } else {
    inPkg.extraPax = ep;
  }
  if (shouldReRenderCat && typeof renderCat === 'function') renderCat();
  if (typeof renderCustomPkg === 'function') renderCustomPkg();
  if (typeof saveCustomPkgStateToStorage === 'function') saveCustomPkgStateToStorage();
}
window.updateItemExtraPax = updateItemExtraPax;

function resetItemExtraPax(itemId) {
  const inPkg = customPkgItems.find(c => String(c.id) === String(itemId));
  if (!inPkg) return;
  delete inPkg.extraPax;
  inPkg._showCustomizePax = false;
  if (typeof renderCat === 'function') renderCat();
  if (typeof renderCustomPkg === 'function') renderCustomPkg();
  if (typeof saveCustomPkgStateToStorage === 'function') saveCustomPkgStateToStorage();
}
window.resetItemExtraPax = resetItemExtraPax;
```

---

### Step 4: Allow Adding & Removing Non-Bundled Extra Items in `toggleItem()` and `removePkgItem()`
**Location:** `toggleItem()` (lines `3619–3731`) and `removePkgItem()` (lines `3733–3779`)

1. **In `toggleItem(id)` — Removing an item (`idx > -1`, lines `3634–3641`):**
   * Check if the item is an original bundled item:
     ```javascript
     const origItemIds = new Set((activePkg && activePkg.itemIds) ? activePkg.itemIds.map(String) : []);
     const isOrigBundled = activePkg && (origItemIds.has(String(id)) || customPkgItems[idx].isOriginalPkgItem || customPkgItems[idx].isEventSetupEquipment);
     ```
   * Only block removal if `isOrigBundled && !customPkgItems[idx].isFreeChoiceApplied`.
   * If `!isOrigBundled` (i.e. it was newly added by the customer as an extra item), allow `customPkgItems.splice(idx, 1)`!
2. **In `toggleItem(id)` — Adding an item (`else` branch, lines `3693–3700`):**
   * Remove the block that says `"You cannot add extra items to a pre-made package."`
   * Push `{ ...item, isExtraAdded: !!activePkg }` to `customPkgItems` so newly added items are cleanly tracked.
3. **In `removePkgItem(id)` (lines `3744–3750`):**
   * Apply the same `isOrigBundled` check: block removal only for original bundled items (`origItemIds.has(String(id))` or `item.isEventSetupEquipment`), and allow removing any newly added extra item.

---

### Step 5: Compute `additionalCharges` & `extraItemsList` in Both `renderCustomPkg()` and `finalizePackageInternal()`
**Locations:**
* `renderCustomPkg()` (around lines `4759–4773`)
* `finalizePackageInternal()` (around lines `4165–4179`)

Create a shared helper function `calculatePremadeExtraCharges(activePkg, customPkgItems, pCount)` and call it in both places so the live workspace display and the finalized cart package are 100% identical:

```javascript
function calculatePremadeExtraCharges(pkg, items, pCount) {
  let additionalCharges = 0;
  const extraItemsList = [];
  if (!pkg) return { additionalCharges, extraItemsList };

  const origItemIds = new Set((pkg.itemIds || []).map(String));

  items.forEach(item => {
    const isOrig = origItemIds.has(String(item.id)) || !!item.isOriginalPkgItem || !!item.isFreeChoiceApplied;

    // 1. Original Bundled / Free-Choice Food Item with Extra Pax (item.extraPax > 0)
    if (isOrig && item.extraPax && item.extraPax > 0) {
      const extraCost = getDynamicPrice({ ...item, isFree: false, customPax: item.extraPax }, item.extraPax);
      if (extraCost > 0) {
        additionalCharges += extraCost;
        extraItemsList.push({
          id: item.id,
          name: `"${item.name}" (${item.extraPax} extra pax)`,
          price: extraCost,
          extraPax: item.extraPax,
          isExtraPaxCharge: true
        });
      }
      return;
    }

    // 2. Existing Bundled / Event Setup Equipment with Extra Quantity above baseline
    if ((item.cat === 'equipment') && (isOrig || item.isEventSetupEquipment || item.isAutoAdded)) {
      const baselineQty = item.bundledBaselineQty || (window.getEquipmentAllocatedQty ? window.getEquipmentAllocatedQty({ ...item, customQty: null }, pCount, items) : 1);
      const currentQty = (item.customQty !== undefined && item.customQty !== null) ? Number(item.customQty) : baselineQty;
      const extraQty = Math.max(0, currentQty - baselineQty);
      if (extraQty > 0) {
        const unitPrice = parseFloat(item.price) || 0;
        const extraEquipCost = extraQty * unitPrice;
        additionalCharges += extraEquipCost;
        extraItemsList.push({
          id: item.id,
          name: `"${item.name}" (${extraQty} extra pcs)`,
          price: extraEquipCost,
          extraQty: extraQty,
          isExtraEquipCharge: true
        });
      }
      return;
    }

    // 3. Newly Added Extra Items (Food, Drinks, Desserts, Add-ons, Decorations, Standalone Equipment)
    if (!isOrig && !item.isFree && !item.isAutoAdded && !item.isEventSetupEquipment && !item.isFreebie) {
      const itemPrice = getDynamicPrice(item, pCount);
      if (itemPrice > 0) {
        const label = item.customPax
          ? `${item.name} (${item.customPax} pax)`
          : (item.cat === 'equipment' && item.customQty ? `${item.name} (${item.customQty} pcs)` : item.name);
        additionalCharges += itemPrice;
        extraItemsList.push({
          id: item.id,
          name: label,
          price: itemPrice
        });
      }
    }
  });

  return { additionalCharges, extraItemsList };
}
```

---

### Step 6: Update Selected Items Display & Additional Charges Breakdown in `renderCustomPkg()`
**Location:** `renderCustomPkg()` (lines `4904–4960`) and `saveCustomPkgStateToStorage()` (lines `4999–5016`)

1. **In `renderCustomPkg()` item row rendering (lines `4909–4956`):**
   * If an original bundled food item has `item.extraPax > 0`:
     * Calculate `extraCost = getDynamicPrice({ ...item, isFree: false, customPax: item.extraPax }, item.extraPax)`.
     * Display:
       * `Portion: <strong>${p} pax (Included) + ${item.extraPax} extra pax</strong>`
       * Price badge: `<span style="color:var(--primary); font-size:11px; font-weight:700;">INCLUDED</span> <span style="color:var(--gold); font-size:11px; font-weight:700;">+ &#8369;${extraCost.toLocaleString()} (${item.extraPax} extra pax)</span>`
   * If a newly added item (`!isOrig`) is in `customPkgItems`:
     * Display its price `&#8369;${dp.toLocaleString()} <span style="font-size:10px; color:var(--gold); font-weight:700;">(EXTRA)</span>` and enable its remove `&times;` button.
2. **Show Additional Charges Row Under Estimated Total (`renderCustomPkg`):**
   * When `activePkg && additionalCharges > 0`, show a breakdown line right above/below Out of Town Charges:
     * `Base Package: ₱${basePackageTotal.toLocaleString()} | Additional Charges: +₱${additionalCharges.toLocaleString()}`
3. **Persist `extraPax` in Draft Storage (`saveCustomPkgStateToStorage` & `loadCustomPkgStateFromStorage`):**
   * Include `extraPax: i.extraPax ? parseInt(i.extraPax) : null` in the saved item object in `saveCustomPkgStateToStorage()` (around line `5009`) and restore it in `loadCustomPkgStateFromStorage()`.

---

### Step 7: AI Planner Enhancement Mode for Premade Packages
**Location:** AI Planner functions in `app.js` (`sendAiChatMessage` / `applyAiPackageToReservation`)

1. When `activePkg` is active, include `activePkg.name`, `basePackageTotal`, and the list of bundled items in the AI system context.
2. When the user clicks **"Apply to My Package"** on an AI recommendation while `activePkg` is active:
   * Keep `activePkg` and all original bundled items intact, and append the AI's recommended extra items (or apply `extraPax` if the AI suggested extra portions of an existing dish) into `customPkgItems` as `Additional Charges`.
