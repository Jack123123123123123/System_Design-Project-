const TODAY = "2026-06-03";

let products = [];
let inventory = [];
let suppliers = [];
let purchaseOrders = [];
let salesRecord = [];
let wasteRecord = [];
let forecastResult = null; // 儲存後端回傳的備貨建議結果

let currentOrder = {};
let hasPendingSale = false;
let activeReportHasData = true;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// 1. 初始化：從後端大打包 API 載入所有基礎資料
async function loadData() {
  try {
    const response = await fetch("http://127.0.0.1:5000/api/get_all_data");
    const result = await response.json();

    if (!result.success) {
      showToast("讀取資料失敗", "error");
      return;
    }

    products = result.products.map((item) => ({
      id: item.product_id,
      name: item.product_name,
      price: Number(item.price),
      isNoodle: item.product_name.includes("涼麵"),
      stock: 999
    }));

    inventory = result.inventory.map((item) => ({
      id: item.material_id,
      name: item.material_name,
      stock: Number(item.stock_qty),
      unit: item.unit,
      safeStock: Number(item.safe_stock),
      expiryDays: Number(item.expiry_days)
    }));

    suppliers = result.suppliers.map((item) => ({
      id: item.supplier_id,
      name: item.supplier_name,
      contact: item.contact_person,
      phone: item.phone,
      address: item.address,
      items: item.supplied_items,
      used: true
    }));

    purchaseOrders = result.purchaseOrders.map((item) => ({
      id: String(item.po_id),
      date: item.po_date,
      supplierId: item.supplier_id,
      supplierName: item.supplier_name,
      itemId: item.material_id,
      itemName: item.material_name,
      qty: Number(item.order_qty),
      receivedQty: item.received_qty === null ? null : Number(item.received_qty),
      note: item.note || "",
      status: item.status
    }));

    salesRecord = result.salesRecords.map((item) => ({
      id: String(item.sales_id),
      date: item.sales_date,
      productId: item.product_id,
      productName: item.product_name,
      qty: Number(item.qty),
      price: Number(item.unit_price),
      subtotal: Number(item.subtotal)
    }));

    wasteRecord = result.wasteRecords.map((item) => ({
      id: String(item.waste_id),
      date: item.waste_date,
      itemId: item.material_id,
      itemName: item.material_name,
      qty: Number(item.waste_qty),
      reason: item.reason || "",
      unit: item.unit
    }));

    // 若尚未計算過備貨，先初始化一次預設預估
    if (!forecastResult) {
      await fetchForecastFromServer();
    }

    renderAll();
  } catch (error) {
    console.error(error);
    showToast("無法連接資料庫 API", "error");
  }
}

// BOM 物料清單（供前端預扣或報表輔助計算，核心扣料仍由後端處理）
const bomRules = {
  P01: [
    { itemId: "M01", qty: 1 / 15 },
    { itemId: "M02", qty: 3 / 15 },
    { itemId: "M03", qty: 1 / 30 },
    { itemId: "M04", qty: 1 / 50 },
    { itemId: "M05", qty: 1 / 40 },
    { itemId: "M06", qty: 1 / 80 }
  ],
  P02: [
    { itemId: "M01", qty: 1.25 / 15 },
    { itemId: "M02", qty: 3.8 / 15 },
    { itemId: "M03", qty: 1.25 / 30 },
    { itemId: "M04", qty: 1.25 / 50 },
    { itemId: "M05", qty: 1.25 / 40 },
    { itemId: "M06", qty: 1.25 / 80 }
  ],
  P03: [{ itemId: "M09", qty: 1 }, { itemId: "M08", qty: 1 }],
  P04: [{ itemId: "M07", qty: 1 }, { itemId: "M04", qty: 1 / 50 }],
  P05: [{ itemId: "M07", qty: 1 }, { itemId: "M04", qty: 1 / 50 }],
  P06: []
};

