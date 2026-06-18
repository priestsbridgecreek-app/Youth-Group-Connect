import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { 
  useListLessons, getListLessonsQueryKey,
  useCreateLesson,
  useDeleteLesson,
  useListUsers, getListUsersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const lessonSchema = z.object({
  date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Title is required"),
  topic: z.string().min(1, "Topic is required"),
  instructorId: z.coerce.number().optional().nullable(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export default function Lessons() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: lessons, isLoading } = useListLessons(undefined, {
    query: { queryKey: getListLessonsQueryKey() }
  });
  
  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  const createMutation = useCreateLesson();
  const deleteMutation = useDeleteLesson();

  const form = useForm<z.infer<typeof lessonSchema>>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      title: "",
      topic: "",
      location: "",
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof lessonSchema>) => {
    try {
      await createMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Lesson scheduled successfully" });
    } catch (e) {
      toast({ title: "Failed to schedule lesson", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;
    try {
      await deleteMutation.mutateAsync({ lessonId: id });
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      toast({ title: "Lesson removed" });
    } catch (e) {
      toast({ title: "Failed to delete lesson", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-secondary flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            Sunday Lessons
          </h1>
          <p className="text-muted-foreground mt-1">Schedule and view upcoming instruction.</p>
        </div>

        {isLeader && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Lesson
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Schedule a Lesson</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem><FormLabel>Title</FormLabel><FormControl><Input placeholder="Lesson title" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="topic" render={({ field }) => (
                    <FormItem><FormLabel>Topic / Theme</FormLabel><FormControl><Input placeholder="E.g. Faith, Repentance" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="instructorId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="">None (TBD)</SelectItem>
                          {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="location" render={({ field }) => (
                    <FormItem><FormLabel>Location</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
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

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : lessons?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">No lessons scheduled</h3>
          <p className="text-muted-foreground">The upcoming schedule is empty.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {lessons?.map(item => (
            <Card key={item.id} className="hover-elevate border-border border-l-4 border-l-secondary">
              <CardHeader className="flex flex-row justify-between items-start pb-2">
                <div>
                  <div className="text-sm text-secondary font-medium mb-1">
                    {format(new Date(item.date), "EEEE, MMMM do, yyyy")}
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription className="text-base font-medium text-foreground mt-1">{item.topic}</CardDescription>
                </div>
                {isLeader && (
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div className="space-y-1">
                  {item.instructorName && <div><span className="font-medium text-foreground">Instructor:</span> {item.instructorName}</div>}
                  {item.location && <div><span className="font-medium text-foreground">Location:</span> {item.location}</div>}
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
