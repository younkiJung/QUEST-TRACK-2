// 로그인과 저장(Firestore)에 관한 코드는 전부 이 파일에만 둔다.
// 기록은 Firestore 의 records/{uid} 문서 하나에 저장되고, 어느 기기에서 로그인해도 이어서 보인다.
// 화면 코드는 아래의 loadSave · recordClear · setOwner 같은 함수만 부르면 된다.
//
// 문서 모양 (Google 이름과 메일은 읽지도 저장하지도 않는다):
//   { v: 1, uid: '로그인한 사람의 고유 번호', nickname: '별명', stages: { "1": { cleared, coins, time, stars } }, updatedAt: 서버 시간 }
// 지키는 규칙은 week-07/firestore.rules 에 있다 (콘솔에 붙여 넣는다).

// ---------- Firebase 설정 ----------
// 아래 값은 "공개해도 되는 이름표"다 (사용자가 파일에 넣어도 된다고 확인함). 비밀번호나 서비스 계정 키가 아니다.
// 데이터를 지키는 건 이 값이 아니라 firestore.rules 와 로그인이다.
const FIREBASE_VERSION = '13.4.0';
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCeyG4kcTlI58XuVEFX1fcdET5iVef52bk',
  authDomain: 'my-cheer-af1eb.firebaseapp.com',
  projectId: 'my-cheer-af1eb',
  storageBucket: 'my-cheer-af1eb.firebasestorage.app',
  messagingSenderId: '348586918683',
  appId: '1:348586918683:web:b3611ef079375ccee709be',
};
const RECORDS = 'records';   // Firestore 컬렉션 이름
const sdkUrl = (name) => `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-${name}.js`;

// ---------- 기록 모양 (게임 규칙과 가까운 순수한 코드) ----------
function emptySave() {
  return { v: 1, owner: '', stages: {} };
}

// 이름(별명): 앞뒤 공백 없애고, 연속 공백을 하나로, 12글자까지
function cleanName(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, 12);
}

// 이상한 값이 들어와도 안전한 모양으로 고쳐 읽는다 (서버에서 온 값도 믿지 않고 한 번 거른다)
function cleanSave(raw) {
  const out = emptySave();
  if (!raw || typeof raw !== 'object') return out;
  out.owner = cleanName(raw.owner);
  if (raw.stages && typeof raw.stages === 'object') {
    for (const id of Object.keys(raw.stages)) {
      const s = raw.stages[id];
      if (!/^[1-9]\d{0,2}$/.test(id) || !s || s.cleared !== true) continue;
      const coins = Number.isInteger(s.coins) && s.coins >= 0 && s.coins <= 999 ? s.coins : 0;
      out.stages[id] = { cleared: true, coins };
      // 최고기록(가장 빠른 시간)은 1/100초 단위 정수. 없거나 이상하면 빼고 읽는다
      if (Number.isInteger(s.time) && s.time > 0 && s.time <= 599999) out.stages[id].time = s.time;
      // 별(1~3)은 한 판 안에서 정해지므로 가장 많이 받은 개수를 따로 저장한다
      if (Number.isInteger(s.stars) && s.stars >= 1 && s.stars <= 3) out.stages[id].stars = s.stars;
    }
  }
  return out;
}

// 없는 스테이지는 빼고, 코인은 스테이지의 코인 수까지만 둔다. 뺀 개수를 돌려준다.
function clampToStages(save, stageList) {
  let dropped = 0;
  for (const id of Object.keys(save.stages)) {
    const st = stageList[Number(id) - 1];
    if (!st) { delete save.stages[id]; dropped++; continue; }
    if (save.stages[id].coins > st.coins.length) save.stages[id].coins = st.coins.length;
  }
  return dropped;
}

function totalCoins(save) {
  return Object.values(save.stages).reduce((sum, s) => sum + s.coins, 0);
}

// 1번은 처음부터 열려 있고, 그다음은 앞 스테이지를 깨야 열린다
function isUnlocked(save, stageId) {
  return stageId === 1 || !!save.stages[String(stageId - 1)];
}

