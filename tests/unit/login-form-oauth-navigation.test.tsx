// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { createElement } from "react";

const GOOGLE_URL = "https://accounts.google.com/o/oauth2/v2/auth?code_challenge=abc";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  native: false,
}));

vi.mock("@/lib/location/platform", () => ({ isNativePlatform: () => mocks.native }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui", () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    createElement("button", props),
}));
vi.mock("lucide-react", () => ({
  Loader2: () => null,
  Mail: () => null,
  Lock: () => null,
  Eye: () => null,
  EyeOff: () => null,
  Smartphone: () => null,
}));

const { default: LoginForm } = await import("@/components/auth/LoginForm");

describe("Google sign-in navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mocks.native = false;
  });

  it("never sends the external OAuth URL through the RSC router", async () => {
    // keep redirect:false so AccessDenied/OAuthAccountNotLinked stay inline.
    // (jsdom's "Not implemented: navigation" warning is expected: it proves
    // the real hard navigation was attempted.)
    mocks.signIn.mockResolvedValue({ url: GOOGLE_URL });

    render(createElement(LoginForm));
    fireEvent.click(screen.getByRole("button", { name: /login dengan google/i }));

    await vi.waitFor(() => expect(mocks.signIn).toHaveBeenCalled());
    expect(mocks.signIn).toHaveBeenCalledWith("google", expect.objectContaining({ redirect: false }));
    // router.push(href) triggers an RSC payload fetch; accounts.google.com
    // cannot answer it -> "Failed to fetch RSC payload ... Falling back".
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("hides Google OAuth inside the native WebView and routes to device-link", () => {
    mocks.native = true;
    render(createElement(LoginForm));

    expect(screen.queryByRole("button", { name: /login dengan google/i })).toBeNull();
    const link = screen.getByRole("button", { name: /hubungkan perangkat dengan kode/i });
    fireEvent.click(link);
    expect(mocks.push).toHaveBeenCalledWith("/native-login");
  });
});
