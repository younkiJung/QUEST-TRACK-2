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
function recordClear(stageId, coins) {
  const save = loadSave();
  const key = String(stageId);
  const before = save.stages[key];
  const firstClear = !before;
  const prev = before ? before.coins : 0;
  const best = Math.max(prev, coins);
  save.stages[key] = { cleared: true, coins: best };
  const saved = writeSave(save);
  return { save, firstClear, improved: !firstClear && coins > prev, prev, saved };
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
