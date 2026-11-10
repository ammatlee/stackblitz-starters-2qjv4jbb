'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import RequireAuth from '../../components/RequireAuth';
import { Button, Chip } from '../../components/Controls';
import { useDialog } from '../../components/DialogProvider';
import VesselTypeSelect from '../../components/VesselTypeSelect';
import DateInput from '../../components/DateInput';
import { isNonPropelled } from '../../lib/vesselTypes';
import { TIPE_LEGEND, WELDING, circularApplies, itemsRequired, materialTipe, MATERIAL_ITEMS } from '../../lib/materialRules';
import type { MatTipe } from '../../lib/materialRules';
import MaterialTracker from '../../components/newbuilding/materialTracker';
import StageTracker from '../../components/newbuilding/StageTracker';

type Project = {
  id: string;
  name: string;
  yard: string | null;
  hull_no: string | null;
  vessel_type: string | null;
  application_date: string | null;
  international: boolean;
  gt: number | null;
  notasi_l20: boolean;
  propelled: boolean | null;
  updated_at: string;
};

type Draft = {
  id: string | null;
  name: string;
  yard: string;
  hull_no: string;
  vessel_type: string;
  application_date: string;
  international: boolean;
  gt: string;
  notasi_l20: boolean;
  propelled: boolean | null; // null = otomatis dari jenis kapal
};

const EMPTY: Draft = { id: null, name: '', yard: '', hull_no: '', vessel_type: '', application_date: '', international: false, gt: '', notasi_l20: false, propelled: null };

const INPUT = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

