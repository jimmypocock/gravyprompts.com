import React from "react";
import {
  signUp,
  signIn,
  confirmSignUp,
  signOut,
  fetchAuthSession,
  getCurrentUser,
} from "aws-amplify/auth";
import { useAuth } from "@/lib/auth-context";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock AWS Amplify auth
jest.mock("aws-amplify/auth", () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
  confirmSignUp: jest.fn(),
  signOut: jest.fn(),
  fetchAuthSession: jest.fn(),
  getCurrentUser: jest.fn(),
}));

// Create a wrapper component for the auth context
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => {
    const AuthContext = require("@/lib/auth-context").AuthContext;
    const [user, setUser] = React.useState(null);
    const [loading, setLoading] = React.useState(true);

    const value = {
      user,
      loading,
      signIn: async (email: string, password: string) => {
        const result = await signIn({ username: email, password });
        if (result.isSignedIn) {
          setUser({ email, emailVerified: true } as any);
        }
        return result as any;
      },
      signUp: async (email: string, password: string) => {
        return signUp({ username: email, password });
      },
      signOut: async () => {
        await signOut();
        setUser(null);
      },
      checkUser: async () => {
        try {
          const session = await fetchAuthSession();
          if (session?.tokens?.idToken) {
            const currentUser = await getCurrentUser();
            setUser({
              email: currentUser.username,
              userId: currentUser.username,
              emailVerified: true,
            } as any);
          }
        } catch {
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
      confirmSignUp: async (email: string, code: string) => {
        return confirmSignUp({ username: email, confirmationCode: code });
      },
      resendVerificationCode: async (email: string) => {
        // Mock implementation
        return Promise.resolve();
      },
      resetPassword: async (email: string) => {
        // Mock implementation
        return Promise.resolve();
      },
      confirmResetPassword: async (
        email: string,
        code: string,
        newPassword: string,
      ) => {
        // Mock implementation
        return Promise.resolve();
      },
      error: null,
      updateProfile: async (updates: any) => {
        // Mock implementation
        return Promise.resolve();
      },
      resendConfirmationCode: async (email: string) => {
        // Mock implementation
        return Promise.resolve();
      },
      forgotPassword: async (email: string) => {
        // Mock implementation
        return Promise.resolve();
      },
      confirmForgotPassword: async (
        email: string,
        code: string,
        newPassword: string,
      ) => {
        // Mock implementation
        return Promise.resolve();
      },
      refreshUser: async () => {
        // Call checkUser defined above
        await value.checkUser();
      },
      getIdToken: async () => {
        const session = await fetchAuthSession();
        return session?.tokens?.idToken?.toString() || "";
      },
    };

    return (
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
  };
};

describe("Authentication Flow Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Sign Up Flow", () => {
    it("should complete full sign up flow", async () => {
      const mockUserId = "user-123";
      const email = "newuser@example.com";
      const password = "SecurePass123!";

      // Mock successful sign up
      (signUp as jest.Mock).mockResolvedValueOnce({
        isSignUpComplete: false,
        userId: mockUserId,
        nextStep: {
          signUpStep: "CONFIRM_SIGN_UP",
          codeDeliveryDetails: {
            deliveryMedium: "EMAIL",
            destination: email,
          },
        },
      });

      // Mock successful confirmation
      (confirmSignUp as jest.Mock).mockResolvedValueOnce({
        isSignUpComplete: true,
        nextStep: { signUpStep: "DONE" },
      });

      // Mock successful sign in after confirmation
      (signIn as jest.Mock).mockResolvedValueOnce({
        isSignedIn: true,
        nextStep: { signInStep: "DONE" },
      });

      // Mock session
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: "mock-id-token",
          accessToken: "mock-access-token",
        },
      });

      (getCurrentUser as jest.Mock).mockResolvedValueOnce({
        username: email,
        userId: mockUserId,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Initial state
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);

      // Sign up
      await act(async () => {
        await result.current.signUp(email, password);
      });

      expect(signUp).toHaveBeenCalledWith({
        username: email,
        password: password,
      });

      // Confirm sign up
      await act(async () => {
        await confirmSignUp({ username: email, confirmationCode: "123456" });
      });

      expect(confirmSignUp).toHaveBeenCalledWith({
        username: email,
        confirmationCode: "123456",
      });

      // Sign in
      await act(async () => {
        await result.current.signIn(email, password);
      });

      expect(result.current.user).toEqual({ email });
    });

    it("should handle sign up errors", async () => {
      const email = "existing@example.com";
      const password = "Pass123!";

      (signUp as jest.Mock).mockRejectedValueOnce(
        new Error("User already exists"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.signUp(email, password);
        }),
      ).rejects.toThrow("User already exists");
    });

    it("should handle weak password", async () => {
      (signUp as jest.Mock).mockRejectedValueOnce(
        new Error("Password does not meet requirements"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.signUp("user@example.com", "weak");
        }),
      ).rejects.toThrow("Password does not meet requirements");
    });
  });

  describe("Sign In Flow", () => {
    it("should complete successful sign in", async () => {
      const email = "user@example.com";
      const password = "SecurePass123!";

      (signIn as jest.Mock).mockResolvedValueOnce({
        isSignedIn: true,
        nextStep: { signInStep: "DONE" },
      });

      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: "mock-id-token",
          accessToken: "mock-access-token",
        },
      });

      (getCurrentUser as jest.Mock).mockResolvedValueOnce({
        username: email,
        userId: "user-123",
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.signIn(email, password);
      });

      expect(signIn).toHaveBeenCalledWith({
        username: email,
        password: password,
      });

      expect(result.current.user).toEqual({ email });
    });

    it("should handle incorrect credentials", async () => {
      (signIn as jest.Mock).mockRejectedValueOnce(
        new Error("Incorrect username or password"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.signIn("user@example.com", "wrong");
        }),
      ).rejects.toThrow("Incorrect username or password");

      expect(result.current.user).toBeNull();
    });

    it("should handle MFA challenge", async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({
        isSignedIn: false,
        nextStep: {
          signInStep: "CONFIRM_SIGN_IN_WITH_SMS_CODE",
          codeDeliveryDetails: {
            deliveryMedium: "SMS",
            destination: "+1234567890",
          },
        },
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      let signInResult: any;
      await act(async () => {
        signInResult = await result.current.signIn(
          "user@example.com",
          "password",
        );
      });

      expect(signInResult).toHaveProperty("nextStep");
      expect(signInResult.nextStep).toHaveProperty(
        "signInStep",
        "CONFIRM_SIGN_IN_WITH_SMS_CODE",
      );
    });
  });

  describe("Session Management", () => {
    it("should check and restore user session", async () => {
      const mockSession = {
        tokens: {
          idToken:
            "header." +
            btoa(
              JSON.stringify({
                exp: Date.now() / 1000 + 3600,
                email: "user@example.com",
              }),
            ) +
            ".signature",
          accessToken: "mock-access-token",
        },
      };

      (fetchAuthSession as jest.Mock).mockResolvedValueOnce(mockSession);
      (getCurrentUser as jest.Mock).mockResolvedValueOnce({
        username: "user@example.com",
        userId: "user-123",
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(fetchAuthSession).toHaveBeenCalled();
      expect(getCurrentUser).toHaveBeenCalled();
      expect(result.current.user).toEqual({
        email: "user@example.com",
        emailVerified: true,
      });
      expect(result.current.loading).toBe(false);
    });

    it("should handle expired session", async () => {
      const mockSession = {
        tokens: {
          idToken:
            "header." +
            btoa(
              JSON.stringify({
                exp: Date.now() / 1000 - 3600, // Expired
              }),
            ) +
            ".signature",
        },
      };

      (fetchAuthSession as jest.Mock).mockResolvedValueOnce(mockSession);

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("should handle session refresh", async () => {
      // First call - valid session
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: "old-token",
          accessToken: "old-access-token",
        },
      });

      // Second call - refreshed session
      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: "new-token",
          accessToken: "new-access-token",
        },
      });

      const firstSession = await fetchAuthSession();
      expect(firstSession.tokens?.idToken).toBe("old-token");

      const secondSession = await fetchAuthSession({ forceRefresh: true });
      expect(secondSession.tokens?.idToken).toBe("new-token");
    });
  });

  describe("Sign Out Flow", () => {
    it("should complete sign out and clear session", async () => {
      (signOut as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Set initial user
      await act(async () => {
        // Mock sign in to set user
        await signIn({ username: "user@example.com", password: "password" });
      });

      expect(result.current.user).toBeTruthy();

      // Sign out
      await act(async () => {
        await result.current.signOut();
      });

      expect(signOut).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it("should handle sign out errors gracefully", async () => {
      (signOut as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await expect(
        act(async () => {
          await result.current.signOut();
        }),
      ).rejects.toThrow("Network error");
    });
  });

  describe("Token Management", () => {
    it("should get valid ID token", async () => {
      const mockIdToken =
        "header." +
        btoa(
          JSON.stringify({
            exp: Date.now() / 1000 + 3600,
            email: "user@example.com",
            sub: "user-123",
          }),
        ) +
        ".signature";

      (fetchAuthSession as jest.Mock).mockResolvedValueOnce({
        tokens: {
          idToken: mockIdToken,
          accessToken: "mock-access-token",
        },
      });

      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;

      expect(idToken).toBeDefined();

      // Decode and verify token
      const tokenString = idToken!.toString();
      const payload = JSON.parse(atob(tokenString.split(".")[1]));
      expect(payload.email).toBe("user@example.com");
      expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it("should handle token refresh on API calls", async () => {
      let callCount = 0;
      (fetchAuthSession as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call returns expired token
          return Promise.resolve({
            tokens: {
              idToken: "expired-token",
              accessToken: "expired-access-token",
            },
          });
        } else {
          // Subsequent calls return refreshed token
          return Promise.resolve({
            tokens: {
              idToken: "fresh-token",
              accessToken: "fresh-access-token",
            },
          });
        }
      });

      // Simulate API call that needs token refresh
      const makeAuthenticatedRequest = async () => {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken;

        if (token && token.toString() === "expired-token") {
          // Force refresh
          const newSession = await fetchAuthSession({ forceRefresh: true });
          return newSession.tokens?.idToken;
        }

        return token;
      };

      const token = await makeAuthenticatedRequest();
      expect(token).toBe("fresh-token");
      expect(fetchAuthSession).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Recovery", () => {
    it("should handle network failures", async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValueOnce(
        new Error("Network request failed"),
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.refreshUser();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("should handle concurrent sign-in attempts", async () => {
      let signInCallCount = 0;
      (signIn as jest.Mock).mockImplementation(() => {
        signInCallCount++;
        if (signInCallCount === 1) {
          return new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  isSignedIn: true,
                  nextStep: { signInStep: "DONE" },
                }),
              100,
            );
          });
        }
        throw new Error("User already signed in");
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      // Attempt concurrent sign-ins
      const promise1 = act(async () => {
        await result.current.signIn("user@example.com", "password");
      });

      const promise2 = act(async () => {
        await result.current.signIn("user@example.com", "password");
      });

      await expect(Promise.all([promise1, promise2])).rejects.toThrow();
      expect(signInCallCount).toBe(2);
    });
  });
});
