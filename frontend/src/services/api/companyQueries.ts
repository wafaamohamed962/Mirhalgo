import { useQuery } from '@tanstack/react-query';
import { companyApi } from './company';

/*
 * Company portal queries (MW_004). Every key starts with "company", so a change can refresh
 * the whole portal at once (lists, badges and KPIs all depend on the same data: spec B5).
 * The cache is cleared when the signed-in user changes (app/providers.tsx).
 */

export const companyKeys = {
  all: ['company'] as const,
  account: ['company', 'account'] as const,
  dashboard: ['company', 'dashboard'] as const,
  requests: ['company', 'requests'] as const,
  request: (orderId: string) => ['company', 'requests', orderId] as const,
  offers: ['company', 'offers'] as const,
  competitors: ['company', 'competitors'] as const,
  comparison: (orderId: string) => ['company', 'competitors', orderId] as const,
  inquiries: ['company', 'inquiries'] as const,
};

export const useCompanyAccount = () =>
  useQuery({ queryKey: companyKeys.account, queryFn: companyApi.getAccount });

/** KPIs, the sidebar badge counts and the overview lists. */
export const useCompanyDashboard = () =>
  useQuery({ queryKey: companyKeys.dashboard, queryFn: companyApi.getDashboard });

export const useCompanyRequests = () =>
  useQuery({ queryKey: companyKeys.requests, queryFn: companyApi.listRequests });

export const useCompanyRequest = (orderId: string | null) =>
  useQuery({
    queryKey: companyKeys.request(orderId ?? ''),
    queryFn: () => companyApi.getRequest(orderId!),
    enabled: Boolean(orderId),
  });

export const useCompanyOffers = () =>
  useQuery({ queryKey: companyKeys.offers, queryFn: companyApi.listOffers });

export const useCompetitors = () =>
  useQuery({ queryKey: companyKeys.competitors, queryFn: companyApi.listCompetitors });

export const useComparison = (orderId: string | null) =>
  useQuery({
    queryKey: companyKeys.comparison(orderId ?? ''),
    queryFn: () => companyApi.getComparison(orderId!),
    enabled: Boolean(orderId),
  });

export const useCompanyInquiries = () =>
  useQuery({ queryKey: companyKeys.inquiries, queryFn: companyApi.listInquiries });
