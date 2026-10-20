// Membaca file Word (.docx) langsung di peramban dan mengubahnya menjadi HTML untuk editor Bulletin:
// paragraf, judul, tebal/miring/garis bawah, link, daftar bernomor/bullet, tabel (sel gabungan), dan gambar.
// Gambar diunggah lewat fungsi saveImage (ke Supabase Storage), sehingga tidak bergantung pada salin-tempel.
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

/* ---------- membaca ZIP (docx adalah file ZIP) ---------- */
type ZipEntry = { method: number; csize: number; offset: number };

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(buf: ArrayBuffer): Promise<(name: string) => Promise<Uint8Array | null>> {
  if (typeof DecompressionStream === 'undefined') throw new Error('Peramban ini belum bisa membaca file Word. Perbarui Chrome atau Safari.');
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Ini bukan file Word (.docx) yang valid.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');
  const entries: Record<string, ZipEntry> = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    entries[dec.decode(u8.subarray(p + 46, p + 46 + nameLen))] = { method, csize, offset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return async (name: string) => {
    const e = entries[name];
    if (!e) return null;
    const nameLen = dv.getUint16(e.offset + 26, true);
    const extraLen = dv.getUint16(e.offset + 28, true);
    const start = e.offset + 30 + nameLen + extraLen;
    const raw = u8.subarray(start, start + e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return inflateRaw(raw);
    throw new Error('Cara kompresi file Word tidak didukung.');
  };
}

/* ---------- bantuan XML ---------- */
const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.localName === name);
const kid = (el: Element | null | undefined, name: string) => (el ? kids(el, name)[0] : undefined);
const wAttr = (el: Element | null | undefined, name: string) => (el ? el.getAttributeNS(NS_W, name) : null);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const on = (el: Element | undefined) => !!el && !/^(0|false|off)$/i.test(wAttr(el, 'val') || '');

async function readXml(get: (n: string) => Promise<Uint8Array | null>, name: string): Promise<Document | null> {
  const b = await get(name);
  if (!b) return null;
  return new DOMParser().parseFromString(new TextDecoder('utf-8').decode(b), 'application/xml');
}

const IMG_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

/* ---------- daftar bertingkat ---------- */
type LI = { lvl: number; ordered: boolean; html: string };
function renderList(items: LI[]): string {
  let out = '';
  const stack: { lvl: number; tag: string }[] = [];
  const closeTo = (lvl: number) => {
    while (stack.length && stack[stack.length - 1].lvl > lvl) out += '</li></' + stack.pop()!.tag + '>';
  };
  items.forEach((it) => {
    const tag = it.ordered ? 'ol' : 'ul';
    closeTo(it.lvl);
    const top = stack[stack.length - 1];
    if (top && top.lvl === it.lvl) {
      if (top.tag !== tag) {
        out += '</li></' + top.tag + '><' + tag + '><li>';
        stack[stack.length - 1] = { lvl: it.lvl, tag };
      } else out += '</li><li>';
    } else {
      out += '<' + tag + '><li>';
      stack.push({ lvl: it.lvl, tag });
    }
    out += it.html;
  });
  closeTo(-1);
  return out;
}

export type DocxResult = { html: string; images: number; skipped: number };

export async function docxToHtml(file: File, saveImage: (f: File) => Promise<string>): Promise<DocxResult> {
  const get = await readZip(await file.arrayBuffer());
  const docXml = await readXml(get, 'word/document.xml');
  if (!docXml) throw new Error('Isi dokumen tidak ditemukan. Pastikan file berformat .docx.');
  const relsXml = await readXml(get, 'word/_rels/document.xml.rels');
  const stylesXml = await readXml(get, 'word/styles.xml');
  const numXml = await readXml(get, 'word/numbering.xml');

  // hubungan (gambar, link)
  const rels: Record<string, { target: string; external: boolean }> = {};
  if (relsXml) {
    Array.from(relsXml.getElementsByTagName('Relationship')).forEach((r) => {
      rels[r.getAttribute('Id') || ''] = { target: r.getAttribute('Target') || '', external: r.getAttribute('TargetMode') === 'External' };
    });
  }

  // gaya: judul dan daftar yang menempel pada gaya
  const styles: Record<string, { name: string; numId?: string; ilvl?: string }> = {};
  if (stylesXml) {
    Array.from(stylesXml.getElementsByTagNameNS(NS_W, 'style')).forEach((s) => {
      const id = wAttr(s, 'styleId') || '';
      const np = kid(kid(s, 'pPr'), 'numPr');
      styles[id] = {
        name: (wAttr(kid(s, 'name'), 'val') || '').toLowerCase(),
        numId: np ? wAttr(kid(np, 'numId'), 'val') || undefined : undefined,
        ilvl: np ? wAttr(kid(np, 'ilvl'), 'val') || undefined : undefined,
      };
    });
  }

  // penomoran: bullet atau angka
  const abstractFmt: Record<string, Record<string, string>> = {};
  const numToAbs: Record<string, string> = {};
  if (numXml) {
    Array.from(numXml.getElementsByTagNameNS(NS_W, 'abstractNum')).forEach((a) => {
      const id = wAttr(a, 'abstractNumId') || '';
      abstractFmt[id] = {};
      kids(a, 'lvl').forEach((l) => {
        abstractFmt[id][wAttr(l, 'ilvl') || '0'] = wAttr(kid(l, 'numFmt'), 'val') || 'decimal';
      });
    });
    Array.from(numXml.getElementsByTagNameNS(NS_W, 'num')).forEach((n) => {
      numToAbs[wAttr(n, 'numId') || ''] = wAttr(kid(n, 'abstractNumId'), 'val') || '';
    });
  }
  const isOrdered = (numId: string, ilvl: string) => {
    const f = (abstractFmt[numToAbs[numId]] || {})[ilvl] || 'bullet';
    return f !== 'bullet' && f !== 'none';
  };

  const embeds: string[] = [];

  /* ---- isi paragraf ---- */
  const runHtml = (r: Element): string => {
    const pr = kid(r, 'rPr');
    let text = '';
    Array.from(r.children).forEach((c) => {
      const n = c.localName;
      if (n === 't') text += esc(c.textContent || '');
      else if (n === 'tab') text += ' ';
      else if (n === 'noBreakHyphen') text += '-';
      else if (n === 'br') {
        if (wAttr(c, 'type') !== 'page') text += '<br>';
      } else if (n === 'drawing') {
        const blip = c.getElementsByTagNameNS(NS_A, 'blip')[0];
        const rid = blip ? blip.getAttributeNS(NS_R, 'embed') : '';
        if (rid) embeds.push(rid);
      }
    });
    if (!text.replace(/<br>/g, '').trim()) return text;
    if (on(kid(pr, 'b'))) text = '<strong>' + text + '</strong>';
    if (on(kid(pr, 'i'))) text = '<em>' + text + '</em>';
    const u = kid(pr, 'u');
    if (u && wAttr(u, 'val') !== 'none') text = '<u>' + text + '</u>';
    return text;
  };
  const inlineHtml = (el: Element): string => {
    let out = '';
    Array.from(el.children).forEach((c) => {
      const n = c.localName;
      if (n === 'r') out += runHtml(c);
      else if (n === 'hyperlink') {
        const inner = inlineHtml(c);
        const rel = rels[c.getAttributeNS(NS_R, 'id') || ''];
        out += rel && rel.external && /^(https?:|mailto:)/i.test(rel.target) ? '<a href="' + rel.target.replace(/"/g, '%22') + '">' + inner + '</a>' : inner;
      } else if (n === 'ins' || n === 'smartTag' || n === 'sdt' || n === 'fldSimple') out += inlineHtml(n === 'sdt' ? kid(c, 'sdtContent') || c : c);
    });
    return out;
  };

  const paragraph = (p: Element) => {
    const ppr = kid(p, 'pPr');
    const styleId = wAttr(kid(ppr, 'pStyle'), 'val') || '';
    const st = styles[styleId];
    const np = kid(ppr, 'numPr');
    const numId = (np ? wAttr(kid(np, 'numId'), 'val') : null) || (st && st.numId) || '';
    const ilvl = (np ? wAttr(kid(np, 'ilvl'), 'val') : null) || (st && st.ilvl) || '0';
    const before = embeds.length;
    const text = inlineHtml(p);
    const imgs = embeds.slice(before).map((rid) => '<img src="docx-img:' + rid + '">');
    const name = st ? st.name : '';
    let tag = 'p';
    if (/^(title|heading 1)$/.test(name)) tag = 'h2';
    else if (/^heading [2-9]$/.test(name)) tag = 'h3';
    const empty = !text.replace(/<br>/g, '').trim();
    const html = (empty ? '' : '<' + tag + '>' + text + '</' + tag + '>') + imgs.join('');
    return { html, empty: empty && imgs.length === 0, list: numId && numId !== '0' && tag === 'p' ? { numId, lvl: Number(ilvl) || 0 } : null, text, imgs };
  };

  /* ---- tabel ---- */
  const cellBold = (tc: Element) => {
    const rs = Array.from(tc.getElementsByTagNameNS(NS_W, 'r')).filter((r) => (r.textContent || '').trim());
    return rs.length > 0 && rs.every((r) => on(kid(kid(r, 'rPr'), 'b')));
  };
  const table = (tbl: Element): string => {
    type Cell = { tc: Element; col: number; span: number; rows: number };
    const grid: Cell[][] = [];
    const open: Record<number, Cell> = {};
    kids(tbl, 'tr').forEach((tr, ri) => {
      grid[ri] = [];
      let col = 0;
      kids(tr, 'tc').forEach((tc) => {
        const tcPr = kid(tc, 'tcPr');
        const span = Number(wAttr(kid(tcPr, 'gridSpan'), 'val')) || 1;
        const vm = kid(tcPr, 'vMerge');
        if (vm && wAttr(vm, 'val') !== 'restart' && open[col]) {
          open[col].rows++;
        } else {
          const cell = { tc, col, span, rows: 1 };
          grid[ri].push(cell);
          if (vm) open[col] = cell;
          else delete open[col];
        }
        col += span;
      });
    });
    const head = grid[0] && grid[0].length > 0 && (kid(kid(kids(tbl, 'tr')[0], 'trPr'), 'tblHeader') !== undefined || grid[0].every((c) => cellBold(c.tc)));
    const rowsHtml = grid
      .map((row, ri) => {
        const tag = ri === 0 && head ? 'th' : 'td';
        const tds = row
          .map((c) => {
            const inner = blocks(c.tc) || '<p></p>';
            return '<' + tag + (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rows > 1 ? ' rowspan="' + c.rows + '"' : '') + '>' + inner + '</' + tag + '>';
          })
          .join('');
        return '<tr>' + tds + '</tr>';
      })
      .join('');
    return '<table><tbody>' + rowsHtml + '</tbody></table>';
  };

  /* ---- blok: paragraf, daftar, tabel ---- */
  function blocks(parent: Element): string {
    let out = '';
    let list: LI[] = [];
    const flush = () => {
      if (list.length) {
        out += renderList(list);
        list = [];
      }
    };
    const walk = (el: Element) => {
      Array.from(el.children).forEach((c) => {
        const n = c.localName;
        if (n === 'p') {
          const r = paragraph(c);
          if (r.list) {
            list.push({ lvl: r.list.lvl, ordered: isOrdered(r.list.numId, String(r.list.lvl)), html: (r.text.replace(/<br>/g, '').trim() ? '<p>' + r.text + '</p>' : '<p></p>') + r.imgs.join('') });
          } else {
            flush();
            if (!r.empty) out += r.html;
          }
        } else if (n === 'tbl') {
          flush();
          out += table(c);
        } else if (n === 'sdt') {
          const content = kid(c, 'sdtContent');
          if (content) walk(content);
        }
      });
    };
    walk(parent);
    flush();
    return out;
  }

  const body = docXml.getElementsByTagNameNS(NS_W, 'body')[0];
  let html = blocks(body);

  /* ---- unggah gambar, lalu ganti penanda ---- */
  const done: Record<string, string> = {};
  let images = 0;
  let skipped = 0;
  const unique = embeds.filter((v, i) => embeds.indexOf(v) === i);
  for (const rid of unique) {
    const rel = rels[rid];
    const ext = rel ? (rel.target.split('.').pop() || '').toLowerCase() : '';
    const type = IMG_TYPES[ext];
    if (!rel || rel.external || !type) {
      skipped++;
      continue;
    }
    const path = rel.target.charAt(0) === '/' ? rel.target.slice(1) : 'word/' + rel.target.replace(/^\.\//, '');
    const bytes = await get(path);
    if (!bytes) {
      skipped++;
      continue;
    }
    try {
      done[rid] = await saveImage(new File([bytes as BlobPart], 'word-' + rid + '.' + ext, { type }));
      images++;
    } catch {
      skipped++;
    }
  }
  html = html.replace(/<img src="docx-img:([^"]+)">/g, (_m, rid: string) => (done[rid] ? '<img src="' + done[rid] + '">' : ''));
  return { html, images, skipped };
}
