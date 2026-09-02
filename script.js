/* ==========================================================================
   Haas AI Solutions - Customer Portal
   Pure HTML/CSS/Vanilla JS. Replace MOCK DATA / loadTenantData() with a
   real API call when a backend is available (see notes at bottom).
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     1. MOCK DATA
     In production, fetch this from your backend, e.g.:
       fetch('/api/tenant/usage?range=30').then(r => r.json())
     Replace loadTenantData() accordingly - the rest of the app just
     consumes the shape returned below.
  --------------------------------------------------------------------- */

  const TENANT = {
    name: "Acme Corp",
    plan: "Growth Plan",
    initials: "A"
  };

  // Colors used consistently across cards + charts
  const APP_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#eab308"];

  const APPS = [
    { id: "crm", name: "Haas CRM Suite", category: "Sales & CRM", ratePerHour: 4.50, status: "active" },
    { id: "docai", name: "DocAI Extractor", category: "Document Intelligence", ratePerHour: 6.00, status: "active" },
    { id: "chatops", name: "ChatOps Assistant", category: "Internal Automation", ratePerHour: 3.25, status: "active" },
    { id: "analytics", name: "Insight Analytics", category: "Business Intelligence", ratePerHour: 5.00, status: "active" },
    { id: "supportbot", name: "SupportBot Pro", category: "Customer Support", ratePerHour: 3.75, status: "idle" },
    { id: "hrhub", name: "HR Hub AI", category: "Human Resources", ratePerHour: 2.90, status: "active" }
  ];

  // Deterministic pseudo-random generator so numbers are stable across reloads
  function seededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // Generates N days of per-app usage hours
  function generateDailyUsage(days) {
    const rand = seededRandom(42);
    const data = {}; // appId -> [ {date, hours, sessions, users} ]
    const today = new Date();

    APPS.forEach((app, idx) => {
      data[app.id] = [];
      const baseline = 0.6 + rand() * 2.6; // avg hours/day baseline per app
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const weekday = d.getDay();
        const weekendDamp = (weekday === 0 || weekday === 6) ? 0.35 : 1;
        const noise = 0.4 + rand() * 1.3;
        const hours = app.status === "idle"
          ? Math.max(0, (baseline * 0.15 * noise * weekendDamp))
          : Math.max(0, baseline * noise * weekendDamp);
        const sessions = Math.max(0, Math.round(hours * (1.5 + rand())));
        const users = Math.max(0, Math.round(1 + rand() * 6));
        data[app.id].push({
          date: d.toISOString().slice(0, 10),
          hours: Math.round(hours * 100) / 100,
          sessions,
          users
        });
      }
    });
    return data;
  }

  /* ---------------------------------------------------------------------
     2. STATE
  --------------------------------------------------------------------- */

  let RANGE_DAYS = 30;
  let DAILY_USAGE = generateDailyUsage(90); // generate max range once, slice per view

  /* ---------------------------------------------------------------------
     3. HELPERS
  --------------------------------------------------------------------- */

  function money(n) {
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function hoursLabel(n) {
    if (n < 1) return Math.round(n * 60) + "m";
    return (Math.round(n * 10) / 10) + "h";
  }

  function colorFor(index) {
    return APP_COLORS[index % APP_COLORS.length];
  }

  function initialsFor(name) {
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  }

  function daysAgoLabel(dateStr) {
    const then = new Date(dateStr);
    const diffMs = Date.now() - then.getTime();
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return diffDays + "d ago";
  }

  // Aggregate per-app totals for the current RANGE_DAYS
  function computeAppTotals() {
    return APPS.map((app, idx) => {
      const series = DAILY_USAGE[app.id].slice(-RANGE_DAYS);
      const totalHours = series.reduce((s, d) => s + d.hours, 0);
      const totalSessions = series.reduce((s, d) => s + d.sessions, 0);
      const maxUsers = series.reduce((m, d) => Math.max(m, d.users), 0);
      const lastActiveEntry = [...series].reverse().find(d => d.hours > 0);
      const cost = totalHours * app.ratePerHour;
      const avgSession = totalSessions > 0 ? totalHours / totalSessions : 0;
      return {
        ...app,
        color: colorFor(idx),
        totalHours,
        totalSessions,
        maxUsers,
        cost,
        avgSession,
        lastActive: lastActiveEntry ? lastActiveEntry.date : null,
        series
      };
    });
  }

  /* ---------------------------------------------------------------------
     4. RENDER: Sidebar / Tenant
  --------------------------------------------------------------------- */

  function renderTenant() {
    document.getElementById("tenantName").textContent = TENANT.name;
    document.getElementById("tenantPlan").textContent = TENANT.plan;
    document.getElementById("tenantAvatar").textContent = TENANT.initials;
  }

  /* ---------------------------------------------------------------------
     5. RENDER: Dashboard
  --------------------------------------------------------------------- */

  function renderDashboard(totals) {
    const activeApps = totals.filter(a => a.status === "active");
    const totalHours = totals.reduce((s, a) => s + a.totalHours, 0);
    const totalCost = totals.reduce((s, a) => s + a.cost, 0);
    const topApp = [...totals].sort((a, b) => b.totalHours - a.totalHours)[0];

    document.getElementById("statApps").textContent = activeApps.length;
    document.getElementById("statHours").textContent = hoursLabel(totalHours);
    document.getElementById("statCost").textContent = money(totalCost);
    document.getElementById("statTopApp").textContent = topApp ? topApp.name : "--";

    document.getElementById("statHoursTrend").textContent =
      "avg " + hoursLabel(totalHours / RANGE_DAYS) + "/day";
    document.getElementById("statCostTrend").textContent =
      "avg " + money(totalCost / RANGE_DAYS) + "/day";

    renderUsageChart(totals);
    renderSpendChart(totals);
    renderAppGrid(totals, "appGrid", 6);
  }

  function renderAppGrid(totals, containerId, limit) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    const list = limit ? totals.slice(0, limit) : totals;

    list.forEach(app => {
      const card = document.createElement("div");
      card.className = "app-card";
      card.innerHTML = `
        <div class="app-card-top">
          <div class="app-icon" style="background:${app.color}">${initialsFor(app.name)}</div>
          <div>
            <div class="app-name">${app.name}</div>
            <div class="app-category">${app.category}</div>
          </div>
        </div>
        <span class="status-pill ${app.status === 'active' ? 'status-active' : 'status-idle'}">${app.status}</span>
        <div class="app-stats">
          <div>Usage<b>${hoursLabel(app.totalHours)}</b></div>
          <div>Sessions<b>${app.totalSessions}</b></div>
          <div>Est. cost<b>${money(app.cost)}</b></div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* ---------------------------------------------------------------------
     6. RENDER: Apps view
  --------------------------------------------------------------------- */

  function renderAppsView(totals) {
    renderAppGrid(totals, "appGridFull", null);
  }

  function setupAppSearch(totals) {
    const input = document.getElementById("appSearch");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      const filtered = totals.filter(a =>
        a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
      );
      renderAppGrid(filtered, "appGridFull", null);
    });
  }

  /* ---------------------------------------------------------------------
     7. RENDER: Usage view
  --------------------------------------------------------------------- */

  function renderUsageView(totals) {
    const tbody = document.getElementById("usageTableBody");
    tbody.innerHTML = "";
    const sorted = [...totals].sort((a, b) => b.totalHours - a.totalHours);

    sorted.forEach(app => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${app.name}</strong></td>
        <td>${app.totalSessions}</td>
        <td>${app.maxUsers}</td>
        <td>${hoursLabel(app.totalHours)}</td>
        <td>${hoursLabel(app.avgSession)}</td>
        <td>${app.lastActive ? daysAgoLabel(app.lastActive) : "--"}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ---------------------------------------------------------------------
     8. RENDER: Billing view
  --------------------------------------------------------------------- */

  function renderBillingView(totals) {
    const totalCost = totals.reduce((s, a) => s + a.cost, 0);
    const daysElapsed = RANGE_DAYS;
    const dailyAvg = totalCost / daysElapsed;
    const projected = dailyAvg * 30;

    document.getElementById("billTotal").textContent = money(totalCost);
    document.getElementById("billProjected").textContent = money(projected);
    document.getElementById("billPlan").textContent = TENANT.plan;
    document.getElementById("billTrend").textContent =
      "over last " + RANGE_DAYS + " days";

    const tbody = document.getElementById("billingTableBody");
    tbody.innerHTML = "";
    const sorted = [...totals].sort((a, b) => b.cost - a.cost);

    sorted.forEach(app => {
      const share = totalCost > 0 ? (app.cost / totalCost) * 100 : 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${app.name}</strong></td>
        <td>${hoursLabel(app.totalHours)}</td>
        <td>${money(app.ratePerHour)}</td>
        <td>${money(app.cost)}</td>
        <td>${share.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ---------------------------------------------------------------------
     9. CHARTS (pure Canvas, no libraries)
  --------------------------------------------------------------------- */

  function fitCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth;
    const cssHeight = parseInt(canvas.getAttribute("height"), 10) || 200;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width: cssWidth, height: cssHeight };
  }

  function renderUsageChart(totals) {
    const canvas = document.getElementById("usageChart");
    const { ctx, width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    // Aggregate combined hours per day across all apps
    const days = RANGE_DAYS;
    const combined = new Array(days).fill(0);
    totals.forEach(app => {
      app.series.forEach((d, i) => { combined[i] += d.hours; });
    });

    const padding = { top: 16, right: 16, bottom: 28, left: 42 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...combined, 1);
    const barGap = chartW / combined.length;
    const barWidth = Math.max(2, barGap * 0.6);

    // Gridlines
    ctx.strokeStyle = "#e8edf7";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#8a97b5";
    ctx.font = "11px Segoe UI, sans-serif";
    const gridLines = 4;
    for (let g = 0; g <= gridLines; g++) {
      const y = padding.top + (chartH / gridLines) * g;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      const val = maxVal - (maxVal / gridLines) * g;
      ctx.fillText(Math.round(val) + "h", 4, y + 4);
    }

    // Bars with gradient
    combined.forEach((val, i) => {
      const x = padding.left + i * barGap + (barGap - barWidth) / 2;
      const barH = (val / maxVal) * chartH;
      const y = padding.top + chartH - barH;

      const grad = ctx.createLinearGradient(0, y, 0, padding.top + chartH);
      grad.addColorStop(0, "#3b82f6");
      grad.addColorStop(1, "#0d2a5c");
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barWidth, barH, 3);
      ctx.fill();
    });

    // X-axis labels (sparse)
    ctx.fillStyle = "#8a97b5";
    const labelStep = Math.ceil(days / 6);
    const today = new Date();
    for (let i = 0; i < days; i += labelStep) {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const x = padding.left + i * barGap + barGap / 2;
      ctx.textAlign = "center";
      ctx.fillText(label, x, height - 8);
    }
    ctx.textAlign = "left";
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h < 0) h = 0;
    const rad = Math.min(r, w / 2, h / 2 || r);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }

  function renderSpendChart(totals) {
    const canvas = document.getElementById("spendChart");
    const { ctx, width, height } = fitCanvas(canvas);
    ctx.clearRect(0, 0, width, height);

    const totalCost = totals.reduce((s, a) => s + a.cost, 0);
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 10;
    const innerRadius = radius * 0.6;

    let startAngle = -Math.PI / 2;
    const sorted = [...totals].sort((a, b) => b.cost - a.cost);

    if (totalCost === 0) {
      ctx.fillStyle = "#c7d2e6";
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      sorted.forEach(app => {
        const slice = (app.cost / totalCost) * Math.PI * 2;
        const endAngle = startAngle + slice;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = app.color;
        ctx.fill();
        startAngle = endAngle;
      });
    }

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.fillStyle = "#04102b";
    ctx.textAlign = "center";
    ctx.font = "bold 15px Segoe UI, sans-serif";
    ctx.fillText(money(totalCost), cx, cy - 2);
    ctx.font = "11px Segoe UI, sans-serif";
    ctx.fillStyle = "#8a97b5";
    ctx.fillText("total spend", cx, cy + 14);
    ctx.textAlign = "left";

    // Legend
    const legend = document.getElementById("spendLegend");
    legend.innerHTML = "";
    sorted.forEach(app => {
      const pct = totalCost > 0 ? (app.cost / totalCost) * 100 : 0;
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="dot" style="background:${app.color}"></span>
        <span>${app.name}</span>
        <span class="pct">${pct.toFixed(0)}%</span>
      `;
      legend.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------------
     10. NAVIGATION
  --------------------------------------------------------------------- */

  const VIEW_META = {
    dashboard: { title: "Dashboard", subtitle: "Overview of your applications, usage and spend" },
    apps: { title: "My Apps", subtitle: "All applications provisioned for your tenant" },
    usage: { title: "Usage", subtitle: "Detailed usage time per application" },
    billing: { title: "Billing Estimate", subtitle: "Rough estimate of spend based on recorded usage" }
  };

  function switchView(viewName) {
    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    document.getElementById("view-" + viewName).classList.remove("hidden");

    document.querySelectorAll(".nav-link").forEach(link => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    document.getElementById("viewTitle").textContent = VIEW_META[viewName].title;
    document.getElementById("viewSubtitle").textContent = VIEW_META[viewName].subtitle;

    // Close mobile sidebar after navigating
    document.getElementById("sidebar").classList.remove("open");
  }

  function setupNav() {
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        switchView(link.dataset.view);
      });
    });

    document.getElementById("menuToggle").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
  }

  function setupRangeSelect() {
    document.getElementById("rangeSelect").addEventListener("change", (e) => {
      RANGE_DAYS = parseInt(e.target.value, 10);
      renderAll();
    });
  }

  /* ---------------------------------------------------------------------
     11. INIT
  --------------------------------------------------------------------- */

  function renderAll() {
    const totals = computeAppTotals();
    renderDashboard(totals);
    renderAppsView(totals);
    renderUsageView(totals);
    renderBillingView(totals);
  }

  function init() {
    renderTenant();
    setupNav();
    setupRangeSelect();

    const totals = computeAppTotals();
    setupAppSearch(totals);

    renderAll();

    // Re-render charts on resize (canvas needs explicit resize handling)
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(renderAll, 150);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();

/* ==========================================================================
   NOTES FOR HOOKING UP A REAL BACKEND
   --------------------------------------------------------------------------
   1. Replace APPS + generateDailyUsage() with a fetch to your API, e.g.:

        async function loadTenantData(rangeDays) {
          const res = await fetch(`/api/tenants/me/usage?days=${rangeDays}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return res.json(); // expect { apps: [...], dailyUsage: {...} }
        }

   2. Keep the returned shape compatible with computeAppTotals():
        - app: { id, name, category, ratePerHour, status }
        - dailyUsage[app.id]: [{ date, hours, sessions, users }, ...]

   3. Swap RANGE_DAYS handling to re-fetch from the server instead of
      slicing a pre-generated 90-day array.

   4. For authentication, gate init() behind a login check / SSO redirect,
      and populate TENANT from the authenticated session.
   ========================================================================== */