function stageRecord(save, stageId) {
  return save.stages[String(stageId)] || null;
}

// 서버 문서 ↔ 게임 기록. 문서에는 uid 와 별명만 넣는다 (Google 이름·메일·사진은 넣지 않는다).
function toCloud(save, uid) {
  return { v: 1, uid, nickname: save.owner, stages: save.stages };
}

function fromCloud(data) {
  if (!data || typeof data !== 'object') return emptySave();
  return cleanSave({ owner: typeof data.nickname === 'string' ? data.nickname : '', stages: data.stages });
}

// ---------- 지금 로그인한 사람의 기록 (메모리) ----------
// 로그인하면 서버에서 읽어 와서 여기에 두고, 바뀔 때마다 서버에 올린다.
let current = emptySave();
let session = null;          // { uid } — 로그인 전에는 null
let cloud = null;            // 창구: 진짜 Firebase 또는 시험용 가짜
const hooks = { status: () => {}, error: () => {} };

function setCloudHooks(h) { Object.assign(hooks, h); }
function sessionUid() { return session ? session.uid : null; }
function useCloud(adapter) { cloud = adapter; }

// 로그인했을 때 부른다. record 가 있으면 그 기록으로, 없으면 빈 기록으로 시작한다.
function startSession(uid, record) {
  session = { uid };
  current = record ? cleanSave(record) : emptySave();
  dirty = false;
  lastError = null;
}

// 로그아웃했을 때 부른다. 메모리의 기록을 지워서 다음 사람에게 보이지 않게 한다.
function endSession() {
  session = null;
  current = emptySave();
  dirty = false;
  lastError = null;
  hooks.status('idle');
}

function loadSave() {
  return cleanSave(current);   // 복사본을 준다. 고친 뒤 writeSave 로 저장한다.
}

// 저장 요청. 로그인한 상태면 서버에 올리라고 맡기고 true, 로그인 전이면 저장할 수 없어서 false.
function writeSave(save) {
  current = cleanSave(save);
  if (!session) return false;
  dirty = true;
  pump();
  return true;
}

function setOwner(name) {
  const save = loadSave();
  save.owner = cleanName(name);
  writeSave(save);
  return save;
}

// 스테이지를 깼을 때 부른다. 코인은 더 많이 모았을 때만 늘려 저장한다.
// time (1/100초) 을 주면 더 빠를 때만 최고기록으로 바꿔 저장한다. 안 주면 시간은 건드리지 않는다.
// stars (1~3) 를 주면 더 많을 때만 바꿔 저장한다. 안 주면 별은 건드리지 않는다.
function recordClear(stageId, coins, time, stars) {
  const save = loadSave();
  const key = String(stageId);
  const before = save.stages[key];
  const firstClear = !before;
  const prev = before ? before.coins : 0;
  const best = Math.max(prev, coins);
  const prevTime = before && before.time ? before.time : null;
  const entry = { cleared: true, coins: best };
  let newBest = false;
  if (Number.isInteger(time) && time > 0 && time <= 599999 && (prevTime === null || time < prevTime)) {
    entry.time = time;
    newBest = true;
  } else if (prevTime !== null) {
    entry.time = prevTime;
  }
  const prevStars = before && before.stars ? before.stars : 0;
  const validStars = Number.isInteger(stars) && stars >= 1 && stars <= 3;
  const bestStars = validStars ? Math.max(prevStars, stars) : prevStars;
  if (bestStars) entry.stars = bestStars;
  save.stages[key] = entry;
  const saved = writeSave(save);
  return { save, firstClear, improved: !firstClear && coins > prev, prev, saved, newBest, prevTime, bestTime: entry.time || null,
           starsImproved: validStars && stars > prevStars, prevStars, bestStars: bestStars || null };
}

// ---------- 서버에 올리는 순서 (한 번에 하나씩, 마지막 모습으로) ----------
let writing = false, dirty = false, lastError = null, slowTimer = null;
let idleWaiters = [];

