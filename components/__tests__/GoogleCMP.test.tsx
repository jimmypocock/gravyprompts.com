import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GoogleCMP from '../GoogleCMP';

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('GoogleCMP', () => {
  let mockGtag: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Reset window.gtag
    mockGtag = jest.fn();
    delete (window as any).gtag;
    window.gtag = mockGtag as any;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('initial render', () => {
    it('should initialize gtag if not present', () => {
      delete (window as any).gtag;
      
      render(<GoogleCMP />);
      
      expect(window.gtag).toBeDefined();
      expect(typeof window.gtag).toBe('function');
    });

    it('should set default consent to denied', () => {
      render(<GoogleCMP />);
      
      expect(mockGtag).toHaveBeenCalledWith('consent', 'default', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'denied'
      });
    });

    it('should show banner when no consent is stored', () => {
      render(<GoogleCMP />);
      
      expect(screen.getByText('We value your privacy')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Manage Options' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Consent' })).toBeInTheDocument();
    });

    it('should not show banner when consent is already stored', () => {
      const storedConsent = {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      };
      localStorage.setItem('google-cmp-consent', JSON.stringify(storedConsent));
      
      render(<GoogleCMP />);
      
      expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
    });

    it('should update consent based on stored preference', () => {
      const storedConsent = {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'denied',
        'analytics_storage': 'granted'
      };
      localStorage.setItem('google-cmp-consent', JSON.stringify(storedConsent));
      
      render(<GoogleCMP />);
      
      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', storedConsent);
    });
  });

  describe('consent banner interactions', () => {
    it('should handle accept all button click', () => {
      render(<GoogleCMP />);
      
      const consentButton = screen.getByRole('button', { name: 'Consent' });
      fireEvent.click(consentButton);
      
      // Check gtag update was called
      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
      
      // Check localStorage was updated
      const storedConsent = localStorage.getItem('google-cmp-consent');
      expect(JSON.parse(storedConsent!)).toEqual({
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
      expect(localStorage.getItem('cookie-consent')).toBe('accepted');
      
      // Check page reload was triggered
      expect(mockReload).toHaveBeenCalled();
    });

    it('should show manage options modal when manage button is clicked', () => {
      render(<GoogleCMP />);
      
      const manageButton = screen.getByRole('button', { name: 'Manage Options' });
      fireEvent.click(manageButton);
      
      expect(screen.getByText('Privacy Preferences')).toBeInTheDocument();
      expect(screen.getByText('Advertising')).toBeInTheDocument();
      expect(screen.getByText('Ad Personalization')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });

    it('should hide banner after consent is given', async () => {
      render(<GoogleCMP />);
      
      expect(screen.getByText('We value your privacy')).toBeInTheDocument();
      
      const consentButton = screen.getByRole('button', { name: 'Consent' });
      fireEvent.click(consentButton);
      
      await waitFor(() => {
        expect(screen.queryByText('We value your privacy')).not.toBeInTheDocument();
      });
    });

    it('should render privacy policy link', () => {
      render(<GoogleCMP />);
      
      const privacyLink = screen.getByText('Privacy Policy');
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink.closest('a')).toHaveAttribute('href', '/privacy');
    });
  });

  describe('manage options modal', () => {
    beforeEach(() => {
      render(<GoogleCMP />);
      const manageButton = screen.getByRole('button', { name: 'Manage Options' });
      fireEvent.click(manageButton);
    });

    it('should show all consent options unchecked by default', () => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);
      
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('should close modal when close button is clicked', async () => {
      const closeButton = screen.getByRole('button', { name: '' });
      const svgPath = closeButton.querySelector('path[d="M6 18L18 6M6 6l12 12"]');
      expect(svgPath).toBeInTheDocument();
      
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Privacy Preferences')).not.toBeInTheDocument();
      });
    });

    it('should close modal when cancel button is clicked', async () => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Privacy Preferences')).not.toBeInTheDocument();
      });
    });

    it('should save custom preferences when save button is clicked', () => {
      // Check analytics only
      const analyticsCheckbox = screen.getByRole('checkbox', { name: /Analytics/i });
      fireEvent.click(analyticsCheckbox);
      
      const saveButton = screen.getByRole('button', { name: 'Save Preferences' });
      fireEvent.click(saveButton);
      
      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'granted'
      });
      
      const storedConsent = localStorage.getItem('google-cmp-consent');
      expect(JSON.parse(storedConsent!)).toEqual({
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'granted'
      });
      
      // Should not reload if ads not granted
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('should reload page when ads are granted', () => {
      const advertisingCheckbox = screen.getByRole('checkbox', { name: /Advertising/i });
      fireEvent.click(advertisingCheckbox);
      
      const saveButton = screen.getByRole('button', { name: 'Save Preferences' });
      fireEvent.click(saveButton);
      
      expect(mockReload).toHaveBeenCalled();
    });

    it('should handle reject all button', () => {
      const rejectAllButton = screen.getByRole('button', { name: 'Reject All' });
      fireEvent.click(rejectAllButton);
      
      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'denied'
      });
      
      expect(localStorage.getItem('cookie-consent')).toBe('declined');
    });

    it('should toggle checkboxes correctly', () => {
      const checkboxes = screen.getAllByRole('checkbox');
      const [advertising, adPersonalization, analytics] = checkboxes;
      
      // Toggle each checkbox
      fireEvent.click(advertising);
      expect(advertising).toBeChecked();
      
      fireEvent.click(adPersonalization);
      expect(adPersonalization).toBeChecked();
      
      fireEvent.click(analytics);
      expect(analytics).toBeChecked();
      
      // Toggle off
      fireEvent.click(advertising);
      expect(advertising).not.toBeChecked();
    });

    it('should link ad_user_data to ad_storage', () => {
      const advertisingCheckbox = screen.getByRole('checkbox', { name: /Advertising/i });
      fireEvent.click(advertisingCheckbox);
      
      const saveButton = screen.getByRole('button', { name: 'Save Preferences' });
      fireEvent.click(saveButton);
      
      const updateCall = mockGtag.mock.calls.find(
        call => call[0] === 'consent' && call[1] === 'update'
      );
      
      expect(updateCall[2]['ad_storage']).toBe('granted');
      expect(updateCall[2]['ad_user_data']).toBe('granted');
    });
  });

  describe('edge cases', () => {
    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('google-cmp-consent', 'invalid-json');
      
      // Component will throw when parsing invalid JSON
      expect(() => render(<GoogleCMP />)).toThrow('Unexpected token');
    });

    it('should preserve existing gtag.q array if present', () => {
      const existingQ = ['existing', 'data'];
      window.gtag = Object.assign(jest.fn(), { q: existingQ });
      
      render(<GoogleCMP />);
      
      expect(window.gtag.q).toBe(existingQ);
    });

    it('should handle multiple consent updates', () => {
      render(<GoogleCMP />);
      
      // First accept all
      const consentButton = screen.getByRole('button', { name: 'Consent' });
      fireEvent.click(consentButton);
      
      // Clear previous calls
      mockGtag.mockClear();
      mockReload.mockClear();
      
      // Render again with stored consent
      const { unmount } = render(<GoogleCMP />);
      unmount();
      
      // Should update with stored values
      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
    });
  });

  describe('UI styling and accessibility', () => {
    it('should have proper styling for consent banner', () => {
      render(<GoogleCMP />);
      
      // Find the banner container which has the fixed positioning
      const privacyText = screen.getByText('We value your privacy');
      let banner = privacyText.closest('div');
      while (banner && !banner.classList.contains('fixed')) {
        banner = banner.parentElement as HTMLDivElement;
      }
      expect(banner).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0', 'bg-white', 'border-t', 'border-gray-200', 'shadow-lg', 'z-50');
    });

    it('should have proper modal backdrop', () => {
      render(<GoogleCMP />);
      
      const manageButton = screen.getByRole('button', { name: 'Manage Options' });
      fireEvent.click(manageButton);
      
      // Find the backdrop which is the fixed overlay
      const modalContent = screen.getByText('Privacy Preferences').closest('.bg-white');
      const backdrop = modalContent?.parentElement;
      expect(backdrop).toHaveClass('fixed', 'inset-0', 'bg-black', 'bg-opacity-50', 'flex', 'items-center', 'justify-center', 'z-50');
    });

    it('should support keyboard navigation in modal', () => {
      render(<GoogleCMP />);
      
      const manageButton = screen.getByRole('button', { name: 'Manage Options' });
      fireEvent.click(manageButton);
      
      const checkboxes = screen.getAllByRole('checkbox');
      const buttons = screen.getAllByRole('button');
      
      // All interactive elements should be focusable
      [...checkboxes, ...buttons].forEach(element => {
        expect(element.tabIndex).toBeGreaterThanOrEqual(-1);
      });
    });
  });
});