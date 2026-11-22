import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Building2, Search, ShieldCheck } from 'lucide-react';
import {
  COMPANY_CATEGORIES,
  COMPANY_SORTS,
  MAX_COMPANIES_PER_REQUEST,
  type CompanyCategory,
  type CompanySort,
} from '@mirhalgo/shared';
import { Button, EmptyState, QueryState, RadioGroup, Select } from '../../../components/ui';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { useCompanies } from '../../../services/api/queries';
import { CompanyCardView } from './CompanyCardView';

const sendTo = (ids: string[]) => `/app/new-request?companies=${ids.join(',')}`;

/** /app/companies (spec B5). */
export default function CompaniesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [category, setCategory] = useState<CompanyCategory | ''>('');
  const [sort, setSort] = useState<CompanySort>('top_rated');
  const [selected, setSelected] = useState<string[]>([]);
  const companies = useCompanies({ search, category, sort });

  const toggle = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id]));

  return (
    <div className="flex flex-col gap-5 pb-20">
      <section className="flex items-start gap-4 rounded-lg bg-blue-50 p-5">
        <ShieldCheck aria-hidden="true" className="size-8 shrink-0 text-blue-600" />
        <div>
          <h2 className="text-h3">{t('portal.companies.introTitle')}</h2>
          <p className="text-small text-body">{t('portal.companies.introText')}</p>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
        <div className="relative">
          <label
            htmlFor="companies-search"
            className="mb-1.5 block text-small font-semibold text-heading"
          >
            {t('portal.companies.search')}
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 bottom-3 size-5 text-muted"
          />
          <input
            id="companies-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-(--btn-height) w-full rounded-sm border border-slate-200 bg-white ps-10 pe-4 text-heading shadow-sm focus:border-blue-600 focus:bg-blue-50"
          />
        </div>
        <Select
          label={t('portal.companies.sort')}
          value={sort}
          onChange={(event) => setSort(event.target.value as CompanySort)}
          options={COMPANY_SORTS.map((value) => ({
            value,
            label: t(`portal.companies.sorts.${value}`),
          }))}
        />
      </div>

      <RadioGroup
        legend={t('portal.companies.filter')}
        value={category || 'all'}
        onChange={(value) => setCategory(value === 'all' ? '' : value)}
        options={[
          { value: 'all' as const, label: t('portal.companies.all') },
          ...COMPANY_CATEGORIES.map((value) => ({
            value,
            label: t(`portal.companies.categories.${value}`),
          })),
        ]}
      />

      <QueryState
        query={companies}
        isEmpty={(list) => list.length === 0}
        empty={
          <EmptyState
            icon={Building2}
            title={t('portal.companies.empty')}
            text={t('portal.companies.emptyText')}
          />
        }
      >
        {(list) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p aria-live="polite" className="text-small text-muted">
                {t('portal.companies.count', {
                  count: list.length,
                  formatted: list.length.toLocaleString(i18n.language),
                })}
              </p>
              {category && (
                <Button
                  variant="secondary"
                  shape="form"
                  onClick={() =>
                    navigate(sendTo(list.slice(0, MAX_COMPANIES_PER_REQUEST).map((c) => c.id)))
                  }
                >
                  {t('portal.companies.sendToCategory', {
                    category: t(`portal.companies.categories.${category}`),
                    max: MAX_COMPANIES_PER_REQUEST.toLocaleString(i18n.language),
                  })}
                </Button>
              )}
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((company) => (
                <li key={company.id}>
                  <CompanyCardView
                    company={company}
                    selected={selected.includes(company.id)}
                    onToggle={() => toggle(company.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryState>

      {selected.length > 0 && (
        <div
          role="region"
          aria-label={t('portal.companies.bulkLabel')}
          className="fixed inset-x-4 bottom-20 z-20 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-lg bg-navy-900 p-4 text-on-dark shadow-lg md:bottom-6"
        >
          <p className="flex-1 font-semibold">
            {t('portal.companies.selected', {
              count: selected.length,
              formatted: selected.length.toLocaleString(i18n.language),
            })}
          </p>
          {selected.length > MAX_COMPANIES_PER_REQUEST && (
            <p className="w-full text-small text-on-dark-muted">
              {t('portal.companies.tooMany', {
                max: MAX_COMPANIES_PER_REQUEST.toLocaleString(i18n.language),
              })}
            </p>
          )}
          <Button variant="onDark" shape="form" onClick={() => setSelected([])}>
            {t('portal.companies.clear')}
          </Button>
          <Button
            shape="form"
            disabled={selected.length > MAX_COMPANIES_PER_REQUEST}
            onClick={() => navigate(sendTo(selected))}
          >
            {t('portal.companies.sendSelected')}
          </Button>
        </div>
      )}
    </div>
  );
}
