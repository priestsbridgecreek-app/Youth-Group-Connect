import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { UserProfileCard } from "@/components/user-profile-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function MemberProfile() {
  const { userId } = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const parsedId = parseInt(userId ?? "", 10);

  const { data: member, isLoading } = useGetUser(parsedId, {
    query: {
      queryKey: getGetUserQueryKey(parsedId),
      enabled: !isNaN(parsedId),
    },
  });

  const isLeader = currentUser?.role === "leader";

  if (!isLeader) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(parsedId) });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/members")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Roster
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <User className="w-8 h-8 text-muted-foreground" />
        <div>
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <h1 className="text-3xl font-serif font-bold text-foreground">
              {member?.firstName} {member?.lastName}
            </h1>
          )}
          {member && (
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="capitalize">{member.role}</Badge>
              {member.status !== "active" && (
                <Badge variant="secondary" className="capitalize">{member.status}</Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : member ? (
        <UserProfileCard targetUser={member} onSaved={handleSaved} />
      ) : (
        <p className="text-muted-foreground">Member not found.</p>
      )}
    </div>
  );
}
