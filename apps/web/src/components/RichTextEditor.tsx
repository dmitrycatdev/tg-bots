import { useEffect, useMemo, useState } from 'react';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function toEditorHtml(value: string) {
  if (!value.trim()) return '<p></p>';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(value);
  if (looksLikeHtml) return value;
  const escaped = value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\n', '<br>');
  return `<p>${escaped}</p>`;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const initialValue = useMemo(() => toEditorHtml(value), [value]);
  const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
        strike: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: initialValue,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          '[&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-700',
        ),
      },
    },
    onUpdate: ({ editor: instance }) => {
      onChange(instance.getHTML());
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== initialValue) {
      editor.commands.setContent(initialValue, { emitUpdate: false });
    }
  }, [editor, initialValue]);

  const editorState = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      isBold: !!instance && instance.isActive('bold'),
      isItalic: !!instance && instance.isActive('italic'),
      isLink: !!instance && instance.isActive('link'),
      currentHref: (instance?.getAttributes('link').href as string | undefined) || '',
    }),
  });
  const { isBold, isItalic, isLink, currentHref } = editorState ?? {
    isBold: false,
    isItalic: false,
    isLink: false,
    currentHref: '',
  };

  useEffect(() => {
    if (!isLinkEditorOpen) return;
    setLinkUrl(currentHref || 'https://');
  }, [currentHref, isLinkEditorOpen]);

  if (!editor) {
    return null;
  }

  const openLinkEditor = () => {
    setLinkUrl(currentHref || 'https://');
    setIsLinkEditorOpen(true);
  };

  const closeLinkEditor = () => {
    setIsLinkEditorOpen(false);
  };

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      closeLinkEditor();
      return;
    }
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().setLink({ href: normalized }).run();
    closeLinkEditor();
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    closeLinkEditor();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={isBold ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          B
        </Button>
        <Button
          type="button"
          variant={isItalic ? 'default' : 'outline'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          I
        </Button>
        <Button
          type="button"
          variant={isLink ? 'default' : 'outline'}
          size="sm"
          onClick={openLinkEditor}
        >
          Link
        </Button>
      </div>
      {isLinkEditorOpen && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-muted/30 p-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 max-w-md"
          />
          <Button type="button" size="sm" onClick={applyLink}>
            Apply
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={removeLink}>
            Remove
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={closeLinkEditor}>
            Cancel
          </Button>
        </div>
      )}
      <EditorContent editor={editor} />
      {placeholder && !editor.getText().trim() && (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      )}
    </div>
  );
}