const toNum = (s: string): number | null => {
  const n = Number(s.replace(',', '.').trim());
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

const effPropelled = (type: string | null, override: boolean | null) => (override !== null ? override : !isNonPropelled(type));

const tipeOf = (p: { vessel_type: string | null; propelled: boolean | null; international: boolean; gt: number | null; notasi_l20: boolean }): MatTipe | null =>
  materialTipe({ notasiL20: p.notasi_l20, propelled: effPropelled(p.vessel_type, p.propelled), international: p.international, gt: p.gt });

const fromProject = (p: Project): Draft => ({
  id: p.id,
  name: p.name,
  yard: p.yard ?? '',
  hull_no: p.hull_no ?? '',
  vessel_type: p.vessel_type ?? '',
  application_date: p.application_date ?? '',
  international: p.international,
  gt: p.gt == null ? '' : String(p.gt),
  notasi_l20: p.notasi_l20,
  propelled: p.propelled,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Hasil({ d }: { d: Draft }) {
  const gt = toNum(d.gt);
  const tipe = tipeOf({ vessel_type: d.vessel_type, propelled: d.propelled, international: d.international, gt, notasi_l20: d.notasi_l20 });
  const berlaku = !d.application_date || circularApplies(d.application_date);
  return (
    <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
      <p className="text-xs font-bold uppercase tracking-wide text-teal-800">Hasil penentuan (Circular 22-SV-185)</p>
      {!berlaku && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          Permohonan diterima sebelum 15 Des 2022: Circular 185 tidak berlaku. Rujuk Rules BKI dan koordinasikan dengan Divisi Survey.
        </p>
      )}
      {tipe === null ? (
        <p className="mt-2 text-xs">Isi GT untuk menentukan tipe material.</p>
      ) : (
        <>
          <p className="mt-2">
            Tipe material: <b className="text-lg">{tipe}</b>
          </p>
          <p className="text-xs">{TIPE_LEGEND[tipe]}</p>
          <ul className="mt-2 space-y-0.5 text-xs">
            <li>Welding shop approval: <b>{WELDING.weldingShop[tipe] ?? 'tidak disyaratkan'}</b></li>
            <li>WPS approval: <b>{WELDING.wps[tipe] ?? 'tidak disyaratkan'}</b></li>
            <li>Welder: <b>{WELDING.welder[tipe] ?? 'tidak disyaratkan'}</b></li>
            <li>Baris material/komponen yang disyaratkan: <b>{itemsRequired(tipe).length}</b> dari {MATERIAL_ITEMS.length}</li>
          </ul>
        </>
      )}
    </div>
  );
}

function Inner() {
  const { confirm } = useDialog();
  const [list, setList] = useState<Project[] | null>(null);
  const [err, setErr] = useState('');
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [matP, setMatP] = useState<Project | null>(null);
  const [stageP, setStageP] = useState<Project | null>(null);
  const [matFromStage, setMatFromStage] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setErr('');
    const { data, error } = await supabase.from('nb_projects').select('*').order('updated_at', { ascending: false });
    if (error) {
      setErr(error.message + (/relation|does not exist/i.test(error.message) ? ' (sudah menjalankan SQL nb_projects?)' : ''));
      setList([]);
      return;
    }
    setList((data ?? []) as Project[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));

  const save = async () => {
    if (!supabase || !d) return;
    if (!d.name.trim()) {
      setErr('Nama kapal/proyek wajib diisi.');
      return;
    }
    setBusy(true);
    setErr('');
    const payload = {
      name: d.name.trim(),
      yard: d.yard.trim() || null,
      hull_no: d.hull_no.trim() || null,
      vessel_type: d.vessel_type || null,
      application_date: d.application_date || null,
      international: d.international,
      gt: toNum(d.gt),
      notasi_l20: d.notasi_l20,
      propelled: d.propelled,
    };
    const r = d.id
      ? await supabase.from('nb_projects').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', d.id)
      : await supabase.from('nb_projects').insert(payload);
    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    setD(null);
    await load();
  };

  const remove = async (p: Project) => {
    if (!supabase) return;
    if (!(await confirm({ title: 'Hapus proyek?', message: `Hapus proyek "${p.name}"? Data proyek ini tidak bisa dikembalikan.`, confirmText: 'Hapus', tone: 'danger' }))) return;
    const r = await supabase.from('nb_projects').delete().eq('id', p.id);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    await load();
  };

  if (stageP)
    return (
      <StageTracker
        projectId={stageP.id}
        projectName={stageP.name}
        tipe={tipeOf(stageP)}
        propelled={effPropelled(stageP.vessel_type, stageP.propelled)}
        onBack={() => setStageP(null)}
        onOpenMaterial={() => {
          setMatP(stageP);
          setMatFromStage(true);
          setStageP(null);
        }}
      />
    );

  if (matP)
    return (
      <MaterialTracker
        projectId={matP.id}
        projectName={matP.name}
        tipe={tipeOf(matP)}
        vesselType={matP.vessel_type}
        propelled={effPropelled(matP.vessel_type, matP.propelled)}
        onBack={() => {
          if (matFromStage) setStageP(matP);
          setMatFromStage(false);
          setMatP(null);
        }}
      />
    );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">Class &amp; Technical</p>
      <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Penerimaan Klas Bangunan Baru</h1>
      <p className="mt-1 text-sm text-slate-600">Data induk proyek dan penentuan tipe material menurut Circular 22-SV-185.</p>

      {!supabase && <p className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">Mode demo: Supabase belum dikonfigurasi, proyek tidak bisa disimpan.</p>}
      {err && <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</p>}

      {supabase && !d && (
        <div className="mt-5">
          <Button variant="primary" onClick={() => setD({ ...EMPTY })}>
            + Proyek baru
          </Button>
        </div>
      )}

      {d && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">{d.id ? 'Ubah proyek' : 'Proyek baru'}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nama kapal / proyek *">
              <input className={INPUT} value={d.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Galangan">
              <input className={INPUT} value={d.yard} onChange={(e) => set('yard', e.target.value)} />
            </Field>
            <Field label="Nomor lambung">
              <input className={INPUT} value={d.hull_no} onChange={(e) => set('hull_no', e.target.value)} />
            </Field>
            <Field label="Tanggal permohonan klas">
              <DateInput className={INPUT} value={d.application_date} onChange={(v) => set('application_date', v)} />
            </Field>
          </div>

          <div className="mt-3">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Jenis kapal</span>
            <VesselTypeSelect
              className={INPUT}
              value={d.vessel_type}
              onChange={(v, info) => setD((x) => (x ? { ...x, vessel_type: v, propelled: info?.propelled ?? null } : x))}
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-600">Rute pelayaran</span>
              <div className="flex gap-2">
                <Chip selected={!d.international} onClick={() => set('international', false)}>Non-internasional</Chip>
                <Chip selected={d.international} onClick={() => set('international', true)}>Internasional</Chip>
              </div>
            </div>
            <Field label="Gross Tonnage (GT)">
              <input className={INPUT} inputMode="decimal" value={d.gt} onChange={(e) => set('gt', e.target.value)} placeholder="mis. 499" />
            </Field>
          </div>

          <div className="mt-4">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Penggerak</span>
            <div className="flex flex-wrap gap-2">
              <Chip selected={d.propelled === null} onClick={() => set('propelled', null)}>
                Otomatis ({effPropelled(d.vessel_type, null) ? 'ada' : 'tanpa'} penggerak)
              </Chip>
              <Chip selected={d.propelled === true} onClick={() => set('propelled', true)}>Ada penggerak</Chip>
              <Chip selected={d.propelled === false} onClick={() => set('propelled', false)}>Tanpa penggerak</Chip>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={d.notasi_l20} onChange={(e) => set('notasi_l20', e.target.checked)} />
            Notasi pelayanan dibatasi max L(20)
          </label>

          <Hasil d={d} />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={save} disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </Button>
            <Button
              onClick={() => {
                setD(null);
                setErr('');
              }}
            >
              Batal
            </Button>
          </div>
        </section>
      )}

      {supabase && !d && (
        <div className="mt-5 space-y-3">
          {list === null ? (
            <p className="text-sm text-slate-500">Memuat…</p>
          ) : list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada proyek.</p>
          ) : (
            list.map((p) => {
              const tipe = tipeOf(p);
              return (
                <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-600">
                        {[p.vessel_type, p.yard, p.hull_no ? `No. lambung ${p.hull_no}` : null].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">{tipe ? `Tipe ${tipe}` : 'Tipe ?'}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => setStageP(p)}>Tahapan</Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setMatFromStage(false);
                        setMatP(p);
                      }}
                    >
                      Material
                    </Button>
                    <Button size="sm" onClick={() => setD(fromProject(p))}>Ubah</Button>
                    <Button size="sm" variant="warn" onClick={() => remove(p)}>Hapus</Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}

export default function NewbuildingPage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}
