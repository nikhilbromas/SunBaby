
import json
import logging
import sys

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Mock imports/setup if needed
sys.path.append('g:\\SunBaby\\backend')

from app.utils.pdf_generator import PDFGenerator

def reproduce():
    pdf_gen = PDFGenerator()
    
    # Template with two tables in billContent
    # Table 1 at y=0
    # Table 2 at y=100
    template_config = {
        "page": {
            "size": "A4",
            "orientation": "portrait"
        },
        "sectionHeights": {
            "pageHeader": 50,
            "billHeader": 100,
            "billContent": 500, # Large enough to fit both on one page if they don't overlap
            "pageFooter": 50
        },
        "header": [],
        "pageHeader": [
            {"label": "Page Header", "x": 50, "y": 20, "visible": True}
        ],
        "pageFooter": [
             {"label": "Page Footer", "x": 50, "y": 20, "visible": True}
        ],
        "billContent": [],
        "billContentTables": [
            {
                "x": 50, "y": 0, "width": 500, "columns": [
                    {"label": "Item", "bind": "name", "width": 200},
                    {"label": "Cost", "bind": "cost", "width": 100}
                ],
                "cellPadding": 5, "fontSize": 12 
                # Row height approx: 12 + 10 + 2 = 24. Header = 24.
            },
            {
                "x": 50, "y": 100, "width": 500, "columns": [ # y=100 is the static position
                    {"label": "Tax", "bind": "tax", "width": 200},
                    {"label": "Amount", "bind": "amount", "width": 100}
                ],
                "cellPadding": 5, "fontSize": 12
            }
        ],
        "billFooter": []
    }
    
    # Data - Table 1 has enough rows to push past y=100
    # One row height ~ 24pts. 
    # 5 rows = 5 * 24 = 120pts + header 24 = 144pts.
    # This should overlap with Table 2 at y=100.
    data = {
        "items": [
            {"name": f"Item {i}", "cost": f"{i*10}"} for i in range(1, 10)
        ],
        "contentDetails": {}
    }
    
    try:
        pdf_bytes = pdf_gen.generate_pdf(json.dumps(template_config), data)
        print(f"PDF generated, size: {len(pdf_bytes)} bytes")
        # In a real scenario I'd save this to a file and inspect, 
        # but here I'm relying on the logs I'll add or the analysis.
        with open("test_output.pdf", "wb") as f:
            f.write(pdf_bytes)
        print("Saved test_output.pdf")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    reproduce()
