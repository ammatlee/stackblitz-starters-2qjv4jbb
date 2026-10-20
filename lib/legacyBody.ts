// Mengubah isi Bulletin lama (teks bertanda #, -, 1., |, **) menjadi HTML
// supaya entri lama bisa dibuka dan diubah di editor baru.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inl = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const BULLET = /^(\s*)([-*•·▪◦‣●○–—])\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const isPipe = (ln: string) => /^\s*\|.*\|\s*$/.test(ln);
const isTab = (ln: string) => ln.indexOf('\t') >= 0 && ln.trim() !== '';

export function legacyToHtml(text: string): string {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      out.push('<p>' + para.map(inl).join('<br>') + '</p>');
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((t) => '<li><p>' + inl(t) + '</p></li>').join('');
      out.push('<' + list.tag + '>' + items + '</' + list.tag + '>');
      list = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    if (isPipe(ln) || isTab(ln)) {
      const pipe = isPipe(ln);
      const block: string[] = [];
      while (i < lines.length && (pipe ? isPipe(lines[i]) : isTab(lines[i]))) {
        block.push(lines[i]);
        i++;
      }
      i--;
      flushPara();
      flushList();
      const rows = block
        .map((l) => (pipe ? l.trim().replace(/^\||\|$/g, '').split('|') : l.split('\t')).map((c) => c.trim()))
        .filter((r) => !r.every((c) => c === '' || /^:?-{2,}:?$/.test(c)));
      if (rows.length) {
        const w = Math.max(...rows.map((r) => r.length));
        const trs = rows.map((r, ri) => {
          const tag = ri === 0 ? 'th' : 'td';
          let tds = '';
          for (let ci = 0; ci < w; ci++) tds += '<' + tag + '><p>' + inl(r[ci] || '') + '</p></' + tag + '>';
          return '<tr>' + tds + '</tr>';
        });
        out.push('<table><tbody>' + trs.join('') + '</tbody></table>');
      }
      continue;
    }

    const b = ln.match(BULLET);
    const n = ln.match(NUMBERED);
    if (b || n) {
      flushPara();
      const tag: 'ul' | 'ol' = n && !b ? 'ol' : 'ul';
      const t = ((b ? b[3] : n![3]) || '').trim();
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(t);
      continue;
    }
    if (ln.trim() === '') {
      flushPara();
      flushList();
      continue;
    }
    flushList();
    if (ln.indexOf('## ') === 0) {
      flushPara();
      out.push('<h3>' + inl(ln.slice(3)) + '</h3>');
    } else if (ln.indexOf('# ') === 0) {
      flushPara();
      out.push('<h2>' + inl(ln.slice(2)) + '</h2>');
    } else {
      para.push(ln);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}
