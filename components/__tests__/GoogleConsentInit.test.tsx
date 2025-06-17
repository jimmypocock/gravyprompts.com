import React from 'react';
import { render } from '@testing-library/react';
import Script from 'next/script';
import GoogleConsentInit from '../GoogleConsentInit';

// Mock next/script
jest.mock('next/script', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('GoogleConsentInit', () => {
  const mockScript = Script as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Script component to render its props for testing
    mockScript.mockImplementation(({ children, ...props }) => {
      return <script data-testid={props.id} {...props}>{children}</script>;
    });
  });

  describe('Script rendering', () => {
    it('should render a Script component', () => {
      render(<GoogleConsentInit />);
      
      expect(mockScript).toHaveBeenCalledTimes(1);
    });

    it('should have correct Script props', () => {
      render(<GoogleConsentInit />);
      
      const scriptCall = mockScript.mock.calls[0];
      expect(scriptCall[0]).toMatchObject({
        id: 'google-consent-init',
        strategy: 'afterInteractive',
      });
      expect(scriptCall[0].children).toBeDefined();
    });

    it('should contain gtag initialization code', () => {
      render(<GoogleConsentInit />);
      
      const scriptCall = mockScript.mock.calls[0][0];
      const scriptContent = scriptCall.children;
      
      // Check for gtag initialization
      expect(scriptContent).toContain('window.gtag = window.gtag || function()');
      expect(scriptContent).toContain('(window.gtag.q = window.gtag.q || []).push(arguments)');
    });

    it('should set default consent to denied', () => {
      render(<GoogleConsentInit />);
      
      const scriptCall = mockScript.mock.calls[0][0];
      const scriptContent = scriptCall.children;
      
      // Check for consent configuration
      expect(scriptContent).toContain("gtag('consent', 'default', {");
      expect(scriptContent).toContain("'ad_storage': 'denied'");
      expect(scriptContent).toContain("'ad_user_data': 'denied'");
      expect(scriptContent).toContain("'ad_personalization': 'denied'");
      expect(scriptContent).toContain("'analytics_storage': 'denied'");
    });
  });

  describe('Script content structure', () => {
    it('should have properly formatted JavaScript', () => {
      render(<GoogleConsentInit />);
      
      const scriptCall = mockScript.mock.calls[0][0];
      const scriptContent = scriptCall.children;
      
      // Check for proper formatting and comments
      expect(scriptContent).toContain('// Set default consent to denied (required for CMP)');
      
      // Verify the script structure
      const lines = scriptContent.trim().split('\n').map((line: string) => line.trim());
      
      // First line should be gtag initialization
      expect(lines[0]).toMatch(/^window\.gtag = window\.gtag \|\| function\(\)/);
      
      // Should have proper consent call
      expect(scriptContent).toMatch(/gtag\('consent', 'default',/);
    });

    it('should contain all required consent types', () => {
      render(<GoogleConsentInit />);
      
      const scriptCall = mockScript.mock.calls[0][0];
      const scriptContent = scriptCall.children;
      
      // All consent types should be present and denied
      const consentTypes = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];
      
      consentTypes.forEach(type => {
        const regex = new RegExp(`'${type}':\\s*'denied'`);
        expect(scriptContent).toMatch(regex);
      });
    });
  });

  describe('Component behavior', () => {
    it('should be a pure component', () => {
      const { rerender } = render(<GoogleConsentInit />);
      
      expect(mockScript).toHaveBeenCalledTimes(1);
      
      // Re-render
      rerender(<GoogleConsentInit />);
      
      // Should have been called twice (1 + 1)
      expect(mockScript).toHaveBeenCalledTimes(2);
      
      // Props should be identical
      expect(mockScript.mock.calls[0][0]).toEqual(mockScript.mock.calls[1][0]);
    });

    it('should not have any props besides id, strategy, and children', () => {
      render(<GoogleConsentInit />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      const propKeys = Object.keys(scriptProps).sort();
      
      expect(propKeys).toEqual(['children', 'id', 'strategy'].sort());
    });

    it('should use afterInteractive strategy', () => {
      render(<GoogleConsentInit />);
      
      const scriptProps = mockScript.mock.calls[0][0];
      
      // afterInteractive ensures the script runs after the page is interactive
      expect(scriptProps.strategy).toBe('afterInteractive');
    });
  });

  describe('Edge cases', () => {
    it('should not throw errors during render', () => {
      expect(() => render(<GoogleConsentInit />)).not.toThrow();
    });

    it('should render consistently', () => {
      const { container: container1 } = render(<GoogleConsentInit />);
      const { container: container2 } = render(<GoogleConsentInit />);
      
      // Both renders should produce identical results
      expect(container1.innerHTML).toBe(container2.innerHTML);
    });

    it('should handle Script component errors gracefully', () => {
      // Mock Script to throw an error
      mockScript.mockImplementation(() => {
        throw new Error('Script error');
      });
      
      // Component should throw the error (no error boundary)
      expect(() => render(<GoogleConsentInit />)).toThrow('Script error');
    });
  });

  describe('Integration considerations', () => {
    it('should initialize gtag before any gtag calls', () => {
      render(<GoogleConsentInit />);
      
      const scriptContent = mockScript.mock.calls[0][0].children;
      
      // The initialization should come before the consent call
      const gtagInitIndex = scriptContent.indexOf('window.gtag = window.gtag');
      const consentCallIndex = scriptContent.indexOf("gtag('consent'");
      
      expect(gtagInitIndex).toBeLessThan(consentCallIndex);
      expect(gtagInitIndex).toBeGreaterThanOrEqual(0);
      expect(consentCallIndex).toBeGreaterThan(0);
    });

    it('should preserve existing gtag.q array', () => {
      render(<GoogleConsentInit />);
      
      const scriptContent = mockScript.mock.calls[0][0].children;
      
      // Check that it preserves existing queue
      expect(scriptContent).toContain('window.gtag.q = window.gtag.q || []');
    });
  });
});