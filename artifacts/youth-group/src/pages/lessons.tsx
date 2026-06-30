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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, Plus, Trash2, Wand2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const lessonSchema = z.object({
  date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Lesson is required"),
  topic: z.string().default(""),
  instructorId: z.coerce.number().optional().nullable(),
  assistingIds: z.array(z.number()).default([]),
  goalSharingIds: z.array(z.number()).default([]),
  notes: z.string().optional(),
});

type LessonForm = z.infer<typeof lessonSchema>;
type User = { id: number; firstName: string; lastName: string };

const NONE = "__none__";

// Controlled multi-user dropdown with + button to add slots and × to remove.
// `extraSlots` tracks empty placeholder slots not yet assigned to a user.
function MultiUserSelect({
  label,
  ids,
  users,
  onChange,
}: {
  label: string;
  ids: number[];
  users: User[];
  onChange: (ids: number[]) => void;
}) {
  const [extraSlots, setExtraSlots] = useState(0);

  // One empty slot always shown if ids is empty and no extras added
  const filledSlots: (number | null)[] = ids.length === 0 && extraSlots === 0
    ? [null]
    : [...ids, ...Array<null>(extraSlots).fill(null)];

  const handleChange = (index: number, val: string) => {
    if (index < ids.length) {
      // Changing a filled slot
      const next = [...ids];
      if (val === NONE) {
        next.splice(index, 1);
      } else {
        next[index] = parseInt(val);
      }
      onChange(next);
    } else {
      // Filling an extra (empty) slot
      if (val !== NONE) {
        onChange([...ids, parseInt(val)]);
        setExtraSlots(n => Math.max(0, n - 1));
      }
    }
  };

  const handleRemove = (index: number) => {
    if (index < ids.length) {
      onChange(ids.filter((_, i) => i !== index));
    } else {
      setExtraSlots(n => Math.max(0, n - 1));
    }
  };

  const canRemove = filledSlots.length > 1 || (filledSlots.length === 1 && filledSlots[0] !== null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium leading-none">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full border border-border text-muted-foreground hover:text-secondary hover:border-secondary"
          onClick={() => setExtraSlots(n => n + 1)}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {filledSlots.map((slotId, index) => (
        <div key={index} className="flex items-center gap-1">
          <Select
            value={slotId != null ? slotId.toString() : NONE}
            onValueChange={(val) => handleChange(index, val)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id.toString()}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(index)}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function LessonFormFields({ form, leaders, nonLeaders }: {
  form: ReturnType<typeof useForm<LessonForm>>;
  leaders: User[];
  nonLeaders: User[];
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
            <FormControl>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
            </FormControl>
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

      <FormField control={form.control} name="assistingIds" render={({ field }) => (
        <FormItem>
          <MultiUserSelect
            label="Assisting"
            ids={field.value ?? []}
            users={nonLeaders}
            onChange={field.onChange}
          />
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="goalSharingIds" render={({ field }) => (
        <FormItem>
          <MultiUserSelect
            label="Goal Sharing"
            ids={field.value ?? []}
            users={nonLeaders}
            onChange={field.onChange}
          />
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="notes" render={({ field }) => (
        <FormItem>
          <FormLabel>Notes</FormLabel>
          <FormControl>
            <Textarea placeholder="Optional" className="min-h-[80px]" {...field} />
          </FormControl>
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
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoFillWeeks, setAutoFillWeeks] = useState(4);
  const [autoFillPreview, setAutoFillPreview] = useState<string[]>([]);
  const [autoFillGenerated, setAutoFillGenerated] = useState(false);
  const [isSavingAutoFill, setIsSavingAutoFill] = useState(false);

  const { data: lessons, isLoading } = useListLessons(undefined, {
    query: { queryKey: getListLessonsQueryKey() }
  });
  const { data: users } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });

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
      assistingIds: [],
      goalSharingIds: [],
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
      assistingIds: [],
      goalSharingIds: [],
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
      assistingIds: lesson.assistingIds ?? [],
      goalSharingIds: lesson.goalSharingIds ?? [],
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
      await updateMutation.mutateAsync({ id: editingId, data: { ...values, topic: values.title } });
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
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      setEditingId(null);
      toast({ title: "Lesson removed" });
    } catch {
      toast({ title: "Failed to delete lesson", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  const getUpcomingSundays = (n: number): string[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const daysUntil = day === 0 ? 0 : 7 - day;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + daysUntil + i * 7);
      return d.toISOString().split("T")[0];
    });
  };

  const generateAutoFillPreview = () => {
    const existingDates = new Set((lessons ?? []).map(l => l.date));
    const sundays = getUpcomingSundays(autoFillWeeks);
    setAutoFillPreview(sundays.filter(d => !existingDates.has(d)));
    setAutoFillGenerated(true);
  };

  const handleSaveAutoFill = async () => {
    setIsSavingAutoFill(true);
    try {
      for (const date of autoFillPreview) {
        await createMutation.mutateAsync({ data: { date, title: "TBD", topic: "TBD" } });
      }
      queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey() });
      setAutoFillOpen(false);
      setAutoFillPreview([]);
      setAutoFillGenerated(false);
      toast({ title: `${autoFillPreview.length} lesson${autoFillPreview.length !== 1 ? "s" : ""} scheduled` });
    } catch {
      toast({ title: "Failed to save some lessons", variant: "destructive" });
    } finally {
      setIsSavingAutoFill(false);
    }
  };

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setAutoFillOpen(true); setAutoFillPreview([]); setAutoFillGenerated(false); }}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Auto-fill Sundays
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Lesson
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
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
          </div>
        )}
      </div>

      {/* Auto-fill dialog */}
      <Dialog open={autoFillOpen} onOpenChange={(open) => {
        setAutoFillOpen(open);
        if (!open) { setAutoFillPreview([]); setAutoFillGenerated(false); }
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-secondary" />
              Auto-fill Sundays
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create placeholder lesson entries for upcoming Sundays. Each will be saved as "TBD" — click any entry afterwards to fill in the details.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">Sundays to schedule</label>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => { setAutoFillWeeks(w => Math.max(1, w - 1)); setAutoFillGenerated(false); }}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums select-none">{autoFillWeeks}</span>
                <Button type="button" variant="outline" size="icon" className="h-8 w-8"
                  onClick={() => { setAutoFillWeeks(w => Math.min(52, w + 1)); setAutoFillGenerated(false); }}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <Button type="button" variant="secondary" onClick={generateAutoFillPreview}>
                <Wand2 className="w-4 h-4 mr-2" />Preview
              </Button>
            </div>
            {autoFillPreview.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Preview — {autoFillPreview.length} lesson{autoFillPreview.length !== 1 ? "s" : ""} to create
                </div>
                <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                  {autoFillPreview.map(date => (
                    <li key={date} className="px-3 py-2.5 text-sm font-medium text-foreground">
                      {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {autoFillPreview.length === 0 && autoFillGenerated && (
              <div className="text-sm text-center py-4 border border-dashed border-border rounded-lg px-4">
                <p className="text-muted-foreground">
                  All {autoFillWeeks} upcoming Sundays are already scheduled.{" "}
                  <button type="button" className="underline font-medium text-foreground hover:text-secondary"
                    onClick={() => { setAutoFillWeeks(w => w + 4); setAutoFillGenerated(false); }}>
                    Try {autoFillWeeks + 4} weeks instead
                  </button>
                </p>
              </div>
            )}
            {!autoFillGenerated && (
              <div className="text-sm text-center py-4 border border-dashed border-border rounded-lg px-4">
                <p className="text-muted-foreground">
                  Click <span className="font-medium text-foreground">Preview</span> to see which Sundays will be added.
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setAutoFillOpen(false)}>Cancel</Button>
            <Button type="button" disabled={autoFillPreview.length === 0 || isSavingAutoFill} onClick={handleSaveAutoFill}>
              {isSavingAutoFill ? "Saving…"
                : autoFillPreview.length > 0
                ? `Save ${autoFillPreview.length} Lesson${autoFillPreview.length !== 1 ? "s" : ""}`
                : "Save Lessons"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog — key resets MultiUserSelect internal state when switching lessons */}
      <Dialog open={editingId !== null} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form key={editingId ?? "edit"} onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <LessonFormFields form={editForm} leaders={leaders} nonLeaders={nonLeaders} />
              <DialogFooter className="pt-6 flex justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                  onClick={() => editingLesson && handleDelete(editingLesson.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />Delete
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
            {mineOnly
              ? "You have no upcoming lessons assigned to you as instructor."
              : "The upcoming schedule is empty."}
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
                    {format(parseISO(item.date), "EEEE, MMMM do, yyyy")}
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="space-y-1">
                  {item.instructorName && (
                    <div><span className="font-medium text-foreground">Teacher:</span> {item.instructorName}</div>
                  )}
                  {(item.assistingNames ?? []).length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">Assisting:</span>{" "}
                      {(item.assistingNames ?? []).join(", ")}
                    </div>
                  )}
                  {(item.goalSharingNames ?? []).length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">Goal Sharing:</span>{" "}
                      {(item.goalSharingNames ?? []).join(", ")}
                    </div>
                  )}
                </div>
                <div>
                  {item.notes && (
                    <p><span className="font-medium text-foreground">Notes:</span> {item.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
