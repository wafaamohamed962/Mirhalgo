import type {
  ChangePasswordInput,
  CompanyAccount,
  CompanyContactInput,
  CompanyDashboard,
  CompanyInquiry,
  CompanyOffer,
  CompanyRequest,
  CompanyRequestDetails,
  CompetitorComparison,
  CompetitorRow,
  InquiryReplyInput,
  OfferInput,
  OfferPrivacyInput,
  OfferSubmissionStatus,
} from '@mirhalgo/shared';
import { apiRequest } from '../../lib/apiClient';

/*
 * Company portal service layer (MW_004 spec B12). Paths and response types are the contract
 * of the future real API (types in @mirhalgo/shared/companyPortal). Today MSW answers them
 * (src/mocks/company); removing the mocks is the only change needed later.
 */

const get = <T>(path: `/${string}`) => apiRequest<T>('GET', `/company${path}`, { auth: true });
const send = <T>(method: 'POST' | 'PATCH', path: `/${string}`, body?: unknown) =>
  apiRequest<T>(method, `/company${path}`, { body, auth: true });

export const companyApi = {
  getAccount: () => get<CompanyAccount>('/me'),
  getDashboard: () => get<CompanyDashboard>('/dashboard'),
  listRequests: () => get<CompanyRequest[]>('/requests'),
  getRequest: (orderId: string) => get<CompanyRequestDetails>(`/requests/${orderId}`),
  submitOffer: (orderId: string, offer: OfferInput) =>
    send<CompanyOffer>('POST', `/requests/${orderId}/offers`, offer),
  listOffers: () => get<CompanyOffer[]>('/offers'),
  updateOffer: (offerId: string, offer: OfferInput) =>
    send<CompanyOffer>('PATCH', `/offers/${offerId}`, offer),
  listCompetitors: () => get<CompetitorRow[]>('/competitors'),
  getComparison: (orderId: string) => get<CompetitorComparison>(`/competitors/${orderId}`),
  listInquiries: () => get<CompanyInquiry[]>('/inquiries'),
  replyToInquiry: (inquiryId: string, input: InquiryReplyInput) =>
    send<CompanyInquiry>('POST', `/inquiries/${inquiryId}/reply`, input),
  updateContact: (input: CompanyContactInput) =>
    send<CompanyAccount>('PATCH', '/settings/contact', input),
  updatePrivacy: (input: OfferPrivacyInput) =>
    send<CompanyAccount>('PATCH', '/settings/privacy', input),
  changePassword: (input: ChangePasswordInput) => send<null>('POST', '/settings/password', input),

  /** Demo tools (dev / staging only, mock-only endpoints: never part of the real API). */
  demo: {
    reset: () => send<null>('POST', '/demo/reset'),
    setOfferSubmission: (status: OfferSubmissionStatus) =>
      send<CompanyAccount>('PATCH', '/demo/offer-submission', { status }),
  },
};
