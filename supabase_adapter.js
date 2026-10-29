function handleJwtExpiry(error) {
  if (error && error.message && error.message.includes('JWT expired')) {
    console.warn('JWT expired, forcing logout...');
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'index.html';
    return true;
  }
  return false;
}

﻿// ============================================================================
// SUPABASE FIRESTORE ADAPTER (DUAL-CLIENT ACTIVE + STANDBY BACKUP ARCHITECTURE)
// Maps Firebase syntax to Supabase to avoid rewriting frontend logic.
// Writes to Primary Supabase and mirrors to Secondary Supabase.
// Automatically falls back to Secondary Supabase for reads if Primary fails.
// ============================================================================

// Primary Client Fallback URL and Key
if (!window.SUPABASE_URL) {
  window.SUPABASE_URL = 'https://nukbdmyqizrnkmbusdtm.supabase.co';
}
if (!window.SUPABASE_ANON) {
  window.SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51a2JkbXlxaXpybmttYnVzZHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjM3NTQsImV4cCI6MjA5ODg5OTc1NH0.WlKtqa8hBxLedDHS7-q10yoPne6VTjt5F4E86vTA5eY';
}
if (!window.supabaseClient && window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON) {
  try {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON);
  } catch (err) {
    console.warn('[Supabase] Primary client init warning:', err);
  }
}

// Secondary / Standby Supabase Client configuration
if (!window.SUPABASE_BACKUP_URL) {
  window.SUPABASE_BACKUP_URL = 'https://llngowrkbzefjdkktgfm.supabase.co';
}
if (!window.SUPABASE_BACKUP_ANON) {
  window.SUPABASE_BACKUP_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsbmdvd3JrYnplZmpka2t0Z2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MzE3MTAsImV4cCI6MjEwNzUwNzcxMH0.8IndBI2vVOeTsUwwzNd9zaIcO-M4toGRrtR-mlkUeO0';
}
if (!window.supabaseBackupClient && window.supabase && window.SUPABASE_BACKUP_URL && window.SUPABASE_BACKUP_ANON) {
  try {
    window.supabaseBackupClient = window.supabase.createClient(window.SUPABASE_BACKUP_URL, window.SUPABASE_BACKUP_ANON);
    console.log('[Supabase] Secondary backup client initialized successfully.');
  } catch (err) {
    console.warn('[Supabase] Could not initialize secondary client:', err);
  }
}

window.firebaseDB = window.supabaseClient;

window.firebaseAuth = {
  get currentUser() {
    return window.__sbUser || null;
  }
};

// Returns true while Supabase is exchanging a PKCE ?code= on Vercel.
// During this window auth is transiently null - do NOT propagate that null
// or it wipes localStorage and causes an infinite reload loop on deployed sites.
function _isPKCEExchange() {
  return window.location.search.includes('code=') ||
         window.location.hash.includes('access_token');
}

// Listen to Supabase Auth State and map it to Firebase format
window.supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    window.__sbUser = {
      uid: session.user.id,
      email: session.user.email,
      displayName: session.user.user_metadata?.full_name || 'User',
      photoURL: session.user.user_metadata?.avatar_url || ''
    };
  } else {
    // Skip null propagation during PKCE mid-exchange (Vercel redirect flow).
    if (event !== 'SIGNED_OUT' && _isPKCEExchange()) return;
    window.__sbUser = null;
  }
  
  // Trigger Firebase observers
  if (window.__authObservers) {
    window.__authObservers.forEach(cb => cb(window.__sbUser));
  }
});

// AUTHENTICATION
async function signInWithEmailAndPassword(auth, email, password) {
  const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }
  return { user: { uid: data.user.id, email: data.user.email, displayName: data.user.user_metadata?.full_name } };
}

async function createUserWithEmailAndPassword(auth, email, password) {
  const { data, error } = await window.supabaseClient.auth.signUp({ email, password });
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }
  return { user: { uid: data.user.id, email: data.user.email } };
}

async function signOut(auth) {
  const { error } = await window.supabaseClient.auth.signOut();
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }
}

window.__authObservers = [];
function onAuthStateChanged(auth, callback) {
  window.__authObservers.push(callback);
  // call immediately if ready
  // Skip the null callback during a PKCE exchange (getSession transiently returns null mid-exchange on Vercel)
  window.supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      callback({ uid: session.user.id, email: session.user.email, displayName: session.user.user_metadata?.full_name });
    } else if (!_isPKCEExchange()) {
      callback(null);
    }
  });
  return () => {
    window.__authObservers = window.__authObservers.filter(cb => cb !== callback);
  };
}

async function updateProfile(user, { displayName, photoURL }) {
  const { error } = await window.supabaseClient.auth.updateUser({
    data: { full_name: displayName, avatar_url: photoURL }
  });
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }
}

// Google Auth Dummy (Supabase OAuth needs redirect, so we wrap it)
function GoogleAuthProvider() {}
async function signInWithPopup(auth, provider) {
  const { data, error } = await window.supabaseClient.auth.signInWithOAuth({ provider: 'google' });
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }
  return data;
}

// DATABASE - FIRESTORE EMULATION
function collection(db, path) { return { path }; }
function doc(db, path, id) { 
  if (arguments.length === 2) {
    // doc(collectionRef, id)
    return { path: db.path, id: path };
  }
  return { path, id }; 
}
function query(col, ...constraints) { return { ...col, constraints: [...(col.constraints || []), ...constraints] }; }
function where(field, op, val) { return { type: 'where', field, op, val }; }
function orderBy(field, dir='asc') { return { type: 'orderBy', field, dir }; }
function limit(n) { return { type: 'limit', val: n }; }

// ===== UNIVERSAL COLUMN MAPPING LAYER =====
// Maps Firebase camelCase fields to Supabase snake_case columns

const UNSTRUCTURED_COLLECTIONS = [
  'FoodTaste', 'designs', 'chats', 'equipment_assets', 'equipment_flags', 
  'deploymentLogs', 'issueResolutions', 'purchaseOrders', 
  'shoppingLists', 'rentalDamagePayments', 'maintenanceTasks'
];

function getTableName(path) {
  return UNSTRUCTURED_COLLECTIONS.includes(path) ? path.toLowerCase() : path;
}

const GLOBAL_FIELD_MAP = {
  createdAt: 'created_at', updatedAt: 'updated_at',
  reservationId: 'reservation_id', meetingId: 'meeting_id',
  userId: 'user_id', clientName: 'client_name', clientEmail: 'client_email',
};

