'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import { cleanWordHtml } from '../lib/wordPaste';
import { useDialog } from './DialogProvider';
import { uploadImage } from '../lib/uploads';

type Props = {
  value: string;
  onChange: (html: string, text: string) => void;
  /** true bila kolom judul masih kosong: judul dari dokumen Word yang diimpor boleh mengisinya */
  titleEmpty?: boolean;
  onTitle?: (title: string) => void;
};

// perubahan isi dikirim ke induk paling cepat tiap 400 ms (dan langsung saat editor kehilangan fokus),
// supaya artikel panjang tidak memproses seluruh dokumen pada setiap ketikan
const EMIT_DELAY = 400;

function Btn(p: { label: string; run: () => void; on?: boolean; off?: boolean; title?: string }) {
  return (
    <button
      type="button"
      title={p.title}
      aria-label={p.title}
      disabled={p.off}
      onMouseDown={(e) => e.preventDefault()}
      onClick={p.run}
      className={
        'rounded-md border px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ' +
        (p.on ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-300 bg-white hover:bg-slate-50')
      }
    >
      {p.label}
    </button>
  );
}

// Link yang dibuka di tab baru wajib membawa rel="noopener noreferrer" (mencegah halaman tujuan membajak tab ini).
// Dipasang sekali di level modul; berlaku untuk semua isi yang ditampilkan lewat RichView, termasuk data lama.
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer');
  });
}

export function RichView({ html }: { html: string }) {
  // pembersihan HTML cukup sekali per isi (dulu diulang di setiap render, mahal untuk artikel panjang)
  const clean = useMemo(() => (typeof window === 'undefined' ? '' : DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })), [html]);
  return (
    <div className="overflow-x-auto">
      <div className="rich" dangerouslySetInnerHTML={{ __html: clean }} />
    </div>
  );
}

const isImg = (f: File) => f.type.startsWith('image/');

