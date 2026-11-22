import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock, ThumbsDown, ThumbsUp } from 'lucide-react';
import { PORTAL_LIMITS, reviewSchema, type CompanyProfile, type Review } from '@mirhalgo/shared';
import {
  Alert,
  Avatar,
  Button,
  QueryState,
  Select,
  Skeleton,
  StarRating,
  StarRatingInput,
  Textarea,
  buttonClasses,
} from '../../../components/ui';
import { useDateFormat } from '../../../lib/dateFormat';
import { useZodForm } from '../../../lib/forms';
import { cn } from '../../../lib/utils';
import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation, useCompany, useReviews } from '../../../services/api/queries';
import { useCompanyIdentity } from '../components/companyIdentity';

function RateForm({ company }: { company: CompanyProfile }) {
  const { t } = useTranslation();
  const form = useZodForm(reviewSchema, { defaultValues: { comment: '' } });
  const rate = useApiMutation(
    (input: Parameters<typeof portalApi.rateCompany>[1]) =>
      portalApi.rateCompany(company.id, input),
    {
      setData: keys.company(company.id),
      invalidate: [['companies', 'reviews', company.id], keys.companies],
      success: 'portal.rate.thanks',
    },
  );

  if (!company.canRate) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-small text-body">
        <Lock aria-hidden="true" className="size-5 shrink-0 text-muted" />
        {t('portal.rate.locked')}
      </div>
    );
  }
  if (company.myRating)
    return <Alert tone="success">{t('portal.rate.done', { rating: company.myRating })}</Alert>;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => rate.mutate(values))}
      className="flex flex-col gap-4"
    >
      <Controller
        control={form.control}
        name="rating"
        render={({ field, fieldState }) => (
          <StarRatingInput
            legend={t('portal.rate.stars')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Textarea
        label={t('portal.rate.comment')}
        rows={3}
        maxLength={PORTAL_LIMITS.review.max}
        error={form.formState.errors.comment?.message}
        {...form.register('comment')}
      />
      <Button type="submit" shape="form" className="self-start" loading={rate.isPending}>
        {t('portal.rate.submit')}
      </Button>
    </form>
  );
}

function ReviewItem({ companyId, review }: { companyId: string; review: Review }) {
  const { t, i18n } = useTranslation();
  const { formatDate } = useDateFormat();
  const react = useApiMutation(
    (reaction: Review['myReaction']) => portalApi.reactToReview(companyId, review.id, reaction),
    {
      invalidate: [['companies', 'reviews', companyId]],
    },
  );
  const button = (kind: 'like' | 'dislike', Icon: typeof ThumbsUp, count: number) => (
    <button
      type="button"
      aria-pressed={review.myReaction === kind}
      aria-label={t(`portal.reviews.${kind}Count`, { count: count.toLocaleString(i18n.language) })}
      disabled={react.isPending}
      onClick={() => react.mutate(review.myReaction === kind ? null : kind)}
      className={cn(
        'inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-small font-semibold',
        review.myReaction === kind ? 'bg-blue-50 text-blue-600' : 'text-muted hover:bg-slate-50',
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {count.toLocaleString(i18n.language)}
    </button>
  );

  return (
    <article className="flex flex-col gap-2 border-b border-slate-200 py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-3">
        <p dir="auto" className="font-semibold text-heading">
          {review.author}
        </p>
        <StarRating value={review.rating} />
        <p className="text-caption text-muted">{formatDate(review.createdAt)}</p>
      </div>
      {review.comment && (
        <p dir="auto" className="text-body">
          {review.comment}
        </p>
      )}
      <div className="flex gap-1">
        {button('like', ThumbsUp, review.likes)}
        {button('dislike', ThumbsDown, review.dislikes)}
      </div>
    </article>
  );
}

function Reviews({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<'newest' | 'top'>('newest');
  const reviews = useReviews(companyId, sort);
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-white p-5 shadow-md">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-h3">{t('portal.reviews.title')}</h2>
        <div className="w-44">
          <Select
            label={t('portal.reviews.sort')}
            value={sort}
            onChange={(event) => setSort(event.target.value as 'newest' | 'top')}
            options={[
              { value: 'newest', label: t('portal.reviews.newest') },
              { value: 'top', label: t('portal.reviews.top') },
            ]}
          />
        </div>
      </div>
      <QueryState
        query={reviews}
        isEmpty={(list) => list.length === 0}
        empty={<p className="py-4 text-small text-muted">{t('portal.reviews.empty')}</p>}
      >
        {(list) => (
          <div>
            {list.map((review) => (
              <ReviewItem key={review.id} companyId={companyId} review={review} />
            ))}
          </div>
        )}
      </QueryState>
    </section>
  );
}

/** /app/companies/:id (spec B5). */
export default function CompanyProfilePage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const company = useCompany(id);
  const identity = useCompanyIdentity();
  const number = (value: number) => value.toLocaleString(i18n.language);

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/app/companies"
        className="inline-flex items-center gap-1 self-start text-small font-semibold"
      >
        <ArrowRight aria-hidden="true" className="size-4 ltr:rotate-180" />
        {t('portal.companies.back')}
      </Link>
      <QueryState query={company} skeleton={<Skeleton className="h-96 rounded-lg" />}>
        {(data) => {
          const { name, logoUrl } = identity(data);
          return (
            <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
              <div className="flex flex-col gap-5">
                <section className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-md">
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar name={name} src={logoUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h2 dir="auto" className="text-h2">
                        {name}
                      </h2>
                      <StarRating value={data.rating} />
                    </div>
                    <Link
                      to={`/app/new-request?companies=${data.id}`}
                      className={buttonClasses({ shape: 'form' })}
                    >
                      {t('portal.companies.sendRequest')}
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-blue-50 px-3 py-1 text-caption font-semibold text-blue-600"
                      >
                        {t(`portal.companies.categories.${category}`)}
                      </span>
                    ))}
                  </div>
                  <p dir="auto" className="text-body">
                    {data.about}
                  </p>
                  <dl className="grid grid-cols-3 gap-3 rounded-sm bg-slate-50 p-4 text-center">
                    {(
                      [
                        [
                          'rating',
                          data.rating.toLocaleString(i18n.language, { maximumFractionDigits: 1 }),
                        ],
                        ['reviewsCount', number(data.reviewsCount)],
                        ['completedOrders', number(data.completedOrders)],
                      ] as const
                    ).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-caption text-muted">
                          {t(`portal.companies.stats.${key}`)}
                        </dt>
                        <dd className="text-h3 text-heading">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <Reviews companyId={data.id} />
              </div>

              <aside className="flex flex-col gap-5">
                <section className="rounded-lg bg-white p-5 shadow-md">
                  <h2 className="mb-3 text-h3">{t('portal.companies.services')}</h2>
                  <ul className="flex flex-wrap gap-2">
                    {data.services.map((service) => (
                      <li
                        key={service}
                        className="rounded-full bg-blue-50 px-3 py-1 text-caption font-semibold text-blue-600"
                      >
                        {t(`portal.companyServices.${service}`)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-small text-muted">
                    {t('portal.companies.years', {
                      count: data.yearsInBusiness,
                      formatted: number(data.yearsInBusiness),
                    })}
                  </p>
                </section>
                <section className="rounded-lg bg-white p-5 shadow-md">
                  <h2 className="mb-3 text-h3">{t('portal.companies.areas')}</h2>
                  <p className="text-small text-body">
                    {data.allGovernorates
                      ? t('portal.companies.allEgypt')
                      : new Intl.ListFormat(i18n.language).format(
                          data.coveredGovernorates.map((g) => t(`options.governorate.${g}`)),
                        )}
                  </p>
                </section>
                <section className="rounded-lg bg-white p-5 shadow-md">
                  <h2 className="mb-3 text-h3">{t('portal.rate.title')}</h2>
                  <RateForm company={data} />
                </section>
              </aside>
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
