# Dynamic Bill Preview & Template Designer System

A full-stack system for creating dynamic bill/report previews with visual template design capabilities.

## Features

- **SQL Preset Management**: Technical users can create and manage SQL query presets with parameter validation
- **Visual Template Designer**: Non-technical users can design bill templates using a drag-and-drop canvas interface
- **Real-time Preview**: End users can input parameters and preview bills instantly
- **Export Capabilities**: Print and PDF export functionality
- **Security**: SQL injection prevention with SELECT-only query validation

## Architecture

- **Backend**: FastAPI (Python) with MSSQL database
- **Frontend**: React + TypeScript with Vite
- **Template Engine**: Jinja2 for HTML rendering
- **PDF Export**: WeasyPrint

## Prerequisites

- Python 3.8+
- Node.js 18+
- MSSQL Server
- ODBC Driver for SQL Server

## Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

5. Run database migrations:
```bash
# Execute the SQL script in migrations/001_initial_schema.sql on your MSSQL database
```

6. Start the backend server:
```bash
python -m uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

## Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file (optional):
```bash
# Create .env file if you need to customize API URL
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env
```

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Environment Variables

### Backend (.env)

```env
# Database Configuration
DB_SERVER=localhost
DB_NAME=SunBabyDB
DB_USER=sa
DB_PASSWORD=your_password_here
DB_DRIVER=ODBC Driver 17 for SQL Server
DB_TRUSTED_CONNECTION=False

# API Configuration
API_PREFIX=/api/v1

# CORS Configuration (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Security Configuration
ALLOWED_TABLES=BillHeader,BillItem,Products,Customers
MAX_QUERY_ROWS=1000

# Export Configuration
PDF_EXPORT_ENABLED=True
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Usage

### 1. Create SQL Presets (Technical Users)

1. Navigate to "Presets" in the application
2. Click "Create New Preset"
3. Enter preset name and SQL queries:
   - Header Query: `SELECT * FROM BillHeader WHERE BillId = @BillId`
   - Item Query: `SELECT * FROM BillItem WHERE BillId = @BillId`
4. Specify expected parameters (comma-separated)
5. Save the preset

### 2. Design Templates (Non-Technical Users)

1. Navigate to "Template Designer"
2. Select a preset from the dropdown
3. Drag elements from the toolbar:
   - **Text Field**: For header information
   - **Items Table**: For item lists
4. Click on elements to edit properties:
   - Label, binding path, position, visibility
   - Font size, weight, color
5. Save the template

### 3. Preview Bills (End Users)

1. Navigate to "Preview"
2. Select a template
3. Enter required parameters
4. Click "Generate Preview"
5. Use "Print" or "Export PDF" buttons

## API Endpoints

### Presets
- `GET /api/v1/presets` - List all presets
- `GET /api/v1/presets/{id}` - Get preset by ID
- `POST /api/v1/presets` - Create new preset
- `PUT /api/v1/presets/{id}` - Update preset
- `DELETE /api/v1/presets/{id}` - Delete preset

### Templates
- `GET /api/v1/templates` - List templates
- `GET /api/v1/templates/{id}` - Get template by ID
- `POST /api/v1/templates` - Create new template
- `PUT /api/v1/templates/{id}` - Update template
- `DELETE /api/v1/templates/{id}` - Delete template

### Preview
- `POST /api/v1/preview/html` - Generate HTML preview
- `POST /api/v1/preview/pdf` - Generate PDF preview
- `GET /api/v1/preview/data/{template_id}` - Get preview data

## Security Features

- **SQL Validation**: Only SELECT queries allowed
- **Parameterized Queries**: Prevents SQL injection
- **Keyword Filtering**: Blocks dangerous SQL keywords
- **Table Whitelist**: Optional table/view access control

## Project Structure

```
SunBaby/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI endpoints
│   │   ├── models/       # Pydantic models
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utilities (SQL validator, template engine)
│   │   ├── config.py     # Configuration
│   │   ├── database.py   # Database connection
│   │   └── main.py       # FastAPI app
│   ├── migrations/       # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API client and types
│   │   └── styles/       # CSS files
│   └── package.json
└── README.md
```

## Development

### Backend Development

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

```bash
cd frontend
npm run dev
```

### Building for Production

**Backend:**
```bash
# No build step needed, just deploy the Python code
```

**Frontend:**
```bash
cd frontend
npm run build
# Output in dist/ directory
```

## Troubleshooting

### Database Connection Issues

- Verify ODBC driver is installed
- Check connection string in `.env`
- Ensure SQL Server is running and accessible
- Test connection with `pyodbc` directly

### PDF Export Not Working

- Install WeasyPrint: `pip install weasyprint`
- On Linux, may need additional system dependencies
- Check `PDF_EXPORT_ENABLED` in `.env`

### CORS Errors

- Add frontend URL to `CORS_ORIGINS` in backend `.env`
- Restart backend server after changes

## Future Enhancements

- Authentication/authorization system
- Multi-language template support
- Role-based access control
- Cloud storage integration
- GST breakup views
- QR code generation
- Template versioning
- Batch processing

## License

[Specify your license here]

## Support

For issues and questions, please [create an issue](link-to-issues) or contact the development team.

