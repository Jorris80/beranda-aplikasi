/**
 * Beranda Aplikasi — Backend Google Apps Script
 * -------------------------------------------------
 * Penyimpanan: satu Google Sheet (tab "Aplikasi"), satu baris per aplikasi.
 * Aplikasi HTML memanggil endpoint ini untuk menarik (list) dan menyimpan (saveAll) data,
 * sehingga daftar tersinkron di semua perangkat.
 *
 * CARA PASANG (ringkas):
 *  1. Buka https://script.google.com  →  New project.
 *  2. Hapus isi Code.gs bawaan, tempel seluruh file ini.
 *  3. (Opsional) Isi TOKEN dengan kata sandi rahasia, samakan di aplikasi HTML.
 *  4. Deploy  →  New deployment  →  Type: Web app.
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  5. Salin "Web app URL" (…/exec), tempel di menu Sinkronisasi pada aplikasi.
 *
 * Catatan: Sheet dibuat otomatis saat pertama kali dipakai. Tidak perlu
 * membuat Spreadsheet manual — script ini terikat pada Spreadsheet aktifnya
 * sendiri. Jika ingin Sheet khusus, buat Spreadsheet lalu Extensions → Apps Script,
 * dan tempel kode ini di sana.
 */

var SHEET_NAME = 'Aplikasi';
var TOKEN = ''; // Kosongkan untuk tanpa cek. Isi string rahasia untuk mengamankan penulisan.
var HEADERS = ['id', 'created', 'name', 'url', 'cat', 'status', 'note', 'tags'];

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'ping') return json({ ok: true, count: Math.max(0, getSheet().getLastRow() - 1) });
  if (action === 'list') return json({ ok: true, apps: readAll() });
  return json({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json({ ok: false, error: 'bad json' }); }

  if (TOKEN && String(body.token || '') !== TOKEN) {
    return json({ ok: false, error: 'unauthorized' });
  }

  if (body.action === 'saveAll') {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      writeAll(body.apps || []);
      return json({ ok: true, count: (body.apps || []).length });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      try { lock.releaseLock(); } catch (e2) {}
    }
  }
  if (body.action === 'ping') return json({ ok: true });
  return json({ ok: false, error: 'unknown action' });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll() {
  var sh = getSheet();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return rows.filter(function (r) { return String(r[0]) !== ''; }).map(function (r) {
    return {
      id: String(r[0]),
      created: Number(r[1]) || 0,
      name: String(r[2] || ''),
      url: String(r[3] || ''),
      cat: String(r[4] || ''),
      status: String(r[5] || 'aktif'),
      note: String(r[6] || ''),
      tags: r[7] ? String(r[7]).split(',').map(function (t) { return t.trim(); }).filter(Boolean) : []
    };
  });
}

function writeAll(apps) {
  var sh = getSheet();
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, HEADERS.length).clearContent();
  if (!apps.length) return;
  var values = apps.map(function (a) {
    return [
      a.id || '',
      a.created || Date.now(),
      a.name || '',
      a.url || '',
      a.cat || '',
      a.status || 'aktif',
      a.note || '',
      (a.tags || []).join(', ')
    ];
  });
  sh.getRange(2, 1, values.length, HEADERS.length).setValues(values);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
