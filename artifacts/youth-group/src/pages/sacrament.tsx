import { useState } from "react";
import { useSearch, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  useListSacramentRotations, getListSacramentRotationsQueryKey,
  useCreateSacramentRotation,
  useUpdateSacramentRotation,
  useDeleteSacramentRotation,
  useRandomizeSacramentRotation, getRandomizeSacramentRotationQueryKey,
  useListUsers, getListUsersQueryKey,
  useCreateSubstitutionRequest,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Shuffle, AlertCircle, Pencil } from "lucide-react";
import { SacramentTrayIcon } from "@/components/icons/sacrament-tray";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const rotationSchema = z.object({
  date: z.string().min(1, "Date is required"),
  memberIds: z.array(z.coerce.number()).length(3, "Exactly 3 members must be selected"),
});

const subRequestSchema = z.object({
  rotationId: z.number(),
  reason: z.string().optional(),
});

type RotationFormValues = z.infer<typeof rotationSchema>;

export default function Sacrament() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editRotationId, setEditRotationId] = useState<number | null>(null);
  const [randomizing, setRandomizing] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subRotationId, setSubRotationId] = useState<number>(0);

  const { data: rotations, isLoading } = useListSacramentRotations(undefined, {
    query: { queryKey: getListSacramentRotationsQueryKey() },
  });

  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });

  const activeUsers = users?.filter((u) => u.status === "active" && u.role !== "leader") ?? [];

  const search = useSearch();
  const mineOnly = new URLSearchParams(search).get("mine") === "true";
  const displayedRotations = mineOnly
    ? rotations?.filter(r => r.members.some(m => m.userId === user?.id))
    : rotations;

  const createMutation = useCreateSacramentRotation();
  const updateMutation = useUpdateSacramentRotation();
  const deleteMutation = useDeleteSacramentRotation();
  const requestSubMutation = useCreateSubstitutionRequest();

  const createForm = useForm<RotationFormValues>({
    resolver: zodResolver(rotationSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      memberIds: [],
    },
  });

  const editForm = useForm<RotationFormValues>({
    resolver: zodResolver(rotationSchema),
    defaultValues: {
      date: "",
      memberIds: [],
    },
  });

  const subForm = useForm<z.infer<typeof subRequestSchema>>({
    resolver: zodResolver(subRequestSchema),
    defaultValues: { rotationId: 0, reason: "" },
  });

  const { refetch: randomizeRefetch } = useRandomizeSacramentRotation({
    query: { queryKey: getRandomizeSacramentRotationQueryKey(), enabled: false },
  });

  const handleRandomize = async (form: ReturnType<typeof useForm<RotationFormValues>>) => {
    setRandomizing(true);
    try {
      const { data } = await randomizeRefetch();
      if (data?.members) {
        form.setValue("memberIds", data.members.map((m) => m.userId));
        toast({ title: "Members randomized" });
      }
    } catch {
      toast({ title: "Failed to randomize", variant: "destructive" });
    } finally {
      setRandomizing(false);
    }
  };

  const onCreateSubmit = async (values: RotationFormValues) => {
    try {
      await createMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      setIsCreateOpen(false);
      createForm.reset();
      toast({ title: "Rotation created" });
    } catch {
      toast({ title: "Failed to create rotation", variant: "destructive" });
    }
  };

  const openEdit = (rotation: NonNullable<typeof rotations>[number]) => {
    editForm.reset({
      date: rotation.date,
      memberIds: rotation.members.map((m) => m.userId),
    });
    setEditRotationId(rotation.id);
  };

  const onEditSubmit = async (values: RotationFormValues) => {
    if (editRotationId === null) return;
    try {
      await updateMutation.mutateAsync({ id: editRotationId, data: values });
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      setEditRotationId(null);
      toast({ title: "Rotation updated" });
    } catch {
      toast({ title: "Failed to update rotation", variant: "destructive" });
    }
  };

  const onSubmitSub = async (values: z.infer<typeof subRequestSchema>) => {
    try {
      await requestSubMutation.mutateAsync({ data: { rotationId: subRotationId, reason: values.reason } });
      setSubModalOpen(false);
      subForm.reset();
      toast({ title: "Substitution requested" });
    } catch {
      toast({ title: "Failed to request substitution", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rotation?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      toast({ title: "Rotation removed" });
    } catch {
      toast({ title: "Failed to delete rotation", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  const RotationMemberFields = ({ form }: { form: ReturnType<typeof useForm<RotationFormValues>> }) => (
    <>
      {[0, 1, 2].map((index) => (
        <FormField
          key={index}
          control={form.control}
          name={`memberIds.${index}`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Member {index + 1}</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(parseInt(val))}
                value={field.value?.toString() || ""}
              >
                <FormControl>
                  <SelectTrigger data-testid={`select-member-${index}`}>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activeUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.firstName} {u.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
    </>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
            <SacramentTrayIcon className="w-8 h-8" />
            Sacrament Blessing
          </h1>
          <p className="text-muted-foreground mt-1">Manage weekly blessing rotations.</p>
        </div>

        {isLeader && (
          <Button
            data-testid="button-new-rotation"
            onClick={() => {
              createForm.reset({
                date: new Date().toISOString().split("T")[0],
                memberIds: [],
              });
              setIsCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Rotation
          </Button>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Rotation</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRandomize(createForm)}
              disabled={randomizing}
              data-testid="button-randomize-create"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              {randomizing ? "Randomizing..." : "Randomize"}
            </Button>
          </div>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-create-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <RotationMemberFields form={createForm} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-rotation">
                  {createMutation.isPending ? "Saving..." : "Save Rotation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editRotationId !== null} onOpenChange={(open) => { if (!open) setEditRotationId(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Rotation</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRandomize(editForm)}
              disabled={randomizing}
              data-testid="button-randomize-edit"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              {randomizing ? "Randomizing..." : "Randomize"}
            </Button>
          </div>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" data-testid="input-edit-date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <RotationMemberFields form={editForm} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditRotationId(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Substitution Request Dialog */}
      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Substitution</DialogTitle>
          </DialogHeader>
          <Form {...subForm}>
            <form onSubmit={subForm.handleSubmit(onSubmitSub)} className="space-y-4">
              <FormField
                control={subForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Why do you need a substitute?" data-testid="textarea-sub-reason" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSubModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={requestSubMutation.isPending} data-testid="button-submit-sub">
                  Submit Request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {mineOnly && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Showing your sacrament assignments</p>
          <Link href="/sacrament" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">View all</Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : displayedRotations?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <SacramentTrayIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">
            {mineOnly ? "No upcoming assignments" : "No rotations scheduled"}
          </h3>
          <p className="text-muted-foreground">
            {mineOnly ? "You are not assigned to any upcoming rotations." : "The upcoming sacrament schedule is empty."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedRotations?.map((rotation) => {
            const isAssigned = rotation.members.some((m) => m.userId === user?.id);
            return (
              <Card
                key={rotation.id}
                data-testid={`card-rotation-${rotation.id}`}
                className={`transition-all ${isAssigned ? "bg-primary/5 border-primary/30" : "border-border"}`}
              >
                <CardHeader className="flex flex-row justify-between items-start pb-4">
                  <div className="text-lg font-semibold text-foreground">
                    {format(parseISO(rotation.date), "EEEE, MMMM do")}
                  </div>
                  <div className="flex gap-1 -mt-1 -mr-2">
                    {isAssigned && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSubRotationId(rotation.id);
                          setSubModalOpen(true);
                        }}
                        className="h-8 text-xs"
                        data-testid={`button-request-sub-${rotation.id}`}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Request Sub
                      </Button>
                    )}
                    {isLeader && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(rotation)}
                          className="text-muted-foreground hover:text-foreground"
                          data-testid={`button-edit-rotation-${rotation.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rotation.id)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-rotation-${rotation.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {rotation.members.map((member, idx) => (
                      <li
                        key={member.userId}
                        className="flex items-center gap-3 p-2 rounded-lg bg-background border shadow-sm"
                        data-testid={`member-${rotation.id}-${member.userId}`}
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {idx + 1}
                        </div>
                        <span className={member.userId === user?.id ? "font-bold text-primary" : "font-medium"}>
                          {member.firstName} {member.lastName}
                        </span>
                        {member.userId === user?.id && (
                          <span className="ml-auto text-xs text-primary font-medium">You</span>
                        )}
                      </li>
                    ))}
                    {rotation.members.length === 0 && (
                      <li className="text-sm text-muted-foreground italic p-2">No members assigned</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
