import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'TCC REN 1000/2021 — Dashboard',
  description:
    'Análise da eficácia da REN 1000/2021 da ANEEL sobre qualidade de atendimento comercial.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#09090b] text-zinc-100 antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Conteúdo principal — deslocado pela sidebar */}
            <main className="flex-1 ml-56 p-6 min-h-screen">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
