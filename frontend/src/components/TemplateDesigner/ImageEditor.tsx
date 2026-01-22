import React, { useState, useEffect } from 'react';
import type { ImageFieldConfig } from '../../services/types';
import apiClient from '../../services/api';
import './ImageEditor.css';

interface ImageEditorProps {
  imageField: ImageFieldConfig;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ImageFieldConfig>) => void;
  onDelete: () => void;
  section?: 'pageHeader' | 'pageFooter' | 'header' | 'billContent' | 'billFooter';
}

const ImageEditor: React.FC<ImageEditorProps> = ({
  imageField,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLButtonElement) {
      return;
    }
    if (imageRef.current) {
      // Find the section zone container
      let parent = imageRef.current.parentElement;
      while (parent && !parent.classList.contains('section-zone')) {
        parent = parent.parentElement;
      }
      
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        setIsDragging(true);
        setDragStart({ 
          x: e.clientX - parentRect.left - imageField.x, 
          y: e.clientY - parentRect.top - imageField.y 
        });
        onSelect();
        e.preventDefault();
        e.stopPropagation();
      } else {
        // Fallback
        setIsDragging(true);
        setDragStart({ x: e.clientX - imageField.x, y: e.clientY - imageField.y });
        onSelect();
      }
    }
  };

  useEffect(() => {
    if (isDragging) {
      let animationFrameId: number | null = null;
      
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        
        animationFrameId = requestAnimationFrame(() => {
          if (imageRef.current) {
            let parent = imageRef.current.parentElement;
            while (parent && !parent.classList.contains('section-zone')) {
              parent = parent.parentElement;
            }
            
            if (parent) {
              const parentRect = parent.getBoundingClientRect();
              const newX = e.clientX - parentRect.left - dragStart.x;
              const newY = e.clientY - parentRect.top - dragStart.y;
              const clampedX = Math.max(0, Math.min(newX, parentRect.width - (imageField.width || 100)));
              const clampedY = Math.max(0, Math.min(newY, parentRect.height - (imageField.height || 100)));
              setPosition({ x: clampedX, y: clampedY });
              onUpdate({ x: clampedX, y: clampedY });
            } else {
              const newX = e.clientX - dragStart.x;
              const newY = e.clientY - dragStart.y;
              setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
              onUpdate({ x: Math.max(0, newX), y: Math.max(0, newY) });
            }
          }
        });
      };
      
      const handleGlobalMouseUp = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        setIsDragging(false);
      };
      
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragStart, onUpdate, imageField.width, imageField.height]);

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

