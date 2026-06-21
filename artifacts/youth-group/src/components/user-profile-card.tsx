import { useState } from "react";
import { useUpdateUser, useResetAccessCode } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, CheckCircle2, Pencil, X, Check, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface UserLike {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  groupName?: string | null;
  accessCode?: string | null;
}

interface UserProfileCardProps {
  targetUser: UserLike;
  onSaved?: () => void;
  readonlyName?: boolean;
}

export function UserProfileCard({ targetUser, onSaved, readonlyName = false }: UserProfileCardProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateUser();
  const resetCodeMutation = useResetAccessCode();

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customDigits, setCustomDigits] = useState("");
  const [settingCode, setSettingCode] = useState(false);
  const [liveCode, setLiveCode] = useState<string | null>(null);

  const displayCode = liveCode ?? targetUser.accessCode ?? "";
  const initials = `${targetUser.firstName[0] ?? ""}${targetUser.lastName[0] ?? ""}`.toUpperCase();

  const copyCode = async () => {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      toast({ title: "Access code copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const startEditing = () => {
    setFirstName(targetUser.firstName);
    setLastName(targetUser.lastName);
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "Name cannot be blank", variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        userId: targetUser.id,
        data: { firstName: firstName.trim(), lastName: lastName.trim() },
      });
      setEditing(false);
      onSaved?.();
      toast({ title: "Profile updated" });
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Personal information and access</CardDescription>
          </div>
          {!readonlyName && !editing && (
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
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
            ) : (
              <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium">
                {targetUser.firstName}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Last Name</Label>
            {editing ? (
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            ) : (
              <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium">
                {targetUser.lastName}
              </div>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={saveProfile} disabled={updateMutation.isPending}>
              <Check className="w-3.5 h-3.5 mr-2" />
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}

        {targetUser.groupName && (
          <div className="space-y-2">
            <Label>Group</Label>
            <div className="p-3 bg-muted/30 border border-border rounded-md text-foreground font-medium flex items-center justify-between">
              <span>{targetUser.groupName}</span>
              <Badge variant="outline" className="capitalize">{targetUser.role}</Badge>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-4 border-t border-border">
          <Label>Access Code</Label>
          <p className="text-sm text-muted-foreground mb-3">
            Private sign-in code. Share it directly with the member.
          </p>
          <div className="flex gap-2">
            <Input
              value={displayCode}
              readOnly
              className="font-mono text-lg tracking-widest text-center"
            />
            <Button variant="secondary" onClick={copyCode} className="w-24 shrink-0">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={resetCodeMutation.isPending}
              onClick={async () => {
                try {
                  const res = await resetCodeMutation.mutateAsync({ userId: targetUser.id, data: {} });
                  setLiveCode(res.accessCode ?? null);
                  setSettingCode(false);
                  onSaved?.();
                  toast({ title: "New access code generated" });
                } catch {
                  toast({ title: "Failed to generate new code", variant: "destructive" });
                }
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              {resetCodeMutation.isPending ? "Generating…" : "Generate Random"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSettingCode(s => !s); setCustomDigits(""); }}
            >
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Set Manually
            </Button>
          </div>

          {settingCode && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted-foreground">
                Enter 4 digits. Initials <span className="font-mono font-bold text-foreground">{initials}</span> will be added automatically.
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-foreground tracking-widest">{initials}</span>
                <Input
                  className="font-mono text-lg tracking-widest text-center w-28"
                  placeholder="0000"
                  maxLength={4}
                  value={customDigits}
                  onChange={e => setCustomDigits(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={customDigits.length !== 4 || resetCodeMutation.isPending}
                  onClick={async () => {
                    if (customDigits.length !== 4) return;
                    try {
                      const res = await resetCodeMutation.mutateAsync({
                        userId: targetUser.id,
                        data: { customCode: `${initials}${customDigits}` },
                      });
                      setLiveCode(res.accessCode ?? null);
                      setSettingCode(false);
                      setCustomDigits("");
                      onSaved?.();
                      toast({ title: "Access code updated" });
                    } catch {
                      toast({ title: "Failed to set code", variant: "destructive" });
                    }
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setSettingCode(false); setCustomDigits(""); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              {customDigits.length === 4 && (
                <p className="text-xs text-muted-foreground">
                  New code will be: <span className="font-mono font-bold text-foreground">{initials}{customDigits}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
