import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { 
  Home, 
  CalendarDays, 
  BookOpen, 
  Library, 
  Users, 
  MessageSquareQuote,
  Settings,
  LogOut,
} from "lucide-react";
import { SacramentTrayIcon } from "@/components/icons/sacrament-tray";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Lessons", href: "/lessons", icon: BookOpen },
  { label: "Sacrament", href: "/sacrament", icon: SacramentTrayIcon },
  { label: "Activities Library", href: "/activities", icon: Library },
  { label: "Members", href: "/members", icon: Users },
  { label: "Requests", href: "/requests", icon: MessageSquareQuote },
];

function AppSidebar({ onNavigate, onLogout }: { onNavigate: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-serif font-bold text-primary">Youth Connect</h1>
        <p className="text-sm text-muted-foreground">{user.groupName}</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    tooltip={item.label}
                  >
                    <Link href={item.href} className="flex items-center gap-3" onClick={onNavigate}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location === "/settings"}>
              <Link href="/settings" className="flex items-center gap-3" onClick={onNavigate}>
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-3" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const { setOpenMobile } = useSidebar();

  const handleNavigate = () => setOpenMobile(false);

  const handleLogout = async () => {
    setOpenMobile(false);
    await logoutMutation.mutateAsync(undefined);
    setLocation("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex w-full">
      <AppSidebar onNavigate={handleNavigate} onLogout={handleLogout} />
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="md:hidden flex items-center h-16 px-4 border-b border-border bg-card">
          <SidebarTrigger />
          <span className="ml-4 font-serif font-semibold text-primary">Youth Connect</span>
        </header>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutInner>{children}</LayoutInner>
    </SidebarProvider>
  );
}
