// GLOBAL HELPERS & DECLARATIONS
function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function (match) {
    const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return escape[match];
  });
}
window.escHtml = escHtml;

function toggleStaffTaskStatus(pIdx, tIdx) {
  if (typeof staffMarkTaskDone === 'function') {
    return staffMarkTaskDone(pIdx, tIdx);
  }
}
window.toggleStaffTaskStatus = toggleStaffTaskStatus;

var staffCalendarInstances = [];
var lastRoutineCheckDate = localStorage.getItem('rc_last_check_date') || '2026-04-06';
var EQUIPMENT_FLAGS = (() => {
  try { return JSON.parse(localStorage.getItem('equipment_flags') || '[]'); } catch (e) { return []; }
})();

// GLOBAL DATA
var RESERVATIONS = [];
let ANNOUNCEMENTS = [];
let ACTIVITY_LOG = [];
var USERS = [];
let LAST_SYNCED = null;

function toggleSidebarGroup(group) {
  const content = document.getElementById('sg-' + group);
  const toggle = document.getElementById('sgt-' + group);
  if (!content) return;
  const isOpen = content.classList.contains('open');
  
  // Close all
  document.querySelectorAll('.sg-items').forEach(el => el.classList.remove('open'));
  document.querySelectorAll('.sg-toggle').forEach(el => el.classList.remove('open'));
  
  // Toggle the clicked one
  if (!isOpen) {
    content.classList.add('open');
    toggle?.classList.add('open');
  }
}
window.toggleSidebarGroup = toggleSidebarGroup;


function showUnauthorizedNotice() {
  if (document.getElementById('unauthorized-overlay')) return;
  try {
    document.querySelectorAll('.layout, .top-nav, .sidebar, .main, #app-content').forEach(el => {
      el.style.display = 'none';
    });
  } catch (e) { }

  const overlay = document.createElement('div');
  overlay.id = 'unauthorized-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#0c0906;z-index:99999999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:inherit;';

  overlay.innerHTML = `
    <div style="background:#18120c;border:1px solid rgba(196,154,60,0.35);border-radius:18px;max-width:440px;width:100%;padding:32px 24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.9);animation:fadeIn 0.25s ease-out;">
      <div style="width:68px;height:68px;border-radius:50%;background:rgba(220,38,38,0.12);border:2px solid #dc2626;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h2 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#f5ede0;letter-spacing:0.3px;">Access Denied</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#c9baa7;line-height:1.5;">You are not authorized or authenticated to view this page.</p>
      <div style="font-size:13px;color:#c49a3c;background:rgba(196,154,60,0.1);padding:12px 18px;border-radius:10px;border:1px solid rgba(196,154,60,0.25);margin-bottom:22px;display:inline-block;width:100%;box-sizing:border-box;">
        You will now be redirected back in <strong id="auth-countdown" style="font-size:16px;color:#ffffff;display:inline-block;min-width:14px;">3</strong> seconds...
      </div>
      <div>
        <button onclick="window.location.href='index.html'" style="background:#c49a3c;color:#ffffff;border:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(196,154,60,0.3);transition:all 0.15s ease;">
          Return to Home Now
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let seconds = 3;
  const countEl = document.getElementById('auth-countdown');
  const timer = setInterval(() => {
    seconds--;
    if (countEl) countEl.textContent = String(seconds);
    if (seconds <= 0) {
      clearInterval(timer);
      window.location.href = 'index.html';
    }
  }, 1000);
}

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.style.cssText = `background:${type === 'error' ? '#D32F2F' : type === 'warning' ? '#FBC02D' : type === 'success' ? '#388E3C' : '#333'};color:#fff;padding:12px 20px;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;min-width:250px;`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

function checkAuth() {
  const logged = sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff');
  if (!logged) {
    showUnauthorizedNotice();
    return;
  }
  let u = null;
  try {
    u = JSON.parse(logged);
  } catch (e) { }
  const role = (u?.role || u?.user_metadata?.role || '').toLowerCase();
  const isAllowed = (role === 'staff' || role === 'equipment staff' || role === 'equipment_staff' || role === 'admin');
  if (!u || !isAllowed) {
    sessionStorage.removeItem('halden_staff');
    localStorage.removeItem('halden_staff');
    showUnauthorizedNotice();
    return;
  }
  const isEquipStaff = (role === 'equipment staff' || role === 'equipment_staff');
  const equipSec = document.getElementById('sidebar-sec-equipment-inv');
  if (equipSec) {
    equipSec.style.display = isEquipStaff ? 'block' : 'none';
  }
  const nameEl = document.getElementById('admin-name');
  if (nameEl) {
    const fullName = u.name || (u.fname ? `${u.fname} ${u.lname}` : 'Staff Member');
    nameEl.textContent = isEquipStaff ? `${fullName} (Equipment Staff)` : fullName;
  }
}

function adminLogout() {
  sessionStorage.removeItem('halden_staff');
  localStorage.removeItem('halden_staff');
  localStorage.removeItem('halden_logged_in');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('currentUserId');
  localStorage.removeItem('session_start');
  localStorage.removeItem('sb-nukbdmyqizrnkmbusdtm-auth-token');
  localStorage.setItem('halden_user_type', '');
  
  if (window.supabaseClient && window.supabaseClient.auth) {
    window.supabaseClient.auth.signOut().catch(() => { }).finally(() => {
      window.location.href = 'index.html';
    });
  } else {
    window.location.href = 'index.html';
  }
}

// ===== NAVIGATION =====
function showSection(id, btn) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  // Show target section
  const target = document.getElementById('section-' + id);
  if (target) target.classList.add('active');

  // Update sidebar active state
  if (btn) {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    btn.classList.add('active');
  }

  // Close mobile sidebar drawer if open
  if (typeof toggleStaffMobileSidebar === 'function') {
    toggleStaffMobileSidebar(false);
  }

  // Show floating QR scanner camera button only on mobile dashboard (hidden on desktop views)
  const qrFab = document.getElementById('staff-qr-scan-fab');
  if (qrFab) {
    const isMobile = window.innerWidth <= 768;
    qrFab.style.display = (id === 'dashboard' && isMobile) ? 'flex' : 'none';
  }

  // Section-specific triggers
  if (id === 'dashboard') renderStaffDashboard();
  if (id === 'execution-day') renderStaffExecutionDay();
  if (id === 'payroll') renderPayroll();
  if (id === 'profile' && typeof loadStaffProfile === 'function') loadStaffProfile();
  if (id === 'routine-check') {
    if (typeof loadRoutineChecks === 'function') loadRoutineChecks();
    if (typeof renderRoutineCheckSection === 'function') renderRoutineCheckSection();
  }
  if (id === 'equipment') {
    if (typeof renderEIMTable === 'function') renderEIMTable();
  }
  if (id === 'equip-cycle') {
    if (typeof populateEqcDropdown === 'function') populateEqcDropdown();
    if (typeof onEqcReservationChange === 'function') onEqcReservationChange();
  }
  if (id === 'resupply') {
    if (typeof renderResupplySection === 'function') renderResupplySection();
  }
  if (id === 'maintenance') {
    if (typeof renderMaintenanceSection === 'function') renderMaintenanceSection();
  }
  if (id === 'disposed') {
    if (typeof renderDisposedSection === 'function') renderDisposedSection();
  }
  if (id === 'qr-compile') {
    if (typeof renderQrCompileSection === 'function') renderQrCompileSection();
  }
}

// ===== MOBILE SIDEBAR DRAWER TOGGLE =====
function toggleStaffMobileSidebar(open) {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('staff-sidebar-backdrop');
  if (!sidebar) return;

  const isOpen = sidebar.classList.contains('mobile-open');
  const targetState = (open !== undefined) ? open : !isOpen;

  if (targetState) {
    sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  } else {
    sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }
}
window.toggleStaffMobileSidebar = toggleStaffMobileSidebar;

// ===== LOAD FROM FIRESTORE =====
async function loadData() {
  const list = document.getElementById('staff-assigned-list');
  if (list) list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);">Loading assignments...</div>`;

  try {
    const { collection, getDocs } = window.firebaseFns;
    const db = window.firebaseDB;

    // Load reservations from Firebase
    const resSnap = await getDocs(collection(db, 'reservations'));
    RESERVATIONS = resSnap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, amount: '₱' + Number(data.amount || 0).toLocaleString() };
    });

    // Also load from Supabase (bypassing Firebase security rules issues)
    try {
      if (window.supabaseClient) {
        const { data: sbRes } = await window.supabaseClient.from('reservations').select('*');
        if (sbRes && sbRes.length > 0) {
          const combinedMap = new Map();
          RESERVATIONS.forEach(r => combinedMap.set(r.id, r));
          sbRes.forEach(r => {
            if (combinedMap.has(r.id)) {
              combinedMap.set(r.id, { ...combinedMap.get(r.id), ...r });
            } else {
              combinedMap.set(r.id, r);
            }
          });
          RESERVATIONS = Array.from(combinedMap.values());
          window.RESERVATIONS = RESERVATIONS;
        }
      }
    } catch(e) { console.warn('Supabase reservations fetch failed:', e); }

    // Load assigned reservation IDs from reservation_staff_assignments (Supabase)
    window.STAFF_ASSIGNED_RES_IDS = new Set();
    try {
      if (window.supabaseClient) {
        // Await getSession() so the Supabase client fully restores its JWT
        // before we run the query : without this, auth.uid() is null on page load
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const staffUid = session?.user?.id || '';
        if (staffUid) {
          const { data: assignRows } = await window.supabaseClient
            .from('reservation_staff_assignments')
            .select('reservation_id')
            .eq('staff_id', staffUid);
          if (assignRows) assignRows.forEach(r => window.STAFF_ASSIGNED_RES_IDS.add(r.reservation_id));
        }
      }
    } catch(e) { console.warn('Could not load staff assignments from Supabase:', e); }

    // Load users (for ID -> Name mapping)
    try {
      const { query, where } = window.firebaseFns;
      const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '!=', 'customer')));
      USERS = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) { console.error('Error loading users:', e); USERS = []; }

    // Load announcements
    try {
      const annSnap = await getDocs(collection(db, 'announcements'));
      ANNOUNCEMENTS = annSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ANNOUNCEMENTS.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch(e) { ANNOUNCEMENTS = []; }

    // Load activity log from localStorage
    try {
      const stored = localStorage.getItem('halden_staff_activity');
      ACTIVITY_LOG = stored ? JSON.parse(stored) : [];
    } catch(e) { ACTIVITY_LOG = []; }

    LAST_SYNCED = new Date();
    updateLastSynced();

    renderStaffDashboard();
    renderStaffExecutionDay();
    if (typeof handleStaffHashNavigation === 'function') {
      handleStaffHashNavigation();
    }

  } catch(err) {
    console.error('Firestore load error:', err);
    if (list) list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--red);"> Failed to load data.</div>`;
  }
}

