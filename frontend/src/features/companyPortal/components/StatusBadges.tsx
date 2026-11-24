import { useTranslation } from 'react-i18next';
import type { CompanyOfferStatus, CompanyOrderStatus, InquiryStatus } from '@mirhalgo/shared';
import { StatusPill, type StatusTone } from '../../portal/components/StatusBadge';

/* Company portal statuses, on the customer portal's status pill (AA text, coloured dot). */

const OFFER_TONES: Record<CompanyOfferStatus, StatusTone> = {
  under_review: 'blue',
  accepted: 'success',
  rejected: 'error',
};
const ORDER_TONES: Record<CompanyOrderStatus, StatusTone> = {
  open: 'warning',
  awarded: 'violet',
  completed: 'success',
  cancelled: 'muted',
};
const INQUIRY_TONES: Record<InquiryStatus, StatusTone> = {
  awaiting_reply: 'warning',
  replied: 'success',
};

export function OfferStatusBadge({ status }: { status: CompanyOfferStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={OFFER_TONES[status]} label={t(`companyPortal.offerStatus.${status}`)} />;
}

export function CompanyOrderStatusBadge({ status }: { status: CompanyOrderStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ORDER_TONES[status]} label={t(`companyPortal.orderStatus.${status}`)} />;
}

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={INQUIRY_TONES[status]} label={t(`companyPortal.inquiryStatus.${status}`)} />
  );
}
