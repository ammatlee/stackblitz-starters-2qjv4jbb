// Merapikan hasil salin dari Word sebelum dibaca editor:
// - daftar Word (paragraf "mso-list") diubah menjadi daftar bertingkat sungguhan
// - gambar file:/cid: (tidak bisa dibuka) dibuang
// - judul h1-h6 disesuaikan dengan tingkat judul editor (h2 dan h3)
const IS_WORD = /mso-|MsoNormal|MsoList|schemas-microsoft-com:office/i;
const LIST_STYLE = /mso-list\s*:\s*(?!none)[^;'"]*\bl\d+/i;

type Item = { level: number; ordered: boolean; html: string };

function lastLi(list: HTMLElement): HTMLElement {
  return (list.lastElementChild as HTMLElement) || list;
}

function buildLists(items: Item[], doc: Document): HTMLElement {
  const root = doc.createElement('div');
  const stack: { level: number; list: HTMLElement }[] = [];
  const make = (ordered: boolean, level: number, parent: HTMLElement) => {
    const list = doc.createElement(ordered ? 'ol' : 'ul');
    parent.appendChild(list);
    stack.push({ level, list });
  };
  items.forEach((it) => {
    while (stack.length && it.level < stack[stack.length - 1].level) stack.pop();
    let top = stack[stack.length - 1];
    if (top && top.level === it.level && (top.list.tagName === 'OL') !== it.ordered) {
      stack.pop();
      make(it.ordered, it.level, stack.length ? lastLi(stack[stack.length - 1].list) : root);
    } else if (!top || it.level > top.level) {
      make(it.ordered, it.level, top ? lastLi(top.list) : root);
    }
    top = stack[stack.length - 1];
    const li = doc.createElement('li');
    const p = doc.createElement('p');
    p.innerHTML = it.html;
    li.appendChild(p);
    top.list.appendChild(li);
  });
  return root;
}

function isListPara(el: Element | null): el is HTMLElement {
  return !!el && el.tagName === 'P' && LIST_STYLE.test(el.getAttribute('style') || '');
}

export function cleanWordHtml(html: string): string {
  if (!IS_WORD.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  body.querySelectorAll('img').forEach((img) => {
    if (/^(file|cid):/i.test(img.getAttribute('src') || '')) img.remove();
  });

  body.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h) => {
    const n = doc.createElement(h.tagName === 'H1' ? 'h2' : 'h3');
    n.innerHTML = h.innerHTML;
    h.replaceWith(n);
  });

  const seen = new Set<Element>();
  Array.from(body.querySelectorAll('p')).forEach((p) => {
    if (seen.has(p) || !isListPara(p)) return;
    const group: HTMLElement[] = [];
    let n: Element | null = p;
    while (isListPara(n)) {
      seen.add(n);
      group.push(n);
      n = n.nextElementSibling;
    }
    const items: Item[] = group.map((el) => {
      let marker = '';
      Array.from(el.querySelectorAll('span')).forEach((s) => {
        if (/mso-list\s*:\s*ignore/i.test(s.getAttribute('style') || '')) {
          if (!marker) marker = (s.textContent || '').replace(/\u00a0/g, ' ').trim();
          s.remove();
        }
      });
      const lv = /level(\d+)/i.exec(el.getAttribute('style') || '');
      return {
        level: lv ? Number(lv[1]) : 1,
        ordered: /^([0-9]+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)]$/.test(marker),
        html: el.innerHTML.replace(/^(\s|&nbsp;|\u00a0)+/, ''),
      };
    });
    const built = buildLists(items, doc);
    const first = group[0];
    while (built.firstChild) first.parentNode!.insertBefore(built.firstChild, first);
    group.forEach((el) => el.remove());
  });

  return body.innerHTML;
}
