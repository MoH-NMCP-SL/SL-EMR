/**
 * E-learning backend for the National Malaria Control Programme
 *
 * One Google Sheet holds everything: the video links for every lesson and the
 * record of every learner. The page reads both when somebody signs in and
 * writes back as they move through a course.
 *
 * SET UP
 *  1. Create a Google Sheet. Extensions, then Apps Script. Paste this file in.
 *  2. Put the spreadsheet id below, or leave it blank if this script is bound
 *     to the sheet itself.
 *  3. Run setup() once. It creates the four sheets with their headers.
 *  4. Import videos_template.csv into the Videos sheet and paste a YouTube
 *     link into the last column for every lesson you have recorded.
 *  5. Deploy, New deployment, type Web app. Execute as Me. Who has access,
 *     Anyone. Copy the /exec address.
 *  6. Open e_learning.html, find API_URL near the top of the script and paste
 *     that address between the quotes.
 *
 * Redeploy as a NEW VERSION every time you change this file, otherwise the
 * page keeps talking to the old copy.
 */

var SPREADSHEET_ID = '';   // leave blank when this script is bound to the sheet

var SHEETS = {
  videos:   ['course_code', 'lesson_no', 'lesson_title', 'youtube_url'],
  learners: ['key', 'name', 'unit', 'first_seen', 'last_seen'],
  progress: ['key', 'name', 'unit', 'programme', 'course_code', 'course_title',
             'enrolled', 'lessons_done', 'lessons_total', 'done_index',
             'passed', 'score', 'date', 'updated'],
  results:  ['timestamp', 'key', 'name', 'unit', 'programme', 'course_code',
             'course_title', 'score', 'certificate_code', 'date']
};

var NAMES = { videos: 'Videos', learners: 'Learners', progress: 'Progress', results: 'Results' };


/* ------------------------------------------------------------------ book */

function book() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID)
                        : SpreadsheetApp.getActiveSpreadsheet();
}

function sheetFor(which) {
  var ss = book();
  var sh = ss.getSheetByName(NAMES[which]);
  if (!sh) {
    sh = ss.insertSheet(NAMES[which]);
    sh.getRange(1, 1, 1, SHEETS[which].length).setValues([SHEETS[which]]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, SHEETS[which].length).setFontWeight('bold');
  }
  return sh;
}

function setup() {
  ['videos', 'learners', 'progress', 'results'].forEach(function (w) { sheetFor(w); });
  return 'Sheets ready';
}

function rowsOf(which) {
  var sh = sheetFor(which);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var head = SHEETS[which];
  var values = sh.getRange(2, 1, last - 1, head.length).getValues();
  return values.map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = r[i]; });
    return o;
  });
}


/* ------------------------------------------------------------------ read */

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  try {
    if (p.action === 'bootstrap') return json(bootstrap(p));
    if (p.action === 'videos')    return json({ ok: true, videos: videoMap() });
    if (p.action === 'ping')      return json({ ok: true, time: new Date().toISOString() });
    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function videoMap() {
  var out = {};
  rowsOf('videos').forEach(function (r) {
    var code = String(r.course_code || '').trim();
    var no = parseInt(r.lesson_no, 10);
    var url = String(r.youtube_url || '').trim();
    if (!code || !no || !url) return;
    out[code + '|' + (no - 1) + ''] = url;      // the page counts lessons from zero
  });
  return out;
}

function bootstrap(p) {
  var key = String(p.key || '').trim();
  if (!key) return { ok: false, error: 'no key' };
  touchLearner(key, p.name, p.unit);

  var mine = {}, counts = {};
  rowsOf('progress').forEach(function (r) {
    var code = String(r.course_code || '').trim();
    if (!code) return;
    if (Number(r.enrolled) === 1) counts[code] = (counts[code] || 0) + 1;
    if (String(r.key).trim() !== key) return;
    mine[code] = {
      enrolled: Number(r.enrolled) === 1,
      done: String(r.done_index || '').split(',')
              .filter(function (x) { return x !== ''; })
              .map(Number),
      passed: Number(r.passed) === 1,
      score: Number(r.score) || 0,
      date: r.date ? formatDate(r.date) : null
    };
  });

  return { ok: true, videos: videoMap(), progress: mine, counts: counts };
}

function formatDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}


/* ----------------------------------------------------------------- write */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var body = JSON.parse(e.postData.contents);
    var items = (body.action === 'batch') ? (body.items || []) : [body];
    items.forEach(handle);
    return json({ ok: true, written: items.length });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function handle(item) {
  if (!item || !item.action) return;
  if (item.action === 'progress') return writeProgress(item);
  if (item.action === 'result')   return writeResult(item);
}

function touchLearner(key, name, unit) {
  var sh = sheetFor('learners');
  var rows = rowsOf('learners');
  var now = new Date();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].key).trim() === key) {
      sh.getRange(i + 2, 3).setValue(unit || rows[i].unit);
      sh.getRange(i + 2, 5).setValue(now);
      return;
    }
  }
  sh.appendRow([key, name || '', unit || '', now, now]);
}

function writeProgress(d) {
  var key = String(d.key || '').trim(), code = String(d.course || '').trim();
  if (!key || !code) return;
  touchLearner(key, d.name, d.unit);

  var sh = sheetFor('progress');
  var rows = rowsOf('progress');
  var row = [key, d.name || '', d.unit || '', d.programme || '', code, d.title || '',
             Number(d.enrolled) ? 1 : 0, Number(d.lessons_done) || 0,
             Number(d.lessons_total) || 0, String(d.done || ''),
             Number(d.passed) ? 1 : 0, Number(d.score) || 0, d.date || '', new Date()];

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].key).trim() === key && String(rows[i].course_code).trim() === code) {
      sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}

function writeResult(d) {
  var sh = sheetFor('results');
  sh.appendRow([new Date(), d.key || '', d.name || '', d.unit || '', d.programme || '',
                d.course || '', d.title || '', Number(d.score) || 0,
                d.certificate || '', d.date || '']);
}


/* ----------------------------------------------------------------- reply */

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
