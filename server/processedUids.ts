import fs from 'fs';
import path from 'path';
// Resolve storage file path safely in both CJS bundle and TSX/ESM dev
const possiblePaths = [
  path.resolve(process.cwd(), 'server', 'processed_uids.json'),
  path.resolve(process.cwd(), 'processed_uids.json'),
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, 'server', 'processed_uids.json') : '',
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, 'processed_uids.json') : '',
].filter(Boolean);

const FILE_PATH = possiblePaths.find(p => fs.existsSync(p)) || path.resolve(process.cwd(), 'server', 'processed_uids.json');

export class ProcessedUidsTracker {
  private uids: Set<number> = new Set();

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const raw = fs.readFileSync(FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          this.uids = new Set(data.map(Number));
        }
      }
    } catch (e) {
      console.warn('[UID Tracker] Initializing fresh set.');
    }
  }

  public save() {
    try {
      const dir = path.dirname(FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(FILE_PATH, JSON.stringify(Array.from(this.uids)), 'utf-8');
    } catch (e) {
      console.warn('[UID Tracker] Could not save processed_uids.json:', e);
    }
  }

  public has(uid: number): boolean {
    return this.uids.has(Number(uid));
  }

  public add(uid: number) {
    this.uids.add(Number(uid));
    this.save();
  }

  public addMany(uids: number[]) {
    for (const uid of uids) {
      this.uids.add(Number(uid));
    }
    this.save();
  }

  public size(): number {
    return this.uids.size;
  }
}

export const uidTracker = new ProcessedUidsTracker();
