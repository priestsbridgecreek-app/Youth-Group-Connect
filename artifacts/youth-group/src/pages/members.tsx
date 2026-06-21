import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { 
  useListUsers, getListUsersQueryKey,
  useInviteUser,
  useUpdateUser,
  useResetAccessCode
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, UserPlus, Shield, MoreVertical, KeyRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const inviteSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["member", "presidency", "leader"]),
});

export default function Members() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [resetCodeModal, setResetCodeModal] = useState<{isOpen: boolean, userId: number, userName: string}>({isOpen: false, userId: 0, userName: ""});
  const [newAccessCode, setNewAccessCode] = useState("");

  const { data: users, isLoading } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  const inviteMutation = useInviteUser();
  const updateMutation = useUpdateUser();
  const resetMutation = useResetAccessCode();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      role: "member",
    },
  });

  const onInvite = async (values: z.infer<typeof inviteSchema>) => {
    try {
      const res = await inviteMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setIsInviteOpen(false);
      form.reset();
      
      // Auto-open reset code modal to show the new code
      setNewAccessCode(res.accessCode);
      setResetCodeModal({ isOpen: true, userId: res.id, userName: `${res.firstName} ${res.lastName}` });
      
      toast({ title: "Member invited successfully" });
    } catch (e) {
      toast({ title: "Failed to invite member", variant: "destructive" });
    }
  };

  const handleUpdateRole = async (userId: number, role: "member" | "presidency" | "leader") => {
    try {
      await updateMutation.mutateAsync({ userId, data: { role } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Role updated" });
    } catch (e) {
      toast({ title: "Failed to update role", variant: "destructive" });
    }
  };

  const handleUpdateStatus = async (userId: number, status: "active" | "inactive" | "archived") => {
    try {
      await updateMutation.mutateAsync({ userId, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: `Status set to ${status}` });
    } catch (e) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleResetCode = async (userId: number) => {
    try {
      const res = await resetMutation.mutateAsync({ userId, data: {} });
      setNewAccessCode(res.accessCode);
      // The modal is already open at this point
    } catch (e) {
      toast({ title: "Failed to reset access code", variant: "destructive" });
    }
  };

  const isPresidency = user?.role === "presidency" || user?.role === "leader";
  const isLeader = user?.role === "leader";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
            <Users className="w-8 h-8" />
            Group Roster
          </h1>
          <p className="text-muted-foreground mt-1">Manage members of {user?.groupName}.</p>
        </div>

        {isPresidency && (
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a New Member</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onInvite)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="firstName" render={({ field }) => (
                      <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (
                      <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  {isLeader && (
                    <FormField control={form.control} name="role" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="presidency">Presidency</SelectItem>
                            <SelectItem value="leader">Leader</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? "Adding..." : "Add Member"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={resetCodeModal.isOpen} onOpenChange={(open) => setResetCodeModal(prev => ({...prev, isOpen: open}))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access Code for {resetCodeModal.userName}</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-muted-foreground mb-4">Share this secure access code with {resetCodeModal.userName}. They will need it to sign in.</p>
            <div className="bg-muted/50 p-6 rounded-lg border border-border border-dashed">
              <div className="text-4xl font-mono tracking-widest font-bold text-primary">
                {newAccessCode || "..."}
              </div>
            </div>
            {!newAccessCode && (
              <Button className="mt-4" onClick={() => handleResetCode(resetCodeModal.userId)} disabled={resetMutation.isPending}>
                Generate New Code
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setResetCodeModal({isOpen: false, userId: 0, userName: ""})}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users?.map(member => (
            <Card
              key={member.id}
              className={`hover-elevate border-border ${member.status === 'archived' ? 'opacity-50' : ''} ${isLeader ? 'cursor-pointer' : ''}`}
              onClick={isLeader ? () => navigate(`/members/${member.id}`) : undefined}
            >
              <CardContent className="p-4 flex justify-between items-center h-full">
                <div className="space-y-1.5">
                  <div className="font-semibold text-lg flex items-center gap-2">
                    {member.firstName} {member.lastName}
                    {member.id === user?.id && <Badge variant="outline" className="text-xs font-normal">You</Badge>}
                  </div>
                  <div className="flex gap-2">
                    {member.role === 'leader' && <Badge variant="secondary" className="text-[10px] uppercase tracking-wider"><Shield className="w-3 h-3 mr-1"/> Leader</Badge>}
                    {member.role === 'presidency' && <Badge variant="default" className="text-[10px] uppercase tracking-wider bg-primary/80">Presidency</Badge>}
                    {member.status !== 'active' && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{member.status}</Badge>}
                  </div>
                </div>
                
                {isPresidency && member.id !== user?.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Manage Member</DropdownMenuLabel>
                      {isLeader && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setNewAccessCode("");
                            setResetCodeModal({isOpen: true, userId: member.id, userName: `${member.firstName} ${member.lastName}`});
                          }}>
                            <KeyRound className="w-4 h-4 mr-2" /> Reset Access Code
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUpdateRole(member.id, member.role === "member" ? "presidency" : "member")}>
                            {member.role === "member" ? "Make Presidency" : "Remove Presidency"}
                          </DropdownMenuItem>
                        </>
                      )}
                      {isLeader && (
                        <>
                          <DropdownMenuSeparator />
                          {member.status === "active" ? (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(member.id, "inactive")}>Mark Inactive</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(member.id, "active")}>Mark Active</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleUpdateStatus(member.id, "archived")} className="text-destructive focus:text-destructive">Archive Member</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
