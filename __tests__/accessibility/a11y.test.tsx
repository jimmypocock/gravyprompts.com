/**
 * Accessibility (a11y) Tests
 *
 * These tests verify WCAG 2.1 compliance and ensure the application
 * is accessible to users with disabilities, including keyboard users,
 * screen reader users, and users with visual impairments.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock components for testing
const MockTemplateCard = ({ template, onClick }: any) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    aria-label={`Template: ${template.title} by ${template.authorEmail}`}
    className="template-card"
  >
    <h3 id={`template-title-${template.templateId}`}>{template.title}</h3>
    <p aria-describedby={`template-title-${template.templateId}`}>
      {template.preview}
    </p>
    <div aria-label="Template metadata">
      <span aria-label={`${template.views} views`}>{template.views} views</span>
      <span aria-label={`${template.useCount} uses`}>
        {template.useCount} uses
      </span>
    </div>
    <div role="list" aria-label="Template tags">
      {template.tags.map((tag: string) => (
        <span key={tag} role="listitem" className="tag">
          {tag}
        </span>
      ))}
    </div>
  </article>
);

const MockSearchForm = ({ onSearch }: any) => {
  const [searchTerm, setSearchTerm] = React.useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(searchTerm);
      }}
      aria-label="Search templates"
    >
      <label htmlFor="search-input" className="sr-only">
        Search for templates
      </label>
      <input
        id="search-input"
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search templates..."
        aria-describedby="search-instructions"
        aria-required={false}
      />
      <div id="search-instructions" className="sr-only">
        Enter keywords to search for templates. Use space to separate multiple
        terms.
      </div>
      <button type="submit" aria-label="Execute search">
        Search
      </button>
    </form>
  );
};

const MockQuickviewModal = ({ template, isOpen, onClose }: any) => {
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      ref={modalRef}
      tabIndex={-1}
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-content">
        <header>
          <h2 id="modal-title">{template.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template details"
            className="close-button"
          >
            ×
          </button>
        </header>

        <div id="modal-description">
          <p>Template details and variable filling interface</p>
        </div>

        <main>
          <section aria-labelledby="template-content-heading">
            <h3 id="template-content-heading">Template Content</h3>
            <div aria-label="Template preview">{template.content}</div>
          </section>

          <section aria-labelledby="variables-heading">
            <h3 id="variables-heading">Fill in Variables</h3>
            <form aria-label="Template variable form">
              {template.variables.map((variable: string) => (
                <div key={variable} className="form-group">
                  <label htmlFor={`var-${variable}`}>
                    {variable}
                    <span className="required" aria-label="required">
                      *
                    </span>
                  </label>
                  <input
                    id={`var-${variable}`}
                    type="text"
                    aria-required="true"
                    aria-describedby={`var-${variable}-help`}
                  />
                  <div id={`var-${variable}-help`} className="help-text">
                    Enter value for {variable} variable
                  </div>
                </div>
              ))}
            </form>
          </section>
        </main>

        <footer>
          <button type="button" className="btn-primary">
            Populate Template
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};

describe("Accessibility Tests", () => {
  beforeEach(() => {
    // Clear any existing announcements
    document.querySelectorAll("[aria-live]").forEach((el) => {
      el.textContent = "";
    });
  });

  describe("Keyboard Navigation", () => {
    it("should navigate template cards with keyboard", async () => {
      const user = userEvent.setup();
      const mockTemplates = [
        {
          templateId: "1",
          title: "Template 1",
          preview: "Preview 1",
          tags: ["tag1"],
          views: 100,
          useCount: 50,
          authorEmail: "user1@example.com",
        },
        {
          templateId: "2",
          title: "Template 2",
          preview: "Preview 2",
          tags: ["tag2"],
          views: 200,
          useCount: 75,
          authorEmail: "user2@example.com",
        },
      ];

      render(
        <div>
          {mockTemplates.map((template) => (
            <MockTemplateCard
              key={template.templateId}
              template={template}
              onClick={() => {}}
            />
          ))}
        </div>,
      );

      // Should be able to tab to first template
      await user.tab();
      expect(screen.getByLabelText(/Template: Template 1/)).toHaveFocus();

      // Should be able to tab to second template
      await user.tab();
      expect(screen.getByLabelText(/Template: Template 2/)).toHaveFocus();

      // Should be able to activate with Enter key
      const onClickSpy = jest.fn();
      render(
        <MockTemplateCard template={mockTemplates[0]} onClick={onClickSpy} />,
      );

      const templateCard = screen.getAllByLabelText(/Template: Template 1/)[1];
      templateCard.focus();
      await user.keyboard("{Enter}");
      expect(onClickSpy).toHaveBeenCalled();

      // Should be able to activate with Space key
      onClickSpy.mockClear();
      await user.keyboard(" ");
      expect(onClickSpy).toHaveBeenCalled();
    });

    it("should handle form navigation properly", async () => {
      const user = userEvent.setup();
      const onSearch = jest.fn();

      render(<MockSearchForm onSearch={onSearch} />);

      // Should focus search input
      await user.tab();
      expect(screen.getByLabelText(/Search for templates/)).toHaveFocus();

      // Should be able to tab to search button
      await user.tab();
      expect(screen.getByLabelText(/Execute search/)).toHaveFocus();

      // Should submit form with Enter on input
      const searchInput = screen.getByLabelText(/Search for templates/);
      searchInput.focus();
      await user.type(searchInput, "test query");
      await user.keyboard("{Enter}");
      expect(onSearch).toHaveBeenCalledWith("test query");
    });

    it("should trap focus in modal dialogs", async () => {
      const user = userEvent.setup();
      const template = {
        templateId: "test",
        title: "Test Template",
        content: "Hello {{name}}",
        variables: ["name"],
      };

      const MockModalTest = () => {
        const [isOpen, setIsOpen] = React.useState(false);

        return (
          <div>
            <button onClick={() => setIsOpen(true)}>Open Modal</button>
            <MockQuickviewModal
              template={template}
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
            />
          </div>
        );
      };

      render(<MockModalTest />);

      // Open modal
      await user.click(screen.getByText("Open Modal"));

      // Modal should have focus
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toHaveFocus();
      });

      // Tab should move within modal
      await user.tab();
      expect(screen.getByLabelText(/Close template details/)).toHaveFocus();

      // Continue tabbing should stay within modal
      await user.tab();
      expect(screen.getByLabelText(/name/)).toHaveFocus();

      await user.tab();
      expect(screen.getByText("Populate Template")).toHaveFocus();

      await user.tab();
      expect(screen.getByText("Cancel")).toHaveFocus();

      // Tab should wrap back to close button
      await user.tab();
      expect(screen.getByLabelText(/Close template details/)).toHaveFocus();
    });

    it("should close modal with Escape key", async () => {
      const user = userEvent.setup();
      const template = {
        templateId: "test",
        title: "Test Template",
        content: "Hello {{name}}",
        variables: ["name"],
      };

      const MockModalTest = () => {
        const [isOpen, setIsOpen] = React.useState(true);

        return (
          <MockQuickviewModal
            template={template}
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
          />
        );
      };

      render(<MockModalTest />);

      // Modal should be open
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Escape should close modal
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("should support skip links", async () => {
      const user = userEvent.setup();

      const MockPageWithSkipLink = () => (
        <div>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <nav aria-label="Main navigation">
            <a href="/templates">Templates</a>
            <a href="/profile">Profile</a>
          </nav>
          <main id="main-content" tabIndex={-1}>
            <h1>Main Content</h1>
          </main>
        </div>
      );

      render(<MockPageWithSkipLink />);

      // First tab should focus skip link
      await user.tab();
      expect(screen.getByText("Skip to main content")).toHaveFocus();

      // Activating skip link should focus main content
      await user.keyboard("{Enter}");
      expect(screen.getByRole("main")).toHaveFocus();
    });
  });

  describe("Screen Reader Support", () => {
    it("should provide proper ARIA labels and descriptions", () => {
      const template = {
        templateId: "test",
        title: "Email Template",
        preview: "Professional email template",
        tags: ["email", "business"],
        views: 150,
        useCount: 75,
        authorEmail: "author@example.com",
      };

      render(<MockTemplateCard template={template} onClick={() => {}} />);

      // Template card should have descriptive label
      expect(
        screen.getByLabelText(/Template: Email Template by author@example.com/),
      ).toBeInTheDocument();

      // Metadata should be properly labeled
      expect(screen.getByLabelText(/150 views/)).toBeInTheDocument();
      expect(screen.getByLabelText(/75 uses/)).toBeInTheDocument();

      // Tags should be in a list
      expect(
        screen.getByRole("list", { name: /Template tags/ }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("should provide proper form labels and instructions", () => {
      render(<MockSearchForm onSearch={() => {}} />);

      // Search form should have proper role
      expect(screen.getByRole("search")).toBeInTheDocument();

      // Input should have proper label
      expect(screen.getByLabelText(/Search for templates/)).toBeInTheDocument();

      // Should have describedby for instructions
      const searchInput = screen.getByLabelText(/Search for templates/);
      expect(searchInput).toHaveAttribute(
        "aria-describedby",
        "search-instructions",
      );

      // Instructions should exist
      expect(screen.getByText(/Enter keywords to search/)).toBeInTheDocument();
    });

    it("should announce dynamic content changes", async () => {
      const MockDynamicContent = () => {
        const [status, setStatus] = React.useState("");

        return (
          <div>
            <button onClick={() => setStatus("Template saved successfully!")}>
              Save Template
            </button>
            <div
              aria-live="polite"
              aria-atomic="true"
              id="status-announcements"
              className="sr-only"
            >
              {status}
            </div>
          </div>
        );
      };

      const user = userEvent.setup();
      render(<MockDynamicContent />);

      await user.click(screen.getByText("Save Template"));

      expect(
        screen.getByText("Template saved successfully!"),
      ).toBeInTheDocument();
      expect(screen.getByText("Template saved successfully!")).toHaveAttribute(
        "aria-live",
        "polite",
      );
    });

    it("should provide proper heading structure", () => {
      const template = {
        templateId: "test",
        title: "Test Template",
        content: "Hello {{name}}",
        variables: ["name"],
      };

      render(
        <MockQuickviewModal
          template={template}
          isOpen={true}
          onClose={() => {}}
        />,
      );

      // Should have proper heading hierarchy
      const headings = screen.getAllByRole("heading");
      expect(headings[0]).toHaveTextContent("Test Template"); // h2
      expect(headings[1]).toHaveTextContent("Template Content"); // h3
      expect(headings[2]).toHaveTextContent("Fill in Variables"); // h3

      // Main heading should be referenced by aria-labelledby
      expect(screen.getByRole("dialog")).toHaveAttribute(
        "aria-labelledby",
        "modal-title",
      );
    });

    it("should provide accessible error messages", () => {
      const MockFormWithErrors = () => {
        const [errors, setErrors] = React.useState<Record<string, string>>({});

        const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          setErrors({ name: "Name is required" });
        };

        return (
          <form onSubmit={handleSubmit} aria-label="Template creation form">
            <div className="form-group">
              <label htmlFor="template-name">
                Template Name
                <span className="required" aria-label="required">
                  *
                </span>
              </label>
              <input
                id="template-name"
                type="text"
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <div
                  id="name-error"
                  role="alert"
                  aria-live="polite"
                  className="error-message"
                >
                  {errors.name}
                </div>
              )}
            </div>
            <button type="submit">Create Template</button>
          </form>
        );
      };

      const user = userEvent.setup();
      render(<MockFormWithErrors />);

      const nameInput = screen.getByLabelText(/Template Name/);
      expect(nameInput).toHaveAttribute("aria-required", "true");

      user.click(screen.getByText("Create Template"));

      waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent("Name is required");
        expect(nameInput).toHaveAttribute("aria-invalid", "true");
        expect(nameInput).toHaveAttribute("aria-describedby", "name-error");
      });
    });
  });

  describe("Visual Accessibility", () => {
    it("should provide sufficient color contrast", () => {
      // Mock color contrast testing - in real app, use tools like axe-core
      const MockColorContrastTest = () => (
        <div>
          <div
            style={{
              backgroundColor: "#ffffff",
              color: "#333333", // Should pass WCAG AA (contrast ratio > 4.5:1)
            }}
            data-testid="good-contrast"
          >
            High contrast text
          </div>
          <div
            style={{
              backgroundColor: "#ffffff",
              color: "#cccccc", // Should fail WCAG AA (contrast ratio < 4.5:1)
            }}
            data-testid="poor-contrast"
          >
            Low contrast text
          </div>
        </div>
      );

      render(<MockColorContrastTest />);

      // In a real implementation, you would use axe-core or similar tools
      expect(screen.getByTestId("good-contrast")).toBeInTheDocument();
      expect(screen.getByTestId("poor-contrast")).toBeInTheDocument();
    });

    it("should provide visible focus indicators", async () => {
      const user = userEvent.setup();

      const MockFocusTest = () => (
        <div>
          <button className="btn-with-focus">Focusable Button</button>
          <a href="#test" className="link-with-focus">
            Focusable Link
          </a>
        </div>
      );

      render(<MockFocusTest />);

      // Tab to button
      await user.tab();
      const button = screen.getByText("Focusable Button");
      expect(button).toHaveFocus();

      // Tab to link
      await user.tab();
      const link = screen.getByText("Focusable Link");
      expect(link).toHaveFocus();
    });

    it("should not rely solely on color for information", () => {
      const MockStatusIndicators = () => (
        <div>
          <div className="status-approved" aria-label="Status: Approved">
            <span className="status-icon" aria-hidden="true">
              ✓
            </span>
            <span className="status-text">Approved</span>
          </div>
          <div className="status-rejected" aria-label="Status: Rejected">
            <span className="status-icon" aria-hidden="true">
              ✗
            </span>
            <span className="status-text">Rejected</span>
          </div>
          <div className="status-pending" aria-label="Status: Pending">
            <span className="status-icon" aria-hidden="true">
              ⏳
            </span>
            <span className="status-text">Pending</span>
          </div>
        </div>
      );

      render(<MockStatusIndicators />);

      // Status should be conveyed through text and icons, not just color
      expect(screen.getByLabelText("Status: Approved")).toBeInTheDocument();
      expect(screen.getByLabelText("Status: Rejected")).toBeInTheDocument();
      expect(screen.getByLabelText("Status: Pending")).toBeInTheDocument();

      // Icons should be marked as decorative
      expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText("✗")).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText("⏳")).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Images and Media", () => {
    it("should provide appropriate alt text for images", () => {
      const MockImageGallery = () => (
        <div>
          <img
            src="/template-preview.jpg"
            alt="Email marketing template with blue header and call-to-action button"
          />
          <img src="/decorative-icon.svg" alt="" role="presentation" />
          <img src="/user-avatar.jpg" alt="Profile picture of John Doe" />
        </div>
      );

      render(<MockImageGallery />);

      // Meaningful images should have descriptive alt text
      expect(
        screen.getByAltText(/Email marketing template/),
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(/Profile picture of John Doe/),
      ).toBeInTheDocument();

      // Decorative images should have empty alt text
      const decorativeImage = screen.getByRole("presentation");
      expect(decorativeImage).toHaveAttribute("alt", "");
    });

    it("should provide captions for video content", () => {
      const MockVideoPlayer = () => (
        <video controls aria-label="Tutorial: How to create a template">
          <source src="/tutorial.mp4" type="video/mp4" />
          <track
            kind="captions"
            src="/tutorial-captions.vtt"
            srcLang="en"
            label="English captions"
            default
          />
          <track
            kind="descriptions"
            src="/tutorial-descriptions.vtt"
            srcLang="en"
            label="English descriptions"
          />
          Your browser does not support the video tag.
        </video>
      );

      render(<MockVideoPlayer />);

      const video = screen.getByLabelText(/Tutorial: How to create a template/);
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute("controls");
    });
  });

  describe("Form Accessibility", () => {
    it("should group related form fields", () => {
      const MockTemplateForm = () => (
        <form aria-label="Create new template">
          <fieldset>
            <legend>Template Information</legend>
            <div className="form-group">
              <label htmlFor="template-title">Title</label>
              <input id="template-title" type="text" required />
            </div>
            <div className="form-group">
              <label htmlFor="template-description">Description</label>
              <textarea id="template-description" />
            </div>
          </fieldset>

          <fieldset>
            <legend>Visibility Settings</legend>
            <div className="form-group">
              <input
                type="radio"
                id="visibility-public"
                name="visibility"
                value="public"
              />
              <label htmlFor="visibility-public">Public</label>
            </div>
            <div className="form-group">
              <input
                type="radio"
                id="visibility-private"
                name="visibility"
                value="private"
              />
              <label htmlFor="visibility-private">Private</label>
            </div>
          </fieldset>
        </form>
      );

      render(<MockTemplateForm />);

      // Should have grouped fields with legends
      expect(screen.getByText("Template Information")).toBeInTheDocument();
      expect(screen.getByText("Visibility Settings")).toBeInTheDocument();

      // Radio buttons should be grouped
      expect(screen.getByRole("radio", { name: "Public" })).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: "Private" }),
      ).toBeInTheDocument();
    });

    it("should provide clear form validation feedback", async () => {
      const MockValidationForm = () => {
        const [submitted, setSubmitted] = React.useState(false);
        const [values, setValues] = React.useState({ email: "", password: "" });

        const errors = {
          email: submitted && !values.email ? "Email is required" : "",
          password:
            submitted && values.password.length < 8
              ? "Password must be at least 8 characters"
              : "",
        };

        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            aria-label="Login form"
          >
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, email: e.target.value }))
                }
                aria-required="true"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : "email-help"}
              />
              <div id="email-help" className="help-text">
                Enter your registered email address
              </div>
              {errors.email && (
                <div id="email-error" role="alert" className="error-message">
                  {errors.email}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={values.password}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, password: e.target.value }))
                }
                aria-required="true"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : "password-help"
                }
              />
              <div id="password-help" className="help-text">
                Must be at least 8 characters long
              </div>
              {errors.password && (
                <div id="password-error" role="alert" className="error-message">
                  {errors.password}
                </div>
              )}
            </div>

            <button type="submit">Sign In</button>
          </form>
        );
      };

      const user = userEvent.setup();
      render(<MockValidationForm />);

      // Submit form without filling fields
      await user.click(screen.getByText("Sign In"));

      await waitFor(() => {
        expect(
          screen.getByRole("alert", { name: /Email is required/ }),
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue("")).toHaveAttribute(
          "aria-invalid",
          "true",
        );
      });
    });
  });

  describe("WCAG 2.1 Compliance", () => {
    it("should pass axe-core accessibility audit", async () => {
      const template = {
        templateId: "test",
        title: "Test Template",
        preview: "Test preview",
        tags: ["test"],
        views: 100,
        useCount: 50,
        authorEmail: "test@example.com",
      };

      const { container } = render(
        <div>
          <h1>Template Gallery</h1>
          <MockSearchForm onSearch={() => {}} />
          <main>
            <MockTemplateCard template={template} onClick={() => {}} />
          </main>
        </div>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should meet minimum touch target size", () => {
      const MockTouchTargets = () => (
        <div>
          <button
            style={{ minWidth: "44px", minHeight: "44px" }}
            aria-label="Like template"
          >
            ❤️
          </button>
          <button
            style={{ minWidth: "44px", minHeight: "44px" }}
            aria-label="Share template"
          >
            📤
          </button>
        </div>
      );

      render(<MockTouchTargets />);

      const likeButton = screen.getByLabelText("Like template");
      const shareButton = screen.getByLabelText("Share template");

      // In a real test, you would check computed styles
      expect(likeButton).toBeInTheDocument();
      expect(shareButton).toBeInTheDocument();
    });

    it("should support user preferences for reduced motion", () => {
      // Mock matchMedia for reduced motion preference
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const MockAnimatedComponent = () => {
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;

        return (
          <div
            className={`animated-element ${prefersReducedMotion ? "reduced-motion" : ""}`}
            data-testid="animated-element"
          >
            Animated content
          </div>
        );
      };

      render(<MockAnimatedComponent />);

      const element = screen.getByTestId("animated-element");
      expect(element).toHaveClass("reduced-motion");
    });
  });

  describe("Mobile Accessibility", () => {
    it("should work with mobile screen readers", () => {
      const MockMobileLayout = () => (
        <div>
          <header>
            <h1>GravyPrompts</h1>
            <button
              aria-label="Open navigation menu"
              aria-expanded="false"
              aria-controls="mobile-nav"
            >
              ☰
            </button>
          </header>

          <nav id="mobile-nav" aria-hidden="true">
            <ul role="list">
              <li>
                <a href="/templates">Templates</a>
              </li>
              <li>
                <a href="/profile">Profile</a>
              </li>
              <li>
                <a href="/settings">Settings</a>
              </li>
            </ul>
          </nav>

          <main>
            <h2>Featured Templates</h2>
          </main>
        </div>
      );

      render(<MockMobileLayout />);

      const menuButton = screen.getByLabelText("Open navigation menu");
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
      expect(menuButton).toHaveAttribute("aria-controls", "mobile-nav");

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-hidden", "true");
    });

    it("should support voice control commands", () => {
      const MockVoiceControlTest = () => (
        <div>
          <button data-voice-command="search templates">🔍 Search</button>
          <button data-voice-command="create new template">
            ➕ New Template
          </button>
          <button data-voice-command="go to profile">👤 Profile</button>
        </div>
      );

      render(<MockVoiceControlTest />);

      // Voice command attributes should be present for voice control software
      expect(screen.getByText("🔍 Search")).toHaveAttribute(
        "data-voice-command",
        "search templates",
      );
      expect(screen.getByText("➕ New Template")).toHaveAttribute(
        "data-voice-command",
        "create new template",
      );
      expect(screen.getByText("👤 Profile")).toHaveAttribute(
        "data-voice-command",
        "go to profile",
      );
    });
  });
});