function updateLastSynced() {
  const el = document.getElementById('staff-last-synced');
  if (!el || !LAST_SYNCED) return;
  const t = LAST_SYNCED;
  el.textContent = ' Last synced: ' + t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

function logActivity(msg) {
  ACTIVITY_LOG.unshift({ msg, time: new Date().toISOString() });
  if (ACTIVITY_LOG.length > 20) ACTIVITY_LOG.pop();
  try { localStorage.setItem('halden_staff_activity', JSON.stringify(ACTIVITY_LOG)); } catch(e){}
}

// ── Global 12-Hour (AM/PM) Formatter for Staff Portal ────────────────
function formatStaffTime12h(val) {
  if (!val) return '';
  const s = String(val).trim();
  
  // If it already has AM/PM, normalize whitespace and ensure uppercase AM/PM
  if (/\b(AM|PM)\b/i.test(s)) {
    return s.replace(/(\d{1,2}:\d{2})\s*(am|pm)/i, (m, t, p) => t + ' ' + p.toUpperCase());
  }

  // Interval with separator e.g. "06:35 - 07:35", "06:35 – 07:35", "06:35 to 07:35"
  if (s.includes(' - ') || s.includes(' – ') || s.includes(' — ') || s.toLowerCase().includes(' to ')) {
    const sep = s.includes(' — ') ? ' — ' : (s.includes(' – ') ? ' – ' : (s.toLowerCase().includes(' to ') ? (s.includes(' to ') ? ' to ' : ' TO ') : ' - '));
    const parts = s.split(sep);
    return parts.map(p => formatStaffTime12h(p.trim())).join(' – ');
  }

  // "Done at 20:19"
  if (/done at \d{1,2}:\d{2}/i.test(s)) {
    return s.replace(/done at (\d{1,2}):(\d{2})/i, (match, hStr, mStr) => {
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `Done at ${h}:${mStr} ${ampm}`;
    });
  }

  // HH:MM:SS or HH:MM
  const timeMatch = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  // ISO Date string e.g. "2026-10-09T20:19:00Z"
  if (s.includes('T') && !isNaN(Date.parse(s))) {
    try {
      const d = new Date(s);
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm}`;
    } catch(e) {}
  }

  return s;
}
window.formatStaffTime12h = formatStaffTime12h;

// ===== STAFF DASHBOARD LOGIC =====
function getStaffAssigned(staffId, staffName, staffEmail) {
  return RESERVATIONS.filter(res => {
    // Exclude completed or cancelled reservations
    const st = String(res.status || res.ops_status || '').toLowerCase().trim();
    if (st === 'completed' || st === 'cancelled' || st === 'canceled') return false;

    // Check reservation_staff_assignments table (Supabase-saved assignments)
    if (window.STAFF_ASSIGNED_RES_IDS && window.STAFF_ASSIGNED_RES_IDS.has(res.id)) return true;
    if (res.staffIds && Array.isArray(res.staffIds)) {
       if (staffId && res.staffIds.includes(staffId)) return true;
       if (res.staffIds.some(sid => sid && sid.toLowerCase() === staffName)) return true;
       if (res.staffIds.some(sid => sid && sid.toLowerCase() === staffEmail)) return true;
    }
    if (!res.executionPlan || !res.executionPlan.phases) return false;
    return res.executionPlan.phases.some(p =>
      p.tasks && p.tasks.some(t => {
        const ids = (t.staffIds || []).filter(id => id).map(id => id.toLowerCase());
        return (staffId && ids.includes(staffId.toLowerCase())) ||
               (staffName && ids.includes(staffName)) ||
               (staffEmail && ids.includes(staffEmail));
      })
    );
  });
}

function renderStaffDashboard() {
  const logged = sessionStorage.getItem('halden_staff');
  if (!logged) return;
  const staff = JSON.parse(logged);
  const staffId = staff.id || "";
  const staffName = (staff.name || "").toLowerCase();
  const staffEmail = (staff.email || "").toLowerCase();

  const assigned = getStaffAssigned(staffId, staffName, staffEmail);

  // Analytics
  const evVal = document.getElementById('staff-stat-events');
  if (evVal) evVal.textContent = assigned.length;
  const dayVal = document.getElementById('staff-stat-days');
  if (dayVal) dayVal.textContent = new Set(assigned.map(r => r.date)).size;

  // ── Shared helpers ──────────────────────────────────────────
  const to12hr = (t) => {
    if (!t) return '';
    const m = String(t).match(/(\d{1,2}):(\d{2})/);
    if (!m) return t;
    let h = parseInt(m[1]), min = m[2];
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${min} ${ampm}`;
  };

  // Parse "H:MM AM/PM to H:MM AM/PM" or "H:MM AM/PM - H:MM AM/PM" or bare HH:MM HH:MM
  const parseTimeRange = (tf) => {
    if (!tf) return null;
    const hasMeridiem = /\b(AM|PM)\b/i.test(tf);
    if (!hasMeridiem) {
      const m24 = String(tf).match(/(\d{1,2}:\d{2})/g);
      if (m24 && m24.length >= 2) return { s: m24[0], e: m24[1] };
    }
    const mAP = String(tf).match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/gi);
    if (mAP && mAP.length >= 2) {
      const cvt = s => {
        const x = s.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
        if (!x) return null;
        let h = parseInt(x[1]), mn = x[2] || '00', ap = x[3].toUpperCase();
        if (ap === 'PM' && h !== 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2,'0')}:${mn}`;
      };
      return { s: cvt(mAP[0]), e: cvt(mAP[1]) };
    }
    return null;
  };

  const getWorkHours = (res) => {
    const tfRaw = res.time || res.timeframe || res.time_range || '';
    const tFrom = res.time_from || res.timeFrom || null;
    const tTo   = res.time_to   || res.timeTo   || null;
    let s24 = null, e24 = null;
    if (tFrom && tTo) {
      s24 = tFrom.length <= 5 ? tFrom : tFrom.substring(0,5);
      e24 = tTo.length   <= 5 ? tTo   : tTo.substring(0,5);
    } else {
      const tf = parseTimeRange(tfRaw);
      if (tf) { s24 = tf.s; e24 = tf.e; }
    }
    if (!s24 || !e24) return null;
    const toMins = t => { const [h,m] = t.split(':'); return parseInt(h)*60+parseInt(m); };
    let diff = toMins(e24) - toMins(s24);
    if (diff < 0) diff += 1440;
    return (diff / 60).toFixed(1);
  };

  const getTimeDisplay = (res) => {
    const tfRaw = res.time || res.timeframe || res.time_range || '';
    const tFrom = res.time_from || res.timeFrom || null;
    const tTo   = res.time_to   || res.timeTo   || null;
    if (tFrom && tTo) {
      const s24 = tFrom.length <= 5 ? tFrom : tFrom.substring(0,5);
      const e24 = tTo.length   <= 5 ? tTo   : tTo.substring(0,5);
      return `${to12hr(s24)} – ${to12hr(e24)}`;
    }
    const tf = parseTimeRange(tfRaw);
    if (tf) return `${to12hr(tf.s)} – ${to12hr(tf.e)}`;
    return tfRaw || '–';
  };

  const getCallTime = (res) => {
    const raw = res.call_time || res.callTime || res.calltime || '';
    if (!raw) return null;
    // may already be 12hr, or HH:MM
    if (/^\d{1,2}:\d{2}$/.test(raw.trim())) return to12hr(raw.trim());
    return raw;
  };

  const getPackageName = (res) =>
    res.package_name || res.packageName || res.type || res.occasion || res.event_type || '';

  const hoursVal = document.getElementById('staff-stat-hours');
  if (hoursVal) {
    let totalHrs = 0;
    assigned.forEach(res => {
      totalHrs += parseFloat(getWorkHours(res)) || 0;
    });
    hoursVal.textContent = totalHrs.toFixed(1);
  }

  // --- Shift Reminder Banner ---
  const shiftBanner = document.getElementById('staff-shift-banner');
  if (shiftBanner) {
    const upcoming = assigned
      .filter(r => r.date)
      .map(r => ({ ...r, diff: Math.ceil((new Date(r.date + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 86400000) }))
      .filter(r => r.diff >= 0)
      .sort((a, b) => a.diff - b.diff);
    if (upcoming.length > 0) {
      const next = upcoming[0];
      const label = next.diff === 0 ? 'TODAY' : next.diff === 1 ? 'TOMORROW' : `IN ${next.diff} DAYS`;
      const pkgName = getPackageName(next);
      const callT   = getCallTime(next);
      const timeDisp = getTimeDisplay(next);
      shiftBanner.style.display = 'flex';
      shiftBanner.innerHTML = `
        <div style="font-size:20px; color:var(--gold); font-weight:900;">&#9658;</div>
        <div style="flex:1;">
          <div style="font-size:12px; font-weight:800; color:var(--gold); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Next Shift</div>
          <div style="font-size:15px; font-weight:700; color:var(--cream);">${next.client || next.clientName || 'Client'}'s Event${pkgName ? ' &mdash; ' + pkgName : ''}</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">${next.date}${timeDisp ? ' &middot; ' + timeDisp : ''}${callT ? ' &middot; Call: ' + callT : ''}</div>
        </div>
        <div style="color:var(--gold); font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">${label}</div>
      `;
    } else {
      shiftBanner.style.display = 'none';
    }
  }

  // --- Assigned List (Filtered to only reservations that have not passed yet) ---
  const list = document.getElementById('staff-assigned-list');
  if (!list) return;

  const _localNow = new Date();
  const todayStr = _localNow.getFullYear() + '-'
    + String(_localNow.getMonth() + 1).padStart(2, '0') + '-'
    + String(_localNow.getDate()).padStart(2, '0');

  // Only display active reservations (exclude completed/cancelled) whose event date is today or in the future
  const upcomingAssigned = assigned.filter(res => {
    const st = String(res.status || res.ops_status || '').toLowerCase().trim();
    if (st === 'completed' || st === 'cancelled' || st === 'canceled') return false;
    const rDate = String(res.date || res.eventDate || res.event_date || '').trim();
    if (!rDate) return true; // keep if no date specified so it's not accidentally lost
    return rDate >= todayStr;
  });

  if (upcomingAssigned.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-dim);"><div style="font-size:36px;margin-bottom:15px;color:var(--border);">[ ]</div><div>No active upcoming assignments found.</div></div>`;
  } else {
    list.innerHTML = upcomingAssigned.map(res => {
      const pkgName    = getPackageName(res);
      const timeDisp   = getTimeDisplay(res);
      const callT      = getCallTime(res);
      const workHours  = getWorkHours(res);
      const address    = res.venue || res.address || res.venueAddress || res.venue_address || res.venueName || '–';
      const safeId     = res.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const resIdEsc   = (res.id || '').replace(/'/g, "\\'");
      return `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden;">
          <div class="staff-assign-card-inner" style="padding:20px;display:flex;justify-content:space-between;align-items:center;">
            <div style="flex:1;">
              <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:2px;">${res.client || res.clientName || '–'}${pkgName ? ' &mdash; <span style="color:var(--cream);font-weight:600;">' + pkgName + '</span>' : ''}</div>
              <div style="font-size:12px;color:var(--cream);margin-bottom:2px;">
                Date: ${res.date || '–'}&nbsp;&nbsp;Time: ${timeDisp}
                ${callT ? `&nbsp;&nbsp; Call: <b>${callT}</b>` : ''}
                ${workHours ? `  |  <b>${workHours} hrs work</b>` : ''}
              </div>
              <div style="font-size:11px;color:var(--text-dim);">${address}</div>
            </div>
            <button onclick="toggleStaffViewPlan('${resIdEsc}')" id="btn-vp-${safeId}"
              style="background:var(--bg3);border:1px solid var(--border);color:var(--gold);padding:8px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;margin-left:16px;transition:all 0.2s;"
              onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--border)'">
              View Plan
            </button>
          </div>
          <div id="vp-expand-${safeId}" style="display:none;border-top:1px solid var(--border);">
            <!-- Roles injected here by toggleStaffViewPlan -->
            <div id="vp-roles-${safeId}"></div>
            <div style="padding:16px 20px;">
              <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Venue Location</div>
              <div id="vp-map-${safeId}" style="height:260px;border-radius:10px;overflow:hidden;border:1px solid var(--border);background:var(--bg3);"></div>
              <div style="font-size:12px;color:var(--text-dim);margin-top:8px;">${address}</div>
              ${(res.venueInfo || res.venue_info) ? `<div style="font-size:11px;color:var(--gold);margin-top:6px;white-space:pre-wrap;word-break:break-word;line-height:1.4;"><span style="font-weight:700;text-transform:uppercase;font-size:10px;letter-spacing:0.5px;color:var(--text-dim);display:block;margin-bottom:2px;">Venue Info</span>${typeof escHtml === 'function' ? escHtml(res.venueInfo || res.venue_info) : (res.venueInfo || res.venue_info)}</div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // Init dashboard calendar
  if (typeof initStaffCalendar === 'function') {
    initStaffCalendar();
  }
}

// ===== STAFF EXECUTION DAY LOGIC =====
let activeStaffExecutionResId = null;

function renderStaffExecutionDay() {
  const logged = sessionStorage.getItem('halden_staff');
  if (!logged) return;
  const staff = JSON.parse(logged);
  const staffId = staff.id || "";
  const staffName = (staff.name || "").toLowerCase();
  const staffEmail = (staff.email || "").toLowerCase();

  const container = document.getElementById('staff-execution-list');
  const mobContainer = document.getElementById('staff-execution-list-mobile');
  if (!container && !mobContainer) return;

  // Use getStaffAssigned which checks STAFF_ASSIGNED_RES_IDS (Supabase) + legacy fields
  // Exclude completed reservations from active execution day view
  const assigned = getStaffAssigned(staffId, staffName, staffEmail)
    .filter(r => {
      const st = String(r.status || '').toLowerCase();
      const isCompleted = st === 'completed' || !!r.exec_finalized_at || !!(r.executionPlan && r.executionPlan.completedAt);
      return !isCompleted && ['confirmed','preparing','procurement','procuring','on-going'].includes(st);
    });

  if (activeStaffExecutionResId) {
    const isStillActive = assigned.some(r => r.id === activeStaffExecutionResId);
    if (!isStillActive) {
      activeStaffExecutionResId = null;
    }
  }

  if (assigned.length === 0) {
    const emptyHtml = '<div style="padding:20px; color:var(--text-dim); font-size:12px; text-align:center;">No assigned active events found.</div>';
    if (container) container.innerHTML = emptyHtml;
    if (mobContainer) mobContainer.innerHTML = emptyHtml;
    const emptyDetail = document.getElementById('staff-execution-detail-empty');
    const detailView = document.getElementById('staff-execution-detail-view');
    if (emptyDetail) emptyDetail.style.display = 'flex';
    if (detailView) detailView.style.display = 'none';
    return;
  }

  // Build desktop items list
  const desktopHtml = assigned.map(res => {
    const isActive = activeStaffExecutionResId === res.id;
    const pkgName = res.package_name || res.packageName || res.type || res.occasion || '';
    const clientName = res.client_name || res.clientName || res.client || res.name || '–';
    const eventType = res.event_type || res.eventType || res.type || '–';
    const eventDate = res.event_date || res.eventDate || res.date || '–';
    return `
      <div onclick="selectStaffExecutionEvent('${res.id}')"
           style="padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--border); transition:background 0.15s;
                  ${isActive ? 'background:rgba(212,175,55,0.1); border-left:3px solid var(--gold);' : 'border-left:3px solid transparent;'}">
        <div style="font-weight:600; color:${isActive ? 'var(--gold)' : 'var(--cream)'}; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${clientName}${pkgName ? ' &mdash; ' + pkgName : ''}</div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">${eventType} &middot; ${eventDate}</div>
      </div>
    `;
  }).join('');

  // Build mobile items list: events whose execution day is NOT live yet are NOT clickable
  const mobileHtml = assigned.map(res => {
    const isLive = String(res.status || '').toLowerCase() === 'on-going' ||
                   String(res.ops_status || '').toLowerCase() === 'on-going' ||
                   String(res.execution_live_status || '').toLowerCase() === 'active';
    const isActive = activeStaffExecutionResId === res.id;
    const pkgName = res.package_name || res.packageName || res.type || res.occasion || '';
    const clientName = res.client_name || res.clientName || res.client || res.name || '–';
    const eventType = res.event_type || res.eventType || res.type || '–';
    const eventDate = res.event_date || res.eventDate || res.date || '–';

    if (!isLive) {
      // Non-live reservation: strictly unclickable on mobile view
      return `
        <div style="padding:12px 14px; cursor:not-allowed; opacity:0.55; border-bottom:1px solid var(--border); border-left:3px solid transparent; user-select:none;">
          <div style="font-weight:600; color:var(--text-dim); font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${clientName}${pkgName ? ' &mdash; ' + pkgName : ''}</div>
          <div style="font-size:11px; color:var(--text-dim); margin-top:2px; display:flex; align-items:center; gap:6px;">
            <span>${eventType} &middot; ${eventDate}</span>
            <span style="font-size:10px; color:var(--text-dim); border:1px solid var(--border); padding:1px 6px; border-radius:4px;">Not Live Yet</span>
          </div>
        </div>
      `;
    }

    // Live reservation: clickable
    return `
      <div onclick="selectStaffExecutionEvent('${res.id}')"
           style="padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--border); transition:background 0.15s;
                  ${isActive ? 'background:rgba(212,175,55,0.1); border-left:3px solid var(--gold);' : 'border-left:3px solid transparent;'}">
        <div style="font-weight:600; color:${isActive ? 'var(--gold)' : 'var(--cream)'}; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${clientName}${pkgName ? ' &mdash; ' + pkgName : ''}</div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:2px; display:flex; align-items:center; gap:6px;">
          <span>${eventType} &middot; ${eventDate}</span>
          <span style="font-size:10px; color:var(--gold); border:1px solid rgba(212,175,55,0.4); padding:1px 6px; border-radius:4px;">Live</span>
        </div>
      </div>
    `;
  }).join('');

  if (container) container.innerHTML = desktopHtml;
  if (mobContainer) mobContainer.innerHTML = mobileHtml;

  if (activeStaffExecutionResId) renderStaffExecutionDetail();
}

function selectStaffExecutionEvent(id) {
  // Mobile guard: reservations whose execution day area is not live yet are not clickable
  const isMobile = window.innerWidth <= 768;
  const res = RESERVATIONS.find(r => r.id === id);
  if (isMobile && res) {
    const isLive = String(res.status || '').toLowerCase() === 'on-going' ||
                   String(res.ops_status || '').toLowerCase() === 'on-going' ||
                   String(res.execution_live_status || '').toLowerCase() === 'active';
    if (!isLive) return;
  }

  activeStaffExecutionResId = id;
  // Automatically close mobile assigned drawer after selecting an event
  if (typeof toggleStaffExecMobileDrawer === 'function') {
    toggleStaffExecMobileDrawer(false);
  }
  renderStaffExecutionDay();
}

// =====================================================================
// STAFF TIME FORMATTER (1-12 FORMAT WITH AM AND PM)
// =====================================================================
function formatStaffTime12h(timeStr) {
  if (!timeStr) return 'TBD';
  const str = String(timeStr).trim();
  if (!str || str.toLowerCase() === 'tbd') return 'TBD';

  if (str.includes(' - ') || str.includes(' to ') || str.includes(' – ')) {
    const sep = str.includes(' – ') ? ' – ' : (str.includes(' - ') ? ' - ' : ' to ');
    return str.split(sep).map(part => formatStaffTime12h(part.trim())).join(' – ');
  }

  if (/\b(AM|PM)\b/i.test(str)) {
    return str.replace(/\b0?([1-9]|1[0-2]):([0-5][0-9])(?::[0-5][0-9])?\s*(AM|PM)\b/gi, (match, h, m, period) => {
      return `${parseInt(h, 10)}:${m} ${period.toUpperCase()}`;
    });
  }

  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    let hours = parseInt(m24[1], 10);
    const minutes = m24[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes} ${period}`;
  }

  if (str.includes('T') || (str.includes('-') && str.includes(':'))) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${period}`;
    }
  }

  return str;
}
window.formatStaffTime12h = formatStaffTime12h;

// =====================================================================
// STAFF EXECUTION SUB-TAB SWITCHER
// Toggles between active execution day and historical executions partaken in
// =====================================================================
function switchStaffExecSubTab(tab) {
  const activeBtn = document.getElementById('staff-exec-subtab-active');
  const historyBtn = document.getElementById('staff-exec-subtab-history');
  const activePane = document.getElementById('staff-exec-pane-active');
  const historyPane = document.getElementById('staff-exec-pane-history');

  if (tab === 'history') {
    if (activeBtn) {
      activeBtn.style.borderBottom = '2px solid transparent';
      activeBtn.style.color = 'var(--cream)';
      activeBtn.style.fontWeight = '600';
    }
    if (historyBtn) {
      historyBtn.style.borderBottom = '2px solid var(--gold)';
      historyBtn.style.color = 'var(--gold)';
      historyBtn.style.fontWeight = '700';
    }
    if (activePane) activePane.style.display = 'none';
    if (historyPane) historyPane.style.display = 'block';
    renderStaffExecutionHistory();
  } else {
    if (activeBtn) {
      activeBtn.style.borderBottom = '2px solid var(--gold)';
      activeBtn.style.color = 'var(--gold)';
      activeBtn.style.fontWeight = '700';
    }
    if (historyBtn) {
      historyBtn.style.borderBottom = '2px solid transparent';
      historyBtn.style.color = 'var(--cream)';
      historyBtn.style.fontWeight = '600';
    }
    if (activePane) activePane.style.display = 'block';
    if (historyPane) historyPane.style.display = 'none';
    renderStaffExecutionDay();
  }
}
window.switchStaffExecSubTab = switchStaffExecSubTab;

// =====================================================================
// RENDER STAFF EXECUTION HISTORY
// Lists all catering executions the authenticated staff member has partaken in,
// displaying reservation name, date and 1-12 AM/PM time range, and fixed salary of ₱1,000.
// Adheres strictly to safety protocols: no emoticons, no colored pill backgrounds.
// =====================================================================
async function renderStaffExecutionHistory() {
  const container = document.getElementById('staff-execution-history-list');
  const statsContainer = document.getElementById('staff-history-summary-stats');
  if (!container) return;

  const logged = sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff');
  if (!logged) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px;">Please log in to view execution history.</div>';
    return;
  }

  const staff = JSON.parse(logged);
  const staffId = String(staff.id || staff.uid || staff.user_id || '').trim();
  const staffName = (staff.name || '').toLowerCase().trim();
  const staffEmail = (staff.email || '').toLowerCase().trim();

  container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:13px;">Loading execution history...</div>';

  // 1. Collect completed reservations from in-memory RESERVATIONS
  const historyMap = new Map();

  const allAssigned = getStaffAssigned(staffId, staffName, staffEmail);
  allAssigned.forEach(r => {
    const st = String(r.status || '').toLowerCase();
    const isCompleted = st === 'completed' || !!r.exec_finalized_at || !!(r.executionPlan && r.executionPlan.completedAt);
    if (isCompleted) {
      historyMap.set(String(r.id), r);
    }
  });

  // 2. Query Supabase reservation_staff_assignments to ensure complete history
  if (window.supabaseClient && (staffId || window.STAFF_ASSIGNED_RES_IDS?.size > 0)) {
    try {
      const sb = window.supabaseClient;
      let assignedResIds = Array.from(window.STAFF_ASSIGNED_RES_IDS || []);
      if (staffId) {
        const { data: rows } = await sb.from('reservation_staff_assignments').select('reservation_id').eq('staff_id', staffId);
        if (rows && rows.length > 0) {
          rows.forEach(rw => { if (rw.reservation_id) assignedResIds.push(rw.reservation_id); });
        }
      }
      assignedResIds = Array.from(new Set(assignedResIds));

      if (assignedResIds.length > 0) {
        const missingIds = assignedResIds.filter(id => !historyMap.has(String(id)));
        if (missingIds.length > 0) {
          const { data: completedRes } = await sb.from('reservations')
            .select('*')
            .in('id', missingIds)
            .eq('status', 'completed');
          if (completedRes && completedRes.length > 0) {
            completedRes.forEach(r => {
              historyMap.set(String(r.id), r);
            });
          }
        }
      }
    } catch(err) {
      console.warn('[renderStaffExecutionHistory] Supabase fetch notice:', err);
    }
  }

  const historyList = Array.from(historyMap.values());

  // Sort by event date descending
  historyList.sort((a, b) => {
    const da = new Date(a.date || a.event_date || a.eventDate || 0).getTime();
    const db = new Date(b.date || b.event_date || b.eventDate || 0).getTime();
    return db - da;
  });

  // Render stats summary header
  const totalExecutions = historyList.length;
  const totalSalary = totalExecutions * 1000;

  if (statsContainer) {
    statsContainer.innerHTML = `
      <div style="background:var(--bg3); border:1px solid var(--border); border-radius:10px; padding:10px 18px; text-align:right;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text-dim); letter-spacing:1px;">Completed Events</div>
        <div style="font-size:18px; font-weight:800; color:var(--cream);">${totalExecutions}</div>
      </div>
      <div style="background:var(--bg3); border:1px solid var(--border); border-radius:10px; padding:10px 18px; text-align:right;">
        <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--gold); letter-spacing:1px;">Total Credited Salary</div>
        <div style="font-size:18px; font-weight:800; color:var(--gold);">₱${totalSalary.toLocaleString()}</div>
      </div>
    `;
  }

  if (historyList.length === 0) {
    container.innerHTML = `
      <div style="padding:60px 20px; text-align:center; color:var(--text-dim);">
        <div style="font-size:16px; font-weight:700; color:var(--cream); margin-bottom:6px;">No Execution History Found</div>
        <div style="font-size:13px; max-width:400px; margin:0 auto;">You have not partaken in any completed catering events yet. Completed assignments will be archived here alongside your salary details.</div>
      </div>
    `;
    return;
  }

  // Render history list cards
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${historyList.map(res => {
        const clientName = res.client_name || res.clientName || res.client || res.name || 'Valued Client';
        const pkgName = res.package_name || res.packageName || res.type || res.occasion || '';
        const reservationName = `${clientName}${pkgName ? ' — ' + pkgName : ''}`;

        const eventDate = res.date || res.eventDate || res.event_date || 'N/A';

        // 1-12 format with AM and PM time range
        let timeRangeStr = 'N/A';
        if (res.timeStart && res.timeEnd) {
          timeRangeStr = `${formatStaffTime12h(res.timeStart)} – ${formatStaffTime12h(res.timeEnd)}`;
        } else if (res.time_start && res.time_end) {
          timeRangeStr = `${formatStaffTime12h(res.time_start)} – ${formatStaffTime12h(res.time_end)}`;
        } else if (res.time || res.timeframe) {
          timeRangeStr = formatStaffTime12h(res.time || res.timeframe);
        }

        const venueStr = res.venue || res.venueAddress || res.venue_location || "Halden's Private Venue";
        const completedDateStr = res.exec_finalized_at || (res.executionPlan && res.executionPlan.completedAt)
          ? new Date(res.exec_finalized_at || res.executionPlan.completedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
          : eventDate;

        return `
          <div style="background:var(--bg3); border:1px solid var(--border); border-radius:12px; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; transition:border-color 0.15s;">
            <div style="flex:1; min-width:260px;">
              <div style="font-size:15px; font-weight:700; color:var(--cream); margin-bottom:4px; line-height:1.3;">
                ${escHtml(reservationName)}
              </div>
              <div style="display:flex; gap:14px; font-size:12px; color:var(--text-dim); flex-wrap:wrap; align-items:center;">
                <span><strong>Date:</strong> ${escHtml(eventDate)}</span>
                <span style="color:var(--border);">|</span>
                <span><strong>Time:</strong> ${escHtml(timeRangeStr)}</span>
                <span style="color:var(--border);">|</span>
                <span><strong>Venue:</strong> ${escHtml(venueStr)}</span>
              </div>
            </div>

            <div style="text-align:right; min-width:140px;">
              <div style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text-dim); letter-spacing:0.8px; margin-bottom:2px;">
                Salary Amount
              </div>
              <div style="font-size:22px; font-weight:900; color:var(--gold);">
                ₱1,000
              </div>
              <div style="font-size:11px; color:var(--green); font-weight:600; margin-top:2px;">
                Completed on ${escHtml(completedDateStr)}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
window.renderStaffExecutionHistory = renderStaffExecutionHistory;

// ===== MOBILE EXECUTION DRAWER TOGGLE (MIMICS ADMIN SIDE) =====
function toggleStaffExecMobileDrawer(open) {
  const drawer = document.getElementById('staff-exec-mobile-drawer');
  if (!drawer) return;
  const isHidden = (drawer.style.display === 'none' || !drawer.style.display);
  const targetState = (open !== undefined) ? open : isHidden;
  drawer.style.display = targetState ? 'block' : 'none';
  if (targetState) {
    renderStaffExecutionDay();
  }
}
window.toggleStaffExecMobileDrawer = toggleStaffExecMobileDrawer;

async function renderStaffExecutionDetail() {
  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  const emptyView = document.getElementById('staff-execution-detail-empty');
  const detailView = document.getElementById('staff-execution-detail-view');
  if (!res) { emptyView.style.display='flex'; detailView.style.display='none'; return; }
  emptyView.style.display = 'none';
  detailView.style.display = 'flex';

  // Fetch sorted status and execution strategy from Supabase
  let staffExecDayProcSorted = {};
  let execStrategyData = null;
  try {
    const sb = window.supabaseClient;
    if (sb) {
      const { data: sortedData } = await sb.from('reservation_exec_sorted')
        .select('*')
        .eq('reservation_id', res.id)
        .maybeSingle();
      if (sortedData) {
        staffExecDayProcSorted = {
          food:             sortedData.sorted_food             || false,
          equipment:        sortedData.sorted_equipment        || false,
          decoration:       sortedData.sorted_decoration       || false,
          personnel:        sortedData.sorted_personnel        || false,
          staff_allocation: sortedData.sorted_staff_allocation || false,
          transportation:   sortedData.sorted_transportation   || false
        };
      }

      const { data: stratData } = await sb.from('execution_plans')
        .select('*')
        .eq('reservation_id', res.id)
        .maybeSingle();
      if (stratData) execStrategyData = stratData;
    }
  } catch (e) { /* silently ignore */ }

  // Countdown
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  let daysLeft = null;
  let formattedDate = res.date || '\u2014';
  if (res.date) {
    const eventDateObj = new Date(res.date + 'T00:00:00');
    if (!isNaN(eventDateObj)) {
      daysLeft = Math.ceil((eventDateObj - todayMidnight) / (1000 * 60 * 60 * 24));
      formattedDate = eventDateObj.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  let countdownHtml = '';
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      countdownHtml = `<div style="margin:0 0 16px 0;padding:14px 20px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;text-align:center;">
        <div style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Event Has Passed</div>
        <div style="font-size:22px;font-weight:700;color:var(--red);">${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago</div>
      </div>`;
    } else if (daysLeft === 0) {
      countdownHtml = `<div style="margin:0 0 16px 0;padding:14px 20px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:10px;text-align:center;">
        <div style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Execution Day Status</div>
        <div style="font-size:22px;font-weight:700;color:var(--green);">TODAY</div>
      </div>`;
    } else {
      const urgencyColor = daysLeft <= 7 ? 'var(--amber)' : daysLeft <= 30 ? 'var(--gold)' : 'var(--cream)';
      const urgencyBg = daysLeft <= 7 ? 'rgba(217,119,6,0.08)' : daysLeft <= 30 ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.04)';
      const urgencyBorder = daysLeft <= 7 ? 'rgba(217,119,6,0.25)' : daysLeft <= 30 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)';
      countdownHtml = `<div style="margin:0 0 16px 0;padding:20px;background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:12px;text-align:center;">
        <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">Days Until Execution</div>
        <div style="font-size:52px;font-weight:800;color:${urgencyColor};line-height:1;">${daysLeft}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:6px;">day${daysLeft !== 1 ? 's' : ''} remaining</div>
      </div>`;
    }
  }

  // Status badge
  const statusMap = { confirmed:{label:'Confirmed',cls:'confirmed'}, preparing:{label:'Preparing',cls:'warning'}, procuring:{label:'Procuring',cls:'warning'}, procurement:{label:'Procurement',cls:'warning'}, 'on-going':{label:'On-Going',cls:'ok'}, completed:{label:'Completed',cls:'confirmed'} };
  const statusInfo = statusMap[String(res.status).toLowerCase()] || { label: res.status || 'Unknown', cls: 'pending' };

  // Financial
  const rawAmt = typeof res.amount === 'string' ? parseFloat(res.amount.replace(/[^0-9.]/g, '')) || 0 : (res.amount || 0);
  const isMalabon = ([res.venue, res.venueName, res.venueAddress, res.venueAddr, res.city, res.venueCity, res.fullAddress, res.gpsVenueAddress].map(s => String(s || '').toLowerCase()).join(' ').includes('malabon'));
  let otc = isMalabon ? 0 : (parseFloat(res.outOfTownCharge || res.out_of_town_charge) || 0);
  if (!isMalabon && otc <= 0 && rawAmt > 0) otc = Math.round(rawAmt * 0.05);
  const baseTotal = (otc > 0 && rawAmt >= otc) ? (rawAmt - otc) : rawAmt;
  const dpAmt = Math.round(baseTotal * 0.5);
  const finalAmt = (baseTotal - dpAmt) + otc;
  const amtStr = finalAmt > 0 ? '\u20b1' + finalAmt.toLocaleString() : '\u2014';

  // Execution Strategy section
  const staffText = execStrategyData && execStrategyData.staff_assigned && execStrategyData.staff_assigned.length > 0
    ? execStrategyData.staff_assigned.join(', ')
    : 'No staff assigned';
  const flexText = execStrategyData && execStrategyData.flexibility === 'strict'
    ? 'Strict Schedule (No Extension)'
    : (execStrategyData && execStrategyData.flexibility === 'flexible' ? 'Flexible (Extension Allowed)' : (execStrategyData && execStrategyData.flexibility || 'Not specified'));

  const phasesArr = Array.isArray(execStrategyData && execStrategyData.phases) ? execStrategyData.phases : [];

  const fmt12 = (hhmm) => {
    if (!hhmm || !hhmm.includes(':')) return '--:--';
    const [hStr, mStr] = hhmm.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2,'0')}:${mStr.substring(0,2)} ${ampm}`;
  };

  const renderPhase = (label, key, color) => {
    const p = phasesArr.find(ph => ph.id === key);
    const startTime = p && p.start ? fmt12(p.start) : '--:--';
    const endTime   = p && p.end   ? fmt12(p.end)   : '--:--';
    return `<div style="flex:1;border:1px solid ${color};background:rgba(0,0,0,0.2);border-radius:8px;padding:10px;text-align:center;">
      <div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;margin-bottom:4px;">${label}</div>
      <div style="font-size:11px;color:var(--cream);">${startTime} &ndash; ${endTime}</div>
    </div>`;
  };

  const strategyHtml = `
    <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px;">
      <div onclick="const content=this.nextElementSibling;const icon=this.querySelector('i');if(content.style.display==='none'){content.style.display='block';icon.style.transform='rotate(180deg)';}else{content.style.display='none';icon.style.transform='rotate(0deg)';}" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;">
        <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;">Execution Day Strategy</div>
        <i class="fas fa-chevron-down" style="color:var(--text-dim);transition:transform 0.2s;font-size:12px;"></i>
      </div>
      <div style="display:none;margin-top:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Assigned Staff</div>
            <div style="font-size:12px;color:var(--cream);line-height:1.4;">${staffText}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Event Flexibility</div>
            <div style="font-size:12px;color:var(--cream);line-height:1.4;">${flexText}</div>
          </div>
        </div>
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;">Timeline Periods</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${renderPhase('Departure','departure','var(--gold)')}
          ${renderPhase('Deployment','deployment','var(--blue)')}
          ${renderPhase('Execution','execution','var(--green)')}
          ${renderPhase('Bash-Out','bashout','var(--red)')}
          ${renderPhase('Restorage','restorage','var(--purple)')}
        </div>
      </div>
    </div>
  `;

  // Resource preparation boxes
  const STAFF_EXEC_PROC_CATS = [
    { key: 'food',             label: 'Dishes & Ingredients' },
    { key: 'equipment',        label: 'Event Equipment' },
    { key: 'decoration',       label: 'Aesthetic & Decor' },
    { key: 'personnel',        label: 'Talent & Personnel' },
    { key: 'staff_allocation', label: 'Staff Allocation' },
    { key: 'transportation',   label: 'Transportation' }
  ];
  const allSorted = STAFF_EXEC_PROC_CATS.every(c => staffExecDayProcSorted[c.key]);
  const sortedBoxesHtml = `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Resource Preparation</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;">
        ${STAFF_EXEC_PROC_CATS.map(c => {
          const isSorted = staffExecDayProcSorted[c.key] || false;
          return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 10px;border-radius:10px;background:var(--bg2);border:1px solid ${isSorted?'rgba(39,174,96,0.6)':'rgba(192,57,43,0.6)'};box-shadow:0 0 10px ${isSorted?'rgba(39,174,96,0.3)':'rgba(192,57,43,0.3)'};text-align:center;">
            <span style="font-size:12px;font-weight:600;color:var(--cream);margin-bottom:6px;line-height:1.2;">${c.label}</span>
            <span style="font-size:10px;font-weight:800;text-transform:uppercase;color:${isSorted?'var(--green)':'var(--red)'};">  ${isSorted?'SORTED':'NOT SORTED'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Call time formatter
  const fmtCallTime = (t) => {
    if (!t || !t.includes(':')) return t || '\u2014';
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h.toString().padStart(2,'0')}:${mStr.substring(0,2)} ${ampm}`;
  };

  detailView.innerHTML = `
    <div style="padding:24px;overflow-y:auto;">
      ${countdownHtml}

      <!-- Event details card -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;">Event Details</div>
          <span class="badge ${statusInfo.cls}">${statusInfo.label}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Client</div>
            <div style="font-size:13px;font-weight:600;color:var(--cream);">${res.client_name || res.clientName || res.client || res.name || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Event Type</div>
            <div style="font-size:13px;font-weight:600;color:var(--cream);">${res.event_type || res.eventType || res.type || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Execution Date</div>
            <div style="font-size:12px;font-weight:600;color:var(--gold);">${formattedDate}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Time</div>
            <div style="font-size:12px;font-weight:600;color:var(--cream);">${formatStaffTime12h(res.timeRange || res.timeframe || res.event_time || res.eventTime || res.time || '') || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Package</div>
            <div style="font-size:12px;color:var(--cream);">${res.package_name || res.packageName || res.package || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Theme</div>
            <div style="font-size:12px;color:var(--cream);">${res.theme || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Call Time</div>
            <div style="font-size:12px;color:var(--cream);">${formatStaffTime12h(res.call_time || res.callTime || '') || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Guest Count (Pax)</div>
            <div style="font-size:12px;color:var(--cream);">${res.pax || res.guestCount || '\u2014'}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">VIP Count</div>
            <div style="font-size:12px;color:var(--cream);">${res.vipCount || '0 VIP'}</div>
          </div>
        </div>
        ${res.venue ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Venue</div>
          <div style="font-size:12px;color:var(--cream);">${res.venue}</div>
          ${(res.venueInfo || res.venue_info) ? `<div style="margin-top:8px;">
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Venue Info</div>
            <div style="font-size:12px;color:var(--cream);white-space:pre-wrap;word-break:break-word;line-height:1.4;">${typeof escHtml === 'function' ? escHtml(res.venueInfo || res.venue_info) : (res.venueInfo || res.venue_info)}</div>
          </div>` : ''}
        </div>` : ((res.venueInfo || res.venue_info) ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;">Venue Info</div>
          <div style="font-size:12px;color:var(--cream);white-space:pre-wrap;word-break:break-word;line-height:1.4;">${typeof escHtml === 'function' ? escHtml(res.venueInfo || res.venue_info) : (res.venueInfo || res.venue_info)}</div>
        </div>` : '')}
        ${strategyHtml}
      </div>

      ${sortedBoxesHtml}

      <!-- Start Execution Day button -->
      ${(() => {
        const isLive = typeof isExecutionSessionLive === 'function' ? isExecutionSessionLive(res) : (res.status === 'on-going' || res.execution_live_status === 'active' || (res.date && res.date.slice(0,10) === new Date().toISOString().slice(0,10)));
        if (isLive || res.status === 'completed') {
          return `<button onclick="startStaffExecutionDay('${res.id}')"
            style="width:100%;padding:14px 20px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:700;font-size:14px;border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity 0.15s;letter-spacing:0.3px;margin-bottom:10px;box-shadow:0 4px 20px rgba(34,197,94,0.25);"
            onmouseover="this.style.opacity='0.88'" onmouseout="this.style.opacity='1'">
            Start Execution Day
          </button>`;
        }
        return `<button onclick="alert('Execution Day live session has not been started by the admin yet. The live session will become available once the admin begins execution day or on the event day.')"
          style="width:100%;padding:14px 20px;background:#2d261e;color:#7a6e5e;font-weight:700;font-size:14px;border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px;">
          Execution Day Pending (Session Not Live)
        </button>`;
      })()}
    </div>
  `;
}

function isExecutionSessionLive(res) {
  if (!res) return false;
  if (res.execution_live_status === 'active' || res.status === 'on-going' || res.ops_status === 'on-going') return true;
  if (res.executionPlan && res.executionPlan.live_status === 'active') return true;
  if (res.execution_plan && res.execution_plan.live_status === 'active') return true;
  const todayStr = new Date().toISOString().split('T')[0];
  const resDateStr = (res.date || '').slice(0, 10);
  if (resDateStr && resDateStr === todayStr) return true;
  return false;
}
window.isExecutionSessionLive = isExecutionSessionLive;

// ===== STAFF EXECUTION LIVE VIEW =====
let activeStaffLivePhaseIdx = 0;
let _staffExecActiveView = 'phases'; // 'phases' | 'equipment'
let _staffFinalizePollTimer = null;
let _staffRolesCache = {};
let _staffEquipSearchQuery = '';
let _staffEquipCatFilter = 'all';
let _staffExecActivitiesSub = null;
let _staffExecIncidentsSub = null;
let _staffExecLiveBroadcastSub = null;
let _staffLiveFeedTimer = null;
let staffExecLiveActivities = [];

// Builds default 5 execution phases if reservation does not have an execution plan yet
function buildDefaultStaffPhases(res) {
  let execStart = '10:00', execEnd = '22:00';
  const rawTime = (res && (res.time || res.timeframe)) || '';
  if (rawTime) {
    const sep = rawTime.toLowerCase().includes(' to ') ? / to /i : (rawTime.includes(' - ') ? / - / : (rawTime.includes('-') ? /-/ : null));
    if (sep) {
      const parts = rawTime.split(sep);
      if (parts[0]) execStart = parts[0].trim();
      if (parts[1]) execEnd = parts[1].trim();
    }
  }
  return [
    { id: 'departure', name: 'Departure', start: '08:00', end: '09:00', tasks: [{ text: 'Load transport & equipment', status: 'pending' }, { text: 'Depart confirmed', status: 'pending' }] },
    { id: 'deployment', name: 'Deployment', start: '09:00', end: '10:00', tasks: [{ text: 'Venue dock check-in & unload', status: 'pending' }, { text: 'Setup tables & linens', status: 'pending' }, { text: 'Setup buffet & stations', status: 'pending' }, { text: 'Staff briefing', status: 'pending' }, { text: 'Deployment ready sign-off', status: 'pending' }] },
    { id: 'execution', name: 'Execution', start: execStart, end: execEnd, tasks: [{ text: 'Guest arrival & reception', status: 'pending' }, { text: 'Buffet & service monitoring', status: 'pending' }, { text: 'Manager floor walk', status: 'pending' }] },
    { id: 'bashout', name: 'Bash-out', start: '22:00', end: '23:30', tasks: [{ text: 'Pack & inventory equipment', status: 'pending' }, { text: 'Venue sweep & cleanup', status: 'pending' }, { text: 'Load-out transport', status: 'pending' }] },
    { id: 'restorage', name: 'Restorage', start: '23:30', end: '01:00', tasks: [{ text: 'Return to office', status: 'pending' }, { text: 'Unload & inventory check', status: 'pending' }] }
  ];
}

// Ensures reservation executionPlan is fully hydrated from DB or created with defaults
async function ensureStaffResExecutionPlan(res) {
  if (!res) return null;
  // 1. Check if executionPlan already populated with phases
  if (res.executionPlan && Array.isArray(res.executionPlan.phases) && res.executionPlan.phases.length > 0) {
    return res.executionPlan;
  }
  // 2. Check if snake_case execution_plan exists on res
  if (res.execution_plan) {
    const parsed = typeof res.execution_plan === 'string' ? JSON.parse(res.execution_plan) : res.execution_plan;
    if (parsed && Array.isArray(parsed.phases) && parsed.phases.length > 0) {
      res.executionPlan = parsed;
      return res.executionPlan;
    }
  }
  // 3. Query Supabase execution_plans table
  const sb = window.supabaseClient;
  if (sb) {
    try {
      const { data: planData } = await sb.from('execution_plans').select('*').eq('reservation_id', String(res.id)).maybeSingle();
      if (planData) {
        const phasesArr = Array.isArray(planData.phases) ? planData.phases : (typeof planData.phases === 'string' ? JSON.parse(planData.phases) : []);
        if (phasesArr.length > 0) {
          res.executionPlan = {
            flexibility: planData.flexibility || 'strict',
            phases: phasesArr,
            active_phase_idx: planData.active_phase_idx !== undefined ? planData.active_phase_idx : 0
          };
          res.execution_plan = res.executionPlan;
          return res.executionPlan;
        }
      }
    } catch(e) {
      console.warn('[ensureStaffResExecutionPlan] DB query error:', e);
    }
  }
  // 4. Fallback: Build default phases for reservation
  const defaultPhases = buildDefaultStaffPhases(res);
  res.executionPlan = {
    flexibility: 'strict',
    phases: defaultPhases,
    active_phase_idx: 0
  };
  res.execution_plan = res.executionPlan;
  // Persist to Supabase execution_plans and reservations table
  if (sb) {
    try {
      await sb.from('execution_plans').upsert({
        reservation_id: String(res.id),
        flexibility: 'strict',
        phases: defaultPhases
      }, { onConflict: 'reservation_id' });
      await sb.from('reservations').update({
        execution_plan: res.executionPlan
      }).eq('id', String(res.id));
    } catch(e) {}
  }
  return res.executionPlan;
}

// Loads execution day activity logs from Supabase for live feed
async function loadStaffExecLiveActivities(resId) {
  if (!resId || !window.supabaseClient) return;
  try {
    const { data } = await window.supabaseClient
      .from('execution_day_activity_logs')
      .select('*')
      .eq('reservation_id', String(resId))
      .order('logged_at', { ascending: false })
      .limit(100);

    if (data && data.length) {
      staffExecLiveActivities = data.map(row => ({
        id: row.id,
        text: row.text,
        time: formatStaffTime12h(row.logged_at),
        phaseId: row.phase_id,
        phaseName: row.phase_name,
        logged_by_name: row.logged_by_name,
        logged_by_role: row.logged_by_role,
        logged_at: row.logged_at,
        fromDb: true
      }));
    }
  } catch(e) {
    console.warn('[loadStaffExecLiveActivities] error:', e);
  }
}
window.loadStaffExecLiveActivities = loadStaffExecLiveActivities;

function startStaffLivePolling(resId) {
  stopStaffLivePolling();
  _staffLiveFeedTimer = setInterval(async () => {
    if (document.hidden) return;
    if (activeStaffExecutionResId && String(activeStaffExecutionResId) === String(resId)) {
      await loadStaffExecLiveActivities(resId);
      if (_staffExecActiveView === 'phases') {
        const inputEl = document.getElementById('staff-exec-live-activity-input');
        if (!inputEl || document.activeElement !== inputEl) {
          renderStaffExecutionLive(true);
        }
      }
    }
  }, 6000);
}

function stopStaffLivePolling() {
  if (_staffLiveFeedTimer) {
    clearInterval(_staffLiveFeedTimer);
    _staffLiveFeedTimer = null;
  }
}

function initStaffExecRealtime(resId) {
  cleanupStaffExecRealtime();
  const sb = window.supabaseClient;
  if (!sb || !resId) return;
  try {
    _staffExecActivitiesSub = sb.channel('staff-live-activities-' + resId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'execution_day_activity_logs', filter: 'reservation_id=eq.' + resId }, async () => {
        await loadStaffExecLiveActivities(resId);
        if (_staffExecActiveView === 'phases') renderStaffExecutionLive();
      })
      .subscribe();

    _staffExecIncidentsSub = sb.channel('staff-live-incidents-' + resId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exec_batch_incidents', filter: 'reservation_id=eq.' + resId }, () => {
        if (_staffExecActiveView === 'equipment') renderStaffExecutionLive();
      })
      .subscribe();

    // Instant synchronization for admin completion finalization
    _staffExecLiveBroadcastSub = sb.channel('staff-exec-live-' + resId)
      .on('broadcast', { event: 'execution_finalized' }, () => {
        stopStaffFinalizationMonitor();
        showStaffExecCongratsModal();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservations', filter: 'id=eq.' + resId }, (payload) => {
        if (payload.new && (payload.new.status === 'completed' || payload.new.execution_live_status === 'completed')) {
          stopStaffFinalizationMonitor();
          showStaffExecCongratsModal();
        }
      })
      .subscribe();
  } catch(e) {
    console.warn('[initStaffExecRealtime] subscribe error:', e);
  }
}

function cleanupStaffExecRealtime() {
  if (_staffExecActivitiesSub) {
    try { _staffExecActivitiesSub.unsubscribe(); } catch(e) {}
    _staffExecActivitiesSub = null;
  }
  if (_staffExecIncidentsSub) {
    try { _staffExecIncidentsSub.unsubscribe(); } catch(e) {}
    _staffExecIncidentsSub = null;
  }
  if (_staffExecLiveBroadcastSub) {
    try { _staffExecLiveBroadcastSub.unsubscribe(); } catch(e) {}
    _staffExecLiveBroadcastSub = null;
  }
}

// Cross-tab and multi-device storage sync listener
window.addEventListener('storage', (e) => {
  if (activeStaffExecutionResId && (e.key === 'exec_finalized_' + activeStaffExecutionResId || e.key === 'exec_summary_' + activeStaffExecutionResId)) {
    stopStaffFinalizationMonitor();
    showStaffExecCongratsModal();
  }
});

async function startStaffExecutionDay(resId) {
  activeStaffExecutionResId = resId;
  activeStaffLivePhaseIdx = 0;
  _staffExecActiveView = 'phases';
  try { sessionStorage.setItem('active_staff_exec_res_id', resId); } catch(e) {}
  window.location.hash = '#execution-day?id=' + encodeURIComponent(resId);
  document.body.style.overflow = 'hidden';
  showSection('execution-live');

  // Hydrate execution plan and load activity logs before rendering
  let res = (Array.isArray(RESERVATIONS) ? RESERVATIONS : []).find(r => String(r.id) === String(resId));
  if (res && !isExecutionSessionLive(res) && res.status !== 'completed') {
    document.body.style.overflow = '';
    alert('Execution Day live session has not been started by the admin yet. Staff cannot enter live execution until the admin begins the live session or on the event day.');
    return;
  }
  if (res) {
    await ensureStaffResExecutionPlan(res);
  }
  await loadStaffExecLiveActivities(resId);
  await renderStaffExecutionLive();
  startStaffFinalizationMonitor(resId);
  initStaffExecRealtime(resId);
  startStaffLivePolling(resId);
}
window.startStaffExecutionDay = startStaffExecutionDay;

function exitStaffExecutionLive() {
  cleanupStaffManagerLiveMap();
  stopStaffLivePolling();
  stopStaffFinalizationMonitor();
  cleanupStaffExecRealtime();
  try { sessionStorage.removeItem('active_staff_exec_res_id'); } catch(e) {}
  document.body.style.overflow = '';
  window.location.hash = '#execution-day';
  showSection('execution-day');
}
window.exitStaffExecutionLive = exitStaffExecutionLive;

function selectStaffLivePhase(idx) {
  activeStaffLivePhaseIdx = idx;
  renderStaffExecutionLive();
}
window.selectStaffLivePhase = selectStaffLivePhase;

function switchStaffExecView(view) {
  _staffExecActiveView = view;
  renderStaffExecutionLive();
}
window.switchStaffExecView = switchStaffExecView;

// Monitor admin finalization in real-time
function startStaffFinalizationMonitor(resId) {
  stopStaffFinalizationMonitor();
  _staffFinalizePollTimer = setInterval(async () => {
    if (document.hidden) return;
    if (!resId || activeStaffExecutionResId !== resId) return;

    // 1. Check local storage
    const summaryLs = localStorage.getItem('exec_summary_' + resId);
    const finalizedLs = localStorage.getItem('exec_finalized_' + resId);
    if (summaryLs || finalizedLs) {
      stopStaffFinalizationMonitor();
      showStaffExecCongratsModal();
      return;
    }

    // 2. Check Supabase reservations table
    if (window.supabaseClient) {
      try {
        const { data } = await window.supabaseClient
          .from('reservations')
          .select('status, execution_live_status')
          .eq('id', String(resId))
          .maybeSingle();
        if (data && (data.status === 'completed' || data.execution_live_status === 'completed')) {
          stopStaffFinalizationMonitor();
          showStaffExecCongratsModal();
        }
      } catch(e) {}
    }
  }, 6000);
}

function stopStaffFinalizationMonitor() {
  if (_staffFinalizePollTimer) {
    clearInterval(_staffFinalizePollTimer);
    _staffFinalizePollTimer = null;
  }
}

function showStaffExecCongratsModal() {
  const modal = document.getElementById('staff-exec-congrats-modal');
  if (modal) modal.style.display = 'flex';
}
window.showStaffExecCongratsModal = showStaffExecCongratsModal;

function closeStaffExecCongratsModal() {
  const modal = document.getElementById('staff-exec-congrats-modal');
  if (modal) modal.style.display = 'none';
  exitStaffExecutionLive();
}
window.closeStaffExecCongratsModal = closeStaffExecCongratsModal;

const fallbackStaffRoles = {
  'Manager': 'Leads on-site event execution and provides live team GPS location tracking',
  'Setup & Styling': 'Tables, chairs, cloths, table settings, centerpieces, basic setup',
  'Food Service': 'Serve food, refill chafers, monitor temperatures, refill rice station',
  'Beverage Service': 'Juice, water, glasses, cocktail replenishment, beverage station care',
  'Table / Guest Service': 'Attentive waiter duties, handling guest requests, bussing tables',
  'Sanitation': 'Washing plates/glasses, cleaning spills, maintaining sanitation standards',
  'Equipment / Logistics': 'Equipment movement, inventory checks, unloading and loading logistics',
  'Event Floater': 'Flexible operational support across food stations, bar, and venue requirements',
  'Event Coordinator/Manager': 'Directs staff, enforces timeline, coordinates with client'
};

async function getStaffAssignedRolesWithDesc(resId, staffInput) {
  // Extract all potential identifiers for the current staff member
  let staffObj = {};
  if (staffInput && typeof staffInput === 'object') {
    staffObj = staffInput;
  } else {
    try {
      staffObj = JSON.parse(sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff') || '{}');
    } catch(e) {}
  }

  const explicitId = (typeof staffInput === 'string' && staffInput) ? staffInput : '';
  const possibleIds = new Set(
    [
      explicitId,
      staffObj.id,
      staffObj.uid,
      staffObj.user_id,
      staffObj.staff_id,
      localStorage.getItem('currentUserId')
    ].filter(Boolean).map(String)
  );

  const staffEmail = String(staffObj.email || '').trim().toLowerCase();
  const staffName = String(staffObj.name || '').trim().toLowerCase();

  // If Supabase client has an active authenticated session, include that UID
  if (window.supabaseClient && window.supabaseClient.auth) {
    try {
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      if (session?.user?.id) possibleIds.add(String(session.user.id));
    } catch(e) {}
  }

  const cacheKey = `${resId}_${Array.from(possibleIds).sort().join('-')}_${staffEmail}`;
  if (_staffRolesCache[cacheKey] && _staffRolesCache[cacheKey].length > 0) {
    return _staffRolesCache[cacheKey];
  }

  let assignedRoles = [];

  // 1. Query Supabase reservation_staff_assignments for this reservation
  if (window.supabaseClient && resId) {
    try {
      const { data: allAsgns, error: asgnErr } = await window.supabaseClient
        .from('reservation_staff_assignments')
        .select('*')
        .eq('reservation_id', String(resId));

      if (!asgnErr && Array.isArray(allAsgns) && allAsgns.length > 0) {
        // Find assignment matching any known staff ID
        let matched = allAsgns.find(a => possibleIds.has(String(a.staff_id)));

        // If no direct ID match found, resolve staff_id against users table by email/name
        if (!matched && (staffEmail || staffName)) {
          const asgnStaffIds = allAsgns.map(a => a.staff_id).filter(Boolean);
          if (asgnStaffIds.length > 0) {
            const { data: userRows } = await window.supabaseClient
              .from('users')
              .select('id, email, name')
              .in('id', asgnStaffIds);

            if (userRows && userRows.length > 0) {
              const matchedUser = userRows.find(u => {
                const uEmail = String(u.email || '').trim().toLowerCase();
                const uName = String(u.name || '').trim().toLowerCase();
                return (staffEmail && uEmail === staffEmail) || (staffName && uName === staffName);
              });
              if (matchedUser) {
                possibleIds.add(String(matchedUser.id));
                matched = allAsgns.find(a => String(a.staff_id) === String(matchedUser.id));
              }
            }
          }
        }

        // If still not matched, check if asgn row has staff_name or email
        if (!matched && (staffEmail || staffName)) {
          matched = allAsgns.find(a => {
            const aName = String(a.staff_name || a.name || '').trim().toLowerCase();
            const aEmail = String(a.email || '').trim().toLowerCase();
            return (staffEmail && aEmail === staffEmail) || (staffName && aName === staffName);
          });
        }

        if (matched && matched.roles) {
          assignedRoles = Array.isArray(matched.roles)
            ? matched.roles
            : (typeof matched.roles === 'string' ? JSON.parse(matched.roles) : []);
        }
      }
    } catch(e) {
      console.warn('[getStaffAssignedRolesWithDesc] DB fetch error:', e);
    }
  }

  // 2. Fallback to res.staffing.assignments / res.staff_assignments
  if (!assignedRoles.length) {
    const res = (Array.isArray(RESERVATIONS) ? RESERVATIONS : []).find(r => String(r.id) === String(resId));
    const asgns = (res && res.staffing && res.staffing.assignments) ||
                  (res && res.staff_assignments) ||
                  (res && res.staffAssignments) || [];

    const matched = asgns.find(a => {
      const aId = String(a.staffId || a.id || a.staff_id || a.userId || a.uid || '');
      const aEmail = String(a.email || '').trim().toLowerCase();
      const aName = String(a.name || a.staffName || '').trim().toLowerCase();
      return (aId && possibleIds.has(aId)) ||
             (staffEmail && aEmail === staffEmail) ||
             (staffName && aName === staffName);
    });

    if (matched && Array.isArray(matched.roles)) {
      assignedRoles = matched.roles;
    }
  }

  // 3. Fallback: check executionPlan phase tasks where task.staffIds or task.roles match
  if (!assignedRoles.length) {
    const res = (Array.isArray(RESERVATIONS) ? RESERVATIONS : []).find(r => String(r.id) === String(resId));
    if (res && res.executionPlan && Array.isArray(res.executionPlan.phases)) {
      const collected = new Set();
      res.executionPlan.phases.forEach(p => {
        (p.tasks || []).forEach(t => {
          const ids = (t.staffIds || []).map(String);
          const hasMatch = ids.some(id => possibleIds.has(id) || (staffName && id.toLowerCase() === staffName) || (staffEmail && id.toLowerCase() === staffEmail));
          if (hasMatch && Array.isArray(t.roles)) {
            t.roles.forEach(r => collected.add(r));
          }
        });
      });
      if (collected.size > 0) assignedRoles = Array.from(collected);
    }
  }

  // 4. Resolve descriptions from Supabase staff_roles or fallbackStaffRoles
  const result = [];
  for (const roleName of assignedRoles) {
    if (!roleName || !String(roleName).trim()) continue;
    const cleanRole = String(roleName).trim();
    let desc = fallbackStaffRoles[cleanRole] || '';
    if (window.supabaseClient) {
      try {
        const { data: roleRow } = await window.supabaseClient
          .from('staff_roles')
          .select('description')
          .eq('role_name', cleanRole)
          .maybeSingle();
        if (roleRow && roleRow.description) desc = roleRow.description;
      } catch(e) {}
    }
    result.push({ name: cleanRole, description: desc });
  }

  if (result.length > 0) {
    _staffRolesCache[cacheKey] = result;
  }
  return result;
}

// Offline incidents queue and auto-sync on internet reconnect
function enqueueStaffOfflineIncident(action) {
  try {
    let queue = JSON.parse(localStorage.getItem('exec_offline_incidents') || '[]');
    queue = queue.filter(q => !(q.id === action.id && q.type === action.type));
    queue.push(action);
    localStorage.setItem('exec_offline_incidents', JSON.stringify(queue));
  } catch(e) {}
}

async function syncStaffOfflineIncidents() {
  if (!navigator.onLine || !window.supabaseClient) return;
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem('exec_offline_incidents') || '[]'); } catch(e) {}
  if (!queue.length) return;

  const remaining = [];
  for (const action of queue) {
    try {
      if (action.type === 'insert') {
        const { error } = await window.supabaseClient.from('exec_batch_incidents').insert(action.payload);
        if (error && error.code !== '23505') remaining.push(action);
      } else if (action.type === 'update') {
        const { error } = await window.supabaseClient.from('exec_batch_incidents').update(action.payload).eq('id', action.id);
        if (error) remaining.push(action);
      } else if (action.type === 'delete') {
        const { error } = await window.supabaseClient.from('exec_batch_incidents').delete().eq('id', action.id);
        if (error) remaining.push(action);
      }
    } catch(e) {
      remaining.push(action);
    }
  }
  localStorage.setItem('exec_offline_incidents', JSON.stringify(remaining));
  if (queue.length > remaining.length && _staffExecActiveView === 'equipment') {
    renderStaffExecutionLive();
  }
}
window.addEventListener('online', syncStaffOfflineIncidents);

// Staff marks a phase task as done — CANNOT be unmarked once completed
async function staffMarkTaskDone(pIdx, tIdx) {
  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  if (!res || !res.executionPlan || !res.executionPlan.phases) return;
  const phase = res.executionPlan.phases[pIdx];
  if (!phase || !phase.tasks || !phase.tasks[tIdx]) return;
  let task = phase.tasks[tIdx];
  if (typeof task === 'string') {
    task = { text: task, staffIds: [], doneAt: null, status: 'pending' };
    phase.tasks[tIdx] = task;
  }

  // Once done, cannot unmark!
  if (task.doneAt || task.status === 'done' || task.status === 'completed') return;

  const now = new Date();
  const timeStr = formatStaffTime12h(now);
  task.doneAt = timeStr;
  task.status = 'done';

  const staffData = JSON.parse(sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff') || '{}');
  const staffName = staffData.name || 'Staff';

  const entry = {
    text: 'Task completed: ' + (task.text || ''),
    time: timeStr,
    phaseId: phase.id,
    phaseName: phase.name,
    logged_at: now.toISOString(),
    logged_by_name: staffName,
    logged_by_role: 'staff'
  };

  if (!res.executionPlan.activity_logs) res.executionPlan.activity_logs = [];
  res.executionPlan.activity_logs.unshift(entry);

  let localLogs = [];
  try { localLogs = JSON.parse(localStorage.getItem('exec_activities_' + res.id) || '[]'); } catch(e) {}
  localLogs.unshift(entry);
  try { localStorage.setItem('exec_activities_' + res.id, JSON.stringify(localLogs)); } catch(e) {}

  renderStaffExecutionLive();

  // Async persistence
  (async () => {
    const sb = window.supabaseClient;
    if (sb) {
      try {
        await sb.from('execution_day_activity_logs').insert({
          reservation_id: res.id,
          phase_id: phase.id,
          phase_name: phase.name,
          text: 'Task completed: ' + (task.text || ''),
          logged_by_name: staffName,
          logged_by_role: 'staff',
          logged_at: now.toISOString()
        });
      } catch(e) {}
      try {
        await sb.from('execution_plans').update({
          phases: res.executionPlan.phases,
          activity_logs: res.executionPlan.activity_logs
        }).eq('reservation_id', res.id);
        await sb.from('reservations').update({
          execution_plan: res.executionPlan
        }).eq('id', res.id);
      } catch(e) {}
    }
    if (window.firebaseDB && window.firebaseFns) {
      try {
        const { doc, updateDoc } = window.firebaseFns;
        await updateDoc(doc(window.firebaseDB, 'reservations', res.id), { executionPlan: res.executionPlan });
      } catch(e) {}
    }
  })();
}
window.staffMarkTaskDone = staffMarkTaskDone;

// Staff adds a custom activity log for the active phase
async function staffAddExecActivity() {
  const input = document.getElementById('staff-exec-live-activity-input');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  const now = new Date();
  const timeStr = formatStaffTime12h(now);

  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  if (!res || !res.executionPlan) return;
  const phase = res.executionPlan.phases && res.executionPlan.phases[activeStaffLivePhaseIdx];
  const phaseId = phase ? phase.id : 'general';
  const phaseName = phase ? phase.name : 'General';

  const staffData = JSON.parse(sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff') || '{}');
  const staffName = staffData.name || 'Staff';

  const entry = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('log_' + Date.now()),
    text,
    time: timeStr,
    phaseId,
    phaseName,
    logged_at: now.toISOString(),
    logged_by_name: staffName,
    logged_by_role: 'staff'
  };

  // Add to memory list
  staffExecLiveActivities.unshift(entry);

  if (!res.executionPlan.activity_logs) res.executionPlan.activity_logs = [];
  res.executionPlan.activity_logs.unshift(entry);

  let localLogs = [];
  try { localLogs = JSON.parse(localStorage.getItem('exec_activities_' + res.id) || '[]'); } catch(e) {}
  localLogs.unshift(entry);
  try { localStorage.setItem('exec_activities_' + res.id, JSON.stringify(localLogs)); } catch(e) {}

  input.value = '';
  renderStaffExecutionLive();

  const sb = window.supabaseClient;
  if (sb) {
    try {
      await sb.from('execution_day_activity_logs').insert({
        reservation_id: res.id,
        phase_id: phaseId,
        phase_name: phaseName,
        text,
        logged_by_name: staffName,
        logged_by_role: 'staff',
        logged_at: now.toISOString()
      });
      await sb.from('execution_plans').update({
        activity_logs: res.executionPlan.activity_logs
      }).eq('reservation_id', res.id);
      await sb.from('reservations').update({
        execution_plan: res.executionPlan
      }).eq('id', res.id);
    } catch(e) {
      console.warn('[staffAddExecActivity] persistence error:', e);
    }
  }
}
window.staffAddExecActivity = staffAddExecActivity;

// Scroll state preservation across equipment batch incident reports
let _staffSavedScrollTop = 0;
let _staffSavedSecY = 0;
let _staffSavedWindowY = 0;
let _staffLastInteractedEqId = null;

function captureStaffExecScroll(eqId) {
  const container = document.getElementById('staff-execution-live-container');
  const scrollEl = (container ? container.querySelector('div[style*="overflow-y"]') : null) || container;
  const secEl = document.getElementById('section-execution-live');
  if (scrollEl && scrollEl.scrollTop > 0) _staffSavedScrollTop = scrollEl.scrollTop;
  if (secEl && secEl.scrollTop > 0) _staffSavedSecY = secEl.scrollTop;
  _staffSavedWindowY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  if (eqId) _staffLastInteractedEqId = eqId;
}
window.captureStaffExecScroll = captureStaffExecScroll;

let staffExecLiveMap = null;
let staffManagerMarker = null;
let staffVenueMarker = null;
let staffRouteLine = null;
let _staffGpsWatchId = null;
let _staffLastKnownMgrLL = null;
let _staffHasUserPannedMap = false;
let _staffLastRouteLL = null;
let _staffIsFetchingRoute = false;

function getStaffManagerCircleIcon() {
  return L.divIcon({
    className: 'staff-manager-circle-marker',
    html: `<div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(37,99,235,0.25); animation:pulse 2s infinite ease-in-out;"></div>
      <div style="position:relative; width:18px; height:18px; border-radius:50%; background:#2563eb; border:3px solid #ffffff; box-shadow:0 0 10px rgba(37,99,235,0.6); display:flex; align-items:center; justify-content:center;">
        <div style="width:5px; height:5px; border-radius:50%; background:#ffffff;"></div>
      </div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

function getStaffVenueCircleIcon() {
  return L.divIcon({
    className: 'staff-venue-circle-marker',
    html: `<div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
      <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:rgba(220,38,38,0.25); animation:pulse 2s infinite ease-in-out;"></div>
      <div style="position:relative; width:18px; height:18px; border-radius:50%; background:#dc2626; border:3px solid #ffffff; box-shadow:0 0 10px rgba(220,38,38,0.6); display:flex; align-items:center; justify-content:center;">
        <div style="width:5px; height:5px; border-radius:50%; background:#ffffff;"></div>
      </div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
}

async function initStaffManagerLiveMap(res) {
  const mapContainer = document.getElementById('staff-exec-live-map');
  if (!mapContainer) return;

  if (typeof L === 'undefined' || !window.L) {
    console.warn('[initStaffManagerLiveMap] Leaflet not ready yet, retrying in 250ms...');
    setTimeout(() => initStaffManagerLiveMap(res), 250);
    return;
  }

  try {
    if (staffExecLiveMap) {
      try { staffExecLiveMap.remove(); } catch(e) {}
      staffExecLiveMap = null;
    }
    staffManagerMarker = null;
    staffVenueMarker = null;
    staffRouteLine = null;
    _staffLastRouteLL = null;
    if (mapContainer._leaflet_id) {
      delete mapContainer._leaflet_id;
      mapContainer._leaflet_id = null;
    }

    function parseStaffCoords(val) {
      if (!val) return null;
      if (Array.isArray(val) && val.length >= 2) {
        const lat = parseFloat(val[0]), lng = parseFloat(val[1]);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
      }
      if (typeof val === 'object') {
        const lat = parseFloat(val.lat || val.latitude);
        const lng = parseFloat(val.lng || val.lon || val.longitude);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
      }
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          const p = parseStaffCoords(parsed);
          if (p) return p;
        } catch(e) {}
        const parts = val.replace(/[\{\}\[\]\(\)]/g, '').split(',').map(s => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return [parts[0], parts[1]];
        }
      }
      return null;
    }

    // Resolve venue coordinates safely
    let venueCoords = parseStaffCoords(res.venue_coords) ||
                      parseStaffCoords(res.executionPlan?.venue_coords) ||
                      parseStaffCoords(res.execution_plan?.venue_coords) ||
                      parseStaffCoords([res.venueLat, res.venueLng]) ||
                      parseStaffCoords([res.latitude, res.longitude]) ||
                      [14.6575, 120.9575];

    staffExecLiveMap = L.map(mapContainer, {
      zoomControl: true,
      attributionControl: false
    }).setView(venueCoords, 14);

    staffExecLiveMap.on('dragstart zoomstart', () => {
      _staffHasUserPannedMap = true;
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19
    }).addTo(staffExecLiveMap);

    const vIcon = getStaffVenueCircleIcon();
    staffVenueMarker = L.marker(venueCoords, { icon: vIcon }).addTo(staffExecLiveMap)
      .bindPopup('<div style="font-size:12px;color:#dc2626;font-weight:700;">Venue Location</div><div style="font-size:11px;">' + escHtml(res.venue || 'Event Venue') + '</div>');

  function haversineMeters(p1, p2) {
    const R = 6371000;
    const dLat = (p2[0] - p1[0]) * Math.PI / 180;
    const dLng = (p2[1] - p1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function fetchStaffDrivingRoute(fromLL, toLL, resId) {
    if (!fromLL || !toLL) return;
    const startLat = Array.isArray(fromLL) ? fromLL[0] : fromLL.lat;
    const startLng = Array.isArray(fromLL) ? fromLL[1] : fromLL.lng;
    const endLat = Array.isArray(toLL) ? toLL[0] : toLL.lat;
    const endLng = Array.isArray(toLL) ? toLL[1] : toLL.lng;
    if (startLat == null || startLng == null || endLat == null || endLng == null) return;

    _staffIsFetchingRoute = true;
    _staffLastRouteLL = [startLat, startLng];

    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=false`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        _staffIsFetchingRoute = false;
        if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const rt = data.routes[0];
          const waypoints = rt.geometry.coordinates.map(c => [c[1], c[0]]);
          if (!staffRouteLine && staffExecLiveMap) {
            staffRouteLine = L.polyline(waypoints, {
              color: '#2563eb',
              weight: 5,
              opacity: 0.85
            }).addTo(staffExecLiveMap);
          } else if (staffRouteLine) {
            staffRouteLine.setLatLngs(waypoints);
          }

          // Broadcast recalculation to Supabase
          if (window.supabaseClient && resId) {
            try {
              window.supabaseClient.channel('cust-exec-live-' + resId).send({
                type: 'broadcast',
                event: 'manager_route_sync',
                payload: {
                  manager_route: waypoints,
                  timestamp: Date.now()
                }
              });
            } catch(e) {}

            try {
              window.supabaseClient.from('reservations').update({
                manager_route: waypoints
              }).eq('id', String(resId)).then(() => {}).catch(() => {});
            } catch(e) {}
          }
        } else {
          if (!staffRouteLine && staffExecLiveMap) {
            staffRouteLine = L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(staffExecLiveMap);
          } else if (staffRouteLine) {
            staffRouteLine.setLatLngs([[startLat, startLng], [endLat, endLng]]);
          }
        }
      })
      .catch(() => {
        _staffIsFetchingRoute = false;
        if (!staffRouteLine && staffExecLiveMap) {
          staffRouteLine = L.polyline([[startLat, startLng], [endLat, endLng]], { color: '#2563eb', weight: 4, opacity: 0.8 }).addTo(staffExecLiveMap);
        } else if (staffRouteLine) {
          staffRouteLine.setLatLngs([[startLat, startLng], [endLat, endLng]]);
        }
      });
  }

  // If manager location is already known, immediately render marker & route
  const initialMgrLL = _staffLastKnownMgrLL || (res.manager_location && Array.isArray(res.manager_location) ? res.manager_location : null);
  if (initialMgrLL && Array.isArray(initialMgrLL) && initialMgrLL.length >= 2) {
    _staffLastKnownMgrLL = initialMgrLL;
    const mIcon = getStaffManagerCircleIcon();
    staffManagerMarker = L.marker(initialMgrLL, { icon: mIcon }).addTo(staffExecLiveMap)
      .bindPopup('<div style="font-size:12px;color:#2563eb;font-weight:700;">Manager / Team Location</div><div style="font-size:11px;">Live Tracking Active</div>');
    fetchStaffDrivingRoute(initialMgrLL, venueCoords, res.id);
    if (!_staffHasUserPannedMap) {
      try {
        const bounds = L.latLngBounds([initialMgrLL, venueCoords]).pad(0.15);
        staffExecLiveMap.fitBounds(bounds);
      } catch(e) {}
    }
  }

  // Asynchronous geocode venue if needed
  const venueStr = res.venue || res.venueAddress;
  if (venueStr && (!res.venue_coords || !res.venue_coords.length)) {
    try {
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(venueStr), {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'SmartServe/1.0' }
      })
      .then(r => r.json())
      .then(geo => {
        if (geo && geo.length > 0 && staffExecLiveMap) {
          venueCoords = [parseFloat(geo[0].lat), parseFloat(geo[0].lon)];
          if (staffVenueMarker) staffVenueMarker.setLatLng(venueCoords);
        }
      }).catch(() => {});
    } catch(e) {}
  }

  // Start GPS Geolocation Watcher
  if ('geolocation' in navigator) {
    const statusEl = document.getElementById('staff-exec-map-status');
    const indicatorEl = document.getElementById('staff-gps-indicator');
    if (statusEl && !_staffLastKnownMgrLL) {
      statusEl.textContent = 'Requesting GPS location permissions...';
    }
    if (indicatorEl && !_staffLastKnownMgrLL) {
      indicatorEl.textContent = 'Acquiring GPS...';
      indicatorEl.style.color = '#3b82f6';
      indicatorEl.style.background = 'rgba(59,130,246,0.1)';
      indicatorEl.style.border = '1px solid rgba(59,130,246,0.3)';
    }

    const onLocationSuccess = (pos) => {
      if (!staffExecLiveMap) return;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const mgrLL = [lat, lng];
      _staffLastKnownMgrLL = mgrLL;

      const retryBtn = document.getElementById('staff-gps-retry-btn');
      if (retryBtn) retryBtn.style.display = 'none';

      // Update or create manager marker
      if (!staffManagerMarker) {
        const mIcon = getStaffManagerCircleIcon();
        staffManagerMarker = L.marker(mgrLL, { icon: mIcon }).addTo(staffExecLiveMap)
          .bindPopup('<div style="font-size:12px;color:#2563eb;font-weight:700;">Manager / Team Location</div><div style="font-size:11px;">Live Tracking Active</div>');
      } else {
        staffManagerMarker.setLatLng(mgrLL);
      }

      // Update road route to venue dynamically
      if (staffVenueMarker) {
        const vLL = staffVenueMarker.getLatLng();
        const vCoords = [vLL.lat, vLL.lng];
        const distMoved = _staffLastRouteLL ? haversineMeters(_staffLastRouteLL, mgrLL) : 999;
        if (!_staffLastRouteLL || distMoved >= 25 || !staffRouteLine) {
          fetchStaffDrivingRoute(mgrLL, vCoords, res.id);
        }
        if (!_staffHasUserPannedMap) {
          try {
            const bounds = L.latLngBounds([mgrLL, vCoords]).pad(0.15);
            staffExecLiveMap.fitBounds(bounds);
          } catch(e) {}
        }
      }

      // Update status banner
      const statusEl = document.getElementById('staff-exec-map-status');
      if (statusEl) {
        statusEl.textContent = `Broadcasting live GPS (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
      }
      const indicatorEl = document.getElementById('staff-gps-indicator');
      if (indicatorEl) {
        indicatorEl.textContent = 'GPS Active';
        indicatorEl.style.color = '#10b981';
        indicatorEl.style.background = 'rgba(16,185,129,0.1)';
        indicatorEl.style.border = '1px solid rgba(16,185,129,0.3)';
      }

      // Real-time broadcast to Supabase
      if (window.supabaseClient && res.id) {
        try {
          window.supabaseClient.channel('cust-exec-live-' + res.id).send({
            type: 'broadcast',
            event: 'manager_location_sync',
            payload: {
              manager_location: mgrLL,
              timestamp: Date.now()
            }
          });
        } catch(e) {}

        // Persist manager_location in reservations table
        try {
          window.supabaseClient.from('reservations').update({
            manager_location: mgrLL
          }).eq('id', String(res.id)).then(() => {}).catch(() => {});
        } catch(e) {}
      }
    };

    const onLocationError = (err) => {
      console.warn('[Staff GPS] Location error:', err);
      const statusEl = document.getElementById('staff-exec-map-status');
      const indicatorEl = document.getElementById('staff-gps-indicator');
      const retryBtn = document.getElementById('staff-gps-retry-btn');
      if (retryBtn) retryBtn.style.display = 'inline-block';

      let msg = 'Signal searching / waiting for location...';
      if (err.code === 1) { // PERMISSION_DENIED
        msg = 'Location permission was denied. Please allow location access in your browser address bar.';
        if (indicatorEl) {
          indicatorEl.textContent = 'Permission Denied';
          indicatorEl.style.color = '#ef4444';
          indicatorEl.style.background = 'rgba(239,68,68,0.1)';
          indicatorEl.style.border = '1px solid rgba(239,68,68,0.3)';
        }
      } else if (err.code === 2) {
        msg = 'Location unavailable or device GPS signal is weak.';
      } else if (err.code === 3) {
        msg = 'GPS acquisition timed out. Retrying...';
      }
      if (statusEl) statusEl.textContent = msg;
    };

    navigator.geolocation.getCurrentPosition(onLocationSuccess, onLocationError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    });

    if (_staffGpsWatchId) {
      try { navigator.geolocation.clearWatch(_staffGpsWatchId); } catch(e) {}
    }
    _staffGpsWatchId = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000
    });
  } else {
    const statusEl = document.getElementById('staff-exec-map-status');
    if (statusEl) statusEl.textContent = 'Geolocation is not supported by your device browser.';
  }

    [50, 150, 300, 600, 1000].forEach(ms => {
      setTimeout(() => {
        if (staffExecLiveMap) staffExecLiveMap.invalidateSize();
      }, ms);
    });
  } catch(err) {
    console.error('[initStaffManagerLiveMap] Error:', err);
  }
}

function cleanupStaffManagerLiveMap() {
  if (_staffGpsWatchId) {
    try { navigator.geolocation.clearWatch(_staffGpsWatchId); } catch(e) {}
    _staffGpsWatchId = null;
  }
  if (staffExecLiveMap) {
    try { staffExecLiveMap.remove(); } catch(e) {}
    staffExecLiveMap = null;
    staffManagerMarker = null;
    staffVenueMarker = null;
    staffRouteLine = null;
    _staffLastRouteLL = null;
  }
}
function retryStaffManagerGPS() {
  const res = (Array.isArray(RESERVATIONS) ? RESERVATIONS : []).find(r => String(r.id) === String(activeStaffExecutionResId));
  if (res) {
    initStaffManagerLiveMap(res);
  }
}
window.retryStaffManagerGPS = retryStaffManagerGPS;
window.initStaffManagerLiveMap = initStaffManagerLiveMap;
window.cleanupStaffManagerLiveMap = cleanupStaffManagerLiveMap;

// Master renderer for Staff Execution Live View
async function renderStaffExecutionLive(isPolling = false) {
  // Synchronously capture scroll before any async awaits can collapse the layout
  if (!_staffSavedScrollTop) {
    const _c = document.getElementById('staff-execution-live-container');
    const _s = (_c ? _c.querySelector('div[style*="overflow-y"]') : null) || _c;
    const _sec = document.getElementById('section-execution-live');
    if (_s && _s.scrollTop > 0) _staffSavedScrollTop = _s.scrollTop;
    if (_sec && _sec.scrollTop > 0) _staffSavedSecY = _sec.scrollTop;
    _staffSavedWindowY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  let res = (Array.isArray(RESERVATIONS) ? RESERVATIONS : []).find(r => String(r.id) === String(activeStaffExecutionResId));
  if (!res && window.supabaseClient && activeStaffExecutionResId) {
    try {
      const { data: dbRes } = await window.supabaseClient.from('reservations').select('*').eq('id', String(activeStaffExecutionResId)).maybeSingle();
      if (dbRes) {
        res = dbRes;
        RESERVATIONS.push(dbRes);
        window.RESERVATIONS = RESERVATIONS;
      }
    } catch(e) {}
  }
  if (!res) return;

  // Hydrate execution plan from DB or fallback defaults
  await ensureStaffResExecutionPlan(res);
  if (!res.executionPlan || !Array.isArray(res.executionPlan.phases) || res.executionPlan.phases.length === 0) return;

  const container = document.getElementById('staff-execution-live-container');
  if (!container) return;

  // When live polling, only update the phases/tasks DOM so the Leaflet live map is not destroyed
  const phasesWrap = document.getElementById('staff-exec-phases-view-wrap');
  if (isPolling && phasesWrap) {
    let innerContent = '';
    if (_staffExecActiveView === 'equipment') {
      innerContent = await buildStaffEquipmentBatchHtml(res);
    } else {
      innerContent = buildStaffPhasesHtml(res);
    }
    phasesWrap.innerHTML = innerContent;
    if (staffExecLiveMap) {
      staffExecLiveMap.invalidateSize();
    }
    return;
  }

  const staffData = JSON.parse(sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff') || '{}');
  const staffId = staffData.id || '';
  const clientName = res.client || res.name || res.customerName || 'Client';
  const pkgName = res.packageName || res.package_name || res.package || '';
  const evDate = res.date || res.event_date || '';

  // 1. Fetch assigned roles and descriptions
  const rolesWithDesc = await getStaffAssignedRolesWithDesc(res.id, staffData);
  const isManager = rolesWithDesc.some(r => String(r.name || '').trim().toLowerCase() === 'manager') ||
    String(staffData.role || '').trim().toLowerCase() === 'manager';

  // 2. Build Top Header
  let html = `
    <!-- Top Bar -->
    <div style="background:var(--bg2);border-bottom:1px solid var(--border);padding:14px 24px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:16px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:14px;">
        <button onclick="exitStaffExecutionLive()" style="background:none;border:1px solid var(--border);color:var(--cream);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;"
          onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='none'">
          &larr; Exit Live
        </button>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--cream);line-height:1.2;">${escHtml(clientName)}'s Event</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${escHtml(pkgName ? pkgName + ' · ' : '')}${escHtml(evDate)}</div>
        </div>
      </div>
      <!-- View Switcher -->
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="switchStaffExecView('phases')"
          style="padding:8px 16px;border-radius:8px;border:1px solid ${_staffExecActiveView === 'phases' ? 'var(--gold)' : 'var(--border)'};background:${_staffExecActiveView === 'phases' ? 'rgba(196,154,60,0.1)' : 'var(--bg3)'};color:${_staffExecActiveView === 'phases' ? 'var(--gold)' : 'var(--cream)'};font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;">
          Execution Phases
        </button>
        <button onclick="switchStaffExecView('equipment')"
          style="padding:8px 16px;border-radius:8px;border:1px solid ${_staffExecActiveView === 'equipment' ? 'var(--gold)' : 'var(--border)'};background:${_staffExecActiveView === 'equipment' ? 'rgba(196,154,60,0.1)' : 'var(--bg3)'};color:${_staffExecActiveView === 'equipment' ? 'var(--gold)' : 'var(--cream)'};font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;">
          Equipment Batch Allocation
        </button>
      </div>
    </div>

    <!-- Main Content Container (Scrollable) -->
    <div style="flex:1;overflow-y:auto;padding:24px 30px;background:var(--bg);">
      <div style="max-width:1100px;margin:0 auto;">

        <!-- Prominently Highlighted Staff Roles Banner at Top -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-left:4px solid var(--gold);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Assigned Role &amp; Responsibilities</div>
          ${rolesWithDesc.length === 0 ? `
            <div style="font-size:13px;color:var(--text-dim);">Supporting the execution team as General Operations Staff.</div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${rolesWithDesc.map(r => `
                <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px 16px;">
                  <div style="font-size:14px;font-weight:800;color:var(--cream);">${escHtml(r.name)}</div>
                  ${r.description ? `<div style="font-size:12px;color:var(--text-dim);margin-top:3px;line-height:1.4;">${escHtml(r.description)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        ${isManager ? `
          <!-- Manager Live Team GPS Tracker & Map -->
          <div id="staff-exec-manager-map-card" style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
              <div>
                <div style="font-size:14px;font-weight:800;color:var(--cream);display:flex;align-items:center;gap:8px;">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2563eb;box-shadow:0 0 8px #2563eb;"></span>
                  Team Live GPS Tracker (Manager On-Site)
                </div>
                <div style="font-size:12px;color:var(--text-dim);margin-top:2px;" id="staff-exec-map-status">
                  Requesting GPS location permissions...
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button id="staff-gps-retry-btn" onclick="retryStaffManagerGPS()" style="display:none;background:var(--bg3);border:1px solid var(--border);color:var(--gold);font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;cursor:pointer;">
                  Retry GPS
                </button>
                <span id="staff-gps-indicator" style="font-size:11px;font-weight:700;color:#3b82f6;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);padding:4px 10px;border-radius:20px;">
                  Acquiring GPS...
                </span>
              </div>
            </div>
            <div id="staff-exec-live-map" style="width:100%;height:320px;border-radius:10px;overflow:hidden;border:1px solid var(--border);position:relative;z-index:1;"></div>
          </div>
        ` : ''}
  `;

  // 3. Render either Phases View or Equipment Batch Allocation View
  html += `<div id="staff-exec-phases-view-wrap">`;
  if (_staffExecActiveView === 'equipment') {
    html += await buildStaffEquipmentBatchHtml(res);
  } else {
    html += buildStaffPhasesHtml(res);
  }
  html += `</div>`;

  html += `
      </div>
    </div>
  `;

  // Preserve scroll position before updating innerHTML so reporting incidents never jumps to the top
  const scrollEl = (container ? container.querySelector('div[style*="overflow-y"]') : null) || container;
  const secEl = document.getElementById('section-execution-live');
  if (scrollEl && scrollEl.scrollTop > 0) _staffSavedScrollTop = scrollEl.scrollTop;
  if (secEl && secEl.scrollTop > 0) _staffSavedSecY = secEl.scrollTop;
  if (!_staffSavedWindowY) _staffSavedWindowY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

  const prevScrollTop = _staffSavedScrollTop;
  const prevSecY = _staffSavedSecY;
  const prevWindowY = _staffSavedWindowY;
  const targetEqId = _staffLastInteractedEqId;

  container.innerHTML = html;

  if (isManager) {
    setTimeout(() => initStaffManagerLiveMap(res), 150);
  } else {
    cleanupStaffManagerLiveMap();
  }

  // Restore scroll position across mobile and desktop views
  const restoreStaffScroll = () => {
    const newScrollEl = (container ? container.querySelector('div[style*="overflow-y"]') : null) || container;
    const newSecEl = document.getElementById('section-execution-live');
    if (newScrollEl && prevScrollTop) newScrollEl.scrollTop = prevScrollTop;
    if (newSecEl && prevSecY) newSecEl.scrollTop = prevSecY;
    if (prevWindowY) window.scrollTo(0, prevWindowY);

    if (targetEqId) {
      const row = document.getElementById('staff-equip-row-' + targetEqId) ||
                  (container ? container.querySelector(`[data-equip-id="${targetEqId}"]`) : null);
      if (row && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      }
    }
  };
  restoreStaffScroll();
  requestAnimationFrame(restoreStaffScroll);
  setTimeout(restoreStaffScroll, 50);
  setTimeout(() => {
    restoreStaffScroll();
    _staffLastInteractedEqId = null;
    _staffSavedScrollTop = 0;
    _staffSavedSecY = 0;
    _staffSavedWindowY = 0;
  }, 120);
}

// Builds the execution phases view (matching admin phases without the map)
function buildStaffPhasesHtml(res) {
  const ep = res.executionPlan || {};
  const phases = ep.phases || [];
  const p = phases[activeStaffLivePhaseIdx] || phases[0] || {};
  const tasks = p.tasks || [];

  const doneCount = tasks.filter(t => typeof t === 'object' && (t.doneAt || t.status === 'done' || t.status === 'completed')).length;
  const totalCount = tasks.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Collect activity logs for this phase
  let phaseLogs = [];
  const currentPId = String(p.id || '').toLowerCase();
  const currentPName = String(p.name || '').toLowerCase();

  const isLogMatch = (l) => {
    const lPId = String(l.phaseId || l.phase_id || '').toLowerCase();
    const lPName = String(l.phaseName || l.phase_name || '').toLowerCase();
    if (!lPId || lPId === 'general' || lPId === 'all') return true;
    return lPId === currentPId || lPName === currentPName || currentPId.includes(lPId) || lPId.includes(currentPId);
  };

  if (Array.isArray(staffExecLiveActivities) && staffExecLiveActivities.length) {
    phaseLogs.push(...staffExecLiveActivities.filter(isLogMatch));
  }
  if (Array.isArray(ep.activity_logs)) {
    ep.activity_logs.filter(isLogMatch).forEach(al => {
      if (!phaseLogs.some(pl => pl.text === al.text && (pl.time === al.time || pl.logged_at === al.logged_at))) {
        phaseLogs.push(al);
      }
    });
  }
  try {
    const cached = JSON.parse(localStorage.getItem('exec_activities_' + res.id) || '[]');
    if (Array.isArray(cached)) {
      cached.filter(isLogMatch).forEach(c => {
        if (!phaseLogs.some(pl => pl.text === c.text && (pl.time === c.time || pl.logged_at === c.logged_at))) {
          phaseLogs.push(c);
        }
      });
    }
  } catch(e) {}

  // If in execution phase and agenda is not loaded yet, fetch from additional_reservation_details
  if (p.id === 'execution' && (!p.agenda || !p.agenda.length) && !p._fetchingAgenda) {
    p._fetchingAgenda = true;
    if (window.supabaseClient && res.id) {
      window.supabaseClient.from('additional_reservation_details')
        .select('event_flow')
        .eq('reservation_id', res.id)
        .maybeSingle()
        .then(({ data: ard }) => {
          p._fetchingAgenda = false;
          if (ard && Array.isArray(ard.event_flow) && ard.event_flow.length > 0) {
            p.agenda = ard.event_flow;
            if (typeof renderStaffLiveExecutionOverlay === 'function') renderStaffLiveExecutionOverlay();
          }
        })
        .catch(() => { p._fetchingAgenda = false; });
    }
  }

  // Fallback to res.event_flow or res.eventFlow if available
  if (p.id === 'execution' && (!p.agenda || !p.agenda.length)) {
    if (Array.isArray(res.event_flow) && res.event_flow.length > 0) {
      p.agenda = res.event_flow;
    } else if (Array.isArray(res.eventFlow) && res.eventFlow.length > 0) {
      p.agenda = res.eventFlow;
    }
  }

  const evStart12 = formatStaffTime12h(p.start || (res.time ? res.time.split(' - ')[0] : '')) || '8:00 AM';
  const evEnd12 = formatStaffTime12h(p.end || (res.time ? res.time.split(' - ')[1] : '')) || '8:00 PM';

  return `
    <!-- Execution Phases Tabs Across Top (Scrollable Horizontally on Mobile) -->
    <div class="staff-exec-phases-scroll" style="display:flex;gap:10px;margin-bottom:20px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px;">
      ${phases.map((ph, idx) => {
        const isActive = idx === activeStaffLivePhaseIdx;
        const phTasks = ph.tasks || [];
        const phDone = phTasks.filter(t => typeof t === 'object' && (t.doneAt || t.status === 'done' || t.status === 'completed')).length;
        const start12h = formatStaffTime12h(ph.start);
        const end12h = formatStaffTime12h(ph.end);
        return `
          <button onclick="selectStaffLivePhase(${idx})"
            style="flex:0 0 160px;min-width:150px;padding:14px 12px;border-radius:10px;border:1px solid ${isActive ? 'var(--gold)' : 'var(--border)'};background:${isActive ? 'rgba(196,154,60,0.1)' : 'var(--bg2)'};text-align:left;cursor:pointer;transition:all 0.15s;box-sizing:border-box;">
            <div style="font-size:11px;font-weight:800;color:${isActive ? 'var(--gold)' : 'var(--text-dim)'};text-transform:uppercase;margin-bottom:4px;">${escHtml(ph.name)}</div>
            <div style="font-size:12px;font-weight:700;color:var(--cream);">${escHtml(start12h)} – ${escHtml(end12h)}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">${phDone}/${phTasks.length} done</div>
          </button>
        `;
      }).join('')}
    </div>

    <!-- Active Phase Detail Card -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:22px 24px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Active Operational Phase</div>
          <div style="font-size:22px;font-weight:800;color:var(--cream);">${escHtml(p.name)} Phase</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">Scheduled Window: ${escHtml(formatStaffTime12h(p.start))} – ${escHtml(formatStaffTime12h(p.end))}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:14px;font-weight:700;color:var(--gold);">${doneCount} of ${totalCount} Tasks Done (${pct}%)</div>
          <div style="width:160px;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;margin-top:6px;">
            <div style="width:${pct}%;height:100%;background:var(--gold);transition:width 0.3s;"></div>
          </div>
        </div>
      </div>

      <!-- Task Checklist -->
      <div style="font-size:11px;font-weight:800;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Phase Checklist &amp; Tasks</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${tasks.length === 0 ? `
          <div style="padding:24px;text-align:center;color:var(--text-dim);font-size:13px;">No tasks assigned for this phase.</div>
        ` : tasks.map((t, tIdx) => {
          const tText = typeof t === 'string' ? t : (t.text || '');
          const isDone = typeof t === 'object' && (t.doneAt || t.status === 'done' || t.status === 'completed');
          const doneTime = typeof t === 'object' && t.doneAt ? formatStaffTime12h(t.doneAt) : '';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--bg3);border:1px solid ${isDone ? 'rgba(22,163,74,0.3)' : 'var(--border)'};border-radius:10px;gap:16px;">
              <div style="display:flex;align-items:center;gap:12px;flex:1;">
                <div style="width:8px;height:8px;border-radius:50%;background:${isDone ? '#16a34a' : 'rgba(255,255,255,0.2)'};flex-shrink:0;"></div>
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--cream);line-height:1.4;text-decoration:${isDone ? 'line-through' : 'none'};opacity:${isDone ? 0.75 : 1};">${escHtml(tText)}</div>
                  ${isDone && doneTime ? `<div style="font-size:11px;color:#16a34a;margin-top:2px;">Done at ${escHtml(doneTime)}</div>` : ''}
                </div>
              </div>
              <div>
                ${isDone ? `
                  <button disabled
                    style="padding:8px 16px;border-radius:8px;border:1px solid #16a34a;background:transparent;color:#16a34a;font-size:13px;font-weight:700;cursor:default;">
                    Completed
                  </button>
                ` : `
                  <button onclick="staffMarkTaskDone(${activeStaffLivePhaseIdx}, ${tIdx})"
                    style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--cream);font-size:13px;font-weight:700;cursor:pointer;transition:all 0.15s;">
                    Mark Done
                  </button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Execution Program Flow when in Execution phase (matching Admin Side) -->
      ${p.id === 'execution' ? `
        <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border);">
          <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Execution Agenda</div>
          <div style="font-size:16px;font-weight:700;color:var(--cream);margin-bottom:14px;">Event Program Flow</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <!-- Beginning of Event Anchor -->
            <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.25);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:14px;">
              <span style="font-size:13px;color:var(--gold);font-weight:800;min-width:80px;letter-spacing:0.5px;">${escHtml(evStart12)}</span>
              <span style="font-size:13px;color:var(--cream);font-style:italic;font-weight:600;">Beginning of Event</span>
            </div>

            <!-- Flow / Agenda Items In Between -->
            ${(p.agenda && p.agenda.length > 0) ? p.agenda.map(a => {
              const typeColors = {
                'Arrival': { text: '#4ade80' },
                'Program': { text: '#c084fc' },
                'Catering': { text: '#60a5fa' },
                'Buffer': { text: '#fbbf24' },
                'Custom': { text: 'var(--text-dim)' }
              };
              const aType = a.type || 'Custom';
              const tc = typeColors[aType] || typeColors['Custom'];
              const aTime = formatStaffTime12h(a.time || a.start || '') || '';
              const aTitle = a.text || a.title || a.name || a.activity || '';
              return `
                <div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
                  <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
                    <span style="font-size:13px;color:var(--gold);font-weight:800;min-width:80px;letter-spacing:0.5px;">${escHtml(aTime)}</span>
                    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${tc.text};">${escHtml(aType)}</span>
                    <span style="font-size:13px;color:var(--cream);font-weight:600;">${escHtml(aTitle)}</span>
                  </div>
                </div>
              `;
            }).join('') : `
              <div style="text-align:center;padding:16px;color:var(--text-dim);font-size:12px;background:var(--bg3);border:1px dashed var(--border);border-radius:10px;">
                No agenda items between beginning and end.
              </div>
            `}

            <!-- End of Event Anchor -->
            <div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.25);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:14px;">
              <span style="font-size:13px;color:var(--gold);font-weight:800;min-width:80px;letter-spacing:0.5px;">${escHtml(evEnd12)}</span>
              <span style="font-size:13px;color:var(--cream);font-style:italic;font-weight:600;">End of Event</span>
            </div>
          </div>
        </div>
      ` : ''}
    </div>

    <!-- Phase Activity Logs -->
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px 24px;">
      <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Activity Log — ${escHtml(p.name)}</div>
      <div style="font-size:15px;font-weight:700;color:var(--cream);margin-bottom:14px;">Live Operations Feed</div>

      <!-- Add Log Input Box -->
      <div style="display:flex;gap:10px;margin-bottom:18px;">
        <input type="text" id="staff-exec-live-activity-input" placeholder="Log an activity for ${escHtml(p.name)} phase..."
          onkeydown="if(event.key==='Enter')staffAddExecActivity()"
          style="flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--cream);font-size:13px;" />
        <button onclick="staffAddExecActivity()"
          style="padding:10px 20px;border-radius:8px;border:none;background:var(--gold);color:#000;font-size:13px;font-weight:800;cursor:pointer;">
          + Log
        </button>
      </div>

      <!-- Log Entries List matching Admin Side UI -->
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${phaseLogs.length === 0 ? `
          <div style="text-align:center;padding:24px;color:var(--text-dim);font-size:13px;">No activity logs recorded yet for this phase.</div>
        ` : phaseLogs.map(l => {
          const lTime = formatStaffTime12h(l.time || l.logged_at);
          return `
            <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;">
              <div style="width:8px;height:8px;border-radius:50%;background:#16a34a;margin-top:5px;flex-shrink:0;"></div>
              <div style="flex:1;font-size:14px;color:var(--cream);line-height:1.4;">${escHtml(l.text || '')}</div>
              <div style="font-size:12px;color:var(--text-dim);white-space:nowrap;margin-left:8px;">${escHtml(lTime)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ====================================================================
// STAFF EQUIPMENT BATCH ALLOCATION SYSTEM (EXACT MATCH TO ADMIN SIDE)
// ====================================================================

function getLocalStaffIncidents(resId) {
  try {
    return JSON.parse(localStorage.getItem('ss_staff_incidents_' + resId) || '[]');
  } catch(e) { return []; }
}

function saveLocalStaffIncident(resId, inc) {
  const list = getLocalStaffIncidents(resId);
  const idx = list.findIndex(i => i.id === inc.id);
  if (idx >= 0) list[idx] = inc; else list.push(inc);
  try { localStorage.setItem('ss_staff_incidents_' + resId, JSON.stringify(list)); } catch(e) {}
}

function removeLocalStaffIncident(resId, incId) {
  const list = getLocalStaffIncidents(resId).filter(i => i.id !== incId);
  try { localStorage.setItem('ss_staff_incidents_' + resId, JSON.stringify(list)); } catch(e) {}
}

// Builds the Equipment Batch Allocation View for staff (exact match to admin side)
async function buildStaffEquipmentBatchHtml(res) {
  let equipment = [];
  const sb = window.supabaseClient;

  // 1. Fetch allocated equipment from allocation_history and equipment_inventory
  if (sb) {
    try {
      const { data: hist } = await sb.from('allocation_history')
        .select('*')
        .eq('reservation_id', res.id)
        .order('recorded_at', { ascending: false });

      const { data: invAllocs } = await sb.from('equipment_inventory')
        .select('id, asset_id, name, category, allocated_qty, allocated_reservation_id, consumable')
        .eq('allocated_reservation_id', res.id);

      const dedupMap = {};
      (hist || []).forEach(h => {
        const key = (h.asset_id || h.equipment_id || h.equipment_name || '').toLowerCase().trim();
        if (!key) return;
        const time = h.recorded_at ? new Date(h.recorded_at).getTime() : 0;
        if (!dedupMap[key] || time > dedupMap[key]._time) {
          dedupMap[key] = {
            id: h.equipment_id || h.id,
            asset_id: h.asset_id || h.assetId || '',
            name: h.equipment_name || 'Equipment',
            category: h.category || '',
            allocated_quantity: h.allocated_qty || h.allocated_quantity || 1,
            is_rental: !!h.is_rental,
            is_venue: h.allocation_batch && h.allocation_batch.startsWith('VENUE-'),
            consumable: !!h.consumable,
            _time: time
          };
        }
      });

      if (invAllocs && invAllocs.length) {
        invAllocs.forEach(inv => {
          const key = (inv.asset_id || inv.id || inv.name || '').toLowerCase().trim();
          if (!dedupMap[key]) {
            dedupMap[key] = {
              id: inv.id,
              asset_id: inv.asset_id || '',
              name: inv.name || 'Equipment',
              category: inv.category || '',
              allocated_quantity: inv.allocated_qty || 1,
              is_rental: false,
              is_venue: false,
              consumable: !!inv.consumable,
              _time: 1
            };
          } else {
            if (inv.category) dedupMap[key].category = inv.category;
            if (inv.asset_id && !dedupMap[key].asset_id) dedupMap[key].asset_id = inv.asset_id;
            if (inv.consumable !== undefined) dedupMap[key].consumable = !!inv.consumable;
          }
        });
      }

      // Query equipment_inventory table to retrieve authentic categories
      const eqKeys = Object.values(dedupMap).map(e => e.id).filter(Boolean);
      if (eqKeys.length > 0) {
        try {
          const { data: invDetails } = await sb.from('equipment_inventory')
            .select('id, asset_id, category, name, consumable')
            .in('id', eqKeys);
          if (invDetails) {
            invDetails.forEach(inv => {
              const item = Object.values(dedupMap).find(e => e.id === inv.id || (inv.asset_id && e.asset_id === inv.asset_id));
              if (item) {
                if (inv.category && !item.category) item.category = inv.category;
                if (inv.asset_id && !item.asset_id) item.asset_id = inv.asset_id;
                if (inv.name && !item.name) item.name = inv.name;
                if (inv.consumable !== undefined) item.consumable = !!inv.consumable;
              }
            });
          }
        } catch(e) {}
      }

      // Check EIM_ASSETS / localAssets if available
      const localAssets = (typeof EIM_ASSETS !== 'undefined' ? EIM_ASSETS : (window.EIM_ASSETS || []));
      Object.values(dedupMap).forEach(item => {
        const found = localAssets.find(a => (a.assetId && a.assetId === item.asset_id) || (a.id && a.id === item.id) || (a.name && a.name.toLowerCase() === item.name.toLowerCase()));
        if (found) {
          if (found.category && !item.category) item.category = found.category;
          if (found.assetId && !item.asset_id) item.asset_id = found.assetId;
          if (found.consumable !== undefined) item.consumable = !!found.consumable;
        }
      });

      // Smart semantic classification fallback matching admin
      Object.values(dedupMap).forEach(item => {
        if (!item.category || item.category.toLowerCase() === 'general' || item.category.toLowerCase() === 'general equipment') {
          const n = (item.name || '').toLowerCase();
          if (n.includes('chair') || n.includes('table') || n.includes('seat') || n.includes('stool') || n.includes('bench')) item.category = 'Furniture';
          else if (n.includes('spoon') || n.includes('fork') || n.includes('knife') || n.includes('plate') || n.includes('glass') || n.includes('bowl') || n.includes('cup') || n.includes('saucer') || n.includes('pitcher') || n.includes('tray') || n.includes('goblet') || n.includes('cutlery')) item.category = 'Tableware';
          else if (n.includes('chafing') || n.includes('warmer') || n.includes('pan') || n.includes('dispenser') || n.includes('sandok') || n.includes('tongs') || n.includes('buffet') || n.includes('burner')) item.category = 'Serving';
          else if (n.includes('cloth') || n.includes('linen') || n.includes('napkin') || n.includes('cover') || n.includes('skirt') || n.includes('runner')) item.category = 'Linens';
          else if (n.includes('speaker') || n.includes('mic') || n.includes('light') || n.includes('cable') || n.includes('projector') || n.includes('sound')) item.category = 'AV & Electrical';
          else item.category = 'Misc';
        }
      });

      equipment = Object.values(dedupMap).filter(item => {
        const n = (item.name || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const batch = (item.allocation_batch || '').toUpperCase();
        if (item.is_rental || item.is_venue) return false;
        if (batch.startsWith('VENUE-')) return false;
        if (n.includes('venue provided') || n.includes('[venue provided]')) return false;
        if (n.includes('(rental)') || n.includes('rental')) return false;
        if (cat.includes('venue') || cat.includes('rental')) return false;
        return true;
      });
    } catch(e) {
      console.warn('[staffEquipmentBatch] fetch history error:', e);
    }
  }

  // Fallback to reservation equipmentManifest
  if (!equipment.length && Array.isArray(res.equipmentManifest) && res.equipmentManifest.length) {
    equipment = res.equipmentManifest.map(eq => ({
      id: eq.assetId || eq.id || eq.name,
      asset_id: eq.assetId || eq.asset_id || '',
      name: eq.name || 'Equipment',
      category: eq.category || 'General',
      allocated_quantity: eq.assignedQty !== undefined ? eq.assignedQty : (eq.assignQty || eq.qty || 1),
      consumable: eq.consumable === true
    }));
  }

  // 2. Fetch incidents from Supabase exec_batch_incidents
  let incidents = {};
  if (sb) {
    try {
      const { data: incData } = await sb.from('exec_batch_incidents').select('*').eq('reservation_id', res.id);
      if (incData) {
        incData.forEach(inc => {
          const key = inc.equipment_id || inc.equipment_name;
          if (!incidents[key]) incidents[key] = [];
          incidents[key].push(inc);
        });
      }
    } catch(e) {
      console.warn('[staffEquipmentBatch] fetch incidents error:', e);
    }
  }

  // Merge locally stored incidents
  try {
    const localList = getLocalStaffIncidents(res.id);
    localList.forEach(inc => {
      const key = inc.equipment_id || inc.equipment_name;
      if (!incidents[key]) incidents[key] = [];
      if (!incidents[key].some(i => i.id === inc.id)) {
        incidents[key].push(inc);
      }
    });
  } catch(e) {}

  // Merge offline queue items
  try {
    const offline = JSON.parse(localStorage.getItem('exec_offline_incidents') || '[]');
    if (Array.isArray(offline)) {
      offline.filter(o => o.payload && o.payload.reservation_id === res.id).forEach(o => {
        const inc = o.payload;
        const key = inc.equipment_id || inc.equipment_name;
        if (!incidents[key]) incidents[key] = [];
        if (!incidents[key].some(i => i.id === inc.id)) {
          incidents[key].push(inc);
        }
      });
    }
  } catch(e) {}

  const cats = [...new Set(equipment.map(e => e.category || 'Misc').filter(Boolean))];
  const PHASES = ['Departure', 'Deployment', 'Execution', 'Bash-Out', 'Restorage'];

  return `
    <div style="background:var(--bg2);border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:11px;color:var(--gold);text-transform:uppercase;font-weight:800;letter-spacing:1px;margin-bottom:4px;">Reservation Manifest</div>
          <div style="font-size:18px;font-weight:700;color:var(--cream);">Equipment — Batch Allocation (${equipment.length} items)</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <input type="text" id="staff-exec-equip-search" placeholder="Search equipment or asset ID..." oninput="filterStaffExecEquipment(this.value)"
            style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--cream);font-size:13px;width:240px;" />
          <button onclick="renderStaffExecutionLive()" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--cream);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
            Refresh
          </button>
        </div>
      </div>

      <!-- Clean Underline Category Tabs (No colored pill backgrounds) -->
      <div id="staff-exec-equip-cat-filters" style="display:flex;gap:16px;border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:16px;overflow-x:auto;">
        <button onclick="filterStaffExecEquipCategory('all')" id="staff-exec-equip-cat-all"
          style="background:none;border:none;border-bottom:2px solid var(--gold);color:var(--gold);font-size:13px;font-weight:700;padding:4px 6px;cursor:pointer;white-space:nowrap;">All</button>
        ${cats.map(cat => `<button onclick="filterStaffExecEquipCategory('${escHtml(cat)}')"
          style="background:none;border:none;border-bottom:2px solid transparent;color:var(--cream);font-size:13px;font-weight:600;padding:4px 6px;cursor:pointer;white-space:nowrap;">${escHtml(cat)}</button>`).join('')}
      </div>

      <div id="staff-exec-equip-list">
        ${equipment.length === 0 ? '<div style="color:var(--text-dim);font-size:14px;padding:30px;text-align:center;">No equipment found in batch allocation for this reservation.</div>' :
          equipment.map((e, idx) => renderStaffEquipRow(e, idx, (incidents[e.id] || incidents[e.asset_id] || incidents[e.name] || []), PHASES)).join('')}
      </div>
    </div>
  `;
}

// Renders an individual equipment item row with incident entries matching admin side
function renderStaffEquipRow(eq, idx, incidents, phases) {
  const eqId = eq.id || eq.equipment_id || ('eq_' + idx);
  const assetId = eq.asset_id || eq.assetId || '';
  const name = eq.name || eq.item_name || eq.equipment_name || 'Equipment';
  const qty = Number(eq.allocated_quantity || eq.quantity || eq.qty || 1);
  const cat = eq.category || 'General';
  const isConsumable = eq.consumable === true;

  const totalReportedQty = (incidents || []).reduce((s, inc) => s + (Number(inc.quantity) || 0), 0);
  const remainingQty = Math.max(0, qty - totalReportedQty);

  return `
    <div class="staff-exec-equip-row" id="staff-equip-row-${escHtml(eqId)}" data-equip-id="${escHtml(eqId)}" data-cat="${escHtml(cat)}" data-name="${escHtml(name.toLowerCase())}" data-asset="${escHtml(assetId.toLowerCase())}"
      style="background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin-bottom:12px;transition:all 0.15s;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${assetId ? `<span style="font-size:12px;font-weight:700;color:var(--gold);letter-spacing:0.5px;">[${escHtml(assetId)}]</span>` : ''}
            <span style="font-size:15px;font-weight:600;color:var(--cream);">${escHtml(name)}</span>
            ${isConsumable ? '<span style="font-size:11px;color:#facc15;font-weight:600;border-bottom:1px dotted #facc15;margin-left:6px;">Consumable</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">Category: <span style="color:var(--cream);">${escHtml(cat)}</span> &nbsp;&middot;&nbsp; Allocated: <strong style="color:var(--gold);">${qty}</strong></div>
        </div>
        ${(!incidents || incidents.length === 0) ? `
          <button onclick="captureStaffExecScroll('${escHtml(eqId)}'); createStaffExecIncident('${escHtml(eqId)}', '${escHtml(name)}', ${qty})"
            style="padding:7px 16px;border-radius:8px;border:1px solid rgba(212,175,55,0.4);background:transparent;color:var(--gold);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.15s;"
            onmouseover="this.style.background='rgba(212,175,55,0.08)'" onmouseout="this.style.background='transparent'">
            Report Incident
          </button>
        ` : ''}
      </div>

      <!-- Active Incident Rows -->
      ${(incidents && incidents.length > 0) ? `
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          ${incidents.map(inc => {
            const otherQty = totalReportedQty - (Number(inc.quantity) || 0);
            const maxAllowedForThis = Math.max(1, qty - otherQty);
            return `
              <div class="staff-exec-incident-item" style="display:flex;flex-direction:column;gap:10px;padding:12px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;width:100%;">
                  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;flex:1;min-width:260px;">
                    <!-- Incident Type -->
                    <div>
                      <div style="font-size:10px;color:var(--text-dim);margin-bottom:2px;">Type</div>
                      <select onchange="updateStaffExecIncidentField('${inc.id}', 'incident_type', this.value)"
                        style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--cream);font-size:12px;font-weight:600;">
                        <option value="Broken" ${inc.incident_type === 'Broken' ? 'selected' : ''}>Broken</option>
                        <option value="Missing" ${inc.incident_type === 'Missing' ? 'selected' : ''}>Missing</option>
                        <option value="Retired" ${inc.incident_type === 'Retired' ? 'selected' : ''}>Retired</option>
                      </select>
                    </div>
                    <!-- Quantity -->
                    <div>
                      <div style="font-size:10px;color:var(--text-dim);margin-bottom:2px;">Qty (max ${maxAllowedForThis})</div>
                      <div style="display:flex;align-items:center;gap:4px;">
                        <input type="number" min="1" max="${maxAllowedForThis}" value="${inc.quantity || 1}"
                          onchange="handleStaffExecIncidentQtyChange('${inc.id}', ${maxAllowedForThis}, this)"
                          style="width:58px;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--cream);font-size:12px;text-align:center;" />
                        <span style="font-size:11px;color:var(--text-dim);">/ ${maxAllowedForThis}</span>
                      </div>
                    </div>
                    <!-- Phase -->
                    <div>
                      <div style="font-size:10px;color:var(--text-dim);margin-bottom:2px;">Phase</div>
                      <select onchange="updateStaffExecIncidentField('${inc.id}', 'phase', this.value)"
                        style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--cream);font-size:12px;">
                        ${phases.map(p => `<option value="${escHtml(p)}" ${inc.phase === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}
                      </select>
                    </div>
                  </div>

                  <!-- Far Right: Upload / Replace Photo & Delete button -->
                  <div style="display:flex;align-items:center;gap:10px;margin-left:auto;flex-shrink:0;">
                    <button type="button" onclick="openStaffExecPhotoCaptureModal('${inc.id}')"
                      style="padding:6px 14px;border-radius:6px;border:1px dashed var(--gold);background:rgba(196,154,60,0.08);color:var(--gold);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all 0.15s;">
                      ${inc.photo_url ? 'Replace Photo' : 'Upload Photo'}
                    </button>

                    <!-- ✕ Delete Incident Button -->
                    <button onclick="deleteStaffExecIncident('${inc.id}')" title="Delete this incident"
                      style="width:32px;height:32px;border-radius:6px;border:1px solid #dc2626;background:#dc2626;color:#ffffff;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;flex-shrink:0;"
                      onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
                      ✕
                    </button>
                  </div>
                </div>

                <!-- Incident Photo underneath the incident card (medium size, with delete button) -->
                ${inc.photo_url ? `
                  <div style="width:100%;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:flex-start;">
                    <div style="position:relative;display:inline-block;">
                      <a href="javascript:void(0)" onclick="openStaffExecIncidentPhoto('${inc.photo_url}')">
                        <img src="${inc.photo_url}" style="width:150px;height:105px;object-fit:cover;border-radius:8px;border:1px solid rgba(196,154,60,0.4);cursor:pointer;display:block;box-shadow:0 4px 12px rgba(0,0,0,0.3);" title="Click to view full photo" />
                      </a>
                      <button onclick="removeStaffExecIncidentPhoto('${inc.id}')" title="Remove photo"
                        style="position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;background:#dc2626;color:#fff;border:none;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,0.6);">
                        ✕
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}

          <!-- + Add Another button under each part -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.08);flex-wrap:wrap;gap:8px;">
            <div style="font-size:12px;color:var(--text-dim);">
              Reported: <strong style="color:${totalReportedQty >= qty ? 'var(--red)' : 'var(--gold)'};">${totalReportedQty}</strong> / ${qty} allocated
              ${remainingQty > 0 ? `<span style="color:var(--text-dim);margin-left:4px;">(${remainingQty} remaining)</span>` : '<span style="color:var(--red);margin-left:4px;">(Max quantity reported)</span>'}
            </div>
            <button onclick="captureStaffExecScroll('${escHtml(eqId)}'); createStaffExecIncident('${escHtml(eqId)}', '${escHtml(name)}', ${qty})"
              ${remainingQty <= 0 ? 'disabled' : ''}
              style="padding:6px 14px;border-radius:6px;border:1px solid ${remainingQty <= 0 ? 'rgba(255,255,255,0.1)' : 'var(--gold)'};background:transparent;color:${remainingQty <= 0 ? 'var(--text-dim)' : 'var(--gold)'};font-size:12px;font-weight:600;cursor:${remainingQty <= 0 ? 'not-allowed' : 'pointer'};opacity:${remainingQty <= 0 ? '0.45' : '1'};display:flex;align-items:center;gap:6px;transition:all 0.15s;">
              Add Another
            </button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Category filter tabs
function filterStaffExecEquipCategory(cat) {
  _staffEquipCatFilter = cat;
  document.querySelectorAll('.staff-exec-equip-row').forEach(row => {
    row.style.display = (cat === 'all' || row.dataset.cat === cat) ? 'block' : 'none';
  });
  document.querySelectorAll('#staff-exec-equip-cat-filters button').forEach(btn => {
    const isThis = (cat === 'all' && btn.id === 'staff-exec-equip-cat-all') || btn.textContent.trim() === cat;
    btn.style.border = 'none';
    btn.style.borderBottom = isThis ? '2px solid var(--gold)' : '2px solid transparent';
    btn.style.background = 'none';
    btn.style.color = isThis ? 'var(--gold)' : 'var(--cream)';
    btn.style.fontWeight = isThis ? '700' : '600';
  });
}
window.filterStaffExecEquipCategory = filterStaffExecEquipCategory;

// Live search across equipment items
function filterStaffExecEquipment(query) {
  _staffEquipSearchQuery = query;
  const q = (query || '').toLowerCase().trim();
  document.querySelectorAll('.staff-exec-equip-row').forEach(row => {
    const match = !q || (row.dataset.name || '').includes(q) || (row.dataset.asset || '').includes(q) || (row.dataset.cat || '').toLowerCase().includes(q);
    row.style.display = match ? 'block' : 'none';
  });
}
window.filterStaffExecEquipment = filterStaffExecEquipment;

// Current phase name helper
function getStaffExecCurrentPhaseName(res) {
  if (res && res.executionPlan && Array.isArray(res.executionPlan.phases)) {
    const p = res.executionPlan.phases[activeStaffLivePhaseIdx];
    if (p && p.name) return p.name;
  }
  const PHASES = ['Departure', 'Deployment', 'Execution', 'Bash-Out', 'Restorage'];
  return PHASES[activeStaffLivePhaseIdx] || 'Execution';
}

// Creates an equipment incident record in Supabase exec_batch_incidents
async function createStaffExecIncident(eqId, eqName, maxQty) {
  captureStaffExecScroll(eqId);
  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  if (!res) return;

  // 1. Check existing quantity so we don't exceed allocated
  const existingLocal = getLocalStaffIncidents(res.id).filter(i => i.equipment_id === eqId);
  let totalUsed = existingLocal.reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const sb = window.supabaseClient;
  if (sb) {
    try {
      const { data: dbExisting } = await sb.from('exec_batch_incidents').select('id, quantity').eq('reservation_id', res.id).eq('equipment_id', eqId);
      if (dbExisting && dbExisting.length) {
        totalUsed = dbExisting.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
      }
    } catch(e) {}
  }

  if (totalUsed >= maxQty) {
    alert(`All ${maxQty} allocated units for this item have already been reported.`);
    return;
  }

  const phaseName = getStaffExecCurrentPhaseName(res);
  const staffRaw = sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff');
  let reporter = 'Staff (Staff)';
  try {
    if (staffRaw) {
      const u = JSON.parse(staffRaw);
      const sName = u.name || (u.fname ? `${u.fname} ${u.lname}` : 'Staff');
      const rawRole = u.role || 'Staff';
      const sRole = rawRole.toLowerCase().includes('equipment') ? 'Equipment Staff' : 'Staff';
      reporter = `${sName} (${sRole})`;
    }
  } catch(e) {}

  const newIncident = {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : ('inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
    reservation_id: res.id,
    equipment_id: eqId,
    equipment_name: eqName,
    incident_type: 'Broken',
    quantity: 1,
    phase: phaseName || 'Execution',
    photo_url: null,
    logged_at: new Date().toISOString(),
    source_reservation_id: res.id,
    reported_by: reporter,
    logged_by: reporter
  };

  // 2. Insert into Supabase (with offline queue fallback)
  let savedToDb = false;
  if (sb && navigator.onLine) {
    try {
      const { error } = await sb.from('exec_batch_incidents').insert(newIncident);
      if (!error) {
        savedToDb = true;
      } else {
        enqueueStaffOfflineIncident({ type: 'insert', payload: newIncident, id: newIncident.id });
      }
    } catch(e) {
      enqueueStaffOfflineIncident({ type: 'insert', payload: newIncident, id: newIncident.id });
    }
  } else {
    enqueueStaffOfflineIncident({ type: 'insert', payload: newIncident, id: newIncident.id });
  }

  // 3. Save locally as fallback so UI updates instantly
  saveLocalStaffIncident(res.id, newIncident);
  renderStaffExecutionLive();
}
window.createStaffExecIncident = createStaffExecIncident;

// Auto-saves any changes to incident fields (incident_type, quantity, phase, photo_url)
async function updateStaffExecIncidentField(incId, field, value) {
  captureStaffExecScroll();
  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  const resId = res ? res.id : activeStaffExecutionResId;

  // 1. Update local storage
  if (resId) {
    const list = getLocalStaffIncidents(resId);
    const item = list.find(i => i.id === incId);
    if (item) {
      item[field] = value;
      saveLocalStaffIncident(resId, item);
    }
  }

  // 2. Update Supabase
  try {
    const sb = window.supabaseClient;
    if (sb && navigator.onLine) {
      await sb.from('exec_batch_incidents').update({ [field]: value }).eq('id', incId);
    } else {
      enqueueStaffOfflineIncident({ type: 'update', payload: { [field]: value }, id: incId });
    }
  } catch(e) {
    enqueueStaffOfflineIncident({ type: 'update', payload: { [field]: value }, id: incId });
  }
}
window.updateStaffExecIncidentField = updateStaffExecIncidentField;

// Validates quantity changes against maximum allowed remaining units
async function handleStaffExecIncidentQtyChange(incId, maxAllowed, inputEl) {
  captureStaffExecScroll();
  let val = parseInt(inputEl.value, 10);
  if (isNaN(val) || val < 1) {
    val = 1;
    inputEl.value = '1';
  } else if (val > maxAllowed) {
    alert(`Quantity cannot exceed remaining available quantity (${maxAllowed}).`);
    val = maxAllowed;
    inputEl.value = String(maxAllowed);
  }
  await updateStaffExecIncidentField(incId, 'quantity', val);
  renderStaffExecutionLive();
}
window.handleStaffExecIncidentQtyChange = handleStaffExecIncidentQtyChange;

let _staffActiveCaptureIncId = null;
let _staffCaptureStream = null;
let _staffCapturedDataUrl = null;

async function openStaffExecPhotoCaptureModal(incId) {
  _staffActiveCaptureIncId = incId;
  _staffCapturedDataUrl = null;

  let modal = document.getElementById('staff-incident-capture-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'staff-incident-capture-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--card, #1e1510);border:1px solid var(--border, rgba(196,154,60,0.3));border-radius:16px;width:100%;max-width:440px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.7);">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid var(--border, rgba(196,154,60,0.2));background:var(--bg2, #18110c);">
        <div style="font-size:15px;font-weight:700;color:var(--cream, #f5ebd7);display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">📷</span> Incident Photo
        </div>
        <button type="button" onclick="closeStaffExecPhotoCaptureModal()" style="background:none;border:none;color:var(--text-dim, #a39582);font-size:22px;cursor:pointer;line-height:1;padding:2px 6px;">✕</button>
      </div>

      <!-- Viewfinder / Preview Box -->
      <div style="position:relative;width:100%;height:270px;background:#050505;display:flex;align-items:center;justify-content:center;overflow:hidden;">
        <video id="staff-inc-cam-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:block;"></video>
        <img id="staff-inc-cam-preview" style="display:none;width:100%;height:100%;object-fit:contain;background:#000;" />
        <canvas id="staff-inc-cam-canvas" style="display:none;"></canvas>
        <div id="staff-inc-cam-status" style="position:absolute;bottom:10px;left:10px;right:10px;text-align:center;font-size:12px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.9);pointer-events:none;">Starting camera...</div>
      </div>

      <!-- File input hidden -->
      <input type="file" id="staff-inc-file-input" accept="image/*" style="display:none;" onchange="handleStaffExecFileSelected(this)" />

      <!-- Action Buttons Container -->
      <div id="staff-inc-actions-container" style="padding:14px 18px;background:var(--bg2, #18110c);border-top:1px solid var(--border, rgba(196,154,60,0.2));">
        <div id="staff-inc-initial-actions" style="display:flex;gap:12px;">
          <button type="button" onclick="staffExecSnapFrame()" style="flex:1;padding:12px;border-radius:10px;background:var(--gold, #c49a3c);color:#1a1005;border:none;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            Take Picture
          </button>
          <button type="button" onclick="document.getElementById('staff-inc-file-input').click()" style="flex:1;padding:12px;border-radius:10px;background:transparent;border:1px solid var(--gold, #c49a3c);color:var(--gold, #c49a3c);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            Upload Picture
          </button>
        </div>
        <div id="staff-inc-confirm-actions" style="display:none;gap:12px;">
          <button type="button" id="staff-inc-upload-btn" onclick="staffExecUploadSnappedPhoto()" style="flex:1;padding:12px;border-radius:10px;background:var(--gold, #c49a3c);color:#1a1005;border:none;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            Upload
          </button>
          <button type="button" onclick="staffExecCancelSnap()" style="flex:1;padding:12px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,0.25);color:var(--cream, #fff);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  // Start camera stream
  const video = document.getElementById('staff-inc-cam-video');
  const statusEl = document.getElementById('staff-inc-cam-status');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      _staffCaptureStream = stream;
      video.srcObject = stream;
      await video.play();
      if (statusEl) statusEl.textContent = 'Camera active. Frame incident and click Take Picture.';
    } catch(err) {
      console.warn('Incident camera stream error:', err);
      if (statusEl) statusEl.textContent = 'Camera not available. Please use "Upload Picture".';
    }
  } else {
    if (statusEl) statusEl.textContent = 'Camera not supported. Please use "Upload Picture".';
  }
}
window.openStaffExecPhotoCaptureModal = openStaffExecPhotoCaptureModal;

function staffExecSnapFrame() {
  const video = document.getElementById('staff-inc-cam-video');
  const preview = document.getElementById('staff-inc-cam-preview');
  const canvas = document.getElementById('staff-inc-cam-canvas');
  const statusEl = document.getElementById('staff-inc-cam-status');
  if (!video || !canvas || !preview) return;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, w, h);

  _staffCapturedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
  preview.src = _staffCapturedDataUrl;
  preview.style.display = 'block';
  video.style.display = 'none';

  if (statusEl) statusEl.textContent = 'Photo captured. Review and click Upload.';

  document.getElementById('staff-inc-initial-actions').style.display = 'none';
  document.getElementById('staff-inc-confirm-actions').style.display = 'flex';
}
window.staffExecSnapFrame = staffExecSnapFrame;

function staffExecCancelSnap() {
  const video = document.getElementById('staff-inc-cam-video');
  const preview = document.getElementById('staff-inc-cam-preview');
  const statusEl = document.getElementById('staff-inc-cam-status');
  _staffCapturedDataUrl = null;

  if (preview) preview.style.display = 'none';
  if (video) video.style.display = 'block';
  if (statusEl) statusEl.textContent = 'Camera active. Frame incident and click Take Picture.';

  document.getElementById('staff-inc-initial-actions').style.display = 'flex';
  document.getElementById('staff-inc-confirm-actions').style.display = 'none';
}
window.staffExecCancelSnap = staffExecCancelSnap;

async function staffExecUploadSnappedPhoto() {
  if (!_staffCapturedDataUrl || !_staffActiveCaptureIncId) return;
  const uploadBtn = document.getElementById('staff-inc-upload-btn');
  if (uploadBtn) { uploadBtn.textContent = 'Uploading...'; uploadBtn.disabled = true; }

  let photoUrl = null;
  try {
    const res = await fetch(_staffCapturedDataUrl);
    const blob = await res.blob();
    const fd = new FormData();
    fd.append('file', blob);
    fd.append('upload_preset', typeof CLOUDINARY_UPLOAD_PRESET !== 'undefined' ? CLOUDINARY_UPLOAD_PRESET : 'test_default');
    fd.append('folder', 'catering');
    const cloudName = typeof CLOUDINARY_CLOUD_NAME !== 'undefined' ? CLOUDINARY_CLOUD_NAME : 'dg8ytmck5';
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
    if (r.ok) {
      const data = await r.json();
      photoUrl = data.secure_url;
    }
  } catch(e) {
    console.warn('Cloudinary upload exception, fallback to base64:', e);
  }

  if (!photoUrl) photoUrl = _staffCapturedDataUrl;

  const incId = _staffActiveCaptureIncId;
  closeStaffExecPhotoCaptureModal();
  await updateStaffExecIncidentField(incId, 'photo_url', photoUrl);
  renderStaffExecutionLive();
}
window.staffExecUploadSnappedPhoto = staffExecUploadSnappedPhoto;

async function handleStaffExecFileSelected(inputEl) {
  if (!inputEl.files || !inputEl.files[0] || !_staffActiveCaptureIncId) return;
  const file = inputEl.files[0];
  const incId = _staffActiveCaptureIncId;

  let photoUrl = null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', typeof CLOUDINARY_UPLOAD_PRESET !== 'undefined' ? CLOUDINARY_UPLOAD_PRESET : 'test_default');
    fd.append('folder', 'catering');
    const cloudName = typeof CLOUDINARY_CLOUD_NAME !== 'undefined' ? CLOUDINARY_CLOUD_NAME : 'dg8ytmck5';
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
    if (r.ok) {
      const data = await r.json();
      photoUrl = data.secure_url;
    }
  } catch(e) {}

  if (!photoUrl) {
    try {
      photoUrl = await compressStaffImageToBase64(file);
    } catch(e) {}
  }

  closeStaffExecPhotoCaptureModal();
  if (photoUrl) {
    await updateStaffExecIncidentField(incId, 'photo_url', photoUrl);
    renderStaffExecutionLive();
  }
}
window.handleStaffExecFileSelected = handleStaffExecFileSelected;

function closeStaffExecPhotoCaptureModal() {
  if (_staffCaptureStream) {
    try {
      _staffCaptureStream.getTracks().forEach(t => t.stop());
    } catch(e) {}
    _staffCaptureStream = null;
  }
  _staffCapturedDataUrl = null;
  _staffActiveCaptureIncId = null;
  const modal = document.getElementById('staff-incident-capture-modal');
  if (modal) modal.style.display = 'none';
}
window.closeStaffExecPhotoCaptureModal = closeStaffExecPhotoCaptureModal;

// Cloudinary + canvas photo upload fallback
async function handleStaffExecIncidentPhotoUpload(incId, inputEl) {
  if (!inputEl.files || !inputEl.files[0]) return;
  captureStaffExecScroll();
  const file = inputEl.files[0];

  let photoUrl = null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', typeof CLOUDINARY_UPLOAD_PRESET !== 'undefined' ? CLOUDINARY_UPLOAD_PRESET : 'test_default');
    fd.append('folder', 'catering');
    const cloudName = typeof CLOUDINARY_CLOUD_NAME !== 'undefined' ? CLOUDINARY_CLOUD_NAME : 'dg8ytmck5';
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
    if (r.ok) {
      const data = await r.json();
      photoUrl = data.secure_url || null;
    }
  } catch(e) {
    console.warn('[staffIncidentPhoto] Cloudinary failed, fallback to canvas:', e);
  }

  if (!photoUrl) {
    try {
      photoUrl = await compressStaffImageToBase64(file);
    } catch(e) {
      console.warn('[staffIncidentPhoto] Canvas fallback failed:', e);
    }
  }

  if (photoUrl) {
    await updateStaffExecIncidentField(incId, 'photo_url', photoUrl);
    renderStaffExecutionLive();
  } else {
    alert('Failed to process image.');
  }
}
window.handleStaffExecIncidentPhotoUpload = handleStaffExecIncidentPhotoUpload;

// Removes an uploaded incident photo
async function removeStaffExecIncidentPhoto(incId) {
  if (!confirm('Remove this photo?')) return;
  captureStaffExecScroll();
  await updateStaffExecIncidentField(incId, 'photo_url', null);
  renderStaffExecutionLive();
}
window.removeStaffExecIncidentPhoto = removeStaffExecIncidentPhoto;

// Full image preview modal
function openStaffExecIncidentPhoto(url) {
  if (!url) return;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  let modal = document.getElementById('staff-exec-photo-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'staff-exec-photo-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);';
    modal.onclick = (e) => { if (e.target === modal || e.target.id === 'staff-exec-photo-close') modal.style.display = 'none'; };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="position:relative;max-width:92vw;max-height:90vh;display:flex;flex-direction:column;align-items:center;">
      <button id="staff-exec-photo-close" style="position:absolute;top:-40px;right:0;background:none;border:none;color:#fff;font-size:30px;cursor:pointer;line-height:1;">✕</button>
      <img src="${url}" style="max-width:100%;max-height:80vh;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,0.9);object-fit:contain;border:1px solid rgba(255,255,255,0.2);" />
    </div>
  `;
  modal.style.display = 'flex';
}
window.openStaffExecIncidentPhoto = openStaffExecIncidentPhoto;

// Deletes an incident report row from Supabase and local cache
async function deleteStaffExecIncident(incidentId) {
  if (!confirm('Delete this incident report?')) return;
  captureStaffExecScroll();
  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  const resId = res ? res.id : activeStaffExecutionResId;

  // 1. Remove from local cache
  if (resId) removeLocalStaffIncident(resId, incidentId);

  // 2. Remove from Supabase
  try {
    const sb = window.supabaseClient;
    if (sb && navigator.onLine) {
      await sb.from('exec_batch_incidents').delete().eq('id', incidentId);
    } else {
      enqueueStaffOfflineIncident({ type: 'delete', id: incidentId });
    }
  } catch(e) {
    enqueueStaffOfflineIncident({ type: 'delete', id: incidentId });
  }

  renderStaffExecutionLive();
}
window.deleteStaffExecIncident = deleteStaffExecIncident;

function compressStaffImageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Hash router for staff portal
async function handleStaffHashNavigation() {
  const hash = window.location.hash || '';
  let resId = null;
  if (hash.startsWith('#execution-day?id=')) {
    resId = decodeURIComponent(hash.replace('#execution-day?id=', '').trim());
  } else if (!hash || hash === '#execution-live' || hash === '#execution-day') {
    try { resId = sessionStorage.getItem('active_staff_exec_res_id'); } catch(e) {}
  }

  if (resId) {
    let match = (Array.isArray(window.RESERVATIONS) ? window.RESERVATIONS : (Array.isArray(RESERVATIONS) ? RESERVATIONS : [])).find(r => String(r.id) === String(resId));
    if (!match && window.supabaseClient) {
      try {
        const { data: dbRes } = await window.supabaseClient.from('reservations').select('*').eq('id', String(resId)).maybeSingle();
        if (dbRes) {
          match = dbRes;
          RESERVATIONS.push(dbRes);
          window.RESERVATIONS = RESERVATIONS;
        }
      } catch(e) {}
    }

    if (match) {
      activeStaffExecutionResId = resId;
      try { sessionStorage.setItem('active_staff_exec_res_id', resId); } catch(e) {}
      if (window.location.hash !== '#execution-day?id=' + encodeURIComponent(resId)) {
        try { window.history.replaceState(null, '', '#execution-day?id=' + encodeURIComponent(resId)); } catch(e) { window.location.hash = '#execution-day?id=' + encodeURIComponent(resId); }
      }
      showSection('execution-live');
      await ensureStaffResExecutionPlan(match);
      await loadStaffExecLiveActivities(resId);
      await renderStaffExecutionLive();
      startStaffFinalizationMonitor(resId);
      initStaffExecRealtime(resId);
      startStaffLivePolling(resId);
      return true;
    }
  } else if (hash === '#execution-day') {
    showSection('execution-day');
    return true;
  }
  return false;
}
window.handleStaffHashNavigation = handleStaffHashNavigation;
window.addEventListener('hashchange', handleStaffHashNavigation);
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(handleStaffHashNavigation, 250);
});
window.addEventListener('load', () => {
  setTimeout(handleStaffHashNavigation, 450);
});

// ===== PAYROLL MODULE =====
function renderPayroll() {
  const logged = sessionStorage.getItem('halden_staff');
  if (!logged) return;
  const staff = JSON.parse(logged);
  
  // Placeholder payroll data
  const payrollData = {
    totalEarnings: 45000,
    hoursWorked: 72,
    eventsCompleted: 5,
    pendingPayment: 15000,
    earnings: [
      {
        id: 1,
        eventName: "Santos Wedding Reception",
        date: "2026-05-12",
        hours: 8,
        rate: 2500,
        overtime: 2,
        overtimeRate: 375,
        total: 5750,
        status: "paid"
      },
      {
        id: 2,
        eventName: "Cruz Corporate Event",
        date: "2026-05-08",
        hours: 12,
        rate: 2500,
        overtime: 4,
        overtimeRate: 375,
        total: 9000,
        status: "paid"
      },
      {
        id: 3,
        eventName: "Reyes Birthday Party",
        date: "2026-05-05",
        hours: 6,
        rate: 2500,
        overtime: 0,
        overtimeRate: 375,
        total: 3750,
        status: "pending"
      },
      {
        id: 4,
        eventName: "Luna Anniversary Dinner",
        date: "2026-05-03",
        hours: 10,
        rate: 2500,
        overtime: 2,
        overtimeRate: 375,
        total: 8250,
        status: "paid"
      },
      {
        id: 5,
        eventName: "Villanueva Graduation",
        date: "2026-05-01",
        hours: 8,
        rate: 2500,
        overtime: 0,
        overtimeRate: 375,
        total: 5000,
        status: "pending"
      }
    ],
    paymentHistory: [
      {
        id: 1,
        period: "April 16-30, 2026",
        amount: 32500,
        paidDate: "2026-05-02",
        status: "completed",
        method: "Bank Transfer"
      },
      {
        id: 2,
        period: "April 1-15, 2026",
        amount: 28000,
        paidDate: "2026-04-18",
        status: "completed",
        method: "Bank Transfer"
      },
      {
        id: 3,
        period: "March 16-31, 2026",
        amount: 31000,
        paidDate: "2026-04-02",
        status: "completed",
        method: "Bank Transfer"
      }
    ]
  };

  // Update summary cards
  const totalEarningsEl = document.getElementById('payroll-total-earnings');
  const hoursWorkedEl = document.getElementById('payroll-hours-worked');
  const eventsCompletedEl = document.getElementById('payroll-events-completed');
  const pendingPaymentEl = document.getElementById('payroll-pending');

  if (totalEarningsEl) totalEarningsEl.textContent = '₱' + payrollData.totalEarnings.toLocaleString();
  if (hoursWorkedEl) hoursWorkedEl.textContent = payrollData.hoursWorked + 'h';
  if (eventsCompletedEl) eventsCompletedEl.textContent = payrollData.eventsCompleted;
  if (pendingPaymentEl) pendingPaymentEl.textContent = '₱' + payrollData.pendingPayment.toLocaleString();

  // Render earnings breakdown
  const earningsListEl = document.getElementById('payroll-earnings-list');
  if (earningsListEl) {
    earningsListEl.innerHTML = payrollData.earnings.map(earning => `
      <div style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:15px; font-weight:700; color:var(--cream);">${earning.eventName}</span>
            <span style="font-size:11px; font-weight:800; ${earning.status === 'paid' ? 'color:var(--green);' : 'color:var(--red);'};">
              ${earning.status === 'paid' ? 'PAID' : 'PENDING'}
            </span>
          </div>
          <div style="font-size:12px; color:var(--text-dim); margin-bottom:4px;">${earning.date} · ${earning.hours}h regular ${earning.overtime > 0 ? `+ ${earning.overtime}h overtime` : ''}</div>
          <div style="font-size:11px; color:var(--text-mid);">
            Base: ₱${earning.rate.toLocaleString()}/h · Overtime: ₱${earning.overtimeRate.toLocaleString()}/h
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:18px; font-weight:700; color:var(--gold);">₱${earning.total.toLocaleString()}</div>
          <div style="font-size:10px; color:var(--text-dim);">Total Earnings</div>
        </div>
      </div>
    `).join('');
  }

  // Render payment history
  const paymentHistoryEl = document.getElementById('payroll-payment-history');
  if (paymentHistoryEl) {
    paymentHistoryEl.innerHTML = payrollData.paymentHistory.map(payment => `
      <div style="background:var(--bg2); border:1px solid var(--border); border-radius:12px; padding:16px 20px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:700; color:var(--cream); margin-bottom:4px;">${payment.period}</div>
          <div style="font-size:12px; color:var(--text-dim);">Paid: ${payment.paidDate} · ${payment.method}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px; font-weight:700; color:var(--green);">₱${payment.amount.toLocaleString()}</div>
          <div style="font-size:10px; color:var(--text-dim);">Disbursed</div>
        </div>
      </div>
    `).join('');
  }
}

// ===== STRATEGY MODAL =====
function viewStaffExecutionStrategy(resId) {
  const staffData = JSON.parse(sessionStorage.getItem('halden_staff') || '{}');
  const staffId = staffData.id || "";
  const staffName = (staffData.name || "").toLowerCase();
  const staffEmail = (staffData.email || "").toLowerCase();

  const res = RESERVATIONS.find(r => r.id === resId);
  if (!res || !res.executionPlan) return;
  
  const content = document.getElementById('staff-strategy-content');
  if (!content) return;
  
  const phases = res.executionPlan.phases;
  
  let html = `
    <div style="padding:30px; background:var(--bg2);">
       <div style="margin-bottom:30px;">
          <h2 style="font-family:'Arial'; font-size:24px; color:var(--gold);">${res.client}'s Event Strategy</h2>
          <p style="font-size:13px; color:var(--text-dim);">Assigned tasks and logistical flow for this event.</p>
       </div>
       <div style="display:flex; flex-direction:column; gap:25px;">
  `;
  
  phases.forEach(p => {
    html += `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:16px; overflow:hidden;">
         <div style="padding:15px 20px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <div>
               <div style="font-size:11px; color:var(--gold); font-weight:800; text-transform:uppercase; letter-spacing:1px;">Phase</div>
               <div style="font-size:16px; font-weight:700; color:var(--cream);">${p.name}</div>
            </div>
            <div style="text-align:right;">
               <div style="font-size:11px; color:var(--text-dim); font-weight:800; text-transform:uppercase; letter-spacing:1px;">Time Period</div>
               <div style="font-size:14px; font-weight:600; color:var(--cream);">${formatStaffTime12h(p.start)} – ${formatStaffTime12h(p.end)}</div>
            </div>
         </div>
         <div style="padding:20px;">
            <div style="font-size:11px; color:var(--text-dim); text-transform:uppercase; margin-bottom:12px; font-weight:800;">Logistical Activities</div>
            <div style="display:flex; flex-direction:column; gap:10px;">
               ${p.tasks ? p.tasks.map(t => {
                 const ids = (t.staffIds || []).filter(id => id).map(id => id.toLowerCase());
                 const isMyTask = (staffId && ids.includes(staffId.toLowerCase())) || 
                                  (staffName && ids.includes(staffName)) || 
                                  (staffEmail && ids.includes(staffEmail));
                 return `
                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.1); padding:10px 15px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                     <span style="font-size:13px; color:var(--text);">${t.text}</span>
                     ${isMyTask 
                        ? '<span style="font-size:10px; background:var(--gold); color:#000; padding:2px 8px; border-radius:10px; font-weight:800; text-transform:uppercase;">My Task</span>' 
                        : '<span style="font-size:10px; color:var(--text-dim);">Support Team</span>'}
                  </div>
                `;
               }).join('') : ''}
            </div>
         </div>
      </div>
    `;
  });

  html += `</div></div>`;
  content.innerHTML = html;
  
  document.getElementById('staff-strategy-overlay').classList.add('on');
  document.getElementById('staff-strategy-modal').classList.add('open');
}

function closeStaffStrategy() {
  document.getElementById('staff-strategy-overlay').classList.remove('on');
  document.getElementById('staff-strategy-modal').classList.remove('open');
}

// ===== INIT =====
function waitForFirebase(attempts = 0) {
  if (window.firebaseFns && window.firebaseDB) {
    loadData();
  } else if (attempts < 20) {
    setTimeout(() => waitForFirebase(attempts + 1), 150);
  } else {
    console.error('Firebase did not initialize in time.');
  }
}

waitForFirebase();
checkAuth();

// EXPORTS
window.showSection = showSection;
window.startStaffExecutionDay = startStaffExecutionDay;
window.selectStaffLivePhase = selectStaffLivePhase;
window.toggleStaffTaskStatus = toggleStaffTaskStatus;
window.viewStaffExecutionStrategy = viewStaffExecutionStrategy;
window.closeStaffStrategy = closeStaffStrategy;
window.selectStaffExecutionEvent = selectStaffExecutionEvent;
window.adminLogout = adminLogout;
window.logActivity = logActivity;

window.saveStaffEquipmentChecks = async function(pIdx, tIdx) {
  const res = RESERVATIONS.find(r => r.id === activeStaffExecutionResId);
  if (!res || !res.executionPlan) return;

  const p = res.executionPlan.phases[pIdx];
  if (!p) return;

  let totalPcs = 0, presentPcs = 0, missingPcs = 0, damaged = 0, broken = 0;
  let checklistData = [];

  const checks = p.equipmentChecks || {};
  
  if (res.equipmentManifest) {
    res.equipmentManifest.forEach(eq => {
      const safeId = (eq.assetId || eq.name).replace(/[^a-zA-Z0-9]/g, '-');
      const condEl = document.getElementById(`eq-chk-cond-${pIdx}-${safeId}`);
      const statEl = document.getElementById(`eq-chk-stat-${pIdx}-${safeId}`);
      if (condEl && statEl) {
        checks[safeId] = {
          condition: condEl.value,
          status: statEl.value,
          lastUpdated: new Date().toISOString()
        };

        const totalQty = parseInt(eq.assignedQty || eq.assignQty) || parseInt(eq.requiredQty) || 1;
        const presentQty = statEl.value === 'missing' ? 0 : totalQty;
        const missingQty = totalQty - presentQty;
        const condition = condEl.value === 'fine' ? 'excellent' : 'broken';

        totalPcs += totalQty;
        presentPcs += presentQty;
        missingPcs += missingQty;
        if (condition === 'broken') broken++;

        checklistData.push({
          assetId: eq.assetId || 'EQ-???',
          name: eq.name,
          category: eq.category || 'Equipment',
          source: 'inventory',
          totalQty,
          presentQty,
          missingQty,
          condition,
          liableParty: 'none'
        });
      }
    });
  }

  p.equipmentChecks = checks;

  // Also mark the task as done if not already done
  const t = p.tasks[tIdx];
  if (t && t.status !== 'done') {
    t.status = 'done';
    t.completedAt = new Date().toISOString();
    logActivity(`Completed "${t.text}" on ${res.client}'s event`);
  }

  renderStaffExecutionLive();
  renderStaffDashboard();

  try {
    const { doc, updateDoc, collection, addDoc } = window.firebaseFns;
    
    // Save to execution plan
    await updateDoc(doc(window.firebaseDB, 'reservations', res.id), { executionPlan: res.executionPlan });

    // Auto-Log to deploymentLogs for Admin Lifecycle
    const record = {
      reservationId: res.id,
      eventName: res.client || res.name,
      eventDate: res.date,
      stage: p.id,
      timestamp: new Date().toISOString(),
      loggedAt: new Date().toISOString(),
      loggedBy: 'Staff',
      liableParty: 'see-per-item',
      checklist: checklistData,
      summary: { totalPcs, presentPcs, missingPcs, damaged, broken }
    };

    await addDoc(collection(window.firebaseDB, 'deploymentLogs'), record);

    // Show Execution Summary Panel instead of alert
    showExecutionSummaryPanel(res, p, { totalPcs, presentPcs, missingPcs, damaged, broken, checklistData });
  } catch(e) {
    console.error("Failed to save checklist", e);
    alert('Saved locally, but failed to sync to server.');
  }
};

// ===== EXECUTION SUMMARY PANEL =====
// Called after Save Checklist & Mark Done in the Restorage phase

let EXECUTION_PERFORMANCE_LOG = (() => {
  try { return JSON.parse(localStorage.getItem('halden_exec_perf_log') || '[]'); } catch(e){ return []; }
})();

function saveToExecutionPerformanceLog(entry) {
  EXECUTION_PERFORMANCE_LOG.unshift(entry);
  if (EXECUTION_PERFORMANCE_LOG.length > 50) EXECUTION_PERFORMANCE_LOG.pop();
  try { localStorage.setItem('halden_exec_perf_log', JSON.stringify(EXECUTION_PERFORMANCE_LOG)); } catch(e){}
}

function showExecutionSummaryPanel(res, phase, stats) {
  const logged = sessionStorage.getItem('halden_staff');
  const staff = logged ? JSON.parse(logged) : {};
  const staffName = staff.name || 'Staff Member';
  const staffId = staff.id || 'STF-001';

  // Build assignment rows from phase tasks
  const phaseDefs = [
    { name: 'Departure',   start: '05:00', end: '06:00' },
    { name: 'Deployment',  start: '06:00', end: '08:00' },
    { name: 'Execution',   start: '08:00', end: '15:00' },
    { name: 'Bashout',     start: '15:00', end: '16:00' },
    { name: 'Restorage',   start: '16:00', end: '17:00' },
  ];

  // Gather tasks across all phases assigned to this staff
  const allPhases = (res.executionPlan?.phases || []);
  const assignedTasks = [];
  let totalTasksDone = 0;

  allPhases.forEach((p, pi) => {
    const phaseDef = phaseDefs[pi] || {};
    (p.tasks || []).forEach(t => {
      const ids = (t.staffIds || []).map(x => (x||'').toLowerCase());
      const matchesSelf = ids.includes((staff.id||'').toLowerCase()) ||
                          ids.includes((staff.name||'').toLowerCase()) ||
                          ids.includes((staff.email||'').toLowerCase());
      if (matchesSelf) {
        totalTasksDone++;
        assignedTasks.push({
          phase: p.name || phaseDef.name || `Phase ${pi+1}`,
          task: t.text || 'Task',
          status: t.status || 'done',
          window: `${phaseDef.start} – ${phaseDef.end}`,
          completedAt: t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Completed'
        });
      }
    });
  });

  // If no tasks found (simple phase only), show the Restorage phase tasks
  if (assignedTasks.length === 0) {
    (phase.tasks || []).forEach(t => {
      totalTasksDone++;
      assignedTasks.push({
        phase: phase.name || 'Restorage',
        task: t.text || 'Task',
        status: t.status || 'done',
        window: '16:00 – 17:00',
        completedAt: t.completedAt ? new Date(t.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : 'Completed'
      });
    });
  }

  // Working hours: based on phase definitions (5 phases = 12 hrs total, staff typically covers Departure to Restorage)
  const startTime = new Date(); startTime.setHours(5, 0, 0, 0);
  const endTime = new Date(); endTime.setHours(17, 0, 0, 0);
  const workingHours = ((endTime - startTime) / 3600000).toFixed(1); // 12.0

  // Estimated salary (placeholder: ₱600/hour)
  const hourlyRate = 600;
  const estimatedSalary = (parseFloat(workingHours) * hourlyRate).toLocaleString();

  // Inventory summary
  const { totalPcs = 0, presentPcs = 0, missingPcs = 0, damaged = 0, broken = 0, checklistData = [] } = stats;

  // Create the performance record
  const perfRecord = {
    id: 'PERF-' + Date.now(),
    timestamp: new Date().toISOString(),
    staffName,
    staffId,
    eventName: res.client || 'Unknown Event',
    eventDate: res.date || 'N/A',
    packageName: res.packageName || res.type || 'N/A',
    totalTasksDone,
    assignedTasks,
    workingHours: parseFloat(workingHours),
    estimatedSalary: parseFloat(workingHours) * hourlyRate,
    inventory: { totalPcs, presentPcs, missingPcs, damaged, broken }
  };
  saveToExecutionPerformanceLog(perfRecord);

  // Build HTML for the panel
  const taskRows = assignedTasks.map(t => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid rgba(196,154,60,0.1);">
      <div style="width:8px;height:8px;border-radius:50%;background:#27ae60;flex-shrink:0;margin-top:5px;"></div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${t.task}</div>
        <div style="font-size:11px;color:var(--text-dim);">${t.phase} &nbsp;·&nbsp; ${t.window}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;font-weight:800;color:#27ae60;text-transform:uppercase;">Done</div>
        <div style="font-size:10px;color:var(--text-dim);">${t.completedAt}</div>
      </div>
    </div>
  `).join('');

  const panelHTML = `
  <div id="exec-summary-overlay" style="
    position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;
    display:flex;align-items:center;justify-content:center;padding:20px;
    backdrop-filter:blur(4px);
  ">
    <div style="
      background:var(--bg);border:1px solid var(--border);border-radius:24px;
      width:100%;max-width:700px;max-height:90vh;overflow-y:auto;
      box-shadow:0 40px 80px rgba(0,0,0,0.5);
    ">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1007,#2d1f0a);padding:28px;border-radius:24px 24px 0 0;position:relative;">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--gold);margin-bottom:8px;">Execution Complete</div>
        <div style="font-size:26px;font-weight:900;color:#fff;margin-bottom:4px;">Execution Summary</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);">${res.client}'s Event &nbsp;·&nbsp; ${res.date || 'Today'} &nbsp;·&nbsp; ${res.packageName || res.type || 'Custom Package'}</div>
        <div style="position:absolute;top:24px;right:24px;">
          <span style="color:#27ae60;font-size:11px;font-weight:800;text-transform:uppercase;">All Done</span>
        </div>
      </div>

      <div style="padding:24px;">

        <!-- Staff Identity -->
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px;display:flex;gap:16px;align-items:center;">
          <div style="width:48px;height:48px;background:var(--gold);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#000;">${staffName.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text);">${staffName}</div>
            <div style="font-size:11px;color:var(--text-dim);">Staff ID: ${staffId}</div>
          </div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:var(--text-dim);margin-bottom:2px;">Report ID</div>
            <div style="font-size:12px;font-weight:700;color:var(--gold);">${perfRecord.id}</div>
          </div>
        </div>

        <!-- Stats Row -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px;">
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px;">Tasks Completed</div>
            <div style="font-size:32px;font-weight:900;color:var(--gold);">${totalTasksDone}</div>
            <div style="font-size:10px;color:var(--text-dim);">assignments done</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px;">Working Hours</div>
            <div style="font-size:32px;font-weight:900;color:#3498db;">${workingHours}</div>
            <div style="font-size:10px;color:var(--text-dim);">hrs (05:00 – 17:00)</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px;">Est. Salary</div>
            <div style="font-size:26px;font-weight:900;color:#27ae60;">&#8369;${estimatedSalary}</div>
            <div style="font-size:10px;color:var(--text-dim);">at &#8369;${hourlyRate}/hr</div>
          </div>
        </div>

        <!-- Task Assignments Log -->
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--gold);margin-bottom:12px;">Assignment Log</div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;">
            ${taskRows || '<div style="text-align:center;color:var(--text-dim);font-size:13px;padding:20px;">No individual task data found : checklist completed.</div>'}
          </div>
        </div>

        <!-- Inventory Summary -->
        <div style="margin-bottom:20px;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--gold);margin-bottom:12px;">Inventory Condition</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
            ${[
              ['Total', totalPcs, '#c49a3c'],
              ['Present', presentPcs, '#27ae60'],
              ['Missing', missingPcs, '#e74c3c'],
              ['Damaged', damaged, '#e67e22'],
              ['Broken', broken, '#c0392b'],
            ].map(([lbl,val,clr]) => `
              <div style="border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;background:var(--bg2);">
                <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:var(--text-dim);margin-bottom:4px;">${lbl}</div>
                <div style="font-size:22px;font-weight:900;color:${clr};">${val}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Phase Timeline -->
        <div style="margin-bottom:24px;">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--gold);margin-bottom:12px;">Phase Coverage</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
            ${phaseDefs.map(pd => `
              <div style="border:2px solid var(--gold);border-radius:10px;padding:10px;text-align:center;">
                <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:var(--gold);margin-bottom:2px;">${pd.name}</div>
                <div style="font-size:9px;color:var(--text-dim);">${pd.start} – ${pd.end}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Actions -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <button onclick="document.getElementById('exec-summary-overlay').remove();renderExecutionPerformance();" 
            style="padding:14px;background:var(--gold);color:#000;border:none;border-radius:12px;font-weight:800;font-size:13px;cursor:pointer;">
            Save to Performance Log
          </button>
          <button onclick="document.getElementById('exec-summary-overlay').remove();" 
            style="padding:14px;background:var(--bg2);color:var(--text);border:1px solid var(--border);border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;">
            Close
          </button>
        </div>

      </div>
    </div>
  </div>`;

  // Inject panel into body
  const overlay = document.createElement('div');
  overlay.innerHTML = panelHTML;
  document.body.appendChild(overlay.firstElementChild);
}

// ===== EXECUTION PERFORMANCE MODULE =====
function renderExecutionPerformance() {
  const log = EXECUTION_PERFORMANCE_LOG;
  const container = document.getElementById('exec-performance-container');
  if (!container) return;

  if (log.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-dim);">
      <div style="font-size:48px;margin-bottom:16px;">-</div>
      <div style="font-size:15px;font-weight:700;">No performance records yet</div>
      <div style="font-size:12px;margin-top:6px;">Records are saved automatically after completing the Restorage phase checklist.</div>
    </div>`;
    return;
  }

  container.innerHTML = log.map(rec => {
    const date = new Date(rec.timestamp).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
    return `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--gold);">Execution Record</div>
          <div style="font-size:17px;font-weight:800;color:var(--text);margin-top:2px;">${rec.eventName}'s Event</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:2px;">${rec.packageName} &nbsp;·&nbsp; ${rec.eventDate} &nbsp;·&nbsp; ${date}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:var(--text-dim);">Record ID</div>
          <div style="font-size:11px;font-weight:700;color:var(--gold);">${rec.id}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
        <div style="border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);font-weight:800;margin-bottom:4px;">Tasks Done</div>
          <div style="font-size:24px;font-weight:900;color:var(--gold);">${rec.totalTasksDone}</div>
        </div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);font-weight:800;margin-bottom:4px;">Hours Worked</div>
          <div style="font-size:24px;font-weight:900;color:#3498db;">${rec.workingHours}</div>
        </div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);font-weight:800;margin-bottom:4px;">Est. Salary</div>
          <div style="font-size:18px;font-weight:900;color:#27ae60;">&#8369;${Number(rec.estimatedSalary).toLocaleString()}</div>
        </div>
        <div style="border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:9px;text-transform:uppercase;color:var(--text-dim);font-weight:800;margin-bottom:4px;">Items OK</div>
          <div style="font-size:24px;font-weight:900;color:#27ae60;">${rec.inventory?.presentPcs ?? '-'}</div>
        </div>
      </div>
      <details style="cursor:pointer;">
        <summary style="font-size:11px;font-weight:700;color:var(--gold);outline:none;">View Assignment Details</summary>
        <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">
          ${(rec.assignedTasks || []).map(t => `
            <div style="display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(196,154,60,0.08);">
              <div style="width:6px;height:6px;border-radius:50%;background:#27ae60;flex-shrink:0;"></div>
              <div style="flex:1;font-size:12px;font-weight:600;color:var(--text);">${t.task}</div>
              <div style="font-size:10px;color:var(--text-dim);">${t.phase} &nbsp;${t.window}</div>
              <div style="font-size:10px;font-weight:800;color:#27ae60;">${t.completedAt}</div>
            </div>
          `).join('') || '<div style="color:var(--text-dim);font-size:12px;padding:8px;">No task details recorded.</div>'}
        </div>
      </details>
    </div>`;
  }).join('');
}

window.showExecutionSummaryPanel = showExecutionSummaryPanel;
window.renderExecutionPerformance = renderExecutionPerformance;

// ===== PROFILE & CALENDAR MODULE =====

async function loadStaffProfile() {
  const logged = sessionStorage.getItem('halden_staff');
  if (!logged) return;
  const staff = JSON.parse(logged);

  try {
    const staffId = staff.id || staff.uid;
    if (!staffId) {
       console.error("No valid staff ID found.");
       return;
    }
    const { data, error } = await window.supabaseClient.from('users').select('*').eq('id', staffId).single();
    if (error) {
      console.error('Error fetching staff profile:', error);
      return;
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // e.g., "2026-09"
    let statusToDisplay = data.availability || 'unknown';

    // Removed last_availability_month auto-switch due to schema constraints

    const nameParts = (data.name || '').split(' ');
    const fname = nameParts[0] || '';
    const lname = nameParts.length > 1 ? nameParts.slice(-1)[0] : '';
    const mname = nameParts.length > 2 ? nameParts.slice(1, -1).join(' ') : '';

    // Populate Display View
    document.getElementById('prof-fname').textContent = fname || ':';
    document.getElementById('prof-mname').textContent = mname || ':';
    document.getElementById('prof-lname').textContent = lname || ':';
    document.getElementById('prof-email').textContent = data.email || ':';
    document.getElementById('prof-phone').textContent = data.phone || ':';

    // Populate Edit View
    document.getElementById('edit-fname').value = fname;
    document.getElementById('edit-mname').value = mname;
    document.getElementById('edit-lname').value = lname;
    document.getElementById('edit-phone').value = data.phone || '';

    // Availability Toggle
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('avail-month-label').textContent = monthNames[new Date().getMonth()];
    
    const isAvail = statusToDisplay === 'Available';
    document.getElementById('avail-toggle').checked = isAvail;
    const availText = document.getElementById('avail-status-text');
    availText.textContent = isAvail ? 'Available' : 'Unavailable';
    availText.style.color = isAvail ? 'var(--green)' : 'var(--text-dim)';

    // Init Calendar
    initStaffCalendar();
  } catch (err) {
    console.error('Profile load error:', err);
  }
}

function toggleEditProfile(isEditing = true) {
  document.getElementById('profile-display-view').style.display = isEditing ? 'none' : 'flex';
  document.getElementById('profile-edit-view').style.display = isEditing ? 'flex' : 'none';
  document.getElementById('btn-edit-profile').style.display = isEditing ? 'none' : 'block';
}

async function saveProfile() {
  const logged = sessionStorage.getItem('halden_staff');
  if (!logged) return;
  const staff = JSON.parse(logged);

  const btn = document.getElementById('btn-save-profile');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  const fname = document.getElementById('edit-fname').value.trim();
  const mname = document.getElementById('edit-mname').value.trim();
  const lname = document.getElementById('edit-lname').value.trim();
  
  const payload = {
    name: [fname, mname, lname].filter(Boolean).join(' '),
    phone: document.getElementById('edit-phone').value.trim()
  };

  const staffId = staff.id || staff.uid;
  const { error } = await window.supabaseClient.from('users').update(payload).eq('id', staffId);
  
  if (!error) {
    // Update local cache
    staff.name = payload.name;
    sessionStorage.setItem('halden_staff', JSON.stringify(staff));
    document.getElementById('admin-name').textContent = staff.name;

    await loadStaffProfile();
    toggleEditProfile(false);
  } else {
    alert('Failed to save profile changes.');
  }

  btn.textContent = 'Save Changes';
  btn.disabled = false;
}

async function toggleAvailability(checkbox) {
  const logged = sessionStorage.getItem('halden_staff');
  if (!logged) return;
  const staff = JSON.parse(logged);

  const isAvail = checkbox.checked;
  const newStatus = isAvail ? 'Available' : 'Unavailable';
  const availText = document.getElementById('avail-status-text');
  
  availText.textContent = 'Saving...';
  availText.style.color = 'var(--text-dim)';
  checkbox.disabled = true;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const staffId = staff.id || staff.uid;
  const { error } = await window.supabaseClient.from('users').update({
    availability: newStatus
  }).eq('id', staffId);

  if (!error) {
    availText.textContent = newStatus;
    availText.style.color = isAvail ? 'var(--green)' : 'var(--text-dim)';
  } else {
    alert('Failed to update availability.');
    checkbox.checked = !isAvail; // Revert
    availText.textContent = !isAvail ? 'Available' : 'Unavailable';
    availText.style.color = !isAvail ? 'var(--green)' : 'var(--text-dim)';
  }
  
  checkbox.disabled = false;
}

staffCalendarInstances = staffCalendarInstances || [];
async function initStaffCalendar() {
  const containers = [
    document.getElementById('staff-calendar-container'),
    document.getElementById('staff-dashboard-calendar-container')
  ].filter(Boolean);

  if (containers.length === 0) return;

  // Destroy previous instances
  staffCalendarInstances.forEach(inst => inst.destroy());
  staffCalendarInstances = [];

  try {
    // Ensure Supabase session is restored before querying
    if (window.supabaseClient) {
      await window.supabaseClient.auth.getSession();
    }

    const { data: resData, error } = await window.supabaseClient
      .from('reservations')
      .select('*');

    if (error) throw error;

    const sbData = resData || [];
    const allCandidates = [];
    if (typeof RESERVATIONS !== 'undefined' && Array.isArray(RESERVATIONS)) allCandidates.push(...RESERVATIONS);
    allCandidates.push(...sbData);

    const combinedMap = new Map();
    
    // Add fallback cache to match index.html calendar behavior
    try {
      const cached = localStorage.getItem('halden_public_calendar_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) allCandidates.push(...parsed);
      }
    } catch(e) {}

    allCandidates.forEach(r => {
      if (r && r.id) {
        combinedMap.set(r.id, Object.assign({}, combinedMap.get(r.id) || {}, r));
      }
    });

    const activeStatuses = ['confirmed', 'approved', 'procurement', 'procuring', 'preparing', 'on-going', 'paid', 'downpayment_paid', 'initial_fee_paid', 'scheduled'];
    const finalRes = Array.from(combinedMap.values()).filter(ev => {
      const status = String(ev.status || ev.reservation_status || '').toLowerCase().trim();
      const isAct = activeStatuses.includes(status) || ev.confirmed || ev.is_confirmed;
      const isDone = status === 'cancelled' || status === 'canceled' || status === 'rejected' || status === 'completed';
      return isAct && !isDone;
    });

    const assignedIds = window.STAFF_ASSIGNED_RES_IDS || new Set();
    const events = [];
    finalRes.forEach(r => {
      let tStr = r.timeframe || r.time || '';
      
      let rawDate = r.date || r.event_date || r.reservation_date;
      let startStr = null;
      if (rawDate) {
        if (typeof rawDate === 'object' && rawDate.seconds) {
          startStr = new Date(rawDate.seconds * 1000).toISOString().split('T')[0];
        } else {
          const s = String(rawDate).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) startStr = s;
          else {
            const d = new Date(s);
            if (!isNaN(d.getTime())) startStr = d.toISOString().split('T')[0];
          }
        }
      }
      
      if (!startStr) return;

      if (tStr.includes('-')) {
        let startTime = tStr.split('-')[0].trim();
        if (startTime.match(/am|pm/i)) {
          const isPM = startTime.toLowerCase().includes('pm');
          let [h, m] = startTime.toLowerCase().replace(/am|pm/, '').trim().split(':');
          if (!m) m = '00';
          let hi = parseInt(h);
          if (isPM && hi < 12) hi += 12;
          if (!isPM && hi === 12) hi = 0;
          startStr += `T${hi.toString().padStart(2,'0')}:${m}:00`;
        }
      }

      function formatReservationTimeRange12h(timeStr) {
        if (!timeStr || typeof timeStr !== 'string' || !timeStr.trim()) {
          return '12:00 PM - 5:00 PM';
        }
        const str = timeStr.trim();
        function to12h(t) {
          if (!t) return '';
          let raw = t.trim();
          const hasAm = /am/i.test(raw);
          const hasPm = /pm/i.test(raw);
          raw = raw.replace(/am|pm/ig, '').trim();
          const parts = raw.split(':');
          let h = parseInt(parts[0], 10);
          let m = parts[1] !== undefined ? parseInt(parts[1], 10) : 0;
          if (isNaN(h)) return t.trim();
          if (isNaN(m)) m = 0;

          let period = 'AM';
          if (hasPm) {
            period = 'PM';
            if (h < 12) {}
          } else if (hasAm) {
            period = 'AM';
            if (h === 12) h = 12;
          } else {
            if (h >= 12) {
              period = 'PM';
              if (h > 12) h -= 12;
            } else {
              period = 'AM';
              if (h === 0) h = 12;
            }
          }
          const mStr = String(m).padStart(2, '0');
          return `${h}:${mStr} ${period}`;
        }

        if (str.includes('-')) {
          const [p1, p2] = str.split('-');
          const t1 = to12h(p1);
          const t2 = to12h(p2);
          if (t1 && t2) return `${t1} - ${t2}`;
          if (t1) return t1;
        }
        return to12h(str) || '12:00 PM - 5:00 PM';
      }

      const isAssigned = assignedIds.has(r.id);
      events.push({
        id: r.id,
        title: formatReservationTimeRange12h(tStr),
        start: startStr,
        allDay: true,
        backgroundColor: isAssigned ? '#22c55e' : '#c49a3c',
        borderColor:     isAssigned ? '#16a34a' : '#a07830',
        textColor: isAssigned ? '#fff' : '#000'
      });
    });

    containers.forEach(container => {
      const calendar = new FullCalendar.Calendar(container, {
        initialView: 'dayGridMonth',
        displayEventTime: false,
        headerToolbar: {
          left: '',
          center: 'title',
          right: 'prev,next'
        },
        events: events,
        height: 450,
        themeSystem: 'standard'
      });
      calendar.render();
      staffCalendarInstances.push(calendar);
    });
  } catch (err) {
    console.error('Calendar init error:', err);
  }
}

// ===== VIEW PLAN — INLINE GPS MAP =====
const _vpMapInstances = {}; // resId -> L.Map instance

async function toggleStaffViewPlan(resId) {
  const safeId   = resId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const expandEl = document.getElementById('vp-expand-' + safeId);
  const mapEl    = document.getElementById('vp-map-'    + safeId);
  const btnEl    = document.getElementById('btn-vp-'    + safeId);
  if (!expandEl) return;

  const isOpen = expandEl.style.display !== 'none';

  if (isOpen) {
    expandEl.style.display = 'none';
    if (btnEl) btnEl.textContent = 'View Plan';
    return;
  }

  // Expand
  expandEl.style.display = 'block';
  if (btnEl) btnEl.textContent = 'Close Plan';

  // Already fully rendered — just re-show
  if (_vpMapInstances[resId]) {
    _vpMapInstances[resId].invalidateSize();
    return;
  }

  const res     = (RESERVATIONS || []).find(r => r.id === resId);
  const address = (res && (res.venue || res.address || res.venueAddress ||
                           res.venue_address || res.venueName)) || '';

  // --- Show roles section first ---
  const rolesContainerId = 'vp-roles-' + safeId;
  let rolesHtml = '';
  try {
    const staffData  = JSON.parse(sessionStorage.getItem('halden_staff') || '{}');
    const myStaffId  = staffData.id || '';
    if (myStaffId && window.supabaseClient) {
      const { data: asgn } = await window.supabaseClient
        .from('reservation_staff_assignments')
        .select('roles')
        .eq('reservation_id', resId)
        .eq('staff_id', myStaffId)
        .maybeSingle();

      const roles = (asgn && Array.isArray(asgn.roles) ? asgn.roles : []).filter(Boolean);
      if (roles.length > 0) {
        let roleRows = [];
        if (window.supabaseClient) {
          const { data } = await window.supabaseClient
            .from('staff_roles')
            .select('role_name, description')
            .in('role_name', roles);
          roleRows = data || [];
        }
        
        // Fallback to defaults if not found in DB
        const fallbackRoles = {
          'Setup & Styling': 'Tables, chairs, cloths, table settings, basic setup',
          'Food Service': 'Serve food, refill food, refill rice, food heating',
          'Beverage Service': 'Juice, water, glasses, beverage station',
          'Table / Guest Service': 'Waiter duties, handing food, assisting guests',
          'Sanitation': 'Washing plates/glasses, cleaning spills, maintaining cleanliness',
          'Equipment / Logistics': 'Equipment movement, counting, loading/unloading',
          'Event Floater': 'Assist wherever the event manager assigns',
          'Event Coordinator/Manager': 'Directs staff and oversees execution'
        };

        const descMap = {};
        roles.forEach(r => { descMap[r] = fallbackRoles[r] || ''; }); // prime with fallbacks
        roleRows.forEach(r => { if (r.description) descMap[r.role_name] = r.description; }); // override with DB

        rolesHtml = `
          <div style="padding:16px 20px; border-bottom:1px solid var(--border);">
            <div style="font-size:11px;font-weight:800;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Your Assigned Roles</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${roles.map(r => `
                <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px 14px;">
                  <div style="font-size:13px;font-weight:700;color:var(--cream);">${r}</div>
                  ${descMap[r] ? `<div style="font-size:11px;color:var(--text-dim);margin-top:3px;">${descMap[r]}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>`;
      } else {
        rolesHtml = `<div style="padding:12px 20px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-dim);">No roles assigned for this event yet.</div>`;
      }
    }
  } catch (e) { console.warn('Could not load roles:', e); }

  // Inject roles HTML before the map section
  const rolesEl = document.getElementById(rolesContainerId);
  if (rolesEl) rolesEl.innerHTML = rolesHtml;

  if (!address || !mapEl) return;

  // Show loading state in map
  mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:13px;">Loading map...</div>';

  try {
    const geoUrl = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
                   encodeURIComponent(address);
    const resp = await fetch(geoUrl, { headers: { 'Accept-Language': 'en' } });
    const geo  = await resp.json();

    if (!geo || geo.length === 0) {
      mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:13px;">Could not locate venue on map.</div>';
      return;
    }

    const lat = parseFloat(geo[0].lat);
    const lon = parseFloat(geo[0].lon);

    mapEl.innerHTML = '';
    const map = L.map(mapEl).setView([lat, lon], 16);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const goldIcon = L.divIcon({
      html: '<div style="background:#c49a3c;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>',
      className: '',
      iconSize:   [20, 20],
      iconAnchor: [10, 10]
    });
    L.marker([lat, lon], { icon: goldIcon })
      .addTo(map)
      .bindPopup(`<b>${(res && res.client) || 'Venue'}</b><br>${address}`)
      .openPopup();

    _vpMapInstances[resId] = map;
    setTimeout(() => map.invalidateSize(), 150);

  } catch (err) {
    console.error('Map init error:', err);
    mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-dim);font-size:13px;">Map unavailable.</div>';
  }
}

// Attach to window
window.loadStaffProfile    = loadStaffProfile;
window.toggleEditProfile   = toggleEditProfile;
window.saveProfile         = saveProfile;
window.toggleAvailability  = toggleAvailability;
window.toggleStaffViewPlan = toggleStaffViewPlan;



// ==========================================
// ROUTINE CHECKS LOGIC PORTED FROM ADMIN
// ==========================================


function getStaffName() {
  try {
    const raw = sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff');
    if(raw) {
      const u = JSON.parse(raw);
      return u.name || (u.fname ? `${u.fname} ${u.lname}` : 'Unknown Staff');
    }
  } catch(e) {}
  return 'Staff';
}
var ROUTINE_CHECK_LOGS = [
  {
    id: 'CHK-001',
    date: '2026-04-06',
    checkedBy: 'Staff - ' + getStaffName(),
    totalItems: 44,
    issuesFound: 2,
    flagsCreated: 2,
    notes: '2 chipped wine glasses found. Chafing dish #3 has a loose handle : flagged for repair.',
    status: 'Completed'
  }
];

// Initialize with any saved logs from local storage (if running locally)
try {
  const localLogs = JSON.parse(localStorage.getItem('rc_saved_logs') || '[]');
  if (Array.isArray(localLogs)) {
    // Deduplicate by id before loading : only push entries not already present
    localLogs.forEach(l => {
      if (l && l.id && !ROUTINE_CHECK_LOGS.find(existing => existing.id === l.id)) {
        ROUTINE_CHECK_LOGS.push(l);
      }
    });
    // Write the deduplicated list back to localStorage to clean it up
    const deduped = [];
    const seen = new Set();
    localLogs.forEach(l => { if (l && l.id && !seen.has(l.id)) { seen.add(l.id); deduped.push(l); } });
    if (deduped.length !== localLogs.length) localStorage.setItem('rc_saved_logs', JSON.stringify(deduped));
  }
} catch (e) { }

lastRoutineCheckDate = localStorage.getItem('rc_last_check_date') || lastRoutineCheckDate || '2026-04-06';
var activeRoutineCheck = null; // stores current in-progress check

// ----- HELPERS -----
function daysSinceLastCheck() {
  if (!lastRoutineCheckDate) return 9999;
  // Append T00:00:00 so JS parses it as local midnight, preventing timezone offset bugs that result in -1 on the same day
  const diff = Date.now() - new Date(lastRoutineCheckDate + 'T00:00:00').getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}
function isRoutineCheckOverdue() { return daysSinceLastCheck() >= 7; }

function getAssetAvailStatus(asset) {
  const hasFlag = EQUIPMENT_FLAGS.find(f => f.assetId === asset.id && f.status !== 'Resolved');
  if (hasFlag) return { label: 'Flagged', cls: 'critical', icon: '' };
  switch (asset.status) {
    case 'Active': return { label: 'Available', cls: 'confirmed', icon: '' };
    case 'In Use': return { label: 'Deployed', cls: 'pending', icon: '' };
    case 'Under Repair': return { label: 'Under Repair', cls: 'critical', icon: '' };
    case 'Retired': return { label: 'Retired', cls: 'cancelled', icon: '' };
    default: return { label: asset.status, cls: 'pending', icon: '' };
  }
}

// ----- DASHBOARD ALERT BANNER -----
function updateRoutineAlertBanner() {
  const alertEl = document.getElementById('dash-routine-alert');
  const badge = document.getElementById('routine-sidebar-badge');
  if (!alertEl) return;
  const overdue = isRoutineCheckOverdue();
  alertEl.style.display = overdue ? 'block' : 'none';
  if (badge) badge.style.display = overdue ? 'inline-flex' : 'none';
  if (overdue) {
    const days = daysSinceLastCheck();
    const sub = document.getElementById('routine-alert-sub');
    if (sub) sub.textContent =
      `Last inspection was ${days} day${days !== 1 ? 's' : ''} ago : weekly check required. Click here to begin. →`;
  }
}

// ----- RENDER AVAILABILITY SECTION -----
function renderAvailabilitySection() {
  // Stats
  const avail = EIM_ASSETS.filter(a => {
    const fl = EQUIPMENT_FLAGS.find(f => f.assetId === a.id && f.status !== 'Resolved');
    return !fl && a.status === 'Active';
  }).length;
  const inUse = EIM_ASSETS.filter(a => a.status === 'In Use').length;
  const repair = EIM_ASSETS.filter(a => a.status === 'Under Repair').length;
  const flags = EQUIPMENT_FLAGS.filter(f => f.status !== 'Resolved').length;

  const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  s('avail-stat-avail', avail);
  s('avail-stat-inuse', inUse);
  s('avail-stat-repair', repair);
  s('avail-stat-flags', flags);

  // Flags panel
  const flagsEl = document.getElementById('avail-flags-container');
  if (flagsEl) {
    const active = EQUIPMENT_FLAGS.filter(f => f.status !== 'Resolved');
    if (!active.length) {
      flagsEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-dim); font-size:13px;">No active flags. All equipment accounted for. ✓</div>`;
    } else {
      const sevColors = { High: 'var(--red)', Medium: 'var(--amber)', Low: 'var(--gold)' };
      flagsEl.innerHTML = active.map((f, i) => `
        <div style="display:flex; align-items:flex-start; gap:14px; padding:14px 20px; border-bottom:1px solid var(--border);">
          <div style="width:8px; height:8px; border-radius:50%; background:${sevColors[f.severity] || 'var(--gold)'}; margin-top:5px; flex-shrink:0;"></div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:700; color:var(--cream); margin-bottom:2px;">${f.assetName}</div>
            <div style="font-size:12px; color:var(--text); margin-bottom:4px;">${f.issue}</div>
            <div style="font-size:11px; color:var(--text-dim);">
              Reported ${f.reportedDate} by ${f.reportedBy} ·
              <span style="color:${sevColors[f.severity]}">${f.severity} severity</span> ·
              <code style="font-size:10px; background:rgba(255,255,255,0.05); padding:1px 5px; border-radius:4px;">${f.id}</code>
            </div>
          </div>
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button class="btn-view" style="font-size:11px;" onclick="updateFlagStatus(${EQUIPMENT_FLAGS.indexOf(f)}, 'Under Repair')">Mark Repairing</button>
            <button class="btn-approve" style="font-size:11px;" onclick="updateFlagStatus(${EQUIPMENT_FLAGS.indexOf(f)}, 'Resolved')">✓ Resolve</button>
          </div>
        </div>`).join('');
    }
  }

  // Availability table
  const q = (document.getElementById('avail-search') || {}).value || '';
  const filtered = EIM_ASSETS.filter(a => {
    if (a.status === 'Disabled') return false;
    if (!q) return true;
    const ql = q.toLowerCase();
    return a.name.toLowerCase().includes(ql) || a.id.toLowerCase().includes(ql) || a.category.toLowerCase().includes(ql);
  });

  const tbody = document.getElementById('avail-tbody');
  if (!tbody) return;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-dim);">No items found.</td></tr>`;
    return;
  }

  const condColors = { Excellent: 'var(--green)', Good: 'var(--gold)', Fair: 'var(--amber)', Poor: 'var(--red)' };

  tbody.innerHTML = filtered.map(a => {
    const idx = EIM_ASSETS.indexOf(a);
    const avs = getAssetAvailStatus(a);
    return `
      <tr>
        <td><code style="font-size:11px; color:var(--gold);">${a.id}</code></td>
        <td>
          <div class="item-name">${a.name}</div>
          <div class="item-cat">${a.type}</div>
        </td>
        <td><span class="badge pending" style="font-size:10px;">${a.category}</span></td>
        <td style="font-size:13px;font-weight:600;">${a.quantity} <span style="color:var(--text-dim);font-size:11px;">${a.unitType}</span></td>
        <td>
          <select class="avail-status-select" onchange="quickUpdateAssetStatus(${idx}, this.value)"
            style="background:transparent; border:1px solid var(--border); border-radius:6px; color:var(--text); padding:4px 8px; font-size:12px; font-family:'DM Sans',sans-serif; cursor:pointer;">
            <option value="Active"      ${a.status === 'Active' ? 'selected' : ''}> Available</option>
            <option value="In Use"      ${a.status === 'In Use' ? 'selected' : ''}> In Use</option>
            <option value="Under Repair"${a.status === 'Under Repair' ? 'selected' : ''}> Under Repair</option>
            <option value="Retired"     ${a.status === 'Retired' ? 'selected' : ''}> Retired</option>
          </select>
          ${avs.label === 'Flagged' ? `<div style="font-size:10px;color:var(--red);margin-top:3px;"> Flagged</div>` : ''}
        </td>
        <td><span style="font-size:12px;font-weight:600;color:${condColors[a.condition] || 'var(--text)'};">● ${a.condition}</span></td>
        <td style="text-align:right;">
          <button class="btn-view" style="font-size:11px;" onclick="openFlagModalFor('${a.id}')"> Flag</button>
        </td>
      </tr>`;
  }).join('');
}

function quickUpdateAssetStatus(idx, newStatus) {
  if (!EIM_ASSETS[idx]) return;
  EIM_ASSETS[idx].status = newStatus;
  renderAvailabilitySection();
  renderEIMStats();
  updateRoutineAlertBanner();
}
window.quickUpdateAssetStatus = quickUpdateAssetStatus;

function updateFlagStatus(idx, newStatus) {
  if (!EQUIPMENT_FLAGS[idx]) return;
  EQUIPMENT_FLAGS[idx].status = newStatus;
  renderAvailabilitySection();
  updateRoutineAlertBanner();
}
window.updateFlagStatus = updateFlagStatus;
window.renderAvailabilitySection = renderAvailabilitySection;

// ----- FLAG MODAL -----
function populateFlagSelect(preselect) {
  const sel = document.getElementById('flag-asset-select');
  if (!sel) return;
  sel.innerHTML = `<option value="">Select equipment...</option>` +
    EIM_ASSETS.filter(a => a.status !== 'Disabled').map(a => `<option value="${a.id}" ${a.id === preselect ? 'selected' : ''}>${a.id} : ${a.name}</option>`).join('');
}

function openFlagModal() {
  populateFlagSelect(null);
  document.getElementById('flag-description').value = '';
  document.getElementById('flag-reporter').value = '';
  document.getElementById('flag-type').value = 'damage';
  document.getElementById('flag-severity').value = 'Medium';
  document.getElementById('flag-overlay').classList.add('on');
  document.getElementById('flag-modal').classList.add('open');
}

function openFlagModalFor(assetId) {
  openFlagModal();
  populateFlagSelect(assetId);
}

function closeFlagModal() {
  document.getElementById('flag-overlay').classList.remove('on');
  document.getElementById('flag-modal').classList.remove('open');
}

function submitFlag() {
  const assetId = document.getElementById('flag-asset-select').value;
  const desc = document.getElementById('flag-description').value.trim();
  const reporter = document.getElementById('flag-reporter').value.trim();
  if (!assetId || !desc) { alert('Please select an asset and describe the issue.'); return; }
  const asset = EIM_ASSETS.find(a => a.id === assetId);
  const newFlag = {
    id: 'FLAG-' + String(EQUIPMENT_FLAGS.length + 1).padStart(3, '0'),
    assetId,
    assetName: asset ? asset.name : assetId,
    issue: desc,
    flagType: document.getElementById('flag-type').value,
    severity: document.getElementById('flag-severity').value,
    reportedDate: new Date().toISOString().split('T')[0],
    reportedBy: reporter || 'Admin',
    status: 'Flagged'
  };
  EQUIPMENT_FLAGS.push(newFlag);
  closeFlagModal();
  renderAvailabilitySection();
  updateRoutineAlertBanner();
  // TODO: persist to Firestore: addDoc(collection(db, 'equipment_flags'), newFlag)
}

window.openFlagModal = openFlagModal;
window.openFlagModalFor = openFlagModalFor;
window.closeFlagModal = closeFlagModal;
window.submitFlag = submitFlag;

// ====================================================================
// ==================== EIM 3.5: ROUTINE CHECKS =======================
// ====================================================================

// ----- SESSION KEYS -----
var RC_SESSION_KEY = 'rc_active_session';
var RC_ITEMS_KEY = 'rc_checked_items';
var RC_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours
var _rcTimerInterval = null;

// ----- HELPERS -----
function getRcSession() { try { return JSON.parse(localStorage.getItem(RC_SESSION_KEY) || 'null'); } catch (e) { return null; } }
function getRcCheckedItems() { try { return JSON.parse(localStorage.getItem(RC_ITEMS_KEY) || '{}'); } catch (e) { return {}; } }
function getRcSavedLogs() { try { return JSON.parse(localStorage.getItem('rc_saved_logs') || '[]'); } catch (e) { return []; } }

function saveRcSession(s) { 
  localStorage.setItem(RC_SESSION_KEY, JSON.stringify(s)); 
  if (s && s.id && window.supabaseClient) {
    window.supabaseClient.from('routine_check_sessions').upsert({
      id: s.id,
      started_at: s.startedAt,
      started_by: s.startedBy,
      status: 'active'
    }).then(() => {}).catch(e => console.error(e));
  }
}
function saveRcCheckedItems(c) { 
  localStorage.setItem(RC_ITEMS_KEY, JSON.stringify(c)); 
  const s = getRcSession();
  if (s && s.id && window.supabaseClient) {
    window.supabaseClient.from('routine_check_sessions').update({
      items_state: c
    }).eq('id', s.id).then(() => {}).catch(e => console.error(e));
  }
}
function saveRcSavedLogs(l) { localStorage.setItem('rc_saved_logs', JSON.stringify(l)); }

function clearRcSession() { 
  const s = getRcSession();
  if (s && s.id && window.supabaseClient) {
    window.supabaseClient.from('routine_check_sessions').delete().eq('id', s.id).then(() => {}).catch(e => console.error(e));
  }
  localStorage.removeItem(RC_SESSION_KEY); 
  localStorage.removeItem(RC_ITEMS_KEY); 
}

function rcSupabase() { return window.supabaseClient || null; }

async function fetchSupabaseScanLogs() {
  const sb = rcSupabase();
  if (!sb) return [];
  const { data } = await sb.from('routine_check').select('*').order('checked_at', { ascending: false }).limit(500);

  const allRows = data || [];

  // ── Group all individual item rows by their session ID ──────────────────
  // notes format: "Routine check : RCS-123..." or "SESSION:RCS-123..."
  const sessionItemsMap = {}; // sessionId -> [rows]
  const masterLogMap = {}; // sessionId -> masterRow

  allRows.forEach(row => {
    // Skip the SESSION-ACTIVE marker
    if (row.asset_id === 'SESSION-ACTIVE' || row.notes === 'SESSION-ACTIVE') return;

    // MASTER-LOG rows store full JSON in notes
    if (row.asset_id === 'MASTER-LOG' && row.notes && row.notes.startsWith('{')) {
      try {
        const parsed = JSON.parse(row.notes);
        if (parsed.id) masterLogMap[parsed.id] = { row, parsed };
      } catch (e) { }
      return;
    }

    // Individual item rows: extract session ID from notes
    let sid = null;
    if (row.notes) {
      // Match "Routine check : RCS-xxx", "Routine check - RCS-xxx", "Routine check — RCS-xxx"
      const m1 = row.notes.match(/Routine check\s*[\u2014\-:]\s*(\S+)/);
      if (m1) sid = m1[1];
      // "SESSION:RCS-xxx" style
      const m2 = row.notes.match(/SESSION:(\S+)/);
      if (m2) sid = m2[1];
    }
    if (sid) {
      if (!sessionItemsMap[sid]) sessionItemsMap[sid] = [];
      sessionItemsMap[sid].push(row);
    }
  });

  const parsedLogs = [];
  const seenIds = new Set();

  // ── Emit one entry per session with a MASTER-LOG ─────────────────────────
  Object.entries(masterLogMap).forEach(([sid, { row, parsed }]) => {
    if (seenIds.has(sid)) return;
    seenIds.add(sid);

    if (!parsed.itemBreakdown || !parsed.itemBreakdown.length) {
      const individualRows = sessionItemsMap[sid] || [];
      if (individualRows.length) {
        parsed.itemBreakdown = individualRows.map(r => {
          let brokenQty = 0, missingQty = 0, retiredQty = 0;
          const incidents = typeof r.incidents === 'string' ? ((() => { try { return JSON.parse(r.incidents); } catch (e) { return []; } })()) : (r.incidents || []);
          incidents.forEach(inc => {
            const q = parseInt(inc.qty) || 0;
            const t = (inc.type || '').toLowerCase();
            if (t === 'broken' || t === 'damaged') brokenQty += q;
            else if (t === 'missing') missingQty += q;
            else if (t === 'trash' || t === 'retired') retiredQty += q;
            else brokenQty += q;
          });
          const storedQty = parseInt(r.quantity) || 0;
          const eimAsset = (window.EIM_ASSETS || []).find(a => 
            a.id === r.asset_id || 
            a.assetId === r.asset_id || 
            a.asset_id === r.asset_id || 
            a.supabaseId === r.asset_id || 
            (a.name && r.equipment_name && a.name.trim().toLowerCase() === r.equipment_name.trim().toLowerCase())
          );
          const totalQty = storedQty || parseInt(r.good_qty) || parseInt(eimAsset?.total_qty || eimAsset?.quantity || 0) || 0;
          const goodQty = (r.status === 'good' && !incidents.length)
            ? (parseInt(r.good_qty) || totalQty)
            : Math.max(0, totalQty - brokenQty - missingQty - retiredQty);
          return { assetId: r.asset_id || '', assetName: r.equipment_name || r.asset_id || '', quantity: totalQty, goodQty, brokenQty, missingQty, retiredQty };
        });
      }
    }
    parsedLogs.push({ ...parsed, fromScan: false });
  });

  // ── Sessions WITHOUT a MASTER-LOG: group item rows → one entry per session ─
  Object.entries(sessionItemsMap).forEach(([sid, rows]) => {
    if (seenIds.has(sid)) return; // already handled above
    seenIds.add(sid);

    const earliest = rows.reduce((a, b) => (a.checked_at < b.checked_at ? a : b));
    const rawDate = earliest.checked_at || '';
    // Use local date from the timestamp
    const localDate = rawDate ? new Date(rawDate).toLocaleDateString('en-CA') : rawDate.split('T')[0];
    const issuesFound = rows.filter(r => r.status === 'incident').length;
    const itemBreakdown = rows.map(r => {
      let brokenQty = 0, missingQty = 0, retiredQty = 0;
      const incidents = typeof r.incidents === 'string' ? ((() => { try { return JSON.parse(r.incidents); } catch (e) { return []; } })()) : (r.incidents || []);
      incidents.forEach(inc => {
        const q = parseInt(inc.qty) || 0;
        const t = (inc.type || '').toLowerCase();
        if (t === 'broken' || t === 'damaged') brokenQty += q;
        else if (t === 'missing') missingQty += q;
        else if (t === 'trash' || t === 'retired') retiredQty += q;
        else brokenQty += q;
      });
      const storedQty2 = parseInt(r.quantity) || 0;
      const eimAsset2 = (window.EIM_ASSETS || []).find(a => 
        a.id === r.asset_id || 
        a.assetId === r.asset_id || 
        a.asset_id === r.asset_id || 
        a.supabaseId === r.asset_id || 
        (a.name && r.equipment_name && a.name.trim().toLowerCase() === r.equipment_name.trim().toLowerCase())
      );
      const totalQty = storedQty2 || parseInt(r.good_qty) || parseInt(eimAsset2?.total_qty || eimAsset2?.quantity || 0) || 0;
      const goodQty = (r.status === 'good' && !incidents.length)
        ? (parseInt(r.good_qty) || totalQty)
        : Math.max(0, totalQty - brokenQty - missingQty - retiredQty);
      return { assetId: r.asset_id || '', assetName: r.equipment_name || r.asset_id || '', quantity: totalQty, goodQty, brokenQty, missingQty, retiredQty };
    });

    parsedLogs.push({
      id: sid,
      date: localDate,
      checkedBy: earliest.checked_by || 'Admin',
      totalItems: rows.length,
      issuesFound,
      flagsCreated: 0,
      notes: issuesFound > 0 ? `${issuesFound} issue(s) found` : 'No issues found',
      status: issuesFound > 0 ? 'Issues Found' : 'Completed',
      itemBreakdown,
      fromScan: false
    });
  });

  return parsedLogs.slice(0, 50);
}


// Counts how many reservations an equipment item is currently allocated to
function countAllocationsForEquip(assetId) {
  if (!assetId) return 0;
  const key = (assetId || '').toUpperCase();
  const seen = new Set();
  // EIM_ASSETS rows loaded from Supabase carry allocated_reservation_id
  (EIM_ASSETS || []).forEach(a => {
    if ((a.id || '').toUpperCase() === key && a.allocated_reservation_id) {
      seen.add(a.allocated_reservation_id);
    }
  });
  // Also scan any Supabase-returned rows cached on the asset objects
  (EIM_ASSETS || []).forEach(a => {
    if ((a.asset_id || '').toUpperCase() === key && a.allocated_reservation_id) {
      seen.add(a.allocated_reservation_id);
    }
  });
  return seen.size;
}

// ====================================================================
// RENDER: Section header, history
// ====================================================================
function renderRoutineCheckSection() {
  const days = lastRoutineCheckDate ? daysSinceLastCheck() : null;
  const overdue = isRoutineCheckOverdue();

  const lastDateEl = document.getElementById('routine-last-date');
  const daysSinceEl = document.getElementById('routine-days-since');
  const badgeEl = document.getElementById('routine-due-badge');
  const itemCountEl = document.getElementById('routine-item-count');

  if (lastDateEl) lastDateEl.textContent = lastRoutineCheckDate
    ? new Date(lastRoutineCheckDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
    : 'Never';
  if (daysSinceEl) {
    daysSinceEl.textContent = days !== null ? days : '\u2014';
    daysSinceEl.style.color = overdue ? 'var(--red)' : 'var(--green)';
  }
  if (badgeEl) {
    badgeEl.innerHTML = overdue
      ? '<span class="badge critical" style="font-size:12px; padding:5px 14px;">OVERDUE</span>'
      : '<span class="badge confirmed" style="font-size:12px; padding:5px 14px;">On Schedule</span>';
  }
  if (itemCountEl) {
    const trackedRentals = RENTED_EQUIPMENT.filter(r => r.trackingType === 'rental' || r.reservationId || r.forEvent).length;
    itemCountEl.textContent = EIM_ASSETS.length + trackedRentals;
  }

  // Show/hide checklist container
  const container = document.getElementById('routine-checklist-container');
  if (container) container.style.display = activeRoutineCheck ? 'block' : 'none';

  // Start button label
  const startBtn = document.getElementById('btn-start-check');
  if (startBtn) startBtn.textContent = activeRoutineCheck ? 'Reset Check' : '+ Start New Check';

  // Render local data immediately, then async-refresh from Supabase
  renderRoutineHistory();
  refreshRoutineHistory(); // pulls cloud logs + updates lastRoutineCheckDate
  if (activeRoutineCheck) renderActiveChecklist();
}



async function refreshRoutineHistory() {
  const scanLogs = await fetchSupabaseScanLogs();
  scanLogs.forEach(log => {
    if (!ROUTINE_CHECK_LOGS.find(l => l.id === log.id)) ROUTINE_CHECK_LOGS.push(log);
  });

  // Deduplicate the entire array by id : keeps the LAST occurrence (most complete)
  const seenById = new Map();
  ROUTINE_CHECK_LOGS.forEach(l => seenById.set(l.id, l));
  ROUTINE_CHECK_LOGS.length = 0;
  seenById.forEach(l => ROUTINE_CHECK_LOGS.push(l));

  // Update lastRoutineCheckDate from the most recently dated submitted log
  const submittedLogs = ROUTINE_CHECK_LOGS.filter(l => l.date);
  if (submittedLogs.length) {
    const mostRecent = submittedLogs.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
    if (mostRecent.date > lastRoutineCheckDate) {
      lastRoutineCheckDate = mostRecent.date;
      localStorage.setItem('rc_last_check_date', lastRoutineCheckDate);
    }
  }

  // Directly update the stats header DOM after cloud sync
  const days = lastRoutineCheckDate ? daysSinceLastCheck() : null;
  const overdue = isRoutineCheckOverdue();
  const lastDateEl = document.getElementById('routine-last-date');
  const daysSinceEl = document.getElementById('routine-days-since');
  const badgeEl = document.getElementById('routine-due-badge');
  if (lastDateEl && lastRoutineCheckDate) {
    lastDateEl.textContent = new Date(lastRoutineCheckDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
  }
  if (daysSinceEl) {
    daysSinceEl.textContent = days !== null ? days : '\u2014';
    daysSinceEl.style.color = overdue ? 'var(--red)' : 'var(--green)';
  }
  if (badgeEl) {
    badgeEl.innerHTML = overdue
      ? '<span class="badge critical" style="font-size:12px; padding:5px 14px;">OVERDUE</span>'
      : '<span class="badge confirmed" style="font-size:12px; padding:5px 14px;">On Schedule</span>';
  }

  // Re-render the history list with cloud data
  renderRoutineHistory();
}

window.refreshRoutineHistory = refreshRoutineHistory;

function renderRoutineHistory() {
  const container = document.getElementById('routine-history-container');
  if (!container) return;
  if (!ROUTINE_CHECK_LOGS.length) {
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-dim); font-size:13px;">No inspection history yet.</div>';
    return;
  }
  // Deduplicate by id before rendering : one entry per unique session
  const uniqueLogs = new Map();
  ROUTINE_CHECK_LOGS.forEach(l => uniqueLogs.set(l.id, l));
  // Only show logs that have item-level breakdown data
  const sorted = [...uniqueLogs.values()]
    .filter(log => log.itemBreakdown && log.itemBreakdown.length > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!sorted.length) {
    container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--text-dim); font-size:13px;">No inspection history yet.</div>';
    return;
  }
  container.innerHTML = sorted.map((log, idx) => {
    const dateStr = new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const uid = `rc-hist-${idx}`;

    // Build item breakdown table if available
    let itemTableHtml = '';
    if (log.itemBreakdown && log.itemBreakdown.length) {
      const rows = log.itemBreakdown.map(item => {
        const asset = (window.EIM_ASSETS || []).find(a => 
          a.assetId === item.assetId || 
          a.id === item.assetId || 
          a.asset_id === item.assetId || 
          a.supabaseId === item.assetId || 
          (a.name && item.assetName && a.name.trim().toLowerCase() === item.assetName.trim().toLowerCase())
        );
        const totalQty = parseInt(item.quantity || asset?.total_qty || asset?.quantity || asset?.good_qty || 0) || 1;
        const broken = parseInt(item.brokenQty) || 0;
        const missing = parseInt(item.missingQty) || 0;
        const retired = parseInt(item.retiredQty) || 0;
        const calculatedGood = Math.max(0, totalQty - broken - missing - retired);
        const gCount = (item.goodQty != null && item.goodQty > 0) ? item.goodQty : calculatedGood;
        return `
        <tr>
          <td style="padding:7px 10px; font-size:12px; color:var(--cream);">${item.assetName}</td>
          <td style="padding:7px 10px; font-size:12px; color:var(--text-mid); text-align:center;">${item.assetId}</td>
          <td style="padding:7px 10px; font-size:12px; color:#4caf7d; text-align:center; font-weight:600;">${gCount}</td>
          <td style="padding:7px 10px; font-size:12px; color:#e05c4e; text-align:center; font-weight:600;">${broken}</td>
          <td style="padding:7px 10px; font-size:12px; color:#f5a623; text-align:center; font-weight:600;">${missing}</td>
          <td style="padding:7px 10px; font-size:12px; color:#a3988b; text-align:center; font-weight:600;">${retired}</td>
        </tr>`;
      }).join('');
      itemTableHtml = `
        <div id="${uid}-body" style="display:none; border-top:1px solid var(--border); overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:rgba(0,0,0,0.2);">
                <th style="padding:8px 10px; font-size:11px; color:var(--text-dim); text-align:left; font-weight:600;">ITEM</th>
                <th style="padding:8px 10px; font-size:11px; color:var(--text-dim); text-align:center; font-weight:600;">ASSET ID</th>
                <th style="padding:8px 10px; font-size:11px; color:#4caf7d; text-align:center; font-weight:600;">GOOD</th>
                <th style="padding:8px 10px; font-size:11px; color:#e05c4e; text-align:center; font-weight:600;">BROKEN</th>
                <th style="padding:8px 10px; font-size:11px; color:#f5a623; text-align:center; font-weight:600;">MISSING</th>
                <th style="padding:8px 10px; font-size:11px; color:#a3988b; text-align:center; font-weight:600;">RETIRED</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } else {
      itemTableHtml = `<div id="${uid}-body" style="display:none; border-top:1px solid var(--border); padding:14px 22px; font-size:12px; color:var(--text-dim); font-style:italic;">No item-level detail available for this session.</div>`;
    }

    return `
      <div style="border-bottom:1px solid var(--border);">
        <div onclick="document.getElementById('${uid}-body').style.display = document.getElementById('${uid}-body').style.display === 'none' ? 'block' : 'none'; this.querySelector('.rc-hist-chevron').classList.toggle('open');"
             style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 22px; cursor:pointer; transition:background 0.15s;">
          <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
            <span class="rc-hist-chevron" style="font-size:11px; color:var(--text-dim); transition:transform 0.2s; display:inline-block;">▶</span>
            <div>
              <div style="font-size:13px; font-weight:700; color:var(--cream);">${log.id} <span style="color:var(--text-dim); font-weight:400; font-size:12px;">: ${dateStr}</span></div>
              <div style="font-size:12px; color:var(--text-mid); margin-top:3px;">Checked by: ${log.checkedBy} · ${log.totalItems} items · ${log.issuesFound} issue${log.issuesFound !== 1 ? 's' : ''} found · ${log.flagsCreated} flag${log.flagsCreated !== 1 ? 's' : ''} created</div>
              ${log.notes ? `<div style="font-size:11px; color:var(--text-dim); margin-top:3px; font-style:italic;">"${log.notes}"</div>` : ''}
            </div>
          </div>
          <span class="badge confirmed">Completed</span>
        </div>
        ${itemTableHtml}
      </div>`;
  }).join('');
}

// Add chevron open style
if (!document.getElementById('rc-hist-chevron-style')) {
  const s = document.createElement('style');
  s.id = 'rc-hist-chevron-style';
  s.textContent = '.rc-hist-chevron.open { transform: rotate(90deg); }';
  document.head.appendChild(s);
}

function showRcConfirmModal(title, msg, onConfirm) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#1f1914; border:1px solid rgba(196, 154, 60, 0.3); border-radius:12px; width:100%; max-width:320px; padding:24px; box-shadow:0 10px 40px rgba(0,0,0,0.8); text-align:center;';

  modal.innerHTML = `
    <div style="font-size:16px; font-weight:700; color:#f8f5f0; margin-bottom:8px;">${title}</div>
    <div style="font-size:13px; color:#a3988b; margin-bottom:24px; line-height:1.5;">${msg}</div>
    <div style="display:flex; gap:12px;">
      <button class="btn-outline" style="flex:1; justify-content:center; padding:10px; background:transparent; border:1px solid #c49a3c; color:#c49a3c; border-radius:6px; font-size:13px; cursor:pointer;" id="rc-modal-no">No</button>
      <button class="btn-primary" style="flex:1; justify-content:center; background:#e05c4e; color:#fff; border:none; padding:10px; border-radius:6px; font-size:13px; font-weight:700; cursor:pointer;" id="rc-modal-yes">Yes</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('rc-modal-no').onclick = () => overlay.remove();
  document.getElementById('rc-modal-yes').onclick = () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  };
}

// ====================================================================
// SESSION: Start, restore, expire
// ====================================================================
async function startNewRoutineCheck(isSilentLoad = false, forceReset = false) {
  // If clicked by user and there's already an active check, confirm first
  if (!forceReset && !isSilentLoad && activeRoutineCheck) {
    showRcConfirmModal(
      'Reset Routine Check?',
      'Are you sure you want to reset the current inspection? All unsaved progress will be lost.',
      () => startNewRoutineCheck(false, true)
    );
    return;
  }

  // Check for existing unexpired session
  const existing = getRcSession();
  if (existing && !forceReset) {
    const age = Date.now() - new Date(existing.startedAt).getTime();
    if (age < RC_EXPIRY_MS) {
      // Restore session
      const rentalItems = RENTED_EQUIPMENT
        .filter(r => r.trackingType === 'rental' || r.reservationId || r.forEvent)
        .map((r, i) => ({
          idx: EIM_ASSETS.length + i,
          assetId: r.id, assetName: r.name,
          category: (r.category || r.type || 'Rented') + ' (Rental)',
          quantity: r.quantity || 1, unitType: r.unitType || 'pcs',
          expectedCondition: r.condition || 'Good',
          supabaseId: null, checked: false, incidents: []
        }));
      activeRoutineCheck = {
        id: existing.id,
        date: existing.date,
        checkedBy: existing.startedBy || 'Admin',
        startedAt: existing.startedAt,
        items: EIM_ASSETS.map((a, i) => ({
          idx: i, assetId: a.id, assetName: a.name, category: a.category,
          quantity: a.total_qty || a.quantity || 1, unitType: a.unitType,
          expectedCondition: a.condition,
          supabaseId: null, checked: false, incidents: [],
          status: a.status
        })).filter(x => x.status !== 'Disabled').concat(rentalItems)
      };
      // Restore state from localStorage
      const saved = getRcCheckedItems();
      activeRoutineCheck.items.forEach(item => {
        const state = saved[item.assetId];
        if (state) {
          item.checked = true;
          item.incidents = state.incidents || [];
          item.supabaseId = state.routineCheckRowId || null;
          item.status = state.status || 'good';
        }
      });
      renderRoutineCheckSection();
      startSessionTimer();
      document.getElementById('routine-checklist-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    } else {
      // Expired : clean up
      await wipeSessionFromSupabase(existing.id);
      clearRcSession();
    }
  }

  // Create fresh session
  const sessionId = 'RCS-' + Date.now();
  const rentalChecklistItems = RENTED_EQUIPMENT
    .filter(r => r.trackingType === 'rental' || r.reservationId || r.forEvent)
    .map((r, i) => ({
      idx: EIM_ASSETS.length + i,
      assetId: r.id, assetName: r.name,
      category: (r.category || r.type || 'Rented') + ' (Rental)',
      quantity: r.quantity || 1, unitType: r.unitType || 'pcs',
      expectedCondition: r.condition || 'Good',
      supabaseId: null, checked: false, incidents: []
    }));
  const now = new Date().toISOString();
  // Use LOCAL date so timezone doesn't shift the date (e.g. UTC+8 at 2 AM = still today locally)
  const _localNow = new Date();
  const localDate = _localNow.getFullYear() + '-'
    + String(_localNow.getMonth() + 1).padStart(2, '0') + '-'
    + String(_localNow.getDate()).padStart(2, '0');
  activeRoutineCheck = {
    id: sessionId,
    date: localDate,
    checkedBy: 'Staff - ' + getStaffName(),
    startedAt: now,
    items: EIM_ASSETS.map((a, i) => ({
      idx: i, assetId: a.id, assetName: a.name, category: a.category,
      quantity: a.total_qty || a.quantity || 1, unitType: a.unitType,
      expectedCondition: a.condition,
      supabaseId: null, checked: false, incidents: [],
      status: a.status
    })).filter(x => x.status !== 'Disabled').concat(rentalChecklistItems)
  };
  saveRcSession({ id: sessionId, startedAt: now, date: localDate, startedBy: 'Staff' });
  saveRcCheckedItems({});
  // Notify scan pages a session has started
  try { new BroadcastChannel('rc_session_channel').postMessage({ type: 'RC_STARTED', session: { id: sessionId, startedAt: now } }); } catch(e) {}
  renderRoutineCheckSection();
  startSessionTimer();
  document.getElementById('routine-checklist-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ====================================================================
// SESSION TIMER: 48-hour countdown
// ====================================================================
function startSessionTimer() {
  clearInterval(_rcTimerInterval);
  const timerEl = document.getElementById('rc-session-timer');
  if (!timerEl) return;
  timerEl.style.display = 'inline';

  function tick() {
    const session = getRcSession();
    if (!session) { timerEl.style.display = 'none'; return; }
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    const remaining = RC_EXPIRY_MS - elapsed;
    if (remaining <= 0) {
      timerEl.textContent = 'Session expired';
      timerEl.classList.add('urgent');
      clearInterval(_rcTimerInterval);
      autoExpireSession();
      return;
    }
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    timerEl.textContent = `${pad(h)}:${pad(m)}:${pad(s)} remaining`;
    timerEl.classList.toggle('urgent', remaining < 3600000); // red when < 1 hour
  }
  tick();
  _rcTimerInterval = setInterval(tick, 1000);
}

async function autoExpireSession() {
  const session = getRcSession();
  if (!session) return;
  await wipeSessionFromSupabase(session.id);
  clearRcSession();
  activeRoutineCheck = null;
  clearInterval(_rcTimerInterval);
  renderRoutineCheckSection();
}

async function checkAndExpireSession() {
  const session = getRcSession();
  if (!session) return;
  const age = Date.now() - new Date(session.startedAt).getTime();
  if (age >= RC_EXPIRY_MS) {
    await wipeSessionFromSupabase(session.id);
    clearRcSession();
  } else if (!activeRoutineCheck) {
    // Silently restore session on page load
    startNewRoutineCheck(true);
  }
}

async function wipeSessionFromSupabase(sessionId) {
  const sb = rcSupabase();
  if (!sb || !sessionId) return;
  // Fetch all rows for this session
  const { data } = await sb.from('routine_check').select('id, notes, asset_id').like('notes', `SESSION:${sessionId}%`);
  if (data && data.length) {
    const ids = data.map(r => r.id);
    await sb.from('routine_check').delete().in('id', ids);
  }

  // Revert equipment_inventory counts for any items that had incidents
  const checked = getRcCheckedItems();
  const revertPromises = Object.entries(checked).map(async ([assetId, state]) => {
    if (!state._eqId || state._origGood == null) return;
    try {
      await sb.from('equipment_inventory').update({
        good_qty: state._origGood, maintenance_qty: state._origMaint,
        missing_qty: state._origMiss, retired_qty: state._origRet,
        available_qty: state._origGood
      }).eq('id', state._eqId);
      const eimEntry = (window.EIM_ASSETS || []).find(a => a.id === state._eqId);
      if (eimEntry) {
        eimEntry.good_qty = state._origGood; eimEntry.maintenance_qty = state._origMaint;
        eimEntry.missing_qty = state._origMiss; eimEntry.retired_qty = state._origRet;
        eimEntry.available_qty = state._origGood;
      }
    } catch (e) { console.warn('[RC Wipe] revert failed for', assetId, e); }
  });
  await Promise.all(revertPromises);
}

var rcFilterCategory = 'All';

function toggleRoutineCheckBody(e) {
  // Prevent toggle if clicking on buttons
  if (e && e.target && e.target.closest('button')) return;
  const body = document.getElementById('routine-check-body');
  const icon = document.getElementById('rc-toggle-icon');
  if (body) {
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (icon) {
      icon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    }
  }
}

window.setRcFilter = function (cat) {
  rcFilterCategory = cat;
  renderActiveChecklist();
};

window.addEventListener('storage', function (e) {
  if (e.key === 'rc_checked_items' && activeRoutineCheck) {
    const saved = getRcCheckedItems();
    activeRoutineCheck.items.forEach(item => {
      const state = saved[item.assetId];
      if (state) {
        item.checked = true;
        item.incidents = state.incidents || [];
        item.supabaseId = state.routineCheckRowId || null;
        item.status = state.status || 'good';
      } else {
        item.checked = false;
        item.incidents = [];
        item.supabaseId = null;
        item.status = null;
      }
    });
    renderActiveChecklist();
  }
});

// ====================================================================
// RENDER: Checklist rows
// ====================================================================
function renderActiveChecklist() {
  const container = document.getElementById('routine-checklist-items');
  const filterBar = document.getElementById('rc-filter-bar');
  if (!container || !activeRoutineCheck) return;

  const checked = activeRoutineCheck.items.filter(i => i.checked).length;
  const total = activeRoutineCheck.items.length;
  const progEl = document.getElementById('routine-check-progress');
  if (progEl) progEl.textContent = `${checked} / ${total} items marked`;

  // Build filter bar
  if (filterBar) {
    const categories = new Set();
    activeRoutineCheck.items.forEach(i => categories.add(i.category || 'Uncategorized'));
    const sortedCats = Array.from(categories).sort();

    let html = `<button class="rc-filter-btn ${rcFilterCategory === 'All' ? 'active' : ''}" onclick="setRcFilter('All')">All</button>`;
    sortedCats.forEach(c => {
      html += `<button class="rc-filter-btn ${rcFilterCategory === c ? 'active' : ''}" onclick="setRcFilter('${c}')">${c}</button>`;
    });
    // Mark All as Okay button on the right
    const allGood = activeRoutineCheck.items.every(i => i.checked && i.status === 'good');
    html += `<button class="rc-filter-btn" id="btn-mark-all-okay" onclick="markAllItemsOkay()" style="margin-left:auto;background:var(--green);color:#fff;border:2px solid var(--green);font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;"><i class="${allGood ? 'fas fa-undo' : 'fas fa-check-double'}"></i> ${allGood ? 'Unmark All' : 'Mark All as Okay'}</button>`;
    filterBar.innerHTML = html;
  }

  // Filter items
  let displayItems = activeRoutineCheck.items;
  if (rcFilterCategory !== 'All') {
    displayItems = displayItems.filter(i => (i.category || 'Uncategorized') === rcFilterCategory);
  }

  container.innerHTML = displayItems.map(item => {
    const i = item.idx; // Preserve original index for logic
    const isOk = item.checked && item.status === 'good';
    const hasIncident = item.checked && item.status === 'incident';

    // Auto-compute allocations for this asset
    const allocCount = countAllocationsForEquip(item.assetId);

    const incidentPanelOpen = hasIncident ? 'open' : '';
    let incidentEntries = '';
    if (hasIncident && item.incidents) {
      const usedTypes = item.incidents.map(inc => inc.type === 'trash' || inc.type === 'retired' ? 'trash' : inc.type);
      item.incidents.forEach((inc, incIdx) => {
        const myType = inc.type === 'trash' || inc.type === 'retired' ? 'trash' : inc.type;
        const otherUsed = usedTypes.filter((_, k) => k !== incIdx);
        const disabledBroken = otherUsed.includes('broken') ? 'disabled' : '';
        const disabledMissing = otherUsed.includes('missing') ? 'disabled' : '';
        const disabledTrash = otherUsed.includes('trash') ? 'disabled' : '';
        incidentEntries += `
          <div class="ri-incident-entry-group" id="ri-inc-entry-${i}-${incIdx}" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px dashed rgba(196,154,60,0.2);">
            <div style="display:flex; align-items:center; gap:8px; width:100%;">
              <select class="rc-input" style="flex:1; min-width:120px;" onchange="updateRcIncidentField(${i}, ${incIdx}, 'type', this.value)">
                <option value="broken" ${myType === 'broken' ? 'selected' : ''} ${disabledBroken}>Broken / Damaged</option>
                <option value="missing" ${myType === 'missing' ? 'selected' : ''} ${disabledMissing}>Missing</option>
                <option value="trash" ${myType === 'trash' ? 'selected' : ''} ${disabledTrash}>Retired / Disposed</option>
              </select>
              <div style="display:flex;align-items:center;gap:6px;">
                <input type="number" class="rc-input" style="width:60px;text-align:center;" min="1" value="${inc.qty || 1}" onchange="updateRcIncidentField(${i}, ${incIdx}, 'qty', this.value)" />
                <button onclick="triggerStaffRcIncUpload(${i},${incIdx})" style="background:rgba(196,154,60,0.12);border:1px solid rgba(196,154,60,0.3);color:var(--gold);border-radius:5px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;" id="stf-inc-ubtn-${i}-${incIdx}">${inc.imageUrl ? 'Replace' : 'Upload'}</button>
                <input type="file" id="stf-inc-file-${i}-${incIdx}" accept="image/*" style="display:none;" onchange="handleStaffRcIncFileChange(${i},${incIdx},this)" />
              </div>
              <button class="ri-inc-remove" style="font-size: 18px; font-weight: bold; flex-shrink:0; width:32px; height:32px; display:flex; align-items:center; justify-content:center;" onclick="removeRcIncident(${i}, ${incIdx})" title="Remove">&times;</button>
            </div>
            <div id="stf-inc-thumb-${i}-${incIdx}" style="display:${inc.imageUrl ? 'flex' : 'none'}; justify-content:center; align-items:center; width:100%; margin-top:6px;">
              ${inc.imageUrl ? `<img src="${inc.imageUrl}" alt="Incident Photo" style="max-width:280px; max-height:200px; width:auto; height:auto; object-fit:contain; border-radius:8px; border:1px solid rgba(196,154,60,0.4); box-shadow:0 4px 12px rgba(0,0,0,0.25);" />` : ''}
            </div>
          </div>
        `;
      });
    }

    return `
      <div class="ri-row ${isOk ? 'ri-checked' : ''} ${hasIncident ? 'ri-has-incident' : ''}" id="ri-row-${i}">
        
        <div class="ri-item-info">
          <div class="ri-asset-id">${item.assetId}</div>
          <div class="ri-asset-name">${item.assetName}</div>
          <div class="ri-asset-cat">${item.category || 'Uncategorized'}</div>
        </div>

        <div class="ri-stats">
          <div class="ri-stat-line"><strong>${item.quantity || ':'} ${item.unitType || 'pcs'}</strong></div>
          <div class="ri-stat-line">Expected: <strong>${item.expectedCondition || 'Good'}</strong></div>
          <div class="ri-stat-line">Allocated to: <strong>${allocCount} event${allocCount !== 1 ? 's' : ''}</strong></div>
        </div>

        <div class="ri-controls">
          <div class="ri-ctrl-row">
            <label class="ri-ok-label ${isOk ? 'is-checked' : ''}" id="ri-ok-label-${i}">
              <input type="checkbox" id="ri-ok-chk-${i}" ${isOk ? 'checked' : ''} ${hasIncident ? 'disabled' : ''}
                onchange="markItemOkay(${i}, this.checked)" />
              Mark as Okay
            </label>
            <button class="ri-incident-btn ${hasIncident ? 'has-reports' : ''} ${incidentPanelOpen}" 
              id="ri-inc-btn-${i}" onclick="toggleRcIncidentPanel(${i})" ${isOk ? 'disabled' : ''}>
              ${hasIncident ? `Incident (${item.incidents.length})` : 'Report Incident'}
            </button>
            <button class="ri-qr-btn" onclick="window.open('scan.html?eq='+encodeURIComponent('${item.assetId}'),'_blank')" title="Scan with camera">
              <i class="fas fa-camera"></i> Scan
            </button>
          </div>
        </div>
        
        <div class="ri-incident-panel ${incidentPanelOpen}" id="ri-inc-panel-${i}">
          <div id="ri-inc-entries-${i}">${incidentEntries}</div>
          <button class="ri-add-inc-btn" onclick="addRcIncident(${i})">+ Add Another</button>
        </div>
      </div>`;
  }).join('');
}

// ====================================================================
// ITEM ACTIONS: OK, incident, auto-save
// ====================================================================

function toggleRICheck(i) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[i];
  item.checked = !item.checked;
  renderActiveChecklist();
}

async function markItemOkay(i, checked) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[i];

  if (checked) {
    // Cannot mark ok if incidents exist
    if (item.incidents && item.incidents.length > 0) {
      document.getElementById(`ri-ok-chk-${i}`).checked = false;
      return;
    }
    item.checked = true;
    item.incidents = [];
    item.status = 'good';
    await autoSaveItem(i);
  } else {
    // Uncheck : remove from Supabase
    item.checked = false;
    item.status = null;
    await deleteItemSave(i);
  }
  renderActiveChecklist();
}

async function toggleRcIncidentPanel(i) {
  const panel = document.getElementById(`ri-inc-panel-${i}`);
  const btn = document.getElementById(`ri-inc-btn-${i}`);
  if (!panel) return;
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    btn && btn.classList.remove('open');
  } else {
    const item = activeRoutineCheck.items[i];
    // Uncheck OK if incident panel is being opened
    if (item.status === 'good') {
      item.checked = false;
      item.status = null;
      await deleteItemSave(i);
    }
    // Seed a default incident row if none exist
    if (!item.incidents || item.incidents.length === 0) {
      item.incidents = [{ type: 'broken', qty: 1 }];
    }
    // Mark as incident so renderActiveChecklist shows the entries
    item.checked = true;
    item.status = 'incident';
    renderActiveChecklist();
    // Re-open the panel after re-render
    const panelAfter = document.getElementById(`ri-inc-panel-${i}`);
    if (panelAfter) panelAfter.classList.add('open');
    const btnAfter = document.getElementById(`ri-inc-btn-${i}`);
    if (btnAfter) btnAfter.classList.add('open');
  }
}

function addRcIncident(i) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[i];
  if (!item.incidents) item.incidents = [];
  const allTypes = ['broken', 'missing', 'trash'];
  const usedTypes = item.incidents.map(inc => inc.type === 'retired' ? 'trash' : inc.type);
  const nextType = allTypes.find(t => !usedTypes.includes(t));
  if (!nextType) return;
  item.incidents.push({ type: nextType, qty: 1, imageUrl: null, imagePublicId: null, imageDeleteToken: null });
  item.checked = true;
  item.status = 'incident';
  renderActiveChecklist();
  const panel = document.getElementById(`ri-inc-panel-${i}`);
  if (panel) panel.classList.add('open');
  const btn = document.getElementById(`ri-inc-btn-${i}`);
  if (btn) btn.classList.add('open');
  autoSaveItem(i);
}

// ====== STAFF INCIDENT IMAGE UPLOAD HELPERS ======
const CLOUDINARY_CLOUD_NAME_STF = 'dg8ytmck5';
const CLOUDINARY_UPLOAD_PRESET_STF = 'test_default';

function triggerStaffRcIncUpload(itemIdx, incIdx) {
  const inp = document.getElementById(`stf-inc-file-${itemIdx}-${incIdx}`);
  if (inp) inp.click();
}
window.triggerStaffRcIncUpload = triggerStaffRcIncUpload;

async function handleStaffRcIncFileChange(itemIdx, incIdx, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const btn = document.getElementById(`stf-inc-ubtn-${itemIdx}-${incIdx}`);
  const thumbEl = document.getElementById(`stf-inc-thumb-${itemIdx}-${incIdx}`);
  if (btn) { btn.textContent = 'Uploading...'; btn.disabled = true; }
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET_STF);
    fd.append('folder', 'incident_photos');
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME_STF}/image/upload`;
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    const data = await res.json();
    if (activeRoutineCheck) {
      const item = activeRoutineCheck.items[itemIdx];
      if (item && item.incidents && item.incidents[incIdx]) {
        item.incidents[incIdx].imageUrl = data.secure_url;
        item.incidents[incIdx].imagePublicId = data.public_id;
        item.incidents[incIdx].imageDeleteToken = data.delete_token || null;
      }
    }
    if (thumbEl) {
      thumbEl.style.display = 'flex';
      thumbEl.innerHTML = `<img src="${data.secure_url}" alt="Incident Photo" style="max-width:280px; max-height:200px; width:auto; height:auto; object-fit:contain; border-radius:8px; border:1px solid rgba(196,154,60,0.4); box-shadow:0 4px 12px rgba(0,0,0,0.25);" />`;
    }
    if (btn) { btn.textContent = 'Replace'; btn.disabled = false; }
    autoSaveItem(itemIdx);
  } catch (e) {
    if (btn) { btn.textContent = 'Upload'; btn.disabled = false; }
    alert('Upload failed: ' + e.message);
  }
}
window.handleStaffRcIncFileChange = handleStaffRcIncFileChange;

function removeRcIncident(i, j) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[i];
  item.incidents.splice(j, 1);
  if (item.incidents.length === 0) {
    item.checked = false;
    item.status = null;
    deleteItemSave(i);
  } else {
    autoSaveItem(i);
  }
  renderActiveChecklist();
  const panel = document.getElementById(`ri-inc-panel-${i}`);
  if (panel && item.incidents.length > 0) panel.classList.add('open');
}

function updateRcIncidentField(i, j, field, value) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[i];
  if (!item.incidents || !item.incidents[j]) return;
  if (field === 'qty') {
    value = Math.min(Math.max(1, value), item.quantity || 9999);
  }
  item.incidents[j][field] = value;
  item.checked = true;
  item.status = 'incident';
  if (field === 'type') refreshRcIncidentTypeOptions(i);
  autoSaveItem(i);
}

// ====================================================================
// SUPABASE AUTO-SAVE
// ====================================================================
async function autoSaveItem(i) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[i];
  const checked = getRcCheckedItems();
  checked[item.assetId] = {
    status: item.incidents && item.incidents.length > 0 ? 'incident' : 'good',
    incidents: item.incidents || [],
    routineCheckRowId: item.supabaseId || null
  };
  saveRcCheckedItems(checked);

  // Flash saved dot
  const row = document.getElementById(`ri-row-${i}`);
  if (row) {
    let dot = row.querySelector('.ri-saved-dot');
    if (!dot) { dot = document.createElement('span'); dot.className = 'ri-saved-dot'; row.appendChild(dot); }
    dot.classList.add('show');
    setTimeout(() => dot.classList.remove('show'), 1500);
  }
}

async function deleteItemSave(i) {
  const item = activeRoutineCheck?.items[i];
  if (!item) return;
  const checked = getRcCheckedItems();
  delete checked[item.assetId];
  saveRcCheckedItems(checked);
}

// ====================================================================
// CANCEL & SUBMIT
// ====================================================================
async function cancelRoutineCheck() {
  showRcConfirmModal(
    'Cancel Inspection?',
    'Are you sure you want to cancel this inspection? All saved progress for this session will be removed.',
    async () => {
      clearInterval(_rcTimerInterval);
      const session = getRcSession();
      // Clean up any uploaded incident images
      if (activeRoutineCheck) {
        activeRoutineCheck.items.forEach(item => {
          if (item.incidents) item.incidents.forEach(inc => {
            if (inc.imageDeleteToken) {
              const fd = new FormData(); fd.append('token', inc.imageDeleteToken);
              fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME_STF}/delete_by_token`, { method: 'POST', body: fd }).catch(() => {});
            }
          });
        });
      }
      if (session) await wipeSessionFromSupabase(session.id);
      const sbRc2 = rcSupabase();
      if (sbRc2) { (async () => { try { await sbRc2.from('routine_check').delete().eq('asset_id', 'SESSION-ACTIVE'); } catch (e) { } })(); }
      clearRcSession();
      activeRoutineCheck = null;
      // Notify scan pages
      try { new BroadcastChannel('rc_session_channel').postMessage({ type: 'RC_ENDED' }); } catch(e) {}
      renderRoutineCheckSection();
    }
  );
}

