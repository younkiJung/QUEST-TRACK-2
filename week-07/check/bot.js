// 시험용 로봇: 오른쪽으로 걸으면서 구멍·벽·높은 발판 앞에서 점프해 본다.
// 점프 타이밍을 여러 가지로 바꿔 보고, 하나라도 깃발에 닿으면 "깰 수 있는 스테이지"로 본다.

function runBot(stage, off, ahead, maxFrames = 4000) {
  const p = newPlayer(stage);
  const took = stage.coins.map(() => false);
  let holding = false;
  for (let f = 0; f < maxFrames; f++) {
    let jump = holding;
    if (p.onGround) {
      const feet = p.y + PHYS.H;
      const px = p.x + off;
      const supported = stage.platforms.some(r => px >= r.x && px <= r.x + r.w && r.y >= feet - 2);
      const higherAhead = stage.platforms.some(r =>
        r.x > p.x + PHYS.W && r.x < p.x + PHYS.W + ahead && r.y < feet - 8 && r.y > feet - 115);
      if (!supported || higherAhead) { jump = true; holding = true; }
    }
    if (p.vy > 0) holding = false;
    // 깃발을 날아서 지나쳤으면 왼쪽으로 돌아간다
    const passed = p.x > stage.goal.x + stage.goal.w;
    stepPlayer(p, { right: !passed, left: passed, jump }, stage);
    stage.coins.forEach((c, i) => { if (!took[i] && touchesCoin(p, c)) took[i] = true; });
    if (p.dead) return { ok: false, frames: f, coins: took.filter(Boolean).length };
    if (touchesGoal(p, stage.goal)) return { ok: true, frames: f, coins: took.filter(Boolean).length };
  }
  return { ok: false, frames: maxFrames, coins: took.filter(Boolean).length };
}

// 여러 타이밍을 시험해서 가장 잘 간 결과를 돌려준다
function tryBot(stage) {
  let best = null;
  for (let off = 0; off <= 44; off += 4) {
    for (const ahead of [0, 16, 32, 48, 64, 80]) {
      const r = runBot(stage, off, ahead);
      if (r.ok && (!best || !best.ok || r.coins > best.coins)) best = { ...r, off, ahead };
      else if (!best) best = { ...r, off, ahead };
    }
  }
  return best;
}
