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
    /** Hanya satu per kapal (mis. fore peak): tidak diberi nomor dan tidak bisa ditambah dua kali. */
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
  
  /** Nama baris berikutnya untuk jenis ini. null bila jenis tunggal dan sudah ada. */
  export function nextTankName(k: Pick<TankKind, 'label' | 'single'>, names: string[]): string | null {
    const hits = names.filter((n) => matchesKind(n, k.label));
    if (k.single) return hits.length > 0 ? null : k.label;
    let max = 0;
    for (const n of hits) {
      const m = n.trim().match(/\s(\d+)$/);
      max = Math.max(max, m ? Number(m[1]) : 1);
    }
    return `${k.label} ${max + 1}`;
  }
  
  export const kindsFor = (c: TankCtx, showAll: boolean): TankKind[] => TANK_KINDS.filter((k) => showAll || !k.applies || k.applies(c));
  
  export function catalogGroups(c: TankCtx, showAll: boolean): { title: string; kinds: TankKind[] }[] {
    const list = kindsFor(c, showAll);
    return TANK_GROUPS.map((title) => ({ title, kinds: list.filter((k) => k.group === title) })).filter((g) => g.kinds.length > 0);
  }
  