// Refresh disabled states on all incident type selects for item i after any change
function refreshRcIncidentTypeOptions(itemIdx) {
  if (!activeRoutineCheck) return;
  const item = activeRoutineCheck.items[itemIdx];
  if (!item || !item.incidents) return;
  const usedTypes = item.incidents.map(inc => inc.type === 'retired' ? 'trash' : inc.type);
  item.incidents.forEach((inc, incIdx) => {
    const sel = document.getElementById(`ri-inc-entry-${itemIdx}-${incIdx}`)?.querySelector('select');
    if (!sel) return;
    const myType = inc.type === 'retired' ? 'trash' : inc.type;
    Array.from(sel.options).forEach(opt => {
      opt.disabled = opt.value !== myType && usedTypes.includes(opt.value);
    });
  });
}
window.refreshRcIncidentTypeOptions = refreshRcIncidentTypeOptions;

window.startNewRoutineCheck = startNewRoutineCheck;
window.cancelRoutineCheck = cancelRoutineCheck;
window.toggleRICheck = toggleRICheck;
window.markItemOkay = markItemOkay;

// Toggle Mark All as Okay / Unmark All
async function markAllItemsOkay() {
  if (!activeRoutineCheck) return;
  const allGood = activeRoutineCheck.items.every(i => i.checked && i.status === 'good');
  const allItems = activeRoutineCheck.items;

  if (allGood) {
    // Unmark all items
    for (let idx = 0; idx < allItems.length; idx++) {
      const item = allItems[idx];
      item.checked = false;
      item.status = null;
      item.incidents = [];
    }
    saveRcCheckedItems({});
    renderActiveChecklist();
    showToast('Unmarked all items');
  } else {
    // Mark all as okay
    const checked = getRcCheckedItems();
    for (let idx = 0; idx < allItems.length; idx++) {
      const item = allItems[idx];
      if (item.incidents && item.incidents.length > 0) continue;
      item.checked = true;
      item.incidents = [];
      item.status = 'good';
      checked[item.assetId] = { status: 'good', incidents: [] };
    }
    saveRcCheckedItems(checked);
    renderActiveChecklist();
    showToast('All items marked as okay!');
  }
}
window.markAllItemsOkay = markAllItemsOkay;

