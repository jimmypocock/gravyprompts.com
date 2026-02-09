import { test, expect } from '@playwright/test';

test.describe('Application Health Checks', () => {
  test('all services should be running', async ({ request }) => {
    // Check main app
    const appResponse = await request.get('http://localhost:6827/');
    expect(appResponse.ok()).toBeTruthy();
    expect(appResponse.status()).toBe(200);

    // Check API
    const apiResponse = await request.get('http://localhost:7429/templates');
    expect(apiResponse.ok()).toBeTruthy();
    expect(apiResponse.status()).toBe(200);
    
    // Verify API returns templates
    const templates = await apiResponse.json();
    expect(templates).toHaveProperty('templates');
    expect(Array.isArray(templates.templates)).toBeTruthy();
    expect(templates.templates.length).toBeGreaterThan(0);

    // Check DynamoDB Admin
    const dynamoResponse = await request.get('http://localhost:8001/');
    expect(dynamoResponse.ok()).toBeTruthy();
    expect(dynamoResponse.status()).toBe(200);
  });

  test('static assets should load', async ({ page }) => {
    await page.goto('/');
    
    // Check that CSS loads
    const response = await page.waitForResponse(response => 
      response.url().includes('.css') && response.status() === 200
    );
    expect(response).toBeTruthy();
    
    // Check that JS bundles load
    const jsResponse = await page.waitForResponse(response => 
      response.url().includes('.js') && response.status() === 200
    );
    expect(jsResponse).toBeTruthy();
  });

  test('no console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected warnings (like Next.js dev mode warnings)
    const unexpectedErrors = consoleErrors.filter(error => 
      !error.includes('Warning:') && 
      !error.includes('DevTools') &&
      !error.includes('source map')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('API endpoints should return valid data', async ({ request }) => {
    // Test templates endpoint
    const templatesResponse = await request.get('http://localhost:7429/templates');
    const templatesData = await templatesResponse.json();
    
    expect(templatesData).toHaveProperty('templates');
    expect(templatesData.templates.length).toBeGreaterThan(0);
    
    // Verify template structure
    const firstTemplate = templatesData.templates[0];
    expect(firstTemplate).toHaveProperty('templateId');
    expect(firstTemplate).toHaveProperty('title');
    expect(firstTemplate).toHaveProperty('description');
    expect(firstTemplate).toHaveProperty('content');
    expect(firstTemplate).toHaveProperty('tags');
    expect(firstTemplate).toHaveProperty('variables');
  });
});