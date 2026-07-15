import { type Firestore } from 'firebase-admin/firestore';

type SupportSummaryOptions = {
  apply?: boolean;
  generatedBy?: 'script' | 'trigger';
  sourceVersion?: 'member-phase-6-v1';
  log?: (message: string, data?: Record<string, unknown>) => void;
};

export type SupportDonationSummaryResult = {
  mode: 'dry-run' | 'apply';
  generatedAt: string;
  durationMs: number;
  readCounts: {
    supportDonations: number;
  };
  writeCounts: {
    supportDonationSummary: number;
  };
  summary: {
    totalConfirmedAmount: number;
    donorCount: number;
    confirmedDonationCount: number;
    generatedAt: string;
    sourceVersion: 'member-phase-6-v1';
  };
};

function numberValue(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

export async function rebuildSupportDonationSummary(
  db: Firestore,
  options: SupportSummaryOptions = {},
): Promise<SupportDonationSummaryResult> {
  const startedAt = Date.now();
  const apply = options.apply === true;
  const generatedAt = new Date().toISOString();
  const sourceVersion = options.sourceVersion ?? 'member-phase-6-v1';
  const snap = await db.collection('supportDonations').where('status', '==', 'confirmed').get();
  const donors = new Set<string>();
  let totalConfirmedAmount = 0;

  snap.docs.forEach((docSnap) => {
    const row = docSnap.data() as Record<string, unknown>;
    const userId = stringValue(row, 'userId');
    if (userId) donors.add(userId);
    totalConfirmedAmount += numberValue(row, 'amountKes');
  });

  const summary = {
    totalConfirmedAmount,
    donorCount: donors.size,
    confirmedDonationCount: snap.size,
    generatedAt,
    sourceVersion,
  };

  if (apply) {
    await db.collection('supportDonationSummary').doc('current').set(summary, { merge: true });
  }

  const result: SupportDonationSummaryResult = {
    mode: apply ? 'apply' : 'dry-run',
    generatedAt,
    durationMs: Date.now() - startedAt,
    readCounts: {
      supportDonations: snap.size,
    },
    writeCounts: {
      supportDonationSummary: apply ? 1 : 0,
    },
    summary,
  };
  options.log?.('support donation summary rebuilt', {
    mode: result.mode,
    readCounts: result.readCounts,
    writeCounts: result.writeCounts,
    summary: result.summary,
    generatedBy: options.generatedBy ?? 'script',
  });
  return result;
}
