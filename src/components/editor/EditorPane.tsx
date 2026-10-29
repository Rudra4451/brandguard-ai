import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FindingHighlightExtension, highlightPluginKey, type ActiveHighlight } from './highlight-plugin';
import { EditorToolbar, type Channel } from './EditorToolbar';
import { resolveFindingAnchor } from '../../engine/anchor-resolver';
import type { Finding } from '../../engine/types';

interface EditorPaneProps {
  initialContent: string;
  onContentChange: (text: string) => void;
  channel: Channel;
  onChannelChange: (channel: Channel) => void;
  channelLimit?: number;
  onRunAudit: () => void;
  isStale: boolean;
  selectedFinding: Finding | null;
  onApplyRewriteRef?: React.MutableRefObject<((from: number, to: number, replacement: string) => void) | null>;
  className?: string;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  initialContent,
  onContentChange,
  channel,
  onChannelChange,
  channelLimit,
  onRunAudit,
  isStale,
  selectedFinding,
  onApplyRewriteRef,
  className = '',
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      FindingHighlightExtension,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          'font-sans text-lg md:text-xl leading-relaxed text-zinc-900 outline-none min-h-[480px] p-8 bg-white focus:outline-none selection:bg-blue-100',
        'aria-label': 'Draft Editor Document',
      },
    },
    onUpdate({ editor }) {
      const text = editor.getText();
      onContentChange(text);
    },
  });

  // Provide safe rewrite apply function via ref
  useEffect(() => {
    if (onApplyRewriteRef && editor) {
      onApplyRewriteRef.current = (from: number, to: number, replacement: string) => {
        editor.chain().focus().insertContentAt({ from, to }, replacement).run();
      };
    }
  }, [editor, onApplyRewriteRef]);

  // Update ProseMirror highlight decoration whenever selectedFinding changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (!selectedFinding) {
      // Clear highlight
      editor.view.dispatch(editor.state.tr.setMeta(highlightPluginKey, null));
      return;
    }

    const resolved = resolveFindingAnchor(editor.state.doc, selectedFinding);
    if (!resolved) {
      // Orphaned finding: clear highlight
      editor.view.dispatch(editor.state.tr.setMeta(highlightPluginKey, null));
      return;
    }

    // Apply inline highlight decoration
    const highlight: ActiveHighlight = {
      from: resolved.from,
      to: resolved.to,
      findingId: selectedFinding.id,
      severity: selectedFinding.severity,
    };

    editor.view.dispatch(editor.state.tr.setMeta(highlightPluginKey, highlight));

    // Scroll to position respecting prefers-reduced-motion
    const domNode = editor.view.domAtPos(resolved.from).node;
    if (domNode instanceof Element) {
      domNode.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    }
  }, [editor, selectedFinding]);

  const rawText = editor ? editor.getText() : '';
  const charCount = rawText.length;
  const wordCount = rawText.trim().length > 0 ? rawText.trim().split(/\s+/).length : 0;
  const isAuditDisabled = charCount === 0;

  return (
    <div className={`flex flex-col border border-[#E4E4E7] rounded-md bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden ${className}`}>
      <EditorToolbar
        channel={channel}
        onChannelChange={onChannelChange}
        charCount={charCount}
        channelLimit={channelLimit}
        wordCount={wordCount}
        onRunAudit={onRunAudit}
        isAuditDisabled={isAuditDisabled}
        isStale={isStale}
        canUndo={!!editor?.can().undo()}
        canRedo={!!editor?.can().redo()}
        onUndo={() => editor?.chain().focus().undo().run()}
        onRedo={() => editor?.chain().focus().redo().run()}
      />
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
