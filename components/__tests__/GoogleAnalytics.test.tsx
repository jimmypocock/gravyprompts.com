import React from 'react';
import { render } from '@testing-library/react';
import Script from 'next/script';
import GoogleAnalytics from '../GoogleAnalytics';

// Mock next/script
jest.mock('next/script', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('GoogleAnalytics', () => {
  const mockScript = Script as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    // Mock Script component to render its props for testing
    mockScript.mockImplementation(({ children, ...props }) => {
      if (props.id) {
        return <script data-testid={props.id} {...props}>{children}</script>;
      }
      return <script data-testid="gtag-script" {...props} />;
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when GA_MEASUREMENT_ID is not set', () => {
    it('should return null when GA_MEASUREMENT_ID is not defined', () => {
      delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      
      const { container } = render(<GoogleAnalytics />);
      
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });

    it('should return null when GA_MEASUREMENT_ID is empty string', () => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = '';
      
      const { container } = render(<GoogleAnalytics />);
      
      expect(container.firstChild).toBeNull();
      expect(mockScript).not.toHaveBeenCalled();
    });
  });

  describe('when GA_MEASUREMENT_ID is set', () => {
    const mockGAId = 'G-TESTID12345';

    beforeEach(() => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = mockGAId;
    });

    it('should render two Script components', () => {
      render(<GoogleAnalytics />);
      
      expect(mockScript).toHaveBeenCalledTimes(2);
    });

    it('should render gtag.js script with correct src', () => {
      render(<GoogleAnalytics />);
      
      // First call should be the gtag.js script
      expect(mockScript).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          src: `https://www.googletagmanager.com/gtag/js?id=${mockGAId}`,
          strategy: 'afterInteractive',
        }),
        undefined
      );
    });

    it('should render inline script with google-analytics id', () => {
      render(<GoogleAnalytics />);
      
      const inlineScriptCall = mockScript.mock.calls.find(
        call => call[0].id === 'google-analytics'
      );
      
      expect(inlineScriptCall).toBeDefined();
      expect(inlineScriptCall[0]).toMatchObject({
        id: 'google-analytics',
        strategy: 'afterInteractive',
      });
    });

    it('should include correct gtag configuration in inline script', () => {
      render(<GoogleAnalytics />);
      
      const inlineScriptCall = mockScript.mock.calls.find(
        call => call[0].id === 'google-analytics'
      );
      
      const scriptContent = inlineScriptCall[0].children;
      
      // Check for dataLayer initialization
      expect(scriptContent).toContain('window.dataLayer = window.dataLayer || [];');
      expect(scriptContent).toContain('function gtag(){dataLayer.push(arguments);}');
      
      // Check for consent configuration
      expect(scriptContent).toContain("gtag('consent', 'default', {");
      expect(scriptContent).toContain("'ad_storage': 'denied'");
      expect(scriptContent).toContain("'ad_user_data': 'denied'");
      expect(scriptContent).toContain("'ad_personalization': 'denied'");
      expect(scriptContent).toContain("'analytics_storage': 'denied'");
      
      // Check for gtag configuration
      expect(scriptContent).toContain("gtag('js', new Date());");
      expect(scriptContent).toContain(`gtag('config', '${mockGAId}', {`);
      expect(scriptContent).toContain('page_path: window.location.pathname,');
    });

    it('should set all consent types to denied by default', () => {
      render(<GoogleAnalytics />);
      
      const inlineScriptCall = mockScript.mock.calls.find(
        call => call[0].id === 'google-analytics'
      );
      
      const scriptContent = inlineScriptCall[0].children;
      
      // Verify all consent types are denied
      const consentTypes = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];
      consentTypes.forEach(type => {
        expect(scriptContent).toContain(`'${type}': 'denied'`);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in GA_MEASUREMENT_ID', () => {
      const specialId = 'G-TEST"ID\'123';
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = specialId;
      
      render(<GoogleAnalytics />);
      
      // Should still render scripts
      expect(mockScript).toHaveBeenCalledTimes(2);
      
      // Check that the ID is used as-is in the src URL
      expect(mockScript).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          src: `https://www.googletagmanager.com/gtag/js?id=${specialId}`,
        }),
        undefined
      );
    });

    it('should handle whitespace in GA_MEASUREMENT_ID', () => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = '  G-TESTID12345  ';
      
      render(<GoogleAnalytics />);
      
      // Should still render scripts (component doesn't trim the ID)
      expect(mockScript).toHaveBeenCalledTimes(2);
    });
  });

  describe('Script component props', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TESTID12345';
    });

    it('should use afterInteractive strategy for both scripts', () => {
      render(<GoogleAnalytics />);
      
      const scriptCalls = mockScript.mock.calls;
      
      expect(scriptCalls[0][0].strategy).toBe('afterInteractive');
      expect(scriptCalls[1][0].strategy).toBe('afterInteractive');
    });

    it('should not include any additional props besides required ones', () => {
      render(<GoogleAnalytics />);
      
      const [gtagScriptProps] = mockScript.mock.calls[0];
      const [inlineScriptProps] = mockScript.mock.calls[1];
      
      // First script should only have src and strategy
      expect(Object.keys(gtagScriptProps).sort()).toEqual(['src', 'strategy'].sort());
      
      // Second script should only have id, strategy, and children
      expect(Object.keys(inlineScriptProps).sort()).toEqual(['id', 'strategy', 'children'].sort());
    });
  });

  describe('component behavior', () => {
    it('should be a pure component with no side effects during render', () => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TESTID12345';
      
      // Should not throw or cause side effects
      expect(() => render(<GoogleAnalytics />)).not.toThrow();
    });

    it('should re-render correctly when props change', () => {
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TESTID12345';
      
      const { rerender } = render(<GoogleAnalytics />);
      
      expect(mockScript).toHaveBeenCalledTimes(2);
      
      // Re-render with same environment
      rerender(<GoogleAnalytics />);
      
      // Should have been called 4 times total (2 + 2)
      expect(mockScript).toHaveBeenCalledTimes(4);
    });
  });
});