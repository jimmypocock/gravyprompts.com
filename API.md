# GravyPrompts Template API Documentation

## Base URLs

- **Local Development**: `http://localhost:7429`
- **Production**: `https://api.gravyprompts.com` (or your deployed API Gateway URL)

## Authentication

All endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

For local development, use: `Authorization: Bearer local-dev-token`

## Endpoints

### 1. Create Template

**POST** `/templates`

Create a new template.

**Request Body:**
```json
{
  "title": "Template Title",
  "content": "<p>Hello [[name]]!</p>",
  "visibility": "public" | "private",
  "tags": ["tag1", "tag2"],
  "viewers": ["email@example.com"] // optional
}
```

**Response:**
```json
{
  "message": "Template created successfully",
  "template": {
    "templateId": "uuid",
    "title": "Template Title",
    "visibility": "public",
    "variables": ["name"],
    "tags": ["tag1", "tag2"],
    "createdAt": "2024-01-01T00:00:00Z",
    "moderationStatus": "pending" | "approved" | "not_required"
  }
}
```

### 2. Get Template

**GET** `/templates/{templateId}`

Retrieve a specific template.

**Query Parameters:**
- `token` (optional) - Share token for accessing private templates

**Response:**
```json
{
  "templateId": "uuid",
  "title": "Template Title",
  "content": "<p>Hello [[name]]!</p>",
  "variables": ["name"],
  "visibility": "public",
  "tags": ["tag1", "tag2"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "viewCount": 100,
  "useCount": 50,
  "authorEmail": "author@example.com",
  "isOwner": true
}
```

### 3. List Templates

**GET** `/templates`

List templates based on filters.

**Query Parameters:**
- `filter` - "public" | "mine" | "all" (default: "public")
- `tag` - Filter by tag
- `search` - Search in title and tags
- `limit` - Max items to return (default: 20, max: 100)
- `nextToken` - Pagination token
- `sortBy` - "createdAt" | "viewCount" | "useCount" (default: "createdAt")
- `sortOrder` - "asc" | "desc" (default: "desc")

**Response:**
```json
{
  "items": [
    {
      "templateId": "uuid",
      "title": "Template Title",
      "tags": ["tag1", "tag2"],
      "visibility": "public",
      "authorEmail": "author@example.com",
      "createdAt": "2024-01-01T00:00:00Z",
      "viewCount": 100,
      "useCount": 50,
      "variableCount": 3,
      "isOwner": false
    }
  ],
  "nextToken": "pagination-token",
  "count": 10
}
```

### 4. Update Template

**PUT** `/templates/{templateId}`

Update an existing template (owner only).

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "<p>Updated content</p>",
  "visibility": "private",
  "tags": ["updated", "tags"]
}
```

**Response:**
```json
{
  "message": "Template updated successfully",
  "template": { /* updated template object */ }
}
```

### 5. Delete Template

**DELETE** `/templates/{templateId}`

Delete a template (owner only).

**Response:**
```json
{
  "message": "Template deleted successfully"
}
```

### 6. Share Template

**POST** `/templates/{templateId}/share`

Manage template sharing (owner only).

**Request Body:**
```json
{
  "action": "add" | "remove" | "generate_link",
  "emails": ["email1@example.com", "email2@example.com"], // for add/remove
  "expiresIn": 7 // days, for generate_link
}
```

**Response:**
```json
{
  "message": "Share link generated",
  "shareToken": "token",
  "shareUrl": "https://gravyprompts.com/templates/uuid?token=token",
  "expiresAt": "2024-01-08T00:00:00Z"
}
```

### 7. Populate Template

**POST** `/templates/{templateId}/populate`

Populate template variables and track usage.

**Query Parameters:**
- `token` (optional) - Share token for accessing private templates

**Request Body:**
```json
{
  "variables": {
    "name": "John Doe",
    "company": "Acme Corp"
  },
  "returnHtml": true
}
```

**Response:**
```json
{
  "templateId": "uuid",
  "title": "Template Title",
  "populatedContent": "<p>Hello John Doe!</p>",
  "variables": {
    "required": ["name"],
    "provided": ["name"],
    "missing": [],
    "used": ["name"]
  }
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "details": ["Additional details"], // optional
  "message": "Debug message" // only in development
}
```

### Common Error Codes

- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (access denied)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Rate Limiting

- Create template: 10 per minute, 100 per hour
- Other operations: 100 per minute

## Content Moderation

Public templates are automatically moderated using AWS Comprehend:
- Toxicity detection
- PII (Personally Identifiable Information) detection
- Sentiment analysis

Templates with inappropriate content will have `moderationStatus: "rejected"`.

## Local Development

For local development:
1. Use `http://localhost:7429` as the base URL
2. Use `Authorization: Bearer local-dev-token`
3. Content moderation is mocked (always passes)
4. Rate limiting is disabled