function mapColumn(path, field) {
  // Always apply global camelCase → snake_case map first
  if (GLOBAL_FIELD_MAP[field]) return GLOBAL_FIELD_MAP[field];

  // Then apply reservations-specific map
  if (path !== 'reservations') return field;
  const map = {
    client: 'client_name', email: 'client_email', packageName: 'package_name',
    packageItems: 'package_items', paymentMethod: 'payment_method',
    pricingMode: 'pricing_mode', selectedTier: 'selected_tier',
    isVIP: 'is_vip', vipCount: 'vip_count', vipService: 'vip_service',
    proposedMeetingTimes: 'meeting_times', time: 'timeframe', coords: 'venue_coords',
    createdAt: 'created_at', updatedAt: 'updated_at',
    rejectionReason: 'rejection_reason', activePkgId: 'active_pkg_id',
    contractUrl: 'contract_url', contractFinalizedAt: 'contract_finalized_at',
    statusNote: 'status_note', paymentStatus: 'payment_status',
    paidAt: 'paid_at', venueSurcharge: 'venue_surcharge',
    activityLogs: 'activity_logs', hiredPersonnel: 'hired_personnel',
    logisticsMilestones: 'logistics_milestones', timelineTasks: 'timeline_tasks',
    finalRundown: 'final_rundown', downpaymentAmount: 'downpayment_amount',
    downpaymentDueDate: 'downpayment_due_date', executionPlan: 'execution_plan',
    venueLocation: 'venue_location', serviceChargePct: 'service_charge_pct',
    premadePackageName: 'premade_package_name', contractUrls: 'contract_urls'
  };
  return map[field] || field;
}


