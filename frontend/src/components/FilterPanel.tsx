import React from 'react';
import './FilterPanel.css';

export interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
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
      dateFrom: '',
      dateTo: '',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className="filter-panel-compact">
      <div className="filter-row">
        {/* 検索ボックス */}
        <div className="filter-item">
          <input
            id="search-input"
            type="text"
            placeholder="タイトル、要約を検索..."
            value={filters.search}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        {/* 日付範囲フィルター */}
        <div className="filter-item date-range">
          <input
            id="date-from"
            type="date"
            value={filters.dateFrom}
            onChange={handleDateFromChange}
            className="date-input"
            placeholder="開始日"
          />
          <span className="date-separator">〜</span>
          <input
            id="date-to"
            type="date"
            value={filters.dateTo}
            onChange={handleDateToChange}
            className="date-input"
            placeholder="終了日"
          />
        </div>

        {/* クリアボタン */}
        {hasActiveFilters && (
          <button onClick={handleClearFilters} className="clear-filters-btn">
            クリア
          </button>
        )}
      </div>
    </div>
  );
};
