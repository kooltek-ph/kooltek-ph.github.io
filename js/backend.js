// Data layer for the Kooltek portal.
// Live mode: Firebase Auth + Cloud Firestore. Demo mode: browser localStorage.
import { firebaseConfig, demoAdminEmails } from "./firebase-config.js";
import { DEFAULT_PRICES, COMPANY } from "./company.js";

export const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey === "REPLACE_ME";

// Workflow: Pending → Scheduled (JO issued) → In progress → Completed → Billed → Paid
export const STATUSES = ["Pending", "Scheduled", "In progress", "Completed", "Billed", "Paid", "Cancelled"];

export const backend = DEMO ? createDemoBackend() : await createFirebaseBackend();

// JO number: 888 + YYYYMMDD + 2-digit sequence for that date + -AM/PM  (e.g. 8882026112512-PM)
export async function makeJoNumber(dateIso, ampm) {
  const seq = (await backend.countJobOrdersOn(dateIso)) + 1;
  return `${COMPANY.joPrefix}${dateIso.replaceAll("-", "")}${String(seq).padStart(2, "0")}-${ampm || "AM"}`;
}

/* ---------------- Firebase (live) ---------------- */
async function createFirebaseBackend() {
  const V = "10.12.2";
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);

  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const jobsCol = F.collection(db, "jobs");
  const pricesDoc = F.doc(db, "settings", "prices");

  const toJob = (d) => {
    const x = d.data();
    return { id: d.id, ...x, createdAt: x.createdAt?.toDate?.() || new Date() };
  };

  return {
    onAuth(cb) {
      return A.onAuthStateChanged(auth, async (u) => {
        if (!u) return cb(null);
        let isAdmin = false;
        try { isAdmin = (await F.getDoc(F.doc(db, "admins", u.uid))).exists(); } catch (_) {}
        cb({ uid: u.uid, email: u.email, name: u.displayName || "", isAdmin });
      });
    },
    async signUp(name, email, password) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, password);
      if (name) await A.updateProfile(cred.user, { displayName: name });
    },
    signIn: (email, password) => A.signInWithEmailAndPassword(auth, email, password),
    signInGoogle: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    resetPassword: (email) => A.sendPasswordResetEmail(auth, email),
    signOut: () => A.signOut(auth),

    async createJob(user, data) {
      await F.addDoc(jobsCol, { email: user.email, ...data, uid: user.uid, status: "Pending", createdAt: F.serverTimestamp() });
    },
    watchMyJobs(user, cb) {
      const q = F.query(jobsCol, F.where("uid", "==", user.uid), F.orderBy("createdAt", "desc"));
      return F.onSnapshot(q, (s) => cb(s.docs.map(toJob)), (e) => cb([], e));
    },
    watchAllJobs(cb) {
      const q = F.query(jobsCol, F.orderBy("createdAt", "desc"));
      return F.onSnapshot(q, (s) => cb(s.docs.map(toJob)), (e) => cb([], e));
    },
    async getJob(id) {
      const d = await F.getDoc(F.doc(db, "jobs", id));
      return d.exists() ? toJob(d) : null;
    },
    async getJobsOn(dateIso) {
      const s = await F.getDocs(F.query(jobsCol, F.where("jo.date", "==", dateIso)));
      return s.docs.map(toJob);
    },
    async countJobOrdersOn(dateIso) {
      const s = await F.getDocs(F.query(jobsCol, F.where("jo.date", "==", dateIso)));
      return s.docs.filter((d) => d.data().jo?.number).length;
    },
    updateJob: (id, patch) => F.updateDoc(F.doc(db, "jobs", id), patch),
    updateStatus: (id, status) => F.updateDoc(F.doc(db, "jobs", id), { status }),
    cancelJob: (id) => F.updateDoc(F.doc(db, "jobs", id), { status: "Cancelled" }),

    async getPrices() {
      const d = await F.getDoc(pricesDoc);
      return d.exists() ? d.data() : { items: DEFAULT_PRICES, transpoFee: COMPANY.defaultTranspoFee };
    },
    savePrices: (data) => F.setDoc(pricesDoc, data),
  };
}

