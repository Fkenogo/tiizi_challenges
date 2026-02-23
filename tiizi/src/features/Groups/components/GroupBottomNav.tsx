import { BottomNav } from '../../../components/Layout';

type Props = {
  active: 'home' | 'groups' | 'challenges' | 'profile';
};

export function GroupBottomNav({ active }: Props) {
  return <BottomNav active={active} />;
}