async function submitRoutineCheck(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!activeRoutineCheck) return;
  const unchecked = activeRoutineCheck.items.filter(i => !i.checked);
  if (unchecked.length > 0) {
    const names = unchecked.slice(0, 3).map(i => i.assetName).join(', ');
    const more = unchecked.length > 3 ? ` and ${unchecked.length - 3} more` : '';
    alert(`Cannot submit : ${unchecked.length} item${unchecked.length > 1 ? 's' : ''} not yet checked:\n${names}${more}\n\nPlease mark all equipment before submitting.`);
    return;
  }

  const sb = rcSupabase();
  const ses = getRcSession();

  let flagsCreated = 0;
  let issuesFound = 0;

  // Build per-item breakdown and commit saves to Supabase + equipment_inventory
  const itemBreakdown = await Promise.all(activeRoutineCheck.items.map(async (item) => {
    const asset = (window.EIM_ASSETS || []).find(a => a.assetId === item.assetId || a.id === item.assetId || a.supabaseId === item.assetId);
    const totalPcs = parseInt(item.quantity || asset?.quantity || asset?.total_qty || asset?.good_qty || 1);

    let brokenQty = 0, missingQty = 0, retiredQty = 0;
    if (item.incidents && item.incidents.length > 0) {
      issuesFound++;
      item.incidents.forEach(inc => {
        const q = parseInt(inc.qty) || 0;
        const t = (inc.type || '').toLowerCase();
        if (t === 'broken' || t === 'damaged') brokenQty += q;
        else if (t === 'missing') missingQty += q;
        else if (t === 'trash' || t === 'retired') retiredQty += q;
        else brokenQty += q;
      });

      const alreadyFlagged = EQUIPMENT_FLAGS.find(f => f.assetId === item.assetId && f.status === 'Flagged');
      if (!alreadyFlagged) {
        EQUIPMENT_FLAGS.push({
          id: 'FLAG-' + String(EQUIPMENT_FLAGS.length + 1).padStart(3, '0'),
          assetId: item.assetId, assetName: item.assetName,
          issue: `Routine check (${activeRoutineCheck.id}): ${item.incidents.map(inc => inc.type + ' x' + inc.qty).join(', ')}`,
          flagType: 'damage', severity: 'High',
          reportedDate: activeRoutineCheck.date,
          reportedBy: activeRoutineCheck.checkedBy + ' (Routine Check)',
          status: 'Flagged'
        });
        flagsCreated++;
      }
    }

    const goodQty = Math.max(0, totalPcs - brokenQty - missingQty - retiredQty);

    // Save individual item routine check row to Supabase on Submit
    if (sb) {
      try {
        // Resolve UUID: in staff.js EIM_ASSETS are raw Supabase rows so 'id' is the UUID
        let eqId = asset?.supabaseId || asset?.id || null;
        // Validate it looks like a UUID (not an asset_id text like 'EQ-0011')
        if (eqId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eqId)) {
          eqId = null;
        }
        if (!eqId) {
          // Fallback: look up UUID directly from DB by asset_id text
          const { data: eqRow } = await sb.from('equipment_inventory')
            .select('id, good_qty, maintenance_qty, missing_qty, retired_qty')
            .ilike('asset_id', item.assetId)
            .maybeSingle();
          if (eqRow) eqId = eqRow.id;
        }

        // CRITICAL: only insert if we have a valid UUID — equipment_id is NOT NULL + FK
        if (eqId) {
          const payload = {
            equipment_id: eqId,
            asset_id: item.assetId,
            equipment_name: item.assetName,
            checked_by: activeRoutineCheck.checkedBy || 'Staff',
            checked_at: new Date().toISOString(),
            status: item.incidents && item.incidents.length > 0 ? 'incident' : 'good',
            incidents: item.incidents && item.incidents.length > 0 ? item.incidents.map(inc => ({ type: inc.type, qty: inc.qty, imageUrl: inc.imageUrl || null })) : null,
            notes: 'Routine check : ' + activeRoutineCheck.id,
            quantity: totalPcs,
            good_qty: goodQty,
            incident_image_url: item.incidents ? (item.incidents.find(inc => inc.imageUrl)?.imageUrl || null) : null,
            incident_image_public_id: item.incidents ? (item.incidents.find(inc => inc.imagePublicId)?.imagePublicId || null) : null
          };
          await sb.from('routine_check').insert(payload);

          // Update equipment inventory quantities in Supabase if incidents were logged
          if (brokenQty > 0 || missingQty > 0 || retiredQty > 0) {
            const curGood = asset?.good_qty ?? totalPcs;
            const curMaint = asset?.maintenance_qty ?? 0;
            const curMiss = asset?.missing_qty ?? 0;
            const curRet = asset?.retired_qty ?? 0;
            const newGood = Math.max(0, curGood - (brokenQty + missingQty + retiredQty));
            const newMaint = curMaint + brokenQty;
            const newMiss = curMiss + missingQty;
            const newRet = curRet + retiredQty;
            await sb.from('equipment_inventory').update({
              good_qty: newGood,
              maintenance_qty: newMaint,
              missing_qty: newMiss,
              retired_qty: newRet,
              available_qty: newGood
            }).eq('id', eqId);
            if (asset) {
              asset.good_qty = newGood;
              asset.maintenance_qty = newMaint;
              asset.missing_qty = newMiss;
              asset.retired_qty = newRet;
              asset.available_qty = newGood;
            }
          }
        } else {
          console.warn('[RC Submit] Skipping DB save for', item.assetId, '— no valid UUID found');
        }
      } catch (err) {
        console.warn('[RC Submit] DB save error for item', item.assetId, err);
      }
    }

    return { assetId: item.assetId, assetName: item.assetName, quantity: totalPcs, goodQty, brokenQty, missingQty, retiredQty };
  }));

  const logEntry = {
    id: activeRoutineCheck.id,
    date: activeRoutineCheck.date,
    checkedBy: activeRoutineCheck.checkedBy,
    totalItems: activeRoutineCheck.items.length,
    issuesFound,
    flagsCreated,
    notes: flagsCreated > 0 ? `${flagsCreated} flag${flagsCreated > 1 ? 's' : ''} auto-created.` : 'No issues found.',
    status: 'Completed',
    itemBreakdown
  };

  // Upsert into in-memory array & local storage
  const existingIdx = ROUTINE_CHECK_LOGS.findIndex(l => l.id === logEntry.id);
  if (existingIdx >= 0) ROUTINE_CHECK_LOGS.splice(existingIdx, 1);
  ROUTINE_CHECK_LOGS.push(logEntry);

  const existingSaved = getRcSavedLogs().filter(l => l.id !== logEntry.id);
  existingSaved.push(logEntry);
  saveRcSavedLogs(existingSaved);

  // NOTE: MASTER-LOG is NOT saved to Supabase — equipment_id is NOT NULL + FK constraint.
  // History is reconstructed from individual item rows by fetchSupabaseScanLogs().
  lastRoutineCheckDate = activeRoutineCheck.date;
  localStorage.setItem('rc_last_check_date', lastRoutineCheckDate);

  clearInterval(_rcTimerInterval);
  clearRcSession();
  activeRoutineCheck = null;
  updateRoutineAlertBanner();
  if (typeof renderEIMStats === 'function') renderEIMStats();
  if (typeof renderStaffEquipStats === 'function') renderStaffEquipStats();
  // Notify scan pages that check ended
  try { new BroadcastChannel('rc_session_channel').postMessage({ type: 'RC_ENDED' }); } catch(e) {}
  renderRoutineCheckSection();

  const timerEl = document.getElementById('rc-session-timer');
  if (timerEl) timerEl.style.display = 'none';

  if (flagsCreated > 0) {
    alert('Routine check submitted. ' + flagsCreated + ' new issue flag' + (flagsCreated > 1 ? 's were' : ' was') + ' created.');
  } else {
    alert('Routine check completed : no critical issues found.');
  }
}
window.submitRoutineCheck = submitRoutineCheck;

