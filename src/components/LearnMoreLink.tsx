import { useNavigate } from 'react-router-dom';

interface Props {
  section: string;
  label?: string;
  className?: string;
}

/**
 * Subtle inline link that opens the Learn Tiizi guide at a specific section.
 * Usage: <LearnMoreLink section="groups" />
 */
export function LearnMoreLink({ section, label = 'Learn more', className = '' }: Props) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/app/profile/learn-tiizi?section=${section}`)}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--primary)',
        fontSize: 12,
        fontWeight: 600,
        textDecoration: 'underline',
        textUnderlineOffset: 2,
        WebkitTapHighlightColor: 'transparent',
        lineHeight: '16px',
        opacity: 0.85,
      }}
    >
      {label}
    </button>
  );
}
