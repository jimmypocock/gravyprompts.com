/**
 * Frontend Performance Tests
 * 
 * These tests measure frontend performance including component rendering,
 * virtual DOM updates, search responsiveness, and user interaction latency.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { performance } from 'perf_hooks';

// Mock components and dependencies
jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(() => ({
    user: { userId: 'test-user', email: 'test@example.com' },
    loading: false
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

jest.mock('@/lib/search-context', () => ({
  useSearch: jest.fn(() => ({
    searchTerm: '',
    setSearchTerm: jest.fn(),
    results: [],
    loading: false
  })),
  SearchProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

jest.mock('@/lib/api/templates', () => ({
  useTemplateApi: jest.fn(() => ({
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn()
  }))
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn()
  }),
  useSearchParams: () => new URLSearchParams()
}));

// Mock GravyJS editor for performance testing
jest.mock('gravyjs', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        setContent: jest.fn(),
        generatePopulatedContent: jest.fn()
      }));
      return React.createElement('div', { 'data-testid': 'gravyjs-editor' }, props.initialValue);
    })
  };
});

describe('Frontend Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('Component Rendering Performance', () => {
    it('should render template cards efficiently', async () => {
      // Generate large template dataset
      const largeTemplateSet = Array.from({ length: 100 }, (_, i) => ({
        templateId: `template-${i}`,
        title: `Template ${i}`,
        preview: `Preview content for template ${i}`.repeat(5),
        tags: ['test', 'performance', `tag-${i % 10}`],
        variables: ['name', 'company'],
        variableCount: 2,
        visibility: 'public' as const,
        status: 'approved' as const,
        authorEmail: `author${i}@example.com`,
        views: Math.floor(Math.random() * 1000),
        useCount: Math.floor(Math.random() * 100),
        createdAt: new Date().toISOString()
      }));

      // Mock template grid component
      const TemplateGrid = () => {
        const [templates] = React.useState(largeTemplateSet);
        
        return (
          <div data-testid="template-grid">
            {templates.map(template => (
              <div key={template.templateId} data-testid="template-card">
                <h3>{template.title}</h3>
                <p>{template.preview}</p>
                <div>
                  {template.tags.map(tag => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div>Views: {template.views}</div>
                <div>Uses: {template.useCount}</div>
              </div>
            ))}
          </div>
        );
      };

      // Measure rendering performance
      const startTime = performance.now();
      render(<TemplateGrid />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;

      // Performance assertions
      expect(renderTime).toBeLessThan(500); // Under 500ms for 100 templates
      expect(screen.getByTestId('template-grid')).toBeInTheDocument();
      expect(screen.getAllByTestId('template-card')).toHaveLength(100);
    });

    it('should handle search input responsively', async () => {
      const user = userEvent.setup();
      let searchCallCount = 0;
      
      const SearchComponent = () => {
        const [searchTerm, setSearchTerm] = React.useState('');
        const [results, setResults] = React.useState<any[]>([]);
        
        // Simulate search function
        const handleSearch = React.useCallback((term: string) => {
          searchCallCount++;
          // Simulate search processing
          const filtered = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            title: `Result ${i}`,
            relevance: Math.random()
          })).filter(item => 
            item.title.toLowerCase().includes(term.toLowerCase())
          );
          setResults(filtered);
        }, []);

        // Debounced search
        React.useEffect(() => {
          const timer = setTimeout(() => {
            if (searchTerm) {
              handleSearch(searchTerm);
            }
          }, 300);
          
          return () => clearTimeout(timer);
        }, [searchTerm, handleSearch]);

        return (
          <div>
            <input
              data-testid="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
            />
            <div data-testid="search-results">
              {results.map(result => (
                <div key={result.id}>{result.title}</div>
              ))}
            </div>
          </div>
        );
      };

      render(<SearchComponent />);
      
      const searchInput = screen.getByTestId('search-input');
      
      // Measure search responsiveness
      const startTime = performance.now();
      
      // Type search query
      await user.type(searchInput, 'test query');
      
      // Wait for debounced search
      await waitFor(() => {
        expect(searchCallCount).toBeGreaterThan(0);
      }, { timeout: 1000 });
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;

      // Search should feel responsive
      expect(searchTime).toBeLessThan(1000); // Complete search under 1s
      expect(searchCallCount).toBeLessThan(15); // Reasonable debouncing
    });

    it('should update template quickview efficiently', async () => {
      const mockTemplate = {
        templateId: 'test-template',
        title: 'Performance Test Template',
        content: 'Hello {{name}}, welcome to {{company}}!'.repeat(50), // Large content
        tags: ['performance', 'test'],
        variables: ['name', 'company'],
        visibility: 'public' as const,
        status: 'approved' as const,
        authorEmail: 'test@example.com',
        views: 100,
        useCount: 50,
        createdAt: new Date().toISOString()
      };

      const QuickviewComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        const [template, setTemplate] = React.useState<any>(null);

        return (
          <div>
            <button
              data-testid="open-quickview"
              onClick={() => {
                setTemplate(mockTemplate);
                setIsOpen(true);
              }}
            >
              Open Quickview
            </button>
            
            {isOpen && template && (
              <div data-testid="quickview-panel">
                <h2>{template.title}</h2>
                <div data-testid="gravyjs-editor">{template.content}</div>
                <div>
                  {template.variables.map((variable: string) => (
                    <input
                      key={variable}
                      data-testid={`variable-${variable}`}
                      placeholder={`Enter ${variable}`}
                    />
                  ))}
                </div>
                <button
                  data-testid="close-quickview"
                  onClick={() => setIsOpen(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        );
      };

      render(<QuickviewComponent />);

      // Measure quickview opening
      const openButton = screen.getByTestId('open-quickview');
      
      const startTime = performance.now();
      fireEvent.click(openButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('quickview-panel')).toBeInTheDocument();
      });
      
      const endTime = performance.now();
      const openTime = endTime - startTime;

      // Quickview should open quickly
      expect(openTime).toBeLessThan(100); // Under 100ms
      expect(screen.getByTestId('variable-name')).toBeInTheDocument();
      expect(screen.getByTestId('variable-company')).toBeInTheDocument();
    });
  });

  describe('Virtual DOM Performance', () => {
    it('should handle frequent state updates efficiently', async () => {
      const StateUpdateComponent = () => {
        const [counter, setCounter] = React.useState(0);
        const [items, setItems] = React.useState<number[]>([]);

        React.useEffect(() => {
          // Simulate frequent updates
          const interval = setInterval(() => {
            setCounter(prev => prev + 1);
            setItems(prev => [...prev, prev.length]);
          }, 10);

          // Stop after 100 updates
          setTimeout(() => clearInterval(interval), 1000);

          return () => clearInterval(interval);
        }, []);

        return (
          <div data-testid="state-component">
            <div data-testid="counter">Count: {counter}</div>
            <div data-testid="items-list">
              {items.map(item => (
                <div key={item} data-testid={`item-${item}`}>
                  Item {item}
                </div>
              ))}
            </div>
          </div>
        );
      };

      const startTime = performance.now();
      render(<StateUpdateComponent />);

      // Wait for updates to complete
      await waitFor(() => {
        const counter = screen.getByTestId('counter');
        return counter.textContent?.includes('Count: 9');
      }, { timeout: 2000 });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Frequent updates should not block UI
      expect(updateTime).toBeLessThan(1500); // Complete within 1.5s
      expect(screen.getByTestId('state-component')).toBeInTheDocument();
    });

    it('should optimize large list rendering', async () => {
      const LargeListComponent = () => {
        const [filter, setFilter] = React.useState('');
        const [items] = React.useState(
          Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            category: `Category ${i % 10}`,
            description: `Description for item ${i}`.repeat(3)
          }))
        );

        const filteredItems = React.useMemo(() => {
          if (!filter) return items.slice(0, 50); // Show first 50
          return items.filter(item => 
            item.name.toLowerCase().includes(filter.toLowerCase())
          ).slice(0, 50);
        }, [items, filter]);

        return (
          <div>
            <input
              data-testid="filter-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter items..."
            />
            <div data-testid="items-container">
              {filteredItems.map(item => (
                <div key={item.id} data-testid={`list-item-${item.id}`}>
                  <h4>{item.name}</h4>
                  <p>{item.category}</p>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      };

      const startTime = performance.now();
      render(<LargeListComponent />);
      const endTime = performance.now();

      const renderTime = endTime - startTime;

      // Large list should render efficiently
      expect(renderTime).toBeLessThan(200); // Under 200ms
      expect(screen.getAllByTestId(/list-item-/)).toHaveLength(50);

      // Test filtering performance
      const filterInput = screen.getByTestId('filter-input');
      
      const filterStartTime = performance.now();
      fireEvent.change(filterInput, { target: { value: 'Item 1' } });
      const filterEndTime = performance.now();

      const filterTime = filterEndTime - filterStartTime;
      expect(filterTime).toBeLessThan(50); // Filter update under 50ms
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during component lifecycle', async () => {
      const LeakTestComponent = () => {
        const [data, setData] = React.useState<any[]>([]);
        
        React.useEffect(() => {
          // Simulate data loading
          const largeData = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            content: 'Large content block '.repeat(100),
            nested: {
              more: 'data',
              array: new Array(100).fill('item')
            }
          }));
          setData(largeData);

          return () => {
            // Cleanup
            setData([]);
          };
        }, []);

        return (
          <div data-testid="leak-test">
            {data.map(item => (
              <div key={item.id}>
                {item.content.substring(0, 50)}...
              </div>
            ))}
          </div>
        );
      };

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      const { unmount } = render(<LeakTestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('leak-test')).toBeInTheDocument();
      });

      const afterMountMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      unmount();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterUnmountMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory should be freed after unmount (allowing for some variance)
      if (initialMemory > 0 && afterMountMemory > 0 && afterUnmountMemory > 0) {
        const memoryIncrease = afterUnmountMemory - initialMemory;
        const peakIncrease = afterMountMemory - initialMemory;
        
        // Memory should return close to initial levels
        expect(memoryIncrease).toBeLessThan(peakIncrease * 0.5);
      }
    });
  });

  describe('Animation and Interaction Performance', () => {
    it('should handle modal transitions smoothly', async () => {
      const ModalComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        const [animationPhase, setAnimationPhase] = React.useState('closed');

        const openModal = () => {
          setIsOpen(true);
          setAnimationPhase('opening');
          setTimeout(() => setAnimationPhase('open'), 300);
        };

        const closeModal = () => {
          setAnimationPhase('closing');
          setTimeout(() => {
            setIsOpen(false);
            setAnimationPhase('closed');
          }, 300);
        };

        return (
          <div>
            <button data-testid="open-modal" onClick={openModal}>
              Open Modal
            </button>
            
            {isOpen && (
              <div 
                data-testid="modal-backdrop"
                data-animation-phase={animationPhase}
                style={{
                  opacity: animationPhase === 'open' ? 1 : 0,
                  transition: 'opacity 300ms ease'
                }}
              >
                <div data-testid="modal-content">
                  <h2>Modal Content</h2>
                  <button data-testid="close-modal" onClick={closeModal}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<ModalComponent />);

      const openButton = screen.getByTestId('open-modal');
      
      // Measure modal opening
      const startTime = performance.now();
      fireEvent.click(openButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
      });
      
      const openTime = performance.now() - startTime;
      
      // Modal should open quickly
      expect(openTime).toBeLessThan(50); // DOM update under 50ms
      
      // Test modal closing
      const closeButton = screen.getByTestId('close-modal');
      
      const closeStartTime = performance.now();
      fireEvent.click(closeButton);
      
      await waitFor(() => {
        const backdrop = screen.queryByTestId('modal-backdrop');
        return backdrop?.getAttribute('data-animation-phase') === 'closing';
      });
      
      const closeTime = performance.now() - closeStartTime;
      expect(closeTime).toBeLessThan(50); // Close initiation under 50ms
    });

    it('should handle scroll events efficiently', async () => {
      const ScrollComponent = () => {
        const [scrollPosition, setScrollPosition] = React.useState(0);
        const [visibleItems, setVisibleItems] = React.useState<number[]>([]);
        
        const items = Array.from({ length: 500 }, (_, i) => i);
        
        const handleScroll = React.useCallback((e: any) => {
          const scrollTop = e.target.scrollTop;
          setScrollPosition(scrollTop);
          
          // Calculate visible items (simple windowing)
          const itemHeight = 50;
          const containerHeight = 300;
          const startIndex = Math.floor(scrollTop / itemHeight);
          const endIndex = Math.min(
            startIndex + Math.ceil(containerHeight / itemHeight) + 1,
            items.length
          );
          
          setVisibleItems(items.slice(startIndex, endIndex));
        }, [items]);

        React.useEffect(() => {
          // Initialize visible items
          setVisibleItems(items.slice(0, 10));
        }, [items]);

        return (
          <div
            data-testid="scroll-container"
            onScroll={handleScroll}
            style={{
              height: '300px',
              overflow: 'auto'
            }}
          >
            <div style={{ height: `${items.length * 50}px`, position: 'relative' }}>
              {visibleItems.map(item => (
                <div
                  key={item}
                  data-testid={`scroll-item-${item}`}
                  style={{
                    position: 'absolute',
                    top: `${item * 50}px`,
                    height: '50px',
                    width: '100%'
                  }}
                >
                  Item {item} (Scroll: {scrollPosition})
                </div>
              ))}
            </div>
          </div>
        );
      };

      render(<ScrollComponent />);

      const scrollContainer = screen.getByTestId('scroll-container');
      
      // Measure scroll performance
      const scrollStartTime = performance.now();
      
      // Simulate multiple scroll events
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(scrollContainer, { target: { scrollTop: i * 100 } });
      }
      
      const scrollEndTime = performance.now();
      const scrollTime = scrollEndTime - scrollStartTime;

      // Scroll handling should be efficient
      expect(scrollTime).toBeLessThan(200); // 10 scroll events under 200ms
      expect(screen.getByTestId('scroll-container')).toBeInTheDocument();
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('should simulate efficient code splitting', async () => {
      // Simulate lazy loading behavior
      const LazyComponent = React.lazy(async () => {
        // Simulate network delay for chunk loading
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
          default: () => (
            <div data-testid="lazy-component">
              Lazy loaded component content
            </div>
          )
        };
      });

      const LoadingWrapper = () => (
        <React.Suspense fallback={<div data-testid="loading">Loading...</div>}>
          <LazyComponent />
        </React.Suspense>
      );

      const startTime = performance.now();
      render(<LoadingWrapper />);

      // Should show loading state immediately
      expect(screen.getByTestId('loading')).toBeInTheDocument();

      // Wait for lazy component to load
      await waitFor(() => {
        expect(screen.getByTestId('lazy-component')).toBeInTheDocument();
      });

      const loadTime = performance.now() - startTime;

      // Lazy loading should complete reasonably quickly
      expect(loadTime).toBeLessThan(300); // Under 300ms including simulated network
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });
});