async function pump() {
  if (writing) return;
  writing = true;
  let failure = null;
  while (dirty && session) {
    dirty = false;
    const uid = session.uid;
    hooks.status('saving');
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { if (writing) hooks.status('slow'); }, 8000);
    try {
      await cloud.write(uid, toCloud(current, uid));
    } catch (e) {
      failure = e;
      break;
    }
  }
  clearTimeout(slowTimer);
  writing = false;
  lastError = failure;
  if (failure) { hooks.status('error'); hooks.error(explainError(failure, 'write')); }
  else if (session) { hooks.status('saved'); hooks.error(null); }
  const waiters = idleWaiters; idleWaiters = [];
  for (const w of waiters) w({ ok: !failure, error: failure });
}

// 저장이 끝날 때까지 기다린다. { ok, error } 를 돌려준다.
function flushSave() {
  if (!writing && !dirty) return Promise.resolve({ ok: !lastError, error: lastError });
  return new Promise((resolve) => idleWaiters.push(resolve));
}

// 저장이 실패했을 때 "다시 저장"을 누르면 부른다
function retrySave() {
  if (!session) return;
  dirty = true;
  pump();
}

// ---------- 오류 글 (화면에 그대로 보여 준다) ----------
function explainError(err, where) {
  const code = (err && err.code) || '';
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  const reasons = {
    'auth/popup-blocked': '로그인 창(팝업)이 막혔어요. 주소창 옆의 팝업 허용을 누른 뒤 다시 눌러 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔어요. 다시 눌러 주세요.',
    'auth/cancelled-popup-request': '로그인 창이 이미 열려 있어요. 열린 창에서 로그인해 주세요.',
    'auth/unauthorized-domain': `이 주소(${host})는 Firebase 에서 아직 허용되지 않았어요. 콘솔의 Authentication > 설정 > 승인된 도메인에 ${host} 를 추가해 주세요.`,
    'auth/operation-not-allowed': 'Google 로그인이 아직 켜져 있지 않아요. 콘솔의 Authentication > 로그인 방법에서 Google 을 사용 설정해 주세요.',
    'auth/network-request-failed': '인터넷에 연결되지 않았어요. 연결을 확인한 뒤 다시 해 주세요.',
    'auth/too-many-requests': '짧은 시간에 너무 많이 시도했어요. 조금 있다가 다시 해 주세요.',
    'auth/user-disabled': '이 계정은 사용할 수 없게 되어 있어요.',
    'permission-denied': '권한이 없어요. 콘솔의 Firestore 규칙에 firestore.rules 를 붙여 넣었는지, 로그인이 풀리지 않았는지 확인해 주세요.',
    'unauthenticated': '로그인이 풀렸어요. 다시 로그인해 주세요.',
    'unavailable': '서버에 연결할 수 없어요. 인터넷을 확인해 주세요.',
    'not-found': 'Firestore 데이터베이스가 아직 없는 것 같아요. 콘솔의 Firestore Database 에서 데이터베이스를 만들어 주세요.',
    'resource-exhausted': '사용량 한도에 걸렸어요. 조금 있다가 다시 해 주세요.',
    'deadline-exceeded': '서버가 너무 늦게 답해요. 다시 해 주세요.',
    'app/sdk-load-failed': 'Firebase 를 불러오지 못했어요. 인터넷을 확인하고 새로고침해 주세요.',
    'app/not-ready': 'Firebase 가 아직 준비되지 않았어요. 잠깐 뒤에 다시 눌러 주세요.',
  };
  const base = { login: '로그인에 실패했어요.', logout: '로그아웃에 실패했어요.', read: '기록을 불러오지 못했어요.',
                 write: '기록을 저장하지 못했어요.', list: '랭킹을 불러오지 못했어요.', init: 'Firebase 에 연결하지 못했어요.' }[where] || '문제가 생겼어요.';
  const why = reasons[code] || `알 수 없는 오류예요${err && err.message ? ': ' + String(err.message).slice(0, 80) : ''}.`;
  return `${base} ${why}${code ? ` (오류 코드: ${code})` : ''}`;
}

