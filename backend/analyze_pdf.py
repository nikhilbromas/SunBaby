
import sys
import logging

try:
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LTTextContainer, LTTextLine, LTTextBox
except ImportError:
    print("pdfminer.six not installed. Cannot analyze structure.")
    sys.exit(1)

def analyze_pdf(path):
    print(f"Analyzing {path}...")
    for page_layout in extract_pages(path):
        print(f"--- Page {page_layout.pageid} ---")
        element_bboxes = []
        for element in page_layout:
            if isinstance(element, (LTTextContainer, LTTextBox)):
                text = element.get_text().strip()
                if text:
                    # ReportLab Y is bottom-up. PDFMiner Y is bottom-up.
                    # bbox: (x0, y0, x1, y1) -> (left, bottom, right, top)
                    print(f"Text: '{text[:20]}...' at bbox={element.bbox}")
                    element_bboxes.append((text, element.bbox))
        
        # Check for overlaps
        for i, (t1, b1) in enumerate(element_bboxes):
            for j, (t2, b2) in enumerate(element_bboxes):
                if i >= j: continue
                
                # b: (x0, y0, x1, y1)
                # Overlap if rectangles intersect
                if (b1[0] < b2[2] and b1[2] > b2[0] and
                    b1[1] < b2[3] and b1[3] > b2[1]):
                     print(f"WARNING: OVERLAP DETECTED between '{t1[:10]}' and '{t2[:10]}'")


if __name__ == "__main__":
    analyze_pdf("g:\\SunBaby\\backend\\ret.pdf")
