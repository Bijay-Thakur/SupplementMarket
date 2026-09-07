"use client";

export function AdminLogoutButton() {
  return (
    <form action="/api/auth/sign-out" method="post">
      <input type="hidden" name="next" value="/admin/login" />
      <button type="submit" className="mt-4 text-xs text-[color:var(--muted)] hover:underline">
        Log out
      </button>
    </form>
  );
}
