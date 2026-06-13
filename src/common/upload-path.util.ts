import * as fs from 'fs';
import * as path from 'path';

/**
 * Каталог загрузок. На Railway: UPLOAD_DIR=/aida_volume (mount volume).
 * Локально по умолчанию: {cwd}/uploads
 */
export function resolveUploadDir(cwd: string = process.cwd()): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(cwd, fromEnv);
  }
  return path.join(cwd, 'uploads');
}

export function ensureUploadDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
