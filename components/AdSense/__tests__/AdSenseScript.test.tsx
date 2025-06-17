import React from 'react';
import { render } from '@testing-library/react';
import Script from 'next/script';
import AdSenseScript from '../AdSenseScript';

// Mock next/script
jest.mock('next/script', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('AdSenseScript', () => {
  const mockScript = Script as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Mock Script component
    mockScript.mockImplementation((props) => {
      return <script data-testid="adsense-script" {...props} />;
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when AdSense client ID is not set', () => {
    it('should return null when NEXT_PUBLIC_ADSENSE_CLIENT_ID is not defined', () => {
      delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
      process.env.NODE_ENV = 'production';
      
      const { container } = render(<AdSenseScript />);
      
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });

    it('should return null when NEXT_PUBLIC_ADSENSE_CLIENT_ID is empty', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = '';
      process.env.NODE_ENV = 'production';
      
      const { container } = render(<AdSenseScript />);
      
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });
  });

  describe('when not in production', () => {
    it('should return null in development environment', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      process.env.NODE_ENV = 'development';
      
      const { container } = render(<AdSenseScript />);
      
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });

    it('should return null in test environment', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      process.env.NODE_ENV = 'test';
      
      const { container } = render(<AdSenseScript />);
      
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });
  });

  describe('when in production with client ID', () => {
    const mockClientId = 'ca-pub-1234567890';

    beforeEach(() => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = mockClientId;
      process.env.NODE_ENV = 'production';
    });

    it('should render Script component', () => {
      render(<AdSenseScript />);
      
      expect(mockScript).toHaveBeenCalledTimes(1);
    });

    it('should have correct Script props', () => {
      render(<AdSenseScript />);
      
      expect(mockScript).toHaveBeenCalledWith(
        expect.objectContaining({
          async: true,
          src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${mockClientId}`,
          crossOrigin: 'anonymous',
          strategy: 'afterInteractive',
        }),
        undefined
      );
    });

    it('should include client ID in script URL', () => {
      render(<AdSenseScript />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      expect(scriptProps.src).toContain(mockClientId);
    });

    it('should use afterInteractive loading strategy', () => {
      render(<AdSenseScript />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      expect(scriptProps.strategy).toBe('afterInteractive');
    });

    it('should set async attribute', () => {
      render(<AdSenseScript />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      expect(scriptProps.async).toBe(true);
    });

    it('should set crossOrigin to anonymous', () => {
      render(<AdSenseScript />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      expect(scriptProps.crossOrigin).toBe('anonymous');
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in client ID', () => {
      const specialClientId = 'ca-pub-123&test=456';
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = specialClientId;
      process.env.NODE_ENV = 'production';
      
      render(<AdSenseScript />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      expect(scriptProps.src).toBe(
        `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${specialClientId}`
      );
    });

    it('should handle whitespace in client ID', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = '  ca-pub-1234567890  ';
      process.env.NODE_ENV = 'production';
      
      render(<AdSenseScript />);
      
      // Component doesn't trim whitespace
      const scriptProps = mockScript.mock.calls[0][0];
      expect(scriptProps.src).toContain('  ca-pub-1234567890  ');
    });

    it('should handle undefined NODE_ENV', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      delete process.env.NODE_ENV;
      
      const { container } = render(<AdSenseScript />);
      
      // Should return null when NODE_ENV is not 'production'
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });
  });

  describe('component behavior', () => {
    it('should be a pure component', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      process.env.NODE_ENV = 'production';
      
      const { rerender } = render(<AdSenseScript />);
      
      expect(mockScript).toHaveBeenCalledTimes(1);
      
      rerender(<AdSenseScript />);
      
      expect(mockScript).toHaveBeenCalledTimes(2);
      
      // Props should be identical
      expect(mockScript.mock.calls[0][0]).toEqual(mockScript.mock.calls[1][0]);
    });

    it('should not have any additional props', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-1234567890';
      process.env.NODE_ENV = 'production';
      
      render(<AdSenseScript />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      const propKeys = Object.keys(scriptProps).sort();
      
      expect(propKeys).toEqual(['async', 'crossOrigin', 'src', 'strategy'].sort());
    });
  });
});