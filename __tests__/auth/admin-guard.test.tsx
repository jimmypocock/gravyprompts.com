import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AdminGuard from "@/components/admin/AdminGuard";
import { useAuth } from "@/lib/auth-context";
import { checkAdminAccess } from "@/lib/api/admin";
import { useRouter } from "next/navigation";

// Mock dependencies
jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/api/admin", () => ({
  checkAdminAccess: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

describe("AdminGuard", () => {
  const mockPush = jest.fn();
  const mockRouter = { push: mockPush };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  it("should show loading state while checking auth", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: true,
    });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("should redirect to login when user is not authenticated", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      loading: false,
    });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("should redirect to home when user lacks admin access", async () => {
    const mockUser = {
      userId: "123",
      email: "test@example.com",
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    (checkAdminAccess as jest.Mock).mockResolvedValue(false);

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    await waitFor(() => {
      expect(checkAdminAccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("should render children when user has admin access", async () => {
    const mockUser = {
      userId: "123",
      email: "admin@example.com",
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    (checkAdminAccess as jest.Mock).mockResolvedValue(true);

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    await waitFor(() => {
      expect(checkAdminAccess).toHaveBeenCalled();
      expect(screen.getByText("Admin Content")).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const mockUser = {
      userId: "123",
      email: "test@example.com",
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false,
    });

    (checkAdminAccess as jest.Mock).mockRejectedValue(
      new Error("API Error")
    );

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    await waitFor(() => {
      expect(checkAdminAccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error checking admin access:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  it("should not check access while auth is loading", () => {
    (useAuth as jest.Mock).mockReturnValue({
      user: { userId: "123", email: "test@example.com" },
      loading: true,
    });

    render(
      <AdminGuard>
        <div>Admin Content</div>
      </AdminGuard>
    );

    expect(checkAdminAccess).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});