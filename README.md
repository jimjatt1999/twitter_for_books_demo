# BookFeed

A modern web application that transforms EPUB books into an interactive social media-like feed of quotations with AI-powered discussions.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Technical Architecture](#technical-architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Code Structure](#code-structure)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Development Guide](#development-guide)

## Overview

BookFeed is a Flask-based web application that extracts meaningful quotes from EPUB books and presents them in a Twitter-like feed interface. Users can interact with quotes through comments, engage in AI-powered discussions, save favorite quotes, and share insights.

### Key Features
- 📚 EPUB book processing and quote extraction
- 🔄 Dynamic feed generation with infinite scroll
- 💬 AI-powered discussions using Ollama
- 🎨 Dark/Light theme support
- 📱 Responsive design
- 💾 Quote saving and management
- 📤 Social sharing capabilities

## Technical Architecture

### Backend (Python/Flask)
- **Flask**: Web framework
- **SQLite**: Database for comments storage
- **ebooklib**: EPUB file processing
- **BeautifulSoup4**: HTML parsing
- **Ollama**: Local AI model integration

### Frontend
- **Vanilla JavaScript**: Core functionality
- **CSS3**: Styling with CSS variables
- **HTML5**: Semantic markup
- **SVG Icons**: Vector graphics

## Installation

### Prerequisites
- Python 3.8+
- Ollama (for AI chat functionality)
- Git

### Setup Steps

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bookfeed.git
cd bookfeed
```

2. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Install and start Ollama:
```bash
# Follow Ollama installation instructions from: https://ollama.ai/
ollama run llama2
```

5. Initialize the database:
```bash
flask init-db
```

6. Start the application:
```bash
flask run
```

## Usage

### Adding Books
1. Click the "Upload" button
2. Select one or more EPUB files
3. Wait for processing to complete

### Interacting with Quotes
- **Source**: View the quote's context and chapter information
- **Save**: Add quotes to your saved collection
- **Share**: Copy or share quotes externally
- **Comments**: Engage in AI-powered discussions

### Feed Controls
- Use book filters to view specific books
- Generate new feed for different quotes
- Scroll for more content
- Toggle between light and dark themes

## Code Structure

```
bookfeed/
├── app.py              # Main Flask application
├── static/
│   ├── css/
│   │   └── style.css   # Styling
│   └── js/
│       └── main.js     # Frontend functionality
├── templates/
│   └── index.html      # Main template
├── uploads/            # Book storage
└── bookfeed.db        # SQLite database
```

### Key Components

#### BookProcessor Class
Handles EPUB processing and quote extraction:
```python
class BookProcessor:
    def process_epub(self, file_path):
        # Process EPUB files
        # Extract quotes
        # Store in memory
```

#### OllamaClient Class
Manages AI interactions:
```python
class OllamaClient:
    def generate_response(self, prompt, context, book_title):
        # Generate AI responses
        # Handle retries and errors
```

#### Frontend State Management
```javascript
const state = {
    currentPage: 0,
    itemsPerPage: 10,
    activeBooks: new Set(),
    savedQuotes: [],
    currentQuoteId: null,
    isLoading: false,
    hasMore: true
};
```

## API Documentation

### Endpoints

#### `POST /upload`
Upload and process EPUB files
```json
{
    "status": "success",
    "successful_uploads": ["book1.epub"],
    "failed_uploads": [],
    "feed": [...],
    "books": [...]
}
```

#### `GET /feed`
Get feed items
```json
{
    "status": "success",
    "feed": [...],
    "has_more": true,
    "next_page": 1
}
```

#### `POST /chat`
Submit comment for AI response
```json
{
    "success": true,
    "response": "AI response text",
    "timestamp": "2024-01-01T00:00:00"
}
```

## Configuration

### App Configuration
```python
class Config:
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    DATABASE = 'bookfeed.db'
    ALLOWED_EXTENSIONS = {'epub'}
    OLLAMA_BASE_URL = 'http://localhost:11434'
    ITEMS_PER_PAGE = 10
    MAX_QUOTE_LENGTH = 280
    MIN_QUOTE_LENGTH = 50
```

### Theme Configuration
```css
:root {
    --background-light: #ffffff;
    --text-light: #0f1419;
    /* ... other theme variables */
}
```

## Troubleshooting

### Common Issues

1. **Feed Not Loading**
   - Check browser console for errors
   - Verify book processing completed
   - Check server logs

2. **AI Chat Not Working**
   - Ensure Ollama is running
   - Check Ollama model availability
   - Verify network connectivity

3. **Book Upload Fails**
   - Check file size (max 16MB)
   - Verify EPUB format
   - Check upload folder permissions

## Development Guide

### Adding New Features

1. **New Quote Actions**
```javascript
const quoteActions = {
    newAction(button) {
        // Implementation
    }
};
```

2. **Custom Book Processing**
```python
def custom_processing(self, text):
    # Implementation
```

### Best Practices

1. **Error Handling**
   - Always use try-catch blocks
   - Provide user feedback
   - Log errors properly

2. **Performance**
   - Implement pagination
   - Use document fragments
   - Optimize book processing

3. **UI/UX**
   - Maintain consistent styling
   - Provide loading states
   - Add user feedback

### Testing

```bash
# Run Python tests
python -m pytest tests/

# Check JavaScript console
console.log('Debug information');
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Submit pull request

## License

