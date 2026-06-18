import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { 
  useListActivities, getListActivitiesQueryKey,
  useVoteActivity,
  useCreateActivity
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronUp, ChevronDown, Plus, Library } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const activitySchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description needs more detail"),
  activityType: z.string().min(1, "Type is required"),
  equipmentNeeded: z.string().optional(),
  suggestedLocation: z.string().optional(),
});

export default function Activities() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const { data: activities, isLoading } = useListActivities(
    filterType !== "all" ? { type: filterType } : undefined,
    { query: { queryKey: getListActivitiesQueryKey(filterType !== "all" ? { type: filterType } : undefined) } }
  );

  const voteMutation = useVoteActivity();
  const createMutation = useCreateActivity();

  const form = useForm<z.infer<typeof activitySchema>>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: "",
      description: "",
      activityType: "Spiritual",
      equipmentNeeded: "",
      suggestedLocation: "",
    },
  });

  const handleVote = async (activityId: number, voteType: "up" | "down" | "none") => {
    try {
      await voteMutation.mutateAsync({ activityId, data: { vote: voteType } });
      queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
    } catch (e) {
      toast({ title: "Failed to save vote", variant: "destructive" });
    }
  };

  const onSubmit = async (values: z.infer<typeof activitySchema>) => {
    try {
      await createMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Activity created" });
    } catch (e) {
      toast({ title: "Failed to create activity", variant: "destructive" });
    }
  };

  const activityTypes = ["Spiritual", "Social", "Physical", "Service", "Intellectual", "Other"];

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

        <div className="flex items-center gap-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {activityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Suggest Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Suggest a New Activity</DialogTitle>
                <DialogDescription>
                  Share an idea with the group. Others can vote on it.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="E.g. Scripture Chase" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="activityType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {activityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="How does it work?" className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="suggestedLocation" render={({ field }) => (
                      <FormItem><FormLabel>Suggested Location</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="equipmentNeeded" render={({ field }) => (
                      <FormItem><FormLabel>Equipment Needed</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Saving..." : "Submit Idea"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : activities?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <Library className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">No activities found</h3>
          <p className="text-muted-foreground mb-6">Be the first to suggest an idea for the group!</p>
          <Button onClick={() => setIsCreateOpen(true)} variant="outline">Suggest an Idea</Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {activities?.map(activity => (
            <Card key={activity.id} className="flex flex-col h-full hover-elevate border-border">
              <CardHeader className="flex flex-row items-start justify-between pb-2 gap-4">
                <div>
                  <Badge variant="outline" className="mb-2">{activity.activityType}</Badge>
                  <CardTitle className="text-xl leading-tight">{activity.title}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">{activity.description}</CardDescription>
                </div>
                <div className="flex flex-col items-center bg-muted/30 rounded-lg p-1 min-w-[3rem]">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 ${activity.userVote === "up" ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                    onClick={() => handleVote(activity.id, activity.userVote === "up" ? "none" : "up")}
                  >
                    <ChevronUp className="w-5 h-5" />
                  </Button>
                  <span className="font-bold text-lg my-1">{activity.upvotes - activity.downvotes}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 ${activity.userVote === "down" ? "text-destructive bg-destructive/10" : "text-muted-foreground"}`}
                    onClick={() => handleVote(activity.id, activity.userVote === "down" ? "none" : "down")}
                  >
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                {(activity.equipmentNeeded || activity.suggestedLocation) && (
                  <div className="text-sm text-muted-foreground space-y-1 mt-4 bg-muted/10 p-3 rounded-md border border-border/50">
                    {activity.suggestedLocation && <p><span className="font-medium text-foreground">Location:</span> {activity.suggestedLocation}</p>}
                    {activity.equipmentNeeded && <p><span className="font-medium text-foreground">Needs:</span> {activity.equipmentNeeded}</p>}
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
