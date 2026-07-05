import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Shield } from "lucide-react";
import { UserProfileCard } from "@/components/user-profile-card";

export default function Settings() {
  const { user, refetch } = useAuth();

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
