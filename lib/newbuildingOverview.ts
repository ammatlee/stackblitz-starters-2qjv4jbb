import { drawingSummary } from './newbuildingDrawings';
import type { DrawingRowsLike, DrawingSummary } from './newbuildingDrawings';
import { firstOpenStage, overallProgress } from './newbuildingStages';
import type { Stage, StageProgress, StageRow } from './newbuildingStages';
import type { MatTipe } from './materialRules';
import type { MatStatus } from './materialTracker';
import { summarizeCert } from './newbuildingCertDocs';
import type { CertSummary, DocStatus } from './newbuildingCertDocs';

/** Ringkasan satu proyek untuk kartu di daftar proyek. */
export type ProjectOverview = {
  stage: StageProgress;
  /** Tahap pertama yang belum selesai; null bila semua tahap selesai. */
  current: Stage | null;
  /** null bila data gambar belum bisa dimuat (mis. SQL belum dijalankan). */
  drawing: DrawingSummary | null;
  /** Kelengkapan dokumen Interim dan Permanent; null bila data dokumen belum bisa dimuat (mis. SQL nb_doc_status belum dijalankan). */
  cert: CertSummary | null;
};

export type OverviewInput = {
  vesselType: string | null;
  propelled: boolean;
  tipe: MatTipe | null;
  fpAbove60: boolean | null;
  override: string | null;
  /** Ada permohonan load line. */
  loadLine?: boolean;
};

/** Baris dokumen dan material satu proyek. null = tabelnya belum bisa dibaca. */
export type CertRows = {
  docRows: Map<string, { status: DocStatus }> | null;
  matRows: Map<string, { status: MatStatus }> | null;
};

export function projectOverview(i: OverviewInput, stageRows: Map<string, StageRow>, drawRows: DrawingRowsLike | null, certRows: CertRows | null = null): ProjectOverview {
  const ctx = { tipe: i.tipe, propelled: i.propelled };
  return {
    stage: overallProgress(ctx, stageRows),
    current: firstOpenStage(ctx, stageRows),
    drawing: drawRows ? drawingSummary({ vesselType: i.vesselType, propelled: i.propelled, fpAbove60: i.fpAbove60, override: i.override }, drawRows) : null,
    cert:
      certRows && certRows.docRows
        ? summarizeCert(
            { vesselType: i.vesselType, propelled: i.propelled, loadLine: !!i.loadLine, tipe: i.tipe },
            { docRows: certRows.docRows, matRows: certRows.matRows, interimDone: stageRows.get('certificate.interim')?.status === 'selesai' },
          )
        : null,
  };
}

/** Mengelompokkan baris hasil query semua proyek menjadi peta per project_id. */
export function groupByProject<T extends { project_id: string; item_key: string }>(rows: T[]): Map<string, Map<string, T>> {
  const out = new Map<string, Map<string, T>>();
  for (const r of rows) {
    let m = out.get(r.project_id);
    if (!m) {
      m = new Map();
      out.set(r.project_id, m);
    }
    m.set(r.item_key, r);
  }
  return out;
}
