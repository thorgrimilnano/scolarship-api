export const metadata = {
  title: 'Scholarship Search API',
  description: 'Public read-only API for scholarship search.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
