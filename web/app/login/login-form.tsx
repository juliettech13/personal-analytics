"use client";

import { useActionState } from "react";
import { login } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Label htmlFor="password" className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        Password
      </Label>
      <Input
        id="password"
        name="password"
        type="password"
        autoFocus
        required
        className="border-border bg-background"
      />
      {state?.error && (
        <p className="font-mono text-xs text-destructive">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "checking…" : "enter"}
      </Button>
    </form>
  );
}
