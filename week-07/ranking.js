// 주인별 랭킹 계산. 기록을 받아서 순위만 계산하고, 저장은 하지 않는다 (저장은 save.js).
// current: 지금 주인의 기록, owners: 보관된 다른 주인들 { 이름: { owner, stages } }, stageList: STAGES

// 별은 한 판 안에서 정해지지만 옛 기록에는 없을 수 있어서, 깬 스테이지는 최소 1개로 친다
function ownerTotals(stages) {
  let stars = 0, coins = 0, cleared = 0;
  for (const rec of Object.values(stages)) {
    cleared++;
    stars += rec.stars || 1;
    coins += rec.coins;
  }
  return { stars, coins, cleared };
}

const byName = (a, b) => a.name.localeCompare(b.name, 'ko');

// 같은 값이면 같은 순위 (1, 1, 3 …)
function assignRanks(rows, sameFn) {
  let prev = null, rank = 0;
  rows.forEach((row, i) => {
    if (!prev || !sameFn(prev, row)) rank = i + 1;
    row.rank = rank;
    prev = row;
  });
  return rows;
}

function buildRanking(current, owners, stageList) {
  // 같은 이름이면 지금 주인의 기록을 쓴다. 이름이 없는 기록은 넣지 않는다.
  const map = {};
  for (const name of Object.keys(owners || {})) map[name] = owners[name].stages;
  if (current && current.owner) map[current.owner] = current.stages;
  const list = Object.keys(map).map(name => ({
    name, stages: map[name], current: !!current && name === current.owner, ...ownerTotals(map[name]),
  }));

  // 전체 순위: 별 합계 → 코인 합계 → (같으면 같은 순위, 이름 순으로 보여 줌)
  const overall = list.slice().sort((a, b) => b.stars - a.stars || b.coins - a.coins || byName(a, b))
    .map(o => ({ name: o.name, current: o.current, stars: o.stars, coins: o.coins, cleared: o.cleared }));
  assignRanks(overall, (a, b) => a.stars === b.stars && a.coins === b.coins);

  // 스테이지별 순위: 가장 빠른 시간 (시간 기록이 있는 주인만)
  const perStage = stageList.map(st => {
    const rows = list.filter(o => o.stages[st.id] && o.stages[st.id].time)
      .map(o => ({ name: o.name, current: o.current, time: o.stages[st.id].time }))
      .sort((a, b) => a.time - b.time || byName(a, b));
    assignRanks(rows, (a, b) => a.time === b.time);
    return { id: st.id, name: st.name, rows };
  });
  return { overall, perStage };
}

// 서버에서 받은 여러 사람의 기록(문서 목록)을 랭킹 계산에 넣을 모양으로 바꾼다.
// records: [{ uid, nickname, stages }], myUid: 나의 uid (나는 빼고 지금 기록으로 따로 넣는다), myNickname: 나의 별명
// 남이 쓴 값이라 믿지 않고 한 번 거른다. 별명이 겹치면 uid 앞 4글자를 붙여 구분한다 (예: "토끼 #a1b2").
function ownersFromRecords(records, myUid, myNickname, stageList) {
  const owners = {};
  const used = new Set([myNickname]);
  for (const r of records || []) {
    if (!r || typeof r !== 'object' || r.uid === myUid) continue;
    const nick = typeof r.nickname === 'string' ? cleanName(r.nickname) : '';
    if (!nick) continue;
    const s = cleanSave({ owner: nick, stages: r.stages });
    clampToStages(s, stageList);
    let name = nick;
    if (used.has(name)) name = `${nick} #${String(r.uid || '').slice(0, 4)}`;
    if (used.has(name)) continue;   // 그래도 겹치면 건너뛴다
    used.add(name);
    owners[name] = { owner: name, stages: s.stages };
  }
  return owners;
}
