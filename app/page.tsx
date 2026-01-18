'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const getBasePath = () => {
      if (typeof window === 'undefined') return '';
      // On GitHub Pages the app runs under /explore-instances-sales
      return window.location.pathname.startsWith('/explore-instances-sales') ? '/explore-instances-sales' : '';
    };

    const basePath = getBasePath();
    const isAuth = typeof window !== 'undefined' && window.localStorage.getItem('sales_showcase_auth') === 'true';
    
    if (isAuth) {
      window.location.replace(basePath + '/instances');
    } else {
      window.location.replace(basePath + '/login');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0A082D] flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  );
}    