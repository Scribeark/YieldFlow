'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RetiredDeviceReadingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/seller');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center text-foreground-muted">
      Redirecting to Seller Dashboard...
    </div>
  );
}
