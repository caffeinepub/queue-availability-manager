import React, { useState } from "react";
import { Loader2, UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveCallerUserProfile, useIsCallerAdmin } from "@/hooks/useQueries";
import { toast } from "sonner";

interface ProfileSetupProps {
  open: boolean;
}

export default function ProfileSetup({ open }: ProfileSetupProps) {
  const [name, setName] = useState("");
  const saveMutation = useSaveCallerUserProfile();
  const { refetch: refetchIsAdmin } = useIsCallerAdmin();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await saveMutation.mutateAsync({ name: name.trim() });

      // After saving, check if this user became an admin (first-ever user)
      // or a guest (subsequent users waiting for approval)
      const { data: isAdmin } = await refetchIsAdmin();

      if (isAdmin) {
        toast.success("Welcome, Admin! You're the first user — you have full access.", {
          duration: 6000,
        });
      } else {
        toast.info("Profile saved! Your account is pending approval. An admin will grant you access shortly.", {
          duration: 8000,
        });
      }
    } catch {
      toast.error("Failed to save profile");
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <UserCircle2 className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-lg">Welcome! Set up your profile</DialogTitle>
          </div>
          <DialogDescription>
            Enter your name so colleagues can identify your approvals. You can change this later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your Name
            </Label>
            <Input
              id="profile-name"
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={saveMutation.isPending}
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
