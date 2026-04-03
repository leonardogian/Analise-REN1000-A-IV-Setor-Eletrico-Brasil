import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/providers';
import { Sidebar, Breadcrumb } from '@/components/Sidebar';

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
            <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
              <Breadcrumb />
              <main className="flex-1 p-4 md:p-6 pt-16 md:pt-6">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
