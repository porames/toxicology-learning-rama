import { onRequest } from "firebase-functions/v2/https";
import moment from "moment";
import { handleCors } from "../lib/cors.js";
import { verifyAdmin } from "../lib/auth.js";

const TIMESTAMP_FORMAT = "DD/MM/YYYY HH:mm:ss";

// Zero-based column indices for A B C E F H I J L P Q.
const SELECTED_COLUMNS = [0, 1, 2, 4, 5, 7, 8, 9, 11, 15, 16];

function selectColumns(row) {
  return SELECTED_COLUMNS.map((index) => row[index] ?? "");
}

function isEmptyRow(row) {
  return !row.some((cell) => String(cell ?? "").trim() !== "");
}

function parseTimestamp(raw) {
  const cleaned = String(raw ?? "").replace(/,/g, "").trim();
  const parsed = moment(cleaned, TIMESTAMP_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

function sortByTimestamp(rows) {
  const withTimestamp = rows.map((row) => {
    const parsed = parseTimestamp(row[0]);
    return { row, time: parsed ? parsed.toDate().getTime() : null };
  });

  withTimestamp.sort((a, b) => {
    if (a.time === null && b.time === null) return 0;
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return b.time - a.time;
  });

  return withTimestamp.map((entry) => entry.row);
}

function normalizeTimestampRow(row) {
  const parsed = parseTimestamp(row[0]);
  const timestamp = parsed ? parsed.format(TIMESTAMP_FORMAT) : row[0];
  return [timestamp, ...row.slice(1)];
}

export const readGoogleSheet = onRequest(async (req, res) => {
  try {
    if (handleCors(req, res)) return;
    await verifyAdmin(req);

    const { GOOGLE_SHEET_ID, GOOGLE_SHEET_TAB, GOOGLE_SHEETS_API_KEY } = process.env;
    if (!GOOGLE_SHEET_ID || !GOOGLE_SHEETS_API_KEY) {
      return res.status(500).json({
        error: "GOOGLE_SHEET_ID and GOOGLE_SHEETS_API_KEY must be set in functions/.env",
      });
    }

    const tab = GOOGLE_SHEET_TAB || "Sheet1";
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(GOOGLE_SHEET_ID)}/values/${encodeURIComponent(tab)}?key=${encodeURIComponent(GOOGLE_SHEETS_API_KEY)}`;

    const sheetRes = await fetch(url);
    if (!sheetRes.ok) {
      const body = await sheetRes.json().catch(() => null);
      return res.status(sheetRes.status).json({
        error: body?.error?.message || `Google Sheets API returned HTTP ${sheetRes.status}`,
      });
    }

    const data = await sheetRes.json();
    const values = Array.isArray(data.values) ? data.values : [];

    let result = values;
    if (values.length > 1) {
      const [header, ...rows] = values;
      const nonEmptyRows = rows.filter((row) => !isEmptyRow(row));
      const sortedRows = sortByTimestamp(nonEmptyRows).map(normalizeTimestampRow);
      result = [selectColumns(header), ...sortedRows.map(selectColumns)];
    }

    return res.status(200).json({ values: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Something went wrong" });
  }
});
