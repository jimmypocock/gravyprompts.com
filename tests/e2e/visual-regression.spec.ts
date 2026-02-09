import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('GravyJS editor should render correctly', async ({ page }) => {
    // Navigate to demo
    await page.goto('http://localhost:5173/');
    
    // Wait for editor to be fully loaded
    await page.waitForSelector('.gravy-editor');
    await page.waitForTimeout(1000); // Let animations complete
    
    // Take screenshot of the editor
    const editor = page.locator('.demo-editor');
    await expect(editor).toHaveScreenshot('gravyjs-editor-empty.png');
    
    // Add some content
    const content = page.locator('.gravy-content');
    await content.click();
    await page.keyboard.type('This is a test with **bold** and *italic* text.');
    
    // Take screenshot with content
    await expect(editor).toHaveScreenshot('gravyjs-editor-with-content.png');
    
    // Insert a variable
    await page.locator('.toolbar-btn').filter({ hasText: '[[]]' }).click();
    page.on('dialog', async dialog => {
      await dialog.accept('userName');
    });
    
    await page.waitForTimeout(500);
    
    // Take screenshot with variable
    await expect(editor).toHaveScreenshot('gravyjs-editor-with-variable.png');
  });

  test('Template quickview should render correctly', async ({ page }) => {
    await page.goto('/');
    
    // Wait for templates to load
    await page.waitForSelector('[data-testid="template-card"]');
    
    // Open first template
    await page.locator('[data-testid="template-card"]').first().click();
    
    // Wait for quickview and editor to load
    await page.waitForSelector('[data-testid="template-quickview"]');
    await page.waitForSelector('.gravy-editor', { timeout: 10000 });
    await page.waitForTimeout(1000); // Let animations complete
    
    // Take screenshot of quickview panel
    const quickview = page.locator('[data-testid="template-quickview"]');
    await expect(quickview).toHaveScreenshot('template-quickview.png');
  });

  test('Toolbar states should be visually correct', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    // Wait for editor
    await page.waitForSelector('.gravy-toolbar');
    
    // Take screenshot of default toolbar
    const toolbar = page.locator('.gravy-toolbar');
    await expect(toolbar).toHaveScreenshot('toolbar-default.png');
    
    // Type some text and select it
    const content = page.locator('.gravy-content');
    await content.click();
    await page.keyboard.type('Test text');
    await page.keyboard.press('Control+A');
    
    // Apply bold
    await page.locator('.toolbar-btn').filter({ hasText: 'B' }).click();
    
    // Screenshot with active button
    await expect(toolbar).toHaveScreenshot('toolbar-with-active-button.png');
  });

  test('Variable styles should be correct', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    
    // Insert sample template with variables
    await page.locator('button').filter({ hasText: 'Insert Sample Template' }).click();
    
    // Wait for variables to render
    await page.waitForSelector('.gravy-variable');
    
    // Screenshot unpopulated variables
    const content = page.locator('.gravy-content');
    await expect(content).toHaveScreenshot('variables-unpopulated.png');
    
    // Populate variables
    await page.locator('button').filter({ hasText: 'Populate Variables' }).click();
    
    // Handle prompts
    let promptCount = 0;
    page.on('dialog', async dialog => {
      promptCount++;
      await dialog.accept(`Test Value ${promptCount}`);
    });
    
    await page.waitForTimeout(2000); // Wait for all prompts
    
    // Screenshot populated content
    const populatedSection = page.locator('.populated-preview');
    if (await populatedSection.isVisible()) {
      await expect(populatedSection).toHaveScreenshot('variables-populated.png');
    }
  });
});