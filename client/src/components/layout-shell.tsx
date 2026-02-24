import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  User, 
  LogOut, 
  Menu, 
  Sun,
  Moon,
  Trophy,
  Medal,
  Shield,
  Bell,
  Plus,
  X,
  CheckCheck,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Notification {
  id: number;
  feedbackId: number;
  notificationType: string;
  customMessage: string | null;
  isRead: boolean;
  createdAt: string;
  feedbackMessage: string;
  feedbackCategory: string;
}

const NOTIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  investigating: { label: "Being Investigated", color: "text-amber-600 dark:text-amber-400" },
  resolved: { label: "Issue Resolved", color: "text-green-600 dark:text-green-400" },
  update: { label: "Update", color: "text-blue-600 dark:text-blue-400" },
};

function NotificationBell() {
  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unread = (notifications || []).filter(n => !n.isRead);
  const hasUnread = unread.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 relative"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5 shrink-0" />
          <span>Notifications</span>
          {hasUnread && (
            <Badge className="ml-auto text-xs h-5 min-w-5 px-1 bg-primary text-primary-foreground">
              {unread.length}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start" side="right">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {hasUnread && (
            <button
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={() => markAllRead.mutate()}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(!notifications || notifications.length === 0) ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
          ) : (
            notifications.map((n) => {
              const typeInfo = NOTIFICATION_LABELS[n.notificationType] || { label: n.notificationType, color: "" };
              return (
                <div
                  key={n.id}
                  className={cn("px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors", !n.isRead && "bg-primary/5")}
                  onClick={() => !n.isRead && markRead.mutate(n.id)}
                  data-testid={`notification-${n.id}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1 w-2 h-2 bg-primary rounded-full shrink-0" />}
                    <div className={cn("space-y-0.5", n.isRead && "pl-4")}>
                      <p className={cn("text-xs font-semibold", typeInfo.color)}>{typeInfo.label}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        Re: "{n.feedbackMessage}"
                      </p>
                      {n.customMessage && (
                        <p className="text-xs text-foreground italic">"{n.customMessage}"</p>
                      )}
                      <p className="text-xs text-muted-foreground/70">
                        {n.createdAt ? format(new Date(n.createdAt), "dd MMM yyyy HH:mm") : ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user } = useUser();
  const { mutate: logout } = useLogout();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const baseNav = [
    { name: 'My Tournaments', href: '/tournaments', icon: Trophy },
    { name: 'Create New', href: '/create', icon: Plus },
    { name: 'Leagues', href: '/leagues', icon: Medal },
  ];
  const navigation = [
    ...baseNav,
    ...(user?.isSuperUser ? [{ name: 'Beta Logs', href: '/admin', icon: Shield }] : []),
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold border-primary/50 text-primary bg-primary/10 uppercase tracking-wider">
              Beta
            </Badge>
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
        <NotificationBell />
        <FeedbackDialog />
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
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-bold border-primary/50 text-primary bg-primary/10 uppercase tracking-wider">
            Beta
          </Badge>
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
