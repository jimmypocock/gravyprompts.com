import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { getApprovalHistory } from '@/lib/api/admin';
import { formatDistanceToNow } from 'date-fns';
import ApprovalHistory from '../ApprovalHistory';

// Mock dependencies
jest.mock('@/lib/api/admin', () => ({
  getApprovalHistory: jest.fn(),
}));

jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(),
}));

// Note: console.error is already handled by jest.setup.js

describe('ApprovalHistory', () => {
  const mockHistoryData = [
    {
      historyId: 'history-1',
      templateId: 'template-123-abc-def',
      templateTitle: 'Email Template',
      templateAuthor: 'author-123-user-id',
      action: 'approve',
      reviewerId: 'reviewer-1',
      reviewerEmail: 'reviewer1@example.com',
      reason: null,
      notes: 'Looks good',
      timestamp: '2024-01-15T10:00:00Z',
    },
    {
      historyId: 'history-2',
      templateId: 'template-456-ghi-jkl',
      templateTitle: 'Marketing Template',
      templateAuthor: 'author-456-user-id',
      action: 'reject',
      reviewerId: 'reviewer-2',
      reviewerEmail: 'reviewer2@example.com',
      reason: 'Inappropriate content',
      notes: 'Contains spam',
      timestamp: '2024-01-14T15:30:00Z',
    },
    {
      historyId: 'history-3',
      templateId: 'template-789-mno-pqr',
      templateTitle: 'Newsletter Template',
      templateAuthor: 'author-789-user-id',
      action: 'approve',
      reviewerId: 'reviewer-1',
      reviewerEmail: 'reviewer1@example.com',
      reason: null,
      notes: null,
      timestamp: '2024-01-13T09:15:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (formatDistanceToNow as jest.Mock).mockImplementation((date) => {
      const dateStr = date instanceof Date ? date.toISOString() : date.toString();
      
      if (dateStr.includes('2024-01-15T10:00:00')) return '2 hours';
      if (dateStr.includes('2024-01-14T15:30:00')) return '20 hours';
      if (dateStr.includes('2024-01-13T09:15:00')) return '2 days';
      
      return 'some time';
    });
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner initially', async () => {
      (getApprovalHistory as jest.Mock).mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      render(<ApprovalHistory />);

      const spinnerContainer = document.querySelector('.animate-spin');
      expect(spinnerContainer).toBeInTheDocument();
      expect(spinnerContainer).toHaveClass('animate-spin', 'rounded-full', 'h-8', 'w-8', 'border-b-2', 'border-primary');
    });
  });

  describe('data loading', () => {
    it('should load and display approval history', async () => {
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: mockHistoryData,
      });

      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Email Template')).toBeInTheDocument();
        expect(screen.getByText('Marketing Template')).toBeInTheDocument();
        expect(screen.getByText('Newsletter Template')).toBeInTheDocument();
      });

      expect(getApprovalHistory).toHaveBeenCalledWith({ limit: 50 });
    });

    it('should handle API errors gracefully', async () => {
      (getApprovalHistory as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<ApprovalHistory />);

      await waitFor(() => {
        // Should not show loading spinner after error
        expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
      });

      // Error is logged by the component
    });

    it('should display empty state when no history', async () => {
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: [],
      });

      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('No history found')).toBeInTheDocument();
      });
    });
  });

  describe('filtering functionality', () => {
    beforeEach(async () => {
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: mockHistoryData,
      });
    });

    it('should show all items by default', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Email Template')).toBeInTheDocument();
        expect(screen.getByText('Marketing Template')).toBeInTheDocument();
        expect(screen.getByText('Newsletter Template')).toBeInTheDocument();
      });

      // Check that "All" button is active
      const allButton = screen.getByRole('button', { name: 'All' });
      expect(allButton).toHaveClass('bg-primary', 'text-white');
    });

    it('should filter approved items', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Email Template')).toBeInTheDocument();
      });

      const approvedButton = screen.getByRole('button', { name: 'Approved' });
      fireEvent.click(approvedButton);

      expect(screen.getByText('Email Template')).toBeInTheDocument();
      expect(screen.queryByText('Marketing Template')).not.toBeInTheDocument();
      expect(screen.getByText('Newsletter Template')).toBeInTheDocument();

      expect(approvedButton).toHaveClass('bg-green-600', 'text-white');
    });

    it('should filter rejected items', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Marketing Template')).toBeInTheDocument();
      });

      const rejectedButton = screen.getByRole('button', { name: 'Rejected' });
      fireEvent.click(rejectedButton);

      expect(screen.queryByText('Email Template')).not.toBeInTheDocument();
      expect(screen.getByText('Marketing Template')).toBeInTheDocument();
      expect(screen.queryByText('Newsletter Template')).not.toBeInTheDocument();

      expect(rejectedButton).toHaveClass('bg-red-600', 'text-white');
    });

    it('should switch between filters correctly', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Email Template')).toBeInTheDocument();
      });

      // Click Approved
      fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
      expect(screen.queryByText('Marketing Template')).not.toBeInTheDocument();

      // Click Rejected
      fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));
      expect(screen.getByText('Marketing Template')).toBeInTheDocument();
      expect(screen.queryByText('Email Template')).not.toBeInTheDocument();

      // Click All
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(screen.getByText('Email Template')).toBeInTheDocument();
      expect(screen.getByText('Marketing Template')).toBeInTheDocument();
    });
  });

  describe('data display', () => {
    beforeEach(async () => {
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: mockHistoryData,
      });
    });

    it('should display template information correctly', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        // Template titles
        expect(screen.getByText('Email Template')).toBeInTheDocument();
        
        // Template IDs (truncated) - there should be 3 of them
        const templateIds = screen.getAllByText('ID: template...');
        expect(templateIds).toHaveLength(3);
        
        // Author IDs (truncated)
        expect(screen.getByText('author-1...')).toBeInTheDocument();
      });
    });

    it('should display action status with icons', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        // Get approved status elements (not the filter button)
        const approvedStatusElements = document.querySelectorAll('span.text-green-600');
        expect(approvedStatusElements).toHaveLength(2);
        
        approvedStatusElements.forEach(el => {
          expect(el.textContent).toContain('Approved');
        });

        const rejectedStatusElement = document.querySelector('span.text-red-600');
        expect(rejectedStatusElement).toBeInTheDocument();
        expect(rejectedStatusElement?.textContent).toContain('Rejected');
      });
    });

    it('should display reviewer information', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        const reviewer1Elements = screen.getAllByText('reviewer1@example.com');
        expect(reviewer1Elements.length).toBeGreaterThan(0);
        expect(screen.getByText('reviewer2@example.com')).toBeInTheDocument();
      });
    });

    it('should display reason and notes when available', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        // Item with both reason and notes
        expect(screen.getByText('Reason: Inappropriate content')).toBeInTheDocument();
        expect(screen.getByText('Notes: Contains spam')).toBeInTheDocument();
        
        // Item with only notes
        expect(screen.getByText('Notes: Looks good')).toBeInTheDocument();
        
        // Item with neither (shows dash)
        const dashElements = screen.getAllByText('-');
        expect(dashElements.length).toBeGreaterThan(0);
      });
    });

    it('should display timestamps with relative time', async () => {
      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('2 hours ago')).toBeInTheDocument();
        expect(screen.getByText('20 hours ago')).toBeInTheDocument();
        expect(screen.getByText('2 days ago')).toBeInTheDocument();
      });

      // Verify formatDistanceToNow was called with correct dates
      expect(formatDistanceToNow).toHaveBeenCalledWith(new Date('2024-01-15T10:00:00Z'));
      expect(formatDistanceToNow).toHaveBeenCalledWith(new Date('2024-01-14T15:30:00Z'));
      expect(formatDistanceToNow).toHaveBeenCalledWith(new Date('2024-01-13T09:15:00Z'));
    });
  });

  describe('table structure', () => {
    it('should render table with correct headers', async () => {
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: mockHistoryData,
      });

      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Template')).toBeInTheDocument();
        expect(screen.getByText('Author')).toBeInTheDocument();
        expect(screen.getByText('Action')).toBeInTheDocument();
        expect(screen.getByText('Reviewer')).toBeInTheDocument();
        expect(screen.getByText('Reason/Notes')).toBeInTheDocument();
        expect(screen.getByText('When')).toBeInTheDocument();
      });
    });

    it('should render table rows for each history item', async () => {
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: mockHistoryData,
      });

      render(<ApprovalHistory />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Header row + 3 data rows
        expect(rows).toHaveLength(4);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle missing optional fields', async () => {
      const historyWithMissingFields = [
        {
          historyId: 'history-4',
          templateId: 'template-999',
          templateTitle: 'Test Template',
          templateAuthor: 'author-999',
          action: 'approve',
          reviewerId: 'reviewer-3',
          reviewerEmail: 'reviewer3@example.com',
          reason: null,
          notes: null,
          timestamp: '2024-01-12T08:00:00Z',
        },
      ];

      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: historyWithMissingFields,
      });

      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Test Template')).toBeInTheDocument();
        expect(screen.getByText('-')).toBeInTheDocument(); // No reason/notes
      });
    });

    it('should handle empty filter results', async () => {
      const onlyApprovedHistory = mockHistoryData.filter(item => item.action === 'approve');
      
      (getApprovalHistory as jest.Mock).mockResolvedValue({
        history: onlyApprovedHistory,
      });

      render(<ApprovalHistory />);

      await waitFor(() => {
        expect(screen.getByText('Email Template')).toBeInTheDocument();
      });

      // Switch to rejected filter
      fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));

      expect(screen.getByText('No history found')).toBeInTheDocument();
    });
  });
});