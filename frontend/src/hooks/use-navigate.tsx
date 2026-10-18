'use client';

import React from 'react';
import * as ReactRouter from 'react-router-dom';
import * as NextNav from 'next/navigation';
import { Link as CustomLink } from '../components/ui/Link';

export function useNavigate() {
  try {
    // If inside React Router (e.g. tests or router context)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const rrNavigate = ReactRouter.useNavigate();
    return rrNavigate;
  } catch {
    // If inside Next.js App Router
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const nextRouter = NextNav.useRouter();
      return (to: string | number, options?: { replace?: boolean }) => {
        if (typeof to === 'number') {
          if (to === -1) {
            nextRouter.back();
          }
        } else {
          if (options?.replace) {
            nextRouter.replace(to);
          } else {
            nextRouter.push(to);
          }
        }
      };
    } catch {
      return (to: string | number, options?: { replace?: boolean }) => {
        if (typeof window !== 'undefined') {
          if (typeof to === 'number') {
            window.history.go(to);
          } else if (options?.replace) {
            window.location.replace(to);
          } else {
            window.location.href = to;
          }
        }
      };
    }
  }
}

export const Navigate: React.FC<{ to: string; replace?: boolean }> = (props) => {
  try {
    return <ReactRouter.Navigate {...props} />;
  } catch {
    const nav = useNavigate();
    React.useEffect(() => {
      nav(props.to, { replace: props.replace });
    }, [props.to, props.replace, nav]);
    return null;
  }
};

export function useParams<T extends Record<string, string | string[]> = Record<string, string>>(): T {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const p = ReactRouter.useParams();
    if (p && Object.keys(p).length > 0) return p as T;
  } catch {
    // ignore
  }

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const p = NextNav.useParams();
    return (p || {}) as T;
  } catch {
    return {} as T;
  }
}

export function useSearchParams(): [URLSearchParams, (params: Record<string, string>) => void] {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [searchParams, setSearchParams] = ReactRouter.useSearchParams();
    return [
      searchParams,
      (newParams: Record<string, string>) => {
        setSearchParams(newParams);
      },
    ];
  } catch {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const sp = NextNav.useSearchParams();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const r = NextNav.useRouter();
      const setParams = (newParams: Record<string, string>) => {
        const c = new URLSearchParams(sp ? Array.from(sp.entries()) : []);
        Object.entries(newParams).forEach(([k, v]) => c.set(k, v));
        r.push(`?${c.toString()}`);
      };
      return [sp as unknown as URLSearchParams, setParams];
    } catch {
      return [
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams(),
        () => {},
      ];
    }
  }
}

export const Link = CustomLink;
