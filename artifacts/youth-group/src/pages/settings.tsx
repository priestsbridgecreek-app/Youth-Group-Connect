import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Shield, CalendarDays, Link2, Check } from "lucide-react";
import { UserProfileCard } from "@/components/user-profile-card";

export default function Settings() {
  const { user, refetch } = useAuth();
  const [copied, setCopied] = useState(false);
  const calendarUrl = `${window.location.origin}/api/calendar/activities.ics`;

  const handleCopyCalendarUrl = () => {
    navigator.clipboard.writeText(calendarUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!user) return null;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-muted-foreground" />
        <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
      </div>

      <div className="grid gap-6">
        <UserProfileCard targetUser={user} onSaved={refetch} viewerCanManageSacramentExclusion={false} />

        <Card className="border-border bg-muted/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-muted-foreground" />
              Calendar Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subscribe to the group activity calendar so it stays up to date automatically in your calendar app.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={calendarUrl}
                className="flex-1 min-w-0 text-xs bg-background border border-border rounded-md px-3 py-2 text-muted-foreground font-mono truncate cursor-text"
                onFocus={(e) => e.target.select()}
              />
              <Button size="sm" variant="outline" onClick={handleCopyCalendarUrl} className="shrink-0 gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Link2 className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy URL"}
              </Button>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li><strong>Google Calendar:</strong> Other calendars → From URL → paste → Add Calendar</li>
              <li><strong>Apple Calendar:</strong> File → New Calendar Subscription → paste → Subscribe</li>
              <li><strong>iPhone:</strong> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border bg-muted/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-muted-foreground" />
              Role & Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-4">
              <p>You currently hold the <strong>{user.role}</strong> role in {user.groupName}.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>View the group dashboard, schedule, and roster</li>
                <li>Vote on and suggest new activities</li>
                {(user.role === 'presidency' || user.role === 'leader') ? (
                  <>
                    <li>Schedule activities and Sunday lessons</li>
                    <li>Manage sacrament blessing rotations</li>
                    <li>Approve or deny substitution requests</li>
                    <li>Invite new members to the group</li>
                  </>
                ) : (
                  <li>Request substitutions for assigned sacrament rotations</li>
                )}
                {user.role === 'leader' && (
                  <li>Manage member roles, active status, and reset access codes</li>
                )}
              </ul>
              {user.role === 'member' && (
                <p className="pt-2 italic">Contact your Presidency or Leader to request additional permissions.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
