import { describe, expect, it } from 'vitest';
import { TANK_GROUPS, TANK_KINDS, TANK_SIDES, catalogGroups, countKind, duplicateTankIds, isOilCarrier, kindOfName, kindsFor, matchesKind, nextTankName, rowsNeedingSide, tankDisplayName } from '../lib/newbuildingTankCatalog';

const fw = TANK_KINDS.find((k) => k.key === 'freshwater')!;
const fore = TANK_KINDS.find((k) => k.key === 'forepeak')!;
const fuel = TANK_KINDS.find((k) => k.key === 'fuel')!;
const fuelService = TANK_KINDS.find((k) => k.key === 'fuelservice')!;

describe('Katalog tangki', () => {
  it('kunci dan nama jenis unik, dan setiap grup dikenal', () => {
    expect(new Set(TANK_KINDS.map((k) => k.key)).size).toBe(TANK_KINDS.length);
    expect(new Set(TANK_KINDS.map((k) => k.label.toLowerCase())).size).toBe(TANK_KINDS.length);
    for (const k of TANK_KINDS) expect((TANK_GROUPS as readonly string[]).includes(k.group)).toBe(true);
  });

  it('penomoran: ketuk dua kali jadi tangki 1 dan 2', () => {
    const names: string[] = [];
    const a = nextTankName(fw, names);
    names.push(a as string);
    const b = nextTankName(fw, names);
    expect(a).toBe('Freshwater tank 1');
    expect(b).toBe('Freshwater tank 2');
  });

  it('penomoran lanjut dari nomor tertinggi dan nama polos dihitung 1', () => {
    expect(nextTankName(fw, ['Freshwater tank 3'])).toBe('Freshwater tank 4');
    expect(nextTankName(fw, ['Freshwater tank'])).toBe('Freshwater tank 2');
    expect(nextTankName(fw, ['Freshwater tank 1', 'Freshwater tank 2', 'Ballast tank 7'])).toBe('Freshwater tank 3');
  });

  it('nama yang diubah (mis. P/S) tidak ikut dihitung', () => {
    expect(nextTankName(fw, ['Freshwater tank (P)'])).toBe('Freshwater tank 1');
    expect(matchesKind('Freshwater tank (P)', fw.label)).toBe(false);
  });

  it('jenis tunggal: tanpa nomor, tangki kedua tetap boleh (dibedakan dengan P/C/S)', () => {
    expect(nextTankName(fore, [])).toBe('Fore peak tank');
    expect(nextTankName(fore, ['Fore peak tank'])).toBe('Fore peak tank');
  });

  it('penanda P/C/S dan nama tampilan', () => {
    expect(TANK_SIDES).toEqual(['P', 'C', 'S']);
    expect(tankDisplayName('Fore peak tank', 'P')).toBe('Fore peak tank (P)');
    expect(tankDisplayName('Fore peak tank', null)).toBe('Fore peak tank');
  });

  it('pilihan P/C/S hanya muncul bila ada tangki sejenis lain atau penanda sudah terisi', () => {
    const one = [{ id: 'a', name: 'Fore peak tank', side: null }];
    expect(rowsNeedingSide(one).size).toBe(0);
    const two = [
      { id: 'a', name: 'Fore peak tank', side: null },
      { id: 'b', name: 'Fore peak tank', side: null },
      { id: 'c', name: 'Chain locker', side: null },
    ];
    expect(Array.from(rowsNeedingSide(two)).sort()).toEqual(['a', 'b']);
    expect(rowsNeedingSide([{ id: 'c', name: 'Chain locker', side: 'P' }]).has('c')).toBe(true);
    // jenis katalog bernomor dihitung satu kelompok
    const nums = [
      { id: 'x', name: 'Ballast tank 1', side: null },
      { id: 'y', name: 'Ballast tank 2', side: null },
    ];
    expect(rowsNeedingSide(nums).size).toBe(2);
    // nama bebas dihitung per nama polos
    const free = [
      { id: 'p', name: 'Tangki X', side: null },
      { id: 'q', name: 'tangki x', side: null },
      { id: 'r', name: 'Tangki Y', side: null },
    ];
    expect(Array.from(rowsNeedingSide(free)).sort()).toEqual(['p', 'q']);
  });

  it('baris kembar: nama dan penanda sama persis', () => {
    const rows = [
      { id: 'a', name: 'Fore peak tank', side: null },
      { id: 'b', name: 'Fore peak tank', side: null },
      { id: 'c', name: 'Ballast tank 1', side: 'P' as const },
      { id: 'd', name: 'Ballast tank 1', side: 'S' as const },
      { id: 'e', name: 'Ballast tank 2', side: 'P' as const },
      { id: 'f', name: 'ballast tank 2', side: 'P' as const },
    ];
    expect(Array.from(duplicateTankIds(rows)).sort()).toEqual(['a', 'b', 'e', 'f']);
    expect(duplicateTankIds([{ id: 'a', name: 'Fore peak tank', side: 'P' }, { id: 'b', name: 'Fore peak tank', side: 'S' }]).size).toBe(0);
  });

  it('jenis yang namanya mirip tidak saling menghitung', () => {
    expect(countKind(['Fuel oil service tank 1', 'Fuel oil tank 1'], fuel)).toBe(1);
    expect(countKind(['Fuel oil service tank 1', 'Fuel oil tank 1'], fuelService)).toBe(1);
    expect(nextTankName(fuel, ['Fuel oil service tank 1'])).toBe('Fuel oil tank 1');
  });

  it('pencocokan nama tidak peka huruf besar dan kecil', () => {
    expect(kindOfName('chain locker')?.key).toBe('chainlocker');
    expect(kindOfName('Tangki lain')).toBeNull();
  });

  it('jenis kapal pembawa minyak', () => {
    expect(isOilCarrier('Oil Barge')).toBe(true);
    expect(isOilCarrier('SPOB')).toBe(true);
    expect(isOilCarrier('Oil Tanker')).toBe(true);
    expect(isOilCarrier('Chemical Tanker')).toBe(true);
    expect(isOilCarrier('Tugboat')).toBe(false);
    expect(isOilCarrier('Barge')).toBe(false);
    expect(isOilCarrier(null)).toBe(false);
  });

  it('penyaringan: tongkang biasa tanpa bahan bakar dan kargo minyak, tug tanpa kargo minyak', () => {
    const barge = kindsFor({ propelled: false, oil: false }, false).map((k) => k.key);
    expect(barge).not.toContain('fuel');
    expect(barge).not.toContain('cargo');
    expect(barge).toContain('freshwater');
    const tug = kindsFor({ propelled: true, oil: false }, false).map((k) => k.key);
    expect(tug).toContain('fuel');
    expect(tug).not.toContain('cargo');
    const oilBarge = kindsFor({ propelled: false, oil: true }, false).map((k) => k.key);
    expect(oilBarge).toContain('cargo');
    expect(oilBarge).toContain('slop');
  });

  it('tampilkan semua jenis memunculkan yang disembunyikan', () => {
    expect(kindsFor({ propelled: false, oil: false }, true).length).toBe(TANK_KINDS.length);
  });

  it('grup kosong tidak ditampilkan', () => {
    const titles = catalogGroups({ propelled: false, oil: false }, false).map((g) => g.title);
    expect(titles).not.toContain('Kargo minyak');
    expect(titles).not.toContain('Bahan bakar dan minyak');
    expect(catalogGroups({ propelled: true, oil: true }, false).length).toBe(TANK_GROUPS.length);
  });
});
