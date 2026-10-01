// 입력 — 키보드(물리 키 code 기준: 한글 입력 상태에서도 WASD 동작) · 마우스 · 터치 조이스틱(화면 UI 가 값을 넣는다).
export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0, down: false, clicked: false, right: false, dragDX: 0, dragDY: 0, wheel: 0, inside: false };
  joy = { x: 0, y: 0, active: false };
  /** 화면 행동 버튼(모바일) */
  action = false;
  private el: HTMLElement;
  private downAt = { x: 0, y: 0, t: 0 };
  private offs: Array<() => void> = [];

  constructor(el: HTMLElement) {
    this.el = el;
    const typing = (e: Event) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const kd = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    const ku = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    const blur = () => {
      this.keys.clear();
      this.joy.active = false;
      this.joy.x = this.joy.y = 0;
    };
    const mm = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;
      if (this.mouse.down || this.mouse.right) {
        this.mouse.dragDX += nx - this.mouse.x;
        this.mouse.dragDY += ny - this.mouse.y;
      }
      this.mouse.x = nx;
      this.mouse.y = ny;
      this.mouse.ndcX = (nx / r.width) * 2 - 1;
      this.mouse.ndcY = -(ny / r.height) * 2 + 1;
      this.mouse.inside = true;
    };
    const md = (e: PointerEvent) => {
      mm(e);
      if (e.button === 2) this.mouse.right = true;
      else {
        this.mouse.down = true;
        this.downAt = { x: this.mouse.x, y: this.mouse.y, t: performance.now() };
      }
    };
    const mu = (e: PointerEvent) => {
      if (e.button === 2) this.mouse.right = false;
      else if (this.mouse.down) {
        this.mouse.down = false;
        const moved = Math.hypot(this.mouse.x - this.downAt.x, this.mouse.y - this.downAt.y);
        if (moved < 8 && performance.now() - this.downAt.t < 450) this.mouse.clicked = true;
      }
    };
    const wh = (e: WheelEvent) => {
      this.mouse.wheel += Math.sign(e.deltaY);
    };
    const ctx = (e: Event) => e.preventDefault();
    const leave = () => {
      this.mouse.inside = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    el.addEventListener('pointermove', mm);
    el.addEventListener('pointerdown', md);
    window.addEventListener('pointerup', mu);
    el.addEventListener('wheel', wh, { passive: true });
    el.addEventListener('contextmenu', ctx);
    el.addEventListener('pointerleave', leave);
    this.offs.push(
      () => window.removeEventListener('keydown', kd),
      () => window.removeEventListener('keyup', ku),
      () => window.removeEventListener('blur', blur),
      () => el.removeEventListener('pointermove', mm),
      () => el.removeEventListener('pointerdown', md),
      () => window.removeEventListener('pointerup', mu),
      () => el.removeEventListener('wheel', wh),
      () => el.removeEventListener('contextmenu', ctx),
      () => el.removeEventListener('pointerleave', leave),
    );
  }

  /** 이동 입력(-1~1). 화면 기준: x 오른쪽, z 아래(남) */
  move(): { x: number; z: number; mag: number; run: boolean } {
    let x = 0;
    let z = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    let mag = Math.hypot(x, z);
    if (mag > 0) {
      x /= mag;
      z /= mag;
      mag = 1;
    }
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (this.joy.active) {
      const jm = Math.min(1, Math.hypot(this.joy.x, this.joy.y));
      if (jm > 0.12) {
        x = this.joy.x / Math.max(jm, 0.0001);
        z = this.joy.y / Math.max(jm, 0.0001);
        mag = jm;
        run = jm > 0.92;
      }
    }
    return { x, z, mag, run };
  }

  /** 이번 프레임에 눌렸는지(한 번만) */
  hit(...codes: string[]): boolean {
    for (const c of codes) {
      if (this.pressed.has(c)) {
        this.pressed.delete(c);
        return true;
      }
    }
    return false;
  }

  takeAction(): boolean {
    const a = this.action || this.hit('KeyE', 'Space', 'Enter', 'NumpadEnter');
    this.action = false;
    return a;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.wheel = 0;
    this.mouse.dragDX = 0;
    this.mouse.dragDY = 0;
  }

  dispose() {
    this.offs.forEach((f) => f());
  }
}
