import type { HTMLAttributes } from 'react';
import { cardClasses } from './styles';

type CardProps = HTMLAttributes<HTMLDivElement> & { interactive?: boolean };

/** White surface, 20px radius, md shadow; `interactive` adds the hover lift (spec 3.4). */
export function Card({ interactive, className, ...rest }: CardProps) {
  return <div className={cardClasses({ interactive, className })} {...rest} />;
}
