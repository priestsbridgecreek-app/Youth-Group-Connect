import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useSearch, Link } from "wouter";
import {
  useListLessons, getListLessonsQueryKey,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useListUsers, getListUsersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  title: z.string().min(1, "Lesson is required"),
  topic: z.string().default(""),
  instructorId: z.coerce.number().optional().nullable(),
  assistingId: z.coerce.number().optional().nullable(),
  goalSharingId: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

type LessonForm = z.infer<typeof lessonSchema>;

const NONE = "__none__";

function LessonFormFields({ form, leaders, nonLeaders }: {
  form: ReturnType<typeof useForm<LessonForm>>;
  leaders: { id: number; firstName: string; lastName: string }[];
  nonLeaders: { id: number; firstName: string; lastName: string }[];
}) {
  return (
    <div className="space-y-4">
      <FormField control={form.control} name="date" render={({ field }) => (
        <FormItem>
          <FormLabel>Date</FormLabel>
          <FormControl><Input type="date" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Lesson</FormLabel>
          <FormControl><Input placeholder="Lesson title" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="instructorId" render={({ field }) => (
        <FormItem>
          <FormLabel>Teacher</FormLabel>
          <Select
            onValueChange={(val) => field.onChange(val === NONE ? null : parseInt(val))}
            value={field.value != null ? field.value.toString() : NONE}
          >
            <FormControl><SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value={NONE}>None (TBD)</SelectItem>
              {leaders.map(u => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="assistingId" render={({ field }) => (
        <FormItem>
          <FormLabel>Assisting</FormLabel>
          <Select
            onValueChange={(val) => field.onChange(val === NONE ? null : parseInt(val))}
            value={field.value != null ? field.value.toString() : NONE}
          >
            <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {nonLeaders.map(u => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="goalSharingId" render={({ field }) => (
        <FormItem>
          <FormLabel>Goal Sharing</FormLabel>
          <Select
            onValueChange={(val) => field.onChange(val === NONE ? null : parseInt(val))}
            value={field.value != null ? field.value.toString() : NONE}
          >
            <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {nonLeaders.map(u => (
                <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="notes" render={({ field }) => (
        <FormItem>
          <FormLabel>Notes</FormLabel>
          <FormControl><Textarea placeholder="Optional" className="min-h-[80px]" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
}

export default function Lessons() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: lessons, isLoading } = useListLessons(undefined, {
    query: { queryKey: getListLessonsQueryKey() }
  });

  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  const leaders = users?.filter(u => u.status === "active" && u.role === "leader") ?? [];
  const nonLeaders = users?.filter(u => u.status === "active" && u.role !== "leader") ?? [];

  const createMutation = useCreateLesson();
  const updateMutation = useUpdateLesson();
  const deleteMutation = useDeleteLesson();

  const createForm = useForm<LessonForm>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      title: "",
      topic: "",
      instructorId: null,
      assistingId: null,
      goalSharingId: null,
      notes: "",
    },
  });

  const editForm = useForm<LessonForm>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      date: "",
      title: "",
      topic: "",
      instructorId: null,
      assistingId: null,
      goalSharingId: null,
      notes: "",
    },
  });

  const editingLesson = lessons?.find(l => l.id === editingId);

  const openEdit = (lesson: NonNullable<typeof editingLesson>) => {
    editForm.reset({
      date: lesson.date,
      title: lesson.title,
      topic: lesson.topic ?? "",
      instructorId: lesson.instructorId ?? null,
      assistingId: lesson.assistingId ?? null,
      goalSharingId: lesson.goalSharingId ?? null,
      notes: lesson.notes ?? "",
    });
    setEditingId(lesson.id);
  };

  const onCreateSubmit = async (values: LessonForm) => {
    try {
      await createMutation.mutateAsync({ data: { ...values, topic: values.title } });
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      setIsCreateOpen(false);
      createForm.reset();
      toast({ title: "Lesson scheduled" });
    } catch {
      toast({ title: "Failed to schedule lesson", variant: "destructive" });
    }
  };

  const onEditSubmit = async (values: LessonForm) => {
    if (!editingId) return;
    try {
      await updateMutation.mutateAsync({ lessonId: editingId, data: { ...values, topic: values.title } });
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      setEditingId(null);
      toast({ title: "Lesson updated" });
    } catch {
      toast({ title: "Failed to update lesson", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this lesson?")) return;
    try {
      await deleteMutation.mutateAsync({ lessonId: id });
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      setEditingId(null);
      toast({ title: "Lesson removed" });
    } catch {
      toast({ title: "Failed to delete lesson", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  const search = useSearch();
  const mineOnly = new URLSearchParams(search).get("mine") === "true";
  const fullName = user ? `${user.firstName} ${user.lastName}` : "";
  const displayedLessons = mineOnly
    ? lessons?.filter(item => item.instructorName === fullName)
    : lessons;

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
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Schedule a Lesson</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
                  <LessonFormFields form={createForm} leaders={leaders} nonLeaders={nonLeaders} />
                  <DialogFooter className="pt-6">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Scheduling…" : "Schedule"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <LessonFormFields form={editForm} leaders={leaders} nonLeaders={nonLeaders} />
              <DialogFooter className="pt-6 flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                  onClick={() => editingLesson && handleDelete(editingLesson.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {mineOnly && (
        <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-secondary">Showing lessons you're teaching</p>
          <Link href="/lessons" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2">View all</Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : displayedLessons?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">
            {mineOnly ? "No upcoming lessons assigned" : "No lessons scheduled"}
          </h3>
          <p className="text-muted-foreground">
            {mineOnly ? "You have no upcoming lessons assigned to you as instructor." : "The upcoming schedule is empty."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedLessons?.map(item => (
            <Card
              key={item.id}
              className={`border-border border-l-4 border-l-secondary ${isLeader ? "hover-elevate cursor-pointer" : ""}`}
              onClick={isLeader ? () => openEdit(item) : undefined}
            >
              <CardHeader className="flex flex-row justify-between items-start pb-2">
                <div>
                  <div className="text-sm text-secondary font-medium mb-1">
                    {format(new Date(item.date), "EEEE, MMMM do, yyyy")}
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="space-y-1">
                  {item.instructorName && (
                    <div><span className="font-medium text-foreground">Teacher:</span> {item.instructorName}</div>
                  )}
                  {item.assistingName && (
                    <div><span className="font-medium text-foreground">Assisting:</span> {item.assistingName}</div>
                  )}
                  {item.goalSharingName && (
                    <div><span className="font-medium text-foreground">Goal Sharing:</span> {item.goalSharingName}</div>
                  )}
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
