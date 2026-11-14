'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import DrawingTracker from '../../components/newbuilding/DrawingTracker';
import TankTestTracker from '../../components/newbuilding/TankTestTracker';
import FindingTracker from '../../components/newbuilding/FindingTracker';
import DocTracker from '../../components/newbuilding/DocTracker';
import { openFindingsText } from '../../lib/newbuildingFindings';
import { fetchAllRows } from '../../lib/fetchAll';
import { removePhotoFiles } from '../../lib/photoUpload';
import { LIST_ROUTE, parseRoute, routeHref } from '../../lib/newbuildingRoute';
import type { NbRoute } from '../../lib/newbuildingRoute';
import { groupByProject, projectOverview } from '../../lib/newbuildingOverview';
import type { ProjectOverview } from '../../lib/newbuildingOverview';
import type { StageRow } from '../../lib/newbuildingStages';
import type { DocStatus } from '../../lib/newbuildingCertDocs';
import type { MatStatus } from '../../lib/materialTracker';
import { INPUT } from '../../components/newbuilding/fields';
import { updateWithVersion } from '../../lib/optimisticLock';
import type { LockClient } from '../../lib/optimisticLock';
import { PAGE_STEP, countArchived, filterProjects } from '../../lib/newbuildingListView';

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
  fp_above60?: boolean | null;
  drawing_col?: string | null;
  /** Ada permohonan load line; kosong bila kolomnya belum ada (SQL nb_doc_status belum dijalankan). */
  load_line?: boolean | null;
  /** Penanda edit bersamaan; kosong bila kolom version belum ada di database. */
  version?: number | null;
  /** Terisi bila proyek diarsipkan; kosong bila kolomnya belum ada atau proyek aktif. */
  archived_at?: string | null;
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
  load_line: boolean;
  /** true bila proyek yang dibuka sudah punya kolom load_line di database (kolom ikut disimpan). */
  load_line_col: boolean;
  /** version proyek saat formulir dibuka (untuk cek edit bersamaan); null = proyek baru atau kolom belum ada. */
  version: number | null;
};

