import React, { useState, useEffect, useRef } from 'react';
import { useDrag } from 'react-dnd';
import apiClient from '../../services/api';
import type { Image } from '../../services/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Upload, Loader2 } from 'lucide-react';
import './ImageGallery.css';

const ImageGallery: React.FC = () => {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getImages(0, 100);
      setImages(response.images);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    try {
      setUploading(true);
      const uploadedImage = await apiClient.uploadImage(file);
      setImages((prev) => [uploadedImage, ...prev]);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const ImageCard: React.FC<{ image: Image }> = ({ image }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'image',
      item: {
        type: 'image',
        imageId: image.ImageId,
        base64Data: image.Base64Data,
        width: image.Width,
        height: image.Height,
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    return (
      <div
        ref={drag}
        className={`image-card ${isDragging ? 'dragging' : ''}`}
        title="Drag to canvas to add image"
      >
        <div className="image-card-thumbnail">
          <img src={image.Base64Data} alt={image.ImageName} />
        </div>
        <div className="image-card-info">
          <div className="image-card-name" title={image.ImageName}>
            {image.ImageName}
          </div>
          <div className="image-card-dimensions">
            {image.Width} × {image.Height}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="image-gallery">
      <div className="image-gallery-header">
        <h3>Images</h3>
        <Button
          variant="outline"
          size="sm"
          className="upload-button"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} className="mr-2" />
              Upload
            </>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {loading ? (
        <div className="image-gallery-loading">Loading images...</div>
      ) : images.length === 0 ? (
        <div className="image-gallery-empty">
          <p>No images uploaded yet.</p>
          <p>Click "Upload" to add images.</p>
        </div>
      ) : (
        <div className="image-gallery-grid">
          {images.map((image) => (
            <ImageCard key={image.ImageId} image={image} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageGallery;

