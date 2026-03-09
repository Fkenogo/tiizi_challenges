import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';
import { useAuth } from '../../hooks/useAuth';
import { useMarkAllNotificationsRead, useNotifications } from '../../hooks/useNotifications';

function formatRelativeTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Recently';
  const deltaMs = Date.now() - ts;
  const minutes = Math.floor(deltaMs / (60 * 1000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function NotificationsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: items = [] } = useNotifications(user?.uid);
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <Screen>
      <Section title="Notifications">
        <Card className="mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-primary" />
              <p className="text-sm font-bold text-slate-900">Activity Inbox</p>
            </div>
            <button
              className="h-9 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold disabled:opacity-60"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending || items.length === 0}
            >
              <CheckCheck size={14} className="inline-block mr-1" />
              Mark all read
            </button>
          </div>
        </Card>

        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} variant="flat" className={item.unread ? 'border-primary/30 bg-primary/5' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{item.message}</p>
                </div>
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{formatRelativeTime(item.createdAt)}</span>
              </div>
            </Card>
          ))}
          {items.length === 0 && (
            <Card variant="flat">
              <p className="text-xs text-slate-500">No notifications yet.</p>
            </Card>
          )}
        </div>

        <Card className="mt-3">
          <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/home')}>
            Back to Home
          </button>
        </Card>
      </Section>
    </Screen>
  );
}

export default NotificationsScreen;
