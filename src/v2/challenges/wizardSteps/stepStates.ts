import type { WizardState } from '../challengeCreationDraft';

/**
 * Narrow, explicit state contracts for the reusable Wizard steps. Each step
 * sees ONLY the fields it renders or edits, so a later `TEMPLATE_AUTHORING`
 * composition can reuse the step without ever receiving a hosting Group,
 * dates, Social Cause, Support or `creatorJoins` field.
 */
export type NameAppearanceState = Pick<WizardState, 'title' | 'description' | 'coverId'>;
export type ActivitiesStepState = Pick<WizardState, 'challengeType' | 'activities'>;
export type WhatCountsStepState = Pick<WizardState, 'challengeType' | 'activities'>;
