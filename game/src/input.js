// Keyboard and mouse input for Azura Bay. The game reads this one object each
// frame; main.js converts the mouse position into world coordinates.
// SPDX-License-Identifier: MIT

export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    sprint: false, handbrake: false, shooting: false,
    enterPressed: false, pausePressed: false, mutePressed: false,
    mouseX: 0, mouseY: 0, mouseWorldX: 0, mouseWorldY: 0,
    anyKey: false,
  };

  const keyMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'handbrake',
  };

  window.addEventListener('keydown', (e) => {
    input.anyKey = true;
    const field = keyMap[e.code];
    if (field) {
      input[field] = true;
      if (e.code === 'Space') e.preventDefault();
    }
    if (e.code === 'KeyE' && !e.repeat) input.enterPressed = true;
    if (e.code === 'KeyP' && !e.repeat) input.pausePressed = true;
    if (e.code === 'KeyM' && !e.repeat) input.mutePressed = true;
  });
  window.addEventListener('keyup', (e) => {
    const field = keyMap[e.code];
    if (field) input[field] = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.sprint = input.handbrake = input.shooting = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.shooting = true;
    const rect = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - rect.left;
    input.mouseY = e.clientY - rect.top;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.shooting = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}
