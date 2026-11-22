import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '@mirhalgo/shared';
import { cn } from '../../lib/utils';

const LEVELS = [
  { min: 0, key: 'weak', bar: 'bg-error' },
  { min: 3, key: 'medium', bar: 'bg-warning' },
  { min: PASSWORD_RULES.length, key: 'strong', bar: 'bg-success' },
] as const;

/** Strength meter + checklist driven by the shared password rules. */
export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const results = PASSWORD_RULES.map((rule) => ({ id: rule.id, passed: rule.test(password) }));
  const score = results.filter((r) => r.passed).length;
  const level = [...LEVELS].reverse().find((l) => score >= l.min) ?? LEVELS[0];

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div
          role="meter"
          aria-label={t('ui.passwordStrength')}
          aria-valuemin={0}
          aria-valuemax={PASSWORD_RULES.length}
          aria-valuenow={score}
          aria-valuetext={t(`ui.strength.${level.key}`)}
          className="flex flex-1 gap-1"
        >
          {results.map((rule, index) => (
            <span
              key={rule.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-200',
                password && index < score ? level.bar : 'bg-slate-200',
              )}
            />
          ))}
        </div>
        {password && (
          <span aria-live="polite" className="text-caption font-semibold text-body">
            {t(`ui.strength.${level.key}`)}
          </span>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {results.map((rule) => {
          const Icon = rule.passed ? Check : X;
          return (
            <li
              key={rule.id}
              className={cn('flex items-center gap-1.5', rule.passed ? 'text-body' : 'text-muted')}
            >
              {/* green only on the icon: success text color fails AA contrast at caption size */}
              <Icon
                aria-hidden="true"
                className={cn('size-3.5 shrink-0', rule.passed && 'text-success')}
              />
              <span>{t(`ui.passwordRules.${rule.id}`)}</span>
              <span className="sr-only">{t(rule.passed ? 'ui.ruleMet' : 'ui.ruleNotMet')}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
