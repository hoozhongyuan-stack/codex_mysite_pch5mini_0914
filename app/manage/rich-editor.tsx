'use client';
import { useState } from 'react';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import AssetPicker from './asset-picker';
import { plainToRich } from '@/lib/cms-domain.mjs';
const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'video' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, { controls: true, preload: 'metadata' }),
    ];
  },
});
export default function RichEditor({
  value,
  plain,
  onChange,
  assets,
  folders,
}: any) {
  const [picker, setPicker] = useState(false),
    [link, setLink] = useState('');
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false },
      }),
      Image,
      TableKit,
      Video,
    ],
    content: value || plainToRich(plain),
    editorProps: {
      attributes: { class: 'rich-edit-surface', 'aria-label': '富文本正文' },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  if (!editor) return <div role="status" className="notice">正在加载富文本编辑器…</div>;
  const btn = (name: string, act: () => void, active = false) => (
    <button type="button" className={active ? 'active' : ''} onClick={act}>
      {name}
    </button>
  );
  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        {btn('正文', () => editor.chain().focus().setParagraph().run())}
        {btn(
          '标题',
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          editor.isActive('heading'),
        )}
        {btn(
          '粗体',
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive('bold'),
        )}
        {btn(
          '斜体',
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive('italic'),
        )}
        {btn(
          '下划线',
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive('underline'),
        )}
        {btn('列表', () => editor.chain().focus().toggleBulletList().run())}
        {btn('编号', () => editor.chain().focus().toggleOrderedList().run())}
        {btn('引用', () => editor.chain().focus().toggleBlockquote().run())}
        {btn('插入素材', () => setPicker(true))}
        {btn('表格', () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
        )}
        {editor.isActive('table') && (
          <>
            {btn('+ 行', () => editor.chain().focus().addRowAfter().run())}
            {btn('+ 列', () => editor.chain().focus().addColumnAfter().run())}
            {btn('删除表格', () => editor.chain().focus().deleteTable().run())}
          </>
        )}
        {btn('撤销', () => editor.chain().focus().undo().run())}
        {btn('重做', () => editor.chain().focus().redo().run())}
      </div>
      <div className="rich-link">
        <input
          type="url"
          aria-label="链接地址"
          placeholder="选中文字后输入 https:// 链接"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button
          type="button"
          disabled={!/^https?:\/\//i.test(link)}
          onClick={() => {
            editor.chain().focus().setLink({ href: link }).run();
            setLink('');
          }}
        >
          设置链接
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          移除链接
        </button>
      </div>
      <EditorContent editor={editor} />
      {picker && (
        <AssetPicker
          assets={assets}
          folders={folders}
          onClose={() => setPicker(false)}
          onSelect={(a: any) => {
            if (a.mime.startsWith('video'))
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'video',
                  attrs: { src: '/api/media/' + a.id, alt: a.name },
                })
                .run();
            else
              editor
                .chain()
                .focus()
                .setImage({ src: '/api/media/' + a.id, alt: a.name })
                .run();
            setPicker(false);
          }}
        />
      )}
    </div>
  );
}