// ---------- 창구: 진짜 Firebase ----------
function makeFirebaseCloud() {
  let fb = null;
  const need = () => {
    if (!fb) throw Object.assign(new Error('Firebase 가 아직 준비되지 않았어요'), { code: 'app/not-ready' });
    return fb;
  };
  return {
    kind: 'firebase',
    // 모듈은 처음 한 번만 내려받는다. 로그인 창은 단추를 누른 그 순간에 열어야 막히지 않아서, 미리 준비해 둔다.
    async init(onAuth, onAuthError) {
      let mods;
      try {
        mods = await Promise.all([import(sdkUrl('app')), import(sdkUrl('auth')), import(sdkUrl('firestore'))]);
      } catch (e) {
        throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'app/sdk-load-failed' });
      }
      const [appM, authM, fsM] = mods;
      const app = appM.initializeApp(FIREBASE_CONFIG);
      fb = { auth: authM.getAuth(app), db: fsM.getFirestore(app), authM, fsM };
      // 로그인 상태가 바뀔 때마다 알려 준다. 고유 번호(uid)만 넘기고 이름·메일은 넘기지 않는다.
      authM.onAuthStateChanged(fb.auth, (u) => onAuth(u ? { uid: u.uid } : null), (e) => onAuthError && onAuthError(e));
    },
    // 새 창(팝업)으로 로그인. 단추를 누른 순간 바로 불러야 하므로 await 를 쓰지 않는다.
    login() {
      const f = need();
      return f.authM.signInWithPopup(f.auth, new f.authM.GoogleAuthProvider());
    },
    logout() {
      const f = need();
      return f.authM.signOut(f.auth);
    },
    async read(uid) {
      const f = need();
      const snap = await f.fsM.getDoc(f.fsM.doc(f.db, RECORDS, uid));
      return snap.exists() ? snap.data() : null;
    },
    async write(uid, data) {
      const f = need();
      await f.fsM.setDoc(f.fsM.doc(f.db, RECORDS, uid), { ...data, updatedAt: f.fsM.serverTimestamp() });
    },
    async listAll() {
      const f = need();
      const q = f.fsM.query(f.fsM.collection(f.db, RECORDS), f.fsM.limit(100));
      const snap = await f.fsM.getDocs(q);
      return snap.docs.map((d) => d.data());
    },
  };
}

// ---------- 창구: 시험용 가짜 (주소 끝에 ?fake=1 을 붙이거나 확인 도구가 쓴다) ----------
// 인터넷도 Google 도 없이 로그인·저장·오류 화면을 확인하려고 만든 메모리 서버다. 아무것도 남기지 않는다.
function makeFakeCloud() {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const f = {
    kind: 'fake', records: {}, user: null, listener: null, failures: {}, delay: 0, writes: [], nextUid: 'fake-user-1',
    failNext(op, code) { f.failures[op] = code; },
    _check(op) {
      const code = f.failures[op];
      if (code) { delete f.failures[op]; throw Object.assign(new Error('시험용 오류'), { code }); }
    },
    async init(onAuth) {
      if (typeof location !== 'undefined' && /fake=initfail/.test(location.search)) {
        throw Object.assign(new Error('시험용: Firebase 를 불러오지 못함'), { code: 'app/sdk-load-failed' });
      }
      f.listener = onAuth;
      onAuth(f.user);
    },
    loginAs(uid) { f.user = { uid }; if (f.listener) f.listener(f.user); },
    login() {
      try { f._check('login'); } catch (e) { return Promise.reject(e); }
      f.loginAs(f.nextUid);
      return Promise.resolve();
    },
    logout() { f.user = null; if (f.listener) f.listener(null); return Promise.resolve(); },
    async read(uid) { f._check('read'); return f.records[uid] ? clone(f.records[uid]) : null; },
    async write(uid, data) {
      if (f.delay) await new Promise((r) => setTimeout(r, f.delay));
      f._check('write');
      f.records[uid] = { ...clone(data), updatedAt: 'fake-time' };
      f.writes.push(uid);
    },
    async listAll() { f._check('list'); return Object.values(f.records).map(clone); },
  };
  return f;
}

