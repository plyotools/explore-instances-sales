'use client';

import { useEffect, useRef, useState } from 'react';
import { webglContextManager } from '@/app/lib/webgl-context-manager';

// Dynamically import Photo Sphere Viewer to avoid SSR issues
let Viewer: any = null;
let viewerModule: any = null;
let cssLoaded = false;

// Load the viewer module dynamically
const loadViewer = async () => {
  if (viewerModule && Viewer) return viewerModule;
  try {
    // Load CSS first
    if (!cssLoaded && typeof window !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/photo-sphere-viewer@4/dist/photo-sphere-viewer.min.css';
      document.head.appendChild(link);
      cssLoaded = true;
    }
    
    // Load the viewer module
    viewerModule = await import('photo-sphere-viewer');
    // Try different possible exports
    Viewer = viewerModule.Viewer || viewerModule.default?.Viewer || viewerModule.default;
    if (!Viewer) {
      console.error('PanoramaViewer: Could not find Viewer in module:', viewerModule);
      return null;
    }
    return viewerModule;
  } catch (error) {
    console.error('PanoramaViewer: Failed to load Photo Sphere Viewer:', error);
    return null;
  }
};

interface PanoramaViewerProps {
  imageSrc: string;
  autoRotate?: boolean;
  rotationSpeed?: number; // degrees per second
  initialPitch?: number; // Initial pitch in degrees (vertical rotation)
  initialYaw?: number; // Initial yaw in degrees (horizontal rotation)
  className?: string;
  style?: React.CSSProperties;
  onLoadError?: (fallbackSrc?: string) => void; // Callback when image fails to load, with optional fallback URL
  fallbackSrc?: string; // Fallback image URL to try if primary fails
  lowResSrc?: string; // Progressive loading: show this low-res image first, then upgrade to imageSrc
  // External rotation control (for syncing with 3D camera)
  externalYaw?: number; // External yaw in degrees (horizontal rotation)
  externalPitch?: number; // External pitch in degrees (vertical rotation)
  onRotationChange?: (yaw: number, pitch: number) => void; // Callback when user rotates the panorama
  viewerRef?: React.MutableRefObject<any>; // Ref to expose viewer instance
  priority?: number; // WebGL context priority (higher = kept longer, default = 1, preview panels should use 0)
  disableInteraction?: boolean; // Disable user interaction (mouse/touch) - makes it a slave to external rotation
}

