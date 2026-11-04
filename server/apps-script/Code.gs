// Summing Mobile leaderboard backend: a Google Apps Script web app bound to a Google Sheet.
// API (see README.md):
//   GET  ?action=list                      -> { ok, entries }
//   POST { action: 'submit', name, score, moves, remaining, status } (as text/plain) -> { ok, entries }

var SHEET_NAME = 'records';
var HEADERS = ['timestamp', 'name', 'score', 'moves', 'remaining', 'status'];
var LIMIT = 20;
var NAME_MAX = 12;
var DEFAULT_NAME = '익명';
var MAX_SCORE = 1000000;
var MAX_MOVES = 100000;
var BOARD_CELLS = 81;

function doGet(e) {
    try {
        var action = e && e.parameter ? e.parameter.action : 'list';
        if (action && action !== 'list') {
            return json_({ ok: false, error: 'unknown action' });
        }
        return json_({ ok: true, entries: topEntries_(readRows_(getSheet_())) });
    } catch (error) {
        return json_({ ok: false, error: String(error) });
    }
}

function doPost(e) {
    var lock = LockService.getScriptLock();
    try {
        var data = JSON.parse(e.postData.contents);
        if (!data || data.action !== 'submit') {
            return json_({ ok: false, error: 'unknown action' });
        }
        var record = validateSubmission_(data);
        if (!record) {
            return json_({ ok: false, error: 'invalid submission' });
        }

        lock.waitLock(10000);
        var sheet = getSheet_();
        var row = sheet.getLastRow() + 1;
        // Plain-text name column so a name such as "=1+1" is never evaluated as a formula.
        sheet.getRange(row, 2).setNumberFormat('@');
        sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
            Date.now(), record.name, record.score, record.moves, record.remaining, record.status
        ]]);
        return json_({ ok: true, entries: topEntries_(readRows_(sheet)) });
    } catch (error) {
        return json_({ ok: false, error: String(error) });
    } finally {
        if (lock.hasLock()) {
            lock.releaseLock();
        }
    }
}

function json_(value) {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = spreadsheet.insertSheet(SHEET_NAME);
        sheet.appendRow(HEADERS);
        sheet.setFrozenRows(1);
    }
    return sheet;
}

function readRows_(sheet) {
    var last = sheet.getLastRow();
    return last < 2 ? [] : sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

// Same rules as sanitizePlayerName in logic.js.
function sanitizeName_(raw) {
    if (typeof raw !== 'string') {
        return '';
    }
    return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
}

function isIntInRange_(value, min, max) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= min && value <= max;
}

// Returns a clean record or null. Basic sanity checks only; scores are not replay-verified.
function validateSubmission_(data) {
    if (!isIntInRange_(data.score, 0, MAX_SCORE) || !isIntInRange_(data.moves, 0, MAX_MOVES)
        || !isIntInRange_(data.remaining, 0, BOARD_CELLS)) {
        return null;
    }
    if (data.status !== 'cleared' && data.status !== 'gameover') {
        return null;
    }
    // A cleared board is empty and a game over means every cell is full.
    if ((data.status === 'cleared' && data.remaining !== 0) || (data.status === 'gameover' && data.remaining !== BOARD_CELLS)) {
        return null;
    }
    return {
        name: sanitizeName_(data.name) || DEFAULT_NAME,
        score: data.score,
        moves: data.moves,
        remaining: data.remaining,
        status: data.status
    };
}

// Rows are [timestamp, name, score, moves, remaining, status]. Order: score desc, moves asc, newest first.
function topEntries_(rows) {
    // Hand-edited or malformed rows are skipped instead of breaking the whole list.
    return rows
        .filter(function (row) {
            return isFinite(Number(row[0])) && Number(row[0]) > 0 && isFinite(Number(row[2]))
                && isFinite(Number(row[3])) && (row[5] === 'cleared' || row[5] === 'gameover');
        })
        .map(function (row) {
            return {
                name: String(row[1]),
                score: Number(row[2]),
                moves: Number(row[3]),
                remaining: Number(row[4]),
                status: String(row[5]),
                date: new Date(Number(row[0])).toISOString(),
                timestamp: Number(row[0])
            };
        })
        .sort(function (a, b) {
            return (b.score - a.score) || (a.moves - b.moves) || (b.timestamp - a.timestamp);
        })
        .slice(0, LIMIT);
}
