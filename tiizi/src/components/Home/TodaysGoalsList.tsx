import { Check } from 'lucide-react';

interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

interface TodaysGoalsListProps {
  goals: Goal[];
  onSelectGoal?: (goal: Goal) => void;
}

export function TodaysGoalsList({ goals, onSelectGoal }: TodaysGoalsListProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {goals.map((goal, index) => (
        <div key={goal.id} className={`flex items-center justify-between gap-2 px-4 py-4 ${index < goals.length - 1 ? 'border-b border-slate-100' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            {goal.completed ? (
              <span className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center"><Check size={17} /></span>
            ) : (
              <span className="h-9 w-9 rounded-full border-[3px] border-slate-300" />
            )}
            <p className={`text-[16px] leading-[20px] ${goal.completed ? 'text-slate-400 line-through' : 'text-slate-900'} truncate`}>{goal.text}</p>
          </div>
          {goal.completed && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[12px] leading-[14px] font-bold text-primary">DONE</span>
          )}
          {!goal.completed && (
            <button className="text-[24px] leading-none text-slate-400" onClick={() => onSelectGoal?.(goal)}>›</button>
          )}
        </div>
      ))}
    </article>
  );
}
