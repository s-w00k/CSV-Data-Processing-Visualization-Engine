const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");

const previewTable = document.getElementById("previewTable");
const previewHead = previewTable.querySelector("thead");
const previewBody = previewTable.querySelector("tbody");

let missingChart, productChart, monthlyChart;

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = "status";
  if (type === "ok") statusEl.classList.add("ok");
  if (type === "err") statusEl.classList.add("err");
}

function destroyCharts() {
  for (const c of [missingChart, productChart, monthlyChart]) {
    if (c) c.destroy();
  }
  missingChart = productChart = monthlyChart = null;
}

function renderSummary(analytics, warnings) {
  const price = analytics.stats.price;
  const rating = analytics.stats.rating;

  const warnHtml = warnings?.unexpectedColumns?.length
    ? `<div style="margin-top:8px;color:#ffd36a;">
         Warning: unexpected columns: <code>${warnings.unexpectedColumns.join(", ")}</code>
       </div>`
    : "";

  summaryEl.innerHTML = `
    <div><b>Total cleaned rows:</b> ${analytics.totalRows}</div>
    <div style="margin-top:10px;"><b>Price stats:</b>
      count=${price.count}, min=${fmt(price.min)}, mean=${fmt(price.mean)}, max=${fmt(price.max)}
    </div>
    <div style="margin-top:6px;"><b>Rating stats:</b>
      count=${rating.count}, min=${fmt(rating.min)}, mean=${fmt(rating.mean)}, max=${fmt(rating.max)}
    </div>
    <div style="margin-top:10px;"><b>In-stock counts:</b>
      true=${analytics.instockCounts.true}, false=${analytics.instockCounts.false}, unknown=${analytics.instockCounts.null}
    </div>
    ${warnHtml}
  `;
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2) : "—";
  return String(v);
}

function renderPreview(rows) {
  previewHead.innerHTML = "";
  previewBody.innerHTML = "";

  if (!rows || rows.length === 0) {
    previewHead.innerHTML = "<tr><th>No rows</th></tr>";
    return;
  }

  const cols = Object.keys(rows[0]);

  const headRow = document.createElement("tr");
  for (const c of cols) {
    const th = document.createElement("th");
    th.textContent = c;
    headRow.appendChild(th);
  }
  previewHead.appendChild(headRow);

  for (const r of rows) {
    const tr = document.createElement("tr");
    for (const c of cols) {
      const td = document.createElement("td");
      td.textContent = r[c] === null ? "" : String(r[c]);
      tr.appendChild(td);
    }
    previewBody.appendChild(tr);
  }
}

function renderMissingChart(missing) {
  const ctx = document.getElementById("missingChart");
  const labels = Object.keys(missing);
  const values = labels.map((k) => missing[k]);

  missingChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Missing count", data: values }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

function renderTopProductsChart(topProducts) {
  const ctx = document.getElementById("productChart");
  const labels = topProducts.map((x) => x.product);
  const values = topProducts.map((x) => x.count);

  productChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Rows", data: values }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}

function renderMonthlyChart(monthly) {
  const ctx = document.getElementById("monthlyChart");
  const labels = monthly.map((x) => x.month);
  const counts = monthly.map((x) => x.count);
  const avgPrice = monthly.map((x) => x.avgPrice ?? null);

  monthlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Rows per month", data: counts, yAxisID: "y" },
        { label: "Avg price", data: avgPrice, yAxisID: "y1" }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { type: "linear", position: "left", title: { display: true, text: "Rows" } },
        y1: { type: "linear", position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Avg price" } }
      }
    }
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    setStatus("Pick a CSV file first.", "err");
    return;
  }

  setStatus("Uploading and analyzing...");
  destroyCharts();

  const fd = new FormData();
  fd.append("file", file);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || "Upload failed.", "err");
      summaryEl.innerHTML = data.details
        ? `<pre style="white-space:pre-wrap;color:#ffd36a;">${JSON.stringify(data.details, null, 2)}</pre>`
        : "";
      renderPreview([]);
      return;
    }

    setStatus("Done ✅ Analytics generated.", "ok");
    renderSummary(data.analytics, data.warnings);
    renderPreview(data.sampleCleanedRows);

    renderMissingChart(data.analytics.missing);
    renderTopProductsChart(data.analytics.topProducts);
    renderMonthlyChart(data.analytics.monthly);
  } catch (err) {
    setStatus("Network/server error. Check console.", "err");
    console.error(err);
  }
});