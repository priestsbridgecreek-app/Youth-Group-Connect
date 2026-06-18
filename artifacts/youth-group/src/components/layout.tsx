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
  Coffee
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync(undefined);
    setLocation("/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Home },
    { label: "Schedule", href: "/schedule", icon: CalendarDays },
    { label: "Lessons", href: "/lessons", icon: BookOpen },
    { label: "Sacrament", href: "/sacrament", icon: Coffee },
    { label: "Activities Library", href: "/activities", icon: Library },
    { label: "Members", href: "/members", icon: Users },
    { label: "Requests", href: "/requests", icon: MessageSquareQuote },
  ];

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
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
                        <Link href={item.href} className="flex items-center gap-3">
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
                  <Link href="/settings" className="flex items-center gap-3">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="w-4 h-4 mr-3" />
                  <span>Log out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        
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
    </SidebarProvider>
  );
}