function mapToDB(path, data) {
  if (!data) return data;
  
  if (UNSTRUCTURED_COLLECTIONS.includes(path)) {
    const wrapped = { ...data };
    const id = wrapped.id;
    delete wrapped.id;
    const mappedData = {};
    for (const k of Object.keys(wrapped)) {
      mappedData[GLOBAL_FIELD_MAP[k] || k] = wrapped[k];
    }
    return { id, data: mappedData };
  }

  if (path === 'meetings') {
    const mData = { ...data };
    if (mData.reservationId !== undefined) { mData.reservation_id = mData.reservationId; delete mData.reservationId; }
    if (mData.roomId !== undefined) { mData.room_id = mData.roomId; delete mData.roomId; }
    if (mData.adminProposedTimes !== undefined) { 
      mData.admin_proposed_times = mData.adminProposedTimes; 
      mData.proposed_times = mData.adminProposedTimes; 
      delete mData.adminProposedTimes; 
    }
    if (mData.timeEnd !== undefined) { mData.time_end = mData.timeEnd; delete mData.timeEnd; }
    if (mData.timeType !== undefined) { mData.time_type = mData.timeType; delete mData.timeType; }
    if (mData.finalPaymentDueDate !== undefined) { mData.final_payment_due_date = mData.finalPaymentDueDate; delete mData.finalPaymentDueDate; }
    if (mData.finalPaymentAmount !== undefined) { mData.final_payment_amount = mData.finalPaymentAmount; delete mData.finalPaymentAmount; }
    if (mData.downpaymentDueDate !== undefined) { mData.downpayment_due_date = mData.downpaymentDueDate; delete mData.downpaymentDueDate; }
    if (mData.downpaymentAmount !== undefined) { mData.downpayment_amount = mData.downpaymentAmount; delete mData.downpaymentAmount; }
    if (mData.isModifying !== undefined) { mData.is_modifying = mData.isModifying; delete mData.isModifying; }
    if (mData.activeTab !== undefined) { mData.active_tab = mData.activeTab; }
    if (mData.active_tab !== undefined) { mData.activeTab = mData.active_tab; }
    if (mData.agenda !== undefined && mData.topic === undefined) { mData.topic = mData.agenda; }
    if (mData.topic !== undefined && mData.agenda === undefined) { mData.agenda = mData.topic; }
    if (mData.date && mData.time && !mData.scheduled_at) {
      try { mData.scheduled_at = new Date(`${mData.date}T${mData.time}:00`).toISOString(); } catch (e) {}
    }
    // Map customer and client fields to ensure Supabase meetings schema is populated
    if (mData.customerEmail !== undefined) { mData.customer_email = mData.customerEmail; }
    if (mData.customerName !== undefined) { mData.customer_name = mData.customerName; }
    if (mData.clientName !== undefined) { mData.client_name = mData.clientName; }
    if (mData.clientId !== undefined) { mData.client_id = mData.clientId; }
    if (mData.manualPickedByAdmin !== undefined) { mData.manual_picked_by_admin = mData.manualPickedByAdmin; }
    if (mData.initialFeeDueDate !== undefined) { mData.initial_fee_due_date = mData.initialFeeDueDate; }
    if (mData.cancellationWindow !== undefined) { mData.cancellation_window = mData.cancellationWindow; }
    // Sanitize any empty string date fields to null to avoid Postgres syntax errors
    const meetingDateCols = ['date', 'time_end', 'scheduled_at', 'final_payment_due_date', 'downpayment_due_date', 'initial_fee_due_date', 'cancellation_window'];
    for (const k of meetingDateCols) {
      if (mData[k] !== undefined && typeof mData[k] === 'string' && mData[k].trim() === '') {
        mData[k] = null;
      }
    }
    return mData;
  }

  if (path !== 'reservations') return data;
  const dbData = { ...data };

  if (dbData.userId !== undefined) { dbData.user_id = dbData.userId; delete dbData.userId; }
  if (dbData.client !== undefined) { dbData.client_name = dbData.client; delete dbData.client; }
  if (dbData.email !== undefined) { dbData.client_email = dbData.email; delete dbData.email; }
  if (dbData.time !== undefined) { dbData.timeframe = dbData.time; delete dbData.time; }
  if (dbData.coords !== undefined) { dbData.venue_coords = dbData.coords; delete dbData.coords; }
  if (dbData.packageName !== undefined) { dbData.package_name = dbData.packageName; delete dbData.packageName; }
  if (dbData.paymentMethod !== undefined) { dbData.payment_method = dbData.paymentMethod; delete dbData.paymentMethod; }
  if (dbData.pricingMode !== undefined) { dbData.pricing_mode = dbData.pricingMode; delete dbData.pricingMode; }
  if (dbData.selectedTier !== undefined) { dbData.selected_tier = dbData.selectedTier; delete dbData.selectedTier; }
  if (dbData.createdAt !== undefined) { dbData.created_at = dbData.createdAt; delete dbData.createdAt; }

  // packageItems — save as proper text array
  if (dbData.packageItems !== undefined) {
    dbData.package_items = Array.isArray(dbData.packageItems)
      ? dbData.packageItems.map(i => typeof i === 'string' ? i : (i && i.name ? i.name : '')).filter(Boolean)
      : [];
    delete dbData.packageItems;
  }

  if (dbData.rejectionReason !== undefined) { dbData.rejection_reason = dbData.rejectionReason; delete dbData.rejectionReason; }
  if (dbData.activePkgId !== undefined) { dbData.active_pkg_id = dbData.activePkgId; delete dbData.activePkgId; }
  if (dbData['mandatory-meeting concluded'] !== undefined) { dbData.mandatory_meeting_concluded = dbData['mandatory-meeting concluded']; delete dbData['mandatory-meeting concluded']; }
  if (dbData.downpaymentDueDate !== undefined) { dbData.downpayment_due_date = dbData.downpaymentDueDate; delete dbData.downpaymentDueDate; }
  if (dbData.finalPaymentDueDate !== undefined) { dbData.final_payment_due_date = dbData.finalPaymentDueDate; delete dbData.finalPaymentDueDate; }
  if (dbData.finalPaymentAmount !== undefined) { dbData.final_payment_amount = dbData.finalPaymentAmount; delete dbData.finalPaymentAmount; }
  if (dbData.contractUrl !== undefined) { dbData.contract_url = dbData.contractUrl; delete dbData.contractUrl; }
  if (dbData.contractFinalizedAt !== undefined) { dbData.contract_finalized_at = dbData.contractFinalizedAt; delete dbData.contractFinalizedAt; }
  if (dbData.statusNote !== undefined) { dbData.status_note = dbData.statusNote; delete dbData.statusNote; }
  if (dbData.paymentStatus !== undefined) { dbData.payment_status = dbData.paymentStatus; delete dbData.paymentStatus; }
  if (dbData.paidAt !== undefined) { dbData.paid_at = dbData.paidAt; delete dbData.paidAt; }
  if (dbData.venueSurcharge !== undefined) { dbData.venue_surcharge = dbData.venueSurcharge; delete dbData.venueSurcharge; }
  if (dbData.activityLogs !== undefined) { dbData.activity_logs = dbData.activityLogs; delete dbData.activityLogs; }
  if (dbData.hiredPersonnel !== undefined) { dbData.hired_personnel = dbData.hiredPersonnel; delete dbData.hiredPersonnel; }
  if (dbData.logisticsMilestones !== undefined) { dbData.logistics_milestones = dbData.logisticsMilestones; delete dbData.logisticsMilestones; }
  if (dbData.timelineTasks !== undefined) { dbData.timeline_tasks = dbData.timelineTasks; delete dbData.timelineTasks; }
  if (dbData.finalRundown !== undefined) { dbData.final_rundown = dbData.finalRundown; delete dbData.finalRundown; }
  if (dbData.downpaymentAmount !== undefined) { dbData.downpayment_amount = dbData.downpaymentAmount; delete dbData.downpaymentAmount; }
  if (dbData.executionPlan !== undefined) { dbData.execution_plan = dbData.executionPlan; delete dbData.executionPlan; }
  if (dbData.venueLocation !== undefined) { dbData.venue_location = dbData.venueLocation; delete dbData.venueLocation; }
  if (dbData.packageOrigin !== undefined) { dbData.package_origin = dbData.packageOrigin; delete dbData.packageOrigin; }
  if (dbData.pricePerHead !== undefined) { dbData.price_per_head = dbData.pricePerHead; delete dbData.pricePerHead; }
  if (dbData.priceTiers !== undefined) { dbData.price_tiers = dbData.priceTiers || null; delete dbData.priceTiers; }
  if (dbData.serviceChargePct !== undefined) { dbData.service_charge_pct = dbData.serviceChargePct; delete dbData.serviceChargePct; }
  if (dbData.premadePackageName !== undefined) { dbData.premade_package_name = dbData.premadePackageName; delete dbData.premadePackageName; }
  if (dbData.contractUrls !== undefined) { dbData.contract_urls = dbData.contractUrls; delete dbData.contractUrls; }
  if (dbData.downpaymentStatus !== undefined) { dbData.downpayment_status = dbData.downpaymentStatus; delete dbData.downpaymentStatus; }
  if (dbData.initialFeeStatus !== undefined) { dbData.initial_fee_status = dbData.initialFeeStatus; delete dbData.initialFeeStatus; }
  if (dbData.finalPaymentStatus !== undefined) { dbData.final_payment_status = dbData.finalPaymentStatus; delete dbData.finalPaymentStatus; }
  if (dbData.downpaymentMethod !== undefined) { dbData.downpayment_method = dbData.downpaymentMethod; delete dbData.downpaymentMethod; }
  if (dbData.initialFeeMethod !== undefined) { dbData.initial_fee_method = dbData.initialFeeMethod; delete dbData.initialFeeMethod; }
  if (dbData.finalPaymentMethod !== undefined) { dbData.final_method = dbData.finalPaymentMethod; delete dbData.finalPaymentMethod; }
  if (dbData.outOfTownCharge !== undefined) { dbData.out_of_town_charge = dbData.outOfTownCharge; delete dbData.outOfTownCharge; }
  if (dbData.basePrice !== undefined) { dbData.base_price = dbData.basePrice; delete dbData.basePrice; }
  if (dbData.additionalItemsCharge !== undefined) { dbData.additional_items_charge = dbData.additionalItemsCharge; delete dbData.additionalItemsCharge; }
  if (dbData.additionalItems !== undefined) { dbData.additional_items = dbData.additionalItems; delete dbData.additionalItems; }
  if (dbData.callTime !== undefined) { dbData.call_time = dbData.callTime; delete dbData.callTime; }

  // VIP bundling
  if (dbData.isVIP !== undefined || dbData.vipCount !== undefined || dbData.vipService !== undefined) {
    dbData.vip = { enabled: dbData.isVIP || false, count: dbData.vipCount || 0, service: dbData.vipService || '' };
    delete dbData.isVIP; delete dbData.vipCount; delete dbData.vipService;
  }
  if (dbData.proposedMeetingTimes !== undefined) { dbData.meeting_times = dbData.proposedMeetingTimes; delete dbData.proposedMeetingTimes; }

  if (dbData.initialFeeDueDate !== undefined) { dbData.initial_fee_due_date = dbData.initialFeeDueDate; delete dbData.initialFeeDueDate; }
  if (dbData.cancellationWindow !== undefined) { dbData.cancellation_window = dbData.cancellationWindow; delete dbData.cancellationWindow; }
  if (dbData.initial_fee_due_date) {
    dbData.execution_plan = dbData.execution_plan || {};
    dbData.execution_plan.initial_fee_due_date = dbData.initial_fee_due_date;
  }
  if (dbData.cancellation_window) {
    dbData.execution_plan = dbData.execution_plan || {};
    dbData.execution_plan.cancellation_window = dbData.cancellation_window;
  }
  if (dbData.additional_items_charge !== undefined) {
    dbData.execution_plan = dbData.execution_plan || {};
    dbData.execution_plan.additional_items_charge = dbData.additional_items_charge;
  }
  if (dbData.additional_items !== undefined) {
    dbData.execution_plan = dbData.execution_plan || {};
    dbData.execution_plan.additional_items = dbData.additional_items;
  }

  // Sanitize all date and timestamp fields so empty strings become null (avoids Postgres date syntax error)
  const resDateCols = [
    'date', 'event_date', 'initial_fee_due_date', 'downpayment_due_date',
    'final_payment_due_date', 'cancellation_window', 'paid_at',
    'contract_finalized_at', 'call_time'
  ];
  for (const k of resDateCols) {
    if (dbData[k] !== undefined && typeof dbData[k] === 'string' && dbData[k].trim() === '') {
      dbData[k] = null;
    }
  }
  for (const k of Object.keys(dbData)) {
    if (typeof dbData[k] === 'string' && dbData[k].trim() === '' && (k.endsWith('_date') || k.endsWith('Date') || k === 'cancellation_window' || k === 'paid_at' || k === 'contract_finalized_at')) {
      dbData[k] = null;
    }
  }

  // Any remaining unknown fields go into execution_plan._firebase_extras
  const allowedKeys = [
    'id','user_id','client_name','client_email','client_phone',
    'date','timeframe','venue','venue_coords','pax','type','theme',
    'description','status','ops_status','amount','payment_method',
    'payment_status','package_name','package_items','pricing_mode',
    'selected_tier','vip','meeting_times','staff','seating_layout',
    'execution_plan','food_tasted','rundown_data','design_selections',
    'customer_equipment','execution_agenda','settlement_amount','settled',
    'execution_live_status','delay_reason','downpayment_amount','downpayment_paid',
    'downpayment_due','downpayment_due_date','final_payment_due_date','final_payment_amount',
    'created_at','updated_at',
    'venue_location','rejection_reason','active_pkg_id','mandatory_meeting_concluded',
    'contract_url','contract_finalized_at','status_note','venue_surcharge',
    'activity_logs','staffing','hired_personnel','logistics_milestones',
    'timeline_tasks','final_rundown','paid_at','payment_status_note',
    'submittedDate','requestedAt','bookedAt',
    'initial_fee','initial_fee_paid','package_origin','price_per_head',
    'freeChoiceFoodItem','price_tiers','service_charge_pct','premade_package_name',
    'contract_urls',
    'downpayment_status','initial_fee_status','final_payment_status',
    'downpayment_method','initial_fee_method','final_method','final_payment_method',
    'out_of_town_charge','base_price','call_time','transportation_driver_id',
    'downpayment_proof','final_proof','initial_fee_proof',
    'initial_fee_due_date','cancellation_window'
  ];
  let extras = {};
  for (const k of Object.keys(dbData)) {
    if (!allowedKeys.includes(k)) { extras[k] = dbData[k]; delete dbData[k]; }
  }
  if (Object.keys(extras).length > 0) {
    dbData.execution_plan = dbData.execution_plan || {};
    dbData.execution_plan._firebase_extras = { ...(dbData.execution_plan._firebase_extras || {}), ...extras };
  }
  return dbData;
}

