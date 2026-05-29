'use client';

import { forwardRef, useCallback, useImperativeHandle } from 'react';
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

export interface RichTextEditorHandle {
  /** 현재 에디터 HTML 가져오기 (저장 시 호출) */
  getHTML: () => string;
  /** 외부에서 HTML 강제 주입 (저장 후 백엔드 응답 반영, 폼 재로드) */
  setHTML: (html: string) => void;
}

interface Props {
  /** 초기 본문. 마운트 후에는 prop 변경을 무시 — uncontrolled 패턴 */
  defaultValue?: string;
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
      onMouseDown={(e) => e.preventDefault()}
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

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  { defaultValue = '', placeholder = '본문을 입력하세요', minHeight = 320 },
  ref,
) {
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
    content: defaultValue,
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none px-5 py-4 min-h-[200px]',
      },
    },
    // onUpdate 제거 — uncontrolled. 부모 폼 리렌더 폭주 방지
  });

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => {
        if (!editor) return defaultValue || '';
        const html = editor.getHTML();
        return html === '<p></p>' ? '' : html;
      },
      setHTML: (html: string) => {
        if (!editor) return;
        const current = editor.getHTML();
        const incoming = html || '';
        if (current === incoming) return;
        if (current === '<p></p>' && incoming === '') return;
        editor.commands.setContent(incoming, false);
      },
    }),
    [editor, defaultValue],
  );

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
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setColor(c).run()}
              className="h-5 w-5 rounded-sm border border-gray-200 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
            />
          ))}
          <button
            type="button"
            title="색상 해제"
            onMouseDown={(e) => e.preventDefault()}
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

      <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
        HTML 자동 저장 — 저장 버튼을 누르면 본문이 전송됩니다
      </div>
    </div>
  );
});

export default RichTextEditor;
