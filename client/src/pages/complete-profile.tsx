import { useState } from "react";
import { useUser, useUpdateProfile, useSetMemorableWord } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Check } from "lucide-react";
import tkoLogoDark from "@assets/Untitled-1-02_1771177331378.png";
import tkoLogoWhite from "@assets/TKO_White-02_1771177730966.png";
import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";

export default function CompleteProfile() {
  const { data: user } = useUser();
  const updateProfile = useUpdateProfile();
  const setMemorableWordMutation = useSetMemorableWord();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const tkoLogo = theme === "dark" ? tkoLogoWhite : tkoLogoDark;

  const needsDob = !user?.dateOfBirth;
  const needsMemorable = !user?.hasMemorableWord;

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [memorableWord, setMemorableWord] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (needsDob && !dateOfBirth) {
      toast({ title: "Date of birth is required", variant: "destructive" });
      return;
    }
    if (needsMemorable && !memorableWord.trim()) {
      toast({ title: "Memorable word is required", variant: "destructive" });
      return;
    }
    if (needsMemorable && memorableWord.trim().length < 3) {
      toast({ title: "Memorable word must be at least 3 characters", variant: "destructive" });
      return;
    }
    if (needsMemorable && !currentPassword) {
      toast({ title: "Please enter your password to set the memorable word", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (needsDob || phone || billingAddress) {
        await new Promise<void>((resolve, reject) => {
          updateProfile.mutate({
            dateOfBirth: dateOfBirth || undefined,
            phone: phone || null,
            billingAddress: billingAddress || null,
          }, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          });
        });
      }

      if (needsMemorable) {
        await new Promise<void>((resolve, reject) => {
          setMemorableWordMutation.mutate({
            memorableWord,
            currentPassword,
          }, {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          });
        });
      }

      toast({ title: "Profile completed!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4"
        data-testid="button-toggle-theme-profile"
      >
        {theme === "light" ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
      </Button>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <img src={tkoLogo} alt="TKO" className="w-20 h-20 mx-auto mb-2" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Complete Your Profile</h1>
          <p className="text-muted-foreground text-sm">Please fill in the required details to get started.</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {needsDob && (
                <div className="space-y-2">
                  <Label htmlFor="profile-dob">Date of Birth <span className="text-destructive">*</span></Label>
                  <Input
                    id="profile-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    data-testid="input-profile-dob"
                  />
                </div>
              )}

              {needsMemorable && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-memorable">Memorable Word <span className="text-destructive">*</span></Label>
                    <Input
                      id="profile-memorable"
                      type="text"
                      placeholder="e.g. sunshine, bullseye, treble20"
                      value={memorableWord}
                      onChange={(e) => setMemorableWord(e.target.value)}
                      required
                      data-testid="input-profile-memorable"
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose a word you'll remember. You can use it to reset your password. Not case-sensitive. Minimum 3 characters.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-password">Current Password <span className="text-destructive">*</span></Label>
                    <Input
                      id="profile-password"
                      type="password"
                      placeholder="Enter your password to confirm"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      data-testid="input-profile-password"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="profile-phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  placeholder="+44 7700 900000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid="input-profile-phone"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-billing">Billing Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  id="profile-billing"
                  placeholder="123 Main Street, City, Postcode"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  data-testid="input-profile-billing"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSaving} data-testid="button-complete-profile">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Complete Profile
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
