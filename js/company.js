// Kooltek company details used on the Job Order and Billing Statement.
// Edit here once; every printed document updates.
export const COMPANY = {
  name: "Kooltek Philippines Inc.",
  shortName: "KoolTek Philippines",
  address1: "3A Amber Place Bldg. 67 Bayani Road",
  address2: "AFPOVAI Western Bicutan Taguig City 1630",
  website: "www.kooltekphilippines.com",
  email: "kooltek.ph@gmail.com",
  mobiles: "0919.999.KOOL (5665) | 0917.888.KOOL (5665)",
  landlines: "(02) 8289.8888 | (02) 8400.4118 | (02) 8400.4038",
  approver: { name: "Darlene Inocencio", title: "General Manager" },
  bank: { name: "Metrobank", accountName: "Kooltek Philippines Inc.", accountNo: "385-7-38550783-2" },
  gcash: { name: "DA*****E I.", number: "09178885665" },
  joPrefix: "888", // Job Order No. = 888 + YYYYMMDD + 2-digit daily sequence + -AM/PM
  defaultTranspoFee: 150,
};

// Starting price list (admins can edit it in the portal → Price list tab).
export const DEFAULT_PRICES = [
  { category: "CLEANING", description: "WINDOW TYPE 2.0HP (INV)", price: 1000 },
  { category: "CLEANING", description: "FLOOR MOUNTED 3TR", price: 2550 },
];

export const peso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const longDate = (iso) =>
  iso ? new Date(iso + "T00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase().replace(", ", ",") : "";

// "13:00" → { ampm: "PM", clock: "1:00" }
export const splitTime = (t) => {
  if (!t) return { ampm: "", clock: "" };
  let [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { ampm, clock: `${h}:${String(m).padStart(2, "0")}` };
};

export const lineTotal = (it) => (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
export const billTotal = (b) => (b?.items || []).reduce((s, it) => s + lineTotal(it), 0) + (Number(b?.transpoFee) || 0);
