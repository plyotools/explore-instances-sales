'use client';

  import '../globals.css';
  import { useEffect, useState } from 'react';

  export default function InstancesLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const [authenticated, setAuthenticated] = useState(false);
    const basePath = process.env.NODE_ENV === 'production' ? '/explore-instances-sales' : '';

    useEffect(() => {
      if (typeof window !== 'undefined') {
        const isAuth = window.localStorage.getItem('sales_showcase_auth') === 'true';
        if (!isAuth && !window.location.pathname.includes('/login')) {
          window.location.replace(basePath + '/login');
        } else {
          setAuthenticated(true);
        }
      }
    }, [basePath]);

    if (!authenticated && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      return null; // Prevents flashing content
    }

    return children;
  }    