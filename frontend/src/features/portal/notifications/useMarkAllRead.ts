import { portalApi } from '../../../services/api/portal';
import { keys, useApiMutation } from '../../../services/api/queries';

export const useMarkAllRead = () =>
  useApiMutation(portalApi.markAllNotificationsRead, { invalidate: [keys.notifications] });
