from flask import Flask, render_template, request, jsonify, g
import ebooklib
from ebooklib import epub
from bs4 import BeautifulSoup
import re
from collections import defaultdict
import os
import random
import requests
import time
from datetime import datetime
import sqlite3
import threading
import queue
import uuid
import logging

app = Flask(__name__)

# Configuration
class Config:
    UPLOAD_FOLDER = 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    DATABASE = 'bookfeed.db'
    ALLOWED_EXTENSIONS = {'epub'}
    OLLAMA_BASE_URL = 'http://localhost:11434'
    ITEMS_PER_PAGE = 10
    MAX_QUOTE_LENGTH = 280
    MIN_QUOTE_LENGTH = 50

app.config.from_object(Config)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database management
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(
            app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

app.teardown_appcontext(close_db)

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                quote_id TEXT NOT NULL,
                book_title TEXT NOT NULL,
                user_message TEXT NOT NULL,
                ai_response TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                context TEXT
            )
        ''')
        db.commit()

# Initialize database
init_db()

class OllamaClient:
    def __init__(self, base_url=app.config['OLLAMA_BASE_URL']):
        self.base_url = base_url
        self.retry_count = 3
        self.retry_delay = 1
        self.timeout = 30

    def generate_response(self, prompt, context, book_title):
        formatted_prompt = f"""You're a casual Twitter user in a quote discussion thread. Be casual and authentic!

    The quote is from "{book_title}": {context}

    Someone just tweeted: "{prompt}"

    Pick a random Twitter personality type for your response:
    - The Witty Intellectual (loves clever wordplay and "actually..." moments)
    - The Enthusiastic Reactor (uses lots of "OMG" and "THIS!!")
    - The Chill Observer (keeps it lowkey with "ngl" and "fr fr")
    - The Devil's Advocate (starts with "hot take but...")
    - The Meme Lord (references trending formats)
    - The Thread Explainer (breaks it down with numbered points)

    Reply in your chosen personality style! Keep it:
    - Super casual and conversational
    - Use common Twitter slang/abbreviations
    - Maybe throw in some emojis
    - Reference the quote but don't be too formal
    - Stay on topic but make it fun
    - Keep the Twitter energy but actually be helpful
    - dont use emojis or hashtags be casual and dont be to exagerated

    Quote tweet vibe, but make it make sense! Go:"""

    # Rest of the method remains the same

        for attempt in range(self.retry_count):
            try:
                response = requests.post(
                    f'{self.base_url}/api/generate',
                    json={
                        'model': 'llama3.2:3b',
                        'prompt': formatted_prompt,
                        'stream': False,
                        'temperature': 0.8,  # Slightly increased for more creative responses
                        'max_tokens': 150,   # Reduced to encourage conciseness
                        'top_p': 0.9,
                        'frequency_penalty': 0.7,
                        'stop': ['\n', 'User:', 'Response:']  # Stop generation at these tokens
                    },
                    timeout=self.timeout
                )
                
                if response.status_code == 200:
                    ai_response = response.json()['response']
                    
                    # Better truncation logic
                    if len(ai_response) > app.config['MAX_QUOTE_LENGTH']:
                        # Find the last complete sentence within length limit
                        last_period = ai_response[:277].rfind('.')
                        last_exclamation = ai_response[:277].rfind('!')
                        last_question = ai_response[:277].rfind('?')
                        
                        # Get the last valid sentence end
                        end_pos = max(last_period, last_exclamation, last_question)
                        
                        if end_pos > 0:
                            ai_response = ai_response[:end_pos + 1]
                        else:
                            # If no sentence end found, truncate at last space
                            last_space = ai_response[:277].rfind(' ')
                            ai_response = ai_response[:last_space] + '...'
                    
                    return ai_response
                    
            except requests.exceptions.RequestException as e:
                logger.error(f"Ollama request failed (attempt {attempt + 1}): {str(e)}")
                if attempt == self.retry_count - 1:
                    raise Exception(f"Failed to connect to Ollama after {self.retry_count} attempts")
                time.sleep(self.retry_delay * (attempt + 1))
                
        raise Exception("Failed to generate response")

ollama_client = OllamaClient()

class BookProcessor:
    def __init__(self):
        self.books = defaultdict(list)
        self.book_titles = set()
        
    def clean_text(self, text):
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def split_into_sentences(self, text):
        sentences = []
        current = []
        in_quote = False
        
        for char in text:
            current.append(char)
            if char == '"':
                in_quote = not in_quote
            elif char in '.!?' and not in_quote and len(current) > app.config['MIN_QUOTE_LENGTH']:
                sentence = ''.join(current).strip()
                if sentence:
                    sentences.append(sentence)
                current = []
        
        if current:
            sentence = ''.join(current).strip()
            if sentence:
                sentences.append(sentence)
                
        return sentences

    def is_interesting_sentence(self, sentence):
        if len(sentence) < app.config['MIN_QUOTE_LENGTH'] or len(sentence) > app.config['MAX_QUOTE_LENGTH']:
            return False
            
        if re.match(r'^(chapter|section|figure|table|note|reference)', sentence.lower()):
            return False
            
        interesting_patterns = [
            r'\b(but|however|therefore|thus|hence|because)\b',
            r'\b(discover|reveal|find|realize|understand|know)\b',
            r'\b(important|significant|crucial|essential|key|vital)\b',
            r'[?!]$',
            r'"[^"]+"',
            r'\b(I|we|you)\b',
            r'\b(never|always|must|should)\b',
            r'\b(like|as if|seems)\b',
        ]
        
        return any(re.search(pattern, sentence, re.IGNORECASE) for pattern in interesting_patterns)

    def process_epub(self, file_path):
        try:
            logger.info(f"Processing EPUB file: {file_path}")
            book = epub.read_epub(file_path)
            book_title = book.get_metadata('DC', 'title')[0][0]
            self.book_titles.add(book_title)
            
            quotes_count = 0
            for i, item in enumerate(book.get_items()):
                if item.get_type() == ebooklib.ITEM_DOCUMENT:
                    soup = BeautifulSoup(item.get_content(), 'html.parser')
                    
                    # Try to extract chapter title
                    chapter_title = None
                    for header in soup.find_all(['h1', 'h2', 'h3']):
                        if header.text.strip():
                            chapter_title = header.text.strip()
                            break
                    
                    chapter_text = self.clean_text(soup.get_text())
                    sentences = self.split_into_sentences(chapter_text)
                    
                    for j, sentence in enumerate(sentences):
                        if self.is_interesting_sentence(sentence):
                            context = self.get_context(sentences, j)
                            self.books[book_title].append({
                                'id': str(uuid.uuid4()),
                                'preview': sentence,
                                'full_text': context,
                                'book_title': book_title,
                                'chapter': chapter_title or f"Chapter {i + 1}",
                                'position': f"Part {i + 1}, Paragraph {j + 1}"
                            })
                            quotes_count += 1
            
            logger.info(f"Successfully processed {book_title}: {quotes_count} quotes extracted")
            return True
        except Exception as e:
            logger.error(f"Error processing {file_path}: {str(e)}")
            return False

    def get_context(self, sentences, current_idx):
        start = max(0, current_idx - 1)
        end = min(len(sentences), current_idx + 2)
        return ' '.join(sentences[start:end])

    def get_feed_items(self, page=0, items_per_page=10, selected_books=None):
        try:
            all_items = []
            books_to_use = selected_books if selected_books else self.books.keys()
            
            logger.info(f"Generating feed - Page: {page}, Items: {items_per_page}, Books: {books_to_use}")
            logger.info(f"Available books: {self.book_titles}")
            
            for book_title in books_to_use:
                if book_title in self.books:
                    all_items.extend(self.books[book_title])
            
            logger.info(f"Total items before pagination: {len(all_items)}")
            
            # Randomize all items
            random.shuffle(all_items)
            
            # Get the subset for the current page
            start = page * items_per_page
            end = start + items_per_page
            items = all_items[start:end]
            
            logger.info(f"Returning {len(items)} items for page {page}")
            return items
            
        except Exception as e:
            logger.error(f"Error in get_feed_items: {str(e)}")
            return []

    def remove_book(self, book_title):
        if book_title in self.books:
            del self.books[book_title]
            self.book_titles.remove(book_title)
            return True
        return False

processor = BookProcessor()

# Routes
@app.route('/')
def index():
    return render_template('index.html', books=list(processor.book_titles))

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'files' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    files = request.files.getlist('files')
    if not files:
        return jsonify({'error': 'No selected file'}), 400
    
    successful_uploads = []
    failed_uploads = []
    
    try:
        for file in files:
            if file.filename.endswith('.epub'):
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
                file.save(filepath)
                
                logger.info(f"Processing uploaded file: {file.filename}")
                if processor.process_epub(filepath):
                    successful_uploads.append(file.filename)
                    logger.info(f"Successfully processed: {file.filename}")
                else:
                    failed_uploads.append(file.filename)
                    logger.error(f"Failed to process: {file.filename}")
            else:
                failed_uploads.append(file.filename)
        
        logger.info(f"Current books: {processor.book_titles}")
        logger.info(f"Total quotes: {sum(len(quotes) for quotes in processor.books.values())}")
        
        return jsonify({
            'status': 'success',
            'successful_uploads': successful_uploads,
            'failed_uploads': failed_uploads,
            'feed': processor.get_feed_items(page=0),
            'books': list(processor.book_titles)
        })
            
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/feed')
def get_feed():
    try:
        page = int(request.args.get('page', 0))
        items_per_page = int(request.args.get('items_per_page', 10))
        books = request.args.get('books', '').split(',')
        selected_books = [b for b in books if b.strip()]
        
        logger.info(f"Feed request - Page: {page}, Items: {items_per_page}, Books: {selected_books}")
        
        feed_items = processor.get_feed_items(
            page=page,
            items_per_page=items_per_page,
            selected_books=selected_books if selected_books else None
        )
        
        logger.info(f"Generated feed items: {len(feed_items)}")
        
        return jsonify({
            'status': 'success',
            'feed': feed_items,
            'has_more': len(feed_items) == items_per_page,
            'next_page': page + 1 if len(feed_items) == items_per_page else None
        })
    except Exception as e:
        logger.error(f"Feed generation error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/remove-book', methods=['POST'])
def remove_book():
    try:
        data = request.get_json()
        book_title = data.get('book')
        
        if not book_title:
            return jsonify({
                'success': False,
                'error': 'No book title provided'
            }), 400
        
        if processor.remove_book(book_title):
            logger.info(f"Removed book: {book_title}")
            return jsonify({
                'success': True,
                'message': f'Successfully removed {book_title}'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Book not found'
            }), 404
            
    except Exception as e:
        logger.error(f"Book removal error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    
    required_fields = ['message', 'context', 'book_title', 'quote_id']
    if not all(field in data for field in required_fields):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    try:
        ai_response = ollama_client.generate_response(
            data['message'],
            data['context'],
            data['book_title']
        )
        
        with get_db() as conn:
            conn.execute('''
                INSERT INTO comments 
                (quote_id, book_title, user_message, ai_response, context)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                data['quote_id'],
                data['book_title'],
                data['message'],
                ai_response,
                data['context']
            ))
            
        return jsonify({
            'success': True,
            'response': ai_response,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/comments/<quote_id>', methods=['GET'])
def get_comments(quote_id):
    try:
        with get_db() as conn:
            conn.row_factory = sqlite3.Row
            comments = conn.execute('''
                SELECT * FROM comments 
                WHERE quote_id = ?
                ORDER BY timestamp ASC
            ''', (quote_id,)).fetchall()
            
        return jsonify({
            'success': True,
            'comments': [{
                'id': c['id'],
                'user_message': c['user_message'],
                'ai_response': c['ai_response'],
                'timestamp': c['timestamp']
            } for c in comments]
        })
        
    except Exception as e:
        logger.error(f"Comments retrieval error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.errorhandler(413)
def too_large(e):
    return jsonify({
        'error': 'File is too large. Maximum size is 16MB'
    }), 413

if __name__ == '__main__':
    app.run(debug=True)