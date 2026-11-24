import { useTranslation } from 'react-i18next';
import type { CompanyRequestDetails } from '@mirhalgo/shared';
import '../../i18n/portal'; // the order field labels of the New Request summary
import { REQUEST_STEPS, type RequestStep } from '../requests/model';
import { summarize } from '../requests/summary';
import { useReferenceNames } from '../requests/useReferenceNames';

/**
 * The order's sections and fields, with the New Request summary (same labels, option names
 * and reference names). The contact block is not in a company order (privacy, spec B1): only
 * the client type, shown in the customer section.
 */
export function useOrderSections(details: CompanyRequestDetails | undefined) {
  const { t, i18n } = useTranslation();
  const names = useReferenceNames();
  if (!details) return [];
  const { clientType, ...order } = details.order;
  const service = details.service;
  const sections = summarize(
    service,
    { ...order, contact: { clientType } },
    {
      t,
      language: i18n.language,
      names,
      uploads: {},
    },
  );
  return REQUEST_STEPS[service]
    .filter((step): step is Exclude<RequestStep, 'review'> => step !== 'review')
    .map((step) => ({
      step,
      title: t(`portal.request.steps.${step}`),
      rows: sections.get(step) ?? [],
    }));
}
