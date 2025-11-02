import React from 'react';
import './FilterPanel.css';

export interface FilterState {
  search: string;
  tags: string[];
  isRead: 'all' | 'read' | 'unread';
  dateFrom: string;
  dateTo: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableTags: string[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  availableTags,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const handleIsReadChange = (value: 'all' | 'read' | 'unread') => {
    onFiltersChange({ ...filters, isRead: value });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, dateFrom: e.target.value });
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, dateTo: e.target.value });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      tags: [],
      isRead: 'all',
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.tags.length > 0 ||
    filters.isRead !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>フィルター</h3>
        {hasActiveFilters && (
          <button onClick={handleClearFilters} className="clear-filters-btn">
            クリア
          </button>
        )}
      </div>

      {/* 検索ボックス */}
      <div className="filter-section">
        <label htmlFor="search-input">検索</label>
        <input
          id="search-input"
          type="text"
          placeholder="タイトル、要約を検索..."
          value={filters.search}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>

      {/* タグフィルター */}
      <div className="filter-section">
        <label>タグ</label>
        <div className="tag-filter-list">
          {availableTags.length === 0 ? (
            <p className="no-tags">タグがありません</p>
          ) : (
            availableTags.map(tag => (
              <label key={tag} className="tag-checkbox">
                <input
                  type="checkbox"
                  checked={filters.tags.includes(tag)}
                  onChange={() => handleTagToggle(tag)}
                />
                <span className="tag-label">{tag}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* 既読/未読フィルター */}
      <div className="filter-section">
        <label>ステータス</label>
        <div className="read-status-filter">
          <label className="radio-label">
            <input
              type="radio"
              name="isRead"
              checked={filters.isRead === 'all'}
              onChange={() => handleIsReadChange('all')}
            />
            <span>すべて</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="isRead"
              checked={filters.isRead === 'unread'}
              onChange={() => handleIsReadChange('unread')}
            />
            <span>未読のみ</span>
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="isRead"
              checked={filters.isRead === 'read'}
              onChange={() => handleIsReadChange('read')}
            />
            <span>既読のみ</span>
          </label>
        </div>
      </div>

      {/* 日付範囲フィルター */}
      <div className="filter-section">
        <label>更新日</label>
        <div className="date-range-filter">
          <div className="date-input-group">
            <label htmlFor="date-from">開始日</label>
            <input
              id="date-from"
              type="date"
              value={filters.dateFrom}
              onChange={handleDateFromChange}
              className="date-input"
            />
          </div>
          <div className="date-input-group">
            <label htmlFor="date-to">終了日</label>
            <input
              id="date-to"
              type="date"
              value={filters.dateTo}
              onChange={handleDateToChange}
              className="date-input"
            />
          </div>
        </div>
      </div>

      {/* アクティブなフィルター表示 */}
      {hasActiveFilters && (
        <div className="active-filters">
          <h4>適用中のフィルター:</h4>
          <div className="active-filter-tags">
            {filters.search && (
              <span className="active-filter-tag">
                検索: "{filters.search}"
              </span>
            )}
            {filters.tags.map(tag => (
              <span key={tag} className="active-filter-tag">
                タグ: {tag}
                <button
                  onClick={() => handleTagToggle(tag)}
                  className="remove-filter-btn"
                >
                  ×
                </button>
              </span>
            ))}
            {filters.isRead !== 'all' && (
              <span className="active-filter-tag">
                {filters.isRead === 'read' ? '既読' : '未読'}
              </span>
            )}
            {filters.dateFrom && (
              <span className="active-filter-tag">
                開始: {filters.dateFrom}
              </span>
            )}
            {filters.dateTo && (
              <span className="active-filter-tag">
                終了: {filters.dateTo}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
