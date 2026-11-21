// 플랫폼 게임의 움직임 규칙. 화면은 그리지 않고 계산만 한다 (확인 도구도 이 파일을 그대로 씀).

const PHYS = {
  W: 24, H: 32,          // 캐릭터 크기
  SPEED: 4,              // 한 프레임에 걷는 거리
  GRAVITY: 0.55,
  JUMP: -11.5,           // 점프 시작 속도 (높이 약 115)
  CUT: -4,               // 점프 단추를 일찍 놓으면 위로 가는 속도를 이만큼으로 줄임
  MAXFALL: 14,
  COYOTE: 6,             // 발판 끝에서 떨어진 뒤에도 6프레임은 점프 가능
  BUFFER: 6,             // 착지 6프레임 전에 눌러도 점프 됨
  DEAD_Y: 520,           // 이 아래로 떨어지면 처음 자리로
};

function newPlayer(stage) {
  return { x: stage.start.x, y: stage.start.y, vx: 0, vy: 0, onGround: false,
           coyote: 0, buffer: 0, jumpHeld: false, facing: 1, dead: false };
}

function overlaps(p, r) {
  return p.x < r.x + r.w && p.x + PHYS.W > r.x && p.y < r.y + r.h && p.y + PHYS.H > r.y;
}

// input: { left, right, jump }  (jump 는 누르고 있는 동안 true)
function stepPlayer(p, input, stage) {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.vx = dir * PHYS.SPEED;
  if (dir) p.facing = dir;

  if (p.onGround) p.coyote = PHYS.COYOTE; else if (p.coyote > 0) p.coyote--;
  if (input.jump && !p.jumpHeld) p.buffer = PHYS.BUFFER;
  p.jumpHeld = !!input.jump;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = PHYS.JUMP; p.buffer = 0; p.coyote = 0; p.onGround = false;
  }
  if (p.buffer > 0) p.buffer--;
  if (!input.jump && p.vy < PHYS.CUT) p.vy = PHYS.CUT;

  // 옆으로 움직이기
  p.x += p.vx;
  if (p.x < 0) p.x = 0;
  if (p.x > stage.width - PHYS.W) p.x = stage.width - PHYS.W;
  for (const r of stage.platforms) {
    if (overlaps(p, r)) {
      if (p.vx > 0) p.x = r.x - PHYS.W; else if (p.vx < 0) p.x = r.x + r.w;
    }
  }

  // 위아래로 움직이기
  p.vy = Math.min(p.vy + PHYS.GRAVITY, PHYS.MAXFALL);
  p.y += p.vy;
  p.onGround = false;
  for (const r of stage.platforms) {
    if (overlaps(p, r)) {
      if (p.vy > 0) { p.y = r.y - PHYS.H; p.vy = 0; p.onGround = true; }
      else if (p.vy < 0) { p.y = r.y + r.h; p.vy = 0; }
    }
  }
  if (p.y > PHYS.DEAD_Y) p.dead = true;
}

function touchesCoin(p, c) {
  const cx = p.x + PHYS.W / 2, cy = p.y + PHYS.H / 2;
  return Math.abs(cx - c.x) < 22 && Math.abs(cy - c.y) < 26;
}

function touchesGoal(p, g) {
  return overlaps(p, g);
}
