import type { Metadata } from "next";
import { Montserrat, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/hooks/use-theme";

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
				<script
					dangerouslySetInnerHTML={{
						__html: `
							(function() {
								const theme = localStorage.getItem('theme') || 
									(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
								document.documentElement.classList.toggle('dark', theme === 'dark');
							})();
						`,
					}}
				/>
			</head>
			<body className={`${montserrat.variable} ${cormorant.variable} ${ibmPlexMono.variable} antialiased`}>
				<ThemeProvider>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
