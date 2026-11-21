// 스테이지 정보. 스테이지를 늘리거나 고칠 때는 이 파일만 바꾸면 된다 (게임 코드는 그대로).
//   id: 1부터 차례로 / name: 이름 / level: 난이도 1~3 (카드에 ★로 보임) / hint: 한 줄 설명
//   par: 목표 시간(초). 이 안에 깨면 별 +1 (별 계산은 맨 아래 calcStars)
//   width: 스테이지 가로 길이 / start: 시작 자리 / platforms: 발판 / coins: 코인 / goal: 깃발
//   발판은 {x, y, w, h}, 코인은 {x, y}, 깃발은 {x, y, w, h}. 땅 높이는 390, 화면 높이는 450.
// 점점 어렵게: 뒤로 갈수록 길고, 코인이 많고, 구멍이 많고 넓고, 떠 있는 발판이 좁다. (check/index.html 이 확인한다)

function ground(x, w) { return { x, y: 390, w, h: 60 }; }
function plat(x, y, w) { return { x, y, w, h: 20 }; }

const STAGES = [
  {
    id: 1, name: '풀밭', level: 1, par: 12, hint: '넓은 땅에서 구멍 두 개를 건너뛰어 봐요',
    width: 2000, start: { x: 40, y: 350 },
    platforms: [
      ground(0, 520), ground(620, 480), ground(1200, 800),
      plat(340, 310, 110), plat(760, 300, 120), plat(1350, 310, 120), plat(1560, 250, 120),
    ],
    coins: [{ x: 150, y: 360 }, { x: 395, y: 280 }, { x: 810, y: 270 }, { x: 1410, y: 280 }, { x: 1620, y: 220 }],
    goal: { x: 1900, y: 330, w: 30, h: 60 },
  },
  {
    id: 2, name: '바위 길', level: 2, par: 15, hint: '구멍이 이어져요. 징검다리를 연달아 뛰어요',
    width: 2400, start: { x: 40, y: 350 },
    platforms: [
      ground(0, 400), ground(520, 200), ground(1400, 300), ground(2150, 250),
      plat(800, 330, 120), plat(1000, 270, 120), plat(1200, 330, 100),
      plat(1780, 320, 100), plat(1960, 260, 100),
    ],
    coins: [{ x: 200, y: 360 }, { x: 860, y: 300 }, { x: 1060, y: 240 }, { x: 1250, y: 300 },
            { x: 1540, y: 360 }, { x: 1830, y: 290 }, { x: 2010, y: 230 }],
    goal: { x: 2320, y: 330, w: 30, h: 60 },
  },
  {
    id: 3, name: '구름 다리', level: 3, par: 18, hint: '좁은 발판과 넓은 구멍. 높이 올라가는 곳도 있어요',
    width: 2800, start: { x: 40, y: 350 },
    platforms: [
      ground(0, 300), ground(1940, 300), ground(2650, 150),
      plat(420, 330, 90), plat(640, 270, 90), plat(860, 330, 90), plat(1080, 270, 90),
      plat(1290, 210, 90), plat(1500, 270, 90), plat(1720, 330, 90),
      plat(2360, 320, 100), plat(2520, 260, 100),
    ],
    coins: [{ x: 150, y: 360 }, { x: 465, y: 300 }, { x: 685, y: 240 }, { x: 905, y: 300 },
            { x: 1125, y: 240 }, { x: 1335, y: 180 }, { x: 1545, y: 240 }, { x: 1765, y: 300 },
            { x: 2410, y: 290 }],
    goal: { x: 2740, y: 330, w: 30, h: 60 },
  },
];

// 별 계산 (한 판 안에서): 깼으면 1개, 코인을 전부 모았으면 +1, 목표 시간(par) 안에 깼으면 +1.
// coins: 이번 판에 모은 코인 개수, cs: 걸린 시간 (1/100초)
function calcStars(stage, coins, cs) {
  const allCoins = coins >= stage.coins.length;
  const fast = cs <= stage.par * 100;
  return { stars: 1 + (allCoins ? 1 : 0) + (fast ? 1 : 0), allCoins, fast };
}
