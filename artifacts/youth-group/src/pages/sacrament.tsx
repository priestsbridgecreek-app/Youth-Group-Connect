import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { 
  useListSacramentRotations, getListSacramentRotationsQueryKey,
  useCreateSacramentRotation,
  useDeleteSacramentRotation,
  useRandomizeSacramentRotation, getRandomizeSacramentRotationQueryKey,
  useListUsers, getListUsersQueryKey,
  useCreateSubstitutionRequest
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Coffee, Plus, Trash2, Shuffle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const rotationSchema = z.object({
  date: z.string().min(1, "Date is required"),
  memberIds: z.array(z.coerce.number()).length(3, "Exactly 3 members must be selected"),
});

const subRequestSchema = z.object({
  rotationId: z.number(),
  reason: z.string().optional(),
});

export default function Sacrament() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subRotationId, setSubRotationId] = useState<number>(0);

  const { data: rotations, isLoading } = useListSacramentRotations(undefined, {
    query: { queryKey: getListSacramentRotationsQueryKey() }
  });
  
  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });

  const createMutation = useCreateSacramentRotation();
  const deleteMutation = useDeleteSacramentRotation();
  const requestSubMutation = useCreateSubstitutionRequest();

  const form = useForm<z.infer<typeof rotationSchema>>({
    resolver: zodResolver(rotationSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      memberIds: [],
    },
  });

  const subForm = useForm<z.infer<typeof subRequestSchema>>({
    resolver: zodResolver(subRequestSchema),
    defaultValues: {
      rotationId: 0,
      reason: "",
    },
  });

  const { refetch: randomizeRefetch } = useRandomizeSacramentRotation({
    query: { 
      queryKey: getRandomizeSacramentRotationQueryKey(),
      enabled: false 
    }
  });

  const handleRandomize = async () => {
    setRandomizing(true);
    try {
      const { data } = await randomizeRefetch();
      if (data && data.members) {
        form.setValue("memberIds", data.members.map(m => m.userId));
        toast({ title: "Randomized successfully" });
      }
    } catch (e) {
      toast({ title: "Failed to randomize", variant: "destructive" });
    } finally {
      setRandomizing(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof rotationSchema>) => {
    try {
      await createMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Rotation created successfully" });
    } catch (e) {
      toast({ title: "Failed to create rotation", variant: "destructive" });
    }
  };

  const onSubmitSub = async (values: z.infer<typeof subRequestSchema>) => {
    try {
      await requestSubMutation.mutateAsync({ data: { rotationId: subRotationId, reason: values.reason } });
      setSubModalOpen(false);
      subForm.reset();
      toast({ title: "Substitution requested" });
    } catch (e) {
      toast({ title: "Failed to request substitution", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rotation?")) return;
    try {
      await deleteMutation.mutateAsync({ rotationId: id });
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      toast({ title: "Rotation removed" });
    } catch (e) {
      toast({ title: "Failed to delete rotation", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-blue-700 flex items-center gap-3">
            <Coffee className="w-8 h-8" />
            Sacrament Blessing
          </h1>
          <p className="text-muted-foreground mt-1">Manage weekly blessing rotations.</p>
        </div>

        {isLeader && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Rotation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Rotation</DialogTitle>
              </DialogHeader>
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={handleRandomize} disabled={randomizing} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Shuffle className="w-4 h-4 mr-2" />
                  Randomize Selection
                </Button>
              </div>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  
                  {[0, 1, 2].map((index) => (
                    <FormField key={index} control={form.control} name={`memberIds.${index}`} render={({ field }) => (
                      <FormItem>
                        <FormLabel>Member {index + 1}</FormLabel>
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString() || ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.firstName} {u.lastName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ))}

                  <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Saving..." : "Save Rotation"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={subModalOpen} onOpenChange={setSubModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Substitution</DialogTitle>
          </DialogHeader>
          <Form {...subForm}>
            <form onSubmit={subForm.handleSubmit(onSubmitSub)} className="space-y-4">
              <FormField control={subForm.control} name="reason" render={({ field }) => (
                <FormItem><FormLabel>Reason (Optional)</FormLabel><FormControl><Textarea placeholder="Why do you need a sub?" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSubModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={requestSubMutation.isPending}>Submit Request</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : rotations?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <Coffee className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">No rotations scheduled</h3>
          <p className="text-muted-foreground">The upcoming sacrament schedule is empty.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {rotations?.map(rotation => {
            const isAssigned = rotation.members.some(m => m.userId === user?.id);
            return (
              <Card key={rotation.id} className={`hover-elevate transition-colors ${isAssigned ? "bg-blue-50/30 border-blue-200" : "border-border"}`}>
                <CardHeader className="flex flex-row justify-between items-start pb-4">
                  <div className="text-lg font-medium text-blue-800 dark:text-blue-300">
                    {format(new Date(rotation.date), "EEEE, MMMM do")}
                  </div>
                  <div className="flex gap-2">
                    {isAssigned && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setSubRotationId(rotation.id);
                        setSubModalOpen(true);
                      }} className="h-8 text-xs -mt-1 bg-background">
                        <AlertCircle className="w-3 h-3 mr-1"/> Request Sub
                      </Button>
                    )}
                    {isLeader && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rotation.id)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {rotation.members.map((member, idx) => (
                      <li key={member.userId} className="flex items-center justify-between p-2 rounded bg-background border shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold text-muted-foreground">
                            {idx + 1}
                          </div>
                          <span className={member.userId === user?.id ? "font-bold" : "font-medium"}>
                            {member.firstName} {member.lastName}
                          </span>
                        </div>
                      </li>
                    ))}
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
