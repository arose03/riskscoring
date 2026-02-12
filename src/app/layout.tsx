import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HABGEN Risk Scorer',
  description: 'Student housing & multifamily property risk assessment tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <header className="bg-[#0f172a] text-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="font-bold text-lg tracking-tight hover:text-slate-200 transition-colors">HABGEN</a>
              <div className="text-slate-400 text-sm">|</div>
              <nav className="flex items-center gap-4">
                <a href="/" className="text-sm text-slate-300 hover:text-white transition-colors">Risk Scorer</a>
                <a href="/rent-study" className="text-sm text-slate-300 hover:text-white transition-colors">Rent Study</a>
              </nav>
            </div>
            <div className="text-xs text-slate-500">Habitational Insurance Underwriting</div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
