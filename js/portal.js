import { backend, DEMO, STATUSES, makeJoNumber } from "./backend.js";
import { COMPANY, peso, splitTime, lineTotal, billTotal } from "./company.js";

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => el.classList.toggle("hidden", !on);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => (d instanceof Date ? d : new Date(d)).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
const fmtDay = (s) => (s ? new Date(s + "T00:00").toLocaleDateString("en-PH", { dateStyle: "medium" }) : "");
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

$("yr").textContent = new Date().getFullYear();
show($("demo-banner"), DEMO);
show($("google-wrap"), !DEMO);
$("j-date").min = todayIso();

let user = null;
let unsubMine = null;
let unsubAll = null;
let adminFilter = "All";
let allJobs = [];
let prices = { items: [], transpoFee: COMPANY.defaultTranspoFee };

/* ---------- Messages ---------- */
function msg(el, text, type = "error") {
  el.className = `alert ${type}`;
  el.textContent = text;
  show(el, !!text);
}
function authError(e) {
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/email-already-in-use": "An account with that email already exists. Try logging in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user": "Google sign-in was closed.",
    "demo/google-disabled": "Google sign-in is available once Firebase is connected.",
    "demo/reset-disabled": "Password reset is available once Firebase is connected.",
  };
  return map[e?.code] || e?.message || "Something went wrong. Please try again.";
}

/* ---------- Auth ---------- */
function setTab(which) {
  $("tab-login").classList.toggle("active", which === "login");
  $("tab-signup").classList.toggle("active", which === "signup");
  show($("form-login"), which === "login");
  show($("form-signup"), which === "signup");
  msg($("auth-msg"), "");
}
$("tab-login").onclick = () => setTab("login");
$("tab-signup").onclick = () => setTab("signup");

async function withBusy(form, fn) {
  const btn = form.querySelector("button[type=submit]");
  if (btn) btn.disabled = true;
  try { await fn(); } finally { if (btn) btn.disabled = false; }
}

$("form-login").onsubmit = (e) => {
  e.preventDefault();
  withBusy(e.target, async () => {
    try { await backend.signIn($("li-email").value.trim(), $("li-pass").value); }
    catch (err) { msg($("auth-msg"), authError(err)); }
  });
};
$("form-signup").onsubmit = (e) => {
  e.preventDefault();
  withBusy(e.target, async () => {
    try { await backend.signUp($("su-name").value.trim(), $("su-email").value.trim(), $("su-pass").value); }
    catch (err) { msg($("auth-msg"), authError(err)); }
  });
};
$("btn-google").onclick = async () => {
  try { await backend.signInGoogle(); } catch (err) { msg($("auth-msg"), authError(err)); }
};
$("link-reset").onclick = async (e) => {
  e.preventDefault();
  const email = $("li-email").value.trim();
  if (!email) return msg($("auth-msg"), "Enter your email above first, then tap Forgot password.");
  try { await backend.resetPassword(email); msg($("auth-msg"), "Password reset email sent. Check your inbox.", "success"); }
  catch (err) { msg($("auth-msg"), authError(err)); }
};
$("btn-logout").onclick = () => backend.signOut();

/* ---------- Views ---------- */
function showView(name) {
  show($("loading"), false);
  show($("view-auth"), name === "auth");
  show($("view-customer"), name === "customer");
  show($("view-admin"), name === "admin");
  if (name === "admin") history.replaceState(null, "", "#admin");
  else if (location.hash) history.replaceState(null, "", location.pathname);
}

