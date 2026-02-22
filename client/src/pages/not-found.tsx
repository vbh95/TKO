import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import tkoLogoWhite from "@assets/TKO_White-02_1771177730966.png";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md space-y-6">
        <img src={tkoLogoWhite} alt="TKO" className="w-16 h-16 mx-auto opacity-30" />
        <div>
          <h1 className="text-6xl font-display font-bold text-primary mb-2">404</h1>
          <p className="text-xl text-foreground font-medium">Page Not Found</p>
          <p className="text-muted-foreground mt-2">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()} data-testid="button-go-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Link href="/">
            <Button data-testid="button-go-home">
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