function mapFromDB(path, data) {
  if (!data) return data;

  if (UNSTRUCTURED_COLLECTIONS.includes(path)) {
    if (data.data) {
      const unmappedData = {};
      for (const k of Object.keys(data.data)) {
        const reverseKey = Object.keys(GLOBAL_FIELD_MAP).find(key => GLOBAL_FIELD_MAP[key] === k) || k;
        unmappedData[reverseKey] = data.data[k];
      }
      return { id: data.id, created_at: data.created_at, ...unmappedData };
    }
    return data;
  }

  if (path === 'meetings') {
    const fb = { ...data };
    const rId = fb.reservation_id || fb.reservationId || null;
    fb.reservationId = rId;
    fb.reservation_id = rId;
    if (fb.room_id !== undefined) fb.roomId = fb.room_id;
    if (fb.admin_proposed_times !== undefined && fb.admin_proposed_times !== null) fb.adminProposedTimes = fb.admin_proposed_times;
    else if (fb.proposed_times !== undefined && fb.proposed_times !== null) fb.adminProposedTimes = fb.proposed_times;
    if (fb.time_end !== undefined) fb.timeEnd = fb.time_end;
    if (fb.time_type !== undefined) fb.timeType = fb.time_type;
    if (fb.final_payment_due_date !== undefined) fb.finalPaymentDueDate = fb.final_payment_due_date;
    if (fb.final_payment_amount !== undefined) fb.finalPaymentAmount = fb.final_payment_amount;
    if (fb.downpayment_due_date !== undefined) fb.downpaymentDueDate = fb.downpayment_due_date;
    if (fb.downpayment_amount !== undefined) fb.downpaymentAmount = fb.downpayment_amount;
    if (fb.customer_email !== undefined) fb.customerEmail = fb.customer_email;
    if (fb.customer_name !== undefined) fb.customerName = fb.customer_name;
    if (fb.topic !== undefined && !fb.agenda) fb.agenda = fb.topic;
    if (fb.agenda !== undefined && !fb.topic) fb.topic = fb.agenda;
    const effectiveTab = fb.active_tab || fb.activeTab || 'res';
    fb.activeTab = effectiveTab;
    fb.active_tab = effectiveTab;
    if (fb.is_modifying !== undefined) fb.isModifying = fb.is_modifying;
    if (fb.live_draft !== undefined) fb.liveDraft = fb.live_draft;
    if (fb.meeting_notes !== undefined && !fb.notes) fb.notes = fb.meeting_notes;
    if (fb.scheduled_at && !fb.date) {
      try {
        const dt = new Date(fb.scheduled_at);
        if (!isNaN(dt.getTime())) {
          const yy = dt.getFullYear();
          const mm = String(dt.getMonth() + 1).padStart(2, '0');
          const dd = String(dt.getDate()).padStart(2, '0');
          fb.date = `${yy}-${mm}-${dd}`;
          const hh = String(dt.getHours()).padStart(2, '0');
          const mi = String(dt.getMinutes()).padStart(2, '0');
          if (!fb.time) fb.time = `${hh}:${mi}`;
        }
      } catch (e) {}
    }
    if (fb.initial_fee_due_date !== undefined) fb.initialFeeDueDate = fb.initial_fee_due_date;
    if (fb.cancellation_window !== undefined) fb.cancellationWindow = fb.cancellation_window;
    return fb;
  }

  if (path !== 'reservations') return data;
  const fbData = { ...data };

  if (fbData.client_name !== undefined) { fbData.client = fbData.client_name; delete fbData.client_name; }
  if (fbData.client_email !== undefined) { fbData.email = fbData.client_email; delete fbData.client_email; }
  if (fbData.timeframe !== undefined) { fbData.time = fbData.timeframe; delete fbData.timeframe; }
  if (fbData.venue_coords !== undefined) { fbData.coords = fbData.venue_coords; delete fbData.venue_coords; }
  if (fbData.package_name !== undefined) { fbData.packageName = fbData.package_name; delete fbData.package_name; }
  if (fbData.payment_method !== undefined) { fbData.paymentMethod = fbData.payment_method; delete fbData.payment_method; }
  if (fbData.pricing_mode !== undefined) { fbData.pricingMode = fbData.pricing_mode; delete fbData.pricing_mode; }
  if (fbData.selected_tier !== undefined) { fbData.selectedTier = fbData.selected_tier; delete fbData.selected_tier; }
  if (fbData.created_at !== undefined) { fbData.createdAt = fbData.created_at; delete fbData.created_at; }

  // packageItems — map back to camelCase array
  if (fbData.package_items !== undefined) {
    fbData.packageItems = Array.isArray(fbData.package_items) ? fbData.package_items : [];
    delete fbData.package_items;
  }

  if (fbData.rejection_reason !== undefined) { fbData.rejectionReason = fbData.rejection_reason; delete fbData.rejection_reason; }
  if (fbData.active_pkg_id !== undefined) { fbData.activePkgId = fbData.active_pkg_id; delete fbData.active_pkg_id; }
  if (fbData.mandatory_meeting_concluded !== undefined) { fbData['mandatory-meeting concluded'] = fbData.mandatory_meeting_concluded; delete fbData.mandatory_meeting_concluded; }
  if (fbData.downpayment_due_date !== undefined) { fbData.downpaymentDueDate = fbData.downpayment_due_date; delete fbData.downpayment_due_date; }
  if (fbData.final_payment_due_date !== undefined) { fbData.finalPaymentDueDate = fbData.final_payment_due_date; delete fbData.final_payment_due_date; }
  if (fbData.final_payment_amount !== undefined) { fbData.finalPaymentAmount = fbData.final_payment_amount; delete fbData.final_payment_amount; }
  if (fbData.contract_url !== undefined) { fbData.contractUrl = fbData.contract_url; delete fbData.contract_url; }
  if (fbData.package_origin !== undefined) { fbData.packageOrigin = fbData.package_origin; delete fbData.package_origin; }
  if (fbData.price_per_head !== undefined) { fbData.pricePerHead = parseFloat(fbData.price_per_head) || 0; delete fbData.price_per_head; }
  if (fbData.price_tiers !== undefined) { fbData.priceTiers = fbData.price_tiers || null; delete fbData.price_tiers; }
  if (fbData.contract_finalized_at !== undefined) { fbData.contractFinalizedAt = fbData.contract_finalized_at; delete fbData.contract_finalized_at; }
  if (fbData.status_note !== undefined) { fbData.statusNote = fbData.status_note; delete fbData.status_note; }
  if (fbData.payment_status !== undefined) { fbData.paymentStatus = fbData.payment_status; delete fbData.payment_status; }
  if (fbData.paid_at !== undefined) { fbData.paidAt = fbData.paid_at; delete fbData.paid_at; }
  if (fbData.venue_surcharge !== undefined) { fbData.venueSurcharge = fbData.venue_surcharge; delete fbData.venue_surcharge; }
  if (fbData.activity_logs !== undefined) { fbData.activityLogs = fbData.activity_logs; delete fbData.activity_logs; }
  if (fbData.hired_personnel !== undefined) { fbData.hiredPersonnel = fbData.hired_personnel; delete fbData.hired_personnel; }
  if (fbData.logistics_milestones !== undefined) { fbData.logisticsMilestones = fbData.logistics_milestones; delete fbData.logistics_milestones; }
  if (fbData.timeline_tasks !== undefined) { fbData.timelineTasks = fbData.timeline_tasks; delete fbData.timeline_tasks; }
  if (fbData.final_rundown !== undefined) { fbData.finalRundown = fbData.final_rundown; delete fbData.final_rundown; }
  if (fbData.downpayment_amount !== undefined) { fbData.downpaymentAmount = fbData.downpayment_amount; delete fbData.downpayment_amount; }
  if (fbData.execution_plan !== undefined) { fbData.executionPlan = fbData.execution_plan; }
  if (fbData.venue_location !== undefined) { fbData.venueLocation = fbData.venue_location; delete fbData.venue_location; }
  if (fbData.service_charge_pct !== undefined) { fbData.serviceChargePct = fbData.service_charge_pct; }
  if (fbData.premade_package_name !== undefined) { fbData.premadePackageName = fbData.premade_package_name; }
  if (fbData.contract_urls !== undefined) { fbData.contractUrls = fbData.contract_urls; }
  if (fbData.downpayment_status !== undefined) { fbData.downpaymentStatus = fbData.downpayment_status; }
  if (fbData.initial_fee_status !== undefined) { fbData.initialFeeStatus = fbData.initial_fee_status; }
  if (fbData.final_payment_status !== undefined) { fbData.finalPaymentStatus = fbData.final_payment_status; }
  if (fbData.downpayment_method !== undefined) { fbData.downpaymentMethod = fbData.downpayment_method; }
  if (fbData.initial_fee_method !== undefined) { fbData.initialFeeMethod = fbData.initial_fee_method; }
  if (fbData.final_method !== undefined) { fbData.finalPaymentMethod = fbData.final_method; }
  if (fbData.out_of_town_charge !== undefined) { fbData.outOfTownCharge = fbData.out_of_town_charge; }
  if (fbData.additional_items_charge !== undefined) { fbData.additionalItemsCharge = fbData.additional_items_charge; }
  if (fbData.additional_items !== undefined) { fbData.additionalItems = fbData.additional_items; }
  if (fbData.base_price !== undefined) { fbData.basePrice = fbData.base_price; }
  if (fbData.call_time !== undefined) { fbData.callTime = fbData.call_time; }

  if (fbData.vip) {
    fbData.isVIP = fbData.vip.enabled;
    fbData.vipCount = fbData.vip.count;
    fbData.vipService = fbData.vip.service;
    delete fbData.vip;
  }
  if (fbData.meeting_times !== undefined) { fbData.proposedMeetingTimes = fbData.meeting_times; delete fbData.meeting_times; }

  if (fbData.execution_plan && fbData.execution_plan._firebase_extras) {
    Object.assign(fbData, fbData.execution_plan._firebase_extras);
    delete fbData.execution_plan._firebase_extras;
  }

  if (fbData.initial_fee_due_date !== undefined) { fbData.initialFeeDueDate = fbData.initial_fee_due_date; }
  if (fbData.cancellation_window !== undefined) { fbData.cancellationWindow = fbData.cancellation_window; }
  if (!fbData.initial_fee_due_date && fbData.execution_plan && fbData.execution_plan.initial_fee_due_date) {
    fbData.initial_fee_due_date = fbData.execution_plan.initial_fee_due_date;
    fbData.initialFeeDueDate = fbData.initial_fee_due_date;
  }
  if (!fbData.cancellation_window && fbData.execution_plan && fbData.execution_plan.cancellation_window) {
    fbData.cancellation_window = fbData.execution_plan.cancellation_window;
    fbData.cancellationWindow = fbData.cancellation_window;
  }
  // Restore additional_items and additional_items_charge from execution_plan when present
  if (fbData.execution_plan) {
    if (fbData.additional_items === undefined && fbData.execution_plan.additional_items !== undefined) {
      fbData.additional_items = fbData.execution_plan.additional_items;
    }
    if (fbData.additional_items_charge === undefined && fbData.execution_plan.additional_items_charge !== undefined) {
      fbData.additional_items_charge = fbData.execution_plan.additional_items_charge;
    }
  }
  if (fbData.additional_items !== undefined) fbData.additionalItems = fbData.additional_items;
  if (fbData.additionalItems !== undefined && fbData.additional_items === undefined) fbData.additional_items = fbData.additionalItems;
  if (fbData.additional_items_charge !== undefined) fbData.additionalItemsCharge = fbData.additional_items_charge;
  if (fbData.additionalItemsCharge !== undefined && fbData.additional_items_charge === undefined) fbData.additional_items_charge = fbData.additionalItemsCharge;

  return fbData;
}


