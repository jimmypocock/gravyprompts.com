const {
  getUserFromEvent,
  extractBearerToken,
  decodeJwtPayload,
} = require("../auth");

describe("Auth Module", () => {
  describe("extractBearerToken", () => {
    it("should extract token from Authorization header", () => {
      const headers = {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      };
      const token = extractBearerToken(headers);
      expect(token).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("should handle lowercase authorization header", () => {
      const headers = {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      };
      const token = extractBearerToken(headers);
      expect(token).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("should return null if no Bearer token", () => {
      const headers = {
        Authorization: "Basic sometoken",
      };
      const token = extractBearerToken(headers);
      expect(token).toBeNull();
    });

    it("should return null if no headers", () => {
      expect(extractBearerToken(null)).toBeNull();
      expect(extractBearerToken(undefined)).toBeNull();
      expect(extractBearerToken({})).toBeNull();
    });
  });

  describe("decodeJwtPayload", () => {
    beforeEach(() => {
      // Enable SAM Local mode for tests
      process.env.AWS_SAM_LOCAL = "true";
    });

    afterEach(() => {
      delete process.env.AWS_SAM_LOCAL;
    });

    it("should decode a valid JWT token", () => {
      // This is a real JWT with payload: { sub: "123", email: "test@example.com" }
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.dFlhwTr7SB0POzF5MZKxg7d0XjkQW0IjUb-cO_3sUOs";

      const payload = decodeJwtPayload(token);
      expect(payload).toEqual({
        sub: "123",
        email: "test@example.com",
      });
    });

    it("should return null for invalid JWT format", () => {
      const invalidToken = "not.a.jwt";
      const payload = decodeJwtPayload(invalidToken);
      expect(payload).toBeNull();
    });

    it("should return null when not in SAM Local environment", () => {
      delete process.env.AWS_SAM_LOCAL;
      const token =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.hmRXfJhjaXLKAtKjcZwXpcJDVALKUF9Z4L8NDQRJ8gE";

      const payload = decodeJwtPayload(token);
      expect(payload).toBeNull();
    });
  });

  describe("getUserFromEvent", () => {
    it("should return claims from authorizer context", async () => {
      const event = {
        requestContext: {
          authorizer: {
            claims: {
              sub: "123",
              email: "test@example.com",
              name: "Test User",
            },
          },
        },
      };

      const user = await getUserFromEvent(event);
      expect(user).toEqual({
        sub: "123",
        email: "test@example.com",
        name: "Test User",
      });
    });

    it("should decode JWT from Authorization header when no authorizer", async () => {
      process.env.AWS_SAM_LOCAL = "true";

      const event = {
        headers: {
          Authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImNvZ25pdG86dXNlcm5hbWUiOiJ0ZXN0dXNlciJ9.YH3g9kYPbzm_fBCNM5JAkKj7TKJ76qwqPbmVPrJNiHg",
        },
      };

      const user = await getUserFromEvent(event);
      expect(user).toEqual({
        sub: "123",
        email: "test@example.com",
        name: "Test User",
        email_verified: true,
        username: "testuser",
      });
    });

    it("should return null when no auth information available", async () => {
      const event = {
        headers: {},
      };

      const user = await getUserFromEvent(event);
      expect(user).toBeNull();
    });
  });
});
