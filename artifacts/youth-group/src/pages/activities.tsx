import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListActivities, getListActivitiesQueryKey,
  useVoteActivity,
  useCreateActivity,
  useUpdateActivity,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronUp, ChevronDown, Plus, Library, DollarSign, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const activitySchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description needs more detail"),
  activityType: z.string().min(1, "Type is required"),
  equipmentNeeded: z.string().optional(),
  suggestedLocation: z.string().optional(),
  costEstimate: z.string().optional(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

const activityTypes = ["Spiritual", "Social", "Physical", "Service", "Intellectual", "Other"];

function ActivityFormFields({ form }: { form: ReturnType<typeof useForm<ActivityFormValues>> }) {
  return (
    <>
      <FormField control={form.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl><Input placeholder="E.g. Scripture Chase" data-testid="input-title" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="activityType" render={({ field }) => (
        <FormItem>
          <FormLabel>Type</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger data-testid="select-activity-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            </FormControl>
            <SelectContent>
              {activityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl><Textarea placeholder="How does it work?" className="min-h-[90px]" data-testid="input-description" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="suggestedLocation" render={({ field }) => (
          <FormItem>
            <FormLabel>Suggested Location</FormLabel>
            <FormControl><Input placeholder="Optional" data-testid="input-location" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="equipmentNeeded" render={({ field }) => (
          <FormItem>
            <FormLabel>Equipment Needed</FormLabel>
            <FormControl><Input placeholder="Optional" data-testid="input-equipment" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="costEstimate" render={({ field }) => (
        <FormItem>
          <FormLabel>Cost Estimate</FormLabel>
          <FormControl>
            <Input placeholder="E.g. $5–$10 per person, Free, ~$50 total" data-testid="input-cost-estimate" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );
}

export default function Activities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editActivityId, setEditActivityId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  const queryParams = {
    ...(filterType !== "all" ? { type: filterType } : {}),
    archived: showArchived,
  };

  const { data: activities, isLoading } = useListActivities(queryParams, {
    query: { queryKey: getListActivitiesQueryKey(queryParams) },
  });

  const voteMutation = useVoteActivity();
  const createMutation = useCreateActivity();
  const updateMutation = useUpdateActivity();

  const createForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: { title: "", description: "", activityType: "Spiritual", equipmentNeeded: "", suggestedLocation: "", costEstimate: "" },
  });

  const editForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: { title: "", description: "", activityType: "Spiritual", equipmentNeeded: "", suggestedLocation: "", costEstimate: "" },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
  };

  const handleVote = async (activityId: number, voteType: "up" | "down" | "none") => {
    try {
      await voteMutation.mutateAsync({ activityId, data: { vote: voteType } });
      invalidateAll();
    } catch {
      toast({ title: "Failed to save vote", variant: "destructive" });
    }
  };

  const onCreateSubmit = async (values: ActivityFormValues) => {
    try {
      await createMutation.mutateAsync({ data: values });
      invalidateAll();
      setIsCreateOpen(false);
      createForm.reset();
      toast({ title: "Activity created" });
    } catch {
      toast({ title: "Failed to create activity", variant: "destructive" });
    }
  };

  const openEdit = (activity: NonNullable<typeof activities>[number]) => {
    editForm.reset({
      title: activity.title,
      description: activity.description,
      activityType: activity.activityType,
      equipmentNeeded: activity.equipmentNeeded ?? "",
      suggestedLocation: activity.suggestedLocation ?? "",
      costEstimate: activity.costEstimate ?? "",
    });
    setEditActivityId(activity.id);
  };

  const onEditSubmit = async (values: ActivityFormValues) => {
    if (editActivityId === null) return;
    try {
      await updateMutation.mutateAsync({ activityId: editActivityId, data: values });
      invalidateAll();
      setEditActivityId(null);
      toast({ title: "Activity updated" });
    } catch {
      toast({ title: "Failed to update activity", variant: "destructive" });
    }
  };

  const handleArchiveToggle = async (activity: NonNullable<typeof activities>[number]) => {
    const nextArchived = !activity.archived;
    try {
      await updateMutation.mutateAsync({ activityId: activity.id, data: { archived: nextArchived } });
      invalidateAll();
      toast({ title: nextArchived ? "Activity archived" : "Activity restored" });
    } catch {
      toast({ title: "Failed to update activity", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
            <Library className="w-8 h-8" />
            Activity Library
          </h1>
          <p className="text-muted-foreground mt-1">Browse, vote on, and suggest new ideas.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Active / Archived toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1 gap-1" data-testid="toggle-archived">
            <button
              onClick={() => setShowArchived(false)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!showArchived ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="toggle-active"
            >
              Active
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showArchived ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="toggle-archived-btn"
            >
              Archived
            </button>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {activityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          {!showArchived && (
            <Button onClick={() => { createForm.reset(); setIsCreateOpen(true); }} data-testid="button-suggest-idea">
              <Plus className="w-4 h-4 mr-2" />
              Suggest Idea
            </Button>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Suggest a New Activity</DialogTitle>
            <DialogDescription>Share an idea with the group. Others can vote on it.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <ActivityFormFields form={createForm} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-idea">
                  {createMutation.isPending ? "Saving..." : "Submit Idea"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editActivityId !== null} onOpenChange={(open) => { if (!open) setEditActivityId(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <ActivityFormFields form={editForm} />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditActivityId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-edit">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : activities?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <Library className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">
            {showArchived ? "No archived activities" : "No activities found"}
          </h3>
          <p className="text-muted-foreground mb-6">
            {showArchived ? "Archived activities will appear here." : "Be the first to suggest an idea for the group!"}
          </p>
          {!showArchived && (
            <Button onClick={() => setIsCreateOpen(true)} variant="outline">Suggest an Idea</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {activities?.map(activity => (
            <Card
              key={activity.id}
              data-testid={`card-activity-${activity.id}`}
              className={`flex flex-col h-full border-border transition-opacity ${activity.archived ? "opacity-75" : "hover-elevate"}`}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2 gap-4">
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-2">{activity.activityType}</Badge>
                  <CardTitle className="text-xl leading-tight">{activity.title}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">{activity.description}</CardDescription>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  {/* Vote column */}
                  <div className="flex flex-col items-center bg-muted/30 rounded-lg p-1 min-w-[3rem]">
                    <Button
                      variant="ghost" size="icon"
                      className={`h-8 w-8 ${activity.userVote === "up" ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                      onClick={() => handleVote(activity.id, activity.userVote === "up" ? "none" : "up")}
                      disabled={showArchived}
                      data-testid={`button-upvote-${activity.id}`}
                    >
                      <ChevronUp className="w-5 h-5" />
                    </Button>
                    <span className="font-bold text-lg my-1">{activity.upvotes - activity.downvotes}</span>
                    <Button
                      variant="ghost" size="icon"
                      className={`h-8 w-8 ${activity.userVote === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground"}`}
                      onClick={() => handleVote(activity.id, activity.userVote === "down" ? "none" : "down")}
                      disabled={showArchived}
                      data-testid={`button-downvote-${activity.id}`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Edit / Archive actions for presidency + leader */}
                  {isLeader && (
                    <div className="flex gap-1 mt-1">
                      {!activity.archived && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(activity)}
                          data-testid={`button-edit-${activity.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon"
                        className={`h-7 w-7 ${activity.archived ? "text-primary hover:text-primary/80" : "text-muted-foreground hover:text-amber-600"}`}
                        onClick={() => handleArchiveToggle(activity)}
                        disabled={updateMutation.isPending}
                        title={activity.archived ? "Restore activity" : "Archive activity"}
                        data-testid={`button-archive-${activity.id}`}
                      >
                        {activity.archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                {(activity.equipmentNeeded || activity.suggestedLocation || activity.costEstimate) && (
                  <div className="text-sm text-muted-foreground space-y-1.5 mt-2 bg-muted/10 p-3 rounded-md border border-border/50">
                    {activity.suggestedLocation && (
                      <p><span className="font-medium text-foreground">Location:</span> {activity.suggestedLocation}</p>
                    )}
                    {activity.equipmentNeeded && (
                      <p><span className="font-medium text-foreground">Equipment:</span> {activity.equipmentNeeded}</p>
                    )}
                    {activity.costEstimate && (
                      <p className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-foreground" />
                        <span className="font-medium text-foreground">Cost:</span> {activity.costEstimate}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="text-xs text-muted-foreground border-t pt-4">
                Suggested by {activity.createdByName}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
