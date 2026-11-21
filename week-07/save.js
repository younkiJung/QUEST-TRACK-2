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
