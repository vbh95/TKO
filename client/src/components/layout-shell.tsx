import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { 
  User, 
  LogOut, 
  Menu, 
  X,
  Plus,
  Sun,
  Moon,
  Trophy
} from "lucide-react";
import tkoLogoDark from "@assets/Untitled-1-02_1771177331378.png";
import tkoLogoWhite from "@assets/TKO_White-02_1771177730966.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const navigation = [
    { name: 'My Tournaments', href: '/tournaments', icon: Trophy },
    { name: 'Create New', href: '/create', icon: Plus },
    { name: 'Profile', href: '/account', icon: User },
  ];

  const tkoLogo = theme === 'dark' ? tkoLogoWhite : tkoLogoDark;

  const NavContent = () => (
    <div className="flex flex-col h-full bg-card">
      <div className="p-6 border-b">
        <Link href="/tournaments">
          <div className="flex items-center gap-2 cursor-pointer">
            <img src={tkoLogo} alt="TKO" className="w-9 h-9" />
            <h1 className="text-2xl font-display font-bold text-primary">TKO</h1>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t bg-muted/30 space-y-2">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
          data-testid="button-toggle-theme"
        >
          {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          {theme === "light" ? "Dark Mode" : "Light Mode"}
        </button>
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="h-9 w-9 bg-primary/10 text-primary border border-primary/20">
            <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 border-r fixed inset-y-0 z-50">
        <NavContent />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background/80 backdrop-blur-md z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2 font-display font-bold text-lg text-primary">
          <img src={tkoLogo} alt="TKO" className="w-7 h-7" />
          TKO
        </div>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 md:pl-64 pt-16 md:pt-0">
        <div className="container max-w-7xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
