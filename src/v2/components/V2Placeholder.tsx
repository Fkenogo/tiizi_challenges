import { V2EmptyState, V2Page, V2SectionHeader } from '../components/V2Primitives';

/**
 * TIIZI S1 — product-like placeholder.
 *
 * Placeholders must look like part of the final Tiizi product: page
 * title, short human-facing explanation, an appropriate empty/reference
 * state, and the next integration slice where useful. No domain IDs,
 * governance terms, architecture jargon, or mock metadata for Members.
 */
export function V2Placeholder({
  eyebrow,
  title,
  explanation,
  emptyTitle,
  emptyMessage,
  nextSlice,
  wide,
}: {
  eyebrow: string;
  title: string;
  explanation: string;
  emptyTitle: string;
  emptyMessage: string;
  nextSlice?: string;
  wide?: boolean;
}) {
  return (
    <V2Page wide={wide}>
      <V2SectionHeader eyebrow={eyebrow} title={title} description={explanation} />
      <V2EmptyState title={emptyTitle} message={emptyMessage} nextSlice={nextSlice} />
    </V2Page>
  );
}
