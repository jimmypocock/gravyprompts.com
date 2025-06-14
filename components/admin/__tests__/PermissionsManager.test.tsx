import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PermissionsManager from '../PermissionsManager';
import { getUsersWithPermissions, grantPermission, revokePermission } from '@/lib/api/admin';

// Mock dependencies
jest.mock('@/lib/api/admin');

const mockGetUsersWithPermissions = getUsersWithPermissions as jest.MockedFunction<typeof getUsersWithPermissions>;
const mockGrantPermission = grantPermission as jest.MockedFunction<typeof grantPermission>;
const mockRevokePermission = revokePermission as jest.MockedFunction<typeof revokePermission>;

// Mock data
const mockUsers = [
  {
    userId: 'user-123',
    permission: 'admin',
    grantedAt: '2024-01-01T10:00:00Z',
    grantedBy: 'admin-user'
  },
  {
    userId: 'user-456',
    permission: 'approval',
    grantedAt: '2024-01-02T10:00:00Z',
    grantedBy: 'admin-user'
  }
];

describe('PermissionsManager', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUsersWithPermissions.mockResolvedValue(mockUsers);
    // Mock window.alert and confirm
    window.alert = jest.fn();
    window.confirm = jest.fn(() => true);
  });

  it('should display loading state initially', () => {
    render(<PermissionsManager />);
    expect(screen.getByRole('status')).toHaveClass('animate-spin');
  });

  it('should load and display users with permissions', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
      expect(screen.getByText('user-456')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Approval Process')).toBeInTheDocument();
    });

    expect(mockGetUsersWithPermissions).toHaveBeenCalled();
  });

  it('should display empty state when no users have permissions', async () => {
    mockGetUsersWithPermissions.mockResolvedValue([]);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('No users with permissions yet')).toBeInTheDocument();
    });
  });

  it('should show/hide the add permission form', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Manage Permissions')).toBeInTheDocument();
    });

    // Form should be hidden initially
    expect(screen.queryByPlaceholderText(/123e4567-e89b-12d3/i)).not.toBeInTheDocument();

    // Click to show form
    const grantButton = screen.getByRole('button', { name: /Grant Permission/i });
    await user.click(grantButton);

    // Form should be visible
    expect(screen.getByPlaceholderText(/123e4567-e89b-12d3/i)).toBeInTheDocument();
    expect(screen.getByText('User ID (Cognito Sub)')).toBeInTheDocument();
    // Use getAllByText since 'Permission' appears in both form label and table header
    const permissionElements = screen.getAllByText('Permission');
    expect(permissionElements.length).toBeGreaterThan(0);

    // Click again to hide
    await user.click(grantButton);
    expect(screen.queryByPlaceholderText(/123e4567-e89b-12d3/i)).not.toBeInTheDocument();
  });

  it('should grant permission successfully', async () => {
    mockGrantPermission.mockResolvedValue();
    // Return updated list with new user
    const updatedUsers = [...mockUsers, {
      userId: 'new-user-789',
      permission: 'approval',
      grantedAt: '2024-01-03T10:00:00Z',
      grantedBy: 'current-admin'
    }];
    mockGetUsersWithPermissions
      .mockResolvedValueOnce(mockUsers) // Initial load
      .mockResolvedValueOnce(updatedUsers); // After grant

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole('button', { name: /Grant Permission/i }));

    // Fill form
    const userIdInput = screen.getByPlaceholderText(/123e4567-e89b-12d3/i);
    await user.type(userIdInput, 'new-user-789');

    // Submit
    const submitButton = screen.getAllByRole('button', { name: /Grant Permission/i })[1];
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockGrantPermission).toHaveBeenCalledWith('new-user-789', 'approval');
      expect(screen.getByText('new-user-789')).toBeInTheDocument();
    });

    // Form should be hidden and cleared
    expect(screen.queryByLabelText(/User ID/i)).not.toBeInTheDocument();
  });

  it('should require user ID when granting permission', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole('button', { name: /Grant Permission/i }));

    // Try to submit without user ID
    const submitButton = screen.getAllByRole('button', { name: /Grant Permission/i })[1];
    await user.click(submitButton);

    expect(window.alert).toHaveBeenCalledWith('Please enter a user ID');
    expect(mockGrantPermission).not.toHaveBeenCalled();
  });

  it('should change permission type in the form', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Open form
    await user.click(screen.getByRole('button', { name: /Grant Permission/i }));

    // Find the select element by its role since it doesn't have proper label association
    const selects = screen.getAllByRole('combobox');
    const permissionSelect = selects[0]; // There should only be one select in the form
    expect(permissionSelect).toHaveValue('approval');

    await user.selectOptions(permissionSelect, 'admin');
    expect(permissionSelect).toHaveValue('admin');
  });

  it('should revoke permission with confirmation', async () => {
    mockRevokePermission.mockResolvedValue();
    mockGetUsersWithPermissions
      .mockResolvedValueOnce(mockUsers) // Initial load
      .mockResolvedValueOnce([mockUsers[1]]); // After revoke

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Click revoke button for first user
    const revokeButtons = screen.getAllByRole('button');
    const firstRevokeButton = revokeButtons.find(btn => btn.querySelector('.lucide-trash2'));
    await user.click(firstRevokeButton!);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to revoke admin permission from this user?'
    );

    await waitFor(() => {
      expect(mockRevokePermission).toHaveBeenCalledWith('user-123', 'admin');
      expect(screen.queryByText('user-123')).not.toBeInTheDocument();
    });
  });

  it('should cancel revoke when user declines confirmation', async () => {
    window.confirm = jest.fn(() => false);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Try to revoke
    const revokeButtons = screen.getAllByRole('button');
    const firstRevokeButton = revokeButtons.find(btn => btn.querySelector('.lucide-trash2'));
    await user.click(firstRevokeButton!);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockRevokePermission).not.toHaveBeenCalled();
    expect(screen.getByText('user-123')).toBeInTheDocument();
  });

  it('should handle grant permission errors gracefully', async () => {
    mockGrantPermission.mockRejectedValue(new Error('Network error'));

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Open form and submit
    await user.click(screen.getByRole('button', { name: /Grant Permission/i }));
    await user.type(screen.getByPlaceholderText(/123e4567-e89b-12d3/i), 'new-user');
    await user.click(screen.getAllByRole('button', { name: /Grant Permission/i })[1]);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to grant permission');
    });

    // Form should still be visible with data
    expect(screen.getByPlaceholderText(/123e4567-e89b-12d3/i)).toHaveValue('new-user');
  });

  it('should handle revoke permission errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockRevokePermission.mockRejectedValue(new Error('Network error'));

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Try to revoke
    const revokeButtons = screen.getAllByRole('button');
    const firstRevokeButton = revokeButtons.find(btn => btn.querySelector('.lucide-trash2'));
    await user.click(firstRevokeButton!);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to revoke permission');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error revoking permission:',
        expect.any(Error)
      );
    });

    // User should still be in the list
    expect(screen.getByText('user-123')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('should disable buttons while processing', async () => {
    // Make grantPermission hang
    let resolveGrant: (value: unknown) => void;
    mockGrantPermission.mockImplementation(() => 
      new Promise(resolve => { resolveGrant = resolve; })
    );

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('user-123')).toBeInTheDocument();
    });

    // Open form and submit
    await user.click(screen.getByRole('button', { name: /Grant Permission/i }));
    await user.type(screen.getByPlaceholderText(/123e4567-e89b-12d3/i), 'new-user');
    
    const submitButton = screen.getAllByRole('button', { name: /Grant Permission/i })[1];
    await user.click(submitButton);

    // Button should be disabled
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });

    // Resolve the grant
    act(() => {
      resolveGrant();
    });
    mockGetUsersWithPermissions.mockResolvedValueOnce(mockUsers);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/123e4567-e89b-12d3/i)).not.toBeInTheDocument();
    });
  });

  it('should handle API errors when loading users', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockGetUsersWithPermissions.mockRejectedValue(new Error('Failed to load'));

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading users:',
        expect.any(Error)
      );
    });

    // Should show empty state on error
    expect(screen.getByText('No users with permissions yet')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('should display permission descriptions', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('Available Permissions:')).toBeInTheDocument();
      expect(screen.getByText(/Full administrative access/)).toBeInTheDocument();
      expect(screen.getByText(/Can approve\/reject templates/)).toBeInTheDocument();
    });
  });

  it('should format dates correctly', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      // Check that dates are formatted
      expect(screen.getByText('1/1/2024')).toBeInTheDocument();
      expect(screen.getByText('1/2/2024')).toBeInTheDocument();
    });
  });

  it('should display granted by information', async () => {
    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getAllByText('admin-user')).toHaveLength(2);
    });
  });

  it('should display System for users without grantedBy', async () => {
    mockGetUsersWithPermissions.mockResolvedValue([
      {
        userId: 'user-123',
        permission: 'admin',
        grantedAt: '2024-01-01T10:00:00Z',
        grantedBy: null
      }
    ]);

    render(<PermissionsManager />);

    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });
});