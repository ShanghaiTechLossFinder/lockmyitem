import { sensitivityBadgeText } from '../privacy.js';

export default function SensitivityBadge({ item }) {
  const label = sensitivityBadgeText(item);
  if (!label) return null;
  return <span className={`sensitivity-badge ${item.sensitivityLevel || 'normal'}`}>{label}</span>;
}
