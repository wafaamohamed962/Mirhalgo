import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { CompanyCategory, CompanySort, OrderListParams } from '@mirhalgo/shared';
import { ApiRequestError, errorKey } from '../../lib/apiClient';
import { ordersApi } from './orders';
import { portalApi } from './portal';

/** Query keys in one place, so mutations invalidate exactly what they change. */
export const keys = {
  me: ['me'] as const,
  /** GET /me/summary: first name, balance, drafts (real API, MW_003 B2). */
  summary: ['me', 'summary'] as const,
  orders: ['orders'] as const,
  orderList: (params: Omit<OrderListParams, 'cursor'>) => ['orders', 'list', params] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  /** GET /orders/:reference: a submitted order, real API (MW_003 B4/B6). */
  orderRecord: (reference: string) => ['orders', 'record', reference] as const,
  companies: ['companies'] as const,
  companyList: (params: object) => ['companies', 'list', params] as const,
  company: (id: string) => ['companies', 'detail', id] as const,
  reviews: (id: string, sort: string) => ['companies', 'reviews', id, sort] as const,
  notifications: ['notifications'] as const,
  security: ['account', 'security'] as const,
  prefs: ['account', 'notification-preferences'] as const,
  addresses: ['account', 'addresses'] as const,
  balance: ['account', 'balance'] as const,
  tickets: ['support', 'tickets'] as const,
  ticket: (id: string) => ['support', 'tickets', id] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: portalApi.getMe });
export const useMeSummary = () =>
  useQuery({ queryKey: keys.summary, queryFn: portalApi.getSummary });

/** A submitted order does not change on the success screen: read once, no retry on 404. */
export const useOrderRecord = (reference: string) =>
  useQuery({
    queryKey: keys.orderRecord(reference),
    queryFn: () => ordersApi.getOrder(reference),
    staleTime: Infinity,
    retry: (count, error) =>
      !(error instanceof ApiRequestError && error.status === 404) && count < 2,
  });

export function useOrders(params: Omit<OrderListParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: keys.orderList(params),
    queryFn: ({ pageParam }) => portalApi.listOrders({ ...params, cursor: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}
export const useOrder = (id: string) =>
  useQuery({ queryKey: keys.order(id), queryFn: () => portalApi.getOrder(id) });

export const useCompanies = (params: {
  search: string;
  category: CompanyCategory | '';
  sort: CompanySort;
}) =>
  useQuery({
    queryKey: keys.companyList(params),
    queryFn: () => portalApi.listCompanies(params),
    placeholderData: (previous) => previous, // keep results while filters change
  });
export const useCompany = (id: string) =>
  useQuery({ queryKey: keys.company(id), queryFn: () => portalApi.getCompany(id) });
export const useReviews = (id: string, sort: 'newest' | 'top') =>
  useQuery({ queryKey: keys.reviews(id, sort), queryFn: () => portalApi.listReviews(id, sort) });

export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: portalApi.listNotifications });

export const useSecurity = () =>
  useQuery({ queryKey: keys.security, queryFn: portalApi.getSecurity });
export const useNotificationPrefs = () =>
  useQuery({ queryKey: keys.prefs, queryFn: portalApi.getNotificationPrefs });
export const useAddresses = () =>
  useQuery({ queryKey: keys.addresses, queryFn: portalApi.listAddresses });
export const useBalance = () => useQuery({ queryKey: keys.balance, queryFn: portalApi.getBalance });

export const useTickets = () =>
  useQuery({ queryKey: keys.tickets, queryFn: portalApi.listTickets });
export const useTicket = (id: string) =>
  useQuery({ queryKey: keys.ticket(id), queryFn: () => portalApi.getTicket(id) });

/**
 * Mutation with the portal conventions (spec B2): a success toast (i18n key), the error
 * toast from the API code, and the cache kept in sync: `setData` writes the returned value
 * into a query, `invalidate` refetches.
 */
export function useApiMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  {
    success,
    invalidate = [],
    setData,
    onSuccess,
  }: {
    success?: string;
    invalidate?: QueryKey[];
    setData?: QueryKey;
    onSuccess?: (result: TResult, input: TInput) => void;
  } = {},
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result, input) => {
      if (setData) queryClient.setQueryData(setData, result);
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (success) toast.success(t(success));
      onSuccess?.(result, input);
    },
    onError: (error) => {
      toast.error(t(errorKey(error)));
    },
  });
}
