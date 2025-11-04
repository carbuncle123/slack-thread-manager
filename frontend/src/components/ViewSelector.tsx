import React from 'react';
import type { ThreadView, ViewFilters, ViewSort } from '../types';
import './ViewSelector.css';

interface ViewSelectorProps {
  views: ThreadView[];
  selectedViewId: string | null;
  onSelectView: (viewId: string | null) => void;
  currentFilters: ViewFilters;
  currentSort: ViewSort;
}

export const ViewSelector: React.FC<ViewSelectorProps> = ({
  views,
  selectedViewId,
  onSelectView,
  currentFilters,
  currentSort,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onSelectView(value === '' ? null : value);
  };

  // 現在のフィルタ条件が選択中のビューと一致するかチェック
  const isModified = React.useMemo(() => {
    if (!selectedViewId) return false;

    const selectedView = views.find(v => v.id === selectedViewId);
    if (!selectedView) return false;

    // フィルタ条件を比較
    const filtersMatch =
      JSON.stringify(currentFilters.tags.sort()) === JSON.stringify(selectedView.filters.tags.sort()) &&
      currentFilters.is_read === selectedView.filters.is_read &&
      currentFilters.search === selectedView.filters.search &&
      currentFilters.date_from === selectedView.filters.date_from &&
      currentFilters.date_to === selectedView.filters.date_to &&
      currentFilters.has_new_messages === selectedView.filters.has_new_messages;

    // ソート条件を比較
    const sortMatch =
      currentSort.sort_by === selectedView.sort.sort_by &&
      currentSort.sort_order === selectedView.sort.sort_order;

    return !filtersMatch || !sortMatch;
  }, [selectedViewId, views, currentFilters, currentSort]);

  return (
    <div className="view-selector">
      <label htmlFor="view-select">ビュー:</label>
      <select
        id="view-select"
        value={selectedViewId || ''}
        onChange={handleChange}
        className="view-select"
      >
        <option value="">すべてのスレッド</option>
        {views.length > 0 && <option disabled>─────────────</option>}
        {views.map((view) => (
          <option key={view.id} value={view.id}>
            {view.is_default && '★ '}{view.name}
          </option>
        ))}
      </select>
      {isModified && <span className="view-modified">(編集済み)</span>}
    </div>
  );
};
