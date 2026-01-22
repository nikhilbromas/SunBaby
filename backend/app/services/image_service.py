"""
Service for managing Images.
Handles image upload, compression, storage, and database operations.
"""
import os
import base64
from typing import List, Optional
from datetime import datetime
from PIL import Image
from io import BytesIO
from app.database import db
from app.models.image import ImageCreate, ImageResponse
import logging

logger = logging.getLogger(__name__)

# Allowed image MIME types
ALLOWED_MIME_TYPES = {
    'image/jpeg': 'JPEG',
    'image/jpg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WEBP'
}

# Base upload directory
UPLOAD_BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'images')


class ImageService:
    """Service for image management."""
    
    def __init__(self):
        """Initialize image service."""
        # Ensure base upload directory exists
        os.makedirs(UPLOAD_BASE_DIR, exist_ok=True)
    
    def _get_company_upload_dir(self, company_id: int) -> str:
        """Get upload directory for a company."""
        company_dir = os.path.join(UPLOAD_BASE_DIR, str(company_id))
        os.makedirs(company_dir, exist_ok=True)
        return company_dir
    
    def _compress_image(self, image: Image.Image, mime_type: str, quality: int = 80) -> bytes:
        """
        Compress image to specified quality.
        
        Args:
            image: PIL Image object
            mime_type: MIME type of the image
            quality: Compression quality (0-100)
            
        Returns:
            Compressed image bytes
        """
        output = BytesIO()
        
        # Determine format
        if mime_type in ['image/jpeg', 'image/jpg']:
            format = 'JPEG'
            # Convert RGBA to RGB for JPEG
            if image.mode == 'RGBA':
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                rgb_image.paste(image, mask=image.split()[3] if image.mode == 'RGBA' else None)
                image = rgb_image
        elif mime_type == 'image/png':
            format = 'PNG'
            # PNG uses optimize flag instead of quality
            image.save(output, format=format, optimize=True)
            return output.getvalue()
        elif mime_type == 'image/gif':
            format = 'GIF'
            # GIF doesn't support quality, just optimize
            image.save(output, format=format, optimize=True)
            return output.getvalue()
        elif mime_type == 'image/webp':
            format = 'WEBP'
        else:
            format = 'PNG'
        
        # Save with compression
        if format in ['JPEG', 'WEBP']:
            image.save(output, format=format, quality=quality, optimize=True)
        else:
            image.save(output, format=format, optimize=True)
        
        return output.getvalue()
    
    def upload_image(self, file_content: bytes, filename: str, mime_type: str, company_id: int, created_by: Optional[str] = None) -> ImageResponse:
        """
        Upload and process an image.
        
        Args:
            file_content: Image file content as bytes
            filename: Original filename
            mime_type: MIME type of the image
            company_id: Company ID
            created_by: User who uploaded the image
            
        Returns:
            Created image response
            
        Raises:
            ValueError: If file type is not supported or image processing fails
        """
        # Validate MIME type
        if mime_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"Unsupported image type: {mime_type}. Allowed types: {', '.join(ALLOWED_MIME_TYPES.keys())}")
        
        try:
            # Open and process image
            image = Image.open(BytesIO(file_content))
            
            # Get image dimensions
            width, height = image.size
            
            # Compress image (80% quality)
            compressed_content = self._compress_image(image, mime_type, quality=80)
            file_size = len(compressed_content)
            
            # Generate file path
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            safe_filename = "".join(c for c in filename if c.isalnum() or c in (' ', '-', '_', '.')).strip()
            file_extension = os.path.splitext(filename)[1] or ('.jpg' if mime_type in ['image/jpeg', 'image/jpg'] else '.png')
            stored_filename = f"{timestamp}_{safe_filename}{file_extension}"
            
            company_dir = self._get_company_upload_dir(company_id)
            file_path = os.path.join(company_dir, stored_filename)
            
            # Save to file system
            with open(file_path, 'wb') as f:
                f.write(compressed_content)
            
            # Generate base64
            base64_data = base64.b64encode(compressed_content).decode('utf-8')
            # Add data URI prefix
            base64_data_uri = f"data:{mime_type};base64,{base64_data}"
            
            # Store in database
            image_create = ImageCreate(
                ImageName=filename,
                FilePath=file_path,
                Base64Data=base64_data_uri,
                FileSize=file_size,
                Width=width,
                Height=height,
                MimeType=mime_type,
                CreatedBy=created_by
            )
            
            insert_query = """
                INSERT INTO ReportImages (ImageName, FilePath, Base64Data, FileSize, Width, Height, MimeType, CreatedBy)
                OUTPUT INSERTED.*
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            with db.get_connection() as conn:
                cursor = conn.cursor()
                try:
                    cursor.execute(
                        insert_query,
                        (
                            image_create.imageName,
                            image_create.filePath,
                            image_create.base64Data,
                            image_create.fileSize,
                            image_create.width,
                            image_create.height,
                            image_create.mimeType,
                            image_create.createdBy
                        )
                    )
                    row = cursor.fetchone()
                    conn.commit()
                    
                    if row:
                        return self._row_to_image_response(row)
                    else:
                        raise Exception("Failed to create image record")
                finally:
                    cursor.close()
        
        except Exception as e:
            logger.error(f"Error processing image: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to process image: {str(e)}")
    
    def get_image(self, image_id: int, company_id: Optional[int] = None) -> Optional[ImageResponse]:
        """
        Get image by ID.
        
        Args:
            image_id: Image ID
            company_id: Optional company ID for validation (if provided, checks file path)
            
        Returns:
            Image or None if not found
        """
        query = "SELECT * FROM ReportImages WHERE ImageId = ? AND IsActive = 1"
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(query, (image_id,))
                row = cursor.fetchone()
                
                if row:
                    image = self._row_to_image_response(row)
                    # Optional: Validate company_id matches file path
                    if company_id is not None:
                        expected_path_prefix = os.path.join(UPLOAD_BASE_DIR, str(company_id))
                        if not image.FilePath.startswith(expected_path_prefix):
                            logger.warning(f"Image {image_id} path doesn't match company_id {company_id}")
                            return None
                    return image
                return None
            finally:
                cursor.close()
    
    def list_images(self, company_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> tuple[List[ImageResponse], int]:
        """
        List all active images.
        
        Args:
            company_id: Optional company ID to filter by file path
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            Tuple of (images list, total count)
        """
        if company_id is not None:
            # Filter by company path prefix
            path_prefix = os.path.join(UPLOAD_BASE_DIR, str(company_id))
            count_query = """
                SELECT COUNT(*) FROM ReportImages 
                WHERE IsActive = 1 AND FilePath LIKE ?
            """
            list_query = """
                SELECT * FROM ReportImages 
                WHERE IsActive = 1 AND FilePath LIKE ?
                ORDER BY CreatedOn DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            path_pattern = f"{path_prefix}%"
            count_params = (path_pattern,)
            list_params = (path_pattern, skip, limit)
        else:
            count_query = "SELECT COUNT(*) FROM ReportImages WHERE IsActive = 1"
            list_query = """
                SELECT * FROM ReportImages 
                WHERE IsActive = 1 
                ORDER BY CreatedOn DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
            """
            count_params = ()
            list_params = (skip, limit)
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                # Get total count
                cursor.execute(count_query, count_params)
                total = cursor.fetchone()[0]
                
                # Get images
                cursor.execute(list_query, list_params)
                rows = cursor.fetchall()
                
                images = [self._row_to_image_response(row) for row in rows]
                return images, total
            finally:
                cursor.close()
    
    def delete_image(self, image_id: int, company_id: Optional[int] = None) -> bool:
        """
        Soft delete an image (set IsActive = 0).
        
        Args:
            image_id: Image ID
            company_id: Optional company ID for validation
            
        Returns:
            True if deleted, False if not found
        """
        # First get the image to validate company_id if provided
        if company_id is not None:
            image = self.get_image(image_id, company_id)
            if not image:
                return False
        
        update_query = """
            UPDATE ReportImages 
            SET IsActive = 0
            WHERE ImageId = ? AND IsActive = 1
        """
        
        with db.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(update_query, (image_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                cursor.close()
    
    def _row_to_image_response(self, row) -> ImageResponse:
        """Convert database row to ImageResponse."""
        return ImageResponse(
            ImageId=row[0],
            ImageName=row[1],
            FilePath=row[2],
            Base64Data=row[3],
            FileSize=row[4],
            Width=row[5],
            Height=row[6],
            MimeType=row[7],
            CreatedBy=row[8] if len(row) > 8 else None,
            CreatedOn=row[9] if len(row) > 9 else datetime.now(),
            IsActive=bool(row[10] if len(row) > 10 else True)
        )


# Global service instance
image_service = ImageService()

