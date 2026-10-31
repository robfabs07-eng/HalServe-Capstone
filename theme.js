// ===== UNIVERSAL THEME TOGGLE =====
// Reads from localStorage, applies [data-theme] to <html>, updates all toggle buttons

(function () {
  const STORAGE_KEY = 'halden_theme';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    // Update all toggle buttons on the page
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.innerHTML = theme === 'dark'
        ? '<div style="display:flex; align-items:center; gap:10px;"><div style="width:14px; height:14px; border:2px solid currentColor; border-radius:50%; background:transparent; opacity:0.8;"></div><span class="theme-label" style="font-weight:500;">Light Mode</span></div>'
        : '<div style="display:flex; align-items:center; gap:10px;"><div style="width:14px; height:14px; border:2px solid currentColor; border-radius:50%; background:transparent; opacity:0.8;"></div><span class="theme-label" style="font-weight:500;">Dark Mode</span></div>';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function toggleTheme() {
    const current = getTheme();
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Apply immediately before paint (FOUC prevention)
  applyTheme(getTheme());

  // Expose globally
  window.toggleTheme = toggleTheme;
  window.applyTheme = applyTheme;
  window.getTheme = getTheme;

  // After DOM is ready, bind any already-rendered buttons
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getTheme()); // refresh button labels after DOM builds
  });
})();

// ===== SPECIAL ITEMS & PARENT-CHILD HELPERS (GLOBALLY ACCESSIBLE) =====
window.isSpecialParentItem = function (item) {
  if (!item) return false;
  const name = typeof item === 'string' ? item : (item.name || '');
  const _cat = typeof CAT !== 'undefined' ? CAT : [];
  const entry = typeof item === 'object' ? item : _cat.find(c => c.name === name);
  const ident = entry ? (entry.identify || '').toLowerCase() : '';
  const n = name.toLowerCase();

  if (ident.includes('option') || n.includes('option')) return false;

  // Explicit flag check
  if (entry && (entry.isSpecialMaster || entry.is_special || entry.isMasterSpecial)) return true;

  // Preset master identifiers
  if (ident === 'drinks_package' || ident === 'mobile_bar' || ident === 'ice_cream' || ident === 'special') return true;

  // Master name matches
  if (n.includes('unlimited drinks') || n.includes('mobile bar') || n.includes('ice cream')) return true;

  // Check ingredients string (master special items have "per_X_pax" or "sub_items:")
  const ingStr = entry ? (entry.rawIngredients || entry.ingredients || '') : '';
  if (typeof ingStr === 'string') {
    if (ingStr.includes('sub_items:') || ingStr.startsWith('per_')) return true;
  }

  return false;
};

window.getSpecialParentKey = function (item) {
  if (!item) return null;

  // Master parent special items HAVE NO PARENT KEY
  if (window.isSpecialParentItem(item)) return null;

  const name = typeof item === 'string' ? item : (item.name || '');
  const _cat = typeof CAT !== 'undefined' ? CAT : [];
  const entry = typeof item === 'object' ? item : _cat.find(c => c.name === name);
  if (!entry) return null;

  const n = name.toLowerCase();
  const cat = (entry.cat || entry.category || '').toLowerCase();
  const ident = (entry.identify || '').toLowerCase();

  // Explicit master titles can NEVER be child items
  if (n.includes('mobile bar') || n.includes('unlimited drinks')) return null;
  if (n.includes('ice cream') && !ident.includes('option') && !n.includes('option')) return null;

  if (entry.specialParentKey) return entry.specialParentKey;

  // 1. Check sub_items configuration from master special items in CAT
  for (const parent of _cat) {
    if (!window.isSpecialParentItem(parent)) continue;
    const pIng = parent.rawIngredients || parent.ingredients || '';
    if (typeof pIng === 'string' && pIng.includes('sub_items:')) {
      const subStr = pIng.split('sub_items:')[1];
      if (subStr) {
        const subList = subStr.split(',').map(s => s.trim().toLowerCase());
        if (subList.includes(n) || subList.some(s => s && s.length > 3 && (n.includes(s) || s.includes(n)))) {
          const pName = (parent.name || '').toLowerCase();
          const pIdent = (parent.identify || '').toLowerCase();
          if (pIdent === 'mobile_bar' || pName.includes('mobile bar')) return 'mobile_bar';
          if (pIdent === 'ice_cream' || pName.includes('ice cream')) return 'ice_cream';
          if (pIdent === 'drinks_package' || pName.includes('unlimited drinks')) return 'drinks_package';
          return pIdent || parent.id || pName;
        }
      }
    }
  }

  // 2. Explicit option identifiers
  if (ident === 'mobile_bar_option') return 'mobile_bar';
  if (ident === 'ice_cream_option') return 'ice_cream';

  // 3. Fallback option checks
  if (cat === 'drink' && (n.includes('cocktail') || n.includes('shooter') || n.includes('mixes') || n.includes('mocktail'))) {
    return 'mobile_bar';
  }
  if (cat === 'drink' && ident !== 'drinks_package' && ident !== 'mobile_bar' && !n.includes('mobile bar') && !n.includes('unlimited drinks')) {
    return 'drinks_package';
  }

  return null;
};

