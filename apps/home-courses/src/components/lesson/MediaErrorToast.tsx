"use client";

import { useState, useEffect } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaErrorToastProps {
	assetId: string;
	onRetry?: () => void;
	onDismiss?: () => void;
}

export function MediaErrorToast({
	assetId,
	onRetry,
	onDismiss,
}: MediaErrorToastProps) {
	const [isVisible, setIsVisible] = useState(true);

	const handleDismiss = () => {
		setIsVisible(false);
		onDismiss?.();
	};

	if (!isVisible) return null;

	return (
		<div className="fixed bottom-4 right-4 z-50 max-w-md bg-destructive text-destructive-foreground rounded-lg shadow-lg p-4 flex items-start gap-3">
			<AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
			<div className="flex-1">
				<p className="font-medium mb-1">Не удалось загрузить медиа</p>
				<p className="text-sm opacity-90">
					Обновите страницу или проверьте доступ к медиа-файлу.
				</p>
				{onRetry && (
					<Button
						variant="outline"
						size="sm"
						className="mt-2 bg-background text-foreground hover:bg-background/80"
						onClick={onRetry}
					>
						<RefreshCw className="h-4 w-4 mr-2" />
						Повторить
					</Button>
				)}
			</div>
			<Button
				variant="ghost"
				size="icon"
				className="h-6 w-6 shrink-0 text-destructive-foreground hover:bg-destructive-foreground/20"
				onClick={handleDismiss}
			>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
}
