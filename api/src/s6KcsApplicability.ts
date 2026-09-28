/**
 * Tiizi-owned KCS applicability mapping for the S6 catalogue importer.
 * Applicability is derived from canonical identity/domain plus governed
 * measurement and content characteristics. It is deliberately separate from
 * class satisfaction: these classes do not certify publication readiness.
 */
import type { KcsClass, KnowledgeKind } from './knowledge.js';

export interface KcsApplicabilityInput {
  activityCode: string;
  domain: 'Fitness' | 'Wellness';
  category: string;
  classification: string | null;
  family: string | null;
  content: Record<string, unknown>;
  measurementContract: {
    primaryMetrics: string[];
    secondaryMetrics: string[];
    compatibleUnits: string[];
  };
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function deriveS6KcsClasses(activity: KcsApplicabilityInput): KcsClass[] {
  if (!/^(FIT|WEL)-[A-Z]{3}-\d{3}$/.test(activity.activityCode)) {
    throw new Error(`Cannot establish KCS applicability for malformed Activity Code '${activity.activityCode}'`);
  }
  if ((activity.activityCode.startsWith('FIT-')) !== (activity.domain === 'Fitness')) {
    throw new Error(`Cannot establish KCS applicability for ${activity.activityCode}: Activity Code prefix conflicts with domain`);
  }
  if (activity.domain !== 'Fitness' && activity.domain !== 'Wellness') {
    throw new Error(`Cannot establish KCS applicability for ${activity.activityCode}: unknown domain`);
  }
  if (!text(activity.category) || (!text(activity.classification) && !text(activity.family))) {
    throw new Error(`Cannot establish KCS applicability for ${activity.activityCode}: category/classification identity is incomplete`);
  }
  const kind: KnowledgeKind = activity.domain === 'Fitness' ? 'fitness' : 'wellness';
  const metrics = new Set([...activity.measurementContract.primaryMetrics, ...activity.measurementContract.secondaryMetrics]);
  const content = activity.content;
  const classes = new Set<KcsClass>();

  // Q applies to a declared quantitative metric; completion itself is binary.
  if ([...metrics].some((metric) => metric !== 'completion')) classes.add('Q');
  // KCS technique content applies to exercise activities with procedural/form guidance.
  if (kind === 'fitness' && [content.setup, content.execution, content.techniqueReference].some((x) => text(x))
    || kind === 'fitness' && (list(content.formCues).length > 0 || list(content.commonMistakes).length > 0)) {
    classes.add('T');
  }
  // Protocol/practice structure is characteristic of Wellness activities with steps/framing.
  if (kind === 'wellness' && (list(content.protocolSteps).length > 0 || text(content.sessionFraming))) classes.add('P');
  if (metrics.has('completion') || text(content.completionMeaning)) classes.add('C');
  // Semantic boundary applies to explicit definitions, avoidance activities,
  // serving measurements, and the governed eating-pattern classification.
  if (text(content.semanticDefinition) || text(content.avoidanceCondition)
    || (activity.classification ?? '').toLowerCase().includes('avoidance')
    || activity.measurementContract.compatibleUnits.includes('servings')
    || (kind === 'wellness' && activity.category === 'Nutrition & Hydration'
      && activity.classification === 'Eating Pattern')) classes.add('M');
  // Safety applies when a content record carries a non-empty, Activity-specific
  // caution set; all Fitness also receives KCS's automatic Safety membership.
  if (list(content.safetyNotes).some((note) => text(note))) classes.add('S');
  return [...classes].sort() as KcsClass[];
}

export function effectiveS6KcsClasses(activity: KcsApplicabilityInput): KcsClass[] {
  const classes = new Set<KcsClass>(['U', ...deriveS6KcsClasses(activity)]);
  if (activity.domain === 'Fitness') classes.add('S');
  return [...classes].sort() as KcsClass[];
}