window.isParentSpecialItemInPackage = function (item, currentPkgItems) {
  const parentKey = window.getSpecialParentKey(item);
  if (!parentKey) return true; // Not a child item, so no parent restriction
  const items = currentPkgItems || [];
  return items.some(i => {
    const iName = typeof i === 'string' ? i : (i.name || '');
    const _cat = typeof CAT !== 'undefined' ? CAT : [];
    const iEntry = typeof i === 'object' ? i : _cat.find(c => c.name === iName);
    const iIdent = iEntry ? (iEntry.identify || '').toLowerCase() : '';
    const n = iName.toLowerCase();
    const iId = iEntry ? (iEntry.id || '') : '';

    if (parentKey === 'drinks_package') return iIdent === 'drinks_package' || n.includes('unlimited drinks');
    if (parentKey === 'mobile_bar') return iIdent === 'mobile_bar' || n.includes('mobile bar');
    if (parentKey === 'ice_cream') return iIdent === 'ice_cream' || n.includes('ice cream');
    return iIdent === parentKey || iId === parentKey || n === parentKey;
  });
};

window.removeChildItemsForSpecialParent = function (parentNameOrIdent, itemsList) {
  let parentKey = null;
  const n = (parentNameOrIdent || '').toLowerCase();
  if (n.includes('unlimited drinks') || n === 'drinks_package') parentKey = 'drinks_package';
  else if (n.includes('mobile bar') || n === 'mobile_bar') parentKey = 'mobile_bar';
  else if (n.includes('ice cream') || n === 'ice_cream') parentKey = 'ice_cream';
  else parentKey = n;

  if (!parentKey) return itemsList;

  return itemsList.filter(item => {
    const itemParentKey = window.getSpecialParentKey(item);
    return itemParentKey !== parentKey;
  });
};

// Curated pastel color palette options
const PASTEL_PALETTES = [
  { type: 'gold', border: '#c49a3c', bgDark: 'rgba(196, 154, 60, 0.16)', bgLight: 'rgba(245, 230, 190, 0.45)', textColor: '#c49a3c', badgeBg: 'rgba(196, 154, 60, 0.25)', badgeText: '#92400e' },
  { type: 'blue', border: '#3b82f6', bgDark: 'rgba(59, 130, 246, 0.16)', bgLight: 'rgba(208, 225, 253, 0.5)', textColor: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.25)', badgeText: '#1e40af' },
  { type: 'pink', border: '#ec4899', bgDark: 'rgba(236, 72, 153, 0.16)', bgLight: 'rgba(253, 226, 228, 0.55)', textColor: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.25)', badgeText: '#9d174d' },
  { type: 'emerald', border: '#10b981', bgDark: 'rgba(16, 185, 129, 0.16)', bgLight: 'rgba(209, 250, 229, 0.55)', textColor: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.25)', badgeText: '#065f46' },
  { type: 'purple', border: '#a855f7', bgDark: 'rgba(168, 85, 247, 0.16)', bgLight: 'rgba(243, 232, 255, 0.55)', textColor: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.25)', badgeText: '#6b21a8' },
  { type: 'coral', border: '#f97316', bgDark: 'rgba(249, 115, 22, 0.16)', bgLight: 'rgba(255, 237, 213, 0.55)', textColor: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.25)', badgeText: '#9a3412' },
  { type: 'teal', border: '#14b8a6', bgDark: 'rgba(20, 184, 166, 0.16)', bgLight: 'rgba(204, 251, 241, 0.55)', textColor: '#14b8a6', badgeBg: 'rgba(20, 184, 166, 0.25)', badgeText: '#115e59' },
  { type: 'indigo', border: '#6366f1', bgDark: 'rgba(99, 102, 241, 0.16)', bgLight: 'rgba(224, 231, 255, 0.55)', textColor: '#6366f1', badgeBg: 'rgba(99, 102, 241, 0.25)', badgeText: '#3730a3' }
];

