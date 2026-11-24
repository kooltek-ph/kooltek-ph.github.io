# kooltek-ph.github.io

Website and customer portal for **Kooltek** (aircon & refrigeration services). Built by Zealient.

- `index.html`: landing page (services, how it works, contact)
- `portal.html`: customer login/sign-up, job request form, "My requests", and the admin view (jobs, Job Orders, billing, price list)
- `jo.html`: printable Job Order (client's copy + office copy on one A4), single job or a whole day
- `billing.html`: printable Billing Statement (matches the Excel template), "Save as PDF" from the browser
- `js/company.js`: Kooltek's address, phones, bank/GCash details, JO number format. Edit once, all documents update.
- Hosting: GitHub Pages (static). Login and data: Firebase Auth + Cloud Firestore (free Spark plan is enough to start).

## 1. Publish on GitHub Pages

1. GitHub organization: **`kooltek-ph`** (already created).
2. In it, create a **public** repo named exactly **`kooltek-ph.github.io`**.
3. Push these files to the `main` branch:
   ```bash
   git init && git add . && git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/kooltek-ph/kooltek-ph.github.io.git
   git push -u origin main
   ```
4. Repo → **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` / `(root)`.
5. Site goes live at https://kooltek-ph.github.io within a minute or two.

Until Firebase is connected, the portal runs in **demo mode** (data stays in the visitor's browser). It's fine for showing the client, not for real bookings.

## 2. Connect Firebase (makes login and job requests real)

1. https://console.firebase.google.com → **Add project** (e.g. `kooltek`).
2. **Build → Authentication → Get started** → enable **Email/Password** and **Google**.
3. Authentication → **Settings → Authorized domains** → add `kooltek-ph.github.io`.
4. **Build → Firestore Database → Create database** (production mode, region `asia-southeast1`).
5. Firestore → **Rules** → paste the contents of `firestore.rules` → Publish.
6. Firestore → **Indexes** → add a composite index on collection `jobs`: `uid` Ascending, `createdAt` Descending. (Or click the link in the browser console error the first time "My requests" loads.)
7. **Project settings → General → Your apps → Web (</>)** → register the app → copy the config into `js/firebase-config.js`, replacing the `REPLACE_ME` values. The web API key is safe to publish; access is controlled by the rules.
8. Commit and push.

### Make someone an admin
1. Have them sign up on the portal.
2. Firebase Console → Authentication → Users → copy their **User UID**.
3. Firestore → start collection **`admins`** → Document ID = that UID → add any field (e.g. `name: "Owner"`).
4. They refresh the portal and see **Open admin view**, where they can see all requests and update status (Pending → Scheduled → In progress → Completed / Cancelled).

## Workflow (admin)

| Step | Who | In the portal | Status |
|---|---|---|---|
| 1. Booking | Customer (online) or staff (**+ New job** for phone/Messenger/walk-in) | Job request form | Pending |
| 2. Schedule | Staff | **Issue Job Order**: date, time, technicians, service req. JO No. is auto-generated (`888` + YYYYMMDD + daily seq + `-AM/PM`) and the JO opens ready to print | Scheduled |
| 3. Daily dispatch | Staff | Pick a date → **Print day's Job Orders** (one A4 per job, client + office copy) | In progress (optional) |
| 4. Job done | Technician fills the paper JO; staff encodes it | **Complete & bill**: findings, job done, recommendations, aircon details, then billing lines picked from the price list (qty × price auto-computed, plus transpo fee) | Billed |
| 5. Send bill | Staff | Billing Statement opens → Print / Save as PDF → send via Messenger/Viber/email. Online customers can also view it in "My requests" | Billed |
| 6. Payment | Staff | **Mark paid via** Metrobank / GCash / Cash. Statement shows a PAID stamp | Paid |

Prices: **Price list** tab (category, item description, unit price, default transpo fee). Seeded from the sample statement; add the rest of Kooltek's rate card there.

Tip: when printing, keep "Background graphics" on and margins "Default".

## 3. Before launch: replace placeholders

- Confirm business hours in `index.html` (search `TODO`).
- Check details in `js/company.js` (landline on the old JO template was `02 8829 8888`, the Billing template says `(02) 8289.8888`; the site uses the billing one).
- Fill in the full price list in the portal.

Optional: adjust the service list in `index.html` and the dropdowns in `portal.html` to match Kooltek's actual offerings.

## Optional: custom domain
If Kooltek gets a domain (e.g. `kooltek.ph`), add a `CNAME` file with the domain, set DNS per GitHub Pages docs, and add the domain to Firebase Authorized domains.
