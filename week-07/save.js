// 저장하는 코드는 전부 이 파일에만 둔다. (지금은 이 기기의 브라우저 localStorage 에 저장)
// 나중에 로그인과 보관함을 붙일 때는 이 파일만 바꾸면 된다.
// 저장 모양: { v: 1, owner: '이름', stages: { "1": { cleared: true, coins: 5 } } }

const SAVE_KEY = 'platformer-save';
let storageOk = true;   // 브라우저가 저장을 막으면 false
let memorySave = null;  // 저장이 막혔을 때 이번 방문 동안만 기억해 두는 곳

function emptySave() {
  return { v: 1, owner: '', stages: {} };
}

// 이름: 앞뒤 공백 없애고, 연속 공백을 하나로, 12글자까지
function cleanName(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, 12);
}

// 저장된 글이 망가졌거나 이상해도 안전한 모양으로 고쳐 읽는다
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

function loadSave() {
  let text;
  try {
    text = localStorage.getItem(SAVE_KEY);
  } catch (e) {
    // 브라우저가 저장소를 막음 → 이번 방문 동안 기억해 둔 것을 쓴다
    storageOk = false;
    return memorySave ? cleanSave(memorySave) : emptySave();
  }
  // 저장은 됐는데 읽을 게 없을 때: 저장이 막혀 있었다면 기억해 둔 것, 아니면 빈 기록
  if (text === null) return !storageOk && memorySave ? cleanSave(memorySave) : emptySave();
  try {
    return cleanSave(JSON.parse(text));
  } catch (e) {
    return emptySave();   // 망가진 글이면 빈 기록으로 시작
  }
}

// 저장 성공하면 true, 브라우저가 막으면 false
function writeSave(save) {
  memorySave = save;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    storageOk = true;
    return true;
  } catch (e) {
    storageOk = false;
    return false;
  }
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
  if (Array.isArray(stageList)) {
    for (const id of Object.keys(cleaned.stages)) {
      const st = stageList[Number(id) - 1];
      if (!st) { delete cleaned.stages[id]; dropped++; continue; }
      if (cleaned.stages[id].coins > st.coins.length) cleaned.stages[id].coins = st.coins.length;
    }
  }
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
