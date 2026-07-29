import { categories } from '../data.js';

export default function CategoryBar({ value, onChange, hideAll = false, tone = 'found' }) {
  const list = hideAll ? categories.filter((entry) => entry !== '全部') : categories;
  return (
    <div className={`category-bar ${tone}`}>
      {list.map((entry) => (
        <button
          key={entry}
          className={`tag ${value === entry ? 'active' : ''}`}
          type="button"
          onClick={() => onChange(entry)}
        >
          {entry}
        </button>
      ))}
    </div>
  );
}
