import type {
  Address,
  AddressInput,
  AppNotification,
  Balance,
  ChangePasswordInput,
  CompanyCard,
  CompanyCategory,
  CompanyProfile,
  CompanySort,
  DeleteAccountInput,
  Me,
  MeSummary,
  NotificationEvent,
  NotificationPrefs,
  OrderDetails,
  OrderList,
  OrderListParams,
  ProfileInput,
  Review,
  ReviewInput,
  SecurityOverview,
  ServiceType,
  Ticket,
  TicketInput,
  TicketSummary,
} from '@mirhalgo/shared';
import { apiRequest } from '../../lib/apiClient';
import { ownProfile, type Identity } from './ownProfile';

/*
 * Customer portal service layer (MW_002 B2). Function names and response shapes are the
 * contract of the future real API (types in @mirhalgo/shared/portal). Today MSW answers
 * these requests (src/mocks), except the parts that are already real: the user's own identity
 * (getMe / updateProfile: the profiles row) and, since MW_003 B2, the New Request summary
 * (balance + drafts, GET /me/summary). Removing the mocks is the only change needed later.
 */

const get = <T>(path: `/${string}`) => apiRequest<T>('GET', path, { auth: true });
const send = <T>(method: 'POST' | 'PATCH' | 'DELETE', path: `/${string}`, body?: unknown) =>
  apiRequest<T>(method, path, { body, auth: true });

/*
 * Me = the real identity (profiles row, ownProfile.ts) + the avatar, which stays mocked until
 * avatar storage exists. The avatar is cosmetic: if it fails, initials are shown instead.
 */
const mockedAvatar = () =>
  get<Me>('/me').then(
    (me) => me.avatarUrl,
    () => null,
  );

const withAvatar = async (
  identity: Promise<Identity>,
  avatarUrl: Promise<string | null>,
): Promise<Me> => {
  const [who, avatar] = await Promise.all([identity, avatarUrl]);
  return { ...who, avatarUrl: avatar };
};

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export const portalApi = {
  // profile & quota
  getMe: () => withAvatar(ownProfile.read(), mockedAvatar()),
  updateProfile: (input: ProfileInput) => withAvatar(ownProfile.update(input), mockedAvatar()),
  updateAvatar: (dataUrl: string) =>
    withAvatar(
      ownProfile.read(),
      send<Me>('POST', '/me/avatar', { dataUrl }).then((me) => me.avatarUrl),
    ),
  requestEmailChange: (email: string) => send<null>('POST', '/me/email', { email }),
  confirmEmailChange: (code: string) => send<Me>('POST', '/me/email/confirm', { code }),
  requestPhoneChange: (phone: string) => send<null>('POST', '/me/phone', { phone }),
  confirmPhoneChange: (code: string) => send<Me>('POST', '/me/phone/confirm', { code }),
  // real API (MW_003 B2 / B3)
  getSummary: () => get<MeSummary>('/me/summary'),
  discardRequestDraft: (service: ServiceType) => send<null>('DELETE', `/orders/drafts/${service}`),

  // orders
  listOrders: (params: OrderListParams) => get<OrderList>(`/orders?${query(params)}`),
  getOrder: (id: string) => get<OrderDetails>(`/orders/${encodeURIComponent(id)}`),
  cancelOrder: (id: string, reason?: string) =>
    send<OrderDetails>('POST', `/orders/${encodeURIComponent(id)}/cancel`, { reason }),
  acceptOffer: (orderId: string, offerId: string) =>
    send<OrderDetails>('POST', `/orders/${encodeURIComponent(orderId)}/offers/${offerId}/accept`),
  rejectOffer: (orderId: string, offerId: string, reason?: string) =>
    send<OrderDetails>('POST', `/orders/${encodeURIComponent(orderId)}/offers/${offerId}/reject`, {
      reason,
    }),
  askQuestion: (orderId: string, offerId: string, question: string) =>
    send<null>('POST', `/orders/${encodeURIComponent(orderId)}/offers/${offerId}/questions`, {
      question,
    }),

  // companies
  listCompanies: (params: { search: string; category: CompanyCategory | ''; sort: CompanySort }) =>
    get<CompanyCard[]>(`/companies?${query(params)}`),
  getCompany: (id: string) => get<CompanyProfile>(`/companies/${encodeURIComponent(id)}`),
  listReviews: (id: string, sort: 'newest' | 'top') =>
    get<Review[]>(`/companies/${encodeURIComponent(id)}/reviews?${query({ sort })}`),
  rateCompany: (id: string, input: ReviewInput) =>
    send<CompanyProfile>('POST', `/companies/${encodeURIComponent(id)}/reviews`, input),
  reactToReview: (companyId: string, reviewId: string, reaction: 'like' | 'dislike' | null) =>
    send<Review>(
      'POST',
      `/companies/${encodeURIComponent(companyId)}/reviews/${reviewId}/reaction`,
      { reaction },
    ),

  // notifications
  listNotifications: () => get<AppNotification[]>('/notifications'),
  markNotificationRead: (id: string) => send<null>('POST', `/notifications/${id}/read`),
  markAllNotificationsRead: () => send<null>('POST', '/notifications/read-all'),

  // account
  getSecurity: () => get<SecurityOverview>('/account/security'),
  changePassword: (input: ChangePasswordInput) => send<null>('POST', '/account/password', input),
  logoutOtherSessions: () => send<SecurityOverview>('POST', '/account/sessions/logout-others'),
  getNotificationPrefs: () => get<NotificationPrefs>('/account/notification-preferences'),
  updateNotificationPref: (event: NotificationEvent, channel: 'inApp' | 'email', value: boolean) =>
    send<NotificationPrefs>('PATCH', '/account/notification-preferences', {
      event,
      channel,
      value,
    }),
  listAddresses: () => get<Address[]>('/account/addresses'),
  createAddress: (input: AddressInput) => send<Address[]>('POST', '/account/addresses', input),
  updateAddress: (id: string, input: AddressInput) =>
    send<Address[]>('PATCH', `/account/addresses/${id}`, input),
  deleteAddress: (id: string) => send<Address[]>('DELETE', `/account/addresses/${id}`),
  setDefaultAddress: (id: string) => send<Address[]>('POST', `/account/addresses/${id}/default`),
  getBalance: () => get<Balance>('/account/balance'),
  requestDataExport: () => send<null>('POST', '/account/data-export'),
  deleteAccount: (input: DeleteAccountInput) => send<null>('POST', '/account/delete', input),

  // support
  listTickets: () => get<TicketSummary[]>('/support/tickets'),
  getTicket: (id: string) => get<Ticket>(`/support/tickets/${encodeURIComponent(id)}`),
  createTicket: (input: TicketInput & { attachment: { name: string; size: number } | null }) =>
    send<Ticket>('POST', '/support/tickets', input),
  replyToTicket: (id: string, message: string) =>
    send<Ticket>('POST', `/support/tickets/${encodeURIComponent(id)}/messages`, { message }),
};
