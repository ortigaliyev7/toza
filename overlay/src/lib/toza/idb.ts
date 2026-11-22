import type {ArchiveStore, ArchivedMessage} from './core';

type Row = ArchivedMessage & {d: 0 | 1};

const DB = 'toza-archive';
const STORE = 'msgs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, {keyPath: 'k'});
      s.createIndex('d', 'd');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const wrap = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const strip = ({d, ...rest}: Row): ArchivedMessage => rest;

/** Brauzerdagi mahalliy arxiv (IndexedDB). `d`=1 — serverga hali yuklanmagan. */
export class IdbStore implements ArchiveStore {
  private db: Promise<IDBDatabase> | null = null;

  private async tx(mode: IDBTransactionMode) {
    this.db ||= open();
    return (await this.db).transaction(STORE, mode).objectStore(STORE);
  }

  async get(k: string) {
    const r = await wrap((await this.tx('readonly')).get(k)) as Row | undefined;
    return r && strip(r);
  }

  async put(m: ArchivedMessage, dirty: boolean) {
    await wrap((await this.tx('readwrite')).put({...m, d: dirty ? 1 : 0} as Row));
  }

  async dirty(limit: number) {
    return ((await wrap((await this.tx('readonly')).index('d').getAll(1, limit))) as Row[]).map(strip);
  }

  async clearDirty(items: {k: string; u: number}[]) {
    for(const {k, u} of items) {
      const s = await this.tx('readwrite');
      const r = await wrap(s.get(k)) as Row | undefined;
      if(r && r.u === u) await wrap(s.put({...r, d: 0}));
    }
  }

  async all() {
    return ((await wrap((await this.tx('readonly')).getAll())) as Row[]).map(strip);
  }

  async remove(keys: string[]) {
    for(const k of keys) await wrap((await this.tx('readwrite')).delete(k));
  }

  async markAllDirty() {
    const s = await this.tx('readwrite');
    const rows = await wrap(s.getAll()) as Row[];
    for(const r of rows) await wrap(s.put({...r, d: 1}));
  }

  async clear() {
    await wrap((await this.tx('readwrite')).clear());
  }
}
