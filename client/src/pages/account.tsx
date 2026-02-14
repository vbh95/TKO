import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useUser, useUpdateProfile } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function Account() {
  const { data: user } = useUser();
  const { mutate: updateProfile, isPending } = useUpdateProfile();
  const { toast } = useToast();
  
  const [name, setName] = useState(user?.name || "");

  const handleSave = () => {
    updateProfile({ name }, {
      onSuccess: () => {
        toast({ title: "Profile updated successfully" });
      }
    });
  };

  return (
    <LayoutShell>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your display name.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" value={user?.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input 
                id="name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
              />
            </div>

            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}
