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
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&') // &lt;br/&gt; 처럼 바뀌어 온 글자
    .split(/<\s*br\s*\/?\s*>|\r?\n/i) // <br/>, <br>, < br / >, 줄바꿈 모두 줄 나눔으로
    .map(line => line.replace(/<[^>]*>/g, '').trim()) // 남은 HTML 표시는 지움
    .filter(Boolean)
    .map(line => {
      const numbers = [];
      const take = (_, group) => {
        numbers.push(...group.split('.').map(s => parseInt(s, 10)));
        return ' ';
      };
      const name = line
        .replace(/\(\s*(\d{1,2}(?:\s*\.\s*\d{1,2})*\.?)\s*\)/g, take) // 어디에 있든 (1.2.5) 모양
        .replace(/\s+((?:\d{1,2}\.)+\d{0,2})\s*$/, take) // 끝에 붙은 1.2.5. 모양
        .replace(/\s+/g, ' ')
        .replace(/\s+([/,])/g, '$1') // "돈까스 /소스" → "돈까스/소스"
        .trim();
      const allergies = numbers.filter(n => n >= 1 && n <= 19);
      return { name, allergies };
    })
    .filter(dish => dish.name);
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

// 마지막으로 받은 급식 기억하기 (그 브라우저에만 저장. 저장이 막혀 있으면 조용히 넘어감)
const LAST_KEY = 'meal-last';

function saveLastMeals(school, ymd, meals, savedAt = Date.now()) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ office: school.office, code: school.code, ymd, meals, savedAt }));
  } catch (e) {}
}

function loadLastMeals(school) {
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY));
    if (last && last.office === school.office && last.code === school.code && Array.isArray(last.meals)) return last;
  } catch (e) {}
  return null;
}

// 1700000000000 → "11월 14일 (토) 오후 3:05"
function savedAtLabel(ms) {
  const d = new Date(ms);
  const h = d.getHours();
  return `${todayInfo(d).label} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 20261113 → "11월 13일 (금)"
function ymdLabel(ymd) {
  return todayInfo(new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8))).label;
}

// 급식을 받아 오고, 못 받으면 마지막으로 받은 정보로 대신한다.
// 돌려주는 값: { meals, ymd, offline: false } 또는 { meals, ymd, offline: true, savedAt, reason }
// 마지막 정보도 없으면 까닭을 담은 오류를 던진다.
async function getMealsOrLast(school, ymd) {
  try {
    const meals = await getMeals(school, ymd);
    saveLastMeals(school, ymd, meals);
    return { meals, ymd, offline: false };
  } catch (e) {
    const last = loadLastMeals(school);
    if (!last) throw e;
    return { meals: last.meals, ymd: last.ymd, offline: true, savedAt: last.savedAt, reason: e.message };
  }
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
