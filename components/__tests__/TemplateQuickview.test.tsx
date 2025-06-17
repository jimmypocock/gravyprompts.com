import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import TemplateQuickview from "../TemplateQuickview";
import { useAuth } from "@/lib/auth-context";

// Mock dependencies
jest.mock("@/lib/auth-context");

// Mock GravyJS
jest.mock("gravyjs", () => ({
  __esModule: true,
  default: React.forwardRef(() => {
    return <div data-testid="gravyjs-editor">GravyJS Editor Mock</div>;
  }),
}));

// Mock next/link
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

describe("TemplateQuickview", () => {
  const mockTemplate = {
    templateId: "template-123",
    title: "Email Template",
    content: "Hello {{name}}, Welcome to {{company}}!",
    tags: ["email", "welcome"],
    variables: ["name", "company"],
    authorEmail: "author@example.com",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    views: 100,
    viewCount: 100,
    shares: 5,
    useCount: 50,
    visibility: "public" as const,
    status: "approved" as const,
    authorId: "author-123",
  };

  const defaultProps = {
    template: mockTemplate,
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com", emailVerified: true },
      loading: false,
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
    } as ReturnType<typeof useAuth>);
  });

  describe("Basic Rendering", () => {
    it("should render null when template is null", () => {
      const { container } = render(
        <TemplateQuickview {...defaultProps} template={null} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it("should render template content when open", () => {
      render(<TemplateQuickview {...defaultProps} />);
      expect(screen.getByText("Email Template")).toBeInTheDocument();
      expect(screen.getByText("View Full Template")).toBeInTheDocument();
    });

    it("should apply correct classes when closed", () => {
      const { container } = render(
        <TemplateQuickview {...defaultProps} isOpen={false} />,
      );
      const panel = container.querySelector(".translate-x-full");
      expect(panel).toBeInTheDocument();
    });

    it("should apply correct classes when open", () => {
      const { container } = render(
        <TemplateQuickview {...defaultProps} isOpen={true} />,
      );
      const panel = container.querySelector(".translate-x-0");
      expect(panel).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should call onClose when close button is clicked", () => {
      render(<TemplateQuickview {...defaultProps} />);

      // Find the close button by its SVG path
      const closeButton = screen.getByRole("button", { name: "" });
      const svgPath = closeButton.querySelector(
        'path[d="M6 18L18 6M6 6l12 12"]',
      );
      expect(svgPath).toBeInTheDocument();

      fireEvent.click(closeButton);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop is clicked", () => {
      const { container } = render(<TemplateQuickview {...defaultProps} />);

      // Find the backdrop div
      const backdrop = container.querySelector(".bg-black");
      expect(backdrop).toBeInTheDocument();

      fireEvent.click(backdrop!);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Template Information", () => {
    it("should display template title", () => {
      render(<TemplateQuickview {...defaultProps} />);
      expect(screen.getByText("Email Template")).toBeInTheDocument();
    });

    it("should display template tags", () => {
      render(<TemplateQuickview {...defaultProps} />);
      expect(screen.getByText("email")).toBeInTheDocument();
      expect(screen.getByText("welcome")).toBeInTheDocument();
    });

    it("should display template metadata", () => {
      render(<TemplateQuickview {...defaultProps} />);
      expect(screen.getByText(/By author@example.com/)).toBeInTheDocument();
      expect(screen.getByText(/50 uses/)).toBeInTheDocument();
    });

    it("should show link to full template page", () => {
      render(<TemplateQuickview {...defaultProps} />);
      const link = screen.getByText("View Full Template").closest("a");
      expect(link).toHaveAttribute("href", "/templates/template-123");
    });
  });

  describe("GravyJS Editor Integration", () => {
    it("should render GravyJS editor", () => {
      render(<TemplateQuickview {...defaultProps} />);
      expect(screen.getByTestId("gravyjs-editor")).toBeInTheDocument();
    });
  });
});
