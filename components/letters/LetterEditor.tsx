"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
  Heading2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LetterEditorProps = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  describedBy?: string;
};

type ToolbarButtonProps = {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  active,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex h-10 min-w-10 items-center justify-center rounded-lg px-2 transition-colors sm:h-9 sm:min-w-9",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export default function LetterEditor({
  content,
  onChange,
  placeholder,
  ariaLabel,
  describedBy,
}: LetterEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Tulis suratmu di sini…",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "tiptap-content min-h-[280px] w-full rounded-xl border border-input bg-card px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[320px]",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    immediatelyRender: false,
  });

  // Keep the editor in sync when the draft is restored or the form is reset.
  // Typing already matches, so this never touches the cursor mid-sentence.
  useEffect(() => {
    if (!editor || content === editor.getHTML()) return;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  const toolbar = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor?.isActive("bold") ?? false,
      italic: editor?.isActive("italic") ?? false,
      heading: editor?.isActive("heading", { level: 2 }) ?? false,
      bulletList: editor?.isActive("bulletList") ?? false,
      orderedList: editor?.isActive("orderedList") ?? false,
      blockquote: editor?.isActive("blockquote") ?? false,
      canUndo: editor?.can().undo() ?? false,
      canRedo: editor?.can().redo() ?? false,
    }),
  });

  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const toggleHeading = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const toggleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const undo = useCallback(() => editor?.chain().focus().undo().run(), [editor]);
  const redo = useCallback(() => editor?.chain().focus().redo().run(), [editor]);

  if (!editor || !toolbar) {
    return (
      <div
        aria-hidden="true"
        className="min-h-[280px] animate-pulse rounded-xl border border-input bg-muted/30 sm:min-h-[320px]"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div
        role="toolbar"
        aria-label="Format surat"
        className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/40 p-1"
      >
        <ToolbarButton icon={Bold} label="Tebal" shortcut="Ctrl+B" active={toolbar.bold} onClick={toggleBold} />
        <ToolbarButton icon={Italic} label="Miring" shortcut="Ctrl+I" active={toolbar.italic} onClick={toggleItalic} />
        <ToolbarButton icon={Heading2} label="Judul bagian" active={toolbar.heading} onClick={toggleHeading} />

        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

        <ToolbarButton icon={List} label="Daftar poin" active={toolbar.bulletList} onClick={toggleBulletList} />
        <ToolbarButton icon={ListOrdered} label="Daftar bernomor" active={toolbar.orderedList} onClick={toggleOrderedList} />
        <ToolbarButton icon={Quote} label="Kutipan" active={toolbar.blockquote} onClick={toggleBlockquote} />

        <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

        <ToolbarButton icon={Undo} label="Urungkan" shortcut="Ctrl+Z" disabled={!toolbar.canUndo} onClick={undo} />
        <ToolbarButton icon={Redo} label="Ulangi" shortcut="Ctrl+Shift+Z" disabled={!toolbar.canRedo} onClick={redo} />
      </div>

      <div className="tiptap-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
