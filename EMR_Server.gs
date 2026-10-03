/**
 * EMR_Server.gs  ·  ICF-SL Server for the Ministry of Health Electronic Medical Record (EMR)
 *
 * One Apps Script for the whole EMR:
 *   A. PHU EMR, case based entry form (phu_emr.html)
 *   B. Health Facility Register (facility_register.html)
 *
 * A. PHU EMR
 *   1. Receives case-based records from the EMR and keeps one sheet per register
 *      (one row per record, readable columns plus the full record so the EMR can read it back).
 *   2. Keeps a Patients sheet (one row per Patient ID / NIN).
 *   3. Sends records back to every EMR device.
 *   4. Receives the summary forms (HF1, HF2, HF3, HF5, HF6, HF12) for each facility and month
 *      and keeps them in one summary sheet per form.
 *   5. Gives the EMR's View data page the records of a register and the values of a summary form.
 *
 * B. HEALTH FACILITY REGISTER
 *   Facilities  one row per facility, the master list plus everything submitted
 *               from the Add facility form, with the INFRA and SERVICE columns.
 *   Staff       one row per member of staff, tied to the facility by Facility Key.
 *   Indicators  long format, one row per facility, programme, indicator and month.
 *   Requests    what is waiting for the admin, and what was decided.
 *   Transfers   every move of a member from one facility to another.
 *   Config      the DHIS2 settings, without the password.
 *
 * SET UP
 *  ONE SPREADSHEET: everything is kept in the Health Facility Register spreadsheet, which already
 *  holds the facility register tabs (Facilities, Staff, Indicators, Requests, Transfers, Config).
 *  Only the PHU EMR sheets (the seven registers, Patients, Deleted records, the HF summary sheets and
 *  the WhatsApp log) are added, by themselves, after the last tab, on the first request.
 *  Tabs that already exist are never removed, renamed, moved or cleared. The old EMR spreadsheet is left as it is.
 *
 *  1. Open the Apps Script project of the Health Facility Register spreadsheet
 *     (web app address .../AKfycbwuOj1M.../exec), replace everything with this file and save.
 *  2. SHEET_ID below can stay empty: the script then uses the spreadsheet it is attached to,
 *     the Health Facility Register spreadsheet. (Or paste that spreadsheet's id.)
 *  3. Run setUpSheets once from the editor (or just wait for the first request). It adds the
 *     PHU EMR tabs after the last tab and leaves the facility register tabs alone.
 *  4. Deploy > Manage deployments > the existing web app > Edit > Version: New version > Deploy.
 *     The /exec address stays the same. phu_emr.html and facility_register.html both use it.
 *     (For a brand new deployment: Execute as Me, Who has access Anyone, then put the /exec
 *     address in SYNC_URL of phu_emr.html and SCRIPT_URL of facility_register.html.)
 *  5. Check it any time: choose selfTest at the top and click Run, then read the Execution log.
 *     It also adds any missing PHU EMR tab, and lists any tab it could not find.
 *
 * HOW REQUESTS ARE SHARED OUT
 *   GET  ?action=all                         -> Health Facility Register
 *   GET  (no action)                         -> server check for the PHU EMR
 *   POST push, pull, aggregate, status,
 *        cases, summary, snapshot            -> PHU EMR (needs the access key)
 *   POST newFacility, staffChange, decide,
 *        transfer, bulk, updateFacility,
 *        saveConfig, dhis2Uid                -> Health Facility Register (admin actions need the admin password)
 */

/* ================================================================== */
/* WEB APP ENTRY POINTS (shared)                                       */
/* ================================================================== */
var EMR_ACTIONS = ['push', 'pull', 'aggregate', 'status', 'cases', 'summary', 'snapshot'];

function doGet(e) {
  try { ensureSheets_(); } catch (x) { return out_({ ok: false, error: String(x && x.message || x) }); }
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'all') return facGet_(e);
  return out_({ ok: true, app: 'ICF-SL Server', time: now_() });
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'The request could not be read.' }); }
  try { ensureSheets_(); } catch (x) { return out_({ ok: false, error: String(x && x.message || x) }); }
  if (b && EMR_ACTIONS.indexOf(b.action) > -1) return emrPost_(b);
  return facPost_(b);
}


/* ################################################################## */
/* A. PHU EMR                                                          */
/* ################################################################## */

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */
const SH = { patients: 'Patients', deleted: 'Deleted records' };
const AGG_SHEET = form => form + ' summary';
const META = ['Record ID', 'Register', 'District', 'Chiefdom', 'Facility', 'Facility type', 'Date', 'Month', 'Year',
  'Patient ID', 'Name', 'Sex', 'Updated on device', 'Device', 'Synced at', 'Full record (do not edit)'];
const JSON_COL = 16;         // column of the full record
const SYNC_COL = 15;         // column of the server time the row was written
const PAT_HEAD = ['Patient ID', 'Name', 'Sex', 'Date of birth', 'Date of birth estimated', 'NIN', 'Phone', 'Address',
  'Registers', 'Last seen', 'Last facility', 'Synced at', 'Full record (do not edit)'];
const AGG_HEAD = ['District', 'Chiefdom', 'Facility', 'Facility type', 'Period', 'Table', 'Row key', 'Row label',
  'Column key', 'Column label', 'Value', 'Saved at'];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function props_() { return PropertiesService.getScriptProperties(); }
