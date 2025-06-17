import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Navigation from "../Navigation";
import { useAuth } from "@/lib/auth-context";
import { useSearch } from "@/lib/search-context";
import { checkAdminAccess } from "@/lib/api/admin";

// Mock the modules
jest.mock("@/lib/auth-context");
jest.mock("@/lib/search-context");
jest.mock("@/lib/api/admin");
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: { src: string; alt: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={props.src} alt={props.alt || ""} />;
  },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseSearch = useSearch as jest.MockedFunction<typeof useSearch>;
const mockCheckAdminAccess = checkAdminAccess as jest.MockedFunction<
  typeof checkAdminAccess
>;

// Helper to create mock auth return value
const createMockAuth = (user: any = null, loading = false) => ({
  user,
  loading,
  error: null,
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

describe("Navigation", () => {
  beforeEach(() => {
    // Set up default mocks
    mockUseSearch.mockReturnValue({
      searchQuery: "",
      setSearchQuery: jest.fn(),
      isNavSearchVisible: false,
      setNavSearchVisible: jest.fn(),
    } as ReturnType<typeof useSearch>);

    // Mock window.location for local testing
    Object.defineProperty(window, "location", {
      value: { hostname: "localhost" },
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Admin Link Visibility", () => {
    it("should show admin link when API returns admin permissions", async () => {
      // Mock user with admin permissions
      mockUseAuth.mockReturnValue(
        createMockAuth({
          userId: "admin-user-123",
          email: "admin@example.com",
          emailVerified: true,
        }),
      );

      mockCheckAdminAccess.mockResolvedValue(true);

      render(<Navigation />);

      // Should always check via API
      await waitFor(() => {
        expect(mockCheckAdminAccess).toHaveBeenCalled();
      });

      // Admin link should be visible after API confirms permissions
      await waitFor(() => {
        expect(screen.getByText("Admin")).toBeInTheDocument();
      });
    });

    it("should check admin access via API for non-local admin users", async () => {
      // Mock regular user
      mockUseAuth.mockReturnValue(
        createMockAuth({
          userId: "different-user-id",
          email: "user@example.com",
          emailVerified: true,
        }),
      );

      mockCheckAdminAccess.mockResolvedValue(true);

      render(<Navigation />);

      // Should call checkAdminAccess for non-local admin users
      await waitFor(() => {
        expect(mockCheckAdminAccess).toHaveBeenCalled();
      });

      // Admin link should be visible after API check
      await waitFor(() => {
        expect(screen.getByText("Admin")).toBeInTheDocument();
      });
    });

    it("should not show admin link for users without permissions", async () => {
      // Mock regular user without admin permissions
      mockUseAuth.mockReturnValue(
        createMockAuth({
          userId: "regular-user",
          email: "user@example.com",
          emailVerified: true,
        }),
      );

      mockCheckAdminAccess.mockResolvedValue(false);

      render(<Navigation />);

      await waitFor(() => {
        expect(mockCheckAdminAccess).toHaveBeenCalled();
      });

      // Admin link should not be visible
      expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("should handle API errors gracefully", async () => {
      // Mock user
      mockUseAuth.mockReturnValue(
        createMockAuth({
          userId: "user-123",
          email: "user@example.com",
          emailVerified: true,
        }),
      );

      // Mock API error
      mockCheckAdminAccess.mockRejectedValue(new Error("API Error"));

      render(<Navigation />);

      await waitFor(() => {
        expect(mockCheckAdminAccess).toHaveBeenCalled();
      });

      // Admin link should not be visible when API fails
      expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("should always use API check regardless of environment", async () => {
      // Change location to production
      Object.defineProperty(window, "location", {
        value: { hostname: "gravyprompts.com" },
        writable: true,
      });

      // Mock any user
      mockUseAuth.mockReturnValue(
        createMockAuth({
          email: "user@example.com",
          emailVerified: true,
        }),
      );

      mockCheckAdminAccess.mockResolvedValue(true);

      render(<Navigation />);

      // Should always use API check
      await waitFor(() => {
        expect(mockCheckAdminAccess).toHaveBeenCalled();
      });
    });
  });

  describe("User Authentication States", () => {
    it("should show login/signup when not authenticated", () => {
      mockUseAuth.mockReturnValue(createMockAuth(null, false));

      render(<Navigation />);

      expect(screen.getByText("Log in")).toBeInTheDocument();
      expect(screen.getByText("Sign up")).toBeInTheDocument();
      expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    });

    it("should show user avatar when authenticated", () => {
      mockUseAuth.mockReturnValue(
        createMockAuth({
          email: "user@example.com",
          emailVerified: true,
        }),
      );

      mockCheckAdminAccess.mockResolvedValue(false);

      render(<Navigation />);

      // Should show the first letter of email as avatar
      expect(screen.getByText("U")).toBeInTheDocument();
      expect(screen.queryByText("Log in")).not.toBeInTheDocument();
    });
  });
});