const EMPTY: Draft = { id: null, name: '', yard: '', hull_no: '', vessel_type: '', application_date: '', international: false, gt: '', notasi_l20: false, propelled: null, load_line: false, load_line_col: false, version: null };

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
  load_line: !!p.load_line,
  load_line_col: typeof p.load_line === 'boolean',
  version: typeof p.version === 'number' ? p.version : null,
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

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Ringkasan progress di kartu proyek: tahap berjalan, progress tahapan, dan gambar closed. */
function Overview({ o }: { o: ProjectOverview | undefined }) {
  if (!o) return null;
  const d = o.drawing;
  return (
    <div className="mt-3 space-y-1.5 text-xs text-slate-600">
      <div className="flex items-center gap-3">
        <span className="w-16 shrink-0 font-semibold text-slate-500">Tahapan</span>
        <Bar pct={o.stage.pct} />
        <span className="w-20 shrink-0 text-right tabular-nums">{o.stage.selesai}/{o.stage.total} ({o.stage.pct}%)</span>
      </div>
      <p className="pl-[76px] text-slate-500">{o.current ? `Sekarang: ${o.current.code}. ${o.current.title}` : 'Semua tahap selesai'}</p>
      {d && d.col && (
        <div className="flex items-center gap-3">
          <span className="w-16 shrink-0 font-semibold text-slate-500">Gambar</span>
          <Bar pct={d.progress.pct} />
          <span className="w-20 shrink-0 text-right tabular-nums">{d.progress.closed}/{d.progress.total} ({d.progress.pct}%)</span>
        </div>
      )}
      {d && !d.col && (
        <p className="pl-[76px] text-amber-800">{d.needFlashPoint ? 'Gambar: flash point belum diisi' : 'Gambar: daftar belum ditentukan'}</p>
      )}
      {o.cert && (
        <>
          <div className="flex items-center gap-3">
            <span className="w-16 shrink-0 font-semibold text-slate-500">Dokumen</span>
            <Bar pct={o.cert.permanent.pct} />
            <span className="w-20 shrink-0 text-right tabular-nums">{o.cert.permanent.done}/{o.cert.permanent.total} ({o.cert.permanent.pct}%)</span>
          </div>
          <p className={`pl-[76px] ${o.cert.interim.missing.length > 0 ? 'text-amber-800' : 'text-teal-800'}`}>
            {o.cert.interim.missing.length > 0 ? `Interim: kurang ${o.cert.interim.missing.length} dari ${o.cert.interim.total} dokumen` : 'Dokumen Interim lengkap'}
            {o.cert.permanent.missing.length > 0 ? ` · Permanent kurang ${o.cert.permanent.missing.length}` : ' · Permanent lengkap'}
          </p>
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
  // layar yang dibuka disimpan di URL (?p=<id proyek>&v=<layar>), bukan di state
  const router = useRouter();
  const params = useSearchParams();
  const route = useMemo(() => parseRoute(params.toString()), [params]);
  const go = (r: NbRoute) => router.push(routeHref(r));
  const [openFind, setOpenFind] = useState<Map<string, number>>(new Map());
  const [ov, setOv] = useState<Map<string, ProjectOverview>>(new Map());
  // daftar proyek: kata kunci, tab Aktif/Arsip, dan jumlah kartu yang ditampilkan
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [limit, setLimit] = useState(PAGE_STEP);

  const load = useCallback(async () => {
    if (!supabase) return;
    const sb = supabase;
    setErr('');
    // empat bacaan berjalan bersamaan. Hanya baris yang mengubah angka yang dibaca:
    // tahapan yang belum dikerjakan dan gambar yang masih Open tidak perlu dibaca (tanpa baris = Belum / Open).
    const [pr, fd, st, dr, dc, mt] = await Promise.all([
      sb.from('nb_projects').select('*').order('updated_at', { ascending: false }),
      // pengingat temuan Open per proyek
      fetchAllRows((a, b) => sb.from('nb_findings').select('id,project_id').eq('status', 'open').order('id').range(a, b)),
      fetchAllRows((a, b) => sb.from('nb_stage_status').select('project_id,item_key,status').neq('status', 'belum').order('project_id').order('item_key').range(a, b)),
      fetchAllRows((a, b) => sb.from('nb_drawing_status').select('project_id,item_key,status').neq('status', 'open').order('project_id').order('item_key').range(a, b)),
      // dokumen sertifikasi dan material: hanya baris yang sudah diisi (tanpa baris = Belum)
      fetchAllRows((a, b) => sb.from('nb_doc_status').select('project_id,item_key,status').neq('status', 'belum').order('project_id').order('item_key').range(a, b)),
      fetchAllRows((a, b) => sb.from('nb_material_status').select('project_id,item_key,status').neq('status', 'belum').order('project_id').order('item_key').range(a, b)),
    ]);
    if (pr.error) {
      setErr(pr.error.message + (/relation|does not exist/i.test(pr.error.message) ? ' (sudah menjalankan SQL nb_projects?)' : ''));
      setList([]);
      return;
    }
    const projects = (pr.data ?? []) as Project[];
    setList(projects);

    // bila tabelnya belum ada, kartu tampil tanpa pengingat
    if (!fd.error) {
      const counts = new Map<string, number>();
      for (const r of fd.data as { project_id: string }[]) counts.set(r.project_id, (counts.get(r.project_id) ?? 0) + 1);
      setOpenFind(counts);
    }

    // ringkasan progress per proyek; bila tabelnya belum ada, kartu tampil tanpa ringkasan
    if (st.error) return;
    const stageBy = groupByProject(st.data as { project_id: string; item_key: string; status: StageRow['status'] }[]);
    const drawBy = dr.error ? null : groupByProject(dr.data as { project_id: string; item_key: string; status: 'open' | 'closed' | 'tidak_ada' }[]);
    // bila tabel dokumen belum ada, kartu tampil tanpa ringkasan dokumen
    const docBy = dc.error ? null : groupByProject(dc.data as { project_id: string; item_key: string; status: DocStatus }[]);
    const matBy = mt.error ? null : groupByProject(mt.data as { project_id: string; item_key: string; status: MatStatus }[]);
    const next = new Map<string, ProjectOverview>();
    for (const p of projects) {
      const stageRows = new Map<string, StageRow>();
      stageBy.get(p.id)?.forEach((r, k) => stageRows.set(k, { item_key: r.item_key, status: r.status, done_date: null, note: null }));
      next.set(
        p.id,
        projectOverview(
          { vesselType: p.vessel_type, propelled: effPropelled(p.vessel_type, p.propelled), tipe: tipeOf(p), fpAbove60: p.fp_above60 ?? null, override: p.drawing_col ?? null, loadLine: !!p.load_line },
          stageRows,
          drawBy ? drawBy.get(p.id) ?? new Map() : null,
          { docRows: docBy ? docBy.get(p.id) ?? new Map() : null, matRows: matBy ? matBy.get(p.id) ?? new Map() : null },
        ),
      );
    }
    setOv(next);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // kembali ke daftar proyek: muat ulang supaya progres di kartu mengikuti pekerjaan tadi
  const lastProject = useRef<string | null>(route.projectId);
  useEffect(() => {
    if (lastProject.current && !route.projectId) load();
    lastProject.current = route.projectId;
  }, [route.projectId, load]);

  const project = route.projectId && list ? list.find((x) => x.id === route.projectId) ?? null : null;
  const missing = !!route.projectId && list !== null && !project;
  // proyek di alamat tidak ada (sudah dihapus atau alamat salah): bersihkan alamat
  useEffect(() => {
    if (missing) router.replace(routeHref(LIST_ROUTE));
  }, [missing, router]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => (x ? { ...x, [k]: v } : x));

  const counts = useMemo(() => countArchived(list ?? []), [list]);
  const filtered = useMemo(() => filterProjects(list ?? [], q, showArchived), [list, q, showArchived]);

  /** Mengubah satu proyek. Bila kolom version ada, simpan hanya bila proyek belum diubah orang lain sejak dibuka. */
  const patchProject = async (id: string, version: number | null | undefined, values: Record<string, unknown>): Promise<{ error: string; conflict: boolean }> => {
    if (!supabase) return { error: 'Supabase belum dikonfigurasi.', conflict: false };
    const v = { ...values, updated_at: new Date().toISOString() };
    if (typeof version === 'number') {
      const r = await updateWithVersion(supabase as unknown as LockClient, 'nb_projects', id, version, v);
      return r.status === 'ok' ? { error: '', conflict: false } : { error: r.message, conflict: r.status === 'conflict' };
    }
    const r = await supabase.from('nb_projects').update(v).eq('id', id);
    return { error: r.error ? r.error.message : '', conflict: false };
  };

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
      // kolom load_line baru ada setelah SQL nb_doc_status dijalankan: ikut disimpan hanya bila sudah ada atau sedang dicentang
      ...(d.load_line_col || d.load_line ? { load_line: d.load_line } : {}),
    };
    let msg = '';
    let conflict = false;
    if (d.id) {
      const r = await patchProject(d.id, d.version, payload);
      msg = r.error;
      conflict = r.conflict;
    } else {
      const r = await supabase.from('nb_projects').insert(payload);
      msg = r.error ? r.error.message : '';
    }
    setBusy(false);
    if (msg) {
      if (conflict) {
        // proyek sudah diubah orang lain: tutup formulir, muat data terbaru, lalu tampilkan pesannya
        setD(null);
        await load();
      }
      setErr(msg + (/load_line/i.test(msg) ? ' (sudah menjalankan SQL nb_doc_status?)' : ''));
      return;
    }
    setD(null);
    await load();
  };

  const setArchived = async (p: Project, archived: boolean) => {
    if (archived && !(await confirm({ title: 'Arsipkan proyek?', message: `Proyek "${p.name}" disembunyikan dari daftar aktif. Datanya tetap tersimpan dan bisa dipulihkan dari tab Arsip.`, confirmText: 'Arsipkan' }))) return;
    setErr('');
    const r = await patchProject(p.id, p.version, { archived_at: archived ? new Date().toISOString() : null });
    if (r.error) {
      setErr(r.error + (/archived_at|column/i.test(r.error) ? ' (sudah menjalankan SQL arsip proyek?)' : ''));
      if (r.conflict) await load();
      return;
    }
    await load();
  };

  const remove = async (p: Project) => {
    if (!supabase) return;
    if (!(await confirm({ title: 'Hapus permanen?', message: `Hapus permanen proyek "${p.name}" beserta semua tahapan, gambar, material, dokumen sertifikasi, uji tangki, temuan, dan fotonya? Tidak bisa dikembalikan. Unduh cadangan dulu bila ragu.`, confirmText: 'Hapus permanen', tone: 'danger' }))) return;
    // jalur foto dicatat dulu: barisnya ikut terhapus bersama proyek, berkasnya dihapus sesudahnya
    const pp = await fetchAllRows((a, b) => supabase!.from('nb_finding_photos').select('path').eq('project_id', p.id).order('path').range(a, b));
    if (pp.error) {
      setErr(pp.error.message);
      return;
    }
    const r = await supabase.from('nb_projects').delete().eq('id', p.id);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    await removePhotoFiles((pp.data as { path: string }[]).map((x) => x.path));
    await load();
  };

  if (route.projectId && supabase && list === null) return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Memuat…</main>;

  if (project && route.view === 'drawing')
    return (
      <DrawingTracker
        projectId={project.id}
        projectName={project.name}
        vesselType={project.vessel_type}
        propelled={effPropelled(project.vessel_type, project.propelled)}
        onBack={() => go({ projectId: project.id, view: 'stage' })}
      />
    );

  if (project && route.view === 'finding')
    return <FindingTracker projectId={project.id} projectName={project.name} onBack={() => go({ projectId: project.id, view: 'stage' })} />;

  if (project && route.view === 'tank')
    return (
      <TankTestTracker
        projectId={project.id}
        projectName={project.name}
        vesselType={project.vessel_type}
        propelled={effPropelled(project.vessel_type, project.propelled)}
        onBack={() => go({ projectId: project.id, view: 'stage' })}
      />
    );

  if (project && route.view === 'stage')
    return (
      <StageTracker
        projectId={project.id}
        projectName={project.name}
        tipe={tipeOf(project)}
        propelled={effPropelled(project.vessel_type, project.propelled)}
        international={project.international}
        gt={project.gt}
        vesselType={project.vessel_type}
        loadLine={!!project.load_line}
        onBack={() => go(LIST_ROUTE)}
        onOpenMaterial={() => go({ projectId: project.id, view: 'material', fromStage: true })}
        onOpenDrawing={() => go({ projectId: project.id, view: 'drawing' })}
        onOpenTankTests={() => go({ projectId: project.id, view: 'tank' })}
        onOpenFindings={() => go({ projectId: project.id, view: 'finding' })}
        onOpenDocs={() => go({ projectId: project.id, view: 'docs' })}
      />
    );

  if (project && route.view === 'docs')
    return (
      <DocTracker
        projectId={project.id}
        projectName={project.name}
        vesselType={project.vessel_type}
        propelled={effPropelled(project.vessel_type, project.propelled)}
        tipe={tipeOf(project)}
        loadLine={!!project.load_line}
        onBack={() => go({ projectId: project.id, view: 'stage' })}
        onOpenMaterial={() => go({ projectId: project.id, view: 'material', fromDocs: true })}
        onSetLoadLine={async (v) => {
          const r = await patchProject(project.id, project.version, { load_line: v });
          if (r.error) {
            if (r.conflict) await load();
            return r.error + (/load_line|column/i.test(r.error) ? ' (sudah menjalankan SQL nb_doc_status?)' : '');
          }
          await load();
          return '';
        }}
      />
    );

  if (project && route.view === 'material')
    return (
      <MaterialTracker
        projectId={project.id}
        projectName={project.name}
        tipe={tipeOf(project)}
        vesselType={project.vessel_type}
        propelled={effPropelled(project.vessel_type, project.propelled)}
        onBack={() => go(route.fromStage ? { projectId: project.id, view: 'stage' } : route.fromDocs ? { projectId: project.id, view: 'docs' } : LIST_ROUTE)}
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

          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={d.load_line} onChange={(e) => set('load_line', e.target.checked)} />
            Ada permohonan load line (mewajibkan form F23 dan BA tanda garis muat)
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

      {supabase && !d && list !== null && list.length > 0 && (
        <div className="mt-4 space-y-2">
          <input
            className={INPUT}
            placeholder="Cari nama, galangan, no. lambung, jenis kapal"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE_STEP);
            }}
          />
          {(counts.arsip > 0 || showArchived) && (
            <div className="flex gap-2">
              <Chip
                selected={!showArchived}
                onClick={() => {
                  setShowArchived(false);
                  setLimit(PAGE_STEP);
                }}
              >
                Aktif ({counts.aktif})
              </Chip>
              <Chip
                selected={showArchived}
                onClick={() => {
                  setShowArchived(true);
                  setLimit(PAGE_STEP);
                }}
              >
                Arsip ({counts.arsip})
              </Chip>
            </div>
          )}
        </div>
      )}

      {supabase && !d && (
        <div className="mt-5 space-y-3">
          {list === null ? (
            <p className="text-sm text-slate-500">Memuat…</p>
          ) : list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada proyek.</p>
          ) : filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
              {q.trim() ? 'Tidak ada proyek yang cocok dengan pencarian.' : showArchived ? 'Belum ada proyek di arsip.' : 'Semua proyek ada di arsip.'}
            </p>
          ) : (
            filtered.slice(0, limit).map((p) => {
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
                  <Overview o={ov.get(p.id)} />
                  {(openFind.get(p.id) ?? 0) > 0 && <p className="mt-2 text-xs font-semibold text-amber-800">{openFindingsText(openFind.get(p.id) ?? 0)}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => go({ projectId: p.id, view: 'stage' })}>Tahapan</Button>
                    <Button size="sm" onClick={() => go({ projectId: p.id, view: 'docs' })}>Dokumen</Button>
                    {p.archived_at ? (
                      <>
                        <Button size="sm" onClick={() => setArchived(p, false)}>Pulihkan</Button>
                        <Button size="sm" variant="warn" onClick={() => remove(p)}>Hapus permanen</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => go({ projectId: p.id, view: 'material' })}>Material</Button>
                        <Button size="sm" onClick={() => setD(fromProject(p))}>Ubah</Button>
                        <Button size="sm" onClick={() => setArchived(p, true)}>Arsipkan</Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {list !== null && filtered.length > limit && (
            <div className="text-center">
              <Button size="sm" onClick={() => setLimit((n) => n + PAGE_STEP)}>
                Tampilkan lagi ({filtered.length - limit} proyek)
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function NewbuildingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<main className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-500">Memuat…</main>}>
        <Inner />
      </Suspense>
    </RequireAuth>
  );
}
