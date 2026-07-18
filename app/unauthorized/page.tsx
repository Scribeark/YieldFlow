'use client';

import React from 'react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold text-red-600 mb-4">Unauthorized Access</h1>
      <p className="text-xl text-gray-700 mb-8 max-w-lg">
        You do not have the correct role permissions to view the requested dashboard. Self-switching roles is not permitted.
      </p>
      <Link href="/" className="bg-green-700 text-white font-bold py-3 px-6 rounded hover:bg-green-800 transition">
        Return Home
      </Link>
    </div>
  );
}
