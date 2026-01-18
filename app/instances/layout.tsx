'use client';

  import '../globals.css';
  import { useEffect, useState } from 'react';

  export default function InstancesLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    const [authenticated, setAuthenticated] = useState(false);
    
    const getBasePath = () => {
      if (typeof window === 'undefined') return '';
      // On GitHub Pages the app runs under /explore-instances-sales
      return window.location.pathname.startsWith('/explore-instances-sales') ? '/explore-instances-sales' : '';
    };

    useEffect(() => {
      if (typeof window !== 'undefined') {
        const basePath = getBasePath();
        const isAuth = window.localStorage.getItem('sales_showcase_auth') === 'true';
        if (!isAuth && !window.location.pathname.includes('/login')) {
          window.location.replace(basePath + '/login');
        } else {
          setAuthenticated(true);
        }
      }
    }, []);

    if (!authenticated && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      return null; // Prevents flashing content
    }

    return children;
  }    