async function executeWithPgrstRetry(actionFn, payload) {
  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    const res = await actionFn(payload);
    if (!res.error) return res;

    // Check if error is PGRST204 (column missing from schema cache)
    if (res.error.code === 'PGRST204' || (res.error.message && res.error.message.includes('in the schema cache'))) {
      const match = res.error.message.match(/Could not find the '([^']+)' column/i);
      if (match && match[1]) {
        const missingCol = match[1];
        console.warn(`[SupabaseAdapter] Column '${missingCol}' not found in DB schema cache. Stripping and retrying...`);
        delete payload[missingCol];
        continue;
      }
    }
    return res;
  }
  return { data: null, error: new Error('Max retries exceeded for schema cache error') };
}

async function addDoc(col, data) {
  const payload = mapToDB(col.path, data);
  if (col.path === 'reservations' && !payload.user_id && window.supabaseClient) {
    try {
      const sessionUser = (await window.supabaseClient.auth.getUser())?.data?.user;
      if (sessionUser && sessionUser.id) {
        payload.user_id = sessionUser.id;
      }
    } catch (e) {}
  }
  const { data: res, error } = await executeWithPgrstRetry(
    (pl) => window.supabaseClient.from(getTableName(col.path)).insert([pl]).select().single(),
    payload
  );
  if (error) { console.error('addDoc Error:', error); throw new Error(error.message); }

  // Dual-Write Mirror to Secondary Supabase
  if (window.supabaseBackupClient && res && res.id) {
    try {
      const backupPayload = { ...payload, id: res.id };
      executeWithPgrstRetry(
        (pl) => window.supabaseBackupClient.from(getTableName(col.path)).upsert([pl]),
        backupPayload
      ).catch(e => console.warn('[Supabase Backup Dual-Sync addDoc notice]:', e));
    } catch(e) {}
  }

  return { id: res.id, path: col.path };
}