function prop_(k, d) { const v = props_().getProperty(k); return v == null || v === '' ? d : v; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* The ONE spreadsheet for the whole EMR: the Health Facility Register spreadsheet.
   Paste its id here (the code between /d/ and /edit in its address). Left empty, the spreadsheet
   this script is attached to is used.
   The previous EMR spreadsheet (1-poS6YrYJLQPDaRdxbh3GiWJB4pv_-ZzoRW_GJVNLFg) is no longer written to
   and is left exactly as it is. */
const SHEET_ID = '';
/* The access key built into the EMR. EMR > Set access key can replace it (then put the new key in the EMR too). */
const BUILTIN_KEY = 'dVOO4HZBwCulVWTB9XlCVRZn';
function book_() {
  const b = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!b) throw new Error('No spreadsheet: put the Health Facility Register spreadsheet id in SHEET_ID.');
  return b;
}
/* a new tab always goes after the last tab, so the existing tabs keep their order */
function addTab_(b, name) { return b.insertSheet(name, b.getSheets().length); }
function now_() { return new Date().toISOString(); }
function sheet_(name, head) {
  const b = book_();
  let s = b.getSheetByName(name);
  if (!s) {
    s = addTab_(b, name);
    if (head) { s.getRange(1, 1, 1, head.length).setValues([head]); s.setFrozenRows(1); }
  }
  return s;
}
function rows_(s) {
  const n = s.getLastRow(), c = s.getLastColumn();
  return n < 2 || c < 1 ? [] : s.getRange(2, 1, n - 1, c).getValues();
}
function header_(s) {
  const c = s.getLastColumn();
  return c < 1 ? [] : s.getRange(1, 1, 1, c).getValues()[0].map(String);
}
function writeText_(s, r, c, values) {
  if (!values.length) return;
  const rg = s.getRange(r, c, values.length, values[0].length);
  rg.setNumberFormat('@');
  rg.setValues(values);
}
function norm_(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function periodOf_(p) { return String(p).replace(/[^0-9]/g, '').slice(0, 6); }

/* ------------------------------------------------------------------ */
/* Every PHU EMR sheet, created after the last tab when it is missing  */
/* ------------------------------------------------------------------ */
const EMR_REGISTERS = ['Young infant register', 'Under five register', 'General register (above five)', 'EPI Under 2 register',
  'Td and HPV register', 'Inpatient 29 days to 17 yrs', 'Adult inpatient (18+ yrs)'];
const EMR_FORMS = ['HF1', 'HF2', 'HF3', 'HF5', 'HF6', 'HF12'];
const EMR_LOG_HEAD = ['Time', 'To', 'Facility', 'Register', 'Date', 'Result'];
const EMR_DEL_HEAD = ['Record ID', 'Sheet', 'Deleted at', 'Device'];
function emrSheets_() {
  const made = [];
  const need = EMR_REGISTERS.map(n => [n, META])
    .concat([[SH.patients, PAT_HEAD], [SH.deleted, EMR_DEL_HEAD]])
    .concat(EMR_FORMS.map(f => [AGG_SHEET(f), AGG_HEAD]))
    .concat([['WhatsApp log', EMR_LOG_HEAD]]);
  const b = book_();
  need.forEach(([name, head]) => { if (!b.getSheetByName(name)) { sheet_(name, head); made.push(name); } });
  return made;
}
/* runs once for each spreadsheet (and again if the list of sheets above changes) */
const SHEETS_VER = 'emr-sheets-1';
function ensureSheets_() {
  const mark = SHEETS_VER + '|' + book_().getId();
  if (prop_('SHEETS_READY', '') === mark) return;
  emrSheets_();
  props_().setProperty('SHEETS_READY', mark);
}

/* ------------------------------------------------------------------ */
/* EMR requests                                                        */
/* ------------------------------------------------------------------ */
function emrPost_(b) {
  const key = prop_('TOKEN', BUILTIN_KEY);
  if (!b || b.token !== key) return out_({ ok: false, error: 'Wrong access key.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    switch (b.action) {
      case 'push': return out_(pushRecords(b));
      case 'pull': return out_(pullRecords(b));
      case 'aggregate': return out_(saveAggregate(b));
      case 'status': return out_(statusOf(b));
      case 'cases': return out_(casesOf(b));
      case 'summary': return out_(summaryOf(b));
      case 'snapshot': return out_(snapshotOf(b));
      default: return out_({ ok: false, error: 'Unknown action.' });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* 1. Case-based records                                               */
/* ------------------------------------------------------------------ */
/* b.records: [{ id, reg, sheet, columns:[[id,label]...], row:{id:value}, json, updated, meta:{...} }]
   b.deletes: [{ id, sheet }], b.patients: [{ pid, ... }], b.device */
function pushRecords(b) {
  const at = now_(), bySheet = {}, newOnes = [];
  (b.records || []).forEach(r => { (bySheet[r.sheet] = bySheet[r.sheet] || []).push(r); });
  let written = 0;
  Object.keys(bySheet).forEach(name => {
    const list = bySheet[name], s = sheet_(name, META);
    // columns: META first, then every question of the register in the order the EMR sends them
    let head = header_(s);
    const have = {};
    head.forEach((h, i) => { const m = /\[([^\]]+)\]$/.exec(h); if (m) have[m[1]] = i; });
    const add = [];
    list[0].columns.forEach(([id, label]) => { if (have[id] == null && !add.some(a => a[0] === id)) add.push([id, label]); });
    if (add.length) {
      s.getRange(1, head.length + 1, 1, add.length).setValues([add.map(([id, label]) => label + ' [' + id + ']')]);
      head = header_(s);
      head.forEach((h, i) => { const m = /\[([^\]]+)\]$/.exec(h); if (m) have[m[1]] = i; });
    }
    const index = {};
    rows_(s).forEach((row, i) => { index[String(row[0])] = i + 2; });
    const fresh = [];
    list.forEach(r => {
      const m = r.meta || {};
      const line = new Array(head.length).fill('');
      [r.id, m.register, m.district, m.chiefdom, m.facility, m.ftype, m.date, m.month, m.year, m.patientId, m.name, m.sex,
        r.updated, b.device || '', at, r.json].forEach((v, i) => { line[i] = v == null ? '' : String(v); });
      Object.keys(r.row || {}).forEach(id => { if (have[id] != null) line[have[id]] = String(r.row[id] == null ? '' : r.row[id]); });
      if (index[r.id]) writeText_(s, index[r.id], 1, [line]);
      else { fresh.push(line); newOnes.push([m.facility || '', m.register || '', m.date || '']); }
      written++;
    });
    if (fresh.length) writeText_(s, s.getLastRow() + 1, 1, fresh);
  });

  // WhatsApp: one alert per facility, register and date among the records that are new on the server
  if (newOnes.length) { try { waAlert_(newOnes); } catch (e) { waLog_('', '', '', '', 'Not sent: ' + e.message); } }

  // deletions: remove the row and keep a note so other devices remove it too
  const del = sheet_(SH.deleted, EMR_DEL_HEAD);
  (b.deletes || []).forEach(d => {
    const s = book_().getSheetByName(d.sheet);
    if (s) {
      const ids = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 1).getValues() : [];
      for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === d.id) s.deleteRow(i + 2);
    }
    writeText_(del, del.getLastRow() + 1, 1, [[d.id, d.sheet, at, b.device || '']]);
  });

  // patients
  if ((b.patients || []).length) {
    const s = sheet_(SH.patients, PAT_HEAD), index = {};
    rows_(s).forEach((row, i) => { index[String(row[0])] = i + 2; });
    const fresh = [];
    b.patients.forEach(p => {
      const line = [p.pid, p.name || '', p.sex || '', p.dob || '', p.dobEst ? 'Yes' : 'No', p.nin || '', p.phone || '',
        p.address || p.addrNow || '', (p.registers || []).join(', '), p.lastSeen || '', p.lastFacility || '', at, JSON.stringify(p)];
      if (index[p.pid]) writeText_(s, index[p.pid], 1, [line]); else fresh.push(line);
    });
    if (fresh.length) writeText_(s, s.getLastRow() + 1, 1, fresh);
  }
  return { ok: true, written: written, deleted: (b.deletes || []).length, patients: (b.patients || []).length, at: at };
}

