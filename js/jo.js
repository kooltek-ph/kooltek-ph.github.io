import { backend } from "./backend.js";
import { COMPANY, peso, longDate, splitTime } from "./company.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const out = document.getElementById("out");
const params = new URLSearchParams(location.search);
const fail = (t) => (out.innerHTML = `<div class="msg">${t}</div>`);

function copy(j, label) {
  const jo = j.jo || {};
  const r = j.report || {};
  const ac = r.aircon || {};
  const t = splitTime(jo.time);
  const req = jo.serviceReq || [];
  const box = (v) => `<span class="chk">${v ? "✓" : ""}</span>`;
  const paid = j.payment?.method;
  return `
  <div class="jo-copy">
    <div class="jo-head">
      <div>
        <img src="img/kooltek-wordmark.png" alt="Kooltek" />
        <div class="co">${esc(COMPANY.address1)}, ${esc(COMPANY.address2)}<br>${esc(COMPANY.mobiles)}<br><a>${esc(COMPANY.email)}</a></div>
      </div>
      <div class="jo-no">Job Order No.${esc(jo.number || "")}</div>
    </div>
    <div class="jo-bar" style="border:1px solid #000;border-bottom:0">${label}</div>
    <div class="jo-grid">
      <div class="jo-left">
        <div class="jo-bar">CLIENT'S COPY</div>
        <div class="svc">
          <div>TIME:</div><div>${esc(t.ampm)}</div><div style="justify-content:center">${esc(t.clock)}</div>
          <div style="grid-row:span 2">SERVICE REQ:</div>
          <div class="reqs" style="grid-row:span 2">
            <span>${box(req.includes("Check-up"))}Check-up</span>
            <span>${box(req.includes("Cleaning"))}Cleaning (Warranty: 7 days)</span>
            <span>${box(req.includes("Repair"))}Repair (Warranty: 30 days)</span>
          </div>
          <div style="border-top:1px solid #000">DATE:</div><div style="grid-column:span 2;border-top:1px solid #000;justify-content:center">${esc(longDate(jo.date))}</div>
        </div>
        <div class="row"><div class="lbl">CLIENT:</div><div class="val">${esc((j.contactName || "").toUpperCase())}</div></div>
        <div class="row" style="min-height:9mm"><div class="lbl">ADDRESS:</div><div class="val">${esc(jo.address || `${j.address}, ${j.city}`.toUpperCase())}</div></div>
        <div class="row"><div class="lbl">TECHNICIAN:</div><div class="val">${esc(jo.technicians)}</div></div>
        <div class="jo-bar">FINDINGS</div>
        <div class="box">${esc(r.findings)}</div>
        <div class="jo-bar" style="border-top:1px solid #000">JOB DONE</div>
        <div class="box">${esc(r.jobDone)}</div>
        <div class="thanks">Thank you for choosing and trusting ${esc(COMPANY.shortName)}!<br>We're looking forward to future transactions with you.</div>
      </div>
      <div class="jo-right">
        <div class="jo-bar">RECOMMENDATIONS</div>
        <div class="box">${esc(r.recommendations)}</div>
        <div class="ac">
          <div class="jo-bar" style="border-top:1px solid #000">AIRCON DETAILS</div>
          <div class="row"><div class="lbl">TYPE:</div><div class="val">${esc(ac.type)}</div><div class="lbl" style="border-left:1px solid #000;width:22mm">INV/IN &amp; HP:</div><div class="val">${esc(ac.invHp)}</div></div>
          <div class="row"><div class="lbl">BRAND:</div><div class="val">${esc(ac.brand)}</div></div>
          <div class="row"><div class="lbl">MODEL:</div><div class="val">${esc(ac.model)}</div></div>
          <div class="row"><div class="lbl">SERIAL:</div><div class="val">${esc(ac.serial)}</div></div>
        </div>
        <div class="jo-bar" style="text-align:left;padding-left:1.5mm">MODE OF PAYMENT</div>
        <div class="row"><div class="lbl">TOTAL BILL:</div><div class="val">PHP ${j.billing ? esc(peso(j.billing.total).replace("₱", "")) : ""}</div></div>
        <div class="row pay-row"><div class="lbl">${esc(COMPANY.bank.name.toUpperCase())}:</div><div class="val">${box(paid === "Metrobank")}${esc(COMPANY.bank.accountNo)} &nbsp; ${box(paid === "Cash")}CASH &nbsp; ${box(paid === "GCash")}GCASH</div></div>
        <div class="row"><div class="val">CUSTOMER'S SIGNATURE OVER PRINTED NAME</div></div>
        <div class="sig" style="border-bottom:0"><span>TECHNICIAN'S SIGNATURE OVER PRINTED NAME</span></div>
      </div>
    </div>
    <div class="approved"><b>Approved By:</b><div class="nm">${esc(COMPANY.approver.name.toUpperCase())}</div><div class="t">${esc(COMPANY.approver.title)}</div></div>
  </div>`;
}

const sheet = (j) => `<div class="sheet jo">${copy(j, "CLIENT'S COPY")}<div class="jo-cut"></div>${copy(j, "OFFICE COPY")}</div>`;

backend.onAuth(async (u) => {
  if (!u) return fail(`Please <a href="portal.html">log in</a> first.`);
  try {
    if (params.get("id")) {
      const j = await backend.getJob(params.get("id"));
      if (!j) return fail("Job not found.");
      if (!j.jo?.number) return fail("No Job Order issued for this job yet.");
      document.title = `JO ${j.jo.number} | Kooltek`;
      document.getElementById("tb-label").textContent = `Job Order ${j.jo.number} · ${j.contactName}`;
      out.innerHTML = sheet(j);
    } else if (params.get("date")) {
      if (!u.isAdmin) return fail("Admins only.");
      const d = params.get("date");
      const jobs = (await backend.getJobsOn(d)).filter((j) => j.jo?.number && j.status !== "Cancelled").sort((a, b) => a.jo.number.localeCompare(b.jo.number));
      document.getElementById("tb-label").textContent = `Daily Job Orders · ${longDate(d)} · ${jobs.length} JO(s)`;
      document.title = `JO Daily ${d} | Kooltek`;
      out.innerHTML = jobs.length ? jobs.map(sheet).join("") : `<div class="msg">No Job Orders scheduled on ${esc(longDate(d))}.</div>`;
    } else fail("Missing job id.");
  } catch (e) { fail("Couldn't load: " + esc(e.message)); }
});
