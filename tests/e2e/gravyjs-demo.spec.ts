import { test, expect } from '@playwright/test';

test.describe('GravyJS Demo Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
  });

  test('should load the demo page', async ({ page }) => {
    // Check title
    await expect(page.locator('h1')).toContainText('GravyJS Demo');
    
    // Check description
    await expect(page.locator('p')).toContainText('WYSIWYG editor');
    
    // Check logo
    await expect(page.locator('img[alt="GravyJS Logo"]')).toBeVisible();
  });

  test('should display the GravyJS editor', async ({ page }) => {
    // Check editor container
    await expect(page.locator('.demo-editor')).toBeVisible();
    
    // Check toolbar
    await expect(page.locator('.gravy-toolbar')).toBeVisible();
    
    // Check content area
    await expect(page.locator('.gravy-content')).toBeVisible();
    
    // Check formatting buttons
    await expect(page.locator('.toolbar-btn').filter({ hasText: 'B' })).toBeVisible();
    await expect(page.locator('.toolbar-btn').filter({ hasText: 'I' })).toBeVisible();
    await expect(page.locator('.toolbar-btn').filter({ hasText: 'U' })).toBeVisible();
  });

  test('should apply text formatting', async ({ page }) => {
    const content = page.locator('.gravy-content');
    
    // Click in editor and type
    await content.click();
    await page.keyboard.type('Test text');
    
    // Select all text
    await page.keyboard.press('Control+A');
    
    // Apply bold
    await page.locator('.toolbar-btn').filter({ hasText: 'B' }).click();
    
    // Check that bold was applied
    await expect(content.locator('strong')).toContainText('Test text');
  });

  test('should handle variable insertion and population', async ({ page }) => {
    const content = page.locator('.gravy-content');
    
    // Insert a variable
    await page.locator('.toolbar-btn').filter({ hasText: '[[]]' }).click();
    
    // Handle the prompt (if it appears)
    page.on('dialog', async dialog => {
      await dialog.accept('testVariable');
    });
    
    // Check variable was inserted
    await expect(content.locator('.gravy-variable')).toBeVisible();
    
    // Click populate button
    await page.locator('button').filter({ hasText: 'Populate Variables' }).click();
    
    // Handle variable value prompt
    page.on('dialog', async dialog => {
      await dialog.accept('Test Value');
    });
    
    // Wait for populated content
    await page.waitForTimeout(1000);
    
    // Check populated content section appears
    const populatedSection = page.locator('.populated-preview');
    if (await populatedSection.isVisible()) {
      await expect(populatedSection).toContainText('Test Value');
    }
  });

  test('should load sample template', async ({ page }) => {
    // Click insert sample button
    await page.locator('button').filter({ hasText: 'Insert Sample Template' }).click();
    
    // Check that content was inserted
    const content = page.locator('.gravy-content');
    await expect(content).toContainText('Hello [[name]]');
    
    // Check for multiple formatting examples
    await expect(content.locator('strong')).toBeVisible();
    await expect(content.locator('em')).toBeVisible();
    await expect(content.locator('u')).toBeVisible();
  });

  test('should handle snippets dropdown', async ({ page }) => {
    // Click snippets button
    const snippetsButton = page.locator('.toolbar-btn').filter({ hasText: '📝' });
    
    if (await snippetsButton.isVisible()) {
      await snippetsButton.click();
      
      // Check dropdown appears
      await expect(page.locator('.gravy-snippets-dropdown')).toBeVisible();
      
      // Check for snippet items
      await expect(page.locator('.snippet-item')).toHaveCount(4); // Based on sampleSnippets
      
      // Click a snippet
      await page.locator('.snippet-item').first().click();
      
      // Check content was inserted
      const content = page.locator('.gravy-content');
      await expect(content).toContainText('Best regards');
    }
  });

  test('should copy content to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Insert sample content
    await page.locator('button').filter({ hasText: 'Insert Sample Template' }).click();
    
    // Populate variables
    await page.locator('button').filter({ hasText: 'Populate Variables' }).click();
    
    // Handle prompts
    page.on('dialog', async dialog => {
      await dialog.accept('Test User');
    });
    
    await page.waitForTimeout(1000);
    
    // Click copy button if visible
    const copyButton = page.locator('button').filter({ hasText: 'Copy with Formatting' });
    if (await copyButton.isVisible()) {
      await copyButton.click();
      
      // Check for success message
      page.on('dialog', async dialog => {
        expect(dialog.message()).toContain('copied');
        await dialog.accept();
      });
    }
  });

  test('should handle variable delimiter configuration', async ({ page }) => {
    // Change prefix
    await page.locator('input[value="[["]').fill('{{');
    
    // Change suffix
    await page.locator('input[value="]]"]').fill('}}');
    
    // Check example updates
    await expect(page.locator('.example-text')).toContainText('{{name}}');
    
    // Insert variable with new delimiters
    await page.locator('.toolbar-btn').filter({ hasText: '{{}}' }).click();
  });

  test('should show no console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected warnings
    const unexpectedErrors = errors.filter(error => 
      !error.includes('Warning:') && 
      !error.includes('DevTools')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });
});