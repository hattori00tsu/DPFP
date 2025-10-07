'use client';

import { useState, useEffect } from 'react';
import { FilterState, PostCategory, PostSourceType, EventType } from '@/types/index';
import { Search, ListFilter as Filter, X, ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';
import { filterDefaultsService } from '@/lib/supabase-filter-defaults';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { prefectures } from '@/public/prefecture';
import { politicianTypeLabels } from '@/public/category';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  politicians: Array<{ id: string; name: string }>;
  regions: string[];
}

interface MultiSelectFilterState {
  newsCategories: PostCategory[];
  eventCategories: EventType[];
  prefectures: string[];
  snsCategories: PostSourceType[];
}

export function FilterBar({ filters, onFilterChange, politicians, regions }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [multiSelectFilters, setMultiSelectFilters] = useState<MultiSelectFilterState>({
    newsCategories: ['policy', 'media', 'parliament'], // デフォルト全選択
    eventCategories: ['rally', 'volunteer', 'meeting', 'other'], // デフォルト全選択
    prefectures: [
      '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
      '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
      '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
      '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
      '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
      '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
      '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
    ], // デフォルトは全国
    snsCategories: ['party_hq', 'politician', 'sns'], // デフォルト全選択
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientComponentClient();

  // ユーザー情報とデフォルト設定を読み込み
  useEffect(() => {
    const loadUserDefaults = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          const defaults = await filterDefaultsService.getOrCreateUserFilterDefaults(user.id);
          if (defaults) {
            const newFilters = {
              newsCategories: defaults.news_categories,
              eventCategories: defaults.event_categories,
              prefectures: defaults.prefectures,
              snsCategories: defaults.sns_categories,
            };
            setMultiSelectFilters(newFilters);
            
            // 親コンポーネントにデフォルト値を通知
            onFilterChange({
              ...filters,
              newsCategories: newFilters.newsCategories,
              eventCategories: newFilters.eventCategories,
              prefectures: newFilters.prefectures,
              snsCategories: newFilters.snsCategories,
            });
          }
        }
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    loadUserDefaults();
  }, []);

  const newsCategories: Array<{ value: PostCategory; label: string }> = [
    { value: 'policy', label: '政策' },
    { value: 'media', label: 'メディア' },
    { value: 'parliament', label: '国会' },
  ];

  const eventCategories: Array<{ value: EventType; label: string }> = [
    { value: 'rally', label: '集会・演説' },
    { value: 'volunteer', label: 'ボランティア' },
    { value: 'meeting', label: '会議・懇談' },
    { value: 'other', label: 'その他' },
  ];

  const snsCategories: Array<{ value: PostSourceType; label: string }> = [
    { value: 'party_hq', label: '党本部' },
    { value: 'politician', label: '議員' },
    { value: 'sns', label: 'SNS' },
  ];


  // 複数選択の処理関数
  const handleMultiSelectChange = async <T extends string>(
    category: keyof MultiSelectFilterState,
    value: T,
    checked: boolean
  ) => {
    const newFilters = {
      ...multiSelectFilters,
      [category]: checked
        ? [...(multiSelectFilters[category] as T[]), value]
        : (multiSelectFilters[category] as T[]).filter(item => item !== value)
    };
    setMultiSelectFilters(newFilters);
    
    // 親コンポーネントに変更を通知
    onFilterChange({
      ...filters,
      newsCategories: newFilters.newsCategories,
      eventCategories: newFilters.eventCategories,
      prefectures: newFilters.prefectures,
      snsCategories: newFilters.snsCategories,
    });

    // Supabaseに保存
    if (userId) {
      await filterDefaultsService.updateUserFilterDefaults(userId, {
        news_categories: newFilters.newsCategories,
        event_categories: newFilters.eventCategories,
        prefectures: newFilters.prefectures,
        sns_categories: newFilters.snsCategories,
      });
    }
  };

  // 全選択/全解除の処理
  const handleSelectAll = async (category: keyof MultiSelectFilterState, items: string[]) => {
    const newFilters = {
      ...multiSelectFilters,
      [category]: items
    };
    setMultiSelectFilters(newFilters);
    
    onFilterChange({
      ...filters,
      newsCategories: newFilters.newsCategories,
      eventCategories: newFilters.eventCategories,
      prefectures: newFilters.prefectures,
      snsCategories: newFilters.snsCategories,
    });

    // Supabaseに保存
    if (userId) {
      await filterDefaultsService.updateUserFilterDefaults(userId, {
        news_categories: newFilters.newsCategories,
        event_categories: newFilters.eventCategories,
        prefectures: newFilters.prefectures,
        sns_categories: newFilters.snsCategories,
      });
    }
  };

  const handleDeselectAll = async (category: keyof MultiSelectFilterState) => {
    const newFilters = {
      ...multiSelectFilters,
      [category]: []
    };
    setMultiSelectFilters(newFilters);
    
    onFilterChange({
      ...filters,
      newsCategories: newFilters.newsCategories,
      eventCategories: newFilters.eventCategories,
      prefectures: newFilters.prefectures,
      snsCategories: newFilters.snsCategories,
    });

    // Supabaseに保存
    if (userId) {
      await filterDefaultsService.updateUserFilterDefaults(userId, {
        news_categories: newFilters.newsCategories,
        event_categories: newFilters.eventCategories,
        prefectures: newFilters.prefectures,
        sns_categories: newFilters.snsCategories,
      });
    }
  };

  const handleClearFilters = async () => {
    onFilterChange({
      region: null,
      politician: null,
      category: null,
      sourceType: null,
      dateFrom: null,
      dateTo: null,
      search: '',
    });
    
    // ユーザーのデフォルト値にリセット
    if (userId) {
      const defaults = await filterDefaultsService.getUserFilterDefaults(userId);
      if (defaults) {
        const newFilters = {
          newsCategories: defaults.news_categories,
          eventCategories: defaults.event_categories,
          prefectures: defaults.prefectures,
          snsCategories: defaults.sns_categories,
        };
        setMultiSelectFilters(newFilters);
        onFilterChange({
          region: null,
          politician: null,
          category: null,
          sourceType: null,
          dateFrom: null,
          dateTo: null,
          search: '',
          newsCategories: newFilters.newsCategories,
          eventCategories: newFilters.eventCategories,
          prefectures: newFilters.prefectures,
          snsCategories: newFilters.snsCategories,
        });
      }
    } else {
      // ログインしていない場合はハードコードされたデフォルト値
      const defaultFilters = {
        newsCategories: ['policy', 'media', 'parliament'] as PostCategory[],
        eventCategories: ['rally', 'volunteer', 'meeting', 'other'] as EventType[],
        prefectures: prefectures.map(p => p.id),
        snsCategories: ['party_hq', 'politician', 'sns'] as PostSourceType[],
      };
      setMultiSelectFilters(defaultFilters);
      onFilterChange({
        region: null,
        politician: null,
        category: null,
        sourceType: null,
        dateFrom: null,
        dateTo: null,
        search: '',
        ...defaultFilters,
      });
    }
  };

  const hasActiveFilters = Object.values(filters).some((value) =>
    value !== null && value !== ''
  ) || multiSelectFilters.prefectures.length !== prefectures.length;

  // 複数選択ドロップダウンコンポーネント
  const MultiSelectDropdown = ({ 
    label, 
    items, 
    selectedItems, 
    onItemChange, 
    onSelectAll, 
    onDeselectAll 
  }: {
    label: string;
    items: Array<{ value: string; label: string }>;
    selectedItems: string[];
    onItemChange: (value: string, checked: boolean) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
  }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-left flex items-center justify-between"
          >
            <span className="truncate">
              {selectedItems.length === 0 
                ? 'なし' 
                : selectedItems.length === items.length 
                ? 'すべて' 
                : `${selectedItems.length}件選択`}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {isOpen && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
              <div className="p-2 border-b border-gray-200 flex space-x-2">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  すべて選択
                </button>
                <button
                  type="button"
                  onClick={onDeselectAll}
                  className="text-xs text-gray-600 hover:text-gray-800"
                >
                  すべて解除
                </button>
              </div>
              {items.map((item) => (
                <label key={item.value} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.value)}
                    onChange={(e) => onItemChange(item.value, e.target.checked)}
                    className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="キーワードで検索..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2"
        >
          <Filter className="w-4 h-4" />
          <span>フィルター</span>
          {hasActiveFilters && (
            <span className="ml-2 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              !
            </span>
          )}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleClearFilters} size="sm">
            <X className="w-4 h-4 mr-1" />
            クリア
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MultiSelectDropdown
              label="ニュースカテゴリー"
              items={newsCategories}
              selectedItems={multiSelectFilters.newsCategories}
              onItemChange={(value, checked) => handleMultiSelectChange('newsCategories', value as PostCategory, checked)}
              onSelectAll={() => handleSelectAll('newsCategories', newsCategories.map(c => c.value))}
              onDeselectAll={() => handleDeselectAll('newsCategories')}
            />

            <MultiSelectDropdown
              label="イベントカテゴリー"
              items={eventCategories}
              selectedItems={multiSelectFilters.eventCategories}
              onItemChange={(value, checked) => handleMultiSelectChange('eventCategories', value as EventType, checked)}
              onSelectAll={() => handleSelectAll('eventCategories', eventCategories.map(c => c.value))}
              onDeselectAll={() => handleDeselectAll('eventCategories')}
            />

            <MultiSelectDropdown
              label="都道府県"
              items={prefectures.map(p => ({ value: p.id, label: p.name_ja }))}
              selectedItems={multiSelectFilters.prefectures}
              onItemChange={(value, checked) => handleMultiSelectChange('prefectures', value, checked)}
              onSelectAll={() => handleSelectAll('prefectures', prefectures.map(p => p.id)  )}
              onDeselectAll={() => handleDeselectAll('prefectures')}
            />

            <MultiSelectDropdown
              label="SNSカテゴリー"
              items={snsCategories}
              selectedItems={multiSelectFilters.snsCategories}
              onItemChange={(value, checked) => handleMultiSelectChange('snsCategories', value as PostSourceType, checked)}
              onSelectAll={() => handleSelectAll('snsCategories', snsCategories.map(c => c.value))}
              onDeselectAll={() => handleDeselectAll('snsCategories')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">議員</label>
              <select
                value={filters.politician || ''}
                onChange={(e) => onFilterChange({ ...filters, politician: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">すべて</option>
                {politicians.map((politician) => (
                  <option key={politician.id} value={politician.id}>
                    {politician.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
