import type { ReactNode } from 'react';

interface TagProps {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'teal';
}

export default function Tag({ children, variant = 'default' }: TagProps) {
  const className = `tag${variant === 'primary' ? ' tag-primary' : ''}${variant === 'teal' ? ' tag-teal' : ''}`;
  return <span className={className}>{children}</span>;
}

