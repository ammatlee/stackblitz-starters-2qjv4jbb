/* Katalog jenis tangki/kompartemen untuk daftar uji Leak dan Structural.
   Hanya mempercepat pengisian nama: ketuk satu jenis, satu baris baru dibuat dengan nomor otomatis.
   Tidak mengubah status uji dan tidak memutuskan tangki mana yang wajib uji struktural. */

   export type TankCtx = {
    propelled: boolean;
    /** Kapal pembawa minyak/bahan kimia menurut jenisnya. Kapal lain dengan notasi kargo bisa menampilkan semua jenis. */
    oil: boolean;
  };
  
  export type TankKind = {
    key: string;
    /** Nama dasar. Baris yang dibuat: "<label> 1", "<label> 2", dst (jenis tunggal tanpa nomor). */
    label: string;
    group: string;
    /** Biasanya satu per kapal (mis. fore peak): tidak diberi nomor. Bila ditambah lagi, tangkinya dibedakan dengan P/C/S. */
    single?: boolean;
    /** Bila ada dan hasilnya false, jenis ini disembunyikan kecuali "Tampilkan semua jenis". */
    applies?: (c: TankCtx) => boolean;
    /** Pengingat singkat di bawah uji struktural. Hanya untuk jenis yang punya aturan khusus. */
    hint?: string;
  };
  
  const propelledOnly = (c: TankCtx) => c.propelled;
  const oilOnly = (c: TankCtx) => c.oil;
  
  export const TANK_GROUPS = ['Ballast dan ruang kosong', 'Bahan bakar dan minyak', 'Air dan limbah', 'Lainnya', 'Kargo minyak'] as const;
  
  export const TANK_KINDS: TankKind[] = [
    { key: 'forepeak', label: 'Fore peak tank', group: 'Ballast dan ruang kosong', single: true },
    { key: 'afterpeak', label: 'After peak tank', group: 'Ballast dan ruang kosong', single: true },
    { key: 'ballast', label: 'Ballast tank', group: 'Ballast dan ruang kosong' },
    { key: 'doublebottom', label: 'Double bottom tank', group: 'Ballast dan ruang kosong' },
    { key: 'wing', label: 'Wing tank', group: 'Ballast dan ruang kosong' },
    { key: 'void', label: 'Void space', group: 'Ballast dan ruang kosong' },
    { key: 'cofferdam', label: 'Cofferdam', group: 'Ballast dan ruang kosong' },
    { key: 'fuel', label: 'Fuel oil tank', group: 'Bahan bakar dan minyak', applies: propelledOnly },
    { key: 'fuelservice', label: 'Fuel oil service tank', group: 'Bahan bakar dan minyak', applies: propelledOnly },
    { key: 'lub', label: 'Lub oil tank', group: 'Bahan bakar dan minyak', applies: propelledOnly },
    { key: 'freshwater', label: 'Freshwater tank', group: 'Air dan limbah' },
    { key: 'sewage', label: 'Sewage tank', group: 'Air dan limbah' },
    { key: 'sludge', label: 'Sludge tank', group: 'Air dan limbah' },
    {
      key: 'chainlocker',
      label: 'Chain locker',
      group: 'Lainnya',
      single: true,
      hint: 'Tinggi uji sampai top of chain pipe (S14 Part A Tabel 1 butir 18). Pengecualian uji struktural tidak berlaku untuk chain locker (S14 Part A 4.2.2.3 dan 4.2.2.4).',
    },
    {
      key: 'cargo',
      label: 'Cargo oil tank',
      group: 'Kargo minyak',
      applies: oilOnly,
      hint: 'Cek pengecualian S14 Part C 2.4: batas ruang kargo yang berdekatan dengan kompartemen lain pada tanker dan tangki kargo/polutan terpisah wajib diuji struktural semuanya. Konfirmasikan dengan ITP.',
    },
    { key: 'slop', label: 'Slop tank', group: 'Kargo minyak', applies: oilOnly },
  ];
  
  /** Kapal pembawa minyak atau bahan kimia menurut jenisnya (Oil Barge, SPOB, tanker). */
  export const isOilCarrier = (t: string | null | undefined): boolean => !!t && /oil|chemical|minyak|kimia|tanker|\bspob\b/i.test(t);
  
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  /** Apakah nama baris termasuk jenis ini: "<label>" atau "<label> <angka>". Nama yang diubah (mis. "(P)") tidak dihitung. */
  export const matchesKind = (name: string, label: string): boolean => new RegExp(`^${esc(label)}(\\s+\\d+)?$`, 'i').test(name.trim());
  
  export const countKind = (names: string[], k: TankKind): number => names.filter((n) => matchesKind(n, k.label)).length;
  
  export const kindOfName = (name: string): TankKind | null => TANK_KINDS.find((k) => matchesKind(name, k.label)) ?? null;
  
  /** Nama baris berikutnya untuk jenis ini. Jenis tunggal tetap bernama polos; tangki kedua dibedakan lewat P/C/S, bukan nomor. */
  export function nextTankName(k: Pick<TankKind, 'label' | 'single'>, names: string[]): string {
    const hits = names.filter((n) => matchesKind(n, k.label));
    if (k.single) return k.label;
    let max = 0;
    for (const n of hits) {
      const m = n.trim().match(/\s(\d+)$/);
      max = Math.max(max, m ? Number(m[1]) : 1);
    }
    return `${k.label} ${max + 1}`;
  }

  /** Penanda posisi tangki: Port, Center, Starboard. Disimpan terpisah dari nama. */
  export type TankSide = 'P' | 'C' | 'S';
  export const TANK_SIDES: TankSide[] = ['P', 'C', 'S'];
  export const TANK_SIDE_LABEL: Record<TankSide, string> = { P: 'Port', C: 'Center', S: 'Starboard' };

  /** Nama untuk tampilan dan teks temuan, mis. "Fore peak tank (P)". */
  export const tankDisplayName = (name: string, side: TankSide | null | undefined): string => (side ? `${name} (${side})` : name);

  type SideRow = { id: string; name: string; side: TankSide | null };

  /** Kunci kelompok "tangki sejenis": jenis katalog bila dikenal, selain itu nama polos. */
  const groupKey = (name: string): string => kindOfName(name)?.key ?? `n:${name.trim().toLowerCase()}`;

  /** Baris yang perlu menampilkan pilihan P/C/S: ada tangki sejenis lain, atau penandanya sudah terisi (supaya bisa diubah/dikosongkan). */
  export function rowsNeedingSide(rows: SideRow[]): Set<string> {
    const count = new Map<string, number>();
    for (const r of rows) count.set(groupKey(r.name), (count.get(groupKey(r.name)) ?? 0) + 1);
    return new Set(rows.filter((r) => r.side != null || (count.get(groupKey(r.name)) ?? 0) > 1).map((r) => r.id));
  }

  /** Baris yang kembar: nama dan penanda sama persis dengan baris lain. Perlu dibedakan dengan P/C/S atau nama. */
  export function duplicateTankIds(rows: SideRow[]): Set<string> {
    const count = new Map<string, number>();
    const key = (r: SideRow) => `${r.name.trim().toLowerCase()}|${r.side ?? ''}`;
    for (const r of rows) count.set(key(r), (count.get(key(r)) ?? 0) + 1);
    return new Set(rows.filter((r) => (count.get(key(r)) ?? 0) > 1).map((r) => r.id));
  }

  export const kindsFor = (c: TankCtx, showAll: boolean): TankKind[] => TANK_KINDS.filter((k) => showAll || !k.applies || k.applies(c));
  
  export function catalogGroups(c: TankCtx, showAll: boolean): { title: string; kinds: TankKind[] }[] {
    const list = kindsFor(c, showAll);
    return TANK_GROUPS.map((title) => ({ title, kinds: list.filter((k) => k.group === title) })).filter((g) => g.kinds.length > 0);
  }
  