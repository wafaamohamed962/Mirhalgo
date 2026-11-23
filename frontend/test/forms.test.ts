import { describe, expect, it } from 'vitest';
import { hasChanges } from '../src/lib/forms';

/* "The form has data" from react-hook-form's dirtyFields (MW_003 A3: leave guards). */

describe('hasChanges', () => {
  it('is false when no field changed', () => {
    expect(hasChanges({})).toBe(false);
    expect(hasChanges(undefined)).toBe(false);
    expect(hasChanges({ contact: {}, items: [{}, {}] })).toBe(false);
    expect(hasChanges({ a: false })).toBe(false);
  });

  it('is true when any nested field or array row changed', () => {
    expect(hasChanges({ firstName: true })).toBe(true);
    expect(hasChanges({ contact: { phone: true } })).toBe(true);
    expect(hasChanges({ items: [{}, { weight: { value: true } }] })).toBe(true);
  });
});
