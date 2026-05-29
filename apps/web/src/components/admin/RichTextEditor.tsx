'use client';

import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Code,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const COLORS = [
  '#000000',
  '#3180F7',
  '#EF4444',
  '#F59E0B',
  '#22C55E',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
];

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-[#3180F7] text-white'
          : 'text-gray-700 hover:bg-gray-100 disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-6 w-px bg-gray-200" />;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '본문을 입력하세요',
  minHeight = 320,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({ inline: false, HTMLAttributes: { class: 'rounded-lg my-3' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none px-5 py-4 min-h-[200px]',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '';
    if (current === incoming) return;
    if (current === '<p></p>' && incoming === '') return;
    editor.commands.setContent(incoming, false);
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('링크 URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('이미지 URL', 'https://');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className="w-full rounded-xl border border-gray-200 bg-white"
        style={{ minHeight }}
      >
        <div className="border-b border-gray-200 px-3 py-2 text-[12px] text-gray-400">
          에디터 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <ToolbarButton
          title="제목1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="제목2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="제목3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="굵게"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="기울임"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="밑줄"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="취소선"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={16} />
        </ToolbarButton>

        <Divider />

        {/* 색상 */}
        <div className="flex items-center gap-0.5 px-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`색상 ${c}`}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className="h-5 w-5 rounded-sm border border-gray-200 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            title="색상 해제"
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="ml-1 flex h-6 items-center rounded-sm px-1.5 text-[10px] text-gray-500 hover:bg-gray-100"
          >
            해제
          </button>
        </div>

        <Divider />

        <ToolbarButton
          title="왼쪽 정렬"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="가운데 정렬"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="오른쪽 정렬"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="글머리 기호"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="번호 매기기"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="인용"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="인라인 코드"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="구분선"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton title="링크" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarButton title="이미지" onClick={insertImage}>
          <ImageIcon size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          title="실행 취소"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="다시 실행"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </ToolbarButton>
      </div>

      {/* 에디터 영역 */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>

      {/* 푸터 — 글자수 + HTML 미리보기 토글 */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
        <span>{editor.storage.characterCount?.characters?.() ?? editor.getText().length}자</span>
        <span>HTML 자동 저장</span>
      </div>

      <style jsx global>{`
        .ProseMirror {
          font-family: inherit;
          font-size: 14px;
          line-height: 1.75;
          color: #1f2937;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror h1 {
          font-size: 22px;
          font-weight: 800;
          margin: 14px 0 8px;
          line-height: 1.3;
        }
        .ProseMirror h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 12px 0 6px;
          line-height: 1.3;
        }
        .ProseMirror h3 {
          font-size: 16px;
          font-weight: 700;
          margin: 10px 0 6px;
          line-height: 1.3;
        }
        .ProseMirror p {
          margin: 6px 0;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 22px;
          margin: 6px 0;
        }
        .ProseMirror ul {
          list-style: disc;
        }
        .ProseMirror ol {
          list-style: decimal;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #3180f7;
          padding: 4px 12px;
          margin: 8px 0;
          color: #4b5563;
          background: #f8faff;
        }
        .ProseMirror code {
          background: #f3f4f6;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12.5px;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 14px 0;
        }
        .ProseMirror a {
          color: #3180f7;
          text-decoration: underline;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
