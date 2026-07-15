import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xs border-2 border-foreground shadow-[4px_4px_0_rgba(0,0,0,0.28)]">
        <CardHeader>
          <CardTitle className="text-center font-[family-name:var(--font-pixel)] text-3xl">
            nerd_splash
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
