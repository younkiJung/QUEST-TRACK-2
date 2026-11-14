// 급식 앱이 쓰는 함수 모음. index.html 과 check/index.html 이 같이 쓴다.
// 나이스 교육정보 개방 포털 API 를 키 없이 쓴다 (키 없이 쓰면 한 번에 5줄까지만 받아 온다).
// 학교 이름과 코드는 이 파일에 적지 않는다. 고른 학교는 그 브라우저에만 저장된다.

const NEIS = 'https://open.neis.go.kr/hub/';

const ALLERGY = {
  1: '난류', 2: '우유', 3: '메밀', 4: '땅콩', 5: '대두', 6: '밀', 7: '고등어', 8: '게', 9: '새우',
  10: '돼지고기', 11: '복숭아', 12: '토마토', 13: '아황산류', 14: '호두', 15: '닭고기', 16: '쇠고기',
  17: '오징어', 18: '조개류(굴·전복·홍합 포함)', 19: '잣',
};

// 오늘 날짜를 20261114 모양과 "11월 14일 (토)" 모양으로
function todayInfo(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const ymd = `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
  const label = `${m}월 ${d}일 (${'일월화수목금토'[date.getDay()]})`;
  return { ymd, label };
}

// 나이스에 묻고 답을 받는다. 못 받으면 까닭을 담은 오류를 던진다.
// 돌려주는 값: 줄 목록 (데이터가 없으면 빈 목록)
async function askNeis(service, params, timeoutMs = 10000) {
  const url = NEIS + service + '?' + new URLSearchParams({ Type: 'json', pIndex: 1, pSize: 100, ...params });
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { signal: stop.signal });
  } catch (e) {
    throw new Error(e.name === 'AbortError'
      ? `나이스 서버가 ${timeoutMs / 1000}초 안에 답하지 않았어요. 잠시 뒤 다시 해 보세요.`
      : '나이스 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`나이스 서버가 오류를 돌려줬어요 (HTTP ${res.status}).`);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('나이스 서버의 답을 읽지 못했어요 (JSON 이 아님).');
  }

  if (data[service]) return data[service][1].row || [];
  const result = data.RESULT || {};
  if (result.CODE === 'INFO-200') return []; // 해당하는 데이터가 없음
  throw new Error(`나이스 서버가 정보를 주지 않았어요: ${result.MESSAGE || '까닭을 알 수 없음'} (${result.CODE || '코드 없음'})`);
}

// "치즈크러스트피자(수제) (1.2.5.6.13.16)<br/>깍두기 (9)<br/>귤 " → [{ name, allergies: [..] }]
function parseDishes(text) {
  return String(text || '')
    .split(/<br\s*\/?>/i)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      // 끝에 붙은 (1.2.5) 또는 1.2.5. 모양의 알레르기 번호
      const m = line.match(/\s*\(([\d.\s]+)\)\s*$/) || line.match(/\s+((?:\d{1,2}\.)+\d{0,2})\s*$/);
      if (!m) return { name: line, allergies: [] };
      const allergies = m[1].split('.').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 19);
      return { name: line.slice(0, m.index).trim(), allergies };
    });
}

// 학교 찾기 → [{ office, code, name, region, kind }]
async function findSchools(name) {
  const rows = await askNeis('schoolInfo', { SCHUL_NM: name });
  return rows.map(r => ({
    office: r.ATPT_OFCDC_SC_CODE,
    code: r.SD_SCHUL_CODE,
    name: r.SCHUL_NM,
    region: r.LCTN_SC_NM,
    kind: r.SCHUL_KND_SC_NM,
  }));
}

// 그날 급식 → [{ meal: '중식', dishes: [...], kcal }] (급식이 없으면 빈 목록)
async function getMeals(school, ymd) {
  const rows = await askNeis('mealServiceDietInfo', {
    ATPT_OFCDC_SC_CODE: school.office,
    SD_SCHUL_CODE: school.code,
    MLSV_YMD: ymd,
  });
  return rows.map(r => ({ meal: r.MMEAL_SC_NM, dishes: parseDishes(r.DDISH_NM), kcal: r.CAL_INFO }));
}
