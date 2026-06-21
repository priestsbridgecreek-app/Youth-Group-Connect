import { useAuth } from "@/lib/auth";
import { useUpdateUser, useResetAccessCode } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Shield, Copy, CheckCircle2, Pencil, X, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const updateMutation = useUpdateUser();

  const resetCodeMutation = useResetAccessCode();

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const copyCode = async () => {
    if (!user?.accessCode) return;
    try {
      await navigator.clipboard.writeText(user.accessCode);
      setCopied(true);
      toast({ title: "Access code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const startEditing = () => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveProfile = async () => {
    if (!user) return;
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "Name cannot be blank", variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        userId: user.id,
        data: { firstName: firstName.trim(), lastName: lastName.trim() },
      });
      await refetch();
      setEditing(false);
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Profile</CardTitle>
                <CardDescription>Your personal information in the group</CardDescription>
              </div>
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>First Name</Label>
                {editing ? (
                  <Input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium">
                    {user?.firstName}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                {editing ? (
                  <Input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                  />
                ) : (
                  <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium">
                    {user?.lastName}
                  </div>
                )}
              </div>
            </div>

            {editing && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={cancelEditing}>
                  <X className="w-3.5 h-3.5 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={saveProfile} disabled={updateMutation.isPending}>
                  <Check className="w-3.5 h-3.5 mr-2" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            )}

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
                <Button variant="secondary" onClick={copyCode} className="w-24 shrink-0">
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={resetCodeMutation.isPending}
                onClick={async () => {
                  if (!user) return;
                  try {
                    await resetCodeMutation.mutateAsync({ userId: user.id, data: {} });
                    await refetch();
                    toast({ title: "New access code generated" });
                  } catch {
                    toast({ title: "Failed to generate new code", variant: "destructive" });
                  }
                }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                {resetCodeMutation.isPending ? "Generating…" : "Generate New Code"}
              </Button>
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
                {(user?.role === 'presidency' || user?.role === 'leader') ? (
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