/* ---------------- Demo (localStorage) ---------------- */
function createDemoBackend() {
  const K_USERS = "kooltek_demo_users";
  const K_JOBS = "kooltek_demo_jobs";
  const K_SESSION = "kooltek_demo_session";
  const K_PRICES = "kooltek_demo_prices";
  const listeners = new Set();
  const jobListeners = new Set();

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const current = () => {
    const email = read(K_SESSION, null);
    if (!email) return null;
    const u = read(K_USERS, {})[email];
    if (!u) return null;
    return { uid: email, email, name: u.name, isAdmin: demoAdminEmails.includes(email) };
  };
  const emitAuth = () => listeners.forEach((cb) => cb(current()));
  const emitJobs = () => jobListeners.forEach((fn) => fn());
  const err = (code) => Object.assign(new Error(code), { code });
  const jobs = () => read(K_JOBS, []).map((j) => ({ ...j, createdAt: new Date(j.createdAt) }));
  const setPath = (obj, path, val) => {
    const keys = path.split(".");
    let o = obj;
    keys.slice(0, -1).forEach((k) => (o = o[k] = { ...(o[k] || {}) }));
    o[keys.at(-1)] = val;
  };
  window.addEventListener("storage", (e) => { if (e.key === K_JOBS) emitJobs(); if (e.key === K_SESSION) emitAuth(); });

  return {
    onAuth(cb) { listeners.add(cb); setTimeout(() => cb(current())); return () => listeners.delete(cb); },
    async signUp(name, email, password) {
      email = email.toLowerCase();
      const users = read(K_USERS, {});
      if (users[email]) throw err("auth/email-already-in-use");
      if (password.length < 6) throw err("auth/weak-password");
      users[email] = { name, password };
      write(K_USERS, users); write(K_SESSION, email); emitAuth();
    },
    async signIn(email, password) {
      email = email.toLowerCase();
      const u = read(K_USERS, {})[email];
      if (!u || u.password !== password) throw err("auth/invalid-credential");
      write(K_SESSION, email); emitAuth();
    },
    async signInGoogle() { throw err("demo/google-disabled"); },
    async resetPassword() { throw err("demo/reset-disabled"); },
    async signOut() { localStorage.removeItem(K_SESSION); emitAuth(); },

    async createJob(user, data) {
      const all = read(K_JOBS, []);
      all.unshift({ email: user.email, ...data, id: crypto.randomUUID(), uid: user.uid, status: "Pending", createdAt: new Date().toISOString() });
      write(K_JOBS, all); emitJobs();
    },
    watchMyJobs(user, cb) {
      const fn = () => cb(jobs().filter((j) => j.uid === user.uid));
      jobListeners.add(fn); fn(); return () => jobListeners.delete(fn);
    },
    watchAllJobs(cb) {
      const fn = () => cb(jobs());
      jobListeners.add(fn); fn(); return () => jobListeners.delete(fn);
    },
    async getJob(id) { return jobs().find((j) => j.id === id) || null; },
    async getJobsOn(dateIso) { return jobs().filter((j) => j.jo?.date === dateIso); },
    async countJobOrdersOn(dateIso) { return jobs().filter((j) => j.jo?.date === dateIso && j.jo?.number).length; },
    async updateJob(id, patch) {
      write(K_JOBS, read(K_JOBS, []).map((j) => {
        if (j.id !== id) return j;
        const n = { ...j };
        Object.entries(patch).forEach(([k, v]) => setPath(n, k, v));
        return n;
      }));
      emitJobs();
    },
    async updateStatus(id, status) { return this.updateJob(id, { status }); },
    async cancelJob(id) { return this.updateJob(id, { status: "Cancelled" }); },

    async getPrices() { return read(K_PRICES, { items: DEFAULT_PRICES, transpoFee: COMPANY.defaultTranspoFee }); },
    async savePrices(data) { write(K_PRICES, data); },
  };
}