backend.onAuth(async (u) => {
  user = u;
  unsubMine?.(); unsubAll?.();
  unsubMine = unsubAll = null;
  show($("btn-logout"), !!u);
  if (!u) { setTab("login"); return showView("auth"); }

  $("who-name").textContent = u.name || u.email.split("@")[0];
  $("who-email").textContent = u.email;
  if (!$("j-name").value) $("j-name").value = u.name || "";
  show($("btn-to-admin"), u.isAdmin);

  unsubMine = backend.watchMyJobs(u, (jobs, err) => renderMine(jobs, err));
  if (u.isAdmin) {
    prices = await backend.getPrices();
    unsubAll = backend.watchAllJobs((jobs, err) => { allJobs = jobs; renderAll(err); });
    return showView(location.hash === "#admin" ? "admin" : "customer");
  }
  showView("customer");
});

$("btn-to-admin").onclick = () => showView("admin");
$("btn-to-customer").onclick = () => showView("customer");

/* ---------- Customer: create job ---------- */
$("form-job").onsubmit = (e) => {
  e.preventDefault();
  withBusy(e.target, async () => {
    const data = {
      contactName: $("j-name").value.trim(),
      phone: $("j-phone").value.trim(),
      address: $("j-address").value.trim(),
      city: $("j-city").value.trim(),
      service: $("j-service").value,
      unitType: $("j-unit").value,
      quantity: Number($("j-qty").value) || 1,
      brand: $("j-brand").value.trim(),
      preferredDate: $("j-date").value,
      preferredTime: $("j-time").value,
      notes: $("j-notes").value.trim(),
    };
    try {
      await backend.createJob(user, data);
      ["j-address", "j-city", "j-brand", "j-date", "j-notes"].forEach((id) => ($(id).value = ""));
      $("j-service").value = ""; $("j-unit").value = ""; $("j-qty").value = 1;
      msg($("job-msg"), "Request submitted! We'll contact you to confirm the schedule.", "success");
      setTimeout(() => msg($("job-msg"), ""), 6000);
    } catch (err) {
      msg($("job-msg"), "Couldn't submit the request: " + (err?.message || err));
    }
  });
};

/* ---------- Rendering ---------- */
function jobCard(j, admin) {
  const statusCls = j.status.replace(/\s+/g, "-");
  const sched = j.jo?.date
    ? `📅 ${esc(fmtDay(j.jo.date))} · ${esc(splitTime(j.jo.time).clock)} ${esc(splitTime(j.jo.time).ampm)} · 👷 ${esc(j.jo.technicians)}`
    : `📅 Preferred: ${esc(fmtDay(j.preferredDate))} · ${esc(j.preferredTime)}`;
  const lines = [
    `${esc(j.unitType)} × ${esc(j.quantity)}${j.brand ? " · " + esc(j.brand) : ""}`,
    sched,
    `📍 ${esc(j.address)}, ${esc(j.city)}`,
  ];
  if (admin) lines.push(`👤 ${esc(j.contactName)} · 📞 <a href="tel:${esc(j.phone)}">${esc(j.phone)}</a>${j.email ? " · " + esc(j.email) : ""}`);
  if (j.billing) lines.push(`🧾 <span class="amount">${esc(peso(j.billing.total))}</span>${j.payment?.method ? " · paid via " + esc(j.payment.method) : ""}`);

  let actions = "";
  const id = esc(j.id);
  if (admin) {
    const b = [];
    if (j.status !== "Cancelled") {
      b.push(`<button class="btn ${j.jo?.number ? "btn-ghost" : "btn-primary"} btn-sm" data-act="jo" data-id="${id}">${j.jo?.number ? "Edit JO" : "Issue Job Order"}</button>`);
      if (j.jo?.number) b.push(`<a class="btn btn-ghost btn-sm" href="jo.html?id=${id}" target="_blank">🖨 Job Order</a>`);
      if (j.jo?.number) b.push(`<button class="btn ${j.billing ? "btn-ghost" : "btn-primary"} btn-sm" data-act="bill" data-id="${id}">${j.billing ? "Edit billing" : "Complete &amp; bill"}</button>`);
      if (j.billing) b.push(`<a class="btn btn-ghost btn-sm" href="billing.html?id=${id}" target="_blank">🧾 Billing Statement</a>`);
      if (j.status === "Billed") b.push(`<select data-pay="${id}"><option value="">Mark paid via…</option><option>Metrobank</option><option>GCash</option><option>Cash</option></select>`);
    }
    b.push(`<select data-status="${id}" title="Override status">${STATUSES.map((s) => `<option${s === j.status ? " selected" : ""}>${s}</option>`).join("")}</select>`);
    actions = `<div class="job-actions">${b.join("")}</div>`;
  } else {
    const b = [];
    if (j.status === "Pending") b.push(`<button class="btn btn-ghost btn-sm" data-cancel="${id}">Cancel request</button>`);
    if (j.billing) b.push(`<a class="btn btn-outline btn-sm" href="billing.html?id=${id}" target="_blank">View billing statement</a>`);
    if (b.length) actions = `<div class="job-actions">${b.join("")}</div>`;
  }

  return `<div class="job">
    <div class="job-top"><div><h4>${esc(admin ? j.contactName + " — " + j.service : j.service)}</h4>${j.jo?.number ? `<span class="jo-no">JO ${esc(j.jo.number)}</span>` : ""}</div><span class="badge ${statusCls}">${esc(j.status)}</span></div>
    ${lines.map((l) => `<div class="meta">${l}</div>`).join("")}
    ${j.notes ? `<p class="desc">${esc(j.notes)}</p>` : ""}
    <div class="meta" style="font-size:.8rem">Submitted ${esc(fmtDate(j.createdAt))}</div>
    ${actions}
  </div>`;
}