function updateRICondition(i, val) {
  if (!activeRoutineCheck) return;
  activeRoutineCheck.items[i].foundCondition = val;
}

function updateRINotes(i, val) {
  if (!activeRoutineCheck) return;
  activeRoutineCheck.items[i].notes = val;
}

function forceRoutineCheck() {
  showSection('routine-check', document.getElementById('nav-routine-check'));
  setTimeout(() => {
    if (!activeRoutineCheck) startNewRoutineCheck();
    document.getElementById('routine-checklist-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}
window.forceRoutineCheck = forceRoutineCheck;



if (!window.EIM_ASSETS || !window.EIM_ASSETS.length) {
  window.EIM_ASSETS = (typeof EIM_ASSETS !== 'undefined' && Array.isArray(EIM_ASSETS) && EIM_ASSETS.length) ? EIM_ASSETS : [];
}
if (!window.RENTED_EQUIPMENT) {
  window.RENTED_EQUIPMENT = [];
}

async function loadRoutineChecks() {
  if (window.supabaseClient && (!window.EIM_ASSETS || window.EIM_ASSETS.length === 0)) {
    // Fetch equipment inventory to populate EIM_ASSETS with complete quantity tracking
    const { data: eqData } = await window.supabaseClient.from('equipment_inventory').select('*').order('name');
    if (eqData) {
      window.EIM_ASSETS = eqData.map((row, idx) => ({
        id: row.asset_id || `EQ-${String(idx + 1).padStart(4, '0')}`,
        asset_id: row.asset_id || `EQ-${String(idx + 1).padStart(4, '0')}`,
        assetId: row.asset_id || `EQ-${String(idx + 1).padStart(4, '0')}`,
        supabaseId: row.id,
        name: String(row.name || 'Unnamed'),
        category: String(row.category || 'Uncategorized'),
        type: String(row.type || 'General'),
        quantity: parseInt(row.total_qty) || 1,
        total_qty: parseInt(row.total_qty) || 1,
        good_qty: row.good_qty != null ? parseInt(row.good_qty) : (row.available_qty != null ? parseInt(row.available_qty) : (parseInt(row.total_qty) || 1)),
        maintenance_qty: parseInt(row.maintenance_qty) || 0,
        missing_qty: parseInt(row.missing_qty) || 0,
        retired_qty: parseInt(row.retired_qty) || 0,
        unitType: row.unit_type || 'pcs',
        condition: String(row.condition || 'Good'),
        status: String(row.status || 'available')
      }));
    }
    // Note: If you have a separate rentals table, you can fetch it here.
    // Assuming staff doesn't need to track rented equipment in this basic port,
    // window.RENTED_EQUIPMENT remains empty to prevent ReferenceErrors.
  }

  // Then render section
  renderRoutineCheckSection();
  refreshRoutineHistory().then(() => {
    renderRoutineHistory();
  });
}


// ====================================================================
// SHARED SESSIONS REALTIME SYNC
// ====================================================================
window._rcRealtimeChannel = null;

async function initSharedRcSessions() {
  const sb = window.supabaseClient;
  if (!sb) return;

  // 1. Fetch active session on load
  try {
    const { data } = await sb.from('routine_check_sessions').select('*').eq('status', 'active').limit(1);
    if (data && data.length > 0) {
      const remote = data[0];
      const localS = getRcSession();
      // If we don't have it locally, or it's a different session, or we just want to ensure we're in sync
      if (!localS || localS.id !== remote.id) {
        localStorage.setItem(RC_SESSION_KEY, JSON.stringify({
          id: remote.id,
          startedAt: remote.started_at,
          startedBy: remote.started_by
        }));
        if (remote.items_state) {
          localStorage.setItem(RC_ITEMS_KEY, JSON.stringify(remote.items_state));
        }
        if (typeof renderRoutineCheckSection === 'function') renderRoutineCheckSection();
        if (typeof startSessionTimer === 'function') startSessionTimer();
      }
    } else {
      // No active session remotely. If we have one locally, clear it.
      const localS = getRcSession();
      if (localS) {
        localStorage.removeItem(RC_SESSION_KEY);
        localStorage.removeItem(RC_ITEMS_KEY);
        if (typeof renderRoutineCheckSection === 'function') renderRoutineCheckSection();
      }
    }
  } catch (e) { console.error('Failed to fetch shared RC session:', e); }

  // 2. Subscribe to changes
  if (!window._rcRealtimeChannel) {
    window._rcRealtimeChannel = sb.channel('shared-rc-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routine_check_sessions' }, payload => {
        const localS = getRcSession();
        
        if (payload.eventType === 'DELETE') {
          if (localS && localS.id === payload.old.id) {
            localStorage.removeItem(RC_SESSION_KEY);
            localStorage.removeItem(RC_ITEMS_KEY);
            if (typeof renderRoutineCheckSection === 'function') renderRoutineCheckSection();
          }
        } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const remote = payload.new;
          if (remote.status !== 'active') {
             if (localS && localS.id === remote.id) {
               localStorage.removeItem(RC_SESSION_KEY);
               localStorage.removeItem(RC_ITEMS_KEY);
               if (typeof renderRoutineCheckSection === 'function') renderRoutineCheckSection();
             }
             return;
          }

          // It's active. Let's sync to localStorage without triggering an infinite loop
          // (We use localStorage.setItem directly)
          localStorage.setItem(RC_SESSION_KEY, JSON.stringify({
            id: remote.id,
            startedAt: remote.started_at,
            startedBy: remote.started_by
          }));
          if (remote.items_state) {
            localStorage.setItem(RC_ITEMS_KEY, JSON.stringify(remote.items_state));
          }
          if (typeof renderRoutineCheckSection === 'function') renderRoutineCheckSection();
          if (typeof startSessionTimer === 'function') startSessionTimer();
        }
      })
      .subscribe();
  }
}

// Call on load and also add a small delay in case Supabase isn't initialized yet
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initSharedRcSessions, 1500);
});

