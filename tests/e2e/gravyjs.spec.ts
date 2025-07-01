import { test, expect } from '@playwright/test';

test.describe('GravyJS Editor', () => {
  test('should load the homepage and display templates', async ({ page }) => {
    await page.goto('/');
    
    // Check that the page loads
    await expect(page).toHaveTitle(/Gravy/);
    
    // Check for key elements
    await expect(page.locator('h1').filter({ hasText: 'AI Prompt Templates' })).toBeVisible();
    
    // Check that templates are loaded
    await expect(page.locator('[data-testid="template-grid"]')).toBeVisible();
    const templates = page.locator('[data-testid="template-card"]');
    await expect(templates).toHaveCount(37); // Based on the loaded templates
  });

  test('should open template quickview with GravyJS editor', async ({ page }) => {
    await page.goto('/');
    
    // Wait for templates to load
    await page.waitForSelector('[data-testid="template-card"]');
    
    // Click the first template
    await page.locator('[data-testid="template-card"]').first().click();
    
    // Check that quickview panel opens
    await expect(page.locator('[data-testid="template-quickview"]')).toBeVisible();
    
    // Wait for GravyJS editor to load (dynamic import)
    await page.waitForSelector('.gravy-editor', { timeout: 10000 });
    
    // Verify the editor is present
    const editor = page.locator('.gravy-editor');
    await expect(editor).toBeVisible();
    
    // Verify toolbar is present
    await expect(page.locator('.gravy-toolbar')).toBeVisible();
    
    // Verify content area is present
    await expect(page.locator('.gravy-content')).toBeVisible();
  });

  test('should allow typing in the GravyJS editor', async ({ page }) => {
    await page.goto('/');
    
    // Open a template
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('.gravy-editor');
    
    // Click in the editor content area
    const editorContent = page.locator('.gravy-content');
    await editorContent.click();
    
    // Type some text
    await page.keyboard.type('Test content in GravyJS editor');
    
    // Verify the text appears
    await expect(editorContent).toContainText('Test content in GravyJS editor');
  });

  test('should handle variable insertion', async ({ page }) => {
    await page.goto('/');
    
    // Open a template
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('.gravy-editor');
    
    // Look for variable button in toolbar
    const variableButton = page.locator('.toolbar-btn').filter({ hasText: '[[]]' });
    await expect(variableButton).toBeVisible();
    
    // Click to insert variable
    await variableButton.click();
    
    // Check for variable prompt or insertion
    // This depends on the implementation
    const editorContent = page.locator('.gravy-content');
    const variables = editorContent.locator('.gravy-variable');
    
    // Should have at least one variable
    await expect(variables).toHaveCount(1, { timeout: 5000 });
  });

  test('should populate variables when clicking populate button', async ({ page }) => {
    await page.goto('/');
    
    // Open a template with variables
    await page.locator('[data-testid="template-card"]').first().click();
    await page.waitForSelector('.gravy-editor');
    
    // Look for populate button
    const populateButton = page.locator('button').filter({ hasText: /populate|fill/i });
    
    if (await populateButton.isVisible()) {
      await populateButton.click();
      
      // Handle variable prompts if they appear
      // This will depend on the actual implementation
      await page.waitForTimeout(1000);
    }
  });
});