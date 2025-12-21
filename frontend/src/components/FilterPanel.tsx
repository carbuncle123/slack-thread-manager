import React, { useState, useEffect, useRef } from 'react';
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
  // ローカルstateで入力値を管理（即座に反映）
  const [localSearch, setLocalSearch] = useState(filters.search);
  const [localDateFrom, setLocalDateFrom] = useState(filters.dateFrom);
  const [localDateTo, setLocalDateTo] = useState(filters.dateTo);

  // debounce用のタイマーref
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 親からのfilters変更を反映（ビュー切り替え時など）
  useEffect(() => {
    setLocalSearch(filters.search);
    setLocalDateFrom(filters.dateFrom);
    setLocalDateTo(filters.dateTo);
  }, [filters.search, filters.dateFrom, filters.dateTo]);

  // debounce後の親への通知
  useEffect(() => {
    // タイマーをクリア
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 300ms後に親に通知
    debounceTimer.current = setTimeout(() => {
      onFiltersChange({
        search: localSearch,
        dateFrom: localDateFrom,
        dateTo: localDateTo
      });
    }, 300);

    // クリーンアップ
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [localSearch, localDateFrom, localDateTo, onFiltersChange]);

  // 検索入力の変更ハンドラ（ローカルstateのみ更新）
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  };

  // 日付FROM変更ハンドラ（ローカルstateのみ更新）
  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDateFrom(e.target.value);
  };

  // 日付TO変更ハンドラ（ローカルstateのみ更新）
  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDateTo(e.target.value);
  };

  // クリアハンドラ（ローカルstateのみ更新）
  const handleClearFilters = () => {
    setLocalSearch('');
    setLocalDateFrom('');
    setLocalDateTo('');
  };

  const hasActiveFilters =
    localSearch ||
    localDateFrom ||
    localDateTo;

  return (
    <div className="filter-panel-compact">
      <div className="filter-row">
        {/* 検索ボックス */}
        <div className="filter-item">
          <input
            id="search-input"
            type="text"
            placeholder="タイトル、要約を検索..."
            value={localSearch}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        {/* 日付範囲フィルター */}
        <div className="filter-item date-range">
          <input
            id="date-from"
            type="date"
            value={localDateFrom}
            onChange={handleDateFromChange}
            className="date-input"
            placeholder="開始日"
          />
          <span className="date-separator">〜</span>
          <input
            id="date-to"
            type="date"
            value={localDateTo}
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
