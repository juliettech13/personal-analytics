"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isCorrectPassword, sessionTokenFor, SESSION_COOKIE } from "@/lib/auth";

export async function login(
  _prevState: { error: string } | undefined,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const password = String(formData.get("password") ?? "");

  if (!isCorrectPassword(password)) {
    return { error: "Wrong password" };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionTokenFor(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/");
}
