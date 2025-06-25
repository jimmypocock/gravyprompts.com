import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";

// Create a mock Request class if it doesn't exist in the test environment
if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor() {
      // Basic mock implementation
    }
  } as any;
}

// Mock NextResponse methods
jest.mock("next/server", () => ({
  NextResponse: {
    next: jest.fn(() => ({ type: "next" })),
    redirect: jest.fn((url: URL, status?: number) => ({ 
      type: "redirect", 
      url: url.toString(), 
      status 
    })),
  },
  NextRequest: class MockNextRequest {
    url: string;
    headers: Headers;
    cookies: any;
    
    constructor(input: string | URL) {
      this.url = input.toString();
      this.headers = new Map() as any;
      this.cookies = {
        get: () => undefined,
        getAll: () => [],
      };
    }
  },
}));

describe("Middleware", () => {

  const createRequest = (url: string, options: { host?: string; cookies?: Record<string, string> } = {}) => {
    const parsedUrl = new URL(url, "http://localhost");
    const request = {
      url,
      nextUrl: {
        ...parsedUrl,
        pathname: parsedUrl.pathname,
        search: parsedUrl.search,
        clone: () => new URL(parsedUrl.toString()),
      },
      headers: {
        get: (name: string) => name === "host" ? (options.host || parsedUrl.host) : null,
      },
      cookies: {
        get: (name: string) => options.cookies?.[name] ? { name, value: options.cookies[name] } : undefined,
        getAll: () => Object.entries(options.cookies || {}).map(([name, value]) => ({ name, value })),
      },
    } as unknown as NextRequest;

    return request;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Domain Redirects", () => {
    it("should redirect Amplify URLs to www.gravyprompts.com", () => {
      const request = createRequest("http://main.d123abc.amplifyapp.com/test", {
        host: "main.d123abc.amplifyapp.com",
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "www.gravyprompts.com",
          protocol: "https:",
          pathname: "/test",
        }),
        301
      );
    });

    it("should redirect gravyprompts.com to www.gravyprompts.com", () => {
      const request = createRequest("http://gravyprompts.com/profile", {
        host: "gravyprompts.com",
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "www.gravyprompts.com",
          pathname: "/profile",
        }),
        301
      );
    });

    it("should not redirect www.gravyprompts.com", () => {
      const request = createRequest("http://www.gravyprompts.com/test", {
        host: "www.gravyprompts.com",
      });

      middleware(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe("Protected Routes", () => {
    it("should redirect to login when accessing /profile without auth", () => {
      const request = createRequest("http://localhost/profile", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/login",
          search: "?redirect=%2Fprofile",
        })
      );
    });

    it("should redirect to login when accessing /admin without auth", () => {
      const request = createRequest("http://localhost/admin", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/login",
          search: "?redirect=%2Fadmin",
        })
      );
    });

    it("should redirect to login when accessing /my-prompts without auth", () => {
      const request = createRequest("http://localhost/my-prompts", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/login",
          search: "?redirect=%2Fmy-prompts",
        })
      );
    });

    it("should allow access to protected routes with auth cookies", () => {
      const request = createRequest("http://localhost/profile", {
        cookies: {
          "CognitoIdentityServiceProvider.abc123.idToken": "token123",
        },
      });

      middleware(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it("should preserve query parameters in redirect URL", () => {
      const request = createRequest("http://localhost/profile?tab=settings", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/login",
          search: "?redirect=%2Fprofile",
        })
      );
    });
  });

  describe("Public Routes", () => {
    it("should allow access to home page without auth", () => {
      const request = createRequest("http://localhost/", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it("should allow access to login page without auth", () => {
      const request = createRequest("http://localhost/login", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it("should allow access to signup page without auth", () => {
      const request = createRequest("http://localhost/signup", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).not.toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  describe("Nested Protected Routes", () => {
    it("should protect nested admin routes", () => {
      const request = createRequest("http://localhost/admin/permissions", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/login",
          search: "?redirect=%2Fadmin%2Fpermissions",
        })
      );
    });

    it("should protect nested profile routes", () => {
      const request = createRequest("http://localhost/profile/settings", {
        cookies: {},
      });

      middleware(request);

      expect(NextResponse.redirect).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/login",
          search: "?redirect=%2Fprofile%2Fsettings",
        })
      );
    });
  });
});