window.getSpecialItemColorInfo = function (item) {
  if (!item) return null;
  const name = typeof item === 'string' ? item : (item.name || '');
  const _cat = typeof CAT !== 'undefined' ? CAT : [];
  const entry = typeof item === 'object' ? item : _cat.find(c => c.name === name);

  const n = name.toLowerCase();
  const ident = (entry ? entry.identify : '') || '';
  const parentKey = window.getSpecialParentKey ? window.getSpecialParentKey(item) : null;
  const isParent = window.isSpecialParentItem ? window.isSpecialParentItem(item) : false;

  let label = '';
  if (n.includes('mobile bar') || parentKey === 'mobile_bar' || ident === 'mobile_bar' || ident === 'mobile_bar_option') {
    label = 'MOBILE BAR';
  } else if (n.includes('ice cream') || parentKey === 'ice_cream' || ident === 'ice_cream' || ident === 'ice_cream_option') {
    label = 'ICE CREAM';
  } else if (n.includes('unlimited drinks') || parentKey === 'drinks_package' || ident === 'drinks_package') {
    label = 'UNLIMITED DRINKS';
  } else if (isParent || parentKey) {
    label = (name || parentKey || 'SPECIAL').toUpperCase();
  } else {
    return null;
  }

  // Return label with transparent backgrounds and borders so it renders as plain text without colored boxes
  return {
    label: label,
    border: 'transparent',
    bgDark: 'transparent',
    bgLight: 'transparent',
    badgeBg: 'transparent',
    textColor: 'var(--gold)',
    badgeText: 'var(--gold)'
  };
};

window.validateSpecialItemsSelection = function (itemsList) {
  const items = itemsList || [];
  const _cat = typeof CAT !== 'undefined' ? CAT : [];

  for (const item of items) {
    if (!window.isSpecialParentItem(item)) continue;

    const itemName = typeof item === 'string' ? item : (item.name || '');
    const itemEntry = typeof item === 'object' ? item : _cat.find(c => c.name === itemName);
    if (!itemEntry) continue;

    const n = itemName.toLowerCase();
    const pIdent = (itemEntry.identify || '').toLowerCase();
    const rawIng = itemEntry.rawIngredients || itemEntry.ingredients || '';

    let masterKey = 'special';
    if (pIdent === 'drinks_package' || n.includes('unlimited drinks')) masterKey = 'drinks_package';
    else if (pIdent === 'mobile_bar' || n.includes('mobile bar')) masterKey = 'mobile_bar';
    else if (pIdent === 'ice_cream' || n.includes('ice cream')) masterKey = 'ice_cream';
    else masterKey = itemEntry.id || itemEntry.name || pIdent;

    const hasSubItems = (typeof rawIng === 'string' && rawIng.includes('sub_items:')) ||
      ['drinks_package', 'mobile_bar', 'ice_cream'].includes(masterKey);

    if (hasSubItems) {
      const childCount = items.filter(child => {
        const pKey = window.getSpecialParentKey(child);
        return pKey === masterKey || pKey === itemEntry.id || pKey === itemEntry.name ||
          (masterKey === 'ice_cream' && pKey === 'ice_cream') ||
          (masterKey === 'mobile_bar' && pKey === 'mobile_bar') ||
          (masterKey === 'drinks_package' && pKey === 'drinks_package');
      }).length;

      if (childCount === 0) {
        return {
          valid: false,
          message: `You have added "${itemName}" to the package. Please select at least one item included in "${itemName}" before saving.`
        };
      }
    }
  }

  return { valid: true };
};

