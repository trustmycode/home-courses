import type { Metadata } from "next";
import { Montserrat, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";
import { Toaster } from "@/components/ui/sonner";

const montserrat = Montserrat({
	subsets: ["latin", "cyrillic"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-montserrat",
});

const cormorant = Cormorant_Garamond({
	subsets: ["latin", "cyrillic"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-cormorant",
});

const ibmPlexMono = IBM_Plex_Mono({
	subsets: ["latin", "cyrillic"],
	weight: ["400", "700"],
	variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
	title: "Courses",
	description: "Online courses platform",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ru" suppressHydrationWarning>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${montserrat.variable} ${cormorant.variable} ${ibmPlexMono.variable} antialiased`}>
				<ThemeProvider>
					{children}
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
