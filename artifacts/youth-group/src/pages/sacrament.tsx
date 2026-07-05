import { useState, useMemo, useEffect } from "react";
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
import { Plus, Trash2, Shuffle, AlertCircle, Pencil, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { SacramentTrayIcon } from "@/components/icons/sacrament-tray";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";

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
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoFillWeeks, setAutoFillWeeks] = useState(4);
  const [autoFillPreview, setAutoFillPreview] = useState<{ date: string; memberIds: number[]; memberNames: string[] }[]>([]);
  const [isSavingAutoFill, setIsSavingAutoFill] = useState(false);
  const [autoFillGenerated, setAutoFillGenerated] = useState(false);

  const { data: rotations, isLoading } = useListSacramentRotations(undefined, {
    query: { queryKey: getListSacramentRotationsQueryKey() },
  });

  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });

  const activeUsers = users?.filter((u) => u.status === "active" && u.role !== "leader") ?? [];

  // Map each userId to their most-recent rotation date
  const userLastAssigned = useMemo(() => {
    const map = new Map<number, string>();
    for (const rotation of rotations ?? []) {
      for (const member of rotation.members) {
        const existing = map.get(member.userId);
        if (!existing || rotation.date > existing) {
          map.set(member.userId, rotation.date);
        }
      }
    }
    return map;
  }, [rotations]);

  // Sort active users: never-assigned first, then by oldest assignment date
  const sortedByOverdue = useMemo(() => {
    return [...activeUsers].sort((a, b) => {
      const aDate = userLastAssigned.get(a.id);
      const bDate = userLastAssigned.get(b.id);
      if (!aDate && !bDate) return 0;
      if (!aDate) return -1;
      if (!bDate) return 1;
      return aDate < bDate ? -1 : 1;
    });
  }, [activeUsers, userLastAssigned]);

  // Suggested = top 3 plus any ties at position 3
  const suggestedUserIds = useMemo(() => {
    if (sortedByOverdue.length === 0) return new Set<number>();
    const cutoffUser = sortedByOverdue[Math.min(2, sortedByOverdue.length - 1)];
    const cutoffDate = userLastAssigned.get(cutoffUser.id); // undefined = never assigned
    const ids = new Set<number>();
    for (const u of sortedByOverdue) {
      const d = userLastAssigned.get(u.id);
      if (cutoffDate === undefined) {
        if (d === undefined) ids.add(u.id);
      } else {
        if (d === undefined || d <= cutoffDate) ids.add(u.id);
      }
    }
    return ids;
  }, [sortedByOverdue, userLastAssigned]);

  const getDaysAgoLabel = (userId: number): string => {
    const dateStr = userLastAssigned.get(userId);
    if (!dateStr) return "never assigned";
    const days = differenceInDays(new Date(), parseISO(dateStr));
    if (days === 0) return "assigned today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  // ── Sunday navigation helpers ────────────────────────────────────────────
  const stepToSunday = (dateStr: string, direction: 1 | -1): string => {
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDay();
    if (direction === 1) {
      d.setDate(d.getDate() + (day === 0 ? 7 : 7 - day));
    } else {
      d.setDate(d.getDate() - (day === 0 ? 7 : day));
    }
    return d.toISOString().split("T")[0];
  };

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

  // Smart auto-assign: minimize repeat pairings, prioritize most-overdue members
  const smartAutoAssign = (sundays: string[]): { date: string; memberIds: number[]; memberNames: string[] }[] => {
    if (activeUsers.length < 3) return [];
    const pairCount = new Map<string, number>();
    const lastAssignedLocal = new Map<number, string>();

    for (const rot of rotations ?? []) {
      const ids = rot.members.map(m => m.userId);
      for (const id of ids) {
        const ex = lastAssignedLocal.get(id);
        if (!ex || rot.date > ex) lastAssignedLocal.set(id, rot.date);
      }
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = `${Math.min(ids[i], ids[j])}-${Math.max(ids[i], ids[j])}`;
          pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
        }
      }
    }

    const existingDates = new Set((rotations ?? []).map(r => r.date));
    const result: { date: string; memberIds: number[]; memberNames: string[] }[] = [];

    for (const sunday of sundays) {
      if (existingDates.has(sunday)) continue;

      const sorted = [...activeUsers].sort((a, b) => {
        const aDate = lastAssignedLocal.get(a.id);
        const bDate = lastAssignedLocal.get(b.id);
        if (!aDate && !bDate) return 0;
        if (!aDate) return -1;
        if (!bDate) return 1;
        return aDate < bDate ? -1 : 1;
      });

      const poolSize = Math.min(sorted.length, Math.max(6, Math.ceil(sorted.length * 0.65)));
      const pool = sorted.slice(0, poolSize);
      let bestTriple: number[] | null = null;
      let bestScore = Infinity;

      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          for (let k = j + 1; k < pool.length; k++) {
            const ids = [pool[i].id, pool[j].id, pool[k].id];
            const pScore =
              (pairCount.get(`${Math.min(ids[0], ids[1])}-${Math.max(ids[0], ids[1])}`) ?? 0) +
              (pairCount.get(`${Math.min(ids[0], ids[2])}-${Math.max(ids[0], ids[2])}`) ?? 0) +
              (pairCount.get(`${Math.min(ids[1], ids[2])}-${Math.max(ids[1], ids[2])}`) ?? 0);
            const positionPenalty = (i + j + k) / (pool.length * 3);
            const score = pScore + positionPenalty * 0.5;
            if (score < bestScore) { bestScore = score; bestTriple = ids; }
          }
        }
      }

      if (bestTriple) {
        for (let i = 0; i < bestTriple.length; i++) {
          for (let j = i + 1; j < bestTriple.length; j++) {
            const key = `${Math.min(bestTriple[i], bestTriple[j])}-${Math.max(bestTriple[i], bestTriple[j])}`;
            pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
          }
          lastAssignedLocal.set(bestTriple[i], sunday);
        }
        const names = bestTriple.map(id => {
          const u = activeUsers.find(u => u.id === id)!;
          return `${u.firstName} ${u.lastName}`;
        });
        result.push({ date: sunday, memberIds: bestTriple, memberNames: names });
      }
    }
    return result;
  };

  const search = useSearch();
  const mineOnly = new URLSearchParams(search).get("mine") === "true";
  const mineFilteredRotations = mineOnly
    ? rotations?.filter(r => r.members.some(m => m.userId === user?.id))
    : rotations;

  const [pastVisibleCount, setPastVisibleCount] = useState(0);
  const todayStr = new Date().toISOString().split("T")[0];

  const upcomingRotations = useMemo(
    () => (mineFilteredRotations ?? []).filter(r => r.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)),
    [mineFilteredRotations, todayStr]
  );

  const pastRotationsAll = useMemo(
    () => (mineFilteredRotations ?? []).filter(r => r.date < todayStr).sort((a, b) => b.date.localeCompare(a.date)),
    [mineFilteredRotations, todayStr]
  );

  const visiblePastRotations = pastRotationsAll.slice(0, pastVisibleCount);
  const hasMorePast = pastVisibleCount < pastRotationsAll.length;

  const displayedRotations = rotations ? [...upcomingRotations, ...visiblePastRotations] : rotations;

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

  // Watch the date field so we can detect duplicates in real-time
  const createDate = createForm.watch("date");
  const existingForDate = useMemo(
    () => rotations?.find(r => r.date === createDate) ?? null,
    [rotations, createDate]
  );

  // When the selected date already has a rotation, pre-fill its members
  useEffect(() => {
    if (!isCreateOpen) return;
    if (existingForDate) {
      createForm.setValue("memberIds", existingForDate.members.map(m => m.userId), { shouldValidate: true });
    }
  }, [existingForDate, isCreateOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (existingForDate) {
        // Date already has a rotation — update it instead of creating a duplicate
        await updateMutation.mutateAsync({ id: existingForDate.id, data: values });
        toast({ title: "Rotation updated" });
      } else {
        await createMutation.mutateAsync({ data: values });
        toast({ title: "Rotation created" });
      }
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      setIsCreateOpen(false);
      createForm.reset();
    } catch {
      toast({ title: "Failed to save rotation", variant: "destructive" });
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

  const handleSaveAutoFill = async () => {
    setIsSavingAutoFill(true);
    try {
      for (const pending of autoFillPreview) {
        await createMutation.mutateAsync({ data: { date: pending.date, memberIds: pending.memberIds } });
      }
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      setAutoFillOpen(false);
      setAutoFillPreview([]);
      toast({ title: `${autoFillPreview.length} rotation${autoFillPreview.length !== 1 ? "s" : ""} created` });
    } catch {
      toast({ title: "Failed to save some rotations", variant: "destructive" });
    } finally {
      setIsSavingAutoFill(false);
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

  const RotationMemberFields = ({ form }: { form: ReturnType<typeof useForm<RotationFormValues>> }) => {
    const suggestedList = sortedByOverdue.filter(u => suggestedUserIds.has(u.id));
    const currentIds: number[] = form.watch("memberIds") ?? [];

    const handleSuggestionClick = (userId: number) => {
      const emptyIndex = [0, 1, 2].findIndex(i => !currentIds[i]);
      if (emptyIndex === -1) return;
      form.setValue(`memberIds.${emptyIndex}`, userId, { shouldValidate: true });
    };

    return (
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
                    {sortedByOverdue.map((u) => {
                      const isSuggested = suggestedUserIds.has(u.id);
                      return (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          <span className="flex items-center gap-2 w-full">
                            {isSuggested && (
                              <span className="text-amber-500 text-xs">★</span>
                            )}
                            <span className={isSuggested ? "font-medium" : ""}>
                              {u.firstName} {u.lastName}
                            </span>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {getDaysAgoLabel(u.id)}
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {suggestedList.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
              ★ Suggested — longest overdue · click to add
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedList.map(u => {
                const slotIndex = currentIds.indexOf(u.id);
                const isSelected = slotIndex !== -1;
                const allFull = currentIds.filter(Boolean).length === 3 && !isSelected;
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={allFull}
                    onClick={() => !isSelected && handleSuggestionClick(u.id)}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      isSelected
                        ? "bg-amber-200 dark:bg-amber-800/60 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 cursor-default"
                        : allFull
                        ? "bg-amber-50 dark:bg-transparent border-amber-200 dark:border-amber-900 text-amber-400 dark:text-amber-600 opacity-50 cursor-not-allowed"
                        : "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-800/60 hover:border-amber-400",
                    ].join(" ")}
                  >
                    {isSelected && <span className="text-amber-600 dark:text-amber-400">✓</span>}
                    <span>{u.firstName} {u.lastName}</span>
                    <span className="text-amber-500">·</span>
                    <span className="text-amber-600 dark:text-amber-400">{getDaysAgoLabel(u.id)}</span>
                    {isSelected && (
                      <span className="text-amber-500 dark:text-amber-400 font-normal">
                        #{slotIndex + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  };

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAutoFillPreview([]);
                setAutoFillWeeks(4);
                setAutoFillGenerated(false);
                setAutoFillOpen(true);
              }}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Auto-fill Sundays
            </Button>
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
          </div>
        )}
      </div>

      {/* Create / Upsert Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{existingForDate ? "Edit Rotation" : "New Rotation"}</DialogTitle>
          </DialogHeader>

          {existingForDate && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>
                A rotation already exists for this date — editing it instead of creating a new one.
              </span>
            </div>
          )}

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
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        title="Previous Sunday"
                        onClick={() => field.onChange(stepToSunday(field.value || new Date().toISOString().split("T")[0], -1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <FormControl>
                        <Input type="date" data-testid="input-create-date" {...field} className="flex-1" />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        title="Next Sunday"
                        onClick={() => field.onChange(stepToSunday(field.value || new Date().toISOString().split("T")[0], 1))}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <RotationMemberFields form={createForm} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-rotation"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : existingForDate
                    ? "Update Rotation"
                    : "Save Rotation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editRotationId !== null} onOpenChange={(open) => { if (!open) setEditRotationId(null); }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
      ) : displayedRotations?.length === 0 && pastRotationsAll.length === 0 ? (
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
          {hasMorePast && (
            <div className="flex justify-center pb-2">
              <Button
                variant="outline"
                onClick={() => setPastVisibleCount((c) => c + 4)}
                data-testid="button-show-past-rotations"
              >
                Show past 4 entries
              </Button>
            </div>
          )}
          {upcomingRotations.length === 0 && visiblePastRotations.length === 0 && (
            <div className="text-center py-10 bg-card border border-border rounded-xl border-dashed">
              <SacramentTrayIcon className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {mineOnly ? "You are not assigned to any upcoming rotations." : "No upcoming rotations scheduled."}
              </p>
            </div>
          )}
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
      {/* Auto-fill Sundays Dialog */}
      <Dialog open={autoFillOpen} onOpenChange={setAutoFillOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              Auto-fill Sundays
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Automatically assign 3 members to upcoming Sundays. Members are selected to maximise
              variety in pairings and prioritise those who haven't been assigned recently.
            </p>

            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">Sundays to schedule</label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setAutoFillWeeks(w => Math.max(1, w - 1)); setAutoFillGenerated(false); }}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="w-10 text-center text-sm font-semibold tabular-nums select-none">
                  {autoFillWeeks}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setAutoFillWeeks(w => Math.min(52, w + 1)); setAutoFillGenerated(false); }}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setAutoFillPreview(smartAutoAssign(getUpcomingSundays(autoFillWeeks))); setAutoFillGenerated(true); }}
                disabled={activeUsers.length < 3}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </div>

            {activeUsers.length < 3 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                At least 3 active members are needed to generate assignments.
              </div>
            )}

            {autoFillPreview.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Preview — {autoFillPreview.length} rotation{autoFillPreview.length !== 1 ? "s" : ""} to create
                </div>
                <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                  {autoFillPreview.map(item => (
                    <li key={item.date} className="flex items-start gap-3 px-3 py-2.5">
                      <span className="text-sm font-medium text-foreground w-32 shrink-0">
                        {format(parseISO(item.date), "MMM d, yyyy")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {item.memberNames.join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {autoFillPreview.length === 0 && activeUsers.length >= 3 && (
              <div className="text-sm text-center py-4 border border-dashed border-border rounded-lg px-4">
                {autoFillGenerated ? (
                  <p className="text-muted-foreground">
                    All {autoFillWeeks} upcoming Sundays are already scheduled.{" "}
                    <button
                      type="button"
                      className="underline font-medium text-foreground hover:text-primary"
                      onClick={() => { setAutoFillWeeks(w => w + 4); setAutoFillGenerated(false); }}
                    >
                      Try {autoFillWeeks + 4} weeks instead
                    </button>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Click <span className="font-medium text-foreground">Preview</span> to generate assignments.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setAutoFillOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={autoFillPreview.length === 0 || isSavingAutoFill}
              onClick={handleSaveAutoFill}
            >
              {isSavingAutoFill
                ? "Saving..."
                : autoFillPreview.length > 0
                ? `Save ${autoFillPreview.length} Rotation${autoFillPreview.length !== 1 ? "s" : ""}`
                : "Save Rotations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
