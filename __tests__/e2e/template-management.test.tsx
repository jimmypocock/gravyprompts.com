import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import HomePage from '@/app/page';
import TemplateDetailPage from '@/app/templates/[id]/page';
import { useAuth, AuthProvider } from '@/lib/auth-context';
import { SearchProvider } from '@/lib/search-context';
import { savePrompt } from '@/lib/api/prompts';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => ({
    get: jest.fn()
  }))
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn()
}));

jest.mock('@/lib/api/templates', () => ({
  getTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  listTemplates: jest.fn()
}));

jest.mock('@/lib/api/prompts', () => ({
  savePrompt: jest.fn()
}));

// Mock GravyJS editor
jest.mock('gravyjs', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        setContent: jest.fn(),
        generatePopulatedContent: jest.fn((variables: Record<string, string>) => {
          let content = props.initialValue || '';
          Object.entries(variables).forEach(([key, value]) => {
            content = content.replace(new RegExp(`\\[\\[${key}\\]\\]`, 'g'), value);
          });
          return Promise.resolve(content);
        })
      }));
      return React.createElement('div', { 'data-testid': 'gravyjs-editor' }, props.initialValue);
    })
  };
});

describe('Template Management E2E', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn()
  };

  const mockUser = {
    userId: 'user-123',
    email: 'user@example.com'
  };

  const mockTemplate = {
    templateId: 'template-123',
    title: 'Email Marketing Template',
    content: 'Hello [[name]], Welcome to [[company]]!',
    tags: ['email', 'marketing'],
    variables: ['name', 'company'],
    visibility: 'public' as const,
    status: 'approved' as const,
    authorId: 'user-123',
    authorEmail: 'user@example.com',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    views: 150,
    shares: 25,
    useCount: 75
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      loading: false
    });
  });

  describe('Template Discovery and Viewing', () => {
    it('should allow users to browse and search templates', async () => {
      const user = userEvent.setup();
      
      // Mock API response for template list
      const mockTemplates = [mockTemplate];
      require('@/lib/api/templates').listTemplates.mockResolvedValue({
        templates: mockTemplates
      });

      render(
        <AuthProvider>
          <SearchProvider>
            <HomePage />
          </SearchProvider>
        </AuthProvider>
      );

      // Wait for templates to load
      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      // Search for templates
      const searchInput = screen.getByPlaceholderText(/search templates/i);
      await user.type(searchInput, 'email');

      // Click on a template card
      const templateCard = screen.getByText('Email Marketing Template').closest('article');
      fireEvent.click(templateCard!);

      // Should open quickview
      await waitFor(() => {
        expect(screen.getByText('View Full Template')).toBeInTheDocument();
      });
    });

    it('should display template details in quickview', async () => {
      const mockTemplates = [mockTemplate];
      require('@/lib/api/templates').listTemplates.mockResolvedValue({
        templates: mockTemplates
      });

      render(
        <AuthProvider>
          <SearchProvider>
            <HomePage />
          </SearchProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      // Open quickview
      const templateCard = screen.getByText('Email Marketing Template').closest('article');
      fireEvent.click(templateCard!);

      await waitFor(() => {
        // Check template information
        expect(screen.getByText('By user@example.com')).toBeInTheDocument();
        expect(screen.getByText('75 uses')).toBeInTheDocument();
        expect(screen.getByText('email')).toBeInTheDocument();
        expect(screen.getByText('marketing')).toBeInTheDocument();
      });
    });
  });

  describe('Template Variable Population', () => {
    it('should allow users to fill in template variables', async () => {
      const user = userEvent.setup();
      
      const mockTemplates = [mockTemplate];
      require('@/lib/api/templates').listTemplates.mockResolvedValue({
        templates: mockTemplates
      });

      render(
        <AuthProvider>
          <SearchProvider>
            <HomePage />
          </SearchProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      // Open quickview
      const templateCard = screen.getByText('Email Marketing Template').closest('article');
      fireEvent.click(templateCard!);

      await waitFor(() => {
        expect(screen.getByText('Fill in Variables')).toBeInTheDocument();
      });

      // Fill in variables
      const nameInput = screen.getByLabelText('name');
      const companyInput = screen.getByLabelText('company');

      await user.type(nameInput, 'John Doe');
      await user.type(companyInput, 'Acme Corp');

      // Populate template
      const populateButton = screen.getByText('🔄 Populate Template');
      expect(populateButton).not.toBeDisabled();
      
      fireEvent.click(populateButton);

      await waitFor(() => {
        expect(screen.getByText('Your Populated Template')).toBeInTheDocument();
        expect(screen.getByText(/Hello John Doe, Welcome to Acme Corp!/)).toBeInTheDocument();
      });
    });

    it('should allow users to copy populated content', async () => {
      const user = userEvent.setup();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
          write: jest.fn().mockResolvedValue(undefined)
        }
      });

      const mockTemplates = [mockTemplate];
      require('@/lib/api/templates').listTemplates.mockResolvedValue({
        templates: mockTemplates
      });

      render(
        <AuthProvider>
          <SearchProvider>
            <HomePage />
          </SearchProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      // Open quickview and populate
      const templateCard = screen.getByText('Email Marketing Template').closest('article');
      fireEvent.click(templateCard!);

      await waitFor(() => {
        expect(screen.getByText('Fill in Variables')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('name');
      const companyInput = screen.getByLabelText('company');

      await user.type(nameInput, 'John');
      await user.type(companyInput, 'Example Inc');

      fireEvent.click(screen.getByText('🔄 Populate Template'));

      await waitFor(() => {
        expect(screen.getByText('Your Populated Template')).toBeInTheDocument();
      });

      // Copy as text
      const copyTextButton = screen.getByText('Copy Text');
      fireEvent.click(copyTextButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('Hello John, Welcome to Example Inc!')
      );
    });

    it('should save populated prompts for authenticated users', async () => {
      const user = userEvent.setup();
      
      (savePrompt as jest.Mock).mockResolvedValue({
        prompt: {
          promptId: 'prompt-123',
          templateId: mockTemplate.templateId,
          title: 'My Email',
          content: 'Hello John, Welcome to Acme!',
          variables: { name: 'John', company: 'Acme' }
        }
      });

      const mockTemplates = [mockTemplate];
      require('@/lib/api/templates').listTemplates.mockResolvedValue({
        templates: mockTemplates
      });

      render(
        <AuthProvider>
          <SearchProvider>
            <HomePage />
          </SearchProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      // Open quickview and populate
      const templateCard = screen.getByText('Email Marketing Template').closest('article');
      fireEvent.click(templateCard!);

      await waitFor(() => {
        expect(screen.getByText('Fill in Variables')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('name');
      const companyInput = screen.getByLabelText('company');

      await user.type(nameInput, 'John');
      await user.type(companyInput, 'Acme');

      fireEvent.click(screen.getByText('🔄 Populate Template'));

      await waitFor(() => {
        expect(screen.getByText('Your Populated Template')).toBeInTheDocument();
      });

      // Save prompt
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(savePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: mockTemplate.templateId,
            variables: { name: 'John', company: 'Acme' }
          }),
          expect.any(String)
        );
      });
    });
  });

  describe('Template Detail Page', () => {
    it('should display full template details', async () => {
      (getTemplate as jest.Mock).mockResolvedValue({
        template: mockTemplate
      });

      render(
        <AuthProvider>
          <TemplateDetailPage params={{ id: mockTemplate.templateId }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
        expect(screen.getByText('By user@example.com')).toBeInTheDocument();
        expect(screen.getByText('150 views')).toBeInTheDocument();
        expect(screen.getByText('25 shares')).toBeInTheDocument();
        expect(screen.getByText('75 uses')).toBeInTheDocument();
      });
    });

    it('should allow template owner to edit', async () => {
      (getTemplate as jest.Mock).mockResolvedValue({
        template: mockTemplate
      });

      render(
        <AuthProvider>
          <TemplateDetailPage params={{ id: mockTemplate.templateId }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Edit Template')).toBeInTheDocument();
      });

      const editButton = screen.getByText('Edit Template');
      fireEvent.click(editButton);

      expect(mockRouter.push).toHaveBeenCalledWith(
        `/templates/${mockTemplate.templateId}/edit`
      );
    });

    it('should not show edit button for non-owners', async () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { userId: 'different-user', email: 'other@example.com' },
        loading: false
      });

      (getTemplate as jest.Mock).mockResolvedValue({
        template: mockTemplate
      });

      render(
        <AuthProvider>
          <TemplateDetailPage params={{ id: mockTemplate.templateId }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      expect(screen.queryByText('Edit Template')).not.toBeInTheDocument();
    });

    it('should handle template deletion', async () => {
      (getTemplate as jest.Mock).mockResolvedValue({
        template: mockTemplate
      });

      (deleteTemplate as jest.Mock).mockResolvedValue({
        success: true
      });

      render(
        <AuthProvider>
          <TemplateDetailPage params={{ id: mockTemplate.templateId }} />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Delete Template')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Template');
      fireEvent.click(deleteButton);

      // Confirm deletion
      const confirmButton = await screen.findByText('Confirm Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(deleteTemplate).toHaveBeenCalledWith(
          mockTemplate.templateId,
          expect.any(String)
        );
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Template Creation Flow', () => {
    it('should guide users through template creation', async () => {
      const user = userEvent.setup();
      
      // Mock create template page
      const CreateTemplatePage = () => {
        const [title, setTitle] = React.useState('');
        const [content, setContent] = React.useState('');
        const [tags, setTags] = React.useState<string[]>([]);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          await require('@/lib/api/templates').createTemplate({
            title,
            content,
            tags,
            visibility: 'public'
          }, 'mock-token');
          mockRouter.push('/');
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              name="title"
              placeholder="Template Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              name="content"
              placeholder="Template Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <input
              name="tags"
              placeholder="Tags (comma separated)"
              onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()))}
            />
            <button type="submit">Create Template</button>
          </form>
        );
      };

      require('@/lib/api/templates').createTemplate.mockResolvedValue({
        template: { ...mockTemplate, templateId: 'new-template-123' }
      });

      render(<CreateTemplatePage />);

      // Fill in template details
      const titleInput = screen.getByPlaceholderText('Template Title');
      const contentInput = screen.getByPlaceholderText('Template Content');
      const tagsInput = screen.getByPlaceholderText('Tags (comma separated)');

      await user.type(titleInput, 'New Email Template');
      await user.type(contentInput, 'Dear [[recipient]], This is a test.');
      await user.type(tagsInput, 'email, test');

      // Submit
      const createButton = screen.getByText('Create Template');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(require('@/lib/api/templates').createTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Email Template',
            content: 'Dear [[recipient]], This is a test.',
            tags: ['email', 'test']
          }),
          'mock-token'
        );
        expect(mockRouter.push).toHaveBeenCalledWith('/');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle template loading errors', async () => {
      (getTemplate as jest.Mock).mockRejectedValue(
        new Error('Template not found')
      );

      render(<TemplateDetailPage params={{ id: 'non-existent' }} />);

      await waitFor(() => {
        expect(screen.getByText(/Template not found/i)).toBeInTheDocument();
      });
    });

    it('should handle save errors gracefully', async () => {
      const user = userEvent.setup();
      
      (savePrompt as jest.Mock).mockRejectedValue(
        new Error('Failed to save prompt')
      );

      const mockTemplates = [mockTemplate];
      require('@/lib/api/templates').listTemplates.mockResolvedValue({
        templates: mockTemplates
      });

      render(
        <AuthProvider>
          <SearchProvider>
            <HomePage />
          </SearchProvider>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      });

      // Open quickview and populate
      const templateCard = screen.getByText('Email Marketing Template').closest('article');
      fireEvent.click(templateCard!);

      await waitFor(() => {
        expect(screen.getByText('Fill in Variables')).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText('name');
      await user.type(nameInput, 'Test');

      const companyInput = screen.getByLabelText('company');
      await user.type(companyInput, 'Test Co');

      fireEvent.click(screen.getByText('🔄 Populate Template'));

      await waitFor(() => {
        expect(screen.getByText('Your Populated Template')).toBeInTheDocument();
      });

      // Try to save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to save/i)).toBeInTheDocument();
      });
    });
  });
});