const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const path = require("path");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.use(express.static(path.join(__dirname, "public")));

const REQUIRED_COLUMNS = ["product", "price", "rating", "instock", "launch_date"];
const OPTIONAL_COLUMNS = ["review"];

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase();
}

function parseNumber(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;

  // remove common currency symbols/commas: "£1,234.50" -> "1234.50"
  const cleaned = s.replace(/[$£€,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseBoolean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "") return null;
  if (["true", "t", "yes", "y", "1", "in stock", "instock"].includes(s)) return true;
  if (["false", "f", "no", "n", "0", "out of stock", "oos"].includes(s)) return false;
  return null; // unrecognized
}

function parseDateISO(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;

  // Accept ISO-like dates (YYYY-MM-DD) best; also try Date.parse fallback
  // Return YYYY-MM-DD or null
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return s;

  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function validateColumns(headers) {
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  const unexpected = headers.filter(
    (h) => !REQUIRED_COLUMNS.includes(h) && !OPTIONAL_COLUMNS.includes(h)
  );
  return { missing, unexpected };
}

function cleanRow(row) {
  // row keys already normalized
  const cleaned = {
    product: String(row.product ?? "").trim() || null,
    price: parseNumber(row.price),
    rating: parseNumber(row.rating),
    instock: parseBoolean(row.instock),
    review: row.review !== undefined ? String(row.review ?? "").trim() : null,
    launch_date: parseDateISO(row.launch_date)
  };

  // Additional simple rules:
  // rating clamp 0..5 (if your data uses that)
  if (cleaned.rating !== null) {
    if (cleaned.rating < 0) cleaned.rating = 0;
    if (cleaned.rating > 5) cleaned.rating = 5;
  }

  return cleaned;
}

function computeAnalytics(rows) {
  const totalRows = rows.length;

  // Missing counts
  const missing = {
    product: 0,
    price: 0,
    rating: 0,
    instock: 0,
    launch_date: 0
  };

  // Numeric aggregates
  const numeric = {
    price: [],
    rating: []
  };

  // Category counts
  const productCounts = new Map();
  const instockCounts = { true: 0, false: 0, null: 0 };

  // Time series (by month)
  const byMonth = new Map(); // YYYY-MM -> { count, avgPrice, avgRating }
  const monthAcc = new Map(); // YYYY-MM -> { priceSum, priceN, ratingSum, ratingN, count }

  for (const r of rows) {
    for (const k of Object.keys(missing)) {
      if (r[k] === null) missing[k] += 1;
    }

    if (r.price !== null) numeric.price.push(r.price);
    if (r.rating !== null) numeric.rating.push(r.rating);

    const p = r.product ?? "Unknown";
    productCounts.set(p, (productCounts.get(p) || 0) + 1);

    const instKey = r.instock === true ? "true" : r.instock === false ? "false" : "null";
    instockCounts[instKey] += 1;

    if (r.launch_date) {
      const month = r.launch_date.slice(0, 7); // YYYY-MM
      const acc = monthAcc.get(month) || {
        count: 0,
        priceSum: 0,
        priceN: 0,
        ratingSum: 0,
        ratingN: 0
      };
      acc.count += 1;
      if (r.price !== null) {
        acc.priceSum += r.price;
        acc.priceN += 1;
      }
      if (r.rating !== null) {
        acc.ratingSum += r.rating;
        acc.ratingN += 1;
      }
      monthAcc.set(month, acc);
    }
  }

  for (const [month, acc] of monthAcc.entries()) {
    byMonth.set(month, {
      count: acc.count,
      avgPrice: acc.priceN ? acc.priceSum / acc.priceN : null,
      avgRating: acc.ratingN ? acc.ratingSum / acc.ratingN : null
    });
  }

  function stats(arr) {
    if (!arr.length) return { count: 0, min: null, max: null, mean: null };
    let min = arr[0];
    let max = arr[0];
    let sum = 0;
    for (const x of arr) {
      if (x < min) min = x;
      if (x > max) max = x;
      sum += x;
    }
    return {
      count: arr.length,
      min,
      max,
      mean: sum / arr.length
    };
  }

  // Sort top products
  const topProducts = [...productCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([product, count]) => ({ product, count }));

  // Sort months
  const monthly = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  return {
    totalRows,
    missing,
    stats: {
      price: stats(numeric.price),
      rating: stats(numeric.rating)
    },
    topProducts,
    instockCounts,
    monthly
  };
}

app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Use field name 'file'." });
    }
    if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({ error: "Please upload a .csv file." });
    }

    const csvText = req.file.buffer.toString("utf-8");

    // Parse CSV with header row
    const records = parse(csvText, {
      columns: (headers) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true
    });

    // Validate columns
    const headers = records.length ? Object.keys(records[0]) : [];
    const { missing, unexpected } = validateColumns(headers);

    if (missing.length) {
      return res.status(422).json({
        error: "CSV structure invalid: missing required columns.",
        details: { missing, required: REQUIRED_COLUMNS, found: headers }
      });
    }

    // Clean rows
    const cleanedRows = records.map(cleanRow);

    // Optional: drop completely empty rows (e.g., product null and all other null)
    const finalRows = cleanedRows.filter((r) => {
      const values = [r.product, r.price, r.rating, r.instock, r.launch_date];
      return values.some((v) => v !== null);
    });

    const analytics = computeAnalytics(finalRows);

    res.json({
      ok: true,
      warnings: unexpected.length ? { unexpectedColumns: unexpected } : null,
      analytics,
      sampleCleanedRows: finalRows.slice(0, 8) // show a preview
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server failed to process CSV.",
      details: err && err.message ? err.message : String(err)
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});