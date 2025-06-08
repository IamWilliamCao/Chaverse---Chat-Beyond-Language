from flask import Flask, request, jsonify
from deep_translator import GoogleTranslator
from langdetect import detect
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app, resources={r"/translate": {"origins": "*"}})

def add_flair(text):
    # Customize or randomize emojis here if you want
    return f"🌟 {text} 💬✨"

@app.route('/translate', methods=['POST'])
def translate_text():
    data = request.json
    text = data.get('text')
    source_lang = data.get('source', 'auto')
    target_lang = data.get('target', 'en')
    add_emojis = data.get('flair', False)

    if not text:
        return jsonify({'error': 'No text provided'}), 400

    try:
        if source_lang == 'auto':
            detected = detect(text)
            source_lang = detected
        else:
            detected = source_lang

        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)
        if add_emojis:
            translated = add_flair(translated)

        return jsonify({
            'translatedText': translated,
            'detectedSource': detected
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
