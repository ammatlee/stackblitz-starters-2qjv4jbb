'use client';

import React, { useEffect, useRef, useState } from 'react';
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
import { uploadImage } from '../lib/uploads';

type Props = { value: string; onChange: (html: string, text: string) => void };

function Btn(p: { label: string; run: () => void; on?: boolean; off?: boolean }) {
  return (
    <button
      type="button"
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

export function RichView({ html }: { html: string }) {
  const clean = typeof window === 'undefined' ? '' : DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
  return (
    <div className="overflow-x-auto">
      <div className="rich" dangerouslySetInnerHTML={{ __html: clean }} />
    </div>
  );
}

const isImg = (f: File) => f.type.startsWith('image/');

export default function RichEditor({ value, onChange }: Props) {
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const edRef = useRef<Editor | null>(null);
  const upRef = useRef<(files: File[]) => void>(() => {});

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
    onUpdate: ({ editor: e }: { editor: Editor }) =>
      onChange(e.isEmpty ? '' : e.getHTML(), e.getText({ blockSeparator: '\n' })),
  });

  useEffect(() => {
    edRef.current = editor;
  }, [editor]);

  upRef.current = async (files: File[]) => {
    setNote('');
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const src = await uploadImage(file);
        edRef.current?.chain().focus().setImage({ src }).run();
      } catch (err) {
        setNote((err as Error).message);
      }
      setUploading((n) => n - 1);
    }
  };

  if (!editor) return <div className="min-h-[300px] rounded-lg border border-slate-300 bg-white" />;
  const c = () => editor.chain().focus();

  const setLink = () => {
    const prev = (editor.getAttributes('link').href as string) ?? '';
    const url = window.prompt('Alamat link (kosongkan untuk menghapus):', prev);
    if (url === null) return;
    if (url.trim() === '') c().extendMarkRange('link').unsetLink().run();
    else c().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="rounded-lg border border-slate-300 bg-white focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/25">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 bg-slate-50 p-2">
        <Btn label="Paragraf" run={() => c().setParagraph().run()} on={editor.isActive('paragraph')} />
        <Btn label="Judul" run={() => c().toggleHeading({ level: 2 }).run()} on={editor.isActive('heading', { level: 2 })} />
        <Btn label="Sub" run={() => c().toggleHeading({ level: 3 }).run()} on={editor.isActive('heading', { level: 3 })} />
        <Btn label="B" run={() => c().toggleBold().run()} on={editor.isActive('bold')} />
        <Btn label="I" run={() => c().toggleItalic().run()} on={editor.isActive('italic')} />
        <Btn label="U" run={() => c().toggleUnderline().run()} on={editor.isActive('underline')} />
        <Btn label="• Poin" run={() => c().toggleBulletList().run()} on={editor.isActive('bulletList')} />
        <Btn label="1. Nomor" run={() => c().toggleOrderedList().run()} on={editor.isActive('orderedList')} />
        <Btn label="Link" run={setLink} on={editor.isActive('link')} />
        <Btn label={uploading > 0 ? 'Mengunggah…' : 'Gambar'} run={() => fileRef.current?.click()} off={uploading > 0} />
        <Btn label="Tabel" run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <Btn label="↶" run={() => c().undo().run()} off={!editor.can().undo()} />
        <Btn label="↷" run={() => c().redo().run()} off={!editor.can().redo()} />
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
      {note && <p className="border-b border-slate-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">{note}</p>}
      <EditorContent editor={editor} />
    </div>
  );
}