function renderMine(jobs, err) {
  const box = $("my-jobs");
  if (err) { box.innerHTML = `<div class="alert error">Couldn't load requests: ${esc(err.message)}</div>`; return; }
  box.innerHTML = jobs.length ? jobs.map((j) => jobCard(j, false)).join("") : `<div class="empty">No requests yet. Submit one using the form.</div>`;
  box.querySelectorAll("[data-cancel]").forEach((b) => {
    b.onclick = async () => {
      if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "Tap again to confirm"; return; }
      b.disabled = true;
      try { await backend.cancelJob(b.dataset.cancel); } catch (e) { b.textContent = "Failed, try again"; b.disabled = false; }
    };
  });
}

function filteredJobs() {
  const d = $("f-date").value;
  const q = $("f-search").value.trim().toLowerCase();
  return allJobs.filter((j) => {
    if (d && (j.jo?.date || j.preferredDate) !== d) return false;
    if (q && ![j.contactName, j.address, j.city, j.phone, j.email, j.jo?.number, j.service].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderAll(err) {
  const box = $("all-jobs");
  $("admin-count").textContent = allJobs.length;
  const base = filteredJobs();
  const opts = ["All", ...STATUSES];
  const counts = Object.fromEntries(opts.map((s) => [s, s === "All" ? base.length : base.filter((j) => j.status === s).length]));
  $("admin-filters").innerHTML = opts.map((s) => `<button data-f="${s}" class="${s === adminFilter ? "active" : ""}">${s} (${counts[s]})</button>`).join("");
  $("admin-filters").querySelectorAll("button").forEach((b) => (b.onclick = () => { adminFilter = b.dataset.f; renderAll(); }));

  if (err) { box.innerHTML = `<div class="alert error">Couldn't load jobs: ${esc(err.message)}</div>`; return; }
  const list = adminFilter === "All" ? base : base.filter((j) => j.status === adminFilter);
  if ($("f-date").value) list.sort((a, b) => (a.jo?.time || "99").localeCompare(b.jo?.time || "99"));
  box.innerHTML = list.length ? list.map((j) => jobCard(j, true)).join("") : `<div class="empty">No jobs here.</div>`;

  box.querySelectorAll("[data-status]").forEach((sel) => {
    sel.onchange = async () => { sel.disabled = true; try { await backend.updateStatus(sel.dataset.status, sel.value); } finally { sel.disabled = false; } };
  });
  box.querySelectorAll("[data-pay]").forEach((sel) => {
    sel.onchange = async () => {
      if (!sel.value) return;
      sel.disabled = true;
      await backend.updateJob(sel.dataset.pay, { status: "Paid", "payment.method": sel.value, "payment.paidAt": todayIso() });
    };
  });
  box.querySelectorAll("[data-act=jo]").forEach((b) => (b.onclick = () => openJo(b.dataset.id)));
  box.querySelectorAll("[data-act=bill]").forEach((b) => (b.onclick = () => openBill(b.dataset.id)));
}

$("f-date").onchange = () => renderAll();
$("f-search").oninput = () => renderAll();
$("btn-clear-date").onclick = () => { $("f-date").value = ""; renderAll(); };
$("btn-print-day").onclick = () => {
  const d = $("f-date").value || todayIso();
  window.open(`jo.html?date=${d}`, "_blank");
};

/* ---------- Admin tabs ---------- */
function adminTab(which) {
  $("atab-jobs").classList.toggle("active", which === "jobs");
  $("atab-prices").classList.toggle("active", which === "prices");
  show($("admin-jobs"), which === "jobs");
  show($("admin-prices"), which === "prices");
  if (which === "prices") renderPrices();
}
$("atab-jobs").onclick = () => adminTab("jobs");
$("atab-prices").onclick = () => adminTab("prices");

/* ---------- Dialog helpers ---------- */
document.querySelectorAll("dialog [data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));
const findJob = (id) => allJobs.find((j) => j.id === id);

/* ---------- Issue Job Order ---------- */
let joJobId = null;
function openJo(id) {
  const j = findJob(id);
  joJobId = id;
  $("jo-sub").textContent = `${j.contactName} · ${j.service} · ${j.unitType} × ${j.quantity}` + (j.jo?.number ? ` · JO ${j.jo.number}` : "");
  $("jo-date").value = j.jo?.date || j.preferredDate || todayIso();
  $("jo-time").value = j.jo?.time || (j.preferredTime?.startsWith("Afternoon") ? "13:00" : "09:00");
  $("jo-tech").value = j.jo?.technicians || "";
  $("jo-addr").value = j.jo?.address || `${j.address}, ${j.city}`.toUpperCase();
  const guess = j.jo?.serviceReq || [/clean/i.test(j.service) ? "Cleaning" : /repair|freon|trouble/i.test(j.service) ? "Repair" : "Check-up"];
  document.querySelectorAll("input[name=jo-req]").forEach((c) => (c.checked = guess.includes(c.value)));
  $("dlg-jo").showModal();
}
$("form-jo").onsubmit = async (e) => {
  e.preventDefault();
  const j = findJob(joJobId);
  const date = $("jo-date").value, time = $("jo-time").value;
  const { ampm } = splitTime(time);
  let number = j.jo?.number;
  // Re-number only if the date or AM/PM changed
  if (!number || j.jo.date !== date || !number.endsWith("-" + ampm)) number = await makeJoNumber(date, ampm);
  const patch = {
    "jo.number": number,
    "jo.date": date,
    "jo.time": time,
    "jo.technicians": $("jo-tech").value.trim().toUpperCase(),
    "jo.address": $("jo-addr").value.trim().toUpperCase(),
    "jo.serviceReq": [...document.querySelectorAll("input[name=jo-req]:checked")].map((c) => c.value),
  };
  if (j.status === "Pending") patch.status = "Scheduled";
  await backend.updateJob(joJobId, patch);
  $("dlg-jo").close();
  window.open(`jo.html?id=${joJobId}`, "_blank");
};

/* ---------- Complete & bill ---------- */
let billJobId = null;
const priceKey = (p) => `${p.category}|${p.description}`;

function lineRow(it = { category: "", description: "", qty: 1, unitPrice: 0 }) {
  const tr = document.createElement("tr");
  const opts = prices.items.map((p, i) => `<option value="${i}"${priceKey(p) === priceKey(it) ? " selected" : ""}>${esc(p.category)} · ${esc(p.description)} (${esc(peso(p.price))})</option>`).join("");
  tr.innerHTML = `
    <td><select class="l-pick"><option value="">Custom…</option>${opts}</select></td>
    <td><input class="l-cat" value="${esc(it.category)}" /></td>
    <td><input class="l-desc" value="${esc(it.description)}" /></td>
    <td><input class="l-qty" type="number" min="0" step="1" value="${esc(it.qty)}" /></td>
    <td><input class="l-price" type="number" min="0" step="0.01" value="${esc(it.unitPrice)}" /></td>
    <td class="l-total" style="text-align:right;font-weight:600"></td>
    <td><button type="button" class="rm" title="Remove">✕</button></td>`;
  tr.querySelector(".l-pick").onchange = (e) => {
    const p = prices.items[e.target.value];
    if (p) { tr.querySelector(".l-cat").value = p.category; tr.querySelector(".l-desc").value = p.description; tr.querySelector(".l-price").value = p.price; }
    recalc();
  };
  tr.querySelectorAll("input").forEach((i) => (i.oninput = recalc));
  tr.querySelector(".rm").onclick = () => { tr.remove(); recalc(); };
  $("bill-items").querySelector("tbody").appendChild(tr);
}
function readLines() {
  return [...$("bill-items").querySelectorAll("tbody tr")].map((tr) => ({
    category: tr.querySelector(".l-cat").value.trim().toUpperCase(),
    description: tr.querySelector(".l-desc").value.trim().toUpperCase(),
    qty: Number(tr.querySelector(".l-qty").value) || 0,
    unitPrice: Number(tr.querySelector(".l-price").value) || 0,
  }));
}
function recalc() {
  $("bill-items").querySelectorAll("tbody tr").forEach((tr) => {
    tr.querySelector(".l-total").textContent = peso((Number(tr.querySelector(".l-qty").value) || 0) * (Number(tr.querySelector(".l-price").value) || 0));
  });
  $("b-total").textContent = peso(billTotal({ items: readLines(), transpoFee: $("b-transpo").value }));
}
$("btn-add-line").onclick = () => { lineRow(); recalc(); };
$("b-transpo").oninput = recalc;

function openBill(id) {
  const j = findJob(id);
  billJobId = id;
  msg($("bill-msg"), "");
  $("bill-sub").textContent = `${j.contactName} · JO ${j.jo?.number || "—"} · ${j.service} · ${j.unitType} × ${j.quantity}`;
  const r = j.report || {};
  $("r-findings").value = r.findings || "";
  $("r-done").value = r.jobDone || "";
  $("r-rec").value = r.recommendations || "";
  $("r-type").value = r.aircon?.type || j.unitType || "";
  $("r-hp").value = r.aircon?.invHp || "";
  $("r-brand").value = r.aircon?.brand || "";
  $("r-model").value = r.aircon?.model || "";
  $("r-serial").value = r.aircon?.serial || "";
  $("bill-items").querySelector("tbody").innerHTML = "";
  const items = j.billing?.items?.length ? j.billing.items : [{ category: "", description: "", qty: j.quantity || 1, unitPrice: 0 }];
  items.forEach(lineRow);
  $("b-transpo").value = j.billing ? j.billing.transpoFee : prices.transpoFee ?? COMPANY.defaultTranspoFee;
  $("b-date").value = j.billing?.date || todayIso();
  recalc();
  $("dlg-bill").showModal();
}
function reportPatch() {
  return {
    "report.findings": $("r-findings").value.trim(),
    "report.jobDone": $("r-done").value.trim(),
    "report.recommendations": $("r-rec").value.trim(),
    "report.aircon": {
      type: $("r-type").value.trim(), invHp: $("r-hp").value.trim(), brand: $("r-brand").value.trim(),
      model: $("r-model").value.trim(), serial: $("r-serial").value.trim(),
    },
  };
}
$("btn-save-report").onclick = async () => {
  const j = findJob(billJobId);
  const patch = reportPatch();
  if (["Pending", "Scheduled", "In progress"].includes(j.status)) patch.status = "Completed";
  await backend.updateJob(billJobId, patch);
  $("dlg-bill").close();
};
$("form-bill").onsubmit = async (e) => {
  e.preventDefault();
  const items = readLines().filter((it) => it.description || it.category);
  if (!items.length) return msg($("bill-msg"), "Add at least one billing line.");
  if (items.some((it) => !it.qty || !it.unitPrice)) return msg($("bill-msg"), "Each line needs a quantity and a unit price.");
  const billing = { date: $("b-date").value, items, transpoFee: Number($("b-transpo").value) || 0 };
  billing.total = billTotal(billing);
  const j = findJob(billJobId);
  const patch = { ...reportPatch(), billing };
  if (j.status !== "Paid") patch.status = "Billed";
  await backend.updateJob(billJobId, patch);
  $("dlg-bill").close();
  window.open(`billing.html?id=${billJobId}`, "_blank");
};

/* ---------- New job (admin) ---------- */
$("btn-new-job").onclick = () => { $("form-new").reset(); $("n-date").value = todayIso(); $("dlg-new").showModal(); };
$("form-new").onsubmit = async (e) => {
  e.preventDefault();
  await backend.createJob(user, {
    contactName: $("n-name").value.trim().toUpperCase(),
    phone: $("n-phone").value.trim(),
    email: $("n-email").value.trim(),
    address: $("n-address").value.trim(),
    city: $("n-city").value.trim(),
    service: $("n-service").value,
    unitType: $("n-unit").value,
    quantity: Number($("n-qty").value) || 1,
    brand: "",
    preferredDate: $("n-date").value,
    preferredTime: $("n-time").value,
    notes: $("n-notes").value.trim(),
    source: "admin",
  });
  $("dlg-new").close();
};

/* ---------- Price list ---------- */
function priceRow(p = { category: "", description: "", price: 0 }) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td><input class="p-cat" value="${esc(p.category)}" placeholder="CLEANING" /></td>
    <td><input class="p-desc" value="${esc(p.description)}" placeholder="SPLIT TYPE 1.5HP (INV)" /></td>
    <td><input class="p-price" type="number" min="0" step="0.01" value="${esc(p.price)}" /></td>
    <td><button type="button" class="rm" title="Remove">✕</button></td>`;
  tr.querySelector(".rm").onclick = () => tr.remove();
  $("price-table").querySelector("tbody").appendChild(tr);
}
function renderPrices() {
  $("price-table").querySelector("tbody").innerHTML = "";
  prices.items.forEach(priceRow);
  $("p-transpo").value = prices.transpoFee ?? COMPANY.defaultTranspoFee;
  msg($("price-msg"), "");
}
$("btn-add-price").onclick = () => priceRow();
$("btn-save-prices").onclick = async () => {
  const items = [...$("price-table").querySelectorAll("tbody tr")]
    .map((tr) => ({
      category: tr.querySelector(".p-cat").value.trim().toUpperCase(),
      description: tr.querySelector(".p-desc").value.trim().toUpperCase(),
      price: Number(tr.querySelector(".p-price").value) || 0,
    }))
    .filter((p) => p.description);
  items.sort((a, b) => (a.category + a.description).localeCompare(b.category + b.description));
  prices = { items, transpoFee: Number($("p-transpo").value) || 0 };
  try { await backend.savePrices(prices); renderPrices(); msg($("price-msg"), "Price list saved.", "success"); }
  catch (e) { msg($("price-msg"), "Couldn't save: " + e.message); }
};
