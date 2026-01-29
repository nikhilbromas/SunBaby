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
        className={cn(
          'bg-black border border-white/20 rounded-md overflow-hidden cursor-grab transition-all',
          'hover:border-white/40 hover:shadow-lg hover:-translate-y-0.5',
          isDragging && 'opacity-60 cursor-grabbing scale-95'
        )}
        title="Drag to canvas to add image"
      >
        <div className="w-full aspect-square overflow-hidden bg-black/50 flex items-center justify-center">
          <img src={image.Base64Data} alt={image.ImageName} className="w-full h-full object-cover" />
        </div>
        <div className="p-3 bg-black">
          <div className="text-xs font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis mb-1" title={image.ImageName}>
            {image.ImageName}
          </div>
          <div className="text-[0.7rem] text-white/60">
            {image.Width} × {image.Height}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-white/20 bg-black p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-3">
        <h3 className="text-base font-semibold text-white">
          Images
        </h3>
  
        <Button
          variant="outline"
          size="sm"
          className="border-white/30 text-black hover:text-white hover:bg-black"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin text-black" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} className="mr-2 text-black" />
              Upload
            </>
          )}
        </Button>
  
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
  
      {/* Content */}
      {loading ? (
        <div className="text-sm text-white/60 py-8 text-center">
          Loading images…
        </div>
      ) : images.length === 0 ? (
        <div className="py-10 text-center space-y-1">
          <p className="text-sm text-white/80">
            No images uploaded yet.
          </p>
          <p className="text-xs text-white/60">
            Click <span className="font-medium text-white">Upload</span> to add images.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image) => (
            <ImageCard key={image.ImageId} image={image} />
          ))}
        </div>
      )}
    </div>
  );
  
};

export default ImageGallery;

