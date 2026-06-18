import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Shield, Copy, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!user?.accessCode) return;
    try {
      await navigator.clipboard.writeText(user.accessCode);
      setCopied(true);
      toast({ title: "Access code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-muted-foreground" />
        <h1 className="text-3xl font-serif font-bold text-foreground">Settings</h1>
      </div>

      <div className="grid gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Your personal information in the group</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>First Name</Label>
                <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium">
                  {user?.firstName}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium">
                  {user?.lastName}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Group Assignment</Label>
              <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium flex items-center justify-between">
                <span>{user?.groupName}</span>
                <Badge variant="outline" className="capitalize">{user?.role}</Badge>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <Label>My Access Code</Label>
              <p className="text-sm text-muted-foreground mb-3">
                This is your private code to sign in to Youth Connect. Keep it secure.
              </p>
              <div className="flex gap-2">
                <Input 
                  value={user?.accessCode || ""} 
                  readOnly 
                  className="font-mono text-lg tracking-widest text-center"
                />
                <Button variant="secondary" onClick={copyCode} className="w-24">
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
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
              <p>You currently hold the <strong>{user?.role}</strong> role in {user?.groupName}.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>View the group dashboard, schedule, and roster</li>
                <li>Vote on and suggest new activities</li>
                {user?.role === 'presidency' || user?.role === 'leader' ? (
                  <>
                    <li>Schedule activities and Sunday lessons</li>
                    <li>Manage sacrament blessing rotations</li>
                    <li>Approve or deny substitution requests</li>
                    <li>Invite new members to the group</li>
                  </>
                ) : (
                  <li>Request substitutions for assigned sacrament rotations</li>
                )}
                {user?.role === 'leader' && (
                  <li>Manage member roles, active status, and reset access codes</li>
                )}
              </ul>
              {user?.role === 'member' && (
                <p className="pt-2 italic">Contact your Presidency or Leader to request additional permissions.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
