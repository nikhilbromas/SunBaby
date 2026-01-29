"""
Service for exporting bills to PDF and other formats.
"""
from typing import Optional
from app.config import settings


class ExportService:
    """Service for exporting bills."""
    
    def __init__(self):
        """Initialize export service."""
        self.pdf_enabled = settings.PDF_EXPORT_ENABLED
        self._weasyprint_available = self._check_weasyprint()
    
    def _check_weasyprint(self) -> bool:
        """Check if WeasyPrint is available."""
        try:
            import weasyprint
            # Try to actually use it to verify it works
            from weasyprint import HTML
            return True
        except (ImportError, OSError) as e:
            pass
            return False
    
    def export_to_pdf(self, html_content: str, output_path: Optional[str] = None) -> bytes:
        """
        Export HTML content to PDF.
        
        Args:
            html_content: HTML content to export
            output_path: Optional file path to save PDF
            
        Returns:
            PDF bytes
            
        Raises:
            RuntimeError: If PDF export is not available
        """
        if not self.pdf_enabled:
            raise RuntimeError("PDF export is disabled")
        
        if not self._weasyprint_available:
            raise RuntimeError("WeasyPrint is not installed. Install it with: pip install weasyprint")
        
        try:
            from weasyprint import HTML, CSS
            from io import BytesIO
            
            # Generate PDF from HTML with proper page settings
            html_doc = HTML(string=html_content)
            
            # Create CSS for better PDF rendering
            pdf_css = CSS(string='''
                @page {
                    size: auto;
                    margin: 0;
                }
                * {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    color-adjust: exact;
                }
                body {
                    margin: 0;
                    padding: 0;
                }
            ''')
            
            pdf_bytes = html_doc.write_pdf(
                stylesheets=[pdf_css],
                optimize_images=True,
                presentational_hints=True
            )
            
            # Save to file if path provided
            if output_path:
                with open(output_path, 'wb') as f:
                    f.write(pdf_bytes)
            
            return pdf_bytes
        except Exception as e:
            raise
            raise RuntimeError(f"Failed to generate PDF: {str(e)}")
    
    def export_to_html_file(self, html_content: str, output_path: str) -> None:
        """
        Export HTML content to file.
        
        Args:
            html_content: HTML content to export
            output_path: File path to save HTML
        """
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
        except Exception as e:
            raise
            raise RuntimeError(f"Failed to save HTML file: {str(e)}")


# Global export service instance
export_service = ExportService()

