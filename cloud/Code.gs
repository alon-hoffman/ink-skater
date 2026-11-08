/**
 * InkSkater cloud levels - Google Apps Script web app.
 *
 * SETUP (full steps in cloud/SETUP.md):
 *  1. Create a Google Sheet. Open Extensions > Apps Script.
 *  2. Paste this whole file, replacing the default code.
 *  3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *  4. Authorize, copy the Web App URL, paste it in the game's Cloud dialog.
 *  After editing this file, redeploy via Deploy > Manage deployments > Edit > New version.
 *
 * Everyone can list and download levels. Each device has a random owner key; only a SHA-256 hash
 * of it is stored with the level, and only the matching key may overwrite or delete that level.
 */
var SHEET_NAME = 'Levels';
var HEADERS = ['id', 'name', 'updatedAt', 'json', 'ownerHash'];
var MAX_JSON_CHARS = 45000; // a single cell holds at most 50000 characters

function respond_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function fail_(message) {
  return respond_({ ok: false, error: message });
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function hashKey_(key) {
  if (typeof key !== 'string' || key.length < 16 || key.length > 200) return '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key);
  return bytes
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var me = hashKey_(p.ownerKey);
  if (p.action !== 'list') return fail_('Unknown action.');
  var sh = sheet_();
  var n = sh.getLastRow() - 1;
  var levels = [];
  if (n > 0) {
    var rows = sh.getRange(2, 1, n, 5).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      levels.push({
        id: String(rows[i][0]),
        name: String(rows[i][1]),
        updatedAt: Number(rows[i][2]) || 0,
        json: String(rows[i][3]),
        mine: me !== '' && String(rows[i][4]) === me,
      });
    }
  }
  return respond_({ ok: true, levels: levels });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return fail_('Bad request.');
  }
  var me = body ? hashKey_(body.ownerKey) : '';
  if (me === '') return fail_('Missing owner key.');

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return fail_('Busy, try again.');
  }
  try {
    var sh = sheet_();
    var n = sh.getLastRow() - 1;
    var ids = n > 0 ? sh.getRange(2, 1, n, 1).getValues() : [];
    var findRow = function (id) {
      for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
      return -1;
    };

    if (body.action === 'save') {
      var level = body.level;
      if (!level || typeof level.id !== 'string' || level.id === '') return fail_('Bad level.');
      var json = JSON.stringify(level);
      if (json.length > MAX_JSON_CHARS) return fail_('Level is too large.');
      var updatedAt = Number(level.updatedAt) || 0;
      var name = String(level.name || 'Untitled').slice(0, 60);
      var row = findRow(level.id);
      if (row > 0) {
        var owner = String(sh.getRange(row, 5).getValue());
        if (owner !== '' && owner !== me) return fail_('Only the creator can change this level.');
        var existing = Number(sh.getRange(row, 3).getValue()) || 0;
        if (!body.overwrite && updatedAt < existing) {
          return respond_({ ok: false, error: 'Cloud has a newer version.', conflict: true });
        }
        sh.getRange(row, 1, 1, 5).setValues([[level.id, name, updatedAt, json, me]]);
      } else {
        sh.appendRow([level.id, name, updatedAt, json, me]);
      }
      return respond_({ ok: true });
    }

    if (body.action === 'delete') {
      if (typeof body.id !== 'string' || body.id === '') return fail_('Bad id.');
      var r = findRow(body.id);
      if (r > 0) {
        var own = String(sh.getRange(r, 5).getValue());
        if (own !== '' && own !== me) return fail_('Only the creator can delete this level.');
        sh.deleteRow(r);
      }
      return respond_({ ok: true });
    }

    return fail_('Unknown action.');
  } catch (err) {
    return fail_('Server error.');
  } finally {
    lock.releaseLock();
  }
}