/* Everything written since the device last asked (server time), optionally for some facilities only */
function pullRecords(b) {
  const since = String(b.since || ''), facs = b.facilities && b.facilities.length ? b.facilities.map(norm_) : null;
  const records = [], patients = [], deletes = [];
  book_().getSheets().forEach(s => {
    if (s.getLastRow() < 2 || String(s.getRange(1, 1).getValue()) !== 'Record ID' || s.getName() === SH.deleted) return;
    rows_(s).forEach(row => {
      if (String(row[SYNC_COL - 1]) <= since) return;
      if (facs && facs.indexOf(norm_(row[4])) < 0) return;
      try { records.push(JSON.parse(row[JSON_COL - 1])); } catch (x) { /* a row edited by hand is skipped */ }
    });
  });
  const ps = book_().getSheetByName(SH.patients);
  if (ps) rows_(ps).forEach(row => { if (String(row[11]) > since) { try { patients.push(JSON.parse(row[12])); } catch (x) {} } });
  const ds = book_().getSheetByName(SH.deleted);
  if (ds) rows_(ds).forEach(row => { if (String(row[2]) > since) deletes.push(String(row[0])); });
  return { ok: true, records: records, patients: patients, deletes: deletes, now: now_() };
}

/* The records of one register sheet, for the EMR's View data page.
   b.sheet, optional b.district, b.facility and b.period ('YYYY-MM', on the visit date). Newest first. */
function casesOf(b) {
  const s = book_().getSheetByName(String(b.sheet || ''));
  if (!s || s.getLastRow() < 2) return { ok: true, head: [], rows: [], total: 0 };
  const head = header_(s), keep = head.map((h, i) => i).filter(i => i !== JSON_COL - 1);
  const per = String(b.period || ''), yr = String(b.year || ''), mo = b.month ? String(b.month).padStart(2, '0') : '';
  const is = (want, have) => !want || norm_(want) === norm_(have);
  const rows = rows_(s).filter(r => is(b.district, r[2]) && is(b.chiefdom, r[3]) && is(b.facility, r[4]) && is(b.ftype, r[5]) &&
    (!per || String(r[6]).slice(0, per.length) === per) && (!yr || String(r[6]).slice(0, 4) === yr) && (!mo || String(r[6]).slice(5, 7) === mo));
  rows.sort((x, y) => String(y[6]).localeCompare(String(x[6])) || String(y[SYNC_COL - 1]).localeCompare(String(x[SYNC_COL - 1])));
  const limit = Math.min(rows.length, b.limit || 2000);
  return { ok: true, head: keep.map(i => head[i]), rows: rows.slice(0, limit).map(r => keep.map(i => String(r[i] == null ? '' : r[i]))), total: rows.length };
}

/* ------------------------------------------------------------------ */
/* 2. Summary forms                                                    */
/* ------------------------------------------------------------------ */
/* b.form 'HF1', b.facility {district, chiefdom, facility, ftype}, b.period 'YYYYMM',
   b.values [[table, rowKey, rowLabel, colKey, colLabel, value]] (cells that are not zero) */
function saveAggregate(b) {
  const f = b.facility || {}, period = periodOf_(b.period), s = sheet_(AGG_SHEET(b.form), AGG_HEAD), at = now_();
  // replace this facility and month: keep every other row, add the new ones
  const keep = rows_(s).filter(r => !(norm_(r[2]) === norm_(f.facility) && norm_(r[0]) === norm_(f.district) && periodOf_(r[4]) === period))
    .map(r => r.slice(0, AGG_HEAD.length));
  const add = (b.values || []).map(v => [f.district, f.chiefdom, f.facility, f.ftype, period, v[0], v[1], v[2], v[3], v[4], String(v[5]), at]);
  const all = keep.concat(add), cols = Math.max(s.getLastColumn(), AGG_HEAD.length);
  if (s.getLastRow() > 0) s.getRange(1, 1, s.getLastRow(), cols).clearContent();
  s.getRange(1, 1, 1, AGG_HEAD.length).setValues([AGG_HEAD]);
  if (all.length) writeText_(s, 2, 1, all);
  if (cmbReady_() && b.form !== 'HF12') { try { cmbSummary_(b.form, f, period, b.values, b.vars); } catch (e) { waLog_('', f.facility, b.form, '', 'Not sent: ' + e.message); } }
  return { ok: true, saved: add.length };
}

/* One summary form added up over every facility and month that matches the filters (an empty filter means all).
   b.form, optional b.district, b.chiefdom, b.ftype, b.facility, b.year, b.month. Numbers are added; text answers are listed. */
function summaryOf(b) {
  const s = book_().getSheetByName(AGG_SHEET(b.form));
  if (!s) return { ok: true, cells: [], facilities: 0, months: 0, savedAt: '' };
  const yr = String(b.year || ''), mo = b.month ? String(b.month).padStart(2, '0') : '';
  const is = (want, have) => !want || norm_(want) === norm_(have);
  const mine = rows_(s).filter(r => is(b.district, r[0]) && is(b.chiefdom, r[1]) && is(b.facility, r[2]) && is(b.ftype, r[3]) &&
    (!yr || String(r[4]).slice(0, 4) === yr) && (!mo || String(r[4]).slice(4, 6) === mo));
  const sum = {}, text = {}, facs = {}, months = {};
  let savedAt = '';
  mine.forEach(r => {
    const k = [r[5], r[6], r[8]].join('|'), v = String(r[10]);
    if (r[5] !== 'hdr' && v !== '' && !isNaN(Number(v))) sum[k] = (sum[k] || 0) + Number(v);
    else if (v !== '') { (text[k] = text[k] || []); if (text[k].indexOf(v) < 0) text[k].push(v); }
    facs[norm_(r[0]) + '|' + norm_(r[2])] = 1; months[String(r[4])] = 1;
    if (String(r[11]) > savedAt) savedAt = String(r[11]);
  });
  const cells = Object.keys(sum).map(k => k.split('|').concat([String(sum[k])]))
    .concat(Object.keys(text).filter(k => sum[k] == null).map(k => k.split('|').concat([text[k].join(', ')])));
  return { ok: true, cells: cells, facilities: Object.keys(facs).length, months: Object.keys(months).length, savedAt: savedAt };
}

/* Everything View data and the reports read, in one reply, so the EMR fetches once when it opens and keeps a copy:
   every register sheet (without the full record column) and every summary sheet, as text. */
function snapshotOf(b) {
  const cases = {}, aggs = {};
  book_().getSheets().forEach(s => {
    if (s.getLastRow() < 1 || String(s.getRange(1, 1).getValue()) !== 'Record ID' || s.getName() === SH.deleted) return;
    const head = header_(s), keep = head.map((h, i) => i).filter(i => i !== JSON_COL - 1);
    cases[s.getName()] = { head: keep.map(i => head[i]), rows: rows_(s).map(r => keep.map(i => String(r[i] == null ? '' : r[i]))) };
  });
  EMR_FORMS.forEach(form => {
    const s = book_().getSheetByName(AGG_SHEET(form));
    aggs[form] = s ? rows_(s).map(r => r.slice(0, AGG_HEAD.length).map(x => String(x == null ? '' : x))) : [];
  });
  return { ok: true, cases: cases, aggs: aggs, at: now_() };
}

