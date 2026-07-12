import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { CalendarDays, BookOpen, MessageSquareQuote } from "lucide-react";
import { SacramentTrayIcon } from "@/components/icons/sacrament-tray";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useGetDashboard({
    query: {
      queryKey: getGetDashboardQueryKey()
    }
  });

  if (isLoading || !data) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const { upcomingActivities, upcomingRotations, upcomingLessons, pendingRequests, myAssignments } = data;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary mb-2">Welcome back, {user?.firstName}</h1>
        <p className="text-muted-foreground text-lg">Here's what's happening with {user?.groupName}.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/schedule?mine=true" className="block group">
          <Card className="bg-primary/5 border-primary/20 transition-shadow group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Activities</CardTitle>
              <CalendarDays className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myAssignments.activities.length}</div>
              <p className="text-xs text-muted-foreground">Upcoming assigned activities</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/lessons?mine=true" className="block group">
          <Card className="bg-secondary/5 border-secondary/20 transition-shadow group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Lessons</CardTitle>
              <BookOpen className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myAssignments.lessons.length}</div>
              <p className="text-xs text-muted-foreground">Upcoming assigned lessons</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sacrament?mine=true" className="block group">
          <Card className="bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 transition-shadow group-hover:shadow-md cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Sacrament</CardTitle>
              <SacramentTrayIcon className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myAssignments.rotations.length}</div>
              <p className="text-xs text-muted-foreground">Upcoming rotations</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/requests" className="block group">
          <Card className={`transition-shadow group-hover:shadow-md cursor-pointer h-full ${pendingRequests > 0 ? "bg-destructive/5 border-destructive/20" : ""}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Requests</CardTitle>
              <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingRequests}</div>
              <p className="text-xs text-muted-foreground">Pending substitution requests</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Activities</CardTitle>
            <CardDescription>The next 4 weeks of scheduled activities</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed border-border">
                No upcoming activities scheduled.
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingActivities.map(activity => {
                  const isAssigned = myAssignments.activities.includes(activity.id);
                  return (
                    <Link key={activity.id} href={`/schedule?highlight=${activity.id}`} className="block group">
                      <div
                        className={`p-4 rounded-lg border flex flex-col sm:flex-row gap-4 justify-between transition-colors group-hover:shadow-md cursor-pointer
                          ${isAssigned ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}
                      >
                        <div>
                          <div className="font-semibold text-lg flex items-center gap-2">
                            {activity.activityTitle}
                            {isAssigned && <Badge variant="default">My Assignment</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {format(new Date(activity.date + 'T00:00:00'), "EEEE, MMMM do")}
                          </div>
                        </div>
                        <div className="text-sm space-y-1">
                          {activity.personInChargeName && (
                            <div><span className="text-muted-foreground">In charge:</span> {activity.personInChargeName}</div>
                          )}
                          {activity.treatsAssigneeName && (
                            <div><span className="text-muted-foreground">Treats:</span> {activity.treatsAssigneeName}</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Sacrament Rotations</CardTitle>
            <CardDescription>Next 4 weeks of blessing assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingRotations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed border-border">
                No upcoming rotations scheduled.
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingRotations.map(rotation => {
                  const isAssigned = myAssignments.rotations.includes(rotation.id);
                  return (
                    <div 
                      key={rotation.id} 
                      className={`p-4 rounded-lg border flex flex-col gap-2 transition-colors
                        ${isAssigned ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" : "bg-card border-border"}`}
                    >
                      <div className="font-medium text-lg flex items-center gap-2">
                        {format(new Date(rotation.date + 'T00:00:00'), "EEEE, MMMM do")}
                        {isAssigned && <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-100">My Assignment</Badge>}
                      </div>
                      <div className="text-sm flex gap-4 text-muted-foreground">
                        {rotation.members.map((member, idx) => (
                          <div key={member.userId} className={member.userId === user?.id ? "font-bold text-foreground" : ""}>
                            {idx + 1}. {member.firstName} {member.lastName}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Upcoming Sunday Lessons</CardTitle>
            <CardDescription>Next 4 weeks of Sunday instruction</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingLessons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg border border-dashed border-border">
                No upcoming lessons scheduled.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingLessons.map(lesson => {
                  const isAssigned = myAssignments.lessons.includes(lesson.id);
                  return (
                    <div 
                      key={lesson.id} 
                      className={`p-4 rounded-lg border transition-colors
                        ${isAssigned ? "bg-secondary/10 border-secondary/30" : "bg-card border-border"}`}
                    >
                      <div className="font-medium text-sm text-muted-foreground mb-1">
                        {format(new Date(lesson.date + 'T00:00:00'), "EEEE, MMMM do")}
                      </div>
                      <div className="font-semibold text-lg flex items-center gap-2">
                        {lesson.title}
                        {isAssigned && <Badge variant="secondary">Instructor</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        {lesson.topic}
                      </div>
                      {lesson.instructorName && (
                        <div className="mt-3 text-sm">
                          <span className="text-muted-foreground">Instructor:</span> {lesson.instructorName}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
