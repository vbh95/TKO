import { useState } from "react";
import { useLogin, useSignup } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Sun, Moon, Eye, EyeOff, Copy, Check } from "lucide-react";
import tkoLogoDark from "@assets/Untitled-1-02_1771177331378.png";
import tkoLogoWhite from "@assets/TKO_White-02_1771177730966.png";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showRecoveryKeyDialog, setShowRecoveryKeyDialog] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMethod, setResetMethod] = useState<"memorable" | "recovery">("memorable");
  const [resetMemorableWord, setResetMemorableWord] = useState("");
  const [resetRecoveryKey, setResetRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const login = useLogin();
  const signup = useSignup();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const tkoLogo = theme === 'dark' ? tkoLogoWhite : tkoLogoDark;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username: email, password, rememberMe }, {
      onError: (err) => {
        toast({ title: "Login failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== signupConfirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    signup.mutate({ email, password, name }, {
      onSuccess: (data: any) => {
        if (data.recoveryKey) {
          setRecoveryKey(data.recoveryKey);
          setShowRecoveryKeyDialog(true);
        }
      },
      onError: (err) => {
        toast({ title: "Signup failed", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (resetMethod === "memorable" && !resetMemorableWord.trim()) {
      toast({ title: "Please enter your memorable word", variant: "destructive" });
      return;
    }
    if (resetMethod === "recovery" && !resetRecoveryKey.trim()) {
      toast({ title: "Please enter your recovery key", variant: "destructive" });
      return;
    }
    setIsResetting(true);
    try {
      const body: any = { email: resetEmail, newPassword };
      if (resetMethod === "memorable") {
        body.memorableWord = resetMemorableWord;
      } else {
        body.recoveryKey = resetRecoveryKey;
      }
      await apiRequest("POST", "/api/auth/reset-password", body);
      toast({ title: "Password reset successfully", description: "You can now log in with your new password." });
      setShowReset(false);
      setResetEmail("");
      setResetMemorableWord("");
      setResetRecoveryKey("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 relative">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg bg-card hover:bg-muted transition-colors"
        data-testid="button-toggle-theme-auth"
      >
        {theme === "light" ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
      </button>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <img src={tkoLogo} alt="TKO" className="w-20 h-20 mx-auto mb-2" />
          <h1 className="text-3xl font-display font-bold tracking-tight">Welcome to TKO</h1>
          <p className="text-muted-foreground">The Ultimate Tournament Generator</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardContent className="pt-6">
            {showReset ? (
              <div className="space-y-4">
                <button
                  onClick={() => setShowReset(false)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </button>
                <div>
                  <h2 className="text-lg font-bold">Reset Password</h2>
                  <p className="text-sm text-muted-foreground mt-1">Verify your identity to reset your password.</p>
                </div>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      data-testid="input-reset-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Verification Method</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={`px-3 py-2 text-sm rounded-md border transition-colors ${resetMethod === "memorable" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
                        onClick={() => setResetMethod("memorable")}
                        data-testid="button-reset-method-memorable"
                      >
                        Memorable Word
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-2 text-sm rounded-md border transition-colors ${resetMethod === "recovery" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-muted"}`}
                        onClick={() => setResetMethod("recovery")}
                        data-testid="button-reset-method-recovery"
                      >
                        Recovery Key
                      </button>
                    </div>
                  </div>
                  {resetMethod === "memorable" ? (
                    <div className="space-y-2">
                      <Label htmlFor="reset-memorable">Memorable Word</Label>
                      <Input
                        id="reset-memorable"
                        type="text"
                        placeholder="Your memorable word"
                        value={resetMemorableWord}
                        onChange={(e) => setResetMemorableWord(e.target.value)}
                        data-testid="input-reset-memorable-word"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="reset-recovery">Recovery Key</Label>
                      <Input
                        id="reset-recovery"
                        type="text"
                        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                        value={resetRecoveryKey}
                        onChange={(e) => setResetRecoveryKey(e.target.value)}
                        className="font-mono"
                        data-testid="input-reset-recovery-key"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isResetting} data-testid="button-reset-password">
                    {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reset Password
                  </Button>
                </form>
              </div>
            ) : (
            <Tabs defaultValue="login" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="mvg@darts.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="remember-me" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                        data-testid="checkbox-remember-me"
                      />
                      <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="text-sm text-primary hover:underline"
                      data-testid="button-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Button type="submit" className="w-full" disabled={login.isPending} data-testid="button-login">
                    {login.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      placeholder="Michael van Gerwen"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input 
                      id="signup-email" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input 
                        id="signup-password" 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                        data-testid="input-signup-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="button-toggle-signup-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      required
                      data-testid="input-signup-confirm-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={signup.isPending} data-testid="button-signup">
                    {signup.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showRecoveryKeyDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Your Recovery Key</DialogTitle>
            <DialogDescription>
              Save this recovery key somewhere safe. You can use it to reset your password if you ever forget it. This key will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-4 text-center">
              <code className="text-lg font-mono font-bold tracking-wider" data-testid="text-recovery-key">
                {recoveryKey}
              </code>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(recoveryKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
              }}
              data-testid="button-copy-recovery-key"
            >
              {copiedKey ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copiedKey ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowRecoveryKeyDialog(false)}
              className="w-full"
              data-testid="button-dismiss-recovery-key"
            >
              I've saved my recovery key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
