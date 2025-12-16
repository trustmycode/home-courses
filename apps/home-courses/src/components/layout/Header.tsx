"use client";

import { Search, Menu, GraduationCap } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({ 
  searchQuery = "", 
  onSearchChange, 
  onMenuClick,
  showMenuButton = false 
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="hidden sm:inline">Course Viewer</span>
        </Link>

        {onSearchChange && (
          <div className="relative flex-1 max-w-md ml-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 h-9 bg-background"
            />
          </div>
        )}

        <ThemeToggle />
      </div>
    </header>
  );
}
