'use client';

/**
 * components/providers/MapsProvider.tsx
 *
 * Client Context that distributes the Google Maps API key to all
 * components that need it, without repeated prop-drilling.
 *
 * The key is read server-side in the root layout (a Server Component),
 * passed as a prop to this Client Component, and stored in context.
 *
 * Once received by this Client Component, the key is available to
 * the browser — this is expected and required for Maps JavaScript.
 * The key must be restricted in Google Cloud Console with HTTP referrer
 * restrictions and API restrictions.
 */

import React, { createContext, useContext } from 'react';

const MapsKeyContext = createContext<string>('');

export function MapsProvider({
  apiKey,
  children,
}: {
  apiKey: string;
  children: React.ReactNode;
}) {
  return (
    <MapsKeyContext.Provider value={apiKey}>
      {children}
    </MapsKeyContext.Provider>
  );
}

/** Use this hook in any Client Component that needs the Maps API key. */
export function useMapsKey(): string {
  return useContext(MapsKeyContext);
}
