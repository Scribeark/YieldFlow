'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4 text-center animate-scale-in">
      <Card className="p-8 max-w-lg w-full">
        <h1 className="text-4xl font-bold mb-4" style={{ color: '#ef4444' }}>Unauthorized Access</h1>
        <p className="text-xl mb-8" style={{ color: 'var(--foreground-muted)' }}>
          You do not have the correct role permissions to view the requested dashboard. Self-switching roles is not permitted.
        </p>
        <Link href="/">
          <Button className="w-full" size="lg">Return Home</Button>
        </Link>
      </Card>
    </div>
  );
}
