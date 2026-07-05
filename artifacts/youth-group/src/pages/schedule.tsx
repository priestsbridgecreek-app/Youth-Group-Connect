import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSearch, Link } from "wouter";
import { 
  useListScheduledActivities, getListScheduledActivitiesQueryKey,
  useCreateScheduledActivity,
  useUpdateScheduledActivity,
  useDeleteScheduledActivity,
  useListActivities, getListActivitiesQueryKey,
  useListUsers, getListUsersQueryKey,
  useCreateActivity,
  type ScheduledActivity
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, Plus, Trash2, Library, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const scheduleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  activityId: z.coerce.number().min(1, "Activity is required"),
  personInChargeId: z.coerce.number().optional().nullable(),
  treatsAssigneeId: z.coerce.number().optional().nullable(),
  location: z.string().optional(),
  equipment: z.string().optional(),
  notes: z.string().optional(),
});

const quickActivitySchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description needs more detail"),
  activityType: z.string().min(1, "Type is required"),
});

export default function Schedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduledActivity | null>(null);

  const { data: scheduled, isLoading: isLoadingScheduled } = useListScheduledActivities(undefined, {
    query: { queryKey: getListScheduledActivitiesQueryKey() }
  });
  
  const { data: activities } = useListActivities(undefined, {
    query: { queryKey: getListActivitiesQueryKey() }
  });
  
  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  const createMutation = useCreateScheduledActivity();
  const updateMutation = useUpdateScheduledActivity();
  const deleteMutation = useDeleteScheduledActivity();
  const createActivityMutation = useCreateActivity();

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      location: "",
      equipment: "",
      notes: "",
    },
  });

  const watchedActivityId = form.watch("activityId");
  const selectedActivity = activities?.find(a => a.id.toString() === watchedActivityId?.toString());

  const editForm = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      date: "",
      location: "",
      equipment: "",
      notes: "",
    },
  });

  const editWatchedActivityId = editForm.watch("activityId");
  const editSelectedActivity = activities?.find(a => a.id.toString() === editWatchedActivityId?.toString());

  const quickActivityForm = useForm<z.infer<typeof quickActivitySchema>>({
    resolver: zodResolver(quickActivitySchema),
    defaultValues: {
      title: "",
      description: "",
      activityType: "Spiritual",
    },
  });

  const onSubmit = async (values: z.infer<typeof scheduleSchema>) => {
    try {
      await createMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListScheduledActivitiesQueryKey() });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Activity scheduled successfully" });
    } catch (e) {
      toast({ title: "Failed to schedule activity", variant: "destructive" });
    }
  };

  const onQuickCreateActivity = async (values: z.infer<typeof quickActivitySchema>) => {
    try {
      const newActivity = await createActivityMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
      form.setValue("activityId", newActivity.id);
      setIsQuickCreateOpen(false);
      quickActivityForm.reset();
      toast({ title: "Activity created and selected" });
    } catch (e) {
      toast({ title: "Failed to create activity", variant: "destructive" });
    }
  };

  const openEditDialog = (item: ScheduledActivity) => {
    setEditingItem(item);
    editForm.reset({
      date: item.date.split("T")[0],
      activityId: item.activityId,
      personInChargeId: item.personInChargeId ?? null,
      treatsAssigneeId: item.treatsAssigneeId ?? null,
      location: item.location ?? "",
      equipment: item.equipment ?? "",
      notes: item.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const onEditSubmit = async (values: z.infer<typeof scheduleSchema>) => {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({ id: editingItem.id, data: values });
      queryClient.invalidateQueries({ queryKey: getListScheduledActivitiesQueryKey() });
      setIsEditOpen(false);
      setEditingItem(null);
      toast({ title: "Scheduled activity updated" });
    } catch (e) {
      toast({ title: "Failed to update activity", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this scheduled activity?")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListScheduledActivitiesQueryKey() });
      toast({ title: "Activity removed from schedule" });
    } catch (e) {
      toast({ title: "Failed to delete activity", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  const search = useSearch();
  const mineOnly = new URLSearchParams(search).get("mine") === "true";
  const fullName = user ? `${user.firstName} ${user.lastName}` : "";
  const displayedScheduled = mineOnly
    ? scheduled?.filter(item =>
        item.personInChargeName === fullName || item.treatsAssigneeName === fullName
      )
    : scheduled;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
            <CalendarDays className="w-8 h-8" />
            Schedule
          </h1>
          <p className="text-muted-foreground mt-1">Weekly activities calendar.</p>
        </div>

        {isLeader && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Activity
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]" onOpenAutoFocus={(e) => e.preventDefault()}>
              <DialogHeader>
                <DialogTitle>Schedule an Activity</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="activityId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex justify-between items-center">
                        Activity
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs text-primary"
                          onClick={() => setIsQuickCreateOpen(true)}
                        >
                          <Plus className="w-3 h-3 mr-1" /> New
                        </Button>
                      </FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          const selected = activities?.find(a => a.id.toString() === val);
                          if (selected) {
                            form.setValue("location", selected.suggestedLocation ?? "");
                            form.setValue("equipment", selected.equipmentNeeded ?? "");
                          }
                        }}
                        value={field.value?.toString() || ""}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder="Select an activity" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {activities?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {selectedActivity && (
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1 text-sm text-muted-foreground">
                      <div><span className="font-medium text-foreground">Type:</span> {selectedActivity.activityType}</div>
                      {selectedActivity.costEstimate && (
                        <div><span className="font-medium text-foreground">Cost Estimate:</span> {selectedActivity.costEstimate}</div>
                      )}
                      {selectedActivity.description && (
                        <div><span className="font-medium text-foreground">Description:</span> {selectedActivity.description}</div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="personInChargeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Person in Charge</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                          value={field.value?.toString() || "__none__"}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="treatsAssigneeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Treats</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                          value={field.value?.toString() || "__none__"}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="equipment" render={({ field }) => (
                    <FormItem><FormLabel>Equipment</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional" className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Scheduling..." : "Schedule"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={isQuickCreateOpen} onOpenChange={setIsQuickCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Create Activity</DialogTitle>
            <DialogDescription>
              Add a new activity to the library and select it.
            </DialogDescription>
          </DialogHeader>
          <Form {...quickActivityForm}>
            <form onSubmit={quickActivityForm.handleSubmit(onQuickCreateActivity)} className="space-y-4">
              <FormField control={quickActivityForm.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="E.g. Scripture Chase" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={quickActivityForm.control} name="activityType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Spiritual", "Social", "Physical", "Service", "Intellectual", "Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={quickActivityForm.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Brief description..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsQuickCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createActivityMutation.isPending}>Create & Select</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="sm:max-w-[500px]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Scheduled Activity</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="activityId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity</FormLabel>
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      const selected = activities?.find(a => a.id.toString() === val);
                      if (selected) {
                        editForm.setValue("location", selected.suggestedLocation ?? "");
                        editForm.setValue("equipment", selected.equipmentNeeded ?? "");
                      }
                    }}
                    value={field.value?.toString() || ""}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select an activity" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {activities?.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              {editSelectedActivity && (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-1 text-sm text-muted-foreground">
                  <div><span className="font-medium text-foreground">Type:</span> {editSelectedActivity.activityType}</div>
                  {editSelectedActivity.costEstimate && (
                    <div><span className="font-medium text-foreground">Cost Estimate:</span> {editSelectedActivity.costEstimate}</div>
                  )}
                  {editSelectedActivity.description && (
                    <div><span className="font-medium text-foreground">Description:</span> {editSelectedActivity.description}</div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="personInChargeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person in Charge</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                      value={field.value?.toString() || "__none__"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="treatsAssigneeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Treats</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)}
                      value={field.value?.toString() || "__none__"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="location" render={({ field }) => (
                <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="equipment" render={({ field }) => (
                <FormItem><FormLabel>Equipment</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Optional" className="min-h-[80px]" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {mineOnly && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-primary">Showing your assigned activities</p>
          <Link href="/schedule" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">View all</Link>
        </div>
      )}

      {isLoadingScheduled ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : displayedScheduled?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <CalendarDays className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">
            {mineOnly ? "No upcoming assignments" : "No activities scheduled"}
          </h3>
          <p className="text-muted-foreground">
            {mineOnly ? "You have no upcoming activities assigned to you." : "The upcoming schedule is empty."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedScheduled?.map(item => (
            <Card key={item.id} className="hover-elevate border-border">
              <CardHeader className="flex flex-row justify-between items-start pb-2">
                <div>
                  <div className="text-sm text-primary font-medium mb-1">
                    {format(new Date(item.date), "EEEE, MMMM do, yyyy")}
                  </div>
                  <CardTitle>{item.activityTitle}</CardTitle>
                </div>
                {isLeader && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="space-y-1">
                  {item.location && <div><span className="font-medium text-foreground">Location:</span> {item.location}</div>}
                  {item.equipment && <div><span className="font-medium text-foreground">Equipment:</span> {item.equipment}</div>}
                  {item.personInChargeName && <div><span className="font-medium text-foreground">In charge:</span> {item.personInChargeName}</div>}
                  {item.treatsAssigneeName && <div><span className="font-medium text-foreground">Treats:</span> {item.treatsAssigneeName}</div>}
                </div>
                <div>
                  {item.notes && <p><span className="font-medium text-foreground">Notes:</span> {item.notes}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