async function setDoc(docRef, data, options = {}) {
  const payload = mapToDB(docRef.path, data);
  const { error } = await executeWithPgrstRetry(
    (pl) => window.supabaseClient.from(getTableName(docRef.path)).upsert([{ id: docRef.id, ...pl }]),
    payload
  );
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }

  // Dual-Write Mirror to Secondary Supabase
  if (window.supabaseBackupClient && docRef.id) {
    try {
      const backupPayload = { ...payload, id: docRef.id };
      executeWithPgrstRetry(
        (pl) => window.supabaseBackupClient.from(getTableName(docRef.path)).upsert([pl]),
        backupPayload
      ).catch(e => console.warn('[Supabase Backup Dual-Sync setDoc notice]:', e));
    } catch(e) {}
  }
}

async function updateDoc(docRef, data) {
  if (!docRef || !docRef.id || docRef.id === 'null' || docRef.id === 'undefined') {
    console.warn('[updateDoc] Attempted update with invalid/null document ID on path:', docRef?.path);
    return;
  }
  const payload = mapToDB(docRef.path, data);
  const { error } = await executeWithPgrstRetry(
    (pl) => window.supabaseClient.from(getTableName(docRef.path)).update(pl).eq('id', docRef.id),
    payload
  );
  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message); }

  // Dual-Write Mirror to Secondary Supabase
  if (window.supabaseBackupClient && docRef.id) {
    try {
      executeWithPgrstRetry(
        (pl) => window.supabaseBackupClient.from(getTableName(docRef.path)).update(pl).eq('id', docRef.id),
        payload
      ).catch(e => console.warn('[Supabase Backup Dual-Sync updateDoc notice]:', e));
    } catch(e) {}
  }
}

async function deleteDoc(docRef) {
  if (!docRef || !docRef.id) return;
  const { error } = await window.supabaseClient.from(getTableName(docRef.path)).delete().eq('id', docRef.id);
  if (error) { if (handleJwtExpiry(error)) return; throw new Error(error.message); }

  // Mirror delete to Secondary Supabase
  if (window.supabaseBackupClient && docRef.id) {
    try {
      window.supabaseBackupClient.from(getTableName(docRef.path)).delete().eq('id', docRef.id)
        .then(() => {})
        .catch(e => console.warn('[Supabase Backup Dual-Sync deleteDoc notice]:', e));
    } catch(e) {}
  }
}

