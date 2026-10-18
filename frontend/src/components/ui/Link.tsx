'use client';

import React from 'react';
import NextLink from 'next/link';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to?: string;
  href?: string;
  children?: React.ReactNode;
}

export const Link: React.FC<LinkProps> = ({ to, href, children, ...props }) => {
  const target = href || to || '#';
  return (
    <NextLink href={target} {...props}>
      {children}
    </NextLink>
  );
};

export default Link;
