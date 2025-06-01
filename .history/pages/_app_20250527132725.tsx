// pages/_app.tsx
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from 'react';
import { Toaster } from 'sonner';
import '@/styles/globals.css';

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