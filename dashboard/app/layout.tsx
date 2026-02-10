import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'HIMT Dashboard - Privacy Analytics',
    description: 'How I Met Your Tracker - Personal tracking analytics dashboard',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
