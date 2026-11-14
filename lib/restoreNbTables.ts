/** Daftar tabel Bangunan Baru yang ikut cadangan dan pemulihan. Urutan = urutan pemulihan (induk dulu, anak kemudian). */
export const NB_TABLES = [
  'nb_projects',
  'nb_stage_status',
  'nb_drawing_status',
  'nb_material_status',
  'nb_tank_tests',
  'nb_findings',
  'nb_finding_photos',
] as const;
export type NbTable = (typeof NB_TABLES)[number];

export const NB_LABEL: Record<NbTable, string> = {
  nb_projects: 'proyek bangunan baru',
  nb_stage_status: 'status tahapan',
  nb_drawing_status: 'status gambar',
  nb_material_status: 'status material',
  nb_tank_tests: 'uji tangki',
  nb_findings: 'temuan',
  nb_finding_photos: 'data foto temuan',
};