export default function RichEditor({ value, onChange, titleEmpty, onTitle }: Props) {
  const { prompt, confirm } = useDialog();
  const [note, setNote] = useState<{ k: 'err' | 'ok'; t: string } | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const edRef = useRef<Editor | null>(null);
  const upRef = useRef<(files: File[]) => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const e = edRef.current;
    if (e) onChangeRef.current(e.isEmpty ? '' : e.getHTML(), e.getText({ blockSeparator: '\n' }));
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    editorProps: {
      attributes: { class: 'rich min-h-[260px] px-3 py-2 focus:outline-none' },
      transformPastedHTML: cleanWordHtml,
      // tempel screenshot / seret foto ke kotak isi: diunggah otomatis
      handlePaste: (_v, ev) => {
        const files = Array.from((ev.clipboardData?.files ?? []) as ArrayLike<File>).filter(isImg);
        if (!files.length) return false;
        upRef.current(files);
        return true;
      },
      handleDrop: (_v, ev) => {
        const files = Array.from((ev.dataTransfer?.files ?? []) as ArrayLike<File>).filter(isImg);
        if (!files.length) return false;
        ev.preventDefault();
        upRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }: { editor: Editor }) => {
      edRef.current = e;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(emit, EMIT_DELAY);
    },
    // klik Simpan / Pratinjau / Kembali memindahkan fokus dulu, jadi isi terbaru pasti sudah terkirim
    onBlur: () => {
      if (timer.current) emit();
    },
  });

  useEffect(() => {
    edRef.current = editor;
  }, [editor]);

  // editor dibongkar (ganti entri / keluar halaman): batalkan kiriman tertunda supaya tidak menimpa form lain
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  upRef.current = async (files: File[]) => {
    setNote(null);
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const src = await uploadImage(file);
        edRef.current?.chain().focus().setImage({ src }).run();
      } catch (err) {
        setNote({ k: 'err', t: (err as Error).message });
      }
      setUploading((n) => n - 1);
    }
  };

  // impor file Word (.docx): isi, tabel, daftar, dan gambar ikut terbaca; judul dokumen mengisi kolom Judul bila masih kosong
  const importDocx = async (file: File) => {
    const ed = edRef.current;
    if (!ed) return;
    if (!/\.docx$/i.test(file.name)) {
      setNote({ k: 'err', t: 'Hanya file .docx. Untuk file .doc, simpan ulang dulu sebagai .docx di Word.' });
      return;
    }
    // editor sudah berisi: tanya mau diganti atau disisipkan (batal = sisipkan, yang tidak merusak)
    let replace = false;
    if (!ed.isEmpty) {
      replace = await confirm({
        title: 'Impor dokumen Word',
        message: 'Ganti seluruh isi dengan "' + file.name + '"?\nPilih "Sisipkan" untuk menaruhnya di posisi kursor tanpa menghapus apa pun.',
        confirmText: 'Ganti isi',
        cancelText: 'Sisipkan',
        tone: 'danger',
      });
    }
    setNote({ k: 'ok', t: 'Membaca ' + file.name + '…' });
    setUploading((n) => n + 1);
    try {
      const { docxToHtml } = await import('../lib/docxImport');
      const r = await docxToHtml(file, uploadImage, {
        extractTitle: !!titleEmpty && !!onTitle,
        onProgress: (d, t) => setNote({ k: 'ok', t: 'Mengunggah gambar ' + d + '/' + t + '…' }),
      });
      if (!r.html) throw new Error('Tidak ada isi yang bisa dibaca di file ini.');
      if (replace) ed.chain().focus().setContent(r.html, true).run();
      else ed.chain().focus().insertContent(r.html).run();
      emit();
      if (r.title && onTitle) onTitle(r.title);
      setNote({
        k: 'ok',
        t:
          'Selesai' +
          (r.title ? '. Judul diambil dari dokumen' : '') +
          '. ' +
          r.images +
          ' gambar diunggah' +
          (r.skipped ? ', ' + r.skipped + ' gambar dilewati (format tidak didukung).' : '.'),
      });
    } catch (err) {
      setNote({ k: 'err', t: (err as Error).message });
    }
    setUploading((n) => n - 1);
  };

  if (!editor) return <div className="min-h-[300px] rounded-lg border border-slate-300 bg-white" />;
  const c = () => editor.chain().focus();

  const setLink = async () => {
    const prev = (editor.getAttributes('link').href as string) ?? '';
    const url = await prompt({ title: 'Alamat link', message: 'Kosongkan untuk menghapus link.', defaultValue: prev, placeholder: 'https://…', confirmText: 'Terapkan' });
    if (url === null) return;
    if (url.trim() === '') c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/25">
      <div className="sticky top-0 z-10 flex flex-wrap gap-1.5 rounded-t-lg border-b border-slate-200 bg-slate-50 p-2">
        <Btn label="Paragraf" run={() => c().setParagraph().run()} on={editor.isActive('paragraph')} />
        <Btn label="Judul" run={() => c().toggleHeading({ level: 2 }).run()} on={editor.isActive('heading', { level: 2 })} />
        <Btn label="Sub" run={() => c().toggleHeading({ level: 3 }).run()} on={editor.isActive('heading', { level: 3 })} />
        <Btn label="B" title="Tebal (Ctrl+B)" run={() => c().toggleBold().run()} on={editor.isActive('bold')} />
        <Btn label="I" title="Miring (Ctrl+I)" run={() => c().toggleItalic().run()} on={editor.isActive('italic')} />
        <Btn label="U" title="Garis bawah (Ctrl+U)" run={() => c().toggleUnderline().run()} on={editor.isActive('underline')} />
        <Btn label="• Poin" run={() => c().toggleBulletList().run()} on={editor.isActive('bulletList')} />
        <Btn label="1. Nomor" run={() => c().toggleOrderedList().run()} on={editor.isActive('orderedList')} />
        <Btn label="❝ Penting" title="Kutipan / catatan penting" run={() => c().toggleBlockquote().run()} on={editor.isActive('blockquote')} />
        <Btn label="―" title="Garis pemisah" run={() => c().setHorizontalRule().run()} />
        <Btn label="Link" run={setLink} on={editor.isActive('link')} />
        <Btn label={uploading > 0 ? 'Mengunggah…' : 'Gambar'} run={() => fileRef.current?.click()} off={uploading > 0} />
        <Btn label="Impor Word" title="Baca file .docx: isi, tabel, gambar, dan judul" run={() => docRef.current?.click()} off={uploading > 0} />
        <Btn label="Tabel" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <Btn label="↶" title="Urungkan (Ctrl+Z)" run={() => c().undo().run()} off={!editor.can().undo()} />
        <Btn label="↷" title="Ulangi (Ctrl+Shift+Z)" run={() => c().redo().run()} off={!editor.can().redo()} />
      </div>
      {editor.isActive('table') && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-teal-50/60 p-2">
          <Btn label="+ Baris" run={() => c().addRowAfter().run()} />
          <Btn label="+ Kolom" run={() => c().addColumnAfter().run()} />
          <Btn label="− Baris" run={() => c().deleteRow().run()} />
          <Btn label="− Kolom" run={() => c().deleteColumn().run()} />
          <Btn label="Baris judul" run={() => c().toggleHeaderRow().run()} />
          <Btn label="Hapus tabel" run={() => c().deleteTable().run()} />
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (list.length) upRef.current(list);
        }}
      />
      <input
        ref={docRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          e.target.value = '';
          if (f) importDocx(f);
        }}
      />
      {note && (
        <p className={'border-b border-slate-200 px-3 py-1.5 text-xs ' + (note.k === 'err' ? 'bg-red-50 text-red-700' : 'bg-teal-50 text-teal-800')}>{note.t}</p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}