import {
  Archive,
  BarChart2,
  CheckSquare,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Square,
  Star,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, LoadingSpinner } from '../../../components/Mobile';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../hooks/useAuth';
import { useAdminPermissions } from '../../../hooks/useAdminPermissions';
import {
  useAllAdminTemplates,
  useArchiveTemplate,
  useDeleteTemplate,
  useDuplicateTemplate,
  useFeatureTemplate,
  usePublishTemplate,
  useRestoreTemplate,
  useUnfeatureTemplate,
  useUnpublishTemplate,
} from '../../../hooks/useChallengeTemplates';
import {
  useAllAdminWellnessTemplates,
  useArchiveWellnessTemplate,
  useDeleteWellnessTemplate,
  useDuplicateWellnessTemplate,
  useFeatureWellnessTemplate,
  usePublishWellnessTemplate,
  useRestoreWellnessTemplate,
  useUnfeatureWellnessTemplate,
  useUnpublishWellnessTemplate,
} from '../../../hooks/useWellnessTemplates';
import { challengeTemplateService } from '../../../services/challengeTemplateService';
import { wellnessTemplateService } from '../../../services/wellnessTemplateService';
import { AdminLayout } from '../layout/AdminLayout';

// ─── Unified type ────────────────────────────────────────────────────────────

type TemplateCollection = 'fitness' | 'wellness';
type TemplateStatus = 'draft' | 'published' | 'archived' | 'deleted';
type EngineType = 'collective' | 'competitive' | 'streak';

interface AdminTemplate {
  id: string;
  collection: TemplateCollection;
  name: string;
  description: string;
  challengeType: EngineType;
  status: TemplateStatus;
  version: number;
  usageCount: number;
  coverImageUrl?: string;
  difficultyLevel?: string;
  durationDays?: number;
  activityCount: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  createdBy?: string;
  wellnessCategory?: string;
  isFeatured?: boolean;
}

// ─── Filters / sort ──────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'draft' | 'published' | 'archived';
type CollectionFilter = 'all' | 'fitness' | 'wellness';
type EngineFilter = 'all' | EngineType;
type SortKey = 'updatedAt' | 'name' | 'usageCount' | 'createdAt';

// ─── Constants ───────────────────────────────────────────────────────────────

const ENGINE_META: Record<EngineType, { emoji: string; label: string; badge: string }> = {
  collective: { emoji: '👥', label: 'Collective', badge: 'bg-blue-100 text-blue-700' },
  competitive: { emoji: '🏆', label: 'Competitive', badge: 'bg-amber-100 text-amber-700' },
  streak: { emoji: '🔥', label: 'Streak', badge: 'bg-orange-100 text-orange-700' },
};

const STATUS_BADGE: Record<TemplateStatus, { bg: string; label: string }> = {
  draft:     { bg: 'bg-amber-100 text-amber-700', label: 'Draft' },
  published: { bg: 'bg-emerald-100 text-emerald-700', label: 'Published' },
  archived:  { bg: 'bg-slate-200 text-slate-600', label: 'Archived' },
  deleted:   { bg: 'bg-red-100 text-red-600', label: 'Deleted' },
};

const COLLECTION_BADGE: Record<TemplateCollection, { label: string; bg: string }> = {
  fitness:  { label: '🏃 Fitness', bg: 'bg-indigo-100 text-indigo-700' },
  wellness: { label: '🌿 Wellness', bg: 'bg-teal-100 text-teal-700' },
};

// ─── Date helper ─────────────────────────────────────────────────────────────

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

// ─── Analytics strip ─────────────────────────────────────────────────────────

interface AnalyticsStripProps {
  templates: AdminTemplate[];
  onFilterStatus: (s: StatusFilter) => void;
  onFilterUnused: () => void;
  onSortUsage: () => void;
}

