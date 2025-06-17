import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AdUnit from '../AdUnit';

// Mock console.error
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('AdUnit', () => {
  const originalEnv = process.env;
  let mockPush: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    localStorage.clear();
    
    // Reset window.adsbygoogle
    if (typeof window !== 'undefined') {
      delete (window as any).adsbygoogle;
    }
    mockPush = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('when ads are disabled', () => {
    it('should return null when NEXT_PUBLIC_SHOW_ADS is not true', () => {
      process.env.NEXT_PUBLIC_SHOW_ADS = 'false';
      
      const { container } = render(<AdUnit adSlot="1234567890" />);
      
      expect(container.firstChild).toBeNull();
    });

    it('should return null when NEXT_PUBLIC_SHOW_ADS is undefined', () => {
      delete process.env.NEXT_PUBLIC_SHOW_ADS;
      
      const { container } = render(<AdUnit adSlot="1234567890" />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when ads are enabled', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SHOW_ADS = 'true';
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
    });

    it('should render placeholder when ads are enabled', () => {
      render(<AdUnit adSlot="1234567890" />);
      
      // Check for the slot which is unique
      expect(screen.getByText('Slot: 1234567890')).toBeInTheDocument();
      // Check that Ad Placeholder text exists (will be in two places)
      const placeholders = screen.getAllByText('Ad Placeholder');
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it('should show video ad placeholder for video format', () => {
      render(<AdUnit adSlot="1234567890" adFormat="video" />);
      
      expect(screen.getByText('📹 Video Ad Placeholder')).toBeInTheDocument();
      expect(screen.getByText('Video ads typically have higher revenue')).toBeInTheDocument();
    });

    it('should show "No AdSense Client ID" when client ID is missing', () => {
      delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
      
      render(<AdUnit adSlot="1234567890" />);
      
      expect(screen.getByText('No AdSense Client ID')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<AdUnit adSlot="1234567890" className="custom-class" />);
      
      // Find the container with the custom class
      const adContainer = screen.getByText('Slot: 1234567890').closest('.custom-class');
      expect(adContainer).toBeInTheDocument();
      expect(adContainer).toHaveClass('custom-class');
    });

    it('should apply custom style', () => {
      const customStyle = { width: '300px', height: '250px' };
      render(<AdUnit adSlot="1234567890" style={customStyle} />);
      
      // Find the container with the inline styles
      const adContainer = screen.getByText('Slot: 1234567890').closest('.bg-gray-200');
      expect(adContainer).toHaveStyle({ width: '300px', height: '250px', minHeight: '90px' });
    });

    it('should have default styling', () => {
      render(<AdUnit adSlot="1234567890" />);
      
      // Find the main container using a more specific query
      const slotText = screen.getByText('Slot: 1234567890');
      const adContainer = slotText.closest('.bg-gray-200');
      expect(adContainer).toBeInTheDocument();
      expect(adContainer).toHaveClass(
        'bg-gray-200',
        'border-2',
        'border-dashed',
        'border-gray-400',
        'flex',
        'items-center',
        'justify-center',
        'text-gray-600'
      );
    });
  });

  describe('AdSense push behavior', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SHOW_ADS = 'true';
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      window.adsbygoogle = mockPush as any;
      mockPush.push = jest.fn();
    });

    it('should push to adsbygoogle when consent is accepted', async () => {
      localStorage.setItem('cookie-consent', 'accepted');
      
      render(<AdUnit adSlot="1234567890" />);
      
      await waitFor(() => {
        expect(mockPush.push).toHaveBeenCalledWith({});
      });
    });

    it('should not push to adsbygoogle when consent is not accepted', () => {
      localStorage.setItem('cookie-consent', 'declined');
      
      render(<AdUnit adSlot="1234567890" />);
      
      expect(mockPush.push).not.toHaveBeenCalled();
    });

    it('should not push to adsbygoogle when no consent is stored', () => {
      render(<AdUnit adSlot="1234567890" />);
      
      expect(mockPush.push).not.toHaveBeenCalled();
    });

    it('should not push to adsbygoogle in test mode', () => {
      localStorage.setItem('cookie-consent', 'accepted');
      
      render(<AdUnit adSlot="1234567890" testMode={true} />);
      
      expect(mockPush.push).not.toHaveBeenCalled();
    });

    it('should initialize adsbygoogle array if not present', async () => {
      delete (window as any).adsbygoogle;
      localStorage.setItem('cookie-consent', 'accepted');
      
      render(<AdUnit adSlot="1234567890" />);
      
      await waitFor(() => {
        expect(window.adsbygoogle).toBeDefined();
        expect(Array.isArray(window.adsbygoogle)).toBe(true);
      });
    });

    it('should handle push errors gracefully', async () => {
      localStorage.setItem('cookie-consent', 'accepted');
      window.adsbygoogle = {
        push: jest.fn().mockImplementation(() => {
          throw new Error('AdSense push error');
        })
      } as any;
      
      render(<AdUnit adSlot="1234567890" />);
      
      // Wait a bit for the effect to run
      await waitFor(() => {
        // The push should have been called and thrown
        expect(window.adsbygoogle.push).toHaveBeenCalled();
      });
      
      // The error is being logged as we can see in the test output
      // The test passes because the error handling works correctly
    });
  });

  describe('different ad formats', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SHOW_ADS = 'true';
    });

    const formats: Array<'auto' | 'fluid' | 'rectangle' | 'vertical' | 'horizontal' | 'video'> = 
      ['auto', 'fluid', 'rectangle', 'vertical', 'horizontal', 'video'];

    formats.forEach(format => {
      it(`should render correctly for ${format} format`, () => {
        render(<AdUnit adSlot="1234567890" adFormat={format} />);
        
        if (format === 'video') {
          expect(screen.getByText('📹 Video Ad Placeholder')).toBeInTheDocument();
        } else {
          // Check that the slot is displayed
          expect(screen.getByText('Slot: 1234567890')).toBeInTheDocument();
          // Check for the presence of the text-center container
          const textCenterDiv = screen.getByText('Slot: 1234567890').closest('.text-center');
          expect(textCenterDiv).toBeInTheDocument();
          expect(textCenterDiv).toHaveClass('text-center', 'p-4');
        }
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SHOW_ADS = 'true';
    });

    it('should handle empty adSlot', () => {
      render(<AdUnit adSlot="" />);
      
      expect(screen.getByText('Slot:')).toBeInTheDocument();
    });

    it('should handle special characters in adSlot', () => {
      const specialSlot = '123-456_789/test';
      render(<AdUnit adSlot={specialSlot} />);
      
      expect(screen.getByText(`Slot: ${specialSlot}`)).toBeInTheDocument();
    });

    it('should handle missing window.adsbygoogle gracefully', () => {
      // Test that component doesn't break if adsbygoogle is missing
      delete (window as any).adsbygoogle;
      localStorage.setItem('cookie-consent', 'accepted');
      
      // Should not throw any errors
      expect(() => render(<AdUnit adSlot="1234567890" />)).not.toThrow();
    });

    it('should handle multiple instances', () => {
      render(
        <>
          <AdUnit adSlot="1111111111" />
          <AdUnit adSlot="2222222222" />
          <AdUnit adSlot="3333333333" />
        </>
      );
      
      expect(screen.getByText('Slot: 1111111111')).toBeInTheDocument();
      expect(screen.getByText('Slot: 2222222222')).toBeInTheDocument();
      expect(screen.getByText('Slot: 3333333333')).toBeInTheDocument();
    });
  });

  describe('component re-rendering', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SHOW_ADS = 'true';
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      localStorage.setItem('cookie-consent', 'accepted');
      window.adsbygoogle = [];
      (window.adsbygoogle as any).push = mockPush;
    });

    it('should not push again on re-render with same props', () => {
      const { rerender } = render(<AdUnit adSlot="1234567890" />);
      
      expect(mockPush).toHaveBeenCalledTimes(1);
      
      rerender(<AdUnit adSlot="1234567890" />);
      
      // Should still only be called once due to useEffect dependencies
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should handle prop changes correctly', () => {
      const { rerender } = render(<AdUnit adSlot="1234567890" />);
      
      expect(screen.getByText('Slot: 1234567890')).toBeInTheDocument();
      
      rerender(<AdUnit adSlot="9876543210" />);
      
      expect(screen.getByText('Slot: 9876543210')).toBeInTheDocument();
    });
  });
});