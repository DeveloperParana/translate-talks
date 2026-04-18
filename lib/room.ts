// Letters that don't visually confuse (no I, O — avoid 1/0 confusion)
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return code;
}

export function getRoomChannel(code: string): string {
  return `sala:${code.toUpperCase()}`;
}
