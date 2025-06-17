import { render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import AdminGuard from "../AdminGuard";
import { checkAdminAccess } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth-context";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));
jest.mock("@/lib/api/admin");
jest.mock("@/lib/auth-context");

const mockPush = jest.fn();
const mockUseRouter = jest.mocked(useRouter);
const mockCheckAdminAccess = jest.mocked(checkAdminAccess);
const mockUseAuth = jest.mocked(useAuth);

// Helper to create mock auth context
const createMockAuthContext = (user: any = null, loading = false, error: string | null = null) => ({
  user,
  loading,
  error,
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
  resendConfirmationCode: jest.fn(),
  forgotPassword: jest.fn(),
  confirmForgotPassword: jest.fn(),
  refreshUser: jest.fn(),
  getIdToken: jest.fn(),
});

describe("AdminGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
    } as ReturnType<typeof useRouter>);
  });

  it("should show loading spinner while checking authentication", () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext(null, true) as ReturnType<typeof useAuth>
    );

    render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should redirect to login if user is not authenticated", async () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext(null, false) as ReturnType<typeof useAuth>
    );

    render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should redirect to home if user does not have admin access", async () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext(
        { email: "user@test.com", emailVerified: true },
        false
      ) as ReturnType<typeof useAuth>
    );
    mockCheckAdminAccess.mockResolvedValue(false);

    render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockCheckAdminAccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should render children if user has admin access", async () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext(
        { email: "admin@test.com", emailVerified: true },
        false
      ) as ReturnType<typeof useAuth>
    );
    mockCheckAdminAccess.mockResolvedValue(true);

    render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    expect(mockCheckAdminAccess).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should handle errors when checking admin access", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    mockUseAuth.mockReturnValue(
      createMockAuthContext(
        { email: "user@test.com", emailVerified: true },
        false
      ) as ReturnType<typeof useAuth>
    );
    mockCheckAdminAccess.mockRejectedValue(new Error("Network error"));

    render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error checking admin access:",
        expect.any(Error),
      );
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it("should not check access while auth is still loading", () => {
    mockUseAuth.mockReturnValue(
      createMockAuthContext(null, true) as ReturnType<typeof useAuth>
    );

    render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    expect(mockCheckAdminAccess).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should re-check access when user changes", async () => {
    const { rerender } = render(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    // Initial render with no user
    mockUseAuth.mockReturnValue(
      createMockAuthContext(null, false) as ReturnType<typeof useAuth>
    );

    rerender(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    // User logs in
    mockUseAuth.mockReturnValue(
      createMockAuthContext(
        { email: "admin@test.com", emailVerified: true },
        false
      ) as ReturnType<typeof useAuth>
    );
    mockCheckAdminAccess.mockResolvedValue(true);
    mockPush.mockClear();

    rerender(
      <AdminGuard>
        <div>Protected Content</div>
      </AdminGuard>,
    );

    await waitFor(() => {
      expect(mockCheckAdminAccess).toHaveBeenCalled();
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
