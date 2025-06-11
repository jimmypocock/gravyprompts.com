// Debug script that directly inspects the editor component
// Run this in the browser console on the editor page

(function debugEditor() {
  console.log('🔍 Debugging editor directly...\n');
  
  // 1. First, let's see if we can find the Save button
  const buttons = Array.from(document.querySelectorAll('button'));
  const saveButton = buttons.find(btn => 
    btn.textContent.includes('Save') || 
    btn.textContent.includes('Create') ||
    btn.textContent.includes('💾')
  );
  
  if (saveButton) {
    console.log('✅ Found save button:', saveButton.textContent);
    console.log('Button disabled?', saveButton.disabled);
    console.log('Button classes:', saveButton.className);
    
    // Check if it has click handlers
    const clickHandlers = getEventListeners ? getEventListeners(saveButton) : null;
    if (clickHandlers) {
      console.log('Click handlers:', clickHandlers);
    }
  } else {
    console.log('❌ Could not find save button');
  }
  
  // 2. Check for form elements
  const titleInput = document.querySelector('input[placeholder*="title"]');
  const contentArea = document.querySelector('[contenteditable], .gravy-editor, [class*="editor"]');
  
  console.log('\n📝 Form elements:');
  console.log('Title input found?', !!titleInput);
  console.log('Title value:', titleInput?.value);
  console.log('Content area found?', !!contentArea);
  console.log('Content preview:', contentArea?.textContent?.substring(0, 50) + '...');
  
  // 3. Try to trigger save manually
  console.log('\n🔧 Manual save test:');
  console.log('To manually trigger save, run:');
  console.log('document.querySelector("button:has(💾), button:contains(Save)")?.click()');
  
  // 4. Check for React component
  const findReactComponent = (el) => {
    for (const key in el) {
      if (key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$')) {
        return el[key];
      }
    }
    return null;
  };
  
  if (saveButton) {
    const fiber = findReactComponent(saveButton);
    if (fiber) {
      console.log('\n⚛️ React component found');
      // Try to find the onClick handler
      let currentFiber = fiber;
      while (currentFiber) {
        if (currentFiber.memoizedProps?.onClick) {
          console.log('Found onClick handler');
          
          // Try to trigger it with a synthetic event
          console.log('\n🧪 Creating synthetic click event...');
          const syntheticEvent = {
            preventDefault: () => console.log('preventDefault called'),
            stopPropagation: () => console.log('stopPropagation called'),
            target: saveButton,
            currentTarget: saveButton,
            type: 'click',
            nativeEvent: new MouseEvent('click')
          };
          
          try {
            console.log('Calling onClick directly...');
            currentFiber.memoizedProps.onClick(syntheticEvent);
          } catch (error) {
            console.error('Error calling onClick:', error);
            console.error('Stack:', error.stack);
          }
          break;
        }
        currentFiber = currentFiber.return;
      }
    }
  }
  
  // 5. Check localStorage for any auth issues
  console.log('\n🔐 Auth check:');
  const cognitoKeys = Object.keys(localStorage).filter(k => k.includes('Cognito'));
  console.log('Cognito keys in localStorage:', cognitoKeys.length);
  
  // Check for expired token
  const idTokenKey = cognitoKeys.find(k => k.includes('idToken'));
  if (idTokenKey) {
    const token = localStorage.getItem(idTokenKey);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = new Date(payload.exp * 1000);
      console.log('Token expires:', expiry);
      console.log('Token expired?', new Date() > expiry);
    } catch (e) {
      console.log('Could not decode token');
    }
  }
  
  // 6. Override alert to catch any error messages
  const originalAlert = window.alert;
  window.alert = function(message) {
    console.log('🚨 Alert intercepted:', message);
    originalAlert(message);
  };
  console.log('\n✅ Alert interceptor installed');
  
  // 7. Check for any error boundaries
  const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
  if (errorElements.length > 0) {
    console.log('\n❌ Error elements found on page:', errorElements.length);
    errorElements.forEach(el => {
      if (el.textContent) {
        console.log('- Error text:', el.textContent);
      }
    });
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Check if the save button is disabled');
  console.log('2. Try clicking the save button now');
  console.log('3. Watch for any alert messages');
  console.log('4. Check the Network tab in DevTools');
})();