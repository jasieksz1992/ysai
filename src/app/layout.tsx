import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lokalny Asystent AI',
  description: 'Darmowy lokalny czat LLM uruchamiany w przeglądarce przez WebLLM'
}

type RootLayoutProps = {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}
