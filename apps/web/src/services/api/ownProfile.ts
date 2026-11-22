import type { Gender, Me, ProfileInput } from '@mirhalgo/shared';
import { ApiRequestError } from '../../lib/apiClient';

/*
 * The logged-in customer's own identity, read from the REAL profiles row even while the rest
 * of the portal is mocked (MW_002 assumption, CLAUDE.md §14). RLS: the owner selects their row
 * and updates only first_name / last_name / gender (never role, email, phone or verification).
 * supabase-js is imported lazily, like in apiClient, so it stays out of the main chunk.
 */

export type Identity = Omit<Me, 'avatarUrl'>;

const COLUMNS = 'id, first_name, last_name, gender, email, phone';

// Customers always have names + gender (check constraint in the profiles migrations).
type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  gender: Gender;
  email: string;
  phone: string;
};

/** The profiles table, scoped to the logged-in user's own row. */
async function ownRow() {
  const { supabase } = await import('../../lib/supabase');
  const { session } = (await supabase.auth.getSession()).data;
  if (!session) throw new ApiRequestError('INTERNAL', 'No session', 401);
  return { table: supabase.from('profiles'), userId: session.user.id };
}

async function toIdentity(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Identity> {
  const { data, error } = await query;
  if (error) throw new ApiRequestError('INTERNAL', error.message, 500);
  const row = data as ProfileRow;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    email: row.email,
    phone: row.phone,
  };
}

export const ownProfile = {
  read: async () => {
    const { table, userId } = await ownRow();
    return toIdentity(table.select(COLUMNS).eq('id', userId).single());
  },

  update: async ({ firstName, lastName, gender }: ProfileInput) => {
    const { table, userId } = await ownRow();
    return toIdentity(
      table
        .update({ first_name: firstName, last_name: lastName, gender })
        .eq('id', userId)
        .select(COLUMNS)
        .single(),
    );
  },
};
