import type { ReactNode } from 'react';

interface TagProps {
  children: ReactNode;
}

export default function Tag({ children }: TagProps) {
  return <span className="tag">{children}</span>;
}

