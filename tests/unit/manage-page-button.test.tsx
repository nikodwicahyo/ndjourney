// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ManagePageButton from "@/components/layout/ManagePageButton";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));

const { useSession } = await import("next-auth/react");

describe("ManagePageButton", () => {
  it("renders link with href + label when authenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: "u1" } }, status: "authenticated" } as never);
    render(<ManagePageButton href="/dashboard/gallery" label="Kelola Galeri" />);
    const link = screen.getByRole("link", { name: "Kelola Galeri" });
    expect(link.getAttribute("href")).toBe("/dashboard/gallery");
  });

  it("renders nothing while loading or unauthenticated", () => {
    vi.mocked(useSession).mockReturnValue({ data: null, status: "loading" } as never);
    const { container: loading } = render(<ManagePageButton href="/dashboard/gallery" label="Kelola Galeri" />);
    expect(loading.innerHTML).toBe("");

    vi.mocked(useSession).mockReturnValue({ data: null, status: "unauthenticated" } as never);
    const { container: anon } = render(<ManagePageButton href="/dashboard/gallery" label="Kelola Galeri" />);
    expect(anon.innerHTML).toBe("");
  });
});
