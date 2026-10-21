/**
 * Memorandum → file Word asli (.docx), format mengikuti contoh memo DILLAH SAMUDRA VIII:
 * Arial 11, spasi 1,5, rata kiri-kanan, nomor 1. / a., istilah asing dimiringkan.
 * Library "docx" dimuat hanya saat tombol Unduh ditekan (tidak memberatkan halaman).
 */
import { dateLong, memoIntro, memoSubject } from './memo';
import type { MemoCtx, MemoState, ResolvedSection } from './memo';

const DOTS = '……';

// Istilah asing yang dimiringkan (sama seperti memo contoh).
const ITALIC_TERMS = [
  'grating sea chest', 'sea chest', 'free gas', 'suspect', 'slipway', 'in-water survey', 'fouling', 'bilge keel', 'stern frame', 'rudder',
  'clearance', 'neck bearing', 'pintle bearing', 'small hatch', 'manhole', 'cofferdam', 'chain locker', 'void', 'engine room',
  'steering gear room', 'pressure test', 'air pipe head', 'forward', 'aft of', 'crankweb deflection', 'crankcase door', 'liner',
  'balancing test', 'sea valve', 'hydro test', 'overboard valve', 'emergency stop fan/blower', 'emergency stop F.O',
  'quick closing valve test F.O', 'fire detection', 'fire alarm', 'fire water hydrant', 'sea trial', 'renewal', 'crankshaft deflection', 'replating',
].sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const MARK = new RegExp('(0,5L)|\\b(' + ITALIC_TERMS.map(esc).join('|') + ')\\b', 'gi');

type Item = { text: string; sub: string[]; after: string[] };

/** Samakan dengan memo contoh: kalimat lanjutan tidak diberi nomor sendiri. */
function normalize(sec: ResolvedSection): Item[] {
  const out: Item[] = [];
  sec.items.forEach((it) => {
    if (out.length && it.text.indexOf('Perusahaan pelaksana pengukuran ketebalan') === 0) {
      out[out.length - 1].after.push(it.text);
      return;
    }
    const sub = it.sub.slice();
    const after: string[] = [];
    if (sub.length > 1 && sub[sub.length - 1].indexOf('Jika hasil pengukuran menunjukkan') === 0) {
      after.push(sub.pop() as string);
      sub[sub.length - 1] = sub[sub.length - 1].replace(/;$/, '.');
    }
    out.push({ text: it.text, sub, after });
  });
  return out;
}

export async function memoDocxBlob(c: MemoCtx, st: MemoState, secs: ResolvedSection[]): Promise<Blob> {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, TabStopType } = d;
  const J = AlignmentType.JUSTIFIED;
  const LS = { line: 360 };

  const runs = (text: string) => {
    const out: InstanceType<typeof TextRun>[] = [];
    let last = 0;
    MARK.lastIndex = 0;
    let m: RegExpExecArray | null = MARK.exec(text);
    while (m) {
      if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index) }));
      if (m[1]) out.push(new TextRun({ text: m[1], bold: true }));
      else out.push(new TextRun({ text: m[2], italics: true }));
      last = m.index + m[0].length;
      m = MARK.exec(text);
    }
    if (last < text.length) out.push(new TextRun({ text: text.slice(last) }));
    return out;
  };

  const numbering: {
    reference: string;
    levels: { level: number; format: (typeof LevelFormat)[keyof typeof LevelFormat]; text: string; alignment: (typeof AlignmentType)['LEFT']; style: { paragraph: { indent: { left: number; hanging: number } } } }[];
  }[] = [];
  const addList = (ref: string, letters: boolean) =>
    numbering.push({
      reference: ref,
      levels: [{
        level: 0,
        format: letters ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: letters ? { left: 1134, hanging: 425 } : { left: 709, hanging: 425 } } },
      }],
    });

  const kids: InstanceType<typeof Paragraph>[] = [];
  const P = (o: ConstructorParameters<typeof Paragraph>[0]) => kids.push(new Paragraph(o));

  // Judul
  P({ alignment: AlignmentType.CENTER, spacing: { after: 360, line: 240 }, children: [new TextRun({ text: 'MEMORANDUM', bold: true, underline: {}, size: 24 })] });

  // Kepada / Dari / Perihal
  const TAB = 1350;
  const hdr = (label: string, val: string) =>
    P({
      tabStops: [{ type: TabStopType.LEFT, position: TAB }],
      indent: { left: TAB, hanging: TAB },
      spacing: LS,
      children: [new TextRun(label), new TextRun({ text: '\t' }), new TextRun(': '), ...runs(val)],
    });
  hdr('Kepada Yth', `${st.to || DOTS}${st.cc ? `, Cq. ${st.cc}` : ''}`);
  hdr('Dari', st.from);
  hdr('Perihal', memoSubject(c));
  P({ spacing: { after: 120 }, children: [] });
  P({ alignment: J, spacing: LS, children: runs(memoIntro(c)) });

  let subN = 0;
  secs.forEach((s, si) => {
    const items = normalize(s);
    if (!items.length) return;
    const isDocs = s.title.indexOf('Dokumen') === 0;
    P({ spacing: { before: 200, ...LS }, keepNext: true, children: [new TextRun({ text: isDocs ? `${s.title} :` : s.title, bold: !isDocs })] });
    const ref = `main${si}`;
    addList(ref, false);
    items.forEach((it) => {
      P({ numbering: { reference: ref, level: 0 }, alignment: J, spacing: LS, keepNext: it.sub.length > 0, children: runs(it.text) });
      if (it.sub.length) {
        subN += 1;
        const sr = `sub${subN}`;
        addList(sr, true);
        it.sub.forEach((x) => P({ numbering: { reference: sr, level: 0 }, alignment: J, spacing: LS, children: runs(x) }));
      }
      it.after.forEach((x) => P({ indent: { left: 709 }, alignment: J, spacing: LS, children: runs(x) }));
    });
  });

  // Penutup
  P({ spacing: { before: 200, ...LS }, keepNext: true, children: [new TextRun({ text: 'Note :', bold: true })] });
  P({ alignment: J, spacing: LS, keepNext: true, children: runs('Sertifikat sementara akan diterbitkan setelah semua dokumen pendukung lengkap.') });
  P({ alignment: J, spacing: LS, keepNext: true, children: runs('Demikian disampaikan atas perhatian dan kerjasamanya diucapkan terimakasih.') });

  const SIG = 5954;
  P({ indent: { left: SIG }, spacing: { before: 360, ...LS }, keepNext: true, children: [new TextRun(`${st.place}, ${dateLong(st.date) || DOTS}`)] });
  P({ indent: { left: SIG }, spacing: LS, keepNext: true, children: [new TextRun(st.from)] });
  for (let i = 0; i < 3; i += 1) P({ indent: { left: SIG }, spacing: LS, keepNext: true, children: [] });
  P({ indent: { left: SIG }, spacing: LS, children: [new TextRun({ text: st.surveyor || DOTS, bold: true, underline: {} })] });

  const doc = new Document({
    creator: st.surveyor || 'Surveyor BKI',
    title: memoSubject(c),
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    numbering: { config: numbering },
    sections: [{
      properties: { page: { size: { width: 11909, height: 16834 }, margin: { top: 1530, right: 1134, bottom: 1134, left: 1134 } } },
      children: kids,
    }],
  });
  return Packer.toBlob(doc);
}
