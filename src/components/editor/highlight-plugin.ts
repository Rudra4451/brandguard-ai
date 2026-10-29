import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface ActiveHighlight {
  from: number;
  to: number;
  findingId: string;
  severity: 'VIOLATION' | 'NOTICE' | 'CANDIDATE';
}

export const highlightPluginKey = new PluginKey<DecorationSet>('findingHighlight');

export const FindingHighlightExtension = Extension.create({
  name: 'findingHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: highlightPluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, oldSet) {
            // Check if transaction sets a new highlight
            const meta = tr.getMeta(highlightPluginKey) as ActiveHighlight | null | undefined;
            if (meta === null) {
              return DecorationSet.empty;
            }
            if (meta && meta.from !== undefined && meta.to !== undefined) {
              if (meta.from === meta.to) {
                // Point decoration for zero-length findings (e.g. missing disclaimer)
                const widgetEl = document.createElement('span');
                widgetEl.className =
                  'inline-block w-2 h-4 border-r-2 border-conflict animate-pulse align-middle ml-0.5';
                widgetEl.setAttribute('aria-hidden', 'true');
                const deco = Decoration.widget(meta.from, widgetEl);
                return DecorationSet.create(tr.doc, [deco]);
              }

              const className =
                meta.severity === 'VIOLATION'
                  ? 'bg-conflict-tint border-b-2 border-conflict text-ink'
                  : meta.severity === 'NOTICE'
                  ? 'bg-unverified-tint border-b-2 border-unverified text-ink'
                  : 'bg-deterministic-tint border-b-2 border-deterministic text-ink';

              const deco = Decoration.inline(meta.from, meta.to, {
                class: `finding-active-highlight ${className}`,
                'data-finding-id': meta.findingId,
              });

              return DecorationSet.create(tr.doc, [deco]);
            }

            // Map old decorations through document changes
            return oldSet.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
