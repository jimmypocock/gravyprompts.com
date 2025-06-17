import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "@/app/page";
import { SearchProvider } from "@/lib/search-context";
import { AuthProvider } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { useTemplateApi } from "@/lib/api/templates";

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/lib/api/templates", () => ({
  createTemplateApi: jest.fn(),
  useTemplateApi: jest.fn(() => ({
    listTemplates: jest.fn(),
  })),
}));

jest.mock("@/lib/auth-context", () => ({
  ...jest.requireActual("@/lib/auth-context"),
  useAuth: jest.fn(() => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  })),
}));

// Mock template quickview component
jest.mock("@/components/TemplateQuickview", () => ({
  __esModule: true,
  default: ({ template, isOpen, onClose }: any) => {
    if (!isOpen || !template) return null;
    return (
      <div data-testid="template-quickview">
        <h2>{template.title}</h2>
        <button onClick={onClose}>Close</button>
      </div>
    );
  },
}));

const mockTemplates = [
  {
    templateId: "template-1",
    title: "Professional Email Template",
    content: "Dear [[recipient]], I hope this email finds you well.",
    tags: ["email", "business", "professional"],
    variables: ["recipient"],
    visibility: "public",
    status: "approved",
    authorEmail: "author1@example.com",
    views: 500,
    useCount: 200,
    score: 0.95,
  },
  {
    templateId: "template-2",
    title: "Marketing Newsletter",
    content: "Welcome to [[company]] newsletter for [[month]]!",
    tags: ["email", "marketing", "newsletter"],
    variables: ["company", "month"],
    visibility: "public",
    status: "approved",
    authorEmail: "author2@example.com",
    views: 300,
    useCount: 150,
    score: 0.85,
  },
  {
    templateId: "template-3",
    title: "Sales Pitch Email",
    content: "Hi [[name]], I wanted to reach out about [[product]].",
    tags: ["email", "sales", "pitch"],
    variables: ["name", "product"],
    visibility: "public",
    status: "approved",
    authorEmail: "author3@example.com",
    views: 250,
    useCount: 100,
    score: 0.75,
  },
  {
    templateId: "template-4",
    title: "Social Media Post",
    content: "Check out our latest [[item]] at [[link]]!",
    tags: ["social", "marketing", "promotion"],
    variables: ["item", "link"],
    visibility: "public",
    status: "approved",
    authorEmail: "author4@example.com",
    views: 400,
    useCount: 180,
    score: 0.8,
  },
  {
    templateId: "template-5",
    title: "Blog Post Introduction",
    content: "In this article about [[topic]], we will explore [[points]].",
    tags: ["blog", "content", "writing"],
    variables: ["topic", "points"],
    visibility: "public",
    status: "approved",
    authorEmail: "author5@example.com",
    views: 150,
    useCount: 50,
    score: 0.65,
  },
];