// ===== REAL-TIME ACCOUNT DEACTIVATION WATCHDOG =====
function startStaffDeactivationWatchdog() {
  if (window._staffDeactWatchdogStarted) return;
  window._staffDeactWatchdogStarted = true;

  const checkStaffStatus = async () => {
    if (document.hidden) return;
    try {
      const loggedInStr = sessionStorage.getItem('halden_staff') || localStorage.getItem('halden_staff');
      if (!loggedInStr) return;
      const loggedInUser = JSON.parse(loggedInStr);
      const uid = loggedInUser.id || loggedInUser.user_id;
      if (!uid || !window.supabaseClient) return;

      const { data, error } = await window.supabaseClient
        .from('users')
        .select('status')
        .eq('id', uid)
        .maybeSingle();

      if (!error && data && data.status && data.status.toLowerCase() === 'inactive') {
        alert('Your account has been deactivated by an administrator. You will now be logged out.');
        if (typeof adminLogout === 'function') {
          adminLogout();
        } else {
          sessionStorage.clear();
          localStorage.removeItem('halden_staff');
          window.location.href = 'index.html';
        }
      }
    } catch (e) {
      // Ignore background network errors
    }
  };

  setInterval(checkStaffStatus, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkStaffStatus();
  });
}
startStaffDeactivationWatchdog();