// 2. 銷售紀錄：點擊完成銷售對接 Flask POST /sales/create
async function submitSaleToDatabase() {
  const selected = products.filter((product) => currentOrder[product.id] > 0);

  if (selected.length === 0) {
    showToast("請至少選擇一項商品", "error");
    return;
  }

  try {
    for (const product of selected) {
      const response = await fetch("http://127.0.0.1:5000/sales/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sale_id: `S${Date.now().toString().slice(-6)}`,
          product_id: product.id,
          qty: currentOrder[product.id]
        })
      });

      const result = await response.json();
      if (!result.success) {
        showToast(result.message, "error");
        return;
      }
    }

    currentOrder = {};
    hasPendingSale = false;
    showToast("銷售資料已成功寫入資料庫！");
    await loadData();

  } catch (error) {
    console.error(error);
    showToast("銷售資料寫入失敗", "error");
  }
}

// 3. 備貨建議：呼叫後端 POST /forecast/calculate 進行複雜算力預估
async function fetchForecastFromServer() {
  const weather = $("#weather")?.value || "cloudy";
  const holiday = $("#holiday")?.value || "weekday";
  const festival = $("#festival")?.value || "no";
  const cityEvent = $("#cityEvent")?.value || "no";

  try {
    const response = await fetch("http://127.0.0.1:5000/forecast/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weather: weather,
        holiday: holiday,
        festival: festival,
        city_event: cityEvent
      })
    });

    const result = await response.json();
    if (result.success) {
      // 將後端回傳欄位映射成前端格式
      forecastResult = {
        baseBowls: result.base_bowls,
        safeBowls: result.safe_bowls,
        rows: result.material_requirements.map(m => ({
          itemId: m.material_id,
          name: m.name,
          unit: m.unit,
          need: m.required_qty,
          stock: m.current_stock,
          restock: m.suggested_replenishment
        }))
      };
    }
  } catch (error) {
    console.error("無法從後端取得備貨建議數據:", error);
  }
}

//輔助轉換與格式化函數
function formatMoney(value) {
  return `$${Math.round(Number(value)).toLocaleString("zh-TW")}`;
}

function formatQty(value) {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type === "success" ? "" : type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "toast"; }, 2600);
}

function switchPage(pageId) {
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === pageId));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === pageId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function getProduct(productId) { return products.find((p) => p.id === productId); }
function getInventoryItem(itemId) { return inventory.find((item) => item.id === itemId); }
function supplierNameById(id) { return suppliers.find((s) => s.id === id)?.name || "未指定"; }

function statusInfo(item) {
  if (item.expiryDays < 0) return { text: "已過期", className: "tag-expired" };
  if (item.expiryDays <= 1) return { text: "即將過期", className: "tag-danger" };
  if (item.stock < item.safeStock) return { text: "低庫存", className: "tag-low" };
  return { text: "正常", className: "tag-normal" };
}

function purchaseStatusClass(status) {
  if (status === "已驗收") return "tag-done";
  if (status === "異常") return "tag-abnormal";
  return "tag-ordered";
}

function getOrderUsage(orderMap) {
  const usage = {};
  Object.entries(orderMap).forEach(([productId, qty]) => {
    if (qty <= 0) return;
    (bomRules[productId] || []).forEach((rule) => {
      usage[rule.itemId] = (usage[rule.itemId] || 0) + rule.qty * qty;
    });
  });
  return usage;
}

function getSalesRecordUsage(record) { return getOrderUsage({ [record.productId]: record.qty }); }

function todaySales() { return salesRecord.filter((record) => record.date === TODAY); }
function reportFilteredSales() {
  const startDate = $("#startDate")?.value || "0000-01-01";
  const endDate = $("#endDate")?.value || "9999-12-31";
  const productFilter = $("#filterProduct")?.value || "all";
  return salesRecord.filter((r) => r.date >= startDate && r.date <= endDate && (productFilter === "all" || r.productId === productFilter));
}

function reportFilteredWaste() {
  const startDate = $("#startDate")?.value || "0000-01-01";
  const endDate = $("#endDate")?.value || "9999-12-31";
  const materialFilter = $("#filterMaterial")?.value || "all";
  return wasteRecord.filter((r) => r.date >= startDate && r.date <= endDate && (materialFilter === "all" || r.itemId === materialFilter));
}