const FAKE_MODE = typeof location !== 'undefined' && /[?&]fake(=|&|$)/.test(location.search);
cloud = FAKE_MODE ? makeFakeCloud() : makeFirebaseCloud();
if (FAKE_MODE) window.fakeCloud = cloud;

// 화면 코드가 부르는 창구 함수들
function cloudInit(onAuth, onAuthError) { return cloud.init(onAuth, onAuthError); }
function cloudLogin() { return cloud.login(); }
function cloudLogout() { return cloud.logout(); }
function cloudRead(uid) { return cloud.read(uid); }
function cloudListAll() { return cloud.listAll(); }

// ---------- 이 기기에 예전에 저장하던 기록 (로그인 전 버전) ----------
// 처음 로그인할 때 계정으로 옮겨 올 수 있게 읽기만 한다. 옮겨진 걸 확인한 뒤에만 지운다.
const LEGACY_KEY = 'platformer-save';

function readLegacyLocal() {
  try {
    const text = localStorage.getItem(LEGACY_KEY);
    if (text === null) return null;
    const s = cleanSave(JSON.parse(text));
    return s.owner || Object.keys(s.stages).length ? s : null;
  } catch (e) {
    return null;
  }
}

function clearLegacyLocal() {
  try { localStorage.removeItem(LEGACY_KEY); } catch (e) { /* 막혀 있으면 그대로 둔다 */ }
}

// ---------- 기록을 파일로 내보내기 · 불러오기 ----------
// 파일 모양: { app: 'platformer-save', v: 1, exportedAt: '날짜', owner: '이름', stages: {...} }
// 여기서는 글을 만들고 검사만 한다. 파일을 내려받고 고르는 화면은 index.html 에 있다.
const EXPORT_APP = 'platformer-save';
const EXPORT_MAX_CHARS = 200000;   // 이보다 큰 파일은 기록 파일이 아니라고 본다

function makeExportText(save) {
  return JSON.stringify({
    app: EXPORT_APP, v: 1, exportedAt: new Date().toISOString(),
    owner: save.owner, stages: save.stages,
  }, null, 2);
}

// 파일 글을 검사한다. 성공하면 { ok: true, save, dropped, exportedAt }, 실패하면 { ok: false, error }.
// 기록은 바꾸지 않는다. stageList 를 주면 없는 스테이지·넘치는 코인을 걸러낸다.
function parseImport(text, stageList) {
  if (typeof text !== 'string') return { ok: false, error: '파일을 읽지 못했어요.' };
  if (text.length > EXPORT_MAX_CHARS) return { ok: false, error: '파일이 너무 커요. 이 게임의 기록 파일이 아니에요.' };
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: '기록 파일이 아니에요. 읽을 수 없는 글이에요.' }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.app !== EXPORT_APP) {
    return { ok: false, error: '이 게임에서 내보낸 기록 파일이 아니에요.' };
  }
  if (raw.v !== 1) {
    return { ok: false, error: raw.v > 1 ? '더 새로운 버전의 기록 파일이에요. 이 게임으로는 읽을 수 없어요.' : '지원하지 않는 기록 파일 버전이에요.' };
  }
  const stagesRaw = raw.stages && typeof raw.stages === 'object' && !Array.isArray(raw.stages) ? raw.stages : {};
  const cleaned = cleanSave({ owner: raw.owner, stages: stagesRaw });
  let dropped = Object.keys(stagesRaw).length - Object.keys(cleaned.stages).length;
  if (Array.isArray(stageList)) dropped += clampToStages(cleaned, stageList);
  if (!cleaned.owner && Object.keys(cleaned.stages).length === 0) return { ok: false, error: '기록이 비어 있어요.' };
  const when = typeof raw.exportedAt === 'string' && !isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt.slice(0, 10) : null;
  return { ok: true, save: cleaned, dropped, exportedAt: when };
}

// 검사를 통과한 기록으로 지금 기록을 통째로 바꾼다 (화면에서 "바꾸기"를 눌렀을 때만 부른다)
function replaceSave(save) {
  const clean = cleanSave(save);
  const saved = writeSave(clean);
  return { save: clean, saved };
}
