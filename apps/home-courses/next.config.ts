import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
	// Требуется для OpenNext Cloudflare
	output: "standalone",
	
	// Указываем корень для file tracing в монорепо
	// ВАЖНО: может создавать глубокую структуру папок в standalone
	// Если OpenNext не находит файлы, попробуйте убрать эту строку
	outputFileTracingRoot: path.join(__dirname, "../../../"),
	
	// Пакеты, которые должны быть внешними (не включаются в бандл)
	serverExternalPackages: ["@opennextjs/cloudflare"],
	
	// Оптимизация для Cloudflare
	experimental: {
		// Оптимизация для уменьшения размера бандла
		optimizePackageImports: [
			"lucide-react",
			"@radix-ui/react-accordion",
			"@radix-ui/react-dialog",
			"@radix-ui/react-dropdown-menu",
			"@radix-ui/react-tabs",
			"@radix-ui/react-toast",
		],
	},
	
	// Оптимизация размера бандла
	compiler: {
		// Удаляем console.log в production (кроме error и warn)
		removeConsole: process.env.NODE_ENV === "production" ? {
			exclude: ["error", "warn"],
		} : false,
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
if (process.env.NODE_ENV === "development") {
	import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
		initOpenNextCloudflareForDev();
	});
}
