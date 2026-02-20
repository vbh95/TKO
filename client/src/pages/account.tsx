import { useState, useEffect } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useUser, useUpdateProfile, useUpdateEmail, useUpdatePassword, useSetMemorableWord } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Lock, KeyRound, Eye, EyeOff, Check, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { useQueryClient } from "@tanstack/react-query";

export default function Account() {
  const { data: user } = useUser();
  const updateProfile = useUpdateProfile();
  const updateEmail = useUpdateEmail();
  const updatePassword = useUpdatePassword();
  const setMemorableWord = useSetMemorableWord();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");

  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [memorableWordValue, setMemorableWordValue] = useState("");
  const [memorableWordPassword, setMemorableWordPassword] = useState("");

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setDateOfBirth(user.dateOfBirth || "");
      setPhone(user.phone || "");
      setBillingAddress(user.billingAddress || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleProfileSave = () => {
    updateProfile.mutate({
      name,
      dateOfBirth: dateOfBirth || null,
      phone: phone || null,
      billingAddress: billingAddress || null,
    }, {
      onSuccess: () => toast({ title: "Profile updated" }),
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleEmailSave = () => {
    if (!emailPassword) {
      toast({ title: "Please enter your current password to change email", variant: "destructive" });
      return;
    }
    updateEmail.mutate({ email, currentPassword: emailPassword }, {
      onSuccess: () => {
        toast({ title: "Email updated" });
        setEmailPassword("");
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handlePasswordSave = () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    updatePassword.mutate({ currentPassword, newPassword }, {
      onSuccess: () => {
        toast({ title: "Password updated" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const handleMemorableWordSave = () => {
    if (!memorableWordPassword) {
      toast({ title: "Please enter your current password", variant: "destructive" });
      return;
    }
    if (memorableWordValue.length < 3) {
      toast({ title: "Memorable word must be at least 3 characters", variant: "destructive" });
      return;
    }
    setMemorableWord.mutate({ memorableWord: memorableWordValue, currentPassword: memorableWordPassword }, {
      onSuccess: () => {
        toast({ title: "Memorable word updated" });
        setMemorableWordValue("");
        setMemorableWordPassword("");
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <LayoutShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your profile, security, and preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Personal Information
            </CardTitle>
            <CardDescription>Update your personal details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-account-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                data-testid="input-account-dob"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+44 7700 900000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-account-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing">Billing Address</Label>
              <Input
                id="billing"
                placeholder="123 Main Street, City, Postcode"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                data-testid="input-account-billing"
              />
            </div>

            <Button onClick={handleProfileSave} disabled={updateProfile.isPending} data-testid="button-save-profile">
              {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Address
            </CardTitle>
            <CardDescription>Change your email address. Requires your current password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-account-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-password">Current Password</Label>
              <Input
                id="email-password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="Enter password to confirm"
                data-testid="input-account-email-password"
              />
            </div>

            <Button
              onClick={handleEmailSave}
              disabled={updateEmail.isPending || email === user?.email}
              data-testid="button-save-email"
            >
              {updateEmail.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Update Email
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your password. You'll need your current password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  data-testid="input-current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-new-password"
              />
            </div>

            <Button onClick={handlePasswordSave} disabled={updatePassword.isPending} data-testid="button-save-password">
              {updatePassword.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Update Password
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Memorable Word
            </CardTitle>
            <CardDescription>
              {user?.hasMemorableWord
                ? "Your memorable word is set. You can use it to recover your account if you forget your password."
                : "Set a memorable word to help recover your account if you forget your password."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="memorable-word">{user?.hasMemorableWord ? "New Memorable Word" : "Memorable Word"}</Label>
              <Input
                id="memorable-word"
                type="text"
                placeholder="e.g. sunshine, bullseye, treble20"
                value={memorableWordValue}
                onChange={(e) => setMemorableWordValue(e.target.value)}
                data-testid="input-memorable-word"
              />
              <p className="text-xs text-muted-foreground">
                Choose a word you'll remember. It's not case-sensitive. Minimum 3 characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memorable-password">Current Password</Label>
              <Input
                id="memorable-password"
                type="password"
                value={memorableWordPassword}
                onChange={(e) => setMemorableWordPassword(e.target.value)}
                placeholder="Enter password to confirm"
                data-testid="input-memorable-word-password"
              />
            </div>

            <Button onClick={handleMemorableWordSave} disabled={setMemorableWord.isPending} data-testid="button-save-memorable-word">
              {setMemorableWord.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              {user?.hasMemorableWord ? "Update Memorable Word" : "Set Memorable Word"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Account
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting your account will permanently remove all your tournaments, players, matches, results, leagues, and any other data linked to your account. This cannot be reversed.
            </p>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              data-testid="button-open-delete-account"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete My Account
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account and all your data, including all tournaments, players, matches, results, and leagues. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="delete-password">Enter your password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your current password"
                  data-testid="input-delete-account-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Type <span className="font-mono font-bold">DELETE</span> to confirm</Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  data-testid="input-delete-account-confirm"
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => { setDeletePassword(""); setDeleteConfirmation(""); }}
                data-testid="button-cancel-delete-account"
              >
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={isDeleting || deleteConfirmation !== "DELETE" || !deletePassword}
                data-testid="button-confirm-delete-account"
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await apiRequest("DELETE", api.account.delete.path, {
                      password: deletePassword,
                      confirmationPhrase: deleteConfirmation,
                    });
                    queryClient.setQueryData([api.auth.me.path], null);
                    queryClient.invalidateQueries();
                    toast({ title: "Account deleted", description: "Your account and all associated data have been permanently removed." });
                  } catch (err: any) {
                    let msg = "Failed to delete account";
                    try {
                      const parsed = JSON.parse(err.message.replace(/^\d+:\s*/, ""));
                      msg = parsed.message || msg;
                    } catch { msg = err.message || msg; }
                    toast({ title: "Error", description: msg, variant: "destructive" });
                  } finally {
                    setIsDeleting(false);
                    setShowDeleteDialog(false);
                    setDeletePassword("");
                    setDeleteConfirmation("");
                  }
                }}
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isDeleting ? "Deleting..." : "Delete My Account"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </LayoutShell>
  );
}
