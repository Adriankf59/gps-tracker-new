// pages/_app.tsx
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from 'react';
import { Toaster } from 'sonner';

// Import Leaflet and Leaflet Draw CSS globally
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css'; // If you use leaflet-draw

import '@/styles/globals.css'; // Your global styles

export default function App({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Component {...pageProps} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}