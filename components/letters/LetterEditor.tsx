"use client";

import { useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo, Heading2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LetterEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function LetterEditor({
  content,
  onChange,
  placeholder,
}: LetterEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert min-h-[280px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
      },
    },
    immediatelyRender: false,
  });

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const toggleHeading = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const toggleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

  if (!editor) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-input bg-muted/30">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const items = [
    { icon: Bold, action: toggleBold, active: editor.isActive("bold"), label: "Bold" },
    { icon: Italic, action: toggleItalic, active: editor.isActive("italic"), label: "Italic" },
    { icon: Heading2, action: toggleHeading, active: editor.isActive("heading"), label: "Heading" },
    { icon: List, action: toggleBulletList, active: editor.isActive("bulletList"), label: "Bullet List" },
    { icon: ListOrdered, action: toggleOrderedList, active: editor.isActive("orderedList"), label: "Ordered List" },
    { icon: Quote, action: toggleBlockquote, active: editor.isActive("blockquote"), label: "Quote" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/50 p-1">
        {items.map(({ icon: Icon, action, active, label }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="mx-1 w-px bg-border" />
        <button
          type="button"
          onClick={undo}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Undo"
        >
          <Undo className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={redo}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Redo"
        >
          <Redo className="h-4 w-4" />
        </button>
      </div>

      <style>{`
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
      `}</style>

      <div className="tiptap-editor">
        <EditorContent
          editor={editor}
          placeholder={placeholder}
          className="[&_.ProseMirror]:min-h-[280px] [&_.ProseMirror]:w-full [&_.ProseMirror]:rounded-xl [&_.ProseMirror]:border [&_.ProseMirror]:border-input [&_.ProseMirror]:bg-background [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:text-sm [&_.ProseMirror]:outline-none focus-visible:[&_.ProseMirror]:ring-2 focus-visible:[&_.ProseMirror]:ring-ring"
        />
      </div>
    </div>
  );
}
