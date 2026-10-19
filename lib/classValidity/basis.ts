/* Dasar aturan: ITS Part A (bersumber dari Rules) dan Nota Dinas BKI No. 87/SVY/III/2020 (18 Maret 2020). */
export const BASIS: Record<string, { title: string; its: string; nd: string }> = {
    'renewal-status': {
      title: 'Status kelas bila Renewal terlambat',
      its: 'Rules Vol I Sec. 2.B.2.2.1: Class otomatis SUSPENDED bila Renewal belum selesai pada due date atau expiry extension. Rules Sec. 2.B.4.5: Class di-WITHDRAWN bila suspended selama 6 bulan (suspension lebih lama dapat diberikan untuk kapal lay-up atau menunggu disposisi casualty).',
      nd: 'Poin 4: melewati expiry tetapi masih dalam 6 bulan = SUSPEND; lebih dari 6 bulan sejak expiry = WITHDRAWN. Dengan extension (maks. 3 bulan): VALID sampai extension berakhir, SUSPEND pada 3 bulan berikutnya, WITHDRAWN setelah 6 bulan.',
    },
    'renewal-window': {
      title: 'Periode sertifikat baru — Renewal dimulai sebelum expiry',
      its: 'Sec. 3.B.1.3.4: dimulai sebelum expiry atau dalam extension window dan selesai setelah expiry → periode lama berlaku (periode kelas dimulai dari expiry sertifikat sebelumnya). Selesai dalam window Annual ke-1 → Annual ke-1 ditiadakan, biaya survei tetap dikenakan.',
      nd: 'Poin 8: hal di luar Nota Dinas mengikuti Rules Vol I, ITS Part A, dan Circular yang berlaku.',
    },
    'renewal-suspend': {
      title: 'Renewal dimulai dan selesai pada masa SUSPEND',
      its: 'Sec. 3.B.1.3.3: bila Renewal selesai setelah expiry, sertifikat baru berlaku dari completion sampai paling lama 5 tahun sejak expiry sertifikat lama. (Sec. 3.B.1.3.5 "reclass" dipahami BKI sebagai kondisi WITHDRAWN, lihat Nota Dinas.)',
      nd: 'Poin 5a: dimulai dan completion pada masa suspend → lingkup Survey Pembaruan Kelas; masa berlaku sertifikat permanen dihitung dari masa berlaku sertifikat sebelumnya.',
    },
    'renewal-withdrawn': {
      title: 'Renewal pada kondisi WITHDRAWN',
      its: 'Sec. 3.B.1.3.5: survei dimulai setelah expiry (reclass) → periode kelas baru dimulai dari tanggal completion, lingkup berdasarkan umur kapal. Sec. 2.B.4.2 butir 4: scope re-classification = Renewal Survey + Bottom Survey.',
      nd: 'Poin 5b–5c: dimulai dan selesai pada status withdrawn, atau dimulai pada status valid/suspend tetapi completion saat withdrawn → Survey Penerimaan Kelas Kembali; masa berlaku sertifikat permanen dimulai dari tanggal completion (new period).',
    },
    'case-A': {
      title: 'Case A — Annual / Intermediate overdue',
      its: 'Sec. 2.B.4.2 butir 1: satu Annual overdue → scope re-classification = Intermediate Survey; bila Bottom Survey juga jatuh tempo, dilaksanakan bersamaan.',
      nd: 'Poin 3: suspended 6 bulan karena Annual/Intermediate/Special/survei lain overdue → kelas di-withdraw. Poin 2: setelah repair dan survey re-admission, kelas dapat diberikan kembali dengan periode baru.',
    },
    'case-B': {
      title: 'Case B — Recommendation overdue',
      its: 'Sec. 2.B.4.2: seluruh recommendation diselesaikan tuntas sebelum kapal berangkat; endorse "Visa no.1 dealt with" dan "Class reassigned and confirmed".',
      nd: 'Poin 3: recommendation yang overdue hingga suspended 6 bulan → kelas di-withdraw; poin 2: kelas dapat diberikan kembali setelah repair dan survey re-admission.',
    },
    'case-C': {
      title: 'Case C — Dua Annual + Intermediate terlewat',
      its: 'Sec. 2.B.4.2: scope re-classification = Renewal Survey + Bottom Survey (dry dock); terbitkan interim certificate dan tetapkan periode kelas baru.',
      nd: 'Poin 2 dan 5b–5c: Survey Penerimaan Kelas Kembali; masa berlaku sertifikat permanen dimulai dari tanggal completion (new period).',
    },
    'case-D': {
      title: 'Case D — Class Renewal overdue',
      its: 'Sec. 2.B.4.2 butir 4: scope re-classification = Renewal Survey + Bottom Survey dengan lingkup sesuai umur kapal.',
      nd: 'Poin 4b dan 5b–5c: lebih dari 6 bulan setelah expiry = WITHDRAWN; Survey Penerimaan Kelas Kembali dengan periode baru dari tanggal completion.',
    },
    'annual-advance': {
      title: 'Annual dikerjakan lebih awal (Annual in advance)',
      its: 'Sec. 3.B.1.1.3: anniversary baru = 3 bulan setelah tanggal completion dan dicatat lewat endorsement sertifikat; Annual berikutnya mengikuti interval anniversary baru. Intermediate: Sec. 3.B.1.2.3.',
      nd: 'Tidak diatur dalam Nota Dinas; ikuti ITS Part A (poin 8).',
    },
  };
  