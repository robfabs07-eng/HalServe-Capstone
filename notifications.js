// ============================================================================
// Hal'Serve Automated Email Notifications (EmailJS Integration)
// Covers Meetings, Payments, Countdown, Logistics, and Equipment Incidents.
// Compatible with both Desktop and Mobile views.
// Includes in-system Custom Template Management & Live Testing.
// ============================================================================

(function(window) {
  'use strict';

  // Default EmailJS Configuration
  const DEFAULT_CONFIG = {
    serviceId: 'service_8hcbt1e',
    publicKey: 'rKo0nYgSSEaf_NUMH',
    templateId: 'template_2v5slsl', // Hardcoded general notification template ID
    adminEmail: 'jmlenncatering@gmail.com'
  };

  // Default Editable Templates
  const DEFAULT_TEMPLATES = {
    meeting_scheduled: {
      name: "Meeting Scheduled (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Meeting Scheduled: {agenda}",
      body: "Dear {client_name},\n\nYour meeting with Halden's Catering has been scheduled for {date} at {time}.\nAgenda: {agenda}\nMeeting Room: {room_id}\n\nPlease check your Customer Portal for details.\n\nBest regards,\nHalden's Catering Services"
    },
    proposed_times_sent: {
      name: "Proposed Meeting Times (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Action Required: Choose a Meeting Time for {agenda}",
      body: "Dear {client_name},\n\nHalden's Catering has proposed meeting time slots for your {agenda}:\n\n{proposed_slots}\n\nIMPORTANT: Please select a time slot within 24 hours in your Customer Portal. If no selection is made, the reservation may be automatically cancelled.\n\nBest regards,\nHalden's Catering Services"
    },
    meeting_confirmed_by_admin: {
      name: "Meeting Time Confirmed (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Meeting Time Confirmed: {agenda}",
      body: "Dear {client_name},\n\nYour meeting for {agenda} has been confirmed for {date} at {time}.\n\nYou may view your meeting room and details in your Customer Portal.\n\nBest regards,\nHalden's Catering Services"
    },
    meeting_time_chosen_by_customer: {
      name: "Customer Selected Time (to Admin)",
      category: "Admin",
      subject: "[Hal\'Serve] Customer Selected Meeting Time: {client_name}",
      body: "Attention Admin,\n\nCustomer {client_name} has selected a meeting time slot:\nDate: {date}\nTime: {time}\nAgenda: {agenda}\nReservation ID: {reservation_id}\n\nThe meeting status is now scheduled in the Meetings Hub."
    },
    proposed_times_expired: {
      name: "Meeting Proposal Expired (to Admin)",
      category: "Admin",
      subject: "[Hal\'Serve] Meeting Proposal Expired: {client_name}",
      body: "Attention Admin,\n\nCustomer {client_name} did not select a proposed meeting time within the 24-hour deadline.\nReservation ID: {reservation_id}\nAgenda: {agenda}\n\nThe proposal has expired and the associated reservation was marked accordingly."
    },
    payment_receipt_customer: {
      name: "Payment Receipt (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Payment Receipt: {payment_type} - Ref #{reference_id}",
      body: "Dear {client_name},\n\nWe have received your payment for {payment_type}.\n\n{transaction_details}\n\nThank you for choosing Halden's Catering Services!\n\nBest regards,\nHalden's Catering Team"
    },
    payment_received_admin: {
      name: "Payment Received (to Admin)",
      category: "Admin",
      subject: "[Hal\'Serve] New Payment Received: {payment_type} - Ref #{reference_id}",
      body: "Attention Admin,\n\nA new payment transaction was submitted by {client_name}.\n\n{transaction_details}\n\nPlease inspect the transaction in your Admin Panel."
    },
    execution_countdown: {
      name: "Execution Day Countdown Update (to Customer & Admin)",
      category: "Execution",
      subject: "[Hal\'Serve] Event Execution Countdown: {days_left_text} until {package_name}",
      body: "Dear {client_name},\n\nThis is an automated countdown update for your upcoming event with Halden's Catering!\n\nEvent Details:\n- Package: {package_name}\n- Event Date: {event_date}\n- Event Time: {event_time}\n- Venue: {venue}\n- Reservation ID: {reservation_id}\n\nCountdown Status:\n{days_left_text} ({days_left} day(s) remaining until your event execution day!)\n\nOur logistics and catering teams are actively preparing everything for your special day. You can track your event progress and logistics checklist directly in your portal.\n\nBest regards,\nHalden's Catering Services"
    },
    logistics_task_completed: {
      name: "Logistics Timeline Task Completed (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Logistics Update: {task_title} Completed for Your Event",
      body: "Dear {client_name},\n\nGreat news! A logistics milestone for your upcoming catering reservation has been completed:\n\nCompleted Activity: {task_title}\nPhase / Category: {milestone_name}\nTarget Date: {task_date}\nReservation ID: {reservation_id}\nEvent: {package_name} on {event_date}\n\nOur team is actively moving forward through the preparations to ensure everything is flawless for your event.\n\nYou can view your complete timeline progress in your Customer Portal.\n\nBest regards,\nHalden's Catering Services"
    },
    equipment_incident_report: {
      name: "Equipment Incident Report Alert (to Admin)",
      category: "Admin",
      subject: "[Hal\'Serve] Equipment Incident Alert: {incident_type} - {equipment_name}",
      body: "Attention Admin & Equipment Team,\n\nAn equipment incident report has been logged:\n\nIncident Source: {source}\nEquipment Name: {equipment_name}\nAsset ID: {asset_id}\nIncident Type: {incident_type}\nQuantity Affected: {quantity}\nReported By: {reported_by}\nDate & Time: {date_time}\nReservation / Context: {reservation_id}\nNotes / Description: {notes}\n\nPlease check the Equipment Inventory & Maintenance panel in Hal'Serve to take appropriate action.\n\nBest regards,\nHal'Serve Equipment Logistics"
    },
    payment_rejected_customer: {
      name: "Payment Rejected / Dismissed (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Payment Notice: {payment_type} Declined - Ref #{reference_id}",
      body: "Dear {client_name},\n\nWe would like to inform you that your recently submitted payment proof for {payment_type} (Reservation Ref #{reference_id}) was declined or could not be verified by our administrative team.\n\nReason / Details: {reason}\n\nPlease check your Customer Portal to review your payment status and upload a valid proof of payment or complete your transaction.\n\nIf you have already settled this payment or have questions, please reach out to our team at {admin_email}.\n\nBest regards,\nHalden's Catering Services"
    },
    execution_final_summary: {
      name: "Execution Day Final Summary (to Customer & Admin)",
      category: "Execution",
      subject: "Congratulations on a Successful Event! Official Settlement Summary - {client_name} ({package_name})",
      body: "Dear {client_name},\n\nCongratulations on the successful conclusion of your event with Halden's Catering Services! Thank you for trusting our team to cater your special occasion.\n\nHere is your official final event settlement and complete payments summary:\n\nEVENT DETAILS:\n- Package: {package_name}\n- Event Date: {event_date}\n- Venue: {venue}\n- Guests: {pax} pax\n- Reservation ID: {reservation_id}\n\nALL PAYMENTS RECORD:\n- Initial Reservation Fee: PHP {init_fee} (PAID)\n- Downpayment: PHP {dp_amt} (PAID)\n- Base Final Payment: PHP {final_amt} (PAID)\n- Additional Execution Charges: PHP {additional_charges} (PAID)\n{tip_line}- Total Payments Settled: PHP {total_revenue}\n\nADDITIONAL CHARGES ITEMIZATION:\n{additional_charges_breakdown}\n\nOPERATIONS & LOGISTICS OVERVIEW:\n- Assigned Staff: {staff_count} personnel (PHP {staff_expenses})\n- Logistics & Operational Expenses: PHP {total_expenses}\n- Net Settlement Balance: PHP {net_profit}\n\nCongratulations once again, and we look forward to catering your future celebrations!\n\nBest regards,\nHalden's Catering Services"
    },
    payment_due_reminder_customer: {
      name: "Payment Due Reminder (to Customer)",
      category: "Customer",
      subject: "[Hal\'Serve] Payment Reminder: {payment_type} Due on {due_date} - Res #{reservation_id}",
      body: "Dear {client_name},\n\nThis is a friendly reminder from Halden's Catering that your {payment_type} of PHP {amount} for reservation #{reservation_id} ({package_name}) is due on {due_date} ({days_due_text}).\n\nEvent Date: {event_date}\nVenue: {venue}\nAmount Due: PHP {amount}\n\nPlease visit your Customer Portal to settle your payment online via GCash or review your payment schedule.\n\nIf you have already settled this payment or uploaded proof of payment, please disregard this notice while our administrators verify your submission.\n\nBest regards,\nHalden's Catering Services"
    },
    payment_due_reminder_admin: {
      name: "Payment Due Reminder - Unpaid Alert (to Admin)",
      category: "Admin",
      subject: "[Hal\'Serve] UNPAID ALERT: {payment_type} Due on {due_date} for {client_name} (#{reservation_id})",
      body: "Attention Admin & Accounts Team,\n\nThe following payment remains UNPAID and is due within 3 days or is past due:\n\n- Client Name: {client_name}\n- Customer Email: {to_email}\n- Reservation ID: {reservation_id}\n- Package: {package_name}\n- Event Date: {event_date}\n- Payment Type: {payment_type}\n- Amount Due: PHP {amount}\n- Payment Due Date: {due_date}\n- Status: {days_due_text} - STILL UNPAID\n\nPlease check the Reservations & Accounts panel to track or contact the client."
    }
  };

  // Universal "Disable Emails" state (persisted across all devices in Supabase system_settings)
  let _universalEmailsDisabled = (function() {
    try {
      return localStorage.getItem('smartserve_emails_disabled') === 'true';
    } catch(e) {
      return false;
    }
  })();

  // Robust parser for boolean disabled state across all storage and wire formats
  function parseDisabledValue(raw) {
    if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
    if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parseDisabledValue(parsed);
      } catch(e) {
        return false;
      }
    }
    if (raw && typeof raw === 'object') {
      if (raw.disabled !== undefined) return parseDisabledValue(raw.disabled);
      if (raw.emails_disabled !== undefined) return parseDisabledValue(raw.emails_disabled);
    }
    return false;
  }

  // Synchronize universal emails disabled state from Supabase system_settings table
  async function syncUniversalEmailSetting() {
    const sb = window.supabaseClient || window.supabase;
    if (!sb || typeof sb.from !== 'function') return _universalEmailsDisabled;
    try {
      const { data, error } = await sb
        .from('system_settings')
        .select('value')
        .eq('key', 'emails_disabled')
        .maybeSingle();
      if (!error && data && data.value !== undefined) {
        const isDisabled = parseDisabledValue(data.value);
        _universalEmailsDisabled = isDisabled;
        try {
          localStorage.setItem('smartserve_emails_disabled', isDisabled ? 'true' : 'false');
        } catch(e) {}
        try {
          const cfg = getConfig();
          cfg.emails_disabled = isDisabled;
          localStorage.setItem('smartserve_email_config', JSON.stringify(cfg));
        } catch(e) {}
        const chk = document.getElementById('cfg-disable-emails');
        if (chk) chk.checked = isDisabled;
        return isDisabled;
      }
    } catch(e) {
      // Fallback gracefully to localStorage if system_settings table has not been created yet
    }
    return _universalEmailsDisabled;
  }

  // Set universal email disabled setting (saves locally, updates Supabase, and broadcasts)
  async function setEmailsDisabled(disabled) {
    const isDis = parseDisabledValue(disabled);
    _universalEmailsDisabled = isDis;
    try {
      localStorage.setItem('smartserve_emails_disabled', isDis ? 'true' : 'false');
    } catch(e) {}
    try {
      const cfg = getConfig();
      cfg.emails_disabled = isDis;
      localStorage.setItem('smartserve_email_config', JSON.stringify(cfg));
    } catch(e) {}

    const sb = window.supabaseClient || window.supabase;
    if (sb && typeof sb.from === 'function') {
      try {
        // Attempt explicit update first
        const { data: updData, error: updErr } = await sb
          .from('system_settings')
          .update({
            value: { disabled: isDis },
            updated_at: new Date().toISOString()
          })
          .eq('key', 'emails_disabled')
          .select();

        // If no existing row was matched, perform upsert
        if (updErr || !updData || updData.length === 0) {
          await sb.from('system_settings').upsert({
            key: 'emails_disabled',
            value: { disabled: isDis },
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
        }
      } catch(e) {
        // Fallback gracefully if system_settings table has not been created yet
      }
    }

    // Broadcast across open tabs
    try {
      const bc = new BroadcastChannel('halden_live_sync');
      bc.postMessage({ type: 'EMAIL_SETTINGS_UPDATED', disabled: isDis, timestamp: Date.now() });
      setTimeout(() => { try { bc.close(); } catch(err){} }, 500);
    } catch(e) {}

    const chk = document.getElementById('cfg-disable-emails');
    if (chk) chk.checked = isDis;

    return isDis;
  }

  // Check if emails are disabled universally
  function isEmailsDisabled() {
    try {
      if (localStorage.getItem('smartserve_emails_disabled') === 'true') return true;
    } catch(e) {}
    try {
      const cfg = getConfig();
      if (cfg && (cfg.emails_disabled === true || cfg.emails_disabled === 'true')) return true;
    } catch(e) {}
    return !!_universalEmailsDisabled;
  }

  // Auto-sync universal email setting on load and subscribe to realtime changes
  if (typeof window !== 'undefined') {
    setTimeout(syncUniversalEmailSetting, 250);
    setTimeout(syncUniversalEmailSetting, 1500);

    try {
      const bc = new BroadcastChannel('halden_live_sync');
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'EMAIL_SETTINGS_UPDATED') {
          const isDis = parseDisabledValue(ev.data.disabled);
          _universalEmailsDisabled = isDis;
          try { localStorage.setItem('smartserve_emails_disabled', isDis ? 'true' : 'false'); } catch(e){}
          const chk = document.getElementById('cfg-disable-emails');
          if (chk) chk.checked = isDis;
        }
      };
    } catch(e) {}

    setTimeout(() => {
      const sb = window.supabaseClient || window.supabase;
      if (sb && typeof sb.channel === 'function') {
        try {
          sb.channel('system_settings_email_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, (payload) => {
              if (payload.new && payload.new.key === 'emails_disabled') {
                const isDis = parseDisabledValue(payload.new.value);
                _universalEmailsDisabled = isDis;
                try { localStorage.setItem('smartserve_emails_disabled', isDis ? 'true' : 'false'); } catch(e){}
                const chk = document.getElementById('cfg-disable-emails');
                if (chk) chk.checked = isDis;
              }
            })
            .subscribe();
        } catch(e) {}
      }
    }, 1200);
  }

  // Format any time string to 1-12 format with AM and PM (e.g., '14:30' -> '2:30 PM')
  function formatTimeTo12Hour(timeStr) {
    if (!timeStr) return 'TBD';
    const str = String(timeStr).trim();
    if (!str || str.toLowerCase() === 'tbd') return 'TBD';

    // If it contains a range like "14:00 - 18:00" or "14:00 to 18:00"
    if (str.includes(' - ') || str.includes(' to ')) {
      const separator = str.includes(' - ') ? ' - ' : ' to ';
      return str.split(separator).map(part => formatTimeTo12Hour(part.trim())).join(separator);
    }

    // If already contains AM or PM
    if (/\b(AM|PM)\b/i.test(str)) {
      return str.replace(/\b0?([1-9]|1[0-2]):([0-5][0-9])(?::[0-5][0-9])?\s*(AM|PM)\b/gi, (match, h, m, period) => {
        return `${parseInt(h, 10)}:${m} ${period.toUpperCase()}`;
      });
    }

    // 24-hour time like "14:30" or "09:15:00"
    const m24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m24) {
      let hours = parseInt(m24[1], 10);
      const minutes = m24[2];
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${period}`;
    }

    // ISO timestamp like "2026-10-13T14:30:00"
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

  // Format Date & Time object or string with 12-hour AM/PM format
  function formatDateTimeWith12Hour(d) {
    if (!d) return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const dateObj = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dateObj.getTime())) {
      return String(d);
    }
    return dateObj.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Get active configuration
  function getConfig() {
    try {
      const saved = localStorage.getItem('smartserve_email_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Object.assign({}, DEFAULT_CONFIG, parsed, { templateId: 'template_2v5slsl', serviceId: 'service_8hcbt1e' });
      }
    } catch(e) {}
    return Object.assign({}, DEFAULT_CONFIG);
  }

  // Save configuration (locally + Supabase system_settings if available)
  function saveConfig(cfg) {
    try {
      const merged = Object.assign({}, getConfig(), cfg);
      localStorage.setItem('smartserve_email_config', JSON.stringify(merged));

      // Asynchronously persist to Supabase so it's shared across all admin devices
      const sb = window.supabaseClient || window.supabase;
      if (sb && typeof sb.from === 'function') {
        sb.from('system_settings').upsert({
          key: 'email_config',
          value: merged,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' }).then(() => {}).catch(() => {});
      }

      return true;
    } catch(e) {
      console.error("[Hal'Serve Notifications] Failed to save config:", e);
      return false;
    }
  }

  // Sync email config from Supabase system_settings
  async function syncEmailConfig() {
    const sb = window.supabaseClient || window.supabase;
    if (!sb || typeof sb.from !== 'function') return getConfig();
    try {
      const { data, error } = await sb
        .from('system_settings')
        .select('value')
        .eq('key', 'email_config')
        .maybeSingle();
      if (!error && data && data.value) {
        const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        const merged = Object.assign({}, getConfig(), val);
        localStorage.setItem('smartserve_email_config', JSON.stringify(merged));
        return merged;
      }
    } catch(e) {}
    return getConfig();
  }

  // Get active templates (customized or defaults)
  function getTemplates() {
    try {
      const saved = localStorage.getItem('smartserve_email_templates');
      if (saved) {
        const parsed = JSON.parse(saved);
        const result = {};
        for (const k in DEFAULT_TEMPLATES) {
          const item = Object.assign({}, DEFAULT_TEMPLATES[k], parsed[k] || {});
          if (typeof item.subject === 'string') {
            item.subject = item.subject.replace(/\[SmartServe\]/g, "[Hal\'Serve]").replace(/SmartServe/g, "Hal'Serve");
          }
          if (typeof item.body === 'string') {
            item.body = item.body.replace(/SmartServe/g, "Hal'Serve");
          }
          result[k] = item;
        }
        return result;
      }
    } catch(e) {}
    return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  }

  // Save customized templates
  function saveTemplates(templates) {
    try {
      localStorage.setItem('smartserve_email_templates', JSON.stringify(templates));
      return true;
    } catch(e) {
      console.error("[Hal'Serve Notifications] Failed to save templates:", e);
      return false;
    }
  }

  // Reset template to default
  function resetTemplate(key) {
    const cur = getTemplates();
    if (key && DEFAULT_TEMPLATES[key]) {
      cur[key] = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES[key]));
      saveTemplates(cur);
      return cur[key];
    } else {
      localStorage.removeItem('smartserve_email_templates');
      return getTemplates();
    }
  }

  // Interpolate placeholders (ensures times are 1-12 format with AM/PM)
  function interpolate(text, vars) {
    if (!text) return '';
    return text.replace(/\{([a-zA-Z0-9_]+)\}/g, function(match, key) {
      if (!vars || vars[key] === undefined || vars[key] === null) return match;
      let val = vars[key];
      if (key === 'time' || key === 'event_time') {
        val = formatTimeTo12Hour(val);
      }
      return String(val);
    });
  }

  let _lastSendError = null;
  function getLastSendError() {
    return _lastSendError;
  }

  // Core sender function (with direct REST API fallback and full parameter aliasing)
  async function sendEmailNotification(templateParams, isExplicitTest = false) {
    _lastSendError = null;

    if (!templateParams) {
      _lastSendError = "Missing email parameters.";
      return false;
    }

    // Explicit test emails bypass the disable-toggle so admins can test anytime
    if (!isExplicitTest && isEmailsDisabled()) {
      _lastSendError = "Email sending skipped: 'Disable automated emails' is currently toggled ON in Email Notification Templates.";
      console.log("[Hal'Serve Notifications] Email sending skipped because 'Disable emails' is active in Email Templates settings.", templateParams.subject);
      return true;
    }

    const cfg = getConfig();
    const serviceId = 'service_8hcbt1e';
    const templateId = 'template_2v5slsl';
    const publicKey = (cfg && cfg.publicKey) || 'rKo0nYgSSEaf_NUMH';

    const targetEmail = templateParams.to_email || templateParams.email || templateParams.user_email || templateParams.recipient || (cfg && cfg.adminEmail) || '';
    const targetName = templateParams.to_name || templateParams.client_name || templateParams.name || 'Valued Customer';
    const msgContent = templateParams.message || templateParams.content || templateParams.body || '';
    const subjectLine = templateParams.subject || "[Hal'Serve] Notification";

    if (!targetEmail || !targetEmail.includes('@')) {
      _lastSendError = "Invalid recipient email address: " + targetEmail;
      console.warn("[Hal'Serve Notifications]", _lastSendError);
      return false;
    }

    // Build exhaustive template parameter aliases to match ANY EmailJS template variable names
    const payload = Object.assign({}, templateParams, {
      to_email: targetEmail,
      email: targetEmail,
      user_email: targetEmail,
      recipient: targetEmail,
      client_email: targetEmail,
      to: targetEmail,
      reply_to: targetEmail,
      to_name: targetName,
      client_name: targetName,
      from_name: "Halden's Catering Services",
      subject: subjectLine,
      title: subjectLine,
      message: msgContent,
      content: msgContent,
      body: msgContent,
      otp_code: templateParams.otp_code || '(Notification)'
    });

    console.log("[Hal'Serve Notifications] Sending email notification:", {
      type: templateParams.notification_type || (isExplicitTest ? 'test_email' : 'generic'),
      to: targetEmail,
      subject: subjectLine,
      templateId: templateId,
      serviceId: serviceId
    });

    // Strategy 1: Try window.emailjs browser SDK if loaded and functional
    if (typeof emailjs !== 'undefined' && typeof emailjs.send === 'function') {
      try {
        try { emailjs.init(publicKey); } catch(e) {}
        const response = await emailjs.send(serviceId, templateId, payload, publicKey);
        console.log("[Hal'Serve Notifications] Email sent successfully via EmailJS SDK:", response.status, response.text);
        _lastSendError = null;
        return true;
      } catch (err) {
        console.warn("[Hal'Serve Notifications] EmailJS SDK send error, trying direct REST API fallback:", err);
      }
    }

    // Strategy 2: Direct REST API call (works without SDK, immune to ad-blockers, supports CORS)
    try {
      const restRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: payload
        })
      });

      if (restRes.ok) {
        console.log("[Hal'Serve Notifications] Email sent successfully via EmailJS REST API!");
        _lastSendError = null;
        return true;
      } else {
        const errText = await restRes.text().catch(() => '');
        _lastSendError = `EmailJS error (HTTP ${restRes.status}): ${errText || 'Delivery rejected'}`;
        console.warn("[Hal'Serve Notifications] REST API response error:", restRes.status, errText);
        return false;
      }
    } catch (restErr) {
      const errDetails = (restErr && (restErr.text || restErr.message)) || (typeof restErr === 'string' ? restErr : 'Network error');
      _lastSendError = `Email delivery failed: ${errDetails}. Please verify internet connection.`;
      console.warn("[Hal'Serve Notifications] Direct REST send failed:", restErr);
      return false;
    }
  }

  // Helper to query admin email
  async function resolveAdminEmail() {
    const cfg = getConfig();
    if (cfg.adminEmail) return cfg.adminEmail;
    if (window._smartServeAdminEmail) return window._smartServeAdminEmail;
    if (window.supabaseClient) {
      try {
        const { data } = await window.supabaseClient
          .from('users')
          .select('email, role')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        if (data && data.email) {
          window._smartServeAdminEmail = data.email;
          return data.email;
        }
      } catch(e) {}
    }
    return DEFAULT_CONFIG.adminEmail;
  }

  // 1. Admin schedules a meeting -> notify Customer email
  async function notifyCustomerMeetingScheduled(data) {
    if (!data.customerEmail) return;
    const client = data.customerName || 'Valued Client';
    const dateFormatted = data.date || 'TBD';
    const timeFormatted = formatTimeTo12Hour(data.time);
    const agendaText = data.agenda || 'Event Consultation';
    const roomId = data.roomId || 'N/A';
    const resId = data.reservationId || 'N/A';

    const tpl = getTemplates().meeting_scheduled;
    const vars = {
      client_name: client,
      to_name: client,
      to_email: data.customerEmail,
      date: dateFormatted,
      time: timeFormatted,
      agenda: agendaText,
      room_id: roomId,
      reservation_id: resId
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: data.customerEmail,
      to_name: client,
      subject: subject,
      message: message,
      notification_type: 'meeting_scheduled',
      meeting_date: dateFormatted,
      meeting_time: timeFormatted,
      meeting_agenda: agendaText,
      room_id: roomId,
      reservation_id: resId
    });
  }

  // 2. Admin inputs proposed meeting times -> notify Customer email
  async function notifyCustomerProposedTimes(data) {
    if (!data.customerEmail) return;
    const client = data.customerName || 'Valued Client';
    const agendaText = data.agenda || 'Consultation';
    const slots = Array.isArray(data.proposedSlots) ? data.proposedSlots : [];
    const slotListStr = slots.map((s, i) => `${i + 1}) ${s.date} from ${formatTimeTo12Hour(s.start)} to ${formatTimeTo12Hour(s.end || 'TBD')}`).join('\n');
    const resId = data.reservationId || 'N/A';

    const tpl = getTemplates().proposed_times_sent;
    const vars = {
      client_name: client,
      to_name: client,
      to_email: data.customerEmail,
      agenda: agendaText,
      proposed_slots: slotListStr,
      deadline: '24 Hours',
      reservation_id: resId
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: data.customerEmail,
      to_name: client,
      subject: subject,
      message: message,
      notification_type: 'proposed_times_sent',
      meeting_agenda: agendaText,
      proposed_slots: slotListStr,
      deadline: '24 Hours',
      reservation_id: resId
    });
  }

  // 3. Admin manually picks a proposed meeting time -> notify Customer email
  async function notifyCustomerMeetingManuallyLocked(data) {
    if (!data.customerEmail) return;
    const client = data.customerName || 'Valued Client';
    const dateFormatted = data.date || 'TBD';
    const timeFormatted = formatTimeTo12Hour(data.time);
    const agendaText = data.agenda || 'Consultation';
    const resId = data.reservationId || 'N/A';
    const roomId = data.roomId || 'N/A';

    const tpl = getTemplates().meeting_confirmed_by_admin;
    const vars = {
      client_name: client,
      to_name: client,
      to_email: data.customerEmail,
      date: dateFormatted,
      time: timeFormatted,
      agenda: agendaText,
      room_id: roomId,
      reservation_id: resId
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: data.customerEmail,
      to_name: client,
      subject: subject,
      message: message,
      notification_type: 'meeting_confirmed_by_admin',
      meeting_date: dateFormatted,
      meeting_time: timeFormatted,
      meeting_agenda: agendaText,
      room_id: roomId,
      reservation_id: resId
    });
  }

  // 4. Customer chose a proposed meeting time -> notify Admin email
  async function notifyAdminCustomerChoseMeetingTime(data) {
    const adminEmail = await resolveAdminEmail();
    const client = data.customerName || 'Customer';
    const dateFormatted = data.date || 'TBD';
    const timeFormatted = formatTimeTo12Hour(data.time);
    const agendaText = data.agenda || 'Consultation';
    const resId = data.reservationId || 'N/A';

    const tpl = getTemplates().meeting_time_chosen_by_customer;
    const vars = {
      client_name: client,
      date: dateFormatted,
      time: timeFormatted,
      agenda: agendaText,
      reservation_id: resId
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: adminEmail,
      to_name: "Hal'Serve Admin",
      subject: subject,
      message: message,
      notification_type: 'meeting_time_chosen_by_customer',
      client_name: client,
      meeting_date: dateFormatted,
      meeting_time: timeFormatted,
      meeting_agenda: agendaText,
      reservation_id: resId
    });
  }

  // 5. Customer did not choose a proposed time before due time -> notify Admin email
  async function notifyAdminMeetingProposalExpired(data) {
    const adminEmail = await resolveAdminEmail();
    const client = data.customerName || 'Customer';
    const agendaText = data.agenda || 'Consultation';
    const resId = data.reservationId || 'N/A';

    const tpl = getTemplates().proposed_times_expired;
    const vars = {
      client_name: client,
      agenda: agendaText,
      reservation_id: resId
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: adminEmail,
      to_name: "Hal'Serve Admin",
      subject: subject,
      message: message,
      notification_type: 'proposed_times_expired',
      client_name: client,
      meeting_agenda: agendaText,
      reservation_id: resId
    });
  }

  // 6. Every time a payment was made -> notify BOTH Admin and Customer
  async function notifyPaymentMade(data) {
    const adminEmail = await resolveAdminEmail();
    const client = data.customerName || 'Customer';
    const refId = data.referenceId || data.refId || data.referenceNumber || 'N/A';
    const feeType = data.paymentType || data.feeType || 'Payment';
    const amountVal = Number(data.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const method = (data.paymentMethod || 'GCash').toUpperCase();
    const txDate = formatDateTimeWith12Hour(data.transactionDate);
    const resId = data.reservationId || 'N/A';

    let transactionDetails = `----------------------------------------\n` +
      `TRANSACTION DETAILS\n` +
      `----------------------------------------\n` +
      `Client: ${client}\n` +
      `Reservation ID: ${resId}\n` +
      `Payment Type: ${feeType}\n` +
      `Amount Paid: PHP ${amountVal}\n` +
      `Payment Method: ${method}\n` +
      `Reference ID: ${refId}\n` +
      `Date & Time: ${txDate}\n`;
    if (data.cashReceived !== undefined && data.cashReceived !== null && Number(data.cashReceived) > 0) {
      transactionDetails += `Cash Received: PHP ${Number(data.cashReceived).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    }
    if (data.changeGiven !== undefined && data.changeGiven !== null && Number(data.changeGiven) >= 0) {
      transactionDetails += `Change Given: PHP ${Number(data.changeGiven).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    }
    if (data.notes) {
      transactionDetails += `Notes: ${data.notes}\n`;
    }
    transactionDetails += `----------------------------------------`;

    const vars = {
      client_name: client,
      to_name: client,
      reservation_id: resId,
      payment_type: feeType,
      amount: `PHP ${amountVal}`,
      payment_method: method,
      reference_id: refId,
      transaction_date: txDate,
      transaction_details: transactionDetails
    };

    // 6a. Notify Customer
    if (data.customerEmail) {
      const custTpl = getTemplates().payment_receipt_customer;
      const custSubject = interpolate(custTpl.subject, vars);
      const custMessage = interpolate(custTpl.body, vars);

      await sendEmailNotification({
        to_email: data.customerEmail,
        to_name: client,
        subject: custSubject,
        message: custMessage,
        notification_type: 'payment_receipt_customer',
        reference_id: refId,
        amount: `PHP ${amountVal}`,
        payment_type: feeType,
        payment_method: method,
        transaction_date: txDate,
        transaction_details: transactionDetails
      });
    }

    // 6b. Notify Admin
    const adminTpl = getTemplates().payment_received_admin;
    const adminSubject = interpolate(adminTpl.subject, vars);
    const adminMessage = interpolate(adminTpl.body, vars);

    await sendEmailNotification({
      to_email: adminEmail,
      to_name: "Hal'Serve Admin",
      subject: adminSubject,
      message: adminMessage,
      notification_type: 'payment_received_admin',
      reference_id: refId,
      amount: `PHP ${amountVal}`,
      payment_type: feeType,
      payment_method: method,
      transaction_date: txDate,
      transaction_details: transactionDetails
    });
  }

  // 6c. Admin rejects or dismisses payment -> Notify Customer
  async function notifyPaymentRejected(data) {
    if (!data || !data.customerEmail) return false;
    const client = data.customerName || 'Valued Customer';
    const feeType = data.feeType || data.paymentType || 'Payment';
    const refId = data.referenceId || data.referenceNumber || 'N/A';
    const resId = data.reservationId || 'N/A';
    const reason = data.reason || 'Payment proof could not be verified or was rejected by admin.';
    const adminEmail = await resolveAdminEmail();

    const tpl = getTemplates().payment_rejected_customer || DEFAULT_TEMPLATES.payment_rejected_customer;
    const vars = {
      client_name: client,
      to_name: client,
      to_email: data.customerEmail,
      payment_type: feeType,
      reference_id: refId,
      reservation_id: resId,
      reason: reason,
      admin_email: adminEmail
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: data.customerEmail,
      to_name: client,
      subject: subject,
      message: message,
      notification_type: 'payment_rejected_customer',
      payment_type: feeType,
      reference_id: refId,
      reservation_id: resId,
      reason: reason
    });
  }

  // 7. Execution Day countdown decrements -> notify BOTH Customer and Admin
  async function notifyExecutionDayCountdown(data) {
    const res = data.res || {};
    const client = data.customerName || res.client_name || res.name || 'Valued Client';
    const custEmail = data.customerEmail || res.email || res.client_email;
    const daysLeft = (typeof data.daysLeft === 'number') ? data.daysLeft : parseInt(data.daysLeft, 10);
    const resId = data.reservationId || res.id || res.reference_id || 'N/A';
    const pkgName = data.packageName || res.package || res.packageName || 'Catering Package';
    const eventDate = data.eventDate || res.date || 'TBD';
    const eventTime = formatTimeTo12Hour(data.eventTime || res.time || res.startTime || 'TBD');
    const venue = data.venue || res.venue || 'Client Venue';

    let daysLeftText = '';
    if (daysLeft === 0) {
      daysLeftText = 'Event Day is TODAY!';
    } else if (daysLeft === 1) {
      daysLeftText = '1 Day Remaining (Tomorrow)';
    } else {
      daysLeftText = `${daysLeft} Days Remaining`;
    }

    const tpl = getTemplates().execution_countdown;
    const vars = {
      client_name: client,
      to_name: client,
      to_email: custEmail,
      package_name: pkgName,
      event_date: eventDate,
      event_time: eventTime,
      venue: venue,
      days_left: String(daysLeft),
      days_left_text: daysLeftText,
      reservation_id: resId
    };

    // 7a. Notify Customer if email is available
    if (custEmail) {
      const custSubject = interpolate(tpl.subject, vars);
      const custMessage = interpolate(tpl.body, vars);
      await sendEmailNotification({
        to_email: custEmail,
        to_name: client,
        subject: custSubject,
        message: custMessage,
        notification_type: 'execution_countdown_customer',
        package_name: pkgName,
        event_date: eventDate,
        event_time: eventTime,
        venue: venue,
        days_left: String(daysLeft),
        days_left_text: daysLeftText,
        reservation_id: resId
      });
    }

    // 7b. Notify Admin
    const adminEmail = await resolveAdminEmail();
    const adminVars = Object.assign({}, vars, { to_name: "Hal'Serve Admin", to_email: adminEmail });
    const adminSubject = `[Hal\'Serve] Event Countdown Alert: ${daysLeftText} for ${client} (${resId})`;
    const adminMessage = `Attention Admin & Logistics Team,\n\nExecution day countdown update for upcoming reservation:\n\n- Client: ${client}\n- Reservation ID: ${resId}\n- Package: ${pkgName}\n- Event Date: ${eventDate}\n- Event Time: ${eventTime}\n- Venue: ${venue}\n- Days Remaining: ${daysLeft} day(s) (${daysLeftText})\n\nPlease ensure all logistics, equipment allocation, and resource preparations are properly on schedule.\n\nHal'Serve Automated Logistics System`;

    await sendEmailNotification({
      to_email: adminEmail,
      to_name: "Hal'Serve Admin",
      subject: adminSubject,
      message: adminMessage,
      notification_type: 'execution_countdown_admin',
      package_name: pkgName,
      event_date: eventDate,
      event_time: eventTime,
      venue: venue,
      days_left: String(daysLeft),
      days_left_text: daysLeftText,
      reservation_id: resId
    });
  }

  // 8. Logistics timeline task checked -> notify Customer
  async function notifyLogisticsTaskCompleted(data) {
    const custEmail = data.customerEmail;
    if (!custEmail) return;
    const client = data.customerName || 'Valued Client';
    const taskTitle = data.taskTitle || 'Logistics Task';
    const taskDate = data.taskDate || 'Scheduled Date';
    const msName = data.milestoneName || 'LOGISTICS PREPARATION';
    const resId = data.reservationId || 'N/A';
    const pkgName = data.packageName || 'Catering Package';
    const eventDate = data.eventDate || 'Scheduled Event Date';

    const tpl = getTemplates().logistics_task_completed;
    const vars = {
      client_name: client,
      to_name: client,
      to_email: custEmail,
      task_title: taskTitle,
      task_date: taskDate,
      milestone_name: msName,
      reservation_id: resId,
      package_name: pkgName,
      event_date: eventDate
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: custEmail,
      to_name: client,
      subject: subject,
      message: message,
      notification_type: 'logistics_task_completed',
      task_title: taskTitle,
      task_date: taskDate,
      milestone_name: msName,
      reservation_id: resId,
      package_name: pkgName,
      event_date: eventDate
    });
  }

  // 9. Equipment incident occurs -> notify Admin
  async function notifyEquipmentIncident(data) {
    const adminEmail = await resolveAdminEmail();
    const eqName = data.equipmentName || data.name || 'Equipment Item';
    const assetId = data.assetId || 'N/A';
    const incType = data.incidentType || data.type || 'Incident';
    const qty = data.quantity || data.qty || 1;
    const src = data.source || 'General Incident';
    const reporter = data.reportedBy || data.checked_by || 'Staff';
    const dt = formatDateTimeWith12Hour(data.dateTime);
    const resId = data.reservationId || 'N/A';
    const notes = data.notes || 'None provided';

    const tpl = getTemplates().equipment_incident_report;
    const vars = {
      equipment_name: eqName,
      asset_id: assetId,
      incident_type: incType,
      quantity: String(qty),
      source: src,
      reported_by: reporter,
      date_time: dt,
      reservation_id: resId,
      notes: notes,
      to_email: adminEmail,
      to_name: "Hal'Serve Admin"
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    return await sendEmailNotification({
      to_email: adminEmail,
      to_name: "Hal'Serve Admin",
      subject: subject,
      message: message,
      notification_type: 'equipment_incident_report',
      equipment_name: eqName,
      asset_id: assetId,
      incident_type: incType,
      quantity: String(qty),
      source: src,
      reported_by: reporter,
      date_time: dt,
      reservation_id: resId,
      notes: notes
    });
  }

  // 10. Send a test email for any template
  async function sendTestEmail(templateKey, targetEmail, customOverrides = null) {
    if (!targetEmail) throw new Error('Recipient email address is required.');
    const sampleVars = {
      client_name: 'Sample Customer',
      to_name: 'Sample Customer',
      to_email: targetEmail,
      date: new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: '02:00 PM',
      agenda: 'Initial Event Consultation',
      room_id: 'VC-TEST-999',
      reservation_id: 'RES-TEST-001',
      proposed_slots: "1) Oct 20, 2026 from 10:00 AM to 11:00 AM\n2) Oct 21, 2026 from 02:00 PM to 03:00 PM\n3) Oct 22, 2026 from 04:00 PM to 05:00 PM",
      deadline: '24 Hours',
      payment_type: 'Downpayment',
      amount: 'PHP 5,000.00',
      payment_method: 'GCASH',
      reference_id: 'REF-TEST-888',
      transaction_date: new Date().toLocaleString('en-PH'),
      transaction_details: "----------------------------------------\nTRANSACTION DETAILS (TEST)\n----------------------------------------\nClient: Sample Customer\nReservation ID: RES-TEST-001\nPayment Type: Downpayment\nAmount: PHP 5,000.00\nPayment Method: GCASH\nReference ID: REF-TEST-888\nDate & Time: " + new Date().toLocaleString('en-PH') + "\n----------------------------------------",
      days_left: '4',
      days_left_text: '4 Days Remaining',
      package_name: 'try ulet Package',
      event_date: 'Saturday, Oct 17, 2026',
      event_time: '8:35 AM - 8:35 PM',
      venue: 'STI Caloocan, Samson Road, Caloocan, Metro Manila',
      task_title: 'Ingredient Procurement',
      task_date: 'Thu, Oct 15, 2026',
      milestone_name: 'RESOURCE PREPARATION',
      equipment_name: 'Chafing Dish Set - Roll Top 9L',
      asset_id: 'EQ-CDF-001',
      incident_type: 'Broken / Damaged',
      quantity: '2',
      source: 'Routine Checking Session',
      reported_by: 'Staff John',
      date_time: new Date().toLocaleString('en-PH'),
      notes: 'Handle hinge loose and cracked during transit',
      reason: 'Uploaded screenshot is blurry or reference number does not match transaction record.',
      due_date: 'Oct 25, 2026',
      days_due: '2',
      days_due_text: 'Due in 2 days',
      admin_email: 'jmlenncatering@gmail.com'
    };

    const templates = getTemplates();
    const tpl = templates[templateKey] || DEFAULT_TEMPLATES[templateKey] || DEFAULT_TEMPLATES.meeting_scheduled;

    const rawSubj = (customOverrides && customOverrides.subject !== undefined) ? customOverrides.subject : (tpl && tpl.subject ? tpl.subject : "[Hal\'Serve] Notification");
    const rawBody = (customOverrides && customOverrides.body !== undefined) ? customOverrides.body : (tpl && tpl.body ? tpl.body : "Notification message");

    const subject = "[TEST] " + interpolate(rawSubj, sampleVars);
    const message = interpolate(rawBody, sampleVars);

    // Pass isExplicitTest = true so test sends bypass the disable-toggle
    const ok = await sendEmailNotification({
      to_email: targetEmail,
      to_name: sampleVars.client_name,
      subject: subject,
      message: message,
      otp_code: 'TEST-123456',
      notification_type: 'test_' + (templateKey || 'sample')
    }, true);

    if (ok) {
      return { success: true };
    } else {
      return { success: false, reason: _lastSendError || 'EmailJS failed to deliver the test email.' };
    }
  }

  // 11. Final Summary Notification for Execution Day (Admin & Customer)
  async function notifyExecutionFinalSummary(data) {
    if (!data) return false;
    const res = data.reservation || {};
    const client = data.customerName || res.client || res.name || res.client_name || res.customerName || 'Valued Client';
    const pkg = data.packageName || res.packageName || res.package || res.premadePackageName || 'Catering Package';
    const dateFormatted = data.eventDate || res.date || res.eventDate || res.event_date || 'N/A';
    const venue = data.venue || res.venue || res.venueAddress || res.venue_location || 'N/A';
    const pax = data.pax || res.pax || res.guests || res.guest_count || 'N/A';
    const resId = data.resId || res.id || 'N/A';

    const initFee = parseFloat(data.initFee || res.initialBookingFee || res.initial_booking_fee || 5000) || 5000;
    const dpAmt = parseFloat(data.dpAmt || res.downpayment || res.downpaymentAmount || 0) || 0;
    const finalAmt = parseFloat(data.finalAmt || res.finalPayment || res.final_payment || 0) || 0;
    const addCharges = parseFloat(data.subtotalAdditionalCharges || data.totalCharges || res.exec_total_charges || res.additional_charges || 0) || 0;
    const tipVal = parseFloat(data.tip || res.exec_tip || 0) || 0;
    const tipAmt = tipVal.toLocaleString();
    const tipLine = tipVal > 0 ? `- Client Gratuity / Tip: PHP ${tipAmt} (PAID)\n` : '';
    const totRev = parseFloat(data.totalRevenue || res.exec_total_revenue || (initFee + dpAmt + finalAmt + addCharges + tipVal)) || (initFee + dpAmt + finalAmt + addCharges + tipVal);
    const totExp = parseFloat(data.totalExpenses || res.exec_total_expenses || 0) || 0;
    const netProf = parseFloat(data.netProfit || res.exec_net_profit || (totRev - totExp)) || (totRev - totExp);
    const staffCount = Array.isArray(data.assignments) ? data.assignments.length : (data.staffCount || 0);
    const staffExp = parseFloat(data.staffTotal || res.exec_staff_expense_amount || staffCount * 1000) || (staffCount * 1000);

    let breakdownParts = [];
    if (data.extraItemsBreakdown && Array.isArray(data.extraItemsBreakdown) && data.extraItemsBreakdown.length > 0) {
      data.extraItemsBreakdown.forEach(it => {
        breakdownParts.push(`- + ${it.name || 'Additional Item'}: PHP ${(it.price || 0).toLocaleString()}`);
      });
    } else if (data.extraItemsTotal > 0) {
      breakdownParts.push(`- Additional Package Items: PHP ${parseFloat(data.extraItemsTotal).toLocaleString()}`);
    }
    if (data.otcAmt > 0) breakdownParts.push(`- Out of Town Surcharge: PHP ${parseFloat(data.otcAmt).toLocaleString()}`);
    if (data.svcAmt > 0) breakdownParts.push(`- Service Charge: PHP ${parseFloat(data.svcAmt).toLocaleString()}`);
    if (data.overheadUnits > 0) breakdownParts.push(`- Extra Overhead (${data.overheadUnits} units @ PHP 450): PHP ${(data.overheadAmt || data.overheadUnits * 450).toLocaleString()}`);
    if (data.overtimeUnits > 0) breakdownParts.push(`- Overtime Charge (${data.overtimeUnits} hrs @ PHP 1,000): PHP ${(data.overtimeAmt || data.overtimeUnits * 1000).toLocaleString()}`);
    if (data.floorUnits > 0) breakdownParts.push(`- Venue Floor Accessibility (${data.floorUnits} floors @ PHP 100): PHP ${(data.floorAmt || data.floorUnits * 100).toLocaleString()}`);
    if (data.incCharge > 0) breakdownParts.push(`- Incident Charges: PHP ${parseFloat(data.incCharge).toLocaleString()}`);
    const breakdownText = breakdownParts.length > 0 ? breakdownParts.join('\n') : '- No extra charges assessed.';

    const tpl = getTemplates().execution_final_summary || DEFAULT_TEMPLATES.execution_final_summary;
    const vars = {
      client_name: client,
      to_name: client,
      package_name: pkg,
      event_date: dateFormatted,
      venue: venue,
      pax: pax,
      reservation_id: resId,
      init_fee: initFee.toLocaleString(),
      dp_amt: dpAmt.toLocaleString(),
      final_amt: finalAmt.toLocaleString(),
      additional_charges: addCharges.toLocaleString(),
      tip_amount: tipAmt,
      tip_line: tipLine,
      total_revenue: totRev.toLocaleString(),
      total_expenses: totExp.toLocaleString(),
      net_profit: netProf.toLocaleString(),
      staff_count: String(staffCount),
      staff_expenses: staffExp.toLocaleString(),
      additional_charges_breakdown: breakdownText
    };

    const subject = interpolate(tpl.subject, vars);
    const message = interpolate(tpl.body, vars);

    const adminEmail = await resolveAdminEmail();
    const custEmail = data.customerEmail || res.email || res.client_email || res.customerEmail || '';

    // Send to customer
    let custSent = false;
    if (custEmail) {
      try {
        custSent = await sendEmailNotification({
          to_email: custEmail,
          to_name: client,
          subject: subject,
          message: message,
          notification_type: 'execution_final_summary_customer',
          reservation_id: resId
        });
      } catch(e) {
        console.warn("[Hal'Serve Notifications] Customer final summary email failed:", e);
      }
    }

    // Send to admin
    let adminSent = false;
    if (adminEmail && adminEmail !== custEmail) {
      try {
        adminSent = await sendEmailNotification({
          to_email: adminEmail,
          to_name: "Hal'Serve Admin",
          subject: "[ADMIN COPY] " + subject,
          message: "ATTENTION ADMIN - OFFICIAL FINAL SETTLEMENT SUMMARY RECORD:\n\n" + message,
          notification_type: 'execution_final_summary_admin',
          reservation_id: resId
        });
      } catch(e) {
        console.warn("[Hal'Serve Notifications] Admin final summary email failed:", e);
      }
    }

    return custSent || adminSent;
  }
  window.notifyExecutionFinalSummary = notifyExecutionFinalSummary;

  // 12. Downpayment & Final Payment Due Date Reminder (within 3 days or overdue)
  // Notifies Customer with reminder & payment instructions
  // Notifies Admin alerting that the payment is STILL UNPAID
  async function notifyPaymentDueReminder(data) {
    if (!data) return false;
    const client = data.customerName || data.clientName || 'Valued Client';
    const custEmail = data.customerEmail || data.clientEmail || '';
    const resId = data.reservationId || data.resId || 'N/A';
    const pkgName = data.packageName || data.package || 'Catering Package';
    const eventDate = data.eventDate || 'TBD';
    const venue = data.venue || 'Client Venue';
    const feeType = data.paymentType || data.feeType || 'Payment';
    const dueDate = data.dueDate || 'TBD';
    const daysDue = (typeof data.daysDue === 'number') ? data.daysDue : parseInt(data.daysDue, 10);
    const amountVal = Number(data.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let daysDueText = '';
    if (isNaN(daysDue)) {
      daysDueText = 'Due Soon';
    } else if (daysDue < 0) {
      daysDueText = `${Math.abs(daysDue)} day(s) OVERDUE`;
    } else if (daysDue === 0) {
      daysDueText = 'Due TODAY';
    } else if (daysDue === 1) {
      daysDueText = 'Due Tomorrow (1 day remaining)';
    } else {
      daysDueText = `Due in ${daysDue} days`;
    }

    const vars = {
      client_name: client,
      to_name: client,
      to_email: custEmail,
      reservation_id: resId,
      package_name: pkgName,
      event_date: eventDate,
      venue: venue,
      payment_type: feeType,
      amount: amountVal,
      due_date: dueDate,
      days_due: String(daysDue),
      days_due_text: daysDueText
    };

    const templates = getTemplates();
    const custTpl = templates.payment_due_reminder_customer || DEFAULT_TEMPLATES.payment_due_reminder_customer;
    const adminTpl = templates.payment_due_reminder_admin || DEFAULT_TEMPLATES.payment_due_reminder_admin;

    // 12a. Send to customer
    let custSent = false;
    if (custEmail) {
      const custSubject = interpolate(custTpl.subject, vars);
      const custMessage = interpolate(custTpl.body, vars);
      try {
        custSent = await sendEmailNotification({
          to_email: custEmail,
          to_name: client,
          subject: custSubject,
          message: custMessage,
          notification_type: 'payment_due_reminder_customer',
          payment_type: feeType,
          reservation_id: resId,
          amount: `PHP ${amountVal}`,
          due_date: dueDate,
          days_due_text: daysDueText
        });
      } catch (err) {
        console.warn("[Hal'Serve Notifications] Customer payment due reminder email failed:", err);
      }
    }

    // 12b. Send to admin alerting that payment is UNPAID
    let adminSent = false;
    const adminEmail = await resolveAdminEmail();
    if (adminEmail) {
      const adminVars = Object.assign({}, vars, { to_name: "Hal'Serve Admin", to_email: custEmail || 'N/A' });
      const adminSubject = interpolate(adminTpl.subject, adminVars);
      const adminMessage = interpolate(adminTpl.body, adminVars);
      try {
        adminSent = await sendEmailNotification({
          to_email: adminEmail,
          to_name: "Hal'Serve Admin",
          subject: adminSubject,
          message: adminMessage,
          notification_type: 'payment_due_reminder_admin',
          payment_type: feeType,
          reservation_id: resId,
          amount: `PHP ${amountVal}`,
          due_date: dueDate,
          days_due_text: daysDueText
        });
      } catch (err) {
        console.warn("[Hal'Serve Notifications] Admin payment due reminder email failed:", err);
      }
    }

    return custSent || adminSent;
  }
  window.notifyPaymentDueReminder = notifyPaymentDueReminder;

  // Export methods globally
  const notificationsApi = {
    DEFAULT_CONFIG,
    isEmailsDisabled,
    syncUniversalEmailSetting,
    setEmailsDisabled,
    formatTimeTo12Hour,
    formatDateTimeWith12Hour,
    DEFAULT_TEMPLATES,
    getConfig,
    saveConfig,
    getTemplates,
    saveTemplates,
    resetTemplate,
    interpolate,
    sendEmailNotification,
    sendTestEmail,
    getLastSendError,
    syncEmailConfig,
    notifyCustomerMeetingScheduled,
    notifyCustomerProposedTimes,
    notifyCustomerMeetingManuallyLocked,
    notifyAdminCustomerChoseMeetingTime,
    notifyAdminMeetingProposalExpired,
    notifyPaymentMade,
    notifyPaymentRejected,
    notifyExecutionDayCountdown,
    notifyLogisticsTaskCompleted,
    notifyEquipmentIncident,
    notifyExecutionFinalSummary,
    notifyPaymentDueReminder
  };

  window.HalServeNotifications = notificationsApi;
  window.SmartServeNotifications = notificationsApi;

})(window);
