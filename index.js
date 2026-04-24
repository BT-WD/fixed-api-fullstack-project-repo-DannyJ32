const API_KEY = "76ae29a91adf44aca6dc3b3ff60dd1ae";
const BASE = "https://api.twelvedata.com";

// ===== DOM =====
const tickerInput      = document.getElementById("ticker-input");
const searchBtn        = document.getElementById("search-btn");
const addBtn           = document.getElementById("add-btn");
const stockName        = document.getElementById("stock-name");
const stockCompany     = document.getElementById("stock-company");
const stockPrice       = document.getElementById("stock-price");
const stockChange      = document.getElementById("stock-change");
const chartPlaceholder = document.getElementById("chart-placeholder");
const canvas           = document.getElementById("price-chart");
const timeframeBtns    = document.querySelectorAll(".timeframe-btn");
const watchlistEl      = document.getElementById("watchlist-items");

let chart = null;
let currentDailyData = null;
let currentRange = "1M";
let currentStock = null;


async function fetchStock(symbol) {
  const res  = await fetch(`${BASE}/time_series?symbol=${symbol}&interval=1day&outputsize=365&apikey=${API_KEY}`);
  const data = await res.json();

  if (data.status === "error") throw new Error(data.message || "Ticker not found");
  if (!data.values?.length)    throw new Error("No data available");

  const values = [...data.values].reverse();
  const latest = values.at(-1);
  const prev   = values.at(-2);

  const price         = parseFloat(latest.close);
  const changePercent = prev ? ((price - parseFloat(prev.close)) / parseFloat(prev.close)) * 100 : 0;

  const history = values.map(v => ({ date: v.datetime, close: parseFloat(v.close) }));

  return {
    symbol:        (data.meta?.symbol || symbol).toUpperCase(),
    name:          (data.meta?.symbol || symbol).toUpperCase(),
    price,
    changePercent,
    history
  };
}

function sliceByRange(data, range) {
  const daysMap = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
  return data.slice(-(daysMap[range] || 30));
}

function renderChart(data, range) {
  const sliced = sliceByRange(data, range);
  chartPlaceholder.style.display = "none";
  if (chart) chart.destroy();

  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: sliced.map(d => d.date),
      datasets: [{
        data: sliced.map(d => d.close),
        borderColor: "#3FB950",
        backgroundColor: "rgba(63, 185, 80, 0.08)",
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `$${ctx.parsed.y.toFixed(2)}` } }
      },
      scales: {
        x: { display: false },
        y: {
          grid: { color: "#30363D" },
          ticks: { color: "#8B949E", font: { size: 10 } }
        }
      }
    }
  });
}

function updateQuoteUI(stock) {
  stockName.textContent    = stock.symbol;
  stockCompany.textContent = stock.name;
  stockPrice.textContent   = `$${stock.price.toFixed(2)}`;

  const sign = stock.changePercent >= 0 ? "+" : "";
  stockChange.textContent = `${sign}${stock.changePercent.toFixed(2)}%`;
  stockChange.classList.remove("positive", "negative");
  stockChange.classList.add(stock.changePercent >= 0 ? "positive" : "negative");
}

function loadWatchlist() {
  try { return JSON.parse(localStorage.getItem("watchlist")) || []; }
  catch { return []; }
}

function saveWatchlist(list) {
  localStorage.setItem("watchlist", JSON.stringify(list));
}

function renderWatchlist() {
  const list = loadWatchlist();
  watchlistEl.innerHTML = "";

  if (list.length === 0) {
    watchlistEl.innerHTML = '<li class="empty">No stocks saved yet</li>';
    return;
  }

  list.forEach(item => {
    const sign      = item.changePercent >= 0 ? "+" : "";
    const colorClass = item.changePercent >= 0 ? "positive" : "negative";
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div class="watchlist-ticker">${item.symbol}</div>
        <div class="watchlist-price">$${item.price.toFixed(2)}</div>
      </div>
      <div class="watchlist-right">
        <span class="watchlist-change ${colorClass}">${sign}${item.changePercent.toFixed(2)}%</span>
        <button class="remove-btn" data-symbol="${item.symbol}">×</button>
      </div>`;
    watchlistEl.appendChild(li);
  });
}

function addToWatchlist(stock) {
  const list = loadWatchlist();
  if (list.find(i => i.symbol === stock.symbol)) return;
  list.push({ symbol: stock.symbol, name: stock.name, price: stock.price, changePercent: stock.changePercent });
  saveWatchlist(list);
  renderWatchlist();
}

function removeFromWatchlist(symbol) {
  saveWatchlist(loadWatchlist().filter(i => i.symbol !== symbol));
  renderWatchlist();
}

async function handleSearch() {
  const symbol = tickerInput.value.trim().toUpperCase();
  if (!symbol) return;

  stockName.textContent    = "Loading...";
  stockCompany.textContent = "";
  stockPrice.textContent   = "$--.--";
  stockChange.textContent  = "--";
  currentStock = null;

  try {
    const stock = await fetchStock(symbol);
    currentStock = stock;
    updateQuoteUI(stock);
    currentDailyData = stock.history;
    renderChart(stock.history, currentRange);
    localStorage.setItem("lastSymbol", stock.symbol);
  } catch (err) {
    console.error(err);
    stockName.textContent = "Error: " + err.message;
    stockPrice.textContent = "$--.--";
    stockChange.textContent = "--";
    stockChange.classList.remove("positive", "negative");
  }
}

function handleTimeframe(e) {
  currentRange = e.target.dataset.range;
  timeframeBtns.forEach(btn => btn.classList.remove("active"));
  e.target.classList.add("active");
  if (currentDailyData) renderChart(currentDailyData, currentRange);
}

searchBtn.addEventListener("click", handleSearch);
tickerInput.addEventListener("keydown", e => { if (e.key === "Enter") handleSearch(); });
timeframeBtns.forEach(btn => btn.addEventListener("click", handleTimeframe));

addBtn.addEventListener("click", () => {
  if (!currentStock) return alert("Search for a stock first!");
  addToWatchlist(currentStock);
});

watchlistEl.addEventListener("click", e => {
  if (e.target.classList.contains("remove-btn")) {
    removeFromWatchlist(e.target.dataset.symbol);
  }
});

renderWatchlist();
const lastSymbol = localStorage.getItem("lastSymbol");
if (lastSymbol) {
  tickerInput.value = lastSymbol;
  handleSearch();
}
console.log("StockTrack loaded");