function AnalyticsStrip({ templates, onFilterStatus, onFilterUnused, onSortUsage }: AnalyticsStripProps) {
  const total = templates.length;
  const published = templates.filter((t) => t.status === 'published').length;
  const draft = templates.filter((t) => t.status === 'draft').length;
  const archived = templates.filter((t) => t.status === 'archived').length;
  const neverUsed = templates.filter((t) => t.usageCount === 0).length;
  const topTemplate = [...templates].sort((a, b) => b.usageCount - a.usageCount)[0];

  const pill = (
    label: string,
    value: number | string,
    action: () => void,
    accent: string,
  ) => (
    <button
      key={label}
      className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 min-w-[80px] ${accent}`}
      onClick={action}
    >
      <span className="text-[18px] font-black leading-none">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
    </button>
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
      {pill('Total', total, () => onFilterStatus('all'), 'text-slate-800')}
      {pill('Published', published, () => onFilterStatus('published'), 'text-emerald-700')}
      {pill('Draft', draft, () => onFilterStatus('draft'), 'text-amber-700')}
      {pill('Archived', archived, () => onFilterStatus('archived'), 'text-slate-600')}
      {pill('Never Used', neverUsed, onFilterUnused, 'text-rose-600')}
      {topTemplate && topTemplate.usageCount > 0 && (
        <button
          className="flex-shrink-0 flex flex-col items-start rounded-2xl border border-slate-200 bg-white px-4 py-2.5 min-w-[120px]"
          onClick={onSortUsage}
        >
          <div className="flex items-center gap-1">
            <TrendingUp size={12} className="text-violet-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">Most Used</span>
          </div>
          <p className="mt-0.5 text-[12px] font-bold text-slate-800 line-clamp-1">{topTemplate.name}</p>
          <p className="text-[10px] text-slate-500">{topTemplate.usageCount} challenge{topTemplate.usageCount !== 1 ? 's' : ''}</p>
        </button>
      )}
    </div>
  );
}

// ─── Bulk action bar ─────────────────────────────────────────────────────────

interface BulkActionBarProps {
  count: number;
  isBusy: boolean;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onClear: () => void;
}

function BulkActionBar({ count, isBusy, onPublish, onArchive, onDelete, onRestore, onClear }: BulkActionBarProps) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-[80px] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-mobile">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[13px] font-black text-slate-900">{count} selected</p>
          <button className="text-[12px] font-semibold text-slate-500 underline" onClick={onClear}>Clear</button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            className="h-9 rounded-xl bg-emerald-600 px-3 text-[12px] font-bold text-white disabled:opacity-50"
            disabled={isBusy}
            onClick={onPublish}
          >
            {isBusy ? '…' : 'Publish'}
          </button>
          <button
            className="h-9 rounded-xl bg-slate-500 px-3 text-[12px] font-bold text-white disabled:opacity-50"
            disabled={isBusy}
            onClick={onArchive}
          >
            {isBusy ? '…' : 'Archive'}
          </button>
          <button
            className="h-9 rounded-xl bg-primary px-3 text-[12px] font-bold text-white disabled:opacity-50"
            disabled={isBusy}
            onClick={onRestore}
          >
            {isBusy ? '…' : 'Restore'}
          </button>
          <button
            className="h-9 rounded-xl bg-red-600 px-3 text-[12px] font-bold text-white disabled:opacity-50"
            disabled={isBusy}
            onClick={onDelete}
          >
            {isBusy ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Per-card action menu ─────────────────────────────────────────────────────

interface MenuButtonProps {
  template: AdminTemplate;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFeature: () => void;
  onUnfeature: () => void;
}

function MenuButton({ template, onEdit, onPublish, onUnpublish, onArchive, onRestore, onDuplicate, onDelete, onFeature, onUnfeature }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  const item = (icon: React.ReactNode, label: string, action: () => void, danger = false) => (
    <button
      key={label}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] font-semibold hover:bg-slate-50 ${danger ? 'text-red-600' : 'text-slate-800'}`}
      onClick={() => { action(); close(); }}
    >
      <span className="flex-shrink-0">{icon}</span>{label}
    </button>
  );

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
        onClick={() => setOpen((p) => !p)}
        aria-label="Template actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-10 z-30 min-w-[170px] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden"
          onMouseLeave={close}
        >
          {template.collection === 'fitness' && item(<Edit2 size={14} />, 'Edit', onEdit)}
          {item(<Copy size={14} />, 'Duplicate & Edit', onDuplicate)}
          {template.status === 'draft' && item(<Eye size={14} />, 'Publish', onPublish)}
          {template.status === 'published' && item(<EyeOff size={14} />, 'Unpublish', onUnpublish)}
          {template.status === 'published' && !template.isFeatured && item(<Star size={14} />, 'Feature', onFeature)}
          {template.status === 'published' && template.isFeatured && item(<Star size={14} />, 'Unfeature', onUnfeature)}
          {(template.status === 'draft' || template.status === 'published') && item(<Archive size={14} />, 'Archive', onArchive)}
          {template.status === 'archived' && item(<RotateCcw size={14} />, 'Restore to Draft', onRestore)}
          {item(<Trash2 size={14} />, 'Delete', onDelete, true)}
        </div>
      )}
    </div>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps extends MenuButtonProps {
  isSelected: boolean;
  onToggleSelect: () => void;
  selectionActive: boolean;
}