/* What the server holds for one facility and month: the summary values of each form */
function statusOf(b) {
  const f = b.facility || {}, period = periodOf_(b.period), forms = {};
  ['HF1', 'HF2', 'HF3', 'HF5', 'HF6', 'HF12'].forEach(form => {
    const s = book_().getSheetByName(AGG_SHEET(form));
    if (!s) return;
    const mine = rows_(s).filter(r => norm_(r[2]) === norm_(f.facility) && periodOf_(r[4]) === period);
    if (mine.length) forms[form] = { values: mine.length, savedAt: mine[0][11], cells: b.withValues ? mine.map(r => [r[5], r[6], r[8], String(r[10])]) : undefined };
  });
  return { ok: true, forms: forms };
}

/* ===================== WHATSAPP ALERTS (Meta WhatsApp Business Cloud API) =====================
   Set these in Project Settings > Script properties (see the step by step guide):
     WA_TOKEN     permanent access token of the system user
     WA_PHONE_ID  the Phone number ID of the business number
     WA_TO        receiving numbers with country code, separated by commas, e.g. 23276123456,23288123456
     WA_TEMPLATE  name of the approved template (default new_record_alert)
     WA_LANG      language code of the template (default en)
     WA_VERSION   Graph API version (default v23.0)
   The template body has 3 variables: {{1}} facility, {{2}} register, {{3}} date. No patient details are sent. */
function waReady_() { return !!(prop_('WA_TOKEN', '') && prop_('WA_PHONE_ID', '') && prop_('WA_TO', '')); }

/* ---------- CallMeBot (free, sends only to the number that activated it) ----------
   The receiving numbers and their keys are in CMB_RECIPIENTS below. */
/* The people who receive the summary forms: one line each, their WhatsApp number and the key CallMeBot sent to THAT phone.
   To add someone: they send "I allow callmebot to send me messages" to the CallMeBot bot from their own WhatsApp,
   then add a line here with their number and key. */
const CMB_RECIPIENTS = [
  ['+23299725620', '9870333'],
  // ['+232XXXXXXXX', 'THEIR_KEY'],
  // ['+232XXXXXXXX', 'THEIR_KEY'],
];
/* the list in use: the lines above, or a Script property CMB_LIST written as number:key,number:key (it then replaces the lines above) */
function cmbList_() {
  const p = String(prop_('CMB_LIST', '')).trim();
  const list = p ? p.split(/[,;\n]+/).map(x => x.split(':').map(y => y.trim())) : CMB_RECIPIENTS;
  return list.filter(x => x && x[0] && x[1]).map(([n, k]) => [String(n).replace(/[^\d+]/g, ''), String(k)]);
}
function cmbReady_() { return cmbList_().length > 0; }
/* sends one text to every person on the list; returns the result for each */
function cmbText_(text, to, fac, label) {
  return cmbList_().map(([phone, key]) => {
    const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) + '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(key);
    let note;
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const body = String(res.getContentText() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const ok = res.getResponseCode() < 300 && !/error|invalid|not allowed|blocked/i.test(body.slice(0, 2000));
      note = ok ? 'Sent (CallMeBot)' : 'Failed (CallMeBot ' + res.getResponseCode() + '): ' + body.slice(0, 200);
    } catch (e) { note = 'Failed (CallMeBot): ' + e.message; }
    waLog_(phone, fac, label, '', note);
    if (typeof Utilities.sleep === 'function') Utilities.sleep(2000);   /* the free service asks for a pause between messages */
    return phone + ': ' + note;
  }).join(' | ');
}
/* a summary form as WhatsApp text: every row with a figure, as a total (deaths in brackets where the form has them) */
const WA_FORM_TITLE = { HF1: 'Out-patient morbidity, PHU', HF2: 'Child preventive services', HF3: 'Td and HPV', HF5: 'Hospital in-patient morbidity', HF6: 'Hospital out-patient morbidity' };
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function sumText_(form, f, period, values, vars) {
  const rows = [], at = {};
  (values || []).forEach(v => {
    const t = v[0], rk = v[1], lab = v[2], ck = String(v[3]), n = +v[5] || 0;
    if (t === 'hdr' || t === 'hf6x') return;
    const k = t + '|' + rk; if (!(k in at)) { at[k] = rows.length; rows.push({ lab: lab, c: 0, d: 0, o: 0, cd: false }); }
    const r = rows[at[k]];
    if (/^C\d+[MF]$/.test(ck)) { r.c += n; r.cd = true; }
    else if (/^D\d+[MF]$/.test(ck)) { r.d += n; r.cd = true; }
    else if (!/^T/.test(ck) && !/^(DIS|R[UO]?)[MF]$/.test(ck)) r.o += n;
  });
  const p = String(period), when = (MONTH_NAMES[+p.slice(4, 6) - 1] || '') + ' ' + p.slice(0, 4);
  const hdr = {}; (values || []).forEach(v => { if (v[0] === 'hdr') hdr[v[1]] = String(v[5] || ''); });   /* the reporting officer sent with the form */
  const lines = ['*' + form + ' · ' + (WA_FORM_TITLE[form] || '') + '*', 'District: ' + (f.district || ''), 'Chiefdom: ' + (f.chiefdom || ''), 'Health Facility: ' + (f.facility || ''),
    'Facility In-Charge: ' + (hdr.name || ''), 'Telephone: ' + (hdr.contact || ''), 'Date: ' + when, ''];
  /* one line per variable of the form (the list comes from the app), zeros included */
  const list = (vars && vars.length) ? vars : rows.map((r, i) => ['', '', String(r.lab).split(' · ').slice(1).join(' · ') || r.lab, i]);
  list.forEach(([tb, rk, name, i]) => { const r = i != null ? rows[i] : rows[at[tb + '|' + rk]];
    const v = r ? (r.cd ? r.c : r.o) : 0, d = r && r.cd ? r.d : 0;
    lines.push(name + ': ' + v + (d ? ' (deaths ' + d + ')' : '')); });
  return lines;
}
/* send a summary form through CallMeBot, in numbered parts when it is long */
function cmbSummary_(form, f, period, values, vars) {
  const lines = sumText_(form, f, period, values, vars), parts = [];
  let cur = '';
  lines.forEach(l => { if ((cur + '\n' + l).length > 1400 && cur) { parts.push(cur); cur = l; } else cur = cur ? cur + '\n' + l : l; });
  if (cur) parts.push(cur);
  parts.forEach((t, i) => cmbText_((parts.length > 1 ? '(' + (i + 1) + '/' + parts.length + ') ' : '') + t, '', f.facility, form + ' ' + period + (parts.length > 1 ? ' part ' + (i + 1) : '')));
}