async function getDoc(docRef) {
  let data = null;
  let error = null;

  try {
    const primaryRes = await window.supabaseClient.from(getTableName(docRef.path)).select('*').eq('id', docRef.id).single();
    data = primaryRes.data;
    error = primaryRes.error;
  } catch (e) {
    error = e;
  }

  // Automatic Failover: Read from secondary if primary returned network/server/restriction error
  if (error && error.code !== 'PGRST116' && window.supabaseBackupClient) {
    console.warn('[Supabase Failover] Primary getDoc failed, retrying on secondary standby:', error.message || error);
    try {
      const backupRes = await window.supabaseBackupClient.from(getTableName(docRef.path)).select('*').eq('id', docRef.id).single();
      if (!backupRes.error || backupRes.error.code === 'PGRST116') {
        data = backupRes.data;
        error = backupRes.error;
      }
    } catch (e2) {
      console.warn('[Supabase Failover] Secondary getDoc also failed:', e2.message || e2);
    }
  }

  if (error && error.code !== 'PGRST116') throw new Error(error.message || error);
  return {
    id: docRef.id,
    exists: () => !data,
    data: () => mapFromDB(docRef.path, data)
  };
}

async function getDocs(q) {
  function executeQuery(client) {
    let req = client.from(getTableName(q.path)).select('*');
    if (q.constraints) {
      q.constraints.forEach(c => {
        if (c.type === 'where') {
          let field = mapColumn(q.path, c.field);
          if (UNSTRUCTURED_COLLECTIONS.includes(q.path) && field !== 'id' && field !== 'created_at') field = `data->>${field}`;
          if (c.op === '==') req = req.eq(field, c.val);
          else if (c.op === '<') req = req.lt(field, c.val);
          else if (c.op === '>') req = req.gt(field, c.val);
          else if (c.op === '<=') req = req.lte(field, c.val);
          else if (c.op === '>=') req = req.gte(field, c.val);
          else if (c.op === 'in') req = req.in(field, c.val);
          else if (c.op === 'array-contains') req = req.contains(field, [c.val]);
        } else if (c.type === 'orderBy') {
          let field = mapColumn(q.path, c.field);
          if (UNSTRUCTURED_COLLECTIONS.includes(q.path) && field !== 'id' && field !== 'created_at') field = `data->>${field}`;
          req = req.order(field, { ascending: c.dir === 'asc' });
        } else if (c.type === 'limit') {
          req = req.limit(c.val);
        }
      });
    }
    return req;
  }

  let data = null;
  let error = null;

  try {
    const res = await executeQuery(window.supabaseClient);
    data = res.data;
    error = res.error;
  } catch (e) {
    error = e;
  }

  // Automatic Failover: Read from secondary if primary returned network/server/restriction error
  if (error && window.supabaseBackupClient) {
    console.warn('[Supabase Failover] Primary getDocs failed, retrying on secondary standby:', error.message || error);
    try {
      const backupRes = await executeQuery(window.supabaseBackupClient);
      if (!backupRes.error) {
        data = backupRes.data;
        error = null;
      }
    } catch (e2) {
      console.warn('[Supabase Failover] Secondary getDocs also failed:', e2.message || e2);
    }
  }

  if (error) { if (handleJwtExpiry(error)) return { empty: true, docs: [] }; throw new Error(error.message || error); }
  
  const snap = {
    empty: !data || data.length === 0,
    docs: (data || []).map(d => ({
      id: d.id,
      data: () => mapFromDB(q.path, d)
    })),
    forEach(cb) {
      this.docs.forEach(cb);
    },
    docChanges() {
      return this.docs.map(doc => ({ type: 'added', doc }));
    }
  };
  return snap;
}

// onSnapshot emulation using Supabase Realtime + Fetch
function onSnapshot(q, callback) {
  let isDoc = !!q.id; // docRef vs query
  
  let cachedDocs = new Map();
  let isFirstLoad = true;

  const fetchAndNotify = async (payload = null) => {
    try {
      if (isDoc) {
        const snap = await getDoc(q);
        callback(snap);
      } else {
        const snap = await getDocs(q);
        let changes = [];

        if (isFirstLoad) {
          snap.docs.forEach(d => {
            cachedDocs.set(d.id, d);
            changes.push({ type: 'added', doc: d });
          });
          isFirstLoad = false;
        } else if (payload) {
          // Compute change based on realtime payload
          const d = { id: payload.new?.id || payload.old?.id, data: () => mapFromDB(q.path, payload.new) };
          let type = 'modified';
          if (payload.eventType === 'INSERT') type = 'added';
          if (payload.eventType === 'DELETE') type = 'removed';
          
          if (type !== 'removed') cachedDocs.set(d.id, d);
          else cachedDocs.delete(d.id);
          
          changes.push({ type, doc: d });
        }

        // Override docChanges to return the computed diff
        snap.docChanges = () => changes;
        
        callback(snap);
      }
    } catch (e) {
      console.error('onSnapshot fetch error:', e);
    }
  };

  fetchAndNotify();

  // Subscribe to changes on the table
  const channel = window.supabaseClient.channel('realtime-' + Math.random())
    .on('postgres_changes', { event: '*', schema: 'public', table: getTableName(q.path) }, payload => {
       fetchAndNotify(payload);
    })
    .subscribe();

  return () => {
    window.supabaseClient.removeChannel(channel);
  };
}

// Server Timestamp dummy
const serverTimestamp = () => new Date().toISOString();

window.firebaseFns = {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp
};

// Procurement Hub Data Fetchers
window.fetchSuppliers = async function() {
  const { data, error } = await window.supabaseClient.from('suppliers').select('*');
  if (error) { console.error('fetchSuppliers error:', error); return []; }
  return data;
};

window.fetchRecipeIngredients = async function() {
  const { data, error } = await window.supabaseClient
    .from('recipe_ingredients')
    .select('*, suppliers(name, contact_info)');
  if (error) { console.error('fetchRecipeIngredients error:', error); return []; }
  return data.map(ing => ({
    ...ing,
    supplierName: ing.suppliers ? ing.suppliers.name : null,
    supplierContact: ing.suppliers ? ing.suppliers.contact_info : null
  }));
};

// Universal Dual-Write Interceptor for all Supabase mutations across the entire system
function getSafeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const SERIAL_TABLES = ['event_themes', 'food_equipment_rules', 'event_setups', 'equipment_activity_logs', 'execution_settlements', 'disabled_calendar_dates', 'reservation_exec_sorted'];

function normalizeRowsWithUUID(tableName, values) {
  if (!values || SERIAL_TABLES.includes(tableName)) return values;
  if (Array.isArray(values)) {
    return values.map(v => {
      if (v && typeof v === 'object' && !Array.isArray(v) && !v.id) {
        return { id: getSafeUUID(), ...v };
      }
      return v;
    });
  } else if (typeof values === 'object') {
    if (!values.id) {
      return { id: getSafeUUID(), ...values };
    }
  }
  return values;
}

