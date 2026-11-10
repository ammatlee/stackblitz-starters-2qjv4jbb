import { drawingSummary } from './newbuildingDrawings';
import type { DrawingRowsLike, DrawingSummary } from './newbuildingDrawings';
import { firstOpenStage, overallProgress } from './newbuildingStages';
import type { Stage, StageProgress, StageRow } from './newbuildingStages';
import type { MatTipe } from './materialRules';

/** Ringkasan satu proyek untuk kartu di daftar proyek. */
export type ProjectOverview = {
  stage: StageProgress;
  /** Tahap pertama yang belum selesai; null bila semua tahap selesai. */
  current: Stage | null;
  /** null bila data gambar belum bisa dimuat (mis. SQL belum dijalankan). */
  drawing: DrawingSummary | null;
};

export type OverviewInput = {
  vesselType: string | null;
  propelled: boolean;
  tipe: MatTipe | null;
  fpAbove60: boolean | null;
  override: string | null;
};

export function projectOverview(i: OverviewInput, stageRows: Map<string, StageRow>, drawRows: DrawingRowsLike | null): ProjectOverview {
  const ctx = { tipe: i.tipe, propelled: i.propelled };
  return {
    stage: overallProgress(ctx, stageRows),
    current: firstOpenStage(ctx, stageRows),
    drawing: drawRows ? drawingSummary({ vesselType: i.vesselType, propelled: i.propelled, fpAbove60: i.fpAbove60, override: i.override }, drawRows) : null,
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
