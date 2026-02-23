import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
};

const initialNotifications: NotificationItem[] = [
  { id: 'n1', title: 'Challenge reminder', message: 'Your 30-Day Core Blast session is due today.', time: '5m ago', unread: true },
  { id: 'n2', title: 'Group update', message: 'Marathon Group added a new challenge.', time: '1h ago', unread: true },
  { id: 'n3', title: 'Streak progress', message: 'You are on a 7-day streak. Keep going.', time: 'Yesterday', unread: false },
];

function NotificationsScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState(initialNotifications);

  const markAllRead = () => {
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  return (
    <Screen>
      <Section title="Notifications">
        <Card className="mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-primary" />
              <p className="text-sm font-bold text-slate-900">Activity Inbox</p>
            </div>
            <button className="h-9 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold" onClick={markAllRead}>
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
                <span className="text-[11px] text-slate-500 whitespace-nowrap">{item.time}</span>
              </div>
            </Card>
          ))}
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