function waAlert_(items) {
  if (!waReady_()) return;
  const seen = {};
  items.forEach(([fac, reg, date]) => {
    const k = [fac, reg, date].join('|'); if (seen[k]) return; seen[k] = 1;
    String(prop_('WA_TO', '')).split(/[,;\s]+/).map(n => n.replace(/\D/g, '')).filter(Boolean).forEach(to => waSend_(to, fac, reg, date));
  });
}
function waSend_(to, fac, reg, date) {
  const url = 'https://graph.facebook.com/' + prop_('WA_VERSION', 'v23.0') + '/' + prop_('WA_PHONE_ID', '') + '/messages';
  const txt = v => String(v || '-').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').slice(0, 900);   // Meta does not allow new lines in variables
  const body = { messaging_product: 'whatsapp', to: to, type: 'template',
    template: { name: prop_('WA_TEMPLATE', 'new_record_alert'), language: { code: prop_('WA_LANG', 'en') },
      components: [{ type: 'body', parameters: [{ type: 'text', text: txt(fac) }, { type: 'text', text: txt(reg) }, { type: 'text', text: txt(date) }] }] } };
  const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + prop_('WA_TOKEN', '') }, payload: JSON.stringify(body) });
  let note = 'Sent';
  if (res.getResponseCode() >= 300) { let m = res.getContentText(); try { m = JSON.parse(m).error.message; } catch (e) {} note = 'Failed (' + res.getResponseCode() + '): ' + m; }
  waLog_(to, fac, reg, date, note);
  return note;
}
function waLog_(to, fac, reg, date, note) {
  const s = sheet_('WhatsApp log', EMR_LOG_HEAD);
  writeText_(s, s.getLastRow() + 1, 1, [[now_(), to, fac, reg, date, note]]);
}
/* run this from the editor after setting the properties: sends one test alert to every number in WA_TO */
function testWhatsApp() {
  if (cmbReady_()) Logger.log('CallMeBot: ' + cmbText_('Test message from the PHU EMR. Summary forms will arrive here when devices sync.', '', 'Test', 'Test'));
  if (!waReady_()) { if (!cmbReady_()) Logger.log('Add a number and its CallMeBot key to CMB_RECIPIENTS, or set WA_TOKEN, WA_PHONE_ID and WA_TO (Meta) in Script properties.'); return; }
  String(prop_('WA_TO', '')).split(/[,;\s]+/).map(n => n.replace(/\D/g, '')).filter(Boolean)
    .forEach(to => Logger.log(to + ': ' + waSend_(to, 'Test facility', 'Test register', Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd'))));
}

/* ------------------------------------------------------------------ */
/* Spreadsheet menu                                                    */
/* ------------------------------------------------------------------ */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('EMR').addItem('Set access key', 'setAccessKey').addToUi();
}

function setAccessKey() {
  const ui = SpreadsheetApp.getUi(), cur = prop_('TOKEN', '');
  const r = ui.prompt('Access key', 'Type an access key (any long secret word). Type the same key in the EMR under More > ICF-SL Server.' + (cur ? '\n\nA key is already set; typing a new one replaces it.' : ''), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const v = r.getResponseText().trim();
  if (v.length < 6) { ui.alert('Use at least 6 characters.'); return; }
  props_().setProperty('TOKEN', v);
  ui.alert('Access key saved. Next: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone), then copy the address ending in /exec into the EMR.');
}


/* ################################################################## */
/* B. HEALTH FACILITY REGISTER                                         */
/* ################################################################## */

var ADMIN_PASSWORD = 'admin12345';  /* must match ADMIN_PASSWORD in facility_register.html */

var TAB = { fac:'Facilities', staff:'Staff', ind:'Indicators',
            req:'Requests', mov:'Transfers', cfg:'Config' };

var FAC_HEAD = ['Facility Key','Facility Code','District','Chiefdom','Section','Community',
  'Facility Name','Type','Ownership','Functional Status','Listing Status','Source','DHIS2 Status',
  'DHIS2 UID','Latitude','Longitude','Opening Date','In-charge Name','In-charge Telephone',
  'Facility Telephone','Facility Email',
  'INFRA: Buildings','INFRA: Beds','INFRA: Condition','INFRA: Functional generator',
  'INFRA: Non-functional generator','INFRA: Solar power available','INFRA: Electricity available',
  'INFRA: Water','INFRA: Toilets','INFRA: Cold chain','INFRA: Network','INFRA: Motorbike','INFRA: Waste pit',
  'SERVICE: OPD','SERVICE: ANC','SERVICE: Delivery','SERVICE: Postnatal','SERVICE: Immunisation',
  'SERVICE: Family planning','SERVICE: Laboratory','SERVICE: Pharmacy','SERVICE: Nutrition',
  'SERVICE: HIV testing','SERVICE: TB screening','SERVICE: Inpatient',
  'Record Status','Submitted By','Submitted Phone','Submitted At','Last Updated'];

var STAFF_HEAD = ['Staff ID','Facility Key','Facility Name','District','Chiefdom','Name','Cadre',
  'Telephone','Status','Added At'];

var IND_HEAD = ['Facility Key','Facility Name','District','Chiefdom','Programme','Indicator',
  'Year','Month','Value'];

var REQ_HEAD = ['ID','Type','Facility Key','Facility Name','District','Chiefdom','Staff IDs','Detail',
  'By','By Phone','At','Status','Decided By','Decided At','Reason','Batch'];

var MOV_HEAD = ['ID','Staff ID','Member','Cadre','Telephone','From Key','From','To Key','To',
  'Effective Date','Recorded At','By','Reason'];

/* ============================ sheet plumbing ============================ */
/* the same spreadsheet as the EMR (SHEET_ID at the top) */
function book(){ return book_(); }
function tab(name, head){
  var ss = book(), sh = ss.getSheetByName(name);
  if (!sh){
    sh = addTab_(ss, name);
    sh.getRange(1,1,1,head.length).setValues([head]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,head.length).setFontWeight('bold').setBackground('#004080').setFontColor('#ffffff');
  }
  return sh;
}
function readTab(name, head){
  var sh = tab(name, head);
  if (sh.getLastRow() < 2) return [];
  var cols = sh.getLastColumn();
  var keys = sh.getRange(1,1,1,cols).getValues()[0];
  return sh.getRange(2,1,sh.getLastRow()-1,cols).getValues().map(function(r){
    var o = {};
    keys.forEach(function(k,i){ o[String(k)] = r[i]; });
    return o;
  });
}
function headMap(sh){
  var m = {}, head = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  head.forEach(function(h,i){ m[String(h)] = i; });
  return m;
}
function appendObjects(name, head, objs){
  if (!objs || !objs.length) return;
  var sh = tab(name, head), m = headMap(sh), width = sh.getLastColumn();
  var rows = objs.map(function(o){
    var r = new Array(width).fill('');
    for (var k in o) if (m[k] !== undefined) r[m[k]] = o[k];
    return r;
  });
  sh.getRange(sh.getLastRow()+1, 1, rows.length, width).setValues(rows);
}
function rowOf(sh, keyCol, value){
  if (sh.getLastRow() < 2) return 0;
  var m = headMap(sh);
  if (m[keyCol] === undefined) return 0;
  var col = sh.getRange(2, m[keyCol]+1, sh.getLastRow()-1, 1).getValues();
  for (var i=0;i<col.length;i++) if (String(col[i][0]) === String(value)) return i + 2;
  return 0;
}
function setCell(name, head, keyCol, keyVal, field, value){
  var sh = tab(name, head), r = rowOf(sh, keyCol, keyVal);
  if (!r) return false;
  var m = headMap(sh);
  if (m[field] === undefined) return false;
  sh.getRange(r, m[field]+1).setValue(value);
  return true;
}
function str(v){
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  return v === null || v === undefined ? '' : String(v);
}
function num(v){
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

/* ============================ config ============================ */
function readConfig(){
  var sh = tab(TAB.cfg, ['Key','Value']), out = {};
  if (sh.getLastRow() >= 2){
    sh.getRange(2,1,sh.getLastRow()-1,2).getValues().forEach(function(r){ if (r[0]) out[String(r[0])] = String(r[1]); });
  }
  return out;
}
function writeConfig(obj){
  var sh = tab(TAB.cfg, ['Key','Value']), cur = readConfig();
  for (var k in obj) cur[k] = obj[k];
  var keys = Object.keys(cur);
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,2).clearContent();
  if (keys.length) sh.getRange(2,1,keys.length,2).setValues(keys.map(function(k){ return [k, cur[k]]; }));
}
function publicConfig(){
  var c = readConfig(), sets = [];
  try { sets = JSON.parse(c.dhis2Datasets || '[]'); } catch(e){ sets = []; }
  return { url:c.dhis2Url || '', user:c.dhis2User || '',
    level: parseInt(c.dhis2Level || '5', 10), parentLevel: parseInt(c.dhis2ParentLevel || '4', 10),
    datasets: sets };
}

/* ============================ facility register requests ============================ */
function json(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function facGet_(e){
  var action = (e && e.parameter && e.parameter.action) || 'all';
  try{
    if (action === 'all') return json(allData());
    return json({ ok:false, error:'Unknown action ' + action });
  } catch(err){ return json({ ok:false, error:String(err) }); }
}
function facPost_(d){
  var lock = LockService.getScriptLock();
  try { lock.waitLock(25000); } catch(err){ return json({ ok:false, error:'The server was busy, try again' }); }
  try{
    if (!d) return json({ ok:false, error:'The request could not be read.' });
    var guarded = ['decide','transfer','bulk','saveConfig','dhis2Uid','updateFacility'];
    if (guarded.indexOf(d.action) > -1 && String(d.admin || '') !== ADMIN_PASSWORD){
      return json({ ok:false, error:'Admin password refused' });
    }
    switch (d.action){
      case 'newFacility':    return json(actNewFacility(d));
      case 'staffChange':    return json(actStaffChange(d));
      case 'decide':         return json(actDecide(d));
      case 'transfer':       return json(actTransfer(d));
      case 'bulk':           return json(actBulk(d));
      case 'updateFacility': return json(actUpdateFacility(d));
      case 'saveConfig':     return json(actSaveConfig(d));
      case 'dhis2Uid':       return json(actDhis2Uid(d));
      default: return json({ ok:false, error:'Unknown action ' + d.action });
    }
  } catch(err){
    return json({ ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch(e2){}
  }
}

/* ============================ what the app reads ============================ */
function allData(){
  var facRows = readTab(TAB.fac, FAC_HEAD);
  var staffRows = readTab(TAB.staff, STAFF_HEAD);
  var indRows = readTab(TAB.ind, IND_HEAD);

  /* the panel data: infrastructure and services per facility */
  var sheetFacilities = facRows.map(function(r){
    var infra = {}, svc = {};
    FAC_HEAD.forEach(function(h){
      if (h.indexOf('INFRA: ') === 0){
        var v = str(r[h]).trim();
        if (v !== '') infra[h.substring(7)] = v;
      } else if (h.indexOf('SERVICE: ') === 0){
        var s = str(r[h]).trim().toLowerCase();
        if (s !== '') svc[h.substring(9)] = (s === 'yes' || s === 'true' || s === 'y' || s === '1');
      }
    });
    return { key: str(r['Facility Key']), infrastructure: infra, services: svc };
  }).filter(function(x){ return x.key; });

  var sheetStaff = staffRows.map(function(r){
    return { key: str(r['Facility Key']), name: str(r['Name']), cadre: str(r['Cadre']),
             phone: str(r['Telephone']), status: str(r['Status']) };
  }).filter(function(x){ return x.key && x.name; });

  var sheetIndicators = indRows.map(function(r){
    return { key: str(r['Facility Key']), programme: str(r['Programme']), indicator: str(r['Indicator']),
             year: num(r['Year']), month: num(r['Month']), value: num(r['Value']) };
  }).filter(function(x){ return x.key && x.programme && x.indicator && x.year && x.month; });

  /* the register: only what came from the app, so the master list is left alone */
  var mine = facRows.filter(function(r){ return str(r['Source']) === 'App submission'; });
  var facilities = mine.map(function(r){
    return { id: str(r['Facility Key']), district: str(r['District']), chiefdom: str(r['Chiefdom']),
      section: str(r['Section']), community: str(r['Community']), phu: str(r['Facility Name']),
      type: str(r['Type']), owner: str(r['Ownership']), lat: str(r['Latitude']), lng: str(r['Longitude']),
      opened: str(r['Opening Date']), inchargeName: str(r['In-charge Name']),
      inchargePhone: str(r['In-charge Telephone']), facPhone: str(r['Facility Telephone']),
      facEmail: str(r['Facility Email']), status: str(r['Record Status']) || 'Pending',
      dhis2Id: str(r['DHIS2 UID']), createdAt: str(r['Submitted At']),
      createdBy: str(r['Submitted By']), createdByPhone: str(r['Submitted Phone']) };
  });
  var keys = {};
  facilities.forEach(function(f){ keys[f.id] = 1; });
  var staff = staffRows.filter(function(r){ return keys[str(r['Facility Key'])]; }).map(function(r){
    return { id: str(r['Staff ID']), facilityId: str(r['Facility Key']), name: str(r['Name']),
             phone: str(r['Telephone']), cadre: str(r['Cadre']), status: str(r['Status']) || 'Active',
             addedAt: str(r['Added At']) };
  });

  var requests = readTab(TAB.req, REQ_HEAD).map(function(r){
    return { id: str(r['ID']), type: str(r['Type']), facilityId: str(r['Facility Key']),
      facilityName: str(r['Facility Name']), district: str(r['District']), chiefdom: str(r['Chiefdom']),
      staffIds: str(r['Staff IDs']), detail: str(r['Detail']), by: str(r['By']), byPhone: str(r['By Phone']),
      at: str(r['At']), status: str(r['Status']), decidedBy: str(r['Decided By']),
      decidedAt: str(r['Decided At']), reason: str(r['Reason']), batch: str(r['Batch']) };
  }).filter(function(x){ return x.id; });

  var transfers = readTab(TAB.mov, MOV_HEAD).map(function(r){
    return { id: str(r['ID']), staffId: str(r['Staff ID']), staffName: str(r['Member']),
      cadre: str(r['Cadre']), phone: str(r['Telephone']), fromId: str(r['From Key']), fromName: str(r['From']),
      toId: str(r['To Key']), toName: str(r['To']), date: str(r['Effective Date']),
      at: str(r['Recorded At']), by: str(r['By']), reason: str(r['Reason']) };
  }).filter(function(x){ return x.id; });

  return { ok:true, facilities:facilities, staff:staff, requests:requests, transfers:transfers,
           config: publicConfig(),
           sheetFacilities: sheetFacilities, sheetStaff: sheetStaff, sheetIndicators: sheetIndicators,
           counts: { facilities: facRows.length, staff: staffRows.length, indicators: indRows.length } };
}

/* ============================ writing ============================ */
function facRowFrom(f){
  var row = {
    'Facility Key': f.id, 'Facility Code': f.code || '',
    'District': f.district || '', 'Chiefdom': f.chiefdom || '',
    'Section': f.section || '', 'Community': f.community || '',
    'Facility Name': f.phu || '', 'Type': f.type || '', 'Ownership': f.owner || '',
    'Functional Status': 'Functional', 'Listing Status': 'New', 'Source': 'App submission',
    'DHIS2 Status': 'Not in DHIS2', 'DHIS2 UID': f.dhis2Id || '',
    'Latitude': f.lat || '', 'Longitude': f.lng || '', 'Opening Date': f.opened || '',
    'In-charge Name': f.inchargeName || '', 'In-charge Telephone': "'" + String(f.inchargePhone || ''),
    'Facility Telephone': "'" + String(f.facPhone || ''), 'Facility Email': f.facEmail || '',
    'Record Status': f.status || 'Pending', 'Submitted By': f.createdBy || '',
    'Submitted Phone': "'" + String(f.createdByPhone || ''), 'Submitted At': f.createdAt || new Date().toISOString(),
    'Last Updated': new Date().toISOString()
  };
  var infra = f.infrastructure || {};
  for (var k in infra) row['INFRA: ' + k] = infra[k];
  var svc = f.services || {};
  for (var s in svc) row['SERVICE: ' + s] = svc[s] ? 'Yes' : 'No';
  return row;
}
function staffRowFrom(s, fac){
  return { 'Staff ID': s.id, 'Facility Key': s.facilityId,
    'Facility Name': fac ? fac.phu : '', 'District': fac ? fac.district : '', 'Chiefdom': fac ? fac.chiefdom : '',
    'Name': s.name, 'Cadre': s.cadre, 'Telephone': "'" + String(s.phone || ''),
    'Status': s.status || 'Active', 'Added At': s.addedAt || new Date().toISOString() };
}
function reqRowFrom(q){
  return { 'ID': q.id, 'Type': q.type, 'Facility Key': q.facilityId, 'Facility Name': q.facilityName,
    'District': q.district, 'Chiefdom': q.chiefdom, 'Staff IDs': q.staffIds, 'Detail': q.detail,
    'By': q.by, 'By Phone': "'" + String(q.byPhone || ''), 'At': q.at, 'Status': q.status,
    'Decided By': q.decidedBy || '', 'Decided At': q.decidedAt || '', 'Reason': q.reason || '',
    'Batch': q.batch || '' };
}

function actNewFacility(d){
  appendObjects(TAB.fac, FAC_HEAD, [facRowFrom(d.facility)]);
  appendObjects(TAB.staff, STAFF_HEAD, (d.staff || []).map(function(s){ return staffRowFrom(s, d.facility); }));
  appendObjects(TAB.req, REQ_HEAD, [reqRowFrom(d.request)]);
  return { ok:true };
}
function actStaffChange(d){
  var fac = null;
  (d.staff || []).forEach(function(s){ if (!fac) fac = { phu:d.facilityName, district:d.district, chiefdom:d.chiefdom }; });
  appendObjects(TAB.staff, STAFF_HEAD, (d.staff || []).map(function(s){ return staffRowFrom(s, fac); }));
  (d.removeIds || []).forEach(function(id){ setCell(TAB.staff, STAFF_HEAD, 'Staff ID', id, 'Status', 'Pending removal'); });
  appendObjects(TAB.req, REQ_HEAD, (d.requests || []).map(reqRowFrom));
  return { ok:true };
}
function actDecide(d){
  var sh = tab(TAB.req, REQ_HEAD), r = rowOf(sh, 'ID', d.id);
  if (!r) return { ok:false, error:'Request not found' };
  var m = headMap(sh);
  var row = sh.getRange(r,1,1,sh.getLastColumn()).getValues()[0];
  if (String(row[m['Status']]) !== 'Pending') return { ok:false, error:'That request was already decided' };

  var accept = !!(d.accept === 1 || d.accept === '1' || d.accept === true);
  sh.getRange(r, m['Status']+1).setValue(accept ? 'Accepted' : 'Rejected');
  sh.getRange(r, m['Decided By']+1).setValue(d.by || 'Admin');
  sh.getRange(r, m['Decided At']+1).setValue(new Date().toISOString());
  sh.getRange(r, m['Reason']+1).setValue(d.reason || '');

  var type = String(row[m['Type']]);
  var facKey = String(row[m['Facility Key']]);
  var ids = String(row[m['Staff IDs']] || '').split(',').filter(function(x){ return x; });

  if (type === 'NEW_FACILITY'){
    setCell(TAB.fac, FAC_HEAD, 'Facility Key', facKey, 'Record Status', accept ? 'Active' : 'Rejected');
    setCell(TAB.fac, FAC_HEAD, 'Facility Key', facKey, 'Last Updated', new Date().toISOString());
    ids.forEach(function(id){ setCell(TAB.staff, STAFF_HEAD, 'Staff ID', id, 'Status', accept ? 'Active' : 'Rejected'); });
  } else if (type === 'ADD_STAFF'){
    ids.forEach(function(id){ setCell(TAB.staff, STAFF_HEAD, 'Staff ID', id, 'Status', accept ? 'Active' : 'Rejected'); });
  } else if (type === 'REMOVE_STAFF'){
    ids.forEach(function(id){ setCell(TAB.staff, STAFF_HEAD, 'Staff ID', id, 'Status', accept ? 'Removed' : 'Active'); });
  }
  return { ok:true };
}
function actTransfer(d){
  var t = d.transfer;
  if (!t || !t.staffId) return { ok:false, error:'No member was named' };
  appendObjects(TAB.mov, MOV_HEAD, [{
    'ID': t.id, 'Staff ID': t.staffId, 'Member': t.staffName, 'Cadre': t.cadre,
    'Telephone': "'" + String(t.phone || ''), 'From Key': t.fromId, 'From': t.fromName,
    'To Key': t.toId, 'To': t.toName, 'Effective Date': t.date, 'Recorded At': t.at,
    'By': t.by, 'Reason': t.reason || ''
  }]);
  setCell(TAB.staff, STAFF_HEAD, 'Staff ID', t.staffId, 'Facility Key', t.toId);
  return { ok:true };
}
function actBulk(d){
  appendObjects(TAB.fac, FAC_HEAD, (d.facilities || []).map(facRowFrom));
  var byId = {};
  (d.facilities || []).forEach(function(f){ byId[f.id] = f; });
  appendObjects(TAB.staff, STAFF_HEAD, (d.staff || []).map(function(s){ return staffRowFrom(s, byId[s.facilityId]); }));
  return { ok:true, facilities:(d.facilities || []).length, staff:(d.staff || []).length };
}
/* the admin editing a facility row, field by field */
function actUpdateFacility(d){
  if (!d.key || !d.fields) return { ok:false, error:'No facility or fields were given' };
  var done = 0;
  for (var k in d.fields){
    if (setCell(TAB.fac, FAC_HEAD, 'Facility Key', d.key, k, d.fields[k])) done++;
  }
  setCell(TAB.fac, FAC_HEAD, 'Facility Key', d.key, 'Last Updated', new Date().toISOString());
  return { ok:true, updated: done };
}
function actSaveConfig(d){
  writeConfig({
    dhis2Url: String(d.url || '').replace(/\/+$/,''),
    dhis2User: String(d.user || ''),
    dhis2Level: String(d.level || 5),
    dhis2ParentLevel: String(d.parentLevel || 4),
    dhis2Datasets: JSON.stringify(d.datasets || [])
  });
  return { ok:true, config: publicConfig() };
}
function actDhis2Uid(d){
  if (!d.facilityId || !d.uid) return { ok:false, error:'No facility or uid was given' };
  setCell(TAB.fac, FAC_HEAD, 'Facility Key', d.facilityId, 'DHIS2 UID', d.uid);
  setCell(TAB.fac, FAC_HEAD, 'Facility Key', d.facilityId, 'DHIS2 Status', 'In DHIS2');
  setCell(TAB.fac, FAC_HEAD, 'Facility Key', d.facilityId, 'Last Updated', new Date().toISOString());
  return { ok:true };
}

/* ============================ handy from the editor ============================ */
/* run once from the editor: adds the PHU EMR tabs after the last tab.
   The facility register tabs are already in the spreadsheet and are not touched. */
function setUpSheets(){
  var made = emrSheets_();
  props_().setProperty('SHEETS_READY', SHEETS_VER + '|' + book_().getId());
  Logger.log('Spreadsheet "' + book_().getName() + '": ' + (made.length ? 'added ' + made.join(', ') : 'every tab was already there'));
}
function countsFromEditor(){
  Logger.log(JSON.stringify(allData().counts));
}


/* ################################################################## */
/* SELF TEST: run selfTest from the editor and read the Execution log. */
/* It adds any missing PHU EMR tab after the last tab (as the web app does); */
/* apart from that nothing is written to the spreadsheet.             */
/* ################################################################## */
function selfTest() {
  const say = t => Logger.log(t);
  let pass = 0, fail = 0;
  const check = (ok, good, bad) => { if (ok) { pass++; say('PASS  ' + good); } else { fail++; say('FAIL  ' + bad); } };
  let b = null;
  try { b = book_(); check(true, 'Spreadsheet opened: "' + b.getName() + '" with ' + b.getSheets().length + ' tabs', ''); }
  catch (e) { check(false, '', 'Cannot open the spreadsheet (' + e.message + '). Check SHEET_ID and that you allowed access.'); say(pass + ' passed, ' + fail + ' failed'); return; }
  try { ensureSheets_(); } catch (e) { check(false, '', 'Adding the tabs failed: ' + e.message); }
  const gone = EMR_REGISTERS.concat([SH.patients, SH.deleted], EMR_FORMS.map(AGG_SHEET), ['WhatsApp log']).filter(n => !b.getSheetByName(n));
  check(!gone.length, 'Every PHU EMR sheet is there', 'PHU EMR sheets missing: ' + gone.join(', ') + '. Run setUpSheets once (or they are added on the first request).');
  const key = prop_('TOKEN', BUILTIN_KEY);
  check(!!key, 'Access key is set' + (prop_('TOKEN', '') ? ' (your own key)' : ' (the key built into the EMR)'), 'No access key. Run setAccessKey (or EMR > Set access key) first.');
  if (!key) { say(pass + ' passed, ' + fail + ' failed'); return; }
  const call = body => JSON.parse(doPost({ postData: { contents: JSON.stringify(Object.assign({ token: key }, body)) } }).getContent());
  const p = call({ action: 'pull', since: '' });
  check(p.ok, 'Records read back: ' + (p.records || []).length + ' records, ' + (p.patients || []).length + ' patients', 'Reading records failed: ' + p.error);
  ['Young infant register', 'Under five register', 'General register (above five)', 'EPI Under 2 register', 'Td and HPV register', 'Inpatient 29 days to 17 yrs', 'Adult inpatient (18+ yrs)'].forEach(name => {
    const c = call({ action: 'cases', sheet: name });
    check(c.ok, name + ': ' + c.total + ' rows', name + ': ' + c.error);
  });
  [['Ngelehun CHC', 'Badjia'], ['Bo Government Hospital', 'Kakua']].forEach(([fac, ch]) => {
    const st = call({ action: 'status', facility: { district: 'Bo', chiefdom: ch, facility: fac }, period: '202609' });
    check(st.ok, 'Summary forms for ' + fac + ', September 2026: ' + (Object.keys(st.forms || {}).join(', ') || 'none yet'), 'Reading summaries failed: ' + st.error);
  });
  const w = JSON.parse(doPost({ postData: { contents: JSON.stringify({ token: 'wrong-key', action: 'pull' }) } }).getContent());
  check(w.ok === false, 'A wrong access key is refused', 'A wrong access key was accepted');

  /* facility register, read only: the tabs must already exist (run setUpSheets once) */
  try {
    const fb = book(), missing = [TAB.fac, TAB.staff, TAB.ind, TAB.req, TAB.mov, TAB.cfg].filter(n => !fb.getSheetByName(n));
    check(!missing.length, 'Facility register tabs are all there', 'Facility register tabs not found: ' + missing.join(', ') + '. Check SHEET_ID is the facility register spreadsheet.');
    if (!missing.length) {
      const g = JSON.parse(doGet({ parameter: { action: 'all' } }).getContent());
      check(g.ok, 'Facility register read: ' + g.counts.facilities + ' facilities, ' + g.counts.staff + ' staff, ' + g.requests.length + ' requests',
        'Reading the facility register failed: ' + g.error);
    }
  } catch (e) { check(false, '', 'Reading the facility register failed (' + e.message + ').'); }
  const a = JSON.parse(doPost({ postData: { contents: JSON.stringify({ action: 'decide', admin: 'wrong' }) } }).getContent());
  check(a.ok === false, 'A wrong admin password is refused', 'A wrong admin password was accepted');

  say(pass + ' passed, ' + fail + ' failed' + (fail ? '' : '. The script works; now update the web app deployment (Manage deployments > Edit > New version).'));
}