//畫面渲染函數群
function renderDashboard() {
  $("#todayLabel").textContent = `今日：${TODAY.replaceAll("-", "/")}`;

  const today = todaySales();
  const revenue = today.reduce((sum, record) => sum + record.price * record.qty, 0);
  const noodleBowls = today.reduce((sum, record) => getProduct(record.productId)?.isNoodle ? sum + record.qty : sum, 0);
  const lowItems = inventory.filter((item) => item.stock < item.safeStock);
  const expiringItems = inventory.filter((item) => item.expiryDays <= 1);
  const pendingOrders = purchaseOrders.filter((order) => order.status === "已下單");

  $("#dashboardMetrics").innerHTML = [
    { label: "今日營收", value: formatMoney(revenue), note: "由今日銷售明細加總" },
    { label: "今日涼麵銷售", value: `${formatQty(noodleBowls)} 碗`, note: "涼麵小、涼麵大合計" },
    { label: "今日銷售筆數", value: `${today.length} 筆`, note: "salesRecord 自動計算" },
    { label: "低庫存品項", value: `${lowItems.length} 項`, note: lowItems.length ? lowItems.map((i) => i.name).join("、") : "目前正常", tone: lowItems.length ? "warning" : "" }
  ].map((metric) => `
    <article class="metric-card ${metric.tone || ""}">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <small>${metric.note}</small>
    </article>
  `).join("");

  const alerts = [];
  lowItems.forEach((i) => alerts.push({ type: "warning", text: `${i.name} 目前 ${formatQty(i.stock)}${i.unit}，低於安全庫存 ${formatQty(i.safeStock)}${i.unit}，建議補貨。` }));
  expiringItems.forEach((i) => alerts.push({ type: "danger", text: `${i.name} 保存期限剩餘 ${i.expiryDays <= 0 ? "不到 1" : i.expiryDays} 天，請確認是否需使用或報廢。` }));
  pendingOrders.forEach((o) => alerts.push({ type: "info", text: `${o.id} ${o.itemName} 尚未驗收，收貨後請完成驗收。` }));
  if (alerts.length === 0) alerts.push({ type: "info", text: "目前沒有低庫存、即將過期或未驗收提醒。" });

  $("#dashboardAlertTag").textContent = alerts.length > 1 ? `${alerts.length} 則提醒` : "正常";
  $("#dashboardAlertTag").className = `tag ${alerts.length > 1 ? "tag-danger" : "tag-normal"}`;
  $("#dashboardAlerts").innerHTML = alerts.map((a) => `<div class="alert alert-${a.type}">${a.text}</div>`).join("");

  if (forecastResult) {
    $("#dashboardForecast").innerHTML = forecastResult.rows.map((row) => `
      <div><span>${row.name}</span><strong>補 ${formatQty(row.restock)} ${row.unit}</strong></div>
    `).join("");
  }
}