export function PanoramaViewer({ 
  imageSrc, 
  autoRotate = true, 
  rotationSpeed = 0.5, // 360 degrees in 720 seconds = 0.5 deg/sec
  initialPitch,
  initialYaw,
  className,
  style,
  onLoadError,
  fallbackSrc,
  lowResSrc,
  externalYaw,
  externalPitch,
  onRotationChange,
  viewerRef: externalViewerRef,
  priority = 1,
  disableInteraction = false
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const viewerIdRef = useRef<string>(`panorama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const isInitializingRef = useRef<boolean>(false); // Track if we're currently initializing
  const isPanoramaRotatingRef = useRef<boolean>(false); // Track if user is rotating panorama (prevent external updates)

  // Use Intersection Observer to only initialize viewer when visible
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    
    // Check if container has dimensions - if not, wait a bit
    const checkDimensions = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setIsVisible(true);
        return true;
      }
      return false;
    };
    
    // Try immediately
    if (checkDimensions()) {
      return;
    }
    
    // If no dimensions yet, check again after a short delay
    const timeout = setTimeout(() => {
      if (checkDimensions()) {
        return;
      }
      // If still no dimensions, initialize anyway (might be in a hidden panel that will show)
      setIsVisible(true);
    }, 100);
    
    // Also use Intersection Observer as backup
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.disconnect(); // Only initialize once
            }
          });
        },
        {
          rootMargin: '50px', // Start loading 50px before entering viewport
          threshold: 0.01 // Trigger when at least 1% is visible
        }
      );

      observer.observe(container);

      return () => {
        clearTimeout(timeout);
        observer.disconnect();
      };
    }
    
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !containerRef.current) {
      return;
    }
    
    // Prevent multiple initializations - if viewer already exists or we're initializing, don't create another
    if (viewerRef.current || isInitializingRef.current) {
      return;
    }
    
    isInitializingRef.current = true;
    
    // Initialize viewer (logging removed - only log errors)

    const container = containerRef.current;
    let isMounted = true; // Track if component is still mounted
    
    // Set up global error suppression for photo-sphere-viewer errors
    // This needs to be active during the entire initialization process
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    const errorFilter = (args: any[]) => {
      const message = String(args[0] || '');
      const stack = String(args[1] || '');
      const fullMessage = message + ' ' + stack;
      // Suppress known harmless errors from photo-sphere-viewer
      // These occur due to Three.js version conflicts but don't affect functionality
      return (fullMessage.includes('loader') || 
              fullMessage.includes('classList') ||
              (fullMessage.includes('Cannot read properties of undefined') && fullMessage.includes('reading'))) &&
             (fullMessage.includes('photo-sphere-viewer') || 
              fullMessage.includes('photo-sphere-viewer.js') ||
              fullMessage.includes('three.cjs'));
    };
    
    const warnFilter = (args: any[]) => {
      const message = String(args[0] || '');
      // Suppress known harmless warnings
      return message.includes('Multiple instances of Three.js');
    };
    
    console.error = (...args: any[]) => {
      if (!errorFilter(args)) {
        originalConsoleError.apply(console, args);
      }
    };
    
    console.warn = (...args: any[]) => {
      if (!warnFilter(args)) {
        originalConsoleWarn.apply(console, args);
      }
    };
    
    // Also handle unhandled promise rejections from photo-sphere-viewer
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const message = error?.message || String(error || '');
      const stack = error?.stack || '';
      const fullMessage = message + ' ' + stack;
      // Suppress known harmless promise rejections from photo-sphere-viewer
      if ((fullMessage.includes('loader') || 
           fullMessage.includes('classList') ||
           (fullMessage.includes('Cannot read properties of undefined') && fullMessage.includes('reading'))) &&
          (fullMessage.includes('photo-sphere-viewer') || 
           fullMessage.includes('photo-sphere-viewer.js') ||
           fullMessage.includes('three.cjs'))) {
        event.preventDefault(); // Suppress the error
        return;
      }
    };
    
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
    
    // Wait for container to have dimensions
    let dimensionCheckTimeout: NodeJS.Timeout;
    const checkDimensions = () => {
      // Check if component is still mounted and container still exists
      if (!isMounted || !containerRef.current) {
        return;
      }
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      if (width === 0 || height === 0) {
        dimensionCheckTimeout = setTimeout(checkDimensions, 100);
        return;
      }
      
      initializeViewer(width, height).catch((error) => {
        if (isMounted) {
          // Suppress known photo-sphere-viewer errors
          const errorMessage = error?.message || String(error || '');
          const errorStack = error?.stack || '';
          const fullError = errorMessage + ' ' + errorStack;
          if (!((fullError.includes('loader') || 
                 fullError.includes('classList') ||
                 (fullError.includes('Cannot read properties of undefined') && fullError.includes('reading'))) &&
                (fullError.includes('photo-sphere-viewer') || 
                 fullError.includes('photo-sphere-viewer.js') ||
                 fullError.includes('three.cjs')))) {
            console.error('PanoramaViewer: Error in initializeViewer:', error);
          }
          setLoadError(true);
        }
      });
    };
    
    checkDimensions();
    
    // Helper function to initialize viewer with a specific image URL
    async function initializeViewerWithImage(imgSrc: string, width: number, height: number) {
      // Check if component is still mounted and container still exists
      if (!isMounted || !containerRef.current) {
        return;
      }

      const container = containerRef.current;
      
      // Verify container is still in the DOM
      if (!container.parentElement && !document.body.contains(container)) {
        return;
      }
      
      // Validate image URL before proceeding
      if (!imgSrc || imgSrc.trim() === '') {
        console.error('[PanoramaViewer] Empty image URL provided');
        setLoadError(true);
        if (onLoadError) {
          onLoadError();
        }
        return;
      }
      
      // Store timeout reference for cleanup
      let loadingTimeout: NodeJS.Timeout | null = null;
      
      // Ensure URL is absolute
      let absoluteUrl = imgSrc;
      if (!imgSrc.startsWith('http://') && !imgSrc.startsWith('https://') && !imgSrc.startsWith('data:')) {
        // If relative URL, try to make it absolute
        if (imgSrc.startsWith('/')) {
          // Absolute path from root
          absoluteUrl = typeof window !== 'undefined' ? `${window.location.origin}${imgSrc}` : imgSrc;
        } else {
          // Relative path
          absoluteUrl = typeof window !== 'undefined' ? `${window.location.origin}/${imgSrc}` : imgSrc;
        }
        console.log('[PanoramaViewer] Converted relative URL to absolute:', { original: imgSrc, absolute: absoluteUrl });
      }
      
      // Check if image URL is accessible before initializing viewer
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const imageLoadPromise = new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            console.error('[PanoramaViewer] Image validation timeout after 15 seconds for URL:', absoluteUrl);
            resolve(false);
          }, 15000);
          
          img.onload = () => {
            clearTimeout(timeout);
            resolve(true);
          };
          
          img.onerror = (error) => {
            clearTimeout(timeout);
            console.error('[PanoramaViewer] Image validation failed - image cannot be loaded:', {
              url: absoluteUrl,
              originalUrl: imgSrc,
              error: error,
            });
            resolve(false);
          };
          
          img.src = absoluteUrl;
        });
        
        const imageValid = await imageLoadPromise;
        if (!imageValid) {
          console.error('[PanoramaViewer] Image validation failed, aborting viewer initialization');
          setLoadError(true);
          if (onLoadError) {
            onLoadError();
          }
          return;
        }
        
        // Update imgSrc to use absolute URL
        imgSrc = absoluteUrl;
      } catch (validationError) {
        console.error('[PanoramaViewer] Error validating image:', validationError);
        setLoadError(true);
        if (onLoadError) {
          onLoadError();
        }
        return;
      }

      // Load Photo Sphere Viewer module
      const viewerModuleLoaded = await loadViewer();
      if (!viewerModuleLoaded || !Viewer) {
        console.error('PanoramaViewer: Photo Sphere Viewer module not available');
        setLoadError(true);
        return;
      }

      try {
        
        // Calculate autorotate speed from rotationSpeed prop: convert deg/sec to RPM
        // rotationSpeed = degrees per second
        // RPM = (rotationSpeed * 60) / 360 = rotationSpeed / 6
        // Example: 6 deg/sec = 1 rpm (60 seconds per rotation)
        const autorotateSpeed = autoRotate ? `${(rotationSpeed / 6).toFixed(3)}rpm` : null;
        
        // Convert pitch/yaw from degrees to radians for Photo Sphere Viewer
        // Photo Sphere Viewer uses:
        // - defaultLong: longitude (horizontal, yaw) in radians, -π to π, 0 = north, -π/2 = west
        // - defaultLat: latitude (vertical, pitch) in radians, -π/2 to π/2, 0 = horizon, positive = up
        // Viewpoint rot is typically [pitch, roll, yaw] in degrees
        // Yaw: 0° = north, 90° = east, -90° = west, 180° = south
        // Pitch: 0° = horizon, positive = up, negative = down
        let defaultLong = -Math.PI / 2; // Default: -90° (west)
        let defaultLat = 0; // Default: horizon
        
        if (initialYaw !== undefined && !Number.isNaN(initialYaw) && Number.isFinite(initialYaw)) {
          // Convert yaw from degrees to radians
          // Yaw: 0° = north, but Photo Sphere Viewer: 0 = north, -π/2 = west
          // So we need to convert: yaw_degrees * (π/180) - π/2
          defaultLong = (initialYaw * Math.PI / 180) - Math.PI / 2;
          // Validate result
          if (Number.isNaN(defaultLong) || !Number.isFinite(defaultLong)) {
            defaultLong = -Math.PI / 2; // Fallback to default
          }
        }
        
        if (initialPitch !== undefined && !Number.isNaN(initialPitch) && Number.isFinite(initialPitch)) {
          // Convert pitch from degrees to radians
          // Pitch: positive = up, negative = down
          // Photo Sphere Viewer: positive = up, negative = down
          defaultLat = initialPitch * Math.PI / 180;
          // Clamp to valid range
          defaultLat = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, defaultLat));
          // Validate result
          if (Number.isNaN(defaultLat) || !Number.isFinite(defaultLat)) {
            defaultLat = 0; // Fallback to horizon
          }
        }
        
        // Final check before creating viewer
        if (!isMounted || !containerRef.current || !document.body.contains(container)) {
          return;
        }

        let viewer: any;
        try {
          // Final safety check before creating viewer
          if (!container || !container.parentElement || !document.body.contains(container)) {
            return;
          }
          
          // Suppress known photo-sphere-viewer initialization errors
          // These errors occur due to Three.js version conflicts but don't affect functionality
          const originalConsoleError = console.error;
          const originalConsoleWarn = console.warn;
          
          const errorFilter = (args: any[]) => {
            const message = String(args[0] || '');
            const stack = String(args[1] || '');
            const fullMessage = message + ' ' + stack;
            // Suppress known harmless errors from photo-sphere-viewer
            // These occur due to Three.js version conflicts but don't affect functionality
            return fullMessage.includes('loader') && (fullMessage.includes('photo-sphere-viewer') || fullMessage.includes('photo-sphere-viewer.js')) ||
                   fullMessage.includes('classList') && (fullMessage.includes('photo-sphere-viewer') || fullMessage.includes('photo-sphere-viewer.js')) ||
                   (fullMessage.includes('Cannot read properties of undefined') && fullMessage.includes('reading')) && 
                   (fullMessage.includes('photo-sphere-viewer') || fullMessage.includes('photo-sphere-viewer.js'));
          };
          
          const warnFilter = (args: any[]) => {
            const message = String(args[0] || '');
            // Suppress known harmless warnings
            return message.includes('Multiple instances of Three.js');
          };
          
          console.error = (...args: any[]) => {
            if (!errorFilter(args)) {
              originalConsoleError.apply(console, args);
            }
          };
          
          console.warn = (...args: any[]) => {
            if (!warnFilter(args)) {
              originalConsoleWarn.apply(console, args);
            }
          };
          
          // Also handle unhandled promise rejections from photo-sphere-viewer
          let unhandledRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;
          unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
            const error = event.reason;
            const message = error?.message || String(error || '');
            const stack = error?.stack || '';
            const fullMessage = message + ' ' + stack;
            // Suppress known harmless promise rejections from photo-sphere-viewer
            if ((fullMessage.includes('loader') || 
                 fullMessage.includes('classList') ||
                 fullMessage.includes('Cannot read properties of undefined')) &&
                (fullMessage.includes('photo-sphere-viewer') || fullMessage.includes('photo-sphere-viewer.js'))) {
              event.preventDefault(); // Suppress the error
              return;
            }
          };
          
          window.addEventListener('unhandledrejection', unhandledRejectionHandler);
          
          try {
        // Create viewer (logging removed - only log errors)
            
            // Progressive loading: Use low-res image first if provided, then upgrade to high-res
            const initialPanorama = lowResSrc || imgSrc;
            
            // Create viewer configuration
            const viewerConfig: any = {
              container: container,
              panorama: initialPanorama,
              navbar: false,
              defaultLong: defaultLong,
              defaultLat: defaultLat,
              mousewheel: false, // Disable zoom with scroll wheel
              touchmoveTwoFingers: !disableInteraction, // Disable touch if interaction disabled
              caption: '',
              loadingImg: undefined, // No loading spinner
              fisheye: false, // Disable fisheye effect
              sphereCorrection: { pan: 0, tilt: 0, roll: 0 }, // No correction
              // Telephoto FOV - narrower field of view for more zoom
              minFov: 30,
              maxFov: 90,
              defaultZoomLvl: 30, // 0 = widest (90° FOV), 30 = more telephoto (~65° FOV), 50 = default (75° FOV)
              // Enable user interaction with explicit moveSpeed (1.0 = normal speed)
              // This ensures drag-to-rotate works properly
              moveSpeed: disableInteraction ? 0 : 1.0, // Explicitly enable dragging when interaction is enabled
            };
            
            // Only add autorotate options if autoRotate is enabled
            if (autoRotate) {
              viewerConfig.autorotateDelay = 0; // Start immediately
              viewerConfig.autorotateIdle = false; // Don't restart on idle
              viewerConfig.autorotateSpeed = autorotateSpeed; // '6rpm' for 360° in 10 seconds
              viewerConfig.autorotateLat = null; // Maintain current latitude (horizon level)
              viewerConfig.autorotateZoomLvl = null; // Preserve current zoom level
            }
            
            viewer = new Viewer(viewerConfig);
            
            // If low-res image was used for initialization, upgrade to high-res after viewer is ready
            if (lowResSrc && lowResSrc !== imgSrc && viewer) {
              // Wait for low-res to load, then replace with high-res
              setTimeout(() => {
                if (viewer && isMounted && typeof viewer.setPanorama === 'function') {
                  try {
                    viewer.setPanorama(imgSrc, {
                      transition: false, // No animation for upgrade
                      showLoader: false, // No spinner during upgrade
                    });
                  } catch (upgradeError) {
                    // Silently handle - low-res is already showing
                  }
                }
              }, 100); // Small delay to ensure low-res is visible first
            }
            
            // If interaction is disabled, prevent all mouse/touch events
            if (disableInteraction && containerRef.current) {
              // Disable pointer events via CSS - prevents all mouse/touch interaction
              containerRef.current.style.pointerEvents = 'none';
            }
          } finally {
            // Restore console methods
            console.error = originalConsoleError;
            console.warn = originalConsoleWarn;
            // Remove unhandled rejection handler
            if (unhandledRejectionHandler) {
              window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
            }
          }
        } catch (viewerError: any) {
          // If viewer creation fails (e.g., container removed), handle gracefully
          if (!isMounted || !containerRef.current) {
            return;
          }
          // Check if it's a classList error, context loss, or DOM cleanup issue
          if (viewerError?.message?.includes('classList') || 
              viewerError?.message?.includes('Cannot read properties') ||
              viewerError?.message?.includes('Context Lost') ||
              viewerError?.message?.includes('context lost') ||
              viewerError?.message?.includes('loader')) {
            // Suppress expected errors during initialization
            return;
          }
          // Only log unexpected errors
          console.error('PanoramaViewer: Unexpected error creating viewer:', viewerError);
          setLoadError(true);
          return;
        }

        viewerRef.current = viewer;
        
        // Expose viewer instance via external ref if provided
        if (externalViewerRef) {
          externalViewerRef.current = viewer;
        }
        
        // CRITICAL: Set up event listeners IMMEDIATELY after viewer creation
        // Photo Sphere Viewer may start loading immediately, so we need listeners ready
        const addListener = viewer.addEventListener || viewer.on;
        if (!addListener) {
          console.error('[PanoramaViewer] ❌ Viewer does not have addEventListener or on method');
          console.error('[PanoramaViewer] Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(viewer)));
          console.error('[PanoramaViewer] Viewer object:', viewer);
          setLoadError(true);
          return;
        }
        
        // Register with WebGL context manager
        const viewerId = viewerIdRef.current;
        const cleanupFn = () => {
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
          }
          if (viewerRef.current) {
            try {
              // Force dispose of Three.js renderer and WebGL context
              const viewer = viewerRef.current;
              if (viewer.renderer && viewer.renderer.dispose) {
                viewer.renderer.dispose();
              }
              // Also try to access and dispose internal Three.js renderer
              if (viewer.psv && viewer.psv.renderer) {
                viewer.psv.renderer.dispose();
                if (viewer.psv.renderer.forceContextLoss) {
                  viewer.psv.renderer.forceContextLoss();
                }
              }
              // Dispose textures and geometries
              if (viewer.scene) {
                viewer.scene.traverse((obj: any) => {
                  if (obj.geometry) obj.geometry.dispose();
                  if (obj.material) {
                    if (Array.isArray(obj.material)) {
                      obj.material.forEach((mat: any) => mat.dispose());
                    } else {
                      obj.material.dispose();
                    }
                  }
                });
              }
              viewer.destroy();
            } catch (e) {
              // Ignore cleanup errors
            }
            viewerRef.current = null;
          }
        };
        webglContextManager.register(viewerId, cleanupFn, priority);

        // Set up loading timeout - if viewer doesn't become ready within 10 seconds, show error
        loadingTimeout = setTimeout(() => {
          if (viewerRef.current && !loadError) {
            console.error('[PanoramaViewer] Loading timeout - viewer did not become ready within 10 seconds');
            console.error('[PanoramaViewer] Image URL:', imgSrc);
            setLoadError(true);
            if (onLoadError) {
              onLoadError();
            }
            try {
              if (viewerRef.current && typeof viewerRef.current.destroy === 'function') {
                viewerRef.current.destroy();
              }
            } catch (e) {
              // Ignore cleanup errors
            }
            viewerRef.current = null;
          }
        }, 10000);
        
        addListener.call(viewer, 'ready', () => {
          clearTimeout(loadingTimeout);
          
          // Check if component is still mounted before updating state
          if (!isMounted || !containerRef.current) {
            if (viewer && typeof viewer.destroy === 'function') {
              try {
                viewer.destroy();
              } catch (e) {
                // Ignore cleanup errors
              }
            }
            return;
          }
          
          setLoadError(false);
          isInitializingRef.current = false; // Mark initialization as complete
          
          // Helper function to get canvas elements (may need to wait for DOM)
          const getCanvasElements = () => {
            if (!containerRef.current) return { container: null, canvas: null };
            return {
              container: containerRef.current.querySelector('.psv-canvas-container') as HTMLElement,
              canvas: containerRef.current.querySelector('.psv-canvas') as HTMLElement
            };
          };
          
          // Set up cursor styles for drag-to-rotate (with small delay to ensure DOM is ready)
          const setupCursor = () => {
            if (disableInteraction) return;
            const { container: canvasContainer, canvas } = getCanvasElements();
            if (canvasContainer && canvas) {
              canvasContainer.style.cursor = "url('/cursors/hand.svg') 16 16, grab";
              canvas.style.cursor = "url('/cursors/hand.svg') 16 16, grab";
            }
          };
          
          // Try immediately, then retry after a short delay if elements not found
          setupCursor();
          setTimeout(setupCursor, 50);
          
          // Set up interaction listeners (for both cursor management and rotation callbacks)
          addListener.call(viewer, 'interaction-start', () => {
            isPanoramaRotatingRef.current = true;
            // Update cursor to grabbing
            if (!disableInteraction) {
              const { container: canvasContainer, canvas } = getCanvasElements();
              if (canvasContainer && canvas) {
                canvasContainer.style.cursor = "url('/cursors/hand.grab.svg') 16 16, grabbing";
                canvas.style.cursor = "url('/cursors/hand.grab.svg') 16 16, grabbing";
              }
            }
          });
          
          addListener.call(viewer, 'interaction-end', () => {
            setTimeout(() => {
              isPanoramaRotatingRef.current = false;
              // Reset cursor to grab
              if (!disableInteraction) {
                const { container: canvasContainer, canvas } = getCanvasElements();
                if (canvasContainer && canvas) {
                  canvasContainer.style.cursor = "url('/cursors/hand.svg') 16 16, grab";
                  canvas.style.cursor = "url('/cursors/hand.svg') 16 16, grab";
                }
              }
            }, 100);
          });
          
          // Auto-rotation is handled by built-in autorotateSpeed option
          if (autoRotate) {
          }
          
          // Listen for position changes (when user drags the panorama)
          if (onRotationChange) {
            
            addListener.call(viewer, 'position-updated', (event: any) => {
              if (!isMounted) return;
              isPanoramaRotatingRef.current = true; // User is actively rotating
              try {
                // Get current position from viewer
                const position = viewer.getPosition();
                if (position && 
                    typeof position.longitude === 'number' && 
                    typeof position.latitude === 'number' &&
                    !Number.isNaN(position.longitude) &&
                    !Number.isNaN(position.latitude) &&
                    Number.isFinite(position.longitude) &&
                    Number.isFinite(position.latitude)) {
                  // Convert from Photo Sphere Viewer coordinates to degrees
                  // Photo Sphere Viewer: longitude in radians (-π to π), latitude in radians (-π/2 to π/2)
                  // longitude: 0 = north, -π/2 = west, π/2 = east
                  // Our yaw: 0° = north, 90° = east, -90° = west
                  // Convert: yaw = (longitude + π/2) * 180/π
                  const yawDeg = ((position.longitude + Math.PI / 2) * 180 / Math.PI);
                  const pitchDeg = (position.latitude * 180 / Math.PI);
                  
                  // Validate converted values before calling callback
                  if (!Number.isNaN(yawDeg) && !Number.isNaN(pitchDeg) &&
                      Number.isFinite(yawDeg) && Number.isFinite(pitchDeg)) {
                    onRotationChange(yawDeg, pitchDeg);
                  } else {
                    console.warn('PanoramaViewer: Invalid position values, skipping callback', {
                      longitude: position.longitude,
                      latitude: position.latitude,
                      yawDeg,
                      pitchDeg
                    });
                  }
                }
              } catch (error) {
                console.error('PanoramaViewer: Error getting position:', error);
              }
            });
            
            // Reset flag when interaction ends (cursor already handled above)
            // Note: interaction-end listener is already set up above for cursor management
          }
        });

        // Handle load errors
        addListener.call(viewer, 'panorama-load-error', (event: any) => {
          clearTimeout(loadingTimeout);
          console.error('[PanoramaViewer] ❌ Failed to load panorama:', {
            imageSrc: imgSrc,
            event: event,
            errorDetails: event?.error || event?.message || 'Unknown error',
            errorType: event?.type,
            fullEvent: event,
          });
          setLoadError(true);
          if (onLoadError) {
            onLoadError();
          }
          if (viewerRef.current) {
            try {
              viewerRef.current.destroy();
            } catch (destroyError) {
              console.error('PanoramaViewer: Error destroying viewer:', destroyError);
            }
            viewerRef.current = null;
          }
        });
        
        // Handle viewer errors
        addListener.call(viewer, 'error', (event: any) => {
          clearTimeout(loadingTimeout);
          console.error('[PanoramaViewer] ❌ Viewer error event:', {
            event: event,
            imageSrc: imgSrc,
            errorDetails: event?.error || event?.message || 'Unknown error',
            fullEvent: event,
          });
          setLoadError(true);
          if (onLoadError) {
            onLoadError();
          }
        });
        
        // Listen for panorama loading start (silent - only log on errors)
        addListener.call(viewer, 'panorama-load-start', () => {
          // Panorama loading started
        });
        
        // Listen for panorama loading progress (silent - only log on errors)
        addListener.call(viewer, 'panorama-load-progress', (event: any) => {
          // Panorama loading progress
        });
        
        // Try to manually trigger load if viewer has a load method
        // Some versions of Photo Sphere Viewer need explicit load call
        setTimeout(() => {
          if (viewerRef.current && !loadError && isMounted) {
            try {
              // Check if panorama is already set
              const currentPanorama = viewerRef.current.getPanorama ? viewerRef.current.getPanorama() : null;
              
              // If panorama doesn't match, try to set it explicitly
              if (currentPanorama !== imgSrc) {
                if (typeof viewerRef.current.setPanorama === 'function') {
                  viewerRef.current.setPanorama(imgSrc);
                } else if (typeof viewerRef.current.load === 'function') {
                  viewerRef.current.load(imgSrc);
                }
              }
            } catch (manualLoadError) {
              // Silently handle - viewer should load automatically
            }
          }
        }, 100);

      } catch (initError: any) {
        console.error('PanoramaViewer: Error creating viewer:', initError);
        setLoadError(true);
        if (onLoadError) {
          onLoadError();
        }
      }
    }

    async function initializeViewer(width: number, height: number) {
      if (!containerRef.current) {
        return;
      }

      // First check if primary image exists before initializing viewer to avoid 404 errors
      const img = new Image();
      
      img.onload = () => {
        // Primary image exists, safe to initialize viewer
        initializeViewerWithImage(imageSrc, width, height).catch((error) => {
          // Errors are already suppressed by global handlers in useEffect
          // Only log if it's not a known photo-sphere-viewer error
          const errorMessage = error?.message || String(error || '');
          const errorStack = error?.stack || '';
          const fullError = errorMessage + ' ' + errorStack;
          if (!((fullError.includes('loader') || 
                 fullError.includes('classList') ||
                 (fullError.includes('Cannot read properties of undefined') && fullError.includes('reading'))) &&
                (fullError.includes('photo-sphere-viewer') || 
                 fullError.includes('photo-sphere-viewer.js') ||
                 fullError.includes('three.cjs')))) {
            console.error('PanoramaViewer: Error in initializeViewerWithImage:', error);
          }
        });
      };
      
      img.onerror = () => {
        // Primary image doesn't exist (404), try fallback if available
        if (fallbackSrc && imageSrc !== fallbackSrc) {
          // Try fallback image
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            // Use fallback image to initialize viewer
            initializeViewerWithImage(fallbackSrc, width, height).catch((error) => {
              // Errors are already suppressed by global handlers in useEffect
              // Only log if it's not a known photo-sphere-viewer error
              const errorMessage = error?.message || String(error || '');
              const errorStack = error?.stack || '';
              const fullError = errorMessage + ' ' + errorStack;
              if (!((fullError.includes('loader') || 
                     fullError.includes('classList') ||
                     (fullError.includes('Cannot read properties of undefined') && fullError.includes('reading'))) &&
                    (fullError.includes('photo-sphere-viewer') || 
                     fullError.includes('photo-sphere-viewer.js') ||
                     fullError.includes('three.cjs')))) {
                console.error('PanoramaViewer: Error in initializeViewerWithImage (fallback):', error);
              }
            });
          };
          fallbackImg.onerror = () => {
            console.warn('PanoramaViewer: Both primary and fallback images failed (404), skipping viewer initialization');
            console.warn('PanoramaViewer: Primary:', imageSrc);
            console.warn('PanoramaViewer: Fallback:', fallbackSrc);
            setLoadError(true);
            if (onLoadError) {
              onLoadError(fallbackSrc);
            }
          };
          fallbackImg.src = fallbackSrc;
        } else {
          // No fallback or already tried fallback
          console.warn('PanoramaViewer: Image does not exist (404), skipping viewer initialization:', imageSrc);
          setLoadError(true);
          if (onLoadError) {
            onLoadError();
          }
        }
      };
      
      // Start checking if primary image exists
      img.src = imageSrc;
    }


    // Cleanup
    return () => {
      // Don't cleanup if we're still initializing (React Strict Mode double-render)
      if (isInitializingRef.current) {
        return;
      }
      
      isMounted = false; // Mark as unmounted to prevent further operations
      isInitializingRef.current = false;
      
      // Unregister from WebGL context manager
      const viewerId = viewerIdRef.current;
      webglContextManager.unregister(viewerId);
      
      // Restore console methods
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
      
      if (dimensionCheckTimeout) {
        clearTimeout(dimensionCheckTimeout);
      }
      if (viewerRef.current) {
        try {
          const viewer = viewerRef.current;
          
          // Force dispose of Three.js renderer and WebGL context
          try {
            if (viewer.renderer) {
              if (viewer.renderer.dispose) {
                viewer.renderer.dispose();
              }
              // Force context loss if available
              if (viewer.renderer.forceContextLoss) {
                viewer.renderer.forceContextLoss();
              }
              if (viewer.renderer.getContext) {
                const gl = viewer.renderer.getContext();
                if (gl && gl.getExtension) {
                  const loseContext = gl.getExtension('WEBGL_lose_context');
                  if (loseContext) {
                    loseContext.loseContext();
                  }
                }
              }
            }
            // Also try internal renderer
            if (viewer.psv && viewer.psv.renderer) {
              if (viewer.psv.renderer.dispose) {
                viewer.psv.renderer.dispose();
              }
              if (viewer.psv.renderer.forceContextLoss) {
                viewer.psv.renderer.forceContextLoss();
              }
            }
            // Dispose scene objects
            if (viewer.scene) {
              viewer.scene.traverse((obj: any) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                  if (Array.isArray(obj.material)) {
                    obj.material.forEach((mat: any) => {
                      if (mat.dispose) mat.dispose();
                      if (mat.map) mat.map.dispose();
                    });
                  } else {
                    if (obj.material.dispose) obj.material.dispose();
                    if (obj.material.map) obj.material.map.dispose();
                  }
                }
              });
            }
          } catch (disposeError) {
            // Ignore disposal errors
          }
          
          // Check if viewer has a destroy method and if container still exists
          if (viewer && typeof viewer.destroy === 'function') {
            // Check if container still exists and is in the DOM
            if (containerRef.current && document.body.contains(containerRef.current)) {
              // Check if viewer's internal container still exists
              try {
                const viewerContainer = viewer.container || viewer._container;
                if (viewerContainer && viewerContainer.parentElement && viewerContainer.classList) {
                  viewer.destroy();
                } else {
                }
              } catch (containerError: any) {
                // Container may be in invalid state (e.g., WebGL context lost)
                if (containerError?.message?.includes('classList') || 
                    containerError?.message?.includes('Cannot read properties') ||
                    containerError?.message?.includes('Context Lost')) {
                  // Silently ignore - container is in invalid state
                } else {
                  // Try destroy anyway if it's a different error
                  try {
                    viewer.destroy();
                  } catch (e) {
                    // Ignore - cleanup failed
                  }
                }
              }
            } else {
            }
          }
        } catch (error: any) {
          // Ignore errors during cleanup - container may already be removed
          // Check if it's specifically a classList error and ignore it
          if (error?.message?.includes('classList') || 
              error?.message?.includes('Cannot read properties') ||
              error?.message?.includes('Context Lost') ||
              error?.message?.includes('context lost')) {
            // Silently ignore - WebGL context loss or DOM cleanup issues
          } else {
          }
        }
        viewerRef.current = null;
      }
    };
  }, [imageSrc, isVisible, initialPitch, initialYaw]); // Depend on key props that affect viewer initialization
  
  // Handle disableInteraction prop - disable pointer events when interaction is disabled
  useEffect(() => {
    if (containerRef.current) {
      if (disableInteraction) {
        containerRef.current.style.pointerEvents = 'none';
      } else {
        containerRef.current.style.pointerEvents = 'auto';
      }
    }
  }, [disableInteraction]);
  
  // Handle external rotation updates (from 3D camera)
  useEffect(() => {
    // Validate that both values are defined and are valid numbers (not NaN)
    if (!viewerRef.current || 
        externalYaw === undefined || 
        externalPitch === undefined ||
        Number.isNaN(externalYaw) ||
        Number.isNaN(externalPitch) ||
        !Number.isFinite(externalYaw) ||
        !Number.isFinite(externalPitch)) {
      return;
    }
    
    // Prevent updating if user is currently rotating the panorama
    if (isPanoramaRotatingRef.current) {
      return;
    }
    
    try {
      // Convert from degrees to Photo Sphere Viewer coordinates
      // Photo Sphere Viewer uses:
      // - longitude: -π to π, where 0 = north, -π/2 = west, π/2 = east
      // - latitude: -π/2 to π/2, where 0 = horizon, positive = up, negative = down
      // Our yaw: 0° = north, 90° = east, -90° = west, 180° = south
      // Convert: longitude = (yaw - 90) * π/180
      const longitude = ((externalYaw - 90) * Math.PI / 180);
      // Pitch: positive = up, negative = down, same as Photo Sphere Viewer
      const latitude = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, externalPitch * Math.PI / 180));
      
      // Validate converted values are not NaN before passing to viewer
      if (Number.isNaN(longitude) || Number.isNaN(latitude) || 
          !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        console.warn('PanoramaViewer: Invalid rotation values, skipping update', {
          externalYaw,
          externalPitch,
          longitude,
          latitude
        });
        return;
      }
      
      const viewer = viewerRef.current;
      
      // Photo Sphere Viewer 4.x API: try setPosition first (most reliable)
      // The viewer object should have this method since getPosition() works
      let updated = false;
      if (typeof viewer.setPosition === 'function') {
        viewer.setPosition({ longitude, latitude });
        updated = true;
      } else if (viewer.psv && typeof viewer.psv.setPosition === 'function') {
        viewer.psv.setPosition({ longitude, latitude });
        updated = true;
      } else if (typeof viewer.rotate === 'function') {
        viewer.rotate({ longitude, latitude });
        updated = true;
      } else if (viewer.psv && typeof viewer.psv.rotate === 'function') {
        viewer.psv.rotate({ longitude, latitude });
        updated = true;
      } else {
        // Try to access internal PSV instance
        const psv = (viewer as any).psv || (viewer as any)._psv || (viewer as any).viewer || viewer;
        if (psv) {
          if (typeof psv.setPosition === 'function') {
            psv.setPosition({ longitude, latitude });
            updated = true;
          } else if (typeof psv.rotate === 'function') {
            psv.rotate({ longitude, latitude });
            updated = true;
          }
        }
        
        if (!updated) {
          // Log for debugging - only once to avoid spam
          if (!(viewer as any)._rotationWarningLogged) {
            console.warn('PanoramaViewer: Rotation update method not found', {
              externalYaw,
              externalPitch,
              longitude: longitude.toFixed(4),
              latitude: latitude.toFixed(4),
              hasGetPosition: typeof viewer.getPosition === 'function',
              viewerKeys: Object.keys(viewer).filter(k => 
                k.toLowerCase().includes('position') || 
                k.toLowerCase().includes('rotate') || 
                k.toLowerCase().includes('set') ||
                k.toLowerCase().includes('longitude') ||
                k.toLowerCase().includes('latitude')
              ),
            });
            (viewer as any)._rotationWarningLogged = true;
          }
        }
      }
    } catch (error) {
      console.error('PanoramaViewer: Error updating external rotation:', error);
    }
  }, [externalYaw, externalPitch]);

  // Always render the container - if there's a load error, it will be transparent and fallback image shows through
  // If not visible yet, show a placeholder to reserve space
  if (!isVisible) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          ...style,
        }}
      />
    );
  }

  return (
    <>
      <style jsx global>{`
        .psv-container,
        .psv-canvas-container,
        .psv-canvas {
          overflow: hidden !important;
          touch-action: pan-x pan-y !important; /* Critical for drag behavior */
          cursor: url('/cursors/hand.svg') 16 16, grab !important; /* Grab cursor for dragging */
        }
        .psv-container {
          width: 100% !important;
          height: 100% !important;
        }
        .psv-canvas-container {
          width: 100% !important;
          height: 100% !important;
        }
        .psv-canvas {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
        /* Change cursor to grabbing when actively dragging */
        .psv-container.psv--has-navbar .psv-canvas-container,
        .psv-container .psv-canvas-container {
          cursor: url('/cursors/hand.svg') 16 16, grab !important;
        }
        .psv-container.psv--capture-event .psv-canvas-container,
        .psv-container.psv--capture-event .psv-canvas {
          cursor: url('/cursors/hand.grab.svg') 16 16, grabbing !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: loadError ? 'transparent' : 'transparent',
          zIndex: loadError ? 0 : 3, // Higher z-index to ensure it's above fallback image
          pointerEvents: loadError || disableInteraction ? 'none' : 'auto',
          opacity: loadError ? 0 : 1,
          display: loadError ? 'none' : 'block', // Hide completely on error
          ...style,
        }}
      />
    </>
  );
}