function attachDualWriteHooks(client) {
  if (!client || client.__dualWriteHooked) return;
  client.__dualWriteHooked = true;

  // 1. Intercept .from(tableName)
  const originalFrom = client.from.bind(client);
  client.from = function(tableName) {
    const builder = originalFrom(tableName);
    if (!window.supabaseBackupClient) return builder;

    function wrapMutationBuilder(mBuilder, method, payload) {
      if (!mBuilder) return mBuilder;
      const origThen = mBuilder.then.bind(mBuilder);
      mBuilder.then = function(onFulfilled, onRejected) {
        return origThen(function(result) {
          if (result && !result.error && window.supabaseBackupClient) {
            try {
              if (method === 'INSERT' || method === 'UPSERT') {
                let rows = (result.data && Array.isArray(result.data) && result.data.length > 0)
                  ? result.data
                  : (Array.isArray(payload) ? payload : [payload]);
                if (tableName === 'execution_settlements' || tableName === 'disabled_calendar_dates' || tableName === 'reservation_exec_sorted') {
                  rows = rows.map(r => {
                    if (r && typeof r === 'object') {
                      const copy = { ...r };
                      delete copy.id;
                      return copy;
                    }
                    return r;
                  });
                }
                let upsertOpts = undefined;
                if (tableName === 'execution_settlements' || tableName === 'reservation_exec_sorted') {
                  upsertOpts = { onConflict: 'reservation_id' };
                } else if (tableName === 'disabled_calendar_dates') {
                  upsertOpts = { onConflict: 'date' };
                }
                window.supabaseBackupClient.from(tableName).upsert(rows, upsertOpts)
                  .then(() => {})
                  .catch(err => console.warn(`[Dual-Write Sync] ${tableName} ${method} mirror notice:`, err));
              } else if (method === 'UPDATE') {
                const searchStr = mBuilder.url ? mBuilder.url.search : '';
                if (searchStr) {
                  fetch(`${window.SUPABASE_BACKUP_URL}/rest/v1/${encodeURIComponent(tableName)}${searchStr}`, {
                    method: 'PATCH',
                    headers: {
                      'apikey': window.SUPABASE_BACKUP_ANON,
                      'Authorization': `Bearer ${window.SUPABASE_BACKUP_ANON}`,
                      'Content-Type': 'application/json',
                      'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(payload)
                  }).catch(e => console.warn(`[Dual-Write Sync] ${tableName} UPDATE mirror notice:`, e));
                } else if (payload && payload.id) {
                  window.supabaseBackupClient.from(tableName).update(payload).eq('id', payload.id)
                    .then(() => {})
                    .catch(e => console.warn(`[Dual-Write Sync] ${tableName} UPDATE mirror notice:`, e));
                }
              } else if (method === 'DELETE') {
                const searchStr = mBuilder.url ? mBuilder.url.search : '';
                if (searchStr) {
                  fetch(`${window.SUPABASE_BACKUP_URL}/rest/v1/${encodeURIComponent(tableName)}${searchStr}`, {
                    method: 'DELETE',
                    headers: {
                      'apikey': window.SUPABASE_BACKUP_ANON,
                      'Authorization': `Bearer ${window.SUPABASE_BACKUP_ANON}`
                    }
                  }).catch(e => console.warn(`[Dual-Write Sync] ${tableName} DELETE mirror notice:`, e));
                }
              }
            } catch(mirrorErr) {
              console.warn(`[Dual-Write Sync] ${tableName} mirror exception:`, mirrorErr);
            }
          }
          if (onFulfilled) return onFulfilled(result);
          return result;
        }, onRejected);
      };
      return mBuilder;
    }

    // Intercept INSERT
    const origInsert = builder.insert ? builder.insert.bind(builder) : null;
    if (origInsert) {
      builder.insert = function(values, options) {
        const normalized = normalizeRowsWithUUID(tableName, values);
        return wrapMutationBuilder(origInsert(normalized, options), 'INSERT', normalized);
      };
    }

    // Intercept UPSERT
    const origUpsert = builder.upsert ? builder.upsert.bind(builder) : null;
    if (origUpsert) {
      builder.upsert = function(values, options) {
        const normalized = normalizeRowsWithUUID(tableName, values);
        return wrapMutationBuilder(origUpsert(normalized, options), 'UPSERT', normalized);
      };
    }

    // Intercept UPDATE
    const origUpdate = builder.update ? builder.update.bind(builder) : null;
    if (origUpdate) {
      builder.update = function(values, options) {
        return wrapMutationBuilder(origUpdate(values, options), 'UPDATE', values);
      };
    }

    // Intercept DELETE
    const origDelete = builder.delete ? builder.delete.bind(builder) : null;
    if (origDelete) {
      builder.delete = function(options) {
        return wrapMutationBuilder(origDelete(options), 'DELETE', null);
      };
    }

    return builder;
  };

  // 2. Intercept RPC
  const origRpc = client.rpc ? client.rpc.bind(client) : null;
  if (origRpc) {
    client.rpc = function(fnName, params) {
      if (window.supabaseBackupClient) {
        try {
          window.supabaseBackupClient.rpc(fnName, params)
            .then(() => {})
            .catch(err => console.warn(`[Dual-Write Sync] RPC ${fnName} mirror notice:`, err));
        } catch(e) {}
      }
      return origRpc(fnName, params);
    };
  }

  // 3. Intercept auth.signUp
  if (client.auth && !client.auth.__dualSignUpHooked) {
    client.auth.__dualSignUpHooked = true;
    const origSignUp = client.auth.signUp.bind(client.auth);
    client.auth.signUp = async function(credentials) {
      const res = await origSignUp(credentials);
      if (!res.error && window.supabaseBackupClient && window.supabaseBackupClient.auth) {
        try {
          window.supabaseBackupClient.auth.signUp(credentials)
            .then(() => {})
            .catch(err => console.warn('[Dual-Write Sync] auth.signUp mirror notice:', err));
        } catch(e) {}
      }
      return res;
    };
  }
}

// Hook current client
if (window.supabaseClient) {
  attachDualWriteHooks(window.supabaseClient);
}

// Intercept future createClient calls
if (window.supabase && !window.supabase.__createClientWrapped) {
  const origCreateClient = window.supabase.createClient.bind(window.supabase);
  window.supabase.__createClientWrapped = true;
  window.supabase.createClient = function(url, key, options) {
    const newClient = origCreateClient(url, key, options);
    if (url !== window.SUPABASE_BACKUP_URL) {
      attachDualWriteHooks(newClient);
    }
    return newClient;
  };
}