function renderProducts() {
  $("#productGrid").innerHTML = products.map((product) => {
    const qty = currentOrder[product.id] || 0;
    return `
      <div class="product-card">
        <h4>${product.name}</h4>
        <div class="price">${formatMoney(product.price)}</div>
        <div class="qty-control">
          <button type="button" data-action="minus" data-id="${product.id}">-</button>
          <output>${qty}</output>
          <button type="button" data-action="plus" data-id="${product.id}">+</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderCurrentOrder() {
  const selected = products.filter((product) => currentOrder[product.id] > 0);
  const total = selected.reduce((sum, product) => sum + product.price * currentOrder[product.id], 0);

  $("#salesTotal").textContent = formatMoney(total);
  $("#currentOrder").classList.toggle("empty", selected.length === 0);
  $("#currentOrder").innerHTML = selected.length
    ? selected.map((p) => `<div class="order-line"><span>${p.name} x ${currentOrder[p.id]}</span><strong>${formatMoney(p.price * currentOrder[p.id])}</strong></div>`).join("")
    : "尚未選擇商品";
}

function renderSalesTable() {
  const table = $("#salesTable");
  const today = todaySales();
  if (today.length === 0) {
    table.innerHTML = `<tr><td colspan="5" class="empty">今日尚無銷售明細</td></tr>`;
    return;
  }
  table.innerHTML = today.map((r) => `
    <tr>
      <td>${r.productName}</td><td>${formatQty(r.qty)}</td><td>${formatMoney(r.price)}</td><td>${formatMoney(r.price * r.qty)}</td>
      <td><button class="btn btn-danger btn-small" data-delete-sale="${r.id}">刪除</button></td>
    </tr>
  `).join("");
}

function renderInventoryTable() {
  $("#inventoryTable").innerHTML = inventory.map((item) => {
    const status = statusInfo(item);
    return `
      <tr>
        <td>${item.id}</td><td>${item.name}</td><td>${formatQty(item.stock)}</td><td>${item.unit}</td><td>${formatQty(item.safeStock)}</td>
        <td>${item.expiryDays < 0 ? "已過期" : `${item.expiryDays} 天`}</td><td><span class="tag ${status.className}">${status.text}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-small" data-adjust-stock="${item.id}" data-delta="1">+1</button>
            <button class="btn btn-ghost btn-small" data-adjust-stock="${item.id}" data-delta="-1">-1</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  $("#wasteItem").innerHTML = inventory.map((i) => `<option value="${i.id}">${i.name}（目前 ${formatQty(i.stock)}${i.unit}）</option>`).join("");
  $("#poItem").innerHTML = inventory.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
}

function renderSupplierOptions() {
  $("#poSupplier").innerHTML = suppliers.map((s) => `<option value="${s.id}">${s.name}</option>`).join("");
}

function renderPurchaseTable() {
  $("#purchaseTable").innerHTML = purchaseOrders.map((order) => {
    const disabled = order.status === "已驗收" || order.status === "異常";
    return `
      <tr>
        <td>${order.id}</td><td>${order.date}</td><td>${supplierNameById(order.supplierId)}</td><td>${order.itemName}</td><td>${formatQty(order.qty)}</td>
        <td><span class="tag ${purchaseStatusClass(order.status)}">${order.status}</span></td>
        <td><button class="btn btn-secondary btn-small" data-receive="${order.id}" ${disabled ? "disabled" : ""}>${disabled ? "已完成" : "驗收"}</button></td>
      </tr>
    `;
  }).join("");
}

function renderForecastInputs() {
  const activeId = document.activeElement?.id || "";
  if (activeId.startsWith("forecast-stock-")) return;

  $("#forecastStockInputs").innerHTML = inventory.map((item) => `
    <label>${item.name}庫存（${item.unit}）
      <input id="forecast-stock-${item.id}" data-forecast-stock="${item.id}" type="number" min="0" step="0.01" value="${formatQty(item.stock)}">
    </label>
  `).join("");
}

function renderForecastTable() {
  if (!forecastResult) return;
  $("#forecastBase").textContent = `${forecastResult.baseBowls} 碗`;
  $("#forecastSafe").textContent = `${forecastResult.safeBowls} 碗`;
  $("#forecastTable").innerHTML = forecastResult.rows.map((row) => `
    <tr>
      <td>${row.name}</td>
      <td class="text-right">${formatQty(row.need)} ${row.unit}</td>
      <td class="text-right">${formatQty(row.stock)} ${row.unit}</td>
      <td class="text-right"><strong>${formatQty(row.restock)} ${row.unit}</strong></td>
    </tr>
  `).join("");
}

function renderReportFilters() {
  const currentProduct = $("#filterProduct").value || "all";
  const currentMaterial = $("#filterMaterial").value || "all";
  $("#filterProduct").innerHTML = `<option value="all">全部商品</option>` + products.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  $("#filterMaterial").innerHTML = `<option value="all">全部原料</option>` + inventory.map((i) => `<option value="${i.id}">${i.name}</option>`).join("");
  $("#filterProduct").value = products.some((p) => p.id === currentProduct) ? currentProduct : "all";
  $("#filterMaterial").value = inventory.some((i) => i.id === currentMaterial) ? currentMaterial : "all";
}

function renderReports() {
  renderReportFilters();
  const sales = reportFilteredSales();
  const wastes = reportFilteredWaste();
  const startDate = $("#startDate")?.value || "0000-01-01";
  const endDate = $("#endDate")?.value || "9999-12-31";
  const purchaseInRange = purchaseOrders.filter((order) => order.date >= startDate && order.date <= endDate);

  activeReportHasData = sales.length > 0 || wastes.length > 0 || purchaseInRange.length > 0;
  $("#reportEmpty").classList.toggle("hidden", activeReportHasData);
  $("#reportContent").classList.toggle("hidden", !activeReportHasData);
  if (!activeReportHasData) return;

  const revenue = sales.reduce((sum, r) => sum + r.price * r.qty, 0);
  const saleQty = sales.reduce((sum, r) => sum + r.qty, 0);
  const purchaseQty = purchaseInRange.reduce((sum, o) => sum + (o.receivedQty ?? 0), 0);
  const wasteQty = wastes.reduce((sum, r) => sum + r.qty, 0);

  $("#reportSummary").innerHTML = [
    { label: "本週營收", value: formatMoney(revenue), note: "依篩選日期加總" },
    { label: "本週銷售量", value: `${formatQty(saleQty)} 份`, note: "全部商品銷售數" },
    { label: "本週進貨量", value: `${formatQty(purchaseQty)} 單位`, note: "已驗收實收量" },
    { label: "本週報廢量", value: `${formatQty(wasteQty)} 單位`, note: "報廢登記加總" }
  ].map((metric) => `
    <article class="metric-card"><span>${metric.label}</span><strong>${metric.value}</strong><small>${metric.note}</small></article>
  `).join("");

  // 營收圖表、熱門品項與報廢分析圖表更新
  const dayMap = {};
  sales.forEach((r) => { dayMap[r.date] = (dayMap[r.date] || 0) + r.price * r.qty; });
  const revenueDays = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).slice(-7).map(([date, value]) => ({ label: date.slice(5).replace("-", "/"), value }));
  const safeRevenueDays = revenueDays.length ? revenueDays : [{ label: "無資料", value: 0 }];
  const maxRevenue = Math.max(1, ...safeRevenueDays.map((d) => d.value));
  $("#revenueChart").innerHTML = safeRevenueDays.map((d) => `
    <div class="bar-item"><span class="bar-value">${formatMoney(d.value)}</span><div class="bar" style="height:${Math.max(24, (d.value / maxRevenue) * 175)}px"></div><span class="bar-label">${d.label}</span></div>
  `).join("");

  const productMap = {};
  sales.forEach((r) => { productMap[r.productName] = (productMap[r.productName] || 0) + r.qty; });
  const productRank = Object.entries(productMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const rankMax = Math.max(1, ...productRank.map((i) => i.value));
  $("#productRankChart").innerHTML = productRank.length 
    ? productRank.map((i) => `<div class="rank-row"><strong>${i.name}</strong><div class="rank-track"><div class="rank-fill" style="width:${(i.value / rankMax) * 100}%"></div></div><span>${formatQty(i.value)} 份</span></div>`).join("")
    : `<div class="empty">目前查無商品銷售資料</div>`;

  const wasteMap = {};
  wastes.forEach((r) => { wasteMap[r.itemName] = (wasteMap[r.itemName] || 0) + r.qty; });
  const wasteRows = Object.entries(wasteMap).map(([name, value]) => ({ name, value }));
  const wasteMax = Math.max(1, ...wasteRows.map((i) => i.value));
  $("#wasteChart").innerHTML = wasteRows.length
    ? wasteRows.map((i) => `<div class="waste-row"><strong>${i.name}</strong><div class="waste-track"><div class="waste-fill" style="width:${(i.value / wasteMax) * 100}%"></div></div><span>${formatQty(i.value)} 單位</span></div>`).join("")
    : `<div class="empty">目前沒有報廢紀錄</div>`;

  // 進銷存整合表
  const salesUsage = {};
  sales.forEach((r) => { Object.entries(getSalesRecordUsage(r)).forEach(([itemId, qty]) => { salesUsage[itemId] = (salesUsage[itemId] || 0) + qty; }); });
  const purchaseMap = {};
  purchaseInRange.forEach((o) => { purchaseMap[o.itemId] = (purchaseMap[o.itemId] || 0) + (o.receivedQty ?? 0); });
  const wasteByItem = {};
  wastes.forEach((r) => { wasteByItem[r.itemId] = (wasteByItem[r.itemId] || 0) + r.qty; });

  $("#stockOverviewTable").innerHTML = inventory.map((item) => {
    const status = statusInfo(item);
    return `
      <tr>
        <td>${item.name}</td><td>${formatQty(item.stock)} ${item.unit}</td><td>${formatQty(purchaseMap[item.id] || 0)} ${item.unit}</td>
        <td>${formatQty(salesUsage[item.id] || 0)} ${item.unit}</td><td>${formatQty(wasteByItem[item.id] || 0)} ${item.unit}</td>
        <td><span class="tag ${status.className}">${status.text}</span></td>
      </tr>
    `;
  }).join("");
}

async function renderSupplierTable() {
  try {
    const response = await fetch("http://127.0.0.1:5000/supplier/list");
    const data = await response.json();

    suppliers = data.map(s => ({
      id: s.supplier_id, name: s.name, phone: s.phone, contact: s.contact || "未填寫", address: s.address || "未填寫", items: "麵條、小黃瓜", used: true
    }));

    $("#supplierTable").innerHTML = suppliers.map((supplier) => `
      <tr>
        <td>${supplier.id}</td><td>${supplier.name}</td><td>${supplier.contact}</td><td>${supplier.phone}</td><td>${supplier.address}</td><td>${supplier.items}</td>
        <td><div class="table-actions"><button class="btn btn-secondary btn-small" data-edit-supplier="${supplier.id}">修改</button><button class="btn btn-danger btn-small" data-delete-supplier="${supplier.id}">刪除</button></div></td>
      </tr>
    `).join("");
    
    renderSupplierOptions();
  } catch (error) {
    showToast("無法取得供應商列表", "error");
  }
}

function resetSupplierForm() {
  $("#supplierFormTitle").textContent = "新增供應商";
  $("#supplierEditId").value = "";
  $("#supplierForm").reset();
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderCurrentOrder();
  renderSalesTable();
  renderInventoryTable();
  renderSupplierOptions();
  renderPurchaseTable();
  renderForecastInputs();
  renderForecastTable();
  renderReports();
}

//事件綁定群
function bindNavigation() {
  $$(".nav-item").forEach((item) => { item.addEventListener("click", () => switchPage(item.dataset.page)); });
  $$("[data-jump]").forEach((button) => { button.addEventListener("click", () => switchPage(button.dataset.jump)); });
}

function bindSalesEvents() {
  $("#productGrid").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const product = getProduct(button.dataset.id);
    const currentQty = currentOrder[product.id] || 0;
    currentOrder[product.id] = button.dataset.action === "minus" ? Math.max(0, currentQty - 1) : currentQty + 1;

    renderProducts();
    renderCurrentOrder();
  });

  $("#addSaleBtn").addEventListener("click", () => {
    showToast("暫存加入本筆銷售清單（請點擊完成銷售以同步至後端）", "warning");
  });

  $("#completeSaleBtn").addEventListener("click", submitSaleToDatabase);
}