function TemplateCard({ template, isSelected, onToggleSelect, selectionActive, ...menuProps }: TemplateCardProps) {
  const meta = ENGINE_META[template.challengeType] ?? ENGINE_META.collective;
  const status = STATUS_BADGE[template.status] ?? STATUS_BADGE.draft;
  const collection = COLLECTION_BADGE[template.collection];

  return (
    <div
      className={`rounded-2xl border bg-white transition-colors ${isSelected ? 'border-primary/60 bg-primary/[0.03]' : 'border-slate-200'}`}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Checkbox */}
        <button
          className={`flex-shrink-0 mt-0.5 transition-opacity ${selectionActive ? 'opacity-100' : 'opacity-0 hover:opacity-60'}`}
          onClick={onToggleSelect}
          aria-label={isSelected ? 'Deselect' : 'Select'}
        >
          {isSelected
            ? <CheckSquare size={18} className="text-primary" />
            : <Square size={18} className="text-slate-400" />}
        </button>

        {/* Cover */}
        {template.coverImageUrl ? (
          <img src={template.coverImageUrl} alt={template.name} className="h-16 w-16 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-2xl">
            {meta.emoji}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-1.5">
            <p className="text-[14px] font-black text-slate-900 leading-tight">{template.name}</p>
            <MenuButton template={template} {...menuProps} />
          </div>

          {/* Badge row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${collection.bg}`}>{collection.label}</span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>{meta.emoji} {meta.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.bg}`}>{status.label}</span>
            {template.isFeatured && (
              <span className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold bg-yellow-100 text-yellow-800">
                <Star size={9} className="fill-yellow-500 text-yellow-500" /> Featured
              </span>
            )}
          </div>

          {/* Description */}
          {template.description && (
            <p className="mt-1.5 text-[11px] text-slate-500 leading-snug line-clamp-2">{template.description}</p>
          )}

          {/* Spec row */}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
            {template.difficultyLevel && <span className="rounded bg-slate-100 px-1.5 py-0.5 capitalize">{template.difficultyLevel}</span>}
            {template.durationDays != null && <span className="rounded bg-slate-100 px-1.5 py-0.5">{template.durationDays}d</span>}
            <span className="rounded bg-slate-100 px-1.5 py-0.5">{template.activityCount} {template.activityCount === 1 ? 'activity' : 'activities'}</span>
            {template.wellnessCategory && <span className="rounded bg-slate-100 px-1.5 py-0.5 capitalize">{template.wellnessCategory}</span>}
          </div>

          {/* Version history row */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-600">v{template.version}</span>
            {template.usageCount > 0 && (
              <span className="flex items-center gap-0.5">
                <BarChart2 size={9} />{template.usageCount} use{template.usageCount !== 1 ? 's' : ''}
              </span>
            )}
            {template.createdAt && <span>Created {fmtDate(template.createdAt)}</span>}
            {template.updatedAt && template.updatedAt !== template.createdAt && (
              <span>Updated {fmtDate(template.updatedAt)}</span>
            )}
            {template.publishedAt && <span>Published {fmtDate(template.publishedAt)}</span>}
            {template.createdBy && <span>by {template.createdBy.slice(0, 8)}…</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm dialog (with usageCount safety warning) ─────────────────────────

type ConfirmType = 'delete' | 'archive' | 'unpublish' | 'bulk-archive' | 'bulk-delete';

interface ConfirmState {
  type: ConfirmType;
  templateName: string;
  usageCount?: number;
  count?: number; // for bulk
}

function ConfirmDialog({ state, onConfirm, onCancel }: { state: ConfirmState; onConfirm: () => void; onCancel: () => void }) {
  const { type, templateName, usageCount, count } = state;

  const copy: Record<ConfirmType, { title: string; body: string; cta: string; danger: boolean }> = {
    delete: {
      title: 'Delete template?',
      body: `"${templateName}" will be soft-deleted and hidden from all views. The Firestore document is retained.`,
      cta: 'Delete',
      danger: true,
    },
    archive: {
      title: 'Archive template?',
      body: `"${templateName}" will be archived and removed from the published list. You can restore it any time.`,
      cta: 'Archive',
      danger: false,
    },
    unpublish: {
      title: 'Unpublish template?',
      body: `"${templateName}" will move to Draft. Members won't see it in the template picker until you republish.`,
      cta: 'Unpublish',
      danger: false,
    },
    'bulk-archive': {
      title: `Archive ${count} templates?`,
      body: `These templates will be archived and removed from the published list. You can restore them any time.`,
      cta: 'Archive All',
      danger: false,
    },
    'bulk-delete': {
      title: `Delete ${count} templates?`,
      body: `These templates will be soft-deleted. The Firestore documents are retained.`,
      cta: 'Delete All',
      danger: true,
    },
  };

  const { title, body, cta, danger } = copy[type];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <p className="text-[16px] font-black text-slate-900">{title}</p>
        <p className="mt-2 text-[13px] text-slate-600 leading-snug">{body}</p>

        {/* Safety warning for in-use templates */}
        {usageCount != null && usageCount > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
            ⚠️ This template has been used to create <strong>{usageCount} challenge{usageCount !== 1 ? 's' : ''}</strong>.
            Those challenges will not be affected, but new users won't be able to select this template.
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="h-10 rounded-xl bg-slate-100 px-4 text-[13px] font-bold text-slate-700" onClick={onCancel}>Cancel</button>
          <button
            className={`h-10 rounded-xl px-4 text-[13px] font-bold text-white ${danger ? 'bg-red-600' : 'bg-primary'}`}
            onClick={onConfirm}
          >
            {cta}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

function ChallengeTemplatesScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { permissions } = useAdminPermissions(user?.uid);
  const queryClient = useQueryClient();

  // Data
  const { data: fitnessData = [], isLoading: fitnessLoading } = useAllAdminTemplates();
  const { data: wellnessData = [], isLoading: wellnessLoading } = useAllAdminWellnessTemplates();

  // Per-item fitness mutations
  const publishF = usePublishTemplate();
  const unpublishF = useUnpublishTemplate();
  const archiveF = useArchiveTemplate();
  const restoreF = useRestoreTemplate();
  const deleteF = useDeleteTemplate();
  const duplicateF = useDuplicateTemplate();
  const featureF = useFeatureTemplate();
  const unfeatureF = useUnfeatureTemplate();

  // Per-item wellness mutations
  const publishW = usePublishWellnessTemplate();
  const unpublishW = useUnpublishWellnessTemplate();
  const archiveW = useArchiveWellnessTemplate();
  const restoreW = useRestoreWellnessTemplate();
  const deleteW = useDeleteWellnessTemplate();
  const duplicateW = useDuplicateWellnessTemplate();
  const featureW = useFeatureWellnessTemplate();
  const unfeatureW = useUnfeatureWellnessTemplate();

  // Filter / sort state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [engineFilter, setEngineFilter] = useState<EngineFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [unusedOnly, setUnusedOnly] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set()); // stores `id`
  const [bulkBusy, setBulkBusy] = useState(false);

  // Confirmation dialog
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const pendingAction = useRef<(() => void) | null>(null);

  // ── Normalize both collections into AdminTemplate[] ──
  const allTemplates = useMemo<AdminTemplate[]>(() => {
    const fit: AdminTemplate[] = fitnessData.map((t) => ({
      id: t.id,
      collection: 'fitness',
      name: t.name,
      description: t.description,
      challengeType: t.challengeType as EngineType,
      status: t.status,
      version: t.version,
      usageCount: t.usageCount,
      coverImageUrl: t.coverImageUrl,
      difficultyLevel: t.difficultyLevel,
      durationDays: t.durationDays,
      activityCount: t.activityCount,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      publishedAt: t.publishedAt,
      createdBy: t.createdBy,
      isFeatured: t.isFeatured,
    }));
    const well: AdminTemplate[] = wellnessData.map((t) => ({
      id: t.id,
      collection: 'wellness',
      name: t.name,
      description: t.description,
      challengeType: t.type as EngineType,
      status: (t.status ?? (t.isPublished ? 'published' : 'draft')) as TemplateStatus,
      version: t.version ?? 1,
      usageCount: t.usageCount ?? 0,
      coverImageUrl: t.coverImage,
      difficultyLevel: t.difficulty,
      durationDays: t.duration,
      activityCount: t.activities.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      publishedAt: t.publishedAt,
      createdBy: t.createdBy,
      wellnessCategory: t.category,
      isFeatured: t.isFeatured,
    }));
    return [...fit, ...well];
  }, [fitnessData, wellnessData]);

  // ── Map for quick lookup ──
  const templateById = useMemo(() => new Map(allTemplates.map((t) => [t.id, t])), [allTemplates]);

  // ── Filtered + sorted list ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTemplates
      .filter((t) => {
        if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
        if (collectionFilter !== 'all' && t.collection !== collectionFilter) return false;
        if (engineFilter !== 'all' && t.challengeType !== engineFilter) return false;
        if (unusedOnly && t.usageCount > 0) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name);
        if (sortKey === 'usageCount') return b.usageCount - a.usageCount;
        if (sortKey === 'createdAt') return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
        return (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? '');
      });
  }, [allTemplates, search, statusFilter, collectionFilter, engineFilter, unusedOnly, sortKey]);

  const counts = useMemo(() => ({
    all: allTemplates.length,
    published: allTemplates.filter((t) => t.status === 'published').length,
    draft: allTemplates.filter((t) => t.status === 'draft').length,
    archived: allTemplates.filter((t) => t.status === 'archived').length,
  }), [allTemplates]);

  const selectionActive = selected.size > 0;

  // ── Toggle selection ──
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  };

  // ── Individual mutate helper ──
  const mutate = async (action: () => Promise<unknown>, successMsg: string, errorMsg: string) => {
    try {
      await action();
      showToast(successMsg, 'success');
    } catch {
      showToast(errorMsg, 'error');
    }
  };

  const confirmThenRun = (state: ConfirmState, action: () => Promise<unknown>, successMsg: string, errorMsg: string) => {
    setConfirmState(state);
    pendingAction.current = () => mutate(action, successMsg, errorMsg).finally(() => setConfirmState(null));
  };

  // ── Duplicate: navigate to edit for fitness, toast for wellness ──
  const handleDuplicate = async (template: AdminTemplate) => {
    try {
      if (template.collection === 'fitness') {
        const newId = await duplicateF.mutateAsync(template.id);
        showToast(`"${template.name}" duplicated. Opening editor…`, 'success');
        navigate(`/app/admin/challenges/templates/${newId}/edit`);
      } else {
        await duplicateW.mutateAsync(template.id);
        showToast(`"${template.name}" duplicated as draft. Edit it from the Wellness list.`, 'success');
      }
    } catch {
      showToast('Could not duplicate template.', 'error');
    }
  };

  // ── Query key invalidation after bulk ops ──
  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-challenge-templates-all'] }),
      queryClient.invalidateQueries({ queryKey: ['suggested-challenge-templates'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-wellness-templates-all'] }),
      queryClient.invalidateQueries({ queryKey: ['wellness-templates'] }),
    ]);

  // ── Bulk operations ──
  const selectedTemplates = useMemo(
    () => Array.from(selected).map((id) => templateById.get(id)).filter((t): t is AdminTemplate => !!t),
    [selected, templateById],
  );

  const runBulk = async (
    action: (t: AdminTemplate) => Promise<unknown>,
    successMsg: string,
  ) => {
    if (!user?.uid) return;
    setBulkBusy(true);
    try {
      await Promise.all(selectedTemplates.map(action));
      await invalidateAll();
      setSelected(new Set());
      showToast(successMsg, 'success');
    } catch {
      showToast('Some operations failed. Refresh and check.', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkPublish = () =>
    runBulk(
      (t) => t.collection === 'fitness'
        ? challengeTemplateService.publishTemplate(t.id, user!.uid)
        : wellnessTemplateService.publishTemplate(t.id, user!.uid),
      `${selectedTemplates.length} template${selectedTemplates.length !== 1 ? 's' : ''} published.`,
    );

  const handleBulkRestore = () =>
    runBulk(
      (t) => t.collection === 'fitness'
        ? challengeTemplateService.restoreTemplate(t.id, user!.uid)
        : wellnessTemplateService.restoreTemplate(t.id, user!.uid),
      `${selectedTemplates.length} template${selectedTemplates.length !== 1 ? 's' : ''} restored to draft.`,
    );

  const handleBulkArchiveConfirmed = () =>
    runBulk(
      (t) => t.collection === 'fitness'
        ? challengeTemplateService.archiveTemplate(t.id, user!.uid)
        : wellnessTemplateService.archiveTemplate(t.id, user!.uid),
      `${selectedTemplates.length} template${selectedTemplates.length !== 1 ? 's' : ''} archived.`,
    );

  const handleBulkDeleteConfirmed = () =>
    runBulk(
      (t) => t.collection === 'fitness'
        ? challengeTemplateService.deleteTemplate(t.id, user!.uid)
        : wellnessTemplateService.deleteTemplate(t.id, user!.uid),
      `${selectedTemplates.length} template${selectedTemplates.length !== 1 ? 's' : ''} deleted.`,
    );

  if (fitnessLoading || wellnessLoading) return <LoadingSpinner fullScreen label="Loading templates…" />;

  return (
    <AdminLayout title="Challenge Templates" permissions={permissions}>
      {/* Analytics strip */}
      <Card className="mb-3">
        <AnalyticsStrip
          templates={allTemplates}
          onFilterStatus={(s) => { setStatusFilter(s); setUnusedOnly(false); }}
          onFilterUnused={() => { setUnusedOnly(true); setStatusFilter('all'); setSortKey('usageCount'); }}
          onSortUsage={() => { setSortKey('usageCount'); setUnusedOnly(false); }}
        />
      </Card>

      {/* Toolbar */}
      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 placeholder:text-slate-400"
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className="h-10 rounded-xl bg-primary px-4 text-[13px] font-bold text-white flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
            disabled={!permissions.canManageContent}
            onClick={() => navigate('/app/admin/challenges/create')}
          >
            <Plus size={15} /> New
          </button>
        </div>

        {/* Collection filter */}
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {([['all', 'All'], ['fitness', '🏃 Fitness'], ['wellness', '🌿 Wellness']] as const).map(([v, label]) => (
            <button
              key={v}
              className={`h-8 rounded-full px-3 text-[11px] font-bold ${collectionFilter === v ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              onClick={() => setCollectionFilter(v)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {(['all', 'published', 'draft', 'archived'] as const).map((s) => (
            <button
              key={s}
              className={`h-8 rounded-full px-3 text-[11px] font-bold capitalize ${statusFilter === s && !unusedOnly ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
              onClick={() => { setStatusFilter(s); setUnusedOnly(false); }}
            >
              {s} ({counts[s]})
            </button>
          ))}
          <button
            className={`h-8 rounded-full px-3 text-[11px] font-bold ${unusedOnly ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            onClick={() => { setUnusedOnly((p) => !p); if (!unusedOnly) setStatusFilter('all'); }}
          >
            Unused
          </button>
        </div>

        {/* Engine filter + sort */}
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <div className="flex gap-1.5 flex-wrap">
            {([['all', 'All Types'], ['collective', '👥 Collective'], ['competitive', '🏆 Competitive'], ['streak', '🔥 Streak']] as const).map(([v, label]) => (
              <button
                key={v}
                className={`h-8 rounded-full px-3 text-[11px] font-bold ${engineFilter === v ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}
                onClick={() => setEngineFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0">
            Sort:
            {(['updatedAt', 'name', 'usageCount', 'createdAt'] as const).map((k) => (
              <button
                key={k}
                className={`h-7 rounded-full px-2 font-semibold ${sortKey === k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                onClick={() => setSortKey(k)}
              >
                {k === 'updatedAt' ? 'Recent' : k === 'name' ? 'Name' : k === 'usageCount' ? 'Usage' : 'Oldest'}
              </button>
            ))}
          </div>
        </div>

        {/* Results row with select-all */}
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</p>
          {filtered.length > 0 && (
            <button
              className="flex items-center gap-1 text-[11px] font-semibold text-primary"
              onClick={toggleSelectAll}
            >
              {selected.size === filtered.length && filtered.length > 0 ? <CheckSquare size={13} /> : <Square size={13} />}
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
      </Card>

      {/* Template list */}
      <div className="mt-3 space-y-2 pb-32">
        {filtered.length === 0 ? (
          <Card>
            {allTemplates.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[28px]">📋</p>
                <p className="mt-2 text-[14px] font-bold text-slate-700">No templates yet</p>
                <p className="mt-1 text-[12px] text-slate-500">Create your first fitness or wellness challenge template.</p>
                <button
                  className="mt-4 h-10 rounded-xl bg-primary px-5 text-[13px] font-bold text-white"
                  onClick={() => navigate('/app/admin/challenges/create')}
                >
                  Create Template
                </button>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-[22px]">🔍</p>
                <p className="mt-2 text-[13px] font-bold text-slate-700">No templates match</p>
                <p className="mt-1 text-[11px] text-slate-500">Try adjusting filters or clearing the search.</p>
                <button
                  className="mt-3 text-[12px] font-semibold text-primary underline"
                  onClick={() => {
                    setSearch(''); setStatusFilter('all'); setCollectionFilter('all');
                    setEngineFilter('all'); setUnusedOnly(false);
                  }}
                >
                  Clear all filters
                </button>
              </div>
            )}
          </Card>
        ) : (
          filtered.map((item) => (
            <TemplateCard
              key={`${item.collection}-${item.id}`}
              template={item}
              isSelected={selected.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              selectionActive={selectionActive}
              onEdit={() => navigate(`/app/admin/challenges/templates/${item.id}/edit`)}
              onPublish={() => mutate(
                () => item.collection === 'fitness' ? publishF.mutateAsync(item.id) : publishW.mutateAsync(item.id),
                `"${item.name}" published.`, 'Could not publish.',
              )}
              onUnpublish={() => confirmThenRun(
                { type: 'unpublish', templateName: item.name },
                () => item.collection === 'fitness' ? unpublishF.mutateAsync(item.id) : unpublishW.mutateAsync(item.id),
                `"${item.name}" unpublished.`, 'Could not unpublish.',
              )}
              onArchive={() => confirmThenRun(
                { type: 'archive', templateName: item.name, usageCount: item.usageCount },
                () => item.collection === 'fitness' ? archiveF.mutateAsync(item.id) : archiveW.mutateAsync(item.id),
                `"${item.name}" archived.`, 'Could not archive.',
              )}
              onRestore={() => mutate(
                () => item.collection === 'fitness' ? restoreF.mutateAsync(item.id) : restoreW.mutateAsync(item.id),
                `"${item.name}" restored to draft.`, 'Could not restore.',
              )}
              onDuplicate={() => handleDuplicate(item)}
              onDelete={() => confirmThenRun(
                { type: 'delete', templateName: item.name, usageCount: item.usageCount },
                () => item.collection === 'fitness' ? deleteF.mutateAsync(item.id) : deleteW.mutateAsync(item.id),
                `"${item.name}" deleted.`, 'Could not delete.',
              )}
              onFeature={() => mutate(
                () => item.collection === 'fitness' ? featureF.mutateAsync(item.id) : featureW.mutateAsync(item.id),
                `"${item.name}" featured.`, 'Could not feature template.',
              )}
              onUnfeature={() => mutate(
                () => item.collection === 'fitness' ? unfeatureF.mutateAsync(item.id) : unfeatureW.mutateAsync(item.id),
                `"${item.name}" unfeatured.`, 'Could not unfeature template.',
              )}
            />
          ))
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        isBusy={bulkBusy}
        onPublish={handleBulkPublish}
        onArchive={() => {
          const inUse = selectedTemplates.filter((t) => t.usageCount > 0).length;
          if (inUse > 0) {
            setConfirmState({ type: 'bulk-archive', templateName: '', count: selectedTemplates.length });
            pendingAction.current = () => handleBulkArchiveConfirmed().finally(() => setConfirmState(null));
          } else {
            handleBulkArchiveConfirmed();
          }
        }}
        onDelete={() => {
          setConfirmState({ type: 'bulk-delete', templateName: '', count: selectedTemplates.length });
          pendingAction.current = () => handleBulkDeleteConfirmed().finally(() => setConfirmState(null));
        }}
        onRestore={handleBulkRestore}
        onClear={() => setSelected(new Set())}
      />

      {/* Confirmation dialog */}
      {confirmState && (
        <ConfirmDialog
          state={confirmState}
          onConfirm={() => { pendingAction.current?.(); }}
          onCancel={() => { pendingAction.current = null; setConfirmState(null); }}
        />
      )}
    </AdminLayout>
  );
}

export default ChallengeTemplatesScreen;
