import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TEMPLATE_OF } from '@mirhalgo/shared';
import { Alert, Button, Modal, QueryState } from '../../../components/ui';
import { useCompanyAccount, useCompanyRequest } from '../../../services/api/companyQueries';
import { useSeen } from '../seen';
import { OfferModal } from './OfferModal';

/**
 * `?order=<id>&offer=new` (spec B11): loads the order to pick its template, then the offer
 * form. A request that no longer accepts offers says so instead.
 */
export function OfferModalRoute({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const request = useCompanyRequest(orderId);
  const suspended = useCompanyAccount().data?.offerSubmission === 'suspended';
  const { markSeen } = useSeen();
  useEffect(() => markSeen('request', orderId), [markSeen, orderId]);

  if (request.data?.status === 'open') {
    return (
      <OfferModal
        orderId={orderId}
        template={TEMPLATE_OF[request.data.category]}
        suspended={suspended}
        onClose={onClose}
      />
    );
  }
  return (
    <Modal
      title={t('companyPortal.offerForm.title', { id: orderId })}
      onClose={onClose}
      footer={
        <Button variant="secondary" shape="form" onClick={onClose}>
          {t('ui.close')}
        </Button>
      }
    >
      <QueryState query={request}>
        {() => <Alert tone="info">{t('errors.ORDER_NOT_OPEN')}</Alert>}
      </QueryState>
    </Modal>
  );
}