describe("Search Functionality E2E", () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
  };

  const mockSearchParams = new URLSearchParams();
  let mockListTemplates: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    mockListTemplates = jest.fn().mockResolvedValue({
      templates: mockTemplates,
    });
    (useTemplateApi as jest.Mock).mockReturnValue({
      listTemplates: mockListTemplates,
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <AuthProvider>
        <SearchProvider>{component}</SearchProvider>
      </AuthProvider>,
    );
  };

  describe("Basic Search", () => {
    it("should perform instant search as user types", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      // Wait for initial templates to load
      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
        expect(screen.getByText("Marketing Newsletter")).toBeInTheDocument();
      });

      // Type in search
      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "email");

      // API should be called with search query
      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "email" }),
        );
      });

      // Update mock to return filtered results
      mockListTemplates.mockResolvedValue({
        templates: mockTemplates.filter(
          (t) =>
            t.title.toLowerCase().includes("email") ||
            t.tags.some((tag) => tag.includes("email")),
        ),
      });

      // Verify filtered results
      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
        expect(screen.getByText("Sales Pitch Email")).toBeInTheDocument();
        expect(screen.queryByText("Social Media Post")).not.toBeInTheDocument();
      });
    });

    it("should handle multi-word searches", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "marketing email");

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenLastCalledWith(
          expect.objectContaining({ search: "marketing email" }),
        );
      });
    });

    it("should clear search results", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "email");

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.objectContaining({ search: "email" }),
        );
      });

      // Clear search
      await user.clear(searchInput);

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenLastCalledWith(
          expect.not.objectContaining({ search: expect.any(String) }),
        );
      });
    });
  });

  describe("Search Relevance", () => {
    it("should display results ordered by relevance score", async () => {
      const user = userEvent.setup();

      // Mock search results with scores
      const searchResults = [
        { ...mockTemplates[0], score: 0.95 }, // Professional Email Template
        { ...mockTemplates[1], score: 0.85 }, // Marketing Newsletter
        { ...mockTemplates[2], score: 0.75 }, // Sales Pitch Email
      ];

      mockListTemplates.mockResolvedValue({
        templates: searchResults,
      });

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "email");

      await waitFor(() => {
        const templateTitles = screen
          .getAllByRole("heading", { level: 3 })
          .map((el) => el.textContent);

        // Verify order matches score ranking
        expect(templateTitles[0]).toBe("Professional Email Template");
        expect(templateTitles[1]).toBe("Marketing Newsletter");
        expect(templateTitles[2]).toBe("Sales Pitch Email");
      });
    });

    it("should boost popular templates in search results", async () => {
      const user = userEvent.setup();

      // Mock templates with varying popularity
      const searchResults = [
        { ...mockTemplates[1], score: 0.85, useCount: 500 }, // High use count
        { ...mockTemplates[0], score: 0.85, useCount: 100 }, // Lower use count
      ];

      mockListTemplates.mockResolvedValue({
        templates: searchResults,
      });

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "template");

      await waitFor(() => {
        const templateTitles = screen
          .getAllByRole("heading", { level: 3 })
          .map((el) => el.textContent);

        // Higher use count should appear first
        expect(templateTitles[0]).toBe("Marketing Newsletter");
        expect(templateTitles[1]).toBe("Professional Email Template");
      });
    });
  });

  describe("Search Filters", () => {
    it("should filter by tags", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
      });

      // Click on a tag to filter
      const emailTag = screen.getAllByText("email")[0];
      fireEvent.click(emailTag);

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.objectContaining({ tags: ["email"] }),
        );
      });

      // Mock filtered results
      mockListTemplates.mockResolvedValue({
        templates: mockTemplates.filter((t) => t.tags.includes("email")),
      });

      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
        expect(screen.getByText("Marketing Newsletter")).toBeInTheDocument();
        expect(screen.queryByText("Social Media Post")).not.toBeInTheDocument();
      });
    });

    it("should support multiple tag filters", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
      });

      // Apply multiple tag filters
      const emailTag = screen.getAllByText("email")[0];
      const marketingTag = screen.getAllByText("marketing")[0];

      fireEvent.click(emailTag);
      fireEvent.click(marketingTag);

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: expect.arrayContaining(["email", "marketing"]),
          }),
        );
      });
    });

    it("should combine search and filters", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
      });

      // Search
      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "newsletter");

      // Add tag filter
      const marketingTag = screen.getAllByText("marketing")[0];
      fireEvent.click(marketingTag);

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.objectContaining({
            search: "newsletter",
            tags: ["marketing"],
          }),
        );
      });
    });
  });

  describe("Search Results Interaction", () => {
    it("should open template quickview from search results", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      await waitFor(() => {
        expect(
          screen.getByText("Professional Email Template"),
        ).toBeInTheDocument();
      });

      // Search for templates
      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "email");

      // Click on a result
      const templateCard = screen
        .getByText("Professional Email Template")
        .closest("article");
      fireEvent.click(templateCard!);

      await waitFor(() => {
        expect(screen.getByTestId("template-quickview")).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { name: "Professional Email Template" }),
        ).toBeInTheDocument();
      });
    });

    it("should maintain search state when navigating", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      // Perform search
      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "marketing");

      // Open template
      const templateCard = screen
        .getByText("Marketing Newsletter")
        .closest("article");
      fireEvent.click(templateCard!);

      await waitFor(() => {
        expect(screen.getByTestId("template-quickview")).toBeInTheDocument();
      });

      // Close quickview
      const closeButton = screen.getByText("Close");
      fireEvent.click(closeButton);

      // Search should still be active
      expect(searchInput).toHaveValue("marketing");
    });
  });

  describe("Search Suggestions and Autocomplete", () => {
    it("should show popular searches when focused", async () => {
      const user = userEvent.setup();

      // Mock popular searches
      mockListTemplates.mockResolvedValue({
        templates: mockTemplates,
        popularSearches: ["email template", "marketing", "newsletter"],
      });

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.click(searchInput);

      // Should show suggestions
      await waitFor(() => {
        expect(screen.getByText("Popular searches")).toBeInTheDocument();
        expect(screen.getByText("email template")).toBeInTheDocument();
        expect(screen.getByText("marketing")).toBeInTheDocument();
        expect(screen.getByText("newsletter")).toBeInTheDocument();
      });
    });

    it("should update search when clicking suggestion", async () => {
      const user = userEvent.setup();

      mockListTemplates.mockResolvedValue({
        templates: mockTemplates,
        popularSearches: ["email template", "marketing"],
      });

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.click(searchInput);

      await waitFor(() => {
        expect(screen.getByText("email template")).toBeInTheDocument();
      });

      // Click suggestion
      fireEvent.click(screen.getByText("email template"));

      expect(searchInput).toHaveValue("email template");
      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.objectContaining({ search: "email template" }),
        );
      });
    });
  });

  describe("Search Performance", () => {
    it("should debounce search requests", async () => {
      const user = userEvent.setup({ delay: 50 });

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);

      // Type quickly
      await user.type(searchInput, "test");

      // Should not call API for each character
      expect(mockListTemplates).toHaveBeenCalledTimes(2); // Initial load + 1 debounced search
    });

    it("should show loading state during search", async () => {
      const user = userEvent.setup();

      // Delay API response
      mockListTemplates.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ templates: [] }), 500),
          ),
      );

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "test");

      // Should show loading indicator
      await waitFor(() => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument();
      });
    });
  });

  describe("Empty States", () => {
    it("should show no results message", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "xyznonexistent");

      mockListTemplates.mockResolvedValue({
        templates: [],
      });

      await waitFor(() => {
        expect(screen.getByText(/no templates found/i)).toBeInTheDocument();
        expect(screen.getByText(/try different keywords/i)).toBeInTheDocument();
      });
    });

    it("should suggest clearing filters when no results", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      // Apply filters that return no results
      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "specific");

      mockListTemplates.mockResolvedValue({
        templates: [],
      });

      await waitFor(() => {
        expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
      });

      // Click clear filters
      const clearButton = screen.getByText(/clear filters/i);
      fireEvent.click(clearButton);

      expect(searchInput).toHaveValue("");
      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.not.objectContaining({ search: expect.any(String) }),
        );
      });
    });
  });

  describe("Search Persistence", () => {
    it("should save search to URL params", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomePage />);

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      await user.type(searchInput, "email marketing");

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith(
          expect.stringContaining("?search=email%20marketing"),
        );
      });
    });

    it("should restore search from URL params", async () => {
      mockSearchParams.set("search", "newsletter");
      mockSearchParams.set("tags", "email,marketing");

      renderWithProviders(<HomePage />);

      await waitFor(() => {
        expect(mockListTemplates).toHaveBeenCalledWith(
          expect.objectContaining({
            search: "newsletter",
            tags: ["email", "marketing"],
          }),
        );
      });

      const searchInput = screen.getByPlaceholderText(/search.*templates/i);
      expect(searchInput).toHaveValue("newsletter");
    });
  });
});