function bindInventoryEvents() {
  // 報廢登記完全對接 Flask POST /scrap/create
  $("#wasteForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const materialId = $("#wasteItem").value;
    const qty = Number($("#wasteQty").value);
    const reason = $("#wasteReason").value.trim();

    if (!reason || qty <= 0) {
      showToast("請填寫正確的報廢原因與數量", "error");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/scrap/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material_id: materialId, quantity: qty, reason: reason })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showToast(result.message || "已記錄報廢資料並同步扣除庫存");
        event.target.reset();
        $("#wasteQty").value = 0;
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast("連線至伺服器失敗", "error");
    }
  });
}

function bindPurchaseEvents() {
  // 進貨單新增對接 Flask POST /purchase/create
  $("#purchaseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const supplierId = $("#poSupplier").value;
    const itemId = $("#poItem").value;
    const qty = Number($("#poQty").value);

    if (!supplierId || qty <= 0) {
      showToast("請填寫正確進貨資訊", "error");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/purchase/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchase_id: `PO${Date.now().toString().slice(-6)}`,
          material_id: itemId,
          qty: qty,
          cost: 0 // 可依需求擴充前端欄位輸入成本，目前給預設0
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showToast("已成功建立進貨單！");
        $("#poQty").value = 1;
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast("建立進貨單連線失敗", "error");
    }
  });

  // 打開驗收彈窗
  $("#purchaseTable").addEventListener("click", (event) => {
    const button = event.target.closest("[data-receive]");
    if (!button || button.disabled) return;
    const order = purchaseOrders.find((item) => item.id === button.dataset.receive);
    $("#receiveId").value = order.id;
    $("#receiveQty").value = order.qty;
    $("#receiveNote").value = "品質正常";
    $("#modal").classList.remove("hidden");
  });

  // 進貨單驗收對接 Flask PUT /purchase/receive/<id>
  $("#receiveForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const poId = $("#receiveId").value;
    const receiveQty = Number($("#receiveQty").value);
    const note = $("#receiveNote").value.trim();

    try {
      const response = await fetch(`http://127.0.0.1:5000/purchase/receive/${poId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          received_qty: receiveQty,
          note: note
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        showToast(result.message || "驗收完成，庫存已更新！");
        $("#modal").classList.add("hidden");
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast("連線至伺服器失敗", "error");
    }
  });

  $("#closeModal").addEventListener("click", () => $("#modal").classList.add("hidden"));
}

function bindForecastEvents() {
  // 重新計算備貨按鈕：呼叫後端預估計演算法
  $("#forecastForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showToast("正在連線後端核心計算備貨量...");
    await fetchForecastFromServer();
    renderAll();
    showToast("已完成今日備貨建議計算");
  });
}

function bindReportEvents() {
  $("#reportFilter").addEventListener("submit", (event) => {
    event.preventDefault();
    if ($("#startDate").value > $("#endDate").value) {
      showToast("日期區間不可開始日大於結束日", "error");
      return;
    }
    renderAll();
    showToast(activeReportHasData ? "報表篩選已套用" : "目前查無資料", activeReportHasData ? "success" : "warning");
  });
}

function bindSupplierEvents() {
  $("#supplierForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = $("#supplierEditId").value;
    const name = $("#supplierName").value.trim();
    const phone = $("#supplierPhone").value.trim();
    const contact = $("#supplierContact").value.trim();
    const address = $("#supplierAddress").value.trim();

    if (!name || !phone) {
      showToast("供應商名稱與電話不可空白", "error");
      return;
    }

    const payload = {
      supplier_id: editId ? editId : `S${String(suppliers.length + 1).padStart(2, "0")}`,
      name: name, phone: phone, contact: contact, address: address
    };

    try {
      let response = editId 
        ? await fetch(`http://127.0.0.1:5000/supplier/update/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("http://127.0.0.1:5000/supplier/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      const result = await response.json();
      if (response.ok) {
        showToast(result.message);
        resetSupplierForm();
        await renderSupplierTable();
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast("伺服器連線失敗", "error");
    }
  });

  $("#supplierTable").addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-supplier]");
    const deleteButton = event.target.closest("[data-delete-supplier]");

    if (editButton) {
      const supplierId = editButton.dataset.editSupplier;
      try {
        const response = await fetch(`http://127.0.0.1:5000/supplier/${supplierId}`);
        if (!response.ok) { showToast("找不到該供應商資料", "error"); return; }
        const s = await response.json();

        $("#supplierFormTitle").textContent = "修改供應商";
        $("#supplierEditId").value = s.supplier_id;
        $("#supplierName").value = s.name;
        $("#supplierContact").value = s.contact;
        $("#supplierPhone").value = s.phone;
        $("#supplierAddress").value = s.address;
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) { showToast("連線失敗", "error"); }
    }
    
    if (deleteButton) {
      const supplierId = deleteButton.dataset.deleteSupplier;
      if (!confirm("確定要刪除此供應商嗎？")) return;
      try {
        const response = await fetch(`http://127.0.0.1:5000/supplier/delete/${supplierId}`, { method: "DELETE" });
        const result = await response.json();
        if (response.ok) { showToast(result.message); await renderSupplierTable(); }
        else { showToast(result.message, "error"); }
      } catch (error) { showToast("連線失敗", "error"); }
    }
  });

  $("#cancelSupplierEdit").addEventListener("click", resetSupplierForm);
}

//初始化：網頁載入完成後綁定所有事件並同步後端
document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindSalesEvents();
  bindInventoryEvents();
  bindPurchaseEvents();
  bindForecastEvents();
  bindReportEvents();
  bindSupplierEvents();
  
  loadData();
  renderSupplierTable();
});