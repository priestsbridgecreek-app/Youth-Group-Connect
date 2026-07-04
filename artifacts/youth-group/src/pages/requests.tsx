import { useAuth } from "@/lib/auth";
import { 
  useListSubstitutionRequests, getListSubstitutionRequestsQueryKey,
  useUpdateSubstitutionRequest,
  useAcceptSubstitutionRequest,
  getListSacramentRotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareQuote, CheckCircle, XCircle, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Requests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useListSubstitutionRequests({
    query: { queryKey: getListSubstitutionRequestsQueryKey() }
  });

  const updateMutation = useUpdateSubstitutionRequest();
  const acceptMutation = useAcceptSubstitutionRequest();

  const handleUpdateStatus = async (id: number, status: "approved" | "denied" | "resolved") => {
    try {
      await updateMutation.mutateAsync({ id, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListSubstitutionRequestsQueryKey() });
      toast({ title: `Request ${status}` });
    } catch {
      toast({ title: "Failed to update request", variant: "destructive" });
    }
  };

  const handleAccept = async (id: number, rotationDate: string | null) => {
    const dateLabel = rotationDate ? format(parseISO(rotationDate), "MMMM do") : "that week";
    if (!confirm(`Accept this substitution? You'll be added to the sacrament rotation for ${dateLabel}.`)) return;
    try {
      await acceptMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListSubstitutionRequestsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListSacramentRotationsQueryKey() });
      toast({ title: "You've been added to the rotation" });
    } catch {
      toast({ title: "Failed to accept request", variant: "destructive" });
    }
  };

  const isLeader = user?.role === "presidency" || user?.role === "leader";

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
            <MessageSquareQuote className="w-8 h-8" />
            Substitution Requests
          </h1>
          <p className="text-muted-foreground mt-1">Manage requests for sacrament rotations.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : requests?.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl border-dashed">
          <MessageSquareQuote className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-foreground mb-2">No pending requests</h3>
          <p className="text-muted-foreground">All substitution requests have been handled.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests?.map(req => {
            const isMyRequest = req.requesterId === user?.id;
            const isPending = req.status === "pending";
            return (
              <Card key={req.id} className="hover-elevate border-border">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {req.requesterName} requested a sub
                      </CardTitle>
                      <CardDescription className="text-base mt-1">
                        For rotation on:{" "}
                        <span className="font-semibold text-foreground">
                          {req.rotationDate ? format(parseISO(req.rotationDate), "MMM do, yyyy") : "Unknown Date"}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge variant={req.status === "pending" ? "default" : req.status === "approved" ? "secondary" : "outline"}>
                      {req.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {req.reason && (
                    <div className="bg-muted/30 p-4 rounded-md mb-4 italic text-muted-foreground border border-border/50">
                      "{req.reason}"
                    </div>
                  )}

                  {isPending && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {/* Any member (except the requester) can accept */}
                      {!isMyRequest && (
                        <Button
                          onClick={() => handleAccept(req.id, req.rotationDate ?? null)}
                          disabled={acceptMutation.isPending}
                          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          Accept — I'll Cover This
                        </Button>
                      )}

                      {/* Presidency/leader management actions */}
                      {isLeader && (
                        <>
                          <Button
                            onClick={() => handleUpdateStatus(req.id, "approved")}
                            disabled={updateMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve & Find Sub
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleUpdateStatus(req.id, "denied")}
                            disabled={updateMutation.isPending}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Deny
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {isLeader && req.status === "approved" && (
                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={() => handleUpdateStatus(req.id, "resolved")}
                        disabled={updateMutation.isPending}
                        variant="outline"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Resolved
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
