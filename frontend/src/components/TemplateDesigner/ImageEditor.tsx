import React, { useState, useEffect } from 'react';
import type { ImageFieldConfig } from '../../services/types';
import apiClient from '../../services/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import './ImageEditor.css';

interface ImageEditorProps {
  imageField: ImageFieldConfig;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ImageFieldConfig>) => void;
  onDelete: () => void;
  section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
  canvasZoom?: number;
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  imageField,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  canvasZoom = 1,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: imageField.x, y: imageField.y });
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [shouldLoadImage, setShouldLoadImage] = useState(false);
  const imageRef = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setPosition({ x: imageField.x, y: imageField.y });
  }, [imageField.x, imageField.y]);

  // Lazy load images using Intersection Observer - only load when visible or after delay
  useEffect(() => {
    // Defer image loading - wait for templates to render first
    const loadDelay = setTimeout(() => {
      setShouldLoadImage(true);
    }, 500); // Wait 500ms after component mounts to let templates render first

    return () => clearTimeout(loadDelay);
  }, []);

  // Load image when shouldLoadImage is true
  useEffect(() => {
    if (!shouldLoadImage) return;

    const loadImage = async () => {
      try {
        const image = await apiClient.getImage(imageField.imageId);
        setImageData(image.Base64Data);
        setImageDimensions({ width: image.Width, height: image.Height });
      } catch (error) {
        console.error('Error loading image:', error);
      }
    };

    // Use Intersection Observer to load only when visible (or after delay if already visible)
    if (imageRef.current) {
      // Check if already visible
      const rect = imageRef.current.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;

      if (isVisible) {
        // Already visible, load immediately
        loadImage();
      } else {
        // Not visible yet, use Intersection Observer
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                loadImage();
                // Stop observing once loaded
                if (observerRef.current && imageRef.current) {
                  observerRef.current.unobserve(imageRef.current);
                }
              }
            });
          },
          { rootMargin: '50px' } // Start loading 50px before element is visible
        );

        observerRef.current.observe(imageRef.current);
      }
    }

    return () => {
      if (observerRef.current && imageRef.current) {
        observerRef.current.unobserve(imageRef.current);
      }
    };
  }, [shouldLoadImage, imageField.imageId]);

  // Helper function to get parent section zone
  const getParentSectionZone = (): HTMLElement | null => {
    if (!imageRef.current) return null;
    let parent = imageRef.current.parentElement;
    while (parent && !parent.classList.contains('section-zone')) {
      parent = parent.parentElement;
    }
    return parent;
  };

  // Shared drag start logic for both mouse and touch
  const startDrag = (clientX: number, clientY: number) => {
    const parent = getParentSectionZone();
    const zoom = canvasZoom || 1;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      setIsDragging(true);
      // Account for zoom: screen coordinates to canvas coordinates
      setDragStart({ 
        x: (clientX - parentRect.left) / zoom - imageField.x, 
        y: (clientY - parentRect.top) / zoom - imageField.y 
      });
      onSelect();
    } else {
      // Fallback
      setIsDragging(true);
      setDragStart({ x: clientX / zoom - imageField.x, y: clientY / zoom - imageField.y });
      onSelect();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement) {
      return;
    }
    if (imageRef.current) {
      startDrag(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Touch event handler for mobile drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.target instanceof HTMLButtonElement) {
      return;
    }
    if (e.touches.length === 1 && imageRef.current) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (isDragging) {
      let animationFrameId: number | null = null;
      
      // Shared move logic for both mouse and touch
      const handleMove = (clientX: number, clientY: number) => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        
        const zoom = canvasZoom || 1;
        animationFrameId = requestAnimationFrame(() => {
          const parent = getParentSectionZone();
          if (parent) {
            const parentRect = parent.getBoundingClientRect();
            // Convert screen coordinates to canvas coordinates
            const newX = (clientX - parentRect.left) / zoom - dragStart.x;
            const newY = (clientY - parentRect.top) / zoom - dragStart.y;
            // Clamp using canvas dimensions (not screen dimensions)
            const parentWidth = parentRect.width / zoom;
            const parentHeight = parentRect.height / zoom;
            const clampedX = Math.max(0, Math.min(newX, parentWidth - (imageField.width || 100)));
            const clampedY = Math.max(0, Math.min(newY, parentHeight - (imageField.height || 100)));
            setPosition({ x: clampedX, y: clampedY });
            onUpdate({ x: clampedX, y: clampedY });
          } else {
            const newX = clientX / zoom - dragStart.x;
            const newY = clientY / zoom - dragStart.y;
            setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
            onUpdate({ x: Math.max(0, newX), y: Math.max(0, newY) });
          }
        });
      };

      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMove(e.clientX, e.clientY);
      };
      
      const handleGlobalTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          e.preventDefault(); // Prevent scrolling while dragging
          const touch = e.touches[0];
          handleMove(touch.clientX, touch.clientY);
        }
      };
      
      const handleGlobalMouseUp = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        setIsDragging(false);
      };
      
      const handleGlobalTouchEnd = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        setIsDragging(false);
      };
      
      // Add mouse and touch event listeners
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);
      document.addEventListener('touchcancel', handleGlobalTouchEnd);
      
      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        document.removeEventListener('touchcancel', handleGlobalTouchEnd);
      };
    }
  }, [isDragging, dragStart, onUpdate, imageField.width, imageField.height, canvasZoom]);

  if (!imageField.visible) {
    return null;
  }

  const displayWidth = imageField.width || (imageDimensions?.width || 100);
  const displayHeight = imageField.height || (imageDimensions?.height || 100);

  return (
    <div
      ref={imageRef}
      className={`image-editor ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${imageField.watermark ? 'watermark' : ''}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        opacity: imageField.watermark ? 0.3 : 1,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e) => {
        if (e.target instanceof HTMLButtonElement) {
          return;
        }
        onSelect();
        e.stopPropagation();
      }}
      title={imageField.watermark ? 'Watermark (renders behind content)' : undefined}
    >
      {imageData ? (
        <img
          src={imageData}
          alt="Template image"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div className="image-editor-placeholder">Loading...</div>
      )}
      {isSelected && (
        <button
          className="image-editor-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete image"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ImageEditor;