// ================================================================
// ===== HAL'SERVE IN-APP QR SCANNER & AUTO-REDIRECT (STAFF) =====
// ================================================================
let staffQRStream = null;
let staffQRScanAnimId = null;
let staffQRFacingMode = 'environment';
let staffQRTorchActive = false;
let staffQRIsScanning = false;

window.openStaffQRScanner = async function() {
  const modal = document.getElementById('staff-qr-modal');
  const video = document.getElementById('staff-qr-video');
  const statusEl = document.getElementById('staff-qr-status');
  const resultBox = document.getElementById('staff-qr-result-box');
  const reticle = document.getElementById('staff-qr-reticle');
  const torchBtn = document.getElementById('staff-qr-torch-btn');

  if (!modal || !video) return;

  // Reset visual feedback
  if (resultBox) resultBox.style.display = 'none';
  if (reticle) reticle.classList.remove('success');
  if (statusEl) statusEl.textContent = 'Starting camera...';
  if (torchBtn) torchBtn.style.display = 'none';
  staffQRTorchActive = false;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  await startStaffCameraFeed();
};

async function startStaffCameraFeed() {
  const video = document.getElementById('staff-qr-video');
  const statusEl = document.getElementById('staff-qr-status');
  const torchBtn = document.getElementById('staff-qr-torch-btn');

  // Stop any previous media stream
  stopStaffCameraTracks();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (statusEl) statusEl.textContent = 'Camera not supported in this browser. Please use image upload below.';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: staffQRFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    staffQRStream = stream;
    video.srcObject = stream;
    await video.play();

    if (statusEl) statusEl.textContent = 'Align QR code within frame';

    // Check if torch/flashlight is supported on active video track
    const track = stream.getVideoTracks()[0];
    if (track && typeof track.getCapabilities === 'function') {
      const caps = track.getCapabilities();
      if (caps && 'torch' in caps && torchBtn) {
        torchBtn.style.display = 'flex';
      }
    }

    // Begin scanning loop
    staffQRIsScanning = true;
    runStaffQRScanLoop();

  } catch (err) {
    console.warn('Staff QR camera access error:', err);
    if (statusEl) {
      statusEl.textContent = 'Camera access blocked or unavailable. Use upload image option below.';
    }
  }
}

