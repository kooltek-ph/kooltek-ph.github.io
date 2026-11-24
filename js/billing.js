import { backend } from "./backend.js";
import { COMPANY, peso, longDate, lineTotal } from "./company.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const out = document.getElementById("out");
const fail = (t) => (out.innerHTML = `<div class="msg">${t}</div>`);
const MIN_ROWS = 9; // keeps the table the same height as the Excel template

function render(j) {
  const b = j.billing;
  // Group consecutive lines by category so the category cell spans its rows (like the template)
  const rows = [];
  b.items.forEach((it, i) => {
    const first = i === 0 || b.items[i - 1].category !== it.category;
    let span = 1;
    if (first) while (b.items[i + span] && b.items[i + span].category === it.category) span++;
    rows.push(`<tr>
      ${first ? `<td class="cat" rowspan="${span}">${esc(it.category)}</td>` : ""}
      <td>${esc(it.description)}</td>
      <td class="num">${esc(it.qty)}</td>
      <td>${esc(peso(it.unitPrice))}</td>
      <td class="tot">${esc(peso(lineTotal(it)))}</td>
    </tr>`);
  });
  const blanks = Math.max(1, MIN_ROWS - b.items.length - (b.transpoFee ? 1 : 0));
  for (let i = 0; i < blanks; i++) rows.push(`<tr><td></td><td></td><td></td><td></td><td></td></tr>`);
  if (b.transpoFee) rows.push(`<tr class="transpo"><td></td><td></td><td></td><td class="lbl">TRANSPO FEE</td><td class="tot">${esc(peso(b.transpoFee))}</td></tr>`);

  const addr = j.jo?.address || `${j.address}, ${j.city}`.toUpperCase();
  return `<div class="sheet bs">
    <div class="bs-top">
      <div>
        <img class="logo" src="img/kooltek-logo.png" alt="Kooltek" />
        <div class="co">${esc(COMPANY.address1.toUpperCase())}<br>${esc(COMPANY.address2.toUpperCase())}<br>
          <a>${esc(COMPANY.website)}</a>
          <small>${esc(COMPANY.mobiles)}</small><small style="margin-top:1mm">${esc(COMPANY.landlines)}</small>
        </div>
      </div>
      <div class="bs-title">BILLING<br>STATEMENT<div class="d">DATE: ${esc(longDate(b.date))}</div></div>
    </div>

    <div class="bs-client">
      <div>CLIENT NAME : ${esc((j.contactName || "").toUpperCase())}<br>ADDRESS : ${esc(addr)}</div>
      <div class="due"><div class="l">TOTAL AMOUNT DUE:</div><div class="v">${esc(peso(b.total))}</div></div>
    </div>

    <table class="bs-items">
      <thead><tr><th style="width:24%">ITEM DESCRIPTION</th><th style="width:30%">ITEM DESCRIPTION</th><th style="width:7%">QTY</th><th style="width:22%">UNIT PRICE</th><th style="width:17%">TOTAL</th></tr></thead>
      <tbody>
        ${rows.join("")}
        <tr class="thanks-row"><td colspan="2">Thank you for trusting ${esc(COMPANY.name)}</td><td></td><td></td><td></td></tr>
        <tr class="grand"><td></td><td></td><td></td><td class="l">TOTAL AMOUNT DUE :</td><td class="tot">${esc(peso(b.total))}</td></tr>
      </tbody>
    </table>

    <div class="bs-pay">
      <div class="h">BANK TRANSFER OR BANK DEPOSIT ${j.status === "Paid" ? `<span class="paid-stamp">PAID${j.payment?.method ? " · " + esc(j.payment.method.toUpperCase()) : ""}</span>` : ""}</div>
      <div class="acct"><div class="b">${esc(COMPANY.bank.name.toUpperCase())}:</div><div>${esc(COMPANY.bank.accountName.toUpperCase())}</div><div class="b">${esc(COMPANY.bank.accountNo)}</div></div>
      <div class="acct"><div class="b">GCASH ACCOUNT:</div><div>${esc(COMPANY.gcash.name)}</div><div class="b">${esc(COMPANY.gcash.number)}</div></div>
    </div>
    ${j.jo?.number ? `<div class="bs-ref">Ref: Job Order No. ${esc(j.jo.number)}</div>` : ""}
  </div>`;
}

backend.onAuth(async (u) => {
  if (!u) return fail(`Please <a href="portal.html">log in</a> to view this billing statement.`);
  if (u.isAdmin) document.getElementById("back").href = "portal.html#admin";
  try {
    const j = await backend.getJob(new URLSearchParams(location.search).get("id"));
    if (!j) return fail("Billing statement not found.");
    if (!j.billing) return fail("This job hasn't been billed yet.");
    const fileName = `BILLING STATEMENT - ${j.contactName} - ${j.billing.date}`;
    document.title = fileName; // becomes the default PDF file name when saving
    document.getElementById("tb-label").textContent = `Billing Statement · ${j.contactName} · ${peso(j.billing.total)}`;
    out.innerHTML = render(j);
  } catch (e) { fail("Couldn't load: " + esc(e.message)); }
});
