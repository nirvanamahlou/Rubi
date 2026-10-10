import {
  Banknote,
  Plane,
  Bot,
  Handshake,
  IdCard,
  UsersRound,
  BriefcaseBusiness,
} from 'lucide-react';
const icons = {
  finance: Banknote,
  reservations: Plane,
  ai: Bot,
  sales: Handshake,
  visa: IdCard,
  hr: UsersRound,
  management: BriefcaseBusiness,
};
export function MessageUnitIcon({ id }: { id: keyof typeof icons }) {
  const Icon = icons[id];
  return <Icon className="size-5 shrink-0" aria-hidden="true" />;
}
