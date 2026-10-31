/**
 * Hal'Serve Equipment Unit & Instance Tracking Engine
 * Comprehensive Individual-based & Quantity-based Unique Item Tracking
 * Strict UTF-8 Encoding - No Emoticons - No Colored Pill Backgrounds
 */

(function (window) {
  'use strict';

  window.EQUIPMENT_UNITS_CACHE = window.EQUIPMENT_UNITS_CACHE || {};
  window._eimExpandedRows = window._eimExpandedRows || new Set();

  // Helper to safely get Supabase client
  function getSbClient() {
    return window.supabaseClient || window.sb || null;
  }

  // Sort equipment units: broken equipments shot to the top of the list (highest priority),
  // and list is reversed: newest equipment (#100) at top, oldest equipment (#1) at bottom.
  function sortEquipmentUnitsReversedWithBrokenFirst(units) {
    if (!Array.isArray(units)) return units;
    return units.sort((a, b) => {
      const ca = (a.condition || '').toLowerCase();
      const sa = (a.status || '').toLowerCase();
      const isBrokenA = ca === 'broken' || ca === 'needs repair' || ca === 'damaged' || ca === 'poor' || sa === 'maintenance' || sa === 'under repair';

      const cb = (b.condition || '').toLowerCase();
      const sb = (b.status || '').toLowerCase();
      const isBrokenB = cb === 'broken' || cb === 'needs repair' || cb === 'damaged' || cb === 'poor' || sb === 'maintenance' || sb === 'under repair';

      // 1. Broken equipment shot at the top of the list (highest priority)
      if (isBrokenA && !isBrokenB) return -1;
      if (!isBrokenA && isBrokenB) return 1;

      // 2. Both broken or both non-broken: reversed order (newest/highest unit number at top, oldest #1 at bottom)
      const numA = parseInt(a.unit_number != null ? a.unit_number : (String(a.item_code || '').match(/\d+$/) || [0])[0], 10);
      const numB = parseInt(b.unit_number != null ? b.unit_number : (String(b.item_code || '').match(/\d+$/) || [0])[0], 10);
      return numB - numA;
    });
  }
  window.sortEquipmentUnitsReversedWithBrokenFirst = sortEquipmentUnitsReversedWithBrokenFirst;

  // Formatting date
  function fmtDateStr(dStr) {
    if (!dStr) return '—';
    try {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch (e) {}
    return String(dStr);
  }

  // Formatting time (e.g. "14:30:00" -> "02:30 PM")
  function fmtTimeStr(tStr) {
    if (!tStr || tStr === '—') return '—';
    try {
      const s = String(tStr).trim();
      if (s.includes('AM') || s.includes('PM')) return s;
      const parts = s.split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1].slice(0, 2);
        if (isNaN(h)) return s;
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
    } catch(e) {}
    return String(tStr);
  }
  window.fmtTimeStr = fmtTimeStr;

  // Safe escape HTML
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Generate standardized unique unit item code: e.g. EQ-0007-001 or EQ-0007 (1)
  function buildItemCode(assetId, unitNum) {
    const cleanId = String(assetId || 'EQ-0000').trim().toUpperCase();
    return `${cleanId}-${String(unitNum).padStart(3, '0')}`;
  }

  // Synthesize memory items for an asset if not stored in DB yet
  function synthesizeUnitsForAsset(asset) {
    const assetId = asset.asset_id || asset.id;
    const totalQty = parseInt(asset.quantity || asset.total_qty || 0) || 1;
    const goodQty = asset.good_qty != null ? parseInt(asset.good_qty) : (asset.available_qty != null ? parseInt(asset.available_qty) : totalQty);
    const maintQty = parseInt(asset.maintenance_qty || 0);
    const missQty = parseInt(asset.missing_qty || 0);
    const retQty = parseInt(asset.retired_qty || 0);
    const allocQty = parseInt(asset.allocatedQty || asset.allocated_qty || 0);

    const history = Array.isArray(asset.purchase_history) ? asset.purchase_history : [];
    const baseSupplier = asset.supplier || asset.sourceLocation || 'Standard Supplier';
    const baseDate = asset.addedDate || asset.purchase_date || new Date().toISOString().split('T')[0];
    const baseCost = parseFloat(asset.shoppingCost || asset.unitCost || 0);

    const units = [];
    let curGood = goodQty;
    let curMaint = maintQty;
    let curMiss = missQty;
    let curRet = retQty;
    let curAlloc = allocQty;

    // Distribute across purchase history if available
    let histIndex = 0;
    let histAssigned = 0;

    for (let i = 1; i <= totalQty; i++) {
      const code = buildItemCode(assetId, i);
      let condition = 'Good';
      let status = 'Available';

      if (curMaint > 0) {
        condition = 'Broken';
        status = 'Maintenance';
        curMaint--;
      } else if (curMiss > 0) {
        condition = 'Missing';
        status = 'Missing';
        curMiss--;
      } else if (curRet > 0) {
        condition = 'Retired';
        status = 'Retired';
        curRet--;
      } else if (curAlloc > 0) {
        condition = 'Good';
        status = 'Allocated';
        curAlloc--;
      } else {
        condition = 'Good';
        status = 'Available';
      }

      let pDate = baseDate;
      let pSup = baseSupplier;
      let pCost = baseCost;

      if (history.length > 0) {
        const curH = history[histIndex] || history[history.length - 1];
        if (curH) {
          pDate = curH.date || pDate;
          pSup = curH.supplier || pSup;
          pCost = parseFloat(curH.shopping_cost || curH.cost || pCost);
          histAssigned++;
          if (histAssigned >= (parseInt(curH.qty) || 1) && histIndex < history.length - 1) {
            histIndex++;
            histAssigned = 0;
          }
        }
      }

      units.push({
        id: `unit-${assetId}-${i}`,
        equipment_id: asset.supabaseId || asset.id,
        asset_id: assetId,
        item_code: code,
        unit_number: i,
        condition: condition,
        status: status,
        allocated_reservation_id: asset.allocatedReservationId || null,
        allocation_batch: asset.allocationBatch || null,
        purchase_date: pDate,
        purchase_cost: pCost,
        supplier: pSup,
        source_location: pSup,
        qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + '/scan.html?eq=' + code)}`
      });
    }

    return units;
  }

  // Fetch or retrieve unit items for an equipment
  async function getEquipmentUnits(assetId, forceRefresh) {
    if (!assetId) return [];
    const cleanId = String(assetId).trim();
    if (!forceRefresh && window.EQUIPMENT_UNITS_CACHE && window.EQUIPMENT_UNITS_CACHE[cleanId]) {
      const cached = window.EQUIPMENT_UNITS_CACHE[cleanId];
      if (Array.isArray(cached) && cached.length > 0 && cached[0] && cached[0].item_code) {
        return cached;
      }
    }

    const assetList = window.EIM_ASSETS || (typeof EIM_ASSETS !== 'undefined' ? EIM_ASSETS : []);
    const matched = assetList.find(a => String(a.asset_id || a.id).trim() === cleanId || String(a.supabaseId || '').trim() === cleanId);
    const lookupAssetId = (matched && (matched.asset_id || matched.id)) || cleanId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

    const sb = getSbClient();
    if (sb) {
      try {
        let query = sb.from('equipment_unit_items').select('*');
        if (isUuid) {
          query = query.eq('equipment_id', cleanId);
        } else {
          query = query.eq('asset_id', lookupAssetId);
        }
        const { data, error } = await query.order('unit_number', { ascending: true });

        if (!error && data && data.length > 0) {
          sortEquipmentUnitsReversedWithBrokenFirst(data);
          window.EQUIPMENT_UNITS_CACHE = window.EQUIPMENT_UNITS_CACHE || {};
          window.EQUIPMENT_UNITS_CACHE[cleanId] = data;
          if (lookupAssetId && lookupAssetId !== cleanId) {
            window.EQUIPMENT_UNITS_CACHE[lookupAssetId] = data;
          }
          if (matched && matched.supabaseId) {
            window.EQUIPMENT_UNITS_CACHE[matched.supabaseId] = data;
          }
          return data;
        }
      } catch (err) {
        console.warn('[UnitTracker] Query equipment_unit_items failed, using fallback:', err.message);
      }
    }

    // Fallback: look up in EIM_ASSETS
    if (matched) {
      const syn = synthesizeUnitsForAsset(matched);
      sortEquipmentUnitsReversedWithBrokenFirst(syn);
      window.EQUIPMENT_UNITS_CACHE = window.EQUIPMENT_UNITS_CACHE || {};
      window.EQUIPMENT_UNITS_CACHE[cleanId] = syn;
      if (lookupAssetId && lookupAssetId !== cleanId) {
        window.EQUIPMENT_UNITS_CACHE[lookupAssetId] = syn;
      }
      return syn;
    }

    return [];
  }

  // Persist new or updated unit items to Supabase
  async function persistEquipmentUnits(units) {
    if (!Array.isArray(units) || units.length === 0) return true;
    const sb = getSbClient();
    if (!sb) return false;

    try {
      const { error } = await sb.from('equipment_unit_items').upsert(units, { onConflict: 'item_code' });
      if (error) {
        console.warn('[UnitTracker] equipment_unit_items upsert notice:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[UnitTracker] Failed to upsert equipment_unit_items:', e.message);
      return false;
    }
  }

  // Allocate individual units using First In First Out (FIFO)
  async function allocateUnitsFIFO(assetId, requestedQty, reservationId, batchName) {
    const rawUnits = await getEquipmentUnits(assetId, true);
    if (!rawUnits || rawUnits.length === 0) return [];

    // Sort ascending for true FIFO allocation (#1 first, #2 second, etc.)
    const units = [...rawUnits].sort((a, b) => {
      const numA = parseInt(a.unit_number != null ? a.unit_number : (String(a.item_code || '').match(/\d+$/) || [0])[0], 10);
      const numB = parseInt(b.unit_number != null ? b.unit_number : (String(b.item_code || '').match(/\d+$/) || [0])[0], 10);
      return numA - numB;
    });

    const allocatedCodes = [];
    let needed = parseInt(requestedQty) || 0;

    for (let i = 0; i < units.length && needed > 0; i++) {
      const u = units[i];
      // Only allocate if unit is Available and in Good condition
      if ((u.status === 'Available' || !u.status) && (u.condition === 'Good' || !u.condition)) {
        u.status = 'Allocated';
        u.allocated_reservation_id = reservationId;
        u.allocation_batch = batchName;
        u.allocated_date = new Date().toISOString();
        allocatedCodes.push(u.item_code);
        needed--;
      }
    }

    sortEquipmentUnitsReversedWithBrokenFirst(units);
    window.EQUIPMENT_UNITS_CACHE[assetId] = units;
    await persistEquipmentUnits(units);
    return allocatedCodes;
  }

  // Auto-replacement on damage: replace broken allocated unit with next available good unit
  async function replaceDamagedUnit(assetId, brokenItemCode, reservationId, batchName) {
    const units = await getEquipmentUnits(assetId, true);
    if (!units || units.length === 0) return null;

    let replacementCode = null;

    // 1. Mark damaged item
    const damaged = units.find(u => u.item_code === brokenItemCode);
    if (damaged) {
      damaged.status = 'Maintenance';
      damaged.condition = 'Broken';
      damaged.allocated_reservation_id = null;
      damaged.allocation_batch = null;
    }

    // 2. Find next available good unit (FIFO)
    const nextGood = units.find(u => u.item_code !== brokenItemCode && (u.status === 'Available' || !u.status) && (u.condition === 'Good' || !u.condition));
    if (nextGood) {
      nextGood.status = 'Allocated';
      nextGood.allocated_reservation_id = reservationId;
      nextGood.allocation_batch = batchName;
      nextGood.allocated_date = new Date().toISOString();
      replacementCode = nextGood.item_code;
    }

    window.EQUIPMENT_UNITS_CACHE[assetId] = units;
    await persistEquipmentUnits(units);

    // 3. Update allocation_history if needed
    const sb = getSbClient();
    if (sb && batchName) {
      try {
        const { data: hist } = await sb
          .from('allocation_history')
          .select('id, allocated_item_ids')
          .eq('asset_id', assetId)
          .eq('allocation_batch', batchName)
          .maybeSingle();

        if (hist) {
          let curIds = Array.isArray(hist.allocated_item_ids) ? hist.allocated_item_ids : [];
          curIds = curIds.filter(c => c !== brokenItemCode);
          if (replacementCode) curIds.push(replacementCode);
          await sb.from('allocation_history').update({ allocated_item_ids: curIds }).eq('id', hist.id);
        }
      } catch (e) {
        console.warn('[UnitTracker] Failed to update allocation_history item IDs:', e.message);
      }
    }

    return replacementCode;
  }

  // ==================== ADD EQUIPMENT MODAL DYNAMIC SETS ====================

  window.toggleEimAddTrackingMode = function (mode) {
    const wrap = document.getElementById('eim-add-another-set-wrap');
    const preview = document.getElementById('eim-add-financials-qty-preview');
    const set0QtyRow = document.getElementById('eim-add-set0-qty-row');

    if (mode === 'individual') {
      if (wrap) wrap.style.display = 'block';
      if (preview) preview.style.display = 'block';
      if (set0QtyRow) set0QtyRow.style.display = 'block';
      window.onEimAddQtyChange();
    } else {
      if (wrap) wrap.style.display = 'none';
      if (preview) preview.style.display = 'none';
      if (set0QtyRow) set0QtyRow.style.display = 'none';
    }
  };

  window.onEimAddQtyChange = function () {
    const qtyInput = document.getElementById('eim-add-qty');
    const total = parseInt(qtyInput ? qtyInput.value : 0) || 0;
    const disp = document.getElementById('eim-add-initial-qty-display');
    if (disp) disp.textContent = total;

    // Set first set's default quantity if it's the only set
    const container = document.getElementById('eim-add-purchase-sets-container');
    if (container) {
      const cards = container.querySelectorAll('.eim-purchase-set-card');
      if (cards.length === 1) {
        const q0 = document.getElementById('eim-add-set-qty-0');
        if (q0 && (!q0.value || parseInt(q0.value) === 0)) {
          q0.value = total;
        }
      }
    }
    window.updatePurchaseSetsValidation();
  };

  window.addAnotherPurchaseSet = function () {
    const container = document.getElementById('eim-add-purchase-sets-container');
    if (!container) return;

    const cards = container.querySelectorAll('.eim-purchase-set-card');
    const nextIdx = cards.length;

    // Compute remaining quantity for convenience
    const targetQty = parseInt(document.getElementById('eim-add-qty')?.value) || 0;
    let sumExisting = 0;
    container.querySelectorAll('.eim-set-qty-input').forEach(inp => {
      sumExisting += parseInt(inp.value) || 0;
    });
    const defaultRem = Math.max(1, targetQty - sumExisting);

    const div = document.createElement('div');
    div.className = 'eim-purchase-set-card';
    div.setAttribute('data-set-idx', nextIdx);
    div.style.cssText = 'background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; padding:12px; margin-bottom:10px; position:relative;';

    const todayStr = new Date().toISOString().split('T')[0];
    const nowTimeStr = new Date().toTimeString().slice(0, 5);

    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:11px; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px;">Purchase Set ${nextIdx + 1}</span>
        <button type="button" onclick="window.removePurchaseSet(this)" style="background:none; border:none; color:var(--red); font-size:14px; font-weight:bold; cursor:pointer; padding:2px 6px;" title="Remove this set">✕</button>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Set Quantity *</label>
          <input type="number" id="eim-add-set-qty-${nextIdx}" class="input-field eim-set-qty-input" value="${defaultRem}" min="1" oninput="window.updatePurchaseSetsValidation()" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Unit Cost (₱)</label>
          <input type="number" id="eim-add-set-cost-${nextIdx}" class="input-field" placeholder="0.00" min="0" max="999999" maxlength="6" />
        </div>
        <div class="form-group">
          <label>Shopping Cost (₱)</label>
          <input type="number" id="eim-add-set-shopcost-${nextIdx}" class="input-field" placeholder="0.00" min="0" max="999999" maxlength="6" />
        </div>
        <div class="form-group">
          <label>Shopping Unit Type</label>
          <select id="eim-add-set-unit-${nextIdx}" class="input-field">
            <option value="pcs">pcs</option>
            <option value="sets">sets</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Supplier / Source Location</label>
          <input type="text" id="eim-add-set-sup-${nextIdx}" class="input-field" placeholder="e.g. Divisoria, SM" />
        </div>
        <div class="form-group">
          <label>Date Purchased</label>
          <input type="date" id="eim-add-set-date-${nextIdx}" class="input-field" value="${todayStr}" />
        </div>
        <div class="form-group">
          <label>Time Purchased</label>
          <input type="time" id="eim-add-set-time-${nextIdx}" class="input-field" value="${nowTimeStr}" />
        </div>
      </div>
    `;

    container.appendChild(div);
    window.updatePurchaseSetsValidation();
  };

  window.removePurchaseSet = function (btn) {
    const card = btn.closest('.eim-purchase-set-card');
    if (card) {
      card.remove();
      window.updatePurchaseSetsValidation();
    }
  };

  window.updatePurchaseSetsValidation = function () {
    const targetQty = parseInt(document.getElementById('eim-add-qty')?.value) || 0;
    const container = document.getElementById('eim-add-purchase-sets-container');
    if (!container) return;

    let currentSum = 0;
    container.querySelectorAll('.eim-set-qty-input').forEach(inp => {
      currentSum += parseInt(inp.value) || 0;
    });

    const totSpan = document.getElementById('eim-add-sets-total-qty');
    if (totSpan) {
      totSpan.textContent = currentSum;
      if (currentSum === targetQty && targetQty > 0) {
        totSpan.style.color = 'var(--green)';
      } else {
        totSpan.style.color = 'var(--red)';
      }
    }
  };

  // Collect configured purchase sets
  window.getAddEquipmentPurchaseSets = function () {
    const targetQty = parseInt(document.getElementById('eim-add-qty')?.value) || 0;
    const trackingMode = document.getElementById('eim-add-tracking')?.value || 'quantity';

    if (trackingMode !== 'individual') {
      return [{
        qty: targetQty,
        unitCost: parseFloat(document.getElementById('eim-add-cost')?.value) || 0,
        shoppingCost: parseFloat(document.getElementById('eim-add-shopping-cost')?.value) || 0,
        unitType: document.getElementById('eim-add-shopping-unit')?.value || 'pcs',
        supplier: document.getElementById('eim-add-supplier')?.value.trim() || 'General Supplier',
        date: document.getElementById('eim-add-purchase-date')?.value || new Date().toISOString().split('T')[0],
        time: document.getElementById('eim-add-time-purchased')?.value || new Date().toTimeString().slice(0, 5)
      }];
    }

    const container = document.getElementById('eim-add-purchase-sets-container');
    const cards = container ? container.querySelectorAll('.eim-purchase-set-card') : [];
    const sets = [];

    cards.forEach((card, idx) => {
      let q = 0;
      let cost = 0;
      let shopCost = 0;
      let uType = 'pcs';
      let sup = '';
      let pDate = '';
      let pTime = '';

      if (idx === 0) {
        q = parseInt(document.getElementById('eim-add-set-qty-0')?.value) || targetQty;
        cost = parseFloat(document.getElementById('eim-add-cost')?.value) || 0;
        shopCost = parseFloat(document.getElementById('eim-add-shopping-cost')?.value) || 0;
        uType = document.getElementById('eim-add-shopping-unit')?.value || 'pcs';
        sup = document.getElementById('eim-add-supplier')?.value.trim() || 'General Supplier';
        pDate = document.getElementById('eim-add-purchase-date')?.value || new Date().toISOString().split('T')[0];
        pTime = document.getElementById('eim-add-time-purchased')?.value || new Date().toTimeString().slice(0, 5);
      } else {
        q = parseInt(card.querySelector('.eim-set-qty-input')?.value) || 0;
        cost = parseFloat(card.querySelector(`[id^="eim-add-set-cost-"]`)?.value) || 0;
        shopCost = parseFloat(card.querySelector(`[id^="eim-add-set-shopcost-"]`)?.value) || 0;
        uType = card.querySelector(`[id^="eim-add-set-unit-"]`)?.value || 'pcs';
        sup = card.querySelector(`[id^="eim-add-set-sup-"]`)?.value.trim() || 'General Supplier';
        pDate = card.querySelector(`[id^="eim-add-set-date-"]`)?.value || new Date().toISOString().split('T')[0];
        pTime = card.querySelector(`[id^="eim-add-set-time-"]`)?.value || new Date().toTimeString().slice(0, 5);
      }

      if (q > 0) {
        sets.push({ qty: q, unitCost: cost, shoppingCost: shopCost, unitType: uType, supplier: sup, date: pDate, time: pTime });
      }
    });

    return sets.length > 0 ? sets : [{
      qty: targetQty,
      unitCost: parseFloat(document.getElementById('eim-add-cost')?.value) || 0,
      shoppingCost: parseFloat(document.getElementById('eim-add-shopping-cost')?.value) || 0,
      unitType: document.getElementById('eim-add-shopping-unit')?.value || 'pcs',
      supplier: document.getElementById('eim-add-supplier')?.value.trim() || 'General Supplier',
      date: document.getElementById('eim-add-purchase-date')?.value || new Date().toISOString().split('T')[0],
      time: document.getElementById('eim-add-time-purchased')?.value || new Date().toTimeString().slice(0, 5)
    }];
  };

  // Generate unit records from purchase sets
  window.buildUnitsFromSets = function (assetId, sets, parentSupabaseId, startUnitNum) {
    const allUnits = [];
    const cached = (window.EQUIPMENT_UNITS_CACHE && window.EQUIPMENT_UNITS_CACHE[assetId]) || [];
    const maxExisting = cached.reduce((max, u) => Math.max(max, parseInt(u.unit_number) || 0), 0);
    let currentUnitNum = startUnitNum || (maxExisting > 0 ? maxExisting + 1 : 1);

    sets.forEach((st, sIdx) => {
      const q = parseInt(st.qty) || 0;
      for (let i = 0; i < q; i++) {
        const itemCode = buildItemCode(assetId, currentUnitNum);
        allUnits.push({
          equipment_id: parentSupabaseId || null,
          asset_id: assetId,
          item_code: itemCode,
          unit_number: currentUnitNum,
          condition: 'Good',
          status: 'Available',
          purchase_set_id: `SET-${sIdx + 1}`,
          purchase_date: st.date || new Date().toISOString().split('T')[0],
          time_purchased: st.time || (typeof getLocalDeviceTimeStr === 'function' ? getLocalDeviceTimeStr().slice(0, 5) : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`),
          purchase_cost: st.shoppingCost || st.unitCost || 0,
          supplier: st.supplier || 'Standard Supplier',
          source_location: st.supplier || 'Standard Supplier',
          qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(window.location.origin + '/scan.html?eq=' + itemCode)}`
        });
        currentUnitNum++;
      }
    });

    return allUnits;
  };

  // ==================== ACCORDION EXPANSION IN EQUIPMENT ASSETS TABLE ====================

    window.syncParentEquipmentWithUnits = async function (assetIdOrId) {
    if (!assetIdOrId) return null;
    const sb = getSbClient();
    if (!sb) return null;
    try {
      let parent = null;
      let pRes = await sb.from('equipment_inventory').select('*').eq('asset_id', assetIdOrId).maybeSingle();
      if (pRes.data) parent = pRes.data;
      else {
        let pRes2 = await sb.from('equipment_inventory').select('*').eq('id', assetIdOrId).maybeSingle();
        if (pRes2.data) parent = pRes2.data;
      }
      if (!parent) return null;

      const { data: units, error: uErr } = await sb.from('equipment_unit_items')
        .select('*')
        .eq('asset_id', parent.asset_id);

      if (uErr || !units || units.length === 0) return parent;

      let maint = 0, miss = 0, ret = 0, alloc = 0, disabled = 0;
      units.forEach(u => {
        const c = (u.condition || '').toLowerCase();
        const s = (u.status || '').toLowerCase();
        if (s === 'disabled') {
          disabled++;
        } else if (c === 'broken' || c === 'needs repair' || c === 'damaged' || c === 'poor' || s === 'maintenance') {
          maint++;
        } else if (c === 'missing' || s === 'missing') {
          miss++;
        } else if (c === 'retired' || c === 'trash' || s === 'retired') {
          ret++;
        } else if (s === 'allocated') {
          alloc++;
        }
      });

      const totalQty = units.length;
      const goodQty = Math.max(0, totalQty - maint - miss - ret - disabled);
      const availableQty = Math.max(0, goodQty - alloc);

      let conditionStr = 'Good';
      if (maint > 0 || miss > 0 || ret > 0) {
        conditionStr = 'Needs Maintenance';
      } else {
        conditionStr = 'Good';
      }

      const updatePayload = {
        good_qty: goodQty,
        maintenance_qty: maint,
        missing_qty: miss,
        retired_qty: ret,
        available_qty: availableQty,
        total_qty: totalQty,
        condition: conditionStr,
        updated_at: new Date().toISOString()
      };

      await sb.from('equipment_inventory').update(updatePayload).eq('id', parent.id);

      if (typeof EIM_ASSETS !== 'undefined' && Array.isArray(EIM_ASSETS)) {
        const cached = EIM_ASSETS.find(a => (a.asset_id || a.id) === parent.asset_id || (a.supabaseId || a.id) === parent.id);
        if (cached) {
          cached.good_qty = goodQty;
          cached.maintenance_qty = maint;
          cached.missing_qty = miss;
          cached.retired_qty = ret;
          cached.availableQty = availableQty;
          cached.quantity = totalQty;
          cached.condition = conditionStr;
        }
      }

      return Object.assign({}, parent, updatePayload);
    } catch (err) {
      console.error('[syncParentEquipmentWithUnits] Error:', err);
      return null;
    }
  };

  window.toggleEimAssetAccordion = async function (assetId) {
    if (!assetId) return;
    const cleanId = String(assetId).trim();
    const existingSubRow = document.getElementById(`eim-subrow-${cleanId}`);

    if (window._eimExpandedRows.has(cleanId)) {
      window._eimExpandedRows.delete(cleanId);
      if (existingSubRow) {
        existingSubRow.remove();
      } else if (typeof window.renderEIMTable === 'function') {
        window.renderEIMTable();
      }
      return;
    }

    // Instant Expansion (0ms delay)
    window._eimExpandedRows.add(cleanId);
    if (existingSubRow) {
      existingSubRow.style.display = '';
      return;
    }

    const assetList = window.EIM_ASSETS || (typeof EIM_ASSETS !== 'undefined' ? EIM_ASSETS : []);
    const asset = assetList.find(e => String(e.id || e.asset_id).trim() === cleanId || String(e.supabaseId || '').trim() === cleanId);

    let cached = window.EQUIPMENT_UNITS_CACHE ? (window.EQUIPMENT_UNITS_CACHE[cleanId] || (asset && (window.EQUIPMENT_UNITS_CACHE[asset.asset_id] || window.EQUIPMENT_UNITS_CACHE[asset.id]))) : null;
    const hasValidCache = Array.isArray(cached) && cached.length > 0 && cached[0] && cached[0].item_code;

    const mainRow = document.getElementById(`eim-row-${cleanId}`);

    // If units not cached yet, insert synthesized row immediately (0ms instant response)
    if (!hasValidCache) {
      if (mainRow && mainRow.parentNode && asset && typeof window.renderEimUnitSubRows === 'function') {
        const visibleCols = (typeof getEIMVisibleColumnIds === 'function') ? getEIMVisibleColumnIds() : [];
        const colSpan = (visibleCols.length || 10) + 1;
        const instantHtml = window.renderEimUnitSubRows(asset, colSpan);
        if (instantHtml && !document.getElementById(`eim-subrow-${cleanId}`)) {
          mainRow.insertAdjacentHTML('afterend', instantHtml);
        }
      }

      // Then fetch real units asynchronously and update the row smoothly
      try {
        const realUnits = await getEquipmentUnits(cleanId, true);
        if (realUnits && realUnits.length > 0 && asset && typeof window.renderEimUnitSubRows === 'function') {
          const visibleCols = (typeof getEIMVisibleColumnIds === 'function') ? getEIMVisibleColumnIds() : [];
          const colSpan = (visibleCols.length || 10) + 1;
          const updatedHtml = window.renderEimUnitSubRows(asset, colSpan);
          const curSubRow = document.getElementById(`eim-subrow-${cleanId}`);
          if (curSubRow && curSubRow.parentNode && updatedHtml) {
            curSubRow.outerHTML = updatedHtml;
          }
        }
      } catch (err) {
        console.warn('[toggleEimAssetAccordion] async units fetch notice:', err);
      }
      return;
    }

    // Direct DOM insertion right after clicked row without table rebuild
    if (mainRow && mainRow.parentNode && asset && typeof window.renderEimUnitSubRows === 'function') {
      const visibleCols = (typeof getEIMVisibleColumnIds === 'function') ? getEIMVisibleColumnIds() : [];
      const colSpan = (visibleCols.length || 10) + 1;
      const subRowHtml = window.renderEimUnitSubRows(asset, colSpan);
      if (subRowHtml) {
        mainRow.insertAdjacentHTML('afterend', subRowHtml);
        return;
      }
    }

    if (typeof window.renderEIMTable === 'function') {
      window.renderEIMTable();
    }
  };

  // Render expanded individual unit items row
  window.renderEimUnitSubRows = function (asset, colSpan) {
    if (!asset) return '';
    const assetId = asset.asset_id || asset.id;
    const isExpanded = window._eimExpandedRows && (window._eimExpandedRows.has(assetId) || window._eimExpandedRows.has(asset.id) || (asset.supabaseId && window._eimExpandedRows.has(asset.supabaseId)));
    if (!isExpanded) return '';

    let cachedUnits = null;
    if (window.EQUIPMENT_UNITS_CACHE) {
      cachedUnits = window.EQUIPMENT_UNITS_CACHE[assetId] || window.EQUIPMENT_UNITS_CACHE[asset.id] || (asset.supabaseId && window.EQUIPMENT_UNITS_CACHE[asset.supabaseId]);
    }
    const isValidCache = Array.isArray(cachedUnits) && cachedUnits.length > 0 && cachedUnits[0] && cachedUnits[0].item_code;
    const rawUnits = isValidCache ? cachedUnits : synthesizeUnitsForAsset(asset);

    const units = (rawUnits || []).filter(u => {
      const c = (u.condition || '').toLowerCase();
      const s = (u.status || '').toLowerCase();
      return c !== 'missing' && c !== 'retired' && s !== 'missing' && s !== 'retired';
    });

    // Strictly sort units: broken equipments shot to the top of the list (highest priority),
    // and list is reversed: newest equipment (#100) at top, oldest equipment (#1) at bottom.
    sortEquipmentUnitsReversedWithBrokenFirst(units);

    // Resolve purchase history and supplier directly from parent equipment for 100% data consistency
    let parentHist = Array.isArray(asset.purchase_history) ? asset.purchase_history : [];
    if (typeof asset.purchase_history === 'string') {
      try { parentHist = JSON.parse(asset.purchase_history); } catch(e) {}
    }
    const primaryPurchase = parentHist[0] || {};
    const parentDate = primaryPurchase.date || asset.purchase_date || asset.addedDate || '2026-10-08';
    const parentSupplier = primaryPurchase.supplier || asset.supplier || asset.sourceLocation || 'Initial Purchase';

    let rowsHtml = '';
    units.forEach(u => {
      const condColor = u.condition === 'Good' ? 'var(--green)' : (u.condition === 'Broken' ? 'var(--red)' : 'var(--orange)');
      const statColor = u.status === 'Available' ? 'var(--green)' : (u.status === 'Allocated' ? 'var(--gold)' : (u.status === 'Disabled' ? 'var(--red)' : 'var(--text-dim)'));
      const unitTypeLabel = asset.unitType || asset.unit_type || 'pcs';

      // Reference parent purchase history batch sequentially based on unit_number
      let matchedBatch = null;
      if (parentHist.length > 0) {
        let runningQty = 0;
        for (let b = 0; b < parentHist.length; b++) {
          runningQty += parseInt(parentHist[b].qty || 0);
          if (u.unit_number <= runningQty) {
            matchedBatch = parentHist[b];
            break;
          }
        }
        if (!matchedBatch) matchedBatch = parentHist[parentHist.length - 1];
      }

      const unitDate = (matchedBatch && matchedBatch.date) || u.purchase_date || parentDate;
      const unitTime = (matchedBatch && matchedBatch.time) || u.time_purchased || u.purchase_time || asset.timePurchased || asset.time_purchased || '09:00 AM';
      const unitSupplier = (matchedBatch && matchedBatch.supplier) || u.supplier || parentSupplier;

      const uNum = u.unit_number != null ? u.unit_number : (parseInt((String(u.item_code || '').match(/\d+$/) || ['1'])[0], 10));
      const code = u.item_code || buildItemCode(assetId, uNum);

      rowsHtml += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(255,255,255,0.015);">
          <td style="padding:8px 12px; font-size:11px; font-family:monospace; color:var(--gold); font-weight:700;">${escapeHtml(code)}</td>
          <td style="padding:8px 12px; font-size:12px; color:var(--cream);">${escapeHtml(asset.name)} #${uNum}</td>
          <td style="padding:8px 12px; font-size:11px; color:var(--cream); font-weight:600;">1 ${escapeHtml(unitTypeLabel)}</td>
          <td style="padding:8px 12px; font-size:11px; color:${condColor}; font-weight:600;">${escapeHtml(u.condition || 'Good')}</td>
          <td style="padding:8px 12px; font-size:11px; color:${statColor}; font-weight:600;">${escapeHtml(u.status || 'Available')}</td>
          <td style="padding:8px 12px; font-size:11px; color:var(--text);">${escapeHtml(unitSupplier || parentSupplier)}</td>
          <td style="padding:8px 12px; font-size:11px; color:var(--text);">${fmtDateStr(unitDate || parentDate)}</td>
          <td style="padding:8px 12px; font-size:11px; color:var(--text);">${escapeHtml(fmtTimeStr(unitTime))}</td>
          <td style="padding:8px 12px; text-align:right; white-space:nowrap;">
            <button type="button" onclick="window.showEquipmentQR('${escapeHtml(u.asset_id || assetId)}', '${escapeHtml(code)}')" class="btn-outline" style="font-size:10px; padding:3px 8px; display:inline-block; cursor:pointer;">Scan / QR</button>
            <button type="button" onclick="window.openEditUnitModal('${escapeHtml(code)}')" class="btn-outline" style="font-size:10px; padding:3px 8px; margin-left:4px; display:inline-block; cursor:pointer;">Edit</button>
            <button type="button" onclick="window.toggleDisableUnit('${escapeHtml(code)}')" class="btn-outline" style="font-size:10px; padding:3px 8px; margin-left:4px; display:inline-block; cursor:pointer; color:${u.status === 'Disabled' ? 'var(--green)' : 'var(--red)'};">${u.status === 'Disabled' ? 'Enable' : 'Disable'}</button>
          </td>
        </tr>
      `;
    });

    return `
      <tr class="eim-expanded-unit-row" id="eim-subrow-${assetId}" style="background:rgba(0,0,0,0.25);">
        <td colspan="${colSpan}" style="padding:12px 18px;">
          <div style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:12px; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px;">
              Individual Tracking Units (${units.length} total units)
            </div>
            <div style="font-size:11px; color:var(--text-dim);">
              Unique QR per unit enabled
            </div>
          </div>
          <div style="max-height:280px; overflow-y:auto; border:1px solid var(--border); border-radius:6px;">
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">UNIT ID</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">NAME</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">QUANTITY</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">CONDITION</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">STATUS</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">SUPPLIER</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">DATE PURCHASED</th>
                  <th style="padding:8px 12px; text-align:left; color:var(--text-dim); font-size:10px;">TIME PURCHASED</th>
                  <th style="padding:8px 12px; text-align:right; color:var(--text-dim); font-size:10px;">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  };

  // Unit Edit & Toggle Disable Handlers
  window.openEditUnitModal = async function(itemCode) {
    let u = null;
    const allCaches = Object.values(window.EQUIPMENT_UNITS_CACHE || {});
    for (let list of allCaches) {
      if (Array.isArray(list)) {
        u = list.find(x => x.item_code === itemCode);
        if (u) break;
      }
    }
    const sb = getSbClient();
    if (!u && sb) {
      try {
        const { data } = await sb.from('equipment_unit_items').select('*').eq('item_code', itemCode).maybeSingle();
        if (data) u = data;
      } catch(e) {}
    }
    if (!u) {
      alert('Unit not found: ' + itemCode);
      return;
    }

    const idInp = document.getElementById('unit-edit-id');
    const dateInp = document.getElementById('unit-edit-date');
    const timeInp = document.getElementById('unit-edit-time');
    const costInp = document.getElementById('unit-edit-cost');
    const supInp = document.getElementById('unit-edit-supplier');
    const descInp = document.getElementById('unit-edit-desc');

    if (idInp) idInp.value = u.item_code || '';
    if (dateInp) dateInp.value = (u.purchase_date || '').slice(0, 10);
    if (timeInp) timeInp.value = u.time_purchased || u.purchase_time || '';
    if (costInp) costInp.value = u.purchase_cost != null ? u.purchase_cost : '';
    if (supInp) supInp.value = u.supplier || '';
    if (descInp) descInp.value = u.notes || u.description || '';

    window._editingUnitAssetId = u.asset_id;
    window._editingUnitCode = u.item_code;

    document.getElementById('eim-edit-indiv-overlay')?.classList.add('on');
    document.getElementById('eim-edit-indiv-modal')?.classList.add('open');
  };

  window.closeEditIndividualModal = function() {
    document.getElementById('eim-edit-indiv-overlay')?.classList.remove('on');
    document.getElementById('eim-edit-indiv-modal')?.classList.remove('open');
  };

  window.saveEditUnitModal = async function() {
    const itemCode = window._editingUnitCode;
    const assetId = window._editingUnitAssetId;
    if (!itemCode) return;

    const dateVal = document.getElementById('unit-edit-date')?.value || null;
    const timeVal = document.getElementById('unit-edit-time')?.value || null;
    const costVal = parseFloat(document.getElementById('unit-edit-cost')?.value) || 0;
    const supVal = document.getElementById('unit-edit-supplier')?.value || '';
    const descVal = document.getElementById('unit-edit-desc')?.value || '';

    const sb = getSbClient();
    if (sb) {
      try {
        const unitUpdatePayload = {
          purchase_date: dateVal,
          time_purchased: timeVal,
          purchase_cost: costVal,
          supplier: supVal,
          notes: descVal
        };
        let { error } = await sb.from('equipment_unit_items').update(unitUpdatePayload).eq('item_code', itemCode);
        if (error && (error.message || '').includes('time_purchased')) {
          delete unitUpdatePayload.time_purchased;
          await sb.from('equipment_unit_items').update(unitUpdatePayload).eq('item_code', itemCode);
        }
      } catch (err) {
        console.warn('[saveEditUnitModal] Error:', err);
      }
    }

    if (assetId && window.EQUIPMENT_UNITS_CACHE[assetId]) {
      const match = window.EQUIPMENT_UNITS_CACHE[assetId].find(x => x.item_code === itemCode);
      if (match) {
        match.purchase_date = dateVal;
        match.time_purchased = timeVal;
        match.purchase_cost = costVal;
        match.supplier = supVal;
        match.notes = descVal;
      }
    }

    if (typeof recordEIMLog === 'function') {
      const aObj = (typeof EIM_ASSETS !== 'undefined') ? EIM_ASSETS.find(a => (a.asset_id === assetId || a.id === assetId)) : null;
      recordEIMLog({
        action: 'Edited Unit Details',
        eqId: itemCode,
        item_code: itemCode,
        equipment_id: assetId,
        eqName: (aObj ? aObj.name : 'Equipment') + ` (${itemCode})`,
        shoppingCost: costVal,
        supplier: supVal || 'Standard Supplier',
        details: `Updated details for unit ${itemCode}: Supplier "${supVal || 'Standard Supplier'}", Cost ₱${costVal.toLocaleString()}.`
      });
    }

    window.closeEditIndividualModal();
    if (typeof renderEIMTable === 'function') renderEIMTable();
    if (typeof showToast === 'function') showToast(`Unit ${itemCode} updated successfully.`, 'success');
  };

  window.toggleDisableUnit = async function(itemCode) {
    if (!itemCode) return;
    const sb = getSbClient();
    if (!sb) return;

    try {
      const { data: u } = await sb.from('equipment_unit_items').select('*').eq('item_code', itemCode).maybeSingle();
      if (!u) return;

      // If ENABLING:
      if (u.status === 'Disabled') {
        await sb.from('equipment_unit_items').update({ status: 'Available' }).eq('item_code', itemCode);
        if (window.EQUIPMENT_UNITS_CACHE && window.EQUIPMENT_UNITS_CACHE[u.asset_id]) {
          const match = window.EQUIPMENT_UNITS_CACHE[u.asset_id].find(x => x.item_code === itemCode);
          if (match) match.status = 'Available';
        }
        if (typeof window.syncParentEquipmentWithUnits === 'function') {
          await window.syncParentEquipmentWithUnits(u.asset_id);
        }
        if (typeof recordEIMLog === 'function') {
          const aObj = (typeof EIM_ASSETS !== 'undefined') ? EIM_ASSETS.find(a => (a.asset_id === u.asset_id || a.id === u.asset_id)) : null;
          recordEIMLog({
            action: 'Unit Enabled',
            eqId: itemCode,
            item_code: itemCode,
            equipment_id: u.asset_id,
            eqName: (aObj ? aObj.name : 'Equipment') + ` (${itemCode})`,
            details: `Unit ${itemCode} status changed to Available.`
          });
        }
        if (typeof renderEIMTable === 'function') renderEIMTable();
        if (typeof showToast === 'function') showToast(`Unit ${itemCode} status changed to Available.`, 'info');
        return;
      }

      // === If DISABLING: verify not allocated and not used in event setups ===
      const aObj = (typeof EIM_ASSETS !== 'undefined') ? EIM_ASSETS.find(a => (a.asset_id === u.asset_id || a.id === u.asset_id)) : null;
      const eqName = (aObj?.name || '').toLowerCase().trim();
      const assetId = (u.asset_id || '').toUpperCase().trim();

      const isDirectlyAllocated = (u.status || '').toLowerCase() === 'allocated' || !!u.allocated_reservation_id || !!u.allocation_batch;

      const activeStatuses = ['Confirmed', 'Approved', 'Ongoing', 'on-going', 'Pending', 'Awaiting Payment'];
      const matchingReservations = (window.RESERVATIONS || []).filter(r => {
        if (!activeStatuses.includes(r.status)) return false;
        const manifest = r.equipmentManifest || [];
        const inManifest = manifest.some(m => {
          const mName = (m.name || '').toLowerCase().trim();
          const mId = (m.assetId || '').toUpperCase().trim();
          return mId === assetId || mName === eqName;
        });
        const pItems = (r.packageItems || r.items || []).map(i => (typeof i === 'string' ? i : (i.name || '')).toLowerCase().trim());
        const hasItem = pItems.some(n => n === eqName || n.includes(eqName) || eqName.includes(n));
        return inManifest || hasItem;
      });

      const matchingSetups = (window.sbEventSetups || []).filter(s => {
        let items = [];
        try { items = typeof s.equipment_items === 'string' ? JSON.parse(s.equipment_items) : (s.equipment_items || []); } catch(e) {}
        return items.some(i => {
          const iName = (typeof i === 'string' ? i : (i.name || '')).toLowerCase().trim();
          return iName === eqName || iName.includes(eqName) || eqName.includes(iName);
        });
      });

      const inSetup = matchingSetups.length > 0;
      const inReservation = isDirectlyAllocated || matchingReservations.length > 0;

      if (inSetup || inReservation) {
        let contextParts = [];
        if (inSetup && inReservation) contextParts = ['an event setup', 'an active reservation / allocation'];
        else if (inSetup) contextParts = ['an event setup'];
        else contextParts = ['an active reservation / allocation'];

        const modal = document.getElementById('eq-disable-blocked-modal');
        const overlay = document.getElementById('eq-disable-blocked-overlay');
        const msg = document.getElementById('eq-disable-blocked-message');
        const sub = document.getElementById('eq-disable-blocked-subtitle');
        const lists = document.getElementById('eq-disable-blocked-lists');

        if (modal && overlay && msg && sub && lists) {
          sub.textContent = `${itemCode} (${aObj?.name || u.asset_id})`;
          msg.innerHTML = `<strong>"${itemCode}"</strong> cannot be disabled because it is currently allocated or part of ${contextParts.join(' and ')}. Remove it from active allocation before disabling.`;

          let listsHtml = '';
          if (inSetup) {
            listsHtml += `
              <div>
                <div style="font-size:11px; font-weight:800; color:var(--gold); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;">Event Setups</div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                  ${matchingSetups.map(s => `
                    <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(196,154,60,0.07); border:1px solid rgba(196,154,60,0.18); border-radius:8px;">
                      <div style="width:7px; height:7px; border-radius:50%; background:var(--gold); flex-shrink:0;"></div>
                      <span style="font-size:13px; font-weight:600; color:var(--cream);">${s.name || 'Unnamed Setup'}</span>
                    </div>`).join('')}
                </div>
              </div>`;
          }
          if (inReservation) {
            listsHtml += `
              <div>
                <div style="font-size:11px; font-weight:800; color:var(--gold); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:6px;">Allocated Reservation</div>
                <div style="display:flex; flex-direction:column; gap:5px;">
                  <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:rgba(196,154,60,0.07); border:1px solid rgba(196,154,60,0.18); border-radius:8px;">
                    <div style="width:7px; height:7px; border-radius:50%; background:var(--gold); flex-shrink:0;"></div>
                    <span style="font-size:13px; font-weight:600; color:var(--cream);">${u.allocated_reservation_id || (matchingReservations[0]?.client ? matchingReservations[0].client + ' Event' : 'Active Reservation Allocation')}</span>
                  </div>
                </div>
              </div>`;
          }
          lists.innerHTML = listsHtml;
          overlay.style.display = 'block';
          modal.style.display = 'block';
        } else {
          alert(`"${itemCode}" cannot be disabled because it is currently allocated or being used in an event setup.`);
        }
        return;
      }

      await sb.from('equipment_unit_items').update({ status: 'Disabled' }).eq('item_code', itemCode);

      if (window.EQUIPMENT_UNITS_CACHE && window.EQUIPMENT_UNITS_CACHE[u.asset_id]) {
        const match = window.EQUIPMENT_UNITS_CACHE[u.asset_id].find(x => x.item_code === itemCode);
        if (match) match.status = 'Disabled';
      }

      if (typeof window.syncParentEquipmentWithUnits === 'function') {
        await window.syncParentEquipmentWithUnits(u.asset_id);
      }

      if (typeof recordEIMLog === 'function') {
        recordEIMLog({
          action: 'Unit Disabled',
          eqId: itemCode,
          item_code: itemCode,
          equipment_id: u.asset_id,
          eqName: (aObj ? aObj.name : 'Equipment') + ` (${itemCode})`,
          details: `Unit ${itemCode} status changed to Disabled.`
        });
      }

      if (typeof renderEIMTable === 'function') renderEIMTable();
      if (typeof showToast === 'function') showToast(`Unit ${itemCode} disabled successfully.`, 'info');
    } catch (err) {
      console.error('[toggleDisableUnit] Error:', err);
    }
  };

  window._manifestAllocState = window._manifestAllocState || {};
  window._manifestSeeAllState = window._manifestSeeAllState || {};

  // 1. ROUTINE EQUIPMENT CHECK ACCORDION
  window.toggleRcUnitList = async function(idx, assetId) {
    const panel = document.getElementById(`ri-units-panel-${idx}`);
    if (!panel) return;
    if (panel.style.display !== 'none') {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = 'block';
    panel.style.gridColumn = '1 / -1';
    panel.style.width = '100%';
    panel.style.boxSizing = 'border-box';
    panel.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:8px;">Loading units for ' + escapeHtml(assetId) + '...</div>';

    try {
      const rawUnits = await getEquipmentUnits(assetId);
      const units = (rawUnits || []).filter(u => {
        const c = (u.condition || '').toLowerCase();
        const s = (u.status || '').toLowerCase();
        return c !== 'missing' && c !== 'retired' && s !== 'missing' && s !== 'retired';
      });
      if (!units || units.length === 0) {
        panel.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:8px;">No active individual unit records found (missing/retired units are excluded).</div>';
        return;
      }

      const curItem = (typeof activeRoutineCheck !== 'undefined' && activeRoutineCheck && activeRoutineCheck.items) ? activeRoutineCheck.items[idx] : null;

      sortEquipmentUnitsReversedWithBrokenFirst(units);
      let rowsHtml = '';
      units.forEach(u => {
        const cond = u.condition || 'Good';
        const condColor = cond === 'Good' ? 'var(--green)' : (cond === 'Broken' ? 'var(--red)' : 'var(--orange)');
        const statColor = u.status === 'Available' ? 'var(--green)' : (u.status === 'Allocated' ? 'var(--gold)' : 'var(--text-dim)');

        const isBroken = (cond.toLowerCase() === 'broken' || (u.status || '').toLowerCase() === 'maintenance');
        const alreadyInCheck = curItem && curItem.incidents && curItem.incidents.some(inc => inc.item_code === u.item_code);

        let actionBtn = '';
        if (isBroken || alreadyInCheck) {
          actionBtn = `<span style="font-size:10px; color:var(--text-dim); padding:3px 8px; border:1px solid var(--border); border-radius:4px; margin-right:4px; font-weight:600;">Already Reported</span>`;
        } else {
          actionBtn = `<button type="button" class="btn-reject" style="font-size:10px; padding:3px 8px; cursor:pointer; margin-right:4px;" onclick="window.openRcUnitIncidentReport('${escapeHtml(u.item_code)}', '${escapeHtml(assetId)}', ${idx})">Report Incident</button>`;
        }

        rowsHtml += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:6px 10px; font-family:monospace; color:var(--gold); font-weight:700;">${escapeHtml(u.item_code)}</td>
            <td style="padding:6px 10px; color:${condColor}; font-weight:600;">${escapeHtml(cond)}</td>
            <td style="padding:6px 10px; color:${statColor}; font-weight:600;">${escapeHtml(u.status || 'Available')}</td>
            <td style="padding:6px 10px; color:var(--text);">${escapeHtml(u.supplier || '—')}</td>
            <td style="padding:6px 10px; text-align:right; white-space:nowrap;">
              ${actionBtn}
              <button type="button" onclick="window.showEquipmentQR('${escapeHtml(u.asset_id)}', '${escapeHtml(u.item_code)}')" class="btn-outline" style="font-size:10px; padding:3px 8px; cursor:pointer;">Scan / QR</button>
            </td>
          </tr>
        `;
      });
      panel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:11px; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px;">
            Unique Units for ${escapeHtml(assetId)} (${units.length} total units)
          </span>
          <span style="font-size:11px; color:var(--text-dim);">
            Click Scan to inspect or Report Incident to record damage specifically
          </span>
        </div>
        <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border); border-radius:6px;">
          <table style="width:100%; border-collapse:collapse; font-size:11px; width:100%;">
            <thead style="background:rgba(255,255,255,0.04); border-bottom:1px solid var(--border);">
              <tr>
                <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">UNIT ID</th>
                <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">CONDITION</th>
                <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">STATUS</th>
                <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">SUPPLIER</th>
                <th style="padding:6px 10px; text-align:right; color:var(--text-dim);">ACTIONS</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    } catch(e) {
      panel.innerHTML = '<div style="font-size:11px;color:var(--red);padding:8px;">Error loading units: ' + escapeHtml(e.message || e) + '</div>';
    }
  };

  window.openRcUnitIncidentReport = async function(itemCode, assetId, itemIdx) {
    if (typeof activeRoutineCheck === 'undefined' || !activeRoutineCheck) return;
    const item = activeRoutineCheck.items[itemIdx];
    if (!item) return;

    if (!item.incidents) item.incidents = [];

    // Prevent duplicate reporting
    let existing = item.incidents.find(inc => inc.item_code === itemCode);
    if (existing) {
      alert(`Unit ${itemCode} has already been reported in this check.`);
      return;
    }

    if (item.status === 'good') {
      item.checked = false;
      item.status = null;
    }

    if (!window.EQUIPMENT_UNITS_CACHE[assetId]) {
      await getEquipmentUnits(assetId);
    }

    item.incidents.push({
      type: 'broken',
      qty: 1,
      specific: true,
      item_code: itemCode,
      imageUrl: null,
      imagePublicId: null
    });

    if (typeof renderActiveChecklist === 'function') {
      renderActiveChecklist();
    }
    // Re-open accordion after re-render
    setTimeout(() => {
      const p = document.getElementById(`ri-units-panel-${itemIdx}`);
      if (p) {
        p.style.display = 'block';
        window.toggleRcUnitList(itemIdx, assetId);
      }
    }, 50);
  };

  // 2. BATCH ALLOCATION ITEM ACCORDION (EXECUTION DAY / VIEW ALLOCATIONS)
  window.toggleBatchAllocItemUnits = async function(subRowId, assetId, batchName, qty) {
    const subRow = document.getElementById(subRowId);
    if (!subRow) return;
    if (subRow.style.display !== 'none') {
      subRow.style.display = 'none';
      return;
    }
    subRow.style.display = '';
    const td = subRow.querySelector('td');
    if (td) td.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:6px;">Loading allocated units for ' + escapeHtml(assetId) + '...</div>';

    try {
      const units = await getEquipmentUnits(assetId);
      let allocUnits = units.filter(u => u.allocation_batch === batchName);
      if (!allocUnits.length) {
        allocUnits = units.slice(0, Math.max(1, parseInt(qty) || 1));
      }

      let rowsHtml = '';
      allocUnits.forEach(u => {
        const cond = u.condition || 'Good';
        const condColor = cond === 'Good' ? 'var(--green)' : (cond === 'Broken' ? 'var(--red)' : 'var(--orange)');
        rowsHtml += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:6px 10px; font-family:monospace; color:var(--gold); font-weight:700;">${escapeHtml(u.item_code)}</td>
            <td style="padding:6px 10px; color:${condColor}; font-weight:600;">${escapeHtml(cond)}</td>
            <td style="padding:6px 10px; color:var(--gold); font-weight:600;">Allocated</td>
            <td style="padding:6px 10px; text-align:right;">
              <a href="scan.html?eq=${encodeURIComponent(u.item_code)}" target="_blank" class="btn-outline" style="font-size:10px; padding:2px 8px; text-decoration:none;">Open Scan</a>
            </td>
          </tr>
        `;
      });

      if (td) {
        td.innerHTML = `
          <div style="font-size:11px; font-weight:700; color:var(--gold); margin-bottom:6px; text-transform:uppercase;">
            Allocated Unique Units for ${escapeHtml(batchName)} (${allocUnits.length} units assigned via FIFO):
          </div>
          <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border); border-radius:6px;">
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <thead style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">UNIT ID</th>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">CONDITION</th>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">STATUS</th>
                  <th style="padding:6px 10px; text-align:right; color:var(--text-dim);">ACTION</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      }
    } catch(e) {
      if (td) td.innerHTML = '<div style="font-size:11px;color:var(--red);">Error loading units: ' + escapeHtml(e.message || e) + '</div>';
    }
  };

  // 3. DEPLOYMENT MANIFEST INTERACTIVE UNIT ACCORDION & REALTIME ALLOCATION ENGINE
  window.toggleManifestUnitSubRow = async function(assetId, lineIdx) {
    if (!assetId) return;
    const cleanId = String(assetId).trim();
    const subRow = document.getElementById(`manifest-subrow-${cleanId}`);
    if (!subRow) return;

    if (subRow.style.display !== 'none') {
      subRow.style.display = 'none';
      return;
    }
    subRow.style.display = '';
    const td = subRow.querySelector('td');
    if (td) {
      td.colSpan = 12;
      td.style.width = '100%';
      td.style.boxSizing = 'border-box';
      td.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:8px;">Loading units for ' + escapeHtml(cleanId) + '...</div>';
    }

    try {
      const isAllocMode = !!(window._allocMode || window._isAssignAllocationMode);
      let stateUnits = window._manifestAllocState[cleanId];

      // Robust target quantity resolution
      let targetQty = 0;
      const inputEl = (lineIdx != null) ? document.getElementById(`alloc-qty-input-${lineIdx}`) : null;
      if (inputEl) {
        targetQty = parseInt(inputEl.value) || 0;
      }
      if (!targetQty && typeof _lastGeneratedManifest !== 'undefined' && Array.isArray(_lastGeneratedManifest)) {
        let line = _lastGeneratedManifest[lineIdx];
        if (!line || (line.assetId || '').trim() !== cleanId) {
          line = _lastGeneratedManifest.find(l => (l.assetId || '').trim() === cleanId);
        }
        if (line) {
          targetQty = line.allocatedQty != null ? line.allocatedQty : (line.finalReq != null ? line.finalReq : 0);
        }
      }
      targetQty = Math.max(0, parseInt(targetQty) || 0);

      if (!stateUnits || stateUnits.length === 0) {
        const rawUnits = await getEquipmentUnits(cleanId);
        // Exclude retired and missing units so they never appear in manifest, never count on total available
        const activeUnits = (rawUnits || []).filter(u => {
          const cond = (u.condition || '').toLowerCase();
          const stat = (u.status || '').toLowerCase();
          return cond !== 'retired' && stat !== 'retired' && cond !== 'missing' && stat !== 'missing';
        });

        stateUnits = activeUnits.map(u => ({
          ...u,
          allocatedQty: 0
        }));
        window._manifestAllocState[cleanId] = stateUnits;
      }

      // CRITICAL GUARANTEE: In allocation mode, if targetQty > 0 and currently allocated < targetQty,
      // it is strictly IMPOSSIBLE to leave units unallocated! Auto-allocate immediately!
      if (isAllocMode && targetQty > 0) {
        let currentAllocated = stateUnits.filter(u => (u.allocatedQty || 0) > 0).length;
        if (currentAllocated < targetQty) {
          // Pass 1: Allocate Good + Available units first
          for (let i = 0; i < stateUnits.length && currentAllocated < targetQty; i++) {
            const u = stateUnits[i];
            const isGood = (u.condition || 'Good').toLowerCase() === 'good';
            const isAvail = (u.status || 'Available').toLowerCase() === 'available';
            if (!u.allocatedQty && isGood && isAvail) {
              u.allocatedQty = 1;
              currentAllocated++;
            }
          }
          // Pass 2: Allocate any remaining active units if needed
          for (let i = 0; i < stateUnits.length && currentAllocated < targetQty; i++) {
            const u = stateUnits[i];
            if (!u.allocatedQty) {
              u.allocatedQty = 1;
              currentAllocated++;
            }
          }
        }
      }

      window.renderManifestSubRowContent(cleanId, lineIdx);
    } catch(e) {
      if (td) td.innerHTML = '<div style="font-size:11px;color:var(--red);padding:8px;">Error loading manifest units: ' + escapeHtml(e.message || e) + '</div>';
    }
  };

  window.renderManifestSubRowContent = function(cleanId, lineIdx) {
    const subRow = document.getElementById(`manifest-subrow-${cleanId}`);
    if (!subRow) return;
    const td = subRow.querySelector('td');
    if (!td) return;

    td.colSpan = 12;
    td.style.width = '100%';
    td.style.boxSizing = 'border-box';

    const isAllocMode = !!(window._allocMode || window._isAssignAllocationMode);
    // Filter out retired and missing units so they never appear in deployment manifest table
    const rawUnits = window._manifestAllocState[cleanId] || [];
    const stateUnits = rawUnits.filter(u => {
      const cond = (u.condition || '').toLowerCase();
      const stat = (u.status || '').toLowerCase();
      return cond !== 'retired' && stat !== 'retired' && cond !== 'missing' && stat !== 'missing';
    });

    // Determine target quantity for safety check
    let inputEl = (lineIdx != null) ? document.getElementById(`alloc-qty-input-${lineIdx}`) : null;
    let targetQty = inputEl ? (parseInt(inputEl.value) || 0) : 0;
    if (!targetQty && typeof _lastGeneratedManifest !== 'undefined' && Array.isArray(_lastGeneratedManifest)) {
      const line = _lastGeneratedManifest.find(l => (l.assetId || '').trim() === cleanId) || _lastGeneratedManifest[lineIdx];
      if (line) targetQty = line.allocatedQty != null ? line.allocatedQty : (line.finalReq || 0);
    }

    let totalAllocated = stateUnits.filter(u => u.allocatedQty > 0).length;
    // Safety auto-allocation guarantee: never allow 0 units allocated when targetQty > 0 in allocation mode
    if (isAllocMode && targetQty > 0 && totalAllocated < targetQty) {
      for (let i = 0; i < stateUnits.length && totalAllocated < targetQty; i++) {
        if (!stateUnits[i].allocatedQty) {
          stateUnits[i].allocatedQty = 1;
          totalAllocated++;
        }
      }
    }

    // Units always appear directly on the list : never hide behind empty state
    const displayUnits = stateUnits;

    let rowsHtml = '';
    displayUnits.forEach(u => {
      const cond = u.condition || 'Good';
      const condColor = cond === 'Good' ? 'var(--green)' : (cond === 'Broken' ? 'var(--red)' : 'var(--orange)');
      const statColor = u.allocatedQty > 0 ? 'var(--gold)' : (u.status === 'Available' ? 'var(--green)' : 'var(--text-dim)');
      const statLabel = u.allocatedQty > 0 ? 'Allocated' : (u.status || 'Available');

      rowsHtml += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:${u.allocatedQty > 0 ? 'rgba(234,179,8,0.03)' : 'transparent'};">
          <td style="padding:6px 12px; font-family:monospace; color:var(--gold); font-weight:700;">${escapeHtml(u.item_code)}</td>
          <td style="padding:6px 12px; color:${condColor}; font-weight:600;">${escapeHtml(cond)}</td>
          <td style="padding:6px 12px; color:${statColor}; font-weight:600;">${escapeHtml(statLabel)}</td>
          ${isAllocMode ? `
            <td style="padding:6px 12px; text-align:center;">
              <input type="number" min="0" max="1" value="${u.allocatedQty || 0}"
                style="width:54px; text-align:center; padding:3px 6px; font-weight:700; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:${u.allocatedQty > 0 ? 'var(--gold)' : 'var(--text-dim)'}; border-radius:4px;"
                onchange="window.updateManifestUnitAllocQty('${escapeHtml(cleanId)}', '${escapeHtml(u.item_code)}', this.value, ${lineIdx})" />
            </td>
          ` : ''}
          <td style="padding:6px 12px; text-align:right;">
            <a href="scan.html?eq=${encodeURIComponent(u.item_code)}" target="_blank" class="btn-outline" style="font-size:10px; padding:2px 8px; text-decoration:none;">Open Scan</a>
          </td>
        </tr>
      `;
    });

    td.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:gap:8px;">
        <span style="font-size:11px; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.5px;">
          ${isAllocMode ? `Allocated Units for Manifest · ${escapeHtml(cleanId)} (${totalAllocated} allocated / ${stateUnits.length} total)` : `Equipment Units · ${escapeHtml(cleanId)} (${stateUnits.length} units total)`}
        </span>
        <span style="font-size:11px; color:var(--text-dim);">
          ${isAllocMode ? 'Toggle 1 or 0 to assign specific individual equipment items' : 'Unique equipment units and condition states'}
        </span>
      </div>
      <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border); border-radius:6px; background:rgba(0,0,0,0.2);">
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border);">
            <tr>
              <th style="padding:6px 12px; text-align:left; color:var(--text-dim);">UNIT ID</th>
              <th style="padding:6px 12px; text-align:left; color:var(--text-dim);">CONDITION</th>
              <th style="padding:6px 12px; text-align:left; color:var(--text-dim);">STATUS</th>
              ${isAllocMode ? '<th style="padding:6px 12px; text-align:center; color:var(--text-dim);">ALLOCATED QUANTITY</th>' : ''}
              <th style="padding:6px 12px; text-align:right; color:var(--text-dim);">ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="${isAllocMode ? 5 : 4}" style="padding:12px; text-align:center; color:var(--text-dim);">No active units found for this equipment.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
        ${isAllocMode ? `
          <span style="font-size:11px; color:var(--gold); font-weight:700;">
            Total Qty: ${totalAllocated}
          </span>
        ` : `
          <span style="font-size:11px; color:var(--text-dim);">Total Units: ${stateUnits.length}</span>
        `}
      </div>
    `;
  };

  window.toggleManifestSeeAll = function(cleanId, lineIdx) {
    window.renderManifestSubRowContent(cleanId, lineIdx);
  };

  window.updateManifestUnitAllocQty = function(cleanId, itemCode, val, lineIdx) {
    const stateUnits = window._manifestAllocState[cleanId];
    if (!stateUnits) return;

    const parsedVal = Math.max(0, Math.min(1, parseInt(val) || 0));
    const targetUnit = stateUnits.find(u => u.item_code === itemCode);
    if (targetUnit) {
      targetUnit.allocatedQty = parsedVal;
    }

    const newTotal = stateUnits.filter(u => u.allocatedQty > 0).length;
    const inputEl = document.getElementById(`alloc-qty-input-${lineIdx}`);
    if (inputEl) {
      inputEl.value = newTotal;
    }

    window.renderManifestSubRowContent(cleanId, lineIdx);
  };

  window.onManifestMainQtyChanged = function(cleanId, newQty, lineIdx) {
    const stateUnits = window._manifestAllocState[cleanId];
    if (!stateUnits) return;

    const targetCount = Math.max(0, parseInt(newQty) || 0);
    let currentAllocated = stateUnits.filter(u => u.allocatedQty > 0).length;

    if (targetCount > currentAllocated) {
      // Allocate next available good unit
      for (let i = 0; i < stateUnits.length && currentAllocated < targetCount; i++) {
        const u = stateUnits[i];
        if (!u.allocatedQty && (u.condition || 'Good').toLowerCase() === 'good') {
          u.allocatedQty = 1;
          currentAllocated++;
        }
      }
      // If still need more, allocate any available unit
      for (let i = 0; i < stateUnits.length && currentAllocated < targetCount; i++) {
        if (!stateUnits[i].allocatedQty) {
          stateUnits[i].allocatedQty = 1;
          currentAllocated++;
        }
      }
    } else if (targetCount < currentAllocated) {
      // Unallocate the farthest allocated unit
      for (let i = stateUnits.length - 1; i >= 0 && currentAllocated > targetCount; i--) {
        if (stateUnits[i].allocatedQty > 0) {
          stateUnits[i].allocatedQty = 0;
          currentAllocated--;
        }
      }
    }

    const subRow = document.getElementById(`manifest-subrow-${cleanId}`);
    if (subRow && subRow.style.display !== 'none') {
      window.renderManifestSubRowContent(cleanId, lineIdx);
    }
  };

  // 4. BATCH ALLOCATION HISTORY SUB-ROW BUILDER & ACCORDION
  window.renderAllocHistoryItemSubRow = function(it, itIdx) {
    return `<tr class="alloc-history-item-subrow" style="display:none; background:rgba(0,0,0,0.35);">
      <td colspan="5" style="padding:10px 18px; width:100%; box-sizing:border-box;">
        <div style="font-size:11px; color:var(--text-dim);">Loading allocated unique units...</div>
      </td>
    </tr>`;
  };

  window.toggleAllocHistoryItemUnits = async function(trEl, itIdx, assetId, allocQty) {
    const subRow = trEl.nextElementSibling;
    if (!subRow || !subRow.classList.contains('alloc-history-item-subrow')) return;
    if (subRow.style.display !== 'none') {
      subRow.style.display = 'none';
      return;
    }
    subRow.style.display = '';
    const td = subRow.querySelector('td');
    if (td) td.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:6px;">Loading allocated units for ' + escapeHtml(assetId) + '...</div>';

    try {
      const units = await getEquipmentUnits(assetId);
      const q = parseInt(allocQty) || 20;
      const displayUnits = units.slice(0, Math.max(1, q));

      let rowsHtml = '';
      displayUnits.forEach(u => {
        const cond = u.condition || 'Good';
        const condColor = cond === 'Good' ? 'var(--green)' : (cond === 'Broken' ? 'var(--red)' : 'var(--orange)');
        const replacementNote = cond === 'Broken'
          ? '<span style="color:var(--orange); font-size:10px; font-weight:600;">Damaged · Auto-replaced by Unit #' + (displayUnits.length + 1) + '</span>'
          : '<span style="color:var(--cream); font-size:10px;">Active Allocation</span>';

        rowsHtml += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
            <td style="padding:6px 10px; font-family:monospace; color:var(--gold); font-weight:700;">${escapeHtml(u.item_code)}</td>
            <td style="padding:6px 10px; color:${condColor}; font-weight:600;">${escapeHtml(cond)}</td>
            <td style="padding:6px 10px; color:var(--cream);">${escapeHtml(u.status || 'Allocated')}</td>
            <td style="padding:6px 10px;">${replacementNote}</td>
            <td style="padding:6px 10px; text-align:right;">
              <a href="scan.html?eq=${encodeURIComponent(u.item_code)}" target="_blank" class="btn-outline" style="font-size:10px; padding:2px 8px; text-decoration:none;">Open Scan</a>
            </td>
          </tr>
        `;
      });

      if (td) {
        td.innerHTML = `
          <div style="font-size:11px; font-weight:700; color:var(--gold); margin-bottom:6px; text-transform:uppercase;">
            Batch Allocated Units Breakdown (${displayUnits.length} total units):
          </div>
          <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border); border-radius:6px;">
            <table style="width:100%; border-collapse:collapse; font-size:11px;">
              <thead style="background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border);">
                <tr>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">UNIT ID</th>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">CONDITION</th>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">STATUS</th>
                  <th style="padding:6px 10px; text-align:left; color:var(--text-dim);">STATUS / REPLACEMENT</th>
                  <th style="padding:6px 10px; text-align:right; color:var(--text-dim);">ACTION</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
      }
    } catch(e) {
      if (td) td.innerHTML = '<div style="font-size:11px;color:var(--red);">Error loading units: ' + escapeHtml(e.message || e) + '</div>';
    }
  };

  window.HalServeUnitTracker = {
    getEquipmentUnits,
    persistEquipmentUnits,
    allocateUnitsFIFO,
    replaceDamagedUnit,
    synthesizeUnitsForAsset,
    buildItemCode
  };

})(window);
