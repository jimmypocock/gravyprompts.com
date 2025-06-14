import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApprovalQueue from '../ApprovalQueue';
import { getApprovalQueue, processApproval } from '@/lib/api/admin';

// Mock dependencies
jest.mock('@/lib/api/admin');
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours')
}));

const mockGetApprovalQueue = getApprovalQueue as jest.MockedFunction<typeof getApprovalQueue>;
const mockProcessApproval = processApproval as jest.MockedFunction<typeof processApproval>;

// Mock data
const mockTemplates = [
  {
    templateId: 'template-1',
    title: 'Email Marketing Template',
    content: '<p>Sample email template content</p>',
    authorEmail: 'author1@test.com',
    createdAt: '2024-01-01T10:00:00Z',
    tags: ['email', 'marketing'],
    variables: ['name', 'product']
  },
  {
    templateId: 'template-2',
    title: 'Product Launch Template',
    content: '<p>Product launch announcement</p>',
    authorEmail: 'author2@test.com',
    createdAt: '2024-01-01T12:00:00Z',
    tags: ['product', 'announcement'],
    variables: ['productName', 'launchDate']
  }
];

describe('ApprovalQueue', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetApprovalQueue.mockResolvedValue({
      templates: mockTemplates,
      count: mockTemplates.length
    });
  });

  it('should display loading state initially', () => {
    render(<ApprovalQueue />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should load and display pending templates', async () => {
    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
      expect(screen.getByText('Product Launch Template')).toBeInTheDocument();
    });

    expect(mockGetApprovalQueue).toHaveBeenCalledWith('pending');
    expect(screen.getByText('By author1@test.com • 2 hours ago')).toBeInTheDocument();
  });

  it('should display empty state when no templates', async () => {
    mockGetApprovalQueue.mockResolvedValue({
      templates: [],
      count: 0
    });

    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('No templates pending approval')).toBeInTheDocument();
    });
  });

  it('should switch between pending and rejected tabs', async () => {
    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Click rejected tab
    const rejectedTab = screen.getByRole('button', { name: /rejected/i });
    await user.click(rejectedTab);

    expect(mockGetApprovalQueue).toHaveBeenCalledWith('rejected');
    expect(rejectedTab).toHaveClass('border-primary text-primary');
  });

  it('should open preview modal when clicking preview button', async () => {
    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Click preview button for first template
    const previewButtons = screen.getAllByTitle('Preview');
    await user.click(previewButtons[0]);

    // Check modal content
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Sample email template content')).toBeInTheDocument();
    expect(screen.getByText('Variables:')).toBeInTheDocument();
    // Use getAllByText since 'product' appears in both tags and variables
    const productElements = screen.getAllByText('product');
    expect(productElements.length).toBeGreaterThan(0);
  });

  it('should approve template successfully', async () => {
    mockProcessApproval.mockResolvedValue({
      success: true,
      message: 'Template approved'
    });

    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Click approve button
    const approveButtons = screen.getAllByTitle('Approve');
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(mockProcessApproval).toHaveBeenCalledWith('template-1', 'approve', undefined, undefined);
      // Template should be removed from queue
      expect(screen.queryByText('Email Marketing Template')).not.toBeInTheDocument();
    });
  });

  it('should handle rejection with reason', async () => {
    mockProcessApproval.mockResolvedValue({
      success: true,
      message: 'Template rejected'
    });

    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Click reject button to open modal
    const rejectButtons = screen.getAllByTitle('Reject');
    await user.click(rejectButtons[0]);

    // Fill in rejection reason
    const reasonTextarea = screen.getByPlaceholderText(/explain why this template is being rejected/i);
    await user.type(reasonTextarea, 'Contains inappropriate content');

    // Add optional notes
    const notesTextarea = screen.getByPlaceholderText(/add any notes about this template/i);
    await user.type(notesTextarea, 'Please review guidelines');

    // Click reject button in modal
    const rejectButton = screen.getByRole('button', { name: 'Reject Template' });
    await user.click(rejectButton);

    await waitFor(() => {
      expect(mockProcessApproval).toHaveBeenCalledWith(
        'template-1',
        'reject',
        'Contains inappropriate content',
        'Please review guidelines'
      );
      // Template should be removed from queue
      expect(screen.queryByText('Email Marketing Template')).not.toBeInTheDocument();
    });
  });

  it('should require rejection reason', async () => {
    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Click reject button to open modal with rejection form
    const rejectButtons = screen.getAllByTitle('Reject');
    await user.click(rejectButtons[0]);

    // Modal should be open
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The reject button should be disabled when there's no reason
    const rejectButton = screen.getByRole('button', { name: 'Reject Template' });
    expect(rejectButton).toBeDisabled();
    
    // Type a rejection reason
    const reasonTextarea = screen.getByPlaceholderText(/explain why this template is being rejected/i);
    await user.type(reasonTextarea, 'Test rejection reason');
    
    // Now the button should be enabled
    expect(rejectButton).not.toBeDisabled();
  });

  it('should handle approval errors gracefully', async () => {
    window.alert = jest.fn();
    mockProcessApproval.mockRejectedValue(new Error('Network error'));

    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Try to approve
    const approveButtons = screen.getAllByTitle('Approve');
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to process approval');
      // Template should still be in queue
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });
  });

  it('should disable buttons while processing', async () => {
    // Make processApproval hang
    let resolveApproval: (value: unknown) => void;
    mockProcessApproval.mockImplementation(() => 
      new Promise(resolve => { resolveApproval = resolve; })
    );

    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Click approve button
    const approveButton = screen.getAllByTitle('Approve')[0];
    await user.click(approveButton);

    // Check that buttons are disabled
    expect(approveButton).toBeDisabled();
    const rejectButton = screen.getAllByTitle('Reject')[0];
    expect(rejectButton).toBeDisabled();

    // Resolve the approval
    resolveApproval({ success: true });

    await waitFor(() => {
      expect(screen.queryByText('Email Marketing Template')).not.toBeInTheDocument();
    });
  });

  it('should close modal when clicking close button', async () => {
    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('Email Marketing Template')).toBeInTheDocument();
    });

    // Open preview modal
    const previewButton = screen.getAllByTitle('Preview')[0];
    await user.click(previewButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click close button
    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should handle API errors when loading queue', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetApprovalQueue.mockRejectedValue(new Error('Failed to load'));

    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading approval queue:',
        expect.any(Error)
      );
    });

    // Should show empty state on error
    expect(screen.getByText('No templates pending approval')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('should display tags correctly', async () => {
    render(<ApprovalQueue />);

    await waitFor(() => {
      expect(screen.getByText('email')).toBeInTheDocument();
      expect(screen.getByText('marketing')).toBeInTheDocument();
      expect(screen.getByText('product')).toBeInTheDocument();
      expect(screen.getByText('announcement')).toBeInTheDocument();
    });
  });
});