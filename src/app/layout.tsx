import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Your site AI',
  description: 'Premium asystent do rozmów o stronach, kodzie JavaScript i TypeScript oraz jakości UI'
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
