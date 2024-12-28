

```markdown
# BookFeed

A web application that transforms EPUB books into an interactive social media-like feed with AI-powered discussions.

## Quick Start

### Prerequisites
- Python 3.8+
- Ollama (for AI chat functionality)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/bookfeed.git
cd bookfeed
```

2. Install dependencies:
```bash
pip install flask ebooklib beautifulsoup4 requests
```

3. Install and start Ollama:
Visit [Ollama's website](https://ollama.ai/) for installation instructions.
```bash
ollama run llama3.2:8B [customize to a different model as required]
```

4. Run the application:
```bash
python app.py
```

The application will be available at `http://127.0.0.1:5000`

### Troubleshooting

If you encounter the "Address already in use" error on port 5000:

#### On macOS:
1. Go to System Preferences
2. Navigate to General → AirDrop & Handoff
3. Disable 'AirPlay Receiver'

Or use a different port:
```bash
flask run --port 5001
```

## Usage

1. Upload EPUB Books:
   - Click the "Upload" button
   - Select your EPUB file(s)
   - Wait for processing to complete

2. Interact with Quotes:
   - View quote context with "Source"
   - Save favorite quotes
   - Share quotes
   - Engage in AI-powered discussions

3. Navigation:
   - Filter by specific books
   - Infinite scroll for more content
   - Toggle dark/light theme

## Project Structure
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

## Features
- 📚 EPUB book processing
- 🔄 Dynamic feed generation
- 💬 AI-powered discussions
- 🎨 Dark/Light theme
- 📱 Responsive design
- 💾 Quote management
- 📤 Social sharing

## Development

The application uses:
- Flask for the backend
- SQLite for comment storage
- Ollama for AI chat functionality
- Vanilla JavaScript for frontend
- CSS3 with variables for theming

## License

[Your chosen license]
```

This README is:
- More focused on getting started quickly
- Includes the port 5000 issue you encountered
- Shows the actual file structure you're working with
- Removes unnecessary complexity
- Focuses on practical usage

You can further customize it based on your specific needs or add more sections as the project evolves.