function stopStaffCameraTracks() {
  if (staffQRScanAnimId) {
    cancelAnimationFrame(staffQRScanAnimId);
    staffQRScanAnimId = null;
  }
  staffQRIsScanning = false;
  if (staffQRStream) {
    staffQRStream.getTracks().forEach(track => {
      try { track.stop(); } catch(e) {}
    });
    staffQRStream = null;
  }
}

window.closeStaffQRScanner = function() {
  stopStaffCameraTracks();
  const modal = document.getElementById('staff-qr-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
};

window.switchStaffCameraFacing = async function() {
  staffQRFacingMode = (staffQRFacingMode === 'environment') ? 'user' : 'environment';
  await startStaffCameraFeed();
};

window.toggleStaffCameraTorch = async function() {
  if (!staffQRStream) return;
  const track = staffQRStream.getVideoTracks()[0];
  if (!track || typeof track.applyConstraints !== 'function') return;

  try {
    staffQRTorchActive = !staffQRTorchActive;
    await track.applyConstraints({
      advanced: [{ torch: staffQRTorchActive }]
    });
    const label = document.getElementById('staff-torch-label');
    if (label) label.textContent = staffQRTorchActive ? 'Torch: On' : 'Flashlight';
  } catch(e) {
    console.warn('Torch toggle failed:', e);
  }
};

window.handleStaffQRFileUpload = function(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, img.width, img.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let found = null;
      if (typeof jsQR === 'function') {
        found = jsQR(imgData.data, imgData.width, imgData.height);
      }

      if (found && found.data) {
        handleStaffQRRedirect(found.data);
      } else {
        alert('No readable QR code found in the selected image.');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

async function runStaffQRScanLoop() {
  if (!staffQRIsScanning) return;
  const video = document.getElementById('staff-qr-video');
  const canvas = document.getElementById('staff-qr-canvas');

  if (!video || video.readyState < 2) {
    staffQRScanAnimId = requestAnimationFrame(runStaffQRScanLoop);
    return;
  }

  let detectedData = null;

  // 1. Try Native BarcodeDetector first if supported in browser
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await detector.detect(video);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        detectedData = barcodes[0].rawValue;
      }
    } catch(e) {
      // Fall through to jsQR canvas processing
    }
  }

  // 2. Fallback to jsQR canvas inspection
  if (!detectedData && canvas && typeof jsQR === 'function') {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (width > 0 && height > 0) {
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, width, height);
      const imgData = ctx.getContext ? ctx.getImageData(0, 0, width, height) : null;
      if (imgData) {
        const code = jsQR(imgData.data, width, height, {
          inversionAttempts: 'dontInvert'
        });
        if (code && code.data) {
          detectedData = code.data;
        }
      }
    }
  }

  if (detectedData) {
    staffQRIsScanning = false;
    handleStaffQRRedirect(detectedData);
    return;
  }

  staffQRScanAnimId = requestAnimationFrame(runStaffQRScanLoop);
}

function handleStaffQRRedirect(scannedText) {
  const trimmed = (scannedText || '').trim();
  if (!trimmed) return;

  const reticle = document.getElementById('staff-qr-reticle');
  const statusEl = document.getElementById('staff-qr-status');
  const resultBox = document.getElementById('staff-qr-result-box');
  const resultText = document.getElementById('staff-qr-result-text');

  if (reticle) reticle.classList.add('success');
  if (statusEl) statusEl.textContent = 'QR Code detected!';
  if (resultBox) resultBox.style.display = 'block';
  if (resultText) resultText.textContent = trimmed;

  // Haptic feedback if supported
  try { if (navigator.vibrate) navigator.vibrate(100); } catch(e) {}

  // Automatically redirect after brief confirmation
  setTimeout(() => {
    closeStaffQRScanner();

    // Direct Web URLs or local files
    if (/^(https?:\/\/|mailto:|tel:|\/|\.\/)/i.test(trimmed)) {
      window.location.href = trimmed;
      return;
    }

    if (trimmed.endsWith('.html') || trimmed.includes('.html?') || trimmed.includes('.html#')) {
      window.location.href = trimmed;
      return;
    }

    // Reservation ID match
    const matched = (window.RESERVATIONS || []).find(r => r.id === trimmed || (r.id && r.id.toLowerCase() === trimmed.toLowerCase()));
    if (matched) {
      window.activeStaffExecutionResId = matched.id;
      showSection('execution-day');
      if (typeof renderStaffExecutionDay === 'function') renderStaffExecutionDay();
      return;
    }

    // Fallback domain or search redirect
    try {
      new URL(trimmed);
      window.location.href = trimmed;
    } catch(e) {
      if (trimmed.includes('.') && !trimmed.includes(' ')) {
        window.location.href = 'https://' + trimmed;
      } else {
        alert('Scanned QR Content: ' + trimmed);
      }
    }
  }, 650);
}

